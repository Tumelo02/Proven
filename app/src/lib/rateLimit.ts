// app/src/lib/rateLimit.ts
import { headers } from 'next/headers';

/**
 * Rate limiting utilities using Redis (Upstash recommended for serverless)
 * 
 * Install: npm install @upstash/ratelimit @upstash/redis
 * 
 * Configure environment variables:
 * UPSTASH_REDIS_REST_URL=https://...
 * UPSTASH_REDIS_REST_TOKEN=...
 */

export class RateLimitError extends Error {
  constructor(
    public retryAfter: number,
    message = 'Too many requests. Please try again later.'
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Get client IP address from headers
 * Handles X-Forwarded-For, X-Real-IP, and direct connections
 */
export async function getClientIP(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
    
    const realIp = h.get('x-real-ip');
    if (realIp) return realIp;
    
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check rate limit for a given key
 * This is a placeholder - implement with actual Upstash client:
 * 
 * import { Ratelimit } from '@upstash/ratelimit';
 * import { Redis } from '@upstash/redis';
 * 
 * const redis = new Redis({
 *   url: process.env.UPSTASH_REDIS_REST_URL,
 *   token: process.env.UPSTASH_REDIS_REST_TOKEN,
 * });
 * 
 * export const signInLimit = new Ratelimit({
 *   redis,
 *   limiter: Ratelimit.slidingWindow(5, '15 m'),
 *   analytics: true,
 *   prefix: 'ratelimit:signin',
 * });
 * 
 * export const apiLimit = new Ratelimit({
 *   redis,
 *   limiter: Ratelimit.slidingWindow(100, '1 m'),
 *   analytics: true,
 *   prefix: 'ratelimit:api',
 * });
 */

/**
 * Stub implementation - replace with actual Upstash client when configured
 */
export async function checkRateLimit(
  _key: string,
  _limit: number,
  _window: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  // TODO: Implement with Upstash Ratelimit
  // For now, always allow (remove before production!)
  return { success: true, remaining: _limit, reset: Date.now() + 60000 };
}

/**
 * Example usage in auth action:
 * 
 * export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
 *   const email = String(formData.get('email') ?? '').trim();
 *   const ip = await getClientIP();
 *   
 *   const { success } = await checkRateLimit(`signin:${email}:${ip}`, 5, '15m');
 *   if (!success) {
 *     throw new RateLimitError(900, 'Too many sign-in attempts. Try again in 15 minutes.');
 *   }
 *   
 *   // ... rest of auth logic
 * }
 */
