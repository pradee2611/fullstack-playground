/**
 * Python Response Parser
 * Extracts JSON from Python service responses that may be wrapped in markdown code blocks
 */

/**
 * Extract JSON from a string that might be wrapped in markdown code blocks
 */
export function extractJSONFromResponse(response: string | any): any {
  // If it's already an object, return it
  if (typeof response !== 'string') {
    return response;
  }

  // Try to extract JSON from markdown code blocks
  // Pattern: ```json ... ``` or ``` ... ```
  const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch (e) {
      // If parsing fails, try to find JSON object in the extracted text
      const jsonMatch = jsonBlockMatch[1].match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {
          // If still fails, return the original response
        }
      }
    }
  }

  // Try to find JSON object directly in the response
  const directJsonMatch = response.match(/\{[\s\S]*\}/);
  if (directJsonMatch) {
    try {
      return JSON.parse(directJsonMatch[0]);
    } catch (e) {
      // If parsing fails, continue
    }
  }

  // Try to find JSON array
  const arrayMatch = response.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (e) {
      // If parsing fails, continue
    }
  }

  // If no JSON found, return the response as-is (might be plain text)
  return response;
}

/**
 * Parse Python service response and extract structured data
 */
export function parsePythonResponse(pythonData: any, dataKey: string = 'data'): any {
  // Check if response has the expected structure
  if (!pythonData || typeof pythonData !== 'object') {
    return null;
  }

  // Try different possible response formats
  const possibleKeys = [dataKey, 'feedback', 'validation', 'progress', 'plan', 'nextSteps', 'explanation'];
  
  for (const key of possibleKeys) {
    if (pythonData[key]) {
      const value = pythonData[key];
      
      // If it's a string, try to extract JSON
      if (typeof value === 'string') {
        const extracted = extractJSONFromResponse(value);
        if (extracted && typeof extracted === 'object') {
          return extracted;
        }
        // If extraction didn't work, return the string
        return value;
      }
      
      // If it's already an object/array, return it
      if (typeof value === 'object') {
        return value;
      }
    }
  }

  // Check tasks_output (CrewAI format)
  if (pythonData.tasks_output && Array.isArray(pythonData.tasks_output)) {
    for (const taskOutput of pythonData.tasks_output) {
      if (taskOutput.output) {
        const extracted = extractJSONFromResponse(taskOutput.output);
        if (extracted && typeof extracted === 'object') {
          return extracted;
        }
      }
    }
  }

  // If nothing found, return the whole response
  return pythonData;
}

