interface AppModelStatusIndicatorProps {
  appHealth: {
    server: boolean;
    ollama: boolean;
  };
}

export function AppModelStatusIndicator({
  appHealth,
}: AppModelStatusIndicatorProps) {
  return (
    <button
      className="flex items-center gap-1 ml-2 px-2 py-1 rounded hover:bg-muted transition-colors"
      title={`Server: ${appHealth.server ? "Online" : "Offline"}`}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          appHealth.server && appHealth.ollama
            ? "bg-green-500"
            : "bg-red-500"
        }`}
      />
      <span className="text-xs text-muted-foreground">
        {appHealth.server && appHealth.ollama ? "Online" : "Offline"}
      </span>
    </button>
  );
}
