import express from 'express';
import cors from 'cors';
import { dbService } from './database-service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.resourcesPath === undefined;
console.info("Running in development mode:", isDev);

function resolveResourcePath(...segments) {
  const base = isDev
    ? path.join(__dirname, '..')
    : process.resourcesPath
  if (isDev) {
    return path.join(base, ...segments);
  }
  return path.join(base, 'server', ...segments)
}

// Load .env for packaged builds
dotenv.config({ path: resolveResourcePath('.env') });

const app = express();
const PORT = process.env.VITE_API_PORT || 3001;
const ollamaApiUrl = process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
const embeddingModelName = process.env.VITE_EMBEDDING_MODEL_NAME || 'nomic-embed-text';

app.use(cors());
app.use(express.json());

// Serve the frontend
if (!isDev) {
  app.use('/', express.static(resolveResourcePath('/')));
  app.get('/', async (req, res) => {
    res.sendFile(resolveResourcePath('index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('App is not available, please try again later.');
      }
    });
  });
} else {
  app.use('/', express.static(path.join(__dirname, '../dist')));
  app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('App is not available, please try again later.');
      }
    });
  });
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check if our server is running (obviously true if we reach this point)
    const serverStatus = true;
    
    // Check Ollama connectivity
    let ollamaStatus = false;
    try {
      const ollamaResponse = await fetch(`${ollamaApiUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      ollamaStatus = ollamaResponse.ok;
    } catch (ollamaError) {
      console.log('Ollama health check failed:', ollamaError.message);
      ollamaStatus = false;
    }
    
    const overallHealth = serverStatus && ollamaStatus;
    const statusCode = overallHealth ? 200 : 503;
    
    res.status(statusCode).json({
      server: serverStatus,
      ollama: ollamaStatus,
      overall: overallHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      server: false, 
      ollama: false, 
      overall: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/embeddings', async (req, res) => {
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
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching embeddings:', error);
    res.status(500).json({ error: 'Failed to fetch embeddings' });
  }
});

// Chat endpoints
app.get('/api/chats', (req, res) => {
  try {
    const chats = dbService.getAllChats();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chats', (req, res) => {
  try {
    const { title } = req.body;
    const chat = dbService.createChat(title);
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chats/:id', (req, res) => {
  try {
    const chat = dbService.getChatById(parseInt(req.params.id));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/chats/:id', (req, res) => {
  try {
    const chatId = parseInt(req.params.id);
    
    // Check if chat exists
    const chat = dbService.getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Delete the chat (messages will be deleted automatically due to CASCADE)
    dbService.deleteChat(chatId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Message endpoints
app.get('/api/chats/:id/messages', (req, res) => {
  try {
    const chatId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const messages = dbService.getChatMessages(chatId, limit, offset);
    const total = dbService.getChatMessageCount(chatId);
    
    res.json({
      messages,
      total,
      hasMore: offset + messages.length < total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chats/:id/messages', (req, res) => {
  try {
    const chatId = parseInt(req.params.id);
    const { role, content } = req.body;
    
    const message = dbService.addMessage(chatId, role, content);
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/messages/:id', (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const { content } = req.body;
    
    dbService.updateMessage(messageId, content);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/messages/:id', (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    dbService.deleteMessage(messageId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ollama GUI Chat (${process.env.NODE_ENV}) is running at http://localhost:${PORT}`);
});
