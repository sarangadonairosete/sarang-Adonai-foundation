# Sarang Adonai Rosete Foundation Uganda

Static foundation website with a Cloudflare Worker-backed photo gallery and staff directory.

## Gallery backend

- Public gallery: `gallery.html`
- Gallery photo upload page: `admin/upload.html`
- Staff profile manager: `admin/staff.html`
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
- `POST /upload` — authenticated multipart upload (`X-Admin-Password`)
- `DELETE /media/:id` — authenticated removal (`X-Admin-Password`)
- `GET /api/staff` — public staff directory
- `POST /api/staff` — authenticated staff profile creation and photo upload (`X-Admin-Password`)
- `PUT /api/staff/:id` — authenticated staff profile update; photo replacement is optional (`X-Admin-Password`)
- `DELETE /api/staff/:id` — authenticated staff profile and photo removal (`X-Admin-Password`)

Apply the database schema with `npx wrangler d1 execute sarangadonai-db --remote --file=worker/schema.sql --config=worker/wrangler.toml`. It creates missing tables without changing existing data.

Gallery and staff photo uploads accept JPEG, PNG, WebP, GIF, or AVIF images up to 25 MB. R2 public access is enabled for image delivery; staff and gallery writes/deletes require the Worker password.
