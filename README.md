## ioredis-ratelimit

Generic ratelimit tool on top of [ioredis](https://github.com/luin/ioredis).

### Install

```
$ npm i ioredis-ratelimit --save
```

### Usage

```javascript
var ratelimit = require('ioredis-ratelimit')(opts);

ratelimit(id).then(...).catch(...);
```

opts:

- client: {Object} client of [ioredis](https://github.com/luin/ioredis).
- limit: {Number} max amount of calls in duration, default `1`.
- duration: {Number} duration in millisecond, default `1000`.
- difference: {Number} duration between each operation in millisecond, default `0`.
- ttl: {Number} expire in millisecond, must greater than or equal to `.duration`, default `86400000`.
- key: {String|Function} ratelimiter's key.
- error: {Error} throw when reach limit.

### Examples

simple:

```javascript
'use strict';

var Redis = require('ioredis');
var ratelimit = require('ioredis-ratelimit')({
  client: new Redis(),
  key: 'limiter',
  limit: 3,
  duration: 1000,
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
  limit: 1,
  duration: 1000,
  ttl: 86400000 // one day
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

### Test

```
$ npm test
```

### License

MIT