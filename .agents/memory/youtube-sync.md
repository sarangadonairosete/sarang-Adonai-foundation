---
name: YouTube channel discovery
description: Resolve the foundation's YouTube channel ID from its public video or handle.
---

Resolve the channel ID from the public video page or `@sarangadonairosetefoundation` handle at sync time; do not require a manually configured UC ID.

**Why:** The user explicitly requested automatic discovery so they would not need to provide the channel ID.

**How to apply:** Keep manual and scheduled syncs using page scraping and fall back to the configured demo video if YouTube RSS cannot be fetched.
