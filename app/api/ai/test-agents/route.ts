import { NextRequest, NextResponse } from 'next/server';

// Test endpoint to verify all agents are working
export async function GET(request: NextRequest) {
  try {
    const agents = [
      {
        name: 'agentic-reasoning',
        endpoint: '/api/ai/agentic-reasoning',
        method: 'POST',
        status: 'active',
        description: 'Creates autonomous plans from problem statements',
      },
      {
        name: 'auto-explain',
        endpoint: '/api/ai/auto-explain',
        method: 'POST',
        status: 'active',
        description: 'Auto-explains code when files are opened',
      },
      {
        name: 'auto-review',
        endpoint: '/api/ai/auto-review',
        method: 'POST',
        status: 'active',
        description: 'Reviews entire codebase for quality',
      },
      {
        name: 'multi-step-validate',
        endpoint: '/api/ai/multi-step-validate',
        method: 'POST',
        status: 'active',
        description: 'Validates large codebases by splitting into chunks (recommended for all validation)',
      },
      {
        name: 'validate-completion',
        endpoint: '/api/ai/validate-completion',
        method: 'POST',
        status: 'deprecated',
        description: 'DEPRECATED: Use multi-step-validate instead. Basic validation (being phased out)',
      },
      {
        name: 'learning-feedback',
        endpoint: '/api/ai/learning-feedback',
        method: 'POST',
        status: 'active',
        description: 'Generates learning feedback with mistakes and improvements',
      },
      {
        name: 'generate-documentation',
        endpoint: '/api/ai/generate-documentation',
        method: 'POST',
        status: 'active',
        description: 'Unified documentation generator (README, API docs, technical docs, user guides, architecture)',
      },
      {
        name: 'generate-docs',
        endpoint: '/api/ai/generate-docs',
        method: 'POST',
        status: 'deprecated',
        description: 'DEPRECATED: Use generate-documentation with docType="api" instead',
      },
      {
        name: 'generate-readme',
        endpoint: '/api/ai/generate-readme',
        method: 'POST',
        status: 'deprecated',
        description: 'DEPRECATED: Use generate-documentation with docType="readme" instead',
      },
      {
        name: 'learning-approach',
        endpoint: '/api/ai/learning-approach',
        method: 'POST',
        status: 'active',
        description: 'Creates personalized learning paths',
      },
      {
        name: 'progress-tracker',
        endpoint: '/api/ai/progress-tracker',
        method: 'POST',
        status: 'active',
        description: 'Tracks task completion and progress percentage',
      },
      {
        name: 'chat',
        endpoint: '/api/ai/chat',
        method: 'POST',
        status: 'active',
        description: 'Interactive chat with AI mentor',
      },
    ];

    // Check if Groq is configured
    const groqConfigured = !!process.env.GROQ_API_KEY;

    return NextResponse.json({
      success: true,
      agents,
      configuration: {
        groq_configured: groqConfigured,
        total_agents: agents.length,
        active_agents: agents.filter(a => a.status === 'active').length,
      },
      message: groqConfigured 
        ? 'All agents are configured and ready'
        : 'Warning: GROQ_API_KEY not set. Agents will not work properly.',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

