'use client';

import { useState, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
// Import CSS statically - CSS can't be dynamically imported
import '@xterm/xterm/css/xterm.css';

// Types will be imported dynamically to avoid SSR issues
type XTerm = any;
type FitAddon = any;
type WebLinksAddon = any;

interface TerminalTab {
  id: string;
  name: string;
  xterm: XTerm | null;
  socket: Socket | null;
  fitAddon: FitAddon | null;
}

interface TerminalTabsProps {
  workspaceId: string;
}

export default function TerminalTabs({ workspaceId }: TerminalTabsProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize first terminal tab
  useEffect(() => {
    if (tabs.length === 0) {
      createNewTab();
    }
  }, []);

  const createNewTab = () => {
    const tabId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tabName = tabs.length === 0 ? 'Terminal' : `Terminal ${tabs.length + 1}`;
    
    const newTab: TerminalTab = {
      id: tabId,
      name: tabName,
      xterm: null,
      socket: null,
      fitAddon: null,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    // Initialize terminal after tab is created
    setTimeout(() => {
      initializeTerminal(newTab, true); // true = is new terminal
    }, 100);
  };

  const initializeTerminal = async (tab: TerminalTab, isNew = false) => {
    // Find the terminal container for this tab
    const terminalContainer = document.getElementById(`terminal-${tab.id}`);
    if (!terminalContainer) {
      // Retry after a short delay if container not found yet
      setTimeout(() => initializeTerminal(tab, isNew), 100);
      return;
    }

    // Dynamically import xterm and addons to avoid SSR issues
    const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-web-links')
    ]);

    // Initialize xterm with VS Code theme
    const xterm = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#aeafad',
        cursorAccent: '#1e1e1e',
        selection: '#264f78',
        selectionForeground: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontWeight: 'normal',
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 1,
      allowProposedApi: true,
      enableBell: false,
      rightClickSelectsWord: true,
      wordSeparator: ' ()[]{}"\',;',
      convertEol: true,
      scrollback: 10000, // Allow 10000 lines of scrollback (unlimited scroll)
      tabStopWidth: 4,
      disableStdin: false, // Allow input
      pasteWithRightClick: false, // Disable right-click paste to avoid conflicts
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    
    xterm.open(terminalContainer);
    
    // Connect to terminal server with unique session ID
    // Dynamically import socket.io-client to avoid SSR issues
    const { default: io } = await import('socket.io-client');
    const { getSocketUrl } = await import('@/lib/config');
    const socket = io(getSocketUrl(), {
      query: { 
        workspaceId, 
        terminalId: tab.id,
        isNewTerminal: isNew ? 'true' : 'false'
      },
    });
    
    // Clear terminal if it's new
    if (isNew) {
      xterm.clear();
    }

    // Handle terminal output with proper formatting
    socket.on('output', (data: string) => {
      // Write directly to xterm - it handles formatting better
      // Only normalize line endings if needed
      let normalized = data;
      if (!data.includes('\r\n') && data.includes('\n')) {
        // Convert \n to \r\n if not already present
        normalized = data.replace(/\n/g, '\r\n');
      }
      xterm.write(normalized);
    });

    // Handle paste with a flag to prevent multiple simultaneous pastes
    let isPasting = false;
    
    const handlePasteText = (text: string) => {
      if (!text || isPasting) return;
      
      isPasting = true;
      // Send the pasted text to the terminal
      socket.emit('input', text);
      
      // Reset flag after a short delay
      setTimeout(() => {
        isPasting = false;
      }, 100);
    };
    
    // Enable text selection and copying, and Ctrl+C to stop processes
    xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Handle Ctrl+C
      if (event.ctrlKey && event.key === 'c') {
        if (xterm.hasSelection()) {
          // If text is selected, copy it
          const selectedText = xterm.getSelection();
          if (selectedText) {
            navigator.clipboard.writeText(selectedText).catch(() => {
              const textArea = document.createElement('textarea');
              textArea.value = selectedText;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand('copy');
              document.body.removeChild(textArea);
            });
          }
          return false;
        } else {
          // If no text selected, send Ctrl+C to stop running process
          socket.emit('input', '\x03');
          return false;
        }
      }
      
      // Handle Ctrl+V for paste
      if (event.ctrlKey && event.key === 'v') {
        event.preventDefault();
        event.stopPropagation();
        
        // Try to read from clipboard
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText()
            .then((text) => {
              if (text) {
                handlePasteText(text);
              }
            })
            .catch((err) => {
              console.warn('Clipboard read failed:', err);
              // Fallback: try to get from paste event if it fires
            });
        } else {
          // Fallback for older browsers - will rely on paste event
          console.warn('Clipboard API not available');
        }
        
        return false;
      }
      
      return true;
    });
    
    // Handle paste events (works for right-click paste and Ctrl+V)
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const pastedText = e.clipboardData?.getData('text/plain') || '';
      if (pastedText) {
        handlePasteText(pastedText);
      }
    };
    
    // Add paste listener with capture phase to intercept before xterm processes it
    terminalContainer.addEventListener('paste', handlePaste, true);
    
    // Also add to xterm element itself as fallback
    const xtermElement = terminalContainer.querySelector('.xterm');
    if (xtermElement) {
      xtermElement.addEventListener('paste', handlePaste, true);
    }

    // Handle terminal input
    xterm.onData((data: string) => {
      socket.emit('input', data);
    });

    // Fit terminal
    const fitTerminal = () => {
      if (terminalContainer) {
        const { offsetWidth, offsetHeight } = terminalContainer;
        if (offsetWidth > 0 && offsetHeight > 0) {
          try {
            fitAddon.fit();
            socket.emit('resize', {
              cols: xterm.cols,
              rows: xterm.rows,
            });
          } catch (error) {
            console.warn('Failed to fit terminal:', error);
          }
        }
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitTerminal();
      });
    });

    // Handle resize
    const handleResize = () => {
      fitTerminal();
    };

    window.addEventListener('resize', handleResize);

    // Update tab with initialized values
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tab.id
          ? {
              ...t,
              xterm,
              socket,
              fitAddon,
            }
          : t
      )
    );

    // Cleanup on tab close
    return () => {
      window.removeEventListener('resize', handleResize);
      terminalContainer.removeEventListener('paste', handlePaste);
      const xtermElement = terminalContainer.querySelector('.xterm');
      if (xtermElement) {
        xtermElement.removeEventListener('paste', handlePaste);
      }
      if (socket) {
        socket.disconnect();
      }
      if (xterm) {
        xterm.dispose();
      }
    };
  };

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (tab) {
        // Disconnect socket first (this will kill processes on server)
        if (tab.socket) {
          tab.socket.emit('terminal-close', { terminalId: tabId });
          tab.socket.disconnect();
        }
        // Dispose terminal
        if (tab.xterm) {
          tab.xterm.dispose();
        }
      }
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      return newTabs;
    });
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Terminal Tabs Header - VS Code Style */}
      <div className="flex items-center bg-[#252526] border-b border-[#3e3e3e] h-9">
        <div className="flex flex-1 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex items-center gap-1.5 px-3 py-1 cursor-pointer border-r border-[#3e3e3e] transition-colors ${
                activeTabId === tab.id
                  ? 'bg-[#1e1e1e] text-[#cccccc] border-b-2 border-b-[#007acc]'
                  : 'bg-[#2d2d2d] text-[#858585] hover:bg-[#2d2d2d] hover:text-[#cccccc]'
              }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              {/* Shell Icon */}
              <svg 
                className="w-3.5 h-3.5 flex-shrink-0" 
                viewBox="0 0 16 16" 
                fill="currentColor"
              >
                <path d="M2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2zm1 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/>
              </svg>
              <span className="text-xs font-medium truncate">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  className="ml-1 text-[#858585] hover:text-[#cccccc] transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center w-4 h-4 rounded hover:bg-[#3e3e3e]"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  title="Close Terminal"
                >
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                    <path d="M12 4L4 12M4 4l8 8" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          className="px-2 py-1 text-[#cccccc] hover:bg-[#3e3e3e] transition-colors flex items-center justify-center h-7 w-7"
          onClick={createNewTab}
          title="New Terminal"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="M8 2v12M2 8h12" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Active Terminal Content */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative bg-[#1e1e1e]">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`terminal-${tab.id}`}
            className={`absolute inset-0 ${activeTabId === tab.id ? 'block' : 'hidden'}`}
          />
        ))}
      </div>
    </div>
  );
}

