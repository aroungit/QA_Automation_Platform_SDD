import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import passwordResetData from '../../fixtures/passwordResetData.json';

// Spec ID: SPEC-ENABLE-CUSTOMERS-002
// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
// Test Case ID: TC-ENABLE-CUSTOMERS-004
// Source: Approved test case — Invalid Email Address for Password Reset
test('Invalid Email Address for Password Reset', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigateToLogin();
    await loginPage.clickForgotPassword();
    await loginPage.enterEmail(passwordResetData.invalidEmail);
    await loginPage.submitRequest();
    expect(await loginPage.getErrorMessage()).toContain('Email address not recognized.');
});