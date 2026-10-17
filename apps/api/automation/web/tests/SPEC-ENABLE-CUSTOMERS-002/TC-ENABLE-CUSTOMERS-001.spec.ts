import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import passwordResetData from '../../fixtures/passwordResetData.json';

// Spec ID: SPEC-ENABLE-CUSTOMERS-002
// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
// Test Case ID: TC-ENABLE-CUSTOMERS-001
// Source: Approved test case — Successful Password Reset Request
test('Successful Password Reset Request', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigateToLogin();
    await loginPage.clickForgotPassword();
    await loginPage.enterEmail(passwordResetData.validEmail);
    await loginPage.submitRequest();
    expect(await loginPage.getSuccessMessage()).toContain('A password reset link has been sent to your email.');
});