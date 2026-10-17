import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import passwordResetData from '../../fixtures/passwordResetData.json';

// Spec ID: SPEC-ENABLE-CUSTOMERS-002
// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
// Test Case ID: TC-ENABLE-CUSTOMERS-007
// Source: Approved test case — New Password Policy Validation
test('New Password Policy Validation', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigateToLogin();
    await loginPage.clickForgotPassword();
    await loginPage.enterEmail(passwordResetData.validEmail);
    await loginPage.submitRequest();
    // Simulate clicking the reset link in the email
    await page.goto('https://example.com/reset-password?token=valid-token');
    await loginPage.enterNewPassword(passwordResetData.invalidPassword);
    await loginPage.confirmNewPassword(passwordResetData.invalidPassword);
    await loginPage.submitNewPassword();
    expect(await loginPage.getErrorMessage()).toContain('Password does not meet policy requirements.');
});