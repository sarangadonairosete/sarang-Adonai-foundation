---
name: YouTube sync and captions
description: Resolve the channel from its public handle and respect transcript source limits.
---

Resolve the channel ID from the public video page or `@sarangadonairosetefoundation` handle at sync time; do not require a manually configured UC ID.

**Why:** The user explicitly requested automatic discovery so they would not need to provide the channel ID.

**How to apply:** Keep manual and scheduled syncs using page scraping and fall back to the configured demo video if YouTube RSS cannot be fetched.

Use YouTube timedtext captions for transcripts. Do not assume Whisper can transcribe a video ID; it needs audio bytes, and the Worker does not obtain audio from YouTube.

**Why:** The Worker only receives YouTube links/IDs and thumbnails. Direct audio input is required by Whisper.

**How to apply:** Use YouTube-generated captions and translation when available. Only enable Whisper when an authorized audio source is supplied.
