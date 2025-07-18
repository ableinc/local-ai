import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AppContext,
  type AppSettings,
  type AppContextType,
  type HealthStatus,
} from "./AppContextTypes";

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
  });

  const checkHealth = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/health`,
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
        if (!data.server || !data.ollama) {
          toast.error("Ollama and/or server is offline", {
            description: `Server: ${
              data.server ? "Online" : "Offline"
            }, Ollama: ${data.ollama ? "Online" : "Offline"}`,
            duration: 5000,
          });
        }
      } else {
        // Server is not responding
        setHealthStatus({
          server: false,
          ollama: false,
          lastChecked: new Date(),
        });

        toast.error("Ollama and/or server is offline", {
          description: "Unable to connect to the server",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Health check failed:", error);
      setHealthStatus({
        server: false,
        ollama: false,
        lastChecked: new Date(),
      });

      toast.error("Ollama and/or server is offline", {
        description: "Connection failed",
        duration: 5000,
      });
    }
  };

  const getAppSettings = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/settings`,
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
      } else {
        toast.error("App Settings Error", {
          description: data.error,
          duration: 5000,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("App Settings Error", {
        description: "Unable to get app settings, server my be offline.",
        duration: 5000,
      });
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/settings`,
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
