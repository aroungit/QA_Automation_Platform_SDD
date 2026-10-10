import type { z } from 'zod';
import type {
  GenerateOptions,
  GenerateResult,
  LLMProviderInfo,
  LLMProviderName,
} from '@qaa/shared';

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: LLMProviderName,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMConfigurationError extends LLMError {
  constructor(provider: LLMProviderName, missingKey: string) {
    super(
      `Provider "${provider}" is not configured. Missing environment variable ${missingKey}.`,
      'PROVIDER_NOT_CONFIGURED',
      provider,
    );
    this.name = 'LLMConfigurationError';
  }
}

export class LLMRequestError extends LLMError {
  constructor(
    provider: LLMProviderName,
    message: string,
    public readonly status?: number,
    details?: unknown,
  ) {
    super(message, 'LLM_REQUEST_FAILED', provider, details);
    this.name = 'LLMRequestError';
  }
}

export class LLMParseError extends LLMError {
  constructor(provider: LLMProviderName, message: string, details?: unknown) {
    super(message, 'LLM_PARSE_ERROR', provider, details);
    this.name = 'LLMParseError';
  }
}

export interface LLMProvider {
  readonly name: LLMProviderName;
  readonly displayName: string;
  readonly defaultModel: string;
  readonly models: string[];

  isConfigured(): boolean;
  getInfo(): LLMProviderInfo;
  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
  generateJSON<T>(
    prompt: string,
    schema?: z.ZodType<T, z.ZodTypeDef, unknown>,
    options?: GenerateOptions,
  ): Promise<T>;
}
