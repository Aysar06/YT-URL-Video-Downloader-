import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import os from "node:os";
import YTDlpWrapPkg from "yt-dlp-wrap";

const YTDlpWrap = YTDlpWrapPkg.default ?? YTDlpWrapPkg;

function getAppDataRoot() {
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir();
  }
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
}

const BIN_DIR = path.join(getAppDataRoot(), "YoutubeVideoDownloader", ".bin");
const YT_DLP_PATH = path.join(
  BIN_DIR,
  process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
);

let ytDlpWrap;
let ensurePromise;

async function ensureYtDlpBinary() {
  await fs.mkdir(BIN_DIR, { recursive: true });

  if (!fsSync.existsSync(YT_DLP_PATH)) {
    await YTDlpWrap.downloadFromGithub(YT_DLP_PATH);
    if (process.platform !== "win32") {
      await fs.chmod(YT_DLP_PATH, 0o755);
    }
  }

  if (!ytDlpWrap) ytDlpWrap = new YTDlpWrap(YT_DLP_PATH);
  return ytDlpWrap;
}

export async function getYtDlpWrap() {
  if (!ensurePromise) ensurePromise = ensureYtDlpBinary();
  return ensurePromise;
}

export async function hasFfmpeg() {
  return await new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-version"], { windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

export function getDefaultDownloadDir() {
  return path.join(os.homedir(), "Downloads");
}
