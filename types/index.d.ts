import { Redis } from 'ioredis'

/**
 * Rate limiting mode
 * - 'binary': All-or-nothing, either all requests are accepted or all are rejected
 * - 'nary': Partial acceptance, accepts as many requests as possible up to the limit
 * - 'uniform': Lenient, accepts all requests if there's at least one slot available (can exceed limit)
 */
export type RateLimitMode = 'binary' | 'nary' | 'uniform'

/**
 * Options for creating a rate limiter
 */
export interface RateLimitOptions {
  /**
   * ioredis client instance
   */
  client: Redis

  /**
   * Rate limiter key or key generator function
   * - If string: uses the same key for all requests
   * - If function: generates a unique key based on the provided identifier
   */
  key: string | ((id: any) => string)

  /**
   * Maximum number of requests allowed in the duration window
   */
  limit: number

  /**
   * Time window in milliseconds
   */
  duration: number

  /**
   * Minimum milliseconds between requests
   * @default 0
   */
  difference?: number

  /**
   * Redis key TTL in milliseconds
   * @default duration
   */
  ttl?: number

  /**
   * Rate limiting mode
   * @default 'binary'
   */
  mode?: RateLimitMode

  /**
   * Error thrown when rate limit is exceeded
   * @default Error('Too Many Requests')
   */
  error?: Error
}

/**
 * Result of consuming rate limit quota
 */
export interface RateLimitResult {
  /**
   * Total number of requests in the current window
   */
  total: number

  /**
   * Number of requests acknowledged/accepted in this call
   */
  acknowledged: number

  /**
   * Number of remaining requests available
   */
  remaining: number
}

/**
 * Result of getting rate limit status
 */
export interface RateLimitStatus {
  /**
   * Total number of requests in the current window
   */
  total: number

  /**
   * Number of remaining requests available
   */
  remaining: number

  /**
   * Milliseconds to wait before retrying (0 if quota available)
   */
  retryAfterMS: number
}

/**
 * Rate limiter function interface
 */
export interface RateLimiter {
  /**
   * Consume rate limit quota
   * @param times - Number of requests to consume (default: 1)
   * @returns Promise resolving to rate limit result
   */
  (times?: number): Promise<RateLimitResult>

  /**
   * Consume rate limit quota with custom identifier
   * @param id - Identifier when key is a function
   * @param times - Number of requests to consume (default: 1)
   * @returns Promise resolving to rate limit result
   */
  (id: any, times?: number): Promise<RateLimitResult>

  /**
   * Get current rate limit status without consuming quota
   * @returns Promise resolving to rate limit status
   */
  get(): Promise<RateLimitStatus>

  /**
   * Get current rate limit status for a specific identifier without consuming quota
   * @param id - Identifier when key is a function
   * @returns Promise resolving to rate limit status
   */
  get(id: any): Promise<RateLimitStatus>
}

/**
 * Create a rate limiter instance
 * @param options - Rate limiter configuration options
 * @returns Rate limiter function with get method
 */
declare function createRateLimiter(options: RateLimitOptions): RateLimiter

export default createRateLimiter
