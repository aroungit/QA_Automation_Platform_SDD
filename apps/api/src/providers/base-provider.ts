import type { z } from 'zod';
import type {
  GenerateOptions,
  GenerateResult,
  LLMProviderInfo,
  LLMProviderName,
} from '@qaa/shared';
import {
  LLMConfigurationError,
  LLMParseError,
  LLMRequestError,
  type LLMProvider,
} from './types.js';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: LLMProviderName;
  abstract readonly displayName: string;
  abstract readonly defaultModel: string;
  abstract readonly models: string[];

  constructor(
    protected readonly apiKey: string,
    protected readonly baseUrl: string,
    protected readonly defaultTimeoutMs: number = 60000,
    protected readonly defaultTemperature: number = 0.2,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getInfo(): LLMProviderInfo {
    return {
      name: this.name,
      displayName: this.displayName,
      defaultModel: this.defaultModel,
      models: [...this.models],
      configured: this.isConfigured(),
    };
  }

  protected assertConfigured(): void {
    if (!this.isConfigured()) {
      const keyMap: Record<LLMProviderName, string> = {
        groq: 'GROQ_API_KEY',
        cohere: 'COHERE_API_KEY',
        openrouter: 'OPENROUTER_API_KEY',
      };
      throw new LLMConfigurationError(this.name, keyMap[this.name]);
    }
  }

  abstract generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;

  async generateJSON<T>(
    prompt: string,
    schema?: z.ZodType<T, z.ZodTypeDef, unknown>,
    options?: GenerateOptions,
  ): Promise<T> {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include explanatory text before or after the JSON.`;
    const result = await this.generate(jsonPrompt, options);

    const extracted = this.extractJSONText(result.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(extracted);
    } catch (err) {
      throw new LLMParseError(
        this.name,
        `Failed to parse JSON response from ${this.name}: ${(err as Error).message}`,
        { raw: result.text },
      );
    }

    if (schema) {
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        throw new LLMParseError(
          this.name,
          `Response from ${this.name} failed schema validation: ${validated.error.message}`,
          { parsed, errors: validated.error.issues },
        );
      }
      return validated.data;
    }

    return parsed as T;
  }

  protected extractJSONText(text: string): string {
    const trimmed = text.trim();

    // Check for ```json ... ``` code fence
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fencedMatch && fencedMatch[1]) {
      return fencedMatch[1].trim();
    }

    // Check for bare object or array starting with { or [
    const firstBrace = trimmed.indexOf('{');
    const firstBracket = trimmed.indexOf('[');

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      const lastBrace = trimmed.lastIndexOf('}');
      if (lastBrace !== -1 && lastBrace > firstBrace) {
        return trimmed.slice(firstBrace, lastBrace + 1);
      }
    } else if (firstBracket !== -1) {
      const lastBracket = trimmed.lastIndexOf(']');
      if (lastBracket !== -1 && lastBracket > firstBracket) {
        return trimmed.slice(firstBracket, lastBracket + 1);
      }
    }

    return trimmed;
  }

  protected async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs?: number,
  ): Promise<Response> {
    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return res;
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        throw new LLMRequestError(
          this.name,
          `Request to ${this.name} timed out after ${timeout}ms`,
          408,
        );
      }
      throw new LLMRequestError(
        this.name,
        `Network error communicating with ${this.name}: ${(err as Error).message}`,
        500,
        err,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
