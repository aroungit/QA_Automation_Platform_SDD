import type { Request } from 'express';
import type { LLMProviderName } from '@qaa/shared';
import type { ProviderRegistry } from '../providers/registry.js';
import type { LLMProvider } from '../providers/types.js';

export interface ProviderSelection {
  providerName?: LLMProviderName;
  model?: string;
}

export function extractProviderSelection(req: Request): ProviderSelection {
  const headerProvider = req.headers['x-llm-provider'];
  const headerModel = req.headers['x-llm-model'];

  const queryProvider = req.query.provider;
  const queryModel = req.query.model;

  const bodyProvider = (req.body as { provider?: string } | undefined)?.provider;
  const bodyModel = (req.body as { model?: string } | undefined)?.model;

  const rawProvider =
    (typeof headerProvider === 'string' && headerProvider) ||
    (typeof queryProvider === 'string' && queryProvider) ||
    (typeof bodyProvider === 'string' && bodyProvider) ||
    undefined;

  const rawModel =
    (typeof headerModel === 'string' && headerModel) ||
    (typeof queryModel === 'string' && queryModel) ||
    (typeof bodyModel === 'string' && bodyModel) ||
    undefined;

  return {
    providerName: rawProvider as LLMProviderName | undefined,
    model: rawModel,
  };
}

export function resolveRequestProvider(
  registry: ProviderRegistry,
  req: Request,
): { provider: LLMProvider; model: string } {
  const selection = extractProviderSelection(req);
  return registry.resolveProvider(selection.providerName, selection.model);
}
