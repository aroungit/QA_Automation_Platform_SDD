import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('Playwright Script Generation API Endpoints (§3.5)', () => {
  let tempDir: string;
  let app: ReturnType<typeof createApp>['app'];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-script-api-test-'));
    const config = loadConfig({}, tempDir);
    const created = createApp({ config });
    app = created.app;
    await created.store.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createSpecAndApprove(
    slug = 'LOGIN',
    options?: { platform?: 'web' | 'mobile' | 'both' },
  ) {
    const intakeRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Authentication Suite',
        story: 'As a user, I want to authenticate into the application.',
        acceptanceCriteria: [
          'Valid credentials grant access',
          'Invalid credentials display error message',
        ],
        priority: 'high',
        platform: options?.platform ?? 'web',
        targetApp: 'OrangeHRM',
        slug,
        generateSpec: true,
        generateTestCases: true,
      });

    const specId = intakeRes.body.data.specId;

    // Approve the specification
    await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Approved',
      reviewer: 'Senior QA Reviewer',
      comments: 'Fully verified against acceptance criteria',
    });

    return specId;
  }

  it('POST /api/specs/:specId/generate-scripts returns 404 for non-existent spec', async () => {
    const res = await request(app).post('/api/specs/SPEC-NONE-999/generate-scripts');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('not found');
  });

  it('POST /api/specs/:specId/generate-scripts returns 400 when spec is not Approved (§3.4, §3.5)', async () => {
    // Create spec but do NOT approve it (remains in Draft)
    const intakeRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Draft Feature',
        story: 'As a user, I want to test draft gate.',
        acceptanceCriteria: ['Must be in draft'],
        slug: 'DRAFT',
        generateSpec: true,
        generateTestCases: true,
      });

    const specId = intakeRes.body.data.specId;

    const res = await request(app).post(`/api/specs/${specId}/generate-scripts`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PRECONDITION_FAILED');
    expect(res.body.error.message).toContain('Only test cases with status "Approved" can proceed');
  });

  it('POST /api/specs/:specId/generate-scripts generates Playwright scripts for Approved spec (§3.5)', async () => {
    const specId = await createSpecAndApprove('AUTH');

    const res = await request(app).post(`/api/specs/${specId}/generate-scripts`).send({
      cleanWorkspace: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe(specId);
    expect(res.body.data.targetApp).toBe('OrangeHRM');
    expect(res.body.data.platform).toBe('web');
    expect(res.body.data.approvedTestCases.length).toBeGreaterThan(0);
    expect(res.body.data.generatedFiles.length).toBeGreaterThan(0);
    expect(res.body.data.configFiles).toContain('playwright.config.ts');
    expect(res.body.data.configFiles).toContain('tsconfig.json');

    // Verify individual files
    const filePaths = res.body.data.generatedFiles.map((f: { path: string }) => f.path);
    expect(filePaths).toContain('playwright.config.ts');
    expect(filePaths).toContain('tsconfig.json');
    expect(filePaths).toContain('web/pages/LoginPage.ts');
    expect(filePaths).toContain('web/pages/DashboardPage.ts');
    expect(filePaths).toContain('web/fixtures/auth-data.json');
    expect(filePaths).toContain('web/utils/test-helpers.ts');
    expect(filePaths).toContain(`web/tests/${specId}/TC-AUTH-001.spec.ts`);
  });

  it('POST /api/specs/:specId/generate-scripts supports selective test case generation', async () => {
    const specId = await createSpecAndApprove('SELECT');

    const res = await request(app)
      .post(`/api/specs/${specId}/generate-scripts`)
      .send({
        testCaseIds: ['TC-SELECT-001'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.approvedTestCases).toEqual(['TC-SELECT-001']);
  });

  it('POST /api/specs/:specId/generate-scripts fails with 400 when invalid testCaseId is requested', async () => {
    const specId = await createSpecAndApprove('INVALIDTC');

    const res = await request(app)
      .post(`/api/specs/${specId}/generate-scripts`)
      .send({
        testCaseIds: ['TC-INVALIDTC-999'],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TEST_CASE_NOT_APPROVED');
  });

  it('GET /api/specs/:specId/scripts returns generated scripts and content (§3.5)', async () => {
    const specId = await createSpecAndApprove('GETSCR');

    await request(app).post(`/api/specs/${specId}/generate-scripts`).send({});

    const res = await request(app).get(`/api/specs/${specId}/scripts`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe(specId);
    expect(res.body.data.files.length).toBeGreaterThan(0);

    const testFile = res.body.data.files.find((f: { path: string }) =>
      f.path.includes(`web/tests/${specId}/TC-GETSCR-001.spec.ts`),
    );
    expect(testFile).toBeDefined();
    expect(testFile.content).toContain(`// Spec ID: ${specId}`);
    expect(testFile.content).toContain('// Test Case ID: TC-GETSCR-001');
  });

  it('GET /api/workspace/files lists all files in temporary workspace (§3.7)', async () => {
    const specId = await createSpecAndApprove('WSLST');

    await request(app).post(`/api/specs/${specId}/generate-scripts`).send({ cleanWorkspace: true });

    const res = await request(app).get('/api/workspace/files');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.files.length).toBeGreaterThan(0);
    expect(res.body.data.files).toContain('playwright.config.ts');
  });

  it('DELETE /api/workspace cleans the temporary workspace', async () => {
    const specId = await createSpecAndApprove('WSCLEAN');

    await request(app).post(`/api/specs/${specId}/generate-scripts`).send({});

    const deleteRes = await request(app).delete('/api/workspace');
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const listRes = await request(app).get('/api/workspace/files');
    expect(listRes.body.data.files.length).toBe(0);
  });
});
