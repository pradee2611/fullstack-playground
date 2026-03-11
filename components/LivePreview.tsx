'use client';

import { useEffect, useRef, useState } from 'react';

interface LivePreviewProps {
  url: string | null;
  onClose?: () => void;
}

export default function LivePreview({ url, onClose }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentUrl, setCurrentUrl] = useState<string>(url || '');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    if (url) {
      setCurrentUrl(url);
      if (iframeRef.current) {
        iframeRef.current.src = url;
      }
    }
  }, [url]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentUrl(e.target.value);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToUrl(currentUrl);
  };

  const navigateToUrl = (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    
    // Add http:// if no protocol specified
    let finalUrl = targetUrl.trim();
    if (!finalUrl.match(/^https?:\/\//)) {
      finalUrl = `http://${finalUrl}`;
    }
    
    setCurrentUrl(finalUrl);
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = finalUrl;
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleBack = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.back();
      } catch (e) {
        console.error('Cannot navigate back:', e);
      }
    }
  };

  const handleForward = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.forward();
      } catch (e) {
        console.error('Cannot navigate forward:', e);
      }
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    if (iframeRef.current?.contentWindow) {
      try {
        const iframeUrl = iframeRef.current.contentWindow.location.href;
        setCurrentUrl(iframeUrl);
      } catch (e) {
        // Cross-origin, can't access URL
      }
    }
  };

  if (!url && !currentUrl) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-[#3e3e3e]">
        <div className="flex items-center gap-2 p-2 bg-[#2d2d2d] border-b border-[#3e3e3e] min-h-[48px]">
          <div className="flex gap-1">
            <button className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-2.5 py-1.5 rounded text-base transition-all hover:bg-[#4e4e4e] hover:scale-105 min-w-[32px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed" disabled title="Back">←</button>
            <button className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-2.5 py-1.5 rounded text-base transition-all hover:bg-[#4e4e4e] hover:scale-105 min-w-[32px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed" disabled title="Forward">→</button>
            <button className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-2.5 py-1.5 rounded text-base transition-all hover:bg-[#4e4e4e] hover:scale-105 min-w-[32px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed" disabled title="Refresh">🔄</button>
          </div>
          <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center gap-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1 transition-colors focus-within:border-[#007acc]">
            <input
              type="text"
              value={currentUrl}
              onChange={handleUrlChange}
              placeholder="Enter URL or start dev server..."
              className="flex-1 bg-transparent border-none text-[#d4d4d4] text-sm outline-none px-0 py-1 placeholder:text-gray-600"
            />
          </form>
          {onClose && (
            <button className="bg-[#f44336] border-none text-white px-2.5 py-1.5 rounded text-sm font-medium transition-all hover:bg-[#d32f2f] hover:scale-105 min-w-[32px] flex items-center justify-center" onClick={onClose} title="Close Preview">
              ✕
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-center p-8">
          <p>Preview will appear here</p>
          <p className="mt-4 text-sm text-gray-600">Start your development server or enter a URL</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-[#3e3e3e]">
      <div className="flex items-center gap-2 p-2 bg-[#2d2d2d] border-b border-[#3e3e3e] min-h-[48px]">
        <div className="flex gap-1">
          <button 
            className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-2.5 py-1.5 rounded text-base transition-all hover:bg-[#4e4e4e] hover:scale-105 min-w-[32px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleBack}
            disabled={!canGoBack}
            title="Back"
          >
            ←
          </button>
          <button 
            className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-2.5 py-1.5 rounded text-base transition-all hover:bg-[#4e4e4e] hover:scale-105 min-w-[32px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleForward}
            disabled={!canGoForward}
            title="Forward"
          >
            →
          </button>
          <button 
            className="bg-[#3e3e3e] border-none text-[#d4d4d4] px-2.5 py-1.5 rounded text-base transition-all hover:bg-[#4e4e4e] hover:scale-105 min-w-[32px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh"
          >
            {isLoading ? '⏳' : '🔄'}
          </button>
        </div>
        <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center gap-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1 transition-colors focus-within:border-[#007acc]">
          <input
            type="text"
            value={currentUrl}
            onChange={handleUrlChange}
            placeholder="Enter URL..."
            className="flex-1 bg-transparent border-none text-[#d4d4d4] text-sm outline-none px-0 py-1 placeholder:text-gray-600"
          />
          <button type="submit" className="bg-[#007acc] border-none text-white px-2 py-1 rounded text-sm transition-colors hover:bg-[#005a9e] min-w-[28px]" title="Go">
            →
          </button>
        </form>
        {onClose && (
          <button className="bg-[#f44336] border-none text-white px-2.5 py-1.5 rounded text-sm font-medium transition-all hover:bg-[#d32f2f] hover:scale-105 min-w-[32px] flex items-center justify-center" onClick={onClose} title="Close Preview">
            ✕
          </button>
        )}
      </div>
      <div className="flex-1 relative overflow-hidden bg-white">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(30,30,30,0.8)] text-[#d4d4d4] z-10 gap-4">
            <div className="w-8 h-8 border-4 border-[#3e3e3e] border-t-[#007acc] rounded-full animate-spin"></div>
            <span>Loading...</span>
          </div>
        )}
        <iframe
          id="preview-iframe"
          ref={iframeRef}
          className="w-full h-full border-none bg-white"
          title="Live Preview"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}
