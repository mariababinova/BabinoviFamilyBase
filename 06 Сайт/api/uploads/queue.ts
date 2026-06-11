import type { VercelRequest, VercelResponse } from "@vercel/node";

const repo = process.env.MEDS_GITHUB_REPO || "Ulyana19svlv/BabinoviFamilyBase";
const branch = process.env.MEDS_GITHUB_BRANCH || "main";
const token = process.env.MEDS_GITHUB_TOKEN;
const queuePath = "04 Входящие/site-upload-queue.json";
const defaultAllowedOrigins = [
  "https://babinovifamilybase.vercel.app",
  "https://ulyana19svlv.github.io",
  "http://127.0.0.1:4322",
  "http://localhost:4322",
];

type JsonRecord = Record<string, any>;

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
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function json(res: VercelResponse, status: number, body: unknown) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function contentsUrl(filePath: string) {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
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
      "User-Agent": "MedsDataBase-upload-queue",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || "GitHub API request failed.");
  }
  return payload;
}

function cleanText(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function safeRecord(record: JsonRecord) {
  return {
    id: cleanText(record.id, 120),
    status: cleanText(record.status || "uploaded", 80),
    source: cleanText(record.source, 80),
    uploaded_at: cleanText(record.uploaded_at, 80),
    person_id: cleanText(record.person_id, 120),
    person_name: cleanText(record.person_name, 160),
    original_name: cleanText(record.original_name, 320),
    note: cleanText(record.note, 1000),
    next_step: cleanText(record.next_step, 120),
    blob: {
      pathname: cleanText(record.blob?.pathname, 600),
      content_type: cleanText(record.blob?.content_type, 140),
      size: Number(record.blob?.size) || 0,
    },
  };
}

async function readQueue() {
  const current = await githubJson(`${contentsUrl(queuePath)}?ref=${encodeURIComponent(branch)}`);
  const data = JSON.parse(Buffer.from(current.content, "base64").toString("utf8").replace(/^\uFEFF/, ""));
  return {
    updated_at: cleanText(data.updated_at, 80),
    records: Array.isArray(data.records) ? data.records.map(safeRecord) : [],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const queue = await readQueue();
    return json(res, 200, { ok: true, ...queue });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Не удалось прочитать очередь загрузок.",
    });
  }
}
