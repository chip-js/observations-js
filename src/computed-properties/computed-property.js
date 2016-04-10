module.exports = ComputedProperty;
var Class = require('chip-utils/class');


/**
 * An object which will be replaced by its computed value
 */
function ComputedProperty() {}

Class.extend(ComputedProperty, {

  get isComputedProperty() {
    return true;
  },

  /**
   * Add a computed property to a computed object
   * @param {Object} computedObject The object which this property is being added to
   * @param {String} propertyName The name of the property on the object that will be set
   * @return {Observer} An observer which can be bound to the computed object
   */
  addTo: function(computedObject, propertyName) {
    throw new Error('Abstract function is not implemented');
  }
});
