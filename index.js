'use strict';

var assert = require('assert');

module.exports = function (opts) {
  opts = opts || {};
  var client = opts.client;
  var key = opts.key;
  var limit = opts.limit || 1;
  var duration = opts.duration || 1000;
  var difference = opts.difference || 0;
  var ttl = opts.ttl || 86400000;
  var error = opts.error || new Error('Exceeded the limit');

  assert(client, '.client required');
  assert(key, '.key required');
  assert(('number' === typeof limit) && (limit > 0), '.limit must be positive number');
  assert(('number' === typeof duration) && (duration > 0), '.duration must be positive number');
  assert((('number' === typeof difference) && (difference >= 0)), '.difference must be positive number or 0');
  assert(('number' === typeof ttl) && (ttl > 0) && (ttl >= duration), '.ttl must be greater than or equal to .duration');

  return function Limiter() {
    var redisKey = ('string' === typeof key) ? key : key.apply(null, arguments);
    var max = Date.now();
    var min = max - duration;
    var member = Math.random();

    var redisCommand = client
      .multi()
      .zadd(redisKey, max, member)
      .pexpire(redisKey, ttl)
      .zcount(redisKey, min, max);

    if (Number.isFinite(difference) && difference > 0) {
      redisCommand = redisCommand.zcount(redisKey, max - difference, max);
    }

    return redisCommand
      .exec()
      .then(function (res) {
        for (var i = 0; i < res.length; ++i) {
          if (res[i][0]) {
            return Promise.reject(res[i][0]);
          }
        }

        if (res[3] && res[3][1] > 1) {
          return client
            .zrem(redisKey, member) // remove the one just inserted
            .then(function() {
              return Promise.reject(error);
            })
        }

        var remaining = res[2][1];
        if (remaining > limit) {
          return client
            .multi()
            .zremrangebyscore(redisKey, '-inf', min)  // remove expired ones
            .zrem(key, member) // remove the one just inserted
            .exec()
            .then(function() {
              return Promise.reject(error);
            })
        }

        return {
          total: limit,
          remaining: limit - remaining,
          next: difference,
        };
      });
  };
};
