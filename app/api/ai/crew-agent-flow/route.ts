import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * CrewAI Agent Flow
 * Calls the Python CrewAI service to run agents
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, problemStatement, techStack, usePerfectAgent = false } = await request.json();

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Project ID is required',
      });
    }

    // Get base URL from request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    console.log(`[CrewAI Agent Flow] Starting for project ${projectId}`);

    // Step 1: Sync files from file system
    try {
      console.log(`[CrewAI Agent Flow] Step 1: Syncing files from file system...`);
      await fetch(`http://localhost:3001/api/projects/${projectId}/sync-from-fs`, {
        method: 'POST',
      });
      console.log(`[CrewAI Agent Flow] Step 1: Files synced successfully`);
    } catch (e) {
      console.error('[CrewAI Agent Flow] Error syncing files:', e);
    }

    // Step 2: Get latest files from database
    let files = null;
    try {
      console.log(`[CrewAI Agent Flow] Step 2: Fetching files from database...`);
      const filesResponse = await fetch(`http://localhost:3001/api/projects/${projectId}/files-structure`);
      const filesData = await filesResponse.json();
      
      if (filesData.success) {
        files = filesData.files || filesData.fileStructure;
        if (files) {
          const fileCount = Object.keys(files).length;
          console.log(`[CrewAI Agent Flow] Step 2: Found ${fileCount} top-level items in file structure`);
        }
      }
    } catch (e) {
      console.error('[CrewAI Agent Flow] Error fetching files:', e);
    }

    if (!files || Object.keys(files).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No files found in project',
        suggestion: 'Create some files first, then run the agents',
      });
    }

    // Step 3: Filter out binary files and process
    const textFiles = files ? filterTextFiles(files) : {};
    
    // Process files (convert to string for Python service)
    // Limit to ~15000 chars (~3750 tokens) to stay within Groq's 6000 token limit including prompt
    const processedFiles = Object.keys(textFiles).length > 0 ? JSON.stringify(textFiles).substring(0, 15000) : '';

    // Step 4: Call Python CrewAI service
    try {
      console.log(`[CrewAI Agent Flow] Step 3: Calling Python CrewAI service at ${PYTHON_SERVICE_URL}...`);
      
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/agent-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement,
          techStack,
          processedFiles,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[CrewAI Agent Flow] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[CrewAI Agent Flow] Successfully completed with ${pythonData.agentsRun} agents`);
        
        // Transform Python service results to match expected format
        const transformedResults: any = {};
        
        // Transform validation result
        if (pythonData.results?.validation) {
          const val = pythonData.results.validation;
          transformedResults.validation = {
            overall_status: val.overall_status || val.status || 'unknown',
            complete_files: val.complete_files || val.completed || 0,
            incomplete_files: val.incomplete_files || val.incomplete || 0,
            average_completeness: val.percentage || val.average_completeness || 0,
            feedback: val.feedback || val.summary || 'No validation feedback',
          };
        }
        
        // Transform feedback result
        if (pythonData.results?.feedback) {
          const fb = pythonData.results.feedback;
          transformedResults.feedback = {
            mistakes: fb.mistakes || [],
            improvements: fb.improvements || [],
            learning_points: fb.learning_points || [],
            summary: fb.summary || fb.feedback || 'No feedback generated',
          };
        }
        
        // Transform progress result
        if (pythonData.results?.progress) {
          const prog = pythonData.results.progress;
          transformedResults.progress = {
            progress: {
              percentage: prog.progress?.percentage || prog.percentage || 0,
              completed: prog.progress?.completed || prog.tasks?.filter((t: any) => t.status === 'completed').length || 0,
              in_progress: prog.progress?.in_progress || prog.tasks?.filter((t: any) => t.status === 'in_progress').length || 0,
              pending: prog.progress?.pending || prog.tasks?.filter((t: any) => t.status === 'pending').length || 0,
              total: prog.progress?.total || prog.tasks?.length || 0,
            },
            tasks: prog.tasks || [],
            next_priorities: prog.next_priorities || [],
          };
        }

        return NextResponse.json({
          success: true,
          results: transformedResults,
          summary: pythonData.summary,
          agentsRun: pythonData.agentsRun,
          successCount: pythonData.successCount,
          method: 'crewai',
          filesProcessed: Object.keys(files).length,
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: any) {
      console.error('[CrewAI Agent Flow] Error calling Python service:', error);
      
      // Fallback to TypeScript agent flow if Python service is unavailable
      if (error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED')) {
        console.log('[CrewAI Agent Flow] Python service unavailable, falling back to TypeScript agents...');
        
        // Call the regular agent-flow endpoint as fallback
        const fallbackUrl = `${baseUrl}/api/ai/agent-flow`;
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            problemStatement,
            techStack,
            usePerfectAgent,
          }),
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          return NextResponse.json({
            ...fallbackData,
            method: 'fallback-typescript',
            note: 'Python CrewAI service unavailable, used TypeScript agents instead',
          });
        }
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to run CrewAI agent flow',
        message: error.message,
        suggestion: 'Make sure the Python service is running on port 8000',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in CrewAI agent flow:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run CrewAI agent flow',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

