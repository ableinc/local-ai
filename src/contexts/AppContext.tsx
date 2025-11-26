import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AppContext,
  type AppSettings,
  type AppContextType,
  type HealthStatus,
} from "./AppContextTypes";
import { apiService, type McpServer } from "@/services/api";

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    server: false,
    ollama: false,
    lastChecked: null,
  });
  const [settings, setSettings] = useState<AppSettings>({
    use_memory: false,
    agentic_mode: false,
  });
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [didNotify, setDidNotify] = useState<boolean>(false);

  const checkHealth = async () => {
    try {
      const response = await apiService.checkHealth();
      setHealthStatus({
        server: response.server,
        ollama: response.ollama,
        lastChecked: new Date(),
      });
      if ((!response.server || !response.ollama) && !didNotify) {
        toast.error("Server and/or Ollama", {
          description: `Server and/or Ollama is offline.`,
          duration: 3000,
        });
        setDidNotify(true);
      }
    } catch (error) {
      console.error("Health check failed:", error);
      setHealthStatus({
        server: false,
        ollama: false,
        lastChecked: new Date(),
      });
    }
  };

  const getAppSettings = async () => {
    try {
      const response = await apiService.getAppSettings();
      setSettings(response);
    } catch (error) {
      console.error(error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      const response = await apiService.saveAppSettings(newSettings);
      setSettings(response);
    } catch (error) {
      console.error(error);
      toast.error("Updating Settings Error", {
        description: "Unable to update settings. Please try again later.",
        duration: 5000,
      });
    }
  }

  const addMcpServer = async (body: McpServer): Promise<void> => {
    try {
      const newServer = await apiService.addMcpServer(body);
      toast.success("MCP Server added successfully");
      setMcpServers((prevServers) => [...prevServers, newServer]);
    } catch (error) {
      console.error("Failed to add MCP server:", error);
      toast.error("Failed to add MCP server", {
        duration: 5000,
      });
    }
  };

  const deleteMcpServer = async (id: number) => {
    try {
      await apiService.deleteMcpServer(id);
      toast.success("MCP Server deleted successfully");
      setMcpServers((prevServers) => prevServers.filter(server => server.id !== id));
    } catch (error) {
      console.error("Failed to delete MCP server:", error);
      toast.error("Failed to delete MCP server", {
        duration: 5000,
      });
    }
  };

  const getMcpServers = async (): Promise<void> => {
    try {
      const servers = await apiService.getMcpServers();
      setMcpServers(servers);
    } catch (error) {
      console.error("Failed to fetch MCP servers:", error);
      toast.error("Failed to fetch MCP servers", {
        duration: 5000,
      });
    }
  };

  // Check health on mount and periodically
  useEffect(() => {
    checkHealth();
    getAppSettings();
    getMcpServers();
    // Check health every 5 seconds
    const interval = setInterval(checkHealth, 5000);

    return () => clearInterval(interval);
  }, []);

  const value: AppContextType = {
    healthStatus,
    checkHealth,
    settings,
    saveSettings,
    mcpServers,
    addMcpServer,
    deleteMcpServer,
    getMcpServers,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
