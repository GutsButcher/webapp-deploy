import mysql from 'mysql2/promise';

async function initDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST || 'mysql-db',
            port: process.env.MYSQL_PORT || 3306,
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || ''
        });

        // Use environment variable for database name, or default to 'simple_webapp'
        const databaseName = process.env.MYSQL_DATABASE || 'simple_webapp';

        await connection.query(`CREATE DATABASE IF NOT EXISTS ${databaseName}`);
        await connection.query(`USE ${databaseName}`);

        // Use environment variable for table name, or default to 'users'
        const tableName = process.env.MYSQL_TABLE_NAME || 'users';

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        try {
            await connection.query(`
                INSERT INTO ${tableName} (name, email) VALUES
                ('John Doe', 'john@example.com'),
                ('Jane Smith', 'jane@example.com'),
                ('Bob Wilson', 'bob@example.com')
            `);
        } catch (err) {
            console.log('Sample data already exists or insert error:', err);
        }

        await connection.end();
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization failed:', err);
    }


export default initDatabase;