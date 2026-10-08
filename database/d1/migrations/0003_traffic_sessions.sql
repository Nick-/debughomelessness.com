-- Short-lived, first-party browser sessions. Never store IPs, raw user agents,
-- full referring URLs, URL queries, search text, or cross-session identifiers.
CREATE TABLE traffic_sessions (
  session_id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  landing_page TEXT NOT NULL,
  referrer_host TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  asn INTEGER,
  network_owner TEXT NOT NULL DEFAULT '',
  browser_family TEXT NOT NULL,
  browser_version TEXT NOT NULL DEFAULT '',
  automation_signal TEXT NOT NULL,
  bot_score INTEGER,
  page_views INTEGER NOT NULL DEFAULT 0,
  visible_10s INTEGER NOT NULL DEFAULT 0,
  interactions INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX traffic_sessions_first_seen ON traffic_sessions(first_seen);
CREATE INDEX traffic_sessions_last_seen ON traffic_sessions(last_seen);
