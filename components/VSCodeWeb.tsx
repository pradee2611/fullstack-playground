'use client';

import { useEffect, useRef, useState } from 'react';

interface VSCodeWebProps {
  workspaceId: string;
  onClose?: () => void;
}

export default function VSCodeWeb({ workspaceId, onClose }: VSCodeWebProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeServerUrl, setCodeServerUrl] = useState<string | null>(null);

  useEffect(() => {
    // Start code-server for this workspace
    startCodeServer();
  }, [workspaceId]);

  const startCodeServer = async () => {
    try {
      // In production, you would start code-server in a Docker container
      // For now, we'll use a proxy approach or embed code-server
      // This is a placeholder - actual implementation would:
      // 1. Start code-server in Docker container
      // 2. Expose it via reverse proxy
      // 3. Load the URL in iframe

      // For development, you can use a local code-server instance
      // or integrate with a service like Gitpod's code-server
      const response = await fetch(`http://localhost:3001/api/vscode/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCodeServerUrl(data.url);
        setLoading(false);
      } else {
        // Fallback: Use embedded Monaco editor if code-server not available
        setError('Code-server not available. Using embedded editor instead.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to start code-server:', error);
      setError('Code-server not available. Using embedded editor instead.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#3e3e3e] border-t-[#007acc] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#d4d4d4]">Starting VS Code Web...</p>
        </div>
      </div>
    );
  }

  if (error || !codeServerUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e] p-8">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error || 'VS Code Web is not available'}</p>
          <p className="text-gray-500 text-sm mb-6">
            Note: To enable VS Code Web, you need to:
            <br />
            1. Install code-server in your Docker container
            <br />
            2. Configure the code-server service
            <br />
            3. Set up reverse proxy for code-server URLs
          </p>
          {onClose && (
            <button 
              className="bg-[#3e3e3e] text-[#d4d4d4] px-6 py-2 rounded transition-colors hover:bg-[#4e4e4e]"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="flex justify-between items-center px-4 py-3 bg-[#2d2d2d] border-b border-[#3e3e3e]">
        <div className="flex items-center gap-2">
          <span className="text-xl">📝</span>
          <span className="text-[#d4d4d4] font-medium">VS Code Web</span>
        </div>
        {onClose && (
          <button 
            className="bg-[#3e3e3e] text-[#d4d4d4] px-3 py-1 rounded transition-colors hover:bg-[#4e4e4e]"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={codeServerUrl}
          className="w-full h-full border-none"
          title="VS Code Web"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
