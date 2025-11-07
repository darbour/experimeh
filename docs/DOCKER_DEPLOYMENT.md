# Docker Deployment Guide

## Overview

This guide covers deploying the Experimeh application using Docker with automated builds through GitHub Actions.

## Table of Contents

- [Automated Docker Builds](#automated-docker-builds)
- [Using Pre-built Images](#using-pre-built-images)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Monitoring and Logging](#monitoring-and-logging)

## Automated Docker Builds

### GitHub Container Registry (GHCR)

The project uses GitHub Actions to automatically build and push Docker images to GitHub Container Registry.

#### Workflow Triggers

1. **Push to main/master branch**: Builds and pushes with `latest` tag
2. **Version tags**: Pushing a tag like `v1.0.0` creates semantic version tags
3. **Pull requests**: Builds but doesn't push (testing only)
4. **Manual trigger**: Can be triggered via GitHub Actions UI

#### Image Tags

Images are tagged with multiple formats:
- `latest`: Most recent build from main branch
- `v1.0.0`: Specific version
- `v1.0`: Major.minor version
- `v1`: Major version only
- `main-sha123abc`: Branch name with git SHA
- `pr-123`: Pull request number

### Accessing Images

Images are available at:
```
ghcr.io/darbour/experimeh:latest
ghcr.io/darbour/experimeh:v1.0.0
```

#### Public Access

To make the image public:
1. Go to GitHub repository settings
2. Navigate to "Packages"
3. Find the `experimeh` package
4. Change visibility to "Public"

#### Private Access

For private images, authenticate with:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

## Using Pre-built Images

### Quick Start with Pre-built Image

1. **Pull the image**:
```bash
docker pull ghcr.io/darbour/experimeh:latest
```

2. **Run with docker-compose** (recommended):
```bash
# Use the pre-built image
docker-compose up -d
```

3. **Run standalone**:
```bash
docker run -d \
  --name experimeh \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=experimeh_test \
  -e POSTGRES_USER=experimeh \
  -e POSTGRES_PASSWORD=your_password \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  -e KAFKA_BROKERS=kafka:29092 \
  ghcr.io/darbour/experimeh:latest
```

## Local Development

### Building Locally

```bash
# Build the image
docker build -t experimeh:local .

# Or use docker-compose
docker-compose build

# Test the build
docker run --rm experimeh:local node --version
```

### Development with Hot Reload

For development with auto-reload, use volume mounts:

```yaml
# docker-compose.dev.yml
services:
  experimeh:
    build: .
    volumes:
      - ./src:/app/src
      - ./node_modules:/app/node_modules
    environment:
      NODE_ENV: development
    command: npm run dev
```

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Production Deployment

### Docker Compose Deployment

#### Full Stack Deployment

The provided `docker-compose.yml` includes all services:
- PostgreSQL database
- Redis cache
- Kafka message broker
- Zookeeper (for Kafka)
- Experimeh application

**Deploy the full stack**:
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f experimeh

# Scale the application
docker-compose up -d --scale experimeh=3
```

#### Application Only

To deploy just the application (using external services):

```bash
docker run -d \
  --name experimeh \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e POSTGRES_HOST=your-db-host \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=experimeh_prod \
  -e POSTGRES_USER=experimeh \
  -e POSTGRES_PASSWORD=${DB_PASSWORD} \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e KAFKA_BROKERS=your-kafka-host:9092 \
  ghcr.io/darbour/experimeh:latest
```

### Kubernetes Deployment

#### Basic Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: experimeh
spec:
  replicas: 3
  selector:
    matchLabels:
      app: experimeh
  template:
    metadata:
      labels:
        app: experimeh
    spec:
      containers:
      - name: experimeh
        image: ghcr.io/darbour/experimeh:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: POSTGRES_HOST
          valueFrom:
            secretKeyRef:
              name: experimeh-secrets
              key: postgres-host
        # ... other env vars
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 40
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: experimeh
spec:
  selector:
    app: experimeh
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

#### Deploy to Kubernetes

```bash
# Apply the deployment
kubectl apply -f k8s/

# Check status
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/experimeh

# Scale
kubectl scale deployment experimeh --replicas=5
```

### Cloud Platforms

#### AWS ECS

```bash
# Create ECR repository (if not using GHCR)
aws ecr create-repository --repository-name experimeh

# Tag and push
docker tag experimeh:latest AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com/experimeh:latest
docker push AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com/experimeh:latest

# Create ECS task definition and service via AWS Console or CLI
```

#### Google Cloud Run

```bash
# Deploy directly from GHCR
gcloud run deploy experimeh \
  --image ghcr.io/darbour/experimeh:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,POSTGRES_HOST=...
```

#### Azure Container Instances

```bash
az container create \
  --resource-group experimeh-rg \
  --name experimeh \
  --image ghcr.io/darbour/experimeh:latest \
  --dns-name-label experimeh \
  --ports 3000 \
  --environment-variables NODE_ENV=production POSTGRES_HOST=...
```

## Environment Configuration

### Required Environment Variables

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=experimeh_prod
POSTGRES_USER=experimeh
POSTGRES_PASSWORD=secure_password

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# Message Broker
KAFKA_BROKERS=localhost:9092

# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
```

### Using Environment Files

Create a `.env.prod` file:
```bash
# Production environment
NODE_ENV=production
POSTGRES_HOST=prod-db.example.com
POSTGRES_PASSWORD=secure_password
# ... other vars
```

Use with Docker:
```bash
docker run --env-file .env.prod experimeh:latest
```

Use with docker-compose:
```yaml
services:
  experimeh:
    env_file:
      - .env.prod
```

### Secrets Management

#### Docker Secrets

```bash
# Create secrets
echo "my_db_password" | docker secret create db_password -

# Use in docker-compose
services:
  experimeh:
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    external: true
```

#### Kubernetes Secrets

```bash
# Create secret
kubectl create secret generic experimeh-secrets \
  --from-literal=postgres-password=secure_password

# Reference in deployment
env:
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: experimeh-secrets
      key: postgres-password
```

## Monitoring and Logging

### Health Checks

The application exposes health endpoints:
- `/health`: Basic health check
- `/health/ready`: Readiness check (includes dependency checks)

```bash
# Check health
curl http://localhost:3000/health

# Docker health status
docker inspect --format='{{.State.Health.Status}}' experimeh-app
```

### Logs

#### Docker Logs

```bash
# Follow logs
docker logs -f experimeh-app

# Last 100 lines
docker logs --tail 100 experimeh-app

# With timestamps
docker logs -t experimeh-app
```

#### Structured Logging

The application outputs JSON logs for easy parsing:
```json
{
  "level": "info",
  "message": "Server started",
  "timestamp": "2025-11-07T15:00:00.000Z",
  "port": 3000
}
```

#### Log Aggregation

##### Using Docker logging drivers

```yaml
services:
  experimeh:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

##### CloudWatch

```yaml
services:
  experimeh:
    logging:
      driver: awslogs
      options:
        awslogs-region: us-east-1
        awslogs-group: experimeh
        awslogs-stream: experimeh-app
```

### Metrics

#### Docker Stats

```bash
# Real-time metrics
docker stats experimeh-app

# Format output
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

#### Prometheus Integration

Add metrics endpoint to your application and configure Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'experimeh'
    static_configs:
      - targets: ['experimeh:3000']
```

## Troubleshooting

### Common Issues

#### Container won't start

```bash
# Check logs
docker logs experimeh-app

# Check events
docker events --filter container=experimeh-app

# Inspect container
docker inspect experimeh-app
```

#### Can't connect to dependencies

```bash
# Test network connectivity
docker exec experimeh-app nc -zv postgres 5432
docker exec experimeh-app nc -zv redis 6379
docker exec experimeh-app nc -zv kafka 9092

# Check network
docker network inspect experimeh-network
```

#### Performance issues

```bash
# Check resource usage
docker stats

# Check container limits
docker inspect experimeh-app --format='{{.HostConfig.Memory}}'

# Increase resources in docker-compose
services:
  experimeh:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M
```

## Security Best Practices

### Image Security

1. **Scan images for vulnerabilities**:
```bash
# Using Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image ghcr.io/darbour/experimeh:latest

# Using Docker Scout
docker scout cves experimeh:latest
```

2. **Keep base images updated**:
- The Dockerfile uses `node:18-alpine` which is regularly updated
- Rebuild periodically to get security patches

3. **Run as non-root user**:
- Already configured in Dockerfile (user nodejs:1001)

### Runtime Security

1. **Use read-only filesystem**:
```yaml
services:
  experimeh:
    read_only: true
    tmpfs:
      - /tmp
```

2. **Drop unnecessary capabilities**:
```yaml
services:
  experimeh:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

3. **Enable security options**:
```yaml
services:
  experimeh:
    security_opt:
      - no-new-privileges:true
```

## Backup and Recovery

### Database Backups

```bash
# Backup PostgreSQL
docker exec experimeh-postgres pg_dump -U experimeh experimeh > backup.sql

# Restore
docker exec -i experimeh-postgres psql -U experimeh experimeh < backup.sql
```

### Volume Backups

```bash
# Backup volume
docker run --rm \
  -v experimeh_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore volume
docker run --rm \
  -v experimeh_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

## CI/CD Integration

### GitHub Actions (Already Configured)

The repository includes workflows for:
- **docker-build.yml**: Builds and pushes images on main branch and tags
- **docker-test.yml**: Tests Docker build on PRs

### GitLab CI

```yaml
# .gitlab-ci.yml
docker-build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_TAG .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_TAG
```

### Jenkins

```groovy
// Jenkinsfile
pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        sh 'docker build -t experimeh:${BUILD_NUMBER} .'
      }
    }
    stage('Push') {
      steps {
        sh 'docker push experimeh:${BUILD_NUMBER}'
      }
    }
  }
}
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

## Support

For issues or questions:
- Create an issue in the GitHub repository
- Check existing documentation in `/docs`
- Review Docker logs: `docker-compose logs -f`
