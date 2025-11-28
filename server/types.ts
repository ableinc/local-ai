export interface Chat {
  id: number | bigint;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number | bigint;
  chat_id: number | bigint;
  role: 'user' | 'assistant';
  content: string;
  canceled: boolean | number;
  errored: boolean | number;
  created_at: string;
}

export interface MessageEmbeddingDB {
  id: number | bigint;
  message_id: number | bigint;
  embedding: string;
  created_at: string;
}

export interface MessageEmbedding {
  id: number | bigint;
  message_id: number | bigint;
  embedding: number[];
  created_at: string;
}

export interface AppSetting {
  id: number | bigint;
  title: string;
  toggle: boolean | number;
  disabled: boolean | number;
  created_at: string;
}

export interface McpServer {
  id: number | bigint;
  name: string;
  url: string;
  api_key?: string;
  created_at?: string;
}

export interface FileUpload {
  id: number | bigint;
  chat_id: number | bigint;
  filename: string;
  type: string;
  content: string;
  created_at: string;
}

export interface MessageWithEmbedding {
  id: number | bigint;
  role: 'user' | 'assistant';
  content: string;
  embedding: number[];
}

export interface MessageWithEmbeddingDB {
  id: number | bigint;
  role: 'user' | 'assistant';
  content: string;
  embedding: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: Record<string, string | number | string[]>;
}

export interface OllamaTags {
  models: Array<OllamaModel>;
}

export interface ErrorLog {
  id: number | bigint;
  error_message: string;
  stack_trace: string;
  has_embedding_model: boolean | number;
  has_summary_model: boolean | number;
  created_at: string;
}
