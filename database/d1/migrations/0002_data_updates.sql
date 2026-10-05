CREATE TABLE data_updates (
  dataset TEXT PRIMARY KEY,
  first_year INTEGER NOT NULL,
  latest_year INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  source_published TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  next_expected_year INTEGER NOT NULL,
  next_release_date TEXT,
  next_release_note TEXT NOT NULL,
  methodology_note TEXT NOT NULL
);
