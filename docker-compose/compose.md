# Docker Compose Deployment Guide

This guide explains how to deploy the microservices application using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- Images built and pushed (see [Build Guide](../dockerfiles/build.md))
- Basic understanding of Docker networking and volumes

## Configuration Overview

The application uses Docker Compose to orchestrate three containers:
1. **mysql-db**: Database service with persistent storage
2. **backend**: REST API service with endpoints for user management
3. **frontend**: Web UI with Nginx reverse proxy

## Deployment Steps

### 1. Create Secret for MySQL

Create a directory for secrets:

```bash
mkdir -p ./secrets
```

Generate MySQL root password:

```bash
echo "MySecurePassword123" > ./secrets/mysql_root_password
chmod 600 ./secrets/mysql_root_password
```

### 2. Deploy with Docker Compose

Start the services:

```bash
docker-compose up -d
```

This will:
- Create a bridge network (`app-network`)
- Configure a volume for MySQL data (`mysql_data`)
- Start all services with proper dependencies

### 3. Verify Deployment

Check running containers:

```bash
docker-compose ps
```

Check logs:

```bash
docker-compose logs -f
```

## Architecture Details

```yaml
services:
  mysql-db:
    image: gwynbliedd/simple-mysql:v1.1
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p$$(cat /run/secrets/mysql_root_password)"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - mysql_data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD_FILE=/run/secrets/mysql_root_password
    secrets:
      - mysql_root_password
    networks:
      - app-network

  backend:
    image: gwynbliedd/simple-backend:v1.3
    depends_on:
      mysql-db:
        condition: service_healthy
    environment:
      - MYSQL_HOST=mysql-db
      - MYSQL_PORT=3306
      - MYSQL_USER=root
      - MYSQL_PASSWORD_FILE=/run/secrets/mysql_root_password
      - MYSQL_DATABASE=simple_app
    secrets:
      - mysql_root_password
    networks:
      - app-network

  frontend:
    image: gwynbliedd/simple-frontend:v1.1
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  mysql_data:
    driver: local

secrets:
  mysql_root_password:
    file: ./secrets/mysql_root_password
```

Key components:
- **Healthcheck**: Ensures MySQL is ready before starting dependent services
- **Volumes**: Persistent storage for database data
- **Secrets**: Secure password management
- **Networks**: Isolated communication between services
- **Dependencies**: Proper startup order with health conditions

## Testing the Application

### 1. Access the Web Interface

Open your browser and navigate to:
```
http://localhost
```

You should see the User Management interface with:
- Form to add new users
- Table displaying existing users

### 2. API Testing

#### Get Users
```bash
curl -X GET http://localhost/api/users
```

Expected response:
```json
[
  {"id":1,"name":"John Doe","email":"john@example.com","created_at":"2023-05-15T10:30:00Z"},
  {"id":2,"name":"Jane Smith","email":"jane@example.com","created_at":"2023-05-15T10:30:01Z"},
  {"id":3,"name":"Bob Wilson","email":"bob@example.com","created_at":"2023-05-15T10:30:02Z"}
]
```

#### Add User
```bash
curl -X POST http://localhost/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Johnson","email":"alice@example.com"}'
```

Expected response:
```json
{"success":true,"message":"User added successfully"}
```

## Data Persistence

The application maintains data persistence through:
1. Docker volume for MySQL data: `mysql_data:/var/lib/mysql`
2. Table schema created by initialization script

To verify persistence:
1. Add users through the interface
2. Restart containers: `docker-compose restart`
3. Verify users still appear in the interface

## Troubleshooting

### Connection Issues
If the frontend cannot connect to the backend:
- Check network configuration
- Verify service names in `nginx.conf`
- Ensure backend is healthy

### Database Connection Errors
If the backend cannot connect to the database:
- Verify MySQL is healthy
- Check environment variables
- Ensure secret is mounted correctly

## Shutting Down

Stop and remove containers:
```bash
docker-compose down
```

To remove volumes as well:
```bash
docker-compose down -v
```