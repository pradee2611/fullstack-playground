import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';
import { parsePythonResponse } from '@/lib/pythonResponseParser';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Progress Tracker - Uses Python Service
 * Calls the Python CrewAI progress tracking agent
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, problemStatement, files, techStack, existingTasks } = await request.json();

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Project ID is required',
      });
    }

    if (!problemStatement) {
      return NextResponse.json({
        success: false,
        error: 'Problem statement is required',
      });
    }

    console.log(`[Progress Tracker] Starting for project ${projectId}`);

    // If files not provided, fetch from database
    let fileStructure = files;
    if (!fileStructure && projectId) {
      try {
        const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/files-structure`);
        const filesData = await filesResponse.json();
        if (filesData.success && filesData.fileStructure) {
          fileStructure = filesData.fileStructure;
        }
      } catch (error) {
        console.error('Error fetching files from database:', error);
      }
    }

    // Filter out binary files before processing
    const textFiles = fileStructure ? filterTextFiles(fileStructure) : {};
    
    // Process files (convert to string for Python service)
    // Limit to ~15000 chars (~3750 tokens) to stay within Groq's 6000 token limit including prompt
    const processedFiles = Object.keys(textFiles).length > 0 ? JSON.stringify(textFiles).substring(0, 15000) : '';

    // Call Python service for progress tracking
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement,
          techStack,
          files: processedFiles,
          existingTasks,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Progress Tracker] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Progress Tracker] Successfully tracked progress`);
        console.log(`[Progress Tracker] Raw Python response keys:`, Object.keys(pythonData));
        console.log(`[Progress Tracker] Progress type:`, typeof pythonData.progress);
        
        // Parse Python service response (handles markdown code blocks)
        const parsedData = parsePythonResponse(pythonData, 'progress');
        console.log(`[Progress Tracker] Parsed data type:`, typeof parsedData);
        console.log(`[Progress Tracker] Parsed data keys:`, parsedData && typeof parsedData === 'object' ? Object.keys(parsedData) : 'not an object');
        
        const progData = parsedData || {};
        
        // Handle new format with file_analyses
        const fileAnalyses = pythonData.file_analyses || [];
        const totalFilesProcessed = pythonData.total_files_processed || 0;
        
        // Ensure progress calculation is correct
        const tasks = progData?.tasks || [];
        const total = tasks.length;
        const completed = tasks.filter((t: any) => t.status === 'completed').length;
        const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
        const pending = total - completed - inProgress;
        
        // Use progress object from parsed data if available, otherwise calculate
        const progressObj = progData?.progress || {};
        const finalPercentage = progressObj.percentage || (total > 0 
          ? Math.round(((completed * 100) + (inProgress * 50)) / total)
          : 0);
        
        console.log(`[Progress Tracker] Final progress: ${finalPercentage}%, Tasks: ${total}, Completed: ${completed}, In Progress: ${inProgress}`);
        console.log(`[Progress Tracker] Tasks sample:`, tasks.slice(0, 2));
        
        // Ensure we have valid data to return
        if (total === 0 && tasks.length === 0 && !parsedData) {
          console.warn(`[Progress Tracker] No progress data found, returning fallback`);
          return NextResponse.json({
            success: true,
            progress: {
              tasks: [],
              progress: {
                total_tasks: 0,
                completed: 0,
                in_progress: 0,
                pending: 0,
                percentage: 0,
              },
              next_priorities: [],
              critical_path: '',
              file_analyses: fileAnalyses,
              total_files_processed: totalFilesProcessed,
            },
          });
        }
        
        return NextResponse.json({
          success: true,
          progress: {
            tasks: tasks,
            progress: {
              total_tasks: total,
              completed,
              in_progress: inProgress,
              pending,
              percentage: finalPercentage,
            },
            next_priorities: progData?.next_priorities || [],
            critical_path: progData?.critical_path || '',
            file_analyses: fileAnalyses, // Include individual file analyses
            total_files_processed: totalFilesProcessed,
          },
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Progress Tracker] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to track progress via Python service',
          message: errorMessage,
          suggestion: 'Make sure the Python service is running on port 8000',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Progress Tracker] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track progress',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
