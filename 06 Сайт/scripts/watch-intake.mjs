import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { inboxDir, repoRelative, siteDir } from "./dashboard-lib.mjs";

const watchDir = path.join(inboxDir, "00 Новые файлы");
const debounceMs = Number(process.env.MEDS_WATCH_DEBOUNCE_MS || 5000);
let timer = null;
let running = false;
let queued = false;

function runUpdate() {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  const child = spawn(process.execPath, [path.join(siteDir, "scripts", "update-base.mjs"), "--no-ai"], {
    cwd: siteDir,
    stdio: "inherit",
  });
  child.on("exit", () => {
    running = false;
    if (queued) {
      queued = false;
      schedule();
    }
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runUpdate, debounceMs);
}

if (!fs.existsSync(watchDir)) {
  console.error(`Watch directory not found: ${repoRelative(watchDir)}`);
  process.exit(1);
}

console.log(`Watching ${repoRelative(watchDir)}. Debounce: ${debounceMs} ms. Ctrl+C to stop.`);
fs.watch(watchDir, { recursive: false }, (_event, fileName) => {
  if (!fileName || String(fileName).startsWith(".")) return;
  console.log(`Change detected: ${fileName}`);
  schedule();
});
