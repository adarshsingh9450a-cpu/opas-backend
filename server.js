const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

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

// 4. Data Save karne ka Rasta (POST)
app.post('/api/clients', async (req, res) => {
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
            DO UPDATE SET data = $2
        `;
        await pool.query(query, [mobile, data]);
        res.send("Data Successfully Saved!");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error saving data");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`OPAS Micro Finance Pvt Ltd Server running on port ${PORT}`);
});
