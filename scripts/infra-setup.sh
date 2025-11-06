#!/bin/bash

# ==========================================
# Infrastructure Setup Script
# ==========================================
# Sets up all required infrastructure for Experimeh:
# - PostgreSQL
# - Redis
# - Kafka + Zookeeper
# ==========================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
MAX_RETRIES=30
RETRY_INTERVAL=2

# ==========================================
# Logging functions
# ==========================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# ==========================================
# Check prerequisites
# ==========================================
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        log_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        log_info "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi

    log_info "All prerequisites satisfied"
}

# ==========================================
# Stop existing containers
# ==========================================
stop_existing_containers() {
    log_step "Stopping existing containers (if any)..."

    cd "${PROJECT_ROOT}"

    # Try docker-compose first, then docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose down 2>/dev/null || true
    else
        docker compose down 2>/dev/null || true
    fi

    log_info "Existing containers stopped"
}

# ==========================================
# Start infrastructure services
# ==========================================
start_infrastructure() {
    log_step "Starting infrastructure services..."

    cd "${PROJECT_ROOT}"

    # Start services with docker-compose or docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
    else
        docker compose up -d
    fi

    log_info "Infrastructure services started"
}

# ==========================================
# Wait for service to be healthy
# ==========================================
wait_for_service() {
    local service_name=$1
    local max_retries=${2:-$MAX_RETRIES}

    log_step "Waiting for ${service_name} to be healthy..."

    local retries=0
    while [ $retries -lt $max_retries ]; do
        # Check if container is running and healthy
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "experimeh-${service_name}" 2>/dev/null || echo "unknown")

        if [ "$health_status" = "healthy" ]; then
            log_info "${service_name} is healthy!"
            return 0
        elif [ "$health_status" = "unhealthy" ]; then
            log_warn "${service_name} is unhealthy - retrying..."
        elif [ "$health_status" = "unknown" ]; then
            # Service might not have health check, check if it's running
            if docker ps --format '{{.Names}}' | grep -q "experimeh-${service_name}"; then
                log_info "${service_name} is running (no health check)"
                return 0
            fi
        fi

        retries=$((retries + 1))
        log_warn "${service_name} not ready yet (attempt ${retries}/${max_retries})"
        sleep $RETRY_INTERVAL
    done

    log_error "${service_name} did not become healthy in time"
    return 1
}

# ==========================================
# Initialize database
# ==========================================
initialize_database() {
    log_step "Initializing database schema..."

    # Run the init-db script
    if [ -f "${SCRIPT_DIR}/init-db.sh" ]; then
        # Execute SQL directly using docker exec
        docker exec experimeh-postgres psql -U experimeh -d experimeh_test -f /docker-entrypoint-initdb.d/init-db.sh 2>/dev/null || {
            # If that doesn't work, run the commands directly
            docker exec experimeh-postgres psql -U experimeh -d experimeh_test -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
            log_info "Database initialization completed (extensions already exist)"
        }
    else
        log_warn "init-db.sh not found, skipping database initialization"
    fi
}

# ==========================================
# Create Kafka topics
# ==========================================
create_kafka_topics() {
    log_step "Creating Kafka topics..."

    # Topics configuration
    local topics=(
        "experimeh.exposures:3:1"
        "experimeh.metrics:3:1"
        "experimeh.assignments:3:1"
    )

    for topic_config in "${topics[@]}"; do
        IFS=':' read -r topic partitions replication <<< "$topic_config"

        # Check if topic exists
        if docker exec experimeh-kafka kafka-topics --bootstrap-server localhost:9092 --list 2>/dev/null | grep -q "^${topic}$"; then
            log_info "Topic ${topic} already exists"
        else
            # Create topic
            if docker exec experimeh-kafka kafka-topics \
                --bootstrap-server localhost:9092 \
                --create \
                --topic "${topic}" \
                --partitions "${partitions}" \
                --replication-factor "${replication}" \
                --config retention.ms=604800000 \
                2>/dev/null; then
                log_info "Created topic: ${topic}"
            else
                log_warn "Failed to create topic: ${topic}"
            fi
        fi
    done
}

# ==========================================
# Display service status
# ==========================================
display_status() {
    log_step "Infrastructure status:"
    echo ""

    # Display running containers
    docker ps --filter "name=experimeh-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    log_info "Infrastructure is ready!"
    echo ""
    echo "Service endpoints:"
    echo "  PostgreSQL:  localhost:5432"
    echo "  Redis:       localhost:6379"
    echo "  Kafka:       localhost:9092"
    echo "  Zookeeper:   localhost:2181"
    echo ""
    echo "Database credentials (dev/test):"
    echo "  Database:    experimeh_test"
    echo "  User:        experimeh"
    echo "  Password:    test_password"
    echo ""
}

# ==========================================
# Show logs
# ==========================================
show_logs() {
    log_step "Showing service logs (Ctrl+C to exit)..."
    echo ""

    cd "${PROJECT_ROOT}"

    if command -v docker-compose &> /dev/null; then
        docker-compose logs -f
    else
        docker compose logs -f
    fi
}

# ==========================================
# Main execution
# ==========================================
main() {
    echo "=========================================="
    echo "  Experimeh Infrastructure Setup"
    echo "=========================================="
    echo ""

    # Parse arguments
    FOLLOW_LOGS=false
    while [[ $# -gt 0 ]]; do
        case $1 in
            --logs|-l)
                FOLLOW_LOGS=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --logs, -l     Follow logs after setup"
                echo "  --help, -h     Show this help message"
                echo ""
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Execute setup steps
    check_prerequisites
    stop_existing_containers
    start_infrastructure

    # Wait for all services
    wait_for_service "postgres"
    wait_for_service "redis"
    wait_for_service "zookeeper"
    wait_for_service "kafka" 40  # Kafka takes longer

    # Initialize services
    initialize_database
    sleep 2  # Give Kafka a moment to fully initialize
    create_kafka_topics

    # Display status
    display_status

    # Follow logs if requested
    if [ "$FOLLOW_LOGS" = true ]; then
        show_logs
    fi
}

# Run main function
main "$@"
