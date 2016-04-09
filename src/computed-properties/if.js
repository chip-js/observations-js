module.exports = IfProperty;
var ComputedProperty = require('./computed-property');

/**
 * Assigns the result of the `thenExpression` to the object's property when the `ifExpression` is true.
 * @param {String} ifExpression The conditional expression use to determine when to call the `thenExpression`
 * @param {String} thenExpression The expression which will be executed when `if` is truthy and the result set on the
 * object.
 */
function IfProperty(ifExpression, thenExpression) {
  this.ifExpression = ifExpression;
  this.thenExpression = thenExpression;
  this.observer = null;
}


ComputedProperty.extend(IfProperty, {

  addTo: function(computedObject, propertyName) {
    this.observer = this.observations.createObserver(this.thenExpression, function(value) {
      computedObject[propertyName] = value;
    });

    return this.observations.createObserver(this.ifExpression, function(value) {
      if (value && !this.observer.context) {
        this.observer.bind(computedObject);
      } else if (!value && this.observer.context) {
        this.observer.unbind();
        this.observer.sync();
      }
    }, this);
  }
});
