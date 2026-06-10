import data from "../generated/dashboard-data.json";

export const dashboard = data;
export const basePath = data.basePath === "/" ? "" : (data.basePath || "").replace(/\/$/, "");

export function pageHref(path: string) {
  if (path.startsWith("http")) return path;
  if (!path) return basePath || "/";
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

export function formatDate(value?: string) {
  if (!value) return "Дата не указана";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateShort(value?: string) {
  if (!value) return "Без даты";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function ageText(birthDate?: string) {
  if (!birthDate) return "";
  const born = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(born.valueOf())) return "";
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) years -= 1;
  if (years < 1) return "меньше года";
  return `${years} ${plural(years, "год", "года", "лет")}`;
}

export function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function compactList(items?: string[], max = 2) {
  return (items || []).filter(Boolean).slice(0, max);
}

export type MetricIconName =
  | "blood-drop"
  | "red-cell"
  | "thyroid"
  | "sun"
  | "capsule"
  | "molecule"
  | "heart-vessel"
  | "liver"
  | "kidney"
  | "molecule-chain"
  | "coagulation"
  | "scale"
  | "blood-pressure"
  | "pulse"
  | "inflammation"
  | "lab";

export type MetricIconRule = {
  icon: MetricIconName;
  label: string;
  patterns: string[];
};

export const metricIconMap: MetricIconRule[] = [
  { icon: "blood-drop", label: "Капля крови / железо", patterns: ["ферритин", "железо"] },
  { icon: "thyroid", label: "Щитовидная железа / гормон", patterns: ["ттг", "т3", "т4", "тиреотроп", "свободный т"] },
  { icon: "sun", label: "Солнце / витамин D", patterns: ["витамин d", "25(oh)d", "25-oh", "25 oh"] },
  { icon: "capsule", label: "Капсула / витамин", patterns: ["витамин b12", "b12", "фолат", "омега"] },
  { icon: "molecule", label: "Молекула / глюкоза", patterns: ["глюкоза", "инсулин", "гликирован", "hba1c"] },
  { icon: "heart-vessel", label: "Сердце / сосуды", patterns: ["холестерин", "лпнп", "лпвп", "триглицер"] },
  { icon: "liver", label: "Печень", patterns: ["алт", "аст", "билирубин", "альбумин"] },
  { icon: "kidney", label: "Почки", patterns: ["креатинин", "мочевина", "мочевая кислота", "моче"] },
  { icon: "molecule-chain", label: "Молекулярная цепочка / гомоцистеин", patterns: ["гомоцистеин"] },
  { icon: "coagulation", label: "Коагуляция / свертывание", patterns: ["коагул", "фибриноген", "ачтв", "мно", "протромбин", "тромбинов"] },
  { icon: "scale", label: "Весы", patterns: ["вес", "масса тела", "индекс массы"] },
  { icon: "blood-pressure", label: "Давление", patterns: ["давление", "систол", "диастол"] },
  { icon: "pulse", label: "Пульс / сердечный ритм", patterns: ["пульс", "чсс", "ритм"] },
  { icon: "inflammation", label: "Воспалительный / иммунный маркер", patterns: ["c-реактив", "с-реактив", "срб", "соэ", "ревматоид", "асло"] },
  { icon: "lab", label: "Лабораторный показатель", patterns: ["мазке", "квм", "впч", "общий белок"] },
  { icon: "red-cell", label: "Клетки крови", patterns: ["гемоглобин", "гематокрит", "эритроц", "mch", "mchc", "лейкоцит", "тромбоцит", "эозинофил"] },
];

function normalizeMetricName(value?: string) {
  return (value || "")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMetricIcon(metricName?: string) {
  const normalized = normalizeMetricName(metricName);
  return metricIconMap.find((rule) => rule.patterns.some((pattern) => normalized.includes(pattern))) || {
    icon: "lab" as MetricIconName,
    label: "Лабораторный показатель",
    patterns: [],
  };
}

export function metricStatusTone(status?: string, label?: string) {
  const normalizedStatus = normalizeMetricName(status);
  const normalizedLabel = normalizeMetricName(label);
  if (normalizedStatus === "normal" || normalizedLabel.includes("норм")) return "green";
  if (normalizedLabel.includes("границ") || normalizedLabel.includes("контрол")) return "yellow";
  if (normalizedStatus === "low" || normalizedStatus === "high") return "red";
  if (normalizedStatus.includes("review") || normalizedStatus.includes("processing")) return "violet";
  if (normalizedStatus === "unknown" || normalizedLabel.includes("нет данных")) return "blue";
  return "blue";
}

export function excerpt(items?: string[], max = 160) {
  const text = (items || []).filter(Boolean).join(" ");
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export function taskState(task: { dueDate?: string }) {
  if (!task.dueDate) return { bucket: "unknown", label: "Без даты" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.dueDate}T00:00:00`);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { bucket: "overdue", label: "Просрочено" };
  if (diffDays <= 7) return { bucket: "week", label: "На этой неделе" };
  if (diffDays <= 31) return { bucket: "month", label: "В этом месяце" };
  return { bucket: "later", label: "Позже" };
}

export function groupTasks(tasks: any[]) {
  const groups = [
    { id: "overdue", title: "Просрочено", tasks: [] as any[] },
    { id: "week", title: "На этой неделе", tasks: [] as any[] },
    { id: "month", title: "В этом месяце", tasks: [] as any[] },
    { id: "later", title: "Позже", tasks: [] as any[] },
    { id: "unknown", title: "Без даты", tasks: [] as any[] },
  ];
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const task of tasks) {
    const state = taskState(task);
    byId.get(state.bucket)?.tasks.push({ ...task, state });
  }
  for (const group of groups) {
    group.tasks.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  }
  return groups;
}

export function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
