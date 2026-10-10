import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CohereProvider } from '../src/providers/cohere-provider.js';
import { GroqProvider } from '../src/providers/groq-provider.js';
import { OpenRouterProvider } from '../src/providers/openrouter-provider.js';
import { ProviderRegistry } from '../src/providers/registry.js';
import { LLMConfigurationError, LLMParseError, LLMRequestError } from '../src/providers/types.js';

describe('LLM Providers', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Configuration validation', () => {
    it('throws LLMConfigurationError when calling unconfigured Groq provider', async () => {
      const groq = new GroqProvider('');
      expect(groq.isConfigured()).toBe(false);
      await expect(groq.generate('Hello')).rejects.toThrow(LLMConfigurationError);
    });

    it('throws LLMConfigurationError when calling unconfigured Cohere provider', async () => {
      const cohere = new CohereProvider('');
      expect(cohere.isConfigured()).toBe(false);
      await expect(cohere.generate('Hello')).rejects.toThrow(LLMConfigurationError);
    });

    it('throws LLMConfigurationError when calling unconfigured OpenRouter provider', async () => {
      const openrouter = new OpenRouterProvider('');
      expect(openrouter.isConfigured()).toBe(false);
      await expect(openrouter.generate('Hello')).rejects.toThrow(LLMConfigurationError);
    });
  });

  describe('GroqProvider', () => {
    it('formats request and parses OpenAI-compatible response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Generated Groq text' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      });

      const provider = new GroqProvider('mock-key');
      const result = await provider.generate('Test prompt', {
        systemPrompt: 'You are QA assistant',
        temperature: 0.1,
      });

      expect(result.text).toBe('Generated Groq text');
      expect(result.provider).toBe('groq');
      expect(result.model).toBe('llama-3.3-70b-versatile');
      expect(result.usage?.totalTokens).toBe(30);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('throws LLMRequestError on HTTP error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const provider = new GroqProvider('bad-key');
      await expect(provider.generate('Hello')).rejects.toThrow(LLMRequestError);
    });
  });

  describe('CohereProvider', () => {
    it('formats request and parses Cohere v2 chat response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: [{ type: 'text', text: 'Generated Cohere text' }] },
          usage: { tokens: { input_tokens: 15, output_tokens: 25 } },
        }),
      });

      const provider = new CohereProvider('mock-key');
      const result = await provider.generate('Test prompt');

      expect(result.text).toBe('Generated Cohere text');
      expect(result.provider).toBe('cohere');
      expect(result.model).toBe('command-r-plus');
      expect(result.usage?.totalTokens).toBe(40);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.cohere.com/v2/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-key',
          }),
        }),
      );
    });
  });

  describe('OpenRouterProvider', () => {
    it('includes required OpenRouter headers and returns completion', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Generated OpenRouter text' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        }),
      });

      const provider = new OpenRouterProvider('mock-key');
      const result = await provider.generate('Test prompt');

      expect(result.text).toBe('Generated OpenRouter text');
      expect(result.provider).toBe('openrouter');
      expect(result.model).toBe('openai/gpt-4o-mini');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-key',
            'HTTP-Referer': 'http://localhost:4000',
            'X-Title': 'QA_Automation_Platform_Agent',
          }),
        }),
      );
    });
  });

  describe('generateJSON & schema validation', () => {
    it('parses fenced markdown JSON and validates against Zod schema', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n{\n  "title": "Login Test",\n  "count": 42\n}\n```',
              },
            },
          ],
        }),
      });

      const provider = new GroqProvider('mock-key');
      const schema = z.object({
        title: z.string(),
        count: z.number(),
      });

      const result = await provider.generateJSON('Generate data', schema);
      expect(result).toEqual({ title: 'Login Test', count: 42 });
    });

    it('throws LLMParseError when JSON response does not conform to schema', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"title": 12345}', // title should be string
              },
            },
          ],
        }),
      });

      const provider = new GroqProvider('mock-key');
      const schema = z.object({
        title: z.string(),
      });

      await expect(provider.generateJSON('Generate data', schema)).rejects.toThrow(LLMParseError);
    });
  });

  describe('ProviderRegistry', () => {
    it('resolves default provider when none requested', () => {
      const registry = new ProviderRegistry();
      const resolved = registry.resolveProvider();

      expect(resolved.provider.name).toBe('groq');
      expect(resolved.model).toBe('llama-3.3-70b-versatile');
    });

    it('resolves explicitly requested provider and model', () => {
      const registry = new ProviderRegistry();
      const resolved = registry.resolveProvider('openrouter', 'anthropic/claude-3.5-sonnet');

      expect(resolved.provider.name).toBe('openrouter');
      expect(resolved.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('throws error for unsupported provider name', () => {
      const registry = new ProviderRegistry();
      expect(() => registry.resolveProvider('unknown-llm')).toThrow();
    });

    it('returns providers info response for UI dropdown', () => {
      const registry = new ProviderRegistry();
      const response = registry.getProvidersResponse();

      expect(response.defaultProvider).toBe('groq');
      expect(response.providers.length).toBe(3);
      expect(response.providers.map((p) => p.name)).toEqual(['groq', 'cohere', 'openrouter']);
    });
  });
});
