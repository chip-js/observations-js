module.exports = IfProperty;
var ComputedProperty = require('./computed-property');

/**
 * Assigns the result of the `thenExpression` to the object's property when the `ifExpression` is true.
 * @param {String} ifExpression The conditional expression use to determine when to call the `thenExpression`
 * @param {String|ComputedProperty} thenExpression The expression which will be executed when `if` is truthy and the
 *                                                 result set on the object. May also nest computed properties.
 */
function IfProperty(ifExpression, thenExpression) {
  this.ifExpression = ifExpression;
  this.thenExpression = thenExpression;
}


ComputedProperty.extend(IfProperty, {

  addTo: function(observations, computedObject, propertyName, context) {
    var observer = this.watch(observations, this.thenExpression, computedObject, propertyName, context);

    return observations.createObserver(this.ifExpression, function(value) {
      if (value && !observer.context) {
        observer.bind(context);
      } else if (!value && observer.context) {
        observer.unbind();
        observer.sync();
      }
    });
  }
});
