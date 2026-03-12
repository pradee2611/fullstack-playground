'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Feedback {
  id: number;
  project_id: string;
  file_path: string | null;
  feedback_type: string;
  feedback_data: any;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  problem_statement: string;
  created_at: string;
}

function DashboardContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get session from localStorage
    const storedSessionId = localStorage.getItem('sessionId');
    if (!storedSessionId) {
      router.push('/');
      return;
    }
    setSessionId(storedSessionId);
    loadProjects(storedSessionId);
  }, [router]);

  useEffect(() => {
    // Check for project parameter in URL
    const projectParam = searchParams?.get('project');
    if (projectParam && projects.length > 0 && !selectedProject) {
      setSelectedProject(projectParam);
      loadFeedback(projectParam);
    }
  }, [searchParams, projects, selectedProject]);

  const loadProjects = async (sessionId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects`, {
        headers: {
          'x-session-id': sessionId,
        },
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeedback = async (projectId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/feedback`);
      const data = await response.json();
      if (data.success) {
        setFeedback(data.feedback || []);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    loadFeedback(projectId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📊 Learning Dashboard</h1>
            <p className="text-gray-600 text-sm mt-1">View feedback and improvements for your projects</p>
          </div>
          <a
            href="/"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            ← Back to Projects
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Projects</h2>
              <div className="space-y-2">
                {projects.length === 0 ? (
                  <p className="text-gray-500 text-sm">No projects yet</p>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectSelect(project.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedProject === project.id
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {project.problem_statement || 'No problem statement'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Feedback Display */}
          <div className="lg:col-span-2">
            {selectedProject ? (
              <div className="space-y-4">
                {feedback.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-4xl mb-4">📝</div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Feedback Yet</h3>
                    <p className="text-gray-600 text-sm">
                      Feedback will appear here after you use the AI agents in your project.
                    </p>
                  </div>
                ) : (
                  feedback.map((item) => (
                    <FeedbackCard key={item.id} feedback={item} />
                  ))
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-4xl mb-4">👈</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Select a Project</h3>
                <p className="text-gray-600 text-sm">
                  Choose a project from the left to view feedback and improvements.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading Dashboard...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

// Component to format feedback text with proper structure
function FormattedFeedback({ text }: { text: string }) {
  // Split by common patterns and format
  const formatText = (text: string) => {
    // Split by double newlines for paragraphs
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    
    return paragraphs.map((para, idx) => {
      const trimmed = para.trim();
      
      // Check for headers (lines starting with # or **)
      if (trimmed.match(/^#{1,6}\s/)) {
        const level = trimmed.match(/^(#{1,6})/)?.[1].length || 1;
        const content = trimmed.replace(/^#{1,6}\s/, '');
        const className = level === 1 ? 'text-xl font-bold' : level === 2 ? 'text-lg font-semibold' : 'text-base font-semibold';
        return (
          <h5 key={idx} className={`${className} text-gray-800 mt-4 mb-2 ${idx > 0 ? 'pt-2' : ''}`}>
            {content}
          </h5>
        );
      }
      
      // Check for bold text (**text**)
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        const content = trimmed.replace(/\*\*/g, '');
        return (
          <h6 key={idx} className="text-base font-semibold text-gray-800 mt-3 mb-2">
            {content}
          </h6>
        );
      }
      
      // Check for bullet points
      if (trimmed.match(/^[-*•]\s/)) {
        const items = trimmed.split(/\n(?=[-*•])/).filter(i => i.trim());
        return (
          <ul key={idx} className="list-disc list-inside space-y-2 ml-4 mt-2">
            {items.map((item, itemIdx) => {
              const cleanItem = item.replace(/^[-*•]\s/, '').trim();
              // Format inline bold
              const parts = cleanItem.split(/(\*\*[^*]+\*\*)/g);
              return (
                <li key={itemIdx} className="text-sm text-gray-700">
                  {parts.map((part, partIdx) => 
                    part.startsWith('**') && part.endsWith('**') ? (
                      <strong key={partIdx} className="font-semibold text-gray-800">
                        {part.replace(/\*\*/g, '')}
                      </strong>
                    ) : (
                      <span key={partIdx}>{part}</span>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        );
      }
      
      // Check for numbered list
      if (trimmed.match(/^\d+\.\s/)) {
        const items = trimmed.split(/\n(?=\d+\.)/).filter(i => i.trim());
        return (
          <ol key={idx} className="list-decimal list-inside space-y-2 ml-4 mt-2">
            {items.map((item, itemIdx) => {
              const cleanItem = item.replace(/^\d+\.\s/, '').trim();
              const parts = cleanItem.split(/(\*\*[^*]+\*\*)/g);
              return (
                <li key={itemIdx} className="text-sm text-gray-700">
                  {parts.map((part, partIdx) => 
                    part.startsWith('**') && part.endsWith('**') ? (
                      <strong key={partIdx} className="font-semibold text-gray-800">
                        {part.replace(/\*\*/g, '')}
                      </strong>
                    ) : (
                      <span key={partIdx}>{part}</span>
                    )
                  )}
                </li>
              );
            })}
          </ol>
        );
      }
      
      // Regular paragraph with inline formatting
      const parts = trimmed.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
      return (
        <p key={idx} className="text-sm text-gray-700 leading-relaxed mb-3">
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={partIdx} className="font-semibold text-gray-800">
                  {part.replace(/\*\*/g, '')}
                </strong>
              );
            } else if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code key={partIdx} className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-mono text-gray-800">
                  {part.replace(/`/g, '')}
                </code>
              );
            }
            return <span key={partIdx}>{part}</span>;
          })}
        </p>
      );
    });
  };

  return (
    <div className="space-y-2">
      {formatText(text)}
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const data = feedback.feedback_data;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="text-3xl">
            {feedback.feedback_type === 'mistakes' ? '🐛' : 
             feedback.feedback_type === 'improvements' ? '✨' :
             feedback.feedback_type === 'learning' ? '📚' :
             feedback.feedback_type === 'validation' ? '✅' : '💡'}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {feedback.feedback_type === 'mistakes' ? 'Mistakes Found' : 
               feedback.feedback_type === 'improvements' ? 'Improvements' :
               feedback.feedback_type === 'learning' ? 'Learning Points' :
               feedback.feedback_type === 'validation' ? 'Multi-Step Validation' : 'Feedback'}
            </h3>
            {feedback.file_path && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <span>📄</span>
                <span className="font-mono text-xs">{feedback.file_path}</span>
              </p>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {new Date(feedback.created_at).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          })}
        </span>
      </div>

      {data.mistakes && data.mistakes.length > 0 && (
        <div className="mb-4">
          <h4 className="font-semibold text-red-700 mb-2">Mistakes:</h4>
          <div className="space-y-3">
            {data.mistakes.map((mistake: any, idx: number) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-red-800">
                    {mistake.file_path || feedback.file_path}
                    {mistake.line_number && ` (Line ${mistake.line_number})`}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    mistake.severity === 'high' ? 'bg-red-200 text-red-800' :
                    mistake.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {mistake.severity || 'medium'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2"><strong>Issue:</strong> {mistake.description}</p>
                <p className="text-sm text-gray-600 mb-2"><strong>Why:</strong> {mistake.why_wrong}</p>
                <p className="text-sm text-gray-700 mb-2"><strong>Fix:</strong> {mistake.how_to_fix}</p>
                {mistake.code_example && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Fixed Code:</p>
                    <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
                      {mistake.code_example}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.improvements && data.improvements.length > 0 && (
        <div className="mb-4">
          <h4 className="font-semibold text-blue-700 mb-2">Improvements:</h4>
          <div className="space-y-3">
            {data.improvements.map((improvement: any, idx: number) => (
              <div key={idx} className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm font-medium text-blue-800 mb-1">
                  {improvement.file_path || feedback.file_path}
                </p>
                <p className="text-sm text-gray-700 mb-2">{improvement.suggestion}</p>
                {improvement.current_code && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Current:</p>
                    <pre className="bg-gray-800 text-yellow-400 p-2 rounded text-xs overflow-x-auto">
                      {improvement.current_code}
                    </pre>
                  </div>
                )}
                {improvement.improved_code && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Improved:</p>
                    <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
                      {improvement.improved_code}
                    </pre>
                  </div>
                )}
                {improvement.benefit && (
                  <p className="text-xs text-gray-600 mt-2"><strong>Benefit:</strong> {improvement.benefit}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.learning_points && data.learning_points.length > 0 && (
        <div className="mb-4">
          <h4 className="font-semibold text-purple-700 mb-2">Learning Points:</h4>
          <ul className="list-disc list-inside space-y-1">
            {data.learning_points.map((point: string, idx: number) => (
              <li key={idx} className="text-sm text-gray-700">{point}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Summary */}
      {feedback.feedback_type === 'validation' && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{data.average_completeness || 0}%</div>
                <div className="text-xs text-gray-600 mt-1">Completeness</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{data.complete_files || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Complete Files</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{data.incomplete_files || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Incomplete Files</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{data.error_files || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Error Files</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                data.overall_status === 'complete' ? 'bg-green-100 text-green-800' :
                data.overall_status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                Status: {data.overall_status || 'incomplete'}
              </span>
              {data.total_chunks && (
                <span className="text-sm text-gray-600">
                  • {data.total_chunks} {data.total_chunks === 1 ? 'chunk' : 'chunks'} analyzed
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {data.overall_feedback && (
        <div className="mt-6 pt-6 border-t-2 border-indigo-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-2">
              <span className="text-2xl">💡</span>
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800">Overall Feedback</h4>
              <p className="text-xs text-gray-500 mt-0.5">Comprehensive assessment and summary</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-200 shadow-sm">
            <div className="prose prose-sm max-w-none">
              <FormattedFeedback text={data.overall_feedback} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

