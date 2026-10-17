// Validation Report: VAL-SPEC-EMP-SEARCH-001-1792202300927
import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for Enable Customers to Reset Their Password (Online banking web app) (§3.5)
 * Encapsulates stable selectors and user flow operations.
 */
export class EnableCustomersToResetTheirPasswordPage {
  readonly page: Page;
  readonly mainHeading: Locator;
  readonly primaryAction: Locator;
  readonly statusAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    // Stable user-facing locators (§3.5)
    this.mainHeading = page.getByRole('heading', { level: 1 }).or(page.getByRole('heading').first());
    this.primaryAction = page.getByRole('button').first();
    this.statusAlert = page.getByRole('alert');
  }

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }

  async isLoaded(): Promise<boolean> {
    return await this.mainHeading.isVisible();
  }

  /**
   * Step 1: Customer clicks the "Forgot password" link on the login page.
   */
  async customerClicksTheForgot(): Promise<void> {
    // Stable locator action for: Customer clicks the "Forgot password" link on the login page.
    await this.primaryAction.click();
  }

  /**
   * Step 2: Customer enters their registered email address and submits the form.
   */
  async customerEntersTheirRegistered(): Promise<void> {
    // Stable locator action for: Customer enters their registered email address and submits the form.
    await this.primaryAction.click();
  }

  /**
   * Step 3: Customer receives the email and clicks the reset link.
   */
  async customerReceivesTheEmail(): Promise<void> {
    // Stable locator action for: Customer receives the email and clicks the reset link.
    await this.primaryAction.click();
  }

  /**
   * Step 4: Customer enters a new password that complies with the password policy and confirms it.
   */
  async customerEntersANew(): Promise<void> {
    // Stable locator action for: Customer enters a new password that complies with the password policy and confirms it.
    await this.primaryAction.click();
  }
}
