import fs from "node:fs";
import path from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const configuredAllowedOrigins = (process.env.CHATKIT_ALLOWED_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultAllowedOrigins = [
  "https://meds-database-site.vercel.app",
  "https://ulyana19svlv.github.io",
];

function allowedOriginFor(req: VercelRequest) {
  if (configuredAllowedOrigins.includes("*")) return "*";

  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const allowedOrigins = new Set([...configuredAllowedOrigins, ...defaultAllowedOrigins]);

  if (origin && allowedOrigins.has(origin)) return origin;
  return configuredAllowedOrigins[0] || defaultAllowedOrigins[0];
}

function setCors(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", allowedOriginFor(req));
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function loadDashboard() {
  const candidates = [
    path.join(process.cwd(), "06 Сайт", "src", "generated", "dashboard-data.json"),
    path.join(process.cwd(), "src", "generated", "dashboard-data.json"),
  ];

  const target = candidates.find((candidate) => fs.existsSync(candidate));
  if (!target) {
    throw new Error("dashboard-data.json was not found. Run npm run generate:data before deploy.");
  }

  return JSON.parse(fs.readFileSync(target, "utf8").replace(/^\uFEFF/, ""));
}

function textOf(value: unknown) {
  return JSON.stringify(value || "").toLowerCase();
}

function normalizeSearchText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/(\d{2})\.(\d{2})\.(\d{4})/g, "$3-$2-$1");
}

function searchTerms(query: string, person: string) {
  const normalized = normalizeSearchText(`${query} ${person}`);
  const tokens = normalized
    .split(/[^\p{L}\p{N}<>.,-]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  const expanded = new Set(tokens);

  if (tokens.includes("лпнп") || normalized.includes("низкой плотности")) {
    expanded.add("ldl_cholesterol");
    expanded.add("холестерин-лпнп");
    expanded.add("липопротеинов низкой плотности");
  }
  if (tokens.includes("лпвп")) {
    expanded.add("hdl_cholesterol");
  }
  if (tokens.includes("лпонп")) {
    expanded.add("vldl_cholesterol");
  }

  return [...expanded];
}

function metricSearchText(item: any) {
  return normalizeSearchText(
    [
      item.person,
      item.person_id,
      item.metric_id,
      item.metric_label,
      item.custom_metric_label,
      item.metricDescription,
      item.metricMeaning,
      item.date,
      item.date?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3.$2.$1"),
      item.value,
      item.value_text,
      item.displayValue,
      item.unit,
      item.reference_text,
      item.referenceDisplay,
      item.assessmentLabel,
      item.compactAssessmentLabel,
      item.source_text,
      item.source_event_path,
      item.source_files?.join(" "),
      item.eventTitle,
      item.labName,
    ].filter(Boolean).join(" "),
  );
}

function sourceText(item: any, type: string) {
  return type === "metric" ? metricSearchText(item) : normalizeSearchText(textOf(item));
}

function scoreSource(item: any, type: string, terms: string[], rawQuery: string, rawPerson: string) {
  const haystack = sourceText(item, type);
  const normalizedQuery = normalizeSearchText(rawQuery);
  let score = normalizedQuery && haystack.includes(normalizedQuery) ? 8 : 0;

  for (const term of terms) {
    if (haystack.includes(term)) score += term.length >= 5 ? 2 : 1;
  }

  const person = normalizeSearchText(rawPerson);
  if (person && normalizeSearchText(item.person || item.name).includes(person)) score += 6;

  if (type === "metric" && score > 0) {
    score += 4;
    if (terms.includes("лпнп") && normalizeSearchText(item.metric_label).includes("лпнп")) score += 20;
    if (terms.includes("ldl_cholesterol") && item.metric_id === "ldl_cholesterol") score += 20;
  }

  return score;
}

function compactText(value: unknown, maxLength = 900) {
  if (value === undefined || value === null || value === "") return undefined;

  const text = Array.isArray(value)
    ? value.filter(Boolean).join("; ")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function compactDetails(item: any) {
  return [
    compactText(item.birthDateText && `Дата рождения: ${item.birthDateText}`),
    compactText(item.ageLabel && `Возраст: ${item.ageLabel}`),
    compactText(item.bloodType && `Группа крови: ${item.bloodType}`),
    compactText(item.rhFactor && `Резус-фактор: ${item.rhFactor}`),
    compactText(item.specialtyLabel && `Специальность: ${item.specialtyLabel}`),
    compactText(item.clinic && `Клиника: ${item.clinic}`),
    compactText(item.doctor && `Врач: ${item.doctor}`),
    compactText(item.status && `Статус: ${item.status}`),
    compactText(item.importantStatus && `Важный статус: ${item.importantStatus}`),
    compactText(item.actionText && `Действие: ${item.actionText}`),
    compactText(item.result && `Результат: ${item.result}`),
    compactText(item.notes && `Заметки: ${item.notes}`),
    compactText(item.tags?.length ? `Теги: ${item.tags.join(", ")}` : undefined),
  ].filter(Boolean);
}

function compactMetricResult(item: any) {
  return {
    type: "metric",
    id: item.id,
    title: `${item.person || ""} — ${item.metric_label || item.metric_id || "показатель"}`.trim(),
    person: item.person,
    date: item.date,
    href: item.eventHref || item.source_event_path,
    sourcePath: item.source_event_path,
    specialty: item.metric_category,
    summary: compactText(
      [
        item.metric_label,
        item.displayValue || item.value_text || item.value,
        item.referenceDisplay && `референс: ${item.referenceDisplay}`,
        item.compactAssessmentLabel || item.assessmentLabel,
      ].filter(Boolean).join("; "),
    ),
    details: [
      compactText(item.metric_id && `ID показателя: ${item.metric_id}`),
      compactText(item.displayValue && `Значение: ${item.displayValue}`),
      compactText(item.referenceDisplay && `Референс: ${item.referenceDisplay}`),
      compactText((item.compactAssessmentLabel || item.assessmentLabel) && `Статус: ${item.compactAssessmentLabel || item.assessmentLabel}`),
      compactText(item.source_text && `Текст источника: ${item.source_text}`),
      compactText(item.labName && `Лаборатория: ${item.labName}`),
      compactText(item.eventTitle && `Событие: ${item.eventTitle}`),
      compactText(item.source_files?.length ? `Файлы: ${item.source_files.join(", ")}` : undefined),
      compactText(item.metricMeaning && `Смысл показателя: ${item.metricMeaning}`),
    ].filter(Boolean),
  };
}

function compactResult(item: any, type: string) {
  if (type === "metric") return compactMetricResult(item);

  return {
    type,
    id: item.id || item.slug || item.metricId || item.topic || item.title,
    title: item.title || item.name || item.topic || item.metricLabel || item.fileName,
    person: item.person || item.name,
    date: item.date || item.dueDate || item.next_date,
    href: item.href || item.sourcePath || item.path,
    sourcePath: item.sourcePath || item.markdownPath || item.profilePath || item.originalPath || item.path,
    specialty: item.specialty || item.specialtyLabel,
    summary: compactText(item.summary || item.shortSummary || item.importantStatus || item.actionText),
    details: compactDetails(item),
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = String(req.body?.query || "").trim().toLowerCase();
  const person = String(req.body?.person || "").trim().toLowerCase();
  const limit = Math.min(Number(req.body?.limit || 8), 20);

  if (!query && !person) {
    return res.status(400).json({ error: "Provide query or person." });
  }

  const dashboard = loadDashboard();
  const sources = [
    ...dashboard.people.map((item: any) => ({ item, type: "person" })),
    ...dashboard.events.map((item: any) => ({ item, type: "event" })),
    ...dashboard.tasks.map((item: any) => ({ item, type: "task" })),
    ...dashboard.documents.map((item: any) => ({ item, type: "document" })),
    ...dashboard.metrics.map((item: any) => ({ item, type: "metric" })),
    ...(dashboard.watchlist?.records || []).map((item: any) => ({ item, type: "watchlist" })),
    ...(dashboard.doctorSummaries?.records || []).map((item: any) => ({ item, type: "doctor_summary" })),
  ];
  const terms = searchTerms(query, person);

  const results = sources
    .map((source) => {
      const score = scoreSource(source.item, source.type, terms, query, person);
      return { ...source, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result) => compactResult(result.item, result.type));

  return res.status(200).json({
    safety: {
      mode: "read_only",
      instruction:
        "Answer only from indexed family medical records. Do not diagnose, prescribe, or add new medical recommendations. Cite source paths or links.",
    },
    generatedAt: dashboard.generatedAt,
    stats: dashboard.stats,
    results,
  });
}
