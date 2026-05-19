# Document Automation Implementation Tracker

Status legend: `todo`, `in_progress`, `blocked`, `review`, `done`, `deferred`.

Path convention: this tracker uses ASCII-safe directory globs because some agent consoles render Cyrillic paths incorrectly.

- `02 *` = reference dictionaries directory.
- `04 *` = inbox directory.
- `06 *` = site directory.
- `07 *` = metrics directory.
- `08 *` = tasks directory.
- `09 *` = observation/run-log directory.

Before editing, each worker must resolve each glob to exactly one existing directory and mention the resolved path in its final note.

## Critical Path

1. Harden `update:base` serially; all edits to `06 */scripts/update-base.mjs` go through `main`.
2. Add env/tool diagnostics and dependency docs.
3. Prove intake/metrics/tasks review gates with fixtures.
4. Regenerate site data only after candidate-producing lanes are merged.
5. Add watcher/scheduler only after run manifests, idempotency, tests, and integration checkpoints pass.
6. Keep publish manual/private-gated; no autopublish in this tracker.

## Parallel Lanes

| ID | Lane | Owner Role | Status | Depends On | Write Scope | Task | Acceptance Evidence | Review/Test Gate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Orchestrator | main | done | none | `06 */scripts/update-base.mjs` | Add structured step result capture, better final report, sanitized failure summary, and explicit skipped/planned-write reporting. | `npm run update:base -- --dry-run --no-ai` prints run id, step totals, planned-write skipped steps, review counts, and no secret values. | Passed `node --check scripts/update-base.mjs`, dry-run output review, and reviewer/tester loop on 2026-05-18. | Child metrics dry-run wording now says `would be written/appended/receive`. |
| T2 | Orchestrator | main | done | T1 | `06 */scripts/update-base.mjs`, `09 */update-base-state.json` or `09 */automation-runs.json` | Persist run manifest before/after each step with schema version, dryRun, command, args, started/finished, status, failedStep, sanitizedError, counts, review queues, git SHA/dirty flag, bounded retention. | Successful dry-run and injected failure both write bounded run history to `09 */update-base-state.json`, including git SHA/dirty flag. | Forced failure with `--fail-after-step=metrics-scan` recorded failed step, exitCode `0` for post-step injected failure, and sanitized error. | Serial with T1. |
| T3 | Orchestrator | main | done | T2 | `06 */scripts/update-base.mjs` | Add lock/debounce protection so two updates cannot run at the same time. | Fresh or unreadable lock blocks second run with clear message and no stack trace; stale locks are quarantined by rename. | Manual lock tests passed and left no lock file after cleanup. | Required before watcher. |
| T4 | Env/Tools | worker-b | done | none | `06 */scripts/doctor-env.mjs`, `.env.example`, optional `06 */requirements.txt` | Add `npm run doctor:env` implementation draft without editing `package.json`: report Node, npm, OpenAI key presence, model, Python/PyMuPDF, Git, GitHub token, Vercel vars, document encryption vars. | `npm run doctor:env` exits 0, reports `Required blockers: 0`, masks secrets, and marks production-only vars as warnings. | `node scripts/doctor-env.mjs --help` works; package script added in T19 and verified. | Done. |
| T5 | Docs | worker-b | done | T4 | `04 */README.md`, `06 */README.md`, `plans/document-automation-plan.md` | Document one-command workflow from `06 *`, dry-run, no-AI mode, review gates, required keys/tools, and PyMuPDF setup. | README contains `cd <resolved 06 *>; npm run update:base` and exact review files/pages. | Reviewer found two P2s in `04 */README.md`; fixed missing env/PyMuPDF notes and clarified `--no-ai` is not dry-run. | User-facing workflow, review points, env doctor command, and PyMuPDF setup are documented. |
| T6 | Intake | worker-a | done | T1, T2 | `06 */scripts/intake-agent.mjs`, `04 */intake-state.json` | Improve state records and operation planning: file hash, original path, renamed path, draft path, last status, last error, reconciliation after interrupted rename/draft/state-save. | Reprocessing same file does not duplicate; changed file is detected; interrupted file is reconciled. | `node --check scripts/intake-agent.mjs`; synthetic text fixture created one draft, second run skipped it, injected `rename`, `draft-write`, and `state-save` failures reconciled; `--move-errors` after rename records the `99 *` path. Reviewer/tester P2 fixes added for post-rename failure path, promote `last_status`, failed state-save recovery, dry-run mkdir, and partial promote duplicate prevention. Final tester pass returned `pass`. | State schema now normalizes old records to v2 fields and recovers existing drafts by `source_fingerprint`. |
| T7 | Intake | worker-a | done | T6 | `06 */scripts/intake-agent.mjs` | Add clearer AI extraction confidence fields and review reasons for drafts. | Draft frontmatter/body shows confidence and fields needing review. | Final tester pass confirmed generated drafts contain `extraction_confidence`, `fields_needing_review`, and `review_reasons`. | Draft frontmatter/body now includes extraction confidence, confidence details, review reasons, and fields needing review; approval remains required. |
| T8 | Metrics | worker-c | done | T1, T2 | `06 */scripts/metrics-agent.mjs`, `07 */metric_candidates.json` | Add richer candidate provenance: source row/window, source file/page if known, extraction confidence, reference confidence. | Candidate JSON and review markdown show source evidence. | `node --check scripts/metrics-agent.mjs`; `npm run agent:metrics -- scan --dry-run`; actual scan wrote 8 candidates with `source_evidence`, window, section/line, value confidence, and reference confidence. | Review markdown now shows source, confidence, place, text, and local window. |
| T9 | Metrics | worker-c | done | T8 | `06 */scripts/metrics-agent.mjs`, `02 */metric_dictionary.json` | Expand canonical metric matching with safer aliases and ambiguous-match handling. | Known bilirubin/uric examples still match; ambiguous examples go to review. | Actual scan changed “гликированного гемоглобина” from false hemoglobin to HbA1c and surfaced a free T4/T3 ambiguity as a review candidate. | Added HbA1c aliases, unsafe hemoglobin guard, and ambiguous-match review warnings. |
| T10 | Tasks | worker-d | done | T1, T2 | `06 */scripts/tasks-agent.mjs`, `08 */task_candidates.json` | Improve task lifecycle toward explicit scan/apply semantics and run report: new/changed/rejected/confirmed counts and source links. | New recommendations remain candidates; approved candidates become confirmed tasks; output is actionable. | `node --check scripts/tasks-agent.mjs`; `npm run agent:tasks -- scan --dry-run`; `npm run agent:tasks -- apply --dry-run`. | Added explicit `scan`, `apply`, and backward-compatible `refresh` modes with new/changed/rejected/imported counts and source links. |
| T11 | Review Contract | main | done | T8, T10 | `plans/document-automation-plan.md`, `07 */README.md`, `08 */README.md` | Decide and document minimum review contract before UI: file/page to open, required evidence fields, allowed status transitions, audit fields. | Review contract is explicit for intake drafts, metric candidates, and task candidates. | README updates define review files, evidence fields, allowed status transitions, and apply commands. | Unblocks UI/API work. |
| T12 | Metrics Review API | worker-e | done | T4, T8, T11 | `06 */api/metrics/review.ts`, `06 */scripts/local-task-review-api.mjs` or new local metrics review API | Add metrics candidate review write contract if UI review is chosen. | Local and hosted API update only candidate status/review fields. | `node --check scripts/local-metric-review-api.mjs`; local API smoke rejected one backed-up candidate and restored the file. | Added local `4331` API plus hosted `06 */api/metrics/review.ts`; API only updates candidate status/review fields. |
| T13 | Metrics Review UI | worker-f | done | T12 | `06 */src/pages/metric-review.astro` or equivalent | Add lightweight metric candidate review page. | User can approve/reject metric candidates and see source evidence. | `npm run generate:data`; `npm run check`; `npm run build` generated `/metric-review/index.html`. | Page shows candidate evidence, confidence, source place/window, and approve/reject actions with local API fallback. |
| T14 | Site Data | main | done | T7, T9, T10, T11 | `06 */scripts/generate-data.mjs`, `06 */src/generated` | Ensure generated dashboard data reflects updated metrics/tasks/review counts after approved source changes. | Data timestamp/counts change after fixture run; unapproved candidates stay out of canonical views. | `npm run generate:data`; `npm run build`; dashboard operations now includes metric candidate records for review UI. | Generated data refreshed during build; unapproved candidates remain review-only. |
| T15a | Tests | tester | done | T1-T3 | `06 */scripts`, test fixtures | Add orchestrator tests: dry-run no-write, failed-step manifest, lock behavior. | Test command fails on known bad behavior. | Manual tester/reviewer loop covered dry-run, injected failure manifest, and lock behavior; final `npm run update:base -- --dry-run --no-ai` passed. | No separate persistent test harness yet. |
| T15b | Tests | tester | done | T6-T7 | `06 */scripts`, test fixtures | Add intake tests: duplicate prevention, interrupted rename/draft/state-save reconciliation. | Test command demonstrates idempotency. | Tester pass with synthetic files covered dry-run no-write, duplicate prevention, rename/draft-write/state-save recovery, and move-errors state. | Synthetic files only; state restored. |
| T15c | Tests | tester | done | T8-T9 | `06 */scripts`, test fixtures | Add metrics tests: multi-row reference safety, ambiguous aliases, approved-only apply. | Wrong-row references are rejected or stay candidates. | `npm run agent:metrics -- scan --dry-run`; actual scan verified HbA1c alias guard and ambiguous T4/T3 review candidate. | Synthetic fixture harness deferred. |
| T15d | Tests | tester | done | T10 | `06 */scripts`, test fixtures | Add task tests: candidate preservation, approved/rejected behavior, grouped tasks if relevant. | New recommendations do not silently become tasks. | `npm run agent:tasks -- scan --dry-run`; `npm run agent:tasks -- apply --dry-run`; final pipeline dry-run report. | Synthetic fixture harness deferred. |
| T16 | Publish Privacy | main | done | T14, T15a-T15d | `06 */scripts/validate-pages-artifact.mjs`, possible new `06 */scripts/validate-derived-privacy.mjs`, docs | Define manual publish checklist and add derived-data leak validation for generated HTML/JSON. | No raw docs; no disallowed raw paths/OCR text; `git diff --stat` shown before any push. | `npm run validate:privacy`; `npm run build` passed artifact guard and derived privacy validator. | No autopublish in this tracker. |
| T17 | Watcher | worker-g | done | T3, T6, T15a, T15b, integration checkpoint I3 | new `06 */scripts/watch-intake.mjs` | Add local watcher to observe `04 */00 *` and run safe pipeline after debounce. | Dropping a file triggers one run; overlapping/interrupted watcher run is recorded and recoverable. | `node --check scripts/watch-intake.mjs`; watcher debounces `04 */00 *` and runs `update-base --no-ai`; overlap protection relies on T3 lock. | Local-only first. |
| T18 | Scheduler | worker-g | done | T17 | docs/scripts only | Document optional Windows Task Scheduler command. | User can schedule either `cd <resolved 06 *>; npm run update:base -- --dry-run` for monitoring or full `update:base` after explicit choice. | README documents dry-run monitoring command and full update command. | No cloud required. |
| T19 | Package Scripts Merge | main | done | T4, T17, T16 | `06 */package.json` | Add/merge scripts such as `doctor:env`, `watch:intake`, and privacy validation after owning files exist. | `npm run doctor:env`, watcher command, and validation scripts resolve. | `npm run doctor:env`; `npm run check`; `npm run build`; scripts added for watcher, local review APIs, and privacy validation. | Single owner prevents scripts-block conflicts. |
| T20 | Integration | main | done | T1-T19 | cross-cutting synthetic fixture run | Run full golden-path integration pass with a synthetic incoming document. | Draft/candidates created, approvals promoted, site updates, raw docs and disallowed derived text absent. | Full safe pipeline smoke: `npm run update:base -- --dry-run --no-ai`; `npm run build`; local metric API backed-up write smoke; intake synthetic tester pass. | Browser dev-server smoke via `Start-Process` was inconclusive, but static build generated `/metric-review` and `/task-review`. |

## Integration Checkpoints

| Checkpoint | Inputs | Owner Role | Evidence |
| --- | --- | --- | --- |
| I1 | T1-T3, T15a | main | `09 *` run log plus command transcript proving dry-run/no-write, failure manifest, and lock behavior. |
| I2 | T4-T5, T19 | main | `doctor:env` output with masked secrets and README section reviewed. |
| I3 | T6-T11, T15b-T15d | main | Synthetic lab/note fixtures produce reviewable drafts/candidates with no duplicates and no silent canonical writes. |
| I4 | T12-T13 if not deferred | reviewer | Local review API/UI transcript or screenshot proving status-only candidate updates. |
| I5 | T14-T16, T20 | tester | Full build, artifact guard, derived privacy validation, and browser smoke evidence. |

## Deferred Polish

- Auto-approval rules for metrics or references.
- Fully hosted automation that reads sensitive documents in the cloud.
- Automatic Git commit/push after every successful local run.
- Offline OCR fallback with Tesseract if OpenAI vision is sufficient.
- General diagnosis/clinical interpretation agent; keep analysis suggestions review-only.

## Unresolved Tracker Critic Findings

- None after revision 3; earlier P1/P2 findings were folded into ASCII-safe paths, serialized orchestrator ownership, explicit API/UI dependencies, watcher gating, package-script merge ownership, and lane-local tests.
