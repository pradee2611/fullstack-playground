'use client';

import { useState, useEffect } from 'react';
import { ProjectTemplate } from '@/types';

interface CustomProjectCreatorProps {
  onCreateProject: (project: ProjectTemplate) => void;
  onCancel: () => void;
  sessionId?: string | null;
}

export default function CustomProjectCreator({ onCreateProject, onCancel, sessionId }: CustomProjectCreatorProps) {
  const [projectName, setProjectName] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [techStack, setTechStack] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingProjects, setExistingProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    // Load existing projects if session exists
    if (sessionId) {
      loadExistingProjects();
    } else {
      setLoadingProjects(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }
    
    if (!problemStatement.trim()) {
      setError('Problem statement is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (sessionId) {
        headers['x-session-id'] = sessionId;
      }

      const response = await fetch('http://localhost:3001/api/projects/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: projectName,
          problem_statement: problemStatement,
          tech_stack: techStack,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create project');
      }

      // Create project template for workspace
      const project: ProjectTemplate = {
        id: data.project.id,
        name: data.project.name,
        description: data.project.description || '',
        language: data.project.tech_stack || 'custom',
        files: {}, // Empty - user will create files
        repoUrl: undefined,
      };

      onCreateProject(project);
      // Refresh projects list after creation
      if (sessionId) {
        loadExistingProjects();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] overflow-y-auto">
      <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 my-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 m-0">Create Custom Project</h2>
          <button 
            className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 hover:text-gray-700 transition-colors"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side - Create form */}
          <div>
        <div className="space-y-4">
          <div>
            <label htmlFor="projectName" className="block mb-2 text-sm font-medium text-gray-700">
              Project Name *
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-awesome-project"
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-colors focus:outline-none focus:border-[#667eea] disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="problemStatement" className="block mb-2 text-sm font-medium text-gray-700">
              Problem Statement *
            </label>
            <textarea
              id="problemStatement"
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="Describe the problem you want to solve or the project you want to build. The AI mentor will use this to guide you and validate your solution."
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-colors focus:outline-none focus:border-[#667eea] disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
              rows={5}
            />
            <small className="text-gray-500 text-xs mt-1 block">
              Example: &quot;Build a todo app where users can add, edit, delete, and mark tasks as complete&quot;
            </small>
          </div>

          <div>
            <label htmlFor="techStack" className="block mb-2 text-sm font-medium text-gray-700">
              Tech Stack (optional)
            </label>
            <input
              id="techStack"
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="React, Node.js, Python, etc."
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-colors focus:outline-none focus:border-[#667eea] disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <small className="text-gray-500 text-xs mt-1 block">
              You can use any tech stack. Install dependencies later in the terminal.
            </small>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreate}
              disabled={loading || !projectName.trim()}
              className="flex-1 bg-[#667eea] text-white px-6 py-3 rounded-lg text-base font-medium transition-all hover:bg-[#5568d3] hover:-translate-y-0.5 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg text-base font-medium transition-colors hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
            </div>
          </div>

          {/* Right side - Existing projects */}
          {sessionId && (
            <div className="border-l border-gray-200 pl-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Your Existing Projects</h3>
              {loadingProjects ? (
                <div className="text-gray-500 text-center py-8">Loading...</div>
              ) : existingProjects.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {existingProjects.map((project) => (
                    <div
                      key={project.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-[#667eea] transition-colors cursor-pointer"
                      onClick={() => {
                        const projectTemplate: ProjectTemplate = {
                          id: project.id,
                          name: project.name,
                          description: project.description || '',
                          language: project.tech_stack || 'custom',
                          files: {},
                          repoUrl: undefined,
                        };
                        onCreateProject(projectTemplate);
                      }}
                    >
                      <h4 className="font-semibold text-gray-800 mb-1">{project.name}</h4>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {project.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between">
                        {project.tech_stack && (
                          <span className="text-xs bg-[#667eea] text-white px-2 py-1 rounded">
                            {project.tech_stack}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(project.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">
                  <p>No projects yet</p>
                  <p className="text-sm mt-2">Create your first project!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
