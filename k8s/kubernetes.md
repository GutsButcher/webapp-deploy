# Kubernetes Deployment Guide

This guide walks through deploying the microservices application on Kubernetes, providing production-grade features like persistent storage, secrets management, health checks, and TLS encryption.

## Prerequisites

- Kubernetes cluster running (minikube, EKS, GKE, or any other)
- `kubectl` installed and configured
- Docker images built and pushed (see [Build Guide](../dockerfiles/build.md))
- Basic understanding of Kubernetes concepts

## Deployment Process

We'll deploy our application components in the following order:
1. Storage resources (PV/PVC)
2. Secrets
3. Database
4. Backend API
5. Frontend
6. Ingress Controller
7. TLS Certificate
8. Ingress Rules

### 1. Create Storage Resources

Apply the PersistentVolume and PersistentVolumeClaim for MySQL data:

```bash
kubectl apply -f mysql-pv-pvc.yml
```

This creates:
- A 1Gi PersistentVolume using hostPath storage
- A matching PersistentVolumeClaim to request this storage

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mysql-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: "/mnt/data"
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

### 2. Create Secret for Database Password

Create a secret to store the MySQL root password:

```bash
kubectl create secret generic mysql-secret --from-literal=MYSQL_ROOT_PASSWORD=SecretPassword
```

### 3. Deploy MySQL Database

```bash
kubectl apply -f mysql-deploy.yml
kubectl apply -f mysql-service.yml
```

The MySQL deployment includes:
- Persistent storage using the PVC
- Secret for secure password management
- Readiness probe to ensure database availability
- Headless service for stable networking

Key components in the deployment:
```yaml
spec:
  template:
    spec:
      containers:
      - name: mysql
        image: gwynbliedd/simple-mysql:v1.1
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: MYSQL_ROOT_PASSWORD
        volumeMounts:
        - name: mysql-persistent-storage
          mountPath: /var/lib/mysql
        readinessProbe:
          exec:
            command:
            - mysqladmin
            - ping
            - -h
            - localhost
            - -u
            - root
            - -p${MYSQL_ROOT_PASSWORD}
```

### 4. Deploy Backend Service

```bash
kubectl apply -f backend-deploy.yml
kubectl apply -f backend-service.yml
```

The backend deployment includes:
- Init container to ensure MySQL is ready
- Environment variables for database connection
- Health check endpoints
- Internal service for communication

Key features:
```yaml
spec:
  template:
    spec:
      initContainers:
      - name: check-mysql-ready
        image: mysql:8.0
        command: ['sh', '-c', 
          'until mysql -h mysql-service -u root -p${MYSQL_ROOT_PASSWORD} -e "SELECT 1"; do echo waiting for mysql; sleep 2; done']
      containers:
      - name: backend
        image: gwynbliedd/simple-backend:v1.3
        env:
        - name: MYSQL_HOST
          value: "mysql-service"
        # Other environment variables...
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
```

### 5. Deploy Frontend Service

First, create the Nginx configuration:
```bash
kubectl apply -f nginx-configmap.yml
```

Then deploy the frontend:
```bash
kubectl apply -f frontend-deploy.yml
kubectl apply -f frontend-service.yml
```

The frontend deployment includes:
- ConfigMap for Nginx configuration
- Health checks
- ClusterIP service (accessed via Ingress)

Key components:
```yaml
spec:
  template:
    spec:
      containers:
      - name: frontend
        image: gwynbliedd/simple-frontend:v1.1
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: default.conf
      volumes:
      - name: nginx-config
        configMap:
          name: nginx-config
```

### 6. Deploy Ingress Controller

Install the NGINX Ingress Controller:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.3.0/deploy/static/provider/cloud/deploy.yaml
```

Verify the controller is running:
```bash
kubectl get pods --namespace ingress-nginx
```

Check for the assigned public IP:
```bash
kubectl get service ingress-nginx-controller --namespace=ingress-nginx
```

### 7. Create TLS Certificate

Generate a self-signed certificate:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=example.com/O=Example Company"
```

Create a TLS secret using the certificate:
```bash
kubectl create secret tls simple-app-tls --cert=tls.crt --key=tls.key
```

### 8. Configure Ingress Rules

Apply the ingress configuration:
```bash
kubectl apply -f ingress.yaml
```

The ingress configuration:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: frontend-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  ingressClassName: nginx
  tls:
  - secretName: simple-app-tls
  rules:
  - http:
      paths:
      - path: /api/?(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: backend-service
            port:
              number: 3000
      - path: /(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

## Accessing the Application

Once all components are deployed:

1. Get the external IP address of the ingress controller:
   ```bash
   kubectl get service ingress-nginx-controller --namespace=ingress-nginx
   ```

2. Access the application using HTTPS:
   ```
   https://<EXTERNAL-IP>
   ```

   Note: Since we're using a self-signed certificate, you'll need to accept the security warning in your browser.

## Verification and Testing

### Check Deployment Status

```bash
kubectl get deployments
kubectl get pods
kubectl get services
kubectl get ingress
```

### Test API Endpoints

```bash
# Get the ingress IP
INGRESS_IP=$(kubectl get service ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Get users
curl -k https://$INGRESS_IP/api/users

# Add a user
curl -k -X POST https://$INGRESS_IP/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Johnson","email":"alice@example.com"}'
```

## Understanding the Architecture

### Component Relationships
1. **Ingress Controller**: Routes external traffic to internal services
2. **Frontend**: Serves static content and forwards API requests
3. **Backend**: Processes API requests and communicates with database
4. **Database**: Stores persistent data

### Key Features
- **Persistent Storage**: Data survives pod restarts
- **Init Containers**: Ensure dependencies are ready
- **Health Checks**: Monitor service health
- **ConfigMaps**: Externalize configuration
- **Secrets**: Secure sensitive information
- **TLS**: Encrypt traffic

## Troubleshooting

### Checking Logs
```bash
kubectl logs -f deployment/frontend
kubectl logs -f deployment/backend
kubectl logs -f deployment/mysql
```

### Checking Events
```bash
kubectl get events --sort-by='.lastTimestamp'
```

### Common Issues

1. **Database Connection Issues**:
   - Check if MySQL service is running
   - Verify secret is configured correctly
   - Check network policies if applicable

2. **Ingress Not Working**:
   - Verify ingress controller is running
   - Check TLS secret is correctly referenced
   - Validate ingress resource configuration

3. **Persistent Volume Issues**:
   - Check PV/PVC status
   - Verify storage provisioner is working
   - Check storage permissions

## Cleanup

To remove all resources:

```bash
kubectl delete ingress frontend-ingress
kubectl delete service frontend-service backend-service mysql-service
kubectl delete deployment frontend backend mysql
kubectl delete configmap nginx-config
kubectl delete secret mysql-secret simple-app-tls
kubectl delete pvc mysql-pvc
kubectl delete pv mysql-pv
```
