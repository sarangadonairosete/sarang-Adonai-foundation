# Sarang Adonai Rosete Foundation Uganda

Static foundation website with a Cloudflare Worker-backed gallery, staff directory, events, student highlights, and family support records.

## Gallery backend

- Public gallery: `gallery.html`
- Public events: `events.html`
- Public student highlights: `students.html`
- Public family support: `families.html`
- Gallery photo upload page: `admin/upload.html`
- Staff profile manager: `admin/staff.html`
- Events manager: `admin/events.html`
- Student records manager: `admin/students.html`
- Family support manager: `admin/families.html`
- Worker source and Wrangler configuration: `worker/`
- R2 bucket: `sarangadonai-media`
- D1 database: `sarangadonai-db`

The Worker uses the `MEDIA` R2 binding and `DB` D1 binding. `ADMIN_PASSWORD` is a Cloudflare Worker secret and must be set with Wrangler; do not commit secret values.

### Deploy the Worker

Ensure `CLOUDFLARE_API_TOKEN` is available as an environment secret, then run:

```sh
npm run worker:deploy
printf '%s\n' "$ADMIN_PASSWORD" | npx wrangler secret put ADMIN_PASSWORD --config worker/wrangler.toml
```

If the Worker code changes after the secret is added, deploy it again with `npm run worker:deploy`. Wrangler keeps existing Worker secrets.

### API routes

- `GET /health` — service health
- `GET /gallery` — public media grouped by date
- `POST /api/upload-image` — one authenticated gallery-photo upload per request, with required title, description, alt text, and consent confirmation; new photos remain pending until staff approval (`X-Admin-Password`)
- `POST /upload` — authenticated multipart upload (`X-Admin-Password`)
- `DELETE /media/:id` — authenticated removal (`X-Admin-Password`)
- `GET /api/media` — public flat media list
- `GET /api/admin/media/pending` — authenticated pending gallery photos (`Authorization: Bearer <admin password>`)
- `POST /api/admin/media/:id/approve`, `POST /api/admin/media/:id/reject` — authenticated photo approval or rejection (`Authorization: Bearer <admin password>`)
- `POST /api/media`, `PUT /api/media/:id`, `DELETE /api/media/:id` — authenticated media management
- `GET /api/videos?limit=6` — latest approved YouTube videos in the media table, sorted by creation time
- `GET /api/sync-youtube` — discovers the channel ID, imports missing RSS videos, and ensures the demo video is available
- `GET /api/transcript/:youtube_id` — returns cached captions or checks YouTube timedtext, translating Luganda captions to English when Workers AI is available
- `GET /api/staff` — public staff directory
- `POST /api/staff` — authenticated staff profile creation and photo upload (`X-Admin-Password`)
- `PUT /api/staff/:id` — authenticated staff profile update; photo replacement is optional (`X-Admin-Password`)
- `DELETE /api/staff/:id` — authenticated staff profile and photo removal (`X-Admin-Password`)
- `GET /api/events?status=upcoming|past&type=...` — public approved events; `admin=1` with the password header lists private/draft records
- `POST /api/events`, `PUT /api/events/:id`, `DELETE /api/events/:id` — authenticated event management
- `GET /api/students?class=P5&year=2026&top=10` — consent-approved public student profiles and scores
- `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id` — authenticated student management
- `GET /api/families?village=Buwama&status=urgent_need` — consent-approved public family listings
- `POST /api/families`, `PUT /api/families/:id`, `DELETE /api/families/:id` — authenticated family management

Apply the database schema with `npx wrangler d1 execute sarangadonai-db --remote --file=worker/schema.sql --config=worker/wrangler.toml`. It creates missing tables without changing existing data. For an existing database, apply `worker/migrations/001_youtube_fields.sql`, `worker/migrations/002_seed_youtube_demo.sql`, `worker/migrations/003_youtube_sync.sql`, `worker/migrations/004_video_transcripts.sql`, and `worker/migrations/005_gallery_photo_details.sql` once, in order. The Worker syncs the YouTube channel and retries pending approved transcripts hourly.

Image uploads accept JPEG, PNG, WebP, GIF, or AVIF images up to 25 MB and use the `images/gallery/`, `gallery/`, `staff/`, `events/`, `students/`, or `families/` R2 prefixes. The gallery admin page sends photos one at a time, with up to 100 queued per batch; each photo requires a title, description, alt text, and consent confirmation, then remains hidden until an administrator approves it in `admin/staff.html`. Rejected pending photos are removed from R2. YouTube links accept youtu.be and youtube.com watch, embed, shorts, and live URLs; their IDs and visibility are saved on the related record. R2 public access is enabled for image delivery; all writes and deletes require the Worker password.

YouTube timedtext captions are cached in D1. Public video cards show caption-language controls and an English transcript button; videos without generated captions remain pending and are checked again hourly. Luganda captions use YouTube's English translation track first, then the optional Workers AI `@cf/meta/m2m100-1.2b` binding when needed.

Student, family, and event records are private by default. Public APIs return only records with `public_approved = 1`. Family `contact_info` is returned only to authenticated admin list requests and is never included in public responses.
