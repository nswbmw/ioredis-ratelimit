## ioredis-ratelimit

Generic ratelimit tool on top of [ioredis](https://github.com/luin/ioredis).

### Install

```
$ npm i ioredis-ratelimit --save
```

### Usage

```
var ratelimit = require('ioredis-ratelimit')(opts);

ratelimit(id).then(...).catch(...);
```

opts:

- client: {Object} client of [ioredis](https://github.com/luin/ioredis).
- limit: {Number} concurrent in duration milliscond, default `1`.
- duration: {Number} duration in milliscond, default `1000`.
- key: {String|Function} ratelimiter's key.

### Examples

simple:

```
'use strict';

var Redis = require('ioredis');
var ratelimit = require('ioredis-ratelimit')({
  client: new Redis(),
  key: 'limiter',
  limit: 3,
  duration: 1000
});

ratelimit().then(console.log).catch(console.error);// { total: 3, remaining: 2 }
ratelimit().then(console.log).catch(console.error);// { total: 3, remaining: 1 }
ratelimit().then(console.log).catch(console.error);// { total: 3, remaining: 0 }
ratelimit().then(console.log).catch(console.error);// [Error: Exceeded the limit]
```

Express:

```
'use strict';

var app = require('express')();
var Redis = require('ioredis');
var ratelimit = require('ioredis-ratelimit')({
  client: new Redis(),
  key: function (req) {
    return 'limiter:' + req.user._id;
  },
  limit: 1,
  duration: 1000
});

...

app.use(function (req, res, next) {
  ratelimit(req)
    .then(function () {
      next();
    })
    .catch(next);
});

app.get('/', function () {});

...
```

### Test

```
$ npm test
```

### License

MIT