import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('Approval Gate API Endpoints (§3.4)', () => {
  let tempDir: string;
  let app: ReturnType<typeof createApp>['app'];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-approval-api-test-'));
    const config = loadConfig({}, tempDir);
    const created = createApp({ config });
    app = created.app;
    await created.store.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createReadySpec(slug = 'LOGIN') {
    const res = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Authentication Feature',
        story: 'As a user, I want to authenticate.',
        acceptanceCriteria: ['Valid login proceeds to dashboard', 'Invalid login triggers error'],
        priority: 'high',
        platform: 'web',
        targetApp: 'OrangeHRM',
        slug,
        generateSpec: true,
        generateTestCases: true,
      });

    return res.body.data;
  }

  it('GET /api/specs/:specId/approval returns current approval record & history', async () => {
    const spec = await createReadySpec('GETAPP');
    const res = await request(app).get(`/api/specs/${spec.specId}/approval`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe(spec.specId);
    expect(res.body.data.status).toBe('Draft');
    expect(res.body.data.history.length).toBeGreaterThan(0);
  });

  it('GET /api/specs/:specId/approval returns 404 for non-existent spec', async () => {
    const res = await request(app).get('/api/specs/SPEC-UNKNOWN-999/approval');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/specs/:specId/approval transitions status and updates record', async () => {
    const spec = await createReadySpec('TRANS');
    const specId = spec.specId;

    // Transition to Under Review
    const reviewRes = await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Under Review',
      reviewer: 'QA Lead Jane',
      comments: 'Submitting for final review',
    });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.success).toBe(true);
    expect(reviewRes.body.data.status).toBe('Under Review');
    expect(reviewRes.body.data.reviewer).toBe('QA Lead Jane');

    // Transition to Approved
    const approveRes = await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Approved',
      reviewer: 'Director Dave',
      comments: 'All acceptance criteria covered by test cases',
    });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('Approved');
    expect(approveRes.body.data.approvedTestCases.length).toBeGreaterThan(0);

    // Verify list specs reflects Approved status
    const listRes = await request(app).get('/api/specs');
    const found = listRes.body.data.find((s: { specId: string }) => s.specId === specId);
    expect(found.status).toBe('Approved');
  });

  it('PUT /api/specs/:specId/approval works as alias for POST', async () => {
    const spec = await createReadySpec('PUTALIAS');
    const res = await request(app).put(`/api/specs/${spec.specId}/approval`).send({
      status: 'Under Review',
      reviewer: 'Reviewer Mark',
      comments: 'Under review via PUT',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Under Review');
  });

  it('POST /api/specs/:specId/approval returns 400 for invalid transitions or missing comments', async () => {
    const spec = await createReadySpec('VALIDATE');
    const specId = spec.specId;

    // Rejected without comments
    const rejNoComments = await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Rejected',
      reviewer: 'QA Lead',
      comments: '',
    });
    expect(rejNoComments.status).toBe(400);
    expect(rejNoComments.body.error.message).toContain('Reviewer comments are required');

    // Reject with comments
    await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Rejected',
      reviewer: 'QA Lead',
      comments: 'Incomplete flows',
    });

    // Try direct Rejected -> Approved (illegal)
    const directApprove = await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Approved',
      reviewer: 'QA Lead',
    });
    expect(directApprove.status).toBe(400);
    expect(directApprove.body.error.message).toContain('Invalid status transition');
  });

  it('GET /api/specs/:specId/approval/can-proceed checks gating for script generator (§3.4, §3.5)', async () => {
    const spec = await createReadySpec('CANPROCEED');
    const specId = spec.specId;

    // Draft -> cannot proceed
    let res = await request(app).get(`/api/specs/${specId}/approval/can-proceed`);
    expect(res.status).toBe(200);
    expect(res.body.data.canProceed).toBe(false);
    expect(res.body.data.status).toBe('Draft');

    // Approve spec
    await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Approved',
      reviewer: 'Approver',
      comments: 'Ready for automation',
    });

    // Approved -> can proceed
    res = await request(app).get(`/api/specs/${specId}/approval/can-proceed`);
    expect(res.status).toBe(200);
    expect(res.body.data.canProceed).toBe(true);
    expect(res.body.data.status).toBe('Approved');
    expect(res.body.data.approvedTestCases.length).toBeGreaterThan(0);
  });

  it('POST /api/specs/:specId/approval/loopback executes generation loop with feedback (§3.4)', async () => {
    const spec = await createReadySpec('LOOPBACK');
    const specId = spec.specId;

    // Reject first
    await request(app).post(`/api/specs/${specId}/approval`).send({
      status: 'Rejected',
      reviewer: 'Security Reviewer',
      comments: 'Must include CAPTCHA verification step',
    });

    // Loopback endpoint
    const loopRes = await request(app).post(`/api/specs/${specId}/approval/loopback`).send({
      stage: 'all',
      feedback: 'Add CAPTCHA verification and rate limiting steps',
      targetStatus: 'Draft',
    });

    expect(loopRes.status).toBe(200);
    expect(loopRes.body.success).toBe(true);
    expect(loopRes.body.data.approvalRecord.status).toBe('Draft');
    expect(loopRes.body.data.specification).toContain('Reviewer feedback addressed');

    // Verify /api/specs/:specId/loopback alias works as well
    const aliasRes = await request(app).post(`/api/specs/${specId}/loopback`).send({
      stage: 'test-cases',
      targetStatus: 'Under Review',
    });

    expect(aliasRes.status).toBe(200);
    expect(aliasRes.body.data.approvalRecord.status).toBe('Under Review');
  });
});
