const urlInput = document.getElementById("urlInput");
const fetchBtn = document.getElementById("fetchBtn");
const statusEl = document.getElementById("status");
const infoCard = document.getElementById("infoCard");
const videoTitleEl = document.getElementById("videoTitle");
const videoMetaEl = document.getElementById("videoMeta");
const qualitySelect = document.getElementById("qualitySelect");
const downloadBtn = document.getElementById("downloadBtn");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const saveLink = document.getElementById("saveLink");
const downloadDirInput = document.getElementById("downloadDir");

let lastInfo = null;
let currentJobId = null;
let evtSource = null;

function setStatus(message, kind = "info") {
  statusEl.textContent = message ?? "";
  if (kind === "error") statusEl.style.color = "var(--danger)";
  else statusEl.style.color = "var(--muted)";
}

function setBusy(isBusy) {
  fetchBtn.disabled = isBusy;
  urlInput.disabled = isBusy;
}

function formatDuration(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clearProgress() {
  progressWrap.classList.add("hidden");
  progressFill.style.width = "0%";
  progressText.textContent = "";
}

function showProgress() {
  progressWrap.classList.remove("hidden");
}

function closeSse() {
  if (evtSource) {
    evtSource.close();
    evtSource = null;
  }
}

function populateOptions(options) {
  qualitySelect.innerHTML = "";

  const groups = [];
  if (Array.isArray(options?.video) && options.video.length > 0) {
    groups.push({ label: "Video", items: options.video });
  }
  if (Array.isArray(options?.audio) && options.audio.length > 0) {
    groups.push({ label: "Audio Only", items: options.audio });
  }

  for (const group of groups) {
    const optGroup = document.createElement("optgroup");
    optGroup.label = group.label;

    for (const item of group.items) {
      const opt = document.createElement("option");
      opt.value = JSON.stringify(item);
      opt.textContent = item.label;
      optGroup.appendChild(opt);
    }

    qualitySelect.appendChild(optGroup);
  }

  downloadBtn.disabled = qualitySelect.options.length === 0;
}

async function fetchInfo() {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus("Paste a YouTube URL first.", "error");
    return;
  }

  setBusy(true);
  setStatus("Fetching video info…");
  clearProgress();
  saveLink.classList.add("hidden");
  downloadBtn.disabled = true;
  infoCard.classList.add("hidden");
  lastInfo = null;

  try {
    const res = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Failed to fetch video info.");

    lastInfo = body;
    videoTitleEl.textContent = body.title ?? "Untitled video";
    const duration = formatDuration(body.duration);
    const live = body.isLive ? "Live stream" : null;
    videoMetaEl.textContent = [duration, live].filter(Boolean).join(" • ");

    populateOptions(body.options);
    infoCard.classList.remove("hidden");
    setStatus("Select a quality, then start the download.");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Failed to fetch video info.", "error");
  } finally {
    setBusy(false);
  }
}

function formatProgressText(p) {
  const parts = [];
  if (typeof p?.percent === "number") parts.push(`${p.percent.toFixed(1)}%`);
  if (p?.currentSpeed) parts.push(String(p.currentSpeed));
  if (p?.eta) parts.push(`ETA ${String(p.eta)}`);
  return parts.join(" • ");
}

function connectProgress(jobId) {
  closeSse();
  evtSource = new EventSource(`/api/progress/${encodeURIComponent(jobId)}`);

  evtSource.addEventListener("progress", (evt) => {
    const p = JSON.parse(evt.data);
    showProgress();
    if (typeof p?.percent === "number") {
      const clamped = Math.max(0, Math.min(100, p.percent));
      progressFill.style.width = `${clamped}%`;
    }
    progressText.textContent = formatProgressText(p);
  });

  evtSource.addEventListener("state", (evt) => {
    const state = JSON.parse(evt.data);
    if (state.status === "error") {
      setStatus(state.error ?? "Download failed.", "error");
      downloadBtn.disabled = false;
      closeSse();
      return;
    }
    if (state.status === "done" && state.fileId) {
      setStatus("Download complete. Click “Save File” to download to your computer.");
      downloadBtn.disabled = false;
      saveLink.href = `/api/file/${encodeURIComponent(state.fileId)}`;
      saveLink.download = state.fileName ?? "video";
      saveLink.classList.remove("hidden");
      closeSse();
    }
  });

  evtSource.onerror = () => {
    closeSse();
  };
}

async function startDownload() {
  if (!lastInfo) return;

  const selectedRaw = qualitySelect.value;
  if (!selectedRaw) return;

  let selection;
  try {
    selection = JSON.parse(selectedRaw);
  } catch {
    setStatus("Invalid selection.", "error");
    return;
  }

  downloadBtn.disabled = true;
  saveLink.classList.add("hidden");
  setStatus("Starting download…");
  clearProgress();

  try {
    const res = await fetch("/api/download/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: lastInfo.normalizedUrl,
        title: lastInfo.title ?? "video",
        selection,
        downloadDir: downloadDirInput.value.trim()
      })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Failed to start download.");

    currentJobId = body.jobId;
    connectProgress(currentJobId);
    setStatus("Downloading…");
  } catch (err) {
    downloadBtn.disabled = false;
    setStatus(err instanceof Error ? err.message : "Failed to start download.", "error");
  }
}

fetchBtn.addEventListener("click", fetchInfo);
downloadBtn.addEventListener("click", startDownload);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchInfo();
});

