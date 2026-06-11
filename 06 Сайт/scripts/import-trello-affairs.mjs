import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(siteRoot, "..");
const envPath = path.join(repoRoot, ".env");
const outputPath = path.join(repoRoot, "10 Дела", "assistant_tasks.json");

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function slugify(value, fallback = "item") {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y",
    ь: "", э: "e", ю: "yu", я: "ya",
  };
  const slug = String(value || "")
    .toLocaleLowerCase("ru-RU")
    .replace(/[а-яё]/g, (letter) => map[letter] || "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function semanticLabelTone(labelName = "") {
  const normalized = labelName.toLocaleLowerCase("ru-RU");
  if (normalized.includes("мед") || normalized.includes("процед")) return "green";
  if (normalized.includes("документ")) return "violet";
  if (normalized.includes("инфо")) return "blue";
  if (normalized.includes("закуп") || normalized.includes("куп")) return "yellow";
  if (normalized.includes("малыш")) return "yellow";
  if (normalized.includes("актив")) return "violet";
  return "blue";
}

function columnKind(name = "") {
  const normalized = name.toLocaleLowerCase("ru-RU");
  if (normalized.includes("готов")) return "done";
  if (normalized.includes("отлож")) return "deferred";
  if (normalized.includes("регуляр")) return "recurring";
  if (normalized.includes("бэклог")) return "backlog";
  if (normalized.includes("нужно")) return "todo";
  if (normalized.includes("проект")) return "project";
  if (normalized.includes("подум")) return "idea";
  return "active";
}

function taskTone(record) {
  if (record.done) return "green";
  if (record.column_kind === "deferred" || record.column_kind === "idea") return "blue";
  if (record.column_kind === "recurring") return "violet";
  if (record.due_at) return "yellow";
  if (record.column_kind === "project") return "violet";
  return "blue";
}

async function readEnv() {
  try {
    return parseEnv(await fs.readFile(envPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Не найден .env: ${envPath}`);
    }
    throw error;
  }
}

async function trelloGet(pathname, params, credentials) {
  const url = new URL(`https://api.trello.com/1${pathname}`);
  for (const [key, value] of Object.entries({ ...params, key: credentials.key, token: credentials.token })) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Trello request failed for ${pathname}: ${response.status}`);
  }
  return response.json();
}

async function atomicWriteJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const env = await readEnv();
const credentials = {
  key: env.TRELLO_API_KEY,
  token: env.TRELLO_TOKEN,
};

if (!credentials.key || !credentials.token) {
  throw new Error("Нужны TRELLO_API_KEY и TRELLO_TOKEN в .env");
}

const boards = await trelloGet("/members/me/boards", {
  filter: "open",
  fields: "id,name,url,dateLastActivity,closed",
}, credentials);

const board = env.TRELLO_BOARD_ID
  ? boards.find((item) => item.id === env.TRELLO_BOARD_ID)
  : boards.find((item) => item.name === "Задачи");

if (!board) {
  throw new Error("Не найдена Trello-доска. Укажи TRELLO_BOARD_ID в .env.");
}

const lists = (await trelloGet(`/boards/${board.id}/lists/open`, {
  fields: "id,name,pos,closed",
}, credentials)).sort((a, b) => a.pos - b.pos);

const cards = await trelloGet(`/boards/${board.id}/cards/open`, {
  fields: "id,idShort,idList,name,desc,due,dueComplete,dateLastActivity,labels,url,pos,badges,closed",
  checklists: "all",
  attachments: "false",
}, credentials);

const columns = lists.map((list, index) => ({
  id: list.id,
  key: slugify(list.name, `column-${index + 1}`),
  name: list.name,
  kind: columnKind(list.name),
  position: index + 1,
  trello_list_id: list.id,
}));

const columnById = new Map(columns.map((column) => [column.id, column]));
const records = cards
  .sort((a, b) => a.pos - b.pos)
  .map((card, index) => {
    const column = columnById.get(card.idList) || {
      id: card.idList,
      key: "unknown",
      name: "Без списка",
      kind: "active",
    };
    const done = Boolean(card.dueComplete) || column.kind === "done";
    const record = {
      id: `affair-${card.id}`,
      type: "assistant_task",
      title: card.name,
      description: card.desc || "",
      status: done ? "done" : "open",
      done,
      column_id: column.id,
      column_key: column.key,
      column_name: column.name,
      column_kind: column.kind,
      position: index + 1,
      due_at: card.due || "",
      due_complete: Boolean(card.dueComplete),
      last_activity_at: card.dateLastActivity || "",
      labels: (card.labels || []).map((label) => ({
        id: label.id,
        name: label.name || "",
        trello_color: label.color || "",
        tone: semanticLabelTone(label.name || ""),
      })),
      checklist: {
        items_total: card.badges?.checkItems || 0,
        items_done: card.badges?.checkItemsChecked || 0,
      },
      source: "trello",
      trello_card_id: card.id,
      trello_card_short_id: card.idShort || null,
      trello_card_url: card.url,
      search_text: [card.name, card.desc, column.name, ...(card.labels || []).map((label) => label.name)].filter(Boolean).join(" "),
    };
    return {
      ...record,
      tone: taskTone(record),
    };
  });

const now = new Date().toISOString();
const payload = {
  schema_version: 1,
  updated_at: now,
  source: {
    type: "trello",
    board_id: board.id,
    board_name: board.name,
    board_url: board.url,
  },
  stats: {
    columns: columns.length,
    records: records.length,
    open: records.filter((record) => !record.done).length,
    done: records.filter((record) => record.done).length,
    with_due: records.filter((record) => record.due_at).length,
    with_description: records.filter((record) => record.description.trim()).length,
  },
  columns,
  records,
};

if (!dryRun) {
  await atomicWriteJson(outputPath, payload);
}

console.log(
  [
    `Trello affairs import ${dryRun ? "dry-run" : "written"}`,
    `board="${board.name}"`,
    `columns=${payload.stats.columns}`,
    `records=${payload.stats.records}`,
    `open=${payload.stats.open}`,
    `done=${payload.stats.done}`,
    `output=${path.relative(repoRoot, outputPath)}`,
  ].join(" "),
);
