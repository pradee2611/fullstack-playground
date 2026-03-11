'use client';

import { useState, useEffect } from 'react';
import io from 'socket.io-client';

interface File {
  id: number;
  file_path: string;
  content: string;
  is_directory: number;
}

interface FileManagerProps {
  projectId: string;
  onSelectFile: (filePath: string, content: string) => void;
  onFileChange: (filePath: string, content: string) => void;
}

export default function FileManager({ projectId, onSelectFile, onFileChange }: FileManagerProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [createPath, setCreatePath] = useState('');
  const [currentDirectory, setCurrentDirectory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
    
    // Connect to socket for file change notifications
    const socket = io('http://localhost:3001', {
      query: { workspaceId: projectId },
    });
    
    socket.on('files-changed', () => {
      loadFiles();
    });
    
    // Auto-refresh every 3 seconds to catch file system changes
    const interval = setInterval(() => {
      loadFiles();
    }, 3000);
    
    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [projectId, currentDirectory]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:3001/api/projects/${projectId}/files?directory=${currentDirectory || ''}`
      );
      const data = await response.json();
      if (data.success) {
        setFiles(data.files || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createPath.trim()) {
      setError('Name is required');
      return;
    }

    try {
      const filePath = currentDirectory ? `${currentDirectory}/${createPath}` : createPath;
      
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: filePath,
          content: createType === 'file' ? '' : undefined,
          is_directory: createType === 'folder',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setCreatePath('');
        loadFiles();
      } else {
        setError(data.error || 'Failed to create');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3001/api/projects/${projectId}/files?file_path=${encodeURIComponent(filePath)}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        loadFiles();
      } else {
        setError(data.error || 'Failed to delete');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileClick = async (file: File) => {
    if (file.is_directory) {
      setCurrentDirectory(file.file_path);
    } else {
      // Load file content - get the file directly
      try {
        const project = await fetch(`http://localhost:3001/api/projects/${projectId}`);
        const projectData = await project.json();
        if (projectData.success) {
          // Find the file in the files array
          const fileData = projectData.files?.find((f: File) => f.file_path === file.file_path);
          if (fileData) {
            onSelectFile(file.file_path, fileData.content || '');
          } else {
            // Try to read from file system as fallback
            const response = await fetch(
              `http://localhost:3001/api/workspace/${projectId}/file?path=${encodeURIComponent(file.file_path)}`
            );
            const data = await response.json();
            if (data.success) {
              onSelectFile(file.file_path, data.content || '');
            }
          }
        }
      } catch (err) {
        console.error('Error loading file:', err);
      }
    }
  };

  const handleBack = () => {
    if (currentDirectory) {
      const parts = currentDirectory.split('/');
      parts.pop();
      setCurrentDirectory(parts.length > 0 ? parts.join('/') : null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#2d2d2d] text-[#d4d4d4]">
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#3e3e3e]">
        <h3 className="m-0 text-sm font-medium">Files</h3>
        <div className="flex gap-2">
          <button
            className="bg-transparent border-none text-xl cursor-pointer px-2 py-1 rounded transition-colors hover:bg-[#3e3e3e]"
            onClick={async () => {
              // Sync file system to database
              try {
                await fetch(`http://localhost:3001/api/projects/${projectId}/sync-from-fs`, {
                  method: 'POST',
                });
                loadFiles();
              } catch (err) {
                console.error('Error syncing:', err);
              }
            }}
            title="Refresh Files"
          >
            🔄
          </button>
          <button
            className="bg-transparent border-none text-xl cursor-pointer px-2 py-1 rounded transition-colors hover:bg-[#3e3e3e]"
            onClick={() => {
              setCreateType('file');
              setShowCreateModal(true);
            }}
            title="Create File"
          >
            📄
          </button>
          <button
            className="bg-transparent border-none text-xl cursor-pointer px-2 py-1 rounded transition-colors hover:bg-[#3e3e3e]"
            onClick={() => {
              setCreateType('folder');
              setShowCreateModal(true);
            }}
            title="Create Folder"
          >
            📁
          </button>
        </div>
      </div>

      {currentDirectory && (
        <div className="flex items-center px-4 py-2 border-b border-[#3e3e3e] gap-2 text-sm">
          <button 
            onClick={handleBack} 
            className="bg-transparent border-none text-[#d4d4d4] cursor-pointer px-2 py-1 rounded transition-colors hover:bg-[#3e3e3e]"
          >
            ← Back
          </button>
          <span className="text-gray-500">{currentDirectory}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 text-sm m-2 rounded">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
        ) : files.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">No files yet. Create a file or folder to get started!</div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="flex justify-between items-center p-2 rounded transition-colors hover:bg-[#3e3e3e]">
              <div
                className="flex-1 cursor-pointer text-sm flex items-center gap-2"
                onClick={() => handleFileClick(file)}
              >
                {file.is_directory ? '📁' : '📄'} {file.file_path.split('/').pop()}
              </div>
              <button
                className="bg-transparent border-none cursor-pointer p-1 opacity-50 transition-opacity hover:opacity-100 hover:scale-110"
                onClick={() => handleDelete(file.file_path)}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-[#2d2d2d] rounded-lg p-6 min-w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="m-0 mb-4 text-[#d4d4d4]">Create {createType === 'file' ? 'File' : 'Folder'}</h4>
            <input
              type="text"
              value={createPath}
              onChange={(e) => setCreatePath(e.target.value)}
              placeholder={createType === 'file' ? 'filename.js' : 'folder-name'}
              className="w-full px-3 py-3 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[#d4d4d4] text-sm mb-4 box-border focus:outline-none focus:border-[#667eea]"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                } else if (e.key === 'Escape') {
                  setShowCreateModal(false);
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={handleCreate} 
                className="px-4 py-2 border-none rounded cursor-pointer text-sm transition-colors bg-[#667eea] text-white hover:bg-[#5568d3]"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border-none rounded cursor-pointer text-sm transition-colors bg-[#3e3e3e] text-[#d4d4d4] hover:bg-[#4e4e4e]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
