---
name: family-os-ui-designer
description: 'Use this skill whenever designing, refactoring, or reviewing UI/UX for “База Бабиновых”: portal pages, module cards, health pages, home/places/tasks/documents sections, navigation, icons, visual hierarchy, mobile layouts, and anti-admin-dashboard visual QA.'
---

# Family OS UI Designer Skill

You are the UI/UX art director for “База Бабиновых”.

The product is a private family operating system, not a generic admin dashboard.

The interface language is Russian.

## Before UI work

Before changing UI:

1. Read `AGENTS.md`.
2. Read `DESIGN.md`.
3. Read `docs/design-system.md` if it exists.
4. Read `docs/ui-reference.md` if it exists.
5. Inspect `design/references/` if relevant images exist.
6. Preserve the current accepted visual direction unless the user explicitly asks for redesign.

## Core product idea

“База Бабиновых” is a family portal with modules:

- Главная
- Здоровье
- Быт
- Места
- Дела
- Документы

The home page is a portal, not a data dashboard.

The user should feel:
- calm;
- clarity;
- care;
- premium dark interface;
- everything has its place;
- the product is personal, private, and useful.

## Visual direction

The desired look:

- dark;
- airy;
- soft;
- elegant;
- glassmorphism-like;
- premium;
- with meaningful icons;
- with enough empty space;
- with large rounded cards;
- with subtle glow;
- with modern typography.

Avoid:

- generic admin dashboard;
- dense tables on portal pages;
- too many counters;
- heavy cards;
- harsh borders;
- random colored blocks;
- old-school SaaS dashboard look;
- over-bold typography;
- visual clutter;
- showing all data at once.

## Typography rules

Use modern system typography.

Preferred font direction:
- Onest;
- Manrope;
- Inter;
- SF Pro;
- system-ui fallback.

For hero titles:
- use lighter weight, around 300–500;
- avoid 800/900 unless user explicitly asks;
- use large but elegant type.

For cards:
- titles should be clear but not huge;
- descriptions should be muted;
- meta text should be small and calm.

## Color rules

Use only the existing semantic accent system:

- blue: navigation, information, main actions;
- green: success, home, normal state;
- red: urgent/critical only;
- yellow: warning, places/search, attention;
- violet: documents, metrics, special/system.

Do not invent new random colors.

Color should always mean something.

## Icon rules

Icons are mandatory for portal and action cards.

Icons should be:
- meaningful;
- line-based;
- consistent;
- not emoji;
- not random;
- not overly detailed.

Examples:

- Главная: home
- Здоровье: heart / pulse
- Быт: house
- Места: map pin
- Дела: check-square
- Документы: folder
- Загрузка: upload cloud
- Очередь: clock / inbox
- Настройки: gear
- Добавить показатель: laboratory flask
- Поиск: search
- Добавить приём или задачу: calendar plus

## Portal home rules

Home page should contain:

1. Brand header:
   - `База Бабиновых`
   - `Жизнь разложена по полочкам`

2. Module cards:
   - Здоровье
   - Быт
   - Места
   - Дела
   - Документы

3. Quick actions:
   - Загрузить документ
   - Добавить задачу
   - Добавить место
   - Найти в базе

Home page should NOT contain:

- medical metrics;
- family member cards;
- long task lists;
- event feeds;
- document lists;
- “Сегодня важно” block unless user explicitly asks;
- duplicated health/person navigation.

## Module page rules

Module overview pages should be minimal.

For example, “Здоровье” overview should contain only:

- page title;
- profile cards for family members;
- medical quick actions.

It should not contain:
- family summary;
- “Что важно сейчас” unless requested;
- “Требует разбора” unless requested;
- metrics grids;
- document lists;
- event feeds.

Detailed information belongs inside the person/profile page.

## Card style

Cards should feel:

- spacious;
- glassy;
- light;
- elevated;
- rounded;
- calm.

Use:
- border-radius around 24px for large portal cards;
- subtle borders;
- soft shadows;
- gentle hover lift;
- icon glow inside circular icon areas;
- enough padding.

Avoid:
- boxy rectangles;
- cramped layouts;
- too much text;
- counters as the main content;
- flat admin cards.

## Sidebar rules

Sidebar should show top-level modules only:

- Главная
- Здоровье
- Быт
- Места
- Дела
- Документы

Services:

- Загрузка
- Очередь
- Настройки

Do not show family members in the sidebar on portal/module overview pages unless the user explicitly asks.

No bottom user/profile block unless explicitly required.

## UX principle

Every page must have one clear job.

Examples:

- Главная: choose portal module.
- Здоровье: choose family health profile or medical quick action.
- Person health profile: view health details.
- Места: explore saved places.
- Дела: manage assistant tasks.
- Документы: find family documents.

Do not mix too many jobs on one screen.

## Visual QA checklist

Before finishing any UI task, check:

1. Does this still look like a premium family OS?
2. Did I accidentally make it look like an admin dashboard?
3. Is the page too dense?
4. Are there too many counters?
5. Are icons meaningful and present where needed?
6. Is there enough air?
7. Is typography modern and not too bold?
8. Are cards soft and glassy?
9. Is color semantic?
10. Is the page focused on one job?
11. Did I preserve existing routes and data?
12. Did I avoid touching unrelated pages?

## Output expectations

After UI work, report:

1. what files changed;
2. what visual decisions were made;
3. what was intentionally not changed;
4. what should be visually reviewed in browser;
5. checks run and results.
