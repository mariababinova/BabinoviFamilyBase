# Document Automation Plan

## Goal

Make new medical documents flow through one reliable, auditable automation path:

- detect new documents placed into `04 Входящие/00 Новые файлы`;
- parse PDF/image/text contents into reviewable drafts;
- promote approved drafts into the family medical knowledge base;
- extract metrics, document-specific reference ranges, task candidates, doctor summaries, and generated site data;
- preserve explicit human approval for medical facts and recommendations;
- give Codex enough local tooling and credentials to run the process with minimal manual glue.

The desired operator experience is: add files, run one command from a clearly documented location, review only the items that need confirmation, then publish/deploy only after a separate privacy gate.

## Non-Goals

- Do not make diagnoses or clinical recommendations without explicit human review.
- Do not silently convert AI-extracted facts into canonical notes, `metrics.json`, `tasks.json`, or public/private published data unless the relevant review gate has passed.
- Do not invent reference ranges from generic internet norms when the document does not contain a reference.
- Do not automate public publish until the audience/access model is decided.
- Do not publish original PDF/JPG/PNG medical documents to a public static site.
- Do not remove the existing Obsidian/file-based source of truth.

## Safety Policy

Default rule: **human approval is required before AI-extracted medical facts become canonical**.

This means:

- AI-created intake drafts stay in `04 Входящие` until approved.
- New metric values and newly extracted reference ranges stay in `07 Показатели/metric_candidates.json` or another review surface until approved.
- New task recommendations stay in `08 Задачи/task_candidates.json` until approved.
- Auto-approval can be introduced only as a later, separately approved policy with fixtures, audit evidence, and a narrow allowlist.
- Existing deterministic derived views may be regenerated after approved source data changes, but the run report must show what review queues remain.

Publish rule: **local/private refresh and public deploy are separate operations**.

No automated publish step is allowed until the site audience/access model is decided. A publish command, when added, must run artifact validation and a privacy review of derived HTML/JSON, not only raw-file exclusion.

## Context And Evidence

- `06 Сайт/package.json:7-17` exposes the current site-local commands: `generate:data`, `agent:intake`, `agent:promote`, `agent:metrics`, `agent:tasks`, `agent:doctor-summaries`, `update:base`, and `agent:all`.
- The command currently exists under `06 Сайт`, not repo root. Existing intake docs also say commands run from `06 Сайт`.
- `06 Сайт/scripts/update-base.mjs:30-40` defines the current single-command pipeline: intake, promote, metric scan/apply/enrich, tasks, doctor summaries, generated data, asset validation.
- `06 Сайт/scripts/update-base.mjs:217-252` runs the individual agents in sequence and stops on failure.
- `update-base --dry-run` currently skips doctor summaries and generated data because those steps have no dry-run mode; it is a partial orchestration preview, not a full end-to-end proof.
- `06 Сайт/scripts/intake-agent.mjs:54-55` documents that `OPENAI_API_KEY` is required for PDF/image content extraction and `OPENAI_MODEL` is optional.
- `06 Сайт/scripts/intake-agent.mjs:417-418` hard-fails PDF/image reading when the OpenAI key is missing, unless the no-AI path is used.
- `06 Сайт/scripts/metrics-agent.mjs:47-49` keeps a three-step metrics workflow: scan candidates, apply approved candidates, enrich references.
- `06 Сайт/scripts/metrics-agent.mjs:840-853` imports only approved metric candidates into `metrics.json`.
- `07 Показатели/README.md` states the key medical rule: references come from the concrete lab document, not a global norm table.
- `08 Задачи/README.md` and `00 Главная/Памятка проекта для Codex.md` state that new task recommendations first go to `task_candidates.json`; confirmed tasks are separate.
- `00 Главная/Памятка проекта для Codex.md:13-14` documents local `/task-review` fallback and production `/api/tasks/review` using `MEDS_GITHUB_TOKEN`.
- `api/tasks/review.ts` and `06 Сайт/api/tasks/review.ts` use `MEDS_GITHUB_TOKEN` to write task review changes through GitHub.
- `06 Сайт/План реализации дашборда.md` says public builds must not expose original medical documents and notes GitHub Pages constraints.
- Baseline observed on 2026-05-18 from `C:\Users\Professional\Documents\Бабиновы\Медицинская база знаний\_github_MedsDataBase\06 Сайт` in a dirty worktree: `npm run update:base -- --dry-run` completed safe stages and reported `Metrics: 36`, `Metric references: 23/36`, `Task candidates: 1`; `npm run check` reported `0 errors, 0 warnings, 0 hints`.

## Proposed Direction

Use `update:base` as the orchestration spine, then harden it into a stateful automation system in three layers:

1. **Reliable local pipeline:** one command, honest dry-run behavior, step-level run manifests, resumability/reconciliation after partial failure, better summaries, and machine-readable run logs.
2. **Review-first extraction:** keep AI-assisted parsing, metric candidates, reference candidates, task candidates, and document drafts in review queues until explicitly approved.
3. **Optional automation shell:** add a local watcher and optional scheduled/private publish flows only after the command-line pipeline is deterministic, idempotent, and privacy-checked.

This keeps the shortest credible path: first make the manual command excellent, then make the trigger automatic.

## Workstreams

| ID | Workstream | Scope | Dependencies | Verification |
| --- | --- | --- | --- | --- |
| W1 | Pipeline Orchestrator Hardening | `06 Сайт/scripts/update-base.mjs`, command UX, run manifests | none | `cd "06 Сайт"; npm run update:base -- --dry-run`, no-write check, forced failure test, state inspection |
| W2 | Transaction And Recovery | step manifest, temp writes where feasible, reconciliation docs | W1 | Failure injection around step boundaries; failed run is recorded and resumable/reconcilable |
| W3 | Intake State And File Detection | `04 Входящие`, `intake-state.json`, file hashes, operation plans | W1-W2 | Add sample file, rerun, confirm no duplicate; inject failures after rename/draft/state save |
| W4 | AI Extraction Quality | `intake-agent.mjs`, prompt/schema handling, confidence/review reasons | W3 | Fixture docs produce stable person/date/type/metrics/reference fields and review evidence |
| W5 | Metrics Review And Reference Safety | `metrics-agent.mjs`, metric candidates, row-local reference evidence | W1-W4 | Approved candidates import; unapproved stay out; multi-row reference fixtures do not cross rows |
| W6 | Task Lifecycle | `tasks-agent.mjs`, task candidates, future `scan/apply` split | W1-W4 | New recommendations remain candidates; approved candidates become tasks; rejected stay out |
| W7 | Review Surfaces | file-based review minimum, optional metric review page/API | W5-W6 | User can see source evidence and approve/reject without editing unrelated fields |
| W8 | Site And Doctor Summary Refresh | `generate-data.mjs`, `doctor-summary-agent.mjs`, dashboard pages | W5-W7 | `npm run check`, `npm run build`, browser smoke test for metrics/tasks/documents |
| W9 | Tooling, Secrets, And Dependency Diagnostics | `.env.example`, env doctor, Python/PyMuPDF requirements | W1 | `npm run doctor:env` reports missing/available capabilities with masked secrets |
| W10 | Watcher And Scheduling | local watcher, lock/debounce, optional scheduled command | W1-W9 and integration proof | Dropping a file triggers one safe run; interrupted watcher run is recoverable |
| W11 | Publish Privacy Gate | artifact guard, derived-data leak scan, manual publish checklist | W8-W9 | Build has no raw docs; generated HTML/JSON do not expose disallowed raw text/paths; no auto-push |
| W12 | Observability And Reports | run logs, before/after counts, review links, failure summaries | W1-W11 | Each run leaves a concise report with links to review queues and verification artifacts |

## Minimum Review Surface

Before adding a polished UI, file-based review must be explicit and ergonomic:

- Intake drafts: open `04 Входящие/20 На проверке` or `04 Входящие/10 Черновики AI`; review person/date/type/source files, extracted metrics/tasks, confidence notes; set `status: approved` only after checking.
- Metric candidates: open `07 Показатели/metric_candidates.json` or `07 Показатели/Проверка показателей.md`; review value, unit, reference, source file, source text/window; set `status: approved`.
- Task candidates: open `/task-review` locally or `08 Задачи/task_candidates.json`; approve/reject only concrete actions for the family.
- Run report: after `update:base`, open the generated report in `09 Наблюдение` to see remaining review counts and failures.
- Allowed metric review edits: `status`, `review_comment`, reviewer/audit fields only; canonical data moves through `npm run agent:metrics -- apply`.
- Allowed task review edits: `status`/`candidate_status`/`review_status`, `review_comment`, and optional user overrides; confirmed tasks move through `npm run agent:tasks -- apply`.

## Data/API/UX/Infra Impacts

### Data

- Keep source-of-truth medical notes in `01 Члены семьи`.
- Keep intake state under `04 Входящие/intake-state.json` for file fingerprints and draft status.
- Keep automation run history under `09 Наблюдение/update-base-state.json` or a more explicit `09 Наблюдение/automation-runs.json`.
- Preserve candidate layers:
  - document drafts in `04 Входящие/10 Черновики AI` / `20 На проверке`;
  - metrics and references in `07 Показатели/metric_candidates.json` until approved;
  - tasks in `08 Задачи/task_candidates.json`.

### API

- Local command-line path remains primary.
- Production review APIs may write via GitHub only when `MEDS_GITHUB_TOKEN` is configured.
- Root `api/*` and `06 Сайт/api/*` duplication must be documented or consolidated before expanding review APIs.
- Chat/search APIs remain optional site features; they should not be required for document ingestion.

### UX

- The user should have one normal local command from the site folder: `cd "06 Сайт"; npm run update:base`.
- A root-level proxy command can be added later if repo-root execution is desired.
- The user should get one final report: what was added, what needs review, what failed, and what link/file to open next.
- Later, review screens should cover not only task candidates but also intake drafts and metric candidates.

### Infrastructure

- No public deploy should include raw medical files.
- Public deploy also needs derived-data privacy validation.
- CI can run validation/build, but AI extraction should usually remain local or private because it reads sensitive medical documents.
- Watcher/scheduler must guard against overlapping runs.

## Required Tools And Access

### MVP Required

| Tool / Key | Required For | Current Evidence | Safe Handling |
| --- | --- | --- | --- |
| Node.js 22 + npm | All site and agent scripts | `06 Сайт/package.json` | Normal local install |
| `OPENAI_API_KEY` | Full PDF/image intake extraction | `.env.example`, `intake-agent.mjs` | Local `.env` or private deployment env; never commit |
| `OPENAI_MODEL` | Extraction model choice | `intake-agent.mjs`, `.env.example` | Optional env var; default is usable |
| Python + PyMuPDF (`fitz`) | Embedded PDF text extraction for reference enrichment | `extract-pdf-text.py`; currently undocumented dependency | Add `requirements.txt` or env doctor check |
| Git | diff/review/publish workflow | repo is git-backed | Do not auto-push in MVP |

### Production/Private Deploy Optional

| Tool / Key | Enables | Safe Handling |
| --- | --- | --- |
| `MEDS_GITHUB_TOKEN` | Production task/metric review APIs and weight writes through GitHub | Fine-grained repo token, server-side only |
| `MEDS_GITHUB_REPO`, `MEDS_GITHUB_BRANCH` | Override default repo/branch | Server-side env |
| Vercel project | Serverless APIs, ChatKit, basic auth, private deployment | Store secrets in Vercel env |
| `OPENAI_CHATKIT_WORKFLOW_ID` | ChatKit session API | Server-side env |
| `SITE_AUTH_USERNAME`, `SITE_AUTH_PASSWORD` | Basic auth for private Vercel site | Server-side env |
| `MEDS_DOCUMENTS_PASSWORD`, `MEDS_ENCRYPTED_DOCUMENTS` | Encrypted document originals | Strong secret, never commit |

### Later Capabilities

| Tool | Use |
| --- | --- |
| Local OCR such as Tesseract | Offline fallback for scanned images/PDFs if OpenAI is unavailable |
| File watcher / scheduler | Auto-run the hardened local pipeline when files arrive |
| GitHub CLI / GitHub app | Assisted commit/PR/push after explicit publish approval |
| Browser automation | Local smoke tests after generated data changes |

## Risks And Failure Modes

| Risk | Why It Matters | Mitigation |
| --- | --- | --- |
| AI extracts a wrong metric or task | Medical data errors can mislead the family | Keep AI facts in candidates; require approval; preserve source text and file links |
| Reference range is copied from the wrong table row | Status color becomes misleading | Require row-local/window evidence, multi-row fixtures, and “Нет референса” when unsure |
| Pipeline writes partial derived state after failure | Site may show mixed old/new data | Step manifests before/after each step, temp writes, reconciliation/resume rules |
| Dry-run is not truly dry | User loses trust in automation | No-write filesystem/git checks; skipped planned-write stages are listed honestly |
| Intake failure after rename but before state save | Duplicate/untracked files can appear | Precomputed operation plans, idempotent state reconciliation, failure-injection tests |
| Watcher triggers multiple overlapping runs | Duplicate drafts/candidates or file contention | Lock file, debounce, and failed-run recovery before watcher is enabled |
| Public deploy exposes raw or derived sensitive data | Privacy breach | Artifact guard plus derived-data leak scan and manual privacy gate |
| Secrets leak in logs or files | API keys and medical data are sensitive | Never echo secret values; mask env diagnostics; keep `.env` ignored |
| Over-automation hides review work | User thinks everything is handled when review queues remain | Final report must show review counts and next files/pages to open |

## Verification Strategy

- `cd "06 Сайт"; npm run update:base -- --dry-run` for safe-stage orchestration only.
- No-write check for dry-run: before/after `git status --short` plus file mtime/hash snapshot of expected output files.
- Forced failure tests around orchestrator step boundaries and intake rename/draft/state-save boundaries.
- `cd "06 Сайт"; npm run update:base -- --no-ai` with text fixtures for an offline test path.
- `cd "06 Сайт"; npm run check` for Astro/TypeScript validation.
- `cd "06 Сайт"; npm run build` plus `node scripts/validate-pages-artifact.mjs` before publish.
- Data leak validation over generated HTML/JSON for raw document paths, OCR text, and configured sensitive directories.
- Browser smoke test on `/metrics`, one metric detail page, `/tasks`, `/task-review`, and `/documents`.

## Golden Path Acceptance Scenario

Use a synthetic non-private lab document fixture.

1. Place fixture in `04 Входящие/00 Новые файлы`.
2. Run `cd "06 Сайт"; npm run update:base`.
3. Confirm exactly one draft is created and a second run does not duplicate it.
4. Approve the draft.
5. Run `update:base` again.
6. Confirm metric/task candidates are created with source evidence but are not canonical until approved.
7. Approve one metric and one task candidate.
8. Run `update:base` again.
9. Confirm approved metric appears on `/metrics`, approved task appears on `/tasks`, unapproved candidates remain out.
10. Run build/artifact/privacy validation and confirm raw fixture files and disallowed extracted text are absent from public output.

## Open Questions

- Should the normal command also be available from repo root via proxy scripts, or is `cd "06 Сайт"` acceptable?
- Should approved intake drafts be promoted automatically once marked approved, or should promotion be a separately confirmed command?
- Which deployment target is primary now: GitHub Pages, Vercel, both, or local-only for sensitive views?
- Does the user want Codex to commit/push automatically after a successful private/local run, or only prepare changes and show a diff?

## Decisions Made

- Keep `update:base` as the main site-local command and `agent:all` as a synonym.
- Require human approval for AI-extracted medical facts by default.
- Separate local/private refresh from public deploy.
- Use document-specific reference ranges only; no global reference substitution.
- Treat external API keys as capability switches, not hard assumptions.
- Add watcher/scheduler only after the command-line pipeline is hardened and duplicate-safe.
- Document the normal operator command as `cd <resolved 06 *>; npm run update:base` so agents can follow ASCII-safe tracker paths while the user still works in the real `06 Сайт` folder.
- Keep the review points explicit: intake drafts, metric candidates, task candidates or `/task-review`, and `09 Наблюдение/update-base-state.json`.

## Unresolved Critic Findings

- None after revision 2; earlier P1/P2 critic findings were folded into safety policy, publish gate, dry-run scope, transaction/recovery workstreams, and tracker dependencies.
