ALTER TABLE media ADD COLUMN youtube_url TEXT;
ALTER TABLE media ADD COLUMN youtube_id TEXT;
ALTER TABLE media ADD COLUMN visibility TEXT DEFAULT 'unlisted';
ALTER TABLE media ADD COLUMN media_type TEXT DEFAULT 'youtube';

ALTER TABLE staff ADD COLUMN youtube_url TEXT;
ALTER TABLE staff ADD COLUMN youtube_id TEXT;
ALTER TABLE staff ADD COLUMN visibility TEXT DEFAULT 'unlisted';
ALTER TABLE staff ADD COLUMN media_type TEXT DEFAULT 'youtube';

ALTER TABLE events ADD COLUMN youtube_url TEXT;
ALTER TABLE events ADD COLUMN youtube_id TEXT;
ALTER TABLE events ADD COLUMN visibility TEXT DEFAULT 'unlisted';
ALTER TABLE events ADD COLUMN media_type TEXT DEFAULT 'youtube';

ALTER TABLE students ADD COLUMN youtube_url TEXT;
ALTER TABLE students ADD COLUMN youtube_id TEXT;
ALTER TABLE students ADD COLUMN visibility TEXT DEFAULT 'unlisted';
ALTER TABLE students ADD COLUMN media_type TEXT DEFAULT 'youtube';

ALTER TABLE families ADD COLUMN youtube_url TEXT;
ALTER TABLE families ADD COLUMN youtube_id TEXT;
ALTER TABLE families ADD COLUMN visibility TEXT DEFAULT 'unlisted';
ALTER TABLE families ADD COLUMN media_type TEXT DEFAULT 'youtube';

UPDATE media SET media_type = 'photo' WHERE youtube_id IS NULL;
UPDATE staff SET media_type = 'photo' WHERE youtube_id IS NULL;
UPDATE events SET media_type = 'photo' WHERE youtube_id IS NULL;
UPDATE students SET media_type = 'photo' WHERE youtube_id IS NULL;
UPDATE families SET media_type = 'photo' WHERE youtube_id IS NULL;
