# Family Places Migration Tracker

| ID | Lane | Owner Role | Status | Depends On | Write Scope | Task | Acceptance Evidence | Review/Test Gate | Notes |
|---|---|---|---|---|---|---|---|---|---|
| FP1 | Planning | main | completed | none | `plans/` | Capture migration plan and tracker in target repo. | `family-places-migration-plan.md` and this tracker exist. | Manual review. | No subagents used. |
| FP2 | Static module | main | completed | FP1 | `06 Сайт/public/family-places/` | Copy the complete places app from the source repo into target public assets. | Static files and thumbnails exist in target. | `node --check` and data parse. | Preserve relative links. |
| FP3 | Portal page | main | completed | FP2 | `06 Сайт/src/pages/places.astro` | Replace placeholder with embedded module and full-screen link. | `/places` references `pageHref("/family-places/")`. | Astro build. | Work with existing untracked placeholder. |
| FP4 | Styles | main | completed | FP3 | `06 Сайт/src/styles/global.css` | Add scoped embed shell styles. | Embed has stable responsive dimensions. | Astro build and visual smoke. | Avoid global reset conflicts. |
| FP5 | Docs | main | completed | FP2-FP4 | `docs/family-places-module.md` | Document update and verification process. | Doc names source, target, data file, and limitations. | Manual review. | Keep medical safety note. |
| FP6 | Verification | tester | completed | FP2-FP5 | none | Run syntax, data, build/diff checks. | Commands pass or blockers are recorded. | Required before commit. | Stage only migration files. |

## Integration Checkpoints

1. After FP2, copied `places.js` must still contain 65 places.
2. After FP3-FP4, `/places` must be base-path safe through `pageHref`.
3. Before commit, verify staged files do not include unrelated dirty medical-database work.
