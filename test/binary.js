'use strict';

var assert = require('assert');
var co = require('co');
var delay = require('delay');
var factory = require('../');
var Redis = require('ioredis');
var utils = require('./utils')

describe('binary mode', function () {
  var LIMIT = 10;
  var KEY = 'ioredis-ratelimit:test:binary';
  var error = new Error('Limit error');
  var client = utils.createRedisClient();
  var limiter = factory({
    client: client,
    key: KEY,
    limit: LIMIT,
    duration: 3000,
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

  it('should throw error when there\'s no enough capacity for batch actions', function (done) {
    this.slow(500);
    this.timeout(3000);

    co(function* () {
      var BATCH_SIZE = 3;
      var iterations = Math.floor(LIMIT / BATCH_SIZE)
      for (var i = 1; i <= iterations; ++i) {
        yield limiter(BATCH_SIZE).then(function (actual) {
          assert.deepEqual(actual, { total: i * BATCH_SIZE, acknowledged: BATCH_SIZE, remaining: LIMIT - i * BATCH_SIZE });
        });
      }

      var total = iterations * BATCH_SIZE;
      yield expectAmount(KEY, total);
      yield limiter(BATCH_SIZE).then(utils.throwsUnexpected).catch(expectLimitError);
      yield expectAmount(KEY, total);

      done();
    }).catch(done);
  });

  it('should throw error when there\'s no capacity for batch actions', function (done) {
    this.slow(500);
    this.timeout(3000);

    co(function* () {
      var BATCH_SIZE = 2;
      var iterations = Math.floor(LIMIT / BATCH_SIZE)
      for (var i = 1; i <= iterations; ++i) {
        yield limiter(BATCH_SIZE).then(function (actual) {
          assert.deepEqual(actual, { total: i * BATCH_SIZE, acknowledged: BATCH_SIZE, remaining: LIMIT - i * BATCH_SIZE });
        });
      }

      var total = iterations * BATCH_SIZE;
      yield expectAmount(KEY, total);
      yield limiter(BATCH_SIZE).then(utils.throwsUnexpected).catch(expectLimitError);
      yield expectAmount(KEY, total);

      done();
    }).catch(done);
  });
});