# Docker Image Build Guide

This document outlines the process for building and pushing the Docker images required for the microservices application.

> **Note:** Pre-built images are already available on Docker Hub under the `gwynbliedd` namespace. If you want to proceed directly to deployment, you can skip this build guide and use the provided images in the [Docker Compose Guide](../docker-compose/compose.md) or [Kubernetes Guide](../k8s/kubernetes_build.md).

## Prerequisites

- Docker installed and configured
- Docker Hub account or other container registry access
- Git repository cloned locally

## Project Structure

The application consists of three microservices:
- **Frontend**: React/Vite application with Nginx for serving and routing
- **Backend**: Node.js REST API service 
- **Database**: MySQL database with initialization script

## Building the Images

### 1. Backend Service

Navigate to the backend directory:

```bash
cd dockerfiles/backend
```

Build the image:

```bash
docker build -t gwynbliedd/simple-backend:v1.3 .
```

Key features of the backend service:
- Connects to MySQL database
- Exposes REST API on port 3000
- Supports environment variable configuration:
  ```javascript
  // Database configuration from environment variables
  const dbConfig = {
      host: process.env.MYSQL_HOST || 'mysql-db',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'simple_app'
  };
  ```
- Uses entrypoint script to handle secrets:
  ```bash
  #!/bin/sh
  # Read password from file if available
  if [ -f "$MYSQL_PASSWORD_FILE" ]; then
      export MYSQL_PASSWORD=$(cat $MYSQL_PASSWORD_FILE)
  fi
  
  cd /app
  pm2-runtime start server.js --name backend
  
  # Keep container running
  tail -f /dev/null
  ```

### 2. Frontend Service

Navigate to the frontend directory:

```bash
cd dockerfiles/frontend
```

Build the image:

```bash
docker build -t gwynbliedd/simple-frontend:v1.1 .
```

Key features of the frontend service:
- Two-stage build process (Node.js build → Nginx runtime)
- Serves static React application
- Configures Nginx as reverse proxy:
  ```nginx
  # Proxy API requests to backend
  location /api/ {
      proxy_pass http://backend:3000/api/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```

### 3. Database Service

Navigate to the MySQL directory:

```bash
cd dockerfiles/mysql
```

Build the image:

```bash
docker build -t gwynbliedd/simple-mysql:v1.1 .
```

Key features of the database service:
- Based on MySQL 8.0
- Pre-configured database name
- Initialization script to set up schema and sample data:
  ```sql
  USE simple_app;
  
  CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Insert sample data
  INSERT INTO users (name, email) VALUES
      ('John Doe', 'john@example.com'),
      ('Jane Smith', 'jane@example.com'),
      ('Bob Wilson', 'bob@example.com');
  ```

## Pushing Images to Registry

Login to Docker Hub (or your container registry):

```bash
docker login
```

Push the images:

```bash
docker push gwynbliedd/simple-backend:v1.3
docker push gwynbliedd/simple-frontend:v1.1
docker push gwynbliedd/simple-mysql:v1.1
```

## Verifying Images

List the built images:

```bash
docker images | grep gwynbliedd
```

You should see output similar to:
```
gwynbliedd/simple-frontend   v1.1     abc123def456   10 minutes ago   25.1MB
gwynbliedd/simple-backend    v1.3     def456abc789   15 minutes ago   120MB
gwynbliedd/simple-mysql      v1.1     789abc123def   20 minutes ago   446MB
```

## Using Your Own Images

If you choose to build your own images, you'll need to:

1. Replace the image names in all deployment files with your registry/username:
   - Update `docker-compose.yml` to use your images
   - Update all Kubernetes deployment YAML files
   - Update any references in documentation

For example, change:
```
image: gwynbliedd/simple-backend:v1.3
```
to:
```
image: your-username/simple-backend:v1.3
```

## Next Steps

After successfully building and pushing the images, proceed to:
- Deploy with Docker Compose: [Compose Deployment Guide](../docker-compose/compose.md)
- Deploy with Kubernetes: [Kubernetes Deployment Guide](../k8s/kubernetes_build.md)