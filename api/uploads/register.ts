import type { VercelRequest, VercelResponse } from "@vercel/node";

const repo = process.env.MEDS_GITHUB_REPO || "Ulyana19svlv/BabinoviFamilyBase";
const branch = process.env.MEDS_GITHUB_BRANCH || "main";
const token = process.env.MEDS_GITHUB_TOKEN;
const queuePath = "04 Входящие/site-upload-queue.json";
const defaultAllowedOrigins = [
  "https://meds-database-site.vercel.app",
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
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
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
      "User-Agent": "MedsDataBase-upload-intake",
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

async function readQueue() {
  try {
    const current = await githubJson(`${contentsUrl(queuePath)}?ref=${encodeURIComponent(branch)}`);
    const data = JSON.parse(Buffer.from(current.content, "base64").toString("utf8").replace(/^\uFEFF/, ""));
    return { current, data };
  } catch (error) {
    if (error instanceof Error && /Not Found/i.test(error.message)) {
      return {
        current: null,
        data: { schema_version: 1, updated_at: "", records: [] },
      };
    }
    throw error;
  }
}

async function writeQueue(sha: string | null, data: unknown, message: string) {
  return githubJson(contentsUrl(queuePath), {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
      branch,
    }),
  });
}

function cleanText(value: unknown, max = 400) {
  return String(value || "").trim().slice(0, max);
}

function cleanUrl(value: unknown) {
  const url = cleanText(value, 1200);
  if (!/^https:\/\/.+/i.test(url)) return "";
  return url;
}

function uploadRecord(body: JsonRecord) {
  const blob = body.blob && typeof body.blob === "object" ? body.blob : {};
  const url = cleanUrl(blob.url);
  const pathname = cleanText(blob.pathname, 500);
  if (!url || !pathname) {
    throw new Error("Нет данных загруженного Blob-файла.");
  }

  const now = new Date().toISOString();
  const shortId = Math.random().toString(36).slice(2, 10);
  return {
    id: `site-upload-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${shortId}`,
    status: "uploaded",
    source: "site-upload",
    uploaded_at: now,
    person_id: cleanText(body.personId, 80),
    person_name: cleanText(body.personName, 120),
    original_name: cleanText(body.originalName, 260),
    note: cleanText(body.note, 1000),
    blob: {
      url,
      download_url: cleanUrl(blob.downloadUrl || blob.download_url),
      pathname,
      content_type: cleanText(blob.contentType || blob.content_type, 120),
      size: Number(blob.size) || Number(body.size) || 0,
    },
    next_step: "download-to-intake-and-run-agent",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const { current, data } = await readQueue();
    const records = Array.isArray(data.records) ? data.records : [];
    const record = uploadRecord((req.body || {}) as JsonRecord);
    data.schema_version = data.schema_version || 1;
    data.updated_at = record.uploaded_at;
    data.records = [record, ...records].slice(0, 500);

    const result = await writeQueue(current?.sha || null, data, `Register site upload: ${record.original_name || record.id}`);
    return json(res, 200, {
      ok: true,
      record,
      commit: result?.commit?.sha || "",
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Не удалось зарегистрировать загрузку.",
    });
  }
}
