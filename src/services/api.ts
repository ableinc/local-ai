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
    return response.json();
  }

  async createChat(title: string): Promise<Chat> {
    const response = await fetch(`${API_BASE_URL}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!response.ok) throw new Error('Failed to create chat');
    return response.json();
  }

  async getChatById(id: number): Promise<Chat> {
    const response = await fetch(`${API_BASE_URL}/chats/${id}`);
    if (!response.ok) throw new Error('Failed to fetch chat');
    return response.json();
  }

  async deleteChat(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chats/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete chat');
  }

  async getChatMessages(chatId: number, limit: number = 50, offset: number = 0): Promise<ChatMessagesResponse> {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to fetch messages');
    return response.json();
  }

  async addMessage(chatId: number, role: 'user' | 'assistant', content: string): Promise<Message> {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content })
    });
    if (!response.ok) throw new Error('Failed to add message');
    return response.json();
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

  generateChatTitle(firstMessage: string): string {
    return firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...' 
      : firstMessage;
  }

  async generateEmbedding(messageId: number): Promise<number[]> {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}/embedding`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to generate embedding');
    const data = await response.json();
    return data.embedding;
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
    const data = await response.json();
    return data.contextMessages;
  }

  async getTags(): Promise<OllamaModel[]> {
    const response = await fetch(`${API_BASE_URL}/tags`);
    if (!response.ok) throw new Error('Failed to fetch tags');
    return response.json();
  }

  async checkHealth(): Promise<{ server: boolean, ollama: boolean }> {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to check health');
    return response.json();
  }

  async getAppSettings(): Promise<AppSettings> {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch app settings');
    return response.json();
  }

  async saveAppSettings(newSettings: AppSettings): Promise<AppSettings> {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    if (!response.ok) throw new Error('Failed to save app settings');
    return response.json();
  }

  async getMcpServers(): Promise<McpServer[]> {
    const response = await fetch(`${API_BASE_URL}/mcp-servers`);
    if (!response.ok) throw new Error('Failed to fetch MCP servers');
    return response.json();
  }

  async addMcpServer(body: McpServer): Promise<McpServer> {
    const response = await fetch(`${API_BASE_URL}/mcp-servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to add MCP server');
    return response.json();
  }

  async deleteMcpServer(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/mcp-servers/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete MCP server');
  }
}

export const apiService = new ApiService();
