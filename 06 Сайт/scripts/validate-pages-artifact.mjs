import fsp from "node:fs/promises";
import path from "node:path";
import { distDocumentsDir, distEncryptedDocumentsDir, siteDir } from "./dashboard-lib.mjs";

const forbiddenExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const distDir = path.join(siteDir, "dist");
const violations = [];

async function walk(dir) {
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (forbiddenExtensions.has(path.extname(entry.name).toLowerCase())) {
      const relativePath = path.relative(distDir, fullPath).split(path.sep).join("/");
      if (relativePath.startsWith("people/")) continue;
      if (relativePath.startsWith("brand/")) continue;
      violations.push(relativePath);
    }
  }
}

await walk(distDir);

if (violations.length) {
  console.error("Pages artifact contains raw medical document assets:");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error("Production Pages builds must not publish PDF/JPG/PNG originals.");
  process.exitCode = 1;
} else {
  console.log("Pages artifact guard passed: no raw PDF/JPG/PNG documents in dist.");
}

try {
  const entries = await fsp.readdir(distDocumentsDir);
  const unexpected = entries.filter((entry) => entry !== ".gitkeep");
  if (unexpected.length) {
    console.error(`dist/files/documents contains unexpected non-document entries: ${unexpected.join(", ")}`);
    process.exitCode = 1;
  }
} catch {
  // No documents directory is the expected production state.
}

try {
  const entries = await fsp.readdir(distEncryptedDocumentsDir);
  const unexpected = entries.filter((entry) => entry !== ".gitkeep" && !entry.endsWith(".enc"));
  if (unexpected.length) {
    console.error(`dist/files/encrypted-documents contains unexpected entries: ${unexpected.join(", ")}`);
    process.exitCode = 1;
  }
} catch {
  // Encrypted documents are optional.
}
