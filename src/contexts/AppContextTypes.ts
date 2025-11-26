import { createContext } from 'react'
import type { McpServer } from '@/services/api';

export interface HealthStatus {
  server: boolean;
  ollama: boolean;
  lastChecked: Date | null;
}

export interface AppSettings {
  use_memory: boolean;
  agentic_mode: boolean;
}

export interface AppContextType {
  healthStatus: HealthStatus;
  checkHealth: () => Promise<void>;
  settings: AppSettings;
  saveSettings: (newSettings: AppSettings) => Promise<void>;
  mcpServers: McpServer[];
  addMcpServer: (body: McpServer) => Promise<void>;
  deleteMcpServer: (id: number) => Promise<void>;
  getMcpServers: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined)
