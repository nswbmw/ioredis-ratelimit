'use strict';

module.exports = {
  flatten: function(arrays) {
    return arrays.reduce(
      function(a, b) {
        return a.concat(b);
      },
      []
    );
  },

  generateArrayOfRandomValues: function(length) {
    return Array.apply(null, Array(length)).map(function () { return Math.random(); });
  }
};