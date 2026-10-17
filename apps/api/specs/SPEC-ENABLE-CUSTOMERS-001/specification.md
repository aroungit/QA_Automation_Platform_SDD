# Specification: Enable Customers to Reset Their Password

**Spec ID:** SPEC-ENABLE-CUSTOMERS-001  
**Target Application:** Online banking web app  
**Environment:** default  

## Business Objective

Allow customers to securely reset forgotten passwords, reducing support calls and maintaining account security.

## Actors

- Registered Customer
- System
- Email Service

## Preconditions

- Customer has a registered account with a valid email address
- Customer is on the login page
- Password policy is defined in the system

## Main Flow

| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer clicks the "Forgot password" link on the login page. | System displays the password reset request form. |
| 2 | Customer enters their registered email address and submits the form. | System validates email format and existence, generates a one‑time reset token (expires in 30 minutes), stores it, and sends a reset link to the email. |
| 3 | Customer receives the email and clicks the reset link. | System verifies the token is valid and unexpired, then presents the new password entry screen. |
| 4 | Customer enters a new password that complies with the password policy and confirms it. | System validates the password and confirmation, updates the customer's password, invalidates the token, signs out all active sessions, and shows a success confirmation message. |

## Alternate Flows

### Flow: Mobile Password Reset Request

1. Customer accesses the login page via a mobile browser or banking app.
2. Customer taps the "Forgot password" link, which displays a mobile‑optimized reset request form.
3. Customer enters email and submits; system behaves identically to the web flow, sending the reset link.

### Flow: Resend Reset Link

1. Customer selects "Resend link" on the expired‑link error screen.
2. System generates a new token, updates the stored token, and sends a fresh reset email.


## Exception Flows

### Flow: Invalid or Non‑existent Email

- **Condition:** Submitted email does not match any registered account.
- **Action:** System displays a generic error message: "If the email is registered, a reset link will be sent," without revealing account existence.

### Flow: Expired/Used/Invalid Reset Token

- **Condition:** Customer clicks a reset link that is expired, already used, or malformed.
- **Action:** System shows an error message: "The reset link is invalid or has expired." and provides a button to request a new reset link.

### Flow: Password Policy Violation

- **Condition:** New password does not meet the defined password policy.
- **Action:** System highlights the policy requirements and prevents submission until the password complies.


## Data Requirements

| Field | Type | Rules |
| --- | --- | --- |
| email | string | Must be a valid email format; must exist in Customer table. |
| resetToken | string (UUID or secure random) | Stored hashed; expires after 30 minutes; single‑use. |
| newPassword | string | Minimum 12 characters, at least one uppercase, one lowercase, one digit, one special character; must not match last 5 passwords. |
| tokenCreationTimestamp | datetime | Used to calculate expiration. |

## Acceptance Criteria

1. Given a registered customer is on the login page and selects “Forgot password,” when they enter the email address linked to their account, then the system sends a one-time password-reset link to that email address.
2. Given the customer opens a valid, unexpired reset link, when they enter a new password that meets the password policy and confirms it, then the system updates the password, signs out all active sessions, and displays a success confirmation
3. Given the customer uses an expired, already-used, or invalid reset link, when they attempt to reset their password, then the system displays a clear error message and provides an option to request a new reset link

## Non-Functional Requirements

- All communications must use TLS 1.2 or higher.
- Reset token must be generated using a cryptographically secure random number generator.
- Email delivery shall occur within 5 seconds of request under normal load.
- The password reset pages must be responsive and pass WCAG 2.1 AA accessibility criteria on both desktop and mobile browsers.
- System must log reset requests and token validations for audit purposes, retaining logs for 12 months.
