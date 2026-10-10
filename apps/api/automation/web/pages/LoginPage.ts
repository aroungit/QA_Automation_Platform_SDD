// Validation Report: VAL-SPEC-LOGIN-001-1791637471880
import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for OrangeHRM Login Page (§3.5, §4.1)
 * Uses stable, user-facing Playwright locators.
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly alertMessage: Locator;
  readonly requiredErrorMessages: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    // Stable locators (§3.5)
    this.usernameInput = page.getByPlaceholder('Username');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: /login/i });
    this.alertMessage = page.getByRole('alert');
    this.requiredErrorMessages = page.getByText(/required/i);
    this.forgotPasswordLink = page.getByText(/forgot your password/i);
  }

  async goto(path = '/web/index.php/auth/login'): Promise<void> {
    await this.page.goto(path);
    await this.usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  }

  async login(username?: string, password?: string): Promise<void> {
    if (username !== undefined && username !== '') {
      await this.usernameInput.fill(username);
    } else {
      await this.usernameInput.clear();
    }

    if (password !== undefined && password !== '') {
      await this.passwordInput.fill(password);
    } else {
      await this.passwordInput.clear();
    }

    await this.loginButton.click();
  }

  async getErrorMessage(): Promise<string> {
    if (await this.alertMessage.isVisible()) {
      return (await this.alertMessage.textContent()) ?? '';
    }
    if (await this.requiredErrorMessages.first().isVisible()) {
      return (await this.requiredErrorMessages.first().textContent()) ?? '';
    }
    return '';
  }

  async isErrorDisplayed(): Promise<boolean> {
    return (
      (await this.alertMessage.isVisible()) ||
      (await this.requiredErrorMessages.first().isVisible())
    );
  }
}
