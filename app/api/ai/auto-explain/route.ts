import { NextRequest, NextResponse } from 'next/server';
import { parsePythonResponse } from '@/lib/pythonResponseParser';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Auto-Explain - Uses Python Service
 * Calls the Python CrewAI service to explain code
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, filePath, fileContent, problemStatement } = await request.json();

    if (!fileContent) {
      return NextResponse.json({
        success: false,
        explanation: 'No file content provided',
      });
    }

    if (!filePath) {
      return NextResponse.json({
        success: false,
        explanation: 'No file path provided',
      });
    }

    console.log(`[Auto-Explain] Explaining file: ${filePath}`);

    // Call Python service for auto-explain
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/auto-explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filePath,
          fileContent,
          problemStatement,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Auto-Explain] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Auto-Explain] Successfully generated explanation`);
        
        // Parse Python service response (handles markdown code blocks)
        const explanation = parsePythonResponse(pythonData, 'explanation');
        const explanationText = typeof explanation === 'string' ? explanation : (pythonData.explanation || 'Could not generate explanation.');
        
        return NextResponse.json({
          success: true,
          explanation: explanationText,
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Auto-Explain] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          explanation: 'Failed to generate explanation. Please make sure the Python service is running on port 8000.',
          error: 'python_service_error',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Auto-Explain] Error:', errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        explanation: 'Failed to generate explanation. Please try again.',
        error: 'unknown_error',
      },
      { status: 500 }
    );
  }
}

