import { toast } from "sonner";
import { apiService, type Message } from "@/services/api";
import type { UploadedFile } from "@/components/app-file-upload";

interface ConversationSessionProps {
  message: string;
  regeneratedMessageId?: number;
  uploadedFiles: UploadedFile[];
  chatId: number | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  setUploadedFiles: React.Dispatch<
    React.SetStateAction<UploadedFile[]>
  >;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setAbortController: React.Dispatch<React.SetStateAction<AbortController | null>>;
  prepareConversationContext: (chatId: number, currentMessage: string) => Promise<{
    role: string;
    content: string;
  }[]>;
  sendChatMessage: (messages: { role: string; content: string }[], signal: AbortSignal) => Promise<Response>;
  shouldRegenerateMessage: boolean;
}

export async function startConversationSession({
  message,
  regeneratedMessageId,
  uploadedFiles,
  chatId,
  setMessages,
  setMessage,
  setUploadedFiles,
  setIsLoading,
  setAbortController,
  prepareConversationContext,
  sendChatMessage,
  shouldRegenerateMessage,
}: ConversationSessionProps): Promise<void> {
  if (typeof chatId !== "number") {
    toast.error("No chat selected", {
      description: "Please select or create a chat to continue",
      duration: 2000,
    });
    return;
  }
  setIsLoading(true);
  // Include file context if there are uploaded files
  let fullMessageWithFileContent;
  if (uploadedFiles.length > 0) {
    const fileContext = uploadedFiles
      .map((file) => {
        return `File: ${file.name} (${file.type})\nContent: ${file.content}`;
      })
      .join("\n\n");

    fullMessageWithFileContent = `${message}\n\n--- Attached Files ---\n${fileContext}`;
  }

  try {
    if (!shouldRegenerateMessage) {
      // Add user message to database
      const userDbMessage = await apiService.addMessage(
        chatId,
        "user",
        message
      );
      setMessages((prev) => [...prev, userDbMessage]);
      setMessage("");

      // Generate embedding for the user message in the background
      apiService
        .generateEmbedding(userDbMessage.id)
        .catch((err) => console.error("Failed to generate embedding:", err));
    }
    let aiDbMessage: Message;
    if (!shouldRegenerateMessage) {
      // Create AI response placeholder in database
      aiDbMessage = await apiService.addMessage(
        chatId,
        "assistant",
        ""
      );
      setMessages((prev) => [...prev, aiDbMessage]);
    } else {
      aiDbMessage = {
        id: regeneratedMessageId!,
        chat_id: chatId,
        role: "assistant",
        content: message,
        created_at: "",
      } as Message;
    }

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Get conversation context using embeddings
      const conversationContext = await prepareConversationContext(
        chatId,
        message
      );
      console.log('Is regeneration message:', shouldRegenerateMessage);
      console.log('--- Conversation Context ---');
      console.log(conversationContext);
      console.log('----------------------------');
      
      // Add the current user message with file context
      conversationContext.push({
        role: shouldRegenerateMessage ? "assistant" : "user",
        content: fullMessageWithFileContent || message,
      });
      // Send chat message request to Ollama
      const response = await sendChatMessage(conversationContext, controller.signal);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check if body exists and is readable
      if (!response.body) {
        throw new Error("Response body is not available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode the chunk with stream option for proper handling in Electron
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message && data.message.content) {
              accumulatedText += data.message.content;

              // Update the AI message in the local state
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiDbMessage.id
                    ? { ...msg, content: accumulatedText }
                    : msg
                )
              );
            }
          } catch (parseError) {
            console.warn("Failed to parse JSON line:", line, parseError);
          }
        }
      }

      // Update the AI message in the database
      await apiService.updateMessage(
        aiDbMessage.id,
        accumulatedText
      );

      // Generate embedding for the AI response in the background
      apiService
        .generateEmbedding(aiDbMessage.id)
        .catch((err) =>
          console.error("Failed to generate embedding:", err)
        );
    } catch (ollamaError) {
      console.error("Error calling Ollama:", ollamaError);

      // Check if the error is due to abort
      if (
        ollamaError instanceof Error &&
        ollamaError.name === "AbortError"
      ) {
        // Request was cancelled, mark the message as canceled for display purposes
        // The accumulated text is already saved in the database
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiDbMessage.id
              ? { ...msg, canceled: true }
              : msg
          )
        );
        await apiService.cancelMessageGeneration(aiDbMessage.id);
      } else {
        // Other error, show error message
        await apiService.setMessageAsError(aiDbMessage.id);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiDbMessage.id
              ? { ...msg, errored: true }
              : msg
          )
        );
      }
    }
  } catch (error) {
    console.error("Error in startConversationSession:", error);
    toast.error("Something went wrong", {
      description: "Unable to send the message",
      duration: 2000,
    });
  } finally {
    setIsLoading(false);
    setAbortController(null);
    setUploadedFiles([]); // Clear uploaded files after sending
  }
}
