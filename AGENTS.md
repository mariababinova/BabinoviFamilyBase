# AGENTS.md

This repository is the project root for "База Бабиновых": a private family knowledge base and medical family operating system.

The product language is Russian. Interface labels, headings, empty states, filters, buttons, and user-facing status text should be written in Russian unless the user explicitly asks otherwise.

## Non-Negotiable Repository Rules

- Keep the existing repository stack and conventions.
- This project currently uses Astro and CSS. Do not convert it to Next.js, React, shadcn/ui, Tailwind, or another framework unless the user explicitly asks later.
- Do not install packages unless explicitly requested.
- Do not commit or push unless explicitly requested.
- Do not redesign app screens or modify existing UI components unless the user explicitly asks for UI implementation work.
- Before UI work, read `docs/design-system.md`, `docs/ui-reference.md`, and `.agents/skills/dark-family-os-ui/SKILL.md`.
- For UI/UX work, use `$family-os-ui-designer` in addition to `$dark-family-os-ui`. The `family-os-ui-designer` skill is responsible for visual direction, anti-admin-dashboard checks, information architecture, card hierarchy, icon usage, and portal/module page composition.
- Preserve existing content structure and medical/family data conventions unless the requested change requires otherwise.

## Product Definition

"База Бабиновых" is not a generic admin dashboard. It is a premium private family OS for medical knowledge, documents, indicators, tasks, appointments, observations, and family context.

The intended feel combines:

- Linear-like structure and density;
- Notion-like calm knowledge-base organization;
- Apple Health-like medical clarity;
- Raycast-like fast search and command palette behavior;
- warmth appropriate for family use;
- seriousness appropriate for medical information.

## Visual Direction

The visual language is named **Dark Family OS**.

### Visual Freeze

The currently implemented dark interface is the accepted visual baseline and source of truth.

For future tasks, do not:

- change the color system;
- change card radii;
- change typography;
- change shadows;
- change the overall visual mood;
- redesign cards merely for aesthetic polish;
- try to re-approximate the interface to the references;
- use `design/references/` as a mandatory visual target.

Use `design/references/` only as conceptual guidance for:

- information architecture;
- module logic;
- drill-down pages;
- data structure;
- UX patterns.

Do not use the references for visual redesign unless the user explicitly asks.

For architectural tasks, preserve the current CSS classes, components, colors, sizes, cards, and overall appearance.

If a new structure requires small layout adjustments, make them minimal and careful, without changing the design system.

The interface must feel:

- dark;
- calm;
- premium;
- modern;
- structured;
- trustworthy;
- human;
- practical for daily family use.

The interface must not feel:

- generic admin dashboard;
- default template;
- cyberpunk;
- childish;
- retro;
- decorative;
- clinical and cold.

## Mandatory UI Rules

- Dark theme only.
- All avatars and profile photos must be circular.
- Use only five semantic accent colors:
  - blue: action, information, active navigation, selected state;
  - green: normal, success, completed, ready;
  - red: urgent, critical, dangerous abnormal result, delete;
  - yellow: warning, planned, upcoming, needs control;
  - violet: special, category, review, recognition, processing.
- Do not use random decorative colors.
- Do not use pink, turquoise, orange, or meaningless accent colors.
- Do not use square profile photos.
- Do not use thick black borders.
- Do not add decorative top color strips on cards unless they express a real status.
- Do not place huge portraits inside working dashboards.
- "Что важно сейчас" must be visually dominant on profile and medical summary screens.
- Medical information must show source and context wherever possible.
- Mobile layouts must be intentionally designed, not squeezed desktop layouts.

## Medical Data Rules

Medical information should never appear as contextless decoration. Whenever available, show:

- source document or source event;
- date of the measurement, appointment, or observation;
- person the information belongs to;
- reference range for indicators;
- status and interpretation;
- related documents, appointments, tasks, and notes.

If source/context is missing, make the absence visible in a restrained way rather than inventing it.

## Entity Priorities

Person profile pages must prioritize:

- who this is;
- what is important now;
- what needs action;
- what changed;
- where the information came from.

Metrics must show:

- name;
- value;
- unit;
- status;
- date;
- source;
- reference range when available;
- dynamics/trend;
- linked documents;
- linked tasks.

Tasks must show:

- title;
- priority;
- deadline;
- checklist when relevant;
- related appointment;
- related doctor;
- related documents;
- notes;
- clear actions.

Appointments must show:

- date and time;
- doctor;
- specialty;
- clinic/source;
- status;
- complaints;
- summary;
- recommendations;
- prescriptions;
- related tasks;
- related documents;
- related indicators.

Documents must show:

- date;
- type;
- person;
- processing status;
- linked event;
- extracted indicators;
- created tasks if any.

## Implementation Guidance

- Prefer existing Astro components, CSS patterns, content collections, and data conventions.
- Keep changes scoped and reversible.
- Use semantic HTML and accessible labels.
- Keep Russian names, medical terms, and long labels from overflowing.
- Make empty, loading, selected, overdue, urgent, completed, archived, and processing states explicit.
- Verify meaningful UI changes in desktop and mobile widths before reporting completion.
