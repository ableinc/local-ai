import { useApp } from "@/hooks/useApp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/contexts/AppContextTypes";
import { useState } from "react";
import { Loader } from "lucide-react";


interface SettingsProps {
  onClose: () => void;
}

export function SettingsDialogArea({ onClose }: SettingsProps) {
  const { settings, saveSettings } = useApp();
  const [updatedSettings, setUpdatedSettings] = useState<AppSettings>(settings);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [didChange, setDidChange] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label className="font-bold text-md">Use Context Memory</Label>
        <Switch checked={updatedSettings.use_memory || false} onCheckedChange={(checked: boolean) => {
          setDidChange(true);
          setUpdatedSettings((prevState) => {
            return {
              ...prevState,
              use_memory: checked
            }
          })
        }}/>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button disabled={!didChange} onClick={async () => {
          setIsLoading(true);
          await saveSettings(updatedSettings);
          setIsLoading(false);
          setDidChange(false);
        }}>Save Changes</Button>
      </div>
    </div>
  );
}
