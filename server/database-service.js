import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, copyFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseService {
  constructor() {
    // Get the app data directory
    const userDataPath = process.env.ELECTRON_APP_DATA_PATH || __dirname;
    
    // Ensure the directory exists
    try {
      mkdirSync(userDataPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error('Failed to create database directory:', error);
      }
    }
    
    // Initialize database in the app data directory
    const dbPath = join(userDataPath, 'chats.db');
    console.log('Database path:', dbPath);
    
    try {
      // Move sqlite binary if it doesn't exist
      const sqliteBinaryPath = join(userDataPath, 'better_sqlite3.node');
      if (!existsSync(sqliteBinaryPath)) {
        copyFileSync(process.env.BETTER_SQLITE3_PATH, sqliteBinaryPath);
        console.log('Copied better_sqlite3.node to:', sqliteBinaryPath);
      }
      this.db = new Database(dbPath, {
        nativeBinding: sqliteBinaryPath
      });
      this.initializeTables();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
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

    // Create embeddings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        embedding TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
      CREATE INDEX IF NOT EXISTS idx_message_embeddings_message_id ON message_embeddings (message_id);
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

  // Embedding operations
  saveEmbedding(messageId, embedding) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO message_embeddings (message_id, embedding) 
      VALUES (?, ?)
    `);
    return stmt.run(messageId, JSON.stringify(embedding));
  }

  getEmbedding(messageId) {
    const stmt = this.db.prepare(`
      SELECT embedding FROM message_embeddings WHERE message_id = ?
    `);
    const result = stmt.get(messageId);
    return result ? JSON.parse(result.embedding) : null;
  }

  // Get messages with embeddings for similarity search
  getMessagesWithEmbeddings(chatId) {
    const stmt = this.db.prepare(`
      SELECT m.id, m.role, m.content, me.embedding
      FROM messages m
      JOIN message_embeddings me ON m.id = me.message_id
      WHERE m.chat_id = ?
      ORDER BY m.created_at ASC
    `);
    
    const messages = stmt.all(chatId);
    return messages.map(msg => ({
      ...msg,
      embedding: JSON.parse(msg.embedding)
    }));
  }

  // Get recent messages for context
  getRecentMessages(chatId, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE chat_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(chatId, limit).reverse();
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vecA, vecB) {
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
  getSimilarMessages(chatId, queryEmbedding, topK = 5) {
    const messagesWithEmbeddings = this.getMessagesWithEmbeddings(chatId);
    
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

  close() {
    this.db.close();
  }
}

// Export singleton instance
export const dbService = new DatabaseService();
