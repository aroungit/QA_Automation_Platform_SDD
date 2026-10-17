# Test Cases: Enable Customers to Reset Their Password (SPEC-ENABLE-CUSTOMERS-002)

## Summary
- **Specification ID:** SPEC-ENABLE-CUSTOMERS-002
- **Total Test Cases:** 7
- **Automatable:** 7
- **Manual Only:** 0
- **Needs Clarification:** 0

---

### TC-ENABLE-CUSTOMERS-001: Successful Password Reset Request

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-002
- **Priority:** critical
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The customer must be a registered user with an email address linked to their account.
- The customer must have access to the email account linked to their OrangeHRM account.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer navigates to the login page and selects 'Forgot password' | The system displays a prompt to enter the registered email address. |
| 2 | Customer enters their email address and submits the request | The system sends a one-time password-reset link to the provided email address. |

#### Expected Results
- The system displays a prompt to enter the registered email address.
- The system sends a one-time password-reset link to the provided email address.

---

### TC-ENABLE-CUSTOMERS-002: Successful Password Reset with Valid Link

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-002
- **Priority:** critical
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The customer must be a registered user with an email address linked to their account.
- The customer must have access to the email account linked to their OrangeHRM account.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer opens the email and clicks on the password-reset link | The system verifies the link is valid and unexpired. |
| 2 | Customer enters a new password and confirms it | The system validates the new password against the password policy. |
| 3 | Customer submits the new password | The system updates the password, signs out all active sessions, and displays a success confirmation message. |

#### Expected Results
- The system verifies the link is valid and unexpired.
- The system validates the new password against the password policy.
- The system updates the password, signs out all active sessions, and displays a success confirmation message.

---

### TC-ENABLE-CUSTOMERS-003: Expired Password Reset Link

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-002
- **Priority:** high
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The customer must be a registered user with an email address linked to their account.
- The customer must have access to the email account linked to their OrangeHRM account.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer receives the password-reset link but does not click it within the valid time frame. | The system displays an error message indicating the link has expired and provides an option to request a new reset link. |

#### Expected Results
- The system displays an error message indicating the link has expired and provides an option to request a new reset link.

---

### TC-ENABLE-CUSTOMERS-004: Invalid Email Address for Password Reset

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-002
- **Priority:** critical
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The customer must be a registered user with an email address linked to their account.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer enters an email address that is not linked to any account. | The system displays an error message indicating that the email address is not recognized and suggests checking the input or registering. |

#### Expected Results
- The system displays an error message indicating that the email address is not recognized and suggests checking the input or registering.

---

### TC-ENABLE-CUSTOMERS-005: Invalid Reset Link Usage

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-002
- **Priority:** high
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- The customer must be a registered user with an email address linked to their account.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer attempts to use an already-used reset link. | The system displays an error message indicating the link is invalid and provides an option to request a new reset link. |

#### Expected Results
- The system displays an error message indicating the link is invalid and provides an option to request a new reset link.

---

### TC-ENABLE-CUSTOMERS-006: Valid Email Format Check

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-002
- **Priority:** medium
- **Type:** boundary
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- None

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer enters an email address that is not in a valid format. | The system displays an error message indicating the email format is invalid. |

#### Expected Results
- The system displays an error message indicating the email format is invalid.

---

### TC-ENABLE-CUSTOMERS-007: New Password Policy Validation

- **Specification ID:** SPEC-ENABLE-CUSTOMERS-002
- **Priority:** medium
- **Type:** boundary
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- None

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer enters a new password that does not meet the password policy. | The system displays an error message indicating the new password does not meet the policy requirements. |

#### Expected Results
- The system displays an error message indicating the new password does not meet the policy requirements.
