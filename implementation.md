# QA_Automation_Platform_Agent — Implementation Tracker

Source of truth: [SDD_QAA_architecture.md](./SDD_QAA_architecture.md)

Work is delivered **phase by phase**. A phase is started only after the previous phase is approved. Tasks are ticked when the phase is completed.

## Tracks

| Track                                | File                                                   | Order |
| ------------------------------------ | ------------------------------------------------------ | ----- |
| A — Core / Backend                   | this file                                              | 1     |
| B — Web app                          | [implementation-web.md](./implementation-web.md)       | 2     |
| C — Mobile app (React Native / Expo) | [implementation-mobile.md](./implementation-mobile.md) | 3     |
| D — Final (DX, E2E, CI)              | this file                                              | 4     |

## Confirmed decisions

- Application name: **QA_Automation_Platform_Agent**.
- LLM providers (UI dropdown, configured in `.env`): Groq, Cohere, OpenRouter. Voyage and Jina are reserved in `.env` for later embeddings/reranking, not in the UI.
- No database; file-based storage in `/specs`, `/automation`, `/reports` and a temporary `/.workspace`.
- Auto-healing via Playwright healer agent / MCP (bounded retries).
- Logo and title image: to be requested from the user before the web shell (W1).
- Footer: `© 2026 Aroun AI labs`.

## Track A — Core / Backend

### C0 — Foundation — ✅ Completed

- [x] Monorepo scaffold (npm workspaces: `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`)
- [x] TypeScript base config (`tsconfig.base.json`)
- [x] ESLint (flat config) and Prettier configuration, `.editorconfig`
- [x] `.env.example` (LLM providers, reserved Voyage/Jina, storage paths, target apps, mobile, heal, clients)
- [x] `.gitignore` / `.prettierignore`
- [x] Artifact folders: `specs/`, `automation/web|mobile`, `reports/execution-results`
- [x] Tracking files: `implementation.md`, `implementation-web.md`, `implementation-mobile.md`
- [x] Install dev tooling and verify lint/format run

### C1 — Backend core & LLM providers — ✅ Completed

- [x] Express app, config loader (`.env`), error handling, health endpoint
- [x] File-store module and ID generator (`SPEC-*`, `TC-*`)
- [x] Provider abstraction: Groq, Cohere, OpenRouter
- [x] `GET /api/providers` and per-request provider/model selection
- [x] Unit tests

### C2 — Intake, Spec & Test Case generation (§3.1–3.3) — ✅ Completed

- [x] User story intake API (story, acceptance criteria, priority, platform, target app)
- [x] Specification generator (Markdown + JSON)
- [x] Test case generator (no behavior beyond the spec)
- [x] Schema validation and persistence in `/specs`

### C3 — Approval gate API (§3.4) — ✅ Completed

- [x] Statuses: Draft, Under Review, Approved, Rejected, Needs Clarification
- [x] Transition rules and reviewer comments
- [x] `approval-record.json`
- [x] Rejected/clarification loop back to generation

### C4 — Playwright script generator (§3.5) — ✅ Completed

- [x] Only Approved test cases proceed
- [x] TypeScript + Page Object Model, test-data separation, stable selectors
- [x] Traceability comments (Spec ID / Test Case ID)
- [x] Web and mobile outputs to temporary workspace; Playwright config

### C5 — Automated validation & auto-heal (§3.6) — ✅ Completed

- [x] Static validation (tsc, lint, selector/import checks)
- [x] Dynamic validation (execution, screenshots, traces, console logs)
- [x] Specification conformance check
- [x] Playwright healer agent / MCP integration with bounded retries
- [x] Validation reports

### C6 — Repository service & quality gates (§3.7, §8) — ✅ Completed

- [x] Promote validated artifacts to `/specs`, `/automation`, `/reports`
- [x] Commits reference spec ID
- [x] Failed scripts stay in temporary workspace with failure report
- [x] Spec change triggers revalidation

## Track D — Final

### F1 — Developer experience (§5) — ⬜ Not started

- [ ] `.vscode/launch.json`, `settings.json`, `extensions.json`, `tasks.json`
- [ ] npm scripts: `test`, `test:headed`, `test:mobile`, `report`
- [ ] README and mobile device/emulator env configuration

### F2 — E2E on OrangeHRM, CI & hardening — ⬜ Not started

- [ ] Login sample story end-to-end
- [ ] GitHub Actions workflow
- [ ] Final documentation
- [ ] Confirm custom React app target scope
