import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStore } from '../src/storage/file-store.js';

describe('FileStore', () => {
  let tempDir: string;
  let store: FileStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-test-'));
    store = new FileStore({
      rootDir: tempDir,
      specsDir: path.join(tempDir, 'specs'),
      automationDir: path.join(tempDir, 'automation'),
      reportsDir: path.join(tempDir, 'reports'),
      tempWorkspaceDir: path.join(tempDir, '.workspace'),
    });
    await store.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('initializes required directory structure', async () => {
    const specsExists = await fs
      .stat(store.specsDir)
      .then((s) => s.isDirectory())
      .catch(() => false);
    const workspaceExists = await fs
      .stat(store.tempWorkspaceDir)
      .then((s) => s.isDirectory())
      .catch(() => false);
    const webTestsExists = await fs
      .stat(path.join(store.automationDir, 'web', 'tests'))
      .then((s) => s.isDirectory())
      .catch(() => false);
    const mobilePagesExists = await fs
      .stat(path.join(store.automationDir, 'mobile', 'pages'))
      .then((s) => s.isDirectory())
      .catch(() => false);

    expect(specsExists).toBe(true);
    expect(workspaceExists).toBe(true);
    expect(webTestsExists).toBe(true);
    expect(mobilePagesExists).toBe(true);
  });

  it('saves and reads specification artifacts (§3.7)', async () => {
    const specId = 'SPEC-LOGIN-001';

    await store.saveSpecArtifacts(specId, {
      userStory: '# Story\nAs a user...',
      specification: '# Spec\nFeature: Login',
      testCases: '# Test cases\nTC-LOGIN-001',
      testCasesJson: [{ id: 'TC-LOGIN-001', title: 'Valid login' }],
      approvalRecord: {
        specId,
        status: 'Approved',
        reviewer: 'QA Lead',
        comments: 'Looks good',
        approvedTestCases: ['TC-LOGIN-001'],
        timestamp: '2026-10-10T12:00:00Z',
      },
    });

    expect(await store.specExists(specId)).toBe(true);

    const artifacts = await store.readSpecArtifacts(specId);
    expect(artifacts).not.toBeNull();
    expect(artifacts?.userStory).toContain('As a user');
    expect(artifacts?.specification).toContain('Feature: Login');
    expect(artifacts?.testCases).toContain('TC-LOGIN-001');
    expect(artifacts?.approvalRecord?.status).toBe('Approved');
    expect(artifacts?.approvalRecord?.reviewer).toBe('QA Lead');
  });

  it('lists existing specifications with correct status and flags', async () => {
    await store.saveSpecArtifacts('SPEC-AUTH-001', {
      userStory: 'Story 1',
      approvalRecord: {
        specId: 'SPEC-AUTH-001',
        status: 'Under Review',
        reviewer: 'Admin',
        comments: 'Pending check',
        approvedTestCases: [],
        timestamp: '2026-10-10T12:00:00Z',
      },
    });

    await store.saveSpecArtifacts('SPEC-DASH-002', {
      userStory: 'Story 2',
    });

    const list = await store.listSpecs();
    expect(list.length).toBe(2);

    const authSpec = list.find((s) => s.specId === 'SPEC-AUTH-001');
    expect(authSpec).toBeDefined();
    expect(authSpec?.status).toBe('Under Review');
    expect(authSpec?.hasUserStory).toBe(true);
    expect(authSpec?.hasSpecification).toBe(false);

    const dashSpec = list.find((s) => s.specId === 'SPEC-DASH-002');
    expect(dashSpec).toBeDefined();
    expect(dashSpec?.status).toBe('Draft');
  });

  it('calculates the next sequence number for spec IDs', async () => {
    await store.saveSpecArtifacts('SPEC-LOGIN-001', { userStory: 'Story' });
    await store.saveSpecArtifacts('SPEC-LOGIN-002', { userStory: 'Story' });
    await store.saveSpecArtifacts('SPEC-PROFILE-001', { userStory: 'Story' });

    const nextLoginSeq = await store.getNextSpecSequence('LOGIN');
    expect(nextLoginSeq).toBe(3);

    const nextProfileSeq = await store.getNextSpecSequence('PROFILE');
    expect(nextProfileSeq).toBe(2);

    const nextNewSeq = await store.getNextSpecSequence('CHECKOUT');
    expect(nextNewSeq).toBe(1);
  });

  it('manages workspace files and cleans workspace directory', async () => {
    await store.writeWorkspaceFile('generated/login.spec.ts', '// test script');
    await store.writeWorkspaceFile('pages/login.page.ts', '// page object');

    const files = await store.listWorkspaceFiles();
    expect(files).toContain('generated/login.spec.ts');
    expect(files).toContain('pages/login.page.ts');

    const content = await store.readWorkspaceFile('generated/login.spec.ts');
    expect(content).toBe('// test script');

    await store.cleanWorkspace();
    const remaining = await store.listWorkspaceFiles();
    expect(remaining).toEqual([]);
  });

  it('saves and reads promoted automation files', async () => {
    await store.saveAutomationFile('web', 'pages', 'LoginPage.ts', 'export class LoginPage {}');

    const read = await store.readAutomationFile('web', 'pages', 'LoginPage.ts');
    expect(read).toBe('export class LoginPage {}');

    const list = await store.listAutomationFiles('web', 'pages');
    expect(list).toContain('LoginPage.ts');
  });

  it('saves and lists execution reports', async () => {
    const reportData = { runId: 'run-1', passed: true, total: 3 };
    await store.saveExecutionReport('run-1', reportData);

    const reportContent = await store.readExecutionReport('run-1');
    expect(reportContent).not.toBeNull();
    expect(JSON.parse(reportContent!)).toEqual(reportData);

    const list = await store.listExecutionReports();
    expect(list).toContain('run-1');
  });
});
