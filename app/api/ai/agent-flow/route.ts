import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Agent Flow - Uses Python Service
 * Calls the Python CrewAI service to run all agents
 * Removed all frontend agent logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, problemStatement, techStack } = await request.json();

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Project ID is required',
      });
    }

    console.log(`[Agent Flow] Starting for project ${projectId}`);

    // Step 1: Sync files from file system
    try {
      console.log(`[Agent Flow] Step 1: Syncing files from file system...`);
      await fetch(`http://localhost:3001/api/projects/${projectId}/sync-from-fs`, {
        method: 'POST',
      });
      console.log(`[Agent Flow] Step 1: Files synced successfully`);
    } catch (e) {
      console.error('[Agent Flow] Error syncing files:', e);
    }

    // Step 2: Get latest files from database
    let files = null;
    try {
      console.log(`[Agent Flow] Step 2: Fetching files from database...`);
      const filesResponse = await fetch(`http://localhost:3001/api/projects/${projectId}/files-structure`);
      const filesData = await filesResponse.json();
      
      // Handle both response formats (files or fileStructure)
      if (filesData.success) {
        files = filesData.files || filesData.fileStructure;
        if (files) {
          const fileCount = Object.keys(files).length;
          console.log(`[Agent Flow] Step 2: Found ${fileCount} top-level items in file structure`);
          
          // Count total files recursively
          const countFiles = (obj: any): number => {
            let count = 0;
            for (const value of Object.values(obj)) {
              if (typeof value === 'string') {
                count++;
              } else if (typeof value === 'object' && value !== null) {
                count += countFiles(value);
              }
            }
            return count;
          };
          const totalFiles = countFiles(files);
          console.log(`[Agent Flow] Step 2: Total files found: ${totalFiles}`);
        }
      }
    } catch (e) {
      console.error('[Agent Flow] Error fetching files:', e);
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

    // Step 4: Call Python service for agent flow
    try {
      console.log(`[Agent Flow] Step 3: Calling Python service at ${PYTHON_SERVICE_URL}/agent-flow...`);
      
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/agent-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement,
          techStack,
          processedFiles,
          files, // Also pass raw files object
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Agent Flow] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Agent Flow] Successfully completed with ${pythonData.agentsRun || 0} agents`);
        
        // Transform Python service results to match expected format
        const transformedResults: any = {};
        
        // Transform validation result
        if (pythonData.results?.validation) {
          const val = pythonData.results.validation;
          // Handle different response formats from Python service
          const valData = typeof val === 'string' ? JSON.parse(val) : val;
          transformedResults.validation = {
            overall_status: valData?.overall_status || valData?.status || 'unknown',
            complete_files: valData?.complete_files || valData?.completed || 0,
            incomplete_files: valData?.incomplete_files || valData?.incomplete || 0,
            average_completeness: valData?.percentage || valData?.average_completeness || 0,
            feedback: valData?.feedback || valData?.summary || 'No validation feedback',
          };
        }
        
        // Transform feedback result
        if (pythonData.results?.feedback) {
          const fb = pythonData.results.feedback;
          const fbData = typeof fb === 'string' ? JSON.parse(fb) : fb;
          transformedResults.feedback = {
            mistakes: fbData?.mistakes || [],
            improvements: fbData?.improvements || [],
            learning_points: fbData?.learning_points || [],
            summary: fbData?.summary || fbData?.feedback || 'No feedback generated',
          };
          
          // Save feedback to database
          try {
            await fetch(`http://localhost:3001/api/projects/${projectId}/feedback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                feedback_type: 'learning',
                feedback_data: transformedResults.feedback,
              }),
            });
          } catch (e) {
            console.error('[Agent Flow] Error saving feedback:', e);
          }
        }
        
        // Transform progress result
        if (pythonData.results?.progress) {
          const prog = pythonData.results.progress;
          const progData = typeof prog === 'string' ? JSON.parse(prog) : prog;
          transformedResults.progress = {
            progress: {
              percentage: progData?.progress?.percentage || progData?.percentage || 0,
              completed: progData?.progress?.completed || progData?.tasks?.filter((t: any) => t.status === 'completed').length || 0,
              in_progress: progData?.progress?.in_progress || progData?.tasks?.filter((t: any) => t.status === 'in_progress').length || 0,
              pending: progData?.progress?.pending || progData?.tasks?.filter((t: any) => t.status === 'pending').length || 0,
              total: progData?.progress?.total || progData?.tasks?.length || 0,
            },
            tasks: progData?.tasks || [],
            next_priorities: progData?.next_priorities || [],
          };
          
          // Save tasks to database
          for (const task of transformedResults.progress.tasks || []) {
            try {
              await fetch(`http://localhost:3001/api/projects/${projectId}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  task_name: task.task_name,
                  task_description: task.task_description,
                  status: task.status,
                }),
              });
            } catch (e) {
              console.error('[Agent Flow] Error saving task:', e);
            }
          }
        }

        return NextResponse.json({
          success: true,
          results: transformedResults,
          summary: pythonData.summary || {
            files_analyzed: Object.keys(files).length,
            validation_complete: !!transformedResults.validation,
            feedback_generated: !!transformedResults.feedback,
            progress_tracked: !!transformedResults.progress,
            completion_percentage: transformedResults.progress?.progress?.percentage || 0,
          },
          agentsRun: pythonData.agentsRun,
          successCount: pythonData.successCount,
          method: 'python-service',
          filesProcessed: Object.keys(files).length,
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: any) {
      console.error('[Agent Flow] Error calling Python service:', error);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to run agent flow via Python service',
        message: error.message,
        suggestion: 'Make sure the Python service is running on port 8000',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in agent flow:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run agent flow',
        message: error.message,
      },
      { status: 500 }
    );
  }
}



