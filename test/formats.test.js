import test from "node:test";
import assert from "node:assert/strict";

import { buildDownloadOptions } from "../src/formats.js";

test("buildDownloadOptions returns video and audio options", () => {
  const info = {
    formats: [
      { format_id: "18", ext: "mp4", height: 360, vcodec: "avc1", acodec: "mp4a", tbr: 400 },
      { format_id: "22", ext: "mp4", height: 720, vcodec: "avc1", acodec: "mp4a", tbr: 1200 },
      { format_id: "137", ext: "mp4", height: 1080, vcodec: "avc1", acodec: "none", tbr: 2500 },
      { format_id: "140", ext: "m4a", vcodec: "none", acodec: "mp4a", abr: 128 }
    ]
  };

  const { video, audio } = buildDownloadOptions(info);
  assert.ok(video.length >= 2);
  assert.ok(audio.length >= 1);

  const hasMuxed720 = video.some((o) => o.height === 720 && o.container === "mp4" && o.needsFfmpeg === false);
  assert.equal(hasMuxed720, true);

  const hasMerge1080 = video.some((o) => o.height === 1080 && o.needsFfmpeg === true);
  assert.equal(hasMerge1080, true);
});

