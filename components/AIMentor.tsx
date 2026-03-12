'use client';

import { useState, useRef, useEffect } from 'react';
import { AIMessage, FileStructure } from '@/types';

interface AIMentorProps {
  workspaceId: string;
  files: FileStructure;
  activeFile: string | null;
  project?: {
    id: string;
    name: string;
    problem_statement?: string;
    tech_stack?: string;
  };
}

interface ReasoningPlan {
  step: number;
  action: string;
  reasoning: string;
  tool?: string;
  parameters?: any;
  status: 'planned' | 'executing' | 'completed' | 'failed';
  result?: string;
}

export default function AIMentor({ workspaceId, files, activeFile, project }: AIMentorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content: project?.problem_statement 
        ? `🤖 **Agentic AI Mentor Activated**\n\nI'm your autonomous AI agent. I'll help you build: "${project.problem_statement}".\n\nI can:\n- 🧠 **Plan** your project automatically\n- 🔧 **Execute** actions (with your approval)\n- 📚 **Explain** code automatically\n- ✓ **Review** and validate your work\n- 💡 **Suggest** next steps proactively\n\nClick "Start Agentic Reasoning" to begin!`
        : "🤖 **Agentic AI Mentor**\n\nI'm your autonomous AI agent. I can plan, execute, explain, review, and suggest next steps automatically!",
      type: 'explanation',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoExplaining, setIsAutoExplaining] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [reasoningPlan, setReasoningPlan] = useState<ReasoningPlan[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastActiveFileRef = useRef<string | null>(null);
  const lastFileContentRef = useRef<string>('');
  
  // View state: 'project' or 'feedback'
  const [currentView, setCurrentView] = useState<'project' | 'feedback'>('project');
  const [feedback, setFeedback] = useState<any[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  
  // Resizable width state
  const [width, setWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai-mentor-width');
      return saved ? parseInt(saved, 10) : 400;
    }
    return 400;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX - 16; // 16px for right margin
      const minWidth = 300;
      const maxWidth = Math.min(window.innerWidth - 100, 1200);
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai-mentor-width', width.toString());
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, width]);

  // Auto-explain when file changes (with debounce)
  useEffect(() => {
    if (activeFile && activeFile !== lastActiveFileRef.current && files) {
      const getFileContent = (fileStructure: FileStructure, path: string): string => {
        const parts = path.split('/');
        let current: any = fileStructure;
        for (const part of parts) {
          if (current[part] === undefined) return '';
          current = current[part];
        }
        return typeof current === 'string' ? current : '';
      };

      const fileContent = getFileContent(files, activeFile);
      
      // Only auto-explain if file has meaningful content and is different from last
      if (fileContent && fileContent !== lastFileContentRef.current && fileContent.trim().length > 50) {
        lastActiveFileRef.current = activeFile;
        lastFileContentRef.current = fileContent;
        
        // Debounce auto-explanation to avoid too many requests
        const timeoutId = setTimeout(() => {
          autoExplainCode(activeFile, fileContent);
        }, 2000); // Wait 2 seconds after file change
        
        return () => clearTimeout(timeoutId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, files]);

  const autoExplainCode = async (filePath: string, fileContent: string) => {
    if (!project?.id || isAutoExplaining) return;
    
    setIsAutoExplaining(true);
    try {
      const response = await fetch('/api/ai/auto-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          filePath,
          fileContent,
          problemStatement: project.problem_statement,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.explanation) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `📚 **Auto-Explanation for ${filePath}:**\n\n${data.explanation}`,
            type: 'explanation',
          },
        ]);
      }
    } catch (error) {
      console.error('Error in auto-explain:', error);
    } finally {
      setIsAutoExplaining(false);
    }
  };

  const handleAutoReview = async () => {
    if (!project?.id || isReviewing) return;
    
    setIsReviewing(true);
    try {
      // Ensure we have latest files - sync from file system first
      await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/sync-from-fs`, {
        method: 'POST',
      }).catch(() => {});
      
      const response = await fetch('/api/ai/auto-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          files, // Send current files, API will fetch from DB if needed
          problemStatement: project.problem_statement,
          techStack: project.tech_stack,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.review) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `✓ **Code Review:**\n\n${data.review}`,
            type: 'review',
          },
        ]);
      }
    } catch (error) {
      console.error('Error in auto-review:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error while reviewing your code. Please try again.',
          type: 'review',
        },
      ]);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleMultiStepValidate = async () => {
    if (!project?.id || isValidating) return;
    
    setIsValidating(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/sync-from-fs`, {
        method: 'POST',
      }).catch(() => {});

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '🔄 **Multi-Step Validation Started**\n\nSplitting codebase into chunks and validating each part...',
          type: 'review',
        },
      ]);

      const response = await fetch('/api/ai/multi-step-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          files,
          problemStatement: project.problem_statement,
          techStack: project.tech_stack,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.validation) {
        const { validation } = data;
        const statusEmoji = validation.overall_status === 'complete' ? '✅' : 
                           validation.overall_status === 'error' ? '❌' : '⚠️';
        
        // Save validation feedback to database
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              feedback_type: 'validation',
              feedback_data: {
                overall_status: validation.overall_status,
                total_chunks: validation.total_chunks,
                total_files: validation.total_files,
                complete_files: validation.complete_files,
                incomplete_files: validation.incomplete_files,
                error_files: validation.error_files,
                average_completeness: validation.average_completeness,
                overall_feedback: validation.feedback || `Validation Status: ${validation.overall_status}\n\n` +
                  `Chunks Analyzed: ${validation.total_chunks}\n` +
                  `Files: ${validation.complete_files} complete, ${validation.incomplete_files} incomplete, ${validation.error_files} errors\n` +
                  `Overall Completeness: ${validation.average_completeness}%`,
                chunks: validation.chunks || [],
                all_files: validation.all_files || [],
              },
            }),
          });
        } catch (e) {
          console.error('Error saving validation feedback:', e);
        }
        
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `${statusEmoji} **Multi-Step Validation Complete**\n\n` +
                    `**Status:** ${validation.overall_status}\n` +
                    `**Chunks Analyzed:** ${validation.total_chunks}\n` +
                    `**Files:** ${validation.complete_files} complete, ${validation.incomplete_files} incomplete, ${validation.error_files} errors\n` +
                    `**Overall Completeness:** ${validation.average_completeness}%\n\n` +
                    `View detailed feedback in the Dashboard!`,
            type: 'review',
          },
        ]);
      }
    } catch (error) {
      console.error('Error in multi-step validation:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error during multi-step validation. Please try again.',
          type: 'review',
        },
      ]);
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerateDocumentation = async (docType: 'readme' | 'api' | 'technical' | 'user-guide' | 'architecture' = 'readme') => {
    if (!project?.id || isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/generate-documentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          files,
          problemStatement: project.problem_statement,
          techStack: project.tech_stack,
          projectName: project.name,
          docType,
          includeCodeExamples: true,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.documentation) {
        const docTypeName = docType.charAt(0).toUpperCase() + docType.slice(1);
        const fileName = docType === 'readme' ? 'README.md' : `${docType}-documentation.md`;
        
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `📄 **${docTypeName} Documentation Generated**\n\n\`\`\`markdown\n${data.documentation}\n\`\`\`\n\nWould you like to save this as ${fileName}?`,
            type: 'explanation',
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `❌ **Error**: ${data.error || 'Failed to generate documentation'}`,
            type: 'explanation',
          },
        ]);
      }
    } catch (error) {
      console.error('Error generating documentation:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error generating documentation. Please try again.',
          type: 'explanation',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLearningFeedback = async () => {
    if (!project?.id || isLoading) return;
    
    setIsLoading(true);
    try {
      // Sync files first
      await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/sync-from-fs`, {
        method: 'POST',
      }).catch(() => {});

      // Get latest files from database
      let latestFiles = files;
      try {
        const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/files-structure`);
        const filesData = await filesResponse.json();
        if (filesData.success && filesData.fileStructure) {
          latestFiles = filesData.fileStructure;
        }
      } catch (e) {
        console.error('Error fetching latest files:', e);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '🎓 **Generating Learning Feedback...**\n\nAnalyzing your code for mistakes and improvements...',
          type: 'explanation',
        },
      ]);

      // First run multi-step validation to get validation results
      let validationResults = null;
      try {
        const validateResponse = await fetch('/api/ai/multi-step-validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            files: latestFiles,
            problemStatement: project.problem_statement,
            techStack: project.tech_stack,
          }),
        });
        const validateData = await validateResponse.json();
        if (validateData.success) {
          validationResults = validateData.validation;
        }
      } catch (e) {
        console.error('Error running validation:', e);
      }

      const response = await fetch('/api/ai/learning-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          files: latestFiles, // Use latest files
          problemStatement: project.problem_statement,
          validationResults, // Pass validation results
        }),
      });

      const data = await response.json();
      
      if (data.success && data.feedback) {
        // Save feedback to database
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              feedback_type: 'learning',
              feedback_data: data.feedback,
            }),
          });
        } catch (e) {
          console.error('Error saving feedback:', e);
        }

        const mistakesCount = data.feedback.mistakes?.length || 0;
        const improvementsCount = data.feedback.improvements?.length || 0;
        
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `🎓 **Learning Feedback Generated**\n\n` +
                    `Found ${mistakesCount} mistakes and ${improvementsCount} improvement suggestions.\n\n` +
                    `**Switch to Feedback tab to view detailed feedback!**`,
            type: 'explanation',
          },
        ]);
        
        // If on feedback view, refresh feedback list
        if (currentView === 'feedback') {
          loadFeedback();
        }
      }
    } catch (error) {
      console.error('Error generating learning feedback:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error generating learning feedback. Please try again.',
          type: 'explanation',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };



  const handleProgressTracker = async () => {
    if (!project?.id || isLoading) return;
    
    setIsLoading(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/sync-from-fs`, {
        method: 'POST',
      }).catch(() => {});

      // Get existing tasks
      const tasksResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/progress`);
      const tasksData = await tasksResponse.json();
      const existingTasks = tasksData.success ? tasksData.tasks : [];

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '📊 **Tracking Progress...**\n\nAnalyzing project and updating task completion...',
          type: 'explanation',
        },
      ]);

      // Ensure we have latest files - sync from file system first
      await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/sync-from-fs`, {
        method: 'POST',
      }).catch(() => {});

      // Get latest files structure from database
      let latestFiles = files;
      try {
        const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/files-structure`);
        const filesData = await filesResponse.json();
        if (filesData.success && filesData.files) {
          latestFiles = filesData.files;
        }
      } catch (e) {
        console.error('Error fetching latest files:', e);
      }

      const response = await fetch('/api/ai/progress-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          problemStatement: project.problem_statement,
          files: latestFiles, // Use latest files from database
          techStack: project.tech_stack,
          existingTasks,
        }),
      });

      const data = await response.json();
      console.log('[Progress Tracker] Response received:', data);
      
      if (data.success && data.progress) {
        const { progress } = data;
        console.log('[Progress Tracker] Progress data:', progress);
        
        // Save/update tasks in database
        for (const task of progress.tasks || []) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                task_name: task.task_name,
                task_description: task.task_description,
                status: task.status,
              }),
            });
          } catch (e) {
            console.error('Error saving task:', e);
          }
        }

        const progressInfo = progress.progress || {};
        const completed = progressInfo.completed || 0;
        const inProgress = progressInfo.in_progress || 0;
        const total = progressInfo.total_tasks || 0;
        const percentage = progressInfo.percentage || 0;

        // Show detailed task breakdown
        const taskBreakdown = progress.tasks?.slice(0, 5).map((t: any) => {
          const emoji = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⏳';
          return `${emoji} ${t.task_name} (${t.status})`;
        }).join('\n') || '';

        // Show file processing info if available
        const totalFilesProcessed = progress.total_files_processed || 0;
        const fileInfo = totalFilesProcessed > 0 
          ? `\n**Files Analyzed:** ${totalFilesProcessed} files processed individually\n`
          : '';

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `📊 **Progress Updated**\n\n` +
                    `**Completion:** ${percentage}%\n` +
                    `**Tasks:** ${completed} completed, ${inProgress} in progress, ${progressInfo.pending || 0} pending (${total} total)` +
                    fileInfo +
                    `\n${taskBreakdown ? `**Task Status:**\n${taskBreakdown}\n\n` : ''}` +
                    `**Next Priorities:**\n${(progress.next_priorities || []).slice(0, 3).map((p: string) => `- ${p}`).join('\n')}`,
            type: 'explanation',
          },
        ]);
      } else {
        console.error('[Progress Tracker] Invalid response:', data);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `📊 **Progress Tracking**\n\nReceived response but data format is invalid.\n\nResponse: ${JSON.stringify(data).substring(0, 200)}...`,
            type: 'explanation',
          },
        ]);
      }
    } catch (error) {
      console.error('Error tracking progress:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error tracking progress: ${errorMessage}\n\nPlease check the console for details.`,
          type: 'explanation',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          message: input,
          files,
          activeFile,
          conversationHistory: messages,
          problemStatement: project?.problem_statement,
        }),
      });

      const data = await response.json();
      
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: data.response,
        type: data.type || 'explanation',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling AI mentor:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          type: 'explanation',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    const actionMessages: { [key: string]: string } = {
      hint: 'Can you give me a hint on how to proceed?',
      explain: 'Can you explain what this code does?',
      debug: 'Can you help me debug any issues in my code?',
      review: 'Can you review my code and provide feedback?',
    };

    setInput(actionMessages[action]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    handleSend();
  };

  const loadFeedback = async () => {
    if (!project?.id || isLoadingFeedback) return;
    
    setIsLoadingFeedback(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${project.id}/feedback`);
      const data = await response.json();
      if (data.success) {
        setFeedback(data.feedback || []);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
      setFeedback([]);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const handleViewChange = (view: 'project' | 'feedback') => {
    setCurrentView(view);
    if (view === 'feedback' && project?.id) {
      loadFeedback();
    }
  };

  return (
    <>
      <button
        className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg cursor-pointer transition-all hover:from-purple-600 hover:to-indigo-700 hover:scale-105 z-50 flex items-center gap-2 font-medium text-sm"
        onClick={() => setIsOpen(!isOpen)}
        title="Agentic AI Mentor"
      >
        🤖 {isOpen ? 'Close AI' : 'AI Mentor'}
      </button>

      {isOpen && (
        <div 
          className="fixed top-16 right-4 h-[calc(100vh-80px)] bg-white rounded-xl shadow-2xl flex flex-col z-50 border border-gray-200"
          style={{ width: `${width}px` }}
        >
          {/* Resize handle */}
          <div
            ref={resizeRef}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-purple-400 transition-colors group"
            style={{ zIndex: 10 }}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-12 bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity rounded" />
          </div>
          
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <h3 className="m-0 text-lg font-semibold">🤖 Agentic AI Mentor</h3>
            <div className="flex items-center gap-2">
              {/* View Tabs */}
              <div className="flex gap-1 bg-white/20 rounded-lg p-1">
                <button
                  onClick={() => handleViewChange('project')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    currentView === 'project'
                      ? 'bg-white text-purple-600'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  💻 Project
                </button>
                <button
                  onClick={() => handleViewChange('feedback')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    currentView === 'feedback'
                      ? 'bg-white text-purple-600'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  📚 Feedback
                </button>
              </div>
              <button 
                className="bg-transparent border-none text-xl cursor-pointer text-white hover:text-gray-200 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
          </div>

          {/* Conditional rendering based on current view */}
          {currentView === 'project' ? (
            <>
              <div className="flex flex-col gap-2 px-4 py-3 border-b border-gray-200">
                {/* <button 
                  onClick={handleAgenticReasoning}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-3 rounded-lg text-sm font-semibold transition-all hover:from-purple-600 hover:to-indigo-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  disabled={isReasoning || isLoading || !project?.problem_statement}
                >
                  {isReasoning ? '🧠 Reasoning...' : '🧠 Start Agentic Reasoning'}
                </button> */}
                {/* <button 
                  onClick={handleFullAgentFlow}
                  className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-3 rounded-lg text-sm font-semibold transition-all hover:from-green-600 hover:to-teal-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  disabled={isLoading || !project?.problem_statement}
                >
                  🚀 Run All Agents (Full Analysis)
                </button> */}
                <div className="flex gap-2">
              <button 
                onClick={() => handleQuickAction('hint')}
                className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded text-sm transition-colors hover:bg-blue-100"
                disabled={isLoading}
              >
                💡 Hint
              </button>
              <button 
                onClick={() => handleQuickAction('explain')}
                className="flex-1 bg-green-50 text-green-700 px-3 py-2 rounded text-sm transition-colors hover:bg-green-100"
                disabled={isLoading}
              >
                📚 Explain
              </button>
              <button 
                onClick={() => handleQuickAction('debug')}
                className="flex-1 bg-yellow-50 text-yellow-700 px-3 py-2 rounded text-sm transition-colors hover:bg-yellow-100"
                disabled={isLoading}
              >
                🐛 Debug
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAutoReview}
                className="flex-1 bg-purple-50 text-purple-700 px-3 py-2 rounded text-sm transition-colors hover:bg-purple-100 disabled:opacity-50"
                disabled={isReviewing || isLoading}
              >
                {isReviewing ? '⏳ Reviewing...' : '✓ Review Code'}
              </button>
              {/* <button 
                onClick={handleMultiStepValidate}
                className="flex-1 bg-indigo-50 text-indigo-700 px-3 py-2 rounded text-sm transition-colors hover:bg-indigo-100 disabled:opacity-50 font-semibold"
                disabled={isValidating || isLoading || !project?.problem_statement}
              >
                {isValidating ? '⏳ Validating...' : '✅ Multi-Step Validate'}
              </button> */}
            </div>
            <div className="flex gap-2 flex-col">
              {/* <button 
                onClick={() => handleGenerateDocumentation('readme')}
                className="w-full bg-cyan-50 text-cyan-700 px-3 py-2 rounded text-sm transition-colors hover:bg-cyan-100 disabled:opacity-50"
                disabled={isLoading}
              >
                📝 Generate README
              </button> */}
              <div className="flex gap-2">
                {/* <button 
                  onClick={() => handleGenerateDocumentation('api')}
                  className="flex-1 bg-teal-50 text-teal-700 px-3 py-2 rounded text-sm transition-colors hover:bg-teal-100 disabled:opacity-50"
                  disabled={isLoading}
                  title="Generate API Documentation"
                >
                  📄 API Docs
                </button> */}
                {/* <button 
                  onClick={() => handleGenerateDocumentation('technical')}
                  className="flex-1 bg-indigo-50 text-indigo-700 px-3 py-2 rounded text-sm transition-colors hover:bg-indigo-100 disabled:opacity-50"
                  disabled={isLoading}
                  title="Generate Technical Documentation"
                >
                  📚 Tech Docs
                </button> */}
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleLearningFeedback}
                className="flex-1 bg-orange-50 text-orange-700 px-3 py-2 rounded text-sm transition-colors hover:bg-orange-100 disabled:opacity-50"
                disabled={isLoading}
              >
                🎓 Learning Feedback
              </button>
              <button 
                onClick={handleProgressTracker}
                className="flex-1 bg-pink-50 text-pink-700 px-3 py-2 rounded text-sm transition-colors hover:bg-pink-100 disabled:opacity-50"
                disabled={isLoading}
              >
                📊 Track Progress
              </button>
            </div>
            {isAutoExplaining && (
              <div className="text-xs text-gray-500 text-center">
                🤖 Auto-explaining code...
              </div>
            )}
            {reasoningPlan.length > 0 && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <strong>Active Plan:</strong> {reasoningPlan.length} steps
              </div>
            )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-[#667eea] text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {msg.type && (
                      <span className="text-lg">
                        {msg.type === 'hint' && '💡'}
                        {msg.type === 'explanation' && '📚'}
                        {msg.type === 'debug' && '🐛'}
                        {msg.type === 'review' && '✓'}
                      </span>
                    )}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 rounded-lg p-3">
                  <div className="text-sm">Thinking...</div>
                </div>
              </div>
            )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-2 px-4 py-3 border-t border-gray-200">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask your AI mentor..."
                  className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#667eea] disabled:bg-gray-100 text-black"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  className="bg-[#667eea] text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#5568d3] disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={isLoading || !input.trim()}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Feedback View */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {isLoadingFeedback ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">Loading feedback...</div>
                  </div>
                ) : feedback.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <div className="text-4xl mb-4">📚</div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Feedback Yet</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Generate learning feedback to see detailed analysis and improvements.
                    </p>
                    <button
                      onClick={handleLearningFeedback}
                      className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                      disabled={isLoading || !project?.id}
                    >
                      🎓 Generate Learning Feedback
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-800">📚 Learning Feedback</h4>
                      <span className="text-sm text-gray-500">{feedback.length} feedback item{feedback.length !== 1 ? 's' : ''}</span>
                    </div>
                    {feedback.map((fb, idx) => {
                      const feedbackData = typeof fb.feedback_data === 'string' 
                        ? JSON.parse(fb.feedback_data) 
                        : fb.feedback_data;
                      
                      return (
                        <div key={fb.id || idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-800 mb-1">
                                {fb.feedback_type === 'learning' ? '🎓 Learning Feedback' : '✓ Code Review'}
                              </div>
                              {fb.file_path && (
                                <div className="text-xs text-gray-500">File: {fb.file_path}</div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(fb.created_at).toLocaleString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: true
                                })}
                              </div>
                            </div>
                          </div>
                          
                          {feedbackData && (
                            <div className="space-y-3">
                              {feedbackData.mistakes && feedbackData.mistakes.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-semibold text-red-700 mb-2">⚠️ Mistakes Found:</h5>
                                  <ul className="list-disc list-inside space-y-2 ml-2">
                                    {feedbackData.mistakes.slice(0, 5).map((mistake: any, mIdx: number) => {
                                      // Handle different mistake object structures
                                      const mistakeType = mistake.mistake_type || mistake.type || 'Issue';
                                      const description = mistake.description || mistake.explanation || '';
                                      const whyWrong = mistake.why_wrong || mistake.why || '';
                                      const howToFix = mistake.how_to_fix || mistake.fix || mistake.how || '';
                                      const filePath = mistake.file_path || '';
                                      const lineNumber = mistake.line_number;
                                      
                                      return (
                                        <li key={mIdx} className="text-xs text-gray-700">
                                          <div className="font-semibold text-red-800 mb-1">
                                            {mistakeType}
                                            {filePath && ` (${filePath}${lineNumber ? `:${lineNumber}` : ''})`}
                                          </div>
                                          {description && <div className="text-gray-600 mb-1">{description}</div>}
                                          {whyWrong && <div className="text-gray-500 mb-1"><strong>Why:</strong> {whyWrong}</div>}
                                          {howToFix && <div className="text-gray-500"><strong>Fix:</strong> {howToFix}</div>}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                              
                              {feedbackData.improvements && feedbackData.improvements.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-semibold text-blue-700 mb-2">💡 Improvements:</h5>
                                  <ul className="list-disc list-inside space-y-2 ml-2">
                                    {feedbackData.improvements.slice(0, 5).map((improvement: any, iIdx: number) => {
                                      // Handle different improvement object structures
                                      const suggestion = improvement.suggestion || improvement.title || '';
                                      const why = improvement.why || improvement.why_important || '';
                                      const how = improvement.how || improvement.implementation || '';
                                      
                                      // If improvement is a string, render it directly
                                      if (typeof improvement === 'string') {
                                        return (
                                          <li key={iIdx} className="text-xs text-gray-700">{improvement}</li>
                                        );
                                      }
                                      
                                      return (
                                        <li key={iIdx} className="text-xs text-gray-700">
                                          <div className="font-semibold text-blue-800 mb-1">{suggestion || 'Improvement'}</div>
                                          {why && <div className="text-gray-600 mb-1"><strong>Why:</strong> {why}</div>}
                                          {how && <div className="text-gray-500"><strong>How:</strong> {how}</div>}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                              
                              {feedbackData.learning_points && feedbackData.learning_points.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-semibold text-green-700 mb-2">📖 Learning Points:</h5>
                                  <ul className="list-disc list-inside space-y-1 ml-2">
                                    {feedbackData.learning_points.slice(0, 5).map((point: any, pIdx: number) => {
                                      // Handle both string and object learning points
                                      const pointText = typeof point === 'string' ? point : (point.text || point.description || JSON.stringify(point));
                                      return (
                                        <li key={pIdx} className="text-xs text-gray-700">{pointText}</li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                              
                              {feedbackData.summary && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-xs text-gray-700 leading-relaxed">{feedbackData.summary}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => handleViewChange('project')}
                  className="w-full bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                >
                  ← Back to Project
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
