# Test Cases: Admin User Authentication & Role-Based Access (SPEC-LOGIN-005)

## Summary
- **Specification ID:** SPEC-LOGIN-005
- **Total Test Cases:** 7
- **Automatable:** 7
- **Manual Only:** 0
- **Needs Clarification:** 0

---

### TC-LOGIN-001: Verify positive main flow for Admin User Authentication & Role-Based Access

- **Specification ID:** SPEC-LOGIN-005
- **Priority:** high
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user is on the OrangeHRM login page.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Enter a valid administrator username in the Username field. | Username field accepts the input. |
| 2 | Enter the corresponding valid password in the Password field. | Password field accepts the input. |
| 3 | Click the "Login" button. | System validates the credentials. |
| 4 | System authenticates the user. | User is redirected to the Dashboard page. |

#### Expected Results
- User is redirected to the Dashboard page.

---

### TC-LOGIN-002: Verify exception handling: System Unavailable

- **Specification ID:** SPEC-LOGIN-005
- **Priority:** medium
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user is on the OrangeHRM login page.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Set up scenario where Authentication service is unreachable or returns an error. | Condition is established |
| 2 | Trigger action under exception condition | Display a generic error message "Unable to process login at this time. Please try again later." and log the incident for investigation. |

#### Expected Results
- Display a generic error message "Unable to process login at this time. Please try again later." and log the incident for investigation.

---

### TC-LOGIN-003: Verify exception handling: Session Timeout During Login

- **Specification ID:** SPEC-LOGIN-005
- **Priority:** medium
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user is on the OrangeHRM login page.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Set up scenario where User remains idle on the login page beyond the session timeout limit. | Condition is established |
| 2 | Trigger action under exception condition | Refresh the login page and prompt the user to re-enter credentials. |

#### Expected Results
- Refresh the login page and prompt the user to re-enter credentials.

---

### TC-LOGIN-004: Verify alternate flow: Invalid Credentials

- **Specification ID:** SPEC-LOGIN-005
- **Priority:** medium
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user is on the OrangeHRM login page.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User enters a username and/or password that does not match any administrator account. | Step 1 completes as expected |
| 2 | User clicks the "Login" button. | Step 2 completes as expected |
| 3 | System validates the credentials, determines they are invalid, and displays an error alert "Invalid credentials" without indicating which field is incorrect. | Step 3 completes as expected |

#### Expected Results
- Alternate pathway Invalid Credentials completes successfully

---

### TC-LOGIN-005: Verify alternate flow: Missing Required Fields

- **Specification ID:** SPEC-LOGIN-005
- **Priority:** medium
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user is on the OrangeHRM login page.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User leaves the Username and/or Password field empty. | Step 1 completes as expected |
| 2 | User clicks the "Login" button. | Step 2 completes as expected |
| 3 | System detects empty required fields and displays inline validation messages "Required" next to each empty field. | Step 3 completes as expected |

#### Expected Results
- Alternate pathway Missing Required Fields completes successfully

---

### TC-LOGIN-006: Verify alternate flow: Forgot Password Navigation

- **Specification ID:** SPEC-LOGIN-005
- **Priority:** medium
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user is on the OrangeHRM login page.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User clicks the "Forgot your password?" link. | Step 1 completes as expected |
| 2 | System navigates to the password reset request screen. | Step 2 completes as expected |

#### Expected Results
- Alternate pathway Forgot Password Navigation completes successfully

---

### TC-LOGIN-007: Verify data validation rules for Admin User Authentication & Role-Based Access

- **Specification ID:** SPEC-LOGIN-005
- **Priority:** medium
- **Type:** boundary
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user is on the OrangeHRM login page.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Attempt input violating rules for: username (Required; maximum length 50 characters; must match an existing administrator account.), password (Required; minimum length 8 characters; must be stored and transmitted using secure hashing and TLS.) | Validation error displayed, submission blocked |
| 2 | Provide compliant inputs for: username (Required; maximum length 50 characters; must match an existing administrator account.), password (Required; minimum length 8 characters; must be stored and transmitted using secure hashing and TLS.) | Inputs accepted without errors |

#### Expected Results
- System enforces input data requirements correctly
