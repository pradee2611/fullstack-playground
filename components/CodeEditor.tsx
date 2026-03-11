'use client';

import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';

interface CodeEditorProps {
  path: string;
  content: string;
  language: string;
  onChange: (content: string) => void;
}

export default function CodeEditor({ path, content, language, onChange }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-[#2d2d2d] border-b border-[#3e3e3e] text-sm text-[#d4d4d4]">
        {path}
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="vs-dark"
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
