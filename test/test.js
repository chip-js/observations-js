var expect = require('chai').expect;
var Observations = require('../index');
var Observer = require('../src/observer');

global.log = function() {
  var args = [].slice.call(arguments);
  args.unshift('\033[36m***');
  args.push('\033[0m');
  console.log.apply(console, args);
}


describe('Observations.js', function() {

  describe('Observer', function() {
    var observations, observer, obj, called, lastValue, callback = function(value) {
      called++;
      lastValue = value;
    };

    beforeEach(function() {
      observations = new Observations();
      called = 0;
      lastValue = [];
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

  });


  describe('Observation', function() {
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

  });



});
