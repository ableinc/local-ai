import { useState, useEffect, useCallback } from "react";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppChatInput } from "@/components/app-chat-input";
import { AppChatArea } from "@/components/app-chat-area";
import { AppModelDropdown } from "@/components/app-model-dropdown";
import { AppModeDropdown } from "@/components/app-mode-dropdown";
import type { AppMode } from "@/components/app-mode-dropdown";
import { AppModelExportBtn } from "@/components/app-model-export-btn";
import { apiService, type Chat, type Message, type OllamaChatMessageField } from "@/services/api";
import { useApp } from "@/hooks/useApp";
import type { UploadedFile } from "@/components/app-file-upload";
import "highlight.js/styles/github-dark.css";
import "@/App.css";
import { AppModelStatusIndicator } from "@/components/app-model-status-indicator";
import { toast } from "sonner";
import { getModes } from "@/lib/utils";
import type { OllamaModel } from "@/lib/utils";
import { startConversationSession } from "./services/conversation";
import { AppErrorAlerts } from "./components/app-error-alerts";
import { AlertTriangle } from "lucide-react";

function App() {
  const { healthStatus, checkHealth, settings, appErrorLogs } = useApp();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [appMode, setAppMode] = useState<AppMode>('Chat');
  const [shouldRegenerateMessage, setShouldRegenerateMessage] = useState<boolean>(false);
  const [isErrorLogsOpen, setIsErrorLogsOpen] = useState(false);

  const ollamaBaseUrl = import.meta.env.VITE_OLLAMA_BASE_URL;

  // Load chats on component mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        const allChats = await apiService.getAllChats();
        setChats(allChats);
      } catch (error) {
        console.error("Failed to load chats:", error);
      }
    };
    loadChats();
  }, []);

  const loadChatMessages = useCallback(
    async (chatId: number, page: number = 0, reset: boolean = false) => {
      try {
        const response = await apiService.getChatMessages(chatId, 50, page);

        if (reset) {
          setMessages(response.messages);
          setMessageOffset(response.messages.length);
        } else {
          setMessages((prev) => [...response.messages, ...prev]);
          setMessageOffset((prev) => prev + response.messages.length);
        }

        setHasMoreMessages(response.hasMore);
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    },
    []
  );

  // Load messages when current chat changes
  useEffect(() => {
    if (currentChatId) {
      loadChatMessages(currentChatId, 0, true);
    } else {
      setMessages([]);
      setMessageOffset(0);
      setHasMoreMessages(false);
    }
  }, [currentChatId, loadChatMessages]);

  const createNewChat = useCallback(() => {
    setCurrentChatId(null);
    setMessages([]);
    setMessageOffset(0);
    setHasMoreMessages(false);
    setUploadedFiles([]);
  }, []);

  const selectChat = useCallback((chatId: number) => {
    setCurrentChatId(chatId);
  }, []);

  const deleteChat = useCallback(
    async (chatId: number) => {
      try {
        await apiService.deleteChat(chatId);

        // Remove the chat from the local state
        setChats((prev) => prev.filter((chat) => chat.id !== chatId));

        // If the deleted chat was the current chat, clear the current chat
        if (currentChatId === chatId) {
          setCurrentChatId(null);
          setMessages([]);
          setMessageOffset(0);
          setHasMoreMessages(false);
        }
      } catch (error) {
        console.error("Failed to delete chat:", error);
        toast.error("Something went wrong", {
          description: "Unable to delete the chat",
          duration: 2000,
        });
      }
    },
    [currentChatId]
  );

  const handleCancelGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
    toast.info("Canceled", {
      description: "Canceled the current generation",
      duration: 2000,
    });
  }, [abortController]);

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response: OllamaModel[] = await apiService.getTags();
        setAvailableModels(response);
      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, [ollamaBaseUrl, healthStatus, selectedModel]);

  // Add helper function to prepare context with embeddings
  const prepareConversationWithContext = useCallback(
    async (
      chatId: number,
      currentMessage: string,
      isRegenerated: boolean
    ): Promise<OllamaChatMessageField[]> => {
      try {
        const context: OllamaChatMessageField[] = [];
        if (!settings.use_memory) {
          return [{
            role: "user",
            content: currentMessage,
          }];
        }
        // Get relevant context using embeddings
        const contextMessages = await apiService.getConversationWithContext(
          chatId,
          10
        );
        if (contextMessages.length === 0) {
          return [{
            role: "user",
            content: currentMessage,
          }];
        };
        // Add system instruction first
        context.push({
          role: "system",
          content:
            "You are provided with relevant excerpts from the conversation history for context purposes only. Your task is to respond ONLY to the user's latest message. Use the historical context to inform your response when relevant, but always prioritize and directly address the user's current request. If the user asks something new or gives a different instruction, respond to that new request - do not be constrained by previous conversation topics.",
        });
        
        // Add context messages after system instruction
        contextMessages.forEach((msg) => {
          context.push({
            role: msg.role,
            content: msg.content,
          });
        });
        // Add the current user message at the end
        if (!isRegenerated) {
          context.push({
            role: "user",
            content: currentMessage,
          });
        }
        return context;
      } catch (error) {
        console.error("Failed to get conversation context:", error);
        // Fallback to empty context with system prompt
        return [
          {
            role: "user",
            content: currentMessage
          },
        ];
      }
    },
    [settings]
  );

  const sendChatMessage = useCallback(
    async (
      conversationContext: { role: string; content: string }[],
      signal: AbortSignal
    ): Promise<Response> => {
      const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: conversationContext,
          stream: true,
        }),
        signal,
      });
      return response;
    },
    [ollamaBaseUrl, selectedModel]
  );

  const handleSendMessage = async () => {
    if (!healthStatus.server && !healthStatus.ollama) {
      return;
    }
    if (!selectedModel) {
      toast.error("No model selected", {
        description: "Please select a model to continue",
        duration: 2000,
      });
      return;
    }
    const userMessage = message.trim();
    if (!userMessage) {
      toast.error("Message is empty", {
        description: "Please enter a message to continue",
        duration: 2000,
      });
      return;
    }
    try {
      setIsLoading(true);
      // Create new chat if none exists
      if (!currentChatId) {
        const title = await apiService.generateChatTitle(userMessage);
        const newChat = await apiService.createChat(title);
        setChats((prev) => [newChat, ...prev]);
        await startConversationSession({
          message,
          uploadedFiles,
          chatId: newChat.id,
          setCurrentChatId,
          setMessages,
          setMessage,
          setUploadedFiles,
          setAbortController,
          prepareConversationWithContext,
          sendChatMessage,
        });
      } else {
        await startConversationSession({
          message,
          uploadedFiles,
          chatId: currentChatId,
          setMessages,
          setMessage,
          setUploadedFiles,
          setAbortController,
          prepareConversationWithContext,
          sendChatMessage,
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Something went wrong", {
        description: "Unable to send the message",
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate response functionality
  const handleRegenerateResponse = useCallback(
    async (message: Message) => {
      console.log("Regenerating response for message:", message);
      if (!currentChatId || isLoading || !message || message.role !== "assistant") return;
      try {
        setIsLoading(true);
        // Start chat process
        await startConversationSession({
          message: message.content,
          regeneratedMessageId: message.id,
          uploadedFiles,
          chatId: currentChatId,
          setMessages,
          setMessage,
          setUploadedFiles,
          setAbortController,
          prepareConversationWithContext,
          sendChatMessage,
        });
        setShouldRegenerateMessage(false);
      } catch (error) {
        console.error("Failed to regenerate message:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentChatId,
      isLoading,
      prepareConversationWithContext,
      sendChatMessage,
      uploadedFiles,
    ]
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop === 0 && hasMoreMessages && currentChatId) {
      loadChatMessages(currentChatId, messageOffset, false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading && message.trim()) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Export chat functionality
  const exportChat = useCallback(() => {
    if (!currentChatId || messages.length === 0) {
      toast.error("No chat to export", {
        description: "Please select a chat with messages to export",
        duration: 2000,
      });
      return;
    }

    const currentChat = chats.find((chat) => chat.id === currentChatId);
    const chatTitle = currentChat?.title || `Chat ${currentChatId}`;
    const timestamp = new Date().toISOString().split("T")[0];

    const markdown = [
      `# ${chatTitle}`,
      `*Exported on ${new Date().toLocaleDateString()}*`,
      `*Model: ${selectedModel}*`,
      "",
      ...messages.map(
        (msg) =>
          `**${msg.role === "user" ? "User" : "Assistant"}:**\n${msg.content}\n`
      ),
    ].join("\n");

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chatTitle
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Chat exported successfully", {
      duration: 2000,
    });
  }, [currentChatId, messages, chats, selectedModel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N for new chat
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        createNewChat();
      }

      // Ctrl/Cmd + E for export (when chat exists)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "e" &&
        currentChatId &&
        messages.length > 0
      ) {
        e.preventDefault();
        exportChat();
      }

      // Escape to cancel generation
      if (e.key === "Escape" && isLoading) {
        handleCancelGeneration();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    createNewChat,
    exportChat,
    currentChatId,
    messages.length,
    isLoading,
    handleCancelGeneration,
  ]);

  // Handle file content from upload
  const handleFileContent = useCallback((files: UploadedFile[]) => {
    // Store files in background state for AI processing
    // The files are handled silently and don't appear in the chat interface
    console.log(
      "Files uploaded for background processing:",
      files.map((f) => f.name)
    );
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={selectChat}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
      />
      <SidebarInset className="flex flex-col h-screen max-w-[100vw] overflow-x-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
          <SidebarTrigger className="-ml-1 cursor-pointer" />
          {/* <Separator orientation="vertical" className="mr-2 h-4" /> */}

          {/* Health Status Indicator */}
          <AppModelStatusIndicator
            healthStatus={healthStatus}
            checkHealth={checkHealth}
          />

          <AppModeDropdown
            modes={getModes(settings?.agentic_mode)}
            currentMode={appMode}
            setAppMode={setAppMode}
          />

          {appErrorLogs.length > 0 && (
            <button
              onClick={() => setIsErrorLogsOpen(true)}
              className="p-2 rounded-md hover:bg-accent transition-colors cursor-pointer"
              title="View error logs"
            >
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </button>
          )}

          <AppErrorAlerts
            errorLogs={appErrorLogs}
            isOpen={isErrorLogsOpen}
            onClose={() => setIsErrorLogsOpen(false)}
          />

          {/* Model Selection Dropdown */}
          <AppModelDropdown
            availableModels={availableModels}
            selectedModel={selectedModel || ""}
            setSelectedModel={setSelectedModel}
            modelsLoading={modelsLoading}
            isLoading={isLoading}
          />
          {/* Export Chat Button */}
          {currentChatId && messages.length > 0 && (
            <>
              <AppModelExportBtn exportChat={exportChat} />
            </>
          )}
        </header>

        <div className="flex flex-1 flex-col min-h-0">
          {/* Chat Messages Area */}
          <AppChatArea
            key={currentChatId}
            messages={messages}
            isLoading={isLoading}
            handleScroll={handleScroll}
            selectedModel={selectedModel}
            onRegenerateResponse={handleRegenerateResponse}
            setShouldRegenerateMessage={setShouldRegenerateMessage}
            shouldRegenerateMessage={shouldRegenerateMessage}
            deleteMessage={(messageId: number) => {
              apiService.deleteMessage(messageId).then(() => {
                setMessages((prev) =>
                  prev.filter((msg) => msg.id !== messageId)
                );
              }).catch((error) => {
                console.error("Failed to delete message:", error);
                toast.error("Something went wrong", {
                  description: "Unable to delete the message",
                  duration: 2000,
                });
              });
            }}
          />

          {/* Input Area */}
          <AppChatInput
            message={message}
            setMessage={setMessage}
            handleKeyPress={handleKeyPress}
            isLoading={isLoading}
            handleCancelGeneration={handleCancelGeneration}
            handleSendMessage={handleSendMessage}
            healthStatus={healthStatus}
            onFileContent={handleFileContent}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
            useMemory={settings?.use_memory}
            selectedModel={selectedModel}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
