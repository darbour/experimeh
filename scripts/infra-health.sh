#!/bin/bash

# ==========================================
# Infrastructure Health Check Script
# ==========================================
# Checks the health of all infrastructure services
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

# Health check results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

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
    echo -e "${BLUE}[CHECK]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

# ==========================================
# Check if Docker is running
# ==========================================
check_docker() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_step "Checking Docker..."

    if ! command -v docker &> /dev/null; then
        log_fail "Docker is not installed"
        return 1
    fi

    if ! docker info &> /dev/null; then
        log_fail "Docker daemon is not running"
        return 1
    fi

    log_pass "Docker is running"
    return 0
}

# ==========================================
# Check container status
# ==========================================
check_container() {
    local container_name=$1
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    log_step "Checking ${container_name}..."

    # Check if container exists
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_fail "${container_name} container does not exist"
        return 1
    fi

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_fail "${container_name} container is not running"
        return 1
    fi

    # Check health status if available
    local health_status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "${container_name}" 2>/dev/null)

    if [ "$health_status" = "healthy" ]; then
        log_pass "${container_name} is healthy"
        return 0
    elif [ "$health_status" = "unhealthy" ]; then
        log_fail "${container_name} is unhealthy"
        return 1
    elif [ "$health_status" = "starting" ]; then
        log_warn "${container_name} is starting"
        log_pass "${container_name} is running (health check in progress)"
        return 0
    else
        # No health check configured
        log_pass "${container_name} is running"
        return 0
    fi
}

# ==========================================
# Check PostgreSQL connectivity
# ==========================================
check_postgres() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_step "Checking PostgreSQL connectivity..."

    if docker exec experimeh-postgres psql -U experimeh -d experimeh_test -c "SELECT 1" &> /dev/null; then
        log_pass "PostgreSQL is accepting connections"
        return 0
    else
        log_fail "PostgreSQL is not accepting connections"
        return 1
    fi
}

# ==========================================
# Check PostgreSQL tables
# ==========================================
check_postgres_tables() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_step "Checking PostgreSQL tables..."

    local tables=$(docker exec experimeh-postgres psql -U experimeh -d experimeh_test -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')

    if [ "$tables" -gt 0 ]; then
        log_pass "PostgreSQL has ${tables} tables"
        return 0
    else
        log_warn "PostgreSQL has no tables (database may not be initialized)"
        return 0
    fi
}

# ==========================================
# Check Redis connectivity
# ==========================================
check_redis() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_step "Checking Redis connectivity..."

    if docker exec experimeh-redis redis-cli ping &> /dev/null; then
        log_pass "Redis is accepting connections"
        return 0
    else
        log_fail "Redis is not accepting connections"
        return 1
    fi
}

# ==========================================
# Check Kafka connectivity
# ==========================================
check_kafka() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_step "Checking Kafka connectivity..."

    if docker exec experimeh-kafka kafka-broker-api-versions --bootstrap-server localhost:9092 &> /dev/null; then
        log_pass "Kafka is accepting connections"
        return 0
    else
        log_fail "Kafka is not accepting connections"
        return 1
    fi
}

# ==========================================
# Check Kafka topics
# ==========================================
check_kafka_topics() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_step "Checking Kafka topics..."

    local topics=$(docker exec experimeh-kafka kafka-topics --bootstrap-server localhost:9092 --list 2>/dev/null | grep "^experimeh\." | wc -l)

    if [ "$topics" -gt 0 ]; then
        log_pass "Kafka has ${topics} experimeh topics"
        return 0
    else
        log_warn "Kafka has no experimeh topics (topics may not be initialized)"
        return 0
    fi
}

# ==========================================
# Check Zookeeper connectivity
# ==========================================
check_zookeeper() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_step "Checking Zookeeper connectivity..."

    if docker exec experimeh-zookeeper nc -z localhost 2181 &> /dev/null; then
        log_pass "Zookeeper is accepting connections"
        return 0
    else
        log_fail "Zookeeper is not accepting connections"
        return 1
    fi
}

# ==========================================
# Display summary
# ==========================================
display_summary() {
    echo ""
    echo "=========================================="
    echo "  Health Check Summary"
    echo "=========================================="
    echo ""
    echo "  Total checks:  ${TOTAL_CHECKS}"
    echo -e "  ${GREEN}Passed:        ${PASSED_CHECKS}${NC}"

    if [ $FAILED_CHECKS -gt 0 ]; then
        echo -e "  ${RED}Failed:        ${FAILED_CHECKS}${NC}"
    else
        echo -e "  ${GREEN}Failed:        ${FAILED_CHECKS}${NC}"
    fi

    echo ""

    if [ $FAILED_CHECKS -eq 0 ]; then
        log_info "All health checks passed! ✓"
        echo ""
        return 0
    else
        log_error "Some health checks failed!"
        echo ""
        log_info "Try running: ./scripts/infra-setup.sh"
        echo ""
        return 1
    fi
}

# ==========================================
# Show detailed information
# ==========================================
show_details() {
    echo ""
    echo "=========================================="
    echo "  Container Details"
    echo "=========================================="
    echo ""

    docker ps --filter "name=experimeh-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    echo "=========================================="
    echo "  Resource Usage"
    echo "=========================================="
    echo ""

    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker ps --filter "name=experimeh-" --format "{{.Names}}")

    echo ""
}

# ==========================================
# Main execution
# ==========================================
main() {
    echo "=========================================="
    echo "  Experimeh Infrastructure Health Check"
    echo "=========================================="
    echo ""

    # Parse arguments
    SHOW_DETAILS=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --details|-d)
                SHOW_DETAILS=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Check health of infrastructure services"
                echo ""
                echo "Options:"
                echo "  --details, -d  Show detailed container information"
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

    # Run health checks
    check_docker || true

    # Check containers
    check_container "experimeh-postgres" || true
    check_container "experimeh-redis" || true
    check_container "experimeh-zookeeper" || true
    check_container "experimeh-kafka" || true

    # Check connectivity
    if docker ps --format '{{.Names}}' | grep -q "^experimeh-postgres$"; then
        check_postgres || true
        check_postgres_tables || true
    fi

    if docker ps --format '{{.Names}}' | grep -q "^experimeh-redis$"; then
        check_redis || true
    fi

    if docker ps --format '{{.Names}}' | grep -q "^experimeh-zookeeper$"; then
        check_zookeeper || true
    fi

    if docker ps --format '{{.Names}}' | grep -q "^experimeh-kafka$"; then
        check_kafka || true
        check_kafka_topics || true
    fi

    # Display summary
    display_summary

    # Show details if requested
    if [ "$SHOW_DETAILS" = true ]; then
        show_details
    fi

    # Exit with appropriate code
    if [ $FAILED_CHECKS -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# Run main function
main "$@"
