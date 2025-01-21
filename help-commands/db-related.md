# Create USER

```SQL
CREATE USER 'username'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON database_name.* TO 'username'@'localhost';
FLUSH PRIVILEGES;
```

# Change Root Pass

```SQL
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
```

# Show columns of a table

```SQL
SHOW COLUMNS FROM table_name;
```

# Inject a DB

```bash
# first create the DB using:
mysql -uroot -p -e "CREATE DATABASE `database_name`;"
mysql -u username -p database_name < /path/to/file.sql
```

