/**
 * Token Management Utility
 * Handles token estimation, content optimization, and validation for AI API calls
 * 
 * Groq TPM (Tokens Per Minute) limits:
 * - llama-3.1-8b-instant: 6000 TPM
 * - Other models may have different limits
 */

// Rough estimation: 1 token ≈ 4 characters (conservative)
const CHARS_PER_TOKEN = 4;
export const MAX_SAFE_TOKENS = 5500; // Leave buffer below 6000 limit
const MAX_SAFE_CHARS = MAX_SAFE_TOKENS * CHARS_PER_TOKEN; // ~22,000 chars

/**
 * Estimate token count from text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 characters
  // This is conservative - actual may be less
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Optimize file content for AI processing
 * - Truncates large files intelligently
 * - Removes excessive whitespace
 * - Keeps important parts (imports, exports, function signatures)
 */
export function optimizeFileContent(content: string, maxChars: number = 1500): string {
  if (!content || content.length <= maxChars) {
    return content;
  }

  // For very large files, extract key parts
  const lines = content.split('\n');
  
  // Keep first 30 lines (usually imports, setup)
  const firstLines = lines.slice(0, 30).join('\n');
  
  // Keep last 20 lines (usually exports, closing)
  const lastLines = lines.slice(-20).join('\n');
  
  // Try to find function/class definitions in the middle
  const middleLines: string[] = [];
  const importantPatterns = [
    /^(export\s+)?(function|const|class|interface|type|enum)\s+\w+/,
    /^(export\s+)?(async\s+)?function\s+\w+/,
    /^export\s+(default\s+)?/,
  ];
  
  // Sample middle section for important patterns
  const middleStart = Math.floor(lines.length * 0.3);
  const middleEnd = Math.floor(lines.length * 0.7);
  for (let i = middleStart; i < middleEnd && middleLines.length < 15; i++) {
    if (importantPatterns.some(pattern => pattern.test(lines[i]))) {
      // Include the matched line and next 2-3 lines
      middleLines.push(...lines.slice(i, Math.min(i + 3, middleEnd)));
      i += 3; // Skip ahead
    }
  }
  
  const middleSection = middleLines.join('\n');
  const optimized = [
    firstLines,
    '\n\n... [File truncated - showing key sections] ...\n\n',
    middleSection,
    '\n\n... [File truncated] ...\n\n',
    lastLines,
  ].join('\n');
  
  // Final truncation if still too long
  if (optimized.length > maxChars) {
    const firstPart = optimized.substring(0, maxChars - 500);
    const lastPart = optimized.substring(optimized.length - 500);
    return `${firstPart}\n\n... [Further truncated] ...\n\n${lastPart}`;
  }
  
  return optimized;
}

/**
 * Convert file structure to optimized JSON format
 * Reduces token count by using compact JSON representation
 */
export function filesToOptimizedJSON(
  files: any,
  maxFiles: number = 10,
  maxCharsPerFile: number = 1500
): string {
  const fileList: Array<{ path: string; content: string }> = [];
  
  const extractFiles = (fileStructure: any, path: string = ''): void => {
    for (const [key, value] of Object.entries(fileStructure)) {
      const fullPath = path ? `${path}/${key}` : key;
      if (typeof value === 'string') {
        fileList.push({
          path: fullPath,
          content: optimizeFileContent(value, maxCharsPerFile)
        });
      } else if (typeof value === 'object' && value !== null) {
        extractFiles(value, fullPath);
      }
    }
  };
  
  if (files && Object.keys(files).length > 0) {
    extractFiles(files);
  }
  
  // Limit number of files
  const limitedFiles = fileList.slice(0, maxFiles);
  
  // Convert to compact JSON
  return JSON.stringify(limitedFiles.map(f => ({
    p: f.path, // 'p' instead of 'path' saves tokens
    c: f.content // 'c' instead of 'content' saves tokens
  })));
}

/**
 * Get file content in optimized format for AI
 * Returns either JSON format or text format based on size
 */
export function getOptimizedFileContent(
  files: any,
  activeFile?: string,
  maxFiles: number = 5,
  maxCharsPerFile: number = 1000
): { format: 'json' | 'text'; content: string; tokenCount: number } {
  if (!files || Object.keys(files).length === 0) {
    return { format: 'text', content: '', tokenCount: 0 };
  }

  // If active file specified, prioritize it
  if (activeFile) {
    const getFileContent = (fileStructure: any, path: string): string => {
      const parts = path.split('/');
      let current = fileStructure;
      for (const part of parts) {
        if (current[part] === undefined) return '';
        current = current[part];
      }
      return typeof current === 'string' ? current : '';
    };

    const activeContent = getFileContent(files, activeFile);
    if (activeContent) {
      const optimized = optimizeFileContent(activeContent, maxCharsPerFile);
      const content = `Active file: ${activeFile}\n\n${optimized}`;
      return {
        format: 'text',
        content,
        tokenCount: estimateTokens(content)
      };
    }
  }

  // Use JSON format for multiple files (more compact)
  const jsonContent = filesToOptimizedJSON(files, maxFiles, maxCharsPerFile);
  const jsonPrompt = `Files (JSON format):\n${jsonContent}`;
  
  return {
    format: 'json',
    content: jsonPrompt,
    tokenCount: estimateTokens(jsonPrompt)
  };
}

/**
 * Build optimized prompt with token validation
 */
export function buildOptimizedPrompt(
  systemPrompt: string,
  userPrompt: string,
  conversationHistory: any[] = [],
  maxTokens: number = MAX_SAFE_TOKENS
): { messages: any[]; estimatedTokens: number; wasTruncated: boolean } {
  // Optimize conversation history (keep only last 3 messages to save tokens)
  const optimizedHistory = conversationHistory.slice(-3).map((msg: any) => ({
    role: msg.role,
    content: typeof msg.content === 'string' 
      ? msg.content.substring(0, 300) // Limit history messages
      : msg.content
  }));
  
  // Build messages
  let messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...optimizedHistory,
    { role: 'user', content: userPrompt }
  ];
  
  // Estimate total tokens
  const totalText = messages.map(m => m.content).join(' ');
  let estimatedTokens = estimateTokens(totalText);
  let wasTruncated = false;
  
  // If over limit, progressively truncate
  if (estimatedTokens > maxTokens) {
    wasTruncated = true;
    const excessTokens = estimatedTokens - maxTokens;
    const excessChars = excessTokens * CHARS_PER_TOKEN;
    
    // First, truncate system prompt if needed
    if (estimateTokens(systemPrompt) > 500) {
      messages[0].content = systemPrompt.substring(0, 500) + '... [truncated]';
    }
    
    // Then truncate user prompt
    const userContent = userPrompt.substring(0, Math.max(0, userPrompt.length - excessChars - 200));
    messages[messages.length - 1].content = `${userContent}\n\n[Content truncated due to token limit]`;
    
    // Recalculate
    estimatedTokens = estimateTokens(
      messages.map(m => m.content).join(' ')
    );
  }
  
  return { messages, estimatedTokens, wasTruncated };
}

/**
 * Validate and optimize content before API call
 */
export function validateAndOptimizeContent(
  content: string,
  maxTokens: number = MAX_SAFE_TOKENS
): { optimized: string; tokens: number; wasTruncated: boolean } {
  const tokens = estimateTokens(content);
  const wasTruncated = tokens > maxTokens;
  
  if (wasTruncated) {
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const optimized = content.substring(0, maxChars - 100) + '\n\n[Content truncated]';
    return {
      optimized,
      tokens: estimateTokens(optimized),
      wasTruncated: true
    };
  }
  
  return {
    optimized: content,
    tokens,
    wasTruncated: false
  };
}

/**
 * Handle 413 errors with automatic retry
 */
export async function callWithRetry<T>(
  apiCall: () => Promise<T>,
  onRetry?: (attempt: number, error: any) => void,
  maxRetries: number = 2
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      
      // If it's a 413 error and we have retries left, try again
      if (error.status === 413 && attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt + 1, error);
        }
        // Wait a bit before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      // For other errors or no retries left, throw
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Extract error details from Groq API errors
 */
export function extractGroqError(error: any): {
  status: number;
  message: string;
  retryAfter?: number;
  limit?: number;
  requested?: number;
} {
  const status = error.status || 500;
  let message = 'Unknown error';
  let retryAfter: number | undefined;
  let limit: number | undefined;
  let requested: number | undefined;
  
  if (error.error?.message) {
    message = error.error.message;
    
    // Extract retry-after from headers
    if (error.headers?.['retry-after']) {
      retryAfter = parseInt(error.headers['retry-after'], 10);
    }
    
    // Extract limit info from message
    const limitMatch = message.match(/Limit (\d+)/);
    const requestedMatch = message.match(/Requested (\d+)/);
    
    if (limitMatch) limit = parseInt(limitMatch[1], 10);
    if (requestedMatch) requested = parseInt(requestedMatch[1], 10);
  }
  
  return { status, message, retryAfter, limit, requested };
}

/**
 * Chunk large content into smaller pieces
 */
export function chunkContent(content: string, maxChunkSize: number = MAX_SAFE_CHARS): string[] {
  if (content.length <= maxChunkSize) {
    return [content];
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  const lines = content.split('\n');
  
  for (const line of lines) {
    if ((currentChunk + line + '\n').length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Create summary of content using iterative summarization
 * This is a chat-like loop that creates summaries until we get proper content
 */
export async function createIterativeSummary(
  content: string,
  groq: any,
  context: string = '',
  maxIterations: number = 3
): Promise<string> {
  // If content is small enough, return as-is
  if (estimateTokens(content) < MAX_SAFE_TOKENS * 0.8) {
    return content;
  }
  
  // Split into chunks
  const chunks = chunkContent(content, MAX_SAFE_CHARS * 0.7);
  
  if (chunks.length === 1) {
    // Single chunk but still too large - create summary
    return await summarizeChunk(chunks[0], groq, context);
  }
  
  // Summarize each chunk
  const summaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const summary = await summarizeChunk(chunks[i], groq, `${context} (Chunk ${i + 1}/${chunks.length})`);
    summaries.push(summary);
    
    // Small delay to avoid rate limits
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Combine summaries
  let combinedSummary = summaries.join('\n\n---\n\n');
  
  // If combined summary is still too large, summarize again (recursive)
  if (estimateTokens(combinedSummary) > MAX_SAFE_TOKENS * 0.8 && maxIterations > 0) {
    return await createIterativeSummary(combinedSummary, groq, context, maxIterations - 1);
  }
  
  return combinedSummary;
}

/**
 * Summarize a single chunk
 */
async function summarizeChunk(chunk: string, groq: any, context: string): Promise<string> {
  const systemPrompt = `You are a summarization AI. Create a concise, comprehensive summary of the provided content.
  
${context ? `Context: ${context}` : ''}

Focus on:
- Key points and main ideas
- Important details and facts
- Structure and organization
- Critical information

Keep the summary informative but concise.`;

  const userPrompt = `Summarize this content:\n\n${chunk}`;
  
  const { messages } = buildOptimizedPrompt(systemPrompt, userPrompt, [], MAX_SAFE_TOKENS * 0.6);
  
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.3, // Lower temperature for more consistent summaries
      max_tokens: 1500,
    });
    
    return completion.choices[0]?.message?.content || chunk.substring(0, 1000) + '...';
  } catch (error: any) {
    // If summarization fails, return truncated chunk
    console.error('[Summarize] Error:', error);
    return chunk.substring(0, 1000) + '... [Summary failed, showing truncated content]';
  }
}

/**
 * Process large file structure with iterative summarization
 */
export async function processLargeFiles(
  files: any,
  groq: any,
  maxFiles: number = 20,
  maxCharsPerFile: number = 800
): Promise<string> {
  const fileList: Array<{ path: string; content: string }> = [];
  
  const extractFiles = (fileStructure: any, path: string = ''): void => {
    for (const [key, value] of Object.entries(fileStructure)) {
      const fullPath = path ? `${path}/${key}` : key;
      if (typeof value === 'string') {
        fileList.push({
          path: fullPath,
          content: optimizeFileContent(value, maxCharsPerFile)
        });
      } else if (typeof value === 'object' && value !== null) {
        extractFiles(value, fullPath);
      }
    }
  };
  
  if (files && Object.keys(files).length > 0) {
    extractFiles(files);
  }
  
  // Limit files
  const limitedFiles = fileList.slice(0, maxFiles);
  
  // Convert to JSON format
  const jsonContent = JSON.stringify(limitedFiles.map(f => ({
    p: f.path,
    c: f.content
  })));
  
  // If still too large, create summary
  if (estimateTokens(jsonContent) > MAX_SAFE_TOKENS * 0.7) {
    return await createIterativeSummary(jsonContent, groq, 'Project files');
  }
  
  return jsonContent;
}

/**
 * Process ALL files sequentially with delays to handle token limits
 * Processes every file type, one by one, with 5-10 second delays between batches
 */
export async function processLargeFilesSequential(
  files: any,
  groq: any,
  maxCharsPerFile: number = 800,
  delayBetweenBatches: number = 7000, // 7 seconds default
  batchSize: number = 5 // Process 5 files at a time
): Promise<string> {
  const fileList: Array<{ path: string; content: string; type: string }> = [];
  
  // Extract ALL files (no filtering by type)
  const extractFiles = (fileStructure: any, path: string = ''): void => {
    for (const [key, value] of Object.entries(fileStructure)) {
      const fullPath = path ? `${path}/${key}` : key;
      if (typeof value === 'string') {
        // Detect file type from extension
        const extension = fullPath.split('.').pop()?.toLowerCase() || 'txt';
        const fileType = getFileTypeCategory(extension);
        
        fileList.push({
          path: fullPath,
          content: optimizeFileContent(value, maxCharsPerFile),
          type: fileType
        });
      } else if (typeof value === 'object' && value !== null) {
        extractFiles(value, fullPath);
      }
    }
  };
  
  if (files && Object.keys(files).length > 0) {
    extractFiles(files);
  }
  
  if (fileList.length === 0) {
    return 'No files found in project.';
  }
  
  console.log(`[Sequential Processing] Found ${fileList.length} files to process`);
  
  // Process files in batches with delays
  const processedBatches: string[] = [];
  const totalBatches = Math.ceil(fileList.length / batchSize);
  
  for (let i = 0; i < fileList.length; i += batchSize) {
    const batch = fileList.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`[Sequential Processing] Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)...`);
    
    // Process this batch
    const batchContent = batch.map(f => ({
      p: f.path,
      c: f.content,
      t: f.type // file type
    }));
    
    const batchJson = JSON.stringify(batchContent);
    const batchTokens = estimateTokens(batchJson);
    
    // If batch is too large, summarize it
    let processedBatch: string;
    if (batchTokens > MAX_SAFE_TOKENS * 0.5 && groq) {
      try {
        processedBatch = await createIterativeSummary(batchJson, groq, `Batch ${batchNumber}/${totalBatches}`);
      } catch (error) {
        console.error(`[Sequential Processing] Error summarizing batch ${batchNumber}:`, error);
        processedBatch = batchJson.substring(0, MAX_SAFE_CHARS * 0.5) + '... [truncated]';
      }
    } else {
      processedBatch = batchJson;
    }
    
    processedBatches.push(processedBatch);
    
    // Wait between batches (except for the last one)
    if (i + batchSize < fileList.length) {
      console.log(`[Sequential Processing] Waiting ${delayBetweenBatches}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  // Combine all batches
  const combinedContent = processedBatches.join('\n\n---BATCH_SEPARATOR---\n\n');
  const totalTokens = estimateTokens(combinedContent);
  
  console.log(`[Sequential Processing] Combined ${processedBatches.length} batches, total tokens: ${totalTokens}`);
  
  // If combined content is still too large, create final summary
  if (totalTokens > MAX_SAFE_TOKENS * 0.8 && groq) {
    console.log('[Sequential Processing] Creating final summary...');
    try {
      return await createIterativeSummary(combinedContent, groq, 'All project files');
    } catch (error) {
      console.error('[Sequential Processing] Error creating final summary:', error);
      return combinedContent.substring(0, MAX_SAFE_CHARS * 0.8) + '... [truncated]';
    }
  }
  
  return combinedContent;
}

/**
 * Get file type category from extension
 */
function getFileTypeCategory(extension: string): string {
  const categories: Record<string, string> = {
    // Code files
    'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
    'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp',
    'go': 'go', 'rs': 'rust', 'php': 'php', 'rb': 'ruby', 'swift': 'swift',
    'kt': 'kotlin', 'scala': 'scala', 'r': 'r', 'sql': 'sql',
    // Web files
    'html': 'html', 'css': 'css', 'scss': 'css', 'sass': 'css', 'less': 'css',
    'vue': 'vue', 'svelte': 'svelte',
    // Config files
    'json': 'config', 'yaml': 'config', 'yml': 'config', 'toml': 'config',
    'xml': 'config', 'ini': 'config', 'env': 'config',
    // Documentation
    'md': 'markdown', 'txt': 'text', 'rst': 'text',
    // Data files
    'csv': 'data', 'xlsx': 'data',
    // Other
    'sh': 'script', 'bat': 'script', 'ps1': 'script',
    'dockerfile': 'config', 'makefile': 'config',
  };
  
  return categories[extension] || 'other';
}

