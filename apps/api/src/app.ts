import cors from 'cors';
import express, { type Express } from 'express';
import type { AppConfig } from './config.js';
import { getConfig } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { ProviderRegistry } from './providers/registry.js';
import { createAutomationRouter } from './routes/automation.js';
import { createHealthRouter } from './routes/health.js';
import { createProvidersRouter } from './routes/providers.js';
import { createReportsRouter } from './routes/reports.js';
import { createSpecsRouter } from './routes/specs.js';
import { FileStore } from './storage/file-store.js';

export interface AppDependencies {
  config?: AppConfig;
  store?: FileStore;
  registry?: ProviderRegistry;
}

export function createApp(deps?: AppDependencies): {
  app: Express;
  config: AppConfig;
  store: FileStore;
  registry: ProviderRegistry;
} {
  const config = deps?.config ?? getConfig();
  const store = deps?.store ?? new FileStore(config.storage);
  const registry = deps?.registry ?? new ProviderRegistry(config);

  const app = express();

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true);
        if (config.server.corsOrigins.includes('*') || config.server.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive in development
      },
      credentials: true,
    }),
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Routes
  app.use(createHealthRouter());
  app.use(createProvidersRouter(registry));
  app.use(createSpecsRouter(store, registry));
  app.use(createReportsRouter(store));
  app.use(createAutomationRouter(store));

  // 404 and error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, config, store, registry };
}
