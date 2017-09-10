'use strict';

var assert = require('assert');
var Redis = require('ioredis');
var factory = require('./');
var co = require('co');
var delay = require('delay');

var client = new Redis();
var key = 'limiter';

var basicRateLimit = factory({
  client: client,
  key: key,
  limit: 3,
  duration: 1000,
  ttl: 86400000
});
var rateLimitWithInterval = factory({
  client: client,
  key: key,
  limit: 3,
  duration: 5000,
  difference: 500,
  ttl: 86400000
});

co(function* () {
  yield basicRateLimit().then(console.log).catch(console.error);
  yield basicRateLimit().then(console.log).catch(console.error);
  yield basicRateLimit().then(console.log).catch(console.error);
  yield basicRateLimit().then(console.log).catch(function (e) {
    console.error('expected error:', e);
    assert.equal('Exceeded the limit', e.message);
  });

  yield delay(1200); // wait enough time for the next operations

  yield basicRateLimit().then(console.log).catch(console.error);
  yield basicRateLimit().then(console.log).catch(console.error);
  yield basicRateLimit().then(console.log).catch(console.error);
  yield basicRateLimit().then(console.log).catch(function (e) {
    console.error('expected error:', e);
    assert.equal('Exceeded the limit', e.message);
  });

  yield client.del(key);

  yield rateLimitWithInterval().then(console.log).catch(console.error);
  yield rateLimitWithInterval().then(console.log).catch(function (e) {
    console.error('expected error:', e);
    assert.equal('Exceeded the limit', e.message);
  });
  yield delay(600); // wait enough time for the next operations
  yield rateLimitWithInterval().then(console.log).catch(console.error);
  yield delay(600); // wait enough time for the next operations
  yield rateLimitWithInterval().then(console.log).catch(console.error);

  yield client.del(key);

  process.exit();
}).catch(function() {
  process.exit();
});

