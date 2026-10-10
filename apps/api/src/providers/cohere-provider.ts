import type { GenerateOptions, GenerateResult, LLMProviderName } from '@qaa/shared';
import { BaseLLMProvider } from './base-provider.js';
import { LLMRequestError } from './types.js';

export class CohereProvider extends BaseLLMProvider {
  readonly name: LLMProviderName = 'cohere';
  readonly displayName = 'Cohere';
  readonly defaultModel: string;
  readonly models = ['command-r-plus', 'command-r', 'command-light'];

  constructor(
    apiKey: string,
    baseUrl = 'https://api.cohere.com',
    defaultModel = 'command-r-plus',
    defaultTimeoutMs = 60000,
    defaultTemperature = 0.2,
  ) {
    super(apiKey, baseUrl, defaultTimeoutMs, defaultTemperature);
    this.defaultModel = defaultModel;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    this.assertConfigured();

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? this.defaultTemperature;

    const messages = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature,
    };
    if (options?.maxTokens) {
      payload.max_tokens = options.maxTokens;
    }

    const url = `${this.baseUrl}/v2/chat`;
    const res = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      this.defaultTimeoutMs,
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new LLMRequestError(
        this.name,
        `Cohere API request failed with status ${res.status}: ${errorText}`,
        res.status,
        { statusText: res.statusText, body: errorText },
      );
    }

    const data = (await res.json()) as {
      message?: {
        content?: Array<{ type?: string; text?: string }>;
      };
      usage?: {
        tokens?: {
          input_tokens?: number;
          output_tokens?: number;
        };
      };
    };

    const textPart =
      data.message?.content?.find((c) => c.type === 'text') ?? data.message?.content?.[0];
    const text = textPart?.text ?? '';

    return {
      text,
      provider: this.name,
      model,
      usage: data.usage?.tokens
        ? {
            promptTokens: data.usage.tokens.input_tokens,
            completionTokens: data.usage.tokens.output_tokens,
            totalTokens:
              (data.usage.tokens.input_tokens ?? 0) + (data.usage.tokens.output_tokens ?? 0),
          }
        : undefined,
    };
  }
}
