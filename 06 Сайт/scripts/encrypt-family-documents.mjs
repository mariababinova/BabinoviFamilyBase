import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { atomicWriteJson, readJsonStrict, repoRoot, siteDir } from "./agent-utils.mjs";

const documentsDirName = "\u0031\u0031 \u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b";
const familyDocumentsPath = path.join(repoRoot, documentsDirName, "family_documents.json");
const vaultManifestPath = path.join(repoRoot, documentsDirName, "family_document_vault.json");
const cryptoConfigPath = path.join(siteDir, "family-document-crypto.json");
const outputDir = path.join(siteDir, "public", "files", "family-vault");
const familyRoot = path.resolve(repoRoot, "..", "..");
const downloadsRoot = os.homedir();

function readLocalEnv() {
  const env = {};
  for (const envPath of [path.join(repoRoot, ".env"), path.join(siteDir, ".env")]) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[0].trimStart().startsWith("#")) continue;
      const [, key, rawValue] = match;
      if (process.env[key] || env[key] !== undefined) continue;
      env[key] = rawValue.replace(/^['"]|['"]$/g, "").trim();
    }
  }
  return env;
}

const localEnv = readLocalEnv();
const password =
  process.env.FAMILY_DOCUMENTS_PASSWORD ||
  localEnv.FAMILY_DOCUMENTS_PASSWORD ||
  process.env.MEDS_DOCUMENTS_PASSWORD ||
  localEnv.MEDS_DOCUMENTS_PASSWORD ||
  "";

if (!password) {
  console.error("FAMILY_DOCUMENTS_PASSWORD or MEDS_DOCUMENTS_PASSWORD is required to encrypt family documents.");
  process.exit(1);
}

function hashText(value, length = 12) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, length);
}

function mimeTypeFromExtension(extension) {
  const clean = String(extension || "").toLowerCase().replace(/^\./, "");
  if (clean === "pdf") return "application/pdf";
  if (clean === "jpg" || clean === "jpeg") return "image/jpeg";
  if (clean === "png") return "image/png";
  return "application/octet-stream";
}

function resolveSourcePath(rawSource) {
  const source = String(rawSource || "").trim();
  if (!source) return "";
  if (path.isAbsolute(source)) return source;

  const normalized = source.replace(/[\\/]+/g, path.sep);
  if (/^Downloads[\\/]/iu.test(source)) {
    return path.join(downloadsRoot, normalized);
  }
  return path.join(familyRoot, normalized);
}

function safeDisplayName(document, sourcePath, index) {
  const extension = path.extname(sourcePath).toLowerCase();
  const extLabel = extension ? extension.slice(1).toUpperCase() : "FILE";
  const title = String(document.title || document.id || "Document").trim();
  if (Number(document.file_count || 0) <= 1) return `${title}${extension}`;
  return `${title} \u00b7 ${extLabel} ${index + 1}${extension}`;
}

function encryptedFileName(document, rawSource, index, extension) {
  const hash = hashText(`${document.id}:${index}:${rawSource}`, 10);
  const ext = extension ? extension.replace(/^\./, "") : "file";
  return `${document.id}-${String(index + 1).padStart(2, "0")}-${hash}.${ext}.enc`;
}

const registry = await readJsonStrict(familyDocumentsPath);
const cryptoConfig = await readJsonStrict(cryptoConfigPath);
const salt = Buffer.from(cryptoConfig.salt, "base64");
const iterations = Number(cryptoConfig.iterations || 240000);
const key = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
const magic = Buffer.from("FDB1");
const manifestDocuments = [];
const missing = [];
let encryptedCount = 0;

await fsp.rm(outputDir, { recursive: true, force: true });
await fsp.mkdir(outputDir, { recursive: true });

for (const document of registry.documents || []) {
  const files = [];
  const sources = Array.isArray(document.source_files) ? document.source_files : [];

  for (const [index, rawSource] of sources.entries()) {
    const sourcePath = resolveSourcePath(rawSource);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      missing.push(`${document.id}#${index + 1}`);
      continue;
    }

    const extension = path.extname(sourcePath).toLowerCase();
    const displayName = safeDisplayName(document, sourcePath, index);
    const mimeType = mimeTypeFromExtension(extension);
    const outputFile = encryptedFileName(document, rawSource, index, extension);
    const original = await fsp.readFile(sourcePath);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(original), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const header = Buffer.from(
      JSON.stringify({
        v: 1,
        scope: "family-documents",
        documentId: document.id,
        fileId: `${document.id}-${index + 1}`,
        fileName: displayName,
        extension: extension.replace(/^\./, ""),
        mimeType,
        kdf: {
          name: cryptoConfig.kdf,
          hash: cryptoConfig.hash,
          iterations,
          salt: cryptoConfig.salt,
        },
        cipher: "AES-GCM",
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
      }),
      "utf8",
    );
    const headerLength = Buffer.alloc(4);
    headerLength.writeUInt32BE(header.length, 0);
    await fsp.writeFile(path.join(outputDir, outputFile), Buffer.concat([magic, headerLength, header, encrypted]));

    files.push({
      id: `${document.id}-${index + 1}`,
      display_name: displayName,
      extension: extension.replace(/^\./, ""),
      mime_type: mimeType,
      encrypted_file: outputFile,
    });
    encryptedCount += 1;
  }

  manifestDocuments.push({
    id: document.id,
    files,
  });
}

await fsp.writeFile(path.join(outputDir, ".gitkeep"), "", "utf8");
await atomicWriteJson(vaultManifestPath, {
  schema_version: 1,
  updated_at: new Date().toISOString(),
  crypto: {
    kdf: cryptoConfig.kdf,
    hash: cryptoConfig.hash,
    iterations,
    cipher: cryptoConfig.cipher,
  },
  documents: manifestDocuments,
});

if (missing.length) {
  console.error(`Family vault encryption skipped ${missing.length} missing source file(s): ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Encrypted ${encryptedCount} family document file(s).`);
}
