'use client';

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import io, { Socket } from 'socket.io-client';
import { getSocketUrl } from '@/lib/config';

interface TerminalProps {
  workspaceId: string;
}

export default function Terminal({ workspaceId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const xterm = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selection: '#3e3e3e',
        selectionForeground: '#ffffff',
      },
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      enableBell: false,
      rightClickSelectsWord: true,
      wordSeparator: ' ()[]{}"\',;',
      scrollback: 10000, // Allow 10000 lines of scrollback (unlimited scroll)
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    
    xterm.open(terminalRef.current);
    
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Wait for the container to have dimensions before fitting
    const fitTerminal = () => {
      if (terminalRef.current) {
        const { offsetWidth, offsetHeight } = terminalRef.current;
        if (offsetWidth > 0 && offsetHeight > 0) {
          try {
            fitAddon.fit();
          } catch (error) {
            console.warn('Failed to fit terminal:', error);
          }
        }
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitTerminal();
      });
    });

    // Connect to terminal server
    const socket = io(getSocketUrl(), {
      query: { workspaceId },
    });

    socketRef.current = socket;

    // Handle terminal output
    socket.on('output', (data: string) => {
      xterm.write(data);
    });

    // Enable text selection and copying
    xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Allow Ctrl+C for copy when text is selected
      if (event.ctrlKey && event.key === 'c' && xterm.hasSelection()) {
        const selectedText = xterm.getSelection();
        if (selectedText) {
          navigator.clipboard.writeText(selectedText).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = selectedText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
          });
        }
        return false; // Prevent default behavior
      }
      // Allow Ctrl+V for paste
      if (event.ctrlKey && event.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          socket.emit('input', text);
        }).catch(() => {});
        return false;
      }
      return true;
    });

    // Handle terminal input
    xterm.onData((data: string) => {
      socket.emit('input', data);
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        const { offsetWidth, offsetHeight } = terminalRef.current;
        if (offsetWidth > 0 && offsetHeight > 0) {
          try {
            fitAddonRef.current.fit();
            if (socketRef.current && xtermRef.current) {
              socketRef.current.emit('resize', {
                cols: xtermRef.current.cols,
                rows: xtermRef.current.rows,
              });
            }
          } catch (error) {
            console.warn('Failed to resize terminal:', error);
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial resize with delay to ensure container is ready
    const resizeTimeout = setTimeout(handleResize, 200);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, [workspaceId]);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="px-4 py-2 bg-[#2d2d2d] border-b border-[#3e3e3e] text-sm font-medium text-[#d4d4d4]">
        Terminal
      </div>
      <div ref={terminalRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
