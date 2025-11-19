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
  return path.join(base, ...segments)
}

// Load .env for packaged builds
dotenv.config({ path: resolveResourcePath('.env') });

const app = express();
const PORT = process.env.VITE_API_PORT;
const ollamaApiUrl = process.env.VITE_OLLAMA_BASE_URL;
const embeddingModelName = process.env.VITE_EMBEDDING_MODEL_NAME;

app.use(cors());
app.use(express.json());

function killCurrentProcess() {
  try {
    process.kill(process.pid, 'SIGHUP')
    process.exit(0)
  } catch (err) {
    console.log('some error happened when killing server process: ', err)
  }
}

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

app.get('/api/tags', async (req, res) => {
  let tags = [];
  try {
    const response = await fetch(`${ollamaApiUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (response.ok) {
      const data = await response.json()
      data.models = Array.isArray(data.models) ? data.models.filter((model) => !model.name.includes('nomic-embed')) : [];
      if (data.models.length > 0) {
        tags = data.models
      }
    }
    res.json(tags)
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
})

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
      messages: messages.map(msg => ({
        ...msg,
        // Ensure boolean values for canceled and errored
        canceled: Boolean(msg.canceled),
        errored: Boolean(msg.errored)
      })),
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
    const { content, canceled } = req.body;
    
    dbService.updateMessage(messageId, content, canceled);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/messages/:id/cancel', (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    
    dbService.cancelMessage(messageId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/messages/:id/error', (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    
    dbService.errorMessage(messageId);
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

// Embedding endpoints
app.post('/api/messages/:id/embedding', async (req, res) => {
  try {
    const { id } = req.params;
    const message = dbService.getMessageById(id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check if embedding already exists
    const existingEmbedding = dbService.getEmbedding(id);
    if (existingEmbedding) {
      return res.json({ embedding: existingEmbedding });
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
    
    const data = await response.json();
    const embedding = data.embedding;
    
    // Save embedding
    dbService.saveEmbedding(id, embedding);
    
    res.json({ embedding });
  } catch (error) {
    console.error('Error generating embedding:', error);
    res.status(500).json({ error: 'Failed to generate embedding' });
  }
});

// Get conversation context using embeddings
app.post('/api/chats/:id/context', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, recentCount = 5, similarCount = 3 } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
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
    
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding;
    
    // Get recent messages
    const recentMessages = dbService.getRecentMessages(id, recentCount);
    
    // Get similar messages
    const similarMessages = dbService.getSimilarMessages(id, queryEmbedding, similarCount);
    
    // Combine and deduplicate
    const messageMap = new Map();
    
    // Add similar messages first (higher priority)
    similarMessages.forEach(msg => {
      messageMap.set(msg.id, msg);
    });
    
    // Add recent messages
    recentMessages.forEach(msg => {
      if (!messageMap.has(msg.id)) {
        messageMap.set(msg.id, { ...msg, similarity: 0 });
      }
    });
    
    // Convert back to array and sort by relevance/recency
    const contextMessages = Array.from(messageMap.values())
      .sort((a, b) => {
        // Prioritize similar messages
        if (a.similarity && b.similarity) {
          return b.similarity - a.similarity;
        }
        // Then by recency
        return b.id - a.id;
      });
    
    res.json({ contextMessages });
  } catch (error) {
    console.error('Error getting context:', error);
    res.status(500).json({ error: 'Failed to get context' });
  }
});

// Debug endpoint to check embedding model availability
app.get('/api/debug/embedding-model', async (req, res) => {
  try {
    const response = await fetch(`${ollamaApiUrl}/api/tags`);
    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }
    
    const data = await response.json();
    const hasEmbeddingModel = data.models && data.models.some(model => 
      model.name.includes(embeddingModelName)
    );
    
    res.json({
      embeddingModelName,
      available: hasEmbeddingModel,
      allModels: data.models?.map(m => m.name) || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check embedding model' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const data = dbService.getAppSettings();
    const result = {};
    for (const column of data) {
      result[column.title] = column.toggle === 1;
    }
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    dbService.updateAppSettings(req.body);
    res.json({ message: 'success' })
  } catch (error) {
    res.status(500).json({ error: error.message });
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

app.listen(PORT, () => {
  console.log(`Ollama GUI Chat (${process.env.NODE_ENV}) is running at http://localhost:${PORT}`);
  console.log(`Using embedding model: ${embeddingModelName}`);
  console.log(`Database service initialized: ${dbService ? 'SUCCESS' : 'FAILED'}`);
  
  // Test database connection
  try {
    const chats = dbService.getAllChats();
    console.log(`Database connection test: Found ${chats.length} chats`);
  } catch (error) {
    console.error('Database connection test failed:', error);
  }
}).on('error', (error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
