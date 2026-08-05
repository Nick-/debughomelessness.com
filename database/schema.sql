-- Homelessness KPI Tracker Database Schema
-- PostgreSQL schema for tracking homelessness metrics and Functional Zero status

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Continuums of Care table
CREATE TABLE continuums_of_care (
    coc_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    state VARCHAR(2) NOT NULL,
    region_type VARCHAR(50),
    population INTEGER,
    boundary_geojson JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metrics table
CREATE TABLE metrics (
    metric_id SERIAL PRIMARY KEY,
    coc_id VARCHAR(20) NOT NULL REFERENCES continuums_of_care(coc_id),
    metric_type VARCHAR(50) NOT NULL, -- pit_count, spm_length, spm_placement, spm_recidivism
    year INTEGER NOT NULL,
    value DECIMAL(15,2) NOT NULL,
    unit VARCHAR(50),
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coc_id, metric_type, year)
);

-- Functional Zero status table
CREATE TABLE functional_zero_status (
    status_id SERIAL PRIMARY KEY,
    coc_id VARCHAR(20) NOT NULL REFERENCES continuums_of_care(coc_id),
    status VARCHAR(50) NOT NULL, -- functional_zero, not_achieved, approaching
    achieved_date DATE,
    current_population INTEGER NOT NULL,
    benchmark_population INTEGER NOT NULL,
    percentage_change DECIMAL(10,2),
    rate_per_10k DECIMAL(10,2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coc_id, last_updated)
);

-- Historical data table for tracking changes over time
CREATE TABLE historical_data (
    history_id SERIAL PRIMARY KEY,
    coc_id VARCHAR(20) NOT NULL REFERENCES continuums_of_care(coc_id),
    year INTEGER NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    value DECIMAL(15,2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coc_id, year, metric_type, recorded_at)
);

-- Create indexes for better query performance
CREATE INDEX idx_metrics_coc_id ON metrics(coc_id);
CREATE INDEX idx_metrics_year ON metrics(year);
CREATE INDEX idx_metrics_type ON metrics(metric_type);
CREATE INDEX idx_functional_zero_coc_id ON functional_zero_status(coc_id);
CREATE INDEX idx_historical_coc_id ON historical_data(coc_id);
CREATE INDEX idx_historical_year ON historical_data(year);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coc_updated_at BEFORE UPDATE ON continuums_of_care
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metrics_updated_at BEFORE UPDATE ON metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();