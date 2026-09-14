-- Live re-check runs only. No profile, name or answer is ever stored here (docs/API.md §11).
CREATE TABLE check_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL CHECK (trigger IN ('node', 'cron', 'manual')),
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  sources_total INTEGER NOT NULL,
  sources_ok INTEGER NOT NULL,
  quotes_missing INTEGER NOT NULL
);

CREATE TABLE check_sources (
  run_id INTEGER NOT NULL REFERENCES check_runs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  program_slug TEXT NOT NULL,
  url TEXT NOT NULL,
  ok INTEGER NOT NULL,
  error TEXT,
  http_status INTEGER,
  fetched_at TEXT,
  sha256 TEXT,
  text_sha256 TEXT,
  changed INTEGER NOT NULL DEFAULT 0,
  quotes_total INTEGER NOT NULL DEFAULT 0,
  quotes_found INTEGER NOT NULL DEFAULT 0,
  missing_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (run_id, position)
);

CREATE INDEX check_sources_source ON check_sources (source_id);
