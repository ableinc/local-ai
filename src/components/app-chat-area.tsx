import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useRef, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { ChevronDown, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "@/services/api";

// Format timestamp for display
const formatMessageTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

interface AppChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  selectedModel: string | null;
  handleScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onRegenerateResponse?: (messageId: number) => void;
}

export function AppChatArea({
  messages,
  isLoading,
  selectedModel,
  handleScroll,
  onRegenerateResponse,
}: AppChatAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Copy message to clipboard
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard', {
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Auto-scroll to bottom when new messages are added or when content grows
  useEffect(() => {
    if (scrollAreaRef.current && isNearBottom) {
      const scrollElement = scrollAreaRef.current;
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }, 0);
    }
  }, [messages, isNearBottom]);

  // Additional effect to handle content changes during loading (streaming)
  useEffect(() => {
    if (scrollAreaRef.current && isLoading && isNearBottom) {
      const scrollElement = scrollAreaRef.current;
      const scrollToBottom = () => {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      };

      // Create a MutationObserver to watch for content changes
      const observer = new MutationObserver(scrollToBottom);
      observer.observe(scrollElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      return () => observer.disconnect();
    }
  }, [isLoading, isNearBottom]);

  // Show scroll button when there are 5+ messages and user is not near bottom
  useEffect(() => {
    setShowScrollButton(messages.length >= 5 && !isNearBottom);
  }, [messages.length, isNearBottom]);

  const handleScrollWithAutoScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
    setIsNearBottom(isAtBottom);

    // Call the original scroll handler for loading more messages
    handleScroll(event);
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
      setIsNearBottom(true);
    }
  };

  const isCancledMessage = (msg: Message): boolean => {
    if (typeof msg.canceled === "boolean") {
      return msg.canceled;
    }
    return false;
  }

  const isErrorMessage = (msg: Message): boolean => {
    if (typeof msg.errored === "boolean") {
      return msg.errored;
    }
    return false;
  }


  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onScroll={handleScrollWithAutoScroll}
      >
        <div className="flex flex-col w-full max-w-full px-4 pt-5">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Start a conversation...</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`group flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div className="flex flex-col gap-1 max-w-[70%]">
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-code:bg-muted-foreground/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            // Customize links to open in new tab
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-600 underline"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {msg.role === "assistant" &&
                      msg.content === "" &&
                      isLoading && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-current rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}></div>
                          <div
                            className="w-2 h-2 bg-current rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}></div>
                        </div>
                      )}
                  </div>
                  
                  {/* Cancellation indicator */}
                  {isCancledMessage(msg) && (
                    <div className={`text-xs text-muted-foreground italic ${
                      msg.role === "user" ? "text-right" : "text-left"
                    }`}>
                      Request canceled by user
                    </div>
                  )}

                  {/* Error indicator */}
                  {isErrorMessage(msg) && (
                    <div className={`text-xs text-muted-foreground italic ${
                      msg.role === "user" ? "text-right" : "text-left"
                    }`}>
                      Sorry, I encountered an error.
                    </div>
                  )}
                  
                  {/* Action buttons - only show when hovering and message has content */}
                  {msg.content && (
                    <div className={`flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}>
                      <span className="text-xs text-muted-foreground mr-2">
                        {formatMessageTime(msg.created_at)}
                      </span>
                      <Button
                        onClick={() => copyToClipboard(msg.content)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      {msg.role === "assistant" && onRegenerateResponse && (
                        <Button
                          hidden={isLoading || !selectedModel || selectedModel.trim() === ""}
                          onClick={() => onRegenerateResponse(msg.id)}
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Regenerate
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            onClick={scrollToBottom}
            variant="outline"
            size="sm"
            className="rounded-full shadow-lg bg-background border-border hover:bg-accent"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
