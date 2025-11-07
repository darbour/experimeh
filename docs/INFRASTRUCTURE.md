# Infrastructure Guide

This guide explains how to set up and manage the infrastructure required for Experimeh.

## Overview

Experimeh requires the following infrastructure services:

1. **PostgreSQL** - Primary database for experiments, assignments, metrics, and analysis results
2. **Redis** - High-performance cache for experiments, feature flags, and assignments
3. **Kafka** - Event streaming for exposures, metrics, and assignments
4. **Zookeeper** - Kafka coordination service

## Quick Start

The easiest way to get started is using the provided infrastructure scripts with Docker:

```bash
# Start all infrastructure services
./scripts/infra-setup.sh

# Check if everything is running correctly
./scripts/infra-health.sh
```

## Infrastructure Scripts

### Setup Script (`infra-setup.sh`)

Starts all required infrastructure services using Docker Compose.

**Usage:**
```bash
./scripts/infra-setup.sh [OPTIONS]

Options:
  --logs, -l     Follow logs after setup
  --help, -h     Show help message
```

**What it does:**
1. Checks Docker and Docker Compose are installed
2. Stops any existing containers
3. Starts PostgreSQL, Redis, Kafka, and Zookeeper
4. Waits for all services to be healthy
5. Initializes the database schema
6. Creates required Kafka topics

**Example:**
```bash
# Basic setup
./scripts/infra-setup.sh

# Setup and follow logs
./scripts/infra-setup.sh --logs
```

### Teardown Script (`infra-teardown.sh`)

Stops and removes infrastructure services.

**Usage:**
```bash
./scripts/infra-teardown.sh [OPTIONS]

Options:
  --volumes, -v  Remove volumes (deletes all data)
  --force, -f    Force remove all containers and volumes
  --help, -h     Show help message
```

**What it does:**
1. Stops all running containers
2. Removes containers (optionally removes volumes)
3. Cleans up networks

**Examples:**
```bash
# Stop infrastructure (keeps data)
./scripts/infra-teardown.sh

# Stop and delete all data
./scripts/infra-teardown.sh --volumes

# Force remove everything
./scripts/infra-teardown.sh --force
```

### Health Check Script (`infra-health.sh`)

Checks the health of all infrastructure services.

**Usage:**
```bash
./scripts/infra-health.sh [OPTIONS]

Options:
  --details, -d  Show detailed container information
  --help, -h     Show help message
```

**What it checks:**
1. Docker daemon is running
2. All containers are running and healthy
3. PostgreSQL is accepting connections and has tables
4. Redis is accepting connections
5. Kafka is accepting connections and has topics
6. Zookeeper is accepting connections

**Examples:**
```bash
# Basic health check
./scripts/infra-health.sh

# Detailed health check with resource usage
./scripts/infra-health.sh --details
```

### Reset Script (`infra-reset.sh`)

Completely resets the infrastructure (teardown + setup).

**Usage:**
```bash
./scripts/infra-reset.sh [OPTIONS]

Options:
  --yes, -y      Skip confirmation prompt
  --logs, -l     Follow logs after reset
  --help, -h     Show help message
```

**What it does:**
1. Tears down all infrastructure (with volumes)
2. Waits for cleanup to complete
3. Sets up fresh infrastructure
4. Initializes everything from scratch

**Examples:**
```bash
# Interactive reset (asks for confirmation)
./scripts/infra-reset.sh

# Non-interactive reset
./scripts/infra-reset.sh --yes

# Reset and follow logs
./scripts/infra-reset.sh --yes --logs
```

**⚠️ WARNING:** This deletes ALL data including experiments, assignments, metrics, and cached data!

## Service Endpoints

After running `./scripts/infra-setup.sh`, services are available at:

| Service | Endpoint | Description |
|---------|----------|-------------|
| PostgreSQL | `localhost:5432` | Primary database |
| Redis | `localhost:6379` | Cache service |
| Kafka | `localhost:9092` | Message broker |
| Zookeeper | `localhost:2181` | Kafka coordination |

## Database Credentials (Development)

**Default credentials for local development:**

- Host: `localhost`
- Port: `5432`
- Database: `experimeh_test`
- User: `experimeh`
- Password: `test_password`

**⚠️ WARNING:** These are development credentials only. Never use these in production!

## Docker Compose Configuration

The infrastructure is defined in `docker-compose.yml`:

```yaml
services:
  postgres:
    - PostgreSQL 15 (Alpine)
    - Port: 5432
    - Volume: postgres_data
    - Health checks enabled

  redis:
    - Redis 7 (Alpine)
    - Port: 6379
    - Health checks enabled

  zookeeper:
    - Confluent Platform Zookeeper 7.5
    - Port: 2181
    - Health checks enabled

  kafka:
    - Confluent Platform Kafka 7.5
    - Ports: 9092 (external), 29092 (internal)
    - Auto-creates topics
    - Health checks enabled
    - Depends on Zookeeper
```

## Kafka Topics

The following topics are automatically created:

| Topic | Partitions | Replication | Retention | Purpose |
|-------|------------|-------------|-----------|---------|
| `experimeh.exposures` | 3 | 1 | 7 days | User exposure events |
| `experimeh.metrics` | 3 | 1 | 7 days | Metric tracking events |
| `experimeh.assignments` | 3 | 1 | 7 days | Variant assignment events |

## Database Schema

The database schema includes:

- `experiments` - Experiment configurations
- `variants` - Experiment variant definitions
- `assignments` - User variant assignments
- `exposures` - Exposure event logs
- `metrics` - Metric event logs
- `analysis_results` - Statistical analysis results

See `src/storage/schemas.sql` for the complete schema definition.

## Manual Setup (Without Docker)

If you prefer to set up infrastructure manually:

### 1. PostgreSQL

```bash
# Install PostgreSQL 14+
# Create database and user
createdb experimeh_test
createuser experimeh -P

# Run schema initialization
psql -U experimeh -d experimeh_test -f scripts/init-db.sh
```

### 2. Redis

```bash
# Install Redis 6+
redis-server --port 6379
```

### 3. Kafka

```bash
# Install Kafka 3.0+
# Start Zookeeper
bin/zookeeper-server-start.sh config/zookeeper.properties

# Start Kafka
bin/kafka-server-start.sh config/server.properties

# Create topics
bin/kafka-topics.sh --create --topic experimeh.exposures --partitions 3 --replication-factor 1 --bootstrap-server localhost:9092
bin/kafka-topics.sh --create --topic experimeh.metrics --partitions 3 --replication-factor 1 --bootstrap-server localhost:9092
bin/kafka-topics.sh --create --topic experimeh.assignments --partitions 3 --replication-factor 1 --bootstrap-server localhost:9092
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your connection details:

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=experimeh_test
POSTGRES_USER=experimeh
POSTGRES_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka
KAFKA_BROKERS=localhost:9092
```

## Troubleshooting

### Services not starting

**Check Docker is running:**
```bash
docker info
```

**Check logs:**
```bash
docker-compose logs
```

**Check specific service:**
```bash
docker logs experimeh-postgres
docker logs experimeh-redis
docker logs experimeh-kafka
```

### Port conflicts

If ports are already in use, you can modify `docker-compose.yml`:

```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # Change 5432 to 5433
```

### Kafka not accepting connections

Kafka can take 30-40 seconds to fully initialize. Wait a bit and check again:

```bash
./scripts/infra-health.sh
```

### Database schema not created

Manually run the initialization script:

```bash
docker exec experimeh-postgres psql -U experimeh -d experimeh_test -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

Or reset the infrastructure:

```bash
./scripts/infra-reset.sh --yes
```

### Permission denied errors

Make sure scripts are executable:

```bash
chmod +x scripts/infra-*.sh
```

## Production Considerations

For production deployments:

1. **Use managed services** - Consider AWS RDS, ElastiCache, MSK
2. **Update credentials** - Never use default development credentials
3. **Enable SSL/TLS** - Encrypt connections to all services
4. **Configure replication** - Set appropriate replication factors for Kafka
5. **Set up monitoring** - Use Prometheus, CloudWatch, or DataDog
6. **Configure backups** - Regular database backups
7. **Scale appropriately** - Adjust resource limits and instances
8. **Network security** - Use VPCs, security groups, and firewalls

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guidelines.

## CI/CD Integration

### GitHub Actions

```yaml
services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES_DB: experimeh_test
      POSTGRES_USER: experimeh
      POSTGRES_PASSWORD: test_password
    ports:
      - 5432:5432

  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    env:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    ports:
      - 9092:9092
```

### Local Development

```bash
# One-time setup
./scripts/infra-setup.sh

# Daily workflow
./scripts/infra-health.sh  # Check status
npm run dev                # Start development server

# Reset when needed
./scripts/infra-reset.sh --yes
```

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/docs/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Confluent Platform](https://docs.confluent.io/)

## Support

For infrastructure-related issues:

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Run health checks: `./scripts/infra-health.sh --details`
3. Review logs: `docker-compose logs`
4. Reset infrastructure: `./scripts/infra-reset.sh --yes`

If issues persist, please open an issue on GitHub with:
- Output from `./scripts/infra-health.sh --details`
- Relevant logs from `docker-compose logs`
- Your Docker and Docker Compose versions
