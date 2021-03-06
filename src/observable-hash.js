module.exports = ObservableHash;
var Class = require('chip-utils/class');
var deepDelimiter = /(?:\[\]|\{\})\.?/i;

/**
 * An object for storing data to be accessed by an application. Has methods for easily computing and watching data
 * changes.
 * @param {Observations} observations An instance of the Observations class this has is bound to
 */
function ObservableHash(observations) {
  var enabled = true;
  var _observers = [];
  _observers.enabled = true;

  Object.defineProperties(this, {
    _context: { writable: true, value: this },
    _observations: { value: observations },
    _namespaces: { value: [] },
    _observers: { value: _observers },
    computedObservers: { value: _observers } // alias to work with the computed system
  });
}


Class.extend(ObservableHash, {

  /**
   * Whether or not this hash is currently enabled and running the observations/computations. When disabled, watchers
   * and all computed properties will be cleared out with `undefined`. The hash will be ready for garbage collection.
   * @return {Boolean} If the hash is enabled, default `true`
   */
  get observersEnabled() {
    return this._observers.enabled;
  },
  set observersEnabled(value) {
    // Bind/unbind the observers for this hash
    value ? this.observersStart() : this.observersStop(true);
  },

  /**
   * Starts the observers watching their values
   */
  observersStart: function() {
    this._observers.enabled = true;
    this._observers.forEach(this.observersBindHelper.bind(this), this);

    // Set namespaced hashes to the same value
    this._namespaces.forEach(this.observersStartHelper.bind(this), this);
  },

  observersBindHelper: function(observer) {
    observer.bind(this._context);
  },

  observersStartHelper: function(namespace) {
    this[namespace].observersStart();
  },

  /**
   * Stops the observers watching and responding to changes, optionally clearing out the values
   * @param {Boolean} clearValues Whether to clear the values out to `undefined` or leave them as-is
   */
  observersStop: function(clearValues) {
    this._observers.enabled = false;
    this._observers.forEach(this.observersUnbindHelper.bind(this, clearValues));

    // Set namespaced hashes to the same value
    this._namespaces.forEach(this.observersStopHelper.bind(this, clearValues), this);
  },

  observersUnbindHelper: function(clearValues, observer) {
    observer.unbind();
    if (clearValues) observer.sync();
  },

  observersStopHelper: function(clearValues, namespace) {
    this[namespace].observersStop(clearValues);
  },

  /**
   * Get the value of an expression
   * @param {String} expression The JavaScript expression to evaluate
   * @return {mixed} The value of the expression
   */
  get: function(expression) {
    return this._observations.get(this._context, expression);
  },

  /**
   * Set the value of an expression
   * @param {String} expression The JavaScript expression to set
   * @param {mixed} value The value you'd like to set the expression to
   */
  set: function(expression, value) {
    return this._observations.set(this._context, expression, value);
  },

  /**
   * Add computed properties to this hash. If `name` is provided it will add the computed properties to that namespace
   * on the hash. Otherwise they will be added directly to the hash.
   * @param {String} name [OPTIONAL] The namespace to add the computed properties under
   * @param {Object} map The map of computed properties that will be set on this ObservableHash
   */
  addComputed: function(namespace, map) {
    if (typeof namespace === 'string' && typeof map === 'object') {
      if (!this[namespace]) {
        this[namespace] = new ObservableHash(this._observations);
        this[namespace].observersEnabled = this.observersEnabled;
        this._namespaces.push(namespace);
      }
      this._observations.computed.extend(this[namespace], map, { context: this[namespace]._context });
      return this[namespace];
    } else if (namespace && typeof namespace === 'object') {
      this._observations.computed.extend(this, namespace, { context: this._context });
      return this;
    } else {
      throw new TypeError('addComputed must have a map object');
    }
  },

  /**
   * Watch this object for changes in the value of the expression
   * @param {String} expression The expression to observe
   * @param {Function} onChange The function which will be called when the expression value changes
   * @return {Observer} The observer created
   */
  watch: function(expression, onChange, callbackContext) {
    var observer = this._observations.createObserver(expression, onChange, callbackContext || this);
    this._observers.push(observer);
    if (this.observersEnabled) observer.bind(this._context);
    return observer;
  },

  /**
   * Observe an expression and call `onAdd` and `onRemove` whenever a member is added/removed from the array or object.
   * @param {String} expression The expression to observe
   * @param {Function} onAdd The function which will be called when a member is added to the source
   * @param {Function} onRemove The function which will be called when a member is removed from the source
   * @return {Observer} The observer created
   */
  track: function(expression, onAdd, onRemove, callbackContext) {
    if (deepDelimiter.test(expression)) {
      return this.trackDeeply(expression, onAdd, onRemove, callbackContext);
    }
    var observer = this._observations.createMemberObserver(expression, onAdd, onRemove, callbackContext || this);
    this._observers.push(observer);
    if (this.observersEnabled) observer.bind(this._context);
    return observer;
  },

  /**
   * Works like `track` but allows it to track deeply using `[]` and `{}` in the expression. Example:
   * ```
   * data.addComputed({
   *   widgets: 'getArrayOfWidgets()',
   *   widgetTags: computed.map('w in widgets', 'w.id', 'w.tags')
   * });
   * // know when a tag is added
   * data.trackDeeply('widgets[].tags[].tagName', function(tagAdded) { console.log('tag added', tagAdded )});
   * // widgetTags is an object hash of arrays, so we need to use two levels next to each other
   * data.trackDeeply('widgetTags{}[].tagName', function(tagAdded) { console.log('tag added', tagAdded )});
   * ```
   * @param {String} expression The expression to observe with `{}` and `[]` indicating
   * @param {Function} onAdd The function which will be called when a member is added to the source
   * @param {Function} onRemove The function which will be called when a member is removed from the source
   * @return {Observer} The observer created
   */
  trackDeeply: function(expression, onAdd, onRemove, callbackContext) {
    if (!deepDelimiter.test(expression)) {
      return this.track(expression, onAdd, onRemove, callbackContext);
    }
    callbackContext = callbackContext || this;
    var observers = new WeakMap();
    var observations = this._observations;
    var steps = expression.split(deepDelimiter);
    var lastIndex = steps.length - 1;

    var removedCallback = function(item) {
      var observer = observers.get(item);
      if (observer) {
        observer.unbind();
        observer.sync();
        observers.delete(item);
      }
    };

    // Add a unique onAdd callback for each step of the observation
    var addedCallbacks = steps.slice(1, -1).map(function(expr, index) {
      // Observe the next set of members
      return function(item) {
        if (!item) return;
        var observer = observations.observeMembers(
          expr || 'this',
          addedCallbacks[index + 1],
          removedCallbacks[index + 1],
          callbackContext
        );
        observers.set(item, observer);
        observer.bind(item);
        return observer;
      };
    });

    // Removed callbacks are all the same except the last
    var removedCallbacks = steps.map(function() {
      return removedCallback;
    });

    // Add last callback
    if (steps[lastIndex]) {
      // Observe the item's property
      addedCallbacks.push(function(item, key) {
        if (!item) return;
        var observer = observations.createObserver(steps[lastIndex], function(value, oldValue) {
          if (oldValue != null && typeof onRemove === 'function') {
            onRemove.call(callbackContext, oldValue, key, item);
          }
          if (value != null && typeof onAdd === 'function') {
            onAdd.call(callbackContext, value, key, item);
          }
        });
        observers.set(item, observer);
        observer.bind(item);
        return observer;
      });
    } else {
      addedCallbacks.push(onAdd);
      removedCallbacks[lastIndex] = onRemove;
    }

    var observer = observations.observeMembers(steps[0], addedCallbacks[0], removedCallbacks[0], callbackContext);
    this._observers.push(observer);
    if (this.observersEnabled) observer.bind(this._context);
    return observer;
  }

});
