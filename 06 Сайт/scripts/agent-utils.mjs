import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const siteDir = path.resolve(scriptDir, "..");
export const repoRoot = path.resolve(siteDir, "..");

export function repoRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

export async function readJsonOrDefault(filePath, fallback) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw new Error(`${repoRelative(filePath)}: cannot read valid JSON (${error.message})`);
  }
}

export async function readJsonStrict(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${repoRelative(filePath)}: cannot read valid JSON (${error.message})`);
  }
}

export async function atomicWriteText(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fsp.writeFile(tempPath, value, "utf8");
  await fsp.rename(tempPath, filePath);
}

export async function atomicWriteJson(filePath, value) {
  await atomicWriteText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
