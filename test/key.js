'use strict';

var assert = require('assert');
var co = require('co');
var delay = require('delay');
var factory = require('../');
var Redis = require('ioredis');
var utils = require('./utils')

describe('key is function', function () {
  var LIMIT = 10;
  var error = new Error('Limit error');
  var client = utils.createRedisClient();
  var limiter = factory({
    client: client,
    limit: LIMIT,
    duration: 3000,
    ttl: 86400000,
    mode: 'binary',
    key: function(obj) { return 'ioredis-ratelimit:test:' + obj.id },
    error
  });

  function expectLimitError(err) {
    assert.equal(err, error);
  }

  function* expectAmount() {
    return utils.expectAmount.bind(null, client).apply(null, arguments);
  }

  it('should the key exist with desired size', function (done) {
    this.slow(500);
    this.timeout(3000);

    co(function* () {
      for (var i = 1; i <= 3; ++i) {
        yield limiter({ id: 'foo' }).then(function (actual) {
          assert.deepEqual(actual, { total: i, acknowledged: 1, remaining: LIMIT - i });
        });
      }

      yield expectAmount('ioredis-ratelimit:test:foo', 3);

      yield client.del('ioredis-ratelimit:test:foo');

      done();
    }).catch(done);
  });

  it('should different key count in different bucket', function (done) {
    this.slow(500);
    this.timeout(3000);

    co(function* () {
      for (var i = 1; i <= LIMIT; ++i) {
        yield limiter({ id: 'foo' }).then(function (actual) {
          assert.deepEqual(actual, { total: i, acknowledged: 1, remaining: LIMIT - i });
        });
      }

      for (var i = 1; i <= LIMIT; ++i) {
        yield limiter({ id: 'bar' }).then(function (actual) {
          assert.deepEqual(actual, { total: i, acknowledged: 1, remaining: LIMIT - i });
        });
      }

      yield expectAmount('ioredis-ratelimit:test:foo', LIMIT);
      yield expectAmount('ioredis-ratelimit:test:bar', LIMIT);

      // clean up
      yield client.del('ioredis-ratelimit:test:foo');
      yield client.del('ioredis-ratelimit:test:bar');

      done();
    }).catch(done);
  });

  
});