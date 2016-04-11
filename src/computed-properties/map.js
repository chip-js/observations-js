module.exports = MapProperty;
var ComputedProperty = require('./computed-property');
var expressions = require('expressions-js');

/**
 * Creates an object hash with the key being the value of the `key` property of each item in `sourceExpression` and the
 * value being the result of `expression`. `key` is optional, defaulting to "id" when not provided. `sourceExpression`
 * can resolve to an array or an object hash.
 * @param {Array|Object} sourceExpression An array or object whose members will be added to the map.
 * @param {String} keyExpression The name of the property to key against as values are added to the map.
 *                               Defaults to "id"
 * @param {String} resultExpression [Optional] The expression evaluated against the array/object member whose value is
 *                                  added to the map. If not provided, the member will be added.
 * @return {Object} The object map of key=>value
 */
function MapProperty(sourceExpression, keyExpression, resultExpression) {
  this.sourceExpression = sourceExpression;
  this.getKey = expressions.parse(keyExpression);
  this.resultExpression = resultExpression;
}


ComputedProperty.extend(MapProperty, {

  addTo: function(observations, computedObject, propertyName) {
    var map = {};
    var observers = {};
    computedObject[propertyName] = map;
    var add = this.addItem.bind(this, observations, computedObject, map, observers);
    var remove = this.removeItem.bind(this, computedObject, map, observers);
    return observations.observeMembers(this.sourceExpression, add, remove, this);
  },

  addItem: function(observations, computedObject, map, observers, item) {
    var key = item && this.getKey.call(item);
    if (!key) {
      return;
    }

    if (key in observers) {
      removeObserver(observers, key);
    }

    if (this.resultExpression) {
      var observer;
      if (this.resultExpression.isComputedProperty) {
        observer = this.resultExpression.addTo(observations, map, key);
      } else if (typeof this.resultExpression === 'string') {
        observer = observations.createObserver(this.resultExpression, function(value) {
          if (value === undefined) {
            delete map[key];
          } else {
            map[key] = value;
          }
        }, this);
      } else {
        throw new TypeError('Invalid resultExpression for computed.map');
      }

      var proxy = Object.create(item);
      proxy.$$ = computedObject;
      observer.bind(proxy);
      observers[key] = observer;
    } else {
      map[key] = item;
    }
  },

  removeItem: function(computedObject, map, observers, item) {
    var key = item && this.getKey.call(item);
    if (key) {
      removeObserver(observers, key);
      delete map[key];
    }
  },

  removeObserver: function(observers, key) {
    var observer = observers[key];
    if (observer) {
      observer.unbind();
      delete observers[key];
    }
  }
});
