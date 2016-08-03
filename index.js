
exports.Observations = require('./src/observations');
exports.Observer = require('./src/observer');
exports.ObservableHash = require('./src/observable-hash');
exports.create = function() {
  return new exports.Observations();
};
