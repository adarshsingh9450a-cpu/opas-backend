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
// 🚀 FIX: Smart CORS (Web + Future Android App Support)
const allowedOrigins = ['https://dulcet-yeot-abd9fa.netlify.app', 'http://localhost:3000', 'capacitor://localhost', 'http://localhost'];
app.use(cors({
    origin: function (origin, callback) {
        // 🚀 FIX: Strict Origin Check to prevent Postman/cURL abuse. 
        // Note: Capacitor apps use capacitor://localhost which is safely handled in allowedOrigins
        if (allowedOrigins.includes(origin) || (origin && origin.endsWith('.onrender.com'))) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by OPAS Security (CORS)'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' })); // 🌟 NAYA: 50MB limit Day-End bulk array array ke liye

// PostgreSQL Database Connection Setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 40, // 🚀 FIX: Increased to 40 for handling multiple staff Day-End syncs
    idleTimeoutMillis: 10000, // 🚀 FIX: Free up dead connections in 10s instead of 30s
    connectionTimeoutMillis: 5000
});

pool.on('error', (err, client) => {
    console.error('Neon DB Idle Connection Error Handled:', err);
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

    // 2. Staff Check (Nayi SQL Table se - Fast & Secure)
    try {
        const result = await pool.query("SELECT password FROM staff WHERE username = $1", [username]);
        
        if (result.rows.length > 0) {
            if (result.rows[0].password === password) {
                const token = jwt.sign({ role: 'staff', username }, SECRET_KEY, { expiresIn: '48h' });
                return res.json({ success: true, role: 'staff', token });
            }
        }
        res.status(401).json({ success: false, message: "Galat Username ya Password!" });
    } catch (err) {
        console.error("Login Error:", err);
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

// 2. Database Setup Route (Secret Key Protected)
app.get('/setup', async (req, res) => {
    const { key } = req.query;
    // Environment variable se aayega, warna fallback password
    const SETUP_KEY = process.env.SETUP_KEY || 'opas2026';
    if (key !== SETUP_KEY) {
        return res.status(403).send("Access Denied! Galat Secret Key.");
    }

    try {
        // Nayi proper Relational Tables banayenge
        const createTablesQuery = `
            -- 1. Purani table toh rahegi hi (Safety ke liye)
            CREATE TABLE IF NOT EXISTS clients (
                mobile VARCHAR(15) PRIMARY KEY,
                data JSONB
            );

            -- 2. Staff ki alag table (Overwriting bug khatam karne ke liye)
            CREATE TABLE IF NOT EXISTS staff (
                username VARCHAR(50) PRIMARY KEY,
                password VARCHAR(100),
                name VARCHAR(100),
                branch VARCHAR(100),
                details JSONB
            );

            -- 3. Master Plans ki alag table
            CREATE TABLE IF NOT EXISTS loan_plans (
                id VARCHAR(50) PRIMARY KEY,
                plan_data JSONB
            );

            -- 4. Branches aur Centres ki alag table
            CREATE TABLE IF NOT EXISTS branches_data (
                id VARCHAR(50) PRIMARY KEY,
                type VARCHAR(20), -- 'branch' ya 'centre'
                name VARCHAR(100),
                parent_branch VARCHAR(100),
                details JSONB
            );
        `;
        
        await pool.query(createTablesQuery);
        res.send("Phase 2 Step 1 Complete! ✅ Saari nayi tables database me successfully ban gayi hain.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Table banane mein error aaya: " + err.message);
    }
});

// ==========================================
// 🚀 PHASE 2: DATA MIGRATION SCRIPT
// ==========================================
app.get('/migrate', async (req, res) => {
    const { key } = req.query;
    // 🚀 FIX: Use Secure Environment Variable instead of hardcoded string
    const SETUP_KEY = process.env.SETUP_KEY || 'opas2026';
    if (key !== SETUP_KEY) return res.status(403).send("Access Denied! Galat Secret Key.");

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Purana SYSTEM_SETTINGS fetch karo
        const result = await client.query("SELECT data FROM clients WHERE mobile = 'SYSTEM_SETTINGS'");
        const sysData = result.rows[0]?.data;

        if (!sysData) {
            await client.query('ROLLBACK');
            return res.send("SYSTEM_SETTINGS nahi mila. Shayad pehle hi shift ho chuka hai ya DB khali hai.");
        }

        // 2. Staff Data Shift
        if (sysData.staff) {
            for (const [username, details] of Object.entries(sysData.staff)) {
                const pass = details.pass || '1234';
                const name = details.name || username;
                const branch = details.branch || 'Unknown';
                await client.query(
                    `INSERT INTO staff (username, password, name, branch, details) 
                     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING`,
                    [username, pass, name, branch, details]
                );
            }
        }

        // 3. Master Plans Shift
        if (sysData.loanPlans) {
            for (const plan of sysData.loanPlans) {
                await client.query(
                    `INSERT INTO loan_plans (id, plan_data) 
                     VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
                    [plan.id, plan]
                );
            }
        }

        // 4. Branches Shift
        if (sysData.branches) {
            for (const branch of sysData.branches) {
                const bId = 'b_' + branch.replace(/\s+/g, '_').toLowerCase();
                await client.query(
                    `INSERT INTO branches_data (id, type, name, parent_branch, details) 
                     VALUES ($1, 'branch', $2, NULL, '{}') ON CONFLICT (id) DO NOTHING`,
                    [bId, branch]
                );
            }
        }

        // 5. Centres Shift
        if (sysData.centres) {
            for (const centre of sysData.centres) {
                await client.query(
                    `INSERT INTO branches_data (id, type, name, parent_branch, details) 
                     VALUES ($1, 'centre', $2, $3, '{}') ON CONFLICT (id) DO NOTHING`,
                    [centre.id, centre.name, centre.branch]
                );
            }
        }

        await client.query('COMMIT');
        res.send("Phase 2 Step 2 Complete! ✅ Purana JSON data safely nayi SQL tables me shift ho gaya hai.");
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Migration Error: " + err.message);
    } finally {
        if (client) client.release();
    }
});

// 3. Data Lane ka Rasta (GET) - 🚀 PAGINATION ENGINE ADDED & SECURED
app.get('/api/clients', verifyToken, async (req, res) => {
    try {
        // 🚀 FIX: Cursor-Based Pagination (Zero Data Loss & High Speed)
        const limit = parseInt(req.query.limit) || 5000;
        const lastMobile = req.query.lastMobile || ''; // Pichla aakhiri ID
        
        // Data sequentially layega bina kisi row ko miss kiye
        const result = await pool.query('SELECT * FROM clients WHERE mobile > $1 ORDER BY mobile ASC LIMIT $2', [lastMobile, limit]);
        
        const dbObj = {};
        result.rows.forEach(row => {
            if (row.data && row.data !== "null") {
                dbObj[row.mobile] = row.data;
            }
        });
        
        res.json(dbObj);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching paginated data");
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

        // 🌟 NAYA: Smart Interceptor - Nayi SQL tables aur Purane JSON ko Sync rakhne ke liye
        if (mobile === 'SYSTEM_SETTINGS') {
            
            // 1. Staff Sync (Upsert + DELETE Zombies)
            if (data.staff) {
                const activeStaff = Object.keys(data.staff);
                for (const [username, details] of Object.entries(data.staff)) {
                    await pool.query(
                        `INSERT INTO staff (username, password, name, branch, details) 
                         VALUES ($1, $2, $3, $4, $5) 
                         ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name, branch = EXCLUDED.branch, details = EXCLUDED.details`,
                        [username, details.pass || '1234', details.name || username, details.branch || 'Unknown', details]
                    );
                }
                // 🚨 ZOMBIE KILLER: Delete fired staff from SQL so they can't login
                if (activeStaff.length > 0) {
                    await pool.query(`DELETE FROM staff WHERE username != ALL($1::varchar[]) AND username != 'head01'`, [activeStaff]);
                } else {
                    await pool.query(`DELETE FROM staff WHERE username != 'head01'`);
                }
            }
            
            // 2. Loan Plans Sync
            if (data.loanPlans) {
                const activePlans = data.loanPlans.map(p => p.id);
                for (const plan of data.loanPlans) {
                    await pool.query(`INSERT INTO loan_plans (id, plan_data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET plan_data = EXCLUDED.plan_data`, [plan.id, plan]);
                }
                if (activePlans.length > 0) {
                    await pool.query(`DELETE FROM loan_plans WHERE id != ALL($1::varchar[])`, [activePlans]);
                } else {
                    await pool.query(`DELETE FROM loan_plans`);
                }
            }
            
            // 3. Branches & Centres Sync
            if (data.branches && data.centres) {
                const activeBranches = [];
                for (const branch of data.branches) {
                    const bId = 'b_' + branch.replace(/\s+/g, '_').toLowerCase();
                    activeBranches.push(bId);
                    await pool.query(`INSERT INTO branches_data (id, type, name, parent_branch, details) VALUES ($1, 'branch', $2, NULL, '{}') ON CONFLICT (id) DO NOTHING`, [bId, branch]);
                }
                for (const centre of data.centres) {
                    activeBranches.push(centre.id);
                    await pool.query(`INSERT INTO branches_data (id, type, name, parent_branch, details) VALUES ($1, 'centre', $2, $3, '{}') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, parent_branch = EXCLUDED.parent_branch`, [centre.id, centre.name, centre.branch]);
                }
                if (activeBranches.length > 0) {
                    await pool.query(`DELETE FROM branches_data WHERE id != ALL($1::varchar[])`, [activeBranches]);
                } else {
                    await pool.query(`DELETE FROM branches_data`);
                }
            }
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

// 5. Bulk Data Save karne ka Rasta (Day-End ke liye POST) - 🔒 SECURED & SUPERFAST
app.post('/api/clients/bulk', verifyToken, async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const { clients } = req.body;
        if (!clients || !Array.isArray(clients)) {
            return res.status(400).send("Invalid bulk payload format!");
        }

        await client.query('BEGIN'); // SQL Transaction Start
        
        // 1. Delete aur Upsert wale clients ko alag-alag filter kar lo
        const toDelete = clients.filter(c => c.data === null || c.data === "null").map(c => String(c.mobile));
        const toUpsert = clients.filter(c => c.data !== null && c.data !== "null");

        // 2. Ek hi jhatke mein saare delete maaro (agar koi hai toh)
        if (toDelete.length > 0) {
            await client.query('DELETE FROM clients WHERE mobile = ANY($1::varchar[])', [toDelete]);
        }

        // 3. SUPERFAST BATCH UPSERT: Ek single query mein saare clients save
        if (toUpsert.length > 0) {
            const mobiles = toUpsert.map(c => String(c.mobile));
            // 🚀 FIX: `pg` library array of objects ko [object Object] padhti hai. Isse prevent karne ke liye stringify karna zaroori hai.
            const dataJsons = toUpsert.map(c => JSON.stringify(c.data)); 

            const bulkQuery = `
                INSERT INTO clients (mobile, data) 
                SELECT * FROM UNNEST($1::varchar[], $2::jsonb[])
                ON CONFLICT (mobile) 
                DO UPDATE SET data = EXCLUDED.data
            `;
            await client.query(bulkQuery, [mobiles, dataJsons]);
        }
        
        await client.query('COMMIT'); 
        res.send("Bulk Data Successfully Saved in Lightning Speed!");
    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error("Bulk sync error:", err);
        res.status(500).send("Error saving bulk data");
    } finally {
        if (client) client.release(); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`OPAS Micro Finance Pvt Ltd Server running on port ${PORT}`);
});
