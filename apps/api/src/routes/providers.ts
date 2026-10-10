import { Router } from 'express';
import type { ApiResponse, LLMProviderInfo, LLMProvidersResponse } from '@qaa/shared';
import { resolveRequestProvider } from '../middleware/request-context.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { LLMConfigurationError } from '../providers/types.js';

export function createProvidersRouter(registry: ProviderRegistry): Router {
  const router = Router();

  // GET /api/providers
  router.get('/api/providers', (_req, res) => {
    const data: LLMProvidersResponse = registry.getProvidersResponse();
    const response: ApiResponse<LLMProvidersResponse> = {
      success: true,
      data,
    };
    res.json(response);
  });

  // GET /api/providers/:name
  router.get('/api/providers/:name', (req, res, next) => {
    try {
      const provider = registry.getProvider(req.params.name as never);
      const response: ApiResponse<LLMProviderInfo> = {
        success: true,
        data: provider.getInfo(),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/providers/validate
  router.post('/api/providers/validate', (req, res, next) => {
    try {
      const { provider, model } = resolveRequestProvider(registry, req);

      if (!provider.isConfigured()) {
        const keyMap: Record<string, string> = {
          groq: 'GROQ_API_KEY',
          cohere: 'COHERE_API_KEY',
          openrouter: 'OPENROUTER_API_KEY',
        };
        throw new LLMConfigurationError(provider.name, keyMap[provider.name] ?? 'API_KEY');
      }

      const response: ApiResponse<{
        valid: boolean;
        provider: string;
        model: string;
        configured: boolean;
      }> = {
        success: true,
        data: {
          valid: true,
          provider: provider.name,
          model,
          configured: true,
        },
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
