# Sarang Adonai Rosete Foundation Uganda

Static foundation website with a Cloudflare Worker-backed photo gallery.

## Gallery backend

- Public gallery: `gallery.html`
- Staff upload page: `admin/upload.html`
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

Uploads accept JPEG, PNG, WebP, GIF, or AVIF images up to 25 MB. R2 public access is enabled for media delivery; uploads and deletes are protected by the Worker password.
