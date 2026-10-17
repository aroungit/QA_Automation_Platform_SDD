# Test Cases: Admin User Authentication & Role-Based Access (SPEC-LOGIN-006)

## Summary
- **Specification ID:** SPEC-LOGIN-006
- **Total Test Cases:** 6
- **Automatable:** 6
- **Manual Only:** 0
- **Needs Clarification:** 0

---

### TC-LOGIN-001: Successful Admin User Authentication

- **Specification ID:** SPEC-LOGIN-006
- **Priority:** critical
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- User must have valid administrator credentials.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User enters valid username and password | User is authenticated and redirected to the Dashboard page. |

#### Expected Results
- User is authenticated and redirected to the Dashboard page.

---

### TC-LOGIN-002: Invalid Credentials Alert

- **Specification ID:** SPEC-LOGIN-006
- **Priority:** high
- **Type:** negative
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- User must have invalid administrator credentials.

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User enters invalid username or password. | System displays an error alert 'Invalid credentials'. |

#### Expected Results
- System displays an error alert 'Invalid credentials'.

---

### TC-LOGIN-003: Empty Fields Validation

- **Specification ID:** SPEC-LOGIN-006
- **Priority:** high
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- None

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User submits the login form with empty username or password fields. | System displays inline validation messages 'Required'. |

#### Expected Results
- System displays inline validation messages 'Required'.

---

### TC-LOGIN-004: Forgot Password Navigation

- **Specification ID:** SPEC-LOGIN-006
- **Priority:** medium
- **Type:** functional
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- None

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User clicks on 'Forgot your password?' link. | System navigates to the password reset request screen. |

#### Expected Results
- System navigates to the password reset request screen.

---

### TC-LOGIN-005: Username Format Validation

- **Specification ID:** SPEC-LOGIN-006
- **Priority:** medium
- **Type:** boundary
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- None

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User enters an invalid email format as username. | System displays inline validation messages 'Required'. |

#### Expected Results
- System displays inline validation messages 'Required'.

---

### TC-LOGIN-006: Password Length Validation

- **Specification ID:** SPEC-LOGIN-006
- **Priority:** medium
- **Type:** boundary
- **Target Platform:** web
- **Automation Suitability:** automatable

#### Preconditions
- None

#### Test Steps
| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | User enters a password shorter than 8 characters. | System displays inline validation messages 'Required'. |

#### Expected Results
- System displays inline validation messages 'Required'.
