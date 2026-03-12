'use client';

import { useState, useEffect } from 'react';
import { ProjectTemplate } from '@/types';
import CustomProjectCreator from './CustomProjectCreator';

const projectTemplates: ProjectTemplate[] = [
  {
    id: 'react-app',
    name: 'React App',
    description: 'A modern React application with Vite',
    language: 'javascript',
    files: {
      'package.json': JSON.stringify({
        name: 'my-react-app',
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          vite: '^5.0.0',
          '@vitejs/plugin-react': '^4.2.0',
        },
      }, null, 2),
      'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || process.env.PORT || '3000'),
    host: true
  }
})`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
      'src': {
        'main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        'App.jsx': `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>React App</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
    </div>
  )
}

export default App`,
        'App.css': `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.card {
  padding: 2em;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}`,
        'index.css': `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}`,
      },
    },
    port: 3000,
    startCommand: 'npm run dev',
  },
  {
    id: 'vanilla-html',
    name: 'HTML/CSS/JS',
    description: 'A simple HTML page with CSS and JavaScript',
    language: 'html',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Project</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to My Project</h1>
        <p>This is a simple HTML/CSS/JS project.</p>
        <button id="clickBtn">Click Me!</button>
        <p id="output"></p>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
      'style.css': `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    text-align: center;
    max-width: 500px;
}

h1 {
    color: #333;
    margin-bottom: 1rem;
}

p {
    color: #666;
    margin-bottom: 1.5rem;
}

button {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    font-size: 1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

#output {
    margin-top: 1rem;
    font-weight: 500;
    color: #667eea;
}`,
      'script.js': `document.getElementById('clickBtn').addEventListener('click', function() {
    const output = document.getElementById('output');
    const count = parseInt(output.textContent) || 0;
    output.textContent = count + 1;
});`,
    },
    port: 8080,
    startCommand: 'python -m http.server 8080',
  },
  {
    id: 'node-api',
    name: 'Node.js API',
    description: 'A simple Express.js REST API',
    language: 'javascript',
    files: {
      'package.json': JSON.stringify({
        name: 'my-api',
        version: '1.0.0',
        type: 'module',
        scripts: {
          start: 'node server.js',
          dev: 'node --watch server.js',
        },
        dependencies: {
          express: '^4.18.2',
          cors: '^2.8.5',
        },
      }, null, 2),
      'server.js': `import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API!' });
});

app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ]);
});

app.post('/api/users', (req, res) => {
  const { name } = req.body;
  res.json({ id: Date.now(), name, message: 'User created!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,
    },
    port: 3000,
    startCommand: 'npm run dev',
  },
];

interface ProjectSelectorProps {
  onSelectProject: (project: ProjectTemplate) => void;
  user?: { id: string; email: string; name: string };
  sessionId?: string | null;
  onLogout?: () => void;
}

export default function ProjectSelector({ onSelectProject, user, sessionId, onLogout }: ProjectSelectorProps) {
  const [showGitHubInput, setShowGitHubInput] = useState(false);
  const [showCustomProject, setShowCustomProject] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingProjects, setExistingProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ projectId: string; projectName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Load existing projects if user is logged in
    if (user && sessionId) {
      loadExistingProjects();
    } else {
      setLoadingProjects(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionId]);

  const loadExistingProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('http://localhost:3001/api/projects', {
        headers: {
          'x-session-id': sessionId || '',
        },
      });
      const data = await response.json();
      if (data.success) {
        setExistingProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSelectExistingProject = (project: any) => {
    const projectTemplate: ProjectTemplate = {
      id: project.id,
      name: project.name,
      description: project.description || '',
      language: project.tech_stack || 'custom',
      files: {}, // Files will be loaded from database
      repoUrl: undefined,
    };
    onSelectProject(projectTemplate);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: any) => {
    e.stopPropagation(); // Prevent triggering the project select
    setDeleteConfirm({ projectId: project.id, projectName: project.name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${deleteConfirm.projectId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove project from list
        setExistingProjects(prev => prev.filter(p => p.id !== deleteConfirm.projectId));
        setDeleteConfirm(null);
      } else {
        setError(data.error || 'Failed to delete project');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const handleGitHubClone = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate and get repo info
      const infoResponse = await fetch(`http://localhost:3001/api/github/repo?url=${encodeURIComponent(repoUrl)}`);
      const infoData = await infoResponse.json();

      if (!infoData.success) {
        throw new Error(infoData.error || 'Failed to get repository info');
      }

      // Create workspace and clone
      const workspaceId = `workspace-${Date.now()}`;
      const cloneResponse = await fetch('http://localhost:3001/api/github/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          workspaceId,
          branch: 'main',
        }),
      });

      const cloneData = await cloneResponse.json();

      if (!cloneData.success) {
        throw new Error(cloneData.error || 'Failed to clone repository');
      }

      // Create project template from cloned repo
      const project: ProjectTemplate = {
        id: `github-${infoData.owner}-${infoData.repo}`,
        name: infoData.name || infoData.repo,
        description: infoData.description || `Cloned from ${repoUrl}`,
        language: infoData.language || 'unknown',
        files: {}, // Files will be loaded from file system
        repoUrl,
        repoInfo: infoData,
      };

      onSelectProject(project);
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository');
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex relative"
      style={{
        backgroundImage: 'url(/premium_photo-1677705035709-367cad11ce9f.avif)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Left Content Area - All content on left side */}
      <div className="w-3/5 px-8 py-8 flex flex-col mt-28">
        {/* Header Section */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-black mb-2 drop-shadow-lg">Cloud Workspace Platform</h1>
            {user && (
              <p className="text-black/95 text-lg font-medium">
                Welcome back, <span className="font-semibold">{user.name || user.email}</span>!
              </p>
            )}
          </div>
          {user && (
            <div className="flex gap-3">
              <a
                href="/dashboard"
                className="bg-white/15 hover:bg-white/25 backdrop-blur-md text-black px-3 py-2 rounded-xl transition-all flex items-center gap-2 font-medium shadow-lg hover:shadow-xl border border-white/20"
              >
                <span className="text-lg">📊</span>
                Dashboard
              </a>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="bg-white/15 hover:bg-white/25 backdrop-blur-md text-black px-3 py-2 rounded-xl transition-all font-medium shadow-lg hover:shadow-xl border border-white/20"
                >
                  Logout
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Content Container */}
        <div className="flex-1 flex flex-col">
          {/* Create Project Section */}
          <div className="mb-6">
            <button
              className="w-full bg-gradient-to-r from-white/20 to-white/10 hover:from-white/30 hover:to-white/20 backdrop-blur-lg border-2 border-white/40 border-dashed rounded-2xl p-2 cursor-pointer transition-all flex items-center justify-center gap-4 text-lg font-bold text-black hover:shadow-2xl hover:scale-[1.02] group"
              onClick={() => setShowCustomProject(true)}
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">✨</span>
              <span>Create New Project</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>

          {/* Projects Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-black">Your Projects</h2>
              {existingProjects.length > 0 && (
                <span className="text-black/70 text-sm bg-white/10 px-3 py-1 rounded-full">
                  {existingProjects.length} {existingProjects.length === 1 ? 'project' : 'projects'}
                </span>
              )}
            </div>

            {/* Scrollable Projects List */}
            <div className="flex-1 overflow-y-auto pr-2 projects-scrollbar">
              {loadingProjects ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-black/80 text-lg">Loading projects...</p>
                  </div>
                </div>
              ) : existingProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {existingProjects.map((project) => (
                    <div
                      key={project.id}
                      className="bg-white/15 hover:bg-white/25 backdrop-blur-lg rounded-2xl p-2 transition-all cursor-pointer border border-white/30 hover:border-white/50 hover:shadow-2xl hover:scale-[1] relative group"
                      onClick={() => handleSelectExistingProject(project)}
                    >
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteClick(e, project)}
                        className="absolute top-4 right-4 text-black/70 hover:text-red-400 hover:bg-red-500/20 transition-all p-2 rounded-lg opacity-0 group-hover:opacity-100"
                        title="Delete project"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      
                      {/* Project Icon/Emoji */}
                      <div className="mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400/30 to-blue-500/30 rounded-xl flex items-center justify-center text-2xl mb-3">
                          📁
                        </div>
                        <h3 className="text-black font-bold text-xl mb-2 pr-8">{project.name}</h3>
                        <p className="text-black/80 text-sm mb-4 line-clamp-2 leading-relaxed">
                          {project.description || project.problem_statement || 'No description available'}
                        </p>
                      </div>

                      {/* Tech Stack & Date */}
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/20">
                        {project.tech_stack && (
                          <span className="bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-black px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/20">
                            {project.tech_stack}
                          </span>
                        )}
                        <span className="text-black/60 text-xs font-medium">
                          {new Date(project.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectExistingProject(project);
                          }}
                          className="flex-1 bg-gradient-to-r from-cyan-500/40 to-blue-500/40 hover:from-cyan-500/60 hover:to-blue-500/60 text-black px-4 py-2.5 rounded-xl text-sm font-semibold transition-all backdrop-blur-sm border border-white/30 hover:shadow-lg"
                        >
                          Open Project
                        </button>
                        <a
                          href={`/dashboard?project=${project.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-white/15 hover:bg-white/25 text-black px-4 py-2.5 rounded-xl text-sm font-semibold transition-all backdrop-blur-sm border border-white/30 hover:shadow-lg text-center inline-flex items-center justify-center gap-2"
                        >
                          <span>📊</span>
                          Feedback
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center border border-white/20">
                  <div className="text-6xl mb-4">🚀</div>
                  <p className="text-black font-semibold text-xl mb-2">No projects yet</p>
                  <p className="text-black/70 text-base mb-6">Get started by creating your first project</p>
                  <button
                    onClick={() => setShowCustomProject(true)}
                    className="bg-gradient-to-r from-cyan-500/40 to-blue-500/40 hover:from-cyan-500/60 hover:to-blue-500/60 text-black px-6 py-3 rounded-xl font-semibold transition-all backdrop-blur-sm border border-white/30 hover:shadow-lg"
                  >
                    Create Your First Project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Space - 2/5 for background visibility */}
      <div className="w-2/5"></div>

      {/* GitHub Clone Section */}
      {/* <div className="mb-12 w-full max-w-2xl">
        {!showGitHubInput ? (
          <button
            className="w-full bg-white/95 border-2 border-dashed border-[#667eea] rounded-xl p-6 cursor-pointer transition-all flex items-center justify-center gap-3 text-lg font-medium text-[#667eea] hover:bg-white hover:border-[#764ba2] hover:-translate-y-0.5 hover:shadow-lg"
            onClick={() => setShowGitHubInput(true)}
          >
            <span className="text-2xl">🐙</span>
            Clone from GitHub
          </button>
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <input
              type="text"
              placeholder="https://github.com/username/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGitHubClone()}
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base mb-4 transition-colors focus:outline-none focus:border-[#667eea] disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <div className="flex gap-3">
              <button
                onClick={handleGitHubClone}
                disabled={loading || !repoUrl.trim()}
                className="flex-1 bg-[#667eea] text-white px-6 py-3 rounded-lg text-base font-medium transition-all hover:bg-[#5568d3] hover:-translate-y-0.5 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Cloning...' : 'Clone'}
              </button>
              <button
                onClick={() => {
                  setShowGitHubInput(false);
                  setRepoUrl('');
                  setError(null);
                }}
                disabled={loading}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg text-base font-medium transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          </div>
        )}
      </div> */}

      {/* Templates Section */}
      {/* <div className="w-full max-w-6xl">
        <h2 className="text-white text-2xl mb-6 text-center">Or choose a template:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projectTemplates.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl p-8 cursor-pointer transition-all shadow-md hover:-translate-y-2 hover:shadow-2xl"
              onClick={() => onSelectProject(project)}
            >
              <h2 className="text-gray-800 mb-2 text-2xl">{project.name}</h2>
              <p className="text-gray-600 mb-4 leading-relaxed">{project.description}</p>
              <div className="inline-block bg-[#667eea] text-white px-3 py-1 rounded-full text-sm font-medium">
                {project.language}
              </div>
            </div>
          ))}
        </div>
      </div> */}

      {showCustomProject && (
        <CustomProjectCreator
          onCreateProject={(project) => {
            setShowCustomProject(false);
            onSelectProject(project);
          }}
          onCancel={() => setShowCustomProject(false)}
          sessionId={sessionId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 rounded-full p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-red-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Delete Project</h3>
            </div>
            
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete <strong className="text-gray-800">&ldquo;{deleteConfirm.projectName}&rdquo;</strong>?
            </p>
            <p className="text-red-600 text-sm font-medium mb-6">
              ⚠️ Every data will be deleted. This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                No, Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
