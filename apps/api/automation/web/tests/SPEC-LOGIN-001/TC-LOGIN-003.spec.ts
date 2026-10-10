import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import authData from '../../fixtures/auth-data.json';

// Spec ID: SPEC-LOGIN-001
// Validation Report: VAL-SPEC-LOGIN-001-1791637471880
// Test Case ID: TC-LOGIN-003
// Source: Approved test case — Verify exception handling: Exception 2: Submitting empty username or password fi
test('TC-LOGIN-003: Verify exception handling: Exception 2: Submitting empty username or password fi', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  await loginPage.goto();

    // Step 1: Attempt login with invalid credentials from fixture
    await loginPage.login(
      authData.invalidCredentials.username,
      authData.invalidCredentials.password,
    );

    // Step 2: Verify error message is displayed
    const isErrorVisible = await loginPage.isErrorDisplayed();
    expect(isErrorVisible).toBe(true);

    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain(authData.invalidCredentials.expectedErrorMessage);
});
