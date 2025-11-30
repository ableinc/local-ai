import { toast } from "sonner";
import { apiService, type Message, type OllamaChatMessageField } from "@/services/api";
import type { UploadedFile } from "@/components/app-file-upload";

interface ConversationSessionProps {
  message: string;
  regeneratedMessageId?: number;
  uploadedFiles: UploadedFile[];
  chatId: number | null;
  setCurrentChatId?: React.Dispatch<React.SetStateAction<number | null>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  setUploadedFiles: React.Dispatch<
    React.SetStateAction<UploadedFile[]>
  >;
  setAbortController: React.Dispatch<React.SetStateAction<AbortController | null>>;
  prepareConversationWithContext: (chatId: number, currentMessage: string, isRegenerated: boolean) => Promise<OllamaChatMessageField[]>;
  sendChatMessage: (messages: { role: string; content: string }[], signal: AbortSignal) => Promise<Response>;
}

export async function startConversationSession({
  message,
  regeneratedMessageId,
  uploadedFiles,
  chatId,
  setCurrentChatId,
  setMessages,
  setMessage,
  setUploadedFiles,
  setAbortController,
  prepareConversationWithContext,
  sendChatMessage,
}: ConversationSessionProps): Promise<void> {
  if (typeof chatId !== "number") {
    toast.error("No chat selected", {
      description: "Please select or create a chat to continue",
      duration: 2000,
    });
    return;
  }
  if (setCurrentChatId) {
    setCurrentChatId(chatId);
  }
  // Include file context if there are uploaded files
  let fullMessageWithFileContent;
  if (uploadedFiles.length > 0) {
    // Upload file
    Promise.all(
      uploadedFiles.map((file) =>
        apiService.addFileContent(
          file.content,
          file.name,
          chatId,
          file.type
        )
      )
    )
      .then(() => {
        console.log("Files uploaded successfully");
      })
      .catch((err) => {
        console.error("Error uploading files:", err);
      });
    fullMessageWithFileContent = `${message}\nALSO USE THIS FILE CONTENT AS CONTEXT:\n${uploadedFiles.map(file => file.content).join("\n")}`;
  }

  try {
    if (regeneratedMessageId === undefined) {
      // Add user message to database
      const userDbMessage = await apiService.addMessage(
        chatId,
        "user",
        message,
        false
      );
      setMessages((prev) => [...prev, userDbMessage]);
      setMessage("");
    }
    // Create placeholder for AI message
    const aiDbMessage: Message = await getNewOrExistingAssitantMessage(chatId, regeneratedMessageId);
    if (regeneratedMessageId === undefined) {
      setMessages((prev) => [...prev, aiDbMessage]);
    }
    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Get conversation with memory context (if user enabled) using embeddings
      const conversation = await prepareConversationWithContext(
        chatId,
        fullMessageWithFileContent || message,
        regeneratedMessageId !== undefined
      );

      // Send chat message request to Ollama
      const response = await sendChatMessage(conversation, controller.signal);

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
        accumulatedText,
        false,
        false,
        regeneratedMessageId !== undefined
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
    setAbortController(null);
    setUploadedFiles([]); // Clear uploaded files after sending
  }
}

async function getNewOrExistingAssitantMessage(chatId: number, existingMessageId?: number): Promise<Message> {
  if (existingMessageId !== undefined) {
    const existingMessage: Message = await apiService.getMessageById(existingMessageId);
    return existingMessage;
  }
  const aiDbMessage: Message = await apiService.addMessage(
    chatId,
    "assistant",
    "",
    true
  );
  return aiDbMessage;
}
