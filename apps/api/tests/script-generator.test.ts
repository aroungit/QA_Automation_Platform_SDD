import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { IntakeService } from '../src/services/intake-service.js';
import { ScriptGenerator } from '../src/services/script-generator.js';
import { FileStore } from '../src/storage/file-store.js';

describe('ScriptGenerator (§3.5)', () => {
  let tempDir: string;
  let store: FileStore;
  let intakeService: IntakeService;
  let scriptGenerator: ScriptGenerator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-script-generator-test-'));
    const config = loadConfig({}, tempDir);
    store = new FileStore(config.storage);
    await store.init();
    intakeService = new IntakeService(store);
    scriptGenerator = new ScriptGenerator(store, undefined, config);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createSpecWithStatus(
    status: string,
    options?: { approvedTestCases?: string[]; platform?: 'web' | 'mobile' | 'both' },
  ) {
    const intake = await intakeService.processIntake({
      title: 'OrangeHRM User Authentication',
      story:
        'As an employee, I want to authenticate into OrangeHRM, so that I can access the HR portal.',
      acceptanceCriteria: [
        'Valid credentials navigate to dashboard',
        'Invalid credentials display error alert',
      ],
      priority: 'high',
      platform: options?.platform ?? 'web',
      targetApp: 'OrangeHRM',
      slug: 'LOGIN',
      generateSpec: true,
      generateTestCases: true,
    });

    const specId = intake.specId;

    if (status !== 'Draft') {
      const approvalService = intakeService.getApprovalService();
      if (status === 'Under Review') {
        await approvalService.submitDecision(specId, {
          status: 'Under Review',
          reviewer: 'QA Lead Jane',
          comments: 'Reviewing test cases',
        });
      } else if (status === 'Approved') {
        await approvalService.submitDecision(specId, {
          status: 'Approved',
          reviewer: 'QA Lead Jane',
          comments: 'Approved for automation',
          approvedTestCases: options?.approvedTestCases,
        });
      } else if (status === 'Rejected') {
        await approvalService.submitDecision(specId, {
          status: 'Rejected',
          reviewer: 'QA Lead Jane',
          comments: 'Needs rework',
        });
      } else if (status === 'Needs Clarification') {
        await approvalService.submitDecision(specId, {
          status: 'Needs Clarification',
          reviewer: 'QA Lead Jane',
          comments: 'Unclear acceptance criteria',
        });
      }
    }

    return specId;
  }

  // ==========================================
  // Approval Gate Enforcement (§3.4, §3.5)
  // ==========================================

  it('rejects script generation when specification does not exist', async () => {
    await expect(scriptGenerator.generate('SPEC-NONEXISTENT-999')).rejects.toThrow(
      /Specification "SPEC-NONEXISTENT-999" not found/,
    );
  });

  it('rejects script generation when status is Draft (§3.4, §3.5)', async () => {
    const specId = await createSpecWithStatus('Draft');
    await expect(scriptGenerator.generate(specId)).rejects.toThrow(
      /Only test cases with status "Approved" can proceed to Playwright script generation/,
    );
  });

  it('rejects script generation when status is Under Review (§3.4, §3.5)', async () => {
    const specId = await createSpecWithStatus('Under Review');
    await expect(scriptGenerator.generate(specId)).rejects.toThrow(
      /Only test cases with status "Approved" can proceed to Playwright script generation/,
    );
  });

  it('rejects script generation when status is Rejected (§3.4, §3.5)', async () => {
    const specId = await createSpecWithStatus('Rejected');
    await expect(scriptGenerator.generate(specId)).rejects.toThrow(
      /Only test cases with status "Approved" can proceed to Playwright script generation/,
    );
  });

  it('rejects script generation when status is Needs Clarification (§3.4, §3.5)', async () => {
    const specId = await createSpecWithStatus('Needs Clarification');
    await expect(scriptGenerator.generate(specId)).rejects.toThrow(
      /Only test cases with status "Approved" can proceed to Playwright script generation/,
    );
  });

  it('rejects script generation when requested testCaseId is not approved (§3.4, §3.5)', async () => {
    const specId = await createSpecWithStatus('Approved', {
      approvedTestCases: ['TC-LOGIN-001'],
    });

    await expect(
      scriptGenerator.generate(specId, {
        testCaseIds: ['TC-LOGIN-002'], // Not approved!
      }),
    ).rejects.toThrow(/Test case "TC-LOGIN-002" has not been approved/);
  });

  // ==========================================
  // Script Generation for Approved Test Cases (§3.5)
  // ==========================================

  it('generates complete Web Playwright scripts for Approved test cases', async () => {
    const specId = await createSpecWithStatus('Approved');
    const result = await scriptGenerator.generate(specId);

    expect(result.specId).toBe(specId);
    expect(result.targetApp).toBe('OrangeHRM');
    expect(result.platform).toBe('web');
    expect(result.approvedTestCases.length).toBeGreaterThan(0);
    expect(result.generatedFiles.length).toBeGreaterThan(0);
    expect(result.configFiles).toContain('playwright.config.ts');
    expect(result.configFiles).toContain('tsconfig.json');

    // Verify files were physically written to temporary workspace (.workspace)
    const workspaceFiles = await store.listWorkspaceFiles();
    expect(workspaceFiles).toContain('playwright.config.ts');
    expect(workspaceFiles).toContain('tsconfig.json');
    expect(workspaceFiles).toContain('web/pages/LoginPage.ts');
    expect(workspaceFiles).toContain('web/pages/DashboardPage.ts');
    expect(workspaceFiles).toContain('web/fixtures/auth-data.json');
    expect(workspaceFiles).toContain('web/utils/test-helpers.ts');
    expect(workspaceFiles).toContain(`web/tests/${specId}/TC-LOGIN-001.spec.ts`);
    expect(workspaceFiles).toContain(`web/tests/${specId}/${specId}.spec.ts`);

    // Verify Page Object Model implementation (§3.5)
    const loginPageContent = await store.readWorkspaceFile('web/pages/LoginPage.ts');
    expect(loginPageContent).toBeDefined();
    expect(loginPageContent).toContain('export class LoginPage');
    // Verify stable locators used
    expect(loginPageContent).toContain("page.getByPlaceholder('Username')");
    expect(loginPageContent).toContain("page.getByPlaceholder('Password')");
    expect(loginPageContent).toContain("page.getByRole('button'");

    const dashboardPageContent = await store.readWorkspaceFile('web/pages/DashboardPage.ts');
    expect(dashboardPageContent).toBeDefined();
    expect(dashboardPageContent).toContain('export class DashboardPage');
    expect(dashboardPageContent).toContain("page.getByRole('heading'");

    // Verify Test Data Separation (§3.5)
    const authDataContent = await store.readWorkspaceFile('web/fixtures/auth-data.json');
    expect(authDataContent).toBeDefined();
    const parsedAuth = JSON.parse(authDataContent!);
    expect(parsedAuth.validCredentials.username).toBe('Admin');
    expect(parsedAuth.validCredentials.password).toBe('admin123');
    expect(parsedAuth.invalidCredentials.expectedErrorMessage).toBe('Invalid credentials');

    // Verify Traceability Comments in test files (§3.5)
    const testContent = await store.readWorkspaceFile(`web/tests/${specId}/TC-LOGIN-001.spec.ts`);
    expect(testContent).toBeDefined();
    expect(testContent).toContain(`// Spec ID: ${specId}`);
    expect(testContent).toContain('// Test Case ID: TC-LOGIN-001');
    expect(testContent).toContain('// Source: Approved test case —');
    expect(testContent).toContain("import { LoginPage } from '../../pages/LoginPage'");
    expect(testContent).toContain("import authData from '../../fixtures/auth-data.json'");
  });

  it('generates Mobile Playwright scripts when target platform is mobile (§3.5, §4.3)', async () => {
    const specId = await createSpecWithStatus('Approved', { platform: 'mobile' });
    const result = await scriptGenerator.generate(specId);

    expect(result.platform).toBe('mobile');

    const workspaceFiles = await store.listWorkspaceFiles();
    expect(workspaceFiles).toContain('mobile/pages/MobileLoginPage.ts');
    expect(workspaceFiles).toContain('mobile/pages/MobileDashboardPage.ts');
    expect(workspaceFiles).toContain('mobile/fixtures/auth-data.json');
    expect(workspaceFiles).toContain('mobile/utils/test-helpers.ts');
    expect(workspaceFiles).toContain(`mobile/tests/${specId}/TC-LOGIN-001.spec.ts`);

    const mobileTest = await store.readWorkspaceFile(`mobile/tests/${specId}/TC-LOGIN-001.spec.ts`);
    expect(mobileTest).toContain(`// Spec ID: ${specId}`);
    expect(mobileTest).toContain('// Test Case ID: TC-LOGIN-001');
    expect(mobileTest).toContain('Mobile');
  });

  it('generates both Web and Mobile scripts when platform is "both" (§3.5, §4.3)', async () => {
    const specId = await createSpecWithStatus('Approved', { platform: 'both' });
    const result = await scriptGenerator.generate(specId);

    expect(result.platform).toBe('both');

    const workspaceFiles = await store.listWorkspaceFiles();
    expect(workspaceFiles).toContain('web/pages/LoginPage.ts');
    expect(workspaceFiles).toContain(`web/tests/${specId}/TC-LOGIN-001.spec.ts`);
    expect(workspaceFiles).toContain('mobile/pages/MobileLoginPage.ts');
    expect(workspaceFiles).toContain(`mobile/tests/${specId}/TC-LOGIN-001.spec.ts`);
  });

  it('filters generation to approved subset when testCaseIds provided (§3.5)', async () => {
    const specId = await createSpecWithStatus('Approved');
    const result = await scriptGenerator.generate(specId, {
      testCaseIds: ['TC-LOGIN-001'],
    });

    expect(result.approvedTestCases).toEqual(['TC-LOGIN-001']);
    const workspaceFiles = await store.listWorkspaceFiles();
    expect(workspaceFiles).toContain(`web/tests/${specId}/TC-LOGIN-001.spec.ts`);
    expect(workspaceFiles).not.toContain(`web/tests/${specId}/TC-LOGIN-002.spec.ts`);
  });

  it('supports cleanWorkspace flag to clear stale artifacts (§3.5, §3.7)', async () => {
    await store.writeWorkspaceFile('stale-file.txt', 'old content');
    let files = await store.listWorkspaceFiles();
    expect(files).toContain('stale-file.txt');

    const specId = await createSpecWithStatus('Approved');
    await scriptGenerator.generate(specId, { cleanWorkspace: true });

    files = await store.listWorkspaceFiles();
    expect(files).not.toContain('stale-file.txt');
    expect(files).toContain('playwright.config.ts');
  });

  it('generates generic POM and fixtures for non-OrangeHRM applications (§3.5, §4.2)', async () => {
    const intake = await intakeService.processIntake({
      title: 'React Todo Feature',
      story: 'As a user, I want to add and remove todo items in the React application.',
      acceptanceCriteria: ['Adding item shows it in the list', 'Removing item deletes it'],
      priority: 'medium',
      platform: 'web',
      targetApp: 'CustomReactApp',
      slug: 'TODO',
      generateSpec: true,
      generateTestCases: true,
    });

    const specId = intake.specId;
    await intakeService.getApprovalService().submitDecision(specId, {
      status: 'Approved',
      reviewer: 'Lead Reviewer',
      comments: 'Approved',
    });

    const result = await scriptGenerator.generate(specId);
    expect(result.targetApp).toBe('CustomReactApp');

    const workspaceFiles = await store.listWorkspaceFiles();
    expect(workspaceFiles).toContain('web/pages/ReactTodoFeaturePage.ts');
    expect(workspaceFiles).toContain(`web/fixtures/${specId.toLowerCase()}-data.json`);
    expect(workspaceFiles).toContain(`web/tests/${specId}/TC-TODO-001.spec.ts`);

    const pageContent = await store.readWorkspaceFile('web/pages/ReactTodoFeaturePage.ts');
    expect(pageContent).toContain('export class ReactTodoFeaturePage');
  });
});
