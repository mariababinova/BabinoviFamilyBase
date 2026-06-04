import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import fs from "node:fs/promises";
import path from "node:path";

export const config = {
  api: {
    bodyParser: false,
  },
};

const repoRoot = process.cwd().endsWith("06 Сайт") ? path.dirname(process.cwd()) : process.cwd();
const intakeDir = path.join(repoRoot, "04 Входящие", "00 Новые файлы");
const maxUploadSize = Number(process.env.MEDS_UPLOAD_MAX_BYTES || 25 * 1024 * 1024);
const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".txt"]);
const defaultAllowedOrigins = ["http://127.0.0.1:4322", "http://localhost:4322"];

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

function isLocalRequest(req: VercelRequest) {
  const host = String(req.headers.host || "");
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

function cleanFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\- а-яА-ЯёЁ]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180) || "document";
}

function cleanText(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function firstField(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function firstFile(value: formidable.File | formidable.File[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function parseForm(req: VercelRequest) {
  const form = formidable({
    multiples: false,
    maxFileSize: maxUploadSize,
    keepExtensions: true,
    allowEmptyFiles: false,
  });

  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }
  if (!isLocalRequest(req)) {
    return json(res, 403, { error: "Локальная загрузка доступна только с localhost." });
  }

  try {
    const { fields, files } = await parseForm(req);
    const file = firstFile(files.file);
    if (!file) {
      return json(res, 400, { error: "Выберите файл." });
    }

    const originalName = cleanFileName(file.originalFilename || "document");
    const extension = path.extname(originalName).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return json(res, 400, { error: "Поддерживаются PDF, JPG, PNG, WEBP и TXT." });
    }

    const personName = cleanText(firstField(fields.personName));
    const personId = cleanText(firstField(fields.personId), 80);
    const prefix = [new Date().toISOString().slice(0, 10), personName || personId || "Без профиля"]
      .filter(Boolean)
      .join(" ");
    const destinationName = cleanFileName(`${prefix} — ${originalName}`);
    const destinationPath = path.join(intakeDir, destinationName);

    await fs.mkdir(intakeDir, { recursive: true });
    await fs.copyFile(file.filepath, destinationPath);

    return json(res, 200, {
      ok: true,
      mode: "local",
      path: destinationPath,
      relativePath: path.relative(repoRoot, destinationPath).replace(/\\/g, "/"),
      personId,
      personName,
      originalName,
      note: cleanText(firstField(fields.note), 1000),
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Не удалось сохранить файл локально.",
    });
  }
}
