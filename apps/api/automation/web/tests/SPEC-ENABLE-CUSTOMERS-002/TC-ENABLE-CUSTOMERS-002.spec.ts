import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import passwordResetData from '../../fixtures/passwordResetData.json';

// Spec ID: SPEC-ENABLE-CUSTOMERS-002
// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
// Test Case ID: TC-ENABLE-CUSTOMERS-002
// Source: Approved test case — Successful Password Reset with Valid Link
test('Successful Password Reset with Valid Link', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigateToLogin();
    await loginPage.clickForgotPassword();
    await loginPage.enterEmail(passwordResetData.validEmail);
    await loginPage.submitRequest();
    // Simulate clicking the reset link in the email
    await page.goto('https://example.com/reset-password?token=valid-token');
    await loginPage.enterNewPassword(passwordResetData.newPassword);
    await loginPage.confirmNewPassword(passwordResetData.newPassword);
    await loginPage.submitNewPassword();
    expect(await loginPage.getSuccessMessage()).toContain('Your password has been reset successfully.');
});