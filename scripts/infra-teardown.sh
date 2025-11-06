#!/bin/bash

# ==========================================
# Infrastructure Teardown Script
# ==========================================
# Stops and cleans up all infrastructure services
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
# Stop containers
# ==========================================
stop_containers() {
    log_step "Stopping infrastructure containers..."

    cd "${PROJECT_ROOT}"

    # Try docker-compose first, then docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose stop 2>/dev/null || true
    else
        docker compose stop 2>/dev/null || true
    fi

    log_info "Containers stopped"
}

# ==========================================
# Remove containers
# ==========================================
remove_containers() {
    log_step "Removing infrastructure containers..."

    cd "${PROJECT_ROOT}"

    # Try docker-compose first, then docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose down 2>/dev/null || true
    else
        docker compose down 2>/dev/null || true
    fi

    log_info "Containers removed"
}

# ==========================================
# Remove volumes
# ==========================================
remove_volumes() {
    log_step "Removing infrastructure volumes..."

    cd "${PROJECT_ROOT}"

    # Try docker-compose first, then docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose down -v 2>/dev/null || true
    else
        docker compose down -v 2>/dev/null || true
    fi

    log_info "Volumes removed"
}

# ==========================================
# Remove networks
# ==========================================
remove_networks() {
    log_step "Removing infrastructure networks..."

    # Remove the experimeh network if it exists
    if docker network ls | grep -q "experimeh-network"; then
        docker network rm experimeh-network 2>/dev/null || true
        log_info "Network removed"
    else
        log_info "Network already removed"
    fi
}

# ==========================================
# Display remaining containers
# ==========================================
display_status() {
    log_step "Checking for remaining containers..."

    local remaining=$(docker ps -a --filter "name=experimeh-" --format "{{.Names}}" | wc -l)

    if [ "$remaining" -gt 0 ]; then
        log_warn "Found ${remaining} remaining container(s):"
        docker ps -a --filter "name=experimeh-" --format "table {{.Names}}\t{{.Status}}"
        echo ""
        log_info "Run with --force to remove them"
    else
        log_info "All infrastructure containers removed"
    fi
}

# ==========================================
# Force cleanup
# ==========================================
force_cleanup() {
    log_step "Performing force cleanup..."

    # Stop and remove all experimeh containers
    local containers=$(docker ps -a --filter "name=experimeh-" --format "{{.Names}}")
    if [ -n "$containers" ]; then
        echo "$containers" | xargs -r docker stop 2>/dev/null || true
        echo "$containers" | xargs -r docker rm 2>/dev/null || true
        log_info "Forced removal of all containers"
    fi

    # Remove volumes
    local volumes=$(docker volume ls --filter "name=experimeh" --format "{{.Name}}")
    if [ -n "$volumes" ]; then
        echo "$volumes" | xargs -r docker volume rm 2>/dev/null || true
        log_info "Forced removal of all volumes"
    fi

    # Remove network
    docker network rm experimeh-network 2>/dev/null || true

    log_info "Force cleanup complete"
}

# ==========================================
# Show help
# ==========================================
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Stop and clean up infrastructure services"
    echo ""
    echo "Options:"
    echo "  --volumes, -v      Remove volumes (deletes all data)"
    echo "  --force, -f        Force remove all containers and volumes"
    echo "  --help, -h         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                 # Stop containers"
    echo "  $0 --volumes       # Stop containers and delete data"
    echo "  $0 --force         # Force remove everything"
    echo ""
}

# ==========================================
# Main execution
# ==========================================
main() {
    echo "=========================================="
    echo "  Experimeh Infrastructure Teardown"
    echo "=========================================="
    echo ""

    # Parse arguments
    REMOVE_VOLUMES=false
    FORCE_CLEANUP=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --volumes|-v)
                REMOVE_VOLUMES=true
                shift
                ;;
            --force|-f)
                FORCE_CLEANUP=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Check Docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Execute teardown
    if [ "$FORCE_CLEANUP" = true ]; then
        force_cleanup
    else
        stop_containers

        if [ "$REMOVE_VOLUMES" = true ]; then
            log_warn "This will delete all data!"
            read -p "Are you sure? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                remove_volumes
                remove_networks
            else
                log_info "Volume removal cancelled"
                remove_containers
            fi
        else
            remove_containers
        fi
    fi

    display_status

    echo ""
    log_info "Teardown complete!"
    echo ""
}

# Run main function
main "$@"
