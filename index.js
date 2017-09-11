'use strict';

var assert = require('assert');
var utils = require('./utils')

module.exports = function (opts) {
  opts = opts || {};
  var client = opts.client;
  var key = opts.key;
  var limit = opts.limit || 1;
  var duration = opts.duration || 1000;
  var difference = opts.difference || 0;
  var ttl = opts.ttl || 86400000;
  var mode = opts.mode || 'binary';
  var error = opts.error || new Error('Exceeded the limit');

  assert(client, '.client required');
  assert(key, '.key required');
  assert(('number' === typeof limit) && (limit > 0), '.limit must be a positive number');
  assert(('number' === typeof duration) && (duration > 0), '.duration must be a positive number');
  assert((('number' === typeof difference) && (difference >= 0)), '.difference must be a positive number or 0');
  assert(('number' === typeof ttl) && (ttl > 0) && (ttl >= duration), '.ttl must be greater than or equal to .duration');
  assert(mode === 'nary' || mode === 'binary' || mode === 'uniform', '.mode should be one of \'uniform\', \'binary\' and \'nary\'');
  assert(error instanceof Error, '.error must be in Error type');

  function removeItems(redisKey, min, removeMembers) {
    return client
      .multi()
      .zremrangebyscore(redisKey, '-inf', min)  // remove expired ones
      .zrem(key, removeMembers) // remove the one just inserted
      .exec();
  }

  // return number of items being added
  function runStrategy(redisKey, current, min, addedMembers) {
    var original = current - addedMembers.length;
    if (original >= limit || (mode === 'binary' && current > limit)) {
      return removeItems(redisKey, min, addedMembers)
        .then(function () {
          return Promise.reject(error);
        });
    } else if (mode === 'nary' && current > limit) {
      return removeItems(redisKey, min, addedMembers.slice(limit - current))
        .then(function () {
          return Promise.resolve(limit - original);
        });
    }

    return Promise.resolve(addedMembers.length);
  }

  return function Limiter() {
    var redisKey = ('string' === typeof key) ? key : key.call(null, arguments[0]);
    var times = (('string' === typeof key) ? arguments[0] : arguments[1]) || 1;

    assert('string' === typeof redisKey, 'key should be a string or a function that returns string');
    assert(('number' === typeof times) && (times > 0), 'times should be a positive number');

    var max = Date.now();
    var min = max - duration;
    var members = utils.generateArrayOfRandomValues(times);
    var items = utils.flatten(members.map(function (val) { return [max, val]; }));

    var redisCommand = client
      .multi()
      .zadd(redisKey, items)
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

        if (res[3] && res[3][1] > members.length) {
          return client
            .zrem(redisKey, members) // remove items just inserted
            .then(function() {
              return Promise.reject(error);
            })
        }

        var current = res[2][1];
        return runStrategy(redisKey, current, min, members)
          .then(function (added) {
            const remaining = limit - current;
            return {
              total: current,
              acknowledged: added,
              remaining: remaining > 0 ? remaining : 0,
            };
          });
      });
  };
};
