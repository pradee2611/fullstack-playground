
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  files: FileStructure;
  port?: number;
  startCommand?: string;
  repoUrl?: string;
  repoInfo?: {
    owner: string;
    repo: string;
    name: string;
    description: string;
    language: string;
  };
}

export type FileStructure = {
  [key: string]: string | FileStructure;
};

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'hint' | 'explanation' | 'debug' | 'review';
}

// Module Learning Components

export interface StudyResource {
  id: string;
  title: string;
  type: 'video' | 'article' | 'documentation' | 'code-snippet';
  url?: string;
  content?: string; // Inline content
  duration?: string; // e.g. "5 min read"
}

export interface AssessmentTask {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  hints: string[];
  solution?: string; // Optional solution code
}

export interface ModuleStep {
  id: string;
  title: string;
  isCompleted: boolean;
  isLocked: boolean;
  type: 'overview' | 'task' | 'setup';
  description?: string;

  // New Enhanced Content
  objectives?: string[]; // What will the user learn?
  studyContent?: StudyResource[]; // List of readings/videos
  task?: AssessmentTask; // The coding assignment for this step
}

export interface ProjectModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  focus: string;
  prerequisites: string;
  techStack: string[];
  level: string; // 'Beginner' | 'Intermediate' | 'Advanced'
  steps: ModuleStep[];
}
