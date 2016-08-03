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
  var parts = sourceExpression.split(/\s+in\s+/);
  this.sourceExpression = parts.pop();
  this.itemName = parts.pop();
  this.keyExpression = keyExpression;
  this.resultExpression = resultExpression;
  this.removeExpression = removeExpression;
}


ComputedProperty.extend(MapProperty, {

  addTo: function(observations, computedObject, propertyName, context) {
    var map = {};
    var observers = {};
    computedObject[propertyName] = map;
    var add = this.addItem.bind(this, observations, computedObject, map, observers, context);
    var remove = this.removeItem.bind(this, observations, computedObject, map, observers, context);
    return observations.createMemberObserver(this.sourceExpression, add, remove, this);
  },

  addItem: function(observations, computedObject, map, observers, context, item) {
    if (!this.getKey) {
      this.getKey = observations.getExpression(this.keyExpression);
    }

    var proxy;
    if (this.itemName) {
      proxy = Object.create(context);
      proxy[this.itemName] = item;
    } else {
      proxy = Object.create(item);
      proxy.$$ = context;
    }

    var key = item && this.getKey.call(proxy);
    if (!key) {
      return;
    }

    if (observers.hasOwnProperty(key)) {
      this.removeObserver(observers, key);
    }

    if (this.resultExpression) {
      var observer = this.watch(observations, this.resultExpression, map, key, proxy);
      if (!observer) {
        throw new TypeError('Invalid resultExpression for computed.map');
      }

      observer.bind(proxy);
      observers[key] = observer;
    } else {
      map[key] = item;
    }
  },

  removeItem: function(observations, computedObject, map, observers, context, item) {
    var key = item && this.getKey.call(item);
    if (key) {
      this.removeObserver(observers, key);
      if (this.removeExpression) {
        observations.get(context, this.removeExpression);
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
