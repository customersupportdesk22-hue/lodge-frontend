const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- TURSO DATABASE CONNECTION ---
const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// --- CREATE TABLE ON STARTUP ---
async function initDB() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT NOT NULL,
                reason TEXT,
                secrets_agreed INTEGER,
                change_ready INTEGER,
                balance INTEGER DEFAULT 500, 
                created_at TEXT
            )
        `);
        console.log('✅ Grand Lodge members table ready');
    } catch (err) {
        console.error('❌ Database error:', err.message);
    }
}
initDB();

// --- SERVE FRONTEND ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- REGISTRATION API ---
app.post('/api/register', async (req, res) => {
    const { name, email, phone, reason, secrets, change } = req.body;
    
    if (!name || !email || !phone) {
        return res.status(400).json({ error: 'Name, email, and phone are required.' });
    }

    try {
        const now = new Date().toISOString();
        // Convert booleans to 1 or 0 for SQLite
        const secretsInt = secrets ? 1 : 0;
        const changeInt = change ? 1 : 0;

        // Insert the member. The 500 is the default welcome bonus.
        const result = await db.execute({
            sql: `INSERT OR IGNORE INTO members 
                  (name, email, phone, reason, secrets_agreed, change_ready, balance, created_at) 
                  VALUES (?, ?, ?, ?, ?, ?, 500, ?)`,
            args: [name, email, phone, reason, secretsInt, changeInt, now]
        });

        // If rowsAffected is 0, it means the email already exists
        if (result.rowsAffected === 0) {
            return res.status(400).json({ error: 'This email is already registered.' });
        }

        // Fetch the newly created user to return their name and balance
        const userResult = await db.execute({
            sql: 'SELECT name, balance FROM members WHERE email = ?',
            args: [email]
        });

        res.json({ 
            success: true, 
            message: 'Petition accepted. Welcome package applied.',
            user: userResult.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// --- START SERVER ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Grand Lodge Server running on port ${PORT}`));
