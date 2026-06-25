CREATE TABLE IF NOT EXISTS users (
  telegram_id   INTEGER PRIMARY KEY,
  task_language TEXT,
  feedback_mode TEXT NOT NULL DEFAULT 'english',
  level         TEXT NOT NULL DEFAULT 'B1',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One in-flight exercise per user. Overwritten each round.
CREATE TABLE IF NOT EXISTS sessions (
  telegram_id           INTEGER PRIMARY KEY REFERENCES users(telegram_id),
  state                 TEXT NOT NULL DEFAULT 'idle',
  topic_id              TEXT,
  source_sentence       TEXT,
  reference_translation TEXT,
  target_points         TEXT,
  recent_sentences      TEXT,
  last_request_at       TEXT,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stats (
  telegram_id      INTEGER PRIMARY KEY REFERENCES users(telegram_id),
  total_exercises  INTEGER NOT NULL DEFAULT 0,
  total_correct    INTEGER NOT NULL DEFAULT 0,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT
);

-- Per-category error tallies → "weak spots".
CREATE TABLE IF NOT EXISTS error_stats (
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  category    TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (telegram_id, category)
);
