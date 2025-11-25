import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AppContext,
  type AppSettings,
  type AppContextType,
  type HealthStatus,
} from "./AppContextTypes";
import { getApiBaseUrl } from "@/utils";

interface AppProviderProps {
  children: React.ReactNode;
}

const apiBaseUrl = getApiBaseUrl();

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
  const [didNotify, setDidNotify] = useState<boolean>(false);

  const checkHealth = async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/health`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHealthStatus({
          server: data.server,
          ollama: data.ollama,
          lastChecked: new Date(),
        });

        // Show error toast if either service is down
        if ((!data.server || !data.ollama) && !didNotify) {
          toast.error("Server and/or Ollama", {
            description: `Server and/or Ollama is offline.`,
            duration: 3000,
          });
          setDidNotify(true);
        }
      } else {
        // Server is not responding
        setHealthStatus({
          server: false,
          ollama: false,
          lastChecked: new Date(),
        });
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
      const response = await fetch(
        `${apiBaseUrl}/settings`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newSettings)
        }
      );
      const data = await response.json();
      if (response.ok) {
        setSettings(data.data);
      } else {
        toast.error("Updating Settings Error", {
          description: data.error,
          duration: 5000,
        });
      }
      // Get latest settings
      await getAppSettings();
    } catch (error) {
      console.error(error);
      toast.error("Updating Settings Error", {
        description: "Unable to update settings. Please try again later.",
        duration: 5000,
      });
    } 
  }

  // Check health on mount and periodically
  useEffect(() => {
    checkHealth();
    getAppSettings();
    // Check health every 5 seconds
    const interval = setInterval(checkHealth, 5000);

    return () => clearInterval(interval);
  }, []);

  const value: AppContextType = {
    healthStatus,
    checkHealth,
    settings,
    saveSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
