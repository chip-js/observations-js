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
      obj = {};
      observer = new Observer(observations, 'foo', callback);
    });


    it('should call callback when bound', function() {
      observer.bind(obj);
      expect(called).to.equal(1);
    });

    it('should call callback when changed', function() {
      observer.bind(obj);
      expect(called).to.equal(1);
      expect(lastValue).to.equal(undefined);
      obj.foo = 'bar';
      expect(called).to.equal(1);
      observations.syncNow();
      expect(called).to.equal(2);
      expect(lastValue).to.equal('bar');
    });

    it('should not call callback after being unbound', function() {
      observer.bind(obj);
      expect(called).to.equal(1);
      observer.unbind(obj);
      obj.foo = 'bar';
      observations.syncNow();
      expect(called).to.equal(1);
      expect(lastValue).to.equal(undefined);
    });


    // TODO add more tests
  });


  describe('Observation', function() {

    it('should create a new observations object', function() {
      var observations = new Observations();
      expect(observations instanceof Observations).to.be.true;
    });

    // TODO add more tests

  });



});
