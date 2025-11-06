#!/bin/bash

# ==========================================
# Infrastructure Reset Script
# ==========================================
# Completely resets infrastructure:
# - Tears down existing services
# - Removes all data
# - Sets up fresh infrastructure
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
# Show help
# ==========================================
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Reset infrastructure (teardown + setup)"
    echo ""
    echo "Options:"
    echo "  --yes, -y          Skip confirmation prompt"
    echo "  --logs, -l         Follow logs after reset"
    echo "  --help, -h         Show this help message"
    echo ""
    echo "WARNING: This will delete all data!"
    echo ""
}

# ==========================================
# Confirm reset
# ==========================================
confirm_reset() {
    log_warn "This will completely reset the infrastructure and DELETE ALL DATA!"
    echo ""
    echo "This includes:"
    echo "  - All experiments and feature flags"
    echo "  - All assignments and exposures"
    echo "  - All metrics and analysis results"
    echo "  - All Kafka messages"
    echo "  - All Redis cache"
    echo ""
    read -p "Are you sure you want to continue? (yes/no) " -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Reset cancelled"
        exit 0
    fi
}

# ==========================================
# Main execution
# ==========================================
main() {
    echo "=========================================="
    echo "  Experimeh Infrastructure Reset"
    echo "=========================================="
    echo ""

    # Parse arguments
    SKIP_CONFIRMATION=false
    FOLLOW_LOGS=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --yes|-y)
                SKIP_CONFIRMATION=true
                shift
                ;;
            --logs|-l)
                FOLLOW_LOGS=true
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

    # Check prerequisites
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Confirm reset
    if [ "$SKIP_CONFIRMATION" = false ]; then
        confirm_reset
    fi

    # Teardown existing infrastructure
    log_step "Tearing down existing infrastructure..."
    if [ -f "${SCRIPT_DIR}/infra-teardown.sh" ]; then
        bash "${SCRIPT_DIR}/infra-teardown.sh" --force
    else
        log_error "infra-teardown.sh not found"
        exit 1
    fi

    echo ""
    log_info "Waiting 3 seconds for cleanup to complete..."
    sleep 3
    echo ""

    # Setup fresh infrastructure
    log_step "Setting up fresh infrastructure..."
    if [ -f "${SCRIPT_DIR}/infra-setup.sh" ]; then
        if [ "$FOLLOW_LOGS" = true ]; then
            bash "${SCRIPT_DIR}/infra-setup.sh" --logs
        else
            bash "${SCRIPT_DIR}/infra-setup.sh"
        fi
    else
        log_error "infra-setup.sh not found"
        exit 1
    fi

    echo ""
    log_info "Infrastructure reset complete!"
    echo ""
}

# Run main function
main "$@"
