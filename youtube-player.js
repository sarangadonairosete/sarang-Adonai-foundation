(function () {
  const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const API_BASE = "https://sarangadonai-api.sarangadonairosete.workers.dev";

  window.youtubeVideoIdIsValid = function (id) {
    return ID_PATTERN.test(String(id || ""));
  };

  window.youtubeEmbedUrl = function (id) {
    if (!ID_PATTERN.test(String(id || ""))) return "";
    const params = new URLSearchParams({
      cc_load_policy: "1",
      cc_lang_pref: "en",
      hl: "en",
      modestbranding: "1",
      rel: "0",
      enablejsapi: "1",
      origin: window.location.origin,
    });
    return `https://www.youtube.com/embed/${id}?${params}`;
  };

  window.youtubeThumbnailUrl = function (id) {
    if (!ID_PATTERN.test(String(id || ""))) return "";
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  };

  window.setCaption = function (language, frame, controls) {
    if (!frame || !ID_PATTERN.test(new URL(frame.src).pathname.split("/").pop() || "")) return;
    const selected = language === "lg" ? "lg" : language === "off" ? "off" : "en";
    const url = new URL(frame.src);
    url.searchParams.set("cc_load_policy", selected === "off" ? "0" : "1");
    if (selected === "off") url.searchParams.delete("cc_lang_pref");
    else url.searchParams.set("cc_lang_pref", selected);

    if (controls) {
      controls.querySelectorAll("button[data-caption-lang]").forEach(button => {
        const active = button.dataset.captionLang === selected;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }
    frame.src = url.toString();
    frame.addEventListener("load", () => {
      const languageCode = selected === "off" ? "" : selected;
      const target = frame.contentWindow;
      target?.postMessage(JSON.stringify({
        event: "command",
        func: "setOption",
        args: ["captions", "track", languageCode ? { languageCode } : {}],
      }), "https://www.youtube.com");
      target?.postMessage(JSON.stringify({
        event: "command",
        func: "setOption",
        args: ["captions", "reload", true],
      }), "https://www.youtube.com");
    }, { once: true });
  };

  window.createYouTubeFrame = function (id, title, height = 315, options = {}) {
    const src = window.youtubeEmbedUrl(id);
    if (!src) return null;
    const player = document.createElement("div");
    player.className = "youtube-player";
    const controls = document.createElement("div");
    controls.className = "youtube-caption-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Video captions");

    [
      { language: "lg", label: "Luganda" },
      { language: "en", label: "🇬🇧 English (Auto Translate)" },
      { language: "off", label: "No Subs" },
    ].forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.captionLang = option.language;
      button.textContent = option.label;
      button.className = option.language === "en" ? "active" : "";
      button.setAttribute("aria-pressed", String(option.language === "en"));
      button.addEventListener("click", () => window.setCaption(option.language, frame, controls));
      controls.appendChild(button);
    });

    const frame = document.createElement("iframe");
    frame.src = src;
    frame.className = "youtube-embed";
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
    player.append(controls, frame);

    const info = document.createElement("p");
    info.className = "youtube-caption-info";
    info.textContent = "🌍 Auto-Translated: This video is in Luganda. English subtitles auto-generated. Click CC for other languages.";
    player.appendChild(info);

    const autoTranscribe = options.autoTranscribe !== false &&
      options.autoTranscribe !== 0 && options.autoTranscribe !== "0";
    if (autoTranscribe) {
      const transcriptButton = document.createElement("button");
      transcriptButton.type = "button";
      transcriptButton.className = "youtube-transcript-button";
      transcriptButton.textContent = "📄 Read Full English Transcript";
      transcriptButton.setAttribute("aria-expanded", "false");
      const transcript = document.createElement("div");
      transcript.className = "youtube-transcript";
      transcript.hidden = true;
      transcript.setAttribute("role", "status");

      transcriptButton.addEventListener("click", async () => {
        if (transcript.dataset.loaded === "true") {
          transcript.hidden = !transcript.hidden;
          transcriptButton.setAttribute("aria-expanded", String(!transcript.hidden));
          return;
        }
        transcriptButton.disabled = true;
        transcriptButton.textContent = "Loading transcript…";
        transcript.hidden = false;
        transcript.textContent = "Checking for captions…";
        try {
          const response = await fetch(`${API_BASE}/api/transcript/${encodeURIComponent(id)}`, {
            headers: { Accept: "application/json" },
          });
          const data = await response.json();
          if (data.status === "pending") {
            transcript.textContent = data.message || "Captions are not available yet. Please try again later.";
            transcript.dataset.loaded = "pending";
          } else if (!response.ok) {
            throw new Error(data.error || "The transcript could not be loaded.");
          } else if (data.translated_en) {
            transcript.textContent = data.translated_en;
            transcript.dataset.loaded = "true";
          } else if (data.text) {
            transcript.textContent = `English translation is not available yet. Original ${data.lang === "lg" ? "Luganda" : "video"} captions:\n\n${data.text}`;
            transcript.dataset.loaded = "true";
          } else {
            transcript.textContent = "No transcript is available for this video yet.";
            transcript.dataset.loaded = "pending";
          }
          transcriptButton.setAttribute("aria-expanded", "true");
        } catch (error) {
          transcript.textContent = error.message || "The transcript could not be loaded. Please try again.";
          transcript.dataset.loaded = "";
          transcriptButton.setAttribute("aria-expanded", "true");
        } finally {
          transcriptButton.disabled = false;
          transcriptButton.textContent = "📄 Read Full English Transcript";
        }
      });
      player.append(transcriptButton, transcript);
    }
    return player;
  };
})();
