import express from 'express';
import cors from 'cors';
import { dbService } from './database-service.ts';
import type { OllamaTags, Chat, Message, MessageEmbedding, AppSetting, McpServer, ErrorLog } from './types.ts';
import { installOllamaEmbeddingModelIfNeeded, installOllamaSummaryModelIfNeeded } from './utils.ts';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = (process as unknown as { resourcesPath: string }).resourcesPath === undefined;
console.info("Running in development mode:", isDev);

function resolveResourcePath(...segments: string[]): string {
  const base = isDev
    ? path.join(__dirname, '..')
    : (process as unknown as { resourcesPath: string }).resourcesPath
  return path.join(base, ...segments)
}

// Load .env for packaged builds
dotenv.config({ path: resolveResourcePath('.env') });

const app = express();
const PORT: string | undefined = process.env.VITE_API_PORT;
const ollamaApiUrl: string | undefined = process.env.VITE_OLLAMA_BASE_URL;
const embeddingModelName: string | undefined = process.env.EMBEDDING_MODEL_NAME;
const summarizationModelName: string | undefined = process.env.SUMMARIZATION_MODEL_NAME;

app.use(cors());
app.use(express.json());

function killCurrentProcess(): void {
  try {
    // Clear error logs in database
    dbService.clearErrorLogs();
    process.kill(process.pid, 'SIGHUP')
    process.exit(0)
  } catch (err) {
    console.log('some error happened when killing server process: ', err)
  }
}

// Serve the frontend
if (!isDev) {
  app.use('/', express.static(resolveResourcePath('/')));
  app.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
    res.sendFile(resolveResourcePath('index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('App is not available, please try again later.');
      }
    });
  });
} else {
  app.use('/', express.static(path.join(__dirname, '../dist')));
  app.get('/', async (req: express.Request, res: express.Response): Promise<void> => {
    res.sendFile(path.join(__dirname, '../dist/index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('App is not available, please try again later.');
      }
    });
  });
}

// Health check endpoint
app.get('/api/health', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const ollamaResponse = await fetch(`${ollamaApiUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    res.status(ollamaResponse.ok ? 200 : 503).json({
      data: {
        server: true,
        ollama: ollamaResponse.ok,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      server: false, 
      ollama: false, 
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/embeddings', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { text } = req.query;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text parameter' });
    }
    const response = await fetch(`${ollamaApiUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: embeddingModelName,
        prompt: text
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    const data: { embedding: number[] } = await response.json();
    res.json({
      data: data.embedding
    });
  } catch (error) {
    console.error('Error fetching embeddings:', error);
    res.status(500).json({ error: 'Failed to fetch embeddings' });
  }
});

app.get('/api/tags', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const response = await fetch(`${ollamaApiUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    const data: OllamaTags = await response.json()
    res.json({ data: data.models.filter((model) => !model.name.includes('nomic-embed')) });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
})

// Chat endpoints
app.get('/api/chats', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const chats: Chat[] = dbService.getAllChats();
    res.json({ data: chats });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/chats', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(422).json({ error: 'Title is required' });
    }
    const chat = dbService.createChat(title);
    res.json({ data: chat });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/chats/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'Chat ID is required' });
    }
    const chat: Chat | null = dbService.getChatById(parseInt(id));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    res.json({ data: chat });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/chats/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'Chat ID is required' });
    }
    const chatId = parseInt(id);
    // Check if chat exists
    const chat: Chat | null = dbService.getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    // Delete the chat (messages will be deleted automatically due to CASCADE)
    dbService.deleteChat(chatId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Message endpoints
app.get('/api/chats/:id/messages', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    const { pageSize, page } = req.query;
    if (!id) {
      return res.status(422).json({ error: 'Chat ID is required' });
    }
    const chatId = parseInt(id);
    const limit = parseInt(pageSize as string) || 50;
    const offset = parseInt(page as string) || 0;
    
    const messages: Message[] = dbService.getChatMessages(chatId, limit, offset);
    const total: number | bigint = dbService.getChatMessageCount(chatId);
    
    res.json({
      data: {
        messages,
        total,
        hasMore: offset + messages.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/chats/:id/messages', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    const { role, content } = req.body;
    if (!id || !role || !content) {
      return res.status(422).json({ error: 'Chat ID, role, and content are required' });
    }
    const message = dbService.addMessage(parseInt(id), role, content);
    res.json({ data: message });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put('/api/messages/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    const { content, canceled } = req.body;
    if (!id || !content || !canceled) {
      return res.status(422).json({ error: 'Message ID, content, and canceled status are required' });
    }
    dbService.updateMessage(parseInt(id), content, canceled);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch('/api/messages/:id/cancel', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'Message ID is required' });
    }
    dbService.cancelMessage(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch('/api/messages/:id/error', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'Message ID is required' });
    }
    dbService.errorMessage(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/messages/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'Message ID is required' });
    }
    dbService.deleteMessage(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Embedding endpoints
app.post('/api/messages/:id/embedding', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'Message ID is required' });
    }
    const message: Message | null = dbService.getMessageById(parseInt(id));
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    // Check if embedding already exists
    const existingEmbedding: MessageEmbedding | null = dbService.getEmbedding(message.id);
    if (existingEmbedding) {
      return res.json({ data: existingEmbedding });
    }
    // Generate embedding
    const response = await fetch(`${ollamaApiUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: embeddingModelName,
        prompt: message.content
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate embedding');
    }
    const data: { embedding: number[] } = await response.json();
    // Save embedding
    dbService.saveEmbedding(message.id, data.embedding);
    res.json({ data: data.embedding });
  } catch (error) {
    console.error('Error generating embedding:', error);
    res.status(500).json({ error: 'Failed to generate embedding' });
  }
});

// Get conversation context using embeddings
app.post('/api/chats/:id/context', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    const { message, recentCount = 5, similarCount = 3 } = req.body;
    if (!id || !message) {
      return res.status(422).json({ error: 'Chat ID and message are required' });
    }
    
    // Generate embedding for the current message
    const embeddingResponse = await fetch(`${ollamaApiUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: embeddingModelName,
        prompt: message
      })
    });
    
    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }
    
    const currentMessageEmbeddingData: { embedding: number[] } = await embeddingResponse.json();
    const chatId = parseInt(id);
    
    // // Get similar messages
    const similarMessages = dbService.getSimilarMessages(chatId, currentMessageEmbeddingData.embedding, recentCount, similarCount);

    res.json({ data: similarMessages});
  } catch (error) {
    console.error('Error getting context:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/settings', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const data: AppSetting[] = dbService.getAppSettings();
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put('/api/settings', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    dbService.updateAppSettings(req.body);
    res.json({ message: 'success' })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/mcp-servers', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const servers: McpServer[] = dbService.getMCPServers();
    res.json({ data: servers });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/mcp-servers', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { name, url, api_key } = req.body;
    if (!name || !url) {
      return res.status(422).json({ error: 'Name and URL are required' });
    }
    const server: McpServer | null = dbService.addMCPServer(name, url, api_key);
    res.json({ data: server });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/mcp-servers/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'MCP Server ID is required' });
    }
    dbService.deleteMCPServer(parseInt(id));
    res.json({ message: 'success' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put('/api/mcp-servers/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    const { name, url, api_key } = req.body;
    if (!id || !name || !url) {
      return res.status(422).json({ error: 'MCP Server ID, name, and URL are required' });
    }
    dbService.updateMCPServer(parseInt(id), name, url, api_key);
    res.json({ message: 'success' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/chat/title', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(422).json({ error: 'Invalid message parameter' });
    }
    const response = await fetch(`${ollamaApiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: summarizationModelName,
        prompt: `Generate a concise title (max 6 words) for the following chat conversation:\n${message}\nONLY RETURN THE TITLE TEXT.`,
        temperature: 0.7,
        stop: ['\n']
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    const data: { text: string } = await response.json();
    res.json({ data: data.text.trim() });
  } catch (error) {
    console.error('Error generating chat title:', error);
    res.status(500).json({ error: 'Failed to generate chat title' });
  }
});

app.get('/api/error-logs', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const errorLogs: ErrorLog[] = dbService.getErrorLogs();
    res.json({ data: errorLogs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add error handling for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process for now, just log
});

// Add graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  dbService.close();
  killCurrentProcess()
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  dbService.close();
  killCurrentProcess()
});

app.listen(PORT, async () => {
  console.log(`Ollama GUI Chat (${process.env.NODE_ENV}) is running at http://localhost:${PORT}`);
  console.log(`Database service initialized: ${dbService ? 'SUCCESS' : 'FAILED'}`);
  
  // Test database connection
  try {
    console.log('Initializing database service...');
    dbService.init();
    console.log('Checking if necessary embedding model is available...');
    const hasInstalledEmbeddingModel = await installOllamaEmbeddingModelIfNeeded();
    console.log('Checking if necessary summarization model is available...');
    const hasInstalledSummaryModel = await installOllamaSummaryModelIfNeeded();
    const chats = dbService.getAllChats();
    console.log(`Database connection test: Found ${chats.length} chats`);
    if (!hasInstalledEmbeddingModel || !hasInstalledSummaryModel) {
      dbService.addErrorLog(
        'Missing required models',
        '',
        hasInstalledEmbeddingModel,
        hasInstalledSummaryModel
      );
    } else {
      console.log(`Using embedding model: ${embeddingModelName}`);
      console.log(`Using summarization model: ${summarizationModelName}`);
    }
  } catch (error) {
    console.error('Database connection test failed:', error);
    dbService.addErrorLog(
      (error as Error).message,
      (error as Error).stack || '',
      false,
      false
    );
  }
}).on('error', (error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
