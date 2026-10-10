import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('Specs API Endpoints (§3.1–3.3)', () => {
  let tempDir: string;
  let app: ReturnType<typeof createApp>['app'];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-specs-api-test-'));
    const config = loadConfig({}, tempDir);
    const created = createApp({ config });
    app = created.app;
    await created.store.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('POST /api/specs/intake registers a user story and returns 201 with specId', async () => {
    const res = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'OrangeHRM Login',
        story: 'As an HR user, I want to log in to OrangeHRM, so that I can access the dashboard.',
        acceptanceCriteria: [
          'Valid username and password should navigate to dashboard',
          'Invalid credentials should display error message',
        ],
        priority: 'high',
        platform: 'web',
        targetApp: 'OrangeHRM',
        slug: 'LOGIN',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe('SPEC-LOGIN-001');
    expect(res.body.data.userStory).toContain('OrangeHRM Login');
    expect(res.body.data.userStoryJson.id).toBe('SPEC-LOGIN-001');
    expect(res.body.data.approvalRecord.status).toBe('Draft');
  });

  it('POST /api/specs (alias) works identically to /api/specs/intake', async () => {
    const res = await request(app)
      .post('/api/specs')
      .send({
        title: 'Logout Feature',
        story: 'As a user, I want to log out',
        acceptanceCriteria: ['User is logged out and session cleared'],
        slug: 'LOGOUT',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe('SPEC-LOGOUT-001');
  });

  it('POST /api/specs/intake returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/specs/intake').send({
      title: '', // empty title
      story: 'Story without AC',
      acceptanceCriteria: [], // empty acceptance criteria
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/specs/intake with generateSpec and generateTestCases generates all artifacts', async () => {
    const res = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Employee Creation',
        story: 'As an HR admin, I want to create employee records',
        acceptanceCriteria: ['Employee is saved', 'Mandatory fields validated'],
        slug: 'PIM',
        generateSpec: true,
        generateTestCases: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe('SPEC-PIM-001');
    expect(res.body.data.specification).toBeDefined();
    expect(res.body.data.specificationJson.specId).toBe('SPEC-PIM-001');
    expect(res.body.data.testCases).toBeDefined();
    expect(res.body.data.testCasesJson.length).toBeGreaterThan(0);
  });

  it('GET /api/specs lists all specifications', async () => {
    await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Spec One',
        story: 'Story 1',
        acceptanceCriteria: ['AC 1'],
        slug: 'ONE',
      });

    await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Spec Two',
        story: 'Story 2',
        acceptanceCriteria: ['AC 2'],
        slug: 'TWO',
      });

    const res = await request(app).get('/api/specs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('GET /api/specs/:specId returns details or 404', async () => {
    const createRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Target Spec',
        story: 'Target story description',
        acceptanceCriteria: ['AC target'],
        slug: 'TARGET',
      });

    const specId = createRes.body.data.specId;

    const res = await request(app).get(`/api/specs/${specId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specId).toBe(specId);

    const notFoundRes = await request(app).get('/api/specs/SPEC-NONEXISTENT-999');
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.success).toBe(false);
  });

  it('POST /api/specs/:specId/generate-spec generates specification', async () => {
    const createRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Dashboard Metrics',
        story: 'As a manager, I want to see metrics',
        acceptanceCriteria: ['Metrics rendered in under 2s'],
        slug: 'METRICS',
      });

    const specId = createRes.body.data.specId;
    const res = await request(app).post(`/api/specs/${specId}/generate-spec`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specification).toContain('Dashboard Metrics');
    expect(res.body.data.specificationJson.specId).toBe(specId);
  });

  it('POST /api/specs/:specId/generate-test-cases generates test cases', async () => {
    const createRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Notifications',
        story: 'As a user, I want notifications',
        acceptanceCriteria: ['Alert banner shown for new message'],
        slug: 'NOTIF',
        generateSpec: true,
      });

    const specId = createRes.body.data.specId;
    const res = await request(app).post(`/api/specs/${specId}/generate-test-cases`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.testCasesJson.length).toBeGreaterThan(0);
    expect(res.body.data.testCasesJson[0].specId).toBe(specId);
  });

  it('POST /api/specs/:specId/generate-all generates both spec and test cases sequentially', async () => {
    const createRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Settings Page',
        story: 'As a user, I want to change settings',
        acceptanceCriteria: ['Theme preference saved'],
        slug: 'SETTINGS',
      });

    const specId = createRes.body.data.specId;
    const res = await request(app).post(`/api/specs/${specId}/generate-all`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specificationJson).toBeDefined();
    expect(res.body.data.testCasesJson.length).toBeGreaterThan(0);
  });

  it('PUT and DELETE /api/specs/:specId modify and remove specs', async () => {
    const createRes = await request(app)
      .post('/api/specs/intake')
      .send({
        title: 'Temporary Spec',
        story: 'Will be modified and deleted',
        acceptanceCriteria: ['Condition A'],
        slug: 'TEMP',
      });

    const specId = createRes.body.data.specId;

    // Update story
    const updateRes = await request(app)
      .put(`/api/specs/${specId}/user-story`)
      .send({ title: 'Updated Temp Spec' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.userStoryJson.title).toBe('Updated Temp Spec');

    // Delete
    const deleteRes = await request(app).delete(`/api/specs/${specId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.deleted).toBe(true);

    // Verify deleted
    const getRes = await request(app).get(`/api/specs/${specId}`);
    expect(getRes.status).toBe(404);
  });
});
