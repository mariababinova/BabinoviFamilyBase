# Dark Family OS Preview Rebuild Plan

## Goal

Rebuild the temporary `/design-preview` visual spike so it reads like the reference images in `design/references/`, especially `01-dashboard-dark.png`, rather than like the existing app with darker tokens.

The preview must remain a standalone Astro route. It must not replace the current home page, modify production UI components, install packages, commit, or push.

## Context And Evidence

- Stack evidence: `06 Сайт/package.json` uses Astro and CSS. The work must stay in this stack.
- Normative docs read: `AGENTS.md`, `docs/design-system.md`, `docs/ui-reference.md`, `.agents/skills/dark-family-os-ui/SKILL.md`.
- Reference evidence:
  - `01-dashboard-dark.png`: dense OS dashboard, compact left sidebar, centered search, KPI-like "Что важно сейчас", family cards, right summary widgets, event feed, mobile app view.
  - `02-profile-summary.png`: profile hierarchy and compact priority rows.
  - `04-metrics-expanded.png`: selected metric drawer pattern with value, source, interpretation, history, documents, tasks.
- Current implementation issue: `06 Сайт/src/pages/design-preview.astro` still looks too much like a generic dark dashboard with a large constant drawer and alert cards.

## Proposed Direction

Replace the preview composition, not just styling:

- Make the first viewport a compact family OS dashboard.
- Make `Что важно сейчас` a KPI/status strip with clear numbers and compact labels, not large promotional alert cards.
- Place family profiles and operational widgets in the same hierarchy as the reference: family cards as the main body, metrics/tasks as a right summary column.
- Keep a visible selected metric detail rail, but make it a quieter right-side drill-down pattern aligned with the metrics reference, not the dominant dashboard object.
- Make mobile a separate flow: compact search/person header, profile card, `Что важно сейчас`, metrics/tasks lists, bottom nav, and selected metric as a bottom-sheet-like section.

## Workstreams

| Stream | Scope | Acceptance |
| --- | --- | --- |
| Structure | `06 Сайт/src/pages/design-preview.astro` | Markup reflects reference composition: sidebar, search, KPI strip, family cards, summary widgets, event feed, detail rail. |
| Visual Fidelity | Scoped CSS in `design-preview.astro` | Dark soft surfaces, subtle borders, 5 semantic colors, circular avatars, dense but calm spacing. |
| Mobile | Scoped CSS in `design-preview.astro` | At 390px, sidebar is gone, bottom nav exists, first screen shows compact family/priority context without bottom nav overlap. |
| Verification | Commands and screenshots | `npm run check`, route returns 200, fresh screenshots at desktop/mobile sizes. |
| Critique | Read-only subagents | Multiple UI/UX critics take their own screenshots and report P0-P3 findings against references. |

## Risks And Failure Modes

- Keeping the drawer too strong will make the page feel unlike the dashboard reference.
- Large alert cards will preserve the old failure mode.
- Overusing colored backgrounds will violate the semantic palette and make the UI noisy.
- Mobile can regress into a squeezed desktop layout if the DOM order and spacing are not intentionally changed.
- Long Russian medical labels can overflow compact cards.

## Verification Strategy

- Run `npm run check` from `06 Сайт`.
- Verify `http://127.0.0.1:4321/MedsDataBase/design-preview` returns 200.
- Capture fresh screenshots at `1600x1000`, `1440x900`, `390x844`, and `390x1100`.
- Compare visually against `01-dashboard-dark.png`, `02-profile-summary.png`, and `04-metrics-expanded.png`.
- Spawn multiple read-only UI/UX critics after implementation. They must take their own screenshots and return severity-tagged findings.
- Treat P0-P2 findings as requiring fixes or explicit evidence-backed rejection.

## Decisions Made

- Rebuild only `/design-preview`.
- Preserve existing data and production pages.
- Use existing assets where available; otherwise circular initials placeholders.
- No package installs, no stack changes, no commit/push.

