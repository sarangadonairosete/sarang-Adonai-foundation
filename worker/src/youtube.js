const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeLink(value) {
  const youtubeUrl = String(value || "").trim();
  if (!youtubeUrl) return { youtube_url: "", youtube_id: "" };

  let parsed;
  try {
    parsed = new URL(youtubeUrl);
  } catch {
    return { error: "Enter a valid YouTube video link." };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  let youtubeId = "";
  if (host === "youtu.be") {
    youtubeId = parsed.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parsed.pathname === "/watch") youtubeId = parsed.searchParams.get("v") || "";
    else if (["embed", "shorts", "live"].includes(parts[0])) youtubeId = parts[1] || "";
  } else {
    return { error: "Use a YouTube video link from youtu.be or youtube.com." };
  }

  if (!YOUTUBE_ID_PATTERN.test(youtubeId)) {
    return { error: "The YouTube link does not contain a valid video ID." };
  }
  return { youtube_url: youtubeUrl, youtube_id: youtubeId };
}

export function youtubeFields(form, existing = {}) {
  const inputUrl = form.has("youtube_url")
    ? form.get("youtube_url")
    : (existing.youtube_url || "");
  const parsed = parseYouTubeLink(inputUrl);
  if (parsed.error) return parsed;

  const inputVisibility = form.has("visibility")
    ? String(form.get("visibility") || "")
    : (existing.visibility || "unlisted");
  if (!["unlisted", "public"].includes(inputVisibility)) {
    return { error: "Choose unlisted or public visibility." };
  }

  return {
    youtube_url: parsed.youtube_url || null,
    youtube_id: parsed.youtube_id || null,
    visibility: inputVisibility,
    media_type: parsed.youtube_id ? "youtube" : "photo",
  };
}
