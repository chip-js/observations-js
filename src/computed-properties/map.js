module.exports = MapProperty;
var ComputedProperty = require('./computed-property');

/**
 * Creates an object hash with the key being the value of the `key` property of each item in `sourceExpression` and the
 * value being the result of `expression`. `key` is optional, defaulting to "id" when not provided. `sourceExpression`
 * can resolve to an array or an object hash.
 * @param {Array|Object} sourceExpression An array or object whose members will be added to the map.
 * @param {String} keyExpression The name of the property to key against as values are added to the map.
 * @param {String} resultExpression [Optional] The expression evaluated against the array/object member whose value is
 *                                  added to the map. If not provided, the member will be added.
 * @return {Object} The object map of key=>value
 */
function MapProperty(sourceExpression, keyExpression, resultExpression, removeExpression) {
  this.sourceExpression = sourceExpression;
  this.keyExpression = keyExpression;
  this.resultExpression = resultExpression;
  this.removeExpression = removeExpression;
}


ComputedProperty.extend(MapProperty, {

  addTo: function(observations, computedObject, propertyName) {
    var map = {};
    var observers = {};
    computedObject[propertyName] = map;
    var add = this.addItem.bind(this, observations, computedObject, map, observers);
    var remove = this.removeItem.bind(this, observations, computedObject, map, observers);
    return observations.observeMembers(this.sourceExpression, add, remove, this);
  },

  addItem: function(observations, computedObject, map, observers, item) {
    if (!this.getKey) {
      this.getKey = observations.getExpression(this.keyExpression);
    }

    var key = item && this.getKey.call(item);
    if (!key) {
      return;
    }

    if (key in observers) {
      removeObserver(observers, key);
    }

    if (this.resultExpression) {
      var observer = this.watch(observations, this.resultExpression, map, key);
      if (!observer) {
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

  removeItem: function(observations, computedObject, map, observers, item) {
    var key = item && this.getKey.call(item);
    if (key) {
      this.removeObserver(observers, key);
      if (this.removeExpression) {
        observations.get(computedObject, this.removeExpression);
      }
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
