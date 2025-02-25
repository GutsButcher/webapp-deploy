# CI/CD Pipeline Setup Guide

This guide explains how to set up a CI/CD pipeline for the microservices application using GitLab CI/CD. The pipeline automates the building, testing, and deployment of all containers to a Kubernetes cluster.

## Overview

The CI/CD pipeline consists of two primary stages:
1. **Build**: Compiles code and creates Docker images
2. **Deploy**: Deploys the application to a Kubernetes cluster

## Prerequisites

- GitLab account with a project containing the application code
- Kubernetes cluster (EKS in this example)
- Machine with kubectl access to the cluster (k8s-workstation)
- GitLab Runner for executing pipeline jobs
- GitLab Kubernetes Agent for secure cluster communication

## Setup Process

### 1. Configure GitLab Container Registry

1. Create an Access Token for Container Registry:
   - Navigate to your profile → Preferences → Access Tokens
   - Create a token with `read_registry` and `write_registry` scopes
   - Save the token for later use

2. Add Registry Variables to CI/CD Configuration:
   - Go to Project → Settings → CI/CD → Variables
   - Add the following variables:
     - `CI_DEPLOY_USER`: Your GitLab username
     - `CI_DEPLOY_PASSWORD`: Your access token (masked)

### 2. Set Up GitLab Runner

A GitLab Runner is needed to execute CI/CD jobs.

1. Register a new Runner in GitLab:
   - Go to Project → Settings → CI/CD → Runners
   - Click "New project runner"
   - Configure runner settings and save the registration token

2. Install and Register the Runner on a machine:
   ```bash
   # Install GitLab Runner on RHEL/CentOS/Fedora
   sudo yum update
   curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.rpm.sh" | sudo bash
   sudo yum install gitlab-runner -y

   # Install GitLab Runner on Ubuntu/Debian
   curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
   sudo apt-get install gitlab-runner -y

   # Register the runner
   sudo gitlab-runner register
   ```

3. During registration, provide:
   - GitLab instance URL: `https://gitlab.com`
   - Registration token: (from step 1)
   - Description: A meaningful name for your runner
   - Tags (optional): Add tags to control job execution
   - Executor: Choose `shell` for simplicity

### 3. Connect Kubernetes Cluster to GitLab

GitLab Kubernetes Agent provides secure communication with your cluster.

1. Create a Kubernetes Agent Configuration:
   - Go to Infrastructure → Kubernetes clusters
   - Click "Connect a cluster"
   - Provide an agent name (e.g., "test")
   - Download the agent manifest

2. Install the Agent on your Kubernetes cluster:
   ```bash
   # Connect to your k8s-workstation
   ssh user@k8s-workstation

   # Install Helm if not already installed
   curl https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash

   # Add GitLab Helm repository
   helm repo add gitlab https://charts.gitlab.io
   helm repo update

   # Install GitLab agent (CMD provided by Gitlab once adding agent)
   ```

3. Add the Kubernetes context to your CI/CD variables:
   - Go to Project → Settings → CI/CD → Variables
   - Add: `KUBE_CONTEXT: your-project-path/your-project-name:agent-name`

### 4. Set Up TLS Certificate for Ingress

1. Generate or obtain TLS certificates:
   ```bash
   # Generate self-signed certificate
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout tls.key -out tls.crt \
     -subj "/CN=example.com/O=Example Organization"
   ```

2. Add certificates as file variables in GitLab:
   - Go to Project → Settings → CI/CD → Variables
   - Add `KEY_FILE` (Type: File, Value: content of tls.key)
   - Add `CERT_FILE` (Type: File, Value: content of tls.crt)

### 5. Configure MySQL Password Secret

Add the MySQL root password as a CI/CD variable:
   - Go to Project → Settings → CI/CD → Variables
   - Add `MYSQL_ROOT_PASSWORD` (Masked, protected if using protected branches)

### 6. Create the CI/CD Configuration File

Create a `.gitlab-ci.yml` file in the root of your repository:

```yaml
stages:
  - build
  - deploy

variables:
  DOCKER_REGISTRY: registry.gitlab.com/${CI_PROJECT_PATH}
  KUBE_CONTEXT: ${CI_PROJECT_PATH}:test  # Replace 'test' with your agent name

build_images:
  stage: build
  image: docker:20.10.16
  services:
    - docker:20.10.16-dind
  before_script: 
    - echo "$CI_DEPLOY_PASSWORD" | docker login $CI_REGISTRY -u $CI_DEPLOY_USER --password-stdin
  script:
    - docker build -t $DOCKER_REGISTRY/frontend:${CI_COMMIT_SHORT_SHA} ./dockerfiles/frontend
    - docker build -t $DOCKER_REGISTRY/backend:${CI_COMMIT_SHORT_SHA} ./dockerfiles/backend
    - docker build -t $DOCKER_REGISTRY/mysql:${CI_COMMIT_SHORT_SHA} ./dockerfiles/mysql
    - docker tag $DOCKER_REGISTRY/frontend:${CI_COMMIT_SHORT_SHA} $DOCKER_REGISTRY/frontend:latest
    - docker tag $DOCKER_REGISTRY/backend:${CI_COMMIT_SHORT_SHA} $DOCKER_REGISTRY/backend:latest
    - docker tag $DOCKER_REGISTRY/mysql:${CI_COMMIT_SHORT_SHA} $DOCKER_REGISTRY/mysql:latest
    - docker push $DOCKER_REGISTRY/frontend:${CI_COMMIT_SHORT_SHA}
    - docker push $DOCKER_REGISTRY/backend:${CI_COMMIT_SHORT_SHA}
    - docker push $DOCKER_REGISTRY/mysql:${CI_COMMIT_SHORT_SHA}
    - docker push $DOCKER_REGISTRY/frontend:latest
    - docker push $DOCKER_REGISTRY/backend:latest
    - docker push $DOCKER_REGISTRY/mysql:latest

deploy_to_k8s:
  stage: deploy
  image: 
    name: bitnami/kubectl:latest
    entrypoint: [""]
  before_script:
    - kubectl config use-context "$KUBE_CONTEXT"
  script:
    # Create MySQL password secret
    - kubectl create secret generic mysql-secret --from-literal=MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD --dry-run=client -o yaml | kubectl apply -f -
    # Create TLS secret for Ingress
    - kubectl create secret tls simple-app-tls --key=$KEY_FILE --cert=$CERT_FILE --dry-run=client -o yaml | kubectl apply -f -
    # Update deployment files with correct image tags
    - sed -i "s|gwynbliedd/simple-frontend:.*|$DOCKER_REGISTRY/frontend:${CI_COMMIT_SHORT_SHA}|g" k8s/frontend-yamls/frontend-deploy.yml
    - sed -i "s|gwynbliedd/simple-backend:.*|$DOCKER_REGISTRY/backend:${CI_COMMIT_SHORT_SHA}|g" k8s/backend-yamls/backend-deploy.yml
    - sed -i "s|gwynbliedd/simple-mysql:.*|$DOCKER_REGISTRY/mysql:${CI_COMMIT_SHORT_SHA}|g" k8s/db-yamls/mysql-deploy.yml
    # Apply Kubernetes manifests
    - kubectl apply -f k8s/db-yamls/
    - kubectl apply -f k8s/backend-yamls/
    - kubectl apply -f k8s/frontend-yamls/
    - kubectl apply -f k8s/ingress-yamls/
  only:
    - main
```

## How It Works

1. **Build Stage**:
   - Uses Docker-in-Docker to build containerized applications
   - Tags images with both commit SHA (for versioning) and 'latest'
   - Pushes all images to GitLab Container Registry

2. **Deploy Stage**:
   - Uses kubectl to connect to the Kubernetes cluster
   - Creates necessary secrets
   - Updates deployment manifests with current image versions
   - Applies all Kubernetes resources in the correct order

## Pipeline Execution

The pipeline automatically runs when:
- Code is pushed to the main branch
- A merge request is created/updated
- Pipeline is manually triggered

To manually trigger a pipeline:
1. Go to CI/CD → Pipelines
2. Click "Run Pipeline"
3. Select the branch and run


## Troubleshooting

### Common Issues

1. **Docker login failure**:
   - Verify CI_DEPLOY_USER and CI_DEPLOY_PASSWORD are correct
   - Ensure token has proper registry permissions

2. **Kubernetes connection failure**:
   - Verify KUBE_CONTEXT is correct
   - Check the Kubernetes agent is running properly
   - Verify network connectivity between GitLab and your cluster

3. **Build failures**:
   - Check Dockerfile syntax
   - Verify build context paths are correct
   - Ensure Docker service is running properly in the CI environment

4. **Deployment failures**:
   - Verify Kubernetes manifests are valid
   - Check for namespace issues
   - Ensure secret values are properly set
