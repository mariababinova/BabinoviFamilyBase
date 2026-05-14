import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { distEncryptedDocumentsDir, generatedDir, repoRoot, siteDir } from "./dashboard-lib.mjs";
import { readJsonStrict } from "./agent-utils.mjs";

const password = process.env.MEDS_DOCUMENTS_PASSWORD || "";
if (!password) {
  console.error("MEDS_DOCUMENTS_PASSWORD is required to publish encrypted document originals.");
  process.exit(1);
}

const cryptoConfig = await readJsonStrict(path.join(siteDir, "document-crypto.json"));
const manifest = await readJsonStrict(path.join(generatedDir, "document-manifest.json"));
const salt = Buffer.from(cryptoConfig.salt, "base64");
const iterations = Number(cryptoConfig.iterations || 210000);
const key = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
const magic = Buffer.from("MDB1");

await fsp.rm(distEncryptedDocumentsDir, { recursive: true, force: true });
await fsp.mkdir(distEncryptedDocumentsDir, { recursive: true });

for (const document of manifest) {
  if (!document.encryptedOutputFileName) continue;
  const source = path.join(repoRoot, document.originalPath);
  const original = await fsp.readFile(source);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(original), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const header = Buffer.from(
    JSON.stringify({
      v: 1,
      fileName: document.fileName,
      extension: document.extension,
      mimeType: document.mimeType,
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
  await fsp.writeFile(
    path.join(distEncryptedDocumentsDir, document.encryptedOutputFileName),
    Buffer.concat([magic, headerLength, header, encrypted]),
  );
}

await fsp.writeFile(path.join(distEncryptedDocumentsDir, ".gitkeep"), "", "utf8");
console.log(`Encrypted ${manifest.filter((document) => document.encryptedOutputFileName).length} documents.`);
