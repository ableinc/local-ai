import type { SetStateAction } from "react";
import { Select } from "@/components/ui/select";

export type AppMode = 'Chat' | 'Agent';

interface AppModeDropdownProps {
  modes: string[];
  currentMode: AppMode;
  setAppMode: (value: SetStateAction<AppMode>) => void;
}

export function AppModeDropdown({ modes, currentMode, setAppMode }: AppModeDropdownProps) {
  return (
    <div className="ml-2 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
            Mode:
        </span>
      <Select
        value={currentMode}
        className="w-48 cursor-pointer"
        onChange={(e) => {
          setAppMode(e.target.value as AppMode);
        }}
      >
        {modes.map((mode) => (
          <option key={mode} value={mode}>
            {mode}
          </option>
        ))}
      </Select>
    </div>
  );
}
