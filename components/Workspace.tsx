'use client';

import { useState, useEffect } from 'react';
import CodeEditor from './CodeEditor';
import TerminalTabs from './TerminalTabs';
import LivePreview from './LivePreview';
import AIMentor from './AIMentor';
import FileManager from './FileManager';
import DependencyManager from './DependencyManager';
import { ProjectTemplate, FileStructure } from '@/types';

interface WorkspaceProps {
  workspaceId: string;
  project: ProjectTemplate;
  onCloseProject: () => void;
}

export default function Workspace({ workspaceId, project, onCloseProject }: WorkspaceProps) {
  const [files, setFiles] = useState<FileStructure>(project.files || {});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [isCustomProject, setIsCustomProject] = useState(!project.files || Object.keys(project.files).length === 0);
  const [projectDetails, setProjectDetails] = useState<any>(null);

  // For database projects, use project.id as workspaceId
  const effectiveWorkspaceId = isCustomProject && project.id ? project.id : workspaceId;

  useEffect(() => {
    // For custom projects, load files and project details from database
    if (isCustomProject && project.id) {
      loadProjectFiles();
      loadProjectDetails();

      // Trigger agentic AI agents on project open (if enabled)
      triggerAgentsOnOpen(project.id);

      // Set up periodic auto-sync from file system to database (every 30 seconds)
      const syncInterval = setInterval(async () => {
        try {
          await fetch(`http://localhost:3001/api/projects/${project.id}/sync-from-fs`, {
            method: 'POST',
          });
        } catch (error) {
          // Silently fail - file system might not exist yet
        }
      }, 30000); // Every 30 seconds

      return () => clearInterval(syncInterval);
    } else {
      // For template projects, use existing logic
      const firstFile = findFirstFile(files);
      if (firstFile) {
        setActiveFile(firstFile);
      }
      startPreviewServer();
    }
  }, [project.id, isCustomProject]);

  const triggerAgentsOnOpen = async (projectId: string) => {
    try {
      // Get agent preferences
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) return;

      const prefsResponse = await fetch(`http://localhost:3001/api/projects/${projectId}/agent-preferences`, {
        headers: { 'x-session-id': sessionId },
      });
      const prefsData = await prefsResponse.json();

      if (prefsData.success) {
        const preferences = prefsData.preferences || [];

        // Check if learning feedback agent is enabled and set to auto
        const learningPref = preferences.find((p: any) => p.agent_name === 'learning-feedback' && p.enabled && p.trigger_mode === 'auto');
        if (learningPref) {
          // Trigger learning feedback generation
          setTimeout(async () => {
            try {
              await fetch('/api/ai/learning-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  projectId,
                  files,
                  problemStatement: projectDetails?.problem_statement,
                }),
              });
            } catch (error) {
              console.error('Error triggering learning feedback:', error);
            }
          }, 5000); // Wait 5 seconds after project opens
        }

        // Check if progress tracker is enabled and set to auto
        const progressPref = preferences.find((p: any) => p.agent_name === 'progress-tracker' && p.enabled && p.trigger_mode === 'auto');
        if (progressPref) {
          // Trigger progress tracking
          setTimeout(async () => {
            try {
              await fetch('/api/ai/progress-tracker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  projectId,
                  problemStatement: projectDetails?.problem_statement,
                  files,
                  techStack: projectDetails?.tech_stack,
                }),
              });
            } catch (error) {
              console.error('Error triggering progress tracker:', error);
            }
          }, 7000); // Wait 7 seconds after project opens
        }
      }
    } catch (error) {
      console.error('Error checking agent preferences:', error);
    }
  };

  const loadProjectDetails = async () => {
    if (!project.id) return;
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${project.id}`);
      const data = await response.json();
      if (data.success && data.project) {
        setProjectDetails(data.project);
      }
    } catch (error) {
      console.error('Error loading project details:', error);
    }
  };

  const findFirstFile = (fileStructure: FileStructure): string | null => {
    for (const [path, content] of Object.entries(fileStructure)) {
      if (typeof content === 'string') {
        return path;
      } else {
        const nested = findFirstFile(content);
        if (nested) return nested;
      }
    }
    return null;
  };

  const startPreviewServer = async () => {
    try {
      // For custom projects, sync database to file system first
      if (isCustomProject && project.id) {
        await fetch(`http://localhost:3001/api/projects/${project.id}/sync`, {
          method: 'POST',
        });
      }

      // First, initialize workspace on server
      await fetch('http://localhost:3001/api/workspace/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: effectiveWorkspaceId, project }),
      });

      // Then start preview server
      const response = await fetch('http://localhost:3001/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: effectiveWorkspaceId, project }),
      });
      const data = await response.json();
      if (data.url) {
        setPreviewUrl(data.url);
      }
    } catch (error) {
      console.error('Failed to start preview server:', error);
    }
  };

  const loadProjectFiles = async () => {
    try {
      // First, sync file system to database to ensure we have latest files
      await fetch(`http://localhost:3001/api/projects/${project.id}/sync-from-fs`, {
        method: 'POST',
      }).catch(() => {
        // Ignore errors - file system might not exist yet
      });

      // Then load files structure from database
      const response = await fetch(`http://localhost:3001/api/projects/${project.id}/files-structure`);
      const data = await response.json();
      if (data.success && data.files) {
        setFiles(data.files);

        // Set first file as active if available
        const firstFile = findFirstFile(data.files);
        if (firstFile) {
          setActiveFile(firstFile);
        }
      } else {
        // Fallback: try old endpoint
        const oldResponse = await fetch(`http://localhost:3001/api/projects/${project.id}`);
        const oldData = await oldResponse.json();
        if (oldData.success && oldData.files) {
          // Convert files array to nested FileStructure
          const fileStructure: FileStructure = {};
          oldData.files.forEach((file: any) => {
            if (!file.is_directory) {
              const parts = file.file_path.split('/');
              let current: any = fileStructure;
              for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) {
                  current[parts[i]] = {};
                }
                current = current[parts[i]];
              }
              current[parts[parts.length - 1]] = file.content || '';
            }
          });
          setFiles(fileStructure);

          const firstFile = findFirstFile(fileStructure);
          if (firstFile) {
            setActiveFile(firstFile);
          }
        }
      }
    } catch (error) {
      console.error('Error loading project files:', error);
    }
  };

  const handleFileSelect = async (filePath: string, content: string) => {
    setActiveFile(filePath);
    setActiveFileContent(content);
  };

  const handleFileChange = async (path: string, content: string) => {
    // Update local state
    setActiveFileContent(content);

    // For custom projects, save to database
    if (isCustomProject && project.id) {
      try {
        await fetch(`http://localhost:3001/api/projects/${project.id}/files`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: path, content }),
        });
      } catch (error) {
        console.error('Error saving file:', error);
      }
    }
    const updateFile = (structure: FileStructure, targetPath: string, newContent: string): FileStructure => {
      const newStructure = { ...structure };
      const parts = targetPath.split('/');
      const fileName = parts[parts.length - 1];
      const dirPath = parts.slice(0, -1).join('/');

      if (parts.length === 1) {
        newStructure[fileName] = newContent;
      } else {
        let current: any = newStructure;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        current[fileName] = newContent;
      }
      return newStructure;
    };

    // Update local state
    setFiles(prev => updateFile(prev, path, content));

    // Save to server file system (for template projects)
    if (!isCustomProject) {
      try {
        await fetch(`http://localhost:3001/api/workspace/${effectiveWorkspaceId}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, content }),
        });
      } catch (error) {
        console.error('Failed to save file:', error);
      }
    }

    // Trigger preview refresh after a short delay
    setTimeout(() => {
      if (previewUrl) {
        const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
        if (iframe) {
          iframe.src = iframe.src;
        }
      }
    }, 500);
  };

  const getFileContent = (path: string): string => {
    const parts = path.split('/');
    let current: any = files;
    for (const part of parts) {
      if (current[part] === undefined) return '';
      current = current[part];
    }
    return typeof current === 'string' ? current : '';
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4]">
      <header className="flex justify-between items-center px-4 py-3 bg-[#2d2d2d] border-b border-[#3e3e3e] h-12">
        <div className="flex items-center gap-4">
          <button
            className="bg-transparent border-none text-[#d4d4d4] text-xl cursor-pointer px-2 py-1 rounded hover:bg-[#3e3e3e] transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1 className="text-base font-medium m-0">{project.name}</h1>
        </div>
        <div className="flex gap-2 items-center">
          <AIMentor
            workspaceId={effectiveWorkspaceId}
            files={files}
            activeFile={activeFile}
            project={isCustomProject && project.id && projectDetails ? {
              id: project.id,
              name: projectDetails.name || project.name,
              problem_statement: projectDetails.problem_statement,
              tech_stack: projectDetails.tech_stack || project.language,
            } : undefined}
          />
          <button
            className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-3 py-2 rounded text-xl transition-all hover:bg-[#4e4e4e] hover:scale-105 flex items-center justify-center"
            onClick={() => setPreviewOpen(!previewOpen)}
            title={previewOpen ? 'Hide Preview' : 'Show Preview'}
          >
            🌐
          </button>
          <button
            className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-3 py-2 rounded text-xl transition-all hover:bg-[#4e4e4e] hover:scale-105 flex items-center justify-center"
            onClick={() => setTerminalOpen(!terminalOpen)}
            title={terminalOpen ? 'Hide Terminal' : 'Show Terminal'}
          >
            💻
          </button>
          <button
            className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-4 py-2 rounded cursor-pointer transition-colors hover:bg-[#4e4e4e]"
            onClick={onCloseProject}
          >
            Close Project
          </button>
        </div>
      </header>

      <div className={`flex flex-1 overflow-hidden flex-col ${isResizing ? 'select-none' : ''}`}>
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {sidebarOpen && (
            <aside className="w-[250px] bg-[#252526] border-r border-[#3e3e3e] overflow-y-auto flex-shrink-0 scrollbar-thin">
              {isCustomProject ? (
                <>
                  {/* <DependencyManager projectId={project.id} /> */}
                  <FileManager
                    projectId={project.id}
                    onSelectFile={handleFileSelect}
                    onFileChange={handleFileChange}
                  />
                </>
              ) : (
                <FileTree
                  files={files}
                  activeFile={activeFile}
                  onSelectFile={setActiveFile}
                />
              )}
            </aside>
          )}

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeFile ? (
                <CodeEditor
                  path={activeFile}
                  content={isCustomProject ? activeFileContent : getFileContent(activeFile)}
                  language={getLanguageFromPath(activeFile)}
                  onChange={(content) => handleFileChange(activeFile, content)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#858585] text-center">
                  {isCustomProject ? (
                    <div>
                      <h3 className="m-0 mb-2 text-[#d4d4d4]">No file selected</h3>
                      <p className="m-0 text-sm">Create a file or folder to get started!</p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="m-0 mb-2 text-[#d4d4d4]">No file selected</h3>
                      <p className="m-0 text-sm">Select a file from the sidebar to start editing.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview Panel (Right Side) */}
            {previewOpen && (
              <div className="w-1/2 border-l border-[#3e3e3e] bg-[#1e1e1e] overflow-hidden">
                <LivePreview
                  url={previewUrl}
                  onClose={() => setPreviewOpen(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Terminal at Bottom (VS Code Style) */}
        {terminalOpen && (
          <>
            {/* Resize Handle */}
            <div
              className="h-1 bg-[#3e3e3e] cursor-row-resize hover:bg-[#007acc] transition-colors relative group"
              onMouseDown={(e) => {
                setIsResizing(true);
                const startY = e.clientY;
                const startHeight = terminalHeight;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaY = startY - moveEvent.clientY; // Inverted because we're dragging up
                  const newHeight = Math.max(150, Math.min(600, startHeight + deltaY));
                  setTerminalHeight(newHeight);
                };

                const handleMouseUp = () => {
                  setIsResizing(false);
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-0.5 bg-[#555] group-hover:bg-[#007acc] transition-colors"></div>
              </div>
            </div>
            <div
              className="border-t border-[#3e3e3e] bg-[#1e1e1e] flex-shrink-0 overflow-hidden flex flex-col"
              style={{ height: `${terminalHeight}px` }}
            >
              <TerminalTabs workspaceId={effectiveWorkspaceId} />
            </div>
          </>
        )}
      </div>

    </div>
  );
}

function FileTree({
  files,
  activeFile,
  onSelectFile,
}: {
  files: FileStructure;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const renderTree = (structure: FileStructure, prefix = ''): JSX.Element[] => {
    const items: JSX.Element[] = [];

    Object.entries(structure).forEach(([name, content]) => {
      const path = prefix ? `${prefix}/${name}` : name;
      const isActive = activeFile === path;

      if (typeof content === 'string') {
        items.push(
          <div
            key={path}
            className={`p-2 cursor-pointer rounded text-sm transition-colors hover:bg-[#2a2d2e] ${isActive ? 'bg-[#094771]' : ''
              }`}
            onClick={() => onSelectFile(path)}
          >
            📄 {name}
          </div>
        );
      } else {
        items.push(
          <div key={path} className="my-1">
            <div className="p-2 font-medium text-sm">📁 {name}</div>
            <div className="pl-4">
              {renderTree(content, path)}
            </div>
          </div>
        );
      }
    });

    return items;
  };

  return <div className="p-2">{renderTree(files)}</div>;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: { [key: string]: string } = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
  };
  return languageMap[ext || ''] || 'plaintext';
}

