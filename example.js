const Redis = require('ioredis')
const ratelimit = require('./')({
  client: new Redis(),
  key: 'limiter',
  limit: 3,
  duration: 1000,
  difference: 0, // allow no interval between requests
})

;(async () => {
  await ratelimit().then(console.log) // { total: 1, acknowledged: 1, remaining: 2 }
  await ratelimit().then(console.log) // { total: 2, acknowledged: 1, remaining: 1 }
  await ratelimit().then(console.log) // { total: 3, acknowledged: 1, remaining: 0 }
  await ratelimit().then(console.log).catch(console.error) // 429 - Error: Too Many Requests

  await ratelimit.get().then(console.log) // { total: 3, remaining: 0, retryAfterMS: 998 }
})().catch(console.error)
