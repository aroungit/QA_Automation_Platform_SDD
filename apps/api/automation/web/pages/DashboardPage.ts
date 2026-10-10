// Validation Report: VAL-SPEC-LOGIN-001-1791637471880
import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for OrangeHRM Dashboard Page (§3.5, §4.1)
 * Encapsulates post-login dashboard locators and interactions.
 */
export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly userDropdown: Locator;
  readonly logoutMenuItem: Locator;

  constructor(page: Page) {
    this.page = page;
    // Stable locators (§3.5)
    this.heading = page.getByRole('heading', { name: /dashboard/i });
    this.userDropdown = page.locator('.oxd-userdropdown-tab');
    this.logoutMenuItem = page.getByRole('menuitem', { name: /logout/i });
  }

  async isDisplayed(): Promise<boolean> {
    try {
      await this.heading.waitFor({ state: 'visible', timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.userDropdown.click();
    await this.logoutMenuItem.waitFor({ state: 'visible', timeout: 5000 });
    await this.logoutMenuItem.click();
  }
}
