import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';
import { parsePythonResponse } from '@/lib/pythonResponseParser';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Validate Completion - Uses Python Service
 * DEPRECATED: Use multi-step-validate instead
 * Calls the Python CrewAI validation agent
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    console.warn('[DEPRECATED] validate-completion endpoint called. Use multi-step-validate instead.');
    
    const { projectId, files, problemStatement, techStack } = await request.json();

    if (!projectId) {
      return NextResponse.json({
        success: false,
        isValid: false,
        feedback: 'Project ID is required',
        deprecated: true,
        alternative: '/api/ai/multi-step-validate',
      });
    }

    if (!problemStatement) {
      return NextResponse.json({
        success: false,
        isValid: false,
        feedback: 'Problem statement is required for validation',
      });
    }

    console.log(`[Validate Completion] Starting for project ${projectId}`);

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

    // Call Python service validation endpoint
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement,
          techStack,
          files: processedFiles,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Validate Completion] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Validate Completion] Successfully validated`);
        
        // Parse Python service response (handles markdown code blocks)
        const parsedData = parsePythonResponse(pythonData, 'validation');
        const valData = parsedData || {};
        
        const overallStatus = valData?.overall_status || valData?.status || 'incomplete';
        const isValid = overallStatus === 'complete';
        const feedback = valData?.feedback || valData?.summary || 'Validation completed';
        
        return NextResponse.json({
          success: true,
          isValid,
          feedback,
          validatedAt: new Date().toISOString(),
          deprecated: true,
          warning: 'This endpoint is deprecated. Please use /api/ai/multi-step-validate for better validation.',
          alternative: '/api/ai/multi-step-validate',
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Validate Completion] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          isValid: false,
          feedback: 'Failed to validate completion via Python service. Please make sure the Python service is running on port 8000.',
          deprecated: true,
          alternative: '/api/ai/multi-step-validate',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Validate Completion] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        isValid: false,
        feedback: 'Failed to validate completion. Please try again.',
        deprecated: true,
        alternative: '/api/ai/multi-step-validate',
      },
      { status: 500 }
    );
  }
}
