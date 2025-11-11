-- Migration: 001_add_experiment_flag_relationship.sql
-- Purpose: Add feature flag relationships to experiments
-- Date: 2025-01-10
--
-- This migration implements the flag-first architecture by:
-- 1. Adding featureFlagId to experiments table
-- 2. Creating variant_allocations table
-- 3. Adding linkedExperiments to feature_flags
-- 4. Creating exposure_logs table

-- ============================================================================
-- 1. Add featureFlagId column to experiments
-- ============================================================================

ALTER TABLE experiments
ADD COLUMN feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE RESTRICT;

-- Index for faster lookups
CREATE INDEX idx_experiments_flag_id ON experiments(feature_flag_id);

COMMENT ON COLUMN experiments.feature_flag_id IS 'Required reference to the feature flag this experiment is built upon';

-- ============================================================================
-- 2. Create experiment_variant_allocations table
-- ============================================================================

CREATE TABLE experiment_variant_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  flag_variant_id UUID NOT NULL,
  flag_variant_key VARCHAR(255) NOT NULL,
  experiment_role VARCHAR(50) NOT NULL CHECK (experiment_role IN ('control', 'treatment', 'treatment_1', 'treatment_2', 'treatment_3')),
  allocation_percentage DECIMAL(5,2) NOT NULL CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure allocations sum to 100% per experiment
  CONSTRAINT unique_flag_variant_per_experiment UNIQUE (experiment_id, flag_variant_id)
);

CREATE INDEX idx_variant_allocations_experiment ON experiment_variant_allocations(experiment_id);
CREATE INDEX idx_variant_allocations_flag_variant ON experiment_variant_allocations(flag_variant_id);

COMMENT ON TABLE experiment_variant_allocations IS 'Maps feature flag variants to experiment roles (control/treatment)';
COMMENT ON COLUMN experiment_variant_allocations.flag_variant_id IS 'ID of the feature flag variant';
COMMENT ON COLUMN experiment_variant_allocations.experiment_role IS 'Role in experiment: control, treatment, treatment_1, etc.';
COMMENT ON COLUMN experiment_variant_allocations.allocation_percentage IS 'Percentage of traffic for this variant (must sum to 100% per experiment)';

-- ============================================================================
-- 3. Add linked_experiments to feature_flags
-- ============================================================================

ALTER TABLE feature_flags
ADD COLUMN linked_experiments JSONB DEFAULT '[]'::jsonb;

-- GIN index for faster JSON queries
CREATE INDEX idx_flags_linked_experiments ON feature_flags USING GIN (linked_experiments);

COMMENT ON COLUMN feature_flags.linked_experiments IS 'Array of linked experiments with their status and priority';

-- Example structure:
-- [
--   {
--     "experimentId": "uuid",
--     "experimentKey": "string",
--     "status": "draft|active|paused|completed",
--     "priority": 1,
--     "linkedAt": "2025-01-10T00:00:00Z",
--     "activatedAt": "2025-01-15T00:00:00Z",
--     "completedAt": null
--   }
-- ]

-- ============================================================================
-- 4. Create exposure_logs table
-- ============================================================================

CREATE TABLE exposure_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id VARCHAR(255) NOT NULL,
  unit_type VARCHAR(50) NOT NULL DEFAULT 'user',
  flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  flag_key VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255) NOT NULL,
  variant_key VARCHAR(255) NOT NULL,
  experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
  experiment_key VARCHAR(255),
  variant_role VARCHAR(50),
  assignment_reason VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  context JSONB,
  metadata JSONB,

  -- Partitioning key for time-series data
  created_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Indexes for common queries
CREATE INDEX idx_exposure_unit_id ON exposure_logs(unit_id);
CREATE INDEX idx_exposure_flag_id ON exposure_logs(flag_id);
CREATE INDEX idx_exposure_experiment_id ON exposure_logs(experiment_id) WHERE experiment_id IS NOT NULL;
CREATE INDEX idx_exposure_timestamp ON exposure_logs(timestamp DESC);
CREATE INDEX idx_exposure_created_date ON exposure_logs(created_date);

-- Composite index for analysis queries
CREATE INDEX idx_exposure_experiment_timestamp ON exposure_logs(experiment_id, timestamp) WHERE experiment_id IS NOT NULL;

COMMENT ON TABLE exposure_logs IS 'Tracks all feature flag evaluations and experiment exposures';
COMMENT ON COLUMN exposure_logs.unit_id IS 'Identifier of the unit (user, session, etc.)';
COMMENT ON COLUMN exposure_logs.unit_type IS 'Type of unit: user, session, device, etc.';
COMMENT ON COLUMN exposure_logs.assignment_reason IS 'Why this assignment was made: experiment_allocation, flag_rollout, default, etc.';
COMMENT ON COLUMN exposure_logs.variant_role IS 'Role in experiment if assigned via experiment: control, treatment, etc.';

-- ============================================================================
-- 5. Create helper functions
-- ============================================================================

-- Function to validate variant allocations sum to 100%
CREATE OR REPLACE FUNCTION validate_variant_allocations()
RETURNS TRIGGER AS $$
DECLARE
  total_allocation DECIMAL;
BEGIN
  -- Calculate total allocation for this experiment
  SELECT COALESCE(SUM(allocation_percentage), 0) INTO total_allocation
  FROM experiment_variant_allocations
  WHERE experiment_id = NEW.experiment_id;

  -- Check if total exceeds 100%
  IF total_allocation > 100.01 THEN
    RAISE EXCEPTION 'Total allocation percentage cannot exceed 100%% (current: %%)', total_allocation;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate allocations on insert/update
CREATE TRIGGER validate_allocations_trigger
  BEFORE INSERT OR UPDATE ON experiment_variant_allocations
  FOR EACH ROW
  EXECUTE FUNCTION validate_variant_allocations();

-- ============================================================================
-- 6. Data Migration (if needed)
-- ============================================================================

-- If there are existing experiments, you may need to:
-- 1. Create default feature flags for them
-- 2. Link them properly
-- This section is intentionally left empty as it depends on existing data

-- Example:
-- INSERT INTO feature_flags (id, key, name, enabled, variants, ...)
-- SELECT
--   gen_random_uuid(),
--   experiment_key || '_flag',
--   experiment_name || ' Flag',
--   true,
--   -- Generate variants from experiment
--   ...
-- FROM experiments
-- WHERE feature_flag_id IS NULL;

-- ============================================================================
-- 7. Add constraints for data integrity
-- ============================================================================

-- Ensure experiment status transitions are valid
CREATE OR REPLACE FUNCTION validate_experiment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent running experiment if no variant allocations
  IF NEW.status = 'running' THEN
    IF NOT EXISTS (
      SELECT 1 FROM experiment_variant_allocations
      WHERE experiment_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot start experiment without variant allocations';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_experiment_status_trigger
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_experiment_status_transition();

-- ============================================================================
-- Rollback Script (save for emergency)
-- ============================================================================

/*
-- To rollback this migration:

-- Drop triggers
DROP TRIGGER IF EXISTS validate_experiment_status_trigger ON experiments;
DROP TRIGGER IF EXISTS validate_allocations_trigger ON experiment_variant_allocations;

-- Drop functions
DROP FUNCTION IF EXISTS validate_experiment_status_transition();
DROP FUNCTION IF EXISTS validate_variant_allocations();

-- Drop tables
DROP TABLE IF EXISTS exposure_logs;
DROP TABLE IF EXISTS experiment_variant_allocations;

-- Remove columns
ALTER TABLE feature_flags DROP COLUMN IF EXISTS linked_experiments;
ALTER TABLE experiments DROP COLUMN IF EXISTS feature_flag_id;

-- Drop indexes are automatically dropped with tables/columns
*/
