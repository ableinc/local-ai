import { useApp } from "@/hooks/useApp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/contexts/AppContextTypes";
import { useState } from "react";
import { ChevronsUpDown, Loader, Plus, RotateCcw, X as CloseIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AppMCPServers } from "@/components/app-mcp-servers";

interface SettingsProps {
  onClose: () => void;
}

export function SettingsDialogArea({ onClose }: SettingsProps) {
  const { settings, saveSettings, mcpServers, addMcpServer, deleteMcpServer, getMcpServers } = useApp();
  const [updatedSettings, setUpdatedSettings] = useState<AppSettings>(settings);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [didChange, setDidChange] = useState<boolean>(false);
  const [isMCPServersOpen, setIsMCPServersOpen] = useState<boolean>(false);
  const [doCreateNew, setDoCreateNew] = useState<boolean>(false);

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
        { /* Use Context Memory Setting */ }
        <Label className="font-bold text-md">Use Memory</Label>
        <Switch checked={updatedSettings.use_memory || false} onCheckedChange={(checked: boolean) => {
          setDidChange(true);
          setUpdatedSettings((prevState) => {
            return {
              ...prevState,
              use_memory: checked
            }
          })
        }}/>

        <Label className="font-bold text-md">Enable Agentic Mode</Label>
        <Switch checked={updatedSettings.agentic_mode || false} onCheckedChange={(checked: boolean) => {
          setDidChange(true);
          setUpdatedSettings((prevState) => {
            return {
              ...prevState,
              agentic_mode: checked
            }
          })
        }}/>
      </div>

      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-between">
          <Label className="font-bold text-md">MCP Servers ({mcpServers.length})</Label>
          <Button variant="ghost" size="icon" className="size-8 cursor-pointer" onClick={() => {
            getMcpServers();
          }}>
            <RotateCcw />
          <span className="sr-only">Refresh MCP Server List</span>
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="size-8 cursor-pointer" onClick={() => {
            if (doCreateNew) {
              setDoCreateNew(false);
              getMcpServers();
            } else {
              setDoCreateNew(true);
              setIsMCPServersOpen(true);
            }
          }}>
            { doCreateNew ? <CloseIcon /> : <Plus /> }
            <span className="sr-only">Add MCP Server</span>
          </Button>

          <Button variant="ghost" size="icon" className="size-8" onClick={() => {
            setIsMCPServersOpen(prev => !prev)
          }}>
              <ChevronsUpDown />
              <span className="sr-only">Toggle</span>
          </Button>
        </div>
      </div>
      
      <AppMCPServers
        open={isMCPServersOpen}
        setIsOpen={setIsMCPServersOpen}
        mcpServers={mcpServers}
        createNewFunc={addMcpServer}
        doCreateNew={doCreateNew}
        deleteFunc={deleteMcpServer}
      />
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
