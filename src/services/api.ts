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
}

export interface ChatMessagesResponse {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

class ApiService {
  async getAllChats(): Promise<Chat[]> {
    const response = await fetch(`${API_BASE}/chats`);
    if (!response.ok) throw new Error('Failed to fetch chats');
    return response.json();
  }

  async createChat(title: string): Promise<Chat> {
    const response = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!response.ok) throw new Error('Failed to create chat');
    return response.json();
  }

  async getChatById(id: number): Promise<Chat> {
    const response = await fetch(`${API_BASE}/chats/${id}`);
    if (!response.ok) throw new Error('Failed to fetch chat');
    return response.json();
  }

  async deleteChat(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/chats/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete chat');
  }

  async getChatMessages(chatId: number, limit: number = 50, offset: number = 0): Promise<ChatMessagesResponse> {
    const response = await fetch(`${API_BASE}/chats/${chatId}/messages?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to fetch messages');
    return response.json();
  }

  async addMessage(chatId: number, role: 'user' | 'assistant', content: string): Promise<Message> {
    const response = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content })
    });
    if (!response.ok) throw new Error('Failed to add message');
    return response.json();
  }

  async updateMessage(messageId: number, content: string): Promise<void> {
    const response = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!response.ok) throw new Error('Failed to update message');
  }

  async deleteMessage(messageId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete message');
  }

  generateChatTitle(firstMessage: string): string {
    return firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...' 
      : firstMessage;
  }
}

export const apiService = new ApiService();
