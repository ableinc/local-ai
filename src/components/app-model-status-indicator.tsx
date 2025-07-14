interface AppModelStatusIndicatorProps {
  healthStatus: {
    server: boolean;
    ollama: boolean;
  };
  checkHealth: () => void;
}

export function AppModelStatusIndicator({
  healthStatus,
  checkHealth,
}: AppModelStatusIndicatorProps) {
  return (
    <button
      onClick={checkHealth}
      className="flex items-center gap-1 ml-2 px-2 py-1 rounded hover:bg-muted transition-colors"
      title={`Server: ${healthStatus.server ? "Online" : "Offline"}, Ollama: ${
        healthStatus.ollama ? "Online" : "Offline"
      }. Click to refresh.`}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          healthStatus.server && healthStatus.ollama
            ? "bg-green-500"
            : "bg-red-500"
        }`}
      />
      <span className="text-xs text-muted-foreground">
        {healthStatus.server && healthStatus.ollama ? "Online" : "Offline"}
      </span>
    </button>
  );
}
