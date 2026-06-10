---
name: dark-family-os-ui
description: Use this skill whenever implementing, refactoring, or reviewing UI for "База Бабиновых", especially dark theme, family medical dashboards, person profiles, tasks, indicators, appointments, documents, mobile layouts, and visual QA.
---

# Dark Family OS UI

Use this skill for UI implementation, refactoring, review, and visual QA in "База Бабиновых".

## Required Context

Before changing or reviewing UI:

1. Read `AGENTS.md`.
2. Read `docs/design-system.md`.
3. Read `docs/ui-reference.md`.
4. Inspect `design/references/` if images or notes exist.
5. Inspect the current Astro and CSS patterns before editing.

Keep the existing stack. This repository uses Astro and CSS conventions. Do not convert to Next.js, React, shadcn/ui, Tailwind, or another stack unless the user explicitly asks.

## Product Target

Build and preserve **Dark Family OS**: a dark, calm, premium Russian-language family medical operating system.

The UI should feel structured, trustworthy, human, modern, and practical for daily use. It must not feel like a generic admin dashboard, default template, cyberpunk interface, childish app, retro theme, decorative site, or cold clinical portal.

## Mandatory Visual Rules

- Dark theme only.
- Circular avatars and profile photos only.
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
- Make "Что важно сейчас" visually dominant on profile and medical summary screens.
- Show medical source/context where possible.
- Design mobile intentionally rather than squeezing desktop layouts.

## Entity Requirements

Person profile pages must prioritize who this is, what is important now, what needs action, what changed, and where the information came from.

Metrics must show name, value, unit, status, date, source, reference range when available, dynamics/trend, linked documents, and linked tasks.

Tasks must show title, priority, deadline, checklist when relevant, related appointment, related doctor, related documents, notes, and clear actions.

Appointments must show date and time, doctor, specialty, clinic/source, status, complaints, summary, recommendations, prescriptions, related tasks, related documents, and related indicators.

Documents must show date, type, person, processing status, linked event, extracted indicators, and created tasks if any.

## Layout Patterns

Desktop should prefer:

- left sidebar;
- top search;
- sticky person profile header;
- horizontal tabs;
- summary cards;
- tables only where useful;
- right detail drawer for selected tasks, metrics, appointments, and documents.

Mobile should prefer:

- bottom navigation;
- compact profile header;
- horizontal scrollable tabs;
- one-column cards;
- detail screens or bottom sheets;
- compact lists instead of desktop tables.

## UI References

Use references as inspiration only:

- Linear for compact sidebar, right detail drawer, dense elegant layouts, and task/status systems.
- Notion for knowledge-base structure, linked entities, clear page blocks, metadata, and notes.
- Apple Health for indicators, reference ranges, trends, interpretation, and source documents.
- Raycast for command palette, grouped search, quick actions, and keyboard-first search.

Do not copy any reference pixel-perfect.

## Visual QA Checklist

Before finishing meaningful UI work, verify:

- the UI remains dark theme only;
- no app screens look like a generic admin dashboard;
- avatars and profile photos are circular;
- only blue, green, red, yellow, and violet are used as semantic accents;
- no pink, turquoise, orange, random gradients, decorative backgrounds, or meaningless icons were introduced;
- "Что важно сейчас" is dominant on profile and medical summary screens;
- medical data shows date, source/context, status, and reference range where available;
- desktop supports sidebar, search, tabs, and right-detail drill-down where relevant;
- mobile has intentional navigation, one-column structure, and usable detail behavior;
- Russian labels, names, doctors, clinics, and medical terms do not overflow;
- focus, hover, selected, urgent, completed, processing, and empty states are clear;
- no existing Astro/CSS conventions were replaced by another framework.

Run existing checks and browser verification when available and appropriate. Do not install packages, commit, or push unless explicitly requested.
