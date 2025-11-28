import type { AppSettings } from "@/contexts/AppContextTypes";
import { getApiBaseUrl } from "@/lib/utils";
import type { OllamaModel } from "@/lib/utils";
export interface Chat {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  canceled?: boolean;
  errored?: boolean;
}

export interface ChatMessagesResponse {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

export interface McpServer {
  id: number;
  name: string;
  url: string;
  api_key?: string;
  created_at?: string;
}

const API_BASE_URL = getApiBaseUrl();

class ApiService {
  async getAllChats(): Promise<Chat[]> {
    const response = await fetch(`${API_BASE_URL}/chats`);
    if (!response.ok) throw new Error('Failed to fetch chats');
    return (response.json() as Promise<{ data: Chat[] }>).then(res => res.data);
  }

  async createChat(title: string): Promise<Chat> {
    const response = await fetch(`${API_BASE_URL}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!response.ok) throw new Error('Failed to create chat');
    return (response.json() as Promise<{ data: Chat }>).then(res => res.data);
  }

  async getChatById(id: number): Promise<Chat> {
    const response = await fetch(`${API_BASE_URL}/chats/${id}`);
    if (!response.ok) throw new Error('Failed to fetch chat');
    return (response.json() as Promise<{ data: Chat }>).then(res => res.data);
  }

  async deleteChat(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chats/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete chat');
  }

  async getChatMessages(chatId: number, pageSize: number = 50, page: number = 0): Promise<ChatMessagesResponse> {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages?pageSize=${pageSize}&page=${page}`);
    if (!response.ok) throw new Error('Failed to fetch messages');
    return (response.json() as Promise<{ data: ChatMessagesResponse }>).then(res => res.data);
  }

  async addMessage(chatId: number, role: 'user' | 'assistant', content: string): Promise<Message> {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content })
    });
    if (!response.ok) throw new Error('Failed to add message');
    return (response.json() as Promise<{ data: Message }>).then(res => res.data);
  }

  async updateMessage(messageId: number, content: string, canceled: boolean = false): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, canceled })
    });
    if (!response.ok) throw new Error('Failed to update message');
  }

  async cancelMessageGeneration(messageId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}/cancel`, {
      method: 'PATCH'
    });
    if (!response.ok) throw new Error('Failed to cancel message generation');
  }

  async setMessageAsError(messageId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}/error`, {
      method: 'PATCH'
    });
    if (!response.ok) throw new Error('Failed to mark message as error');
  }

  async deleteMessage(messageId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete message');
  }

  async generateChatTitle(message: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/chats/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!response.ok) throw new Error('Failed to generate chat title');
    return (response.json() as Promise<{ data: { title: string } }>).then(res => res.data.title);
  }

  async generateEmbedding(messageId: number): Promise<number[]> {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}/embedding`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to generate embedding');
    return (response.json() as Promise<{ data: number[] }>).then(res => res.data);
  }

  async getConversationContext(
    chatId: number, 
    message: string, 
    recentCount: number = 5, 
    similarCount: number = 3
  ): Promise<Message[]> {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, recentCount, similarCount })
    });
    if (!response.ok) throw new Error('Failed to get conversation context');
    return (response.json() as Promise<{ context: Message[] }>).then(res => res.context);
  }

  async getTags(): Promise<OllamaModel[]> {
    const response = await fetch(`${API_BASE_URL}/tags`);
    if (!response.ok) throw new Error('Failed to fetch tags');
    return (response.json() as Promise<{ data: OllamaModel[] }>).then(res => res.data);
  }

  async checkHealth(): Promise<{ server: boolean, ollama: boolean, timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to check health');
    return (response.json() as Promise<{ data: {server: boolean, ollama: boolean, timestamp: string } }>).then(res => res.data);
  }

  async getAppSettings(): Promise<AppSettings> {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch app settings');
    return (response.json() as Promise<{ data: AppSettings }>).then(res => res.data);
  }

  async saveAppSettings(newSettings: AppSettings): Promise<AppSettings> {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    if (!response.ok) throw new Error('Failed to save app settings');
    return (response.json() as Promise<{ data: AppSettings }>).then(res => res.data);
  }

  async getMcpServers(): Promise<McpServer[]> {
    const response = await fetch(`${API_BASE_URL}/mcp-servers`);
    if (!response.ok) throw new Error('Failed to fetch MCP servers');
    return (response.json() as Promise<{ data: McpServer[] }>).then(res => res.data);
  }

  async addMcpServer(body: McpServer): Promise<McpServer> {
    const response = await fetch(`${API_BASE_URL}/mcp-servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to add MCP server');
    return (response.json() as Promise<{ data: McpServer }>).then(res => res.data);
  }

  async deleteMcpServer(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/mcp-servers/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete MCP server');
  }
}

export const apiService = new ApiService();
