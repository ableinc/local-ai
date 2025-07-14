# Ollama GUI Chat Application

A modern, full-featured chat application that runs entirely on your local machine. Built with React, TypeScript, and Vite, featuring a sleek UI powered by shadcn/ui components and Tailwind CSS.

## ✨ Features

- **🤖 Local AI Integration**: Connect to Ollama models running on your machine
- **💬 Persistent Chat History**: SQLite database stores all conversations locally
- **🔄 Streaming Responses**: Real-time AI responses with typing indicators
- **📂 Multiple Conversations**: Create and manage multiple chat sessions
- **🎨 Modern UI**: Clean, responsive interface with dark/light theme support
- **📱 Mobile-Friendly**: Responsive design with collapsible sidebar
- **🚀 Fast Performance**: Built with Vite for lightning-fast development and builds
- **📄 Paginated History**: Efficient loading of chat history with scroll-based pagination
- **🔧 Model Selection**: Choose from available Ollama models via dropdown

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI Components**: shadcn/ui, Radix UI primitives
- **Styling**: Tailwind CSS 4.x
- **Database**: SQLite (better-sqlite3)
- **Backend**: Express.js API server
- **AI Integration**: Ollama API
- **Build Tool**: Vite with TypeScript

## 📋 Prerequisites

Before running this application, ensure you have:

1. **Node.js** (v22 or higher)
2. **npm** or **yarn**
3. **Ollama** installed and running on your system

### Installing Ollama

Visit [Ollama's official website](https://ollama.ai) to download and install Ollama for your operating system.

After installation, pull at least one model:
```bash
# Example: Pull a lightweight model
ollama pull llama2

# Or pull other models like:
ollama pull mistral
ollama pull codellama
```

Make sure Ollama is running:
```bash
ollama serve
```

## 🚀 Installation & Setup

1. **Clone the repository** (if applicable) or navigate to the project directory:
```bash
cd ollama-gui-chat
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start the application**:
```bash
# Option 1: Start both frontend and backend simultaneously
npm run dev:full

# Option 2: Start them separately
# Terminal 1 - Backend server
npm run server

# Terminal 2 - Frontend development server
npm run dev
```

4. **Open your browser** and navigate to (development):
   - Frontend: `http://localhost:5173` (or the port shown in terminal)
   - Backend API: `http://localhost:3001`

## 📖 Usage

### Starting a Conversation
1. Click the "New Chat" button in the sidebar
2. Select an AI model from the dropdown menu
3. Type your message in the input area
4. Press Enter or click "Send"

### Managing Chats
- **View Chat History**: All chats appear in the left sidebar
- **Switch Chats**: Click on any chat in the sidebar to load its history
- **Scroll to Load More**: Scroll up in a chat to load earlier messages

### Model Selection
- Use the dropdown in the header to switch between available Ollama models
- The app automatically fetches available models from your Ollama installation

## 🏗️ Project Structure

```
ollama-gui-chat/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   └── app-sidebar.tsx
│   ├── services/
│   │   └── api.ts        # API service for backend communication
│   ├── lib/
│   │   └── utils.ts      # Utility functions
│   └── App.tsx           # Main application component
├── server.js             # Express backend server
├── database-service.js   # SQLite database operations
└── package.json
```

## 🔧 Configuration

### Environment Variables
The application uses default ports but you can customize them:
- Frontend: Port 5173 (Vite default)
- Backend: Port 3001
- Ollama: Port 11434 (default)

### Database
The SQLite database (`chat.db`) is automatically created in the project root when you first run the server.

## 📚 API Endpoints

The backend provides these REST endpoints:

- `GET /api/chats` - Retrieve all chats
- `POST /api/chats` - Create a new chat
- `GET /api/chats/:chatId/messages` - Get messages for a chat (paginated)
- `POST /api/chats/:chatId/messages` - Add a message to a chat

## 🐛 Troubleshooting

### Common Issues

**"No models available" in dropdown:**
- Ensure Ollama is running: `ollama serve`
- Check if you have models installed: `ollama list`
- Pull a model: `ollama pull llama2`

**Connection refused errors:**
- Verify Ollama is running on port 11434
- Check if the backend server is running on port 3001
- Ensure no firewall is blocking the connections

**Database errors:**
- The SQLite database is created automatically
- Check file permissions in the project directory
- Restart the backend server if needed

**Fast Refresh warnings:**
- These are development-only warnings and don't affect functionality
- The app will still work correctly in production builds

## 🏗️ Building for Production

```bash
# Build the application
npm run build

# Start the server (serve via reverse proxy)
npm start
```

**Open your browser** and navigate to:
   - App: `http://localhost:3001` (or the port shown in terminal)

## 🤝 Contributing

This is a local development project. Feel free to modify and extend it according to your needs!

## 📄 License

This project is for personal/educational use.
