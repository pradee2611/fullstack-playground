import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Generate Documentation - Uses Python Service
 * Calls the Python CrewAI reasoning agent with documentation-specific prompt
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      projectId, 
      files, 
      problemStatement, 
      techStack, 
      docType = 'readme',
      projectName,
      includeCodeExamples = true 
    } = body;

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Project ID is required',
      }, { status: 400 });
    }

    if (!files || Object.keys(files).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No files provided. Cannot generate documentation without project files.',
      }, { status: 400 });
    }

    console.log(`[Generate Documentation] Starting for project ${projectId}, type: ${docType}`);

    // Filter out binary files before processing
    const textFiles = files ? filterTextFiles(files) : {};
    
    // Process files (convert to string for Python service)
    // Limit to ~15000 chars (~3750 tokens) to stay within Groq's 6000 token limit including prompt
    const processedFiles = Object.keys(textFiles).length > 0 ? JSON.stringify(textFiles).substring(0, 15000) : '';

    // Create documentation-specific prompt
    const docTypePrompts: Record<string, string> = {
      readme: 'Generate a comprehensive README.md file with installation, usage, features, and project structure.',
      api: 'Generate comprehensive API documentation with endpoints, request/response examples, and integration guide.',
      technical: 'Generate technical documentation with architecture, components, data models, and deployment guide.',
      'user-guide': 'Generate a user-friendly guide with getting started, features, step-by-step instructions, and troubleshooting.',
      architecture: 'Generate architecture documentation with system overview, components, data flow, and design patterns.',
    };

    const docPrompt = docTypePrompts[docType] || docTypePrompts.readme;

    // Call Python service reasoning endpoint with documentation prompt
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/reasoning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement: `${docPrompt}\n\nProject: ${projectName || 'Project'}\nTech Stack: ${techStack || 'Not specified'}\n${problemStatement || ''}`,
          techStack,
          files: processedFiles,
          currentState: `Documentation type: ${docType}, Include code examples: ${includeCodeExamples}`,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Generate Documentation] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Generate Documentation] Successfully generated documentation`);
        
        // Extract documentation from response
        const planData = pythonData.plan || pythonData.data || pythonData.nextSteps || '';
        let documentation = '';
        
        if (typeof planData === 'string') {
          documentation = planData;
        } else if (Array.isArray(planData) && planData.length > 0) {
          // If it's a plan array, format it as documentation
          documentation = planData.map((step: any) => 
            `## ${step.action || step.step}\n\n${step.reasoning || step.description || ''}`
          ).join('\n\n');
        } else {
          documentation = JSON.stringify(planData, null, 2);
        }
        
        return NextResponse.json({
          success: true,
          documentation,
          metadata: {
            docType,
            projectName: projectName || 'Project',
            generatedAt: new Date().toISOString(),
          },
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Generate Documentation] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate documentation via Python service',
          message: errorMessage,
          suggestion: 'Make sure the Python service is running on port 8000',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Generate Documentation] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate documentation',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
