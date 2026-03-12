import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';
import { parsePythonResponse } from '@/lib/pythonResponseParser';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Auto Review - Uses Python Service
 * Calls the Python CrewAI feedback agent for code review
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, files, problemStatement, techStack } = await request.json();

    if (!projectId) {
      return NextResponse.json({
        success: false,
        review: 'Project ID is required',
      });
    }

    console.log(`[Auto Review] Starting for project ${projectId}`);

    // If files not provided, fetch from database
    let fileStructure = files;
    if (!fileStructure && projectId) {
      try {
        const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/files-structure`);
        const filesData = await filesResponse.json();
        if (filesData.success) {
          fileStructure = filesData.files || filesData.fileStructure;
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

    // Call Python service feedback endpoint for code review
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement,
          files: processedFiles,
          validationResults: null, // No validation results for simple review
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Auto Review] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Auto Review] Successfully generated review`);
        
        // Parse Python service response (handles markdown code blocks)
        const parsedData = parsePythonResponse(pythonData, 'feedback');
        const fbData = parsedData || {};
        
        // Format review text from feedback
        const review = fbData?.summary || fbData?.overall_feedback || 
                      (fbData?.improvements && fbData.improvements.length > 0 
                        ? `Review: ${fbData.improvements.map((i: any) => i.suggestion || i).join('\n')}`
                        : 'Code review completed. No major issues found.');
        
        return NextResponse.json({
          success: true,
          review,
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Auto Review] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          review: 'Failed to generate review. Please make sure the Python service is running on port 8000.',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Auto Review] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        review: 'Failed to generate review. Please try again.',
      },
      { status: 500 }
    );
  }
}
