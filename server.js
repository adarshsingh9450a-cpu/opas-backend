const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Database Connection Setup
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_uGgDcJnR92Pt@ep-dry-bar-ado4xlns.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

// 1. Test Route
app.get('/', async (req, res) => {
    try {
        const client = await pool.connect();
        res.send("Database connection SUCCESSFUL! OPAS Micro Finance Pvt Ltd Backend zinda hai. 🚀");
        client.release();
    } catch (err) {
        console.error(err);
        res.send("Database connection Error: " + err);
    }
});

// 2. Database Setup Route (Table banane ke liye)
app.get('/setup', async (req, res) => {
    try {
        const client = await pool.connect();
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS clients (
                mobile VARCHAR(15) PRIMARY KEY,
                data JSONB
            );
        `;
        await client.query(createTableQuery);
        client.release();
        res.send("Badhai ho! Database mein Tables successfully ban gayi hain. 🚀");
    } catch (err) {
        console.error(err);
        res.send("Table banane mein error aaya: " + err);
    }
});

// 3. Data Lane ka Rasta (GET)
app.get('/api/clients', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM clients');
        const dbObj = {};
        result.rows.forEach(row => {
            dbObj[row.mobile] = row.data;
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
        const query = `
            INSERT INTO clients (mobile, data) 
            VALUES ($1, $2) 
            ON CONFLICT (mobile) 
            DO UPDATE SET data = $2
        `;
        await pool.query(query, [mobile, data]);
        res.send("Data Saved!");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error saving data");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`OPAS Micro Finance Pvt Ltd Server running on port ${PORT}`);
});
