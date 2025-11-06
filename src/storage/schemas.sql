-- PostgreSQL Schema for Experimeh Feature Flag & Experimentation System
-- Version: 1.0.0
-- Description: Database schema for experiments, feature flags, assignments, and audit logging

-- ============================================================================
-- Enable Required Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- EXPERIMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    design_type VARCHAR(50) NOT NULL CHECK (design_type IN ('ab', 'multivariate', 'factorial', 'within_subjects', 'switchback')),

    -- Experiment details
    hypotheses TEXT NOT NULL,
    primary_metric VARCHAR(255) NOT NULL,
    secondary_metrics JSONB DEFAULT '[]'::JSONB,
    guardrail_metrics JSONB DEFAULT '[]'::JSONB,

    -- Assignment configuration
    randomization_unit VARCHAR(50) NOT NULL CHECK (randomization_unit IN ('user', 'session', 'device', 'other')),
    assignment_key VARCHAR(255) NOT NULL,
    variants JSONB NOT NULL,
    design_config JSONB NOT NULL,
    targeting_rules TEXT,
    traffic_allocation INTEGER NOT NULL DEFAULT 100 CHECK (traffic_allocation >= 0 AND traffic_allocation <= 100),

    -- Timeline
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,

    -- Statistical parameters
    min_sample_size INTEGER,
    expected_effect DECIMAL(10, 6),

    -- Metadata
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,

    -- Constraints
    CONSTRAINT experiments_dates_check CHECK (end_date IS NULL OR end_date > start_date)
);

-- Indexes for experiments
CREATE INDEX idx_experiments_key ON experiments(key);
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_design_type ON experiments(design_type);
CREATE INDEX idx_experiments_created_at ON experiments(created_at DESC);
CREATE INDEX idx_experiments_status_dates ON experiments(status, start_date, end_date);

-- GIN index for JSONB columns
CREATE INDEX idx_experiments_variants ON experiments USING GIN(variants);
CREATE INDEX idx_experiments_design_config ON experiments USING GIN(design_config);

-- ============================================================================
-- FEATURE FLAGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT false NOT NULL,
    default_value JSONB NOT NULL,
    variants JSONB DEFAULT '[]'::JSONB,
    targeting_rules JSONB DEFAULT '[]'::JSONB,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Indexes for feature flags
CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX idx_feature_flags_created_at ON feature_flags(created_at DESC);

-- GIN indexes for JSONB columns
CREATE INDEX idx_feature_flags_variants ON feature_flags USING GIN(variants);
CREATE INDEX idx_feature_flags_targeting_rules ON feature_flags USING GIN(targeting_rules);

-- ============================================================================
-- ASSIGNMENTS TABLE (Optional - for logging all assignments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    unit_id VARCHAR(255) NOT NULL,
    variant_key VARCHAR(255) NOT NULL,
    factors JSONB,
    context JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Composite unique constraint to prevent duplicate assignments
    CONSTRAINT unique_assignment UNIQUE (experiment_id, unit_id)
);

-- Indexes for assignments
CREATE INDEX idx_assignments_experiment_id ON assignments(experiment_id);
CREATE INDEX idx_assignments_unit_id ON assignments(unit_id);
CREATE INDEX idx_assignments_variant_key ON assignments(variant_key);
CREATE INDEX idx_assignments_timestamp ON assignments(timestamp DESC);
CREATE INDEX idx_assignments_experiment_unit ON assignments(experiment_id, unit_id);

-- GIN index for JSONB columns
CREATE INDEX idx_assignments_factors ON assignments USING GIN(factors);
CREATE INDEX idx_assignments_context ON assignments USING GIN(context);

-- ============================================================================
-- EXPOSURES TABLE (Optional - for logging exposure events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS exposures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    unit_id VARCHAR(255) NOT NULL,
    variant_key VARCHAR(255) NOT NULL,
    exposure_point VARCHAR(500) NOT NULL,
    context JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for exposures
CREATE INDEX idx_exposures_experiment_id ON exposures(experiment_id);
CREATE INDEX idx_exposures_unit_id ON exposures(unit_id);
CREATE INDEX idx_exposures_timestamp ON exposures(timestamp DESC);
CREATE INDEX idx_exposures_experiment_unit ON exposures(experiment_id, unit_id);

-- Partitioning for exposures (by timestamp - monthly partitions recommended)
-- Note: Partitioning setup would be done separately based on needs
-- Example: CREATE TABLE exposures_2024_01 PARTITION OF exposures FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- GIN index for JSONB columns
CREATE INDEX idx_exposures_context ON exposures USING GIN(context);

-- ============================================================================
-- METRICS TABLE (Optional - for storing metric events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_name VARCHAR(255) NOT NULL,
    unit_id VARCHAR(255) NOT NULL,
    value DECIMAL(20, 6),
    properties JSONB,
    experiment_ids JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for metrics
CREATE INDEX idx_metrics_event_name ON metrics(event_name);
CREATE INDEX idx_metrics_unit_id ON metrics(unit_id);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp DESC);

-- GIN indexes for JSONB columns
CREATE INDEX idx_metrics_properties ON metrics USING GIN(properties);
CREATE INDEX idx_metrics_experiment_ids ON metrics USING GIN(experiment_ids);

-- Partitioning for metrics (by timestamp - recommended for high volume)
-- Note: Similar to exposures, partitioning setup would be done separately

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    changes JSONB NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for audit log
CREATE INDEX idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_log_entity_id ON audit_log(entity_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- GIN index for changes
CREATE INDEX idx_audit_log_changes ON audit_log USING GIN(changes);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for experiments table
CREATE TRIGGER update_experiments_updated_at
    BEFORE UPDATE ON experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for feature_flags table
CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MATERIALIZED VIEWS (for analytics and reporting)
-- ============================================================================

-- Experiment summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS experiment_summary AS
SELECT
    e.id,
    e.key,
    e.name,
    e.status,
    e.design_type,
    e.start_date,
    e.end_date,
    COUNT(DISTINCT a.unit_id) as total_assignments,
    COUNT(DISTINCT ex.unit_id) as total_exposures,
    jsonb_agg(DISTINCT a.variant_key) as variants_assigned
FROM experiments e
LEFT JOIN assignments a ON e.id = a.experiment_id
LEFT JOIN exposures ex ON e.id = ex.experiment_id
GROUP BY e.id, e.key, e.name, e.status, e.design_type, e.start_date, e.end_date;

-- Index on materialized view
CREATE INDEX idx_experiment_summary_id ON experiment_summary(id);
CREATE INDEX idx_experiment_summary_status ON experiment_summary(status);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active experiments
CREATE OR REPLACE FUNCTION get_active_experiments()
RETURNS TABLE (
    id UUID,
    key VARCHAR,
    name VARCHAR,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.key, e.name, e.start_date, e.end_date
    FROM experiments e
    WHERE e.status = 'running'
    AND (e.start_date IS NULL OR e.start_date <= NOW())
    AND (e.end_date IS NULL OR e.end_date >= NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to get experiment statistics
CREATE OR REPLACE FUNCTION get_experiment_stats(exp_id UUID)
RETURNS TABLE (
    total_assignments BIGINT,
    total_exposures BIGINT,
    unique_units BIGINT,
    variant_distribution JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT a.id)::BIGINT as total_assignments,
        COUNT(DISTINCT e.id)::BIGINT as total_exposures,
        COUNT(DISTINCT a.unit_id)::BIGINT as unique_units,
        jsonb_object_agg(a.variant_key, COUNT(*)) as variant_distribution
    FROM assignments a
    LEFT JOIN exposures e ON a.experiment_id = e.experiment_id AND a.unit_id = e.unit_id
    WHERE a.experiment_id = exp_id
    GROUP BY a.experiment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA RETENTION POLICIES (Optional - using pg_cron)
-- ============================================================================

-- Example: Delete old exposure events (older than 90 days)
-- Note: Requires pg_cron extension
-- SELECT cron.schedule('cleanup-old-exposures', '0 2 * * *',
--     'DELETE FROM exposures WHERE timestamp < NOW() - INTERVAL ''90 days''');

-- Example: Delete old metrics (older than 90 days)
-- SELECT cron.schedule('cleanup-old-metrics', '0 3 * * *',
--     'DELETE FROM metrics WHERE timestamp < NOW() - INTERVAL ''90 days''');

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Example: Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO experimeh_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO experimeh_app;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE experiments IS 'Stores experiment configurations and metadata';
COMMENT ON TABLE feature_flags IS 'Stores feature flag configurations';
COMMENT ON TABLE assignments IS 'Logs all variant assignments for experiments';
COMMENT ON TABLE exposures IS 'Logs all exposure events when users see experiment variants';
COMMENT ON TABLE metrics IS 'Stores metric events for analysis';
COMMENT ON TABLE audit_log IS 'Audit trail for all configuration changes';

COMMENT ON COLUMN experiments.design_type IS 'Type of experimental design: ab, multivariate, factorial, within_subjects, or switchback';
COMMENT ON COLUMN experiments.randomization_unit IS 'Unit of randomization: user, session, device, or other';
COMMENT ON COLUMN experiments.traffic_allocation IS 'Percentage of traffic allocated to experiment (0-100)';
COMMENT ON COLUMN experiments.version IS 'Version number for optimistic locking';

COMMENT ON COLUMN feature_flags.enabled IS 'Whether the feature flag is currently enabled';
COMMENT ON COLUMN feature_flags.default_value IS 'Default value returned when flag is disabled or no targeting rules match';
COMMENT ON COLUMN feature_flags.version IS 'Version number for optimistic locking';

-- ============================================================================
-- REFRESH MATERIALIZED VIEWS (run periodically)
-- ============================================================================

-- REFRESH MATERIALIZED VIEW experiment_summary;
