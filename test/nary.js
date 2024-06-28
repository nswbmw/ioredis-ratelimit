'use strict';

var assert = require('assert');
var co = require('co');
var delay = require('delay');
var factory = require('../');
var Redis = require('ioredis');
var utils = require('./utils')

describe('nary mode', function () {
  var LIMIT = 10;
  var KEY = 'ioredis-ratelimit:test:nary';
  var error = new Error('Limit error');
  var client = utils.createRedisClient();
  var limiter = factory({
    client: client,
    key: KEY,
    limit: LIMIT,
    duration: 300,
    mode: 'nary',
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

  it('should fill up the limit when the bucket size is not enough for batch actions', function (done) {
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
      yield expectAmount(KEY, iterations * BATCH_SIZE);
      yield limiter(BATCH_SIZE).then(function (actual) {
        assert.deepEqual(actual, { total: LIMIT, acknowledged: LIMIT - total, remaining: 0 });
      });
      yield expectAmount(KEY, LIMIT);

      done();
    }).catch(done);
  });

  it('should throw error when the bucket is full', function (done) {
    this.slow(500);
    this.timeout(3000);

    co(function* () {
      var BATCH_SIZE = 3;
      var iterations = Math.ceil(LIMIT / BATCH_SIZE)
      for (var i = 1; i <= iterations; ++i) {
        yield limiter(BATCH_SIZE);
      }

      yield limiter().then(utils.throwsUnexpected).catch(expectLimitError);

      done();
    }).catch(done);
  });
});