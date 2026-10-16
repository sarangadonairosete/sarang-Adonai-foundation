(function () {
  const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const EMBED_QUERY = "?rel=0&modestbranding=1&showinfo=0";

  window.youtubeVideoIdIsValid = function (id) {
    return ID_PATTERN.test(String(id || ""));
  };

  window.youtubeEmbedUrl = function (id, includeShowInfo = true) {
    if (!ID_PATTERN.test(String(id || ""))) return "";
    return `https://www.youtube.com/embed/${id}${includeShowInfo ? EMBED_QUERY : "?rel=0&modestbranding=1"}`;
  };

  window.youtubeThumbnailUrl = function (id) {
    if (!ID_PATTERN.test(String(id || ""))) return "";
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  };

  window.createYouTubeFrame = function (id, title, height = 315) {
    const src = window.youtubeEmbedUrl(id);
    if (!src) return null;
    const frame = document.createElement("iframe");
    frame.src = src;
    frame.title = title || "YouTube video";
    frame.width = "100%";
    frame.height = String(height);
    frame.loading = "lazy";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    frame.style.width = "100%";
    frame.style.aspectRatio = "16 / 9";
    frame.style.height = "auto";
    frame.style.border = "0";
    frame.style.borderRadius = "12px";
    return frame;
  };
})();
