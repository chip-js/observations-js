module.exports = WhenProperty;
var ComputedProperty = require('./computed-property');

/**
 * Calls the `thenExpression` and assigns the results to the object's property when the `whenExpression` changes value
 * to anything other than a falsey value such as undefined. The return value of the `thenExpression` may be a Promise.
 *
 * @param {String} whenExpression The conditional expression use to determine when to call the `thenExpression`
 * @param {String} thenExpression The expression which will be executed when the `when` value changes and the result (or
 * the result of the returned promise) is set on the object.
 */
function WhenProperty(whenExpression, thenExpression) {
  if (!thenExpression) {
    thenExpression = whenExpression;
    whenExpression = 'true';
  }

  this.whenExpression = whenExpression;
  this.thenExpression = thenExpression;
}


ComputedProperty.extend(WhenProperty, {

  addTo: function(observations, computedObject, propertyName, context) {
    if (!this.thenMethod) {
      this.thenMethod = observations.getExpression(this.thenExpression);
    }

    return observations.createObserver(this.whenExpression, function(value) {
      if (value) {
        var result = this.thenMethod.call(context);
        if (result && result.then) {
          result.then(function(value) {
            computedObject[propertyName] = value;
            observations.sync();
          }, function(err) {
            computedObject[propertyName] = undefined;
            observations.sync();
          });
        } else {
          computedObject[propertyName] = result;
        }
      } else {
        computedObject[propertyName] = undefined;
      }
    }, this);
  }
});
