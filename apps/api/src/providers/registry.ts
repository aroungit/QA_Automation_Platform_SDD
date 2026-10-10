import {
  LLM_PROVIDERS,
  type LLMProviderInfo,
  type LLMProviderName,
  type LLMProvidersResponse,
} from '@qaa/shared';
import type { AppConfig } from '../config.js';
import { getConfig } from '../config.js';
import { CohereProvider } from './cohere-provider.js';
import { GroqProvider } from './groq-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import type { LLMProvider } from './types.js';

export class ProviderRegistry {
  private readonly providers = new Map<LLMProviderName, LLMProvider>();
  readonly defaultProviderName: LLMProviderName;

  constructor(config?: AppConfig) {
    const cfg = config ?? getConfig();
    this.defaultProviderName = cfg.llm.defaultProvider;

    const groq = new GroqProvider(
      cfg.llm.groq.apiKey,
      cfg.llm.groq.baseUrl,
      cfg.llm.groq.defaultModel,
      cfg.llm.timeoutMs,
      cfg.llm.temperature,
    );

    const cohere = new CohereProvider(
      cfg.llm.cohere.apiKey,
      cfg.llm.cohere.baseUrl,
      cfg.llm.cohere.defaultModel,
      cfg.llm.timeoutMs,
      cfg.llm.temperature,
    );

    const openrouter = new OpenRouterProvider(
      cfg.llm.openrouter.apiKey,
      cfg.llm.openrouter.baseUrl,
      cfg.llm.openrouter.defaultModel,
      cfg.llm.timeoutMs,
      cfg.llm.temperature,
    );

    this.providers.set('groq', groq);
    this.providers.set('cohere', cohere);
    this.providers.set('openrouter', openrouter);
  }

  getProvider(name?: LLMProviderName): LLMProvider {
    const target = name ?? this.defaultProviderName;
    const provider = this.providers.get(target);
    if (!provider) {
      throw new Error(
        `Unknown LLM provider: "${target}". Valid providers: ${LLM_PROVIDERS.join(', ')}`,
      );
    }
    return provider;
  }

  getAllProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  getProviderInfoList(): LLMProviderInfo[] {
    return this.getAllProviders().map((p) => p.getInfo());
  }

  getProvidersResponse(): LLMProvidersResponse {
    return {
      defaultProvider: this.defaultProviderName,
      providers: this.getProviderInfoList(),
    };
  }

  resolveProvider(
    requestedProvider?: string,
    requestedModel?: string,
  ): { provider: LLMProvider; model: string } {
    let providerName: LLMProviderName;

    if (requestedProvider) {
      const normalized = requestedProvider.toLowerCase() as LLMProviderName;
      if (!LLM_PROVIDERS.includes(normalized)) {
        throw new Error(
          `Invalid provider "${requestedProvider}". Supported: ${LLM_PROVIDERS.join(', ')}`,
        );
      }
      providerName = normalized;
    } else {
      providerName = this.defaultProviderName;
    }

    const provider = this.getProvider(providerName);
    const model = requestedModel?.trim() || provider.defaultModel;

    return { provider, model };
  }
}

let registryInstance: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!registryInstance) {
    registryInstance = new ProviderRegistry();
  }
  return registryInstance;
}

export function resetProviderRegistry(): void {
  registryInstance = null;
}
