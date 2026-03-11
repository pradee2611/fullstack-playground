import { NextRequest, NextResponse } from 'next/server';
import { filterTextFiles } from '@/lib/fileFilter';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Chat - Uses Python Service
 * Calls the Python CrewAI reasoning agent for conversational responses
 * Removed all frontend Groq logic - now delegates to Python service
 */
export async function POST(request: NextRequest) {
  try {
    const { message, files, activeFile, conversationHistory, problemStatement } = await request.json();

    if (!message) {
      return NextResponse.json({
        response: 'Please provide a message.',
        type: 'explanation',
      });
    }

    console.log(`[Chat] Processing message for active file: ${activeFile || 'none'}`);

    // Determine message type based on keywords
    let messageType: 'hint' | 'explanation' | 'debug' | 'review' = 'explanation';
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('hint') || lowerMessage.includes('help')) {
      messageType = 'hint';
    } else if (lowerMessage.includes('explain') || lowerMessage.includes('what')) {
      messageType = 'explanation';
    } else if (lowerMessage.includes('debug') || lowerMessage.includes('error') || lowerMessage.includes('fix')) {
      messageType = 'debug';
    } else if (lowerMessage.includes('review') || lowerMessage.includes('feedback')) {
      messageType = 'review';
    }

    // Build context from conversation history
    const contextMessages = conversationHistory?.slice(-5).map((msg: any) => 
      `${msg.role}: ${msg.content}`
    ).join('\n') || '';

    // Filter out binary files before processing
    const textFiles = files ? filterTextFiles(files) : {};
    
    // Process files (convert to string for Python service)
    const processedFiles = Object.keys(textFiles).length > 0 ? JSON.stringify(textFiles).substring(0, 30000) : '';

    // Create chat-specific prompt
    const chatPrompt = `User Question: ${message}
${activeFile ? `Active File: ${activeFile}` : ''}
${contextMessages ? `Previous Conversation:\n${contextMessages}` : ''}
${problemStatement ? `Project Context: ${problemStatement.substring(0, 500)}` : ''}

Please provide a helpful, educational response. Be specific and actionable.`;

    // Call Python service reasoning endpoint
    try {
      const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/reasoning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'chat-session',
          problemStatement: chatPrompt,
          techStack: 'Not specified',
          files: processedFiles,
          currentState: `Message type: ${messageType}, Active file: ${activeFile || 'none'}`,
        }),
      });

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text();
        console.error(`[Chat] Python service error: ${pythonResponse.status} ${errorText}`);
        // Fallback response
        return NextResponse.json({
          response: `I understand you're asking: "${message}". To enable full AI mentor capabilities, please make sure the Python service is running on port 8000.`,
          type: messageType,
        });
      }

      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        // Extract response from reasoning output
        const nextSteps = pythonData.nextSteps || pythonData.data || '';
        const response = typeof nextSteps === 'string' ? nextSteps : JSON.stringify(nextSteps);
        
        return NextResponse.json({
          response: response || 'I received your message. How can I help you?',
          type: messageType,
        });
      } else {
        // Fallback response
        return NextResponse.json({
          response: `I understand you're asking: "${message}". Please try again or check if the Python service is running.`,
          type: messageType,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Chat] Error calling Python service:', errorMessage);
      
      // Fallback response
      return NextResponse.json({
        response: `I understand you're asking: "${message}". To enable full AI mentor capabilities, please make sure the Python service is running on port 8000.`,
        type: messageType,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat] Error:', errorMessage);
    return NextResponse.json({
      response: 'Sorry, I encountered an error. Please try again.',
      type: 'explanation',
    });
  }
}
