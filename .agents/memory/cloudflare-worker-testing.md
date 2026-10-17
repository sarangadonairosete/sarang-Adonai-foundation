---
name: Cloudflare Worker smoke tests
description: User-agent restriction encountered when testing the deployed Worker from this workspace.
---

For production smoke tests against this project's Cloudflare Worker, use `curl` rather than Python's `urllib`; the default urllib user agent was rejected by Cloudflare with Error 1010, while curl worked.

**Why:** Cloudflare's browser-signature protection blocked the default Python client before requests reached the Worker, so retries with the same client could not test application behavior.

**How to apply:** Use curl for Worker API checks and include the GitHub Pages origin when validating browser CORS behavior.
