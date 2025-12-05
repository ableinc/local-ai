import { createContext } from 'react'
import type { McpServer, AppHealth, AppSettings } from '@/services/api';

export interface AppContextType {
  appHealth: AppHealth;
  settings: AppSettings;
  saveSettings: (newSettings: AppSettings) => Promise<void>;
  mcpServers: McpServer[];
  addMcpServer: (body: McpServer) => Promise<void>;
  deleteMcpServer: (id: number) => Promise<void>;
  getMcpServers: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined)
