'use strict';

var Redis = require('ioredis');
var ratelimit = require('..')({
  client: new Redis(),
  key: 'limiter',
  limit: 3,
  duration: 1000
});

setInterval(function () {
  ratelimit().then(console.log).catch(console.error);
}, 333);