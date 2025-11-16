import Redis from 'ioredis'
import RateLimiter from './index.js'

const ratelimiter = RateLimiter({
  client: new Redis(),
  key: 'limiter',
  limit: 3,
  duration: 1000,
  difference: 0, // allow no interval between requests
})

;(async () => {
  await ratelimiter().then(console.log) // { total: 1, acknowledged: 1, remaining: 2 }
  await ratelimiter().then(console.log) // { total: 2, acknowledged: 1, remaining: 1 }
  await ratelimiter().then(console.log) // { total: 3, acknowledged: 1, remaining: 0 }
  await ratelimiter().then(console.log).catch(console.error) // 429 - Error: Too Many Requests

  await ratelimiter.get().then(console.log) // { total: 3, remaining: 0, retryAfterMS: 999 }
})().catch(console.error)
