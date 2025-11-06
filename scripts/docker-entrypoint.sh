#!/bin/sh

# ==========================================
# Docker Entrypoint Script for Experimeh
# ==========================================
# This script:
# - Waits for dependencies to be ready
# - Runs database migrations
# - Starts the application
# - Handles graceful shutdown
# ==========================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-2}"

# ==========================================
# Logging functions
# ==========================================
log_info() {
    echo "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

# ==========================================
# Wait for PostgreSQL
# ==========================================
wait_for_postgres() {
    log_info "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."

    local retries=0
    until nc -z "${POSTGRES_HOST}" "${POSTGRES_PORT}" 2>/dev/null; do
        retries=$((retries + 1))
        if [ ${retries} -ge ${MAX_RETRIES} ]; then
            log_error "PostgreSQL is not available after ${MAX_RETRIES} attempts"
            return 1
        fi
        log_warn "PostgreSQL is unavailable - sleeping ${RETRY_INTERVAL}s (attempt ${retries}/${MAX_RETRIES})"
        sleep ${RETRY_INTERVAL}
    done

    log_info "PostgreSQL is ready!"
    return 0
}

# ==========================================
# Wait for Redis
# ==========================================
wait_for_redis() {
    log_info "Waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}..."

    local retries=0
    until nc -z "${REDIS_HOST}" "${REDIS_PORT}" 2>/dev/null; do
        retries=$((retries + 1))
        if [ ${retries} -ge ${MAX_RETRIES} ]; then
            log_error "Redis is not available after ${MAX_RETRIES} attempts"
            return 1
        fi
        log_warn "Redis is unavailable - sleeping ${RETRY_INTERVAL}s (attempt ${retries}/${MAX_RETRIES})"
        sleep ${RETRY_INTERVAL}
    done

    log_info "Redis is ready!"
    return 0
}

# ==========================================
# Wait for Kafka
# ==========================================
wait_for_kafka() {
    log_info "Waiting for Kafka at ${KAFKA_BROKERS}..."

    # Extract host and port from KAFKA_BROKERS
    KAFKA_HOST=$(echo "${KAFKA_BROKERS}" | cut -d: -f1)
    KAFKA_PORT=$(echo "${KAFKA_BROKERS}" | cut -d: -f2)

    local retries=0
    until nc -z "${KAFKA_HOST}" "${KAFKA_PORT}" 2>/dev/null; do
        retries=$((retries + 1))
        if [ ${retries} -ge ${MAX_RETRIES} ]; then
            log_error "Kafka is not available after ${MAX_RETRIES} attempts"
            return 1
        fi
        log_warn "Kafka is unavailable - sleeping ${RETRY_INTERVAL}s (attempt ${retries}/${MAX_RETRIES})"
        sleep ${RETRY_INTERVAL}
    done

    log_info "Kafka is ready!"
    return 0
}

# ==========================================
# Run database migrations
# ==========================================
run_migrations() {
    log_info "Running database migrations..."

    # Check if migration script exists
    if [ -f "./scripts/migrate.sh" ]; then
        ./scripts/migrate.sh
        log_info "Migrations completed successfully"
    elif [ -f "./scripts/migrate.js" ]; then
        node ./scripts/migrate.js
        log_info "Migrations completed successfully"
    else
        log_warn "No migration script found, skipping migrations"
    fi
}

# ==========================================
# Graceful shutdown handler
# ==========================================
shutdown() {
    log_info "Received shutdown signal, gracefully shutting down..."

    # Send SIGTERM to the application process
    if [ -n "${APP_PID}" ]; then
        kill -TERM "${APP_PID}" 2>/dev/null || true

        # Wait for the process to exit (up to 30 seconds)
        local wait_time=0
        while kill -0 "${APP_PID}" 2>/dev/null && [ ${wait_time} -lt 30 ]; do
            sleep 1
            wait_time=$((wait_time + 1))
        done

        # Force kill if still running
        if kill -0 "${APP_PID}" 2>/dev/null; then
            log_warn "Application did not shut down gracefully, forcing shutdown"
            kill -9 "${APP_PID}" 2>/dev/null || true
        fi
    fi

    log_info "Shutdown complete"
    exit 0
}

# ==========================================
# Trap signals for graceful shutdown
# ==========================================
trap shutdown SIGTERM SIGINT SIGQUIT

# ==========================================
# Main execution
# ==========================================
main() {
    log_info "Starting Experimeh application..."
    log_info "Environment: ${NODE_ENV}"
    log_info "Port: ${PORT}"

    # Wait for dependencies
    wait_for_postgres || exit 1
    wait_for_redis || exit 1
    wait_for_kafka || exit 1

    # Run migrations
    if [ "${SKIP_MIGRATIONS}" != "true" ]; then
        run_migrations
    else
        log_warn "Skipping migrations (SKIP_MIGRATIONS=true)"
    fi

    # Start the application
    log_info "Starting Node.js application..."
    node dist/index.js &
    APP_PID=$!

    log_info "Application started with PID ${APP_PID}"

    # Wait for the application process
    wait ${APP_PID}
    EXIT_CODE=$?

    if [ ${EXIT_CODE} -ne 0 ]; then
        log_error "Application exited with code ${EXIT_CODE}"
        exit ${EXIT_CODE}
    fi

    log_info "Application exited normally"
}

# Run main function
main
