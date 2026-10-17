# User Story: Enable Customers to Reset Their Password

**Spec ID:** SPEC-ENABLE-CUSTOMERS-001  
**Target Application:** Online banking web app  
**Platform:** web  
**Priority:** high  
**Created:** 2026-10-17T01:49:49.011Z  
**Updated:** 2026-10-17T01:49:49.011Z  

## Story Description

As a registered customer, I want to reset my forgotten password so that I can regain secure access to my online banking account without contacting support.

## Acceptance Criteria

1. Given a registered customer is on the login page and selects “Forgot password,” when they enter the email address linked to their account, then the system sends a one-time password-reset link to that email address.
2. Given the customer opens a valid, unexpired reset link, when they enter a new password that meets the password policy and confirms it, then the system updates the password, signs out all active sessions, and displays a success confirmation
3. Given the customer uses an expired, already-used, or invalid reset link, when they attempt to reset their password, then the system displays a clear error message and provides an option to request a new reset link
