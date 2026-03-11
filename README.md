# Cloud Workspace Platform

Build real-world projects with an always-ready cloud workspace, live preview, terminal, and agentic AI mentors that give hints, explain concepts, debug, and review your code.

## Features

- 🚀 **Cloud Workspace**: Always-ready development environment
- 👁️ **Live Preview**: See your changes in real-time
- 💻 **Integrated Terminal**: Full terminal access in your browser
- 🤖 **AI Mentor**: Get hints, explanations, debugging help, and code reviews
- 📁 **Project Templates**: Start with pre-configured project templates
- 🎨 **Modern UI**: Beautiful, VS Code-inspired interface

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Code Editor**: Monaco Editor (VS Code editor)
- **Terminal**: xterm.js with Socket.io
- **AI**: Groq API (using Llama 3.1 70B - fast and powerful)
- **Backend**: Node.js, Express, Socket.io
- **Sandbox**: Docker (optional, for production)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker (optional, for full sandbox functionality)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd cloud-workspace-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Groq API key (optional, for AI mentor):
```
GROQ_API_KEY=your-api-key-here
```

Get your free API key from [Groq Console](https://console.groq.com/)

4. Start the development server:
```bash
# Terminal 1: Next.js frontend
npm run dev

# Terminal 2: Backend server (for terminal)
npm run server
```

5. Open [http://localhost:5175](http://localhost:5175) in your browser

## Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── ai/           # AI mentor API
│   │   └── preview/      # Preview server API
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   ├── Workspace.tsx     # Main workspace component
│   ├── CodeEditor.tsx    # Monaco editor wrapper
│   ├── Terminal.tsx      # xterm.js terminal
│   ├── LivePreview.tsx   # Preview iframe
│   ├── AIMentor.tsx      # AI chat interface
│   └── ProjectSelector.tsx
├── server/               # Backend server
│   └── index.js         # Express + Socket.io server
├── types/                # TypeScript types
└── package.json
```

## Usage

1. **Select a Project Template**: Choose from React, HTML/CSS/JS, or Node.js API templates
2. **Edit Code**: Use the Monaco editor to write and edit your code - changes are saved automatically
3. **Install Dependencies**: In the terminal, run `npm install` to install project dependencies
4. **Start Dev Server**: Run `npm run dev` to start your development server
5. **View Preview**: See your running application in the live preview pane
6. **Get Help**: Click the AI Mentor button to get hints, explanations, debugging help, or code reviews

### Example Workflow

```bash
# In the terminal:
npm install          # Install dependencies
npm run dev          # Start development server
# Your app will appear in the preview pane!
```

## AI Mentor Features

The AI mentor can help you with:

- **💡 Hints**: Get guidance without spoiling the solution
- **📚 Explanations**: Understand concepts and how code works
- **🐛 Debugging**: Identify and fix errors
- **✓ Code Reviews**: Get feedback on code quality and best practices

## Development

### Adding New Project Templates

Edit `components/ProjectSelector.tsx` and add your template to the `projectTemplates` array.

### Customizing the AI Mentor

Edit `app/api/ai/chat/route.ts` to customize the AI prompts and behavior.

### Extending Terminal Functionality

Edit `server/index.js` to add more terminal commands or integrate with Docker containers.

## Production Deployment

For production, you'll want to:

1. Set up Docker containers for each workspace (sandbox isolation)
2. Use a proper terminal implementation (optional: node-pty with Docker exec for production)
3. Set up a reverse proxy for preview URLs
4. Configure proper authentication and authorization
5. Use a production-grade AI API service

## Docker Integration (Optional)

To enable full Docker sandbox functionality:

1. Install Docker Desktop
2. The server will automatically detect Docker and use it for workspace isolation
3. Each workspace will run in its own container

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for learning and building!

## Acknowledgments

- Monaco Editor by Microsoft
- xterm.js for terminal emulation
- Groq for fast AI inference with Llama models

