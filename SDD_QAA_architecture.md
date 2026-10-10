# QA Automation Platform — Architecture

## 1. Purpose

Build a Spec-Driven Development (SDD) based QA automation platform that:

1. Accepts a user story as input.
2. Generates structured test cases from the user story.
3. Requires human review and approval of the test cases.
4. Automatically generates Playwright automation scripts from the approved test cases.
5. Automatically executes the generated scripts against the target application.
6. Stores scripts in the repository only after successful validation.
7. Enables review, debugging, and execution through Visual Studio Code.

The specification is the source of truth. Code and test scripts are derived artifacts and must remain traceable to an approved specification.

## 2. Core Principle: Spec-Driven Development

Every automation artifact must follow this lifecycle:

User Story → Specification → Test Cases → Human Approval → Playwright Scripts → Automated Validation → Repository Storage

No Playwright script may be committed unless it:

- Is traceable to an approved user story.
- Implements only approved test cases.
- Passes automated execution against the target application.
- Contains no unapproved functional changes.

If the specification changes, the affected test cases and scripts must be regenerated or updated, then revalidated before being stored.

## 3. System Components

### 3.1 User Story Intake Service

- Accepts user stories through a web UI or API.
- Stores the original user story, acceptance criteria, priority, target platform, and target application.
- Creates a unique specification ID for traceability.

Example input:

```text
As an HR user,
I want to log in to OrangeHRM,
So that I can access the dashboard.

Acceptance criteria:
1. Valid username and password should navigate to the dashboard.
2. Invalid credentials should display an error message.
3. Empty fields should prevent login.
```

### 3.2 Specification Generator

Converts each user story into a structured specification containing:

- Feature title
- Business objective
- Actors
- Preconditions
- Main flow
- Alternate flows
- Exception flows
- Data requirements
- Acceptance criteria
- Non-functional requirements, if applicable
- Target application and environment

The specification is stored in Markdown or JSON so it can be version-controlled, reviewed, and reused.

### 3.3 Test Case Generator

Generates test cases directly from the approved or review-ready specification.

Each test case must include:

- Test case ID
- Specification ID
- Title
- Preconditions
- Test steps
- Expected results
- Priority
- Test type: functional, negative, boundary, regression, accessibility, etc.
- Target platform: web, mobile, or both
- Automation suitability: automatable, manual-only, or needs clarification

Test cases must not introduce behavior that is absent from the specification.

### 3.4 Human Approval Gate

A reviewer must approve or reject generated test cases before script generation.

Approval statuses:

- `Draft`
- `Under Review`
- `Approved`
- `Rejected`
- `Needs Clarification`

Only test cases with status `Approved` can proceed to Playwright script generation.

Rejected or clarified test cases return to the specification or test-case generation stage.

### 3.5 Playwright Script Generator

For approved test cases, the system generates Playwright scripts.

Script generation rules:

- Use TypeScript as the default language.
- Use the Page Object Model for maintainability.
- Separate test data from test logic.
- Use stable selectors wherever possible.
- Generate assertions from the expected results in the approved test case.
- Include comments mapping each test to its specification and test-case IDs.
- Generate separate scripts for web and mobile targets when required.

Example traceability comment:

```typescript
// Spec ID: SPEC-LOGIN-001
// Test Case ID: TC-LOGIN-002
// Source: Approved test case — Invalid login shows an error message
```

### 3.6 Automated Validation Service

After scripts are generated, the system automatically runs them before repository storage.

Validation stages:

1. Static validation
   - TypeScript compilation
   - Lint checks
   - Selector and import validation

2. Dynamic validation
   - Execute Playwright tests against the configured target environment.
   - Capture pass/fail status, screenshots, traces, and console logs.

3. Specification conformance check
   - Confirm every approved test case has a corresponding executed test.
   - Confirm failed tests are not committed.
   - Flag tests that pass but do not map to an approved specification.

Only scripts that pass static validation, dynamic validation, and traceability checks are eligible for repository storage.

### 3.7 Repository Service

Stores approved and validated artifacts:

```text
/specs
  /SPEC-LOGIN-001
    user-story.md
    specification.md
    test-cases.md
    approval-record.json

/automation
  /web
    /pages
    /tests
    /fixtures
    /utils
  /mobile
    /pages
    /tests
    /fixtures
    /utils

/reports
  /execution-results
```

Repository rules:

- Specs, test cases, approval records, and scripts are committed together.
- Each commit references its specification ID.
- Failed or unapproved scripts are stored only in a temporary workspace, never in the main repository.
- Every stored script must include a passing validation report reference.

## 4. Target Applications

### 4.1 OrangeHRM Demo Application

OrangeHRM will be used as the initial sample application for validating the end-to-end workflow.

Candidate test areas:

- Login and logout
- Dashboard access
- Employee creation
- Employee search
- Leave management
- Admin user management

### 4.2 Custom React Web Application

The platform must also test a React-based web application.

Requirements:

- Support component-level and end-to-end testing.
- Support modern React routing and state-driven UI.
- Use Playwright for browser-based automation.
- Support Chromium, Firefox, and WebKit where applicable.

### 4.3 React Native Mobile Application

The platform must support mobile test scenarios.

Requirements:

- Generate mobile-oriented Playwright-compatible test structures where applicable.
- Support device or emulator configuration through environment variables.
- Maintain separate mobile page objects, fixtures, and test suites.
- Support future integration with Appium or Detox if native mobile automation is required.

## 5. Developer Experience: Visual Studio Code

Visual Studio Code is the primary IDE.

The generated project must include:

- `.vscode/launch.json` for debugging Playwright tests.
- `.vscode/settings.json` for TypeScript, ESLint, and Prettier configuration.
- Recommended extensions:
  - Playwright Test for VS Code
  - ESLint
  - Prettier
  - GitLens
- Tasks to run:
  - `npm run test`
  - `npm run test:headed`
  - `npm run test:mobile`
  - `npm run report`

Engineers can open the repository in VS Code, inspect generated specs and scripts, debug failures, and rerun tests locally.

## 6. End-to-End Workflow

1. A QA engineer or product owner submits a user story.
2. The system creates a specification.
3. The system generates candidate test cases.
4. A human reviewer approves, rejects, or requests clarification.
5. Approved test cases trigger Playwright script generation.
6. The system automatically runs static and dynamic validation.
7. Passing, traceable scripts and their specification artifacts are committed to the repository.
8. Failed scripts remain in a temporary workspace with failure reports.
9. Engineers review failures in Visual Studio Code and correct either the specification, test case, or automation script.
10. Corrected artifacts re-enter the validation workflow.

## 7. Technology Stack

| Layer | Technology |
|---|---|
| Web frontend | React |
| Mobile frontend | React Native |
| Backend | Node.js with Express |
| Database | To be finalized; start with PostgreSQL or MongoDB |
| Test automation | Playwright with TypeScript |
| IDE | Visual Studio Code |
| Repository | Git |
| CI/CD | GitHub Actions or equivalent |
| Reporting | Playwright HTML report, traces, screenshots, and logs |

## 8. Quality Gates

A release-ready automation artifact must satisfy:

- Approved specification exists.
- Approved test cases exist.
- Every script maps to an approved test case.
- Scripts compile successfully.
- Scripts pass automated execution.
- Execution evidence is stored.
- No unapproved functionality is automated.
- Specification changes trigger revalidation.

## 9. Future Enhancements

- AI-assisted clarification of incomplete user stories.
- Automatic impact analysis when specifications change.
- Self-healing selectors for UI changes.
- Parallel execution across browsers and devices.
- Test coverage dashboards by specification, feature, and release.
- Integration with Jira, Azure DevOps, or GitHub Issues.
