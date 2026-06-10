# Design System

The design system for "База Бабиновых" is **Dark Family OS**: a dark, calm, premium private family medical operating system.

This document is normative for UI work. It applies to layouts, components, visual states, responsive behavior, and entity presentation.

## Product Language

- The UI language is Russian.
- Use precise Russian labels for navigation, actions, statuses, filters, empty states, and metadata.
- Avoid English placeholder words in production UI.
- Medical source/context labels should be explicit: `Источник`, `Дата`, `Документ`, `Прием`, `Задача`, `Диапазон`, `Динамика`.

## Design Personality

The interface should feel:

- dark;
- calm;
- premium;
- modern;
- structured;
- trustworthy;
- human;
- practical for daily family use.

The interface should not feel:

- generic admin dashboard;
- default template;
- cyberpunk;
- childish;
- retro;
- decorative;
- clinical and cold.

## Core Tokens

Use these tokens as the base palette for future CSS work:

```css
:root {
  --bg-main: #0E1217;
  --bg-sidebar: #0B0F14;

  --surface-1: #141A22;
  --surface-2: #19212B;
  --surface-3: #202A36;

  --border-soft: rgba(255, 255, 255, 0.08);
  --border-medium: rgba(255, 255, 255, 0.14);

  --text-main: #F4F7FA;
  --text-secondary: #A9B4C0;
  --text-muted: #6F7A86;
  --text-disabled: #4F5A66;

  --blue: #4F8CFF;
  --green: #4CD77D;
  --red: #FF5C5C;
  --yellow: #FFC83D;
  --violet: #A970FF;
}
```

## Color Rules

- Dark theme only.
- Use only five semantic accent colors:
  - blue: action, information, active navigation, selected state;
  - green: normal, success, completed, ready;
  - red: urgent, critical, dangerous abnormal result, delete;
  - yellow: warning, planned, upcoming, needs control;
  - violet: special, category, review, recognition, processing.
- Do not use random decorative colors.
- Do not use pink, turquoise, orange, or meaningless accent colors.
- Do not create one-off gradients for decoration.
- Do not rely on color alone for medical status; pair color with text, icon, label, or value.

## Surface Rules

Cards and panels should use:

- dark soft surfaces;
- subtle borders;
- rounded corners in the 16-24px range;
- soft shadows;
- enough spacing;
- clear hierarchy.

Avoid:

- heavy outlines;
- thick black borders;
- flat generic admin cards;
- random gradients;
- decorative backgrounds;
- meaningless icons;
- decorative top color strips on cards unless they express a real status.

## Typography

- Use a clear sans-serif UI style consistent with the existing project.
- Keep operational screens compact; avoid hero-scale type inside dashboards.
- Use strong hierarchy through weight, size, spacing, and color contrast.
- Do not use negative letter spacing.
- Prevent overflow for Russian family names, long medical terms, lab names, doctors, and clinics.

## Avatars And Photos

- All avatars and profile photos must be circular.
- Do not use square profile photos.
- Do not place huge portraits inside working dashboards.
- On profile pages, photos support identity but must not dominate medical priorities.
- If no photo is available, use a circular initials/avatar treatment with restrained color.

## Information Hierarchy

"Что важно сейчас" must be visually dominant on profile and medical summary screens.

Profile and medical summary hierarchy should be:

1. Person identity.
2. "Что важно сейчас".
3. Actions and urgent needs.
4. Recent changes.
5. Key indicators and trends.
6. Documents, appointments, observations, and tasks.
7. Historical or archived context.

## Entity Rules

### Person Profiles

Person profile pages must prioritize:

- who this is;
- what is important now;
- what needs action;
- what changed;
- where the information came from.

### Metrics

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

### Tasks

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

### Appointments

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

### Documents

Documents must show:

- date;
- type;
- person;
- processing status;
- linked event;
- extracted indicators;
- created tasks if any.

## Medical Context Rules

- Medical information must show source/context where possible.
- Lab results should show reference range when available.
- Abnormal or dangerous results must be visually distinct and textually explicit.
- Trends should be shown when historical values exist.
- A metric without a source should show that the source is missing rather than hiding the gap.
- Do not present interpretation as certainty unless the source data supports it.

## Desktop Patterns

Use:

- left sidebar;
- top search;
- sticky person profile header;
- horizontal tabs;
- cards for summaries;
- tables only where useful;
- right detail drawer for selected tasks, metrics, appointments, and documents.

Desktop layouts should feel dense but elegant. Avoid empty hero areas, oversized decorative imagery, and generic dashboard grids.

## Mobile Patterns

Use:

- bottom navigation;
- compact profile header;
- horizontal scrollable tabs;
- one-column cards;
- detail screens or bottom sheets;
- compact lists instead of desktop tables.

Mobile must be intentionally designed, not a squeezed desktop layout. Important actions, "Что важно сейчас", and urgent medical context must remain reachable without hunting through wide tables or hidden sidebars.

## Interaction Rules

- Search should feel fast, central, and command-palette friendly.
- Filters should be compact, resettable, and understandable in Russian.
- Use right drawers or detail screens for drill-down rather than overloading list rows.
- Selected, active, urgent, completed, upcoming, processing, and archived states must be visually clear.
- Use familiar symbols for actions where available, but do not add meaningless icons.

## Accessibility And QA

- Maintain strong text contrast on dark backgrounds.
- Do not rely on color alone for status.
- Focus states must be visible.
- Tap targets must be comfortable on mobile.
- Text must not overlap, clip awkwardly, or overflow containers.
- Test Russian content, long names, long doctor/clinic names, and long medical indicators.
