import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(siteDir, "..");
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));

const LEVELS = {
  REQUIRED: "required",
  OPTIONAL: "optional",
  PRODUCTION: "production-only",
};

const statusRank = {
  ok: 0,
  warn: 1,
  missing: 2,
};

function usage() {
  console.log(`Environment doctor

Usage:
  node scripts/doctor-env.mjs
  node scripts/doctor-env.mjs --strict
  node scripts/doctor-env.mjs --help

Checks:
  required         Node, npm, Git, and local project basics.
  optional         AI extraction and PDF text helper capabilities.
  production-only  Hosted API, ChatKit, site auth, and encrypted document publishing secrets.

Notes:
  Secrets are masked. Missing production-only variables do not block local ingestion.
  --strict exits with code 1 only when a required capability is missing.
`);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return true;
}

function run(command, commandArgs, options = {}) {
  const spawnCommand = options.windowsShell ? "cmd.exe" : command;
  const spawnArgs = options.windowsShell ? ["/d", "/s", "/c", [command, ...commandArgs].join(" ")] : commandArgs;
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd || siteDir,
    encoding: "utf8",
    shell: false,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return {
    ok: result.status === 0,
    status: result.status,
    output,
    error: result.error?.message || "",
    errorCode: result.error?.code || "",
  };
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/).find(Boolean) || "";
}

function mask(value) {
  const text = String(value || "");
  if (!text) return "(not set)";
  if (text.length <= 8) return `${text.slice(0, 1)}...${text.slice(-1)} (${text.length} chars)`;
  return `${text.slice(0, 4)}...${text.slice(-4)} (${text.length} chars)`;
}

function shouldMask(name) {
  return /KEY|TOKEN|PASSWORD|SECRET|WORKFLOW_ID/u.test(name);
}

function displayEnv(name, value, secret = shouldMask(name)) {
  if (!value) return "(not set)";
  return secret ? mask(value) : value;
}

function envValue(name, fallback = "") {
  return process.env[name] || fallback;
}

function add(results, level, name, ok, detail, remediation = "") {
  results.push({
    level,
    name,
    status: ok ? "ok" : level === LEVELS.REQUIRED ? "missing" : "warn",
    detail,
    remediation,
  });
}

function commandCandidates(command) {
  if (process.platform === "win32" && !/\.(cmd|exe|bat)$/iu.test(command)) {
    return [
      { command, windowsShell: false },
      { command, windowsShell: true },
    ];
  }
  return [{ command, windowsShell: false }];
}

function checkCommand(results, level, name, command, commandArgs, parse = firstLine) {
  let result = null;
  let resolvedCommand = command;
  for (const candidate of commandCandidates(command)) {
    result = run(candidate.command, commandArgs, { windowsShell: candidate.windowsShell });
    resolvedCommand = candidate.command;
    if (result.ok || result.errorCode !== "ENOENT") break;
  }
  add(
    results,
    level,
    name,
    result.ok,
    result.ok ? parse(result.output) : result.error || firstLine(result.output) || `${command} not found`,
    `Install ${resolvedCommand} and make sure it is on PATH.`,
  );
}

function checkPython(results) {
  const candidates = [
    ["python", ["--version"]],
    ["py", ["-3", "--version"]],
    ["python3", ["--version"]],
  ];

  let selected = null;
  for (const [command, commandArgs] of candidates) {
    const result = run(command, commandArgs);
    if (result.ok) {
      selected = { command, commandArgs, version: firstLine(result.output) };
      break;
    }
  }

  add(
    results,
    LEVELS.OPTIONAL,
    "Python",
    Boolean(selected),
    selected ? `${selected.command}: ${selected.version}` : "not found",
    "Install Python if PDF metric reference enrichment is needed.",
  );

  if (!selected) {
    add(
      results,
      LEVELS.OPTIONAL,
      "PyMuPDF",
      false,
      "not checked because Python is unavailable",
      "Install with: python -m pip install PyMuPDF",
    );
    return;
  }

  const importArgs =
    selected.command === "py"
      ? ["-3", "-c", "import fitz; print(fitz.__doc__.splitlines()[0] if fitz.__doc__ else 'PyMuPDF available')"]
      : ["-c", "import fitz; print(fitz.__doc__.splitlines()[0] if fitz.__doc__ else 'PyMuPDF available')"];
  const fitz = run(selected.command, importArgs);
  add(
    results,
    LEVELS.OPTIONAL,
    "PyMuPDF",
    fitz.ok,
    fitz.ok ? firstLine(fitz.output) : firstLine(fitz.output) || "fitz module not importable",
    "Install with: python -m pip install PyMuPDF",
  );
}

function checkEnv(results, level, name, label, options = {}) {
  const value = envValue(name, options.defaultValue || "");
  const ok = options.required === false ? true : Boolean(value);
  const rendered = displayEnv(name, value, options.secret);
  const suffix = options.defaultValue && !process.env[name] ? ` default: ${options.defaultValue}` : "";
  add(results, level, label || name, ok, `${name}=${rendered}${suffix}`, options.remediation || `Set ${name}.`);
}

function groupResults(results) {
  return [LEVELS.REQUIRED, LEVELS.OPTIONAL, LEVELS.PRODUCTION].map((level) => ({
    level,
    rows: results
      .filter((result) => result.level === level)
      .sort((a, b) => statusRank[b.status] - statusRank[a.status] || a.name.localeCompare(b.name)),
  }));
}

function printRow(row) {
  const marker = row.status === "ok" ? "OK" : row.status === "missing" ? "MISSING" : "WARN";
  console.log(`  [${marker}] ${row.name}: ${row.detail}`);
  if (row.status !== "ok" && row.remediation) console.log(`        ${row.remediation}`);
}

function main() {
  if (flags.has("--help") || flags.has("-h")) {
    usage();
    return;
  }

  const loadedEnvFiles = [
    [path.join(repoRoot, ".env"), loadEnvFile(path.join(repoRoot, ".env"))],
    [path.join(siteDir, ".env"), loadEnvFile(path.join(siteDir, ".env"))],
  ];

  const results = [];
  checkCommand(results, LEVELS.REQUIRED, "Node.js", "node", ["--version"]);
  checkCommand(results, LEVELS.REQUIRED, "npm", "npm", ["--version"], (output) => `npm ${firstLine(output)}`);
  checkCommand(results, LEVELS.REQUIRED, "Git", "git", ["--version"]);
  add(results, LEVELS.REQUIRED, "Site directory", fs.existsSync(siteDir), siteDir, "Run from the 06 Сайт workspace.");
  add(
    results,
    LEVELS.REQUIRED,
    "package.json",
    fs.existsSync(path.join(siteDir, "package.json")),
    path.join(siteDir, "package.json"),
    "Restore 06 Сайт/package.json.",
  );

  checkEnv(results, LEVELS.OPTIONAL, "OPENAI_API_KEY", "OpenAI API key", {
    remediation: "Set OPENAI_API_KEY for AI PDF/image ingestion and ChatKit.",
  });
  checkEnv(results, LEVELS.OPTIONAL, "OPENAI_MODEL", "OpenAI model", {
    defaultValue: "gpt-4o-mini",
    required: false,
    remediation: "Set OPENAI_MODEL to override the intake default.",
  });
  checkPython(results);

  checkEnv(results, LEVELS.PRODUCTION, "MEDS_GITHUB_TOKEN", "GitHub write token", {
    remediation: "Set MEDS_GITHUB_TOKEN only in trusted local or Vercel server environments.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "MEDS_GITHUB_REPO", "GitHub repo", {
    defaultValue: "Ulyana19svlv/MedsDataBase",
    required: false,
  });
  checkEnv(results, LEVELS.PRODUCTION, "MEDS_GITHUB_BRANCH", "GitHub branch", {
    defaultValue: "main",
    required: false,
  });
  checkEnv(results, LEVELS.PRODUCTION, "VERCEL", "Vercel runtime flag", {
    remediation: "Vercel sets VERCEL automatically during hosted builds/functions.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "PUBLIC_SITE_URL", "Public site URL", {
    required: false,
    remediation: "Set PUBLIC_SITE_URL when hosted URL differs from defaults.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "PUBLIC_BASE_PATH", "Public base path", {
    required: false,
    remediation: "Set PUBLIC_BASE_PATH for non-root static hosting.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "OPENAI_CHATKIT_WORKFLOW_ID", "ChatKit workflow", {
    remediation: "Set OPENAI_CHATKIT_WORKFLOW_ID for /api/chatkit/session.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "CHATKIT_ALLOWED_ORIGIN", "ChatKit allowed origin", {
    defaultValue: "*",
    required: false,
  });
  checkEnv(results, LEVELS.PRODUCTION, "SITE_AUTH_USERNAME", "Site auth username", {
    remediation: "Set SITE_AUTH_USERNAME with SITE_AUTH_PASSWORD to enable basic auth.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "SITE_AUTH_PASSWORD", "Site auth password", {
    remediation: "Set SITE_AUTH_PASSWORD with SITE_AUTH_USERNAME to enable basic auth.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "MEDS_ENCRYPTED_DOCUMENTS", "Encrypted documents build flag", {
    required: false,
    remediation: "Set MEDS_ENCRYPTED_DOCUMENTS=1 when publishing encrypted originals.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "MEDS_DOCUMENTS_PASSWORD", "Document encryption password", {
    remediation: "Set MEDS_DOCUMENTS_PASSWORD only when running build:encrypted-documents.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "MEDS_PUBLIC_DOCUMENTS", "Public raw documents flag", {
    required: false,
    remediation: "Keep unset unless intentionally exposing raw document files.",
  });
  checkEnv(results, LEVELS.PRODUCTION, "MEDS_ALLOW_DIST_DOCUMENTS", "Raw document copy override", {
    required: false,
    remediation: "Use only for private/local builds that intentionally copy raw documents.",
  });

  console.log("Environment doctor");
  console.log(`Workspace: ${siteDir}`);
  console.log(
    `Loaded env files: ${
      loadedEnvFiles
        .filter(([, loaded]) => loaded)
        .map(([filePath]) => path.relative(repoRoot, filePath).split(path.sep).join("/"))
        .join(", ") || "none"
    }`,
  );

  for (const group of groupResults(results)) {
    console.log(`\n${group.level}:`);
    for (const row of group.rows) printRow(row);
  }

  const missingRequired = results.filter((result) => result.level === LEVELS.REQUIRED && result.status !== "ok");
  const warnings = results.filter((result) => result.level !== LEVELS.REQUIRED && result.status !== "ok");

  console.log("\nSummary:");
  console.log(`  Required blockers: ${missingRequired.length}`);
  console.log(`  Optional/production warnings: ${warnings.length}`);
  console.log("  Local ingestion is not blocked by missing production-only variables.");

  if (flags.has("--strict") && missingRequired.length > 0) {
    process.exitCode = 1;
  }
}

main();
