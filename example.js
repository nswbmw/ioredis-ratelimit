var Redis = require('ioredis');
var ratelimit = require('./')({
  client: new Redis(),
  key: 'limiter',
  limit: 3,
  duration: 1000,
  difference: 0, // allow no interval between requests
  ttl: 86400000 // one day
});

ratelimit().then(console.log).catch(console.error); // { total: 3, remaining: 2 }
ratelimit().then(console.log).catch(console.error); // { total: 3, remaining: 1 }
ratelimit().then(console.log).catch(console.error); // { total: 3, remaining: 0 }
ratelimit().then(console.log).catch(console.error); // 429 - [Error: Exceeded the limit]

ratelimit.get().then(console.log) // { total: 3, remaining: 0, retryAfterMS: 1000 }
