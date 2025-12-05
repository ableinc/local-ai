import express from 'express';
import cors from 'cors';
import { dbService } from './database-service.ts';
import type { OllamaTags, Chat, Message, AppSetting, McpServer, ErrorLog, OllamaGenerateResponse, OllamaEmbeddingsResponse, FileUpload } from './types.ts';
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
    dbService.close();
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

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
    }

    const tags: OllamaTags = await ollamaResponse.json();
    const hasEmbeddingModel = tags.models.some((model) => model.name.includes(embeddingModelName!));
    const hasSummarizationModel = tags.models.some((model) => model.name === summarizationModelName);
    if (!hasEmbeddingModel || !hasSummarizationModel) {
      dbService.addErrorLog(
        'Missing required models.',
        '',
        hasEmbeddingModel,
        hasSummarizationModel
      );
    }
    res.status(ollamaResponse.ok ? 200 : 503).json({
      data: {
        server: true,
        ollama: ollamaResponse.ok && hasEmbeddingModel && hasSummarizationModel,
        tags: tags.models,
        errorLogs: dbService.getErrorLogs(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      server: true, 
      ollama: false,
      tags: [],
      errorLogs: dbService.getErrorLogs(),
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/embeddings', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { text } = req.body;
    if (!text) {
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
    const data: OllamaEmbeddingsResponse = await response.json();
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

app.put('/api/chats/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!id || !title) {
      return res.status(422).json({ error: 'Chat ID and title are required' });
    }
    dbService.updateChatTitle(parseInt(id), title);
    res.json({ success: true });
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
    const { role, content, placeholder } = req.body;
    if (!id || !role || (!content && !placeholder)) {
      return res.status(422).json({ error: 'Chat ID, role, and content are required' });
    }
    const message: Message | null = dbService.addMessage(parseInt(id), role, content);
    if (!message) {
      return res.status(400).json({ error: 'Failed to add message' });
    }
    res.json({ data: message });
    if (!message.content || message.content.trim() === "") {
      return;
    }
    // Generate embedding
    fetch(`${ollamaApiUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: embeddingModelName,
        prompt: message.content
      })
    })
      .then(async (response) => {
        if (!response.ok) {
          console.error('Failed to generate embedding using Ollama API');
        }
        const data: OllamaEmbeddingsResponse = await response.json();
        // Save embedding
        dbService.saveEmbedding(message.id, data.embedding);
      })
      .catch((error) => {
        console.error('Error generating embedding using Ollama API:', error);
      });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/chats/title', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(422).json({ error: 'Invalid message parameter' });
    }
    const response = await fetch(`${ollamaApiUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: summarizationModelName,
        prompt: `Generate a concise title (max 6 words) for the following chat conversation, DO NOT ANSWER THE PROMPT ONLY GENERATE A TITLE SUMMARIZING THE PROMPT: ${message}`,
        temperature: 0.7,
        stop: ['\n'],
        stream: false
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    const data: OllamaGenerateResponse = await response.json();
    let title = data.response?.trim() || '';
    if (title.length === 0) {
      title = dbService.generateChatTitleFallback(message);
    }
    res.json({ data: title.replace(/[^a-zA-Z0-9\s]/g, '').trim() });
  } catch (error) {
    console.error('Error generating chat title:', error);
    res.status(200).json({ data: 'New Chat' });
  }
});

app.get('/api/messages/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'Message ID is required' });
    }
    const message: Message | null = dbService.getMessageById(parseInt(id));
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ data: message });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put('/api/messages/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    const { content, canceled, errored, regenerated } = req.body;
    if (!id || content === undefined || canceled === undefined || errored === undefined || regenerated === undefined) {
      return res.status(422).json({ error: 'Message ID, canceled, errored, and regenerated status are required' });
    }
    const data = content.trim();
    dbService.updateMessage(parseInt(id), data, canceled, errored, regenerated);
    // If not canceled or errored generate embedding
    if (data !== "" && !canceled && !errored) {
      // Generate embedding
      fetch(`${ollamaApiUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: embeddingModelName,
          prompt: data
        })
      })
        .then(async (response) => {
          if (!response.ok) {
            console.error('Failed to generate embedding using Ollama API');
          }
          const data: OllamaEmbeddingsResponse = await response.json();
          if (!data.embedding || data.embedding.length === 0) {
            console.error('No embedding returned from Ollama API');
            return;
          }
          // Save embedding
          dbService.saveEmbedding(parseInt(id), data.embedding);
        })
        .catch((error) => {
          console.error('Error generating embedding using Ollama API:', error);
        });
    }
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

// Get conversation context using embeddings
app.post('/api/chats/:id/context/similar', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
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
    
    const currentMessageEmbeddingData: OllamaEmbeddingsResponse = await embeddingResponse.json();
    const chatId = parseInt(id);
    
    // // Get similar messages
    const similarMessages = dbService.getSimilarMessages(chatId, currentMessageEmbeddingData.embedding, recentCount, similarCount);

    res.json({ data: similarMessages});
  } catch (error) {
    console.error('Error getting context:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/chats/:id/context', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    const { limit = 10, regenerate = "false" } = req.query;
    if (!id) {
      return res.status(422).json({ error: 'Chat ID is required' });
    }
    const chatId = parseInt(id);
    const messages: Message[] = dbService.getChatContext(chatId, parseInt(limit as string), 0, "ASC");
    if (regenerate === "true") {
      // Exclude the last message (the one being regenerated)
      messages.pop();
    }
    res.json({ data: messages.map(message => ({
      role: message.role,
      content: message.content
    })) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/settings', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const data: AppSetting[] = dbService.getAppSettings();
    const result: Record<string, boolean | number | string> = {};
    data.forEach((setting) => {
      result[setting.title] = setting.toggle;
    });
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put('/api/settings', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    dbService.updateAppSettings(req.body);
    const data: AppSetting[] = dbService.getAppSettings();
    const result: Record<string, boolean | number | string> = {};
    data.forEach((setting) => {
      result[setting.title] = setting.toggle;
    });
    res.json({ data: result })
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

app.get('/api/error-logs', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const errorLogs: ErrorLog[] = dbService.getErrorLogs();
    res.json({ data: errorLogs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/files/upload', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { chat_id, filename, type, content, message_id } = req.body;
    if (!chat_id || !filename || !type || !content || !message_id) {
      return res.status(422).json({ error: 'Chat ID, filename, type, content, and message ID are required' });
    }
    const file: FileUpload | null = dbService.addFileUpload(chat_id, filename, type, content, message_id);
    if (!file) {
      return res.status(400).json({ error: 'Failed to upload file' });
    }
    res.json({ data: file });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/files/:id', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(422).json({ error: 'File ID is required' });
    }
    const file = dbService.getFileUploadById(parseInt(id));
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ data: file });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/files/:chat_id/chat', async (req: express.Request, res: express.Response): Promise<void | express.Response<unknown, Record<string, unknown>>> => {
  try {
    const { chat_id } = req.params;
    if (!chat_id) {
      return res.status(422).json({ error: 'Chat ID is required' });
    }
    const files = dbService.getFileUploadsByChatId(parseInt(chat_id));
    res.json({ data: files.map(file => file.filename) });
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
  killCurrentProcess()
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
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
        'Missing required models and/or Ollama API is not reachable.',
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
