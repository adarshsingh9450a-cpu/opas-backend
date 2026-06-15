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
    // Niche single quotes '' ke andar apni Render wali URL paste karna
    connectionString: 'postgresql://opas_data_base_user:ATp9M9d3VZFAVF4tqjThAV66Dwm1Pn8O@dpg-d8ns6su7r5hc73b5oi90-a.singapore-postgres.render.com/opas_data_base',
    ssl: { rejectUnauthorized: false }
});

// Test Route
app.get('/', async (req, res) => {
    try {
        const client = await pool.connect();
        res.send("Database connection SUCCESSFUL! OPAS Backend zinda hai.");
        client.release();
    } catch (err) {
        console.error(err);
        res.send("Database connection Error: " + err);
    }
});
// Database Setup Route (Tables banane ke liye)
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
