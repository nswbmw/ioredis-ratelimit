'use strict';

var assert = require('assert');
var co = require('co');
var delay = require('delay');
var factory = require('../');
var Redis = require('ioredis');
var utils = require('./utils')

describe('difference func', function () {
  var LIMIT = 10;
  var KEY = 'basic';
  var error = new Error('Limit error');
  var client = utils.createRedisClient();
  var limiter = factory({
    client: client,
    key: KEY,
    limit: LIMIT,
    duration: 300000,
    ttl: 86400000,
    difference: 300,
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

  it('should not throw an error if call with waiting for an enough time', function (done) {
    this.slow(3500);
    this.timeout(5000);

    co(function* () {
      for (var i = 1; i <= 5; ++i) {
        yield limiter().then(function (actual) {
          assert.deepEqual(actual, { total: i, acknowledged: 1, remaining: LIMIT - i });
        });

        // wait enough time for the next operations
        yield delay(300);
      }

      done();
    }).catch(done);
  });

  it('should throw an error if call without waiting for an enough time', function (done) {
    this.slow(500);
    this.timeout(1000);

    co(function* () {
      yield limiter().then(function (actual) {
        assert.deepEqual(actual, { total: 1, acknowledged: 1, remaining: LIMIT - 1 });
      });

      yield limiter().then(utils.throwsUnexpected).catch(expectLimitError);
      yield expectAmount(KEY, 1);
      yield limiter().then(utils.throwsUnexpected).catch(expectLimitError);
      yield expectAmount(KEY, 1);

      done();
    }).catch(done);
  });
});