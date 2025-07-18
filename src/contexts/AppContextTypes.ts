import { createContext } from 'react'

export interface HealthStatus {
  server: boolean;
  ollama: boolean;
  lastChecked: Date | null;
}

export interface AppSettings {
  use_memory: boolean;
}

export interface AppContextType {
  healthStatus: HealthStatus;
  checkHealth: () => Promise<void>;
  settings: AppSettings;
  saveSettings: (newSettings: AppSettings) => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined)
