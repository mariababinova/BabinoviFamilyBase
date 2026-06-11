# UI Reference

This document defines product and UX references for "База Бабиновых". These references are inspiration for behavior, hierarchy, density, and mood, not pixel-perfect copies.

The app must remain its own product: a Russian-language private family knowledge base and medical family operating system.

## Visual Freeze

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

## Primary Direction

Name: **Dark Family OS**.

The product should feel like:

- a private family archive;
- a medical document index;
- a health indicators and appointments workspace;
- a task and follow-up system;
- a knowledge base that can be used daily.

It should not feel like:

- a generic admin dashboard;
- a default template;
- a decorative portfolio;
- a clinical hospital portal;
- a playful family scrapbook.

## Reference: Linear

Borrow:

- compact sidebar;
- right detail drawer;
- dense but elegant layouts;
- task/status systems;
- calm product feel.

Do not copy Linear visually. Use it as a reference for structure, scanning, detail drawers, issue/task flow, and restrained density.

## Reference: Notion

Borrow:

- knowledge base structure;
- linked entities;
- clear page blocks;
- calm metadata and notes.

Do not copy Notion page chrome. Use it as a reference for readable blocks, connected records, calm document context, and durable organization.

## Reference: Apple Health

Borrow:

- health indicators;
- lab result status against reference ranges;
- trends;
- interpretation;
- source documents.

Do not copy Apple Health visuals literally. Use it as a reference for medical clarity: value, unit, date, range, interpretation, source, and trend should be easy to understand.

## Reference: Raycast

Borrow:

- command palette;
- grouped search results;
- quick actions;
- keyboard-first search.

Do not copy Raycast chrome literally. Use it as a reference for fast retrieval, grouped results, keyboard flow, and action-oriented search.

## Global Entity Model

The UI should make relationships visible:

- person -> documents;
- person -> appointments;
- person -> indicators;
- person -> observations;
- person -> tasks;
- document -> extracted indicators;
- appointment -> recommendations, prescriptions, tasks, documents;
- abnormal indicator -> source, trend, follow-up task.

## Person Profile Screens

Person profile pages must prioritize:

- who this is;
- what is important now;
- what needs action;
- what changed;
- where the information came from.

"Что важно сейчас" should be the dominant working block on profile and medical summary screens. It should not be visually buried below decorative identity content.

Recommended structure:

1. Compact sticky profile header with circular avatar/photo.
2. Dominant "Что важно сейчас" section.
3. Action items and urgent medical flags.
4. Recent changes.
5. Key metrics and trends.
6. Tabs for documents, appointments, tasks, indicators, observations, and notes.
7. Right detail drawer on desktop for selected entities.

## Metrics

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

Metric drill-down should answer:

- Is this normal, abnormal, urgent, or unclear?
- Compared with what reference range?
- What changed over time?
- Which document or appointment produced this value?
- Is there a related task or follow-up?

## Tasks

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

Task drill-down should support status changes, notes, checklist review, related entities, and next action without requiring page navigation on desktop.

## Appointments

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

Appointment drill-down should connect the visit to follow-up tasks, prescriptions, indicators, source documents, and the person profile.

## Documents

Documents must show:

- date;
- type;
- person;
- processing status;
- linked event;
- extracted indicators;
- created tasks if any.

Document drill-down should expose processing state, extracted medical facts, linked appointment or event, and follow-up tasks.

## Desktop Patterns

Use:

- left sidebar;
- top search;
- sticky person profile header;
- horizontal tabs;
- cards for summaries;
- tables only where useful;
- right detail drawer for selected tasks, metrics, appointments, documents.

Desktop screens should support rapid scanning and drill-down. The user should be able to select a task, document, metric, or appointment and see detail without losing list context.

## Mobile Patterns

Use:

- bottom navigation;
- compact profile header;
- horizontal scrollable tabs;
- one-column cards;
- detail screens or bottom sheets;
- compact lists instead of desktop tables.

Mobile is not a squeezed desktop layout. Mobile screens must preserve the key flow: identify person, see "Что важно сейчас", review urgent items, search, and drill into details.

## Visual Guardrails

- Dark theme only.
- Circular avatars and profile photos only.
- Five semantic accent colors only: blue, green, red, yellow, violet.
- No pink, turquoise, orange, or meaningless accent colors.
- No thick black borders.
- No decorative top color strips unless tied to real status.
- No huge portraits in working dashboards.
- No random decorative colors, gradients, or backgrounds.
- No generic dashboard cards with vague icons and fake metrics.
- No text overflow in Russian labels, names, or medical terms.

## Reference Assets

Images and notes in `design/references/` are conceptual references only. Use them for information architecture, module logic, drill-down pages, data structure, and UX patterns. Do not use them as mandatory visual targets or as a reason to redesign the accepted current dark interface unless the user explicitly asks.
