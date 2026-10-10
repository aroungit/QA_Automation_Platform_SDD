import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('API Server & Endpoints', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-api-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('GET /health returns 200 with system info', async () => {
    const config = loadConfig({}, tempDir);
    const { app } = createApp({ config });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('QA_Automation_Platform_Agent');
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.version).toBe('0.1.0');
    expect(typeof res.body.data.uptime).toBe('number');
  });

  it('GET /api/health also returns 200', async () => {
    const config = loadConfig({}, tempDir);
    const { app } = createApp({ config });

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /api/providers returns list of providers and default provider', async () => {
    const config = loadConfig(
      {
        DEFAULT_LLM_PROVIDER: 'groq',
        GROQ_API_KEY: 'gsk-key',
      },
      tempDir,
    );
    const { app } = createApp({ config });

    const res = await request(app).get('/api/providers');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.defaultProvider).toBe('groq');
    expect(res.body.data.providers.length).toBe(3);

    const groq = res.body.data.providers.find((p: { name: string }) => p.name === 'groq');
    expect(groq).toBeDefined();
    expect(groq.configured).toBe(true);
    expect(groq.defaultModel).toBe('llama-3.3-70b-versatile');

    const cohere = res.body.data.providers.find((p: { name: string }) => p.name === 'cohere');
    expect(cohere).toBeDefined();
    expect(cohere.configured).toBe(false);
  });

  it('GET /api/providers/:name returns details for a valid provider', async () => {
    const config = loadConfig({}, tempDir);
    const { app } = createApp({ config });

    const res = await request(app).get('/api/providers/openrouter');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('openrouter');
    expect(res.body.data.defaultModel).toBe('openai/gpt-4o-mini');
  });

  it('GET /api/providers/:name returns 500/error for unknown provider', async () => {
    const config = loadConfig({}, tempDir);
    const { app } = createApp({ config });

    const res = await request(app).get('/api/providers/nonexistent');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Unknown LLM provider');
  });

  it('POST /api/providers/validate returns error when provider has no API key', async () => {
    const config = loadConfig({ GROQ_API_KEY: '' }, tempDir);
    const { app } = createApp({ config });

    const res = await request(app).post('/api/providers/validate').send({ provider: 'groq' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
    expect(res.body.error.message).toContain('GROQ_API_KEY');
  });

  it('POST /api/providers/validate succeeds when provider is configured', async () => {
    const config = loadConfig({ GROQ_API_KEY: 'gsk-valid-key' }, tempDir);
    const { app } = createApp({ config });

    const res = await request(app).post('/api/providers/validate').send({ provider: 'groq' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.provider).toBe('groq');
  });

  it('handles per-request provider selection via headers', async () => {
    const config = loadConfig(
      {
        DEFAULT_LLM_PROVIDER: 'groq',
        GROQ_API_KEY: '',
        OPENROUTER_API_KEY: 'sk-or-valid',
      },
      tempDir,
    );
    const { app } = createApp({ config });

    // Requesting unconfigured default provider fails
    const failRes = await request(app).post('/api/providers/validate');
    expect(failRes.status).toBe(400);

    // Supplying x-llm-provider selects configured OpenRouter
    const successRes = await request(app)
      .post('/api/providers/validate')
      .set('x-llm-provider', 'openrouter');
    expect(successRes.status).toBe(200);
    expect(successRes.body.data.provider).toBe('openrouter');
  });

  it('returns 404 for unknown endpoints', async () => {
    const config = loadConfig({}, tempDir);
    const { app } = createApp({ config });

    const res = await request(app).get('/api/unknown/endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
