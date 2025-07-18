import { useState, useEffect, useCallback } from 'react'
import { SidebarProvider, SidebarTrigger, SidebarInset } from "./components/ui/sidebar"
import { AppSidebar } from "./components/app-sidebar"
import { AppChatInput } from './components/app-chat-input';
import { AppChatArea } from './components/app-chat-area';
import { AppModelDropdown } from './components/app-model-dropdown';
import { AppModelExportBtn } from './components/app-model-export-btn';
import { Separator } from "./components/ui/separator"
import { apiService, type Chat, type Message } from './services/api'
import { useApp } from './hooks/useApp'
import type { UploadedFile } from './components/app-file-upload'
import 'highlight.js/styles/github-dark.css'
import './App.css'
import { AppModelStatusIndicator } from './components/app-model-status-indicator';
import { toast } from 'sonner';

interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
}

function App() {
  const { healthStatus, checkHealth, settings } = useApp()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<number | null>(null)
  const [messageOffset, setMessageOffset] = useState(0)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const ollamaBaseUrl = import.meta.env.VITE_OLLAMA_BASE_URL;
  const appName = import.meta.env.VITE_APP_NAME;

  // Load chats on component mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        const allChats = await apiService.getAllChats()
        setChats(allChats)
      } catch (error) {
        console.error('Failed to load chats:', error)
      }
    }
    loadChats()
  }, [])

  const loadChatMessages = useCallback(async (chatId: number, offset: number = 0, reset: boolean = false) => {
    try {
      const response = await apiService.getChatMessages(chatId, 50, offset)
      
      if (reset) {
        setMessages(response.messages)
        setMessageOffset(response.messages.length)
      } else {
        setMessages(prev => [...response.messages, ...prev])
        setMessageOffset(prev => prev + response.messages.length)
      }
      
      setHasMoreMessages(response.hasMore)
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }, [])

  // Load messages when current chat changes
  useEffect(() => {
    if (currentChatId) {
      loadChatMessages(currentChatId, 0, true)
    } else {
      setMessages([])
      setMessageOffset(0)
      setHasMoreMessages(false)
    }
  }, [currentChatId, loadChatMessages])

  const createNewChat = useCallback(() => {
    setCurrentChatId(null)
    setMessages([])
    setMessageOffset(0)
    setHasMoreMessages(false)
    setUploadedFiles([])
  }, [])

  const selectChat = useCallback((chatId: number) => {
    setCurrentChatId(chatId)
  }, [])

  const deleteChat = useCallback(async (chatId: number) => {
    try {
      await apiService.deleteChat(chatId)
      
      // Remove the chat from the local state
      setChats(prev => prev.filter(chat => chat.id !== chatId))
      
      // If the deleted chat was the current chat, clear the current chat
      if (currentChatId === chatId) {
        setCurrentChatId(null)
        setMessages([])
        setMessageOffset(0)
        setHasMoreMessages(false)
      }
    } catch (error) {
      console.error('Failed to delete chat:', error)
      toast.error('Something went wrong', {
        description: 'Unable to delete the chat',
        duration: 5000,
      })
    }
  }, [currentChatId])

  const handleCancelGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setIsLoading(false)
    }
    toast.info('Canceled', {
      description: 'Canceled the current generation',
      duration: 5000,
    })
  }, [abortController])

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        if (response.ok) {
          const data = await response.json()
          data.models = Array.isArray(data.models) ? data.models.filter((model: OllamaModel) => !model.name.includes('nomic-embed')) : [];
          // Set the first model as default if assistant is not available
          if (data.models.length > 0) {
            for (const model of data.models) {
              if (model.name.includes('assistant')) {
                setSelectedModel(model.name)
                break
              }
            }
            if (!selectedModel) {
              // If no assistant model is selected, default to the first model
              setSelectedModel(data.models[0].name)
            }
          }
          setAvailableModels(data.models || [])
        }
      } catch (error) {
        console.error('Failed to fetch models:', error)
        toast.error('Something went wrong', {
          description: 'Unable to get models',
          duration: 5000,
        })
      } finally {
        setModelsLoading(false)
      }
    }

    fetchModels()
  }, [ollamaBaseUrl, healthStatus, selectedModel])

  // Add helper function to prepare context with embeddings
  const prepareConversationContext = async (
    chatId: number, 
    currentMessage: string
  ): Promise<Array<{role: string, content: string}>> => {
    try {
      const context: Array<{role: string, content: string}> = [];
      if (!settings.use_memory) {
        return context;
      }
      // Get relevant context using embeddings
      const contextMessages = await apiService.getConversationContext(
        chatId, 
        currentMessage,
        5, // Get 5 most recent messages
        3  // Get 3 most similar messages
      );
      // Add context messages
      contextMessages.forEach(msg => {
        context.push({
          role: msg.role,
          content: msg.content
        });
      });
      context.push({
        role: 'system',
        content: 'You have some of our past conversation. Use the past conversation context ONLY WHEN IT IS RELEVANT to what the user is saying. If the user gives you a new command you MUST OBEY that directly.'
      });
      
      return context;
    } catch (error) {
      console.error('Failed to get conversation context:', error);
      // Fallback to empty context with system prompt
      return [{
        role: 'system',
        content: 'You are a helpful AI assistant.'
      }];
    }
  };

  const handleSendMessage = async () => {
    if (!healthStatus.server && !healthStatus.ollama) {
      return;
    }
    if (!selectedModel) {
      toast.error('No model selected', {
        description: 'Please select a model to continue',
        duration: 5000,
      });
      return;
    };
    if (message.trim() && !isLoading) {
      const userMessage = message.trim()
      
      // Include file context if there are uploaded files
      let fullUserMessage = userMessage;
      if (uploadedFiles.length > 0) {
        const fileContext = uploadedFiles.map(file => {
          return `File: ${file.name} (${file.type})\nContent: ${file.content}`;
        }).join('\n\n');
        
        fullUserMessage = `${userMessage}\n\n--- Attached Files ---\n${fileContext}`;
      }
      
      try {
        // Create new chat if none exists
        let chatId = currentChatId
        if (!chatId) {
          const title = apiService.generateChatTitle(userMessage)
          const newChat = await apiService.createChat(title)
          chatId = newChat.id
          setCurrentChatId(chatId)
          setChats(prev => [newChat, ...prev])
        }
        
        // Add user message to database (only the visible message, not file content)
        const userDbMessage = await apiService.addMessage(chatId, 'user', userMessage)
        setMessages(prev => [...prev, userDbMessage])
        setMessage('')
        setUploadedFiles([]) // Clear uploaded files after sending
        setIsLoading(true)

        // Generate embedding for the user message in the background
        apiService.generateEmbedding(userDbMessage.id).catch(err => 
          console.error('Failed to generate embedding:', err)
        );

        // Create AI response placeholder in database
        const aiDbMessage = await apiService.addMessage(chatId, 'assistant', '')
        setMessages(prev => [...prev, aiDbMessage])

        // Create abort controller for this request
        const controller = new AbortController()
        setAbortController(controller)

        try {
          // Get conversation context using embeddings
          const conversationContext = await prepareConversationContext(chatId, userMessage);
          
          // Add the current user message with file context
          conversationContext.push({
            role: 'user',
            content: fullUserMessage
          });

          const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: conversationContext,
              stream: true
            }),
            signal: controller.signal
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No reader available')
          }

          let accumulatedText = ''
          
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) break
            
            const chunk = new TextDecoder().decode(value)
            const lines = chunk.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line)
                if (data.message && data.message.content) {
                  accumulatedText += data.message.content
                  
                  // Update the AI message in the database and local state
                  await apiService.updateMessage(aiDbMessage.id, accumulatedText)
                  
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === aiDbMessage.id 
                        ? { ...msg, content: accumulatedText }
                        : msg
                    )
                  )
                }
              } catch (parseError) {
                console.warn('Failed to parse JSON line:', line, parseError)
              }
            }
          }

          // Generate embedding for the AI response in the background
          apiService.generateEmbedding(aiDbMessage.id).catch(err => 
            console.error('Failed to generate embedding:', err)
          );
        } catch (ollamaError) {
          console.error('Error calling Ollama:', ollamaError)
          
          // Check if the error is due to abort
          if (ollamaError instanceof Error && ollamaError.name === 'AbortError') {
            // Request was cancelled, update AI message to indicate cancellation
            const cancelledMessage = 'Request cancelled by user.'
            await apiService.updateMessage(aiDbMessage.id, cancelledMessage)
            
            setMessages(prev => 
              prev.map(msg => 
                msg.id === aiDbMessage.id 
                  ? { ...msg, content: cancelledMessage }
                  : msg
              )
            )
          } else {
            // Other error, show error message
            const errorMessage = 'Sorry, I encountered an error. Please make sure Ollama is running locally on port 11434.'
            await apiService.updateMessage(aiDbMessage.id, errorMessage)
            
            setMessages(prev => 
              prev.map(msg => 
                msg.id === aiDbMessage.id 
                  ? { ...msg, content: errorMessage }
                  : msg
              )
            )
          }
        }
      } catch (error) {
        console.error('Error in handleSendMessage:', error)
        toast.error('Something went wrong', {
          description: 'Unable to send the message',
          duration: 5000,
        })
      } finally {
        setIsLoading(false)
        setAbortController(null)
      }
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget
    if (scrollTop === 0 && hasMoreMessages && currentChatId) {
      loadChatMessages(currentChatId, messageOffset, false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && message.trim()) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Export chat functionality
  const exportChat = useCallback(() => {
    if (!currentChatId || messages.length === 0) {
      toast.error('No chat to export', {
        description: 'Please select a chat with messages to export',
        duration: 3000,
      });
      return;
    }

    const currentChat = chats.find(chat => chat.id === currentChatId);
    const chatTitle = currentChat?.title || `Chat ${currentChatId}`;
    const timestamp = new Date().toISOString().split('T')[0];
    
    const markdown = [
      `# ${chatTitle}`,
      `*Exported on ${new Date().toLocaleDateString()}*`,
      `*Model: ${selectedModel}*`,
      '',
      ...messages.map(msg => 
        `**${msg.role === 'user' ? 'User' : 'Assistant'}:**\n${msg.content}\n`
      )
    ].join('\n');
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chatTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Chat exported successfully', {
      duration: 3000,
    });
  }, [currentChatId, messages, chats, selectedModel]);

  // Regenerate response functionality
  const handleRegenerateResponse = useCallback(async (messageId: number) => {
    if (!currentChatId || isLoading) return;
    
    // Find the message to regenerate and the user message before it
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex <= 0) return;
    
    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;
    
    try {
      setIsLoading(true);
      
      // Remove all messages after the user message
      const messagesToKeep = messages.slice(0, messageIndex);
      setMessages(messagesToKeep);
      
      // Delete the AI response from database
      await apiService.deleteMessage(messageId);
      
      // Create new AI response
      const aiDbMessage = await apiService.addMessage(currentChatId, 'assistant', '');
      setMessages(prev => [...prev, aiDbMessage]);
      
      // Create abort controller for this request
      const controller = new AbortController();
      setAbortController(controller);
      
      // Get conversation context using embeddings
      const conversationContext = await prepareConversationContext(
        currentChatId, 
        userMessage.content
      );
      
      // Add the user message
      conversationContext.push({
        role: 'user',
        content: userMessage.content
      });
      
      // Generate new response with context
      const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: conversationContext,
          stream: true
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      let accumulatedText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message && data.message.content) {
              accumulatedText += data.message.content;
              
              await apiService.updateMessage(aiDbMessage.id, accumulatedText);
              
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === aiDbMessage.id 
                    ? { ...msg, content: accumulatedText }
                    : msg
                )
              );
            }
          } catch (parseError) {
            console.warn('Failed to parse JSON line:', line, parseError);
          }
        }
      }

      // Generate embedding for the new response
      apiService.generateEmbedding(aiDbMessage.id).catch(err => 
        console.error('Failed to generate embedding:', err)
      );
      
      toast.success('Response regenerated', {
        duration: 3000,
      });
      
    } catch (error) {
      console.error('Error regenerating response:', error);
      toast.error('Failed to regenerate response', {
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  }, [currentChatId, messages, isLoading, selectedModel, ollamaBaseUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N for new chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewChat();
      }
      
      // Ctrl/Cmd + E for export (when chat exists)
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && currentChatId && messages.length > 0) {
        e.preventDefault();
        exportChat();
      }
      
      // Escape to cancel generation
      if (e.key === 'Escape' && isLoading) {
        handleCancelGeneration();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [createNewChat, exportChat, currentChatId, messages.length, isLoading, handleCancelGeneration])

  // Handle file content from upload
  const handleFileContent = useCallback((files: UploadedFile[]) => {
    // Store files in background state for AI processing
    // The files are handled silently and don't appear in the chat interface
    console.log('Files uploaded for background processing:', files.map(f => f.name));
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
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1
            className="font-semibold leading-tight"
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 3.5rem)',
              width: '20%',
              maxWidth: 'min(100vw, 100%)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {appName}
          </h1>
          <Separator orientation="vertical" className="mx-2 h-4" />
          
          {/* Health Status Indicator */}
          <AppModelStatusIndicator
            healthStatus={healthStatus}
            checkHealth={checkHealth}
            />

          {/* Model Selection Dropdown */}
          <AppModelDropdown 
            availableModels={availableModels} 
            selectedModel={selectedModel || ''} 
            setSelectedModel={setSelectedModel} 
            modelsLoading={modelsLoading} 
            isLoading={isLoading}
          />
          {/* Export Chat Button */}
          {currentChatId && messages.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
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
            onRegenerateResponse={handleRegenerateResponse}
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
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
