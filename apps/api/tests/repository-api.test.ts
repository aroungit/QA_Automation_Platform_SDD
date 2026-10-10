import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FileStore } from '../src/storage/file-store.js';

describe('Repository Service & Quality Gates API Endpoints (§3.7, §8)', { timeout: 35000 }, () => {
  let tmpDir: string;
  let app: import('express').Express;
  let store: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-repo-api-'));
    const config = loadConfig({
      NODE_ENV: 'test',
      SPECS_DIR: path.join(tmpDir, 'specs'),
      AUTOMATION_DIR: path.join(tmpDir, 'automation'),
      REPORTS_DIR: path.join(tmpDir, 'reports'),
      TEMP_WORKSPACE_DIR: path.join(tmpDir, '.workspace'),
    });
    store = new FileStore(config.storage);
    await store.init();

    const created = createApp({ config, store });
    app = created.app;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function createApprovedAndValidatedSpec(): Promise<{ specId: string; reportId: string }> {
    // 1. Intake
    const intakeRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Authentication Feature',
        story: 'As a user I want to log in with valid credentials.',
        acceptanceCriteria: ['Valid login succeeds', 'Invalid login fails'],
        platform: 'web',
        targetApp: 'OrangeHRM',
        generateSpec: true,
        generateTestCases: true,
      });

    const specId = intakeRes.body.data.specId;

    // 2. Approve (§3.4)
    await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Approved',
      reviewer: 'QA Lead',
      comments: 'Verified and approved for automation (§3.4)',
    });

    // 3. Generate scripts (§3.5)
    await request(app).post(`/api/specs/${specId}/generate-scripts`).send({});

    // 4. Validate (§3.6)
    const valRes = await request(app).post(`/api/specs/${specId}/validate`).send({
      autoHeal: false,
      executionMode: 'simulated',
    });

    const reportId = valRes.body.data.reportId;
    return { specId, reportId };
  }

  it('GET /api/specs/:specId/quality-gate evaluates quality gates (§8)', async () => {
    const { specId, reportId } = await createApprovedAndValidatedSpec();

    const res = await request(app).get(`/api/specs/${specId}/quality-gate`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe(specId);
    expect(res.body.data.passed).toBe(true);
    expect(res.body.data.status).toBe('PASSED');
    expect(res.body.data.validationReportId).toBe(reportId);
    expect(res.body.data.gates).toHaveLength(8);

    const gateNames = res.body.data.gates.map((g: { gate: string }) => g.gate);
    expect(gateNames).toContain('APPROVED_SPECIFICATION');
    expect(gateNames).toContain('APPROVED_TEST_CASES');
    expect(gateNames).toContain('SCRIPTS_MAP_TO_APPROVED_TEST_CASES');
    expect(gateNames).toContain('SCRIPTS_COMPILE_SUCCESSFULLY');
    expect(gateNames).toContain('SCRIPTS_PASS_AUTOMATED_EXECUTION');
    expect(gateNames).toContain('EXECUTION_EVIDENCE_STORED');
    expect(gateNames).toContain('NO_UNAPPROVED_FUNCTIONALITY_AUTOMATED');
    expect(gateNames).toContain('SPEC_UP_TO_DATE_NO_REVALIDATION_REQUIRED');
  });

  it('GET /api/specs/:specId/quality-gate returns 404 for unknown spec', async () => {
    const res = await request(app).get('/api/specs/SPEC-UNKNOWN-999/quality-gate');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/specs/:specId/promote rejects unvalidated spec with 400 and failedGates details (§8)', async () => {
    // Create spec without approval or validation
    const intakeRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Draft Feature',
        story: 'Story in draft status',
        acceptanceCriteria: ['Criteria 1'],
        generateSpec: true,
        generateTestCases: true,
      });

    const specId = intakeRes.body.data.specId;

    const res = await request(app).post(`/api/specs/${specId}/promote`).send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('QUALITY_GATES_FAILED');
    expect(Array.isArray(res.body.error.details)).toBe(true);

    // Verify main repository has no files
    const autoFilesRes = await request(app).get('/api/automation/files');
    expect(autoFilesRes.body.data.files).toHaveLength(0);
  });

  it('POST /api/specs/:specId/promote promotes validated artifacts to /automation (§3.7, §8)', async () => {
    const { specId, reportId } = await createApprovedAndValidatedSpec();

    const promoteRes = await request(app).post(`/api/specs/${specId}/promote`).send({
      autoCommit: false,
    });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.success).toBe(true);
    expect(promoteRes.body.data.specId).toBe(specId);
    expect(promoteRes.body.data.validationReportId).toBe(reportId);
    expect(promoteRes.body.data.promotedFiles.length).toBeGreaterThan(0);
    expect(promoteRes.body.data.commit.message).toContain(`[${specId}]`);

    // Verify GET /api/specs/:specId/promotion
    const promoRes = await request(app).get(`/api/specs/${specId}/promotion`);
    expect(promoRes.status).toBe(200);
    expect(promoRes.body.data.status).toBe('promoted');
    expect(promoRes.body.data.revalidationRequired).toBe(false);

    // Verify GET /api/automation/files
    const autoFilesRes = await request(app).get('/api/automation/files');
    expect(autoFilesRes.status).toBe(200);
    expect(autoFilesRes.body.data.count).toBeGreaterThan(0);

    const testFile = autoFilesRes.body.data.files.find((f: string) => f.includes('.spec.ts'));
    expect(testFile).toBeDefined();

    // Verify GET /api/automation/file?path=...
    const fileContentRes = await request(app).get(
      `/api/automation/file?path=${encodeURIComponent(testFile)}`,
    );
    expect(fileContentRes.status).toBe(200);
    expect(fileContentRes.body.data.content).toContain(`// Validation Report: ${reportId}`);
    expect(fileContentRes.body.data.content).toContain(`// Spec ID: ${specId}`);
  });

  it('POST /api/specs/:specId/revalidate executes revalidation on modified spec (§8)', async () => {
    const { specId } = await createApprovedAndValidatedSpec();

    // Promote
    await request(app).post(`/api/specs/${specId}/promote`).send({ autoCommit: false });

    // Update specification
    await request(app)
      .put(`/api/specs/${specId}/specification`)
      .send({
        title: 'Updated Specification Title',
        businessObjective: 'Updated objective',
        actors: ['Admin'],
        preconditions: ['Precondition 1'],
        mainFlow: [{ step: 1, action: 'Step 1', expected: 'Expected 1' }],
        alternateFlows: [],
        exceptionFlows: [],
        dataRequirements: [],
        acceptanceCriteria: ['Updated criteria'],
        nonFunctionalRequirements: [],
        targetApp: 'OrangeHRM',
        environment: 'default',
      });

    // Re-approving updated spec
    await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Approved',
      reviewer: 'QA Lead',
      comments: 'Re-approved for revalidation',
    });

    // Revalidate
    const revalRes = await request(app).post(`/api/specs/${specId}/revalidate`).send({
      executionMode: 'simulated',
    });

    expect(revalRes.status).toBe(200);
    expect(revalRes.body.success).toBe(true);
    expect(revalRes.body.data.overallStatus).toBe('PASSED');

    // Promotion status should be updated
    const promoRes = await request(app).get(`/api/specs/${specId}/promotion`);
    expect(promoRes.body.data.status).toBe('promoted');
    expect(promoRes.body.data.revalidationRequired).toBe(false);
  });

  it('GET /api/promotions lists all promoted specifications (§3.7)', async () => {
    const { specId } = await createApprovedAndValidatedSpec();
    await request(app).post(`/api/specs/${specId}/promote`).send({ autoCommit: false });

    const res = await request(app).get('/api/promotions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].specId).toBe(specId);
  });
});
