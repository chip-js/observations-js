var ComputedProperty = require('./computed-properties/computed-property');
var ExprProperty = require('./computed-properties/expr');
var MapProperty = require('./computed-properties/map');
var IfProperty = require('./computed-properties/if');
var AsyncProperty = require('./computed-properties/async');


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
      } else if (expression.isComputedProperty) {
        // Add ComputedProperty's observer to the observers and bind if enabled
        observer = expression.addTo(observations, obj, property);
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
   * Assigns the result of the expression to the computed object's property.
   * @param {String} expression The string expression
   * @return {ComputedProperty}
   */
  computed.expr = function(expression) {
    return new ExprProperty(expression);
  };


  /**
   * Creates an object hash with the key being the value of the `key` property of each item in `sourceExpression` and the
   * value being the result of `expression`. `key` is optional, defaulting to "id" when not provided. `sourceExpression`
   * can resolve to an array or an object hash.
   * @param {Array|Object} sourceExpression An array or object whose members will be added to the map.
   * @param {String} keyName [Optional] The name of the property to key against as values are added to the map. Defaults
   *                         to "id"
   * @param {String} expression The expression evaluated against the array/object member whose value is added to the map.
   * @return {ComputedProperty}
   */
  computed.map = function(sourceExpression, keyName, resultExpression) {
    return new MapProperty(sourceExpression, keyName, resultExpression);
  };


  /**
   * Assigns the result of the `thenExpression` to the object's property when the `ifExpression` is true.
   * @param {String} ifExpression The conditional expression use to determine when to call the `thenExpression`
   * @param {String} thenExpression The expression which will be executed when `if` is truthy and the result set on the
   * object.
   * @return {ComputedProperty}
   */
  computed.if = function(ifExpression, thenExpression) {
    return new IfProperty(ifExpression, thenExpression);
  };


  /**
   * Calls the async expression and assigns the results to the object's property when the `whenExpression` changes value
   * to anything other than a falsey value such as undefined. The return value of the async expression should be a
   * Promise.
   * @param {String} whenExpression The conditional expression use to determine when to call the `asyncExpression`
   * @param {String} asyncExpression The expression which will be executed when the `when` value changes and the result of
   * the returned promise is set on the object.
   * @return {ComputedProperty}
   */
  computed.async = function(whenExpression, asyncExpression) {
    return new AsyncProperty(whenExpression, asyncExpression);
  };


  // Make the ComputedProperty class available for extension
  computed.ComputedProperty = ComputedProperty;

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
