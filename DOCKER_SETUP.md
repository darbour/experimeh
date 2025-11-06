# Docker Setup Quick Reference

## Files Created

### Core Docker Files
- ✅ `.dockerignore` - Excludes unnecessary files from Docker build
- ✅ `Dockerfile` - Multi-stage build (dependencies → build → production)
- ✅ `docker-compose.yml` - Complete stack orchestration

### Scripts
- ✅ `scripts/docker-entrypoint.sh` - Application entrypoint with health checks
- ✅ `scripts/init-db.sh` - Database initialization and schema setup

### Configuration
- ✅ `config/docker.env` - Environment variable template
- ✅ `docs/DEPLOYMENT.md` - Comprehensive deployment guide

## Quick Start

### 1. Initial Setup
```bash
# Copy environment template
cp config/docker.env .env

# Edit configuration (set passwords, API keys)
nano .env
```

### 2. Start Services
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Verify
```bash
# Check health
curl http://localhost:3000/health

# Check all services
docker-compose ps
```

### 4. Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove data (WARNING!)
docker-compose down -v
```

## Service Endpoints

- **Application**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Kafka**: localhost:9092

## Key Features

### Multi-Stage Dockerfile
- **Stage 1 (dependencies)**: Production dependencies only
- **Stage 2 (builder)**: TypeScript compilation
- **Stage 3 (production)**: Minimal runtime image

### Security
- ✅ Non-root user (nodejs:1001)
- ✅ Node 18 Alpine (minimal attack surface)
- ✅ Health checks on all services
- ✅ dumb-init for proper signal handling
- ✅ Read-only containers ready

### High Availability
- ✅ Health checks configured
- ✅ Restart policies (unless-stopped)
- ✅ Graceful shutdown handling
- ✅ Dependency ordering
- ✅ Resource limits configured

### Observability
- ✅ JSON file logging (10MB max, 3 files)
- ✅ Health endpoints (/health, /status)
- ✅ Structured logging to stdout
- ✅ Container metrics via `docker stats`

## Docker Image Size Optimization

The multi-stage build produces a minimal production image:
- Base: Node 18 Alpine (~50MB)
- Production dependencies only
- No dev dependencies
- No source TypeScript files
- No tests or documentation

Expected final image size: ~150-200MB

## Environment Variables

### Required
```bash
POSTGRES_PASSWORD=your_secure_password
VALID_API_KEYS=key1,key2,key3
ADMIN_API_KEYS=admin_key1
```

### Optional (with defaults)
```bash
PORT=3000
LOG_LEVEL=info
ASSIGNMENT_CACHE_TTL=3600
MAX_CONCURRENT_EXPERIMENTS=100
DEFAULT_CONFIDENCE_LEVEL=0.95
```

## Common Commands

### Build
```bash
# Build image
docker-compose build

# Build without cache
docker-compose build --no-cache

# Build specific service
docker-compose build experimeh
```

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f experimeh

# Last 100 lines
docker-compose logs --tail=100 experimeh
```

### Scale
```bash
# Run multiple app instances
docker-compose up -d --scale experimeh=3
```

### Clean Up
```bash
# Remove stopped containers
docker-compose rm

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune
```

## Database Management

### Backup
```bash
# Manual backup
docker exec experimeh-postgres pg_dump -U experimeh experimeh > backup.sql

# With timestamp
docker exec experimeh-postgres pg_dump -U experimeh experimeh > \
  backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore
```bash
# Restore from backup
docker exec -i experimeh-postgres psql -U experimeh experimeh < backup.sql
```

### Direct Access
```bash
# PostgreSQL shell
docker exec -it experimeh-postgres psql -U experimeh experimeh

# Redis shell
docker exec -it experimeh-redis redis-cli

# Application shell
docker exec -it experimeh-app /bin/sh
```

## Troubleshooting

### Check Service Health
```bash
# All services
docker-compose ps

# Specific service status
docker inspect experimeh-app --format='{{.State.Health.Status}}'
```

### View Service Logs
```bash
# Application
docker-compose logs experimeh

# Database
docker-compose logs postgres

# All with timestamps
docker-compose logs -t
```

### Network Issues
```bash
# Inspect network
docker network inspect experimeh-network

# Test connectivity
docker exec experimeh-app nc -zv postgres 5432
```

### Resource Usage
```bash
# Real-time stats
docker stats

# Container processes
docker-compose top
```

## Production Deployment

See `docs/DEPLOYMENT.md` for:
- Kubernetes deployment
- Security hardening
- Monitoring setup
- Backup strategies
- Performance tuning
- SSL/TLS configuration

## Next Steps

1. Configure environment variables in `.env`
2. Review security settings in `docs/DEPLOYMENT.md`
3. Set up monitoring and logging
4. Configure automated backups
5. Plan scaling strategy
6. Set up CI/CD pipeline
