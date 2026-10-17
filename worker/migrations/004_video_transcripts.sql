ALTER TABLE media ADD COLUMN auto_transcribe INTEGER NOT NULL DEFAULT 1;
ALTER TABLE media ADD COLUMN transcript_status TEXT NOT NULL DEFAULT 'pending';

UPDATE media
SET auto_transcribe = 0,
    transcript_status = 'disabled'
WHERE youtube_id IS NULL OR TRIM(youtube_id) = '';

CREATE TABLE IF NOT EXISTS video_transcripts (
  youtube_id TEXT PRIMARY KEY,
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  translated_en TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
