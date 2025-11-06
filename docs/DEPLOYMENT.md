# Experimeh Deployment Guide

Complete guide for deploying the Experimeh experimentation system in production environments.

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Environment Configuration](#environment-configuration)
- [Security Best Practices](#security-best-practices)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Performance Tuning](#performance-tuning)

---

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 20GB+ disk space

### 1. Clone and Configure

```bash
# Clone the repository
git clone <repository-url>
cd experimeh

# Copy environment template
cp config/docker.env .env

# Edit environment variables
nano .env
```

### 2. Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f experimeh

# Check service status
docker-compose ps
```

### 3. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"2024-11-06T15:00:00.000Z","version":"1.0.0"}
```

---

## Docker Deployment

### Architecture

The Docker deployment consists of:

- **experimeh** - Main application (Node.js/Express)
- **postgres** - PostgreSQL database
- **redis** - Cache layer
- **kafka + zookeeper** - Event streaming

### Building the Image

#### Development Build

```bash
docker build -t experimeh:dev .
```

#### Production Build

```bash
docker build --target production -t experimeh:latest .
```

#### Multi-platform Build

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t experimeh:latest \
  --push .
```

### Running with Docker Compose

#### Start All Services

```bash
# Start in detached mode
docker-compose up -d

# Start with build
docker-compose up -d --build

# Scale application instances
docker-compose up -d --scale experimeh=3
```

#### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

#### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f experimeh

# Last 100 lines
docker-compose logs --tail=100 experimeh
```

### Configuration

#### Environment Variables

Edit `.env` file in project root:

```bash
# Required variables
POSTGRES_PASSWORD=your_secure_password
VALID_API_KEYS=key1,key2,key3
ADMIN_API_KEYS=admin_key

# Optional variables
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

#### Volume Mounts

Persistent data is stored in Docker volumes:

```bash
# List volumes
docker volume ls | grep experimeh

# Inspect volume
docker volume inspect experimeh-postgres-data

# Backup volume
docker run --rm -v experimeh-postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Networking

#### Internal Network

Services communicate on `experimeh-network`:

```bash
# Inspect network
docker network inspect experimeh-network
```

#### External Access

Expose ports in `docker-compose.yml`:

```yaml
services:
  experimeh:
    ports:
      - "3000:3000"  # Application
  postgres:
    ports:
      - "5432:5432"  # Database (disable in production)
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster 1.24+
- kubectl configured
- Helm 3+ (optional)

### Basic Deployment

#### 1. Create Namespace

```bash
kubectl create namespace experimeh
```

#### 2. Create ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: experimeh-config
  namespace: experimeh
data:
  NODE_ENV: "production"
  PORT: "3000"
  HOST: "0.0.0.0"
  POSTGRES_HOST: "postgres-service"
  POSTGRES_PORT: "5432"
  POSTGRES_DB: "experimeh"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  KAFKA_BROKERS: "kafka-service:9092"
  LOG_LEVEL: "info"
```

```bash
kubectl apply -f k8s/configmap.yaml
```

#### 3. Create Secrets

```bash
# Create secrets from literals
kubectl create secret generic experimeh-secrets \
  --from-literal=POSTGRES_PASSWORD=your_secure_password \
  --from-literal=POSTGRES_USER=experimeh \
  --from-literal=VALID_API_KEYS=key1,key2 \
  --from-literal=ADMIN_API_KEYS=admin_key \
  -n experimeh
```

#### 4. Deploy PostgreSQL

```yaml
# k8s/postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: experimeh
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: "experimeh"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: experimeh-secrets
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: experimeh-secrets
              key: POSTGRES_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: experimeh
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

#### 5. Deploy Application

```yaml
# k8s/experimeh-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: experimeh
  namespace: experimeh
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
        image: experimeh:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: experimeh-config
        - secretRef:
            name: experimeh-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: experimeh-service
  namespace: experimeh
spec:
  type: LoadBalancer
  selector:
    app: experimeh
  ports:
  - port: 80
    targetPort: 3000
```

```bash
# Apply deployments
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/experimeh-deployment.yaml

# Check status
kubectl get pods -n experimeh
kubectl get services -n experimeh
```

#### 6. Horizontal Pod Autoscaling

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: experimeh-hpa
  namespace: experimeh
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: experimeh
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

```bash
kubectl apply -f k8s/hpa.yaml
```

---

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `POSTGRES_PASSWORD` | Database password | `secure_password` |
| `VALID_API_KEYS` | API authentication keys | `key1,key2,key3` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Application port | `3000` |
| `LOG_LEVEL` | Logging level | `info` |
| `ASSIGNMENT_CACHE_TTL` | Cache duration (seconds) | `3600` |
| `MAX_CONCURRENT_EXPERIMENTS` | Max experiments per user | `100` |
| `DEFAULT_CONFIDENCE_LEVEL` | Statistical confidence | `0.95` |

### Security Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTGRES_PASSWORD` | Database password | Yes |
| `REDIS_PASSWORD` | Redis password | Recommended |
| `VALID_API_KEYS` | Valid API keys | Yes |
| `ADMIN_API_KEYS` | Admin API keys | Yes |

---

## Security Best Practices

### 1. Secrets Management

**DO NOT** commit secrets to version control:

```bash
# Use environment variables
docker-compose --env-file .env.production up -d

# Use Docker secrets (Swarm)
echo "my_secret_password" | docker secret create postgres_password -

# Use Kubernetes secrets
kubectl create secret generic db-secret \
  --from-literal=password=your_password
```

### 2. Network Security

```yaml
# Restrict network access
networks:
  experimeh-network:
    driver: bridge
    internal: true  # No external access

# Only expose application
services:
  experimeh:
    networks:
      - experimeh-network
      - external-network
```

### 3. Container Security

```dockerfile
# Run as non-root user
USER nodejs

# Use read-only root filesystem
docker run --read-only experimeh

# Drop capabilities
docker run --cap-drop=ALL experimeh
```

### 4. Database Security

```sql
-- Use strong passwords
ALTER USER experimeh WITH PASSWORD 'complex_password_123!';

-- Restrict permissions
REVOKE ALL ON DATABASE experimeh FROM PUBLIC;
GRANT CONNECT ON DATABASE experimeh TO experimeh;
```

### 5. API Security

```bash
# Use strong API keys (32+ characters)
VALID_API_KEYS=$(openssl rand -hex 32)

# Enable rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100

# Configure CORS properly
CORS_ORIGIN=https://yourdomain.com
```

---

## Monitoring and Logging

### Application Logs

```bash
# Docker logs
docker-compose logs -f experimeh

# Follow specific service
docker logs -f experimeh-app

# Kubernetes logs
kubectl logs -f deployment/experimeh -n experimeh
```

### Health Checks

```bash
# Application health
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/status
```

### Metrics Collection

#### Prometheus Integration

```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

#### Example Prometheus Config

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'experimeh'
    static_configs:
      - targets: ['experimeh:9090']
```

### Log Aggregation

#### ELK Stack

```yaml
# docker-compose.yml
services:
  elasticsearch:
    image: elasticsearch:8.10.0
    environment:
      - discovery.type=single-node

  logstash:
    image: logstash:8.10.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: kibana:8.10.0
    ports:
      - "5601:5601"
```

---

## Backup and Recovery

### Database Backup

#### Manual Backup

```bash
# Backup PostgreSQL
docker exec experimeh-postgres pg_dump -U experimeh experimeh > backup.sql

# Backup with timestamp
docker exec experimeh-postgres pg_dump -U experimeh experimeh > \
  backup-$(date +%Y%m%d-%H%M%S).sql
```

#### Automated Backup

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker exec experimeh-postgres pg_dump -U experimeh experimeh | \
  gzip > "${BACKUP_DIR}/backup-${TIMESTAMP}.sql.gz"
# Keep only last 7 days
find ${BACKUP_DIR} -name "backup-*.sql.gz" -mtime +7 -delete
EOF

chmod +x backup.sh

# Add to crontab (daily at 2am)
crontab -e
# 0 2 * * * /path/to/backup.sh
```

### Database Restore

```bash
# Restore from backup
docker exec -i experimeh-postgres psql -U experimeh experimeh < backup.sql

# Restore from compressed backup
gunzip -c backup.sql.gz | docker exec -i experimeh-postgres \
  psql -U experimeh experimeh
```

### Volume Backup

```bash
# Backup Docker volume
docker run --rm \
  -v experimeh-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/volume-backup.tar.gz -C /data .

# Restore Docker volume
docker run --rm \
  -v experimeh-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/volume-backup.tar.gz -C /data
```

---

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs
docker-compose logs experimeh

# Check container status
docker-compose ps

# Inspect container
docker inspect experimeh-app
```

#### 2. Database Connection Failed

```bash
# Test database connection
docker exec experimeh-app nc -zv postgres 5432

# Check database logs
docker-compose logs postgres

# Verify credentials
docker exec experimeh-postgres psql -U experimeh -c "SELECT version();"
```

#### 3. Out of Memory

```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.yml
services:
  experimeh:
    deploy:
      resources:
        limits:
          memory: 2G
```

#### 4. Kafka Connection Issues

```bash
# Check Kafka status
docker exec experimeh-kafka kafka-topics --list \
  --bootstrap-server localhost:9092

# View Kafka logs
docker-compose logs kafka
```

### Debug Mode

```bash
# Enable debug logging
docker-compose up -e LOG_LEVEL=debug

# Run with shell access
docker run -it --entrypoint /bin/sh experimeh
```

---

## Performance Tuning

### Application Optimization

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096"

# Enable cluster mode (multiple processes)
NODE_CLUSTER_ENABLED=true
NODE_CLUSTER_WORKERS=4
```

### Database Optimization

```sql
-- Update PostgreSQL configuration
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET work_mem = '16MB';

-- Reload configuration
SELECT pg_reload_conf();
```

### Redis Optimization

```bash
# Redis configuration
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Connection Pooling

```bash
# Database pool settings
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Redis pool settings
REDIS_POOL_MIN=5
REDIS_POOL_MAX=20
```

### Caching Strategy

```bash
# Increase cache TTL for stable experiments
ASSIGNMENT_CACHE_TTL=7200

# Use Redis for distributed caching
CACHE_TYPE=redis
CACHE_TTL=3600
```

---

## Production Checklist

- [ ] Strong passwords for all services
- [ ] API keys configured and secured
- [ ] Environment variables properly set
- [ ] Database backups automated
- [ ] Monitoring and alerting configured
- [ ] Logs aggregated and searchable
- [ ] Health checks passing
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Resource limits set
- [ ] Auto-scaling configured
- [ ] Disaster recovery plan documented

---

## Support

For issues and questions:
- GitHub Issues: <repository-url>/issues
- Documentation: /docs
- Email: support@example.com
