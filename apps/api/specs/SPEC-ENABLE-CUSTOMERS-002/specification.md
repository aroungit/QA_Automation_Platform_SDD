# Specification: Enable Customers to Reset Their Password

**Spec ID:** SPEC-ENABLE-CUSTOMERS-002  
**Target Application:** OrangeHRM  
**Environment:** default  

## Business Objective

To allow registered customers to securely reset their forgotten passwords to regain access to their online banking accounts without needing support assistance.

## Actors

- Registered Customer
- System

## Preconditions

- The customer must be a registered user with an email address linked to their account.
- The customer must have access to the email account linked to their OrangeHRM account.

## Main Flow

| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Customer navigates to the login page and selects 'Forgot password' | The system displays a prompt to enter the registered email address. |
| 2 | Customer enters their email address and submits the request | The system sends a one-time password-reset link to the provided email address. |
| 3 | Customer opens the email and clicks on the password-reset link | The system verifies the link is valid and unexpired. |
| 4 | Customer enters a new password and confirms it | The system validates the new password against the password policy. |
| 5 | Customer submits the new password | The system updates the password, signs out all active sessions, and displays a success confirmation message. |

## Alternate Flows

### Flow: Request New Reset Link

1. Customer receives the password-reset link but does not click it within the valid time frame.
2. Customer attempts to use the expired link.
3. The system displays an error message indicating the link has expired and provides an option to request a new reset link.

### Flow: Invalid Reset Link

1. Customer attempts to use an already-used reset link.
2. The system displays an error message indicating the link is invalid and provides an option to request a new reset link.


## Exception Flows

### Flow: Invalid Email Address

- **Condition:** Customer enters an email address that is not linked to any account.
- **Action:** The system displays an error message indicating that the email address is not recognized and suggests checking the input or registering.


## Data Requirements

| Field | Type | Rules |
| --- | --- | --- |
| email | string | Must be a valid email format and linked to a registered account. |
| newPassword | string | Must meet the defined password policy including length, complexity, and confirmation. |

## Acceptance Criteria

1. Given a registered customer is on the login page and selects “Forgot password,” when they enter the email address linked to their account, then the system sends a one-time password-reset link to that email address.
2. Given the customer opens a valid, unexpired reset link, when they enter a new password that meets the password policy and confirms it, then the system updates the password, signs out all active sessions, and displays a success confirmation.
3. Given the customer uses an expired, already-used, or invalid reset link, when they attempt to reset their password, then the system displays a clear error message and provides an option to request a new reset link.

## Non-Functional Requirements

- The system must ensure that all password reset communications are secure and comply with data protection regulations.
