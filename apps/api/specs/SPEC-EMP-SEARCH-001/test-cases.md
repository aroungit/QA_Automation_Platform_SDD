# Test Cases: PIM Employee Search by Name and Employment Status (SPEC-EMP-SEARCH-001)

## Summary
- **Specification ID:** SPEC-EMP-SEARCH-001
- **Total Test Cases:** 4
- **Automatable:** 4
- **Manual Only:** 0
- **Needs Clarification:** 0

---

### TC-EMP-SEARCH-001: Verify positive main flow for PIM Employee Search by Name and Employment Status

- **Specification ID:** SPEC-EMP-SEARCH-001
- **Priority:** high
- **Type:** functional
- **Target Platform:** mobile
- **Automation Suitability:** automatable

#### Preconditions
- Target application OrangeHRM is reachable in the test environment
- User is in an authorized initial state on mobile

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Navigate to OrangeHRM PIM Employee Search by Name and Employment Status interface on mobile | PIM Employee Search by Name and Employment Status view is loaded and ready for interaction |
| 2 | Enter required input data according to standard positive criteria | Inputs are populated and validated without errors |
| 3 | Submit or confirm the primary action | Entering a partial or full name in the "Employee Name" autocomplete field suggests matching active records. |
| 4 | Verify acceptance condition: Selecting "Full-Time Contract" filter displays only employees currently engaged under full-time contracts. | Selecting "Full-Time Contract" filter displays only employees currently engaged under full-time contracts. |
| 5 | Verify acceptance condition: Clicking "Search" populates the results data table with employee ID, first name, last name, and job title. | Clicking "Search" populates the results data table with employee ID, first name, last name, and job title. |
| 6 | Verify acceptance condition: Clicking "Reset" clears all search parameters and reloads the default paginated employee list. | Clicking "Reset" clears all search parameters and reloads the default paginated employee list. |

#### Expected Results
- Clicking "Reset" clears all search parameters and reloads the default paginated employee list.

---

### TC-EMP-SEARCH-002: Verify exception handling: Exception 1: Searching for a non-existent identifier 

- **Specification ID:** SPEC-EMP-SEARCH-001
- **Priority:** medium
- **Type:** negative
- **Target Platform:** mobile
- **Automation Suitability:** automatable

#### Preconditions
- Target application OrangeHRM is reachable in the test environment
- User is in an authorized initial state on mobile

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Set up scenario where Trigger condition related to: Searching for a non-existent identifier displays a "No Records Found" empty state indicator. | Condition is established |
| 2 | Trigger action under exception condition | Display appropriate validation error or prevention mechanism (Searching for a non-existent identifier displays a "No Records Found" empty state indicator.) |

#### Expected Results
- Display appropriate validation error or prevention mechanism (Searching for a non-existent identifier displays a "No Records Found" empty state indicator.)

---

### TC-EMP-SEARCH-003: Verify alternate flow: Alternate Flow: Secondary action pathway

- **Specification ID:** SPEC-EMP-SEARCH-001
- **Priority:** medium
- **Type:** functional
- **Target Platform:** mobile
- **Automation Suitability:** automatable

#### Preconditions
- Target application OrangeHRM is reachable in the test environment
- User is in an authorized initial state on mobile

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Navigate to OrangeHRM secondary options | Step 1 completes as expected |
| 2 | Perform alternate action sequence | Step 2 completes as expected |
| 3 | Verify alternative state matches expected behavior | Step 3 completes as expected |

#### Expected Results
- Alternate pathway Alternate Flow: Secondary action pathway completes successfully

---

### TC-EMP-SEARCH-004: Verify data validation rules for PIM Employee Search by Name and Employment Status

- **Specification ID:** SPEC-EMP-SEARCH-001
- **Priority:** medium
- **Type:** boundary
- **Target Platform:** mobile
- **Automation Suitability:** automatable

#### Preconditions
- Target application OrangeHRM is reachable in the test environment
- User is in an authorized initial state on mobile

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Attempt input violating rules for: primaryIdentifier (required, non-empty) | Validation error displayed, submission blocked |
| 2 | Provide compliant inputs for: primaryIdentifier (required, non-empty) | Inputs accepted without errors |

#### Expected Results
- System enforces input data requirements correctly
