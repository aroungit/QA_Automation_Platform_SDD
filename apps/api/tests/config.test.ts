import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('Config Loader', () => {
  it('loads default configuration when no env overrides are provided', () => {
    const config = loadConfig({});

    expect(config.server.port).toBe(4000);
    expect(config.server.host).toBe('0.0.0.0');
    expect(config.llm.defaultProvider).toBe('groq');
    expect(config.llm.groq.defaultModel).toBe('llama-3.3-70b-versatile');
    expect(config.llm.cohere.defaultModel).toBe('command-r-plus');
    expect(config.llm.openrouter.defaultModel).toBe('openai/gpt-4o-mini');
    expect(config.heal.maxAttempts).toBe(3);
  });

  it('respects custom environment variables', () => {
    const config = loadConfig({
      API_PORT: '5500',
      API_HOST: '127.0.0.1',
      DEFAULT_LLM_PROVIDER: 'openrouter',
      GROQ_API_KEY: 'gsk-test-123',
      COHERE_API_KEY: 'coh-test-456',
      OPENROUTER_API_KEY: 'sk-or-test-789',
      LLM_TIMEOUT_MS: '30000',
      LLM_TEMPERATURE: '0.7',
      HEAL_MAX_ATTEMPTS: '5',
    });

    expect(config.server.port).toBe(5500);
    expect(config.server.host).toBe('127.0.0.1');
    expect(config.llm.defaultProvider).toBe('openrouter');
    expect(config.llm.groq.apiKey).toBe('gsk-test-123');
    expect(config.llm.cohere.apiKey).toBe('coh-test-456');
    expect(config.llm.openrouter.apiKey).toBe('sk-or-test-789');
    expect(config.llm.timeoutMs).toBe(30000);
    expect(config.llm.temperature).toBe(0.7);
    expect(config.heal.maxAttempts).toBe(5);
  });

  it('rejects invalid numeric port', () => {
    expect(() => {
      loadConfig({ API_PORT: 'not-a-number' });
    }).toThrow();
  });

  it('rejects unsupported LLM provider as default', () => {
    expect(() => {
      loadConfig({ DEFAULT_LLM_PROVIDER: 'unsupported-provider' });
    }).toThrow();
  });
});
