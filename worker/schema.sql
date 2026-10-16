CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  public_url TEXT,
  filename TEXT,
  date TEXT,
  year TEXT,
  month TEXT,
  day TEXT,
  caption TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
