import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';
import { parsePythonResponse, extractJSONFromResponse } from '@/lib/pythonResponseParser';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Agentic Reasoning - Uses Python Service
 * Calls the Python CrewAI reasoning agent
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, problemStatement, files, techStack, currentState } = await request.json();

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

    console.log(`[Agentic Reasoning] Starting for project ${projectId}`);

    // Filter out binary files before processing
    const textFiles = files ? filterTextFiles(files) : {};
    
    // Process files (convert to string for Python service)
    // Limit to ~8000 chars (~2000 tokens) to stay within Groq's 6000 token limit including prompt
    const processedFiles = Object.keys(textFiles).length > 0 ? JSON.stringify(textFiles).substring(0, 8000) : 'No files created yet';
    
    // Truncate currentState (conversation history) to 2000 chars
    const truncatedCurrentState = currentState && currentState.length > 2000 
      ? '... [earlier conversation truncated] ...\n' + currentState.slice(-2000)
      : currentState;

    // Call Python service for reasoning
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/reasoning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement,
          techStack,
          files: processedFiles,
          currentState: truncatedCurrentState,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Agentic Reasoning] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Agentic Reasoning] Successfully generated plan`);
        
        // Parse Python service response (handles markdown code blocks)
        const parsedPlan = parsePythonResponse(pythonData, 'plan');
        const planData = Array.isArray(parsedPlan) ? parsedPlan : (parsedPlan ? [parsedPlan] : []);
        const plan = planData || [];
        
        // Get next steps
        const nextStepsRaw = pythonData.nextSteps || pythonData.data || 'Continue working on your project step by step.';
        const nextSteps = typeof nextStepsRaw === 'string' ? nextStepsRaw : JSON.stringify(nextStepsRaw);
        
        return NextResponse.json({
          success: true,
          plan: plan.map((step: any, index: number) => ({
            step: step.step || index + 1,
            action: step.action || step.task || 'Continue',
            reasoning: step.reasoning || step.description || '',
            tool: step.tool,
            parameters: step.parameters,
            status: 'planned' as const,
          })),
          nextSteps,
          reasoning: `I've analyzed your project and created a plan with ${plan.length} steps.`,
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Agentic Reasoning] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate reasoning via Python service',
          message: errorMessage,
          plan: [],
          nextSteps: 'Continue working on your project step by step.',
          suggestion: 'Make sure the Python service is running on port 8000',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Agentic Reasoning] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate reasoning',
        message: errorMessage,
        plan: [],
        nextSteps: 'Continue working on your project step by step.',
      },
      { status: 500 }
    );
  }
}
