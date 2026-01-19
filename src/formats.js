function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(+value))
    return +value;
  return null;
}

function isAudioOnlyFormat(format) {
  return format && format.vcodec === "none" && format.acodec && format.acodec !== "none";
}

function isMuxedAvFormat(format) {
  return (
    format &&
    format.vcodec &&
    format.vcodec !== "none" &&
    format.acodec &&
    format.acodec !== "none"
  );
}

function isVideoOnlyFormat(format) {
  return format && format.vcodec && format.vcodec !== "none" && format.acodec === "none";
}

function pickBestBy(formats, scoreFn) {
  let best = null;
  let bestScore = -Infinity;
  for (const fmt of formats) {
    const score = scoreFn(fmt);
    if (score > bestScore) {
      bestScore = score;
      best = fmt;
    }
  }
  return best;
}

export function buildDownloadOptions(info) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];

  const muxed = formats.filter(isMuxedAvFormat);
  const videoOnly = formats.filter(isVideoOnlyFormat);
  const audioOnly = formats.filter(isAudioOnlyFormat);

  const muxedByKey = new Map();
  for (const fmt of muxed) {
    const height = toNumber(fmt.height);
    if (!height) continue;
    const ext = fmt.ext || "unknown";
    const key = `${height}|${ext}`;
    if (!muxedByKey.has(key)) muxedByKey.set(key, []);
    muxedByKey.get(key).push(fmt);
  }

  const videoOnlyByKey = new Map();
  for (const fmt of videoOnly) {
    const height = toNumber(fmt.height);
    if (!height) continue;
    const ext = fmt.ext || "unknown";
    const key = `${height}|${ext}`;
    if (!videoOnlyByKey.has(key)) videoOnlyByKey.set(key, []);
    videoOnlyByKey.get(key).push(fmt);
  }

  const audioByExt = new Map();
  for (const fmt of audioOnly) {
    const ext = fmt.ext || "unknown";
    if (!audioByExt.has(ext)) audioByExt.set(ext, []);
    audioByExt.get(ext).push(fmt);
  }

  const video = [];

  for (const [key, group] of muxedByKey.entries()) {
    const [heightStr, ext] = key.split("|");
    const height = +heightStr;
    const best = pickBestBy(group, (f) => (toNumber(f.tbr) ?? 0) + (toNumber(f.filesize) ?? 0) / 1e9);
    if (!best) continue;
    video.push({
      kind: "video",
      label: `${height}p ${ext.toUpperCase()} (fast)`,
      height,
      container: ext,
      format: { type: "format_id", value: String(best.format_id) },
      needsFfmpeg: false
    });
  }

  for (const [key, group] of videoOnlyByKey.entries()) {
    const [heightStr, ext] = key.split("|");
    const height = +heightStr;
    const best = pickBestBy(group, (f) => (toNumber(f.tbr) ?? 0));
    if (!best) continue;
    const formatSelector = `${best.format_id}+bestaudio/best`;
    video.push({
      kind: "video",
      label: `${height}p ${ext.toUpperCase()} (merge audio)`,
      height,
      container: ext,
      format: { type: "format_selector", value: formatSelector },
      needsFfmpeg: true
    });
  }

  video.sort((a, b) => b.height - a.height || a.container.localeCompare(b.container));

  const audio = [];
  for (const [ext, group] of audioByExt.entries()) {
    const best = pickBestBy(group, (f) => (toNumber(f.abr) ?? 0));
    if (!best) continue;
    audio.push({
      kind: "audio",
      label: `${ext.toUpperCase()} audio`,
      container: ext,
      format: { type: "format_id", value: String(best.format_id) }
    });
  }
  audio.sort((a, b) => a.container.localeCompare(b.container));

  return { video, audio };
}

