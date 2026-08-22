const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // 🌟 NAYA: JWT Import
require('dotenv').config();

// 🌟 NAYA: Security Keys
const SECRET_KEY = process.env.JWT_SECRET || 'OPAS_SUPER_SECRET_KEY_2026'; 
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pass@1989';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Payload size badha diya 800+ clients ke liye

// PostgreSQL Database Connection Setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10, // Neon DB ke connections limit ko handle karne ke liye
    idleTimeoutMillis: 30000
});

// ==========================================
// 🌟 NAYA: JWT AUTHENTICATION MIDDLEWARE
// ==========================================
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ success: false, message: "Token required for authentication." });
    
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid Token." });
    }
};

// ==========================================
// 🌟 NAYA: SECURE LOGIN ROUTE
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    // 1. Admin (Head) Check
    if (username === 'head01' && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'head', username }, SECRET_KEY, { expiresIn: '48h' });
        return res.json({ success: true, role: 'head', token });
    }

    // 2. Staff Check (Database se)
    try {
        const result = await pool.query("SELECT data FROM clients WHERE mobile = 'SYSTEM_SETTINGS'");
        const sysData = result.rows[0]?.data;
        
        if (sysData && sysData.staff && sysData.staff[username]) {
            if (sysData.staff[username].pass === password) {
                const token = jwt.sign({ role: 'staff', username }, SECRET_KEY, { expiresIn: '48h' });
                return res.json({ success: true, role: 'staff', token });
            }
        }
        res.status(401).json({ success: false, message: "Galat Username ya Password!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

// 1. Test Route (Optimized Connection)
app.get('/', async (req, res) => {
    try {
        await pool.query('SELECT 1'); // Simple ping check
        res.send("Database connection SUCCESSFUL! OPAS Micro Finance Pvt Ltd Backend zinda hai. 🚀");
    } catch (err) {
        console.error(err);
        res.status(500).send("Database connection Error: " + err.message);
    }
});

// 2. Database Setup Route (Table banane ke liye)
app.get('/setup', async (req, res) => {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS clients (
                mobile VARCHAR(15) PRIMARY KEY,
                data JSONB
            );
        `;
        await pool.query(createTableQuery); // Removed manual connect/release leak
        res.send("Badhai ho! Database mein Tables successfully ban gayi hain. 🚀");
    } catch (err) {
        console.error(err);
        res.status(500).send("Table banane mein error aaya: " + err.message);
    }
});

// 3. Data Lane ka Rasta (GET)
app.get('/api/clients', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM clients');
        const dbObj = {};
        result.rows.forEach(row => {
            // Null check yahan bhi lagaya taki galti se aage kachra na jaye
            if (row.data && row.data !== "null") {
                dbObj[row.mobile] = row.data;
            }
        });
        res.json(dbObj);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching data");
    }
});

// 4. Data Save karne ka Rasta (POST) - 🔒 SECURED
app.post('/api/clients', verifyToken, async (req, res) => {
    try {
        const { mobile, data } = req.body;

        if (!mobile) {
            return res.status(400).send("Mobile number is required!");
        }

        // 🚨 THE ZOMBIE KILLER: Agar frontend se delete order aaye, toh DB se permanently uda do
        if (data === null || data === "null") {
            await pool.query('DELETE FROM clients WHERE mobile = $1', [mobile]);
            return res.send("Client permanently wiped from Database!");
        }

        // Normal Upsert Logic
        const query = `
            INSERT INTO clients (mobile, data) 
            VALUES ($1, $2) 
            ON CONFLICT (mobile) 
            DO UPDATE SET data = EXCLUDED.data
        `;
        await pool.query(query, [mobile, data]);
        res.send("Data Successfully Saved!");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error saving data");
    }
});

// 5. Bulk Data Save karne ka Rasta (Day-End ke liye POST) - 🔒 SECURED
app.post('/api/clients/bulk', verifyToken, async (req, res) => {
    // Transaction shuru karne ke liye client connect karte hain
    const client = await pool.connect();
    try {
        const { clients } = req.body;
        if (!clients || !Array.isArray(clients)) {
            return res.status(400).send("Invalid bulk payload format!");
        }

        await client.query('BEGIN'); // SQL Transaction Start
        
        const query = `
            INSERT INTO clients (mobile, data) 
            VALUES ($1, $2) 
            ON CONFLICT (mobile) 
            DO UPDATE SET data = $2
        `;
        
        // Loop through all clients safely
        for (let c of clients) {
            if (c.data === null || c.data === "null") {
                await client.query('DELETE FROM clients WHERE mobile = $1', [c.mobile]);
            } else {
                await client.query(query, [c.mobile, c.data]);
            }
        }
        
        await client.query('COMMIT'); // Data safe hai toh save kar do
        res.send("Bulk Data Successfully Saved!");
    } catch (err) {
        await client.query('ROLLBACK'); // Agar kisi ek mein bhi error aaya, toh saara revert kar do
        console.error("Bulk sync error:", err);
        res.status(500).send("Error saving bulk data");
    } finally {
        client.release(); // Connection wapas pool mein bhej do
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`OPAS Micro Finance Pvt Ltd Server running on port ${PORT}`);
});
