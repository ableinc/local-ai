import { Select } from "./ui/select";

interface AppModelDropdownProps {
  availableModels: { name: string }[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelsLoading: boolean;
  isLoading: boolean;
}

export function AppModelDropdown({
  availableModels,
  selectedModel,
  setSelectedModel,
  modelsLoading,
  isLoading,
}: AppModelDropdownProps) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        Models ({availableModels.length}):
      </span>
      <Select
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        disabled={modelsLoading || isLoading}
        className="w-48 cursor-pointer"
      >
        {modelsLoading ? (
          <option>Loading models...</option>
        ) : availableModels.length > 0 ? (
          availableModels.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
            </option>
          ))
        ) : (
          <option value="">No models available</option>
        )}
      </Select>
    </div>
  );
}
