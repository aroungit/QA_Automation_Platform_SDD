// Validation Report: VAL-SPEC-ENABLE-CUSTOMERS-002-1792212119587
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'web/tests',
    timeout: 30000,
    expect: {
        timeout: 5000,
    },
    reporter: 'html',
    use: {
        headless: false,
        actionTimeout: 0,
        trace: 'on-first-retry',
    },
});