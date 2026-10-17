// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
import { Page } from '@playwright/test';

export class LoginPage {
    constructor(private page: Page) {}

    async navigateToLogin() {
        await this.page.goto('https://example.com/login');
    }

    async clickForgotPassword() {
        await this.page.getByText('Forgot password').click();
    }

    async enterEmail(email: string) {
        await this.page.getByLabel('Email').fill(email);
    }

    async submitRequest() {
        await this.page.getByRole('button', { name: 'Submit' }).click();
    }

    async enterNewPassword(newPassword: string) {
        await this.page.getByLabel('New Password').fill(newPassword);
    }

    async confirmNewPassword(confirmPassword: string) {
        await this.page.getByLabel('Confirm Password').fill(confirmPassword);
    }

    async submitNewPassword() {
        await this.page.getByRole('button', { name: 'Reset Password' }).click();
    }

    async getErrorMessage() {
        return await this.page.getByTestId('error-message').innerText();
    }

    async getSuccessMessage() {
        return await this.page.getByTestId('success-message').innerText();
    }
}