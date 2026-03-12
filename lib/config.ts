/**
 * Configuration utility for API endpoints
 * Uses environment variables with fallback to localhost for development
 */

/**
 * Get the backend server URL
 * In production, this should be set via NEXT_PUBLIC_SERVER_URL
 * Falls back to localhost:3001 for development
 */
export function getServerUrl(): string {
  // In Next.js, client-side env vars must be prefixed with NEXT_PUBLIC_
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_SERVER_URL or fallback
    return process.env.NEXT_PUBLIC_SERVER_URL ;     
  }
  
  // Server-side: use SERVER_URL or fallback
  return process.env.SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL ;
}

/**
 * Get the WebSocket/Socket.io server URL
 * For Socket.io, we typically use the same URL as the HTTP server
 */
export function getSocketUrl(): string {
  return getServerUrl();
}
