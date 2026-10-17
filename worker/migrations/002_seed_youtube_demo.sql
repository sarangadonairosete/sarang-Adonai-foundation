INSERT INTO media (
  id, public_url, filename, date, year, month, day, caption,
  youtube_url, youtube_id, visibility, media_type
)
SELECT
  '00000000-0000-4000-8000-000000000042', NULL, '', date('now'), strftime('%Y', 'now'),
  strftime('%m', 'now'), strftime('%d', 'now'), 'Togetherness Creates Excitement',
  'https://youtu.be/l8n-W-Rutds', 'l8n-W-Rutds', 'unlisted', 'youtube'
WHERE NOT EXISTS (
  SELECT 1 FROM media WHERE youtube_id = 'l8n-W-Rutds'
);
