'use strict';

var assert = require('assert');
var Redis = require('ioredis');

module.exports = {
  createRedisClient: function() {
    return new Redis();
  },

  expectAmount: function* (client, redisKey, expected, message) {
    yield client.zcard(redisKey).then(function (amount) {
      assert.strictEqual(amount, expected, message);
    });
  },

  throwsUnexpected: function() {
    throw new Error('shouldn\'t be here.');
  }


};