import type { GenerateOptions, GenerateResult, LLMProviderName } from '@qaa/shared';
import { BaseLLMProvider } from './base-provider.js';
import { LLMRequestError } from './types.js';

export class OpenRouterProvider extends BaseLLMProvider {
  readonly name: LLMProviderName = 'openrouter';
  readonly displayName = 'OpenRouter';
  readonly defaultModel: string;
  readonly models = [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.3-70b-instruct',
  ];

  constructor(
    apiKey: string,
    baseUrl = 'https://openrouter.ai/api/v1',
    defaultModel = 'openai/gpt-4o-mini',
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
          'HTTP-Referer': 'http://localhost:4000',
          'X-Title': 'QA_Automation_Platform_Agent',
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
        `OpenRouter API request failed with status ${res.status}: ${errorText}`,
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
