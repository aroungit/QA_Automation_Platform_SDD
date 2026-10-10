import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import authData from '../../fixtures/auth-data.json';

// Spec ID: SPEC-LOGIN-001
// Validation Report: VAL-SPEC-LOGIN-001-1791637471880
// Test Case ID: TC-LOGIN-001
// Source: Approved test case — Verify positive main flow for Admin User Authentication & Role-Based Access
test('TC-LOGIN-001: Verify positive main flow for Admin User Authentication & Role-Based Access', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  await loginPage.goto();

    // Step 1: Login with valid credentials from fixture
    await loginPage.login(
      authData.validCredentials.username,
      authData.validCredentials.password,
    );

    // Step 2: Assert navigation to Dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    const isDashboardVisible = await dashboardPage.isDisplayed();
    expect(isDashboardVisible).toBe(true);
});
