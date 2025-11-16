# ioredis-ratelimit

A generic Redis-backed rate limiting tool built on top of [ioredis](https://github.com/luin/ioredis).

## Features

- 🚀 **Flexible rate limiting** - Control request rates with precision
- 📦 **Batch operations** - Handle multiple requests at once
- 🎯 **Three limiting modes** - Binary, N-ary, and Uniform strategies
- ⏱️ **Minimum interval control** - Enforce delays between requests
- 🔑 **Dynamic keys** - Use functions to generate keys per user/resource
- ✅ **100% test coverage** - Fully tested and reliable

## Installation

```bash
$ npm i ioredis-ratelimit --save
```

## Quick Start

```js
import Redis from 'ioredis'
import RateLimiter from 'ioredis-ratelimit'

const ratelimiter = RateLimiter({
  client: new Redis(),
  key: 'my-rate-limiter',
  limit: 10,        // 10 requests
  duration: 1000    // per 1 second
})

// Check rate limit
await ratelimiter()  // { total: 1, acknowledged: 1, remaining: 9 }

// Get current status
await ratelimiter.get()  // { total: 1, remaining: 9, retryAfterMS: 0 }
```

## API

### `ratelimiter([id], [times])`

Consume rate limit quota.

- **`id`** (optional): Identifier when key is a function
- **`times`** (optional): Number of requests to consume (default: 1)
- **Returns**: `Promise<{ total, acknowledged, remaining }>`

### `ratelimiter.get([id])`

Get current rate limit status without consuming quota.

- **`id`** (optional): Identifier when key is a function
- **Returns**: `Promise<{ total, remaining, retryAfterMS }>`

## Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `client` | `Redis` | ✅ | - | ioredis client instance |
| `key` | `String\|Function` | ✅ | - | Rate limiter key or key generator function |
| `limit` | `Number` | ✅ | - | Maximum requests allowed in duration |
| `duration` | `Number` | ✅ | - | Time window in milliseconds |
| `difference` | `Number` | ❌ | `0` | Minimum milliseconds between requests |
| `ttl` | `Number` | ❌ | `duration` | Redis key TTL in milliseconds |
| `mode` | `String` | ❌ | `'binary'` | Rate limiting mode: `'binary'`, `'nary'`, or `'uniform'` |
| `error` | `Error` | ❌ | `Error('Too Many Requests')` | Error thrown when limit exceeded |

## Examples

### Basic Usage

```js
import Redis from 'ioredis'
import RateLimiter from 'ioredis-ratelimit'

const ratelimiter = RateLimiter({
  client: new Redis(),
  key: 'limiter',
  limit: 3,
  duration: 1000,
  difference: 0 // allow no interval between requests
})

;(async () => {
  await ratelimiter().then(console.log) // { total: 1, acknowledged: 1, remaining: 2 }
  await ratelimiter().then(console.log) // { total: 2, acknowledged: 1, remaining: 1 }
  await ratelimiter().then(console.log) // { total: 3, acknowledged: 1, remaining: 0 }
  await ratelimiter().then(console.log).catch(console.error) // 429 - Error: Too Many Requests

  await ratelimiter.get().then(console.log) // { total: 3, remaining: 0, retryAfterMS: 999 }
})().catch(console.error)
```

### Express Middleware

```js
import express from 'express'
import Redis from 'ioredis'
import RateLimiter from 'ioredis-ratelimit'

const app = express()

const ratelimiter = RateLimiter({
  client: new Redis(),
  key: (req) => `limiter:${req.user.id}`,
  limit: 10,      // 10 requests
  duration: 1000, // per 1 second
  difference: 10  // minimum 10ms between requests
})

app.use(async (req, res, next) => {
  try {
    await ratelimiter(req)
    next()
  } catch (err) {
    res.status(429).json({ error: 'Too Many Requests' })
  }
})

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' })
})

app.listen(3000)
```

### Batch Operations

```js
const ratelimiter = RateLimiter({
  client: new Redis(),
  key: 'batch-limiter',
  limit: 10,
  duration: 1000
})

// Consume 5 requests at once
await ratelimiter(5)  // { total: 5, acknowledged: 5, remaining: 5 }
```

### Dynamic Keys (Per-User Limiting)

```js
const ratelimiter = RateLimiter({
  client: new Redis(),
  key: (userId) => `ratelimit:user:${userId}`,
  limit: 100,
  duration: 60000  // 100 requests per minute per user
})

await ratelimiter('user123')  // Rate limit for user123
await ratelimiter('user456')  // Rate limit for user456 (separate bucket)
```

### Minimum Request Interval

```js
const ratelimiter = RateLimiter({
  client: new Redis(),
  key: 'api-calls',
  limit: 100,
  duration: 60000,
  difference: 1000  // Minimum 1s between requests
})

await ratelimiter()  // OK
await ratelimiter()  // Error: Too Many Requests (called too quickly)
```

## Rate Limiting Modes

### Binary Mode (Default)

**All-or-nothing**: Either all requests are accepted or all are rejected.

```js
const ratelimiter = RateLimiter({
  client: new Redis(),
  key: 'limiter',
  limit: 5,
  duration: 3000,
  mode: 'binary'
})

await ratelimiter(2)  // { total: 2, acknowledged: 2, remaining: 3 }
await ratelimiter(2)  // { total: 4, acknowledged: 2, remaining: 1 }
await ratelimiter(2)  // Error: Too Many Requests (needs 2 but only 1 remaining)
```

**Use case**: Strict rate limiting where partial fulfillment is not acceptable.

### N-ary Mode

**Partial acceptance**: Accepts as many requests as possible, up to the limit.

```js
const ratelimiter = RateLimiter({
  client: new Redis(),
  key: 'limiter',
  limit: 5,
  duration: 3000,
  mode: 'nary'
})

await ratelimiter(2)  // { total: 2, acknowledged: 2, remaining: 3 }
await ratelimiter(2)  // { total: 4, acknowledged: 2, remaining: 1 }
await ratelimiter(2)  // { total: 5, acknowledged: 1, remaining: 0 } ✅ Accepts 1 of 2
await ratelimiter(2)  // Error: Too Many Requests (bucket full)
```

**Use case**: Maximize throughput by accepting partial batches.

### Uniform Mode

**Lenient**: Accepts all requests if there's at least one slot available (can exceed limit).

```js
const ratelimiter = RateLimiter({
  client: new Redis(),
  key: 'limiter',
  limit: 5,
  duration: 3000,
  mode: 'uniform'
})

await ratelimiter(2)  // { total: 2, acknowledged: 2, remaining: 3 }
await ratelimiter(2)  // { total: 4, acknowledged: 2, remaining: 1 }
await ratelimiter(2)  // { total: 6, acknowledged: 2, remaining: 0 } ✅ Exceeds limit
await ratelimiter(2)  // Error: Too Many Requests (no slots available)
```

**Use case**: Flexible rate limiting where occasional bursts are acceptable.

## Test (100% coverage)

Ensure Redis is running, then:

```bash
$ npm test
```

## License

MIT
