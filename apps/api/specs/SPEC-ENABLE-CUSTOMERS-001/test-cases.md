# Test Cases: Enable Customers to Reset Their Password (SPEC-ENABLE-CUSTOMERS-001)

## Summary
- **Specification ID:** SPEC-ENABLE-CUSTOMERS-001
- **Total Test Cases:** 7
- **Automatable:** 7
- **Manual Only:** 0
- **Needs Clarification:** 0

---

### TC-ENABLE-CUSTOMERS-001: Verify positive main flow for Enable Customers to Reset Their Password

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-001
- **Priority:** high
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- Customer has a registered account with a valid email address
- Customer is on the login page
- Password policy is defined in the system

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer clicks the "Forgot password" link on the login page. | System displays the password reset request form. |
| 2 | Customer enters their registered email address and submits the form. | System validates email format and existence, generates a one‑time reset token (expires in 30 minutes), stores it, and sends a reset link to the email. |
| 3 | Customer receives the email and clicks the reset link. | System verifies the token is valid and unexpired, then presents the new password entry screen. |
| 4 | Customer enters a new password that complies with the password policy and confirms it. | System validates the password and confirmation, updates the customer's password, invalidates the token, signs out all active sessions, and shows a success confirmation message. |

#### Expected Results
- System validates the password and confirmation, updates the customer's password, invalidates the token, signs out all active sessions, and shows a success confirmation message.

---

### TC-ENABLE-CUSTOMERS-002: Verify exception handling: Invalid or Non‑existent Email

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-001
- **Priority:** medium
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- Customer has a registered account with a valid email address
- Customer is on the login page
- Password policy is defined in the system

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Set up scenario where Submitted email does not match any registered account. | Condition is established |
| 2 | Trigger action under exception condition | System displays a generic error message: "If the email is registered, a reset link will be sent," without revealing account existence. |

#### Expected Results
- System displays a generic error message: "If the email is registered, a reset link will be sent," without revealing account existence.

---

### TC-ENABLE-CUSTOMERS-003: Verify exception handling: Expired/Used/Invalid Reset Token

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-001
- **Priority:** medium
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- Customer has a registered account with a valid email address
- Customer is on the login page
- Password policy is defined in the system

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Set up scenario where Customer clicks a reset link that is expired, already used, or malformed. | Condition is established |
| 2 | Trigger action under exception condition | System shows an error message: "The reset link is invalid or has expired." and provides a button to request a new reset link. |

#### Expected Results
- System shows an error message: "The reset link is invalid or has expired." and provides a button to request a new reset link.

---

### TC-ENABLE-CUSTOMERS-004: Verify exception handling: Password Policy Violation

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-001
- **Priority:** medium
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- Customer has a registered account with a valid email address
- Customer is on the login page
- Password policy is defined in the system

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Set up scenario where New password does not meet the defined password policy. | Condition is established |
| 2 | Trigger action under exception condition | System highlights the policy requirements and prevents submission until the password complies. |

#### Expected Results
- System highlights the policy requirements and prevents submission until the password complies.

---

### TC-ENABLE-CUSTOMERS-005: Verify alternate flow: Mobile Password Reset Request

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-001
- **Priority:** medium
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- Customer has a registered account with a valid email address
- Customer is on the login page
- Password policy is defined in the system

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer accesses the login page via a mobile browser or banking app. | Step 1 completes as expected |
| 2 | Customer taps the "Forgot password" link, which displays a mobile‑optimized reset request form. | Step 2 completes as expected |
| 3 | Customer enters email and submits; system behaves identically to the web flow, sending the reset link. | Step 3 completes as expected |

#### Expected Results
- Alternate pathway Mobile Password Reset Request completes successfully

---

### TC-ENABLE-CUSTOMERS-006: Verify alternate flow: Resend Reset Link

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-001
- **Priority:** medium
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- Customer has a registered account with a valid email address
- Customer is on the login page
- Password policy is defined in the system

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer selects "Resend link" on the expired‑link error screen. | Step 1 completes as expected |
| 2 | System generates a new token, updates the stored token, and sends a fresh reset email. | Step 2 completes as expected |

#### Expected Results
- Alternate pathway Resend Reset Link completes successfully

---

### TC-ENABLE-CUSTOMERS-007: Verify data validation rules for Enable Customers to Reset Their Password

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-001
- **Priority:** medium
- **Type:** boundary
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- Customer has a registered account with a valid email address
- Customer is on the login page
- Password policy is defined in the system

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Attempt input violating rules for: email (Must be a valid email format; must exist in Customer table.), resetToken (Stored hashed; expires after 30 minutes; single‑use.), newPassword (Minimum 12 characters, at least one uppercase, one lowercase, one digit, one special character; must not match last 5 passwords.), tokenCreationTimestamp (Used to calculate expiration.) | Validation error displayed, submission blocked |
| 2 | Provide compliant inputs for: email (Must be a valid email format; must exist in Customer table.), resetToken (Stored hashed; expires after 30 minutes; single‑use.), newPassword (Minimum 12 characters, at least one uppercase, one lowercase, one digit, one special character; must not match last 5 passwords.), tokenCreationTimestamp (Used to calculate expiration.) | Inputs accepted without errors |

#### Expected Results
- System enforces input data requirements correctly
