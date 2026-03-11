import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';
import { parsePythonResponse, extractJSONFromResponse } from '@/lib/pythonResponseParser';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Multi-Step Validation - Uses Python Service
 * Calls the Python CrewAI validation agent
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, files, problemStatement, techStack } = await request.json();

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

    console.log(`[Multi-Step Validate] Starting for project ${projectId}`);

    // Filter out binary files before processing
    const textFiles = files ? filterTextFiles(files) : {};
    
    // Process files (convert to string for Python service)
    // Limit to ~15000 chars (~3750 tokens) to stay within Groq's 6000 token limit including prompt
    const processedFiles = Object.keys(textFiles).length > 0 ? JSON.stringify(textFiles).substring(0, 15000) : '';

    // Call Python service for validation
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
        console.error(`[Multi-Step Validate] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Multi-Step Validate] Successfully completed validation`);
        
        // Parse Python service response (handles markdown code blocks)
        const parsedData = parsePythonResponse(pythonData, 'validation');
        const valData = parsedData || {};
        
        // Extract validation info
        const overallStatus = valData?.overall_status || valData?.status || 'incomplete';
        const percentage = valData?.percentage || valData?.average_completeness || 0;
        
        // Calculate file counts (if available)
        const completeFiles = valData?.complete_files || valData?.whats_working?.length || 0;
        const incompleteFiles = valData?.incomplete_files || valData?.whats_missing?.length || 0;
        const errorFiles = overallStatus === 'error' ? 1 : 0;
        const feedback = valData?.feedback || valData?.summary || valData?.critical_missing || 'Validation completed';
        
        console.log(`[Multi-Step Validate] Parsed: status=${overallStatus}, percentage=${percentage}, complete=${completeFiles}, incomplete=${incompleteFiles}`);
        
        return NextResponse.json({
          success: true,
          validation: {
            overall_status: overallStatus,
            total_chunks: 1, // Python service handles this internally
            total_files: completeFiles + incompleteFiles || 1,
            complete_files: completeFiles,
            incomplete_files: incompleteFiles,
            error_files: errorFiles,
            average_completeness: Math.round(percentage),
            feedback,
            chunks: [{
              chunk: 1,
              files: [],
              overall_status: overallStatus,
              feedback
            }],
            all_files: [],
          },
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Multi-Step Validate] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to validate code via Python service',
          message: errorMessage,
          suggestion: 'Make sure the Python service is running on port 8000',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Multi-Step Validate] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate code',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

