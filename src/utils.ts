import type { AppMode } from "@/components/app-mode-dropdown";

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: Record<string, string | number | string[]>;
}

export interface OllamaTags {
  models: Array<OllamaModel>;
}

export function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost';
  const port = import.meta.env.VITE_API_PORT ? `:${import.meta.env.VITE_API_PORT}` : '';
  const prefix = import.meta.env.VITE_API_BASE_PREFIX || '';
  return `${baseUrl}${port}${prefix}`;
}

export function getModes(agenticModeEnabled: boolean): AppMode[] {
  return agenticModeEnabled ? ['Chat', 'Agent'] : ['Chat'];
}
