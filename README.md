# ioredis-ratelimit

Generic rate limiter on top of [ioredis](https://github.com/luin/ioredis).

## Supports

- Minimal difference between requests.
- Batch actions.
- Three levels of gratuitousness towards capped attempts.

## Install

```
$ npm i ioredis-ratelimit --save
```

## Usage

```javascript
var ratelimit = require('ioredis-ratelimit')(options);

ratelimit().then(...).catch(...); // when key is string
ratelimit(id).then(...).catch(...); // when key is function
ratelimit(id, numActions).then(...).catch(...); // when key is function and batch actions are requested
ratelimit(numActions).then(...).catch(...); // when key is string
```

### Options

- client: {Object} client of [ioredis](https://github.com/luin/ioredis).
- limit: {Number} max amount of calls in duration, default `1`.
- duration: {Number} duration in millisecond, default `1000`.
- difference: {Number} duration between each operation in millisecond, default `0`.
- ttl: {Number} expire in millisecond, must greater than or equal to `.duration`, default `86400000`.
- key: {String|Function} ratelimiter's key.
- mode: {String} `binary`, `nary`, and `uniform`, default `binary`.
- error: {Error} throw when reach limit.

## Examples

simple:

```javascript
'use strict';

var Redis = require('ioredis');
var ratelimit = require('ioredis-ratelimit')({
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
ratelimit().then(console.log).catch(console.error); // [Error: Exceeded the limit]
```

Express:

```javascript
'use strict';

var app = require('express')();
var Redis = require('ioredis');
var ratelimit = require('ioredis-ratelimit')({
  client: new Redis(),
  key: function (req) {
    return 'limiter:' + req.user._id;
  },

  // 10 requests are allowed in 1s
  limit: 10,
  duration: 1000,

  // there should be at least 10ms interval between requests 
  difference: 10,

  // the redis key will last for 1 day
  ttl: 86400000
});

// ...

app.use(function (req, res, next) {
  ratelimit(req)
    .then(function () {
      next();
    })
    .catch(next);
});

app.get('/', function () {});

// ...
```

## Batch actions

### Binary

Binary mode is as straightforward as any other rate limiter.

```javascript
var ratelimit = require('ioredis-ratelimit')({
  client: new Redis(),
  key: 'limiter',
  limit: 5,
  duration: 3000,
  ttl: 86400000,
  mode: 'binary',
  error: new Error('Exceeded the limit')
});

ratelimit(2).then(console.log).catch(console.error); // { total: 2, acknowledged: 2, remaining: 3 }
ratelimit(2).then(console.log).catch(console.error); // { total: 4, acknowledged: 2, remaining: 1 }
ratelimit(2).then(console.log).catch(console.error); // [Error: Exceeded the limit]
```

### N-ary

N-ary mode will try the best to fill up the bucket where partial saves are possible.

```javascript
var ratelimit = require('ioredis-ratelimit')({
  client: new Redis(),
  key: 'limiter',
  limit: 5,
  duration: 3000,
  ttl: 86400000,
  mode: 'nary',
  error: new Error('Exceeded the limit')
});

ratelimit(2).then(console.log).catch(console.error); // { total: 2, acknowledged: 2, remaining: 3 }
ratelimit(2).then(console.log).catch(console.error); // { total: 4, acknowledged: 2, remaining: 1 }
ratelimit(2).then(console.log).catch(console.error); // { total: 5, acknowledged: 1, remaining: 0 }
ratelimit(2).then(console.log).catch(console.error); // [Error: Exceeded the limit]
```

### Uniform

Uniform mode will save all attempts when there's at least one slot.

```javascript
var ratelimit = require('ioredis-ratelimit')({
  client: new Redis(),
  key: 'limiter',
  limit: 5,
  duration: 3000,
  ttl: 86400000,
  mode: 'nary',
  error: new Error('Exceeded the limit')
});

ratelimit(2).then(console.log).catch(console.error); // { total: 2, acknowledged: 2, remaining: 3 }
ratelimit(2).then(console.log).catch(console.error); // { total: 4, acknowledged: 2, remaining: 1 }
ratelimit(2).then(console.log).catch(console.error); // { total: 6, acknowledged: 2, remaining: 0 }
ratelimit(2).then(console.log).catch(console.error); // [Error: Exceeded the limit]
```

## Test

```
$ npm test
```

## License

MIT