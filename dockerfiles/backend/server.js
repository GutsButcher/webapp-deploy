import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection Configuration
const dbConfig = {
    host: process.env.MYSQL_HOST || 'mysql-db', // Changed from mysql-service to mysql-db
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'simple_app'
};

// Create connection pool
let pool;

// Initialize database connection
const initializeDb = async () => {
    try {
        pool = mysql.createPool(dbConfig);
        // Test the connection
        const connection = await pool.getConnection();
        console.log('Successfully connected to MySQL database');
        connection.release();
    } catch (err) {
        console.error('Error connecting to the database:', err);
        process.exit(1);
    }
};

// Simple health check endpoint for k8s
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// API Routes
app.get('/api/users', async (req, res) => {
    try {
        if (!pool) {
            throw new Error('Database connection not initialized');
        }
        const [rows] = await pool.query('SELECT * FROM users');
        console.log('Successfully fetched users:', rows);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching users:', err.message, err.stack);
        res.status(500).json({ error: 'Error fetching users', details: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { name, email } = req.body;
    
    if (!name || !email) {
        res.status(400).json({ error: 'Name and email are required' });
        return;
    }

    try {
        if (!pool) {
            throw new Error('Database connection not initialized');
        }
        const [result] = await pool.query(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            [name, email]
        );
        res.status(201).json({ id: result.insertId, name, email });
    } catch (err) {
        console.error('Error adding user:', err.message, err.stack);
        res.status(500).json({ error: 'Error adding user', details: err.message });
    }
});

// Initialize database and start server
const startServer = async () => {
    try {
        await initializeDb();
        const port = process.env.PORT || 3000;
        app.listen(port, '0.0.0.0', () => {
            console.log(`Server running on port ${port}`);
            console.log('Database configuration:', {
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.user,
                database: dbConfig.database
            });
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
