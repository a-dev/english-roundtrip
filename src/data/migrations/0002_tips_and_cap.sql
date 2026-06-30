ALTER TABLE users ADD COLUMN role TEXT;                       -- NULL = capped; exempt set in domain/roles.ts
ALTER TABLE stats ADD COLUMN daily_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stats ADD COLUMN daily_count_date TEXT;          -- 'YYYY-MM-DD' (UTC)

CREATE TABLE IF NOT EXISTS tips (
  charge_id   TEXT PRIMARY KEY,                               -- telegram_payment_charge_id; dedupes retries
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  amount      INTEGER NOT NULL,                               -- stars (XTR)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
