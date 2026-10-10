import React, { createContext, useContext, useEffect, useState } from 'react';
import type { LLMProviderInfo, LLMProviderName } from '@qaa/shared';
import { api } from '../services/api';

interface LLMContextType {
  providers: LLMProviderInfo[];
  selectedProvider: LLMProviderName;
  selectedModel: string;
  loading: boolean;
  error: string | null;
  setSelectedProvider: (provider: LLMProviderName) => void;
  setSelectedModel: (model: string) => void;
  refreshProviders: () => Promise<void>;
}

const LLMContext = createContext<LLMContextType | undefined>(undefined);

const PROVIDER_STORAGE_KEY = 'qaa-selected-provider';
const MODEL_STORAGE_KEY = 'qaa-selected-model';

// Fallback initial providers before backend response
const FALLBACK_PROVIDERS: LLMProviderInfo[] = [
  {
    name: 'groq',
    displayName: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    configured: true,
  },
  {
    name: 'cohere',
    displayName: 'Cohere',
    defaultModel: 'command-r-plus',
    models: ['command-r-plus', 'command-r', 'command-light'],
    configured: true,
  },
  {
    name: 'openrouter',
    displayName: 'OpenRouter',
    defaultModel: 'openai/gpt-4o-mini',
    models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash'],
    configured: true,
  },
];

export const LLMProviderComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [providers, setProviders] = useState<LLMProviderInfo[]>(FALLBACK_PROVIDERS);
  const [selectedProvider, setSelectedProviderState] = useState<LLMProviderName>(() => {
    if (typeof window === 'undefined') return 'groq';
    const saved = localStorage.getItem(PROVIDER_STORAGE_KEY) as LLMProviderName | null;
    return saved === 'groq' || saved === 'cohere' || saved === 'openrouter' ? saved : 'groq';
  });

  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'llama-3.3-70b-versatile';
    return (
      localStorage.getItem(MODEL_STORAGE_KEY) ||
      FALLBACK_PROVIDERS.find((p) => p.name === selectedProvider)?.defaultModel ||
      'llama-3.3-70b-versatile'
    );
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const data = await api.getProviders();
      if (data && data.providers) {
        setProviders(data.providers);
        // If current selected provider is not configured or present, use default
        const active = data.providers.find((p) => p.name === selectedProvider);
        if (active) {
          if (!active.models.includes(selectedModel)) {
            setSelectedModel(active.defaultModel);
          }
        } else {
          setSelectedProvider(data.defaultProvider);
        }
      }
      setError(null);
    } catch (err) {
      console.warn('Backend provider query warning (using fallback):', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const setSelectedProvider = (provider: LLMProviderName) => {
    setSelectedProviderState(provider);
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);

    const providerInfo = providers.find((p) => p.name === provider);
    const newDefaultModel = providerInfo ? providerInfo.defaultModel : '';
    setSelectedModelState(newDefaultModel);
    localStorage.setItem(MODEL_STORAGE_KEY, newDefaultModel);
  };

  const setSelectedModel = (model: string) => {
    setSelectedModelState(model);
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  };

  return (
    <LLMContext.Provider
      value={{
        providers,
        selectedProvider,
        selectedModel,
        loading,
        error,
        setSelectedProvider,
        setSelectedModel,
        refreshProviders: fetchProviders,
      }}
    >
      {children}
    </LLMContext.Provider>
  );
};

export function useLLM(): LLMContextType {
  const context = useContext(LLMContext);
  if (!context) {
    throw new Error('useLLM must be used within a LLMProviderComponent');
  }
  return context;
}
