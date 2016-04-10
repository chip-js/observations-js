module.exports = AsyncProperty;
var ComputedProperty = require('./computed-property');
var expressions = require('expressions-js');

/**
 * Calls the load expression and assigns the results to the object's property when the `whenExpression` changes value to
 * anything other than a falsey value such as undefined. The return value of the load expression should be a Promise.
 * @param {String} whenExpression The conditional expression use to determine when to call the `loadExpression`
 * @param {String} loadExpression The expression which will be executed when the `when` value changes and the result of
 * the returned promise is set on the object.
 */
function AsyncProperty(whenExpression, loadExpression) {
  if (!loadExpression) {
    this.whenExpression = 'true';
    this.load = expressions.parse(whenExpression);
  } else {
    this.whenExpression = whenExpression;
    this.load = expressions.parse(loadExpression);
  }
  this.observer = null;
}


ComputedProperty.extend(AsyncProperty, {

  addTo: function(computedObject, propertyName) {
    var observations = this.observations;

    return observations.createObserver(this.whenExpression, function(value) {
      if (value) {
        var promise = this.load.call(computedObject);
        if (promise && promise.then) {
          promise.then(function(value) {
            computedObject[propertyName] = value;
            observations.sync();
          }, function(err) {
            computedObject[propertyName] = undefined;
            observations.sync();
          });
        }
      } else {
        computedObject[propertyName] = undefined;
      }
    }, this);
  }
});
