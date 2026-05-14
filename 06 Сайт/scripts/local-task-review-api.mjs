import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteJson, readJsonOrDefault } from "./agent-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(siteDir, "..");
const port = Number(process.env.LOCAL_TASK_REVIEW_PORT || 4330);
const candidatesPath = path.join(repoRoot, "08 Задачи", "task_candidates.json");
const tasksPath = path.join(repoRoot, "08 Задачи", "tasks.json");

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function normalizeAction(value) {
  const action = String(value || "").trim().toLowerCase();
  if (action === "approve" || action === "approved") return "approved";
  if (action === "reject" || action === "rejected") return "rejected";
  return "";
}

function candidateStatus(record) {
  return String(record?.candidate_status || record?.review_status || record?.status || "needs_review");
}

function taskFromCandidate(candidate) {
  const {
    candidate_id,
    candidate_status,
    review_status,
    reviewed_at,
    reviewed_by,
    review_comment,
    ...task
  } = candidate;
  return {
    ...task,
    id: task.id || `task-${task.dedupe_key || candidate_id}`,
    status: "open",
    source_agent: task.source_agent || "tasks-agent",
    approved_at: new Date().toISOString(),
  };
}

function refreshGeneratedData() {
  const child = spawn(process.execPath, [path.join(siteDir, "scripts", "generate-data.mjs")], {
    cwd: siteDir,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
}

async function handleReview(payload) {
  const candidateId = String(payload?.candidateId || payload?.candidate_id || "").trim();
  const action = normalizeAction(payload?.action);

  if (!candidateId) throw new Error("Не указан кандидат рекомендации.");
  if (!action) throw new Error("Нужно выбрать: сделать задачей или отклонить.");

  const candidatesData = await readJsonOrDefault(candidatesPath, { schema_version: 1, records: [] });
  const tasksData = await readJsonOrDefault(tasksPath, { schema_version: 1, records: [] });
  const candidates = Array.isArray(candidatesData.records) ? candidatesData.records : [];
  const candidateIndex = candidates.findIndex((record) => record.candidate_id === candidateId || record.id === candidateId);
  if (candidateIndex === -1) throw new Error("Рекомендация уже не найдена. Обновите страницу.");

  const candidate = candidates[candidateIndex];
  if (candidateStatus(candidate) !== "needs_review") throw new Error("Эта рекомендация уже разобрана.");

  const now = new Date().toISOString();
  const reviewedCandidate = {
    ...candidate,
    candidate_status: action,
    review_status: action,
    status: action,
    reviewed_at: now,
    reviewed_by: "local_site",
    updated_at: now,
  };
  candidates[candidateIndex] = reviewedCandidate;

  candidatesData.schema_version = candidatesData.schema_version || 1;
  candidatesData.updated_at = now;
  candidatesData.records = candidates;

  let task = null;
  if (action === "approved") {
    task = taskFromCandidate(reviewedCandidate);
    tasksData.schema_version = tasksData.schema_version || 1;
    tasksData.updated_at = now;
    tasksData.records = Array.isArray(tasksData.records) ? tasksData.records : [];
    tasksData.records = tasksData.records.filter((record) => {
      if (task?.dedupe_key && record.dedupe_key === task.dedupe_key) return false;
      return record.id !== task?.id;
    });
    tasksData.records.push(task);
    await atomicWriteJson(tasksPath, tasksData);
  }

  await atomicWriteJson(candidatesPath, candidatesData);
  refreshGeneratedData();

  return { ok: true, action, candidate: reviewedCandidate, task, local: true };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.url !== "/api/tasks/review") return sendJson(res, 404, { error: "Not found." });
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const result = await handleReview(payload);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Не удалось обновить рекомендацию." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local task review API: http://127.0.0.1:${port}/api/tasks/review`);
});
