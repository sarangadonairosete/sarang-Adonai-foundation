(function () {
  const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

  function getYouTubeId(value) {
    let url;
    try { url = new URL(String(value || "").trim()); } catch { return ""; }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else if (["embed", "shorts", "live"].includes(parts[0])) id = parts[1] || "";
    }
    return ID_PATTERN.test(id) ? id : "";
  }

  function refresh() {
    document.querySelectorAll('input[name="youtube_url"]').forEach(input => {
      const preview = input.closest(".youtube-field")?.querySelector(".youtube-preview");
      if (!preview) return;
      const id = getYouTubeId(input.value);
      preview.replaceChildren();
      preview.hidden = !id;
      if (!id) return;
      const label = document.createElement("p");
      label.className = "hint";
      label.textContent = "Video preview";
      const frame = document.createElement("iframe");
      const params = new URLSearchParams({
        cc_load_policy: "1",
        cc_lang_pref: "en",
        hl: "en",
        modestbranding: "1",
        rel: "0",
        enablejsapi: "1",
        origin: window.location.origin,
      });
      frame.src = `https://www.youtube.com/embed/${id}?${params}`;
      frame.title = "YouTube video preview";
      frame.width = "100%";
      frame.height = "200";
      frame.loading = "lazy";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allowFullscreen = true;
      preview.append(label, frame);
    });
  }

  window.getYouTubeVideoId = getYouTubeId;
  window.refreshYouTubePreviews = refresh;
  document.querySelectorAll('input[name="youtube_url"]').forEach(input => {
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
    input.form?.addEventListener("reset", () => setTimeout(refresh, 0));
  });
  refresh();
})();
