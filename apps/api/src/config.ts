import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { LLM_PROVIDERS, type LLMProviderName } from '@qaa/shared';

// Load .env from current directory or monorepo root
dotenv.config();
// In monorepo, also check parent directories if .env wasn't loaded from cwd
if (!process.env.API_PORT && !process.env.DEFAULT_LLM_PROVIDER) {
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
}

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z
    .string()
    .optional()
    .default('4000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .default('http://localhost:5173,http://localhost:8081')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  // LLM General
  DEFAULT_LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('groq'),
  LLM_TIMEOUT_MS: z
    .string()
    .optional()
    .default('60000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  LLM_TEMPERATURE: z
    .string()
    .optional()
    .default('0.2')
    .transform((val) => parseFloat(val))
    .pipe(z.number().min(0).max(2)),

  // Groq
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_BASE_URL: z.string().default('https://api.groq.com/openai/v1'),
  GROQ_DEFAULT_MODEL: z.string().default('llama-3.3-70b-versatile'),

  // Cohere
  COHERE_API_KEY: z.string().optional().default(''),
  COHERE_BASE_URL: z.string().default('https://api.cohere.com'),
  COHERE_DEFAULT_MODEL: z.string().default('command-r-plus'),

  // OpenRouter
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: z.string().default('openai/gpt-4o-mini'),

  // Storage paths
  SPECS_DIR: z.string().default('./specs'),
  AUTOMATION_DIR: z.string().default('./automation'),
  REPORTS_DIR: z.string().default('./reports'),
  TEMP_WORKSPACE_DIR: z.string().default('./.workspace'),

  // Targets
  ORANGEHRM_BASE_URL: z.string().default('https://opensource-demo.orangehrmlive.com'),
  ORANGEHRM_USERNAME: z.string().default('Admin'),
  ORANGEHRM_PASSWORD: z.string().default('admin123'),
  REACT_APP_BASE_URL: z.string().default('http://localhost:3000'),

  // Mobile
  MOBILE_DEVICE: z.string().default('Pixel 7'),
  MOBILE_EMULATOR_NAME: z.string().optional().default(''),
  MOBILE_APP_PATH: z.string().optional().default(''),

  // Auto-heal
  HEAL_MAX_ATTEMPTS: z
    .string()
    .optional()
    .default('3')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative()),
});

export type RawEnv = z.infer<typeof RawEnvSchema>;

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  server: {
    port: number;
    host: string;
    corsOrigins: string[];
  };
  llm: {
    defaultProvider: LLMProviderName;
    timeoutMs: number;
    temperature: number;
    groq: {
      apiKey: string;
      baseUrl: string;
      defaultModel: string;
    };
    cohere: {
      apiKey: string;
      baseUrl: string;
      defaultModel: string;
    };
    openrouter: {
      apiKey: string;
      baseUrl: string;
      defaultModel: string;
    };
  };
  storage: {
    rootDir: string;
    specsDir: string;
    automationDir: string;
    reportsDir: string;
    tempWorkspaceDir: string;
  };
  targets: {
    orangeHrm: {
      baseUrl: string;
      username: string;
      password: string;
    };
    reactApp: {
      baseUrl: string;
    };
  };
  mobile: {
    device: string;
    emulatorName: string;
    appPath: string;
  };
  heal: {
    maxAttempts: number;
  };
}

export function loadConfig(
  customEnv?: Record<string, string | undefined>,
  baseDir?: string,
): AppConfig {
  const envSource = customEnv ? { ...customEnv } : process.env;
  const parsed = RawEnvSchema.parse(envSource);
  const root = baseDir || process.cwd();

  const resolvePath = (relPath: string) =>
    path.isAbsolute(relPath) ? relPath : path.resolve(root, relPath);

  return {
    env: parsed.NODE_ENV,
    server: {
      port: parsed.API_PORT,
      host: parsed.API_HOST,
      corsOrigins: parsed.CORS_ORIGINS,
    },
    llm: {
      defaultProvider: parsed.DEFAULT_LLM_PROVIDER,
      timeoutMs: parsed.LLM_TIMEOUT_MS,
      temperature: parsed.LLM_TEMPERATURE,
      groq: {
        apiKey: parsed.GROQ_API_KEY.trim(),
        baseUrl: parsed.GROQ_BASE_URL.replace(/\/+$/, ''),
        defaultModel: parsed.GROQ_DEFAULT_MODEL,
      },
      cohere: {
        apiKey: parsed.COHERE_API_KEY.trim(),
        baseUrl: parsed.COHERE_BASE_URL.replace(/\/+$/, ''),
        defaultModel: parsed.COHERE_DEFAULT_MODEL,
      },
      openrouter: {
        apiKey: parsed.OPENROUTER_API_KEY.trim(),
        baseUrl: parsed.OPENROUTER_BASE_URL.replace(/\/+$/, ''),
        defaultModel: parsed.OPENROUTER_DEFAULT_MODEL,
      },
    },
    storage: {
      rootDir: root,
      specsDir: resolvePath(parsed.SPECS_DIR),
      automationDir: resolvePath(parsed.AUTOMATION_DIR),
      reportsDir: resolvePath(parsed.REPORTS_DIR),
      tempWorkspaceDir: resolvePath(parsed.TEMP_WORKSPACE_DIR),
    },
    targets: {
      orangeHrm: {
        baseUrl: parsed.ORANGEHRM_BASE_URL,
        username: parsed.ORANGEHRM_USERNAME,
        password: parsed.ORANGEHRM_PASSWORD,
      },
      reactApp: {
        baseUrl: parsed.REACT_APP_BASE_URL,
      },
    },
    mobile: {
      device: parsed.MOBILE_DEVICE,
      emulatorName: parsed.MOBILE_EMULATOR_NAME,
      appPath: parsed.MOBILE_APP_PATH,
    },
    heal: {
      maxAttempts: parsed.HEAL_MAX_ATTEMPTS,
    },
  };
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}
