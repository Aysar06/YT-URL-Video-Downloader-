import fs from "node:fs/promises";
import path from "node:path";
import { randomId } from "./youtube.js";

const jobs = new Map();
const files = new Map();

export function createJob(initial) {
  const id = randomId();
  const job = {
    id,
    status: "running",
    createdAt: Date.now(),
    progress: null,
    error: null,
    fileId: null,
    filePath: null,
    fileName: null,
    meta: initial ?? null,
    clients: new Set()
  };
  jobs.set(id, job);
  return job;
}

export function getJob(jobId) {
  return jobs.get(jobId) ?? null;
}

export function subscribe(jobId, res) {
  const job = getJob(jobId);
  if (!job) return false;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("\n");

  job.clients.add(res);

  res.on("close", () => {
    job.clients.delete(res);
  });

  send(job, "state", serializeJob(job));

  return true;
}

export function send(job, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of job.clients) {
    client.write(payload);
  }
}

export function updateProgress(job, progress) {
  job.progress = progress;
  send(job, "progress", progress);
}

export function markJobError(job, message) {
  job.status = "error";
  job.error = message;
  send(job, "state", serializeJob(job));
}

export function markJobDone(job, fileId, filePath, fileName) {
  job.status = "done";
  job.fileId = fileId;
  job.filePath = filePath;
  job.fileName = fileName;
  send(job, "state", serializeJob(job));
}

export function serializeJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    progress: job.progress,
    error: job.error,
    fileId: job.fileId,
    fileName: job.fileName,
    meta: job.meta
  };
}

export function registerFile({ filePath, fileName }) {
  const fileId = randomId();
  files.set(fileId, { filePath, fileName, createdAt: Date.now() });
  return fileId;
}

export function getFile(fileId) {
  return files.get(fileId) ?? null;
}

export async function findCompletedFile(downloadDir, fileBase) {
  const entries = await fs.readdir(downloadDir, { withFileTypes: true });
  const matches = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith(`${fileBase}.`)) continue;
    matches.push(entry.name);
  }

  if (matches.length === 0) return null;

  let newest = null;
  let newestMtime = 0;
  for (const name of matches) {
    const full = path.join(downloadDir, name);
    const stat = await fs.stat(full);
    if (stat.mtimeMs > newestMtime) {
      newestMtime = stat.mtimeMs;
      newest = { filePath: full, fileName: name };
    }
  }

  return newest;
}

