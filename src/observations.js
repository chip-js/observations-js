module.exports = Observations;
var Class = require('chip-utils/class');
var Observer = require('./observer');
var computed = require('./computed');
var ObservableHash = require('./observable-hash');
var expressions = require('expressions-js');
var requestAnimationFrame = global.requestAnimationFrame || setTimeout;
var cancelAnimationFrame = global.cancelAnimationFrame || clearTimeout;


function Observations() {
  // Bind all methods to this instance
  Object.getOwnPropertyNames(this.constructor.prototype).forEach(function(name) {
    if (typeof this[name] === 'function') {
      this[name] = this[name].bind(this);
    }
  }, this);
  this.globals = {};
  this.formatters = {};
  this.observers = [];
  this.callbacks = [];
  this.listeners = [];
  this.syncing = false;
  this.callbacksRunning = false;
  this.rerun = false;
  this.cycles = 0;
  this.maxCycles = 10;
  this.timeout = null;
  this.pendingSync = null;
  this.computed = computed.create(this);
  this.expressions = expressions;
  this.windows = [ window ];
}


Class.extend(Observations, {
  ObservableHash: ObservableHash,

  /**
   * Creates a new ObservableHash with useful methods for managing data using watch, track, and computed.
   * @param {Object} computedMap [OPTIONAL] An initial computed map for this hash
   * @return {ObservableHash} An object for putting your data on for accessibility
   */
  createHash: function(computedMap) {
    var hash = new ObservableHash(this);
    if (computedMap) hash.addComputed(computedMap);
    return hash;
  },

  /**
   * Observes any changes to the result of the expression on the context object and calls the callback.
   * @param {Object} context The context to bind the expression against
   * @param {String} expression The expression to observe
   * @param {Function} onChange The function which will be called when the expression value changes
   * @return {Observer} The observer created
   */
  watch: function(context, expression, onChange, callbackContext) {
    var observer = this.createObserver(expression, onChange, callbackContext || context);
    observer.bind(context);
    return observer;
  },

  // Alias for `watch`, DEPRECATED
  observe: function(context, expression, onChange, callbackContext) {
    return this.watch(context, expression, onChange, callbackContext);
  },

  /**
   * Observe an expression and call `onAdd` and `onRemove` whenever a member is added/removed from the array or object.
   * @param {Object} context The context to bind the expression against
   * @param {String} expression The expression to observe
   * @param {Function} onAdd The function which will be called when a member is added to the source
   * @param {Function} onRemove The function which will be called when a member is removed from the source
   * @return {Observer} The observer created
   */
  track: function(context, expression, onAdd, onRemove, callbackContext) {
    var observer = this.createMemberObserver(expression, onAdd, onRemove, callbackContext);
    observer.bind(context);
    return observer;
  },

  // Alias for `createMemberObserver`, DEPRECATED
  observeMembers: function(expression, onAdd, onRemove, callbackContext) {
    return this.createMemberObserver(expression, onAdd, onRemove, callbackContext);
  },

  /**
   * Creates a new observer attached to this observations object. When the observer is bound to a context it will be
   * added to this `observations` and synced when this `observations.sync` is called.
   * @param {String} expression The expression to observe
   * @param {Function} callback The function which will be called when the expression value changes
   * @return {Observer} The observer
   */
  createObserver: function(expression, callback, callbackContext) {
    return new Observer(this, expression, callback, callbackContext);
  },

  /**
   * Observe an expression and call `onAdd` and `onRemove` whenever a member is added/removed from the array or object.
   * @param {String} expression The expression to observe
   * @param {Function} onAdd The function which will be called when a member is added to the source
   * @param {Function} onRemove The function which will be called when a member is removed from the source
   * @return {Observer} The observer
   */
  createMemberObserver: function(expression, onAdd, onRemove, callbackContext) {
    if (!onAdd) onAdd = function(){};
    if (!onRemove) onRemove = function(){};

    var observer = this.createObserver(expression, this.createMemberObserverCallback.bind(this, onAdd, onRemove, callbackContext));

    observer.getChangeRecords = true;
    return observer;
  },

  createMemberObserverCallback: function(onAdd, onRemove, callbackContext, source, oldValue, changes) {
    if (changes) {
      // call onRemoved on everything first
      changes.forEach(function(change) {
        if (change.type === 'splice') {
          change.removed.forEach(function(item, index) {
            // Only call onRemove if this item was removed completely, not if it just changed location in the array
            if (source.indexOf(item) === -1) {
              onRemove.call(callbackContext, item, index + change.index);
            }
          }, callbackContext);
        } else {
          if (change.oldValue != null) {
            onRemove.call(callbackContext, change.oldValue, change.name);
          }
        }
      });

      // call onAdded second, allowing for items that changed location to be accurately processed
      changes.forEach(function(change) {
        if (change.type === 'splice') {
          source.slice(change.index, change.index + change.addedCount).forEach(function(item, index) {
            // Only call onAdd if this item was added, not if it changed location in the array
            if (oldValue.indexOf(item) === -1) {
              onAdd.call(callbackContext, item, index + change.index, source);
            }
          }, callbackContext);
        } else {
          var value = source[change.name];
          if (value != null) {
            onAdd.call(callbackContext, value, change.name, source);
          }
        }
      });
    } else if (Array.isArray(source)) {
      source.forEach(onAdd, callbackContext);
    } else if (source && typeof source === 'object') {
      Object.keys(source).forEach(function(key) {
        var value = source[key];
        if (value != null) {
          onAdd.call(callbackContext, value, key, source);
        }
      });
    } else if (Array.isArray(oldValue)) {
      oldValue.forEach(onRemove, callbackContext);
    } else if (oldValue && typeof oldValue === 'object') {
      // If undefined (or something that isn't an array/object) remove the observers
      Object.keys(oldValue).forEach(function(key) {
        var value = oldValue[key];
        if (value != null) {
          onRemove.call(callbackContext, value, key, oldValue);
        }
      });
    }
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

    this.windows = this.windows.filter(this.removeClosed);
    this.pendingSync = this.windows.map(this.queueSync);
    return true;
  },


  // Runs the observer sync cycle which checks all the observers to see if they've changed.
  syncNow: function(callback) {
    if (typeof callback === 'function') {
      this.afterSync(callback);
    }

    if (this.pendingSync) {
      this.pendingSync.forEach(this.cancelQueue);
      this.pendingSync = null;
    }

    if (this.syncing) {
      this.rerun = true;
      return false;
    }

    this.runSync();
    return true;
  },


  runSync: function() {
    this.syncing = true;
    this.rerun = true;
    this.cycles = 0;

    var i, l;

    // Allow callbacks to run the sync cycle again immediately, but stop at `maxCyles` (default 10) cycles so we don't
    // run infinite loops
    while (this.rerun) {
      if (++this.cycles === this.maxCycles) {
        throw new Error('Infinite observer syncing, an observer is calling Observer.sync() too many times');
      }
      this.rerun = false;
      // the observer array may increase or decrease in size (remaining observers) during the sync
      for (i = 0; i < this.observers.length; i++) {
        this.observers[i].sync();
      }
    }

    this.callbacksRunning = true;

    var callbacks = this.callbacks;
    this.callbacks = [];
    while (callbacks.length) {
      callbacks.shift()();
    }

    for (i = 0, l = this.listeners.length; i < l; i++) {
      var listener = this.listeners[i];
      listener();
    }

    this.callbacksRunning = false;
    this.syncing = false;
    this.cycles = 0;
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

  removeClosed: function(win) {
    return !win.closed;
  },

  queueSync: function(win) {
    var reqId = win.requestAnimationFrame(this.syncNow);
    return [win, reqId];
  },

  cancelQueue: function(queue) {
    var win = queue[0];
    var reqId = queue[1];
    win.cancelAnimationFrame(reqId);
  },
});
