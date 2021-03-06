var expect = require('chai').expect;
var Observations = require('../index').Observations;
var Observer = require('../src/observer');

global.log = function() {
  var args = [].slice.call(arguments);
  args.unshift('\033[36m***');
  args.push('\033[0m');
  console.log.apply(console, args);
}


describe('Observations.js', function() {

  describe('Observer', function() {
    var observations, observer, obj, called, lastValue, lastChanges, callback = function(value, old, changes) {
      called++;
      lastValue = value;
      lastChanges = changes;
    };

    beforeEach(function() {
      observations = new Observations();
      called = 0;
      lastValue = [];
      lastChanges = undefined;
      obj = { name: 'test', age: 100 };
      observer = new Observer(observations, 'name', callback);
    });


    it('should call callback when bound', function() {
      observer.bind(obj);
      expect(called).to.equal(1);
    });


    it('should not call the callback initially when skip requested', function() {
      observer.bind(obj, true);
      expect(called).to.equal(0);
    });


    it('should call callback when changed', function() {
      observer.bind(obj);
      expect(called).to.equal(1);
      expect(lastValue).to.equal('test');
      obj.name = 'bar';
      expect(called).to.equal(1);
      observations.syncNow();
      expect(called).to.equal(2);
      expect(lastValue).to.equal('bar');
    });


    it('should not call the callback if another value changed', function() {
      observer.bind(obj);
      expect(called).to.equal(1);

      obj.age = 50;
      observations.syncNow();
      expect(called).to.equal(1);
    });


    it('should not call callback after being unbound', function() {
      observer.bind(obj);
      expect(called).to.equal(1);
      observer.unbind(obj);
      obj.name = 'bar';
      observations.syncNow();
      expect(called).to.equal(1);
      expect(lastValue).to.equal('test');
    });


    it('should not call the callback if requested to skip the next sync', function() {
      observer.bind(obj);
      expect(called).to.equal(1);

      observer.skipNextSync();
      obj.name = 'test2';

      observations.syncNow();
      expect(called).to.equal(1);

      observations.syncNow();
      expect(called).to.equal(1);

      obj.name = 'test3';
      observations.syncNow();
      expect(called).to.equal(2);
    });


    it('should be able to get the value', function() {
      observer.bind(obj);
      expect(observer.get()).to.equal(obj.name);
    });


    it('should be able to set the value', function() {
      observer.bind(obj);
      observer.set('test2');
      expect(obj.name).to.equal('test2');
      expect(called).to.equal(2);

      observations.syncNow();
      expect(called).to.equal(2);
    });


    it('should be called when an object is changed', function() {
      obj.name = { first: 'test', last: 'test' };
      observer.bind(obj);
      expect(called).to.equal(1);

      obj.name = { first: 'test', last: 'test' };
      observations.syncNow();
      expect(called).to.equal(2);
    });


    it('should return change records when requested', function() {
      obj.name = { first: 'test', last: 'test' };
      observer.getChangeRecords = true;
      observer.bind(obj);
      expect(called).to.equal(1);

      obj.name.first = 'test2';
      obj.name.last = 'test2';
      observations.syncNow();
      expect(called).to.equal(2);
      expect(lastChanges).to.not.be.undefined;
      expect(lastChanges).to.have.length(2);
    });


    it('should not be called when an object is changed if the records have not', function() {
      obj.name = { first: 'test', last: 'test' };
      observer.getChangeRecords = true;
      observer.bind(obj);
      expect(called).to.equal(1);

      obj.name = { first: 'test', last: 'test' };
      observations.syncNow();
      expect(called).to.equal(1);
    });


    it('should support compareBy', function() {
      var obj = { children: [{ id: 1, name: 'Bob' }]};
      observer = new Observer(observations, 'children', callback);
      observer.getChangeRecords = true;
      observer.compareBy = 'id';
      observer.bind(obj);

      expect(lastChanges).to.be.undefined;
      expect(called).to.equal(1);

      obj.children = [{ id: 1, name: 'Bobby' }];
      observations.syncNow();
      expect(called).to.equal(1);

      obj.children = [{ id: 2, name: 'Bobby' }];
      observations.syncNow();
      expect(called).to.equal(2);
    });


    it('should support compareByName & index', function() {
      var highestIndex = -1;
      var calledId = 0;
      var getGetId = function(id) {
        return function(idx) {
          calledId++;
          highestIndex = Math.max(idx, highestIndex);
          return id;
        };
      };

      var obj = { children: [{ getId: getGetId(1), name: 'Bob' }]};

      observer = new Observer(observations, 'children', callback);
      observer.getChangeRecords = true;
      observer.compareBy = 'item.getId(index)';
      observer.compareByName = 'item';
      observer.compareByIndex = 'index';
      observer.bind(obj);

      expect(lastChanges).to.be.undefined;
      expect(called).to.equal(1);

      obj.children = [{ getId: getGetId(1), name: 'Bobby' }];
      observations.syncNow();
      expect(called).to.equal(1);
      expect(calledId).to.equal(2);
      expect(highestIndex).to.equal(0);

      obj.children = [{ getId: getGetId(2), name: 'Bobby' }];
      observations.syncNow();
      expect(called).to.equal(2);

      obj.children = [{ getId: getGetId(1), name: 'Bob' }, { getId: getGetId(2), name: 'Bobby' }];
      observations.syncNow();
      expect(called).to.equal(3);
      expect(highestIndex).to.equal(1);
    });

  });


  describe('Observations', function() {
    var observations;

    beforeEach('should create a new observations object', function() {
      observations = new Observations();
    });


    it('should call listeners on every sync', function() {
      var called = 0;
      observations.onSync(function() {
        called++;
      });

      expect(called).to.equal(0);

      observations.syncNow();
      expect(called).to.equal(1);
      observations.syncNow();
      expect(called).to.equal(2);
    });


    it('should stop callling removed listeners', function() {
      var called = 0, callback = function() {
        called++;
      };
      observations.onSync(callback);

      expect(called).to.equal(0);

      observations.syncNow();
      expect(called).to.equal(1);

      observations.offSync(callback);

      observations.syncNow();
      expect(called).to.equal(1);
    });


    it('should fire callbacks after next sync', function() {
      var called = 0, callback = function() {
        called++;
      };

      expect(called).to.equal(0);

      observations.afterSync(callback);

      observations.syncNow();
      expect(called).to.equal(1);

      observations.syncNow();
      expect(called).to.equal(1);

      observations.syncNow(callback);
      expect(called).to.equal(2);

    });


    it('should observe a context for changes to the results of an expression', function() {
      var obj = {}, called = 0;
      observations.observe(obj, 'foo', function() {
        called++;
      });

      expect(called).to.equal(1);
      observations.syncNow();
      expect(called).to.equal(1);
      obj.foo = 'bar';
      observations.syncNow();
      expect(called).to.equal(2);
      obj.foo = 'foobar';
      observations.syncNow();
      expect(called).to.equal(3);
    });


    it('should observe members of an array', function() {
      var lastAdd, addCalled = 0, addCallback = function(member) {
        lastAdd = member;
        addCalled++;
      };
      var lastRemove, removeCalled = 0, removeCallback = function(member) {
        lastRemove = member;
        removeCalled++;
      };

      var observer = observations.observeMembers('array', addCallback, removeCallback);
      var obj = { array: [ 'foo' ] };
      observer.bind(obj);

      expect(addCalled).to.equal(1);
      expect(lastAdd).to.equal('foo');
      expect(removeCalled).to.equal(0);

      obj.array = [ 'foo' ];
      observations.syncNow();

      expect(addCalled).to.equal(1);
      expect(removeCalled).to.equal(0);

      obj.array = [ 'foo', 'bar' ];
      observations.syncNow();

      expect(addCalled).to.equal(2);
      expect(lastAdd).to.equal('bar');
      expect(removeCalled).to.equal(0);

      obj.array = [ 'test' ];
      observations.syncNow();

      expect(addCalled).to.equal(3);
      expect(lastAdd).to.equal('test');
      expect(removeCalled).to.equal(2);
      expect(lastRemove).to.equal('bar');

      obj.array = [];
      observations.syncNow();

      expect(addCalled).to.equal(3);
      expect(removeCalled).to.equal(3);
      expect(lastRemove).to.equal('test');

    });


    it('should observe members of an object', function() {
      var lastAdd, addCalled = 0, addCallback = function(member) {
        lastAdd = member;
        addCalled++;
      };
      var lastRemove, removeCalled = 0, removeCallback = function(member) {
        lastRemove = member;
        removeCalled++;
      };

      var observer = observations.observeMembers('object', addCallback, removeCallback);
      var obj = { object: { foo: 'foo' } };
      observer.bind(obj);

      expect(addCalled).to.equal(1);
      expect(lastAdd).to.equal('foo');
      expect(removeCalled).to.equal(0);

      obj.object = { foo: 'foo' };
      observations.syncNow();

      expect(addCalled).to.equal(1);
      expect(removeCalled).to.equal(0);

      obj.object = { foo: 'foo', bar: '~bar~' };
      observations.syncNow();

      expect(addCalled).to.equal(2);
      expect(lastAdd).to.equal('~bar~');
      expect(removeCalled).to.equal(0);

      obj.object = { foo: '~foo~', bar: '~bar~' };
      observations.syncNow();

      expect(addCalled).to.equal(3);
      expect(lastAdd).to.equal('~foo~');
      expect(removeCalled).to.equal(1);
      expect(lastRemove).to.equal('foo');

      obj.object = { test: '~foo~' };
      observations.syncNow();

      expect(addCalled).to.equal(4);
      expect(lastAdd).to.equal('~foo~');
      expect(removeCalled).to.equal(3);
      expect(lastRemove).to.equal('~bar~');

      obj.object = null;
      observations.syncNow();

      expect(addCalled).to.equal(4);
      expect(removeCalled).to.equal(4);
      expect(lastRemove).to.equal('~foo~');

    });

  });


  describe('computed', function() {
    var observations, computed;

    beforeEach('should create a new observations object', function() {
      observations = new Observations();
      computed = observations.computed;
      observations.formatters.upper = function(value) {
        return typeof value === 'string' ? value.toUpperCase() : value;
      };
    });


    it('should compute a map of properties', function() {
      var loadedCount = 0;
      var removedCount = 0;
      var father = {
        firstName: 'Bob',
        lastName: 'Smith',
        children: [
          { getId: function() { return 1 }, name: 'Joey' },
          { getId: function() { return 3 }, name: 'Sally' },
          { getId: function() { return 93 }, name: 'Buddy' }
        ],
        loadData: function() {
          loadedCount++;
          return {
            then: function(resolveHandler) {
              resolveHandler('foobar');
            }
          };
        }
      };

      computed.extend(father, {
        test: '!foo',
        fullName: 'firstName + " " + lastName',
        caps: 'fullName | upper',
        childrenFullNames: computed.map('children', 'getId()', 'name + " " + $$.lastName', 'countRemoved()'),
        test2: computed.if('!test', 'childrenFullNames[children[0].getId()]'),
        loadedValue: computed.async('test', 'loadData()'),
        countRemoved: function() {
          removedCount++;
        }
      });

      expect(father.test).to.equal(true);
      expect(father.test2).to.equal(undefined);
      expect(father.fullName).to.equal('Bob Smith');
      expect(father.caps).to.equal('BOB SMITH');
      expect(father.childrenFullNames).to.deep.equal({
        1: 'Joey Smith',
        3: 'Sally Smith',
        93: 'Buddy Smith',
      });
      expect(loadedCount).to.equal(1);
      expect(removedCount).to.equal(0);
      expect(father.loadedValue).to.equal('foobar');

      father.foo = 'Test';
      father.firstName = 'John';
      father.lastName = 'Gordon';

      observations.syncNow();
      expect(father.test).to.equal(false);
      expect(father.test2).to.equal('Joey Gordon');
      expect(father.fullName).to.equal('John Gordon');
      expect(father.caps).to.equal('JOHN GORDON');
      expect(father.childrenFullNames).to.deep.equal({
        1: 'Joey Gordon',
        3: 'Sally Gordon',
        93: 'Buddy Gordon',
      });
      expect(removedCount).to.equal(0);


      father.foo = 'Test2';

      observations.syncNow();
      expect(father.test2).to.equal('Joey Gordon');

      father.children.pop();
      observations.syncNow();

      expect(father.childrenFullNames).to.deep.equal({
        1: 'Joey Gordon',
        3: 'Sally Gordon',
      });
      expect(removedCount).to.equal(1);
    });

  });

});
