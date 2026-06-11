# Family Places Migration Plan

## Goal

Migrate the existing Family Hub places database into `Ulyana19svlv/MedsDataBase` as the `Места` section of the larger family knowledge portal, while preserving the medical database, current portal navigation work, and the full places app behavior.

## Context And Evidence

- Target repo: `C:\Users\Professional\Documents\Бабиновы\Медицинская база знаний\_github_MedsDataBase`, remote `https://github.com/Ulyana19svlv/MedsDataBase.git`.
- The target site is an Astro app under `06 Сайт/`.
- `06 Сайт/src/pages/places.astro` already exists as a placeholder.
- `06 Сайт/src/layouts/AppLayout.astro` already includes portal navigation with a `Места` item.
- The source places app is in `C:\Users\Professional\Documents\New project 6\site/` and contains:
  - 65 places in `site/places.js`.
  - Visit status and impressions stored in localStorage.
  - Yandex map, filters, city/category chips, media cards, and inbox tooling.
- The target repo has unrelated existing dirty work. This migration must not revert or rewrite that work.

## Proposed Direction

Use a low-risk embedded static module:

1. Copy the existing places app into `06 Сайт/public/family-places/`.
2. Replace the placeholder Astro `/places` page with a portal page that embeds the static module in an iframe and links to a full-screen version.
3. Add small scoped styles for the embedded module shell.
4. Add documentation for future maintainers explaining where places data lives and how to update it.

This avoids rewriting the app into Astro components during migration and keeps the medical database untouched.

## Workstreams

### Static Module

- Copy `index.html`, `app.js`, `places.js`, `styles.css`, `tokens.css`, `inbox.html`, `inbox.css`, and thumbnail assets into `06 Сайт/public/family-places/`.
- Keep relative links inside the copied app so it can run as a self-contained static app.
- Preserve localStorage keys for visit notes.

### Portal Integration

- Update `06 Сайт/src/pages/places.astro` to embed `/family-places/`.
- Use `pageHref()` for base-path-safe URLs on Vercel and GitHub Pages.
- Keep AppLayout navigation intact.

### Documentation

- Add `docs/family-places-module.md` with source, target, update process, verification, and limitations.

## Data/API/UX/Infra Impacts

- Data: no schema change; data remains in `window.SECRET_MOSCOW_PLACES`.
- UX: `/places` becomes the Family Hub entry; full-screen static app is available at `/family-places/`.
- Notes: local visit status and impressions remain browser-local.
- Map: Yandex Maps API remains client-side in `app.js`.
- Infra: no new backend or package dependency.

## Risks And Failure Modes

- Iframe nesting can feel cramped on small screens. Mitigation: provide a full-screen link and make the embed height responsive.
- Source and target can drift. Mitigation: document source-of-truth and update process.
- Existing dirty target work can be accidentally staged. Mitigation: stage only migration files.

## Verification Strategy

- Run JavaScript syntax checks on copied `app.js` and `places.js`.
- Parse copied `places.js` and verify 65 places, all with `city`, no duplicate ids.
- Run `npm run build` in `06 Сайт` if current dirty repo state allows it; otherwise report the exact blocker.
- Run `git diff --check`.
- Inspect `git diff --name-status` before staging.

## Open Questions

- Whether the places app should later be rewritten as native Astro components.
- Whether visit notes should later sync across devices.

## Decisions Made

- Preserve the static places app for this migration.
- Do not touch medical documents or generated medical data.
- Do not use subagent critic loops; explicit subagent permission was not granted.
