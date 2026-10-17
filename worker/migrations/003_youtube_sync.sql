ALTER TABLE media ADD COLUMN status TEXT DEFAULT 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS media_youtube_id_unique
  ON media(youtube_id)
  WHERE youtube_id IS NOT NULL AND TRIM(youtube_id) <> '';

CREATE TABLE IF NOT EXISTS youtube_sync_state (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  last_synced_at DATETIME,
  synced INTEGER NOT NULL DEFAULT 0
);

UPDATE media
SET caption = 'Togetherness Creates Excitement',
    youtube_url = 'https://youtu.be/l8n-W-Rutds',
    visibility = 'unlisted',
    media_type = 'youtube',
    status = 'approved'
WHERE youtube_id = 'l8n-W-Rutds';
