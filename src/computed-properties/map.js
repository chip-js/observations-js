module.exports = MapProperty;
var ComputedProperty = require('./computed-property');
var expressions = require('expressions-js');

/**
 * Creates an object hash with the key being the value of the `key` property of each item in `sourceExpression` and the
 * value being the result of `expression`. `key` is optional, defaulting to "id" when not provided. `sourceExpression`
 * can resolve to an array or an object hash.
 * @param {Array|Object} sourceExpression An array or object whose members will be added to the map.
 * @param {String} keyExpression [Optional] The name of the property to key against as values are added to the map.
 *                               Defaults to "id"
 * @param {String} expression The expression evaluated against the array/object member whose value is added to the map.
 * @return {Object} The object map of key=>value
 */
function MapProperty(sourceExpression, keyExpression, resultExpression) {
  if (!resultExpression) {
    resultExpression = keyExpression;
    keyExpression = 'id';
  }

  this.sourceExpression = sourceExpression;
  this.getKey = expressions.parse(keyExpression);
  this.resultExpression = resultExpression;
  this.map = {};
  this.observers = Object.create(null);
}


ComputedProperty.extend(MapProperty, {

  addTo: function(computedObject, propertyName) {
    computedObject[propertyName] = this.map;
    this.computedObject = computedObject;
    return this.observations.observeMembers(this.sourceExpression, this.addItem, this.removeItem, this);
  },

  addItem: function(item) {
    var key = item && this.getKey.call(item);
    if (key) {
      if (key in this.observers) {
        removeObserver(key);
      }
      var observer = this.observations.createObserver(this.resultExpression, function(value) {
        if (value === undefined) {
          delete this.map[key];
        } else {
          this.map[key] = value;
        }
      }, this);
      var proxy = Object.create(item);
      proxy.$$ = this.computedObject;
      observer.bind(proxy);
      this.observers[key] = observer;
    }
  },

  removeItem: function(item) {
    var key = item && this.getKey.call(item);
    if (key) {
      removeObserver(key);
    }
  },

  removeObserver: function(key) {
    var observer = this.observers[key];
    if (observer) {
      observer.unbind();
      observer.sync();
      delete this.observers[key];
    }
  }
});
