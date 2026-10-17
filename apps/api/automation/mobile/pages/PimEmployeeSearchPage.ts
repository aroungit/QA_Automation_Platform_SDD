// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
import { Page } from '@playwright/test';

export class PimEmployeeSearchPage {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async navigateToSearch() {
        await this.page.goto('http://your-base-url/pim/employee/search');
    }

    async enterEmployeeName(name: string) {
        await this.page.getByPlaceholder('Employee Name').fill(name);
    }

    async selectFullTimeContract() {
        await this.page.getByLabel('Full-Time Contract').check();
    }

    async clickSearch() {
        await this.page.getByRole('button', { name: 'Search' }).click();
    }

    async clickReset() {
        await this.page.getByRole('button', { name: 'Reset' }).click();
    }

    async getResultsTable() {
        return await this.page.locator('table#results');
    }

    async getNoRecordsFoundMessage() {
        return await this.page.getByText('No Records Found');
    }
}