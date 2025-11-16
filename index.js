/**
 * @typedef {'binary' | 'nary' | 'uniform'} RateLimitMode
 */

/**
 * @typedef {Object} RateLimitOptions
 * @property {import('ioredis').Redis} client - ioredis client instance
 * @property {string | function(any): string} key - Rate limiter key or key generator function
 * @property {number} limit - Maximum number of requests allowed in the duration window
 * @property {number} duration - Time window in milliseconds
 * @property {number} [difference=0] - Minimum milliseconds between requests
 * @property {number} [ttl] - Redis key TTL in milliseconds (defaults to duration)
 * @property {RateLimitMode} [mode='binary'] - Rate limiting mode
 * @property {Error} [error] - Error thrown when rate limit is exceeded
 */

/**
 * @typedef {Object} RateLimitResult
 * @property {number} total - Total number of requests in the current window
 * @property {number} acknowledged - Number of requests acknowledged/accepted in this call
 * @property {number} remaining - Number of remaining requests available
 */

/**
 * @typedef {Object} RateLimitStatus
 * @property {number} total - Total number of requests in the current window
 * @property {number} remaining - Number of remaining requests available
 * @property {number} retryAfterMS - Milliseconds to wait before retrying (0 if quota available)
 */

/**
 * Create a rate limiter instance
 * @param {RateLimitOptions} opts - Rate limiter configuration options
 * @returns {function} Rate limiter function with attached `get` method.
 * When `key` is a string, call as `(times?: number)`.
 * When `key` is a function, call as `(id: string, times?: number)`.
 * The returned function also exposes `fn.get(id?: string): Promise<RateLimitStatus>`.
 */
export default function RateLimiter (opts = {}) {
  const client = opts.client
  const key = opts.key
  const limit = opts.limit
  const duration = opts.duration
  const difference = opts.difference || 0
  const ttl = opts.ttl || duration
  const mode = opts.mode || 'binary'
  const error = opts.error || new Error('Too Many Requests')
  error.status = error.status || 429
  error.statusCode = error.statusCode || 429

  assert(client, '.client required')
  assert(key, '.key required')
  assert(typeof limit === 'number' && limit > 0, '.limit must be a positive number')
  assert(typeof duration === 'number' && duration > 0, '.duration must be a positive number')
  assert(typeof difference === 'number' && difference >= 0, '.difference must be a positive number or 0')
  assert(typeof ttl === 'number' && ttl > 0 && ttl >= duration, '.ttl must be greater than or equal to .duration')
  assert(['nary', 'binary', 'uniform'].includes(mode), '.mode should be one of \'uniform\', \'binary\' and \'nary\'')
  assert(error instanceof Error, '.error must be in Error type')

  /**
   * Remove expired items and specified members from Redis sorted set
   * @private
   * @param {string} redisKey - Redis key
   * @param {number} min - Minimum timestamp for valid items
   * @param {number[]} removeMembers - Members to remove
   * @returns {Promise<void>} Promise that resolves when items are removed
   */
  function removeItems (redisKey, min, removeMembers) {
    return client
      .multi()
      .zremrangebyscore(redisKey, '-inf', min) // remove expired ones
      .zrem(redisKey, removeMembers) // remove the one just inserted
      .exec()
  }

  /**
   * Execute rate limiting strategy based on mode
   * @private
   * @param {string} redisKey - Redis key
   * @param {number} original - Original count before adding new members
   * @param {number} min - Minimum timestamp for valid items
   * @param {number[]} addedMembers - Members that were added
   * @returns {Promise<number>} Promise resolving to number of items being added
   */
  function runStrategy (redisKey, original, min, addedMembers) {
    const current = original + addedMembers.length
    if (original >= limit || (mode === 'binary' && current > limit)) {
      return removeItems(redisKey, min, addedMembers).then(() => Promise.reject(error))
    } else if (mode === 'nary' && current > limit) {
      return removeItems(redisKey, min, addedMembers.slice(limit - current)).then(() => limit - original)
    }

    return Promise.resolve(addedMembers.length)
  }

  /**
   * Consume rate limit quota
   * @param {any} [id] - Identifier when key is a function
   * @param {number} [times=1] - Number of requests to consume
   * @returns {Promise<RateLimitResult>} Promise resolving to rate limit result
   */
  function ratelimiter () {
    const redisKey = typeof key === 'string' ? key : key(arguments[0])
    const times = (typeof key === 'string' ? arguments[0] : arguments[1]) || 1

    assert(typeof redisKey === 'string', 'key should be a string or a function that returns string')
    assert(typeof times === 'number' && times > 0, 'times should be a positive number')

    const max = Date.now()
    const min = max - duration
    const members = Array.from({ length: times }, () => Math.random())
    const items = members.flatMap(val => [max, val])

    let redisCommand = client
      .multi()
      .zremrangebyscore(redisKey, '-inf', `(${min}`) // remove expired ones
      .zadd(redisKey, items)
      .pexpire(redisKey, ttl)
      .zcount(redisKey, min, max)

    if (Number.isFinite(difference) && difference > 0) {
      redisCommand = redisCommand.zcount(redisKey, max - difference, max)
    }

    return redisCommand
      .exec()
      .then(res => {
        // Check for Redis errors
        for (let i = 0; i < res.length; i++) {
          if (res[i][0]) {
            return Promise.reject(res[i][0])
          }
        }

        // Check difference constraint if enabled
        if (res[4] && res[4][1] > members.length) {
          return client
            .zrem(redisKey, members) // remove items just inserted
            .then(() => Promise.reject(error))
        }

        const original = res[3][1] - members.length
        return runStrategy(redisKey, original, min, members)
          .then(added => {
            const total = original + added
            const remaining = limit - total
            return {
              total,
              acknowledged: added,
              remaining: remaining > 0 ? remaining : 0
            }
          })
      })
  }

  /**
   * Get current rate limit status without consuming quota
   * @param {any} [id] - Identifier when key is a function
   * @returns {Promise<RateLimitStatus>} Promise resolving to rate limit status
   */
  ratelimiter.get = function () {
    const redisKey = typeof key === 'string' ? key : key(arguments[0])

    assert(typeof redisKey === 'string', 'key should be a string or a function that returns string')

    const max = Date.now()
    const min = max - duration
    const lastAvailableIndex = Math.max(0, limit - 2)

    return client
      .multi()
      .zremrangebyscore(redisKey, '-inf', `(${min}`) // remove expired ones
      .zcount(redisKey, min, max)
      .zrevrange(redisKey, lastAvailableIndex, lastAvailableIndex, 'WITHSCORES')
      .exec()
      .then(res => {
        // Check for Redis errors
        for (let i = 0; i < res.length; i++) {
          if (res[i][0]) {
            return Promise.reject(res[i][0])
          }
        }

        const total = res[1][1]
        const remaining = limit - total
        return {
          total,
          remaining: remaining > 0 ? remaining : 0,
          retryAfterMS: remaining > 0 ? 0 : (+res[2][1][1] + duration - max)
        }
      })
  }

  return ratelimiter
}

function assert (condition, message) {
  if (!condition) throw new TypeError(message)
}
