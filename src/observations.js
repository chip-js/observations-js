module.exports = Observations;
var Class = require('chip-utils/class');
var Observer = require('./observer');
var computed = require('./computed');
var requestAnimationFrame = global.requestAnimationFrame || setTimeout;
var cancelAnimationFrame = global.cancelAnimationFrame || clearTimeout;


function Observations() {
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
  this.syncNow = this.syncNow.bind(this);
  this.computed = computed.create(this);
}


Class.extend(Observations, {

  // Creates a new observer attached to this observations object. When the observer is bound to a context it will be added
  // to this `observations` and synced when this `observations.sync` is called.
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
});
