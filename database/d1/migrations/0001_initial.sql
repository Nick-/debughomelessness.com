CREATE TABLE continuums_of_care (
  coc_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  region_type TEXT,
  population INTEGER CHECK (population IS NULL OR population > 0),
  boundary_geojson TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE metrics (
  metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
  coc_id TEXT NOT NULL REFERENCES continuums_of_care(coc_id),
  metric_type TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2200),
  value REAL NOT NULL CHECK (value >= 0),
  unit TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (coc_id, metric_type, year)
);

CREATE TABLE functional_zero_status (
  status_id INTEGER PRIMARY KEY AUTOINCREMENT,
  coc_id TEXT NOT NULL REFERENCES continuums_of_care(coc_id),
  status TEXT NOT NULL CHECK (status IN ('functional_zero', 'approaching', 'not_achieved')),
  achieved_date TEXT,
  current_population INTEGER NOT NULL,
  benchmark_population INTEGER NOT NULL,
  percentage_change REAL,
  rate_per_10k REAL,
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (coc_id, last_updated)
);

CREATE INDEX idx_metrics_coc_year ON metrics(coc_id, year);
CREATE INDEX idx_metrics_type_year ON metrics(metric_type, year);
CREATE INDEX idx_status_coc_updated ON functional_zero_status(coc_id, last_updated);
