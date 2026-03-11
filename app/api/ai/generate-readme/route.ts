/**
 * @deprecated This endpoint is deprecated. Use /api/ai/generate-documentation with docType='readme' instead.
 */
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export async function POST(request: NextRequest) {
  try {
    const { projectId, files, problemStatement, techStack, projectName } = await request.json();

    if (!groq) {
      return NextResponse.json({
        success: false,
        error: 'AI service not configured',
      });
    }

    // Analyze project structure
    const fileList: string[] = [];
    const getFileList = (fileStructure: any, path: string = ''): void => {
      for (const [key, value] of Object.entries(fileStructure)) {
        const fullPath = path ? `${path}/${key}` : key;
        if (typeof value === 'string') {
          fileList.push(fullPath);
        } else if (typeof value === 'object') {
          getFileList(value, fullPath);
        }
      }
    };
    getFileList(files);

    // Check for common files
    const hasPackageJson = fileList.some(f => f.includes('package.json'));
    const hasConfig = fileList.some(f => f.includes('config'));
    const hasTests = fileList.some(f => f.includes('test') || f.includes('spec'));

    const systemPrompt = `You are a README generator. Create a professional, comprehensive README.md file for this project.

Project Name: ${projectName || 'Project'}
Problem Statement: ${problemStatement}
Tech Stack: ${techStack || 'Not specified'}

Generate a README that includes:
1. Project Title and Description
2. Features
3. Installation Instructions
4. Usage Guide
5. Project Structure
6. Configuration
7. Technologies Used
8. Contributing Guidelines
9. License (if applicable)

Make it markdown formatted, professional, and easy to follow.`;

    const userPrompt = `Generate README.md for this project:

Project Files:
${fileList.join('\n')}

${hasPackageJson ? 'Has package.json - include npm install instructions' : ''}
${hasConfig ? 'Has config files - include configuration section' : ''}
${hasTests ? 'Has test files - include testing section' : ''}

Create a comprehensive README.md file.`;

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

      const readme = completion.choices[0]?.message?.content || '# README\n\nREADME generation failed.';

      return NextResponse.json({
        success: true,
        readme,
      });
    } catch (error: any) {
      console.error('Error generating README:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate README',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in generate-readme:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process README request',
      },
      { status: 500 }
    );
  }
}

