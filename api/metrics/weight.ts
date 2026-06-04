import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const repo = process.env.MEDS_GITHUB_REPO || "Ulyana19svlv/MedsDataBase";
const branch = process.env.MEDS_GITHUB_BRANCH || "main";
const token = process.env.MEDS_GITHUB_TOKEN;
const metricsPath = "07 Показатели/metrics.json";
const defaultAllowedOrigins = [
  "https://meds-database-site.vercel.app",
  "https://ulyana19svlv.github.io",
  "http://127.0.0.1:4322",
  "http://localhost:4322",
  "http://127.0.0.1:4324",
  "http://localhost:4324",
];

const people: Record<string, string> = {
  artem: "Артём",
  masha: "Маша",
  nika: "Ника",
};

function json(res: VercelResponse, status: number, body: unknown) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function allowedOrigins() {
  const configured = String(process.env.UPLOAD_ALLOWED_ORIGIN || "").trim();
  if (configured === "*") return ["*"];
  return configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean)
    : defaultAllowedOrigins;
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || "");
  const allowed = allowedOrigins();
  if (allowed.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function metricHash(personId: string, date: string, value: number) {
  return crypto.createHash("sha1").update(`${personId}:weight:${date}:${value}`).digest("hex").slice(0, 24);
}

function contentsUrl() {
  const encodedPath = metricsPath.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${repo}/contents/${encodedPath}`;
}

async function githubJson(url: string, init: RequestInit = {}) {
  if (!token) {
    throw new Error("MEDS_GITHUB_TOKEN is not configured.");
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "MedsDataBase-weight-form",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || "GitHub API request failed.");
  }
  return payload;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  const personId = String(req.body?.personId || "").trim();
  const person = people[personId] || String(req.body?.person || "").trim();
  const date = String(req.body?.date || "").trim();
  const weight = Number(String(req.body?.weight || "").replace(",", "."));

  if (!people[personId]) {
    return json(res, 400, { error: "Неизвестный профиль." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(res, 400, { error: "Нужна дата в формате YYYY-MM-DD." });
  }
  if (!Number.isFinite(weight) || weight <= 0 || weight > 400) {
    return json(res, 400, { error: "Укажите корректный вес в кг." });
  }

  try {
    const current = await githubJson(`${contentsUrl()}?ref=${encodeURIComponent(branch)}`);
    const data = JSON.parse(Buffer.from(current.content, "base64").toString("utf8").replace(/^\uFEFF/, ""));
    const hash = metricHash(personId, date, weight);
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
      value_text: String(weight).replace(".", ","),
      unit: "кг",
      reference_low: null,
      reference_high: null,
      reference_text: "",
      is_abnormal: null,
      source_text: `Вес: ${String(weight).replace(".", ",")} кг.`,
      extraction_confidence: "manual",
      reviewed_at: "",
      created_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    };

    data.schema_version = data.schema_version || 1;
    data.updated_at = new Date().toISOString();
    data.records = Array.isArray(data.records) ? data.records : [];
    data.records = data.records.filter((item: any) => item.dedupe_key !== hash);
    data.records.push(record);

    const updated = await githubJson(contentsUrl(), {
      method: "PUT",
      body: JSON.stringify({
        message: `Add weight for ${person} on ${date}`,
        content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8").toString("base64"),
        sha: current.sha,
        branch,
      }),
    });

    return json(res, 200, {
      ok: true,
      record,
      commit: updated?.commit?.sha,
      commitUrl: updated?.commit?.html_url,
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Не удалось записать вес.",
    });
  }
}
