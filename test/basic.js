'use strict';

var assert = require('assert');
var co = require('co');
var delay = require('delay');
var factory = require('../');
var Redis = require('ioredis');
var utils = require('./utils')

describe('basic func', function () {
  var LIMIT = 10;
  var KEY = 'ioredis-ratelimit:test:basic';
  var error = new Error('Limit error');
  var client = utils.createRedisClient();
  var limiter = factory({
    client: client,
    key: KEY,
    limit: LIMIT,
    duration: 300,
    ttl: 86400000,
    mode: 'binary',
    error
  });

  function expectLimitError(err) {
    assert.equal(err, error);
  }

  function* expectAmount() {
    return utils.expectAmount.bind(null, client).apply(null, arguments);
  }

  beforeEach(function (done) {
    co(function* () {
      yield client.del(KEY);
      done();
    }).catch(done);
  });

  after(function (done) {
    co(function* () {
      yield client.del(KEY);
      done();
    }).catch(done);
  });

  it('should throw error when limit reached', function (done) {
    this.slow(500);
    this.timeout(3000);

    co(function* () {
      for (var i = 1; i <= LIMIT; ++i) {
        yield limiter().then(function (actual) {
          assert.deepEqual(actual, { total: i, acknowledged: 1, remaining: LIMIT - i });
        });
      }

      // try to exceed the limit
      yield limiter().then(utils.throwsUnexpected).catch(expectLimitError);

      // the current capacity should be reached
      yield expectAmount(KEY, LIMIT);

      done();
    }).catch(done);
  });

  it('should get() return amount of actions being taken', function (done) {
    this.slow(500);
    this.timeout(3000);

    co(function* () {
      for (var i = 1; i <= 3; ++i) {
        yield limiter().then(function (actual) {
          assert.deepEqual(actual, { total: i, acknowledged: 1, remaining: LIMIT - i });
        });
      }

      // the current capacity should be 3
      assert.deepEqual(yield limiter.get(), { total: 3, remaining: LIMIT - 3 });

      yield limiter().then(function (actual) {
        assert.deepEqual(actual, { total: 4, acknowledged: 1, remaining: LIMIT - 4 });
      });

      // the current capacity should be 4
      assert.deepEqual(yield limiter.get(), { total: 4, remaining: LIMIT - 4 });

      done();
    }).catch(done);
  });

  it('should the capacity restored when wait for an enough time', function (done) {
    this.slow(1000);
    this.timeout(3000);

    co(function* () {
      for (var i = 1; i <= LIMIT; ++i) {
        yield limiter().then(function (actual) {
          assert.deepEqual(actual, { total: i, acknowledged: 1, remaining: LIMIT - i });
        });
      }
      
      // the current capacity should be reached
      yield expectAmount(KEY, LIMIT);
  
      // wait enough time for the next operations
      yield delay(300);
  
      // fill up the bucket
      for (var i = 1; i <= LIMIT; ++i) {
        yield limiter().then(function (actual) { 
          assert.deepEqual(actual, { total: i, acknowledged: 1, remaining: LIMIT - i });
        });
      }
  
      // the current capacity should be reached
      yield expectAmount(KEY, LIMIT);

      done();
    }).catch(done);
  });
});