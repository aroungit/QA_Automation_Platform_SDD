# Test Cases: Admin User Authentication & Role-Based Access (SPEC-LOGIN-004)

## Summary
- **Specification ID:** SPEC-LOGIN-004
- **Total Test Cases:** 5
- **Automatable:** 5
- **Manual Only:** 0
- **Needs Clarification:** 0

---

### TC-LOGIN-001: Verify positive main flow for Admin User Authentication & Role-Based Access

- **Specification ID:** SPEC-LOGIN-004
- **Priority:** high
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user navigates to the OrangeHRM login page using a supported web browser.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Enter a valid administrator username in the Username field. | Username field contains the entered value. |
| 2 | Enter the corresponding password in the Password field. | Password field contains the entered value (masked). |
| 3 | Click the "Login" button. | System validates credentials. |
| 4 | System authenticates the user. | User is redirected to the Dashboard page with a personalized greeting. |

#### Expected Results
- User is redirected to the Dashboard page with a personalized greeting.

---

### TC-LOGIN-002: Verify exception handling: Empty Fields Validation

- **Specification ID:** SPEC-LOGIN-004
- **Priority:** medium
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user navigates to the OrangeHRM login page using a supported web browser.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Set up scenario where Username or Password field is left empty and the Login button is pressed. | Condition is established |
| 2 | Trigger action under exception condition | Display inline validation message "Required" next to each empty field and keep the user on the login page. |

#### Expected Results
- Display inline validation message "Required" next to each empty field and keep the user on the login page.

---

### TC-LOGIN-003: Verify exception handling: Invalid Credentials

- **Specification ID:** SPEC-LOGIN-004
- **Priority:** medium
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user navigates to the OrangeHRM login page using a supported web browser.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Set up scenario where Entered username and/or password do not match an active administrator account. | Condition is established |
| 2 | Trigger action under exception condition | Display an inline error message "Invalid credentials" above the login form and remain on the login page. |

#### Expected Results
- Display an inline error message "Invalid credentials" above the login form and remain on the login page.

---

### TC-LOGIN-004: Verify alternate flow: Forgot Password Flow

- **Specification ID:** SPEC-LOGIN-004
- **Priority:** medium
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user navigates to the OrangeHRM login page using a supported web browser.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User clicks the "Forgot your password?" link located beneath the login form. | Step 1 completes as expected |
| 2 | System navigates to the Password Reset Request screen. | Step 2 completes as expected |
| 3 | User follows the password reset process as defined in the password recovery module. | Step 3 completes as expected |

#### Expected Results
- Alternate pathway Forgot Password Flow completes successfully

---

### TC-LOGIN-005: Verify data validation rules for Admin User Authentication & Role-Based Access

- **Specification ID:** SPEC-LOGIN-004
- **Priority:** medium
- **Type:** boundary
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The user possesses a valid administrator account in OrangeHRM.
- The user navigates to the OrangeHRM login page using a supported web browser.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Attempt input violating rules for: Username (Required; maximum length 50 characters; must match an existing admin account identifier.), Password (Required; minimum length 8 characters; must be stored and compared using secure hashing (e.g., bcrypt).) | Validation error displayed, submission blocked |
| 2 | Provide compliant inputs for: Username (Required; maximum length 50 characters; must match an existing admin account identifier.), Password (Required; minimum length 8 characters; must be stored and compared using secure hashing (e.g., bcrypt).) | Inputs accepted without errors |

#### Expected Results
- System enforces input data requirements correctly
