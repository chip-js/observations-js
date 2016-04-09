# Observations.js

Observations.js takes a string of simple JavaScript (one-liners, no blocks) and triggers the given callback whenever the
result of the function changes. Using [Expressions.js](https://github.com/chip-js/expressions-js) it deals with null
values gracefully and supports formatters.

## Usage

### Basic

To install Observations.js you can use npm.

```
npm install observations-js
```

To use observations:

```js
var observations = require('observations-js').create();

var observer = observations.createObserver('name', function(value) {
  console.log('Name is', value);
});

var person = { name: 'Bob' };
observer.bind(person);
// logged "Name is Bob"

person.name = 'Fred';

observations.syncNow();
// logged "Name is Fred"
```

### API

#### Observations

 * `observations.createObserver(expression, callback, [callbackContext])`
   - Registers a new observer and callback.
 * `observations.observeMembers(expression, addedCallback, removedCallback, [callbackContext])`
   - Registers a new observer and calls the added callback whenever a member (of an array or object) is added and calls
     removed callback whenever a member is removed. Use `obj.computedObservers.enable()` or `disable()` to turn on/off.
 * `observations.computed(expressionMap)`
   - Creates an object which keeps the results of the computed expression map in sync
 * `observations.computed.extend(obj, expressionMap)`
   - Extends an existing object with the results of the computed expression map
 * `observations.sync([callback])`
   - Diffs observed objects, calling the registered callback on changed objects on the next sync cycle.
 * `observations.syncNow([callback])`
   - Explicitly runs the sync cycle on-demand.
 * `observations.afterSync(callback)`
   - Registers a callback to fire after the next (or current) sync cycle completes.
 * `observations.onSync(listener)`
   - Adds a listener that gets run during `sync()`.
 * `observations.offSync(listener)`
   - Removes an `onSync` listener.

#### Observer

 * `observer.bind(context)`
 * `observer.unbind()`
 * `observer.get()`
 * `observer.set(value)`
 * `observer.skipNextSync()`
 * `observer.close()`


## Contributions and Issues

Please open a ticket for any bugs or feature requests.

Contributions are welcome. Please fork and send a pull-request.
