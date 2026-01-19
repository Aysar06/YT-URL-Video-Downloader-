import crypto from "node:crypto";

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeYoutubeUrl(input) {
  if (!isNonEmptyString(input)) return null;

  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.toLowerCase();
  const isYoutubeHost =
    host === "youtu.be" ||
    host === "www.youtu.be" ||
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com";

  if (!isYoutubeHost) return null;

  const videoId = extractYoutubeVideoId(parsed);
  if (!videoId) return null;

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  };
}

export function extractYoutubeVideoId(url) {
  const host = url.hostname.toLowerCase();

  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = url.pathname.replace(/^\/+/, "").split("/")[0];
    return isValidYoutubeVideoId(id) ? id : null;
  }

  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com"
  ) {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return isValidYoutubeVideoId(id) ? id : null;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === "shorts") {
      const id = pathParts[1];
      return isValidYoutubeVideoId(id) ? id : null;
    }
    if (pathParts.length >= 2 && pathParts[0] === "embed") {
      const id = pathParts[1];
      return isValidYoutubeVideoId(id) ? id : null;
    }
  }

  return null;
}

export function isValidYoutubeVideoId(value) {
  if (typeof value !== "string") return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(value);
}

export function sanitizeFilenameBase(name) {
  const value = isNonEmptyString(name) ? name.trim() : "video";
  const withoutControl = value.replace(/[\u0000-\u001F\u007F]/g, "");
  const withoutReserved = withoutControl.replace(/[<>:"/\\|?*]/g, "");
  const withoutTrailingDotsSpaces = withoutReserved.replace(/[. ]+$/g, "");
  const collapsedWhitespace = withoutTrailingDotsSpaces.replace(/\s+/g, " ");
  const limited = collapsedWhitespace.slice(0, 150);
  return limited.length > 0 ? limited : "video";
}

export function randomId() {
  return crypto.randomUUID();
}

