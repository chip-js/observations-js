module.exports = ExprProperty;
var ComputedProperty = require('./computed-property');

/**
 * Assigns the result of the `thenExpression` to the object's property when the `ifExpression` is true.
 * @param {String} ifExpression The conditional expression use to determine when to call the `thenExpression`
 * @param {String|ComputedProperty} thenExpression The expression which will be executed when `if` is truthy and the
 *                                                 result set on the object. May also nest computed properties.
 */
function ExprProperty(expression) {
  this.expression = expression;
}


ComputedProperty.extend(ExprProperty, {

  addTo: function(observations, computedObject, propertyName, context) {
    return this.watch(observations, this.expression, computedObject, propertyName, context);
  }
});
