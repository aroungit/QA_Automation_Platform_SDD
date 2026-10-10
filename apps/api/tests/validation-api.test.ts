import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { FileStore } from '../src/storage/file-store.js';

describe('Validation & Auto-Heal API Endpoints (§3.6, §3.7)', { timeout: 35000 }, () => {
  let tmpDir: string;
  let app: import('express').Express;
  let store: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-val-api-'));
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

  async function createApprovedSpecWithScripts(): Promise<string> {
    // 1. Intake
    const intakeRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'User Login Scenario',
        story: 'As a user I want to log in',
        acceptanceCriteria: ['Valid login succeeds', 'Invalid login fails'],
        platform: 'web',
        targetApp: 'OrangeHRM',
        generateSpec: true,
        generateTestCases: true,
      });

    const specId = intakeRes.body.data.specId;

    // 2. Approve
    await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Approved',
      reviewer: 'QA Lead',
      comments: 'Approved for Playwright automation (§3.4)',
    });

    // 3. Generate scripts
    await request(app).post(`/api/specs/${specId}/generate-scripts`).send();

    return specId;
  }

  it('POST /api/specs/:specId/validate returns 400 if spec is not Approved (§3.4, §3.6)', async () => {
    const intakeRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Draft Spec',
        story: 'Draft story',
        acceptanceCriteria: ['Criteria 1'],
        platform: 'web',
        targetApp: 'OrangeHRM',
        generateSpec: true,
        generateTestCases: true,
      });

    const specId = intakeRes.body.data.specId;

    const valRes = await request(app)
      .post(`/api/specs/${specId}/validate`)
      .send({ executionMode: 'simulated' });

    expect(valRes.status).toBe(400);
    expect(valRes.body.success).toBe(false);
    expect(valRes.body.error.message).toContain('Approved');
  });

  it('POST /api/specs/:specId/validate executes pipeline and returns 200 with ValidationReport (§3.6, §3.7)', async () => {
    const specId = await createApprovedSpecWithScripts();

    const res = await request(app).post(`/api/specs/${specId}/validate`).send({
      executionMode: 'simulated',
      autoHeal: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe(specId);
    expect(res.body.data.reportId).toMatch(/^VAL-/);
    expect(res.body.data.overallStatus).toBe('PASSED');
    expect(res.body.data.eligibleForPromotion).toBe(true);
    expect(res.body.data.staticValidation.passed).toBe(true);
    expect(res.body.data.dynamicValidation.passed).toBe(true);
    expect(res.body.data.conformanceCheck.passed).toBe(true);
  });

  it('GET /api/specs/:specId/validation-reports lists reports for spec (§3.6, §3.7)', async () => {
    const specId = await createApprovedSpecWithScripts();

    await request(app).post(`/api/specs/${specId}/validate`).send({ executionMode: 'simulated' });

    const res = await request(app).get(`/api/specs/${specId}/validation-reports`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].specId).toBe(specId);
  });

  it('GET /api/specs/:specId/validation-reports/latest returns latest report (§3.6)', async () => {
    const specId = await createApprovedSpecWithScripts();

    const valRes = await request(app)
      .post(`/api/specs/${specId}/validate`)
      .send({ executionMode: 'simulated' });

    const res = await request(app).get(`/api/specs/${specId}/validation-reports/latest`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reportId).toBe(valRes.body.data.reportId);
  });

  it('POST /api/specs/:specId/heal invokes healer directly (§3.6)', async () => {
    const specId = await createApprovedSpecWithScripts();

    const res = await request(app).post(`/api/specs/${specId}/heal`).send({ maxAttempts: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe(specId);
    expect(res.body.data.healed).toBe(true);
    expect(res.body.data.healingSummary).toBeDefined();
  });

  it('GET /api/reports/execution-results and /:reportId retrieve stored reports (§3.7)', async () => {
    const specId = await createApprovedSpecWithScripts();

    const valRes = await request(app)
      .post(`/api/specs/${specId}/validate`)
      .send({ executionMode: 'simulated' });

    const reportId = valRes.body.data.reportId;

    // List all
    const listRes = await request(app).get('/api/reports/execution-results');
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.some((r: { reportId: string }) => r.reportId === reportId)).toBe(true);

    // Get by ID
    const singleRes = await request(app).get(`/api/reports/execution-results/${reportId}`);
    expect(singleRes.status).toBe(200);
    expect(singleRes.body.success).toBe(true);
    expect(singleRes.body.data.reportId).toBe(reportId);

    // Get 404 for unknown report ID
    const notFoundRes = await request(app).get('/api/reports/execution-results/VAL-UNKNOWN-999');
    expect(notFoundRes.status).toBe(404);
  });
});
