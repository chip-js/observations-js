
exports.Observations = require('./src/observations');
exports.Observer = require('./src/observer');
exports.create = function() {
  return new exports.Observations();
};
