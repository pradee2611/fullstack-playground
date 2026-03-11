import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

/**
 * @deprecated This endpoint is deprecated. Use /api/ai/generate-documentation instead.
 * The generate-documentation endpoint is a unified agent that handles all documentation types.
 */
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  // Redirect to unified documentation endpoint
  console.warn('[DEPRECATED] generate-docs endpoint called. Use generate-documentation instead.');
  try {
    const { projectId, files, problemStatement, techStack, docType } = await request.json();

    if (!groq) {
      return NextResponse.json({
        success: false,
        error: 'AI service not configured',
      });
    }

    // Get file structure summary
    const fileSummary: string[] = [];
    const getFileContent = (fileStructure: any, path: string = ''): void => {
      for (const [key, value] of Object.entries(fileStructure)) {
        const fullPath = path ? `${path}/${key}` : key;
        if (typeof value === 'string') {
          fileSummary.push(`File: ${fullPath} (${value.length} chars)`);
        } else if (typeof value === 'object') {
          getFileContent(value, fullPath);
        }
      }
    };
    getFileContent(files);

    const systemPrompt = `You are a documentation generator. Create comprehensive ${docType || 'API'} documentation for this project.

Problem Statement: ${problemStatement}
Tech Stack: ${techStack || 'Not specified'}

Generate ${docType || 'API'} documentation that includes:
- Overview and purpose
- Architecture description
- Key components/modules
- Usage examples
- Configuration options
- API endpoints (if applicable)
- Code examples

Make it professional, clear, and comprehensive.`;

    const userPrompt = `Generate ${docType || 'API'} documentation for this project:

Project Files:
${fileSummary.join('\n')}

Create comprehensive documentation.`;

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      });

      const documentation = completion.choices[0]?.message?.content || 'Documentation generation failed.';

      return NextResponse.json({
        success: true,
        documentation,
        docType: docType || 'API',
      });
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate documentation',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in generate-docs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process documentation request',
      },
      { status: 500 }
    );
  }
}

