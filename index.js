
exports.Observations = require('./src/observations');
exports.Observer = require('./src/observer');
exports.ObservableHash = require('./src/observable-hash');
exports.ComputedProperty = require('./src/computed-properties/computed-property');
exports.create = function() {
  return new exports.Observations();
};
