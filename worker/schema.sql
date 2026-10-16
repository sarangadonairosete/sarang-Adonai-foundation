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

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  photo_url TEXT,
  bio TEXT,
  created_at DATETIME
);
