#!/bin/bash

# ==========================================
# Database Initialization Script
# ==========================================
# This script runs automatically when the
# PostgreSQL container starts for the first time
# ==========================================

set -e

# Configuration
POSTGRES_DB="${POSTGRES_DB:-experimeh}"
POSTGRES_USER="${POSTGRES_USER:-experimeh}"

echo "==========================================
Initializing database: ${POSTGRES_DB}
User: ${POSTGRES_USER}
=========================================="

# ==========================================
# Create database schema
# ==========================================
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- ==========================================
    -- Experiments table
    -- ==========================================
    CREATE TABLE IF NOT EXISTS experiments (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        config JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE
    );

    -- ==========================================
    -- Variants table
    -- ==========================================
    CREATE TABLE IF NOT EXISTS variants (
        id VARCHAR(255) PRIMARY KEY,
        experiment_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        allocation DECIMAL(5,4) NOT NULL,
        config JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- Assignments table
    -- ==========================================
    CREATE TABLE IF NOT EXISTS assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        experiment_id VARCHAR(255) NOT NULL,
        variant_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        context JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE,
        UNIQUE (experiment_id, user_id)
    );

    -- ==========================================
    -- Exposures table
    -- ==========================================
    CREATE TABLE IF NOT EXISTS exposures (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        experiment_id VARCHAR(255) NOT NULL,
        variant_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        context JSONB DEFAULT '{}',
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- Metrics table
    -- ==========================================
    CREATE TABLE IF NOT EXISTS metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        experiment_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        variant_id VARCHAR(255),
        metric_name VARCHAR(255) NOT NULL,
        metric_value DOUBLE PRECISION NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        context JSONB DEFAULT '{}',
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL
    );

    -- ==========================================
    -- Analysis results table
    -- ==========================================
    CREATE TABLE IF NOT EXISTS analysis_results (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        experiment_id VARCHAR(255) NOT NULL,
        analysis_type VARCHAR(100) NOT NULL,
        results JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- Indexes for performance
    -- ==========================================

    -- Experiments indexes
    CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
    CREATE INDEX IF NOT EXISTS idx_experiments_type ON experiments(type);
    CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON experiments(created_at);

    -- Variants indexes
    CREATE INDEX IF NOT EXISTS idx_variants_experiment_id ON variants(experiment_id);

    -- Assignments indexes
    CREATE INDEX IF NOT EXISTS idx_assignments_experiment_id ON assignments(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_variant_id ON assignments(variant_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON assignments(created_at);

    -- Exposures indexes
    CREATE INDEX IF NOT EXISTS idx_exposures_experiment_id ON exposures(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_exposures_user_id ON exposures(user_id);
    CREATE INDEX IF NOT EXISTS idx_exposures_variant_id ON exposures(variant_id);
    CREATE INDEX IF NOT EXISTS idx_exposures_timestamp ON exposures(timestamp);
    CREATE INDEX IF NOT EXISTS idx_exposures_exp_user ON exposures(experiment_id, user_id);

    -- Metrics indexes
    CREATE INDEX IF NOT EXISTS idx_metrics_experiment_id ON metrics(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON metrics(user_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_variant_id ON metrics(variant_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_metric_name ON metrics(metric_name);
    CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
    CREATE INDEX IF NOT EXISTS idx_metrics_exp_metric ON metrics(experiment_id, metric_name);

    -- Analysis results indexes
    CREATE INDEX IF NOT EXISTS idx_analysis_experiment_id ON analysis_results(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_type ON analysis_results(analysis_type);
    CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis_results(created_at);

    -- ==========================================
    -- Create trigger to update updated_at
    -- ==========================================
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    CREATE TRIGGER update_experiments_updated_at
        BEFORE UPDATE ON experiments
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    -- ==========================================
    -- Create views for analytics
    -- ==========================================

    -- Summary view for experiments
    CREATE OR REPLACE VIEW experiment_summary AS
    SELECT
        e.id,
        e.name,
        e.type,
        e.status,
        COUNT(DISTINCT a.user_id) as total_users,
        COUNT(DISTINCT exp.user_id) as exposed_users,
        COUNT(DISTINCT v.id) as variant_count,
        e.created_at,
        e.started_at,
        e.ended_at
    FROM experiments e
    LEFT JOIN variants v ON e.id = v.experiment_id
    LEFT JOIN assignments a ON e.id = a.experiment_id
    LEFT JOIN exposures exp ON e.id = exp.experiment_id
    GROUP BY e.id, e.name, e.type, e.status, e.created_at, e.started_at, e.ended_at;

    -- Variant performance view
    CREATE OR REPLACE VIEW variant_performance AS
    SELECT
        e.id as experiment_id,
        e.name as experiment_name,
        v.id as variant_id,
        v.name as variant_name,
        COUNT(DISTINCT a.user_id) as assigned_users,
        COUNT(DISTINCT exp.user_id) as exposed_users,
        COUNT(m.id) as metric_events,
        AVG(m.metric_value) as avg_metric_value
    FROM experiments e
    JOIN variants v ON e.id = v.experiment_id
    LEFT JOIN assignments a ON v.id = a.variant_id
    LEFT JOIN exposures exp ON v.id = exp.variant_id
    LEFT JOIN metrics m ON v.id = m.variant_id
    GROUP BY e.id, e.name, v.id, v.name;

    -- Grant permissions
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${POSTGRES_USER};
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${POSTGRES_USER};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${POSTGRES_USER};

EOSQL

echo "==========================================
Database initialization complete!
=========================================="
