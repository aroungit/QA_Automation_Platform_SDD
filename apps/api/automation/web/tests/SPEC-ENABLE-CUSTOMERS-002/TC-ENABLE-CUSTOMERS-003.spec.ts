import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import passwordResetData from '../../fixtures/passwordResetData.json';

// Spec ID: SPEC-ENABLE-CUSTOMERS-002
// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
// Test Case ID: TC-ENABLE-CUSTOMERS-003
// Source: Approved test case — Expired Password Reset Link
test('Expired Password Reset Link', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigateToLogin();
    await loginPage.clickForgotPassword();
    await loginPage.enterEmail(passwordResetData.validEmail);
    await loginPage.submitRequest();
    // Simulate waiting for the link to expire
    await page.waitForTimeout(1000 * 60 * 15); // 15 minutes
    await page.goto('https://example.com/reset-password?token=expired-token');
    expect(await loginPage.getErrorMessage()).toContain('The link has expired.');
});