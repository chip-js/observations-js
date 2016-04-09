var ComputedProperty = require('./computed-properties/computed-property');
var MapProperty = require('./computed-properties/map');
var IfProperty = require('./computed-properties/if');


exports.create = function(observations) {

  /**
   * Create an object whose properties are dynamically updated with the values of the mapped expressions. An expression
   * can be a simple JavaScript expression with formatters (see https://github.com/chip-js/expressions-js) or it can be
   * a URL for watching the REST APIs. The object will have an array named `computedObservers` which contain all the
   * observers created to watch the properties. The `computedObservers` array has two additional methods, `enable` and
   * `disable` which will turn the binding on/off. When disabled the properties are reset to undefined.
   * @param {Object} map A hash of computed properties, expressions or URLs, that will be set and updated on the object
   * @param {Object} options Options for this computed object:
   *   * enabled {Boolean} Whether to enable this computed object. Default is true.
   * @return {Object} An object which will contain all the values of the computed properties
   */
  function computed(map, options) {
    return computed.extend({}, map, options);
  }


  /**
   * Extends an existing object with the values of the computed properties in the map.
   * @param {Object} obj The object to extend, will create, update, and delete properties from the object as they change
   * @param {Object} map A hash of computed properties that will be mapped onto the object
   * @param {Object} options Options for this computed object:
   *   * enabled {Boolean} Whether to enable this computed object. Default is true.
   * @return {Object} Returns the object passed in
   */
  computed.extend = function(obj, map, options) {
    ensureObservers(obj, options);

    Object.keys(map).forEach(function(property) {
      var expression = map[property];
      var observer;

      if (typeof expression === 'string') {
        // This is a computed expression
        observer = observations.createObserver(expression, function(value) {
          obj[property] = value;
        });
      } else if (expression instanceof ComputedProperty) {
        // Add ComputedProperty's observer to the observers and bind if enabled
        expression.observations = observations;
        observer = expression.addTo(obj, property);
      } else {
        obj[property] = expression;
      }

      if (observer) {
        obj.computedObservers.push(observer);
        if (obj.computedObservers.enabled) {
          observer.bind(obj);
        }
      }
    });

    return obj;
  };


  /**
   * Creates an object hash with the key being the value of the `key` property of each item in `sourceExpression` and the
   * value being the result of `expression`. `key` is optional, defaulting to "id" when not provided. `sourceExpression`
   * can resolve to an array or an object hash.
   * @param {Array|Object} sourceExpression An array or object whose members will be added to the map.
   * @param {String} keyName [Optional] The name of the property to key against as values are added to the map. Defaults
   *                         to "id"
   * @param {String} expression The expression evaluated against the array/object member whose value is added to the map.
   * @return {Object} The object map of key=>value
   */
  computed.map = function(sourceExpression, keyName, resultExpression) {
    return new MapProperty(sourceExpression, keyName, resultExpression);
  };

  computed.if = function(ifExpression, thenExpression) {
    return new IfProperty(ifExpression, thenExpression);
  };

  return computed;
};


/**
 * Ensures the observers array exists on an object, creating it if not and adding disable/enable functions to enable and
 * disable observing.
 * @param {Object} obj The object which ought to have an observers array on it
 * @param {Object} options Options for this computed object:
 *   * enabled {Boolean} Whether to enable this computed object. Default is true.
 * @return {Object} The `obj` that was passed in
 */
function ensureObservers(obj, options) {
  if (!obj.computedObservers) {
    Object.defineProperty(obj, 'computedObservers', { value: [] });
    obj.computedObservers.enabled = (!options || options.enabled !== false);

    // Restarts observing changes
    obj.computedObservers.enable = function() {
      if (!this.enabled) {
        this.enabled = true;
        this.forEach(function(observer) {
          observer.bind(obj);
        });
      }
    };

    // Stops observing changes and resets all computed properties to undefined
    obj.computedObservers.disable = function() {
      if (this.enabled) {
        this.enabled = false;
        this.forEach(function(observer) {
          observer.unbind();
          observer.sync();
        });
      }
    };
  }
  return obj;
}
