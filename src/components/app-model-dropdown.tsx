import type { JSX } from "react";
import { Select } from "./ui/select";

interface AppModelDropdownProps {
  availableModels: { name: string }[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelsLoading: boolean;
  isLoading: boolean;
}

function getModelOptions(
  availableModels: { name: string }[]
): JSX.Element[] {
  const options: JSX.Element[] = [];
  for (let i = 0; i < availableModels.length + 1; i++) {
    const model = availableModels[i - 1];
    if (i === 0) {
      options.push(<option key="default" value="" selected disabled>Select a model...</option>)
    } else {
      options.push(
        <option key={model.name} value={model.name}>
        {model.name}
      </option>
      );
    }
  }
  return options;
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
          <option key={"0"}>Loading models...</option>
        ) : availableModels.length > 0 ? (
          getModelOptions(availableModels)
        ) : null}
      </Select>
    </div>
  );
}
