CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  public_url TEXT,
  filename TEXT,
  date TEXT,
  year TEXT,
  month TEXT,
  day TEXT,
  caption TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  youtube_url TEXT,
  youtube_id TEXT,
  visibility TEXT DEFAULT 'unlisted',
  media_type TEXT DEFAULT 'youtube',
  status TEXT DEFAULT 'approved',
  auto_transcribe INTEGER NOT NULL DEFAULT 1,
  transcript_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE UNIQUE INDEX IF NOT EXISTS media_youtube_id_unique
  ON media(youtube_id)
  WHERE youtube_id IS NOT NULL AND TRIM(youtube_id) <> '';

CREATE TABLE IF NOT EXISTS youtube_sync_state (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  last_synced_at DATETIME,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS video_transcripts (
  youtube_id TEXT PRIMARY KEY,
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  translated_en TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  photo_url TEXT,
  bio TEXT,
  created_at DATETIME,
  youtube_url TEXT,
  youtube_id TEXT,
  visibility TEXT DEFAULT 'unlisted',
  media_type TEXT DEFAULT 'youtube'
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
  public_approved INTEGER NOT NULL DEFAULT 0,
  youtube_url TEXT,
  youtube_id TEXT,
  visibility TEXT DEFAULT 'unlisted',
  media_type TEXT DEFAULT 'youtube'
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
  public_approved INTEGER NOT NULL DEFAULT 0,
  youtube_url TEXT,
  youtube_id TEXT,
  visibility TEXT DEFAULT 'unlisted',
  media_type TEXT DEFAULT 'youtube'
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
  public_approved INTEGER NOT NULL DEFAULT 0,
  youtube_url TEXT,
  youtube_id TEXT,
  visibility TEXT DEFAULT 'unlisted',
  media_type TEXT DEFAULT 'youtube'
);
