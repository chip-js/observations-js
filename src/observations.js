module.exports = Observations;
var Class = require('chip-utils/class');
var Observer = require('./observer');
var computed = require('./computed');
var expressions = require('expressions-js');
var requestAnimationFrame = global.requestAnimationFrame || setTimeout;
var cancelAnimationFrame = global.cancelAnimationFrame || clearTimeout;
var resyncingObservers = new WeakMap();


function Observations() {
  this.globals = {};
  this.formatters = {};
  this.observers = [];
  this.callbacks = [];
  this.listeners = [];
  this.syncing = false;
  this.currentIndex = -1;
  this.callbacksRunning = false;
  this.timeout = null;
  this.pendingSync = null;
  this.syncNow = this.syncNow.bind(this);
  this.computed = computed.create(this);
  this.expressions = expressions;
}


Class.extend(Observations, {

  /**
   * Observes any changes to the result of the expression on the context object and calls the callback.
   */
  observe: function(context, expression, callback, callbackContext) {
    var observer = this.createObserver(expression, callback, callbackContext);
    observer.bind(context);
    return observer;
  },

  /**
   * Creates a new observer attached to this observations object. When the observer is bound to a context it will be
   * added to this `observations` and synced when this `observations.sync` is called.
   */
  createObserver: function(expression, callback, callbackContext) {
    return new Observer(this, expression, callback, callbackContext);
  },

  /**
   * Observe an expression and trigger `onAdd` and `onRemove` whenever a member is added/removed from the array or object.
   * @param {Function} onAdd The function which will be called when a member is added to the source
   * @param {Function} onRemove The function which will be called when a member is removed from the source
   * @return {Observer} The observer for observing the source. Bind against a source object.
   */
  observeMembers: function(expression, onAdd, onRemove, callbackContext) {
    if (!onAdd) onAdd = function(){};
    if (!onRemove) onRemove = function(){};

    var observer = this.createObserver(expression, function(source, oldValue, changes) {
      if (changes) {
        changes.forEach(function(change) {
          if (change.removed) {
            change.removed.forEach(onRemove, callbackContext);
            source.slice(change.index, change.index + change.addedCount).forEach(onAdd, callbackContext);
          } else if (change.type === 'add') {
            onAdd.call(callbackContext, source[change.name]);
          } else if (change.type === 'update') {
            onRemove.call(callbackContext, change.oldValue);
            onAdd.call(callbackContext, source[change.name]);
          } else if (change.type === 'delete') {
            onRemove.call(callbackContext, change.oldValue);
          }
        });
      } else if (Array.isArray(source)) {
        source.forEach(onAdd, callbackContext);
      } else if (source && typeof source === 'object') {
        Object.keys(source).forEach(function(key) {
          onAdd.call(callbackContext, source[key]);
        });
      } else if (Array.isArray(oldValue)) {
        oldValue.forEach(onRemove, callbackContext);
      } else if (oldValue && typeof oldValue === 'object') {
        // If undefined (or something that isn't an array/object) remove the observers
        Object.keys(oldValue).forEach(function(key) {
          onRemove.call(callbackContext, oldValue[key]);
        });
      }
    });

    observer.getChangeRecords = true;
    return observer;
  },


  /**
   * Parses an expression into a function using the globals and formatters objects associated with this instance of
   * observations.
   * @param {String} expression The expression string to parse into a function
   * @param {Object} options Additional options to pass to the parser.
   *                        `{ isSetter: true }` will make this expression a setter that accepts a value.
   *                        `{ extraArgs: [ 'argName' ]` will make extra arguments to pass in to the function.
   * @return {Function} A function that may be called to execute the expression (call it against a context using=
   * `func.call(context)` in order to get the data from the context correct)
   */
  getExpression: function(expression, options) {
    if (options && options.isSetter) {
      return expressions.parseSetter(expression, this.globals, this.formatters, options.extraArgs);
    } else if (options && options.extraArgs) {
      var allArgs = [expression, this.globals, this.formatters].concat(options.extraArgs);
      return expressions.parse.apply(expressions, allArgs);
    } else {
      return expressions.parse(expression, this.globals, this.formatters);
    }
  },


  /**
   * Gets the value of an expression from the given context object
   * @param {Object} context The context object the expression will be evaluated against
   * @param {String} expression The expression to evaluate
   * @return {mixed} The result of the expression against the context
   */
  get: function(context, expression) {
    return this.getExpression(expression).call(context);
  },


  /**
   * Sets the value on the expression in the given context object
   * @param {Object} context The context object the expression will be evaluated against
   * @param {String} expression The expression to set a value with
   * @param {mixed} value The value to set on the expression
   * @return {mixed} The result of the expression against the context
   */
  set: function(source, expression, value) {
    return this.getExpression(expression, { isSetter: true }).call(source, value);
  },


  // Schedules an observer sync cycle which checks all the observers to see if they've changed.
  sync: function(callback) {
    if (typeof callback === 'function') {
      this.afterSync(callback);
    }

    if (this.pendingSync) {
      return false;
    }

    this.pendingSync = requestAnimationFrame(this.syncNow);
    return true;
  },


  // Runs the observer sync cycle which checks all the observers to see if they've changed.
  syncNow: function(callback) {
    if (typeof callback === 'function') {
      this.afterSync(callback);
    }

    cancelAnimationFrame(this.pendingSync);
    this.pendingSync = null;

    this.runSync();
    return true;
  },


  runSync: function() {
    var callingObserver = this.currentIndex >= 0 ? this.observers[this.currentIndex] : null;
    this.syncing = true;
    var callbacks = this.callbacks;
    this.callbacks = [];

    if (callingObserver) {
      resyncingObservers.set(callingObserver, true);
    }

    var i, l;

    // Allow observer callbacks to run the sync cycle again immediately, but only run the observers that aren't
    // requesting the resync to avoid infinite recursion

    for (i = 0; i < this.observers.length; i++) {
      this.currentIndex = i;
      var observer = this.observers[i];
      if (!callingObserver || !resyncingObservers.has(observer)) {
        observer.sync();
      }
      this.syncing = true;
    }

    if (callingObserver) {
      resyncingObservers.delete(callingObserver);
    }

    this.callbacksRunning = true;

    while (callbacks.length) {
      callbacks.shift()();
    }

    if (callingObserver) {
      // Only call listeners after the outer-most sync is finished
      for (i = 0; i < this.listeners.length; i++) {
        this.listeners[i]();
      }
      // Only set syncing to false once the outer-most sync is done
      this.syncing = false;
    }

    this.callbacksRunning = false;
  },


  // After the next sync (or the current if in the middle of one), run the provided callback
  afterSync: function(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('callback must be a function');
    }

    if (this.callbacksRunning) {
      this.sync();
    }

    this.callbacks.push(callback);
  },


  onSync: function(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('listener must be a function');
    }

    this.listeners.push(listener);
  },


  offSync: function(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('listener must be a function');
    }

    var index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1).pop();
    }
  },


  // Adds a new observer to be synced with changes. If `skipUpdate` is true then the callback will only be called when a
  // change is made, not initially.
  add: function(observer, skipUpdate) {
    this.observers.push(observer);
    if (!skipUpdate) {
      observer.forceUpdateNextSync = true;
      observer.sync();
    }
  },


  // Removes an observer, stopping it from being run
  remove: function(observer) {
    var index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
      return true;
    } else {
      return false;
    }
  },
});
