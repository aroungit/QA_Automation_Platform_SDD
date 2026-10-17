// Validation Report: VAL-SPEC-EMP-SEARCH-001-1792202300927
import { type Page, expect } from '@playwright/test';

/**
 * Common test helper utilities for Web automation (§3.5)
 */
export async function waitForPageLoaded(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
}

export async function assertAlertMessage(page: Page, expectedSubstring: string): Promise<void> {
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible({ timeout: 5000 });
  await expect(alert).toContainText(expectedSubstring);
}
