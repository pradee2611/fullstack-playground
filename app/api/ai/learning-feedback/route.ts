import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';
import { parsePythonResponse, extractJSONFromResponse } from '@/lib/pythonResponseParser';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Learning Feedback - Uses Python Service
 * Calls the Python CrewAI feedback agent
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, files, problemStatement, validationResults } = await request.json();

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Project ID is required',
      });
    }

    console.log(`[Learning Feedback] Starting for project ${projectId}`);

    // If files not provided, fetch from database
    let fileStructure = files;
    if (!fileStructure && projectId) {
      try {
        const filesResponse = await fetch(`http://localhost:3001/api/projects/${projectId}/files-structure`);
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

    // Call Python service for feedback
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement,
          files: processedFiles,
          validationResults,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Learning Feedback] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Learning Feedback] Successfully generated feedback`);
        
        // Parse Python service response (handles markdown code blocks)
        const parsedData = parsePythonResponse(pythonData, 'feedback');
        const fbData = parsedData || {};
        
        // Extract feedback fields
        const mistakes = fbData?.mistakes || [];
        const improvements = fbData?.improvements || [];
        const learning_points = fbData?.learning_points || [];
        const summary = fbData?.summary || fbData?.overall_feedback || fbData?.feedback || 'Feedback generated successfully';
        
        console.log(`[Learning Feedback] Parsed: ${mistakes.length} mistakes, ${improvements.length} improvements`);
        
        return NextResponse.json({
          success: true,
          feedback: {
            mistakes,
            improvements,
            learning_points,
            summary,
          },
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Learning Feedback] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate feedback via Python service',
          message: errorMessage,
          suggestion: 'Make sure the Python service is running on port 8000',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Learning Feedback] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process learning feedback',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
