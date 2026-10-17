import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import passwordResetData from '../../fixtures/passwordResetData.json';

// Spec ID: SPEC-ENABLE-CUSTOMERS-002
// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
// Test Case ID: TC-ENABLE-CUSTOMERS-005
// Source: Approved test case — Invalid Reset Link Usage
test('Invalid Reset Link Usage', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigateToLogin();
    await loginPage.clickForgotPassword();
    await loginPage.enterEmail(passwordResetData.validEmail);
    await loginPage.submitRequest();
    // Simulate using an already-used reset link
    await page.goto('https://example.com/reset-password?token=used-token');
    expect(await loginPage.getErrorMessage()).toContain('The link is invalid.');
});