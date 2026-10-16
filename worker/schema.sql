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

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT,
  event_type TEXT,
  event_date TEXT,
  location TEXT,
  description TEXT,
  image_url TEXT,
  status TEXT,
  created_at DATETIME,
  public_approved INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT,
  "class" TEXT,
  age INT,
  photo_url TEXT,
  performance TEXT,
  term TEXT,
  year TEXT,
  subjects TEXT,
  average_score REAL,
  story TEXT,
  created_at DATETIME,
  public_approved INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  family_name TEXT,
  village TEXT,
  district TEXT,
  members_count INT,
  need_type TEXT,
  story TEXT,
  photo_url TEXT,
  support_status TEXT,
  contact_info TEXT,
  created_at DATETIME,
  public_approved INTEGER NOT NULL DEFAULT 0
);
