import BetterSqlite3 from 'better-sqlite3';

export type Database = BetterSqlite3.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  enabled INTEGER DEFAULT 1,
  added_via TEXT DEFAULT 'config',
  last_fetched_at TEXT,
  last_item_id TEXT,
  fetch_errors INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  external_id TEXT,
  url TEXT NOT NULL,
  url_normalized TEXT NOT NULL,
  title TEXT NOT NULL,
  content_snippet TEXT,
  word_count INTEGER,
  category TEXT,
  content_type TEXT,
  summary TEXT,
  classified_by TEXT,
  classifier_score REAL DEFAULT 0,
  feedback_score REAL DEFAULT 0,
  score REAL GENERATED ALWAYS AS (classifier_score * 0.4 + feedback_score * 0.6) STORED,
  published INTEGER DEFAULT 0,
  telegram_message_id INTEGER,
  discovered_at TEXT DEFAULT (datetime('now')),
  published_at TEXT,
  UNIQUE(url_normalized)
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  score INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS link_mentions (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  mentioned_domain TEXT NOT NULL,
  mentioned_url TEXT NOT NULL,
  item_id INTEGER REFERENCES items(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discovery_candidates (
  id INTEGER PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  mention_count INTEGER DEFAULT 1,
  mentioned_by TEXT,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  item_id INTEGER REFERENCES items(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_sightings (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  meta TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(item_id, source_id)
);

CREATE TABLE IF NOT EXISTS saved_items (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) UNIQUE,
  saved_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_url ON items(url_normalized);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published, discovered_at);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source_id, discovered_at);
CREATE INDEX IF NOT EXISTS idx_link_mentions_domain ON link_mentions(mentioned_domain);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date);
CREATE INDEX IF NOT EXISTS idx_feedback_item ON feedback(item_id);
`;

export function createDatabase(dbPath: string): Database {
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
