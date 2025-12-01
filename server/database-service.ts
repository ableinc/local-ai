import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import type { Chat, Message, MessageEmbedding, MessageEmbeddingDB, MessageWithEmbedding, MessageWithEmbeddingDB, AppSetting, McpServer, FileUpload, ErrorLog } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseService {
  db: Database.Database | null;
  userDataPath: string;
  isDev: boolean;
  electronBetterSqlite3Path: string;
  sqliteBinaryPath: string;

  constructor() {
    // Get the app data directory
    this.userDataPath = process.env.ELECTRON_APP_DATA_PATH || __dirname;
    this.isDev = (process as unknown as { resourcesPath: string }).resourcesPath === undefined;
    this.db = null;
    this.electronBetterSqlite3Path = process.env.BETTER_SQLITE3_PATH || '';
    this.sqliteBinaryPath = join(this.userDataPath, 'better_sqlite3.node');
  }

  init(): void {
    // Ensure the directory exists
    try {
      mkdirSync(this.userDataPath, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        console.error('Failed to create database directory:', error);
      }
    }
    
    // Initialize database in the app data directory
    const dbPath = join(this.userDataPath, 'chats.db');
    console.log('Database path:', dbPath);
    
    try {
      // Move sqlite binary if it doesn't exist
      if (!existsSync(this.sqliteBinaryPath) && !this.isDev) {
        copyFileSync(this.electronBetterSqlite3Path, this.sqliteBinaryPath);
        console.log('Copied better_sqlite3.node to:', this.sqliteBinaryPath);
      }
      this.db = new Database(dbPath, this.isDev ? {} : {
        nativeBinding: this.sqliteBinaryPath
      });
      
      // Enable foreign keys and cascade deletes (not enabled by default in SQLite)
      this.db.pragma('foreign_keys = ON');
      
      // Performance optimizations
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
      this.db.pragma('synchronous = NORMAL'); // Balance between safety and performance
      this.db.pragma('cache_size = -64000'); // 64MB cache (negative means KB)
      this.db.pragma('temp_store = MEMORY'); // Store temp tables in memory
      this.db.pragma('mmap_size = 30000000000'); // 30GB memory-mapped I/O
      this.db.pragma('page_size = 4096'); // Optimal page size for most systems
      this.db.pragma('auto_vacuum = INCREMENTAL'); // Automatic database size management
      
      this.runMigrations();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');
    // Create chats table
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        canceled BOOLEAN NOT NULL DEFAULT 0,
        errored BOOLEAN NOT NULL DEFAULT 0,
        regenerated BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
      )
    `);

    // Create embeddings table
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS message_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        embedding TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `);
    
    // Create app settings table
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        toggle BOOLEAN NOT NULL,
        disabled BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Create MCP servers table
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        api_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Create file uploads table
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS file_uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
      )
    `);
    // Create error logs table
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        has_embedding_model BOOLEAN NOT NULL,
        has_summary_model BOOLEAN NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Insert default app settings if they don't exist
    this.db?.exec(`
      INSERT OR IGNORE INTO app_settings (title, toggle, disabled) VALUES
      ('use_memory', 1, 0);
      INSERT OR IGNORE INTO app_settings (title, toggle, disabled) VALUES
      ('agentic_mode', 0, 0);
    `);
    // Alter tables for new columns if they don't exist
    // Add new columns if they do not exist (SQLite lacks IF NOT EXISTS for ADD COLUMN)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageCols = this.db.prepare(`PRAGMA table_info(messages)`).all().map((c: any) => c.name);
    if (!messageCols.includes('regenerated')) {
      this.db.exec(`ALTER TABLE messages ADD COLUMN regenerated BOOLEAN NOT NULL DEFAULT 0;`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appSettingCols = this.db.prepare(`PRAGMA table_info(app_settings)`).all().map((c: any) => c.name);
    if (!appSettingCols.includes('disabled')) {
      this.db.exec(`ALTER TABLE app_settings ADD COLUMN disabled BOOLEAN NOT NULL DEFAULT 0;`);
    }
    // Create indexes for better performance
    this.db?.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
      CREATE INDEX IF NOT EXISTS idx_message_embeddings_message_id ON message_embeddings (message_id);
      CREATE INDEX IF NOT EXISTS idx_app_settings_title ON app_settings (title);
    `);
  }

  // Chat operations
  createChat(title: string): Chat | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT INTO chats (title) VALUES (?)
    `);
    const result: Database.RunResult = stmt.run(title);
    return this.getChatById(result.lastInsertRowid);
  }

  getAllChats(): Chat[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM chats 
      ORDER BY updated_at DESC
    `);
    return stmt.all() as Chat[];
  }

  getChatById(id: number | bigint): Chat | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM chats WHERE id = ?
    `);
    return stmt.get(id) as Chat;
  }

  updateChatTimestamp(chatId: number | bigint): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(chatId);
    return result.changes;
  }

  deleteChat(id: number | bigint): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      DELETE FROM chats WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(id);
    return result.changes;
  }

  // Message operations
  addMessage(chatId: number | bigint, role: string, content: string): Message | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)
    `);
    const result: Database.RunResult = stmt.run(chatId, role, content);
    // Update chat timestamp
    this.updateChatTimestamp(chatId);
    return this.getMessageById(result.lastInsertRowid);
  }

  getMessageById(id: number | bigint): Message | null{
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `);
    return stmt.get(id) as Message;
  }

  getChatMessages(chatId: number | bigint, limit = 50, offset = 0, order: 'ASC' | 'DESC' = 'ASC'): Message[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE chat_id = ? AND content != ''
      ORDER BY created_at ${order} 
      LIMIT ? OFFSET ?
    `);
    const result = stmt.all(chatId, limit, offset) as Message[];
    return result.map(message => ({
      ...message,
      canceled: message.canceled === 1,
      errored: message.errored === 1
    }));
  }

  getChatMessageCount(chatId: number | bigint): number | bigint {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE chat_id = ?
    `);
    const result = stmt.get(chatId) as {count: number | bigint};
    return result.count;
  }

  updateMessage(id: number | bigint, content: string, canceled = false, errored = false, regenerated = false): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      UPDATE messages SET content = ?, canceled = ?, errored = ?, regenerated = ? WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(content, canceled ? 1 : 0, errored ? 1 : 0, regenerated ? 1 : 0, id);
    return result.changes;
  }

  cancelMessage(id: number | bigint): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      UPDATE messages SET canceled = ? WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(1, id);
    return result.changes;
  }

  errorMessage(id: number | bigint): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      UPDATE messages SET errored = ? WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(1, id);
    return result.changes;
  }

  deleteMessage(id: number | bigint): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      DELETE FROM messages WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(id);
    return result.changes;
  }

  // Generate chat title from first user message
  generateChatTitleFallback(message: string): string {
    // Take first 50 characters and add ellipsis if longer
    const title = message.length > 50 
      ? message.substring(0, 50) + '...' 
      : message;
    return title;
  }

  // Embedding operations
  saveEmbedding(messageId: number | bigint, embedding: number[]): number | bigint {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO message_embeddings (message_id, embedding) 
      VALUES (?, ?)
    `);
    const result: Database.RunResult = stmt.run(messageId, JSON.stringify(embedding));
    return result.lastInsertRowid;
  }

  getEmbedding(messageId: number | bigint): MessageEmbedding | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT embedding FROM message_embeddings WHERE message_id = ?
    `);
    const result = stmt.get(messageId) as MessageEmbeddingDB;
    if (!result) return null;
    const embedding: number[] = JSON.parse(result.embedding);
    return {
      id: result.id,
      message_id: messageId,
      embedding,
      created_at: result.created_at
    }
  }

  // Get messages with embeddings for similarity search
  private getMessagesWithEmbeddings(chatId: number | bigint, limit = 5, order: 'ASC' | 'DESC' = 'DESC'): MessageWithEmbedding[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT m.id, m.role, m.content, me.embedding
      FROM messages m
      JOIN message_embeddings me ON m.id = me.message_id
      WHERE m.chat_id = ?
      ORDER BY m.created_at ${order}
      LIMIT ${limit} OFFSET 0
    `);
    
    const messages = stmt.all(chatId) as MessageWithEmbeddingDB[];
    return messages.map(msg => ({
      ...msg,
      embedding: JSON.parse(msg.embedding) as number[]
    }));
  }

  getAppSettings(): AppSetting[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT title, toggle
      FROM app_settings
      WHERE disabled = 0
    `);
    const result = stmt.all() as AppSetting[];
    return result.map(setting => ({
      ...setting,
      toggle: setting.toggle === 1
    }));
  }

  updateAppSettings(newAppSettings: AppSetting): number {
    if (!this.db) throw new Error('Database not initialized');
    const entries = Object.entries(newAppSettings);
    if (entries.length === 0) return 0;
    const placeholders = entries.map(() => '(?, ?)').join(', ');
    const values = entries.flatMap(([key, value]) => [key, value === true ? 1 : 0]);
    const sql = `INSERT OR REPLACE INTO app_settings (title, toggle) VALUES ${placeholders}`;
    const stmt = this.db.prepare(sql);
    const result: Database.RunResult = stmt.run(...values);
    return result.changes;
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }

  // Get similar messages using cosine similarity
  getSimilarMessages(chatId: number | bigint, queryEmbedding: number[], limit: number, topK = 5): {
      id: number | bigint;
      role: "user" | "assistant" | "system";
      content: string;
      similarity: number;
  }[] {
    const messagesWithEmbeddings = this.getMessagesWithEmbeddings(chatId, limit);
    
    // Calculate cosine similarity for each message
    const similarities = messagesWithEmbeddings.map(msg => {
      const similarity = this.cosineSimilarity(queryEmbedding, msg.embedding);
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        similarity
      };
    });
    
    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // MCP Servers operations
  addMCPServer(name: string, url: string, apiKey?: string): McpServer | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT INTO mcp_servers (name, url, api_key) VALUES (?, ?, ?)
    `);
    const result: Database.RunResult = stmt.run(name, url, apiKey);
    return this.getMCPServerById(result.lastInsertRowid);
  }

  getMCPServerById(id: number | bigint): McpServer | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM mcp_servers WHERE id = ?
    `);
    return stmt.get(id) as McpServer;
  }

  getMCPServers(): McpServer[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM mcp_servers ORDER BY created_at DESC
    `);
    return stmt.all() as McpServer[];
  }

  updateMCPServer(id: number | bigint, name: string, url: string, apiKey?: string): number | bigint {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      UPDATE mcp_servers SET name = ?, url = ?, api_key = ? WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(name, url, apiKey, id);
    return result.changes
  }

  deleteMCPServer(id: number | bigint): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      DELETE FROM mcp_servers WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(id);
    return result.changes;
  }

  addFileUpload(chatId: number | bigint, filename: string, type: string, content: string): FileUpload | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT INTO file_uploads (chat_id, filename, type, content) 
      VALUES (?, ?, ?, ?)
    `);
    const result: Database.RunResult = stmt.run(chatId, filename, type, content);
    return this.getFileUploadById(result.lastInsertRowid);
  }

  getFileUploadById(id: number | bigint): FileUpload | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM file_uploads WHERE id = ?
    `);
    return stmt.get(id) as FileUpload;
  }

  getFileUploadsByChatId(chatId: number | bigint): FileUpload[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM file_uploads WHERE chat_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(chatId) as FileUpload[];
  }

  deleteFileUpload(id: number | bigint): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      DELETE FROM file_uploads WHERE id = ?
    `);
    const result: Database.RunResult = stmt.run(id);
    return result.changes;
  }

  addErrorLog(errorMessage: string, stackTrace: string, hasEmbeddingModel: boolean, hasSummaryModel: boolean): number | bigint {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT INTO error_logs (error_message, stack_trace, has_embedding_model, has_summary_model)
      VALUES (?, ?, ?, ?)
    `);
    const result: Database.RunResult = stmt.run(
      errorMessage,
      stackTrace,
      hasEmbeddingModel ? 1 : 0,
      hasSummaryModel ? 1 : 0
    );
    return result.lastInsertRowid;
  }

  getErrorLogs(): ErrorLog[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      SELECT * FROM error_logs ORDER BY created_at DESC
    `);
    const result = stmt.all() as ErrorLog[];
    return result.map(log => ({
      ...log,
      has_embedding_model: log.has_embedding_model === 1,
      has_summary_model: log.has_summary_model === 1
    }));
  }

  clearErrorLogs(): number {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      DELETE FROM error_logs
    `);
    const result: Database.RunResult = stmt.run();
    return result.changes;
  }

  close() {
    if (!this.db) throw new Error('Database not initialized');
    this.db.close();
  }
}

// Export singleton instance
export const dbService = new DatabaseService();
