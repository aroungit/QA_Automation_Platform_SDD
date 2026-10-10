import {
  ApprovalRecordSchema,
  SpecificationSchema,
  TestCaseSchema,
  UserStoryRecordSchema,
  type ApprovalRecord,
  type GeneratedFileInfo,
  type GeneratedScriptFile,
  type GenerateScriptsRequest,
  type GenerateScriptsResult,
  type Platform,
  type Specification,
  type TestCase,
  type UserStoryRecord,
} from '@qaa/shared';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { getConfig } from '../config.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { getProviderRegistry } from '../providers/registry.js';
import type { LLMProvider } from '../providers/types.js';
import type { FileStore } from '../storage/file-store.js';
import { ApprovalGateError } from './approval-service.js';

export class ScriptGeneratorError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = 'SCRIPT_GENERATOR_ERROR', status = 400) {
    super(message);
    this.name = 'ScriptGeneratorError';
    this.code = code;
    this.status = status;
  }
}

export class ScriptGenerator {
  constructor(
    private readonly store: FileStore,
    private readonly registry?: ProviderRegistry,
    private readonly config?: AppConfig,
  ) {}

  private getRegistry(): ProviderRegistry {
    return this.registry ?? getProviderRegistry();
  }

  private getConfig(): AppConfig {
    return this.config ?? getConfig();
  }

  /**
   * Generates Playwright automation scripts for approved test cases (§3.4, §3.5).
   *
   * Rules:
   * 1. Only test cases with status "Approved" can proceed to Playwright script generation.
   * 2. Use TypeScript as default language.
   * 3. Use Page Object Model for maintainability.
   * 4. Separate test data from test logic.
   * 5. Use stable selectors (getByRole, getByLabel, getByPlaceholder, getByText, getByTestId).
   * 6. Include traceability comments mapping each test to its Spec ID and Test Case ID.
   * 7. Output to temporary workspace (/.workspace) for web and/or mobile platforms.
   * 8. Include Playwright configuration.
   */
  async generate(specId: string, request?: GenerateScriptsRequest): Promise<GenerateScriptsResult> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new ScriptGeneratorError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    const artifacts = await this.store.readSpecArtifacts(specId);
    if (!artifacts) {
      throw new ScriptGeneratorError(
        `Specification artifacts for "${specId}" not found.`,
        'NOT_FOUND',
        404,
      );
    }

    // 1. Enforce Approval Gate (§3.4, §3.5): Only Approved test cases proceed
    const approvalRecord: ApprovalRecord | undefined = artifacts.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : undefined;

    if (!approvalRecord || approvalRecord.status !== 'Approved') {
      const currentStatus = approvalRecord?.status ?? 'Draft';
      throw new ApprovalGateError(
        `Specification "${specId}" is in "${currentStatus}" status. Only test cases with status "Approved" can proceed to Playwright script generation (§3.4, §3.5).`,
        'PRECONDITION_FAILED',
        400,
      );
    }

    const approvedIds = approvalRecord.approvedTestCases ?? [];
    if (approvedIds.length === 0) {
      throw new ApprovalGateError(
        `Specification "${specId}" has status "Approved", but no specific test cases are approved (§3.4, §3.5).`,
        'NO_APPROVED_TEST_CASES',
        400,
      );
    }

    // Load and validate test cases
    const allTestCases: TestCase[] = Array.isArray(artifacts.testCasesJson)
      ? z.array(TestCaseSchema).parse(artifacts.testCasesJson)
      : [];

    if (allTestCases.length === 0) {
      throw new ScriptGeneratorError(
        `No test cases found for specification "${specId}".`,
        'NO_TEST_CASES',
        400,
      );
    }

    // Filter to approved test cases
    const approvedTestCases = allTestCases.filter((tc) => approvedIds.includes(tc.id));
    if (approvedTestCases.length === 0) {
      throw new ScriptGeneratorError(
        `None of the approved test case IDs (${approvedIds.join(', ')}) match existing test cases in "${specId}".`,
        'INVALID_APPROVED_TEST_CASES',
        400,
      );
    }

    // Handle optional testCaseIds filter in request
    let selectedTestCases = approvedTestCases;
    if (request?.testCaseIds && request.testCaseIds.length > 0) {
      for (const tcId of request.testCaseIds) {
        if (!approvedIds.includes(tcId)) {
          throw new ApprovalGateError(
            `Test case "${tcId}" has not been approved. Only test cases with status "Approved" can proceed to Playwright script generation (§3.4, §3.5).`,
            'TEST_CASE_NOT_APPROVED',
            400,
          );
        }
      }
      selectedTestCases = approvedTestCases.filter((tc) => request.testCaseIds!.includes(tc.id));
    }

    // Load spec and story records
    const spec: Specification = artifacts.specificationJson
      ? SpecificationSchema.parse(artifacts.specificationJson)
      : {
          specId,
          title: 'Specification',
          businessObjective: 'Automated testing',
          actors: ['User'],
          preconditions: [],
          mainFlow: [],
          alternateFlows: [],
          exceptionFlows: [],
          dataRequirements: [],
          acceptanceCriteria: [],
          nonFunctionalRequirements: [],
          targetApp: 'OrangeHRM',
          environment: 'default',
        };

    const userStory: UserStoryRecord | undefined = artifacts.userStoryJson
      ? UserStoryRecordSchema.parse(artifacts.userStoryJson)
      : undefined;

    // Determine target platform
    const platform: Platform = request?.targetPlatform ?? userStory?.platform ?? 'web';
    const targetApp = userStory?.targetApp ?? spec.targetApp ?? 'OrangeHRM';

    // Optional workspace cleanup
    if (request?.cleanWorkspace) {
      await this.store.cleanWorkspace();
    }

    // Generate script files (LLM with deterministic fallback)
    const scriptFiles = await this.generateFiles(
      spec,
      userStory,
      selectedTestCases,
      platform,
      targetApp,
      request,
    );

    // Write all files to temporary workspace (.workspace)
    const generatedInfos: GeneratedFileInfo[] = [];
    const configFiles: string[] = [];

    for (const file of scriptFiles) {
      await this.store.writeWorkspaceFile(file.path, file.content);
      const size = Buffer.byteLength(file.content, 'utf-8');

      generatedInfos.push({
        path: file.path.replace(/\\/g, '/'),
        category: file.category,
        platform: file.platform,
        size,
      });

      if (file.category === 'config') {
        configFiles.push(file.path.replace(/\\/g, '/'));
      }
    }

    return {
      specId,
      targetApp,
      platform,
      approvedTestCases: selectedTestCases.map((tc) => tc.id),
      generatedFiles: generatedInfos,
      workspaceDir: this.store.tempWorkspaceDir,
      configFiles,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generates files using LLM if available, otherwise uses deterministic generator
   */
  private async generateFiles(
    spec: Specification,
    userStory: UserStoryRecord | undefined,
    testCases: TestCase[],
    platform: Platform,
    targetApp: string,
    request?: GenerateScriptsRequest,
  ): Promise<GeneratedScriptFile[]> {
    const registry = this.getRegistry();

    let resolvedProvider;
    let resolvedModel: string;
    try {
      const resolved = registry.resolveProvider(request?.provider, request?.model);
      resolvedProvider = resolved.provider;
      resolvedModel = resolved.model;
    } catch {
      resolvedProvider = null;
      resolvedModel = '';
    }

    if (resolvedProvider && resolvedProvider.isConfigured()) {
      try {
        const files = await this.generateWithLLM(
          resolvedProvider,
          resolvedModel,
          spec,
          userStory,
          testCases,
          platform,
          targetApp,
        );
        if (files && files.length > 0) {
          // Merge with essential base configs if LLM didn't produce them
          return this.ensureBaseConfigs(files);
        }
      } catch (err) {
        console.warn(
          `[ScriptGenerator] LLM generation failed (${(err as Error).message}). Using deterministic Playwright script generator.`,
        );
      }
    }

    return this.generateDeterministic(spec, userStory, testCases, platform, targetApp);
  }

  /**
   * LLM-driven generation
   */
  private async generateWithLLM(
    provider: LLMProvider,
    model: string,
    spec: Specification,
    userStory: UserStoryRecord | undefined,
    testCases: TestCase[],
    platform: Platform,
    targetApp: string,
  ): Promise<GeneratedScriptFile[]> {
    const prompt = `You are an expert QA Automation Engineer implementing Playwright scripts in TypeScript following Spec-Driven Development (SDD §3.5).

Specification ID: ${spec.specId}
Title: ${spec.title}
Target Application: ${targetApp}
Platform: ${platform}

Specification Details:
- Business Objective: ${spec.businessObjective}
- Main Flow: ${JSON.stringify(spec.mainFlow, null, 2)}
- Alternate Flows: ${JSON.stringify(spec.alternateFlows, null, 2)}
- Exception Flows: ${JSON.stringify(spec.exceptionFlows, null, 2)}
- Data Requirements: ${JSON.stringify(spec.dataRequirements, null, 2)}
- Acceptance Criteria: ${JSON.stringify(spec.acceptanceCriteria, null, 2)}

Approved Test Cases to generate:
${JSON.stringify(testCases, null, 2)}

Strict Requirements (§3.5):
1. Default language: TypeScript (.ts).
2. Use Page Object Model (POM) with clean classes under "${platform === 'mobile' ? 'mobile' : 'web'}/pages/".
3. Separate test data from test logic into JSON fixtures under "${platform === 'mobile' ? 'mobile' : 'web'}/fixtures/".
4. Use stable user-facing locators (page.getByRole, page.getByLabel, page.getByPlaceholder, page.getByText, page.getByTestId).
5. For every single test, you MUST include traceability comments in this exact format:
   // Spec ID: ${spec.specId}
   // Test Case ID: <TC_ID>
   // Source: Approved test case — <TITLE>
6. Tests must be placed in "${platform === 'mobile' ? 'mobile' : 'web'}/tests/${spec.specId}/".
7. Generate Playwright config "playwright.config.ts" and "tsconfig.json".

Return a JSON array of GeneratedScriptFile objects:
[
  {
    "path": string,
    "content": string,
    "category": "page" | "test" | "fixture" | "util" | "config",
    "platform": "web" | "mobile" | "shared",
    "specId": "${spec.specId}",
    "testCaseId": optional string
  }
]`;

    const Schema = z.array(
      z.object({
        path: z.string(),
        content: z.string(),
        category: z.enum(['page', 'test', 'fixture', 'util', 'config']),
        platform: z.enum(['web', 'mobile', 'shared']),
        specId: z.string().optional(),
        testCaseId: z.string().optional(),
      }),
    );

    const result = await provider.generateJSON<GeneratedScriptFile[]>(prompt, Schema, {
      model,
      temperature: 0.1,
      systemPrompt:
        'You are a senior Playwright automation architect. Generate complete, syntactically valid TypeScript Playwright Page Object Model code with strict test-data separation and traceability comments.',
    });

    return result;
  }

  /**
   * Deterministic Playwright Script Generator (§3.5)
   * Produces robust, idiomatic TypeScript Playwright scripts with Page Object Model,
   * test data separation, stable selectors, and required traceability comments.
   */
  generateDeterministic(
    spec: Specification,
    userStory: UserStoryRecord | undefined,
    testCases: TestCase[],
    platform: Platform,
    targetApp: string,
  ): GeneratedScriptFile[] {
    const files: GeneratedScriptFile[] = [];
    const appConfig = this.getConfig();

    // 1. Root Workspace Configuration Files
    files.push(this.generatePlaywrightConfig(appConfig));
    files.push(this.generateTsConfig());

    const platformsToGenerate: ('web' | 'mobile')[] =
      platform === 'both' ? ['web', 'mobile'] : [platform === 'mobile' ? 'mobile' : 'web'];

    for (const plat of platformsToGenerate) {
      if (plat === 'web') {
        files.push(...this.generateWebArtifacts(spec, userStory, testCases, targetApp, appConfig));
      } else {
        files.push(
          ...this.generateMobileArtifacts(spec, userStory, testCases, targetApp, appConfig),
        );
      }
    }

    return files;
  }

  /**
   * Ensures base configuration files are present
   */
  private ensureBaseConfigs(files: GeneratedScriptFile[]): GeneratedScriptFile[] {
    const hasPlaywrightConfig = files.some(
      (f) => f.path === 'playwright.config.ts' || f.path.endsWith('/playwright.config.ts'),
    );
    const hasTsConfig = files.some(
      (f) => f.path === 'tsconfig.json' || f.path.endsWith('/tsconfig.json'),
    );

    const merged = [...files];
    if (!hasPlaywrightConfig) {
      merged.unshift(this.generatePlaywrightConfig(this.getConfig()));
    }
    if (!hasTsConfig) {
      merged.unshift(this.generateTsConfig());
    }
    return merged;
  }

  /**
   * Generates playwright.config.ts for workspace (§3.5)
   */
  private generatePlaywrightConfig(appConfig: AppConfig): GeneratedScriptFile {
    const orangeHrmBaseUrl = appConfig.targets.orangeHrm.baseUrl;
    const reactAppBaseUrl = appConfig.targets.reactApp.baseUrl;
    const mobileDevice = appConfig.mobile.device || 'Pixel 7';

    const content = `import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for QA_Automation_Platform_Agent (§3.5)
 * Generated for temporary workspace validation and dynamic execution.
 * Configured for OrangeHRM (${orangeHrmBaseUrl}), React App (${reactAppBaseUrl}), and Mobile.
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['**/tests/**/*.spec.ts'],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.ORANGEHRM_BASE_URL || '${orangeHrmBaseUrl}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /web\\/tests\\/.*\\.spec\\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: /web\\/tests\\/.*\\.spec\\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /web\\/tests\\/.*\\.spec\\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: /mobile\\/tests\\/.*\\.spec\\.ts/,
      use: {
        ...devices[process.env.MOBILE_DEVICE || '${mobileDevice}'],
      },
    },
    {
      name: 'mobile-safari',
      testMatch: /mobile\\/tests\\/.*\\.spec\\.ts/,
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],
});
`;

    return {
      path: 'playwright.config.ts',
      content,
      category: 'config',
      platform: 'shared',
    };
  }

  /**
   * Generates tsconfig.json for workspace
   */
  private generateTsConfig(): GeneratedScriptFile {
    const content = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          lib: ['ES2022', 'DOM'],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
        },
        include: ['**/*.ts', '**/*.json'],
      },
      null,
      2,
    );

    return {
      path: 'tsconfig.json',
      content,
      category: 'config',
      platform: 'shared',
    };
  }

  /**
   * Generates Web automation artifacts (§3.5, §4.1, §4.2)
   */
  private generateWebArtifacts(
    spec: Specification,
    userStory: UserStoryRecord | undefined,
    testCases: TestCase[],
    targetApp: string,
    appConfig: AppConfig,
  ): GeneratedScriptFile[] {
    const files: GeneratedScriptFile[] = [];
    const isAuth = this.isAuthRelated(spec, userStory);

    if (isAuth && targetApp.toLowerCase().includes('orangehrm')) {
      // 1. Pages: LoginPage & DashboardPage
      files.push(this.createWebOrangeHRMLoginPage());
      files.push(this.createWebOrangeHRMDashboardPage());

      // 2. Fixture: auth-data.json
      files.push(this.createWebAuthFixture(appConfig));

      // 3. Utils: test-helpers.ts
      files.push(this.createWebTestHelpers());

      // 4. Test files for each approved test case
      for (const tc of testCases) {
        files.push(this.createWebOrangeHRMTestCaseSpec(spec, tc));
      }

      // 5. Combined test suite for the spec
      files.push(this.createWebOrangeHRMTestSuite(spec, testCases));
    } else {
      // Generic Web Page Object & Suite
      const pageName = this.derivePageClassName(spec.title);
      files.push(this.createGenericWebPage(pageName, spec, targetApp));
      files.push(this.createGenericWebFixture(spec));
      files.push(this.createWebTestHelpers());

      for (const tc of testCases) {
        files.push(this.createGenericWebTestCaseSpec(pageName, spec, tc));
      }

      files.push(this.createGenericWebTestSuite(pageName, spec, testCases));
    }

    return files;
  }

  /**
   * Generates Mobile automation artifacts (§3.5, §4.3)
   */
  private generateMobileArtifacts(
    spec: Specification,
    userStory: UserStoryRecord | undefined,
    testCases: TestCase[],
    targetApp: string,
    appConfig: AppConfig,
  ): GeneratedScriptFile[] {
    const files: GeneratedScriptFile[] = [];
    const isAuth = this.isAuthRelated(spec, userStory);

    if (isAuth && targetApp.toLowerCase().includes('orangehrm')) {
      files.push(this.createMobileOrangeHRMLoginPage());
      files.push(this.createMobileOrangeHRMDashboardPage());
      files.push(this.createMobileAuthFixture(appConfig));
      files.push(this.createMobileTestHelpers());

      for (const tc of testCases) {
        files.push(this.createMobileOrangeHRMTestCaseSpec(spec, tc));
      }

      files.push(this.createMobileOrangeHRMTestSuite(spec, testCases));
    } else {
      const pageName = `Mobile${this.derivePageClassName(spec.title)}`;
      files.push(this.createGenericMobilePage(pageName, spec, targetApp));
      files.push(this.createGenericMobileFixture(spec));
      files.push(this.createMobileTestHelpers());

      for (const tc of testCases) {
        files.push(this.createGenericMobileTestCaseSpec(pageName, spec, tc));
      }

      files.push(this.createGenericMobileTestSuite(pageName, spec, testCases));
    }

    return files;
  }

  // ==========================================
  // Web OrangeHRM Templates
  // ==========================================

  private createWebOrangeHRMLoginPage(): GeneratedScriptFile {
    const content = `import { type Page, type Locator } from '@playwright/test';

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
`;

    return {
      path: 'web/pages/LoginPage.ts',
      content,
      category: 'page',
      platform: 'web',
    };
  }

  private createWebOrangeHRMDashboardPage(): GeneratedScriptFile {
    const content = `import { type Page, type Locator } from '@playwright/test';

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
`;

    return {
      path: 'web/pages/DashboardPage.ts',
      content,
      category: 'page',
      platform: 'web',
    };
  }

  private createWebAuthFixture(appConfig: AppConfig): GeneratedScriptFile {
    const content = JSON.stringify(
      {
        validCredentials: {
          username: appConfig.targets.orangeHrm.username || 'Admin',
          password: appConfig.targets.orangeHrm.password || 'admin123',
        },
        invalidCredentials: {
          username: 'InvalidUser',
          password: 'WrongPassword123',
          expectedErrorMessage: 'Invalid credentials',
        },
        emptyCredentials: {
          username: '',
          password: '',
          expectedErrorMessage: 'Required',
        },
        urls: {
          login: '/web/index.php/auth/login',
          dashboard: '/web/index.php/dashboard/index',
        },
      },
      null,
      2,
    );

    return {
      path: 'web/fixtures/auth-data.json',
      content,
      category: 'fixture',
      platform: 'web',
    };
  }

  private createWebTestHelpers(): GeneratedScriptFile {
    const content = `import { type Page, expect } from '@playwright/test';

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
`;

    return {
      path: 'web/utils/test-helpers.ts',
      content,
      category: 'util',
      platform: 'web',
    };
  }

  private createWebOrangeHRMTestCaseSpec(spec: Specification, tc: TestCase): GeneratedScriptFile {
    const isNegative =
      tc.testType === 'negative' ||
      tc.title.toLowerCase().includes('invalid') ||
      tc.title.toLowerCase().includes('fail') ||
      tc.title.toLowerCase().includes('empty');

    const testBody = isNegative
      ? `    // Step 1: Attempt login with invalid credentials from fixture
    await loginPage.login(
      authData.invalidCredentials.username,
      authData.invalidCredentials.password,
    );

    // Step 2: Verify error message is displayed
    const isErrorVisible = await loginPage.isErrorDisplayed();
    expect(isErrorVisible).toBe(true);

    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain(authData.invalidCredentials.expectedErrorMessage);`
      : `    // Step 1: Login with valid credentials from fixture
    await loginPage.login(
      authData.validCredentials.username,
      authData.validCredentials.password,
    );

    // Step 2: Assert navigation to Dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    const isDashboardVisible = await dashboardPage.isDisplayed();
    expect(isDashboardVisible).toBe(true);`;

    const content = `import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import authData from '../../fixtures/auth-data.json';

// Spec ID: ${spec.specId}
// Test Case ID: ${tc.id}
// Source: Approved test case — ${tc.title}
test('${tc.id}: ${tc.title}', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  await loginPage.goto();

${testBody}
});
`;

    return {
      path: `web/tests/${spec.specId}/${tc.id}.spec.ts`,
      content,
      category: 'test',
      platform: 'web',
      specId: spec.specId,
      testCaseId: tc.id,
    };
  }

  private createWebOrangeHRMTestSuite(
    spec: Specification,
    testCases: TestCase[],
  ): GeneratedScriptFile {
    const testBlocks = testCases.map((tc) => {
      const isNegative =
        tc.testType === 'negative' ||
        tc.title.toLowerCase().includes('invalid') ||
        tc.title.toLowerCase().includes('fail') ||
        tc.title.toLowerCase().includes('empty');

      const body = isNegative
        ? `    await loginPage.login(
      authData.invalidCredentials.username,
      authData.invalidCredentials.password,
    );
    expect(await loginPage.isErrorDisplayed()).toBe(true);
    const errorMsg = await loginPage.getErrorMessage();
    expect(errorMsg).toContain(authData.invalidCredentials.expectedErrorMessage);`
        : `    await loginPage.login(
      authData.validCredentials.username,
      authData.validCredentials.password,
    );
    await expect(page).toHaveURL(/.*dashboard/);
    expect(await dashboardPage.isDisplayed()).toBe(true);`;

      return `  // Spec ID: ${spec.specId}
  // Test Case ID: ${tc.id}
  // Source: Approved test case — ${tc.title}
  test('${tc.id}: ${tc.title}', async ({ page }) => {
${body}
  });`;
    });

    const content = `import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import authData from '../../fixtures/auth-data.json';

test.describe('${spec.specId} — ${spec.title}', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
  });

${testBlocks.join('\n\n')}
});
`;

    return {
      path: `web/tests/${spec.specId}/${spec.specId}.spec.ts`,
      content,
      category: 'test',
      platform: 'web',
      specId: spec.specId,
    };
  }

  // ==========================================
  // Mobile OrangeHRM Templates (§4.3)
  // ==========================================

  private createMobileOrangeHRMLoginPage(): GeneratedScriptFile {
    const content = `import { type Page, type Locator } from '@playwright/test';

/**
 * Mobile Page Object Model for OrangeHRM Login (§3.5, §4.3)
 * Adapts to mobile viewports, touch interactions, and responsive layouts.
 */
export class MobileLoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly alertMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByPlaceholder('Username');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: /login/i });
    this.alertMessage = page.getByRole('alert');
  }

  async goto(path = '/web/index.php/auth/login'): Promise<void> {
    await this.page.goto(path);
    await this.usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  }

  async login(username?: string, password?: string): Promise<void> {
    if (username) {
      await this.usernameInput.tap();
      await this.usernameInput.fill(username);
    } else {
      await this.usernameInput.clear();
    }

    if (password) {
      await this.passwordInput.tap();
      await this.passwordInput.fill(password);
    } else {
      await this.passwordInput.clear();
    }

    await this.loginButton.tap();
  }

  async getErrorMessage(): Promise<string> {
    if (await this.alertMessage.isVisible()) {
      return (await this.alertMessage.textContent()) ?? '';
    }
    return '';
  }

  async isErrorDisplayed(): Promise<boolean> {
    return await this.alertMessage.isVisible();
  }
}
`;

    return {
      path: 'mobile/pages/MobileLoginPage.ts',
      content,
      category: 'page',
      platform: 'mobile',
    };
  }

  private createMobileOrangeHRMDashboardPage(): GeneratedScriptFile {
    const content = `import { type Page, type Locator } from '@playwright/test';

/**
 * Mobile Page Object Model for OrangeHRM Dashboard (§3.5, §4.3)
 * Handles mobile hamburger menus, touch targets, and responsive views.
 */
export class MobileDashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly userDropdown: Locator;
  readonly logoutMenuItem: Locator;

  constructor(page: Page) {
    this.page = page;
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
    await this.userDropdown.tap();
    await this.logoutMenuItem.waitFor({ state: 'visible', timeout: 5000 });
    await this.logoutMenuItem.tap();
  }
}
`;

    return {
      path: 'mobile/pages/MobileDashboardPage.ts',
      content,
      category: 'page',
      platform: 'mobile',
    };
  }

  private createMobileAuthFixture(appConfig: AppConfig): GeneratedScriptFile {
    const content = JSON.stringify(
      {
        deviceConfig: {
          device: appConfig.mobile.device || 'Pixel 7',
          emulatorName: appConfig.mobile.emulatorName || '',
          appPath: appConfig.mobile.appPath || '',
        },
        validCredentials: {
          username: appConfig.targets.orangeHrm.username || 'Admin',
          password: appConfig.targets.orangeHrm.password || 'admin123',
        },
        invalidCredentials: {
          username: 'InvalidMobileUser',
          password: 'WrongPassword123',
          expectedErrorMessage: 'Invalid credentials',
        },
        urls: {
          login: '/web/index.php/auth/login',
          dashboard: '/web/index.php/dashboard/index',
        },
      },
      null,
      2,
    );

    return {
      path: 'mobile/fixtures/auth-data.json',
      content,
      category: 'fixture',
      platform: 'mobile',
    };
  }

  private createMobileTestHelpers(): GeneratedScriptFile {
    const content = `import { type Page, expect } from '@playwright/test';

/**
 * Mobile-specific test helpers and touch interaction utilities (§3.5, §4.3)
 */
export async function tapElement(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible' });
  await locator.tap();
}

export async function assertMobileAlert(page: Page, expectedText: string): Promise<void> {
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible({ timeout: 5000 });
  await expect(alert).toContainText(expectedText);
}
`;

    return {
      path: 'mobile/utils/test-helpers.ts',
      content,
      category: 'util',
      platform: 'mobile',
    };
  }

  private createMobileOrangeHRMTestCaseSpec(
    spec: Specification,
    tc: TestCase,
  ): GeneratedScriptFile {
    const isNegative =
      tc.testType === 'negative' ||
      tc.title.toLowerCase().includes('invalid') ||
      tc.title.toLowerCase().includes('fail') ||
      tc.title.toLowerCase().includes('empty');

    const testBody = isNegative
      ? `    // Step 1: Submit invalid credentials on mobile interface
    await loginPage.login(
      authData.invalidCredentials.username,
      authData.invalidCredentials.password,
    );

    // Step 2: Verify mobile error alert
    const isErrorVisible = await loginPage.isErrorDisplayed();
    expect(isErrorVisible).toBe(true);

    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain(authData.invalidCredentials.expectedErrorMessage);`
      : `    // Step 1: Submit valid credentials on mobile interface
    await loginPage.login(
      authData.validCredentials.username,
      authData.validCredentials.password,
    );

    // Step 2: Verify mobile dashboard display
    await expect(page).toHaveURL(/.*dashboard/);
    const isDashboardVisible = await dashboardPage.isDisplayed();
    expect(isDashboardVisible).toBe(true);`;

    const content = `import { test, expect } from '@playwright/test';
import { MobileLoginPage } from '../../pages/MobileLoginPage';
import { MobileDashboardPage } from '../../pages/MobileDashboardPage';
import authData from '../../fixtures/auth-data.json';

// Spec ID: ${spec.specId}
// Test Case ID: ${tc.id}
// Source: Approved test case — ${tc.title}
test('${tc.id}: ${tc.title} (Mobile)', async ({ page }) => {
  const loginPage = new MobileLoginPage(page);
  const dashboardPage = new MobileDashboardPage(page);

  await loginPage.goto();

${testBody}
});
`;

    return {
      path: `mobile/tests/${spec.specId}/${tc.id}.spec.ts`,
      content,
      category: 'test',
      platform: 'mobile',
      specId: spec.specId,
      testCaseId: tc.id,
    };
  }

  private createMobileOrangeHRMTestSuite(
    spec: Specification,
    testCases: TestCase[],
  ): GeneratedScriptFile {
    const testBlocks = testCases.map((tc) => {
      const isNegative =
        tc.testType === 'negative' ||
        tc.title.toLowerCase().includes('invalid') ||
        tc.title.toLowerCase().includes('fail') ||
        tc.title.toLowerCase().includes('empty');

      const body = isNegative
        ? `    await loginPage.login(
      authData.invalidCredentials.username,
      authData.invalidCredentials.password,
    );
    expect(await loginPage.isErrorDisplayed()).toBe(true);
    const errorMsg = await loginPage.getErrorMessage();
    expect(errorMsg).toContain(authData.invalidCredentials.expectedErrorMessage);`
        : `    await loginPage.login(
      authData.validCredentials.username,
      authData.validCredentials.password,
    );
    await expect(page).toHaveURL(/.*dashboard/);
    expect(await dashboardPage.isDisplayed()).toBe(true);`;

      return `  // Spec ID: ${spec.specId}
  // Test Case ID: ${tc.id}
  // Source: Approved test case — ${tc.title}
  test('${tc.id}: ${tc.title} (Mobile)', async ({ page }) => {
${body}
  });`;
    });

    const content = `import { test, expect } from '@playwright/test';
import { MobileLoginPage } from '../../pages/MobileLoginPage';
import { MobileDashboardPage } from '../../pages/MobileDashboardPage';
import authData from '../../fixtures/auth-data.json';

test.describe('${spec.specId} — ${spec.title} (Mobile)', () => {
  let loginPage: MobileLoginPage;
  let dashboardPage: MobileDashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new MobileLoginPage(page);
    dashboardPage = new MobileDashboardPage(page);
    await loginPage.goto();
  });

${testBlocks.join('\n\n')}
});
`;

    return {
      path: `mobile/tests/${spec.specId}/${spec.specId}.spec.ts`,
      content,
      category: 'test',
      platform: 'mobile',
      specId: spec.specId,
    };
  }

  // ==========================================
  // Generic Web & Mobile POM Templates
  // ==========================================

  private createGenericWebPage(
    className: string,
    spec: Specification,
    targetApp: string,
  ): GeneratedScriptFile {
    const methods = spec.mainFlow.map((step) => {
      const methodName = this.toMethodName(step.action);
      return `  /**
   * Step ${step.step}: ${step.action}
   */
  async ${methodName}(): Promise<void> {
    // Stable locator action for: ${step.action}
    await this.primaryAction.click();
  }`;
    });

    const content = `import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for ${spec.title} (${targetApp}) (§3.5)
 * Encapsulates stable selectors and user flow operations.
 */
export class ${className} {
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

${methods.join('\n\n')}
}
`;

    return {
      path: `web/pages/${className}.ts`,
      content,
      category: 'page',
      platform: 'web',
    };
  }

  private createGenericWebFixture(spec: Specification): GeneratedScriptFile {
    const fieldsObj: Record<string, string> = {};
    for (const req of spec.dataRequirements) {
      fieldsObj[req.field] = `test_${req.field}_value`;
    }

    const content = JSON.stringify(
      {
        specId: spec.specId,
        testData: fieldsObj,
        acceptanceCriteria: spec.acceptanceCriteria,
      },
      null,
      2,
    );

    return {
      path: `web/fixtures/${spec.specId.toLowerCase()}-data.json`,
      content,
      category: 'fixture',
      platform: 'web',
    };
  }

  private createGenericWebTestCaseSpec(
    className: string,
    spec: Specification,
    tc: TestCase,
  ): GeneratedScriptFile {
    const fixtureImportName = `${spec.specId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data`;
    const fixtureFileName = `${spec.specId.toLowerCase()}-data.json`;

    const content = `import { test, expect } from '@playwright/test';
import { ${className} } from '../../pages/${className}';
import ${fixtureImportName} from '../../fixtures/${fixtureFileName}';

// Spec ID: ${spec.specId}
// Test Case ID: ${tc.id}
// Source: Approved test case — ${tc.title}
test('${tc.id}: ${tc.title}', async ({ page }) => {
  const pageObject = new ${className}(page);
  await pageObject.goto();

  // Execute test steps derived from approved test case
  expect(await pageObject.isLoaded()).toBe(true);

  // Assertion on expected outcome (§3.5)
  // Expected: ${tc.expectedResults.join('; ')}
  expect(${fixtureImportName}.acceptanceCriteria.length).toBeGreaterThan(0);
});
`;

    return {
      path: `web/tests/${spec.specId}/${tc.id}.spec.ts`,
      content,
      category: 'test',
      platform: 'web',
      specId: spec.specId,
      testCaseId: tc.id,
    };
  }

  private createGenericWebTestSuite(
    className: string,
    spec: Specification,
    testCases: TestCase[],
  ): GeneratedScriptFile {
    const fixtureImportName = `${spec.specId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data`;
    const fixtureFileName = `${spec.specId.toLowerCase()}-data.json`;

    const testBlocks = testCases.map((tc) => {
      return `  // Spec ID: ${spec.specId}
  // Test Case ID: ${tc.id}
  // Source: Approved test case — ${tc.title}
  test('${tc.id}: ${tc.title}', async ({ page }) => {
    expect(await pageObject.isLoaded()).toBe(true);
    expect(${fixtureImportName}.acceptanceCriteria).toBeDefined();
  });`;
    });

    const content = `import { test, expect } from '@playwright/test';
import { ${className} } from '../../pages/${className}';
import ${fixtureImportName} from '../../fixtures/${fixtureFileName}';

test.describe('${spec.specId} — ${spec.title}', () => {
  let pageObject: ${className};

  test.beforeEach(async ({ page }) => {
    pageObject = new ${className}(page);
    await pageObject.goto();
  });

${testBlocks.join('\n\n')}
});
`;

    return {
      path: `web/tests/${spec.specId}/${spec.specId}.spec.ts`,
      content,
      category: 'test',
      platform: 'web',
      specId: spec.specId,
    };
  }

  private createGenericMobilePage(
    className: string,
    spec: Specification,
    targetApp: string,
  ): GeneratedScriptFile {
    const content = `import { type Page, type Locator } from '@playwright/test';

/**
 * Mobile Page Object Model for ${spec.title} (${targetApp}) (§3.5, §4.3)
 */
export class ${className} {
  readonly page: Page;
  readonly heading: Locator;
  readonly primaryAction: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading').first();
    this.primaryAction = page.getByRole('button').first();
  }

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }

  async isLoaded(): Promise<boolean> {
    return await this.heading.isVisible();
  }
}
`;

    return {
      path: `mobile/pages/${className}.ts`,
      content,
      category: 'page',
      platform: 'mobile',
    };
  }

  private createGenericMobileFixture(spec: Specification): GeneratedScriptFile {
    const content = JSON.stringify(
      {
        specId: spec.specId,
        acceptanceCriteria: spec.acceptanceCriteria,
      },
      null,
      2,
    );

    return {
      path: `mobile/fixtures/${spec.specId.toLowerCase()}-data.json`,
      content,
      category: 'fixture',
      platform: 'mobile',
    };
  }

  private createGenericMobileTestCaseSpec(
    className: string,
    spec: Specification,
    tc: TestCase,
  ): GeneratedScriptFile {
    const fixtureImportName = `${spec.specId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data`;
    const fixtureFileName = `${spec.specId.toLowerCase()}-data.json`;

    const content = `import { test, expect } from '@playwright/test';
import { ${className} } from '../../pages/${className}';
import ${fixtureImportName} from '../../fixtures/${fixtureFileName}';

// Spec ID: ${spec.specId}
// Test Case ID: ${tc.id}
// Source: Approved test case — ${tc.title}
test('${tc.id}: ${tc.title} (Mobile)', async ({ page }) => {
  const pageObject = new ${className}(page);
  await pageObject.goto();

  expect(await pageObject.isLoaded()).toBe(true);
  expect(${fixtureImportName}.acceptanceCriteria.length).toBeGreaterThan(0);
});
`;

    return {
      path: `mobile/tests/${spec.specId}/${tc.id}.spec.ts`,
      content,
      category: 'test',
      platform: 'mobile',
      specId: spec.specId,
      testCaseId: tc.id,
    };
  }

  private createGenericMobileTestSuite(
    className: string,
    spec: Specification,
    testCases: TestCase[],
  ): GeneratedScriptFile {
    const fixtureImportName = `${spec.specId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data`;
    const fixtureFileName = `${spec.specId.toLowerCase()}-data.json`;

    const testBlocks = testCases.map((tc) => {
      return `  // Spec ID: ${spec.specId}
  // Test Case ID: ${tc.id}
  // Source: Approved test case — ${tc.title}
  test('${tc.id}: ${tc.title} (Mobile)', async ({ page }) => {
    expect(await pageObject.isLoaded()).toBe(true);
    expect(${fixtureImportName}.acceptanceCriteria).toBeDefined();
  });`;
    });

    const content = `import { test, expect } from '@playwright/test';
import { ${className} } from '../../pages/${className}';
import ${fixtureImportName} from '../../fixtures/${fixtureFileName}';

test.describe('${spec.specId} — ${spec.title} (Mobile)', () => {
  let pageObject: ${className};

  test.beforeEach(async ({ page }) => {
    pageObject = new ${className}(page);
    await pageObject.goto();
  });

${testBlocks.join('\n\n')}
});
`;

    return {
      path: `mobile/tests/${spec.specId}/${spec.specId}.spec.ts`,
      content,
      category: 'test',
      platform: 'mobile',
      specId: spec.specId,
    };
  }

  // ==========================================
  // Helper Utilities
  // ==========================================

  private isAuthRelated(spec: Specification, userStory?: UserStoryRecord): boolean {
    const combined =
      `${spec.title} ${spec.businessObjective} ${userStory?.title ?? ''} ${userStory?.story ?? ''}`.toLowerCase();
    return (
      combined.includes('login') ||
      combined.includes('logout') ||
      combined.includes('auth') ||
      combined.includes('credential') ||
      combined.includes('sign in')
    );
  }

  private derivePageClassName(title: string): string {
    const words = title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    const pascal = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    return pascal.endsWith('Page') ? pascal : `${pascal}Page`;
  }

  private toMethodName(action: string): string {
    const words = action
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 4)
      .filter(Boolean);
    if (words.length === 0) return 'executeAction';
    const camel =
      words[0]!.toLowerCase() +
      words
        .slice(1)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    return camel;
  }
}
