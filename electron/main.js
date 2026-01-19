import { app, BrowserWindow } from "electron";
import { startServer } from "../src/server.js";

let server;

async function startBackend() {
  const started = await startServer({ port: 0 });
  server = started.server;
  return started.port;
}

async function createWindow(port) {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    backgroundColor: "#0b0d12"
  });

  await win.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(async () => {
  const port = await startBackend();
  await createWindow(port);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(port);
    }
  });
});

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});
