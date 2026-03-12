
'use client';

import { useState, useEffect } from 'react';
import Workspace from '@/components/Workspace';
import ProjectSelector from '@/components/ProjectSelector';
import Login from '@/components/Login';
import { ProjectTemplate } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import ModuleList from '@/components/modules/ModuleList';
import ModuleDetail from '@/components/modules/ModuleDetail';
import { SAMPLE_MODULES } from '@/data/modules';

interface User {
  id: string;
  email: string;
  name: string;
}

export default function Home() {
  const [selectedProject, setSelectedProject] = useState<ProjectTemplate | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New State for Layout and Modules
  const [currentView, setCurrentView] = useState<string>('modules'); // 'modules', 'workspace'
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  useEffect(() => {
    // Initialize workspace on mount
    const id = `workspace-${Date.now()}`;
    setWorkspaceId(id);

    // Check for existing session
    const storedSessionId = localStorage.getItem('sessionId');
    const storedUser = localStorage.getItem('user');

    if (storedSessionId && storedUser) {
      // Verify session with server
      fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth/me`, {
        headers: {
          'x-session-id': storedSessionId,
        },
      })
        .then((res) => {
          if (res.status === 401) {
            localStorage.removeItem('sessionId');
            localStorage.removeItem('user');
            return null;
          }
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data && data.success) {
            setUser(data.user);
            setSessionId(storedSessionId);
          } else if (data && !data.success) {
            localStorage.removeItem('sessionId');
            localStorage.removeItem('user');
          }
        })
        .catch((error) => {
          if (error.message && !error.message.includes('401')) {
            console.error('Error verifying session:', error);
          }
          localStorage.removeItem('sessionId');
          localStorage.removeItem('user');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData: User, newSessionId: string) => {
    setUser(userData);
    setSessionId(newSessionId);
  };

  const handleLogout = () => {
    if (sessionId) {
      fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'x-session-id': sessionId,
        },
      }).catch(console.error);
    }
    localStorage.removeItem('sessionId');
    localStorage.removeItem('user');
    setUser(null);
    setSessionId(null);
    setSelectedProject(null);
  };

  // Module Handling
  const handleSelectModule = (moduleId: string) => {
    setActiveModuleId(moduleId);
    // If it's a known guided module, we go to detail view
    // If it was a real app, we'd fetch the module data here
  };

  const handleCreateNew = () => {
    // Logic to create new custom project using existing ProjectSelector logic or new logic
    // For now, let's treat it as switching to the 'old' ProjectSelector view or similar
    // But better to integrate it.
    // Let's toggle to a 'create' view or just use the existing helper
    console.log("Create new project");
  };

  const handleStartStep = (stepId: string) => {
    // User clicked 'Go to Milestones' or start step
    // This should launch the Workspace
    if (activeModuleId) {
      const selectedModule = SAMPLE_MODULES.find(m => m.id === activeModuleId);

      if (selectedModule) {
        const projectTemplate: ProjectTemplate = {
          id: selectedModule.id,
          name: selectedModule.title,
          description: selectedModule.description,
          language: selectedModule.techStack && selectedModule.techStack.length > 0 ? selectedModule.techStack[0].toLowerCase() : 'plaintext',
          files: {} // Should load initial boilerplate based on module
        };
        setSelectedProject(projectTemplate);
        setCurrentView('workspace');
      }
    }
  };

  // Main Render
  if (loading || !workspaceId) {
    return (
      <div className="flex items-center justify-center h-screen text-xl text-gray-600 bg-[#0d1017]">
        Initializing workspace...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Determine what to render in the main content area
  let content;

  if (currentView === 'workspace') {
    if (selectedProject) {
      content = (
        <div className="h-full">
          <Workspace
            workspaceId={workspaceId}
            project={selectedProject}
            onCloseProject={() => {
              setSelectedProject(null);
              setCurrentView('modules');
            }}
          />
        </div>
      );
    } else {
      // Fallback if no project selected but view is workspace
      setCurrentView('modules');
      content = <div>Redirecting...</div>
    }
  } else if (currentView === 'modules') {
    if (activeModuleId) {
      // Show Detail
      const moduleData = SAMPLE_MODULES.find(m => m.id === activeModuleId);

      if (moduleData) {
        content = (
          <ModuleDetail
            module={moduleData}
            onStartStep={handleStartStep}
            onBack={() => setActiveModuleId(null)}
          />
        );
      } else {
        content = <div>Module not found</div>;
      }

    } else {
      // Show List
      content = (
        <ModuleList
          onSelectModule={handleSelectModule}
          onCreateNew={handleCreateNew}
        />
      );
    }
  } else {
    // Default or other views
    content = (
      <div className="p-10 text-white">
        <h1 className="text-2xl">View: {currentView}</h1>
        <p>This section is under construction.</p>
      </div>
    );
  }

  return (
    <MainLayout
      currentView={currentView}
      onNavigate={(view) => {
        setCurrentView(view);
        // If navigating away from workspace, should we close project? 
        // For now, we keep state but view changes.
      }}
      title={activeModuleId ? 'Module Detail' : 'Overview'}
    >
      {content}
    </MainLayout>
  );
}
