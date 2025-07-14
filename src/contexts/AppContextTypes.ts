import { createContext } from 'react'

export interface HealthStatus {
  server: boolean
  ollama: boolean
  lastChecked: Date | null
}

export interface AppContextType {
  healthStatus: HealthStatus
  checkHealth: () => Promise<void>
}

export const AppContext = createContext<AppContextType | undefined>(undefined)
