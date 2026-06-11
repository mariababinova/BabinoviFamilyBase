import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteJson, readJsonOrDefault } from "./agent-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(siteDir, "..");
const port = Number(process.env.LOCAL_WEIGHT_PORT || 4332);
const metricsPath = process.env.LOCAL_WEIGHT_METRICS_PATH
  ? path.resolve(process.env.LOCAL_WEIGHT_METRICS_PATH)
  : path.join(repoRoot, "07 Показатели", "metrics.json");

const people = {
  aleksandr: "Александр",
  artem: "Артём",
  masha: "Маша",
  nika: "Ника",
};

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

function metricHash(personId, date, value) {
  return crypto.createHash("sha1").update(`${personId}:weight:${date}:${value}`).digest("hex").slice(0, 24);
}

function refreshGeneratedData() {
  if (process.env.LOCAL_WEIGHT_SKIP_REFRESH === "1") return;
  const child = spawn(process.execPath, [path.join(siteDir, "scripts", "generate-data.mjs")], {
    cwd: siteDir,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
}

async function saveWeight(payload) {
  const personId = String(payload?.personId || "").trim();
  const person = people[personId] || String(payload?.person || "").trim();
  const date = String(payload?.date || "").trim();
  const weight = Number(String(payload?.weight || "").replace(",", "."));

  if (!people[personId]) throw new Error("Неизвестный профиль.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Нужна дата в формате YYYY-MM-DD.");
  if (!Number.isFinite(weight) || weight <= 0 || weight > 400) throw new Error("Укажите корректный вес в кг.");

  const data = await readJsonOrDefault(metricsPath, { schema_version: 1, records: [] });
  const hash = metricHash(personId, date, weight);
  const now = new Date().toISOString();
  const displayWeight = String(weight).replace(".", ",");
  const record = {
    id: `metric-${hash}`,
    status: "approved",
    dedupe_key: hash,
    person,
    person_id: personId,
    date,
    source_type: "manual_profile_form",
    source_event_id: "",
    source_event_path: "",
    source_files: [],
    source_draft_path: "",
    metric_id: "weight",
    metric_label: "Вес",
    metric_category: "body",
    metric_value_type: "numeric",
    custom_metric_label: "",
    value: String(weight),
    numeric_value: weight,
    comparator: "",
    qualitative_value: "",
    value_text: displayWeight,
    unit: "кг",
    reference_low: null,
    reference_high: null,
    reference_text: "",
    is_abnormal: null,
    source_text: `Вес: ${displayWeight} кг.`,
    extraction_confidence: "manual",
    reviewed_at: "",
    created_at: now,
    approved_at: now,
  };

  data.schema_version = data.schema_version || 1;
  data.updated_at = now;
  data.records = Array.isArray(data.records) ? data.records : [];
  data.records = data.records.filter((item) => item.dedupe_key !== hash);
  data.records.push(record);

  await atomicWriteJson(metricsPath, data);
  refreshGeneratedData();

  return { ok: true, record, local: true };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.url !== "/api/metrics/weight") return sendJson(res, 404, { error: "Not found." });
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};
    const result = await saveWeight(payload);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Не удалось сохранить вес." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local weight API: http://127.0.0.1:${port}/api/metrics/weight`);
});
