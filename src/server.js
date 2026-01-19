import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildDownloadOptions } from "./formats.js";
import {
  isNonEmptyString,
  normalizeYoutubeUrl,
  sanitizeFilenameBase
} from "./youtube.js";
import { getDefaultDownloadDir, getYtDlpWrap, hasFfmpeg } from "./ytDlp.js";
import {
  createJob,
  findCompletedFile,
  getJob,
  markJobDone,
  markJobError,
  subscribe,
  updateProgress
} from "./jobs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

function serverError(res, message) {
  res.status(500).json({ error: message });
}

async function resolveDownloadDir(inputDir) {
  const defaultDir = getDefaultDownloadDir();
  if (!isNonEmptyString(inputDir)) return defaultDir;

  const trimmed = inputDir.trim();
  if (trimmed.length > 260) return defaultDir;

  const resolved = path.resolve(trimmed);
  const home = path.resolve(getDefaultDownloadDir(), "..");

  if (!resolved.toLowerCase().startsWith(home.toLowerCase())) return defaultDir;

  await fs.mkdir(resolved, { recursive: true });
  return resolved;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use("/api", apiLimiter);

  const downloadLimiter = rateLimit({
    windowMs: 60_000,
    limit: 6,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.get("/api/health", async (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/capabilities", async (_req, res) => {
    res.json({ ffmpegAvailable: await hasFfmpeg() });
  });

  app.post("/api/info", async (req, res) => {
    const normalized = normalizeYoutubeUrl(req.body?.url);
    if (!normalized) return badRequest(res, "Invalid YouTube URL.");

    try {
      const ytDlp = await getYtDlpWrap();
      const stdout = await ytDlp.execPromise([
        normalized.url,
        "--dump-single-json",
        "--no-playlist",
        "--no-warnings",
        "--skip-download"
      ]);

      const info = JSON.parse(stdout);
      const options = buildDownloadOptions(info);

      res.json({
        normalizedUrl: normalized.url,
        videoId: normalized.videoId,
        title: info?.title ?? null,
        duration: info?.duration ?? null,
        isLive: Boolean(info?.is_live),
        options
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch video info.";
      return serverError(res, message);
    }
  });

  app.post("/api/download/start", downloadLimiter, async (req, res) => {
    const normalized = normalizeYoutubeUrl(req.body?.url);
    if (!normalized) return badRequest(res, "Invalid YouTube URL.");

    const selection = req.body?.selection;
    if (!selection || (selection.kind !== "video" && selection.kind !== "audio")) {
      return badRequest(res, "Invalid download selection.");
    }

    const format = selection.format;
    if (!format || (format.type !== "format_id" && format.type !== "format_selector")) {
      return badRequest(res, "Invalid format selection.");
    }

    const container = isNonEmptyString(selection.container) ? selection.container.trim() : null;
    if (!container || !/^[a-z0-9]{2,5}$/i.test(container)) {
      return badRequest(res, "Invalid container.");
    }

    try {
      const ytDlp = await getYtDlpWrap();
      const ffmpegAvailable = await hasFfmpeg();

      const needsFfmpeg = selection.kind === "video" && Boolean(selection.needsFfmpeg);

      if (needsFfmpeg && !ffmpegAvailable) {
        return badRequest(res, "Selected quality requires FFmpeg, but FFmpeg was not found.");
      }

      const downloadDir = await resolveDownloadDir(req.body?.downloadDir);

      const baseTitle = sanitizeFilenameBase(req.body?.title ?? "video");
      const fileBase = `${baseTitle}-${normalized.videoId}`;
      const outputTemplate = path.join(downloadDir, `${fileBase}.%(ext)s`);

      const job = createJob({
        videoId: normalized.videoId,
        title: baseTitle,
        kind: selection.kind,
        container
      });

      const args = [
        normalized.url,
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "-o",
        outputTemplate
      ];

      if (selection.kind === "video") {
        args.push("-f", format.value);
        if (needsFfmpeg) args.push("--merge-output-format", container);
      } else {
        args.push("-f", format.value);
      }

      const emitter = ytDlp.exec(args);

      emitter
        .on("progress", (progress) => {
          updateProgress(job, {
            percent: progress?.percent ?? null,
            totalSize: progress?.totalSize ?? null,
            currentSpeed: progress?.currentSpeed ?? null,
            eta: progress?.eta ?? null
          });
        })
        .on("error", (error) => {
          markJobError(job, error?.message ?? "Download failed.");
        })
        .on("close", async () => {
          if (job.status === "error") return;

          try {
            const found = await findCompletedFile(downloadDir, fileBase);
            if (!found) return markJobError(job, "Download finished, but file was not found.");

            const fileId = job.id;
            markJobDone(job, fileId, found.filePath, found.fileName);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Download finished, but failed to locate file.";
            markJobError(job, message);
          }
        });

      res.json({ jobId: job.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start download.";
      return serverError(res, message);
    }
  });

  app.get("/api/progress/:jobId", (req, res) => {
    const ok = subscribe(req.params.jobId, res);
    if (!ok) res.status(404).end();
  });

  app.get("/api/file/:jobId", async (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job || job.status !== "done" || !job.filePath) return res.status(404).end();

    if (!fsSync.existsSync(job.filePath)) return res.status(404).end();

    res.setHeader("Content-Disposition", `attachment; filename="${job.fileName ?? "video"}"`);
    res.sendFile(job.filePath);
  });

  app.use(express.static(PUBLIC_DIR));

  app.use((_req, res) => {
    res.status(404).send("Not found");
  });

  return app;
}

export async function startServer({ port } = {}) {
  const resolvedPort = typeof port === "number" ? port : process.env.PORT ? Number(process.env.PORT) : 5179;
  const app = createApp();

  return await new Promise((resolve, reject) => {
    const server = app.listen(resolvedPort, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : resolvedPort;
      resolve({ app, server, port: actualPort });
    });
    server.on("error", reject);
  });
}

const entryArg = process.argv?.[1];
if (typeof entryArg === "string" && import.meta.url === pathToFileURL(entryArg).href) {
  startServer()
    .then(({ port }) => {
      process.stdout.write(`Server running on http://localhost:${port}\n`);
    })
    .catch((err) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    });
}
