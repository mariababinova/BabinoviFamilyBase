import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import formidable from "formidable";

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(siteRoot);
const astroPort = Number(process.env.MEDS_LOCAL_ASTRO_PORT || 4321);
const bridgePort = Number(process.env.MEDS_LOCAL_UPLOAD_PORT || 4322);
const intakeDir = path.join(repoRoot, "04 Входящие", "00 Новые файлы");
const maxUploadSize = Number(process.env.MEDS_UPLOAD_MAX_BYTES || 25 * 1024 * 1024);
const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".txt"]);

function cleanFileName(value) {
  return String(value || "document")
    .normalize("NFKD")
    .replace(/[^\w.\- а-яА-ЯёЁ]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180) || "document";
}

function cleanText(value, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function firstField(value) {
  return Array.isArray(value) ? value[0] : value;
}

function firstFile(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

async function handleLocalUpload(req, res) {
  const form = formidable({
    multiples: false,
    maxFileSize: maxUploadSize,
    keepExtensions: true,
    allowEmptyFiles: false,
  });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (error, parsedFields, parsedFiles) => {
        if (error) reject(error);
        else resolve({ fields: parsedFields, files: parsedFiles });
      });
    });

    const file = firstFile(files.file);
    if (!file) return sendJson(res, 400, { error: "Выберите файл." });

    const originalName = cleanFileName(file.originalFilename || "document");
    const extension = path.extname(originalName).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return sendJson(res, 400, { error: "Поддерживаются PDF, JPG, PNG, WEBP и TXT." });
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

    return sendJson(res, 200, {
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
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Не удалось сохранить файл локально.",
    });
  }
}

function proxyToAstro(req, res) {
  const incomingUrl = new URL(req.url || "/", `http://127.0.0.1:${bridgePort}`);
  const pathname = incomingUrl.pathname.startsWith("/BabinoviFamilyBase/")
    ? incomingUrl.pathname
    : `/BabinoviFamilyBase${incomingUrl.pathname === "/" ? "" : incomingUrl.pathname}`;
  const targetPath = `${pathname}${incomingUrl.search}`;

  const proxy = http.request(
    {
      hostname: "localhost",
      port: astroPort,
      path: targetPath,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxy.on("error", () => {
    sendJson(res, 502, { error: "Astro dev server is not ready yet. Refresh in a moment." });
  });
  req.pipe(proxy);
}

const astro = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(astroPort)], {
  cwd: siteRoot,
  shell: true,
  stdio: "inherit",
});

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url?.startsWith("/api/uploads/local")) {
    void handleLocalUpload(req, res);
    return;
  }
  proxyToAstro(req, res);
});

server.listen(bridgePort, "127.0.0.1", () => {
  console.log(`Local upload dev server: http://127.0.0.1:${bridgePort}/upload`);
  console.log(`Files saved to: ${path.relative(siteRoot, intakeDir)}`);
});

function shutdown() {
  server.close();
  astro.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
