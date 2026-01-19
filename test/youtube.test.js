import test from "node:test";
import assert from "node:assert/strict";

import {
  extractYoutubeVideoId,
  isValidYoutubeVideoId,
  normalizeYoutubeUrl,
  sanitizeFilenameBase
} from "../src/youtube.js";

test("isValidYoutubeVideoId accepts 11-char ids", () => {
  assert.equal(isValidYoutubeVideoId("dQw4w9WgXcQ"), true);
  assert.equal(isValidYoutubeVideoId("dQw4w9WgXc"), false);
  assert.equal(isValidYoutubeVideoId("dQw4w9WgXcQx"), false);
});

test("extractYoutubeVideoId handles watch URLs", () => {
  const url = new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(extractYoutubeVideoId(url), "dQw4w9WgXcQ");
});

test("extractYoutubeVideoId handles youtu.be URLs", () => {
  const url = new URL("https://youtu.be/dQw4w9WgXcQ?t=43");
  assert.equal(extractYoutubeVideoId(url), "dQw4w9WgXcQ");
});

test("extractYoutubeVideoId handles Shorts URLs", () => {
  const url = new URL("https://www.youtube.com/shorts/dQw4w9WgXcQ");
  assert.equal(extractYoutubeVideoId(url), "dQw4w9WgXcQ");
});

test("extractYoutubeVideoId handles embed URLs", () => {
  const url = new URL("https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(extractYoutubeVideoId(url), "dQw4w9WgXcQ");
});

test("normalizeYoutubeUrl rejects non-youtube hosts", () => {
  assert.equal(normalizeYoutubeUrl("https://example.com/watch?v=dQw4w9WgXcQ"), null);
});

test("normalizeYoutubeUrl normalizes to watch URL", () => {
  const normalized = normalizeYoutubeUrl("https://youtu.be/dQw4w9WgXcQ");
  assert.deepEqual(normalized, {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  });
});

test("sanitizeFilenameBase strips windows-reserved characters", () => {
  assert.equal(sanitizeFilenameBase('a<>:"/\\\\|?*b'), "ab");
});

