import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { atomicWriteJson, readJsonOrDefault } from "./agent-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(siteDir, "..");

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const dryRun = flags.has("--dry-run");
const noAi = flags.has("--no-ai");
const skipIntake = flags.has("--skip-intake");
const skipPromote = flags.has("--skip-promote");
const skipDoctorSummaries = flags.has("--skip-doctor-summaries");
const skipValidateAssets = flags.has("--skip-validate-assets");
const failBeforeStep = flagValue("--fail-before-step");
const failAfterStep = flagValue("--fail-after-step");

function usage() {
  console.log(`Update medical knowledge base

Usage:
  npm run update:base
  npm run update:base -- --dry-run
  npm run update:base -- --no-ai

Pipeline:
  1. intake scan new inbox files
  2. promote approved drafts into event notes
  3. scan metric candidates
  4. import approved metric candidates
  5. enrich metric references from event notes and PDFs
  6. refresh task candidates and confirmed tasks
  7. refresh doctor summaries
  8. regenerate site data
  9. validate assets

Safety:
  New AI-review drafts, unapproved metric candidates, and unapproved task candidates stay in review files.
  Dry-run runs only steps with a safe dry-run mode; planned-write steps are listed as skipped.
`);
}

function flagValue(name) {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function discoverDir(prefix) {
  const entry = fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .find((item) => item.isDirectory() && item.name.startsWith(prefix));
  if (!entry) throw new Error(`Cannot find repo directory with prefix ${prefix}`);
  return path.join(repoRoot, entry.name);
}

const observationDir = discoverDir("09 ");
const statePath = path.join(observationDir, "update-base-state.json");
const lockPath = path.join(observationDir, ".update-base.lock");

function repoRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

async function walkFiles(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, output);
    } else if (entry.name !== ".gitkeep") {
      output.push(fullPath);
    }
  }
  return output;
}

async function countFiles(dir) {
  return (await walkFiles(dir)).length;
}

function countBy(records, key) {
  const counts = {};
  for (const record of records || []) {
    const value = String(record?.[key] || "unknown");
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function hasReference(record) {
  return Boolean(
    record?.reference_text ||
      (record?.reference_low !== null && record?.reference_low !== undefined) ||
      (record?.reference_high !== null && record?.reference_high !== undefined),
  );
}

async function readJson(relativeParts, fallback) {
  return readJsonOrDefault(path.join(repoRoot, ...relativeParts), fallback);
}

async function snapshot() {
  const inboxDir = discoverDir("04 ");
  const metricsDir = discoverDir("07 ");
  const tasksDir = discoverDir("08 ");
  const inboxFolders = Object.fromEntries(
    await Promise.all(
      [
        ["newFiles", "00 "],
        ["drafts", "10 "],
        ["review", "20 "],
        ["approved", "30 "],
        ["processed", "90 "],
        ["errors", "99 "],
      ].map(async ([key, prefix]) => {
        const dir = fs
          .readdirSync(inboxDir, { withFileTypes: true })
          .find((item) => item.isDirectory() && item.name.startsWith(prefix));
        return [key, dir ? await countFiles(path.join(inboxDir, dir.name)) : 0];
      }),
    ),
  );

  const metricsJson = await readJson([repoRelative(metricsDir), "metrics.json"], { records: [] });
  const metricCandidatesJson = await readJson([repoRelative(metricsDir), "metric_candidates.json"], { candidates: [] });
  const tasksJson = await readJson([repoRelative(tasksDir), "tasks.json"], { records: [] });
  const taskCandidatesJson = await readJson([repoRelative(tasksDir), "task_candidates.json"], { records: [] });
  const metrics = metricsJson.records || [];
  const metricCandidates = metricCandidatesJson.candidates || [];
  const tasks = tasksJson.records || [];
  const taskCandidates = taskCandidatesJson.records || [];

  return {
    inbox: inboxFolders,
    metrics: {
      total: metrics.length,
      withReferences: metrics.filter(hasReference).length,
      candidates: metricCandidates.length,
      candidateStatus: countBy(metricCandidates, "status"),
    },
    tasks: {
      confirmed: tasks.length,
      candidates: taskCandidates.length,
      candidateStatus: countBy(taskCandidates, "candidate_status"),
    },
  };
}

function delta(before, after, pathParts) {
  const oldValue = pathParts.reduce((value, key) => value?.[key], before) || 0;
  const newValue = pathParts.reduce((value, key) => value?.[key], after) || 0;
  return newValue - oldValue;
}

function formatDelta(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function sanitizedError(error) {
  return String(error?.message || error || "Unknown error")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "sk-[redacted]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g, "gh[token-redacted]")
    .replace(/\b([A-Z0-9_]*(?:KEY|TOKEN|PASSWORD|SECRET)[A-Z0-9_]*)=(?:"[^"]*"|'[^']*'|\S+)/gi, "$1=[redacted]");
}

async function acquireLock() {
  await fsp.mkdir(path.dirname(lockPath), { recursive: true });
  const payload = {
    pid: process.pid,
    started_at: new Date().toISOString(),
    command: ["node", "scripts/update-base.mjs", ...args],
  };

  try {
    const handle = await fsp.open(lockPath, "wx");
    await handle.writeFile(JSON.stringify(payload, null, 2));
    await handle.close();
    return async () => {
      try {
        const current = JSON.parse(await fsp.readFile(lockPath, "utf8"));
        if (current.pid === process.pid) await fsp.unlink(lockPath);
      } catch {
        // Best effort cleanup only.
      }
    };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let current = null;
    let stat = null;
    try {
      stat = await fsp.stat(lockPath);
      current = JSON.parse(await fsp.readFile(lockPath, "utf8"));
    } catch {
      current = null;
    }
    const startedAt = current?.started_at ? Date.parse(current.started_at) : NaN;
    const lockAge = stat?.mtimeMs ? Date.now() - stat.mtimeMs : 0;
    const stale = Number.isFinite(startedAt)
      ? Date.now() - startedAt > 6 * 60 * 60 * 1000
      : lockAge > 6 * 60 * 60 * 1000;
    if (!stale) {
      const pidLabel = current?.pid ? `pid ${current.pid}` : "unreadable lock";
      throw new Error(`Another update-base run is active (${pidLabel}). Lock: ${repoRelative(lockPath)}`);
    }
    const quarantinePath = `${lockPath}.stale-${process.pid}-${Date.now()}`;
    await fsp.rename(lockPath, quarantinePath);
    return acquireLock();
  }
}

function gitSnapshot() {
  const sha = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return {
    available: sha.status === 0 && status.status === 0,
    sha: sha.status === 0 ? sha.stdout.trim() : "",
    dirty: status.status === 0 ? status.stdout.trim().length > 0 : null,
  };
}

function buildSteps() {
  const commonFlags = dryRun ? ["--dry-run"] : [];
  const intakeFlags = [...commonFlags, ...(noAi ? ["--no-ai"] : [])];
  const steps = [];

  if (!skipIntake) {
    steps.push({
      id: "intake",
      label: "Intake: scan new files",
      command: "node",
      args: ["scripts/intake-agent.mjs", "scan", ...intakeFlags],
      dryRunMode: true,
    });
  }
  if (!skipPromote) {
    steps.push({
      id: "promote",
      label: "Intake: promote approved drafts",
      command: "node",
      args: ["scripts/intake-agent.mjs", "promote", ...commonFlags],
      dryRunMode: true,
    });
  }

  steps.push(
    {
      id: "metrics-scan",
      label: "Metrics: scan candidates",
      command: "node",
      args: ["scripts/metrics-agent.mjs", "scan", ...commonFlags],
      dryRunMode: true,
    },
    {
      id: "metrics-apply",
      label: "Metrics: import approved candidates",
      command: "node",
      args: ["scripts/metrics-agent.mjs", "apply", ...commonFlags],
      dryRunMode: true,
    },
    {
      id: "metrics-enrich",
      label: "Metrics: enrich references",
      command: "node",
      args: ["scripts/metrics-agent.mjs", "enrich", ...commonFlags],
      dryRunMode: true,
    },
    {
      id: "tasks",
      label: "Tasks: refresh",
      command: "node",
      args: ["scripts/tasks-agent.mjs", ...commonFlags],
      dryRunMode: true,
    },
  );

  if (!skipDoctorSummaries) {
    steps.push({
      id: "doctor-summaries",
      label: "Doctor summaries: refresh",
      command: "node",
      args: ["scripts/doctor-summary-agent.mjs"],
      dryRunMode: false,
      plannedWrite: "Regenerates doctor summary markdown and JSON.",
    });
  }

  steps.push({
    id: "generate-data",
    label: "Site data: regenerate",
    command: "node",
    args: ["scripts/generate-data.mjs"],
    dryRunMode: false,
    plannedWrite: "Regenerates src/generated/dashboard-data.json.",
  });

  if (!skipValidateAssets) {
    steps.push({
      id: "validate-assets",
      label: "Assets: validate",
      command: "node",
      args: ["scripts/validate-assets.mjs"],
      dryRunMode: true,
      readOnly: true,
    });
  }

  return steps;
}

async function saveRun(run) {
  const state = await readJsonOrDefault(statePath, { schema_version: 1, runs: [] });
  const runs = [run, ...(state.runs || []).filter((item) => item.run_id !== run.run_id)].slice(0, 20);
  await atomicWriteJson(statePath, { schema_version: 1, updated_at: new Date().toISOString(), runs });
}

async function updateRun(run, patch = {}) {
  Object.assign(run, patch, { updated_at: new Date().toISOString() });
  await saveRun(run);
}

function runStep(step) {
  console.log(`\n== ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    cwd: siteDir,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    const error = new Error(`${step.label} failed with exit code ${result.status ?? "unknown"}`);
    error.exitCode = result.status ?? null;
    error.signal = result.signal ?? "";
    throw error;
  }
  return { exitCode: result.status ?? 0, signal: result.signal ?? "" };
}

function printSkipped(step) {
  console.log(`\n== ${step.label}`);
  console.log(`Skipped in dry-run: ${step.plannedWrite || "this step has no safe dry-run mode."}`);
}

function printSummary(before, after, run) {
  const skipped = run.steps.filter((step) => step.status === "skipped").length;
  const completed = run.steps.filter((step) => step.status === "completed").length;
  const failed = run.steps.filter((step) => step.status === "failed").length;

  console.log("\n== Summary");
  console.log(`Run id: ${run.run_id}`);
  console.log(`Status: ${run.status}`);
  console.log(`Steps: ${completed} completed, ${skipped} skipped, ${failed} failed`);
  console.log(`Run log: ${repoRelative(statePath)}`);
  console.log(`Inbox new files: ${after.inbox.newFiles} (${formatDelta(delta(before, after, ["inbox", "newFiles"]))})`);
  console.log(`Inbox review drafts: ${after.inbox.review} (${formatDelta(delta(before, after, ["inbox", "review"]))})`);
  console.log(`Inbox approved drafts: ${after.inbox.approved} (${formatDelta(delta(before, after, ["inbox", "approved"]))})`);
  console.log(`Metrics: ${after.metrics.total} (${formatDelta(delta(before, after, ["metrics", "total"]))})`);
  console.log(
    `Metric references: ${after.metrics.withReferences}/${after.metrics.total} (${formatDelta(
      delta(before, after, ["metrics", "withReferences"]),
    )})`,
  );
  console.log(`Metric candidates needing review: ${after.metrics.candidateStatus.needs_review || 0}`);
  console.log(`Confirmed tasks: ${after.tasks.confirmed} (${formatDelta(delta(before, after, ["tasks", "confirmed"]))})`);
  console.log(`Task candidates: ${after.tasks.candidates} (${formatDelta(delta(before, after, ["tasks", "candidates"]))})`);

  const planned = run.steps.filter((step) => step.status === "skipped").map((step) => `- ${step.id}: ${step.plannedWrite}`);
  if (planned.length) {
    console.log("\nSkipped planned-write steps:");
    console.log(planned.join("\n"));
  }
  if (dryRun) console.log("\nDry run: safe dry-run steps ran; planned-write steps were skipped and recorded.");
}

async function main() {
  if (flags.has("--help") || flags.has("-h")) {
    usage();
    return;
  }

  let releaseLock = async () => {};
  let run = null;

  try {
    releaseLock = await acquireLock();
  } catch (error) {
    console.error(`\nUpdate failed: ${sanitizedError(error)}`);
    process.exitCode = 1;
    return;
  }

  try {
    const before = await snapshot();
    const steps = buildSteps();
    run = {
    schema_version: 1,
    run_id: `update-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    command: ["node", "scripts/update-base.mjs", ...args],
    cwd: repoRelative(siteDir),
    git: gitSnapshot(),
    dryRun,
    noAi,
    status: "running",
    started_at: new Date().toISOString(),
    finished_at: "",
    failedStep: "",
    sanitizedError: "",
    before,
    after: null,
    steps: steps.map((step) => ({
      id: step.id,
      label: step.label,
      status: "pending",
      started_at: "",
      finished_at: "",
      command: [step.command, ...step.args],
      dryRunMode: step.dryRunMode,
      readOnly: Boolean(step.readOnly),
      plannedWrite: step.plannedWrite || "",
      exitCode: null,
      sanitizedError: "",
    })),
    };

    await updateRun(run);
    for (const step of steps) {
      const record = run.steps.find((item) => item.id === step.id);
      record.status = "running";
      record.started_at = new Date().toISOString();
      await updateRun(run);

      if (failBeforeStep === step.id) throw new Error(`Injected failure before step ${step.id}`);
      if (dryRun && !step.dryRunMode) {
        record.status = "skipped";
        record.finished_at = new Date().toISOString();
        printSkipped(step);
        await updateRun(run);
        continue;
      }

      const result = runStep(step);
      record.exitCode = result.exitCode;
      record.signal = result.signal;
      if (failAfterStep === step.id) throw new Error(`Injected failure after step ${step.id}`);
      record.status = "completed";
      record.finished_at = new Date().toISOString();
      await updateRun(run);
    }

    const after = await snapshot();
    run.status = "completed";
    run.finished_at = new Date().toISOString();
    run.after = after;
    await updateRun(run);
    printSummary(before, after, run);
  } catch (error) {
    const message = sanitizedError(error);
    const active = run?.steps.find((step) => step.status === "running");
    if (active) {
      active.status = "failed";
      active.finished_at = new Date().toISOString();
      active.sanitizedError = message;
      if (error?.exitCode !== undefined) active.exitCode = error.exitCode;
      if (error?.signal) active.signal = error.signal;
    }
    if (run) {
      run.status = "failed";
      run.finished_at = new Date().toISOString();
      run.failedStep = active?.id || "";
      run.sanitizedError = message;
    }
    try {
      if (run) run.after = await snapshot();
    } catch {
      if (run) run.after = null;
    }
    if (run) {
      await updateRun(run);
    }
    console.error(`\nUpdate failed: ${message}`);
    if (run) console.error(`Run log: ${repoRelative(statePath)}`);
    process.exitCode = 1;
  } finally {
    await releaseLock();
  }
}

await main();
