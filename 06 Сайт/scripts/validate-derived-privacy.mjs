import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { repoRelative, siteDir } from "./dashboard-lib.mjs";

const distDir = path.join(siteDir, "dist");
const generatedDir = path.join(siteDir, "src", "generated");
const targets = [distDir, generatedDir].filter((dir) => fs.existsSync(dir));
const forbiddenPatterns = [
  /OPENAI_API_KEY|MEDS_GITHUB_TOKEN|SITE_AUTH_PASSWORD|MEDS_DOCUMENTS_PASSWORD/iu,
];
const rawExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"]);

async function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(fullPath, output);
    else output.push(fullPath);
  }
  return output;
}

const findings = [];
for (const target of targets) {
  for (const filePath of await walk(target)) {
    const ext = path.extname(filePath).toLowerCase();
    const publicRelative = repoRelative(filePath).replace(/\\/g, "/");
    const isPublicDocument = /\/documents\//u.test(publicRelative) || /\/assets\/documents\//u.test(publicRelative);
    if (filePath.startsWith(distDir) && rawExtensions.has(ext) && isPublicDocument) {
      findings.push(`${repoRelative(filePath)}: raw document-like asset in public artifact`);
      continue;
    }
    if (![".html", ".json", ".js", ".css", ".txt", ".xml"].includes(ext)) continue;
    const text = await fsp.readFile(filePath, "utf8").catch(() => "");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) findings.push(`${repoRelative(filePath)}: forbidden derived text matched ${pattern}`);
    }
  }
}

if (findings.length) {
  console.error(`Derived privacy validation failed: ${findings.length} finding(s).`);
  for (const finding of findings.slice(0, 50)) console.error(`- ${finding}`);
  if (findings.length > 50) console.error(`...and ${findings.length - 50} more.`);
  process.exitCode = 1;
} else {
  console.log(`Derived privacy validation passed for ${targets.map((target) => repoRelative(target)).join(", ") || "no targets"}.`);
}
