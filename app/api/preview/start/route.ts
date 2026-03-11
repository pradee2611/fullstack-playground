import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, project } = await request.json();
    
    // Forward to backend server
    const response = await fetch('http://localhost:3001/api/preview/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, project }),
    });
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error starting preview:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start preview server' },
      { status: 500 }
    );
  }
}

