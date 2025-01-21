USE simple_app;

CREATE TABLE IF NOT EXISTS users (
	    id INT AUTO_INCREMENT PRIMARY KEY,
	    name VARCHAR(255) NOT NULL,
	    email VARCHAR(255) NOT NULL UNIQUE,
	    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Insert some sample data
INSERT INTO users (name, email) VALUES
    ('John Doe', 'john@example.com'),
    ('Jane Smith', 'jane@example.com'),
    ('Bob Wilson', 'bob@example.com');
