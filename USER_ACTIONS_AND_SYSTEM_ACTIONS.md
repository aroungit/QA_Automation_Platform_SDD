# QA Automation Platform — Step-by-Step User & System Actions Reference Guide

This document is the operational and functional reference guide for the **QA_Automation_Platform_Agent** (Spec-Driven Development — SDD QA Automation Platform). It details every step in the platform lifecycle, clearly contrasting **User Actions** (inputs, decisions, trigger events) with **System Actions** (internal workflows, LLM generation, validations, file system operations, and quality gates).

---

## Architecture & Lifecycle Overview

The platform strictly enforces the **Spec-Driven Development (SDD)** lifecycle:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  1. Story       │  ───► │  2. Spec & TCs  │  ───► │  3. Human       │
│     Intake      │       │     Generation  │       │     Approval    │
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │
                  ┌──────────────────────────────────────────┘
                  ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  4. Playwright  │  ───► │  5. Automated   │  ───► │  6. Quality     │
│     Generation  │       │     Validation  │       │     Gate & Repo │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

**Cardinal Rule (§2, §8):** No Playwright script is stored in the repository unless it traces to an approved specification, covers only approved test cases, passes static and dynamic execution, has execution evidence preserved, and satisfies all 8 quality gates.

---

## Global Pre-requisite: LLM Provider & Theme Selection

### Context
Users can select their preferred active LLM provider and model, as well as customize their interface theme (light/dark) across both Web and Mobile platforms.

### Step-by-Step Matrix

| # | Step Name | User Action | System Action |
|---|-----------|-------------|---------------|
| **0.1** | **LLM Provider Selection** | • Clicks on the LLM dropdown in the header.<br>• Chooses a provider (`Groq`, `Cohere`, or `OpenRouter`).<br>• Chooses an available model from that provider. | • Queries `GET /api/providers` to fetch configured providers and supported models.<br>• Saves preferences in local storage (`qaa-selected-provider`, `qaa-selected-model`).<br>• Automatically injects `x-llm-provider` and `x-llm-model` HTTP headers into all subsequent API requests. |
| **0.2** | **Theme Toggle** | • Clicks the Dark / Light theme toggle button in the header. | • Updates HTML class (`dark` or default).<br>• Persists theme setting in local storage (`qaa-theme`).<br>• Respects OS/system preferences by default (`prefers-color-scheme`). |

---

## Phase 1: User Story Intake (§3.1)

### Objective
Accept high-level business requirements and user stories to initialize a new traceable specification unit.

### Step-by-Step Matrix

| # | Step Name | User Action | System Action |
|---|-----------|-------------|---------------|
| **1.1** | **Access Intake Screen** | • Navigates to `/intake` via navigation menu or dashboard CTA button (*"Start New Story Intake"*). | • Loads intake form and checks backend API health via `GET /api/health`.<br>• Displays active LLM model indicator and the 5-step SDD workflow progress indicator. |
| **1.2** | **Provide Story Details** | • Enters **Feature Title** (e.g., *"Employee Search by Name & Role"*).<br>• Enters **User Story** in agile format (*As a... I want to... So that...*).<br>• Enters one or more **Acceptance Criteria** lines.<br>• Selects **Target Application** (e.g., *OrangeHRM* or *Custom React App*).<br>• Selects **Target Platform** (`web`, `mobile`, or `both`).<br>• Selects **Priority** (`critical`, `high`, `medium`, or `low`).<br>• *(Optional)* Customizes specification ID slug. | • Validates fields client-side against Zod schema `UserStoryIntakeRequestSchema`.<br>• Dynamic UI adds/removes acceptance criteria fields.<br>• Validates that at least one acceptance criterion is present. |
| **1.3** | **Trigger Intake Submission** | • Clicks **"Submit User Story"** or **"Submit & Autogenerate Spec & Test Cases"**. | • Dispatches `POST /api/specs/intake`.<br>• Generates a unique, collisions-free Specification ID (e.g., `SPEC-EMP-SEARCH-001`).<br>• Creates isolated directory `/specs/<SPEC_ID>/`.<br>• Persists `user-story.md` and `user-story.json`.<br>• Initializes empty/draft `approval-record.json` with status `Draft`.<br>• If autogenerate was requested, immediately cascades into Phase 2.<br>• Redirects user to `/specs/<SPEC_ID>`. |

---

## Phase 2: Specification & Test Case Generation (§3.2, §3.3)

### Objective
Transform unstructured user requirements into formal system specifications and derived candidate test cases.

### Step-by-Step Matrix

| # | Step Name | User Action | System Action |
|---|-----------|-------------|---------------|
| **2.1** | **Generate Specification** | • From `/specs/:specId`, clicks **"Generate Specification"** (or was triggered automatically).<br>• *(Optional)* Provides custom guidance or feedback in prompt box. | • Calls `POST /api/specs/:specId/generate-spec`.<br>• Sends prompt containing User Story + Acceptance Criteria to selected LLM.<br>• LLM parses requirements and formats formal specification sections:<br>&nbsp;&nbsp;• Business Objective & Actors<br>&nbsp;&nbsp;• Preconditions<br>&nbsp;&nbsp;• Main flow steps (Action + Expected)<br>&nbsp;&nbsp;• Alternate & Exception flows<br>&nbsp;&nbsp;• Data requirements & Non-functional specs.<br>• Validates output against `SpecificationSchema`.<br>• Saves `/specs/:specId/specification.md` and `specification.json`.<br>• Broadcasts completion and renders tab. |
| **2.2** | **Inspect Specification** | • Clicks on the **Specification** tab to inspect actors, main flows, exception handling, and preconditions. | • Renders formatted markdown viewer with collapsible flow sections and structured data tables. |
| **2.3** | **Generate Test Cases** | • Clicks **"Generate Candidate Test Cases"**.<br>• *(Optional)* Provides specific testing focus (e.g., boundary values, negative flows). | • Calls `POST /api/specs/:specId/generate-test-cases`.<br>• Prompts LLM using `specification.json` as the strict boundary (enforcing: *no test cases beyond specification scope*).<br>• LLM generates test cases with:<br>&nbsp;&nbsp;• Unique IDs (`TC-<SPEC_ID>-001`, `TC-...-002`)<br>&nbsp;&nbsp;• Clear preconditions & ordered steps<br>&nbsp;&nbsp;• Expected assertion points<br>&nbsp;&nbsp;• Priority, type (functional, negative, boundary), and suitability (`automatable`, `manual-only`).<br>• Validates output against `TestCaseSchema[]`.<br>• Saves `/specs/:specId/test-cases.md` and `test-cases.json`.<br>• Sets approval status to `Under Review`. |
| **2.4** | **Review Generated Test Cases** | • Clicks **Test Cases** tab to inspect all generated cases.<br>• Expands individual test case cards to examine step-by-step actions and expected outcomes. | • Renders test case cards / table with metadata badges (Priority, Type, Platform, Automation Suitability).<br>• Displays Next-Stage Banner pointing user to Stage 3: Human Approval Gate. |

---

## Phase 3: Human Approval Gate (§3.4)

### Objective
Mandate a human quality engineer sign-off on test cases prior to script generation. Prevent unauthorized functional drift.

### Step-by-Step Matrix

| # | Step Name | User Action | System Action |
|---|-----------|-------------|---------------|
| **3.1** | **Open Approval Gate** | • Navigates to `/approval?specId=<SPEC_ID>` directly or via the workflow banner. | • Calls `GET /api/specs/:specId`, `GET /api/specs/:specId/approval`, and `GET /api/specs/:specId/approval/can-proceed`.<br>• Renders review interface showing candidate test cases with selection checkboxes, approval status badge, and reviewer comment history. |
| **3.2** | **Review Test Cases** | • Inspects each test case for accuracy, coverage, and stability.<br>• Selects checkboxes for test cases deemed valid for automation (or uses *"Select All"*). | • Computes live tally of selected test cases vs total test cases.<br>• Displays warnings if zero test cases are selected. |
| **3.3A** | **Decision: Approve** | • Enters Reviewer Name (e.g., *"QA Lead"*).<br>• Enters review comments (e.g., *"All 5 test cases verified against criteria"*).<br>• Clicks **"Approve Selected Test Cases"**. | • Calls `POST /api/specs/:specId/approval` with status `Approved`.<br>• Saves `approval-record.json` with:<br>&nbsp;&nbsp;• Status: `Approved`<br>&nbsp;&nbsp;• Timestamp and reviewer details<br>&nbsp;&nbsp;• List of approved test case IDs (`approvedTestCases: [...]`)<br>&nbsp;&nbsp;• Appends entry to `history[]`.<br>• Checks `can-proceed`: marks spec eligible for script generation.<br>• Displays success banner with button to advance to **Stage 4: Validation**. |
| **3.3B** | **Decision: Needs Clarification or Reject** | • Enters reviewer notes describing ambiguities or missing assertions.<br>• Clicks **"Request Clarification"** or **"Reject"**. | • Saves `approval-record.json` with status `Needs Clarification` or `Rejected`.<br>• Blocks downstream Playwright script generation.<br>• Displays loopback panel allowing one-click regeneration with reviewer feedback. |
| **3.4** | **Trigger Loopback Regeneration** *(If Rejected/Clarification)* | • In the loopback panel, chooses target stage (`spec`, `test-cases`, or `all`).<br>• Enters specific feedback instructions.<br>• Clicks **"Submit Feedback & Regenerate"**. | • Calls `POST /api/specs/:specId/approval/loopback`.<br>• Resets approval status to `Draft`.<br>• Re-prompts LLM with original content plus reviewer critique.<br>• Overwrites specifications and/or test cases with corrected artifacts.<br>• Sets status back to `Under Review` for re-inspection. |

---

## Phase 4: Playwright Script Generation (§3.5)

### Objective
Translate approved test cases into production-grade Playwright TypeScript scripts using Page Object Model (POM) in a quarantined workspace.

### Step-by-Step Matrix

| # | Step Name | User Action | System Action |
|---|-----------|-------------|---------------|
| **4.1** | **Initiate Script Generation** | • Navigates to `/validation?specId=<SPEC_ID>`.<br>• Clicks **"Generate Playwright Scripts"** button.<br>• *(Optional)* Toggles *"Clean workspace before generation"*. | • Verifies approval gate via `canProceedToScriptGeneration()`.<br>• Rejects request with HTTP 403 if status is not `Approved`.<br>• Dispatches `POST /api/specs/:specId/generate-scripts`. |
| **4.2** | **Code Synthesis & Workspace Creation** | • Monitors generation progress indicator on screen. | • Creates temporary quarantined directory `/.workspace/<platform>/`.<br>• LLM generates Page Object Model classes with stable selectors (roles, labels, test-ids):<br>&nbsp;&nbsp;• `pages/<PageName>.ts`<br>&nbsp;&nbsp;• `tests/<spec-id>.spec.ts`<br>&nbsp;&nbsp;• `fixtures/testData.json`<br>&nbsp;&nbsp;• `utils/helpers.ts`<br>• Enforces mandatory traceability comments in test files:<br>&nbsp;&nbsp;`// Spec ID: SPEC-XXX`<br>&nbsp;&nbsp;`// Test Case ID: TC-XXX-001`<br>&nbsp;&nbsp;`// Source: Approved test case — Title`<br>• Writes files into `/.workspace/`.<br>• Returns list of generated files and sizes. |
| **4.3** | **Workspace Script Inspection** | • Switches to the **"Workspace Files"** tab.<br>• Selects page objects and spec test files from the file tree. | • Calls `GET /api/workspace/file?path=...`.<br>• Displays syntax-highlighted TypeScript code and fixture JSON in the viewer. |

---

## Phase 5: Automated Validation & Auto-Healing (§3.6)

### Objective
Execute rigorous static and dynamic checks against the target application and autonomously repair script failures before permitting repository storage.

### Step-by-Step Matrix

| # | Step Name | User Action | System Action |
|---|-----------|-------------|---------------|
| **5.1** | **Configure & Run Validation** | • Selects Execution Mode (`real`, `simulated`, or `dry-run`).<br>• Sets **Auto-Heal Retries** (e.g., 2 attempts).<br>• Clicks **"Run Full Validation Pipeline"**. | • Calls `POST /api/specs/:specId/validate`.<br>• Initializes validation runner and stages. |
| **5.2** | **Stage 1: Static Validation** | • Watches Stage 1 progress spinner. | • **TypeScript Compiler (`tsc --noEmit`)**: verifies type-safety and missing variables.<br>• **ESLint Check**: flags syntax and formatting violations.<br>• **Selector Validation**: regex verification ensuring locators follow stable standards.<br>• **Import Validation**: checks that all imported page objects exist.<br>• If static checks fail and auto-heal is enabled, triggers healer. |
| **5.3** | **Stage 2: Dynamic Execution** | • Watches Stage 2 real-time test progress. | • Launches Playwright test runner against target app (e.g. OrangeHRM).<br>• Records per-test execution timing and status (`passed`, `failed`, `timedOut`).<br>• Captures failure screenshots, Playwright trace archives (`trace.zip`), and console logs.<br>• Saves artifacts to `/reports/execution-results/`. |
| **5.4** | **Stage 3: Conformance Verification** | • Watches Stage 3 verification check. | • Compares executed test IDs against `approval-record.json.approvedTestCases`.<br>• Verifies 100% coverage (every approved test case was executed).<br>• Checks for unmapped/unauthorized tests (no extra tests added).<br>• Confirms zero failed tests. |
| **5.5A** | **Autonomous Self-Healing** *(If Failures Detected)* | • Observes "Healing Attempt 1 of 2" status badge on screen. | • Collects failure logs, stack trace, failing selector, and page DOM snapshot.<br>• Healer Agent prompts LLM to diagnose root cause (e.g. outdated selector, timing issue).<br>• Applies minimal surgical diff directly to script in `/.workspace/`.<br>• Records `HealAttempt` entry with diagnosis and diff.<br>• Automatically re-runs validation pipeline.<br>• If tests now pass, marks report status as `HEALED_PASSED`. |
| **5.5B** | **Validation Outcome & Report** | • Inspects validation report summary card and individual test execution rows. | • Synthesizes comprehensive `ValidationReport` (`VAL-<SPEC_ID>-<TIMESTAMP>.json`).<br>• If all stages pass: sets `overallStatus = PASSED` (or `HEALED_PASSED`) and `eligibleForPromotion = true`.<br>• If unresolved failures remain: sets `overallStatus = FAILED` and `eligibleForPromotion = false`.<br>• Unlocks direct links to view screenshots, trace viewer, and failure logs. |

---

## Phase 6: Quality Gates & Repository Promotion (§3.7, §8)

### Objective
Evaluate the 8 mandatory release quality gates and promote validated artifacts from quarantined workspace into the permanent repository structure.

### Step-by-Step Matrix

| # | Step Name | User Action | System Action |
|---|-----------|-------------|---------------|
| **6.1** | **Open Repository & Gates Dashboard** | • Navigates to `/repository?specId=<SPEC_ID>` or clicks banner *"Advance to Quality Gates & Repository"*. | • Calls `GET /api/specs/:specId/quality-gate`.<br>• Evaluates all 8 Quality Gates against filesystem and validation report data.<br>• Displays quality gate checklist (Green checkmarks / Red badges). |
| **6.2** | **Verify the 8 Quality Gates** | • Reviews gate evaluation statuses: | The system validates each of the 8 rules: |
| | | | **Gate 1: Approved Specification**<br>Checks that `specification.json` exists and is non-empty. |
| | | | **Gate 2: Approved Test Cases**<br>Checks that `approval-record.json` has status `Approved` with ≥ 1 approved case. |
| | | | **Gate 3: Scripts Map to Approved Test Cases**<br>Verifies 1-to-1 mapping between generated scripts and approved IDs. |
| | | | **Gate 4: Scripts Compile Successfully**<br>Verifies static TypeScript validation passed without compiler errors. |
| | | | **Gate 5: Scripts Pass Automated Execution**<br>Verifies dynamic validation report has overall status `PASSED` / `HEALED_PASSED`. |
| | | | **Gate 6: Execution Evidence Stored**<br>Verifies reports, traces, and screenshots exist in `/reports/execution-results/`. |
| | | | **Gate 7: No Unapproved Functionality Automated**<br>Ensures zero unmapped tests exist in the conformance report. |
| | | | **Gate 8: Spec Up to Date / No Revalidation Required**<br>Ensures specification timestamp ≤ validation report timestamp (no post-validation spec edits). |
| **6.3** | **Configure Commit & Promotion** | • *(Optional)* Customizes commit message (default: `feat(automation): promote validated scripts for <SPEC_ID>`).<br>• Checks *"Auto-commit to Git"* option.<br>• Clicks **"Promote to Repository"**. | • Blocks action if any of the 8 quality gates failed.<br>• Dispatches `POST /api/specs/:specId/promote`. |
| **6.4** | **Promote & Store Artifacts** | • Waits for promotion confirmation dialog. | • Copies validated scripts from `/.workspace/` to permanent folders:<br>&nbsp;&nbsp;• `/automation/web/pages/`<br>&nbsp;&nbsp;• `/automation/web/tests/`<br>&nbsp;&nbsp;• `/automation/web/fixtures/`<br>• Creates permanent `promotion-record.json` inside `/specs/<SPEC_ID>/`.<br>• Executes Git commit referencing `<SPEC_ID>` in message and Co-authored-by trailer.<br>• Cleans up temporary files in `/.workspace/`.<br>• Returns `PromotionResult` with committed file list and Git SHA. |
| **6.5** | **Browse Promoted Repository Files** | • Clicks on repository browser tabs (`All`, `Web`, `Mobile`).<br>• Clicks any promoted file path to view stored content. | • Queries `GET /api/automation/files` and `GET /api/automation/file?path=...`.<br>• Displays repository tree and committed TypeScript code. |

---

## Phase 7: Specification Change & Revalidation Loop (§2, §8)

### Objective
Ensure that if a user story or specification is updated after promotion, previously generated scripts cannot be run blindly without re-validation.

### Step-by-Step Matrix

| # | Step Name | User Action | System Action |
|---|-----------|-------------|---------------|
| **7.1** | **Modify Specification** | • Edits user story or acceptance criteria in `/intake` or regenerates specification for an existing `specId`. | • Modifies `/specs/<SPEC_ID>/specification.md`.<br>• System detects specification timestamp is newer than `promotion-record.json.promotedAt`.<br>• Sets `revalidationRequired: true` on the specification.<br>• Sets Gate 8 (*Spec Up to Date*) to `FAILED`. |
| **7.2** | **Observe Quality Gate Invalidation** | • Navigates to `/repository?specId=<SPEC_ID>`. | • Displays high-priority warning: *"Specification has changed since last promotion. Revalidation required."*<br>• Disables promotion button until revalidation completes. |
| **7.3** | **Trigger Revalidation** | • Clicks **"Revalidate Specification & Scripts"**. | • Dispatches `POST /api/specs/:specId/revalidate`.<br>• Re-executes static and dynamic validation against current code and updated spec.<br>• Generates new validation report.<br>• Once passing, restores Gate 8 to `PASSED` and re-enables promotion. |

---

## Summary Reference Table: End-to-End Mapping

| Phase | Phase Name | Primary User Actions | Primary System Actions | API Endpoints Invoked | Key Artifact Created / Updated |
|---|---|---|---|---|---|
| **0** | **Setup & LLM** | Select provider, select model, toggle theme | Fetch providers, set request headers, persist theme | `GET /api/providers`, `GET /api/health` | `localStorage` |
| **1** | **Story Intake** | Enter title, story, criteria, priority, target app, submit | Validate inputs, generate Spec ID, create directories | `POST /api/specs/intake` | `/specs/<ID>/user-story.md`, `user-story.json` |
| **2** | **Spec & TCs** | Click Generate Spec, inspect, click Generate Test Cases | Query LLM with strict boundaries, format markdown & JSON | `POST /api/specs/:id/generate-spec`, `POST /api/specs/:id/generate-test-cases` | `/specs/<ID>/specification.md`, `/specs/<ID>/test-cases.md` |
| **3** | **Approval Gate** | Review cases, select valid cases, approve or request changes | Record decision, create history audit, evaluate proceed gate | `GET /api/specs/:id/approval`, `POST /api/specs/:id/approval`, `POST .../loopback` | `/specs/<ID>/approval-record.json` |
| **4** | **Script Gen** | Click Generate Scripts, inspect generated code | Verify approval, generate POM TypeScript into quarantined workspace | `POST /api/specs/:id/generate-scripts`, `GET /api/workspace/files` | `/.workspace/web/pages/`, `/.workspace/web/tests/` |
| **5** | **Validation & Heal** | Select mode, choose retries, click Run Validation | Run tsc, lint, locators, dynamic Playwright, auto-heal failures | `POST /api/specs/:id/validate`, `POST /api/specs/:id/heal` | `/reports/execution-results/VAL-*.json`, `trace.zip`, screenshots |
| **6** | **Quality Gates** | Check gates, edit commit message, click Promote | Evaluate 8 gates, copy workspace to repo, git commit, cleanup | `GET /api/specs/:id/quality-gate`, `POST /api/specs/:id/promote` | `/automation/web/`, `promotion-record.json`, Git Commit |
| **7** | **Revalidation** | Update spec, trigger revalidation | Detect spec drift, invalidate Gate 8, re-run validation runner | `POST /api/specs/:id/revalidate` | Updated `VAL-*.json`, restored Gate 8 status |

---
*Document Version: 1.0.0 — Created for QA_Automation_Platform_Agent SDD Platform.*
*Copyright © 2026 Aroun AI labs.*
