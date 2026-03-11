import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Learning Approach - Uses Python Service
 * Calls the Python CrewAI reasoning agent with learning-specific prompt
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, files, problemStatement, techStack, userLevel } = await request.json();

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Project ID is required',
      });
    }

    console.log(`[Learning Approach] Starting for project ${projectId}, user level: ${userLevel || 'intermediate'}`);

    // Filter out binary files before processing
    const textFiles = files ? filterTextFiles(files) : {};
    
    // Process files (convert to string for Python service)
    // Limit to ~15000 chars (~3750 tokens) to stay within Groq's 6000 token limit including prompt
    const processedFiles = Object.keys(textFiles).length > 0 ? JSON.stringify(textFiles).substring(0, 15000) : '';

    // Create learning approach-specific prompt
    const learningPrompt = `Create a personalized learning path for this project.

User Level: ${userLevel || 'intermediate'}
Tech Stack: ${techStack || 'Not specified'}

Create a learning approach that includes:
1. Learning objectives for this project
2. Concepts to learn/understand
3. Step-by-step learning path
4. Resources and references
5. Practice exercises
6. Assessment criteria

Adapt the approach based on user level:
- Beginner: More explanations, simpler concepts first
- Intermediate: Balanced approach
- Advanced: Focus on best practices and optimization

Format as JSON with learning_objectives, concepts_to_learn, learning_path, and assessment.`;

    // Call Python service reasoning endpoint
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/reasoning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          problemStatement: `${learningPrompt}\n\n${problemStatement || ''}`,
          techStack,
          files: processedFiles,
          currentState: `User level: ${userLevel || 'intermediate'}`,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Learning Approach] Python service error: ${pythonResponse.status} ${errorText}`);
        throw new Error(`Python service error: ${pythonResponse.status} - ${errorText}`);
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        console.log(`[Learning Approach] Successfully generated learning approach`);
        
        // Extract learning approach from response
        const planData = pythonData.plan || pythonData.data || pythonData.nextSteps || {};
        let learningApproach;
        
        if (typeof planData === 'string') {
          try {
            learningApproach = JSON.parse(planData);
          } catch {
            learningApproach = {
              learning_objectives: [],
              concepts_to_learn: [],
              learning_path: [],
              assessment: {},
              raw_response: planData
            };
          }
        } else if (Array.isArray(planData)) {
          // Convert plan array to learning approach format
          learningApproach = {
            learning_objectives: planData.map((step: any) => step.action || step.step),
            concepts_to_learn: planData.map((step: any) => ({
              concept: step.action || step.step,
              description: step.reasoning || step.description || '',
              why_important: step.reasoning || '',
              resources: []
            })),
            learning_path: planData.map((step: any, index: number) => ({
              step: index + 1,
              title: step.action || `Step ${index + 1}`,
              description: step.reasoning || step.description || '',
              practice: '',
              estimated_time: '1-2 hours'
            })),
            assessment: {
              criteria: [],
              checkpoints: []
            }
          };
        } else {
          learningApproach = planData;
        }

        return NextResponse.json({
          success: true,
          learningApproach,
        });
      } else {
        throw new Error(pythonData.error || 'Python service returned unsuccessful response');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Learning Approach] Error calling Python service:', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate learning approach via Python service',
          message: errorMessage,
          suggestion: 'Make sure the Python service is running on port 8000',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Learning Approach] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process learning approach request',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
