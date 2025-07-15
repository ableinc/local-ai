# Ollama GUI Chat Application

A modern, full-featured desktop chat application that runs entirely on your local machine. Built with Electron, React, TypeScript, and Vite, featuring a sleek UI powered by shadcn/ui components and Tailwind CSS.

## 📥 Quick Start

Download the latest version for your platform from our [GitHub Releases](https://github.com/ableinc/local-ai/releases) page:

- **macOS**: Download `Local.Ai-{version}.dmg` (Apple Silicon/Intel)
- **Windows**: Download `Local.Ai-Setup-{version}.exe`
- **Linux**: Download `Local.Ai-{version}.AppImage` or `.deb` package

After installation, make sure you have Ollama running locally before starting the app.

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

- **Desktop App**: Electron with auto-updates
- **Frontend**: React 19, TypeScript, Vite
- **UI Components**: shadcn/ui, Radix UI primitives
- **Styling**: Tailwind CSS 4.x
- **Database**: SQLite (better-sqlite3)
- **Backend**: Express.js API server (runs embedded)
- **AI Integration**: Ollama API
- **Build Tool**: Vite with TypeScript
- **Packaging**: electron-builder

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
cd localai
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
local-ai/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   └── app-sidebar.tsx
│   ├── services/
│   │   └── api.ts        # API service for backend communication
│   ├── lib/
│   │   └── utils.ts      # Utility functions
│   └── App.tsx           # Main application component
│   ├── server/
│   │   └── index.js 
│   │   └── database-service.js 
├── server.js             # Express backend server
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

**App shows blank screen or won't start:**
- Check if Ollama is running on port 11434
- Try running with debug mode: Right-click app icon > Run with Debug Mode
- Check the app logs:
  - macOS: `~/Library/Logs/Local Ai/main.log`
  - Windows: `%USERPROFILE%\AppData\Roaming\Local Ai\logs\main.log`
  - Linux: `~/.config/Local Ai/logs/main.log`

**Connection refused errors:**
- Verify Ollama is running and accessible
- Check your firewall settings
- Make sure port 11434 is not blocked

**Database errors:**
- The SQLite database is created automatically
- Check file permissions in the project directory
- Restart the backend server if needed

**Fast Refresh warnings:**
- These are development-only warnings and don't affect functionality
- The app will still work correctly in production builds

## 🏗️ Building for Production

### Running from Source

```bash
# Build the application
npm run build

# Start in development mode
npm run dev:full
```

### Building Desktop Apps

```bash
# Build for current platform
npm run build:mac    # macOS arm64/x64
npm run build:win    # Windows x64
npm run build:linux  # Linux x64

# The packaged applications will be in the release/ directory
```

### Release Channels

- **Stable**: Download from [GitHub Releases](https://github.com/ableinc/local-ai/releases)
- **Development**: Build from source using instructions above

### Code Signing

The macOS app is notarized and signed with an Apple Developer ID certificate. Windows builds are signed with an EV Code Signing certificate. This ensures:

- No security warnings on launch
- Gatekeeper approval on macOS
- SmartScreen approval on Windows

## 🤝 Contributing

This is a local development project. Feel free to modify and extend it according to your needs!

## 📄 License

This project is for personal/educational use.
