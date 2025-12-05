import { Button } from "./ui/button";
import { AppFileUpload, type UploadedFile } from "./app-file-upload";
import type { AppHealth } from "@/services/api";

interface AppChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  handleKeyPress: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
  handleCancelGeneration: () => void;
  handleSendMessage: () => void;
  appHealth: AppHealth;
  onFileContent: (files: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  useMemory: boolean;
  selectedModel: string | null;
}

function getButtonText(
  isLoading: boolean,
  appHealth: AppHealth,
  selectedModel: string | null
): [string, boolean] {
  if (isLoading) {
    return ["Cancel", false];
  }
  if (!appHealth.server || !appHealth.ollama) {
    return ["Offline", true];
  }
  if (selectedModel && selectedModel.trim() !== "") {
    return ["Send", false];
  }
  return ["Select a model...", true];
}

export function AppChatInput({
  message,
  setMessage,
  handleKeyPress,
  isLoading,
  handleCancelGeneration,
  handleSendMessage,
  appHealth,
  onFileContent,
  uploadedFiles,
  setUploadedFiles,
  useMemory,
  selectedModel,
}: AppChatInputProps) {
  const [buttonText, buttonDisabled] = getButtonText(
    isLoading,
    appHealth,
    selectedModel
  );
  return (
    <div className="border-t bg-background p-4 shrink-0">
      {/* File Upload Section */}
      <div className="mb-3">
        <AppFileUpload 
          onFileContent={onFileContent}
          disabled={isLoading}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
      </div>
      
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1 min-h-[60px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          rows={2}
        />
        <Button
          onClick={isLoading ? handleCancelGeneration : handleSendMessage}
          disabled={buttonDisabled}
          variant={isLoading ? "destructive" : "default"}
          className="self-end"
        >
          {buttonText}
        </Button>
      </div>
      { useMemory === false && (
        <span className="text-xs text-muted-foreground">
          Memory context is disabled. You can change this in settings.
        </span>
      )}
    </div>
  );
}
