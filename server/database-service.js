import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseService {
  constructor() {
    // Initialize database in the project root
    const dbPath = join(__dirname, 'chats.db');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  initializeTables() {
    // Create chats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
    `);
  }

  // Chat operations
  createChat(title) {
    const stmt = this.db.prepare(`
      INSERT INTO chats (title) VALUES (?)
    `);
    const result = stmt.run(title);
    
    return this.getChatById(result.lastInsertRowid);
  }

  getAllChats() {
    const stmt = this.db.prepare(`
      SELECT * FROM chats 
      ORDER BY updated_at DESC
    `);
    return stmt.all();
  }

  getChatById(id) {
    const stmt = this.db.prepare(`
      SELECT * FROM chats WHERE id = ?
    `);
    return stmt.get(id);
  }

  updateChatTimestamp(chatId) {
    const stmt = this.db.prepare(`
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(chatId);
  }

  deleteChat(id) {
    const stmt = this.db.prepare(`
      DELETE FROM chats WHERE id = ?
    `);
    stmt.run(id);
  }

  // Message operations
  addMessage(chatId, role, content) {
    const stmt = this.db.prepare(`
      INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)
    `);
    const result = stmt.run(chatId, role, content);
    
    // Update chat timestamp
    this.updateChatTimestamp(chatId);
    
    return this.getMessageById(result.lastInsertRowid);
  }

  getMessageById(id) {
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `);
    return stmt.get(id);
  }

  getChatMessages(chatId, limit = 50, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE chat_id = ? 
      ORDER BY created_at ASC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(chatId, limit, offset);
  }

  getChatMessageCount(chatId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE chat_id = ?
    `);
    const result = stmt.get(chatId);
    return result.count;
  }

  updateMessage(id, content) {
    const stmt = this.db.prepare(`
      UPDATE messages SET content = ? WHERE id = ?
    `);
    stmt.run(content, id);
  }

  deleteMessage(id) {
    const stmt = this.db.prepare(`
      DELETE FROM messages WHERE id = ?
    `);
    stmt.run(id);
  }

  // Generate chat title from first user message
  generateChatTitle(firstMessage) {
    // Take first 50 characters and add ellipsis if longer
    const title = firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...' 
      : firstMessage;
    return title;
  }

  close() {
    this.db.close();
  }
}

// Export singleton instance
export const dbService = new DatabaseService();
