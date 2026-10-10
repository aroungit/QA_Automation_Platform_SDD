import type { GenerateOptions, GenerateResult, LLMProviderName } from '@qaa/shared';
import { BaseLLMProvider } from './base-provider.js';
import { LLMRequestError } from './types.js';

export class GroqProvider extends BaseLLMProvider {
  readonly name: LLMProviderName = 'groq';
  readonly displayName = 'Groq';
  readonly defaultModel: string;
  readonly models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ];

  constructor(
    apiKey: string,
    baseUrl = 'https://api.groq.com/openai/v1',
    defaultModel = 'llama-3.3-70b-versatile',
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

    const url = `${this.baseUrl}/chat/completions`;
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
        `Groq API request failed with status ${res.status}: ${errorText}`,
        res.status,
        { statusText: res.statusText, body: errorText },
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const text = data.choices?.[0]?.message?.content ?? '';

    return {
      text,
      provider: this.name,
      model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
