import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { atomicWriteJson, readJsonOrDefault, readJsonStrict } from "./agent-utils.mjs";

export const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(siteDir, "..");
export const membersDir = path.join(repoRoot, "01 Члены семьи");
export const inboxDir = path.join(repoRoot, "04 Входящие");
export const metricsFilePath = path.join(repoRoot, "07 Показатели", "metrics.json");
export const tasksFilePath = path.join(repoRoot, "08 Задачи", "tasks.json");
export const taskCandidatesFilePath = path.join(repoRoot, "08 Задачи", "task_candidates.json");
export const watchlistFilePath = path.join(repoRoot, "09 Наблюдение", "watchlist.json");
export const doctorSummariesFilePath = path.join(repoRoot, "09 Наблюдение", "doctor-summaries.json");
export const generatedDir = path.join(siteDir, "src", "generated");
export const publicDocumentsDir = path.join(siteDir, "public", "files", "documents");
export const distDocumentsDir = path.join(siteDir, "dist", "files", "documents");
export const distEncryptedDocumentsDir = path.join(siteDir, "dist", "files", "encrypted-documents");
export const basePath = process.env.PUBLIC_BASE_PATH ?? (process.env.VERCEL ? "" : "/MedsDataBase");

const assetExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const documentPublishEnabled =
  process.env.MEDS_PUBLIC_DOCUMENTS === "1" || process.env.MEDS_PUBLIC_DOCUMENTS === "true";
const encryptedDocumentPublishEnabled =
  process.env.MEDS_ENCRYPTED_DOCUMENTS === "1" || process.env.MEDS_ENCRYPTED_DOCUMENTS === "true";

const translit = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function repoRelative(filePath) {
  return toPosixPath(path.relative(repoRoot, filePath));
}

export function hashText(value, length = 10) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, length);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isOpenOverdueTask(task, today = todayIso()) {
  return task?.status !== "done" && Boolean(task?.dueDate) && String(task.dueDate) < today;
}

export function slugify(value, fallback = "item") {
  const source = String(value ?? "").toLowerCase();
  let out = "";
  for (const char of source) {
    if (translit[char] !== undefined) {
      out += translit[char];
    } else if (/[a-z0-9]/.test(char)) {
      out += char;
    } else {
      out += "-";
    }
  }
  out = out.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return out || fallback;
}

export function isValidSlug(value) {
  return /^[a-z0-9][a-z0-9-]*$/.test(String(value ?? ""));
}

export function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\\/]+/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function stripMarkdown(value) {
  return String(value ?? "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function arrayValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)].filter(Boolean);
}

export function isoDateFromText(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return validIsoDate(iso[1], iso[2], iso[3]);
  const ru = text.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  if (ru) return validIsoDate(ru[3], ru[2], ru[1]);
  return undefined;
}

function validIsoDate(year, month, day) {
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }
  return iso;
}

function addBase(routePath) {
  if (!routePath) return basePath;
  if (/^https?:\/\//.test(routePath)) return routePath;
  const clean = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${basePath}${clean}`;
}

function cleanTaskText(value) {
  const text = stripMarkdown(value);
  if (!text || text === "-" || text === "—" || /^[-—\s]+$/.test(text)) return "";
  if (/^(артём|маша|ника)$/i.test(text)) return "";
  return text;
}

function inferSpecialtyFromPath(filePath) {
  if (!filePath.startsWith(membersDir)) return "";
  const relative = path.relative(membersDir, filePath).split(path.sep);
  const specialtyDir = relative[1] || "";
  return specialtyDir.replace(/^\d+\s+/, "").trim();
}

export function firstHeading(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return stripMarkdown(match?.[1] || fallback);
}

export function parseSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = new Map();
  let current = "";
  let bucket = [];

  function flush() {
    if (!current) return;
    sections.set(current, bucket.join("\n").trim());
  }

  for (const line of lines) {
    const anyHeading = line.match(/^(#{1,6})\s+(.+)$/);
    if (anyHeading && anyHeading[1].length === 1 && current) {
      flush();
      current = "";
      bucket = [];
      continue;
    }
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flush();
      current = stripMarkdown(heading[1]);
      bucket = [];
    } else if (current) {
      bucket.push(line);
    }
  }
  flush();

  return sections;
}

export function sectionList(sections, name) {
  const text = sections.get(name) || "";
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    const bullet = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      const item = stripMarkdown(bullet[1]);
      if (item) items.push(item);
    }
  }
  if (items.length) return items;

  const plain = stripMarkdown(text);
  return plain ? [plain] : [];
}

function cleanList(items) {
  return arrayValue(items).map(cleanTaskText).filter(Boolean);
}

export function sectionText(sections, name) {
  return stripMarkdown(sections.get(name) || "");
}

export function parseKeyValueList(sections, name) {
  const result = {};
  for (const item of sectionList(sections, name)) {
    const match = item.match(/^([^:]+):\s*(.*)$/);
    if (match) result[match[1].trim()] = match[2].trim();
  }
  return result;
}

async function walk(dir, predicate, output = []) {
  if (!fs.existsSync(dir)) return output;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "dist", ".astro", ".next", "out"].includes(entry.name)) continue;
      await walk(fullPath, predicate, output);
    } else if (!predicate || predicate(fullPath)) {
      output.push(fullPath);
    }
  }
  return output;
}

export async function findMarkdownFiles() {
  return walk(membersDir, (filePath) => path.extname(filePath).toLowerCase() === ".md");
}

export async function findAssetFiles({ includeInbox = false } = {}) {
  const files = await walk(membersDir, (filePath) => assetExtensions.has(path.extname(filePath).toLowerCase()));
  if (includeInbox) {
    await walk(inboxDir, (filePath) => assetExtensions.has(path.extname(filePath).toLowerCase()), files);
  }
  return files;
}

export async function readMarkdown(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  const parsed = matter(raw);
  return {
    data: parsed.data || {},
    body: parsed.content || "",
    raw,
  };
}

function memberNameFromPath(filePath) {
  const relative = path.relative(membersDir, filePath);
  return relative.split(path.sep)[0];
}

function memberRootForName(name) {
  return path.join(membersDir, name);
}

function documentOutputName(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  const base = path.basename(relativePath, ext);
  return `${hashText(relativePath)}-${slugify(base, "document")}${ext}`;
}

function cleanDocumentDisplayName(fileName) {
  return String(fileName || "").replace(/\s+Доктор\s*3(?=\.[^.]+$)/iu, "");
}

function mimeTypeFromExtension(extension) {
  const clean = String(extension || "").toLowerCase().replace(/^\./, "");
  if (clean === "pdf") return "application/pdf";
  if (clean === "jpg" || clean === "jpeg") return "image/jpeg";
  if (clean === "png") return "image/png";
  return "application/octet-stream";
}

function documentFromPath(filePath, { isInboxItem = false, publicDocuments = documentPublishEnabled } = {}) {
  const relativePath = repoRelative(filePath);
  const outputFileName = documentOutputName(relativePath);
  const encryptedOutputFileName = `${outputFileName}.enc`;
  const fileName = path.basename(filePath);
  const displayName = cleanDocumentDisplayName(fileName);
  const person = filePath.startsWith(membersDir) ? memberNameFromPath(filePath) : undefined;
  const inferredDate = isoDateFromText(path.basename(filePath)) || isoDateFromText(relativePath);
  const specialty = inferSpecialtyFromPath(filePath);
  const slug = slugify(`${path.basename(displayName, path.extname(displayName))}-${hashText(relativePath, 8)}`, `document-${hashText(relativePath, 8)}`);
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return {
    id: hashText(relativePath, 16),
    slug,
    fileName,
    displayName,
    originalPath: relativePath,
    routePath: `/documents/${slug}`,
    href: addBase(`/documents/${slug}`),
    outputFileName,
    publicUrl: publicDocuments ? `${basePath}/files/documents/${outputFileName}` : "",
    encryptedOutputFileName,
    encryptedUrl: encryptedDocumentPublishEnabled ? `${basePath}/files/encrypted-documents/${encryptedOutputFileName}` : "",
    isOriginalPublic: Boolean(publicDocuments),
    isOriginalEncrypted: Boolean(encryptedDocumentPublishEnabled),
    extension,
    mimeType: mimeTypeFromExtension(extension),
    person,
    eventId: undefined,
    eventSlug: undefined,
    specialty,
    specialtyId: slugify(specialty || "unknown"),
    date: inferredDate,
    isLinkedToEvent: false,
    linkStatus: "document_only",
    linkStatusLabel: "Нет описания события",
    isInboxItem,
    size: fs.statSync(filePath).size,
  };
}

function documentForEvent(document, event) {
  return {
    ...document,
    person: event.person,
    eventId: event.id,
    eventSlug: event.slug,
    eventHref: event.href,
    specialty: event.specialty,
    specialtyId: event.specialtyId,
    date: event.date,
    displayName: cleanDocumentDisplayName(document.displayName || document.fileName),
    isLinkedToEvent: true,
    linkStatus: "linked",
    linkStatusLabel: "Привязан к записи",
  };
}

function createIssue(severity, entityType, message, extra = {}) {
  return {
    id: hashText(`${severity}:${entityType}:${message}:${extra.entityPath || ""}`, 12),
    severity,
    entityType,
    message,
    ...extra,
  };
}

function nearestYearDir(eventDir) {
  let current = eventDir;
  for (let i = 0; i < 4; i += 1) {
    if (/20\d{2}/.test(path.basename(current))) return current;
    current = path.dirname(current);
  }
  return path.dirname(eventDir);
}

function resolveSourceFile(rawSource, event, documents, issues) {
  const raw = String(rawSource || "").trim();
  if (!raw) return undefined;

  const eventDir = path.dirname(path.join(repoRoot, event.markdownPath));
  const personRoot = memberRootForName(event.person);
  const normalizedRaw = normalizeName(path.basename(raw));
  const hasExplicitPath = /[\\/]/.test(raw);

  if (hasExplicitPath) {
    const explicit = path.resolve(eventDir, raw);
    const relative = repoRelative(explicit);
    const doc = documents.find((candidate) => candidate.originalPath === relative);
    if (doc) return doc;
    issues.push(
      createIssue("warn", "document", `Явный путь из source_files не найден: ${raw}`, {
        entityPath: event.markdownPath,
        suggestedFix: "Проверьте путь относительно заметки события. Для явных путей автоподбор по имени файла не используется.",
      }),
    );
    return undefined;
  }

  const exactDirMatches = (dir) =>
    documents.filter((candidate) => {
      const candidatePath = path.join(repoRoot, candidate.originalPath);
      return path.dirname(candidatePath) === dir && normalizeName(candidate.fileName) === normalizedRaw;
    });

  const branchMatches = (dir) =>
    documents.filter((candidate) => {
      const candidatePath = path.join(repoRoot, candidate.originalPath);
      return candidatePath.startsWith(dir + path.sep) && normalizeName(candidate.fileName) === normalizedRaw;
    });

  const searchSteps = [
    exactDirMatches(eventDir),
    branchMatches(nearestYearDir(eventDir)),
    branchMatches(personRoot),
  ];

  for (const matches of searchSteps) {
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      issues.push(
        createIssue("warn", "document", `Несколько документов подходят для source_files: ${raw}`, {
          entityPath: event.markdownPath,
          suggestedFix: "Укажите относительный путь к документу в source_files.",
        }),
      );
      return undefined;
    }
  }

  const globalMatches = documents.filter((candidate) => normalizeName(candidate.fileName) === normalizedRaw);
  if (globalMatches.length === 1) {
    const candidatePath = path.join(repoRoot, globalMatches[0].originalPath);
    if (!candidatePath.startsWith(personRoot + path.sep)) {
      issues.push(
        createIssue("warn", "document", `source_files нашёл файл вне ветки человека и не был привязан: ${raw}`, {
          entityPath: event.markdownPath,
          suggestedFix: "Укажите явный относительный путь или переместите документ в папку события.",
        }),
      );
      return undefined;
    }
    return globalMatches[0];
  }

  if (globalMatches.length > 1) {
    issues.push(
      createIssue("warn", "document", `Глобальный поиск source_files неоднозначен: ${raw}`, {
        entityPath: event.markdownPath,
        suggestedFix: "Укажите относительный путь к документу в source_files.",
      }),
    );
    return undefined;
  }

  issues.push(
    createIssue("warn", "document", `Файл из source_files не найден: ${raw}`, {
      entityPath: event.markdownPath,
    }),
  );
  return undefined;
}

function normalizeProfile(filePath, data, body) {
  const sections = parseSections(body);
  const info = parseKeyValueList(sections, "Основная информация");
  const important = parseKeyValueList(sections, "Важное");
  const person = data.person || memberNameFromPath(filePath);
  const id = data.id || `profile-${slugify(person)}`;
  const birthDate = isoDateFromText(info["Дата рождения"]);

  return {
    id,
    slug: slugify(person, `person-${hashText(person, 6)}`),
    name: person,
    routePath: `/people/${slugify(person, `person-${hashText(person, 6)}`)}`,
    href: addBase(`/people/${slugify(person, `person-${hashText(person, 6)}`)}`),
    photo: data.photo || "",
    profilePath: repoRelative(filePath),
    birthDate,
    birthDateText: info["Дата рождения"] || "",
    bloodType: info["Группа крови"] || "",
    rhFactor: info["Резус-фактор"] || "",
    allergies: important["Аллергии"] ? [important["Аллергии"]] : [],
    chronicConditions: important["Хронические заболевания"] ? [important["Хронические заболевания"]] : [],
    currentMedications: important["Текущие препараты"] ? [important["Текущие препараты"]] : [],
    currentTreatments: important["Текущие курсы лечения"] ? [important["Текущие курсы лечения"]] : [],
    importantStatus: important["Беременность / важный статус"] || "",
    recentImportantEvents: sectionList(sections, "Последние важные события"),
    profileTasks: sectionList(sections, "Ближайшие задачи"),
    eventCount: 0,
    documentCount: 0,
    nextTasks: [],
    dataWarnings: [],
  };
}

function normalizeEvent(filePath, data, body, idCounts, issues) {
  const markdownPath = repoRelative(filePath);
  const person = data.person || memberNameFromPath(filePath);
  const eventDate = isoDateFromText(data.date);
  const rawId = String(data.id || "");

  if (!person) {
    issues.push(createIssue("skip", "event", "Событие без person пропущено.", { entityPath: markdownPath }));
    return undefined;
  }
  if (!eventDate) {
    issues.push(createIssue("skip", "event", "Событие без валидной date пропущено.", { entityPath: markdownPath }));
    return undefined;
  }

  let id = rawId;
  if (!id || id === "null") {
    id = `event-${hashText(markdownPath, 12)}`;
    issues.push(
      createIssue("warn", "event", "Событие без id получило fallback slug.", {
        entityPath: markdownPath,
      }),
    );
  }

  idCounts.set(id, (idCounts.get(id) || 0) + 1);

  const sections = parseSections(body);
  const title = firstHeading(body, path.basename(filePath, ".md"));
  const eventType = String(data.event_type || "Событие");
  const specialty = String(data.specialty || data.doctor_group || "Не указано");
  const followUpDate = isoDateFromText(data.follow_up_date);
  const slug = isValidSlug(id) ? id : slugify(`${eventDate}-${person}-${title}-${hashText(markdownPath, 6)}`);
  const canonicalType = canonicalEventType(eventType);
  const specialtyId = slugify(specialty, "unknown");

  return {
    id,
    slug,
    routePath: `/events/${slug}`,
    href: addBase(`/events/${slug}`),
    title,
    person,
    personSlug: slugify(person),
    date: eventDate,
    year: eventDate.slice(0, 4),
    eventType,
    eventTypeId: canonicalType.eventTypeId,
    eventTypeLabel: canonicalType.eventTypeLabel,
    sourceEventType: eventType,
    specialty,
    specialtyId,
    specialtyLabel: specialty,
    doctor: data.doctor && data.doctor !== "null" ? String(data.doctor) : "",
    clinic: data.clinic && data.clinic !== "null" ? String(data.clinic) : "",
    status: String(data.status || "done"),
    importance: ["low", "normal", "high", "critical"].includes(data.importance) ? data.importance : "normal",
    followUpDate,
    sourceFileNames: arrayValue(data.source_files),
    sourceFiles: [],
    tags: arrayValue(data.tags),
    summary: cleanList(sectionList(sections, "Краткий итог")),
    track: cleanList(sectionList(sections, "Что важно отследить")),
    nextActions: cleanList(sectionList(sections, "Что делать дальше")),
    prescriptions: cleanList(sectionList(sections, "Назначения")),
    markdownPath,
    folderPath: repoRelative(path.dirname(filePath)),
    searchableText: stripMarkdown(
      [
        title,
        person,
        eventType,
        specialty,
        data.doctor,
        data.clinic,
        sectionText(sections, "Краткий итог"),
        sectionText(sections, "Что важно отследить"),
        sectionText(sections, "Что делать дальше"),
        sectionText(sections, "Назначения"),
        sectionText(sections, "Контроль в июле"),
        sectionText(sections, "Планово"),
      ].join(" "),
    ),
    dataWarnings: [],
  };
}

function buildTaskFromEvent(event) {
  if (!event.followUpDate) return undefined;
  if (event.followUpDate < todayIso()) return undefined;
  const actionText = event.followUpAction || `Контроль: ${event.specialty}`;
  return {
    id: `task-${event.slug}-${event.followUpDate}`,
    person: event.person,
    personSlug: event.personSlug,
    href: event.href,
    dueDate: event.followUpDate,
    specialty: event.specialty,
    specialtyId: event.specialtyId,
    sourceType: "event",
    sourceEventId: event.id,
    sourceEventSlug: event.slug,
    sourcePath: event.routePath,
    sourceHref: event.href,
    sourceTitle: event.title,
    title: actionText,
    stateBucket: "computed_on_client",
    statusLabel: "Рассчитывается по текущей дате",
    actionText,
  };
}

function deriveFollowUpAction(event) {
  const candidates = [...event.nextActions, ...event.track]
    .map((item) => ({ item, score: followUpScore(item) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
  if (candidates[0]) {
    return candidates[0].item;
  }
  return `Контроль: ${event.specialty}`;
}

function followUpScore(value) {
  const text = String(value || "").toLowerCase();
  let score = 0;
  if (/контрольн|контроль\s|повторн|чек-ап|чекап|следующ|через\s+\d|в\s+июле|середине\s+мая/.test(text)) score += 10;
  if (/анализ|узи|обследован|осмотр|консультац|тестирован/.test(text)) score += 5;
  if (/при[её]м/.test(text)) score += 1;
  if (/витамин|омега|подмывание|мирамистин|мазь|пить|соблюдать/.test(text)) score -= 5;
  return score;
}

function buildProfileTasks(profile) {
  return cleanList(profile.profileTasks).map((task, index) => ({
    id: `task-${profile.slug}-profile-${index}`,
    person: profile.name,
    personSlug: profile.slug,
    href: profile.href,
    dueDate: undefined,
    specialty: "Профиль",
    specialtyId: "profile",
    sourceType: "profile",
    sourcePath: profile.routePath,
    sourceHref: profile.href,
    sourceTitle: `Профиль — ${profile.name}`,
    title: task,
    stateBucket: "unknown",
    statusLabel: "Без даты",
    actionText: task,
  }));
}

function buildSearchItems({ people, events, documents, tasks, doctorSummaries }) {
  return [
    ...people.map((person) => ({
      type: "person",
      id: person.id,
      person: person.name,
      personSlug: person.slug,
      title: person.name,
      routePath: person.routePath,
      href: person.href,
      subtitle: "Профиль",
      text: stripMarkdown(
        [
          person.name,
          person.birthDateText,
          person.allergies?.join(" "),
          person.chronicConditions?.join(" "),
          person.currentMedications?.join(" "),
          person.currentTreatments?.join(" "),
          person.importantStatus,
        ].join(" "),
      ),
    })),
    ...events.map((event) => ({
      type: "event",
      id: event.id,
      person: event.person,
      personSlug: event.personSlug,
      date: event.date,
      specialty: event.specialty,
      specialtyId: event.specialtyId,
      eventType: event.eventType,
      eventTypeId: event.eventTypeId,
      title: event.title,
      routePath: event.routePath,
      href: event.href,
      subtitle: `${event.date} · ${event.person} · ${event.specialty}`,
      text: event.searchableText,
    })),
    ...documents.map((document) => ({
      type: "document",
      id: document.id,
      person: document.person,
      personSlug: document.person ? slugify(document.person) : undefined,
      date: document.date,
      specialty: document.specialty,
      specialtyId: document.specialtyId,
      extension: document.extension,
      linkStatus: document.linkStatus,
      linkStatusLabel: document.linkStatusLabel,
      title: document.displayName || document.fileName,
      routePath: document.routePath,
      href: document.href,
      subtitle: [document.person, document.date, document.specialty].filter(Boolean).join(" · "),
      text: stripMarkdown(`${document.displayName || document.fileName} ${document.person || ""} ${document.specialty || ""}`),
    })),
    ...tasks.map((task) => ({
      type: "task",
      id: task.id,
      person: task.person,
      personSlug: task.personSlug,
      date: task.dueDate,
      dueDate: task.dueDate,
      specialty: task.specialty,
      specialtyId: task.specialtyId,
      title: task.actionText,
      routePath: task.routePath || task.sourcePath,
      href: task.href || task.sourceHref,
      subtitle: [task.person, task.dueDate || "Без даты"].filter(Boolean).join(" · "),
      text: stripMarkdown(`${task.actionText} ${task.person} ${task.specialty}`),
    })),
    ...(doctorSummaries?.records || []).map((summary) => ({
      type: "doctor-summary",
      id: summary.id,
      person: summary.person,
      personSlug: summary.personSlug,
      date: summary.latestEventDate,
      specialty: summary.specialty,
      title: summary.title,
      routePath: summary.routePath,
      href: summary.href,
      subtitle: [summary.person, summary.specialty, "Сводка врачу"].filter(Boolean).join(" · "),
      text: stripMarkdown(
        [
          summary.title,
          summary.person,
          summary.specialty,
          ...(summary.profileContext || []),
          ...(summary.summary || []),
          ...(summary.track || []),
          ...(summary.nextActions || []),
        ].join(" "),
      ),
    })),
  ];
}

async function readMetricsFile() {
  const parsed = await readJsonOrDefault(metricsFilePath, { records: [] });
  return Array.isArray(parsed.records) ? parsed.records : [];
}

async function readTasksFile() {
  const parsed = await readJsonOrDefault(tasksFilePath, { records: [] });
  return Array.isArray(parsed.records) ? parsed.records : [];
}

async function readTaskCandidatesFile() {
  const parsed = await readJsonOrDefault(taskCandidatesFilePath, { records: [] });
  return {
    updatedAt: parsed.updated_at || parsed.updatedAt || "",
    records: Array.isArray(parsed.records) ? parsed.records : [],
  };
}

async function readWatchlistFile() {
  const parsed = await readJsonOrDefault(watchlistFilePath, { records: [], attention_zones: [] });
  return {
    generatedAt: parsed.generated_at || parsed.generatedAt,
    records: Array.isArray(parsed.records) ? parsed.records : [],
    attentionZones: Array.isArray(parsed.attention_zones) ? parsed.attention_zones : [],
  };
}

async function readDoctorSummariesFile() {
  const parsed = await readJsonOrDefault(doctorSummariesFilePath, { records: [] });
  return {
    generatedAt: parsed.generated_at || parsed.generatedAt,
    records: Array.isArray(parsed.records) ? parsed.records : [],
  };
}

function normalizeTaskRecord(record, eventsById, profilesByPerson, issues) {
  if (record.status && ["done", "cancelled", "rejected"].includes(String(record.status))) return undefined;

  const event = record.source_event_id ? eventsById.get(record.source_event_id) : undefined;
  const person = record.person || event?.person || "";
  const profile = person ? profilesByPerson.get(person) : undefined;
  const dueDate = isoDateFromText(record.due_date || record.dueDate);
  const actionText = cleanTaskText(record.action_text || record.title || record.source_text);
  const groupedSourceEventIds = Array.isArray(record.grouped_source_event_ids) ? record.grouped_source_event_ids : [];
  const items = Array.isArray(record.items)
    ? record.items
        .map((item) => ({
          title: cleanTaskText(item.title || item.action_text || item.source_text),
          specialty: item.specialty || "",
          specialtyId: item.specialty_id || slugify(item.specialty || "control"),
          sourceEventId: item.source_event_id || "",
        }))
        .filter((item) => item.title)
    : [];
  const id = String(record.id || `task-${hashText(actionText, 12)}`);
  const isGroupedTask = record.kind === "grouped_task" || record.task_page === true || groupedSourceEventIds.length > 1 || items.length > 1;
  const taskRoutePath = isGroupedTask ? `/tasks/${slugify(id.replace(/^task-/, ""), id)}` : event?.routePath || record.source_path || profile?.routePath || "/tasks";

  if (!actionText) {
    issues.push(
      createIssue("warn", "task", "Задача без action_text/title пропущена.", {
        entityPath: "08 Задачи/tasks.json",
      }),
    );
    return undefined;
  }

  return {
    id,
    slug: slugify(id.replace(/^task-/, ""), id),
    kind: record.kind || (isGroupedTask ? "grouped_task" : "single_task"),
    taskPage: isGroupedTask,
    person,
    personSlug: profile?.slug || slugify(person || record.person_id || "unknown"),
    href: addBase(taskRoutePath),
    routePath: taskRoutePath,
    dueDate,
    specialty: record.specialty || event?.specialty || "Контроль",
    specialtyId: record.specialty_id || event?.specialtyId || slugify(record.specialty || "control"),
    sourceType: record.source_type || (event ? "event" : "manual"),
    sourceEventId: event?.id || record.source_event_id || "",
    sourceEventSlug: event?.slug,
    sourcePath: event?.routePath || record.source_path || profile?.routePath || "/tasks",
    sourceHref: event?.href || profile?.href || addBase("/tasks"),
    sourceTitle: event?.title || record.source_title || "Задача контроля",
    title: actionText,
    priority: record.priority || "medium",
    status: record.status || "open",
    stateBucket: "computed_on_client",
    statusLabel: "Рассчитывается по текущей дате",
    actionText,
    items,
    groupedFrom: Array.isArray(record.grouped_from) ? record.grouped_from : [],
    groupedSourceEventIds,
  };
}

function displayMetricValue(record) {
  const value = record.value_text || record.value || record.qualitative_value || "";
  return [record.comparator, value, record.unit].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function normalizeMetricRecord(record, eventsById) {
  const event = record.source_event_id ? eventsById.get(record.source_event_id) : undefined;
  return {
    ...record,
    displayValue: displayMetricValue(record),
    numeric_value: typeof record.numeric_value === "number" ? record.numeric_value : null,
    is_abnormal: record.is_abnormal === true,
    eventHref: event?.href,
    eventTitle: event?.title,
    eventSlug: event?.slug,
  };
}

function metricTrend(delta) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return { trendLabel: "", trendTone: "flat" };
  }
  const rounded = Math.round(delta * 100) / 100;
  if (rounded > 0) return { trendLabel: `выше прошлого на ${rounded}`, trendTone: "up" };
  if (rounded < 0) return { trendLabel: `ниже прошлого на ${Math.abs(rounded)}`, trendTone: "down" };
  return { trendLabel: "без изменений", trendTone: "flat" };
}

function doctorQuestionsForMetric(group, latest, previous) {
  const questions = [];
  if (latest?.is_abnormal) {
    questions.push("Обсудить, насколько это отклонение важно именно в текущем контексте и нужен ли контроль.");
  }
  if (previous && group.hasTrend) {
    questions.push("Уточнить, важна ли динамика между последними анализами и когда повторять показатель.");
  }
  if (latest && !latest.reference_text) {
    questions.push("Уточнить целевой диапазон для этого показателя, потому что в записи нет референса.");
  }
  return questions;
}

const keyMetricIds = new Set([
  "weight",
  "hemoglobin",
  "ferritin",
  "vitamin_d",
  "tsh",
  "free_t4",
  "ldl_cholesterol",
  "total_cholesterol",
  "glucose",
  "hba1c",
  "alt",
  "ast",
  "creatinine",
  "homocysteine",
]);

function buildMetricGroups(records) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.person_id || record.person}:${record.metric_id || record.metric_label}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        person: record.person,
        personId: record.person_id,
        metricId: record.metric_id,
        metricLabel: record.metric_label,
        metricCategory: record.metric_category,
        metricValueType: record.metric_value_type,
        records: [],
      });
    }
    groups.get(key).records.push(record);
  }

  return [...groups.values()]
    .map((group) => {
      const sorted = group.records.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const latest = sorted[sorted.length - 1];
      const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
      const hasLatestNumber = latest?.numeric_value !== null && latest?.numeric_value !== undefined;
      const hasPreviousNumber = previous?.numeric_value !== null && previous?.numeric_value !== undefined;
      const delta = hasLatestNumber && hasPreviousNumber ? latest.numeric_value - previous.numeric_value : null;
      const slug = slugify(`${group.personId || group.person}-${group.metricId || group.metricLabel}`, "metric");
      const trend = metricTrend(delta);
      return {
        ...group,
        slug,
        routePath: `/metrics/${slug}`,
        href: addBase(`/metrics/${slug}`),
        records: sorted,
        latest,
        previous,
        delta,
        ...trend,
        count: sorted.length,
        hasTrend: sorted.filter((record) => record.numeric_value !== null && record.numeric_value !== undefined).length >= 2,
        doctorQuestions: doctorQuestionsForMetric(group, latest, previous),
      };
    })
    .sort((a, b) => String(a.person).localeCompare(String(b.person), "ru") || String(a.metricLabel).localeCompare(String(b.metricLabel), "ru"));
}

function canonicalEventType(label) {
  const text = String(label || "").toLowerCase();
  if (/анализ|лаборатор/.test(text)) return { eventTypeId: "lab", eventTypeLabel: "Анализ" };
  if (/обслед|узи|экг|эхо|диагност|эргоспир/.test(text)) return { eventTypeId: "diagnostics", eventTypeLabel: "Обследование" };
  if (/консультац/.test(text)) return { eventTypeId: "consultation", eventTypeLabel: "Консультация" };
  if (/при[её]м|осмотр/.test(text)) return { eventTypeId: "visit", eventTypeLabel: "Приём" };
  if (/оценка|риск/.test(text)) return { eventTypeId: "risk-assessment", eventTypeLabel: "Оценка риска" };
  if (/заключ/.test(text)) return { eventTypeId: "conclusion", eventTypeLabel: "Заключение" };
  return { eventTypeId: slugify(label || "event"), eventTypeLabel: label || "Событие" };
}

async function countFilesInDir(dir) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await countFilesInDir(path.join(dir, entry.name));
      } else if (entry.name !== ".gitkeep") {
        count += 1;
      }
    }
    return count;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}

async function loadOperationsData() {
  const folderNames = {
    newFiles: "00 Новые файлы",
    aiDrafts: "10 Черновики AI",
    review: "20 На проверке",
    approved: "30 Одобрено",
    processed: "90 Обработано",
    errors: "99 Ошибки",
  };
  const entries = await Promise.all(
    Object.entries(folderNames).map(async ([key, folder]) => [key, await countFilesInDir(path.join(inboxDir, folder))]),
  );
  const intakeState = await readJsonOrDefault(path.join(inboxDir, "intake-state.json"), { files: [] });
  const metricCandidates = await readJsonOrDefault(path.join(repoRoot, "07 Показатели", "metric_candidates.json"), {
    candidates: [],
  });
  const taskCandidates = await readTaskCandidatesFile();
  const candidateCounts = {};
  for (const candidate of metricCandidates.candidates || []) {
    const status = candidate.status || "unknown";
    candidateCounts[status] = (candidateCounts[status] || 0) + 1;
  }
  const taskCandidateCounts = {};
  for (const candidate of taskCandidates.records || []) {
    const status = candidate.candidate_status || candidate.review_status || candidate.status || "unknown";
    taskCandidateCounts[status] = (taskCandidateCounts[status] || 0) + 1;
  }

  return {
    inbox: Object.fromEntries(entries),
    intakeState: {
      updatedAt: intakeState.updated_at || intakeState.updatedAt || "",
      files: Array.isArray(intakeState.files) ? intakeState.files.length : 0,
    },
    metricCandidates: {
      generatedAt: metricCandidates.generated_at || metricCandidates.generatedAt || "",
      total: Array.isArray(metricCandidates.candidates) ? metricCandidates.candidates.length : 0,
      byStatus: candidateCounts,
    },
    taskCandidates: {
      updatedAt: taskCandidates.updatedAt || "",
      total: taskCandidates.records.length,
      byStatus: taskCandidateCounts,
      records: taskCandidates.records,
    },
  };
}

export async function loadDashboardData({ includeInbox = false, publicDocuments = documentPublishEnabled, skipDoctorSummaries = false } = {}) {
  const issues = [];
  const documents = (await findAssetFiles({ includeInbox })).map((filePath) =>
    documentFromPath(filePath, { isInboxItem: filePath.startsWith(inboxDir), publicDocuments }),
  );
  const markdownFiles = await findMarkdownFiles();
  const profiles = [];
  const events = [];
  const idCounts = new Map();

  for (const filePath of markdownFiles) {
    const { data, body } = await readMarkdown(filePath);
    if (data.type === "person_profile") {
      profiles.push(normalizeProfile(filePath, data, body));
    } else if (data.type === "medical_event") {
      const event = normalizeEvent(filePath, data, body, idCounts, issues);
      if (event) events.push(event);
    } else {
      issues.push(
        createIssue("warn", "event", `Markdown-файл в папке членов семьи не попал в дашборд: неизвестный type '${data.type || "пусто"}'.`, {
          entityPath: repoRelative(filePath),
          suggestedFix: "Укажите type: medical_event или type: person_profile, если файл должен отображаться на сайте.",
        }),
      );
    }
  }

  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      issues.push(
        createIssue("fatal", "event", `Дублирующийся id события: ${id}`, {
          suggestedFix: "Сделайте id уникальными во frontmatter.",
        }),
      );
    }
  }

  for (const event of events) {
    for (const source of event.sourceFileNames) {
      const document = resolveSourceFile(source, event, documents, issues);
      if (!document) continue;
      const eventDocument = documentForEvent(document, event);
      event.sourceFiles.push(eventDocument);
      if (!document.isLinkedToEvent) {
        Object.assign(document, eventDocument);
      } else {
        document.relatedEventCandidates = [
          ...(document.relatedEventCandidates || []),
          { id: event.id, slug: event.slug, title: event.title, href: event.href },
        ];
      }
    }
  }

  for (const event of events) {
    event.followUpAction = deriveFollowUpAction(event);
  }

  const sortedEvents = events.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ru"));
  const eventsById = new Map(sortedEvents.map((event) => [event.id, event]));
  const computedTasks = [
    ...events.map(buildTaskFromEvent).filter(Boolean),
    ...profiles.flatMap(buildProfileTasks),
  ];
  const profilesByPerson = new Map(profiles.map((profile) => [profile.name, profile]));
  const explicitTasks = (await readTasksFile())
    .map((record) => normalizeTaskRecord(record, eventsById, profilesByPerson, issues))
    .filter((task) => task && !isOpenOverdueTask(task));
  const explicitTaskKeys = new Set(
    explicitTasks.map((task) => [task.sourceEventId || task.sourcePath, task.dueDate || "", task.actionText].join("::")),
  );
  const explicitEventDueKeys = new Set(
    explicitTasks
      .filter((task) => task.sourceEventId && task.dueDate)
      .map((task) => [task.sourceEventId, task.dueDate].join("::")),
  );
  const groupedExplicitEventKeys = new Set(
    explicitTasks.flatMap((task) =>
      (task.items || [])
        .filter((item) => item.sourceEventId)
        .map((item) => [item.sourceEventId, task.dueDate || ""].join("::")),
    ),
  );
  const groupedExplicitEventIds = new Set(explicitTasks.flatMap((task) => task.groupedSourceEventIds || []));
  const tasks = [
    ...explicitTasks,
    ...computedTasks.filter((task) => {
      const taskKey = [task.sourceEventId || task.sourcePath, task.dueDate || "", task.actionText].join("::");
      const groupedEventKey = [task.sourceEventId || "", task.dueDate || ""].join("::");
      return (
        !explicitTaskKeys.has(taskKey) &&
        !explicitEventDueKeys.has(groupedEventKey) &&
        !groupedExplicitEventKeys.has(groupedEventKey) &&
        !groupedExplicitEventIds.has(task.sourceEventId)
      );
    }),
  ].filter((task) => !isOpenOverdueTask(task));

  for (const profile of profiles) {
    const personEvents = events
      .filter((event) => event.person === profile.name)
      .sort((a, b) => b.date.localeCompare(a.date));
    const personDocuments = documents
      .filter((document) => document.person === profile.name)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const specialties = new Map();
    for (const event of personEvents) {
      specialties.set(event.specialty, (specialties.get(event.specialty) || 0) + 1);
    }
    profile.eventCount = personEvents.length;
    profile.documentCount = personDocuments.length;
    profile.nextTasks = tasks
      .filter((task) => task.person === profile.name)
      .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
      .slice(0, 5);
    profile.latestEvent = personEvents[0]
      ? {
          title: personEvents[0].title,
          date: personEvents[0].date,
          specialty: personEvents[0].specialty,
          href: personEvents[0].href,
        }
      : undefined;
    profile.latestDocument = personDocuments[0]
      ? {
          fileName: personDocuments[0].fileName,
          date: personDocuments[0].date,
          href: personDocuments[0].href,
          linkStatusLabel: personDocuments[0].linkStatusLabel,
        }
      : undefined;
    profile.specialtySummary = [...specialties.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
      .slice(0, 6)
      .map(([label, count]) => ({ label, id: slugify(label), count }));
    profile.emptyStateFlags = {
      hasEvents: personEvents.length > 0,
      hasDocuments: personDocuments.length > 0,
      hasTasks: profile.nextTasks.length > 0,
    };
  }

  const sortedDocuments = documents.sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") || a.fileName.localeCompare(b.fileName, "ru"),
  );
  const metrics = (await readMetricsFile())
    .map((record) => normalizeMetricRecord(record, eventsById))
    .sort((a, b) =>
      String(a.person).localeCompare(String(b.person), "ru") ||
      String(a.metric_label).localeCompare(String(b.metric_label), "ru") ||
      String(b.date).localeCompare(String(a.date)),
    );
  const metricGroups = buildMetricGroups(metrics);
  const watchlist = await readWatchlistFile();
  const doctorSummaries = skipDoctorSummaries ? { generatedAt: undefined, records: [] } : await readDoctorSummariesFile();
  const operations = await loadOperationsData();
  for (const profile of profiles) {
    const weightMetric = metricGroups.find((group) => group.person === profile.name && group.metricId === "weight");
    profile.weightMetric = weightMetric || null;
    profile.latestWeight = weightMetric?.latest || null;
    profile.keyMetrics = metricGroups
      .filter((group) => group.person === profile.name && keyMetricIds.has(group.metricId))
      .sort((a, b) => {
        const aLatest = a.latest?.date || "";
        const bLatest = b.latest?.date || "";
        return bLatest.localeCompare(aLatest) || String(a.metricLabel).localeCompare(String(b.metricLabel), "ru");
      })
      .slice(0, 12);
  }

  const data = {
    generatedAt: new Date().toISOString(),
    basePath,
    people: profiles.sort((a, b) => a.name.localeCompare(b.name, "ru")),
    events: sortedEvents,
    documents: sortedDocuments,
    metrics,
    metricGroups,
    watchlist,
    doctorSummaries,
    operations,
    tasks,
    issues,
    searchItems: [],
    stats: {
      people: profiles.length,
      events: events.length,
      documents: documents.length,
      metrics: metrics.length,
      metricTypes: metricGroups.length,
      watchlist: watchlist.records.length,
      doctorSummaries: doctorSummaries.records.length,
      linkedDocuments: documents.filter((document) => document.isLinkedToEvent).length,
      unlinkedDocuments: documents.filter((document) => !document.isLinkedToEvent).length,
      tasks: tasks.length,
      warnings: issues.filter((issue) => issue.severity === "warn").length,
      fatal: issues.filter((issue) => issue.severity === "fatal").length,
    },
  };
  data.searchItems = buildSearchItems(data);
  return data;
}

export async function writeDashboardData(options = {}) {
  const data = await loadDashboardData(options);
  await fsp.mkdir(generatedDir, { recursive: true });
  const dashboardPath = path.join(generatedDir, "dashboard-data.json");
  try {
    const existing = JSON.parse(await fsp.readFile(dashboardPath, "utf8"));
    const existingComparable = { ...existing, generatedAt: "<generated>" };
    const nextComparable = { ...data, generatedAt: "<generated>" };
    if (JSON.stringify(existingComparable) === JSON.stringify(nextComparable)) {
      data.generatedAt = existing.generatedAt || data.generatedAt;
    }
  } catch {
    // No previous generated data to preserve.
  }
  const manifest = data.documents.map((document) => ({
    id: document.id,
    slug: document.slug,
    fileName: document.fileName,
    displayName: document.displayName,
    originalPath: document.originalPath,
    outputFileName: document.outputFileName,
    encryptedOutputFileName: document.encryptedOutputFileName,
    publicUrl: document.publicUrl,
    encryptedUrl: document.encryptedUrl,
    extension: document.extension,
    mimeType: document.mimeType,
    size: document.size,
  }));
  await atomicWriteJson(dashboardPath, data);
  await atomicWriteJson(path.join(generatedDir, "document-manifest.json"), manifest);
  return data;
}

export async function copyDocuments(targetDir) {
  const manifestPath = path.join(generatedDir, "document-manifest.json");
  const manifest = await readJsonStrict(manifestPath);
  await fsp.rm(targetDir, { recursive: true, force: true });
  await fsp.mkdir(targetDir, { recursive: true });
  for (const document of manifest) {
    const source = path.join(repoRoot, document.originalPath);
    const target = path.join(targetDir, document.outputFileName);
    await fsp.copyFile(source, target);
  }
  await fsp.writeFile(path.join(targetDir, ".gitkeep"), "", "utf8");
  return manifest.length;
}

export async function getAssetStats() {
  const files = await findAssetFiles({ includeInbox: true });
  const assets = files.map((filePath) => ({
    path: repoRelative(filePath),
    size: fs.statSync(filePath).size,
  }));
  const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
  return { assets, totalSize };
}
