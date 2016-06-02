'use strict';

var assert = require('assert');
var Redis = require('ioredis');
var ratelimit = require('./')({
  client: new Redis(),
  key: 'limiter',
  limit: 3,
  duration: 1000,
  ttl: 86400000
});

ratelimit().then(console.log).catch(console.error);
ratelimit().then(console.log).catch(console.error);
ratelimit().then(console.log).catch(console.error);
ratelimit().then(console.log).catch(function (e) {
  console.log(e);
  assert.equal('Exceeded the limit', e.message);
});

setTimeout(function () {
  ratelimit().then(console.log).catch(console.error);
  ratelimit().then(console.log).catch(console.error);
  ratelimit().then(console.log).catch(console.error);
  ratelimit().then(console.log).catch(function (e) {
    console.log(e);
    assert.equal('Exceeded the limit', e.message);
    process.exit();
  });
}, 1000);