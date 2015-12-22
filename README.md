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

```
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

 * `observations.createObserver(expr, callback, [callbackContext])`
 * `observations.sync([callback])`
 * `observations.syncNow([callback])`
 * `observations.afterSync(callback)`
 * `observations.onSync(callback)`
 * `observations.removeOnSync(callback)`

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
