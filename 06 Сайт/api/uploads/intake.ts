import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const allowedContentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
];
const maxUploadSize = Number(process.env.MEDS_UPLOAD_MAX_BYTES || 25 * 1024 * 1024);
const defaultAllowedOrigins = [
  "https://meds-database-site.vercel.app",
  "https://ulyana19svlv.github.io",
  "http://127.0.0.1:4322",
  "http://localhost:4322",
];

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

function parseClientPayload(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function assertSafePathname(pathname: string) {
  if (!pathname.startsWith("incoming/")) {
    throw new Error("Файл должен загружаться в папку incoming.");
  }

  const filename = pathname.split("/").pop() || "";
  if (!filename || filename.includes("..") || /[\\?#]/.test(filename)) {
    throw new Error("Некорректное имя файла.");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json(res, 500, { error: "BLOB_READ_WRITE_TOKEN is not configured." });
  }

  try {
    const body = req.body as HandleUploadBody;
    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        assertSafePathname(pathname);
        const payload = parseClientPayload(clientPayload);

        return {
          allowedContentTypes,
          maximumSizeInBytes: maxUploadSize,
          validUntil: Date.now() + 5 * 60 * 1000,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            ...payload,
            pathname,
            issued_at: new Date().toISOString(),
          }),
        };
      },
    });

    return json(res, 200, response);
  } catch (error) {
    return json(res, 400, {
      error: error instanceof Error ? error.message : "Не удалось подготовить загрузку.",
    });
  }
}
