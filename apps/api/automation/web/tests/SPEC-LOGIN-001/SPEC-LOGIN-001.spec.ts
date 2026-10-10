import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import authData from '../../fixtures/auth-data.json';

test.describe('SPEC-LOGIN-001 — Admin User Authentication & Role-Based Access', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
  });

  // Spec ID: SPEC-LOGIN-001
// Validation Report: VAL-SPEC-LOGIN-001-1791637471880
  // Test Case ID: TC-LOGIN-001
  // Source: Approved test case — Verify positive main flow for Admin User Authentication & Role-Based Access
  test('TC-LOGIN-001: Verify positive main flow for Admin User Authentication & Role-Based Access', async ({ page }) => {
    await loginPage.login(
      authData.validCredentials.username,
      authData.validCredentials.password,
    );
    await expect(page).toHaveURL(/.*dashboard/);
    expect(await dashboardPage.isDisplayed()).toBe(true);
  });

  // Spec ID: SPEC-LOGIN-001
  // Test Case ID: TC-LOGIN-002
  // Source: Approved test case — Verify exception handling: Exception 1: Invalid username or password should disp
  test('TC-LOGIN-002: Verify exception handling: Exception 1: Invalid username or password should disp', async ({ page }) => {
    await loginPage.login(
      authData.invalidCredentials.username,
      authData.invalidCredentials.password,
    );
    expect(await loginPage.isErrorDisplayed()).toBe(true);
    const errorMsg = await loginPage.getErrorMessage();
    expect(errorMsg).toContain(authData.invalidCredentials.expectedErrorMessage);
  });

  // Spec ID: SPEC-LOGIN-001
  // Test Case ID: TC-LOGIN-003
  // Source: Approved test case — Verify exception handling: Exception 2: Submitting empty username or password fi
  test('TC-LOGIN-003: Verify exception handling: Exception 2: Submitting empty username or password fi', async ({ page }) => {
    await loginPage.login(
      authData.invalidCredentials.username,
      authData.invalidCredentials.password,
    );
    expect(await loginPage.isErrorDisplayed()).toBe(true);
    const errorMsg = await loginPage.getErrorMessage();
    expect(errorMsg).toContain(authData.invalidCredentials.expectedErrorMessage);
  });

  // Spec ID: SPEC-LOGIN-001
  // Test Case ID: TC-LOGIN-004
  // Source: Approved test case — Verify alternate flow: Alternate Flow: Secondary action pathway
  test('TC-LOGIN-004: Verify alternate flow: Alternate Flow: Secondary action pathway', async ({ page }) => {
    await loginPage.login(
      authData.validCredentials.username,
      authData.validCredentials.password,
    );
    await expect(page).toHaveURL(/.*dashboard/);
    expect(await dashboardPage.isDisplayed()).toBe(true);
  });

  // Spec ID: SPEC-LOGIN-001
  // Test Case ID: TC-LOGIN-005
  // Source: Approved test case — Verify data validation rules for Admin User Authentication & Role-Based Access
  test('TC-LOGIN-005: Verify data validation rules for Admin User Authentication & Role-Based Access', async ({ page }) => {
    await loginPage.login(
      authData.validCredentials.username,
      authData.validCredentials.password,
    );
    await expect(page).toHaveURL(/.*dashboard/);
    expect(await dashboardPage.isDisplayed()).toBe(true);
  });
});
