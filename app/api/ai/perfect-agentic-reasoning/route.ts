import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import {
  buildOptimizedPrompt,
  processLargeFiles,
  processLargeFilesSequential,
  estimateTokens,
  extractGroqError,
  MAX_SAFE_TOKENS,
} from '@/lib/tokenManager';

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

interface AgentResult {
  agent: string;
  success: boolean;
  data?: any;
  error?: string;
  tokensUsed?: number;
}

/**
 * Perfect Agentic Reasoning System
 * Chains all agents together with iterative summarization for large content
 * Optimized for free Groq API (6000 TPM limit)
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, problemStatement, files, techStack } = await request.json();

    if (!groq) {
      return NextResponse.json({
        success: false,
        error: 'AI service not configured',
      });
    }

    if (!problemStatement) {
      return NextResponse.json({
        success: false,
        error: 'Problem statement is required',
      });
    }

    // Get base URL
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    console.log(`[Perfect Agent] Starting for project ${projectId}`);

    // Step 1: Sync files if projectId provided
    if (projectId) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/sync-from-fs`, {
          method: 'POST',
        }).catch(() => {});
      } catch (e) {
        console.error('[Perfect Agent] Error syncing files:', e);
      }
    }

    // Step 2: Get files if not provided, or check if files is already processed
    let fileStructure: any = files;
    let processedFiles: string = '';
    
    // Check if files is already a processed string (from agent-flow)
    if (typeof files === 'string') {
      console.log('[Perfect Agent] Files already processed by agent-flow, using directly...');
      processedFiles = files;
    } else if (!fileStructure && projectId) {
      try {
        const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/files-structure`);
        const filesData = await filesResponse.json();
        if (filesData.success) {
          // Handle both response formats (files or fileStructure)
          fileStructure = filesData.files || filesData.fileStructure;
        }
      } catch (e) {
        console.error('[Perfect Agent] Error fetching files:', e);
      }
    }

    const results: Record<string, AgentResult> = {};
    
    // Chain of Thought: Build context step by step
    interface ChainOfThought {
      step: number;
      agent: string;
      input: string;
      output: string;
      reasoning: string;
    }
    
    const chainOfThought: ChainOfThought[] = [];
    let currentContext = `Problem Statement: ${problemStatement}\nTech Stack: ${techStack || 'Not specified'}\n`;

    // Step 3: Process files with sequential processing (only if not already processed)
    if (!processedFiles && fileStructure && typeof fileStructure === 'object' && Object.keys(fileStructure).length > 0) {
      try {
        console.log('[Perfect Agent] Step 0: Processing ALL files sequentially...');
        processedFiles = await processLargeFilesSequential(
          fileStructure,
          groq,
          800, // maxCharsPerFile
          7000, // 7 second delay between batches
          5 // batch size
        );
        console.log(`[Perfect Agent] Files processed: ${estimateTokens(processedFiles)} tokens`);
        currentContext += `\nFiles Summary: ${processedFiles.substring(0, 500)}...`;
        
        chainOfThought.push({
          step: 0,
          agent: 'file-processor',
          input: `Files structure with ${Object.keys(fileStructure).length} items`,
          output: `Processed ${estimateTokens(processedFiles)} tokens of file content (ALL file types)`,
          reasoning: 'Files processed sequentially with delays to handle token limits - ALL file types included'
        });
      } catch (e) {
        console.error('[Perfect Agent] Error processing files:', e);
        // Fallback to old method
        try {
          processedFiles = await processLargeFiles(fileStructure, groq, 15, 700);
        } catch (e2) {
          processedFiles = 'Files available but processing failed';
        }
      }
    } else if (processedFiles) {
      // Files already processed, just add to context
      console.log(`[Perfect Agent] Using pre-processed files: ${estimateTokens(processedFiles)} tokens`);
      currentContext += `\nFiles Summary: ${processedFiles.substring(0, 500)}...`;
      
      chainOfThought.push({
        step: 0,
        agent: 'file-processor',
        input: 'Pre-processed files from agent-flow',
        output: `Using ${estimateTokens(processedFiles)} tokens of pre-processed file content`,
        reasoning: 'Files were already processed by agent-flow, using directly to avoid duplicate processing'
      });
    }

    // Step 4: Agentic Reasoning - Create Plan (Chain of Thought Step 1)
    try {
      console.log('[Perfect Agent] Step 1: Agentic Reasoning (Chain of Thought)...');
      const reasoningResult = await runAgenticReasoningWithCoT(
        problemStatement,
        processedFiles,
        techStack,
        currentContext,
        1
      );
      results.reasoning = reasoningResult;
      
      const reasoningOutput = JSON.stringify(reasoningResult.data || {}).substring(0, 300);
      currentContext += `\n\n[Step 1 - Reasoning]\nPlan Created: ${reasoningOutput}\nNext Steps: ${reasoningResult.data?.nextSteps?.substring(0, 200) || 'N/A'}`;
      
      chainOfThought.push({
        step: 1,
        agent: 'reasoning',
        input: currentContext.substring(0, 1000),
        output: reasoningOutput,
        reasoning: reasoningResult.data?.nextSteps || 'Created step-by-step plan'
      });
    } catch (e: any) {
      console.error('[Perfect Agent] Reasoning error:', e);
      results.reasoning = {
        agent: 'reasoning',
        success: false,
        error: e.message || 'Reasoning failed',
      };
      chainOfThought.push({
        step: 1,
        agent: 'reasoning',
        input: currentContext,
        output: 'FAILED',
        reasoning: e.message || 'Reasoning failed'
      });
    }

    // Step 5: Multi-Step Validation (Chain of Thought Step 2)
    try {
      console.log('[Perfect Agent] Step 2: Multi-Step Validation (Chain of Thought)...');
      const validationResult = await runMultiStepValidationWithCoT(
        problemStatement,
        processedFiles,
        techStack,
        currentContext,
        results.reasoning?.data,
        2
      );
      results.validation = validationResult;
      
      const validationOutput = `Status: ${validationResult.data?.overall_status || 'unknown'}, Progress: ${validationResult.data?.percentage || 0}%`;
      currentContext += `\n\n[Step 2 - Validation]\n${validationOutput}\nFeedback: ${validationResult.data?.feedback?.substring(0, 200) || 'N/A'}`;
      
      chainOfThought.push({
        step: 2,
        agent: 'validation',
        input: `Previous: ${chainOfThought[chainOfThought.length - 1]?.output || 'N/A'}`,
        output: validationOutput,
        reasoning: validationResult.data?.feedback || 'Validated code against problem statement'
      });
    } catch (e: any) {
      console.error('[Perfect Agent] Validation error:', e);
      results.validation = {
        agent: 'validation',
        success: false,
        error: e.message || 'Validation failed',
      };
    }

    // Step 6: Learning Feedback (Chain of Thought Step 3)
    try {
      console.log('[Perfect Agent] Step 3: Learning Feedback (Chain of Thought)...');
      const feedbackResult = await runLearningFeedbackWithCoT(
        problemStatement,
        processedFiles,
        results.validation?.data,
        currentContext,
        chainOfThought,
        3
      );
      results.feedback = feedbackResult;
      
      const feedbackOutput = feedbackResult.data?.summary || feedbackResult.data?.feedback?.substring(0, 200) || 'N/A';
      currentContext += `\n\n[Step 3 - Learning Feedback]\n${feedbackOutput}`;
      
      chainOfThought.push({
        step: 3,
        agent: 'feedback',
        input: `Previous Steps: ${chainOfThought.map(c => `${c.agent}: ${c.output.substring(0, 100)}`).join('; ')}`,
        output: feedbackOutput,
        reasoning: 'Analyzed mistakes and provided learning opportunities'
      });
    } catch (e: any) {
      console.error('[Perfect Agent] Feedback error:', e);
      results.feedback = {
        agent: 'feedback',
        success: false,
        error: e.message || 'Feedback failed',
      };
    }

    // Step 7: Progress Tracking (Chain of Thought Step 4)
    try {
      console.log('[Perfect Agent] Step 4: Progress Tracking (Chain of Thought)...');
      let existingTasks: any[] = [];
      if (projectId) {
        try {
          const tasksResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/progress`);
          const tasksData = await tasksResponse.json();
          existingTasks = tasksData.success ? tasksData.tasks : [];
        } catch (e) {
          // Ignore
        }
      }

      const progressResult = await runProgressTrackerWithCoT(
        problemStatement,
        processedFiles,
        techStack,
        existingTasks,
        currentContext,
        chainOfThought,
        4
      );
      results.progress = progressResult;
      
      const progressOutput = `Progress: ${progressResult.data?.percentage || 0}%, Tasks: ${progressResult.data?.tasks?.length || 0}`;
      currentContext += `\n\n[Step 4 - Progress]\n${progressOutput}`;
      
      chainOfThought.push({
        step: 4,
        agent: 'progress',
        input: `All previous steps: ${chainOfThought.map(c => c.agent).join(', ')}`,
        output: progressOutput,
        reasoning: 'Tracked overall project progress and completion'
      });
    } catch (e: any) {
      console.error('[Perfect Agent] Progress error:', e);
      results.progress = {
        agent: 'progress',
        success: false,
        error: e.message || 'Progress tracking failed',
      };
    }

    // Step 8: Generate Final Summary with Complete Chain of Thought
    const finalSummary = await generateFinalSummaryWithCoT(
      problemStatement,
      results,
      currentContext,
      chainOfThought
    );

    return NextResponse.json({
      success: true,
      summary: finalSummary,
      results,
      chainOfThought,
      agentsRun: Object.keys(results).length,
      successCount: Object.values(results).filter(r => r.success).length,
      contextFlow: currentContext.substring(0, 1000), // Show how context built up
    });
  } catch (error: any) {
    console.error('[Perfect Agent] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run perfect agentic reasoning',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Run Agentic Reasoning Agent with Chain of Thought
 */
async function runAgenticReasoningWithCoT(
  problemStatement: string,
  files: string,
  techStack: string,
  context: string,
  stepNumber: number
): Promise<AgentResult> {
  const systemPrompt = `You are an autonomous AI agent using Chain of Thought reasoning.

CHAIN OF THOUGHT PROCESS:
1. First, THINK about the problem statement carefully
2. ANALYZE what files and code exist
3. IDENTIFY what needs to be built
4. CREATE a step-by-step plan
5. EXPLAIN your reasoning for each step

${context ? `\nCURRENT CONTEXT:\n${context.substring(0, 800)}` : ''}

Think step by step, then provide your plan.`;

  const userPrompt = `[Step ${stepNumber}: Reasoning Agent]

THINKING PROCESS:
1. Problem Analysis:
   - Problem: ${problemStatement.substring(0, 600)}
   - Tech Stack: ${techStack || 'Not specified'}
   
2. Current State Analysis:
   - Files Available: ${files.substring(0, 800)}
   
3. Planning:
   - What needs to be built?
   - What's the logical sequence?
   - What are the dependencies?
   
4. Create Plan:
   Format as JSON:
   {
     "thinking": "Your step-by-step thinking process",
     "steps": [
       {"step": 1, "action": "...", "reasoning": "...", "dependencies": "..."}
     ],
     "nextSteps": "What to do next",
     "criticalPath": "Most important steps"
   }`;

  const { messages, estimatedTokens } = buildOptimizedPrompt(
    systemPrompt,
    userPrompt,
    [],
    MAX_SAFE_TOKENS
  );

  if (!groq) {
    return {
      agent: 'reasoning',
      success: false,
      error: 'AI service not configured',
    };
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content || '{}';
    let data: any = {};
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      }
    } catch {
      data = { nextSteps: response };
    }

    return {
      agent: 'reasoning',
      success: true,
      data,
      tokensUsed: estimatedTokens,
    };
  } catch (error: any) {
    const errorInfo = extractGroqError(error);
    return {
      agent: 'reasoning',
      success: false,
      error: errorInfo.message,
    };
  }
}

/**
 * Run Multi-Step Validation Agent with Chain of Thought
 */
async function runMultiStepValidationWithCoT(
  problemStatement: string,
  files: string,
  techStack: string,
  context: string,
  previousResults: any,
  stepNumber: number
): Promise<AgentResult> {
  const systemPrompt = `You are a code validator using Chain of Thought reasoning.

CHAIN OF THOUGHT PROCESS:
1. REVIEW the problem statement requirements
2. EXAMINE the code files provided
3. COMPARE code against requirements
4. IDENTIFY what's implemented vs what's missing
5. CALCULATE completion percentage
6. PROVIDE detailed feedback

${context ? `\nCONTEXT FROM PREVIOUS STEPS:\n${context.substring(0, 1000)}` : ''}
${previousResults ? `\nPREVIOUS REASONING RESULTS:\n${JSON.stringify(previousResults).substring(0, 500)}` : ''}

Think through each requirement systematically.`;

  const userPrompt = `[Step ${stepNumber}: Validation Agent]

THINKING PROCESS:
1. Requirements Review:
   - Problem: ${problemStatement.substring(0, 600)}
   - Tech Stack: ${techStack || 'Not specified'}
   ${previousResults?.steps ? `\n- Planned Steps: ${JSON.stringify(previousResults.steps).substring(0, 300)}` : ''}
   
2. Code Examination:
   - Code Files: ${files.substring(0, 1000)}
   
3. Requirement-by-Requirement Check:
   - For each requirement, check if code implements it
   - Note what's working
   - Note what's missing
   
4. Validation Result:
   Format as JSON:
   {
     "thinking": "Your validation thinking process",
     "overall_status": "complete|incomplete|error",
     "percentage": 0-100,
     "whats_working": ["item1", "item2"],
     "whats_missing": ["item1", "item2"],
     "feedback": "Detailed feedback",
     "critical_missing": "Most important missing pieces"
   }`;

  const { messages, estimatedTokens } = buildOptimizedPrompt(
    systemPrompt,
    userPrompt,
    [],
    MAX_SAFE_TOKENS
  );

  if (!groq) {
    return {
      agent: 'validation',
      success: false,
      error: 'AI service not configured',
    };
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Extract status
    const statusMatch = response.match(/(complete|incomplete|error)/i);
    const overallStatus = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';
    
    // Extract percentage
    const percentMatch = response.match(/(\d+)%/);
    const percentage = percentMatch ? parseInt(percentMatch[1]) : 0;

    return {
      agent: 'validation',
      success: true,
      data: {
        overall_status: overallStatus,
        percentage,
        feedback: response,
      },
      tokensUsed: estimatedTokens,
    };
  } catch (error: any) {
    const errorInfo = extractGroqError(error);
    return {
      agent: 'validation',
      success: false,
      error: errorInfo.message,
    };
  }
}

/**
 * Run Learning Feedback Agent with Chain of Thought
 */
async function runLearningFeedbackWithCoT(
  problemStatement: string,
  files: string,
  validationResults: any,
  context: string,
  chainOfThought: any[],
  stepNumber: number
): Promise<AgentResult> {
  const systemPrompt = `You are a learning AI mentor using Chain of Thought reasoning.

CHAIN OF THOUGHT PROCESS:
1. REVIEW previous analysis (reasoning, validation)
2. EXAMINE code for mistakes and issues
3. IDENTIFY learning opportunities
4. SUGGEST improvements
5. PROVIDE educational feedback

${context ? `\nCONTEXT FROM ALL PREVIOUS STEPS:\n${context.substring(0, 1200)}` : ''}
${chainOfThought.length > 0 ? `\nCHAIN OF THOUGHT SO FAR:\n${chainOfThought.map(c => `Step ${c.step} (${c.agent}): ${c.reasoning}`).join('\n')}` : ''}

Think through what the student can learn from this code.`;

  const userPrompt = `[Step ${stepNumber}: Learning Feedback Agent]

THINKING PROCESS:
1. Review Previous Analysis:
   ${validationResults ? `- Validation Status: ${validationResults.overall_status || 'unknown'}\n- Validation Feedback: ${validationResults.feedback?.substring(0, 300) || 'N/A'}` : 'No previous validation'}
   ${chainOfThought.length > 0 ? `\n- Previous Steps: ${chainOfThought.map(c => `${c.agent} (${c.output.substring(0, 100)})`).join('; ')}` : ''}
   
2. Code Analysis:
   - Problem: ${problemStatement.substring(0, 500)}
   - Code: ${files.substring(0, 1000)}
   
3. Learning Points Identification:
   - What mistakes exist?
   - What could be improved?
   - What concepts should be learned?
   - What best practices are missing?
   
4. Educational Feedback:
   Format as JSON:
   {
     "thinking": "Your learning analysis thinking",
     "mistakes": [{"type": "...", "location": "...", "explanation": "...", "fix": "..."}],
     "improvements": [{"suggestion": "...", "why": "...", "how": "..."}],
     "learning_points": ["point1", "point2"],
     "best_practices": ["practice1", "practice2"],
     "summary": "Overall learning summary"
   }`;

  const { messages, estimatedTokens } = buildOptimizedPrompt(
    systemPrompt,
    userPrompt,
    [],
    MAX_SAFE_TOKENS
  );

  if (!groq) {
    return {
      agent: 'feedback',
      success: false,
      error: 'AI service not configured',
    };
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content || '';

    return {
      agent: 'feedback',
      success: true,
      data: {
        feedback: response,
        summary: response.substring(0, 200),
      },
      tokensUsed: estimatedTokens,
    };
  } catch (error: any) {
    const errorInfo = extractGroqError(error);
    return {
      agent: 'feedback',
      success: false,
      error: errorInfo.message,
    };
  }
}

/**
 * Run Progress Tracker Agent with Chain of Thought
 */
async function runProgressTrackerWithCoT(
  problemStatement: string,
  files: string,
  techStack: string,
  existingTasks: any[],
  context: string,
  chainOfThought: any[],
  stepNumber: number
): Promise<AgentResult> {
  const systemPrompt = `You are a progress tracker using Chain of Thought reasoning.

CHAIN OF THOUGHT PROCESS:
1. REVIEW all previous analysis (reasoning, validation, feedback)
2. BREAK DOWN problem into specific tasks
3. CHECK which tasks are completed based on code
4. CALCULATE progress percentage
5. IDENTIFY next priorities

${context ? `\nCOMPLETE CONTEXT FROM ALL STEPS:\n${context.substring(0, 1500)}` : ''}
${chainOfThought.length > 0 ? `\nFULL CHAIN OF THOUGHT:\n${chainOfThought.map(c => `Step ${c.step}: ${c.agent} → ${c.output.substring(0, 150)}`).join('\n')}` : ''}

Synthesize all previous analysis to track progress accurately.`;

  const userPrompt = `[Step ${stepNumber}: Progress Tracker Agent]

THINKING PROCESS:
1. Synthesize All Previous Analysis:
   ${chainOfThought.map(c => `- Step ${c.step} (${c.agent}): ${c.output.substring(0, 200)}`).join('\n')}
   
2. Problem Breakdown:
   - Problem: ${problemStatement.substring(0, 500)}
   - Tech Stack: ${techStack || 'Not specified'}
   ${existingTasks.length > 0 ? `\n- Existing Tasks: ${JSON.stringify(existingTasks.slice(0, 5))}` : ''}
   
3. Code Analysis:
   - Code: ${files.substring(0, 800)}
   
4. Task-by-Task Progress Check:
   - For each required task, check if implemented
   - Mark as completed/in_progress/pending
   - Provide evidence
   
5. Progress Calculation:
   Format as JSON:
   {
     "thinking": "Your progress analysis thinking",
     "tasks": [
       {"task_name": "...", "status": "completed|in_progress|pending", "evidence": "...", "priority": "high|medium|low"}
     ],
     "progress": {
       "total": 10,
       "completed": 4,
       "in_progress": 2,
       "pending": 4,
       "percentage": 50
     },
     "next_priorities": ["priority1", "priority2"],
     "critical_path": "Most important remaining tasks"
   }`;

  const { messages, estimatedTokens } = buildOptimizedPrompt(
    systemPrompt,
    userPrompt,
    [],
    MAX_SAFE_TOKENS
  );

  if (!groq) {
    return {
      agent: 'progress',
      success: false,
      error: 'AI service not configured',
    };
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content || '';

    // Extract percentage
    const percentMatch = response.match(/(\d+)%/);
    const percentage = percentMatch ? parseInt(percentMatch[1]) : 0;

    return {
      agent: 'progress',
      success: true,
      data: {
        percentage,
        tasks: existingTasks,
        feedback: response,
      },
      tokensUsed: estimatedTokens,
    };
  } catch (error: any) {
    const errorInfo = extractGroqError(error);
    return {
      agent: 'progress',
      success: false,
      error: errorInfo.message,
    };
  }
}

/**
 * Generate Final Summary with Complete Chain of Thought
 */
async function generateFinalSummaryWithCoT(
  problemStatement: string,
  results: Record<string, AgentResult>,
  context: string,
  chainOfThought: any[]
): Promise<string> {
  const systemPrompt = `You are an AI mentor creating a final comprehensive summary using Chain of Thought.

FINAL SYNTHESIS PROCESS:
1. REVIEW the complete chain of thought from all steps
2. SYNTHESIZE all agent results
3. IDENTIFY key insights and patterns
4. CREATE actionable recommendations
5. ENSURE nothing is missed

Think through everything systematically to create the perfect summary.`;

  const resultsSummary = Object.entries(results)
    .map(([key, result]) => {
      if (result.success) {
        return `${key}: ${JSON.stringify(result.data).substring(0, 300)}`;
      }
      return `${key}: Failed - ${result.error}`;
    })
    .join('\n\n');

  const userPrompt = `[Final Step: Comprehensive Summary]

COMPLETE CHAIN OF THOUGHT REVIEW:
${chainOfThought.map(c => `
Step ${c.step} - ${c.agent}:
  Input: ${c.input.substring(0, 200)}
  Reasoning: ${c.reasoning}
  Output: ${c.output.substring(0, 300)}
`).join('\n')}

ALL AGENT RESULTS:
${resultsSummary}

COMPLETE CONTEXT:
${context.substring(0, 2000)}

THINKING PROCESS FOR FINAL SUMMARY:
1. What did we learn from each step?
2. What are the key patterns across all analysis?
3. What's the overall project status?
4. What are the most critical next steps?
5. What recommendations should be made?
6. Is anything missing? (Double-check!)

Create comprehensive final summary with:
- Executive Summary (overall status)
- Key Findings (from all agents)
- Chain of Thought Summary (how we got here)
- Critical Insights
- Actionable Next Steps
- Recommendations
- Nothing Missed Checklist`;

  const { messages } = buildOptimizedPrompt(
    systemPrompt,
    userPrompt,
    [],
    MAX_SAFE_TOKENS * 0.8
  );

  if (!groq) {
    return `Summary: Analysis complete. ${Object.keys(results).length} agents ran. AI service not configured.`;
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    return completion.choices[0]?.message?.content || 'Summary generation failed';
  } catch (error: any) {
    return `Summary: Analysis complete. ${Object.keys(results).length} agents ran.`;
  }
}

