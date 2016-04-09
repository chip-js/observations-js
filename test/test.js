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
      var father = {
        firstName: 'Bob',
        lastName: 'Smith',
        children: [
          { id: 1, name: 'Joey' },
          { id: 3, name: 'Sally' },
          { id: 93, name: 'Buddy' }
        ]
      };

      computed.extend(father, {
        test: '!foo',
        fullName: 'firstName + " " + lastName',
        caps: 'fullName | upper',
        childrenFullNames: computed.map('children', 'name + " " + $$.lastName'),
        test2: computed.if('!test', 'childrenFullNames[children[0].id]')
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


      father.foo = 'Test2';

      observations.syncNow();
      expect(father.test2).to.equal('Joey Gordon');
    });

  });

});
