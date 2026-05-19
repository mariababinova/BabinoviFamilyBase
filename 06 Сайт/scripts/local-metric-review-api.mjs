import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteJson, readJsonOrDefault } from "./agent-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(siteDir, "..");
const port = Number(process.env.LOCAL_METRIC_REVIEW_PORT || 4331);
const candidatesPath = path.join(repoRoot, "07 Показатели", "metric_candidates.json");

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
  const reviewComment = String(payload?.reviewComment || payload?.review_comment || "").trim();

  if (!candidateId) throw new Error("Не указан кандидат показателя.");
  if (!action) throw new Error("Нужно выбрать: подтвердить или отклонить.");

  const candidatesData = await readJsonOrDefault(candidatesPath, { schema_version: 1, candidates: [] });
  const candidates = Array.isArray(candidatesData.candidates) ? candidatesData.candidates : [];
  const candidateIndex = candidates.findIndex((record) => record.id === candidateId || record.dedupe_key === candidateId);
  if (candidateIndex === -1) throw new Error("Показатель уже не найден. Обновите страницу.");

  const candidate = candidates[candidateIndex];
  if (!["needs_review", "approved", "rejected"].includes(String(candidate.status || "needs_review"))) {
    throw new Error("Этот показатель уже импортирован или недоступен для изменения.");
  }

  const now = new Date().toISOString();
  const reviewedCandidate = {
    ...candidate,
    status: action,
    reviewed_at: now,
    reviewed_by: "local_site",
    review_comment: reviewComment || candidate.review_comment || "",
    updated_at: now,
  };
  candidates[candidateIndex] = reviewedCandidate;

  candidatesData.schema_version = candidatesData.schema_version || 1;
  candidatesData.updated_at = now;
  candidatesData.candidates = candidates;

  await atomicWriteJson(candidatesPath, candidatesData);
  refreshGeneratedData();

  return { ok: true, action, candidate: reviewedCandidate, local: true };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.url !== "/api/metrics/review") return sendJson(res, 404, { error: "Not found." });
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const result = await handleReview(payload);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Не удалось обновить показатель." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local metric review API: http://127.0.0.1:${port}/api/metrics/review`);
});
