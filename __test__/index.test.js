const factory = require('../')
const Redis = require('ioredis')

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const expectAmount = async (client, redisKey, expected) => {
  const amount = await client.zcard(redisKey)
  expect(amount).toBe(expected)
}

describe('ioredis-ratelimit', () => {
  const client = new Redis()

  afterAll(async () => {
    await client.quit()
  })

  describe('basic functionality', () => {
    const LIMIT = 10
    const KEY = 'ioredis-ratelimit:test:basic'
    const error = new Error('Limit error')
    const limiter = factory({
      client,
      key: KEY,
      limit: LIMIT,
      duration: 1000,
      mode: 'binary',
      error
    })

    beforeEach(async () => {
      await client.del(KEY)
    })

    it('should throw error when limit reached', async () => {
      for (let i = 1; i <= LIMIT; i++) {
        const actual = await limiter()
        expect(actual).toEqual({ total: i, acknowledged: 1, remaining: LIMIT - i })
      }

      await expect(limiter()).rejects.toThrow(error)
      await expectAmount(client, KEY, LIMIT)
    })

    it('should get() return amount of actions being taken', async () => {
      for (let i = 1; i <= 3; i++) {
        if (i === 3) await delay(100)
        const actual = await limiter()
        expect(actual).toEqual({ total: i, acknowledged: 1, remaining: LIMIT - i })
      }

      expect(await limiter.get()).toEqual({ total: 3, remaining: LIMIT - 3, retryAfterMS: 0 })

      const actual4 = await limiter()
      expect(actual4).toEqual({ total: 4, acknowledged: 1, remaining: LIMIT - 4 })
      expect(await limiter.get()).toEqual({ total: 4, remaining: LIMIT - 4, retryAfterMS: 0 })

      for (let i = 5; i <= LIMIT; i++) {
        await limiter()
      }

      const result = await limiter.get()
      expect(result.total).toBe(LIMIT)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterMS).toBeGreaterThan(800)
    })

    it('should restore capacity after duration expires', async () => {
      await client.del(KEY)

      for (let i = 1; i <= LIMIT; i++) {
        const actual = await limiter()
        expect(actual).toEqual({ total: i, acknowledged: 1, remaining: LIMIT - i })
      }

      await expectAmount(client, KEY, LIMIT)
      await delay(1000)

      for (let i = 1; i <= LIMIT; i++) {
        const actual = await limiter()
        expect(actual).toEqual({ total: i, acknowledged: 1, remaining: LIMIT - i })
      }

      await expectAmount(client, KEY, LIMIT)
    })
  })

  describe('modes', () => {
    const LIMIT = 10

    describe('binary mode', () => {
      const KEY = 'ioredis-ratelimit:test:binary'
      const limiter = factory({
        client,
        key: KEY,
        limit: LIMIT,
        duration: 3000,
        mode: 'binary'
      })

      beforeEach(async () => {
        await client.del(KEY)
      })

      it('should throw error when no enough capacity for batch', async () => {
        const BATCH_SIZE = 3
        const iterations = Math.floor(LIMIT / BATCH_SIZE)
        for (let i = 1; i <= iterations; i++) {
          const actual = await limiter(BATCH_SIZE)
          expect(actual).toEqual({ total: i * BATCH_SIZE, acknowledged: BATCH_SIZE, remaining: LIMIT - i * BATCH_SIZE })
        }

        const total = iterations * BATCH_SIZE
        await expectAmount(client, KEY, total)
        await expect(limiter(BATCH_SIZE)).rejects.toThrow()
        await expectAmount(client, KEY, total)
      })

      it('should throw error when no capacity for batch', async () => {
        const BATCH_SIZE = 2
        const iterations = Math.floor(LIMIT / BATCH_SIZE)
        for (let i = 1; i <= iterations; i++) {
          const actual = await limiter(BATCH_SIZE)
          expect(actual).toEqual({ total: i * BATCH_SIZE, acknowledged: BATCH_SIZE, remaining: LIMIT - i * BATCH_SIZE })
        }

        const total = iterations * BATCH_SIZE
        await expectAmount(client, KEY, total)
        await expect(limiter(BATCH_SIZE)).rejects.toThrow()
        await expectAmount(client, KEY, total)
      })
    })

    describe('nary mode', () => {
      const KEY = 'ioredis-ratelimit:test:nary'
      const limiter = factory({
        client,
        key: KEY,
        limit: LIMIT,
        duration: 300,
        mode: 'nary'
      })

      beforeEach(async () => {
        await client.del(KEY)
      })

      it('should fill up limit when bucket not enough for batch', async () => {
        const BATCH_SIZE = 3
        const iterations = Math.floor(LIMIT / BATCH_SIZE)
        for (let i = 1; i <= iterations; i++) {
          const actual = await limiter(BATCH_SIZE)
          expect(actual).toEqual({ total: i * BATCH_SIZE, acknowledged: BATCH_SIZE, remaining: LIMIT - i * BATCH_SIZE })
        }

        const total = iterations * BATCH_SIZE
        await expectAmount(client, KEY, iterations * BATCH_SIZE)
        const actual = await limiter(BATCH_SIZE)
        expect(actual).toEqual({ total: LIMIT, acknowledged: LIMIT - total, remaining: 0 })
        await expectAmount(client, KEY, LIMIT)
      })

      it('should throw error when bucket is full', async () => {
        const BATCH_SIZE = 3
        const iterations = Math.ceil(LIMIT / BATCH_SIZE)
        for (let i = 1; i <= iterations; i++) {
          await limiter(BATCH_SIZE)
        }

        await expect(limiter()).rejects.toThrow()
      })
    })

    describe('uniform mode', () => {
      const KEY = 'ioredis-ratelimit:test:uniform'
      const limiter = factory({
        client,
        key: KEY,
        limit: LIMIT,
        duration: 3000,
        mode: 'uniform'
      })

      beforeEach(async () => {
        await client.del(KEY)
      })

      it('should allow total beyond limit', async () => {
        const BATCH_SIZE = 3
        const iterations = Math.floor(LIMIT / BATCH_SIZE)
        for (let i = 1; i <= iterations; i++) {
          const actual = await limiter(BATCH_SIZE)
          expect(actual).toEqual({ total: i * BATCH_SIZE, acknowledged: BATCH_SIZE, remaining: LIMIT - i * BATCH_SIZE })
        }

        let total = iterations * BATCH_SIZE
        await expectAmount(client, KEY, total)
        const actual = await limiter(BATCH_SIZE)
        expect(actual).toEqual({ total: total + BATCH_SIZE, acknowledged: BATCH_SIZE, remaining: 0 })
        total = total + BATCH_SIZE
        await expectAmount(client, KEY, total)
      })

      it('should throw error when bucket is full', async () => {
        const BATCH_SIZE = 3
        const iterations = Math.ceil(LIMIT / BATCH_SIZE)
        for (let i = 1; i <= iterations; i++) {
          await limiter(BATCH_SIZE)
        }

        const total = iterations * BATCH_SIZE
        await expectAmount(client, KEY, total)
        await expect(limiter(BATCH_SIZE)).rejects.toThrow()
        await expectAmount(client, KEY, total)
      })
    })
  })

  describe('key as function', () => {
    const LIMIT = 10
    const limiter = factory({
      client,
      limit: LIMIT,
      duration: 3000,
      mode: 'binary',
      key: (obj) => 'ioredis-ratelimit:test:' + obj.id
    })

    it('should create key with desired size', async () => {
      for (let i = 1; i <= 3; i++) {
        const actual = await limiter({ id: 'foo' })
        expect(actual).toEqual({ total: i, acknowledged: 1, remaining: LIMIT - i })
      }

      await expectAmount(client, 'ioredis-ratelimit:test:foo', 3)
      await client.del('ioredis-ratelimit:test:foo')
    })

    it('should count different keys in different buckets', async () => {
      for (let i = 1; i <= LIMIT; i++) {
        const actual = await limiter({ id: 'foo' })
        expect(actual).toEqual({ total: i, acknowledged: 1, remaining: LIMIT - i })
      }

      for (let i = 1; i <= LIMIT; i++) {
        const actual = await limiter({ id: 'bar' })
        expect(actual).toEqual({ total: i, acknowledged: 1, remaining: LIMIT - i })
      }

      await expectAmount(client, 'ioredis-ratelimit:test:foo', LIMIT)
      await expectAmount(client, 'ioredis-ratelimit:test:bar', LIMIT)

      await client.del('ioredis-ratelimit:test:foo')
      await client.del('ioredis-ratelimit:test:bar')
    })

    it('should work with limiter.get', async () => {
      await limiter({ id: 'test1' })
      await limiter({ id: 'test1' })

      const result = await limiter.get({ id: 'test1' })
      expect(result.total).toBe(2)
      expect(result.remaining).toBe(8)

      await client.del('ioredis-ratelimit:test:test1')
    })
  })

  describe('difference parameter', () => {
    const LIMIT = 10

    beforeEach(async () => {
      await client.del('ioredis-ratelimit:test:difference1')
      await client.del('ioredis-ratelimit:test:difference2')
    })

    it('should not throw error with enough wait time', async () => {
      const KEY = 'ioredis-ratelimit:test:difference1'
      const limiter = factory({
        client,
        key: KEY,
        limit: LIMIT,
        duration: 300000,
        difference: 300
      })

      for (let i = 1; i <= 5; i++) {
        const actual = await limiter()
        expect(actual).toEqual({ total: i, acknowledged: 1, remaining: LIMIT - i })
        await delay(300)
      }

      await client.del(KEY)
    }, 5000)

    it('should throw error without enough wait time', async () => {
      const KEY = 'ioredis-ratelimit:test:difference2'
      const limiter = factory({
        client,
        key: KEY,
        limit: LIMIT,
        duration: 300000,
        difference: 300
      })

      const actual = await limiter()
      expect(actual).toEqual({ total: 1, acknowledged: 1, remaining: LIMIT - 1 })

      await expect(limiter()).rejects.toThrow()
      await expectAmount(client, KEY, 1)
      await expect(limiter()).rejects.toThrow()
      await expectAmount(client, KEY, 1)

      await client.del(KEY)
    })
  })

  describe('error handling', () => {
    it('should handle Redis errors in limiter', async () => {
      const testClient = new Redis()
      const KEY = 'ioredis-ratelimit:test:error'
      const limiter = factory({
        client: testClient,
        key: KEY,
        limit: 10,
        duration: 1000
      })

      const originalMulti = testClient.multi.bind(testClient)
      testClient.multi = () => {
        const multi = originalMulti()
        multi.exec = async () => {
          return [
            [null, 0],
            [null, 1],
            [null, 1],
            [new Error('Redis error'), null]
          ]
        }
        return multi
      }

      await expect(limiter()).rejects.toThrow('Redis error')
      await testClient.quit()
    })

    it('should handle Redis errors in limiter.get', async () => {
      const testClient = new Redis()
      const KEY = 'ioredis-ratelimit:test:error-get'
      const limiter = factory({
        client: testClient,
        key: KEY,
        limit: 10,
        duration: 1000
      })

      const originalMulti = testClient.multi.bind(testClient)
      testClient.multi = () => {
        const multi = originalMulti()
        multi.exec = async () => {
          return [
            [null, 0],
            [new Error('Redis get error'), null]
          ]
        }
        return multi
      }

      await expect(limiter.get()).rejects.toThrow('Redis get error')
      await testClient.quit()
    })

    it('should handle custom error with default status codes', async () => {
      const KEY = 'ioredis-ratelimit:test:error-status'
      const customError = new Error('Custom error')

      const limiter = factory({
        client,
        key: KEY,
        limit: 1,
        duration: 1000,
        error: customError
      })

      await limiter()

      try {
        await limiter()
      } catch (err) {
        expect(err).toBe(customError)
        expect(err.status).toBe(429)
        expect(err.statusCode).toBe(429)
      }

      await client.del(KEY)
    })

    it('should preserve existing error status codes', async () => {
      const KEY = 'ioredis-ratelimit:test:error-preserve'
      const customError = new Error('Custom error')
      customError.status = 503
      customError.statusCode = 503

      const limiter = factory({
        client,
        key: KEY,
        limit: 1,
        duration: 1000,
        error: customError
      })

      await limiter()

      try {
        await limiter()
      } catch (err) {
        expect(err).toBe(customError)
        expect(err.status).toBe(503)
        expect(err.statusCode).toBe(503)
      }

      await client.del(KEY)
    })
  })

  describe('options and defaults', () => {
    it('should use default values', async () => {
      const KEY = 'ioredis-ratelimit:test:defaults'

      const limiter = factory({
        client,
        key: KEY,
        limit: 1,
        duration: 1000
      })

      const result = await limiter()
      expect(result.total).toBe(1)
      expect(result.acknowledged).toBe(1)
      expect(result.remaining).toBe(0)

      await expect(limiter()).rejects.toThrow('Too Many Requests')
      await client.del(KEY)
    })

    it('should require client and key', async () => {
      expect(() => factory()).toThrow('.client required')
      expect(() => factory({ client })).toThrow('.key required')
    })

    it('should handle custom ttl', async () => {
      const KEY = 'ioredis-ratelimit:test:custom-ttl'

      const limiter = factory({
        client,
        key: KEY,
        limit: 5,
        duration: 1000,
        ttl: 5000
      })

      await limiter()

      const ttl = await client.pttl(KEY)
      expect(ttl).toBeGreaterThan(4000)
      expect(ttl).toBeLessThanOrEqual(5000)

      await client.del(KEY)
    })

    it('should use duration as default ttl', async () => {
      const KEY = 'ioredis-ratelimit:test:ttl-default'

      const limiter = factory({
        client,
        key: KEY,
        limit: 5,
        duration: 1000
      })

      await limiter()

      const ttl = await client.pttl(KEY)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(1000)

      await client.del(KEY)
    })
  })
})
