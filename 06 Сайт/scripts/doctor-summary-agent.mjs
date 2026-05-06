import fsp from "node:fs/promises";
import path from "node:path";
import {
  basePath,
  hashText,
  repoRoot,
  slugify,
  stripMarkdown,
  loadDashboardData,
} from "./dashboard-lib.mjs";

const outputDir = path.join(repoRoot, "05 Индексы", "Сводки врачу");
const outputJsonPath = path.join(repoRoot, "09 Наблюдение", "doctor-summaries.json");
const agentName = "doctor-summary-agent";

function cleanItems(items, max = 12) {
  return [...new Set((items || []).map((item) => stripMarkdown(item)).filter(Boolean))].slice(0, max);
}

function summaryTitle(person, specialty) {
  return `${person} — ${specialty}`;
}

function summarySlug(person, specialty) {
  return slugify(`${person}-${specialty}`, "doctor-summary");
}

function markdownFileName(person, specialty) {
  return `${person} — ${specialty}.md`;
}

function sourceDocuments(events) {
  const rows = [];
  const seen = new Set();
  for (const event of events) {
    for (const document of event.sourceFiles || []) {
      const key = `${event.id}:${document.fileName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        date: event.date,
        fileName: document.fileName,
        href: document.href,
        eventTitle: event.title,
      });
    }
  }
  return rows;
}

function buildSummary(person, specialty, events, profile) {
  const sortedEvents = [...events].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ru"));
  const chronologicalEvents = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ru"));
  const slug = summarySlug(person.name, specialty);
  const title = summaryTitle(person.name, specialty);
  const summary = cleanItems(sortedEvents.flatMap((event) => event.summary.map((item) => `${event.date}: ${item}`)), 16);
  const track = cleanItems(sortedEvents.flatMap((event) => event.track.map((item) => `${event.date}: ${item}`)), 14);
  const nextActions = cleanItems(
    sortedEvents.flatMap((event) => [...(event.nextActions || []), ...(event.prescriptions || [])].map((item) => `${event.date}: ${item}`)),
    14,
  );
  const documents = sourceDocuments(chronologicalEvents);
  const profileContext = cleanItems(
    [
      profile?.birthDateText ? `Дата рождения: ${profile.birthDateText}` : "",
      profile?.bloodType ? `Группа крови: ${profile.bloodType}` : "",
      profile?.rhFactor ? `Резус-фактор: ${profile.rhFactor}` : "",
      profile?.importantStatus ? `Важный статус: ${profile.importantStatus}` : "",
      ...(profile?.allergies || []).map((item) => `Аллергии: ${item}`),
      ...(profile?.chronicConditions || []).map((item) => `Хронические заболевания: ${item}`),
      ...(profile?.currentMedications || []).map((item) => `Текущие препараты: ${item}`),
      ...(profile?.currentTreatments || []).map((item) => `Текущие курсы лечения: ${item}`),
    ],
    10,
  );

  return {
    id: `doctor-summary-${hashText(`${person.slug}:${specialty}`, 12)}`,
    slug,
    title,
    person: person.name,
    personSlug: person.slug,
    specialty,
    routePath: `/doctor-summaries/${slug}`,
    href: `${basePath}/doctor-summaries/${slug}`,
    markdownPath: `05 Индексы/Сводки врачу/${markdownFileName(person.name, specialty)}`,
    sourceEventCount: sortedEvents.length,
    sourceDocumentCount: documents.length,
    latestEventDate: sortedEvents[0]?.date || "",
    profileContext,
    summary,
    track,
    nextActions,
    events: chronologicalEvents.map((event) => ({
      id: event.id,
      title: event.title,
      href: event.href,
      date: event.date,
      eventType: event.eventType,
      specialty: event.specialty,
      doctor: event.doctor,
      clinic: event.clinic,
      markdownPath: event.markdownPath,
    })),
    documents,
  };
}

function renderMarkdown(record) {
  const lines = [
    "---",
    `id: ${record.id}`,
    "type: doctor_summary",
    `person: ${record.person}`,
    `specialty: ${record.specialty}`,
    `updated: ${new Date().toISOString().slice(0, 10)}`,
    "source: doctor-summary-agent",
    "---",
    "",
    `# ${record.title}`,
    "",
    "- Это производная сводка для врача.",
    "- Агент только пересказывает данные из базы и не добавляет новые диагнозы или назначения.",
    `- Событий в сводке: ${record.sourceEventCount}.`,
    `- Документов-источников: ${record.sourceDocumentCount}.`,
  ];

  function section(name, items) {
    if (!items?.length) return;
    lines.push("", `## ${name}`);
    for (const item of items) lines.push(`- ${item}`);
  }

  section("Профиль и постоянный контекст", record.profileContext);
  section("Коротко", record.summary);
  section("Что важно отследить", record.track);
  section("Что обсудить или показать врачу", record.nextActions);

  lines.push("", "## Хронология", "| Дата | Тип | Направление | Врач / клиника | Запись |", "|---|---|---|---|---|");
  for (const event of record.events) {
    const doctorClinic = [event.doctor, event.clinic].filter(Boolean).join(", ");
    lines.push(`| ${event.date} | ${event.eventType} | ${event.specialty} | ${doctorClinic} | [[${event.title}]] |`);
  }

  section(
    "Документы-источники",
    record.documents.map((document) => `${document.date}: ${document.fileName}`),
  );

  lines.push("", "## Техническая область чтения");
  lines.push("- Источник: `01 Члены семьи/**/*.md` с `type: medical_event` и `type: person_profile`.");
  lines.push("- Изменений в медицинских событиях: 0.");

  return `${lines.join("\n")}\n`;
}

async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, value, "utf8");
}

async function main() {
  const dashboard = await loadDashboardData();
  const records = [];

  for (const person of dashboard.people) {
    const personEvents = dashboard.events.filter((event) => event.person === person.name);
    const specialties = [...new Set(personEvents.map((event) => event.specialty).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ru"),
    );

    for (const specialty of specialties) {
      const specialtyEvents = personEvents.filter((event) => event.specialty === specialty);
      if (!specialtyEvents.length) continue;
      records.push(buildSummary(person, specialty, specialtyEvents, person));
    }
  }

  records.sort((a, b) => a.person.localeCompare(b.person, "ru") || a.specialty.localeCompare(b.specialty, "ru"));

  await fsp.rm(outputDir, { recursive: true, force: true });
  await fsp.mkdir(outputDir, { recursive: true });
  for (const record of records) {
    await writeText(path.join(outputDir, markdownFileName(record.person, record.specialty)), renderMarkdown(record));
  }

  await writeJson(outputJsonPath, {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    agent: {
      id: agentName,
      name: "Doctor Summary Agent / агент сводок врачу",
      role: "Собирает read-only markdown-сводки врачу из уже внесённых медицинских событий.",
    },
    records,
  });

  console.log(`Doctor summaries generated: ${records.length}.`);
  console.log("Output: 05 Индексы/Сводки врачу and 09 Наблюдение/doctor-summaries.json.");
}

await main();
