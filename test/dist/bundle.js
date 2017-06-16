var test = (function () {
'use strict';

/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

var index$1 = co['default'] = co.co = co;

/**
 * Wrap the given generator `fn` into a
 * function that returns a promise.
 * This is a separate function so that
 * every `co()` call doesn't create a new,
 * unnecessary closure.
 *
 * @param {GeneratorFunction} fn
 * @return {Function}
 * @api public
 */

co.wrap = function (fn) {
  createPromise.__generatorFunction__ = fn;
  return createPromise;
  function createPromise() {
    return co.call(this, fn.apply(this, arguments));
  }
};

/**
 * Execute the generator function or a generator
 * and return a promise.
 *
 * @param {Function} fn
 * @return {Promise}
 * @api public
 */

function co(gen) {
  var ctx = this;
  var args = slice.call(arguments, 1);

  // we wrap everything in a promise to avoid promise chaining,
  // which leads to memory leak errors.
  // see https://github.com/tj/co/issues/180
  return new Promise(function(resolve, reject) {
    if (typeof gen === 'function') { gen = gen.apply(ctx, args); }
    if (!gen || typeof gen.next !== 'function') { return resolve(gen); }

    onFulfilled();

    /**
     * @param {Mixed} res
     * @return {Promise}
     * @api private
     */

    function onFulfilled(res) {
      var ret;
      try {
        ret = gen.next(res);
      } catch (e) {
        return reject(e);
      }
      next(ret);
    }

    /**
     * @param {Error} err
     * @return {Promise}
     * @api private
     */

    function onRejected(err) {
      var ret;
      try {
        ret = gen.throw(err);
      } catch (e) {
        return reject(e);
      }
      next(ret);
    }

    /**
     * Get the next value in the generator,
     * return a promise.
     *
     * @param {Object} ret
     * @return {Promise}
     * @api private
     */

    function next(ret) {
      if (ret.done) { return resolve(ret.value); }
      var value = toPromise.call(ctx, ret.value);
      if (value && isPromise(value)) { return value.then(onFulfilled, onRejected); }
      return onRejected(new TypeError('You may only yield a function, promise, generator, array, or object, '
        + 'but the following object was passed: "' + String(ret.value) + '"'));
    }
  });
}

/**
 * Convert a `yield`ed value into a promise.
 *
 * @param {Mixed} obj
 * @return {Promise}
 * @api private
 */

function toPromise(obj) {
  if (!obj) { return obj; }
  if (isPromise(obj)) { return obj; }
  if (isGeneratorFunction(obj) || isGenerator(obj)) { return co.call(this, obj); }
  if ('function' == typeof obj) { return thunkToPromise.call(this, obj); }
  if (Array.isArray(obj)) { return arrayToPromise.call(this, obj); }
  if (isObject(obj)) { return objectToPromise.call(this, obj); }
  return obj;
}

/**
 * Convert a thunk to a promise.
 *
 * @param {Function}
 * @return {Promise}
 * @api private
 */

function thunkToPromise(fn) {
  var ctx = this;
  return new Promise(function (resolve, reject) {
    fn.call(ctx, function (err, res) {
      if (err) { return reject(err); }
      if (arguments.length > 2) { res = slice.call(arguments, 1); }
      resolve(res);
    });
  });
}

/**
 * Convert an array of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Array} obj
 * @return {Promise}
 * @api private
 */

function arrayToPromise(obj) {
  return Promise.all(obj.map(toPromise, this));
}

/**
 * Convert an object of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Object} obj
 * @return {Promise}
 * @api private
 */

function objectToPromise(obj){
  var results = new obj.constructor();
  var keys = Object.keys(obj);
  var promises = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var promise = toPromise.call(this, obj[key]);
    if (promise && isPromise(promise)) { defer(promise, key); }
    else { results[key] = obj[key]; }
  }
  return Promise.all(promises).then(function () {
    return results;
  });

  function defer(promise, key) {
    // predefine the key in the result
    results[key] = undefined;
    promises.push(promise.then(function (res) {
      results[key] = res;
    }));
  }
}

/**
 * Check if `obj` is a promise.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isPromise(obj) {
  return 'function' == typeof obj.then;
}

/**
 * Check if `obj` is a generator.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGenerator(obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */
function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  if (!constructor) { return false; }
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) { return true; }
  return isGenerator(constructor.prototype);
}

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject(val) {
  return Object == val.constructor;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var keys = createCommonjsModule(function (module, exports) {
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) { keys.push(key); }
  return keys;
}
});

var is_arguments = createCommonjsModule(function (module, exports) {
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
}
});

var index$1$1 = createCommonjsModule(function (module) {
var pSlice = Array.prototype.slice;
var objectKeys = keys;
var isArguments = is_arguments;

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) { opts = {}; }
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
};

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') { return false; }
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') { return false; }
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    { return false; }
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) { return false; }
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) { return false; }
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) { return false; }
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    { return false; }
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      { return false; }
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) { return false; }
  }
  return typeof a === typeof b;
}
});

const assertions = {
  ok(val, message = 'should be truthy') {
    const assertionResult = {
      pass: Boolean(val),
      expected: 'truthy',
      actual: val,
      operator: 'ok',
      message
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  deepEqual(actual, expected, message = 'should be equivalent') {
    const assertionResult = {
      pass: index$1$1(actual, expected),
      actual,
      expected,
      message,
      operator: 'deepEqual'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  equal(actual, expected, message = 'should be equal') {
    const assertionResult = {
      pass: actual === expected,
      actual,
      expected,
      message,
      operator: 'equal'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  notOk(val, message = 'should not be truthy') {
    const assertionResult = {
      pass: !Boolean(val),
      expected: 'falsy',
      actual: val,
      operator: 'notOk',
      message
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  notDeepEqual(actual, expected, message = 'should not be equivalent') {
    const assertionResult = {
      pass: !index$1$1(actual, expected),
      actual,
      expected,
      message,
      operator: 'notDeepEqual'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  notEqual(actual, expected, message = 'should not be equal') {
    const assertionResult = {
      pass: actual !== expected,
      actual,
      expected,
      message,
      operator: 'notEqual'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  throws(func, expected, message) {
    let caught, pass, actual;
    if (typeof expected === 'string') {
      [expected, message] = [message, expected];
    }
    try {
      func();
    } catch (error) {
      caught = {error};
    }
    pass = caught !== undefined;
    actual = caught && caught.error;
    if (expected instanceof RegExp) {
      pass = expected.test(actual) || expected.test(actual && actual.message);
      expected = String(expected);
    } else if (typeof expected === 'function' && caught) {
      pass = actual instanceof expected;
      actual = actual.constructor;
    }
    const assertionResult = {
      pass,
      expected,
      actual,
      operator: 'throws',
      message: message || 'should throw'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  doesNotThrow(func, expected, message) {
    let caught;
    if (typeof expected === 'string') {
      [expected, message] = [message, expected];
    }
    try {
      func();
    } catch (error) {
      caught = {error};
    }
    const assertionResult = {
      pass: caught === undefined,
      expected: 'no thrown error',
      actual: caught && caught.error,
      operator: 'doesNotThrow',
      message: message || 'should not throw'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  },
  fail(reason = 'fail called') {
    const assertionResult = {
      pass: false,
      actual: 'fail called',
      expected: 'fail not called',
      message: reason,
      operator: 'fail'
    };
    this.test.addAssertion(assertionResult);
    return assertionResult;
  }
};

function assertion (test) {
  return Object.create(assertions, {test: {value: test}});
}

const Test = {
  run: function () {
    const assert = assertion(this);
    const now = Date.now();
    return index$1(this.coroutine(assert))
      .then(() => {
        return {assertions: this.assertions, executionTime: Date.now() - now};
      });
  },
  addAssertion(){
    const newAssertions = [...arguments].map(a => Object.assign({description: this.description}, a));
    this.assertions.push(...newAssertions);
    return this;
  }
};

function test ({description, coroutine, only = false}) {
  return Object.create(Test, {
    description: {value: description},
    coroutine: {value: coroutine},
    assertions: {value: []},
    only: {value: only},
    length: {
      get(){
        return this.assertions.length
      }
    }
  });
}

function tapOut ({pass, message, index}) {
  const status = pass === true ? 'ok' : 'not ok';
  console.log([status, index, message].join(' '));
}

function canExit () {
  return typeof process !== 'undefined' && typeof process.exit === 'function';
}

function tap () {
  return function * () {
    let index = 1;
    let lastId = 0;
    let success = 0;
    let failure = 0;

    const starTime = Date.now();
    console.log('TAP version 13');
    try {
      while (true) {
        const assertion = yield;
        if (assertion.pass === true) {
          success++;
        } else {
          failure++;
        }
        assertion.index = index;
        if (assertion.id !== lastId) {
          console.log(`# ${assertion.description} - ${assertion.executionTime}ms`);
          lastId = assertion.id;
        }
        tapOut(assertion);
        if (assertion.pass !== true) {
          console.log(`  ---
  operator: ${assertion.operator}
  expected: ${JSON.stringify(assertion.expected)}
  actual: ${JSON.stringify(assertion.actual)}
  ...`);
        }
        index++;
      }
    } catch (e) {
      console.log('Bail out! unhandled exception');
      console.log(e);
      if (canExit()) {
        process.exit(1);
      }
    }
    finally {
      const execution = Date.now() - starTime;
      if (index > 1) {
        console.log(`
1..${index - 1}
# duration ${execution}ms
# success ${success}
# failure ${failure}`);
      }
      if (failure && canExit()) {
        process.exit(1);
      }
    }
  };
}

const Plan = {
  test(description, coroutine, opts = {}){
    const testItems = (!coroutine && description.tests) ? [...description] : [{description, coroutine}];
    this.tests.push(...testItems.map(t=>test(Object.assign(t, opts))));
    return this;
  },

  only(description, coroutine){
    return this.test(description, coroutine, {only: true});
  },

  run(sink = tap()){
    const sinkIterator = sink();
    sinkIterator.next();
    const hasOnly = this.tests.some(t=>t.only);
    const runnable = hasOnly ? this.tests.filter(t=>t.only) : this.tests;
    return index$1(function * () {
      let id = 1;
      try {
        const results = runnable.map(t=>t.run());
        for (let r of results) {
          const {assertions, executionTime} = yield r;
          for (let assert of assertions) {
            sinkIterator.next(Object.assign(assert, {id, executionTime}));
          }
          id++;
        }
      }
      catch (e) {
        sinkIterator.throw(e);
      } finally {
        sinkIterator.return();
      }
    }.bind(this))
  },

  * [Symbol.iterator](){
    for (let t of this.tests) {
      yield t;
    }
  }
};

function plan$1 () {
  return Object.create(Plan, {
    tests: {value: []},
    length: {
      get(){
        return this.tests.length
      }
    }
  });
}

const nextTick = fn => setTimeout(fn, 0);

const pairify = holder => key => [key, holder[key]];

const isShallowEqual = (a, b) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k]);
};

const ownKeys = obj => Object.keys(obj).filter(k => obj.hasOwnProperty(k));

const isDeepEqual = (a, b) => {
  const type = typeof a;

  //short path(s)
  if (a === b) {
    return true;
  }

  if (type !== typeof b) {
    return false;
  }

  if (type !== 'object') {
    return a === b;
  }

  // objects ...
  if (a === null || b === null) {
    return false;
  }

  if (Array.isArray(a)) {
    return a.length && b.length && a.every((item, i) => isDeepEqual(a[i], b[i]));
  }

  const aKeys = ownKeys(a);
  const bKeys = ownKeys(b);
  return aKeys.length === bKeys.length && aKeys.every(k => isDeepEqual(a[k], b[k]));
};

const identity = a => a;

const noop = _ => {
};

const traverse = function * (vnode) {
  yield vnode;
  if (vnode.children && vnode.children.length) {
    for (let child of vnode.children) {
      yield * traverse(child);
    }
  }
};

var util = plan$1()
  .test('should traverse a tree (going deep first)', function * (t) {
    const tree = {
      id: 1,
      children: [
        {id: 2, children: [{id: 3}, {id: 4}]},
        {id: 5, children: [{id: 6}]},
        {id: 7}
      ]
    };

    const sequence = [...traverse(tree)].map(n => n.id);
    t.deepEqual(sequence, [1, 2, 3, 4, 5, 6, 7]);
  })
  .test('pair key to value object of an object (aka Object.entries)', function * (t) {
    const holder = {a: 1, b: 2, c: 3, d: 4};
    const f = pairify(holder);
    const data = Object.keys(holder).map(f);
    t.deepEqual(data, [['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
  })
  .test('shallow equality test on object', function * (t) {
    const nested = {foo: 'bar'};
    const obj1 = {a: 1, b: '2', c: true, d: nested};
    t.ok(isShallowEqual(obj1, {a: 1, b: '2', c: true, d: nested}));
    t.notOk(isShallowEqual(obj1, {
      a: 1,
      b: '2',
      c: true,
      d: {foo: 'bar'}
    }), 'nested object should be checked by reference');
    t.notOk(isShallowEqual(obj1, {a: 1, b: 2, c: true, d: nested}), 'exact type checking on primitive');
    t.notOk(isShallowEqual(obj1, {a: 1, c: true, d: nested}), 'return false on missing properties');
    t.notOk(isShallowEqual({a: 1, c: true, d: nested}, obj1), 'return false on missing properties (commmutative');
  });

function compose (first, ...fns) {
  return (...args) => fns.reduce((previous, current) => current(previous), first(...args));
}

function curry (fn, arityLeft) {
  const arity = arityLeft || fn.length;
  return (...args) => {
    const argLength = args.length || 1;
    if (arity === argLength) {
      return fn(...args);
    } else {
      const func = (...moreArgs) => fn(...args, ...moreArgs);
      return curry(func, arity - args.length);
    }
  };
}



function tap$1 (fn) {
  return arg => {
    fn(arg);
    return arg;
  }
}

const SVG_NP = 'http://www.w3.org/2000/svg';

const updateDomNodeFactory = (method) => (items) => tap$1(domNode => {
  for (let pair of items) {
    domNode[method](...pair);
  }
});

const removeEventListeners = updateDomNodeFactory('removeEventListener');

const addEventListeners = updateDomNodeFactory('addEventListener');

const setAttributes = (items) => tap$1((domNode) => {
  const attributes = items.filter(([key, value]) => typeof value !== 'function');
  for (let [key, value] of attributes) {
    value === false ? domNode.removeAttribute(key) : domNode.setAttribute(key, value);
  }
});

const removeAttributes = (items) => tap$1(domNode => {
  for (let attr of items) {
    domNode.removeAttribute(attr);
  }
});

const setTextNode = val => node => node.textContent = val;

const createDomNode = (vnode, parent) => {
  if (vnode.nodeType === 'svg') {
    return document.createElementNS(SVG_NP, vnode.nodeType);
  } else if (vnode.nodeType === 'Text') {
    return document.createTextNode(vnode.nodeType);
  } else {
    return parent.namespaceURI === SVG_NP ? document.createElementNS(SVG_NP, vnode.nodeType) : document.createElement(vnode.nodeType);
  }
};

const getEventListeners = (props) => {
  return Object.keys(props)
    .filter(k => k.substr(0, 2) === 'on')
    .map(k => [k.substr(2).toLowerCase(), props[k]]);
};

const domProto = {

  removeAttribute(attr){
    delete this[attr];
  },

  setAttribute(attr, val){
    this[attr] = val;
  },

  addEventListener(event, handler){
    this.handlers[event] = handler;
  },

  removeEventListener(event, handler){
    delete this.handlers[event];
  }
};

const fakeDom = () => {
  const dom = Object.create(domProto);
  Object.defineProperty(dom, 'handlers', {value: {}});
  return dom;
};

const ownProps = (obj) => {
  const ownProperties = [];
  for (let prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      ownProperties.push(prop);
    }
  }
  return ownProperties;
};


var domUtil = plan$1()
  .test('set attributes', function * (t) {
    const d = fakeDom();
    const update = setAttributes([['foo', 'bar'], ['blah', 2], ['woot', true]]);
    const n = update(d);
    t.equal(n, d, 'should have forwarded dom node');
    t.equal(d.foo, 'bar');
    t.equal(d.blah, 2);
    t.equal(d.woot, true);
    const props = ownProps(d);
    t.deepEqual(props, ['foo', 'blah', 'woot']);
    const handlers = ownProps(d.handlers);
    t.equal(handlers.length, 0);
  })
  .test('remove attribute if value is false', function * (t) {
    const d = fakeDom();
    d.foo = 'bar';
    t.deepEqual(ownProps(d), ['foo']);
    const update = setAttributes([['foo', false]]);
    const n = update(d);
    t.equal(n, d, 'should have forwarded dom node');
    t.equal(d.foo, undefined);
    t.equal(ownProps(d).length, 0);
    const handlers = ownProps(d.handlers);
    t.equal(handlers.length, 0);
  })
  .test('remove attributes', function * (t) {
    const d = fakeDom();
    d.foo = 'bar';
    d.woot = 2;
    d.bar = 'blah';
    t.deepEqual(ownProps(d), ['foo', 'woot', 'bar']);
    const update = removeAttributes(['foo', 'woot']);
    const n = update(d);
    t.equal(n, d, 'should have forwarded dom node');
    t.equal(d.bar, 'blah');
    t.equal(ownProps(d).length, 1);
    const handlers = ownProps(d.handlers);
    t.equal(handlers.length, 0);
  })
  .test('add event listeners', function * (t) {
    const d = fakeDom();
    const update = addEventListeners([['click', noop
    ], ['input', noop]]);
    const n = update(d);
    t.equal(n, d, 'should have forwarded the node');
    t.equal(ownProps(d).length, 0);
    t.deepEqual(ownProps(d.handlers), ['click', 'input']);
    t.equal(d.handlers.click, noop);
    t.equal(d.handlers.input, noop);
  })
  .test('remove event listeners', function * (t) {
    const d = fakeDom();
    d.handlers.click = noop;
    d.handlers.input = noop;
    const update = removeEventListeners([['click', noop
    ]]);
    const n = update(d);
    t.equal(n, d, 'should have forwarded the node');
    t.deepEqual(ownProps(d.handlers), ['input']);
    t.equal(d.handlers.input, noop);
  })
  .test('set text node value', function * (t) {
    const node = {};
    const update = setTextNode('foo');
    update(node);
    t.equal(node.textContent, 'foo');
  })
  .test('get event Listeners from props object', function * (t) {
    const props = {
      onClick: () => {
      },
      input: () => {
      },
      onMousedown: () => {
      }
    };

    const events = getEventListeners(props);
    t.deepEqual(events, [
      ['click', props.onClick],
      ['mousedown', props.onMousedown],
    ]);
  });

const createTextVNode = (value) => ({
  nodeType: 'Text',
  children: [],
  props: {value},
  lifeCycle: 0
});

/**
 * Transform hyperscript into virtual dom node
 * @param nodeType {Function, String} - the HTML tag if string, a component or combinator otherwise
 * @param props {Object} - the list of properties/attributes associated to the related node
 * @param children - the virtual dom nodes related to the current node children
 * @returns {Object} - a virtual dom node
 */
function h$1 (nodeType, props, ...children) {
  const flatChildren = children.reduce((acc, child) => {
    const childrenArray = Array.isArray(child) ? child : [child];
    return acc.concat(childrenArray);
  }, [])
    .map(child => {
      // normalize text node to have same structure than regular dom nodes
      const type = typeof child;
      return type === 'object' || type === 'function' ? child : createTextVNode(child);
    });

  if (typeof nodeType !== 'function') {//regular html/text node
    return {
      nodeType,
      props: props,
      children: flatChildren,
      lifeCycle: 0
    };
  } else {
    const fullProps = Object.assign({children: flatChildren}, props);
    const comp = nodeType(fullProps);
    return typeof comp !== 'function' ? comp : h$1(comp, props, ...flatChildren); //functional comp vs combinator (HOC)
  }
}

const updateEventListeners = ({props:newNodeProps}={}, {props:oldNodeProps}={}) => {
  const newNodeEvents = getEventListeners(newNodeProps || {});
  const oldNodeEvents = getEventListeners(oldNodeProps || {});

  return newNodeEvents.length || oldNodeEvents.length ?
    compose(
      removeEventListeners(oldNodeEvents),
      addEventListeners(newNodeEvents)
    ) : noop;
};

const updateAttributes = (newVNode, oldVNode) => {
  const newVNodeProps = newVNode.props || {};
  const oldVNodeProps = oldVNode.props || {};

  if (isShallowEqual(newVNodeProps, oldVNodeProps)) {
    return noop;
  }

  if (newVNode.nodeType === 'Text') {
    return setTextNode(newVNode.props.value);
  }

  const newNodeKeys = Object.keys(newVNodeProps);
  const oldNodeKeys = Object.keys(oldVNodeProps);
  const attributesToRemove = oldNodeKeys.filter(k => !newNodeKeys.includes(k));

  return compose(
    removeAttributes(attributesToRemove),
    setAttributes(newNodeKeys.map(pairify(newVNodeProps)))
  );
};

const domFactory = createDomNode;

// apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
const domify = (oldVnode, newVnode, parentDomNode) => {
  if (!oldVnode) {//there is no previous vnode
    if (newVnode) {//new node => we insert
      newVnode.dom = parentDomNode.appendChild(domFactory(newVnode, parentDomNode));
      newVnode.lifeCycle = 1;
      return {vnode: newVnode, garbage: null};
    } else {//else (irrelevant)
      throw new Error('unsupported operation')
    }
  } else {//there is a previous vnode
    if (!newVnode) {//we must remove the related dom node
      parentDomNode.removeChild(oldVnode.dom);
      return ({garbage: oldVnode, dom: null});
    } else if (newVnode.nodeType !== oldVnode.nodeType) {//it must be replaced
      newVnode.dom = domFactory(newVnode, parentDomNode);
      newVnode.lifeCycle = 1;
      parentDomNode.replaceChild(newVnode.dom, oldVnode.dom);
      return {garbage: oldVnode, vnode: newVnode};
    } else {// only update attributes
      newVnode.dom = oldVnode.dom;
      // pass the unMountHook
      if(oldVnode.onUnMount){
        newVnode.onUnMount = oldVnode.onUnMount;
      }
      newVnode.lifeCycle = oldVnode.lifeCycle + 1;
      return {garbage: null, vnode: newVnode};
    }
  }
};

/**
 * render a virtual dom node, diffing it with its previous version, mounting it in a parent dom node
 * @param oldVnode
 * @param newVnode
 * @param parentDomNode
 * @param onNextTick collect operations to be processed on next tick
 * @returns {Array}
 */
const render = (oldVnode, newVnode, parentDomNode, onNextTick = []) => {

  //1. transform the new vnode to a vnode connected to an actual dom element based on vnode versions diffing
  // i. note at this step occur dom insertions/removals
  // ii. it may collect sub tree to be dropped (or "unmounted")
  const {vnode, garbage} = domify(oldVnode, newVnode, parentDomNode);

  if (garbage !== null) {
    // defer unmount lifecycle as it is not "visual"
    for (let g of traverse(garbage)) {
      if (g.onUnMount) {
        onNextTick.push(g.onUnMount);
      }
    }
  }

  //Normalisation of old node (in case of a replace we will consider old node as empty node (no children, no props))
  const tempOldNode = garbage !== null || !oldVnode ? {length: 0, children: [], props: {}} : oldVnode;

  if (vnode) {

    //2. update dom attributes based on vnode prop diffing.
    //sync
    if (vnode.onUpdate && vnode.lifeCycle > 1) {
      vnode.onUpdate();
    }

    updateAttributes(vnode, tempOldNode)(vnode.dom);

    //fast path
    if (vnode.nodeType === 'Text') {
      return onNextTick;
    }

    if (vnode.onMount && vnode.lifeCycle === 1) {
      onNextTick.push(() => vnode.onMount());
    }

    const childrenCount = Math.max(tempOldNode.children.length, vnode.children.length);

    //async will be deferred as it is not "visual"
    const setListeners = updateEventListeners(vnode, tempOldNode);
    if (setListeners !== noop) {
      onNextTick.push(() => setListeners(vnode.dom));
    }

    //3 recursively traverse children to update dom and collect functions to process on next tick
    if (childrenCount > 0) {
      for (let i = 0; i < childrenCount; i++) {
        // we pass onNextTick as reference (improve perf: memory + speed)
        render(tempOldNode.children[i], vnode.children[i], vnode.dom, onNextTick);
      }
    }
  }

  return onNextTick;
};

const hydrate = (vnode, dom) => {
  'use strict';
  const hydrated = Object.assign({}, vnode);
  const domChildren = Array.from(dom.childNodes).filter(n => n.nodeType !== 3 || n.nodeValue.trim() !== '');
  hydrated.dom = dom;
  hydrated.children = vnode.children.map((child, i) => hydrate(child, domChildren[i]));
  return hydrated;
};

const mount = curry((comp, initProp, root) => {
  const vnode = comp.nodeType !== void 0 ? comp : comp(initProp || {});
  const oldVNode = root.children.length ? hydrate(vnode, root.children[0]) : null;
  const batch = render(oldVNode, vnode, root);
  nextTick(() => {
    for (let op of batch) {
      op();
    }
  });
  return vnode;
});

/**
 * Create a function which will trigger an update of the component with the passed state
 * @param comp {Function} - the component to update
 * @param initialVNode - the initial virtual dom node related to the component (ie once it has been mounted)
 * @returns {Function} - the update function
 */
var update = (comp, initialVNode) => {
  let oldNode = initialVNode;
  return (props, ...args) => {
    const mount$$1 = oldNode.dom.parentNode;
    const newNode = comp(Object.assign({children: oldNode.children || []}, oldNode.props, props), ...args);
    const nextBatch = render(oldNode, newNode, mount$$1);

    // danger zone !!!!
    // change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream: oldNode may be the child of someone ...(well that is a tree data structure after all :P )
    oldNode = Object.assign(oldNode || {}, newNode);
    // end danger zone

    nextTick(_ => {
      for (let op of nextBatch) {
        op();
      }
    });
    return newNode;
  };
};

const lifeCycleFactory = method => curry((fn, comp) => (props, ...args) => {
  const n = comp(props, ...args);
  n[method] = () => fn(n, ...args);
  return n;
});

/**
 * life cycle: when the component is mounted
 */
const onMount = lifeCycleFactory('onMount');

/**
 * life cycle: when the component is unmounted
 */
const onUnMount = lifeCycleFactory('onUnMount');

/**
 * life cycle: before the component is updated
 */
const onUpdate = lifeCycleFactory('onUpdate');

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp {Function} - the component
 * @returns {Function} - a new wrapped component
 */
var withState = (comp) => () => {
  let updateFunc;
  const wrapperComp = (props, ...args) => {
    //lazy evaluate updateFunc (to make sure it is defined
    const setState = (newState) => updateFunc(newState);
    return comp(props, setState, ...args);
  };
  const setUpdateFunction = (vnode) => {
    updateFunc = update(wrapperComp, vnode);
  };

  return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
};

/**
 * Combinator to create a Elm like app
 * @param view {Function} - a component which takes as arguments the current model and the list of updates
 * @returns {Function} - a Elm like application whose properties "model", "updates" and "subscriptions" will define the related domain specific objects
 */

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change under specific circumstances
 * @param store {Object} - The store (implementing the same api than Redux store
 * @param sliceState {Function} [state => state] - A function which takes as argument the state and return a "transformed" state (like partial, etc) relevant to the container
 * @returns {Function} - A container factory with the following arguments:
 *  - mapStateToProp: a function which takes as argument what the "sliceState" function returns and returns an object to be blended into the properties of the component (default to identity function)
 *  - shouldUpdate: a function which takes as arguments the previous and the current versions of what "sliceState" function returns to returns a boolean defining whether the component should be updated (default to a deepEqual check)
 */
var connect = (store, sliceState = identity) =>
  (comp, mapStateToProp = identity, shouldUpate = (a, b) => isDeepEqual(a, b) === false) =>
    (initProp) => {
      let componentProps = initProp;
      let updateFunc, previousStateSlice, unsubscriber;

      const wrapperComp = (props, ...args) => {
        return comp(Object.assign(props, mapStateToProp(sliceState(store.getState()))), ...args);
      };

      const subscribe = onMount((vnode) => {
        updateFunc = update(wrapperComp, vnode);
        unsubscriber = store.subscribe(() => {
          const stateSlice = sliceState(store.getState());
          if (shouldUpate(previousStateSlice, stateSlice) === true) {
            Object.assign(componentProps, mapStateToProp(stateSlice));
            updateFunc(componentProps);
            previousStateSlice = stateSlice;
          }
        });
      });

      const unsubscribe = onUnMount(() => {
        unsubscriber();
      });

      return compose(subscribe, unsubscribe)(wrapperComp);
    };

var h$$1 = plan$1()
  .test('create regular html node', function * (t) {
    const vnode = h$1('div', {id: 'someId', "class": 'special'});
    t.deepEqual(vnode, {lifeCycle: 0, nodeType: 'div', props: {id: 'someId', "class": 'special'}, children: []});
  })
  .test('create regular html node with text node children', function * (t) {
    const vnode = h$1('div', {id: 'someId', "class": 'special'}, 'foo');
    t.deepEqual(vnode, {
      nodeType: 'div', lifeCycle: 0, props: {id: 'someId', "class": 'special'}, children: [{
        nodeType: 'Text',
        children: [],
        props: {value: 'foo'},
        lifeCycle: 0
      }]
    });
  })
  .test('create regular html with children', function * (t) {
    const vnode = h$1('ul', {id: 'collection'}, h$1('li', {id: 1}, 'item1'), h$1('li', {id: 2}, 'item2'));
    t.deepEqual(vnode, {
      nodeType: 'ul',
      props: {id: 'collection'},
      lifeCycle: 0,
      children: [
        {
          nodeType: 'li',
          props: {id: 1},
          lifeCycle: 0,
          children: [{
            nodeType: 'Text',
            props: {value: 'item1'},
            children: [],
            lifeCycle: 0
          }]
        }, {
          nodeType: 'li',
          props: {id: 2},
          lifeCycle: 0,
          children: [{
            nodeType: 'Text',
            props: {value: 'item2'},
            children: [],
            lifeCycle: 0
          }]
        }
      ]
    });
  })
  .test('use function as component passing the children as prop', function * (t) {
    const foo = (props) => h$1('p', props);
    const vnode = h$1(foo, {id: 1}, 'hello world');
    t.deepEqual(vnode, {
      nodeType: 'p',
      lifeCycle: 0,
      props: {
        children: [{
          nodeType: 'Text',
          lifeCycle: 0,
          children: [],
          props: {value: 'hello world'}
        }],
        id: 1
      },
      children: []
    });
  })
  .test('use nested combinator to create vnode', function * (t) {
    const combinator = () => () => () => () => (props) => h$1('p', {id: 'foo'});
    const vnode = h$1(combinator, {});
    t.deepEqual(vnode, {nodeType: 'p', lifeCycle: 0, props: {id: 'foo'}, children: []});
  });

function waitNextTick () {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, 2);
  })
}

var lifecycles = plan$1()
  .test('should run a function when component is mounted', function * (t) {
    let counter = 0;
    const container = document.createElement('div');
    const comp = () => h$1( 'p', null, "hello world" );
    const withMount = onMount(() => {
      counter++;
    }, comp);
    mount(withMount, {}, container);
    t.equal(counter, 0);
    yield waitNextTick();
    t.equal(counter, 1);
  })
  .test('should run a function when component is unMounted', function * (t) {
    let unmounted = null;
    const container = document.createElement('div');
    const Item = onUnMount((n) => {
      unmounted = n;
    }, ({id}) => h$1( 'li', { id: id }, "hello world"));
    const containerComp = (({items}) => (h$1( 'ul', null,
      items.map(item => h$1( Item, item))
    )));

    const vnode = mount(containerComp, {items: [{id: 1}, {id: 2}, {id: 3}]}, container);
    t.equal(container.innerHTML, '<ul><li id="1">hello world</li><li id="2">hello world</li><li id="3">hello world</li></ul>');
    const batch = render(vnode, containerComp({items: [{id: 1}, {id: 3}]}), container);
    t.equal(container.innerHTML, '<ul><li id="1">hello world</li><li id="3">hello world</li></ul>');
    for (let f of batch){
      f();
    }
    t.notEqual(unmounted, null);
  });

var render$1 = plan$1()
  .test('mount a simple component', function * (t) {
    const container = document.createElement('div');
    const Comp = (props) => (h$1( 'h1', null, h$1( 'span', { id: props.id }, props.greeting) ));
    mount(Comp, {id: 123, greeting: 'hello world'}, container);
    t.equal(container.innerHTML, '<h1><span id="123">hello world</span></h1>');
  })
  .test('mount composed component', function * (t) {
    const container = document.createElement('div');
    const Comp = (props) => (h$1( 'h1', null, h$1( 'span', { id: props.id }, props.greeting) ));
    const Container = (props) => (h$1( 'section', null,
      h$1( Comp, { id: "567", greeting: "hello you" })
    ));
    mount(Container, {}, container);
    t.equal(container.innerHTML, '<section><h1><span id="567">hello you</span></h1></section>');
  })
  .test('mount a component with inner child', function * (t) {
    const container = document.createElement('div');
    const Comp = (props) => (h$1( 'h1', null, h$1( 'span', { id: props.id }, props.greeting) ));
    const Container = (props) => (h$1( 'section', null, props.children ));
    mount(() => h$1( Container, null, h$1( Comp, { id: "567", greeting: "hello world" }) ), {}, container);
    t.equal(container.innerHTML, '<section><h1><span id="567">hello world</span></h1></section>');
  });

var update$1 = plan$1()
  .test('give ability to update a node (and its descendant)', function * (t) {
    const container = document.createElement('div');
    const comp = (({id, content}) => (h$1( 'p', { id: id }, content)));
    const initialVnode = mount(comp, {id: 123, content: 'hello world'}, container);
    t.equal(container.innerHTML, '<p id="123">hello world</p>');
    const updateFunc = update(comp, initialVnode);
    updateFunc({id: 567, content: 'bonjour monde'});
    t.equal(container.innerHTML, '<p id="567">bonjour monde</p>');
  });

var withState$1 = plan$1()
  .test('bind an update function to a component', function * (t) {
    let update$$1 = null;
    const Comp = withState(({foo}, setState) => {
      if (!update$$1) {
        update$$1 = setState;
      }
      return h$1( 'p', null, foo );
    });
    const container = document.createElement('div');
    mount(({foo}) => h$1( Comp, { foo: foo }), {foo: 'bar'}, container);
    t.equal(container.innerHTML, '<p>bar</p>');
    yield waitNextTick();
    update$$1({foo: 'bis'});
    t.equal(container.innerHTML, '<p>bis</p>');
  })
  .test('should create isolated state for each component', function * (t) {
    let update1 = null;
    let update2 = null;
    const Comp = withState(({foo}, setState) => {
      if (!update1) {
        update1 = setState;
      } else if (!update2) {
        update2 = setState;
      }

      return h$1( 'p', null, foo );
    });
    const container = document.createElement('div');
    mount(({foo1, foo2}) => h$1( 'div', null, h$1( Comp, { foo: foo1 }), h$1( Comp, { foo: foo2 }) ), {foo1: 'bar', foo2: 'bar2'}, container);
    t.equal(container.innerHTML, '<div><p>bar</p><p>bar2</p></div>');
    yield waitNextTick();
    update1({foo: 'bis'});
    t.equal(container.innerHTML, '<div><p>bis</p><p>bar2</p></div>');
    update2({foo: 'blah'});
    t.equal(container.innerHTML, '<div><p>bis</p><p>blah</p></div>');
  });

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Built-in value references. */
var Symbol$1 = root.Symbol;

/** Used for built-in method references. */
var objectProto$1 = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty$1 = objectProto$1.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto$1.toString;

/** Built-in value references. */
var symToStringTag$1 = Symbol$1 ? Symbol$1.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty$1.call(value, symToStringTag$1),
      tag = value[symToStringTag$1];

  try {
    value[symToStringTag$1] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag$1] = tag;
    } else {
      delete value[symToStringTag$1];
    }
  }
  return result;
}

/** Used for built-in method references. */
var objectProto$2 = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString$1 = objectProto$2.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString$1.call(value);
}

/** `Object#toString` result references. */
var nullTag = '[object Null]';
var undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var funcProto = Function.prototype;
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor &&
    funcToString.call(Ctor) == objectCtorString;
}

function symbolObservablePonyfill(root) {
	var result;
	var Symbol = root.Symbol;

	if (typeof Symbol === 'function') {
		if (Symbol.observable) {
			result = Symbol.observable;
		} else {
			result = Symbol('observable');
			Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
}

/* global window */
var root$2;

if (typeof self !== 'undefined') {
  root$2 = self;
} else if (typeof window !== 'undefined') {
  root$2 = window;
} else if (typeof global !== 'undefined') {
  root$2 = global;
} else if (typeof module !== 'undefined') {
  root$2 = module;
} else {
  root$2 = Function('return this')();
}

var result = symbolObservablePonyfill(root$2);

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var ActionTypes = {
  INIT: '@@redux/INIT'
};

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [preloadedState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} enhancer The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
function createStore(reducer, preloadedState, enhancer) {
  var _ref2;

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.');
    }

    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.');
  }

  var currentReducer = reducer;
  var currentState = preloadedState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return currentState;
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.');
    }

    var isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
    }

    if (typeof action.type === 'undefined') {
      throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant?');
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = currentListeners = nextListeners;
    for (var i = 0; i < listeners.length; i++) {
      listeners[i]();
    }

    return action;
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.');
    }

    currentReducer = nextReducer;
    dispatch({ type: ActionTypes.INIT });
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/zenparsing/es-observable
   */
  function observable() {
    var _ref;

    var outerSubscribe = subscribe;
    return _ref = {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe: function subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.');
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState());
          }
        }

        observeState();
        var unsubscribe = outerSubscribe(observeState);
        return { unsubscribe: unsubscribe };
      }
    }, _ref[result] = function () {
      return this;
    }, _ref;
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT });

  return _ref2 = {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  }, _ref2[result] = observable, _ref2;
}

/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
  /* eslint-enable no-console */
  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message);
    /* eslint-disable no-empty */
  } catch (e) {}
  /* eslint-enable no-empty */
}

/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

/*
* This is a dummy function to check if the function name has been altered by minification.
* If the function has been minified and NODE_ENV !== 'production', warn the user.
*/
function isCrushed() {}

if ("dev" !== 'production' && typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
  warning('You are currently using minified code outside of NODE_ENV === \'production\'. ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or DefinePlugin for webpack (http://stackoverflow.com/questions/30030031) ' + 'to ensure you have the correct code for your production build.');
}

var connect$1 = plan$1()
  .test('should connect a component to changes of redux state', function * (t) {
    const store = createStore((state, action) => ({value: action.value}));
    const Comp = connect(store)(props => {
      return h$1( 'span', null, props.value )
    });
    const container = document.createElement('div');
    mount(h$1( Comp, null ), {}, container);
    yield waitNextTick();
    store.dispatch({type: 'whatever', value: 'blah'});
    t.equal(container.innerHTML, '<span>blah</span>');
    store.dispatch({type: 'whatever', value: 'woot'});
    t.equal(container.innerHTML, '<span>woot</span>');
  })
  .test('should connect a component to changes of a slice of a redux state', function * (t) {
    const store = createStore((state = {woot: {value: 'foo'}, other: {valueBis: 'blah'}}, action) => {
      const {type} = action;
      switch (type) {
        case 'WOOT':
          return Object.assign({}, {woot: {value: action.value}});
        case 'NOT_WOOT':
          return Object.assign({}, {other: {valueBis: 'another_one'}});
        default:
          return state;
      }
    });
    const Comp = connect(store, state => state.woot)(props => {
      return h$1( 'span', null, props.value )
    });
    const container = document.createElement('div');
    mount(h$1( Comp, null ), {}, container);
    yield waitNextTick();
    store.dispatch({type: 'whatever', value: 'blah'});
    t.equal(container.innerHTML, '<span>foo</span>');
    store.dispatch({type: 'NOT_WOOT', value: 'blah'});
    t.equal(container.innerHTML, '<span>foo</span>');
    store.dispatch({type: 'WOOT', value: 'bip'});
    t.equal(container.innerHTML, '<span>bip</span>');
  })
  .test('should give a condition to update a connected component', function * (t) {
    const store = createStore((state, action) => ({value: action.value}));
    const Comp = connect(store)(props => {
      return h$1( 'span', null, props.value )
    }, state => state, (oldState = {value: 'a'}, newState = {}) => {
      return newState.value > oldState.value;
    });
    const container = document.createElement('div');
    mount(h$1( Comp, null ), {}, container);
    yield waitNextTick();
    store.dispatch({type: 'whatever', value: 'blah'});
    t.equal(container.innerHTML, '<span>blah</span>');
    store.dispatch({type: 'whatever', value: 'aaa'});
    t.equal(container.innerHTML, '<span>blah</span>');
    store.dispatch({type: 'whatever', value: 'zzz'});
    t.equal(container.innerHTML, '<span>zzz</span>');
  });

var index = plan$1()
  .test(util)
  .test(domUtil)
  .test(h$$1)
  .test(lifecycles)
  .test(render$1)
  .test(update$1)
  .test(withState$1)
  .test(connect$1)
  .run();

return index;

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9ub2RlX21vZHVsZXMvem9yYS9kaXN0L3pvcmEuZXMuanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi90cmF2ZXJzZS5qcyIsIi4uL3V0aWwuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vLi4vbGliL2RvbVV0aWwuanMiLCIuLi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL2guanMiLCIuLi8uLi9saWIvdHJlZS5qcyIsIi4uLy4uL2xpYi91cGRhdGUuanMiLCIuLi8uLi9saWIvbGlmZUN5Y2xlcy5qcyIsIi4uLy4uL2xpYi93aXRoU3RhdGUuanMiLCIuLi8uLi9saWIvY29ubmVjdC5qcyIsIi4uL2guanMiLCIuLi90ZXN0VXRpbC5qcyIsIi4uL2xpZmVjeWNsZXMuanMiLCIuLi9yZW5kZXIuanMiLCIuLi91cGRhdGUuanMiLCIuLi93aXRoU3RhdGUuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvbG9kYXNoLWVzL19mcmVlR2xvYmFsLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2xvZGFzaC1lcy9fcm9vdC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9sb2Rhc2gtZXMvX1N5bWJvbC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9sb2Rhc2gtZXMvX2dldFJhd1RhZy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9sb2Rhc2gtZXMvX29iamVjdFRvU3RyaW5nLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2xvZGFzaC1lcy9fYmFzZUdldFRhZy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9sb2Rhc2gtZXMvX292ZXJBcmcuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvbG9kYXNoLWVzL19nZXRQcm90b3R5cGUuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvbG9kYXNoLWVzL2lzT2JqZWN0TGlrZS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9sb2Rhc2gtZXMvaXNQbGFpbk9iamVjdC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zeW1ib2wtb2JzZXJ2YWJsZS9lcy9wb255ZmlsbC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zeW1ib2wtb2JzZXJ2YWJsZS9lcy9pbmRleC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9yZWR1eC9lcy9jcmVhdGVTdG9yZS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9yZWR1eC9lcy91dGlscy93YXJuaW5nLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3JlZHV4L2VzL2NvbXBvc2UuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvcmVkdXgvZXMvaW5kZXguanMiLCIuLi9jb25uZWN0LmpzIiwiLi4vaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBzbGljZSgpIHJlZmVyZW5jZS5cbiAqL1xuXG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbi8qKlxuICogRXhwb3NlIGBjb2AuXG4gKi9cblxudmFyIGluZGV4ID0gY29bJ2RlZmF1bHQnXSA9IGNvLmNvID0gY287XG5cbi8qKlxuICogV3JhcCB0aGUgZ2l2ZW4gZ2VuZXJhdG9yIGBmbmAgaW50byBhXG4gKiBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBwcm9taXNlLlxuICogVGhpcyBpcyBhIHNlcGFyYXRlIGZ1bmN0aW9uIHNvIHRoYXRcbiAqIGV2ZXJ5IGBjbygpYCBjYWxsIGRvZXNuJ3QgY3JlYXRlIGEgbmV3LFxuICogdW5uZWNlc3NhcnkgY2xvc3VyZS5cbiAqXG4gKiBAcGFyYW0ge0dlbmVyYXRvckZ1bmN0aW9ufSBmblxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmNvLndyYXAgPSBmdW5jdGlvbiAoZm4pIHtcbiAgY3JlYXRlUHJvbWlzZS5fX2dlbmVyYXRvckZ1bmN0aW9uX18gPSBmbjtcbiAgcmV0dXJuIGNyZWF0ZVByb21pc2U7XG4gIGZ1bmN0aW9uIGNyZWF0ZVByb21pc2UoKSB7XG4gICAgcmV0dXJuIGNvLmNhbGwodGhpcywgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKSk7XG4gIH1cbn07XG5cbi8qKlxuICogRXhlY3V0ZSB0aGUgZ2VuZXJhdG9yIGZ1bmN0aW9uIG9yIGEgZ2VuZXJhdG9yXG4gKiBhbmQgcmV0dXJuIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gY28oZ2VuKSB7XG4gIHZhciBjdHggPSB0aGlzO1xuICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAvLyB3ZSB3cmFwIGV2ZXJ5dGhpbmcgaW4gYSBwcm9taXNlIHRvIGF2b2lkIHByb21pc2UgY2hhaW5pbmcsXG4gIC8vIHdoaWNoIGxlYWRzIHRvIG1lbW9yeSBsZWFrIGVycm9ycy5cbiAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS90ai9jby9pc3N1ZXMvMTgwXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICBpZiAodHlwZW9mIGdlbiA9PT0gJ2Z1bmN0aW9uJykgZ2VuID0gZ2VuLmFwcGx5KGN0eCwgYXJncyk7XG4gICAgaWYgKCFnZW4gfHwgdHlwZW9mIGdlbi5uZXh0ICE9PSAnZnVuY3Rpb24nKSByZXR1cm4gcmVzb2x2ZShnZW4pO1xuXG4gICAgb25GdWxmaWxsZWQoKTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TWl4ZWR9IHJlc1xuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBvbkZ1bGZpbGxlZChyZXMpIHtcbiAgICAgIHZhciByZXQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXQgPSBnZW4ubmV4dChyZXMpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KGUpO1xuICAgICAgfVxuICAgICAgbmV4dChyZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGVyclxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBvblJlamVjdGVkKGVycikge1xuICAgICAgdmFyIHJldDtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldCA9IGdlbi50aHJvdyhlcnIpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KGUpO1xuICAgICAgfVxuICAgICAgbmV4dChyZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgbmV4dCB2YWx1ZSBpbiB0aGUgZ2VuZXJhdG9yLFxuICAgICAqIHJldHVybiBhIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmV0XG4gICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIG5leHQocmV0KSB7XG4gICAgICBpZiAocmV0LmRvbmUpIHJldHVybiByZXNvbHZlKHJldC52YWx1ZSk7XG4gICAgICB2YXIgdmFsdWUgPSB0b1Byb21pc2UuY2FsbChjdHgsIHJldC52YWx1ZSk7XG4gICAgICBpZiAodmFsdWUgJiYgaXNQcm9taXNlKHZhbHVlKSkgcmV0dXJuIHZhbHVlLnRoZW4ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpO1xuICAgICAgcmV0dXJuIG9uUmVqZWN0ZWQobmV3IFR5cGVFcnJvcignWW91IG1heSBvbmx5IHlpZWxkIGEgZnVuY3Rpb24sIHByb21pc2UsIGdlbmVyYXRvciwgYXJyYXksIG9yIG9iamVjdCwgJ1xuICAgICAgICArICdidXQgdGhlIGZvbGxvd2luZyBvYmplY3Qgd2FzIHBhc3NlZDogXCInICsgU3RyaW5nKHJldC52YWx1ZSkgKyAnXCInKSk7XG4gICAgfVxuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgYHlpZWxkYGVkIHZhbHVlIGludG8gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9ialxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHRvUHJvbWlzZShvYmopIHtcbiAgaWYgKCFvYmopIHJldHVybiBvYmo7XG4gIGlmIChpc1Byb21pc2Uob2JqKSkgcmV0dXJuIG9iajtcbiAgaWYgKGlzR2VuZXJhdG9yRnVuY3Rpb24ob2JqKSB8fCBpc0dlbmVyYXRvcihvYmopKSByZXR1cm4gY28uY2FsbCh0aGlzLCBvYmopO1xuICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2Ygb2JqKSByZXR1cm4gdGh1bmtUb1Byb21pc2UuY2FsbCh0aGlzLCBvYmopO1xuICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSByZXR1cm4gYXJyYXlUb1Byb21pc2UuY2FsbCh0aGlzLCBvYmopO1xuICBpZiAoaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iamVjdFRvUHJvbWlzZS5jYWxsKHRoaXMsIG9iaik7XG4gIHJldHVybiBvYmo7XG59XG5cbi8qKlxuICogQ29udmVydCBhIHRodW5rIHRvIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufVxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHRodW5rVG9Qcm9taXNlKGZuKSB7XG4gIHZhciBjdHggPSB0aGlzO1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgIGZuLmNhbGwoY3R4LCBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgIGlmIChlcnIpIHJldHVybiByZWplY3QoZXJyKTtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikgcmVzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgcmVzb2x2ZShyZXMpO1xuICAgIH0pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGFuIGFycmF5IG9mIFwieWllbGRhYmxlc1wiIHRvIGEgcHJvbWlzZS5cbiAqIFVzZXMgYFByb21pc2UuYWxsKClgIGludGVybmFsbHkuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gb2JqXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gYXJyYXlUb1Byb21pc2Uob2JqKSB7XG4gIHJldHVybiBQcm9taXNlLmFsbChvYmoubWFwKHRvUHJvbWlzZSwgdGhpcykpO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYW4gb2JqZWN0IG9mIFwieWllbGRhYmxlc1wiIHRvIGEgcHJvbWlzZS5cbiAqIFVzZXMgYFByb21pc2UuYWxsKClgIGludGVybmFsbHkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIG9iamVjdFRvUHJvbWlzZShvYmope1xuICB2YXIgcmVzdWx0cyA9IG5ldyBvYmouY29uc3RydWN0b3IoKTtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICB2YXIgcHJvbWlzZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgdmFyIHByb21pc2UgPSB0b1Byb21pc2UuY2FsbCh0aGlzLCBvYmpba2V5XSk7XG4gICAgaWYgKHByb21pc2UgJiYgaXNQcm9taXNlKHByb21pc2UpKSBkZWZlcihwcm9taXNlLCBrZXkpO1xuICAgIGVsc2UgcmVzdWx0c1trZXldID0gb2JqW2tleV07XG4gIH1cbiAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfSk7XG5cbiAgZnVuY3Rpb24gZGVmZXIocHJvbWlzZSwga2V5KSB7XG4gICAgLy8gcHJlZGVmaW5lIHRoZSBrZXkgaW4gdGhlIHJlc3VsdFxuICAgIHJlc3VsdHNba2V5XSA9IHVuZGVmaW5lZDtcbiAgICBwcm9taXNlcy5wdXNoKHByb21pc2UudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICByZXN1bHRzW2tleV0gPSByZXM7XG4gICAgfSkpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBpc1Byb21pc2Uob2JqKSB7XG4gIHJldHVybiAnZnVuY3Rpb24nID09IHR5cGVvZiBvYmoudGhlbjtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBgb2JqYCBpcyBhIGdlbmVyYXRvci5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBpc0dlbmVyYXRvcihvYmopIHtcbiAgcmV0dXJuICdmdW5jdGlvbicgPT0gdHlwZW9mIG9iai5uZXh0ICYmICdmdW5jdGlvbicgPT0gdHlwZW9mIG9iai50aHJvdztcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBgb2JqYCBpcyBhIGdlbmVyYXRvciBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gaXNHZW5lcmF0b3JGdW5jdGlvbihvYmopIHtcbiAgdmFyIGNvbnN0cnVjdG9yID0gb2JqLmNvbnN0cnVjdG9yO1xuICBpZiAoIWNvbnN0cnVjdG9yKSByZXR1cm4gZmFsc2U7XG4gIGlmICgnR2VuZXJhdG9yRnVuY3Rpb24nID09PSBjb25zdHJ1Y3Rvci5uYW1lIHx8ICdHZW5lcmF0b3JGdW5jdGlvbicgPT09IGNvbnN0cnVjdG9yLmRpc3BsYXlOYW1lKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGlzR2VuZXJhdG9yKGNvbnN0cnVjdG9yLnByb3RvdHlwZSk7XG59XG5cbi8qKlxuICogQ2hlY2sgZm9yIHBsYWluIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBpc09iamVjdCh2YWwpIHtcbiAgcmV0dXJuIE9iamVjdCA9PSB2YWwuY29uc3RydWN0b3I7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZuLCBtb2R1bGUpIHtcblx0cmV0dXJuIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfSwgZm4obW9kdWxlLCBtb2R1bGUuZXhwb3J0cyksIG1vZHVsZS5leHBvcnRzO1xufVxuXG52YXIga2V5cyA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHR5cGVvZiBPYmplY3Qua2V5cyA9PT0gJ2Z1bmN0aW9uJ1xuICA/IE9iamVjdC5rZXlzIDogc2hpbTtcblxuZXhwb3J0cy5zaGltID0gc2hpbTtcbmZ1bmN0aW9uIHNoaW0gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgcmV0dXJuIGtleXM7XG59XG59KTtcblxudmFyIGlzX2FyZ3VtZW50cyA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcbnZhciBzdXBwb3J0c0FyZ3VtZW50c0NsYXNzID0gKGZ1bmN0aW9uKCl7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJndW1lbnRzKVxufSkoKSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gc3VwcG9ydHNBcmd1bWVudHNDbGFzcyA/IHN1cHBvcnRlZCA6IHVuc3VwcG9ydGVkO1xuXG5leHBvcnRzLnN1cHBvcnRlZCA9IHN1cHBvcnRlZDtcbmZ1bmN0aW9uIHN1cHBvcnRlZChvYmplY3QpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmplY3QpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xufVxuXG5leHBvcnRzLnVuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5mdW5jdGlvbiB1bnN1cHBvcnRlZChvYmplY3Qpe1xuICByZXR1cm4gb2JqZWN0ICYmXG4gICAgdHlwZW9mIG9iamVjdCA9PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvYmplY3QubGVuZ3RoID09ICdudW1iZXInICYmXG4gICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgJ2NhbGxlZScpICYmXG4gICAgIU9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChvYmplY3QsICdjYWxsZWUnKSB8fFxuICAgIGZhbHNlO1xufVxufSk7XG5cbnZhciBpbmRleCQxID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSkge1xudmFyIHBTbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBvYmplY3RLZXlzID0ga2V5cztcbnZhciBpc0FyZ3VtZW50cyA9IGlzX2FyZ3VtZW50cztcblxudmFyIGRlZXBFcXVhbCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpIHtcbiAgaWYgKCFvcHRzKSBvcHRzID0ge307XG4gIC8vIDcuMS4gQWxsIGlkZW50aWNhbCB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGFzIGRldGVybWluZWQgYnkgPT09LlxuICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIH0gZWxzZSBpZiAoYWN0dWFsIGluc3RhbmNlb2YgRGF0ZSAmJiBleHBlY3RlZCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gYWN0dWFsLmdldFRpbWUoKSA9PT0gZXhwZWN0ZWQuZ2V0VGltZSgpO1xuXG4gIC8vIDcuMy4gT3RoZXIgcGFpcnMgdGhhdCBkbyBub3QgYm90aCBwYXNzIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyxcbiAgLy8gZXF1aXZhbGVuY2UgaXMgZGV0ZXJtaW5lZCBieSA9PS5cbiAgfSBlbHNlIGlmICghYWN0dWFsIHx8ICFleHBlY3RlZCB8fCB0eXBlb2YgYWN0dWFsICE9ICdvYmplY3QnICYmIHR5cGVvZiBleHBlY3RlZCAhPSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBvcHRzLnN0cmljdCA/IGFjdHVhbCA9PT0gZXhwZWN0ZWQgOiBhY3R1YWwgPT0gZXhwZWN0ZWQ7XG5cbiAgLy8gNy40LiBGb3IgYWxsIG90aGVyIE9iamVjdCBwYWlycywgaW5jbHVkaW5nIEFycmF5IG9iamVjdHMsIGVxdWl2YWxlbmNlIGlzXG4gIC8vIGRldGVybWluZWQgYnkgaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChhcyB2ZXJpZmllZFxuICAvLyB3aXRoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCksIHRoZSBzYW1lIHNldCBvZiBrZXlzXG4gIC8vIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLCBlcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnlcbiAgLy8gY29ycmVzcG9uZGluZyBrZXksIGFuZCBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuIE5vdGU6IHRoaXNcbiAgLy8gYWNjb3VudHMgZm9yIGJvdGggbmFtZWQgYW5kIGluZGV4ZWQgcHJvcGVydGllcyBvbiBBcnJheXMuXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iakVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZE9yTnVsbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaXNCdWZmZXIgKHgpIHtcbiAgaWYgKCF4IHx8IHR5cGVvZiB4ICE9PSAnb2JqZWN0JyB8fCB0eXBlb2YgeC5sZW5ndGggIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgeC5jb3B5ICE9PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiB4LnNsaWNlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh4Lmxlbmd0aCA+IDAgJiYgdHlwZW9mIHhbMF0gIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBvYmpFcXVpdihhLCBiLCBvcHRzKSB7XG4gIHZhciBpLCBrZXk7XG4gIGlmIChpc1VuZGVmaW5lZE9yTnVsbChhKSB8fCBpc1VuZGVmaW5lZE9yTnVsbChiKSlcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS5cbiAgaWYgKGEucHJvdG90eXBlICE9PSBiLnByb3RvdHlwZSkgcmV0dXJuIGZhbHNlO1xuICAvL35+fkkndmUgbWFuYWdlZCB0byBicmVhayBPYmplY3Qua2V5cyB0aHJvdWdoIHNjcmV3eSBhcmd1bWVudHMgcGFzc2luZy5cbiAgLy8gICBDb252ZXJ0aW5nIHRvIGFycmF5IHNvbHZlcyB0aGUgcHJvYmxlbS5cbiAgaWYgKGlzQXJndW1lbnRzKGEpKSB7XG4gICAgaWYgKCFpc0FyZ3VtZW50cyhiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhID0gcFNsaWNlLmNhbGwoYSk7XG4gICAgYiA9IHBTbGljZS5jYWxsKGIpO1xuICAgIHJldHVybiBkZWVwRXF1YWwoYSwgYiwgb3B0cyk7XG4gIH1cbiAgaWYgKGlzQnVmZmVyKGEpKSB7XG4gICAgaWYgKCFpc0J1ZmZlcihiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgZm9yIChpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHRyeSB7XG4gICAgdmFyIGthID0gb2JqZWN0S2V5cyhhKSxcbiAgICAgICAga2IgPSBvYmplY3RLZXlzKGIpO1xuICB9IGNhdGNoIChlKSB7Ly9oYXBwZW5zIHdoZW4gb25lIGlzIGEgc3RyaW5nIGxpdGVyYWwgYW5kIHRoZSBvdGhlciBpc24ndFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvLyBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGtleXMgaW5jb3Jwb3JhdGVzXG4gIC8vIGhhc093blByb3BlcnR5KVxuICBpZiAoa2EubGVuZ3RoICE9IGtiLmxlbmd0aClcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vdGhlIHNhbWUgc2V0IG9mIGtleXMgKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksXG4gIGthLnNvcnQoKTtcbiAga2Iuc29ydCgpO1xuICAvL35+fmNoZWFwIGtleSB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGthW2ldICE9IGtiW2ldKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5IGNvcnJlc3BvbmRpbmcga2V5LCBhbmRcbiAgLy9+fn5wb3NzaWJseSBleHBlbnNpdmUgZGVlcCB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAga2V5ID0ga2FbaV07XG4gICAgaWYgKCFkZWVwRXF1YWwoYVtrZXldLCBiW2tleV0sIG9wdHMpKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiBhID09PSB0eXBlb2YgYjtcbn1cbn0pO1xuXG5jb25zdCBhc3NlcnRpb25zID0ge1xuICBvayh2YWwsIG1lc3NhZ2UgPSAnc2hvdWxkIGJlIHRydXRoeScpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBCb29sZWFuKHZhbCksXG4gICAgICBleHBlY3RlZDogJ3RydXRoeScsXG4gICAgICBhY3R1YWw6IHZhbCxcbiAgICAgIG9wZXJhdG9yOiAnb2snLFxuICAgICAgbWVzc2FnZVxuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIGRlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlID0gJ3Nob3VsZCBiZSBlcXVpdmFsZW50Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGluZGV4JDEoYWN0dWFsLCBleHBlY3RlZCksXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcjogJ2RlZXBFcXVhbCdcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBlcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlID0gJ3Nob3VsZCBiZSBlcXVhbCcpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBhY3R1YWwgPT09IGV4cGVjdGVkLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdlcXVhbCdcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBub3RPayh2YWwsIG1lc3NhZ2UgPSAnc2hvdWxkIG5vdCBiZSB0cnV0aHknKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogIUJvb2xlYW4odmFsKSxcbiAgICAgIGV4cGVjdGVkOiAnZmFsc3knLFxuICAgICAgYWN0dWFsOiB2YWwsXG4gICAgICBvcGVyYXRvcjogJ25vdE9rJyxcbiAgICAgIG1lc3NhZ2VcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBub3REZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgbm90IGJlIGVxdWl2YWxlbnQnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogIWluZGV4JDEoYWN0dWFsLCBleHBlY3RlZCksXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcjogJ25vdERlZXBFcXVhbCdcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBub3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlID0gJ3Nob3VsZCBub3QgYmUgZXF1YWwnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogYWN0dWFsICE9PSBleHBlY3RlZCxcbiAgICAgIGFjdHVhbCxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIG9wZXJhdG9yOiAnbm90RXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgdGhyb3dzKGZ1bmMsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gICAgbGV0IGNhdWdodCwgcGFzcywgYWN0dWFsO1xuICAgIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBbZXhwZWN0ZWQsIG1lc3NhZ2VdID0gW21lc3NhZ2UsIGV4cGVjdGVkXTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGZ1bmMoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY2F1Z2h0ID0ge2Vycm9yfTtcbiAgICB9XG4gICAgcGFzcyA9IGNhdWdodCAhPT0gdW5kZWZpbmVkO1xuICAgIGFjdHVhbCA9IGNhdWdodCAmJiBjYXVnaHQuZXJyb3I7XG4gICAgaWYgKGV4cGVjdGVkIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICBwYXNzID0gZXhwZWN0ZWQudGVzdChhY3R1YWwpIHx8IGV4cGVjdGVkLnRlc3QoYWN0dWFsICYmIGFjdHVhbC5tZXNzYWdlKTtcbiAgICAgIGV4cGVjdGVkID0gU3RyaW5nKGV4cGVjdGVkKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ2Z1bmN0aW9uJyAmJiBjYXVnaHQpIHtcbiAgICAgIHBhc3MgPSBhY3R1YWwgaW5zdGFuY2VvZiBleHBlY3RlZDtcbiAgICAgIGFjdHVhbCA9IGFjdHVhbC5jb25zdHJ1Y3RvcjtcbiAgICB9XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzcyxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgYWN0dWFsLFxuICAgICAgb3BlcmF0b3I6ICd0aHJvd3MnLFxuICAgICAgbWVzc2FnZTogbWVzc2FnZSB8fCAnc2hvdWxkIHRocm93J1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIGRvZXNOb3RUaHJvdyhmdW5jLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICAgIGxldCBjYXVnaHQ7XG4gICAgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIFtleHBlY3RlZCwgbWVzc2FnZV0gPSBbbWVzc2FnZSwgZXhwZWN0ZWRdO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgZnVuYygpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYXVnaHQgPSB7ZXJyb3J9O1xuICAgIH1cbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBjYXVnaHQgPT09IHVuZGVmaW5lZCxcbiAgICAgIGV4cGVjdGVkOiAnbm8gdGhyb3duIGVycm9yJyxcbiAgICAgIGFjdHVhbDogY2F1Z2h0ICYmIGNhdWdodC5lcnJvcixcbiAgICAgIG9wZXJhdG9yOiAnZG9lc05vdFRocm93JyxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UgfHwgJ3Nob3VsZCBub3QgdGhyb3cnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgZmFpbChyZWFzb24gPSAnZmFpbCBjYWxsZWQnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogZmFsc2UsXG4gICAgICBhY3R1YWw6ICdmYWlsIGNhbGxlZCcsXG4gICAgICBleHBlY3RlZDogJ2ZhaWwgbm90IGNhbGxlZCcsXG4gICAgICBtZXNzYWdlOiByZWFzb24sXG4gICAgICBvcGVyYXRvcjogJ2ZhaWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfVxufTtcblxuZnVuY3Rpb24gYXNzZXJ0aW9uICh0ZXN0KSB7XG4gIHJldHVybiBPYmplY3QuY3JlYXRlKGFzc2VydGlvbnMsIHt0ZXN0OiB7dmFsdWU6IHRlc3R9fSk7XG59XG5cbmNvbnN0IFRlc3QgPSB7XG4gIHJ1bjogZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IGFzc2VydCA9IGFzc2VydGlvbih0aGlzKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIHJldHVybiBpbmRleCh0aGlzLmNvcm91dGluZShhc3NlcnQpKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4ge2Fzc2VydGlvbnM6IHRoaXMuYXNzZXJ0aW9ucywgZXhlY3V0aW9uVGltZTogRGF0ZS5ub3coKSAtIG5vd307XG4gICAgICB9KTtcbiAgfSxcbiAgYWRkQXNzZXJ0aW9uKCl7XG4gICAgY29uc3QgbmV3QXNzZXJ0aW9ucyA9IFsuLi5hcmd1bWVudHNdLm1hcChhID0+IE9iamVjdC5hc3NpZ24oe2Rlc2NyaXB0aW9uOiB0aGlzLmRlc2NyaXB0aW9ufSwgYSkpO1xuICAgIHRoaXMuYXNzZXJ0aW9ucy5wdXNoKC4uLm5ld0Fzc2VydGlvbnMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG59O1xuXG5mdW5jdGlvbiB0ZXN0ICh7ZGVzY3JpcHRpb24sIGNvcm91dGluZSwgb25seSA9IGZhbHNlfSkge1xuICByZXR1cm4gT2JqZWN0LmNyZWF0ZShUZXN0LCB7XG4gICAgZGVzY3JpcHRpb246IHt2YWx1ZTogZGVzY3JpcHRpb259LFxuICAgIGNvcm91dGluZToge3ZhbHVlOiBjb3JvdXRpbmV9LFxuICAgIGFzc2VydGlvbnM6IHt2YWx1ZTogW119LFxuICAgIG9ubHk6IHt2YWx1ZTogb25seX0sXG4gICAgbGVuZ3RoOiB7XG4gICAgICBnZXQoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXNzZXJ0aW9ucy5sZW5ndGhcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiB0YXBPdXQgKHtwYXNzLCBtZXNzYWdlLCBpbmRleH0pIHtcbiAgY29uc3Qgc3RhdHVzID0gcGFzcyA9PT0gdHJ1ZSA/ICdvaycgOiAnbm90IG9rJztcbiAgY29uc29sZS5sb2coW3N0YXR1cywgaW5kZXgsIG1lc3NhZ2VdLmpvaW4oJyAnKSk7XG59XG5cbmZ1bmN0aW9uIGNhbkV4aXQgKCkge1xuICByZXR1cm4gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBwcm9jZXNzLmV4aXQgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIHRhcCAoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAqICgpIHtcbiAgICBsZXQgaW5kZXggPSAxO1xuICAgIGxldCBsYXN0SWQgPSAwO1xuICAgIGxldCBzdWNjZXNzID0gMDtcbiAgICBsZXQgZmFpbHVyZSA9IDA7XG5cbiAgICBjb25zdCBzdGFyVGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc29sZS5sb2coJ1RBUCB2ZXJzaW9uIDEzJyk7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2VydGlvbiA9IHlpZWxkO1xuICAgICAgICBpZiAoYXNzZXJ0aW9uLnBhc3MgPT09IHRydWUpIHtcbiAgICAgICAgICBzdWNjZXNzKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmFpbHVyZSsrO1xuICAgICAgICB9XG4gICAgICAgIGFzc2VydGlvbi5pbmRleCA9IGluZGV4O1xuICAgICAgICBpZiAoYXNzZXJ0aW9uLmlkICE9PSBsYXN0SWQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgIyAke2Fzc2VydGlvbi5kZXNjcmlwdGlvbn0gLSAke2Fzc2VydGlvbi5leGVjdXRpb25UaW1lfW1zYCk7XG4gICAgICAgICAgbGFzdElkID0gYXNzZXJ0aW9uLmlkO1xuICAgICAgICB9XG4gICAgICAgIHRhcE91dChhc3NlcnRpb24pO1xuICAgICAgICBpZiAoYXNzZXJ0aW9uLnBhc3MgIT09IHRydWUpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgICAtLS1cbiAgb3BlcmF0b3I6ICR7YXNzZXJ0aW9uLm9wZXJhdG9yfVxuICBleHBlY3RlZDogJHtKU09OLnN0cmluZ2lmeShhc3NlcnRpb24uZXhwZWN0ZWQpfVxuICBhY3R1YWw6ICR7SlNPTi5zdHJpbmdpZnkoYXNzZXJ0aW9uLmFjdHVhbCl9XG4gIC4uLmApO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5sb2coJ0JhaWwgb3V0ISB1bmhhbmRsZWQgZXhjZXB0aW9uJyk7XG4gICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgIGlmIChjYW5FeGl0KCkpIHtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgfVxuICAgIH1cbiAgICBmaW5hbGx5IHtcbiAgICAgIGNvbnN0IGV4ZWN1dGlvbiA9IERhdGUubm93KCkgLSBzdGFyVGltZTtcbiAgICAgIGlmIChpbmRleCA+IDEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFxuMS4uJHtpbmRleCAtIDF9XG4jIGR1cmF0aW9uICR7ZXhlY3V0aW9ufW1zXG4jIHN1Y2Nlc3MgJHtzdWNjZXNzfVxuIyBmYWlsdXJlICR7ZmFpbHVyZX1gKTtcbiAgICAgIH1cbiAgICAgIGlmIChmYWlsdXJlICYmIGNhbkV4aXQoKSkge1xuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5jb25zdCBQbGFuID0ge1xuICB0ZXN0KGRlc2NyaXB0aW9uLCBjb3JvdXRpbmUsIG9wdHMgPSB7fSl7XG4gICAgY29uc3QgdGVzdEl0ZW1zID0gKCFjb3JvdXRpbmUgJiYgZGVzY3JpcHRpb24udGVzdHMpID8gWy4uLmRlc2NyaXB0aW9uXSA6IFt7ZGVzY3JpcHRpb24sIGNvcm91dGluZX1dO1xuICAgIHRoaXMudGVzdHMucHVzaCguLi50ZXN0SXRlbXMubWFwKHQ9PnRlc3QoT2JqZWN0LmFzc2lnbih0LCBvcHRzKSkpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBvbmx5KGRlc2NyaXB0aW9uLCBjb3JvdXRpbmUpe1xuICAgIHJldHVybiB0aGlzLnRlc3QoZGVzY3JpcHRpb24sIGNvcm91dGluZSwge29ubHk6IHRydWV9KTtcbiAgfSxcblxuICBydW4oc2luayA9IHRhcCgpKXtcbiAgICBjb25zdCBzaW5rSXRlcmF0b3IgPSBzaW5rKCk7XG4gICAgc2lua0l0ZXJhdG9yLm5leHQoKTtcbiAgICBjb25zdCBoYXNPbmx5ID0gdGhpcy50ZXN0cy5zb21lKHQ9PnQub25seSk7XG4gICAgY29uc3QgcnVubmFibGUgPSBoYXNPbmx5ID8gdGhpcy50ZXN0cy5maWx0ZXIodD0+dC5vbmx5KSA6IHRoaXMudGVzdHM7XG4gICAgcmV0dXJuIGluZGV4KGZ1bmN0aW9uICogKCkge1xuICAgICAgbGV0IGlkID0gMTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBydW5uYWJsZS5tYXAodD0+dC5ydW4oKSk7XG4gICAgICAgIGZvciAobGV0IHIgb2YgcmVzdWx0cykge1xuICAgICAgICAgIGNvbnN0IHthc3NlcnRpb25zLCBleGVjdXRpb25UaW1lfSA9IHlpZWxkIHI7XG4gICAgICAgICAgZm9yIChsZXQgYXNzZXJ0IG9mIGFzc2VydGlvbnMpIHtcbiAgICAgICAgICAgIHNpbmtJdGVyYXRvci5uZXh0KE9iamVjdC5hc3NpZ24oYXNzZXJ0LCB7aWQsIGV4ZWN1dGlvblRpbWV9KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlkKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgIHNpbmtJdGVyYXRvci50aHJvdyhlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNpbmtJdGVyYXRvci5yZXR1cm4oKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpXG4gIH0sXG5cbiAgKiBbU3ltYm9sLml0ZXJhdG9yXSgpe1xuICAgIGZvciAobGV0IHQgb2YgdGhpcy50ZXN0cykge1xuICAgICAgeWllbGQgdDtcbiAgICB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHBsYW4gKCkge1xuICByZXR1cm4gT2JqZWN0LmNyZWF0ZShQbGFuLCB7XG4gICAgdGVzdHM6IHt2YWx1ZTogW119LFxuICAgIGxlbmd0aDoge1xuICAgICAgZ2V0KCl7XG4gICAgICAgIHJldHVybiB0aGlzLnRlc3RzLmxlbmd0aFxuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHBsYW47XG4iLCJleHBvcnQgY29uc3QgbmV4dFRpY2sgPSBmbiA9PiBzZXRUaW1lb3V0KGZuLCAwKTtcblxuZXhwb3J0IGNvbnN0IHBhaXJpZnkgPSBob2xkZXIgPT4ga2V5ID0+IFtrZXksIGhvbGRlcltrZXldXTtcblxuZXhwb3J0IGNvbnN0IGlzU2hhbGxvd0VxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgYUtleXMgPSBPYmplY3Qua2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBPYmplY3Qua2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KChrKSA9PiBhW2tdID09PSBiW2tdKTtcbn07XG5cbmNvbnN0IG93bktleXMgPSBvYmogPT4gT2JqZWN0LmtleXMob2JqKS5maWx0ZXIoayA9PiBvYmouaGFzT3duUHJvcGVydHkoaykpO1xuXG5leHBvcnQgY29uc3QgaXNEZWVwRXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCB0eXBlID0gdHlwZW9mIGE7XG5cbiAgLy9zaG9ydCBwYXRoKHMpXG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gdHlwZW9mIGIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gYSA9PT0gYjtcbiAgfVxuXG4gIC8vIG9iamVjdHMgLi4uXG4gIGlmIChhID09PSBudWxsIHx8IGIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xuICAgIHJldHVybiBhLmxlbmd0aCAmJiBiLmxlbmd0aCAmJiBhLmV2ZXJ5KChpdGVtLCBpKSA9PiBpc0RlZXBFcXVhbChhW2ldLCBiW2ldKSk7XG4gIH1cblxuICBjb25zdCBhS2V5cyA9IG93bktleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gb3duS2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KGsgPT4gaXNEZWVwRXF1YWwoYVtrXSwgYltrXSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGlkZW50aXR5ID0gYSA9PiBhO1xuXG5leHBvcnQgY29uc3Qgbm9vcCA9IF8gPT4ge1xufTtcbiIsImV4cG9ydCBjb25zdCB0cmF2ZXJzZSA9IGZ1bmN0aW9uICogKHZub2RlKSB7XG4gIHlpZWxkIHZub2RlO1xuICBpZiAodm5vZGUuY2hpbGRyZW4gJiYgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2Ygdm5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIHlpZWxkICogdHJhdmVyc2UoY2hpbGQpO1xuICAgIH1cbiAgfVxufTsiLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7aXNTaGFsbG93RXF1YWwsIHBhaXJpZnl9IGZyb20gJy4uL2xpYi91dGlsJztcbmltcG9ydCB7dHJhdmVyc2V9IGZyb20gJy4uL2xpYi90cmF2ZXJzZSc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnc2hvdWxkIHRyYXZlcnNlIGEgdHJlZSAoZ29pbmcgZGVlcCBmaXJzdCknLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgdHJlZSA9IHtcbiAgICAgIGlkOiAxLFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAge2lkOiAyLCBjaGlsZHJlbjogW3tpZDogM30sIHtpZDogNH1dfSxcbiAgICAgICAge2lkOiA1LCBjaGlsZHJlbjogW3tpZDogNn1dfSxcbiAgICAgICAge2lkOiA3fVxuICAgICAgXVxuICAgIH07XG5cbiAgICBjb25zdCBzZXF1ZW5jZSA9IFsuLi50cmF2ZXJzZSh0cmVlKV0ubWFwKG4gPT4gbi5pZCk7XG4gICAgdC5kZWVwRXF1YWwoc2VxdWVuY2UsIFsxLCAyLCAzLCA0LCA1LCA2LCA3XSk7XG4gIH0pXG4gIC50ZXN0KCdwYWlyIGtleSB0byB2YWx1ZSBvYmplY3Qgb2YgYW4gb2JqZWN0IChha2EgT2JqZWN0LmVudHJpZXMpJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGhvbGRlciA9IHthOiAxLCBiOiAyLCBjOiAzLCBkOiA0fTtcbiAgICBjb25zdCBmID0gcGFpcmlmeShob2xkZXIpO1xuICAgIGNvbnN0IGRhdGEgPSBPYmplY3Qua2V5cyhob2xkZXIpLm1hcChmKTtcbiAgICB0LmRlZXBFcXVhbChkYXRhLCBbWydhJywgMV0sIFsnYicsIDJdLCBbJ2MnLCAzXSwgWydkJywgNF1dKTtcbiAgfSlcbiAgLnRlc3QoJ3NoYWxsb3cgZXF1YWxpdHkgdGVzdCBvbiBvYmplY3QnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgbmVzdGVkID0ge2ZvbzogJ2Jhcid9O1xuICAgIGNvbnN0IG9iajEgPSB7YTogMSwgYjogJzInLCBjOiB0cnVlLCBkOiBuZXN0ZWR9O1xuICAgIHQub2soaXNTaGFsbG93RXF1YWwob2JqMSwge2E6IDEsIGI6ICcyJywgYzogdHJ1ZSwgZDogbmVzdGVkfSkpO1xuICAgIHQubm90T2soaXNTaGFsbG93RXF1YWwob2JqMSwge1xuICAgICAgYTogMSxcbiAgICAgIGI6ICcyJyxcbiAgICAgIGM6IHRydWUsXG4gICAgICBkOiB7Zm9vOiAnYmFyJ31cbiAgICB9KSwgJ25lc3RlZCBvYmplY3Qgc2hvdWxkIGJlIGNoZWNrZWQgYnkgcmVmZXJlbmNlJyk7XG4gICAgdC5ub3RPayhpc1NoYWxsb3dFcXVhbChvYmoxLCB7YTogMSwgYjogMiwgYzogdHJ1ZSwgZDogbmVzdGVkfSksICdleGFjdCB0eXBlIGNoZWNraW5nIG9uIHByaW1pdGl2ZScpO1xuICAgIHQubm90T2soaXNTaGFsbG93RXF1YWwob2JqMSwge2E6IDEsIGM6IHRydWUsIGQ6IG5lc3RlZH0pLCAncmV0dXJuIGZhbHNlIG9uIG1pc3NpbmcgcHJvcGVydGllcycpO1xuICAgIHQubm90T2soaXNTaGFsbG93RXF1YWwoe2E6IDEsIGM6IHRydWUsIGQ6IG5lc3RlZH0sIG9iajEpLCAncmV0dXJuIGZhbHNlIG9uIG1pc3NpbmcgcHJvcGVydGllcyAoY29tbW11dGF0aXZlJyk7XG4gIH0pO1xuIiwiZXhwb3J0IGZ1bmN0aW9uIHN3YXAgKGYpIHtcbiAgcmV0dXJuIChhLCBiKSA9PiBmKGIsIGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZSAoZmlyc3QsIC4uLmZucykge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycnkgKGZuLCBhcml0eUxlZnQpIHtcbiAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseSAoZm4pIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcCAoZm4pIHtcbiAgcmV0dXJuIGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xuICB9XG59IiwiaW1wb3J0IHt0YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IFNWR19OUCA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc7XG5cbmNvbnN0IHVwZGF0ZURvbU5vZGVGYWN0b3J5ID0gKG1ldGhvZCkgPT4gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IHBhaXIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlW21ldGhvZF0oLi4ucGFpcik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgncmVtb3ZlRXZlbnRMaXN0ZW5lcicpO1xuXG5leHBvcnQgY29uc3QgYWRkRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgnYWRkRXZlbnRMaXN0ZW5lcicpO1xuXG5leHBvcnQgY29uc3Qgc2V0QXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKChkb21Ob2RlKSA9PiB7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBpdGVtcy5maWx0ZXIoKFtrZXksIHZhbHVlXSkgPT4gdHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nKTtcbiAgZm9yIChsZXQgW2tleSwgdmFsdWVdIG9mIGF0dHJpYnV0ZXMpIHtcbiAgICB2YWx1ZSA9PT0gZmFsc2UgPyBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShrZXkpIDogZG9tTm9kZS5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZSk7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlQXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBhdHRyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3Qgc2V0VGV4dE5vZGUgPSB2YWwgPT4gbm9kZSA9PiBub2RlLnRleHRDb250ZW50ID0gdmFsO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlRG9tTm9kZSA9ICh2bm9kZSwgcGFyZW50KSA9PiB7XG4gIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ3N2ZycpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OUCwgdm5vZGUubm9kZVR5cGUpO1xuICB9IGVsc2UgaWYgKHZub2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodm5vZGUubm9kZVR5cGUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwYXJlbnQubmFtZXNwYWNlVVJJID09PSBTVkdfTlAgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05QLCB2bm9kZS5ub2RlVHlwZSkgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHZub2RlLm5vZGVUeXBlKTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGdldEV2ZW50TGlzdGVuZXJzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcylcbiAgICAuZmlsdGVyKGsgPT4gay5zdWJzdHIoMCwgMikgPT09ICdvbicpXG4gICAgLm1hcChrID0+IFtrLnN1YnN0cigyKS50b0xvd2VyQ2FzZSgpLCBwcm9wc1trXV0pO1xufTtcbiIsImltcG9ydCB7XG4gIHNldEF0dHJpYnV0ZXMsXG4gIHJlbW92ZUF0dHJpYnV0ZXMsXG4gIGFkZEV2ZW50TGlzdGVuZXJzLFxuICByZW1vdmVFdmVudExpc3RlbmVycyxcbiAgc2V0VGV4dE5vZGUsXG4gIGdldEV2ZW50TGlzdGVuZXJzLFxuICBjcmVhdGVEb21Ob2RlXG59IGZyb20gJy4uL2xpYi9kb21VdGlsJztcbmltcG9ydCB7bm9vcH0gZnJvbSAnLi4vbGliL3V0aWwnO1xuaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5cbmNvbnN0IGRvbVByb3RvID0ge1xuXG4gIHJlbW92ZUF0dHJpYnV0ZShhdHRyKXtcbiAgICBkZWxldGUgdGhpc1thdHRyXTtcbiAgfSxcblxuICBzZXRBdHRyaWJ1dGUoYXR0ciwgdmFsKXtcbiAgICB0aGlzW2F0dHJdID0gdmFsO1xuICB9LFxuXG4gIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIpe1xuICAgIHRoaXMuaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcjtcbiAgfSxcblxuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyKXtcbiAgICBkZWxldGUgdGhpcy5oYW5kbGVyc1tldmVudF07XG4gIH1cbn07XG5cbmNvbnN0IGZha2VEb20gPSAoKSA9PiB7XG4gIGNvbnN0IGRvbSA9IE9iamVjdC5jcmVhdGUoZG9tUHJvdG8pO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZG9tLCAnaGFuZGxlcnMnLCB7dmFsdWU6IHt9fSk7XG4gIHJldHVybiBkb207XG59O1xuXG5jb25zdCBvd25Qcm9wcyA9IChvYmopID0+IHtcbiAgY29uc3Qgb3duUHJvcGVydGllcyA9IFtdO1xuICBmb3IgKGxldCBwcm9wIGluIG9iaikge1xuICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIG93blByb3BlcnRpZXMucHVzaChwcm9wKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG93blByb3BlcnRpZXM7XG59O1xuXG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnc2V0IGF0dHJpYnV0ZXMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZCA9IGZha2VEb20oKTtcbiAgICBjb25zdCB1cGRhdGUgPSBzZXRBdHRyaWJ1dGVzKFtbJ2ZvbycsICdiYXInXSwgWydibGFoJywgMl0sIFsnd29vdCcsIHRydWVdXSk7XG4gICAgY29uc3QgbiA9IHVwZGF0ZShkKTtcbiAgICB0LmVxdWFsKG4sIGQsICdzaG91bGQgaGF2ZSBmb3J3YXJkZWQgZG9tIG5vZGUnKTtcbiAgICB0LmVxdWFsKGQuZm9vLCAnYmFyJyk7XG4gICAgdC5lcXVhbChkLmJsYWgsIDIpO1xuICAgIHQuZXF1YWwoZC53b290LCB0cnVlKTtcbiAgICBjb25zdCBwcm9wcyA9IG93blByb3BzKGQpO1xuICAgIHQuZGVlcEVxdWFsKHByb3BzLCBbJ2ZvbycsICdibGFoJywgJ3dvb3QnXSk7XG4gICAgY29uc3QgaGFuZGxlcnMgPSBvd25Qcm9wcyhkLmhhbmRsZXJzKTtcbiAgICB0LmVxdWFsKGhhbmRsZXJzLmxlbmd0aCwgMCk7XG4gIH0pXG4gIC50ZXN0KCdyZW1vdmUgYXR0cmlidXRlIGlmIHZhbHVlIGlzIGZhbHNlJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGQgPSBmYWtlRG9tKCk7XG4gICAgZC5mb28gPSAnYmFyJztcbiAgICB0LmRlZXBFcXVhbChvd25Qcm9wcyhkKSwgWydmb28nXSk7XG4gICAgY29uc3QgdXBkYXRlID0gc2V0QXR0cmlidXRlcyhbWydmb28nLCBmYWxzZV1dKTtcbiAgICBjb25zdCBuID0gdXBkYXRlKGQpO1xuICAgIHQuZXF1YWwobiwgZCwgJ3Nob3VsZCBoYXZlIGZvcndhcmRlZCBkb20gbm9kZScpO1xuICAgIHQuZXF1YWwoZC5mb28sIHVuZGVmaW5lZCk7XG4gICAgdC5lcXVhbChvd25Qcm9wcyhkKS5sZW5ndGgsIDApO1xuICAgIGNvbnN0IGhhbmRsZXJzID0gb3duUHJvcHMoZC5oYW5kbGVycyk7XG4gICAgdC5lcXVhbChoYW5kbGVycy5sZW5ndGgsIDApO1xuICB9KVxuICAudGVzdCgncmVtb3ZlIGF0dHJpYnV0ZXMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZCA9IGZha2VEb20oKTtcbiAgICBkLmZvbyA9ICdiYXInO1xuICAgIGQud29vdCA9IDI7XG4gICAgZC5iYXIgPSAnYmxhaCc7XG4gICAgdC5kZWVwRXF1YWwob3duUHJvcHMoZCksIFsnZm9vJywgJ3dvb3QnLCAnYmFyJ10pO1xuICAgIGNvbnN0IHVwZGF0ZSA9IHJlbW92ZUF0dHJpYnV0ZXMoWydmb28nLCAnd29vdCddKTtcbiAgICBjb25zdCBuID0gdXBkYXRlKGQpO1xuICAgIHQuZXF1YWwobiwgZCwgJ3Nob3VsZCBoYXZlIGZvcndhcmRlZCBkb20gbm9kZScpO1xuICAgIHQuZXF1YWwoZC5iYXIsICdibGFoJyk7XG4gICAgdC5lcXVhbChvd25Qcm9wcyhkKS5sZW5ndGgsIDEpO1xuICAgIGNvbnN0IGhhbmRsZXJzID0gb3duUHJvcHMoZC5oYW5kbGVycyk7XG4gICAgdC5lcXVhbChoYW5kbGVycy5sZW5ndGgsIDApO1xuICB9KVxuICAudGVzdCgnYWRkIGV2ZW50IGxpc3RlbmVycycsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBkID0gZmFrZURvbSgpO1xuICAgIGNvbnN0IHVwZGF0ZSA9IGFkZEV2ZW50TGlzdGVuZXJzKFtbJ2NsaWNrJywgbm9vcFxuICAgIF0sIFsnaW5wdXQnLCBub29wXV0pO1xuICAgIGNvbnN0IG4gPSB1cGRhdGUoZCk7XG4gICAgdC5lcXVhbChuLCBkLCAnc2hvdWxkIGhhdmUgZm9yd2FyZGVkIHRoZSBub2RlJyk7XG4gICAgdC5lcXVhbChvd25Qcm9wcyhkKS5sZW5ndGgsIDApO1xuICAgIHQuZGVlcEVxdWFsKG93blByb3BzKGQuaGFuZGxlcnMpLCBbJ2NsaWNrJywgJ2lucHV0J10pO1xuICAgIHQuZXF1YWwoZC5oYW5kbGVycy5jbGljaywgbm9vcCk7XG4gICAgdC5lcXVhbChkLmhhbmRsZXJzLmlucHV0LCBub29wKTtcbiAgfSlcbiAgLnRlc3QoJ3JlbW92ZSBldmVudCBsaXN0ZW5lcnMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZCA9IGZha2VEb20oKTtcbiAgICBkLmhhbmRsZXJzLmNsaWNrID0gbm9vcDtcbiAgICBkLmhhbmRsZXJzLmlucHV0ID0gbm9vcDtcbiAgICBjb25zdCB1cGRhdGUgPSByZW1vdmVFdmVudExpc3RlbmVycyhbWydjbGljaycsIG5vb3BcbiAgICBdXSk7XG4gICAgY29uc3QgbiA9IHVwZGF0ZShkKTtcbiAgICB0LmVxdWFsKG4sIGQsICdzaG91bGQgaGF2ZSBmb3J3YXJkZWQgdGhlIG5vZGUnKTtcbiAgICB0LmRlZXBFcXVhbChvd25Qcm9wcyhkLmhhbmRsZXJzKSwgWydpbnB1dCddKTtcbiAgICB0LmVxdWFsKGQuaGFuZGxlcnMuaW5wdXQsIG5vb3ApO1xuICB9KVxuICAudGVzdCgnc2V0IHRleHQgbm9kZSB2YWx1ZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBub2RlID0ge307XG4gICAgY29uc3QgdXBkYXRlID0gc2V0VGV4dE5vZGUoJ2ZvbycpO1xuICAgIHVwZGF0ZShub2RlKTtcbiAgICB0LmVxdWFsKG5vZGUudGV4dENvbnRlbnQsICdmb28nKTtcbiAgfSlcbiAgLnRlc3QoJ2dldCBldmVudCBMaXN0ZW5lcnMgZnJvbSBwcm9wcyBvYmplY3QnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgcHJvcHMgPSB7XG4gICAgICBvbkNsaWNrOiAoKSA9PiB7XG4gICAgICB9LFxuICAgICAgaW5wdXQ6ICgpID0+IHtcbiAgICAgIH0sXG4gICAgICBvbk1vdXNlZG93bjogKCkgPT4ge1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBldmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhwcm9wcyk7XG4gICAgdC5kZWVwRXF1YWwoZXZlbnRzLCBbXG4gICAgICBbJ2NsaWNrJywgcHJvcHMub25DbGlja10sXG4gICAgICBbJ21vdXNlZG93bicsIHByb3BzLm9uTW91c2Vkb3duXSxcbiAgICBdKTtcbiAgfSkiLCJjb25zdCBjcmVhdGVUZXh0Vk5vZGUgPSAodmFsdWUpID0+ICh7XG4gIG5vZGVUeXBlOiAnVGV4dCcsXG4gIGNoaWxkcmVuOiBbXSxcbiAgcHJvcHM6IHt2YWx1ZX0sXG4gIGxpZmVDeWNsZTogMFxufSk7XG5cbi8qKlxuICogVHJhbnNmb3JtIGh5cGVyc2NyaXB0IGludG8gdmlydHVhbCBkb20gbm9kZVxuICogQHBhcmFtIG5vZGVUeXBlIHtGdW5jdGlvbiwgU3RyaW5nfSAtIHRoZSBIVE1MIHRhZyBpZiBzdHJpbmcsIGEgY29tcG9uZW50IG9yIGNvbWJpbmF0b3Igb3RoZXJ3aXNlXG4gKiBAcGFyYW0gcHJvcHMge09iamVjdH0gLSB0aGUgbGlzdCBvZiBwcm9wZXJ0aWVzL2F0dHJpYnV0ZXMgYXNzb2NpYXRlZCB0byB0aGUgcmVsYXRlZCBub2RlXG4gKiBAcGFyYW0gY2hpbGRyZW4gLSB0aGUgdmlydHVhbCBkb20gbm9kZXMgcmVsYXRlZCB0byB0aGUgY3VycmVudCBub2RlIGNoaWxkcmVuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSAtIGEgdmlydHVhbCBkb20gbm9kZVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBoIChub2RlVHlwZSwgcHJvcHMsIC4uLmNoaWxkcmVuKSB7XG4gIGNvbnN0IGZsYXRDaGlsZHJlbiA9IGNoaWxkcmVuLnJlZHVjZSgoYWNjLCBjaGlsZCkgPT4ge1xuICAgIGNvbnN0IGNoaWxkcmVuQXJyYXkgPSBBcnJheS5pc0FycmF5KGNoaWxkKSA/IGNoaWxkIDogW2NoaWxkXTtcbiAgICByZXR1cm4gYWNjLmNvbmNhdChjaGlsZHJlbkFycmF5KTtcbiAgfSwgW10pXG4gICAgLm1hcChjaGlsZCA9PiB7XG4gICAgICAvLyBub3JtYWxpemUgdGV4dCBub2RlIHRvIGhhdmUgc2FtZSBzdHJ1Y3R1cmUgdGhhbiByZWd1bGFyIGRvbSBub2Rlc1xuICAgICAgY29uc3QgdHlwZSA9IHR5cGVvZiBjaGlsZDtcbiAgICAgIHJldHVybiB0eXBlID09PSAnb2JqZWN0JyB8fCB0eXBlID09PSAnZnVuY3Rpb24nID8gY2hpbGQgOiBjcmVhdGVUZXh0Vk5vZGUoY2hpbGQpO1xuICAgIH0pO1xuXG4gIGlmICh0eXBlb2Ygbm9kZVR5cGUgIT09ICdmdW5jdGlvbicpIHsvL3JlZ3VsYXIgaHRtbC90ZXh0IG5vZGVcbiAgICByZXR1cm4ge1xuICAgICAgbm9kZVR5cGUsXG4gICAgICBwcm9wczogcHJvcHMsXG4gICAgICBjaGlsZHJlbjogZmxhdENoaWxkcmVuLFxuICAgICAgbGlmZUN5Y2xlOiAwXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBmdWxsUHJvcHMgPSBPYmplY3QuYXNzaWduKHtjaGlsZHJlbjogZmxhdENoaWxkcmVufSwgcHJvcHMpO1xuICAgIGNvbnN0IGNvbXAgPSBub2RlVHlwZShmdWxsUHJvcHMpO1xuICAgIHJldHVybiB0eXBlb2YgY29tcCAhPT0gJ2Z1bmN0aW9uJyA/IGNvbXAgOiBoKGNvbXAsIHByb3BzLCAuLi5mbGF0Q2hpbGRyZW4pOyAvL2Z1bmN0aW9uYWwgY29tcCB2cyBjb21iaW5hdG9yIChIT0MpXG4gIH1cbn07IiwiaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7XG4gIGlzU2hhbGxvd0VxdWFsLFxuICBwYWlyaWZ5LFxuICBuZXh0VGljayxcbiAgbm9vcFxufSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlQXR0cmlidXRlcyxcbiAgc2V0QXR0cmlidXRlcyxcbiAgc2V0VGV4dE5vZGUsXG4gIGNyZWF0ZURvbU5vZGUsXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxuICBhZGRFdmVudExpc3RlbmVycyxcbiAgZ2V0RXZlbnRMaXN0ZW5lcnMsXG59IGZyb20gJy4vZG9tVXRpbCc7XG5pbXBvcnQge3RyYXZlcnNlfSBmcm9tICcuL3RyYXZlcnNlJztcblxuY29uc3QgdXBkYXRlRXZlbnRMaXN0ZW5lcnMgPSAoe3Byb3BzOm5ld05vZGVQcm9wc309e30sIHtwcm9wczpvbGROb2RlUHJvcHN9PXt9KSA9PiB7XG4gIGNvbnN0IG5ld05vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhuZXdOb2RlUHJvcHMgfHwge30pO1xuICBjb25zdCBvbGROb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMob2xkTm9kZVByb3BzIHx8IHt9KTtcblxuICByZXR1cm4gbmV3Tm9kZUV2ZW50cy5sZW5ndGggfHwgb2xkTm9kZUV2ZW50cy5sZW5ndGggP1xuICAgIGNvbXBvc2UoXG4gICAgICByZW1vdmVFdmVudExpc3RlbmVycyhvbGROb2RlRXZlbnRzKSxcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKG5ld05vZGVFdmVudHMpXG4gICAgKSA6IG5vb3A7XG59O1xuXG5jb25zdCB1cGRhdGVBdHRyaWJ1dGVzID0gKG5ld1ZOb2RlLCBvbGRWTm9kZSkgPT4ge1xuICBjb25zdCBuZXdWTm9kZVByb3BzID0gbmV3Vk5vZGUucHJvcHMgfHwge307XG4gIGNvbnN0IG9sZFZOb2RlUHJvcHMgPSBvbGRWTm9kZS5wcm9wcyB8fCB7fTtcblxuICBpZiAoaXNTaGFsbG93RXF1YWwobmV3Vk5vZGVQcm9wcywgb2xkVk5vZGVQcm9wcykpIHtcbiAgICByZXR1cm4gbm9vcDtcbiAgfVxuXG4gIGlmIChuZXdWTm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgcmV0dXJuIHNldFRleHROb2RlKG5ld1ZOb2RlLnByb3BzLnZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IG5ld05vZGVLZXlzID0gT2JqZWN0LmtleXMobmV3Vk5vZGVQcm9wcyk7XG4gIGNvbnN0IG9sZE5vZGVLZXlzID0gT2JqZWN0LmtleXMob2xkVk5vZGVQcm9wcyk7XG4gIGNvbnN0IGF0dHJpYnV0ZXNUb1JlbW92ZSA9IG9sZE5vZGVLZXlzLmZpbHRlcihrID0+ICFuZXdOb2RlS2V5cy5pbmNsdWRlcyhrKSk7XG5cbiAgcmV0dXJuIGNvbXBvc2UoXG4gICAgcmVtb3ZlQXR0cmlidXRlcyhhdHRyaWJ1dGVzVG9SZW1vdmUpLFxuICAgIHNldEF0dHJpYnV0ZXMobmV3Tm9kZUtleXMubWFwKHBhaXJpZnkobmV3Vk5vZGVQcm9wcykpKVxuICApO1xufTtcblxuY29uc3QgZG9tRmFjdG9yeSA9IGNyZWF0ZURvbU5vZGU7XG5cbi8vIGFwcGx5IHZub2RlIGRpZmZpbmcgdG8gYWN0dWFsIGRvbSBub2RlIChpZiBuZXcgbm9kZSA9PiBpdCB3aWxsIGJlIG1vdW50ZWQgaW50byB0aGUgcGFyZW50KVxuY29uc3QgZG9taWZ5ID0gKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSkgPT4ge1xuICBpZiAoIW9sZFZub2RlKSB7Ly90aGVyZSBpcyBubyBwcmV2aW91cyB2bm9kZVxuICAgIGlmIChuZXdWbm9kZSkgey8vbmV3IG5vZGUgPT4gd2UgaW5zZXJ0XG4gICAgICBuZXdWbm9kZS5kb20gPSBwYXJlbnREb21Ob2RlLmFwcGVuZENoaWxkKGRvbUZhY3RvcnkobmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICByZXR1cm4ge3Zub2RlOiBuZXdWbm9kZSwgZ2FyYmFnZTogbnVsbH07XG4gICAgfSBlbHNlIHsvL2Vsc2UgKGlycmVsZXZhbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpXG4gICAgfVxuICB9IGVsc2Ugey8vdGhlcmUgaXMgYSBwcmV2aW91cyB2bm9kZVxuICAgIGlmICghbmV3Vm5vZGUpIHsvL3dlIG11c3QgcmVtb3ZlIHRoZSByZWxhdGVkIGRvbSBub2RlXG4gICAgICBwYXJlbnREb21Ob2RlLnJlbW92ZUNoaWxkKG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4gKHtnYXJiYWdlOiBvbGRWbm9kZSwgZG9tOiBudWxsfSk7XG4gICAgfSBlbHNlIGlmIChuZXdWbm9kZS5ub2RlVHlwZSAhPT0gb2xkVm5vZGUubm9kZVR5cGUpIHsvL2l0IG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IGRvbUZhY3RvcnkobmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHBhcmVudERvbU5vZGUucmVwbGFjZUNoaWxkKG5ld1Zub2RlLmRvbSwgb2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogb2xkVm5vZGUsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfSBlbHNlIHsvLyBvbmx5IHVwZGF0ZSBhdHRyaWJ1dGVzXG4gICAgICBuZXdWbm9kZS5kb20gPSBvbGRWbm9kZS5kb207XG4gICAgICAvLyBwYXNzIHRoZSB1bk1vdW50SG9va1xuICAgICAgaWYob2xkVm5vZGUub25Vbk1vdW50KXtcbiAgICAgICAgbmV3Vm5vZGUub25Vbk1vdW50ID0gb2xkVm5vZGUub25Vbk1vdW50O1xuICAgICAgfVxuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gb2xkVm5vZGUubGlmZUN5Y2xlICsgMTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogbnVsbCwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogcmVuZGVyIGEgdmlydHVhbCBkb20gbm9kZSwgZGlmZmluZyBpdCB3aXRoIGl0cyBwcmV2aW91cyB2ZXJzaW9uLCBtb3VudGluZyBpdCBpbiBhIHBhcmVudCBkb20gbm9kZVxuICogQHBhcmFtIG9sZFZub2RlXG4gKiBAcGFyYW0gbmV3Vm5vZGVcbiAqIEBwYXJhbSBwYXJlbnREb21Ob2RlXG4gKiBAcGFyYW0gb25OZXh0VGljayBjb2xsZWN0IG9wZXJhdGlvbnMgdG8gYmUgcHJvY2Vzc2VkIG9uIG5leHQgdGlja1xuICogQHJldHVybnMge0FycmF5fVxuICovXG5leHBvcnQgY29uc3QgcmVuZGVyID0gKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSwgb25OZXh0VGljayA9IFtdKSA9PiB7XG5cbiAgLy8xLiB0cmFuc2Zvcm0gdGhlIG5ldyB2bm9kZSB0byBhIHZub2RlIGNvbm5lY3RlZCB0byBhbiBhY3R1YWwgZG9tIGVsZW1lbnQgYmFzZWQgb24gdm5vZGUgdmVyc2lvbnMgZGlmZmluZ1xuICAvLyBpLiBub3RlIGF0IHRoaXMgc3RlcCBvY2N1ciBkb20gaW5zZXJ0aW9ucy9yZW1vdmFsc1xuICAvLyBpaS4gaXQgbWF5IGNvbGxlY3Qgc3ViIHRyZWUgdG8gYmUgZHJvcHBlZCAob3IgXCJ1bm1vdW50ZWRcIilcbiAgY29uc3Qge3Zub2RlLCBnYXJiYWdlfSA9IGRvbWlmeShvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuXG4gIGlmIChnYXJiYWdlICE9PSBudWxsKSB7XG4gICAgLy8gZGVmZXIgdW5tb3VudCBsaWZlY3ljbGUgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBmb3IgKGxldCBnIG9mIHRyYXZlcnNlKGdhcmJhZ2UpKSB7XG4gICAgICBpZiAoZy5vblVuTW91bnQpIHtcbiAgICAgICAgb25OZXh0VGljay5wdXNoKGcub25Vbk1vdW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvL05vcm1hbGlzYXRpb24gb2Ygb2xkIG5vZGUgKGluIGNhc2Ugb2YgYSByZXBsYWNlIHdlIHdpbGwgY29uc2lkZXIgb2xkIG5vZGUgYXMgZW1wdHkgbm9kZSAobm8gY2hpbGRyZW4sIG5vIHByb3BzKSlcbiAgY29uc3QgdGVtcE9sZE5vZGUgPSBnYXJiYWdlICE9PSBudWxsIHx8ICFvbGRWbm9kZSA/IHtsZW5ndGg6IDAsIGNoaWxkcmVuOiBbXSwgcHJvcHM6IHt9fSA6IG9sZFZub2RlO1xuXG4gIGlmICh2bm9kZSkge1xuXG4gICAgLy8yLiB1cGRhdGUgZG9tIGF0dHJpYnV0ZXMgYmFzZWQgb24gdm5vZGUgcHJvcCBkaWZmaW5nLlxuICAgIC8vc3luY1xuICAgIGlmICh2bm9kZS5vblVwZGF0ZSAmJiB2bm9kZS5saWZlQ3ljbGUgPiAxKSB7XG4gICAgICB2bm9kZS5vblVwZGF0ZSgpO1xuICAgIH1cblxuICAgIHVwZGF0ZUF0dHJpYnV0ZXModm5vZGUsIHRlbXBPbGROb2RlKSh2bm9kZS5kb20pO1xuXG4gICAgLy9mYXN0IHBhdGhcbiAgICBpZiAodm5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgICAgcmV0dXJuIG9uTmV4dFRpY2s7XG4gICAgfVxuXG4gICAgaWYgKHZub2RlLm9uTW91bnQgJiYgdm5vZGUubGlmZUN5Y2xlID09PSAxKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gdm5vZGUub25Nb3VudCgpKTtcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbkNvdW50ID0gTWF0aC5tYXgodGVtcE9sZE5vZGUuY2hpbGRyZW4ubGVuZ3RoLCB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpO1xuXG4gICAgLy9hc3luYyB3aWxsIGJlIGRlZmVycmVkIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgY29uc3Qgc2V0TGlzdGVuZXJzID0gdXBkYXRlRXZlbnRMaXN0ZW5lcnModm5vZGUsIHRlbXBPbGROb2RlKTtcbiAgICBpZiAoc2V0TGlzdGVuZXJzICE9PSBub29wKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gc2V0TGlzdGVuZXJzKHZub2RlLmRvbSkpO1xuICAgIH1cblxuICAgIC8vMyByZWN1cnNpdmVseSB0cmF2ZXJzZSBjaGlsZHJlbiB0byB1cGRhdGUgZG9tIGFuZCBjb2xsZWN0IGZ1bmN0aW9ucyB0byBwcm9jZXNzIG9uIG5leHQgdGlja1xuICAgIGlmIChjaGlsZHJlbkNvdW50ID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbkNvdW50OyBpKyspIHtcbiAgICAgICAgLy8gd2UgcGFzcyBvbk5leHRUaWNrIGFzIHJlZmVyZW5jZSAoaW1wcm92ZSBwZXJmOiBtZW1vcnkgKyBzcGVlZClcbiAgICAgICAgcmVuZGVyKHRlbXBPbGROb2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuZG9tLCBvbk5leHRUaWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb25OZXh0VGljaztcbn07XG5cbmV4cG9ydCBjb25zdCBoeWRyYXRlID0gKHZub2RlLCBkb20pID0+IHtcbiAgJ3VzZSBzdHJpY3QnO1xuICBjb25zdCBoeWRyYXRlZCA9IE9iamVjdC5hc3NpZ24oe30sIHZub2RlKTtcbiAgY29uc3QgZG9tQ2hpbGRyZW4gPSBBcnJheS5mcm9tKGRvbS5jaGlsZE5vZGVzKS5maWx0ZXIobiA9PiBuLm5vZGVUeXBlICE9PSAzIHx8IG4ubm9kZVZhbHVlLnRyaW0oKSAhPT0gJycpO1xuICBoeWRyYXRlZC5kb20gPSBkb207XG4gIGh5ZHJhdGVkLmNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW4ubWFwKChjaGlsZCwgaSkgPT4gaHlkcmF0ZShjaGlsZCwgZG9tQ2hpbGRyZW5baV0pKTtcbiAgcmV0dXJuIGh5ZHJhdGVkO1xufTtcblxuZXhwb3J0IGNvbnN0IG1vdW50ID0gY3VycnkoKGNvbXAsIGluaXRQcm9wLCByb290KSA9PiB7XG4gIGNvbnN0IHZub2RlID0gY29tcC5ub2RlVHlwZSAhPT0gdm9pZCAwID8gY29tcCA6IGNvbXAoaW5pdFByb3AgfHwge30pO1xuICBjb25zdCBvbGRWTm9kZSA9IHJvb3QuY2hpbGRyZW4ubGVuZ3RoID8gaHlkcmF0ZSh2bm9kZSwgcm9vdC5jaGlsZHJlblswXSkgOiBudWxsO1xuICBjb25zdCBiYXRjaCA9IHJlbmRlcihvbGRWTm9kZSwgdm5vZGUsIHJvb3QpO1xuICBuZXh0VGljaygoKSA9PiB7XG4gICAgZm9yIChsZXQgb3Agb2YgYmF0Y2gpIHtcbiAgICAgIG9wKCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHZub2RlO1xufSk7IiwiaW1wb3J0IHtyZW5kZXJ9IGZyb20gJy4vdHJlZSc7XG5pbXBvcnQge25leHRUaWNrfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgdHJpZ2dlciBhbiB1cGRhdGUgb2YgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBwYXNzZWQgc3RhdGVcbiAqIEBwYXJhbSBjb21wIHtGdW5jdGlvbn0gLSB0aGUgY29tcG9uZW50IHRvIHVwZGF0ZVxuICogQHBhcmFtIGluaXRpYWxWTm9kZSAtIHRoZSBpbml0aWFsIHZpcnR1YWwgZG9tIG5vZGUgcmVsYXRlZCB0byB0aGUgY29tcG9uZW50IChpZSBvbmNlIGl0IGhhcyBiZWVuIG1vdW50ZWQpXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gdGhlIHVwZGF0ZSBmdW5jdGlvblxuICovXG5leHBvcnQgZGVmYXVsdCAoY29tcCwgaW5pdGlhbFZOb2RlKSA9PiB7XG4gIGxldCBvbGROb2RlID0gaW5pdGlhbFZOb2RlO1xuICByZXR1cm4gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgbW91bnQgPSBvbGROb2RlLmRvbS5wYXJlbnROb2RlO1xuICAgIGNvbnN0IG5ld05vZGUgPSBjb21wKE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBvbGROb2RlLmNoaWxkcmVuIHx8IFtdfSwgb2xkTm9kZS5wcm9wcywgcHJvcHMpLCAuLi5hcmdzKTtcbiAgICBjb25zdCBuZXh0QmF0Y2ggPSByZW5kZXIob2xkTm9kZSwgbmV3Tm9kZSwgbW91bnQpO1xuXG4gICAgLy8gZGFuZ2VyIHpvbmUgISEhIVxuICAgIC8vIGNoYW5nZSBieSBrZWVwaW5nIHRoZSBzYW1lIHJlZmVyZW5jZSBzbyB0aGUgZXZlbnR1YWwgcGFyZW50IG5vZGUgZG9lcyBub3QgbmVlZCB0byBiZSBcImF3YXJlXCIgdHJlZSBtYXkgaGF2ZSBjaGFuZ2VkIGRvd25zdHJlYW06IG9sZE5vZGUgbWF5IGJlIHRoZSBjaGlsZCBvZiBzb21lb25lIC4uLih3ZWxsIHRoYXQgaXMgYSB0cmVlIGRhdGEgc3RydWN0dXJlIGFmdGVyIGFsbCA6UCApXG4gICAgb2xkTm9kZSA9IE9iamVjdC5hc3NpZ24ob2xkTm9kZSB8fCB7fSwgbmV3Tm9kZSk7XG4gICAgLy8gZW5kIGRhbmdlciB6b25lXG5cbiAgICBuZXh0VGljayhfID0+IHtcbiAgICAgIGZvciAobGV0IG9wIG9mIG5leHRCYXRjaCkge1xuICAgICAgICBvcCgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlO1xuICB9O1xufTsiLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCBsaWZlQ3ljbGVGYWN0b3J5ID0gbWV0aG9kID0+IGN1cnJ5KChmbiwgY29tcCkgPT4gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gIGNvbnN0IG4gPSBjb21wKHByb3BzLCAuLi5hcmdzKTtcbiAgblttZXRob2RdID0gKCkgPT4gZm4obiwgLi4uYXJncyk7XG4gIHJldHVybiBuO1xufSk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvbk1vdW50Jyk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIHVubW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Vbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Vbk1vdW50Jyk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogYmVmb3JlIHRoZSBjb21wb25lbnQgaXMgdXBkYXRlZFxuICovXG5leHBvcnQgY29uc3Qgb25VcGRhdGUgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvblVwZGF0ZScpOyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVwZGF0ZX0gZnJvbSAnLi9saWZlQ3ljbGVzJztcbmltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuLyoqXG4gKiBDb21iaW5hdG9yIHRvIGNyZWF0ZSBhIFwic3RhdGVmdWwgY29tcG9uZW50XCI6IGllIGl0IHdpbGwgaGF2ZSBpdHMgb3duIHN0YXRlIGFuZCB0aGUgYWJpbGl0eSB0byB1cGRhdGUgaXRzIG93biB0cmVlXG4gKiBAcGFyYW0gY29tcCB7RnVuY3Rpb259IC0gdGhlIGNvbXBvbmVudFxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIGEgbmV3IHdyYXBwZWQgY29tcG9uZW50XG4gKi9cbmV4cG9ydCBkZWZhdWx0ICAoY29tcCkgPT4gKCkgPT4ge1xuICBsZXQgdXBkYXRlRnVuYztcbiAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAvL2xhenkgZXZhbHVhdGUgdXBkYXRlRnVuYyAodG8gbWFrZSBzdXJlIGl0IGlzIGRlZmluZWRcbiAgICBjb25zdCBzZXRTdGF0ZSA9IChuZXdTdGF0ZSkgPT4gdXBkYXRlRnVuYyhuZXdTdGF0ZSk7XG4gICAgcmV0dXJuIGNvbXAocHJvcHMsIHNldFN0YXRlLCAuLi5hcmdzKTtcbiAgfTtcbiAgY29uc3Qgc2V0VXBkYXRlRnVuY3Rpb24gPSAodm5vZGUpID0+IHtcbiAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gIH07XG5cbiAgcmV0dXJuIGNvbXBvc2Uob25Nb3VudChzZXRVcGRhdGVGdW5jdGlvbiksIG9uVXBkYXRlKHNldFVwZGF0ZUZ1bmN0aW9uKSkod3JhcHBlckNvbXApO1xufTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7b25Nb3VudCwgb25Vbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnXG5pbXBvcnQge2lzRGVlcEVxdWFsLCBpZGVudGl0eX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb25uZWN0IGNvbWJpbmF0b3I6IHdpbGwgY3JlYXRlIFwiY29udGFpbmVyXCIgY29tcG9uZW50IHdoaWNoIHdpbGwgc3Vic2NyaWJlIHRvIGEgUmVkdXggbGlrZSBzdG9yZS4gYW5kIHVwZGF0ZSBpdHMgY2hpbGRyZW4gd2hlbmV2ZXIgYSBzcGVjaWZpYyBzbGljZSBvZiBzdGF0ZSBjaGFuZ2UgdW5kZXIgc3BlY2lmaWMgY2lyY3Vtc3RhbmNlc1xuICogQHBhcmFtIHN0b3JlIHtPYmplY3R9IC0gVGhlIHN0b3JlIChpbXBsZW1lbnRpbmcgdGhlIHNhbWUgYXBpIHRoYW4gUmVkdXggc3RvcmVcbiAqIEBwYXJhbSBzbGljZVN0YXRlIHtGdW5jdGlvbn0gW3N0YXRlID0+IHN0YXRlXSAtIEEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnQgdGhlIHN0YXRlIGFuZCByZXR1cm4gYSBcInRyYW5zZm9ybWVkXCIgc3RhdGUgKGxpa2UgcGFydGlhbCwgZXRjKSByZWxldmFudCB0byB0aGUgY29udGFpbmVyXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBjb250YWluZXIgZmFjdG9yeSB3aXRoIHRoZSBmb2xsb3dpbmcgYXJndW1lbnRzOlxuICogIC0gbWFwU3RhdGVUb1Byb3A6IGEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnQgd2hhdCB0aGUgXCJzbGljZVN0YXRlXCIgZnVuY3Rpb24gcmV0dXJucyBhbmQgcmV0dXJucyBhbiBvYmplY3QgdG8gYmUgYmxlbmRlZCBpbnRvIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBjb21wb25lbnQgKGRlZmF1bHQgdG8gaWRlbnRpdHkgZnVuY3Rpb24pXG4gKiAgLSBzaG91bGRVcGRhdGU6IGEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnRzIHRoZSBwcmV2aW91cyBhbmQgdGhlIGN1cnJlbnQgdmVyc2lvbnMgb2Ygd2hhdCBcInNsaWNlU3RhdGVcIiBmdW5jdGlvbiByZXR1cm5zIHRvIHJldHVybnMgYSBib29sZWFuIGRlZmluaW5nIHdoZXRoZXIgdGhlIGNvbXBvbmVudCBzaG91bGQgYmUgdXBkYXRlZCAoZGVmYXVsdCB0byBhIGRlZXBFcXVhbCBjaGVjaylcbiAqL1xuZXhwb3J0IGRlZmF1bHQgIChzdG9yZSwgc2xpY2VTdGF0ZSA9IGlkZW50aXR5KSA9PlxuICAoY29tcCwgbWFwU3RhdGVUb1Byb3AgPSBpZGVudGl0eSwgc2hvdWxkVXBhdGUgPSAoYSwgYikgPT4gaXNEZWVwRXF1YWwoYSwgYikgPT09IGZhbHNlKSA9PlxuICAgIChpbml0UHJvcCkgPT4ge1xuICAgICAgbGV0IGNvbXBvbmVudFByb3BzID0gaW5pdFByb3A7XG4gICAgICBsZXQgdXBkYXRlRnVuYywgcHJldmlvdXNTdGF0ZVNsaWNlLCB1bnN1YnNjcmliZXI7XG5cbiAgICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIHJldHVybiBjb21wKE9iamVjdC5hc3NpZ24ocHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSkpKSwgLi4uYXJncyk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBzdWJzY3JpYmUgPSBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgICAgIHVuc3Vic2NyaWJlciA9IHN0b3JlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdGVTbGljZSA9IHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgaWYgKHNob3VsZFVwYXRlKHByZXZpb3VzU3RhdGVTbGljZSwgc3RhdGVTbGljZSkgPT09IHRydWUpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50UHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHN0YXRlU2xpY2UpKTtcbiAgICAgICAgICAgIHVwZGF0ZUZ1bmMoY29tcG9uZW50UHJvcHMpO1xuICAgICAgICAgICAgcHJldmlvdXNTdGF0ZVNsaWNlID0gc3RhdGVTbGljZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gb25Vbk1vdW50KCgpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmVyKCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNvbXBvc2Uoc3Vic2NyaWJlLCB1bnN1YnNjcmliZSkod3JhcHBlckNvbXApO1xuICAgIH0iLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7aH0gZnJvbSAnLi4vaW5kZXgnO1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ2NyZWF0ZSByZWd1bGFyIGh0bWwgbm9kZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCB2bm9kZSA9IGgoJ2RpdicsIHtpZDogJ3NvbWVJZCcsIFwiY2xhc3NcIjogJ3NwZWNpYWwnfSk7XG4gICAgdC5kZWVwRXF1YWwodm5vZGUsIHtsaWZlQ3ljbGU6IDAsIG5vZGVUeXBlOiAnZGl2JywgcHJvcHM6IHtpZDogJ3NvbWVJZCcsIFwiY2xhc3NcIjogJ3NwZWNpYWwnfSwgY2hpbGRyZW46IFtdfSk7XG4gIH0pXG4gIC50ZXN0KCdjcmVhdGUgcmVndWxhciBodG1sIG5vZGUgd2l0aCB0ZXh0IG5vZGUgY2hpbGRyZW4nLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3Qgdm5vZGUgPSBoKCdkaXYnLCB7aWQ6ICdzb21lSWQnLCBcImNsYXNzXCI6ICdzcGVjaWFsJ30sICdmb28nKTtcbiAgICB0LmRlZXBFcXVhbCh2bm9kZSwge1xuICAgICAgbm9kZVR5cGU6ICdkaXYnLCBsaWZlQ3ljbGU6IDAsIHByb3BzOiB7aWQ6ICdzb21lSWQnLCBcImNsYXNzXCI6ICdzcGVjaWFsJ30sIGNoaWxkcmVuOiBbe1xuICAgICAgICBub2RlVHlwZTogJ1RleHQnLFxuICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgIHByb3BzOiB7dmFsdWU6ICdmb28nfSxcbiAgICAgICAgbGlmZUN5Y2xlOiAwXG4gICAgICB9XVxuICAgIH0pO1xuICB9KVxuICAudGVzdCgnY3JlYXRlIHJlZ3VsYXIgaHRtbCB3aXRoIGNoaWxkcmVuJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IHZub2RlID0gaCgndWwnLCB7aWQ6ICdjb2xsZWN0aW9uJ30sIGgoJ2xpJywge2lkOiAxfSwgJ2l0ZW0xJyksIGgoJ2xpJywge2lkOiAyfSwgJ2l0ZW0yJykpO1xuICAgIHQuZGVlcEVxdWFsKHZub2RlLCB7XG4gICAgICBub2RlVHlwZTogJ3VsJyxcbiAgICAgIHByb3BzOiB7aWQ6ICdjb2xsZWN0aW9uJ30sXG4gICAgICBsaWZlQ3ljbGU6IDAsXG4gICAgICBjaGlsZHJlbjogW1xuICAgICAgICB7XG4gICAgICAgICAgbm9kZVR5cGU6ICdsaScsXG4gICAgICAgICAgcHJvcHM6IHtpZDogMX0sXG4gICAgICAgICAgbGlmZUN5Y2xlOiAwLFxuICAgICAgICAgIGNoaWxkcmVuOiBbe1xuICAgICAgICAgICAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgICAgICAgICAgIHByb3BzOiB7dmFsdWU6ICdpdGVtMSd9LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgICAgbGlmZUN5Y2xlOiAwXG4gICAgICAgICAgfV1cbiAgICAgICAgfSwge1xuICAgICAgICAgIG5vZGVUeXBlOiAnbGknLFxuICAgICAgICAgIHByb3BzOiB7aWQ6IDJ9LFxuICAgICAgICAgIGxpZmVDeWNsZTogMCxcbiAgICAgICAgICBjaGlsZHJlbjogW3tcbiAgICAgICAgICAgIG5vZGVUeXBlOiAnVGV4dCcsXG4gICAgICAgICAgICBwcm9wczoge3ZhbHVlOiAnaXRlbTInfSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXSxcbiAgICAgICAgICAgIGxpZmVDeWNsZTogMFxuICAgICAgICAgIH1dXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfSlcbiAgLnRlc3QoJ3VzZSBmdW5jdGlvbiBhcyBjb21wb25lbnQgcGFzc2luZyB0aGUgY2hpbGRyZW4gYXMgcHJvcCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBmb28gPSAocHJvcHMpID0+IGgoJ3AnLCBwcm9wcyk7XG4gICAgY29uc3Qgdm5vZGUgPSBoKGZvbywge2lkOiAxfSwgJ2hlbGxvIHdvcmxkJyk7XG4gICAgdC5kZWVwRXF1YWwodm5vZGUsIHtcbiAgICAgIG5vZGVUeXBlOiAncCcsXG4gICAgICBsaWZlQ3ljbGU6IDAsXG4gICAgICBwcm9wczoge1xuICAgICAgICBjaGlsZHJlbjogW3tcbiAgICAgICAgICBub2RlVHlwZTogJ1RleHQnLFxuICAgICAgICAgIGxpZmVDeWNsZTogMCxcbiAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgcHJvcHM6IHt2YWx1ZTogJ2hlbGxvIHdvcmxkJ31cbiAgICAgICAgfV0sXG4gICAgICAgIGlkOiAxXG4gICAgICB9LFxuICAgICAgY2hpbGRyZW46IFtdXG4gICAgfSk7XG4gIH0pXG4gIC50ZXN0KCd1c2UgbmVzdGVkIGNvbWJpbmF0b3IgdG8gY3JlYXRlIHZub2RlJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGNvbWJpbmF0b3IgPSAoKSA9PiAoKSA9PiAoKSA9PiAoKSA9PiAocHJvcHMpID0+IGgoJ3AnLCB7aWQ6ICdmb28nfSk7XG4gICAgY29uc3Qgdm5vZGUgPSBoKGNvbWJpbmF0b3IsIHt9KTtcbiAgICB0LmRlZXBFcXVhbCh2bm9kZSwge25vZGVUeXBlOiAncCcsIGxpZmVDeWNsZTogMCwgcHJvcHM6IHtpZDogJ2Zvbyd9LCBjaGlsZHJlbjogW119KTtcbiAgfSlcblxuIiwiZXhwb3J0IGZ1bmN0aW9uIHdhaXROZXh0VGljayAoKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0sIDIpXG4gIH0pXG59IiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQge29uTW91bnQsIG9uVW5Nb3VudCwgaCwgbW91bnQsIHJlbmRlcn0gZnJvbSAnLi4vaW5kZXgnO1xuaW1wb3J0IHt3YWl0TmV4dFRpY2t9IGZyb20gJy4vdGVzdFV0aWwnXG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnc2hvdWxkIHJ1biBhIGZ1bmN0aW9uIHdoZW4gY29tcG9uZW50IGlzIG1vdW50ZWQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgbGV0IGNvdW50ZXIgPSAwO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IGNvbXAgPSAoKSA9PiA8cD5oZWxsbyB3b3JsZDwvcD47XG4gICAgY29uc3Qgd2l0aE1vdW50ID0gb25Nb3VudCgoKSA9PiB7XG4gICAgICBjb3VudGVyKytcbiAgICB9LCBjb21wKTtcbiAgICBtb3VudCh3aXRoTW91bnQsIHt9LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY291bnRlciwgMCk7XG4gICAgeWllbGQgd2FpdE5leHRUaWNrKCk7XG4gICAgdC5lcXVhbChjb3VudGVyLCAxKTtcbiAgfSlcbiAgLnRlc3QoJ3Nob3VsZCBydW4gYSBmdW5jdGlvbiB3aGVuIGNvbXBvbmVudCBpcyB1bk1vdW50ZWQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgbGV0IHVubW91bnRlZCA9IG51bGw7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgSXRlbSA9IG9uVW5Nb3VudCgobikgPT4ge1xuICAgICAgdW5tb3VudGVkID0gbjtcbiAgICB9LCAoe2lkfSkgPT4gPGxpIGlkPXtpZH0+aGVsbG8gd29ybGQ8L2xpPik7XG4gICAgY29uc3QgY29udGFpbmVyQ29tcCA9ICgoe2l0ZW1zfSkgPT4gKDx1bD5cbiAgICAgIHtcbiAgICAgICAgaXRlbXMubWFwKGl0ZW0gPT4gPEl0ZW0gey4uLml0ZW19Lz4pXG4gICAgICB9XG4gICAgPC91bD4pKTtcblxuICAgIGNvbnN0IHZub2RlID0gbW91bnQoY29udGFpbmVyQ29tcCwge2l0ZW1zOiBbe2lkOiAxfSwge2lkOiAyfSwge2lkOiAzfV19LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzx1bD48bGkgaWQ9XCIxXCI+aGVsbG8gd29ybGQ8L2xpPjxsaSBpZD1cIjJcIj5oZWxsbyB3b3JsZDwvbGk+PGxpIGlkPVwiM1wiPmhlbGxvIHdvcmxkPC9saT48L3VsPicpO1xuICAgIGNvbnN0IGJhdGNoID0gcmVuZGVyKHZub2RlLCBjb250YWluZXJDb21wKHtpdGVtczogW3tpZDogMX0sIHtpZDogM31dfSksIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHVsPjxsaSBpZD1cIjFcIj5oZWxsbyB3b3JsZDwvbGk+PGxpIGlkPVwiM1wiPmhlbGxvIHdvcmxkPC9saT48L3VsPicpO1xuICAgIGZvciAobGV0IGYgb2YgYmF0Y2gpe1xuICAgICAgZigpO1xuICAgIH1cbiAgICB0Lm5vdEVxdWFsKHVubW91bnRlZCwgbnVsbCk7XG4gIH0pXG4iLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7bW91bnQsIGh9IGZyb20gJy4uL2luZGV4JztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdtb3VudCBhIHNpbXBsZSBjb21wb25lbnQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgQ29tcCA9IChwcm9wcykgPT4gKDxoMT48c3BhbiBpZD17cHJvcHMuaWR9Pntwcm9wcy5ncmVldGluZ308L3NwYW4+PC9oMT4pO1xuICAgIG1vdW50KENvbXAsIHtpZDogMTIzLCBncmVldGluZzogJ2hlbGxvIHdvcmxkJ30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPGgxPjxzcGFuIGlkPVwiMTIzXCI+aGVsbG8gd29ybGQ8L3NwYW4+PC9oMT4nKTtcbiAgfSlcbiAgLnRlc3QoJ21vdW50IGNvbXBvc2VkIGNvbXBvbmVudCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb25zdCBDb21wID0gKHByb3BzKSA9PiAoPGgxPjxzcGFuIGlkPXtwcm9wcy5pZH0+e3Byb3BzLmdyZWV0aW5nfTwvc3Bhbj48L2gxPik7XG4gICAgY29uc3QgQ29udGFpbmVyID0gKHByb3BzKSA9PiAoPHNlY3Rpb24+XG4gICAgICA8Q29tcCBpZD1cIjU2N1wiIGdyZWV0aW5nPVwiaGVsbG8geW91XCIvPlxuICAgIDwvc2VjdGlvbj4pO1xuICAgIG1vdW50KENvbnRhaW5lciwge30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHNlY3Rpb24+PGgxPjxzcGFuIGlkPVwiNTY3XCI+aGVsbG8geW91PC9zcGFuPjwvaDE+PC9zZWN0aW9uPicpO1xuICB9KVxuICAudGVzdCgnbW91bnQgYSBjb21wb25lbnQgd2l0aCBpbm5lciBjaGlsZCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb25zdCBDb21wID0gKHByb3BzKSA9PiAoPGgxPjxzcGFuIGlkPXtwcm9wcy5pZH0+e3Byb3BzLmdyZWV0aW5nfTwvc3Bhbj48L2gxPik7XG4gICAgY29uc3QgQ29udGFpbmVyID0gKHByb3BzKSA9PiAoPHNlY3Rpb24+e3Byb3BzLmNoaWxkcmVufTwvc2VjdGlvbj4pO1xuICAgIG1vdW50KCgpID0+IDxDb250YWluZXI+PENvbXAgaWQ9XCI1NjdcIiBncmVldGluZz1cImhlbGxvIHdvcmxkXCIvPjwvQ29udGFpbmVyPiwge30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHNlY3Rpb24+PGgxPjxzcGFuIGlkPVwiNTY3XCI+aGVsbG8gd29ybGQ8L3NwYW4+PC9oMT48L3NlY3Rpb24+Jyk7XG4gIH0pXG4iLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7dXBkYXRlLCBtb3VudCwgaH0gZnJvbSAnLi4vaW5kZXgnO1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ2dpdmUgYWJpbGl0eSB0byB1cGRhdGUgYSBub2RlIChhbmQgaXRzIGRlc2NlbmRhbnQpJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IGNvbXAgPSAoKHtpZCwgY29udGVudH0pID0+ICg8cCBpZD17aWR9Pntjb250ZW50fTwvcD4pKTtcbiAgICBjb25zdCBpbml0aWFsVm5vZGUgPSBtb3VudChjb21wLCB7aWQ6IDEyMywgY29udGVudDogJ2hlbGxvIHdvcmxkJ30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHAgaWQ9XCIxMjNcIj5oZWxsbyB3b3JsZDwvcD4nKTtcbiAgICBjb25zdCB1cGRhdGVGdW5jID0gdXBkYXRlKGNvbXAsIGluaXRpYWxWbm9kZSk7XG4gICAgdXBkYXRlRnVuYyh7aWQ6IDU2NywgY29udGVudDogJ2JvbmpvdXIgbW9uZGUnfSk7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHAgaWQ9XCI1NjdcIj5ib25qb3VyIG1vbmRlPC9wPicpO1xuICB9KTtcbiIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHtoLCB3aXRoU3RhdGUsIG1vdW50fSBmcm9tICcuLi9pbmRleCc7XG5pbXBvcnQge3dhaXROZXh0VGlja30gZnJvbSAnLi90ZXN0VXRpbCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnYmluZCBhbiB1cGRhdGUgZnVuY3Rpb24gdG8gYSBjb21wb25lbnQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgbGV0IHVwZGF0ZSA9IG51bGw7XG4gICAgY29uc3QgQ29tcCA9IHdpdGhTdGF0ZSgoe2Zvb30sIHNldFN0YXRlKSA9PiB7XG4gICAgICBpZiAoIXVwZGF0ZSkge1xuICAgICAgICB1cGRhdGUgPSBzZXRTdGF0ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiA8cD57Zm9vfTwvcD47XG4gICAgfSk7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbW91bnQoKHtmb299KSA9PiA8Q29tcCBmb289e2Zvb30vPiwge2ZvbzogJ2Jhcid9LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxwPmJhcjwvcD4nKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICB1cGRhdGUoe2ZvbzogJ2Jpcyd9KTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8cD5iaXM8L3A+Jyk7XG4gIH0pXG4gIC50ZXN0KCdzaG91bGQgY3JlYXRlIGlzb2xhdGVkIHN0YXRlIGZvciBlYWNoIGNvbXBvbmVudCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgdXBkYXRlMSA9IG51bGw7XG4gICAgbGV0IHVwZGF0ZTIgPSBudWxsO1xuICAgIGNvbnN0IENvbXAgPSB3aXRoU3RhdGUoKHtmb299LCBzZXRTdGF0ZSkgPT4ge1xuICAgICAgaWYgKCF1cGRhdGUxKSB7XG4gICAgICAgIHVwZGF0ZTEgPSBzZXRTdGF0ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXVwZGF0ZTIpIHtcbiAgICAgICAgdXBkYXRlMiA9IHNldFN0YXRlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gPHA+e2Zvb308L3A+O1xuICAgIH0pO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG1vdW50KCh7Zm9vMSwgZm9vMn0pID0+IDxkaXY+PENvbXAgZm9vPXtmb28xfS8+PENvbXAgZm9vPXtmb28yfS8+PC9kaXY+LCB7Zm9vMTogJ2JhcicsIGZvbzI6ICdiYXIyJ30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPGRpdj48cD5iYXI8L3A+PHA+YmFyMjwvcD48L2Rpdj4nKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICB1cGRhdGUxKHtmb286ICdiaXMnfSk7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPGRpdj48cD5iaXM8L3A+PHA+YmFyMjwvcD48L2Rpdj4nKTtcbiAgICB1cGRhdGUyKHtmb286ICdibGFoJ30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxkaXY+PHA+YmlzPC9wPjxwPmJsYWg8L3A+PC9kaXY+Jyk7XG4gIH0pOyIsIi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBmcm9tIE5vZGUuanMuICovXG52YXIgZnJlZUdsb2JhbCA9IHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsICYmIGdsb2JhbC5PYmplY3QgPT09IE9iamVjdCAmJiBnbG9iYWw7XG5cbmV4cG9ydCBkZWZhdWx0IGZyZWVHbG9iYWw7XG4iLCJpbXBvcnQgZnJlZUdsb2JhbCBmcm9tICcuL19mcmVlR2xvYmFsLmpzJztcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBzZWxmYC4gKi9cbnZhciBmcmVlU2VsZiA9IHR5cGVvZiBzZWxmID09ICdvYmplY3QnICYmIHNlbGYgJiYgc2VsZi5PYmplY3QgPT09IE9iamVjdCAmJiBzZWxmO1xuXG4vKiogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC4gKi9cbnZhciByb290ID0gZnJlZUdsb2JhbCB8fCBmcmVlU2VsZiB8fCBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuXG5leHBvcnQgZGVmYXVsdCByb290O1xuIiwiaW1wb3J0IHJvb3QgZnJvbSAnLi9fcm9vdC5qcyc7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIFN5bWJvbCA9IHJvb3QuU3ltYm9sO1xuXG5leHBvcnQgZGVmYXVsdCBTeW1ib2w7XG4iLCJpbXBvcnQgU3ltYm9sIGZyb20gJy4vX1N5bWJvbC5qcyc7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZVxuICogW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzcuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBuYXRpdmVPYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBzeW1Ub1N0cmluZ1RhZyA9IFN5bWJvbCA/IFN5bWJvbC50b1N0cmluZ1RhZyA6IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBBIHNwZWNpYWxpemVkIHZlcnNpb24gb2YgYGJhc2VHZXRUYWdgIHdoaWNoIGlnbm9yZXMgYFN5bWJvbC50b1N0cmluZ1RhZ2AgdmFsdWVzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIHJhdyBgdG9TdHJpbmdUYWdgLlxuICovXG5mdW5jdGlvbiBnZXRSYXdUYWcodmFsdWUpIHtcbiAgdmFyIGlzT3duID0gaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgc3ltVG9TdHJpbmdUYWcpLFxuICAgICAgdGFnID0gdmFsdWVbc3ltVG9TdHJpbmdUYWddO1xuXG4gIHRyeSB7XG4gICAgdmFsdWVbc3ltVG9TdHJpbmdUYWddID0gdW5kZWZpbmVkO1xuICAgIHZhciB1bm1hc2tlZCA9IHRydWU7XG4gIH0gY2F0Y2ggKGUpIHt9XG5cbiAgdmFyIHJlc3VsdCA9IG5hdGl2ZU9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICBpZiAodW5tYXNrZWQpIHtcbiAgICBpZiAoaXNPd24pIHtcbiAgICAgIHZhbHVlW3N5bVRvU3RyaW5nVGFnXSA9IHRhZztcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlIHZhbHVlW3N5bVRvU3RyaW5nVGFnXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZ2V0UmF3VGFnO1xuIiwiLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlXG4gKiBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNy4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG5hdGl2ZU9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIHN0cmluZyB1c2luZyBgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ2AuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBjb252ZXJ0ZWQgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gbmF0aXZlT2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IG9iamVjdFRvU3RyaW5nO1xuIiwiaW1wb3J0IFN5bWJvbCBmcm9tICcuL19TeW1ib2wuanMnO1xuaW1wb3J0IGdldFJhd1RhZyBmcm9tICcuL19nZXRSYXdUYWcuanMnO1xuaW1wb3J0IG9iamVjdFRvU3RyaW5nIGZyb20gJy4vX29iamVjdFRvU3RyaW5nLmpzJztcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIG51bGxUYWcgPSAnW29iamVjdCBOdWxsXScsXG4gICAgdW5kZWZpbmVkVGFnID0gJ1tvYmplY3QgVW5kZWZpbmVkXSc7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIHN5bVRvU3RyaW5nVGFnID0gU3ltYm9sID8gU3ltYm9sLnRvU3RyaW5nVGFnIDogdW5kZWZpbmVkO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBnZXRUYWdgIHdpdGhvdXQgZmFsbGJhY2tzIGZvciBidWdneSBlbnZpcm9ubWVudHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHF1ZXJ5LlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgYHRvU3RyaW5nVGFnYC5cbiAqL1xuZnVuY3Rpb24gYmFzZUdldFRhZyh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkVGFnIDogbnVsbFRhZztcbiAgfVxuICByZXR1cm4gKHN5bVRvU3RyaW5nVGFnICYmIHN5bVRvU3RyaW5nVGFnIGluIE9iamVjdCh2YWx1ZSkpXG4gICAgPyBnZXRSYXdUYWcodmFsdWUpXG4gICAgOiBvYmplY3RUb1N0cmluZyh2YWx1ZSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGJhc2VHZXRUYWc7XG4iLCIvKipcbiAqIENyZWF0ZXMgYSB1bmFyeSBmdW5jdGlvbiB0aGF0IGludm9rZXMgYGZ1bmNgIHdpdGggaXRzIGFyZ3VtZW50IHRyYW5zZm9ybWVkLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byB3cmFwLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gdHJhbnNmb3JtIFRoZSBhcmd1bWVudCB0cmFuc2Zvcm0uXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gb3ZlckFyZyhmdW5jLCB0cmFuc2Zvcm0pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiBmdW5jKHRyYW5zZm9ybShhcmcpKTtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgb3ZlckFyZztcbiIsImltcG9ydCBvdmVyQXJnIGZyb20gJy4vX292ZXJBcmcuanMnO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBnZXRQcm90b3R5cGUgPSBvdmVyQXJnKE9iamVjdC5nZXRQcm90b3R5cGVPZiwgT2JqZWN0KTtcblxuZXhwb3J0IGRlZmF1bHQgZ2V0UHJvdG90eXBlO1xuIiwiLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS4gQSB2YWx1ZSBpcyBvYmplY3QtbGlrZSBpZiBpdCdzIG5vdCBgbnVsbGBcbiAqIGFuZCBoYXMgYSBgdHlwZW9mYCByZXN1bHQgb2YgXCJvYmplY3RcIi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZSh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGlzT2JqZWN0TGlrZTtcbiIsImltcG9ydCBiYXNlR2V0VGFnIGZyb20gJy4vX2Jhc2VHZXRUYWcuanMnO1xuaW1wb3J0IGdldFByb3RvdHlwZSBmcm9tICcuL19nZXRQcm90b3R5cGUuanMnO1xuaW1wb3J0IGlzT2JqZWN0TGlrZSBmcm9tICcuL2lzT2JqZWN0TGlrZS5qcyc7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RUYWcgPSAnW29iamVjdCBPYmplY3RdJztcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZSxcbiAgICBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGRlY29tcGlsZWQgc291cmNlIG9mIGZ1bmN0aW9ucy4gKi9cbnZhciBmdW5jVG9TdHJpbmcgPSBmdW5jUHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBVc2VkIHRvIGluZmVyIHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3Rvci4gKi9cbnZhciBvYmplY3RDdG9yU3RyaW5nID0gZnVuY1RvU3RyaW5nLmNhbGwoT2JqZWN0KTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHBsYWluIG9iamVjdCwgdGhhdCBpcywgYW4gb2JqZWN0IGNyZWF0ZWQgYnkgdGhlXG4gKiBgT2JqZWN0YCBjb25zdHJ1Y3RvciBvciBvbmUgd2l0aCBhIGBbW1Byb3RvdHlwZV1dYCBvZiBgbnVsbGAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSAwLjguMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogfVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdChuZXcgRm9vKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc1BsYWluT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdCh7ICd4JzogMCwgJ3knOiAwIH0pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdChPYmplY3QuY3JlYXRlKG51bGwpKTtcbiAqIC8vID0+IHRydWVcbiAqL1xuZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICBpZiAoIWlzT2JqZWN0TGlrZSh2YWx1ZSkgfHwgYmFzZUdldFRhZyh2YWx1ZSkgIT0gb2JqZWN0VGFnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciBwcm90byA9IGdldFByb3RvdHlwZSh2YWx1ZSk7XG4gIGlmIChwcm90byA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHZhciBDdG9yID0gaGFzT3duUHJvcGVydHkuY2FsbChwcm90bywgJ2NvbnN0cnVjdG9yJykgJiYgcHJvdG8uY29uc3RydWN0b3I7XG4gIHJldHVybiB0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IgaW5zdGFuY2VvZiBDdG9yICYmXG4gICAgZnVuY1RvU3RyaW5nLmNhbGwoQ3RvcikgPT0gb2JqZWN0Q3RvclN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgaXNQbGFpbk9iamVjdDtcbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN5bWJvbE9ic2VydmFibGVQb255ZmlsbChyb290KSB7XG5cdHZhciByZXN1bHQ7XG5cdHZhciBTeW1ib2wgPSByb290LlN5bWJvbDtcblxuXHRpZiAodHlwZW9mIFN5bWJvbCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdGlmIChTeW1ib2wub2JzZXJ2YWJsZSkge1xuXHRcdFx0cmVzdWx0ID0gU3ltYm9sLm9ic2VydmFibGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdCA9IFN5bWJvbCgnb2JzZXJ2YWJsZScpO1xuXHRcdFx0U3ltYm9sLm9ic2VydmFibGUgPSByZXN1bHQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHJlc3VsdCA9ICdAQG9ic2VydmFibGUnO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn07XG4iLCIvKiBnbG9iYWwgd2luZG93ICovXG5pbXBvcnQgcG9ueWZpbGwgZnJvbSAnLi9wb255ZmlsbCc7XG5cbnZhciByb290O1xuXG5pZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG4gIHJvb3QgPSBzZWxmO1xufSBlbHNlIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICByb290ID0gd2luZG93O1xufSBlbHNlIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICByb290ID0gZ2xvYmFsO1xufSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICByb290ID0gbW9kdWxlO1xufSBlbHNlIHtcbiAgcm9vdCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG59XG5cbnZhciByZXN1bHQgPSBwb255ZmlsbChyb290KTtcbmV4cG9ydCBkZWZhdWx0IHJlc3VsdDtcbiIsImltcG9ydCBpc1BsYWluT2JqZWN0IGZyb20gJ2xvZGFzaC1lcy9pc1BsYWluT2JqZWN0JztcbmltcG9ydCAkJG9ic2VydmFibGUgZnJvbSAnc3ltYm9sLW9ic2VydmFibGUnO1xuXG4vKipcbiAqIFRoZXNlIGFyZSBwcml2YXRlIGFjdGlvbiB0eXBlcyByZXNlcnZlZCBieSBSZWR1eC5cbiAqIEZvciBhbnkgdW5rbm93biBhY3Rpb25zLCB5b3UgbXVzdCByZXR1cm4gdGhlIGN1cnJlbnQgc3RhdGUuXG4gKiBJZiB0aGUgY3VycmVudCBzdGF0ZSBpcyB1bmRlZmluZWQsIHlvdSBtdXN0IHJldHVybiB0aGUgaW5pdGlhbCBzdGF0ZS5cbiAqIERvIG5vdCByZWZlcmVuY2UgdGhlc2UgYWN0aW9uIHR5cGVzIGRpcmVjdGx5IGluIHlvdXIgY29kZS5cbiAqL1xuZXhwb3J0IHZhciBBY3Rpb25UeXBlcyA9IHtcbiAgSU5JVDogJ0BAcmVkdXgvSU5JVCdcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIFJlZHV4IHN0b3JlIHRoYXQgaG9sZHMgdGhlIHN0YXRlIHRyZWUuXG4gKiBUaGUgb25seSB3YXkgdG8gY2hhbmdlIHRoZSBkYXRhIGluIHRoZSBzdG9yZSBpcyB0byBjYWxsIGBkaXNwYXRjaCgpYCBvbiBpdC5cbiAqXG4gKiBUaGVyZSBzaG91bGQgb25seSBiZSBhIHNpbmdsZSBzdG9yZSBpbiB5b3VyIGFwcC4gVG8gc3BlY2lmeSBob3cgZGlmZmVyZW50XG4gKiBwYXJ0cyBvZiB0aGUgc3RhdGUgdHJlZSByZXNwb25kIHRvIGFjdGlvbnMsIHlvdSBtYXkgY29tYmluZSBzZXZlcmFsIHJlZHVjZXJzXG4gKiBpbnRvIGEgc2luZ2xlIHJlZHVjZXIgZnVuY3Rpb24gYnkgdXNpbmcgYGNvbWJpbmVSZWR1Y2Vyc2AuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVkdWNlciBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgbmV4dCBzdGF0ZSB0cmVlLCBnaXZlblxuICogdGhlIGN1cnJlbnQgc3RhdGUgdHJlZSBhbmQgdGhlIGFjdGlvbiB0byBoYW5kbGUuXG4gKlxuICogQHBhcmFtIHthbnl9IFtwcmVsb2FkZWRTdGF0ZV0gVGhlIGluaXRpYWwgc3RhdGUuIFlvdSBtYXkgb3B0aW9uYWxseSBzcGVjaWZ5IGl0XG4gKiB0byBoeWRyYXRlIHRoZSBzdGF0ZSBmcm9tIHRoZSBzZXJ2ZXIgaW4gdW5pdmVyc2FsIGFwcHMsIG9yIHRvIHJlc3RvcmUgYVxuICogcHJldmlvdXNseSBzZXJpYWxpemVkIHVzZXIgc2Vzc2lvbi5cbiAqIElmIHlvdSB1c2UgYGNvbWJpbmVSZWR1Y2Vyc2AgdG8gcHJvZHVjZSB0aGUgcm9vdCByZWR1Y2VyIGZ1bmN0aW9uLCB0aGlzIG11c3QgYmVcbiAqIGFuIG9iamVjdCB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGBjb21iaW5lUmVkdWNlcnNgIGtleXMuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZW5oYW5jZXIgVGhlIHN0b3JlIGVuaGFuY2VyLiBZb3UgbWF5IG9wdGlvbmFsbHkgc3BlY2lmeSBpdFxuICogdG8gZW5oYW5jZSB0aGUgc3RvcmUgd2l0aCB0aGlyZC1wYXJ0eSBjYXBhYmlsaXRpZXMgc3VjaCBhcyBtaWRkbGV3YXJlLFxuICogdGltZSB0cmF2ZWwsIHBlcnNpc3RlbmNlLCBldGMuIFRoZSBvbmx5IHN0b3JlIGVuaGFuY2VyIHRoYXQgc2hpcHMgd2l0aCBSZWR1eFxuICogaXMgYGFwcGx5TWlkZGxld2FyZSgpYC5cbiAqXG4gKiBAcmV0dXJucyB7U3RvcmV9IEEgUmVkdXggc3RvcmUgdGhhdCBsZXRzIHlvdSByZWFkIHRoZSBzdGF0ZSwgZGlzcGF0Y2ggYWN0aW9uc1xuICogYW5kIHN1YnNjcmliZSB0byBjaGFuZ2VzLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjcmVhdGVTdG9yZShyZWR1Y2VyLCBwcmVsb2FkZWRTdGF0ZSwgZW5oYW5jZXIpIHtcbiAgdmFyIF9yZWYyO1xuXG4gIGlmICh0eXBlb2YgcHJlbG9hZGVkU3RhdGUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGVuaGFuY2VyID09PSAndW5kZWZpbmVkJykge1xuICAgIGVuaGFuY2VyID0gcHJlbG9hZGVkU3RhdGU7XG4gICAgcHJlbG9hZGVkU3RhdGUgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAodHlwZW9mIGVuaGFuY2VyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgZW5oYW5jZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgdGhlIGVuaGFuY2VyIHRvIGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVuaGFuY2VyKGNyZWF0ZVN0b3JlKShyZWR1Y2VyLCBwcmVsb2FkZWRTdGF0ZSk7XG4gIH1cblxuICBpZiAodHlwZW9mIHJlZHVjZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRoZSByZWR1Y2VyIHRvIGJlIGEgZnVuY3Rpb24uJyk7XG4gIH1cblxuICB2YXIgY3VycmVudFJlZHVjZXIgPSByZWR1Y2VyO1xuICB2YXIgY3VycmVudFN0YXRlID0gcHJlbG9hZGVkU3RhdGU7XG4gIHZhciBjdXJyZW50TGlzdGVuZXJzID0gW107XG4gIHZhciBuZXh0TGlzdGVuZXJzID0gY3VycmVudExpc3RlbmVycztcbiAgdmFyIGlzRGlzcGF0Y2hpbmcgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBlbnN1cmVDYW5NdXRhdGVOZXh0TGlzdGVuZXJzKCkge1xuICAgIGlmIChuZXh0TGlzdGVuZXJzID09PSBjdXJyZW50TGlzdGVuZXJzKSB7XG4gICAgICBuZXh0TGlzdGVuZXJzID0gY3VycmVudExpc3RlbmVycy5zbGljZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkcyB0aGUgc3RhdGUgdHJlZSBtYW5hZ2VkIGJ5IHRoZSBzdG9yZS5cbiAgICpcbiAgICogQHJldHVybnMge2FueX0gVGhlIGN1cnJlbnQgc3RhdGUgdHJlZSBvZiB5b3VyIGFwcGxpY2F0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0U3RhdGUoKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRTdGF0ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgY2hhbmdlIGxpc3RlbmVyLiBJdCB3aWxsIGJlIGNhbGxlZCBhbnkgdGltZSBhbiBhY3Rpb24gaXMgZGlzcGF0Y2hlZCxcbiAgICogYW5kIHNvbWUgcGFydCBvZiB0aGUgc3RhdGUgdHJlZSBtYXkgcG90ZW50aWFsbHkgaGF2ZSBjaGFuZ2VkLiBZb3UgbWF5IHRoZW5cbiAgICogY2FsbCBgZ2V0U3RhdGUoKWAgdG8gcmVhZCB0aGUgY3VycmVudCBzdGF0ZSB0cmVlIGluc2lkZSB0aGUgY2FsbGJhY2suXG4gICAqXG4gICAqIFlvdSBtYXkgY2FsbCBgZGlzcGF0Y2goKWAgZnJvbSBhIGNoYW5nZSBsaXN0ZW5lciwgd2l0aCB0aGUgZm9sbG93aW5nXG4gICAqIGNhdmVhdHM6XG4gICAqXG4gICAqIDEuIFRoZSBzdWJzY3JpcHRpb25zIGFyZSBzbmFwc2hvdHRlZCBqdXN0IGJlZm9yZSBldmVyeSBgZGlzcGF0Y2goKWAgY2FsbC5cbiAgICogSWYgeW91IHN1YnNjcmliZSBvciB1bnN1YnNjcmliZSB3aGlsZSB0aGUgbGlzdGVuZXJzIGFyZSBiZWluZyBpbnZva2VkLCB0aGlzXG4gICAqIHdpbGwgbm90IGhhdmUgYW55IGVmZmVjdCBvbiB0aGUgYGRpc3BhdGNoKClgIHRoYXQgaXMgY3VycmVudGx5IGluIHByb2dyZXNzLlxuICAgKiBIb3dldmVyLCB0aGUgbmV4dCBgZGlzcGF0Y2goKWAgY2FsbCwgd2hldGhlciBuZXN0ZWQgb3Igbm90LCB3aWxsIHVzZSBhIG1vcmVcbiAgICogcmVjZW50IHNuYXBzaG90IG9mIHRoZSBzdWJzY3JpcHRpb24gbGlzdC5cbiAgICpcbiAgICogMi4gVGhlIGxpc3RlbmVyIHNob3VsZCBub3QgZXhwZWN0IHRvIHNlZSBhbGwgc3RhdGUgY2hhbmdlcywgYXMgdGhlIHN0YXRlXG4gICAqIG1pZ2h0IGhhdmUgYmVlbiB1cGRhdGVkIG11bHRpcGxlIHRpbWVzIGR1cmluZyBhIG5lc3RlZCBgZGlzcGF0Y2goKWAgYmVmb3JlXG4gICAqIHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQuIEl0IGlzLCBob3dldmVyLCBndWFyYW50ZWVkIHRoYXQgYWxsIHN1YnNjcmliZXJzXG4gICAqIHJlZ2lzdGVyZWQgYmVmb3JlIHRoZSBgZGlzcGF0Y2goKWAgc3RhcnRlZCB3aWxsIGJlIGNhbGxlZCB3aXRoIHRoZSBsYXRlc3RcbiAgICogc3RhdGUgYnkgdGhlIHRpbWUgaXQgZXhpdHMuXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEEgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCBvbiBldmVyeSBkaXNwYXRjaC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGlzIGNoYW5nZSBsaXN0ZW5lci5cbiAgICovXG4gIGZ1bmN0aW9uIHN1YnNjcmliZShsaXN0ZW5lcikge1xuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgbGlzdGVuZXIgdG8gYmUgYSBmdW5jdGlvbi4nKTtcbiAgICB9XG5cbiAgICB2YXIgaXNTdWJzY3JpYmVkID0gdHJ1ZTtcblxuICAgIGVuc3VyZUNhbk11dGF0ZU5leHRMaXN0ZW5lcnMoKTtcbiAgICBuZXh0TGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIHVuc3Vic2NyaWJlKCkge1xuICAgICAgaWYgKCFpc1N1YnNjcmliZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpc1N1YnNjcmliZWQgPSBmYWxzZTtcblxuICAgICAgZW5zdXJlQ2FuTXV0YXRlTmV4dExpc3RlbmVycygpO1xuICAgICAgdmFyIGluZGV4ID0gbmV4dExpc3RlbmVycy5pbmRleE9mKGxpc3RlbmVyKTtcbiAgICAgIG5leHRMaXN0ZW5lcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIERpc3BhdGNoZXMgYW4gYWN0aW9uLiBJdCBpcyB0aGUgb25seSB3YXkgdG8gdHJpZ2dlciBhIHN0YXRlIGNoYW5nZS5cbiAgICpcbiAgICogVGhlIGByZWR1Y2VyYCBmdW5jdGlvbiwgdXNlZCB0byBjcmVhdGUgdGhlIHN0b3JlLCB3aWxsIGJlIGNhbGxlZCB3aXRoIHRoZVxuICAgKiBjdXJyZW50IHN0YXRlIHRyZWUgYW5kIHRoZSBnaXZlbiBgYWN0aW9uYC4gSXRzIHJldHVybiB2YWx1ZSB3aWxsXG4gICAqIGJlIGNvbnNpZGVyZWQgdGhlICoqbmV4dCoqIHN0YXRlIG9mIHRoZSB0cmVlLCBhbmQgdGhlIGNoYW5nZSBsaXN0ZW5lcnNcbiAgICogd2lsbCBiZSBub3RpZmllZC5cbiAgICpcbiAgICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb25seSBzdXBwb3J0cyBwbGFpbiBvYmplY3QgYWN0aW9ucy4gSWYgeW91IHdhbnQgdG9cbiAgICogZGlzcGF0Y2ggYSBQcm9taXNlLCBhbiBPYnNlcnZhYmxlLCBhIHRodW5rLCBvciBzb21ldGhpbmcgZWxzZSwgeW91IG5lZWQgdG9cbiAgICogd3JhcCB5b3VyIHN0b3JlIGNyZWF0aW5nIGZ1bmN0aW9uIGludG8gdGhlIGNvcnJlc3BvbmRpbmcgbWlkZGxld2FyZS4gRm9yXG4gICAqIGV4YW1wbGUsIHNlZSB0aGUgZG9jdW1lbnRhdGlvbiBmb3IgdGhlIGByZWR1eC10aHVua2AgcGFja2FnZS4gRXZlbiB0aGVcbiAgICogbWlkZGxld2FyZSB3aWxsIGV2ZW50dWFsbHkgZGlzcGF0Y2ggcGxhaW4gb2JqZWN0IGFjdGlvbnMgdXNpbmcgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBhY3Rpb24gQSBwbGFpbiBvYmplY3QgcmVwcmVzZW50aW5nIOKAnHdoYXQgY2hhbmdlZOKAnS4gSXQgaXNcbiAgICogYSBnb29kIGlkZWEgdG8ga2VlcCBhY3Rpb25zIHNlcmlhbGl6YWJsZSBzbyB5b3UgY2FuIHJlY29yZCBhbmQgcmVwbGF5IHVzZXJcbiAgICogc2Vzc2lvbnMsIG9yIHVzZSB0aGUgdGltZSB0cmF2ZWxsaW5nIGByZWR1eC1kZXZ0b29sc2AuIEFuIGFjdGlvbiBtdXN0IGhhdmVcbiAgICogYSBgdHlwZWAgcHJvcGVydHkgd2hpY2ggbWF5IG5vdCBiZSBgdW5kZWZpbmVkYC4gSXQgaXMgYSBnb29kIGlkZWEgdG8gdXNlXG4gICAqIHN0cmluZyBjb25zdGFudHMgZm9yIGFjdGlvbiB0eXBlcy5cbiAgICpcbiAgICogQHJldHVybnMge09iamVjdH0gRm9yIGNvbnZlbmllbmNlLCB0aGUgc2FtZSBhY3Rpb24gb2JqZWN0IHlvdSBkaXNwYXRjaGVkLlxuICAgKlxuICAgKiBOb3RlIHRoYXQsIGlmIHlvdSB1c2UgYSBjdXN0b20gbWlkZGxld2FyZSwgaXQgbWF5IHdyYXAgYGRpc3BhdGNoKClgIHRvXG4gICAqIHJldHVybiBzb21ldGhpbmcgZWxzZSAoZm9yIGV4YW1wbGUsIGEgUHJvbWlzZSB5b3UgY2FuIGF3YWl0KS5cbiAgICovXG4gIGZ1bmN0aW9uIGRpc3BhdGNoKGFjdGlvbikge1xuICAgIGlmICghaXNQbGFpbk9iamVjdChhY3Rpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FjdGlvbnMgbXVzdCBiZSBwbGFpbiBvYmplY3RzLiAnICsgJ1VzZSBjdXN0b20gbWlkZGxld2FyZSBmb3IgYXN5bmMgYWN0aW9ucy4nKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFjdGlvbi50eXBlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBY3Rpb25zIG1heSBub3QgaGF2ZSBhbiB1bmRlZmluZWQgXCJ0eXBlXCIgcHJvcGVydHkuICcgKyAnSGF2ZSB5b3UgbWlzc3BlbGxlZCBhIGNvbnN0YW50PycpO1xuICAgIH1cblxuICAgIGlmIChpc0Rpc3BhdGNoaW5nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlZHVjZXJzIG1heSBub3QgZGlzcGF0Y2ggYWN0aW9ucy4nKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgaXNEaXNwYXRjaGluZyA9IHRydWU7XG4gICAgICBjdXJyZW50U3RhdGUgPSBjdXJyZW50UmVkdWNlcihjdXJyZW50U3RhdGUsIGFjdGlvbik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGlzRGlzcGF0Y2hpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgbGlzdGVuZXJzID0gY3VycmVudExpc3RlbmVycyA9IG5leHRMaXN0ZW5lcnM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxpc3RlbmVyc1tpXSgpO1xuICAgIH1cblxuICAgIHJldHVybiBhY3Rpb247XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgdGhlIHJlZHVjZXIgY3VycmVudGx5IHVzZWQgYnkgdGhlIHN0b3JlIHRvIGNhbGN1bGF0ZSB0aGUgc3RhdGUuXG4gICAqXG4gICAqIFlvdSBtaWdodCBuZWVkIHRoaXMgaWYgeW91ciBhcHAgaW1wbGVtZW50cyBjb2RlIHNwbGl0dGluZyBhbmQgeW91IHdhbnQgdG9cbiAgICogbG9hZCBzb21lIG9mIHRoZSByZWR1Y2VycyBkeW5hbWljYWxseS4gWW91IG1pZ2h0IGFsc28gbmVlZCB0aGlzIGlmIHlvdVxuICAgKiBpbXBsZW1lbnQgYSBob3QgcmVsb2FkaW5nIG1lY2hhbmlzbSBmb3IgUmVkdXguXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG5leHRSZWR1Y2VyIFRoZSByZWR1Y2VyIGZvciB0aGUgc3RvcmUgdG8gdXNlIGluc3RlYWQuXG4gICAqIEByZXR1cm5zIHt2b2lkfVxuICAgKi9cbiAgZnVuY3Rpb24gcmVwbGFjZVJlZHVjZXIobmV4dFJlZHVjZXIpIHtcbiAgICBpZiAodHlwZW9mIG5leHRSZWR1Y2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRoZSBuZXh0UmVkdWNlciB0byBiZSBhIGZ1bmN0aW9uLicpO1xuICAgIH1cblxuICAgIGN1cnJlbnRSZWR1Y2VyID0gbmV4dFJlZHVjZXI7XG4gICAgZGlzcGF0Y2goeyB0eXBlOiBBY3Rpb25UeXBlcy5JTklUIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEludGVyb3BlcmFiaWxpdHkgcG9pbnQgZm9yIG9ic2VydmFibGUvcmVhY3RpdmUgbGlicmFyaWVzLlxuICAgKiBAcmV0dXJucyB7b2JzZXJ2YWJsZX0gQSBtaW5pbWFsIG9ic2VydmFibGUgb2Ygc3RhdGUgY2hhbmdlcy5cbiAgICogRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSB0aGUgb2JzZXJ2YWJsZSBwcm9wb3NhbDpcbiAgICogaHR0cHM6Ly9naXRodWIuY29tL3plbnBhcnNpbmcvZXMtb2JzZXJ2YWJsZVxuICAgKi9cbiAgZnVuY3Rpb24gb2JzZXJ2YWJsZSgpIHtcbiAgICB2YXIgX3JlZjtcblxuICAgIHZhciBvdXRlclN1YnNjcmliZSA9IHN1YnNjcmliZTtcbiAgICByZXR1cm4gX3JlZiA9IHtcbiAgICAgIC8qKlxuICAgICAgICogVGhlIG1pbmltYWwgb2JzZXJ2YWJsZSBzdWJzY3JpcHRpb24gbWV0aG9kLlxuICAgICAgICogQHBhcmFtIHtPYmplY3R9IG9ic2VydmVyIEFueSBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCBhcyBhbiBvYnNlcnZlci5cbiAgICAgICAqIFRoZSBvYnNlcnZlciBvYmplY3Qgc2hvdWxkIGhhdmUgYSBgbmV4dGAgbWV0aG9kLlxuICAgICAgICogQHJldHVybnMge3N1YnNjcmlwdGlvbn0gQW4gb2JqZWN0IHdpdGggYW4gYHVuc3Vic2NyaWJlYCBtZXRob2QgdGhhdCBjYW5cbiAgICAgICAqIGJlIHVzZWQgdG8gdW5zdWJzY3JpYmUgdGhlIG9ic2VydmFibGUgZnJvbSB0aGUgc3RvcmUsIGFuZCBwcmV2ZW50IGZ1cnRoZXJcbiAgICAgICAqIGVtaXNzaW9uIG9mIHZhbHVlcyBmcm9tIHRoZSBvYnNlcnZhYmxlLlxuICAgICAgICovXG4gICAgICBzdWJzY3JpYmU6IGZ1bmN0aW9uIHN1YnNjcmliZShvYnNlcnZlcikge1xuICAgICAgICBpZiAodHlwZW9mIG9ic2VydmVyICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIHRoZSBvYnNlcnZlciB0byBiZSBhbiBvYmplY3QuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBvYnNlcnZlU3RhdGUoKSB7XG4gICAgICAgICAgaWYgKG9ic2VydmVyLm5leHQpIHtcbiAgICAgICAgICAgIG9ic2VydmVyLm5leHQoZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZVN0YXRlKCk7XG4gICAgICAgIHZhciB1bnN1YnNjcmliZSA9IG91dGVyU3Vic2NyaWJlKG9ic2VydmVTdGF0ZSk7XG4gICAgICAgIHJldHVybiB7IHVuc3Vic2NyaWJlOiB1bnN1YnNjcmliZSB9O1xuICAgICAgfVxuICAgIH0sIF9yZWZbJCRvYnNlcnZhYmxlXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sIF9yZWY7XG4gIH1cblxuICAvLyBXaGVuIGEgc3RvcmUgaXMgY3JlYXRlZCwgYW4gXCJJTklUXCIgYWN0aW9uIGlzIGRpc3BhdGNoZWQgc28gdGhhdCBldmVyeVxuICAvLyByZWR1Y2VyIHJldHVybnMgdGhlaXIgaW5pdGlhbCBzdGF0ZS4gVGhpcyBlZmZlY3RpdmVseSBwb3B1bGF0ZXNcbiAgLy8gdGhlIGluaXRpYWwgc3RhdGUgdHJlZS5cbiAgZGlzcGF0Y2goeyB0eXBlOiBBY3Rpb25UeXBlcy5JTklUIH0pO1xuXG4gIHJldHVybiBfcmVmMiA9IHtcbiAgICBkaXNwYXRjaDogZGlzcGF0Y2gsXG4gICAgc3Vic2NyaWJlOiBzdWJzY3JpYmUsXG4gICAgZ2V0U3RhdGU6IGdldFN0YXRlLFxuICAgIHJlcGxhY2VSZWR1Y2VyOiByZXBsYWNlUmVkdWNlclxuICB9LCBfcmVmMlskJG9ic2VydmFibGVdID0gb2JzZXJ2YWJsZSwgX3JlZjI7XG59IiwiLyoqXG4gKiBQcmludHMgYSB3YXJuaW5nIGluIHRoZSBjb25zb2xlIGlmIGl0IGV4aXN0cy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBUaGUgd2FybmluZyBtZXNzYWdlLlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHdhcm5pbmcobWVzc2FnZSkge1xuICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG4gIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGNvbnNvbGUuZXJyb3IgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UpO1xuICB9XG4gIC8qIGVzbGludC1lbmFibGUgbm8tY29uc29sZSAqL1xuICB0cnkge1xuICAgIC8vIFRoaXMgZXJyb3Igd2FzIHRocm93biBhcyBhIGNvbnZlbmllbmNlIHNvIHRoYXQgaWYgeW91IGVuYWJsZVxuICAgIC8vIFwiYnJlYWsgb24gYWxsIGV4Y2VwdGlvbnNcIiBpbiB5b3VyIGNvbnNvbGUsXG4gICAgLy8gaXQgd291bGQgcGF1c2UgdGhlIGV4ZWN1dGlvbiBhdCB0aGlzIGxpbmUuXG4gICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWVtcHR5ICovXG4gIH0gY2F0Y2ggKGUpIHt9XG4gIC8qIGVzbGludC1lbmFibGUgbm8tZW1wdHkgKi9cbn0iLCIvKipcbiAqIENvbXBvc2VzIHNpbmdsZS1hcmd1bWVudCBmdW5jdGlvbnMgZnJvbSByaWdodCB0byBsZWZ0LiBUaGUgcmlnaHRtb3N0XG4gKiBmdW5jdGlvbiBjYW4gdGFrZSBtdWx0aXBsZSBhcmd1bWVudHMgYXMgaXQgcHJvdmlkZXMgdGhlIHNpZ25hdHVyZSBmb3JcbiAqIHRoZSByZXN1bHRpbmcgY29tcG9zaXRlIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7Li4uRnVuY3Rpb259IGZ1bmNzIFRoZSBmdW5jdGlvbnMgdG8gY29tcG9zZS5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gQSBmdW5jdGlvbiBvYnRhaW5lZCBieSBjb21wb3NpbmcgdGhlIGFyZ3VtZW50IGZ1bmN0aW9uc1xuICogZnJvbSByaWdodCB0byBsZWZ0LiBGb3IgZXhhbXBsZSwgY29tcG9zZShmLCBnLCBoKSBpcyBpZGVudGljYWwgdG8gZG9pbmdcbiAqICguLi5hcmdzKSA9PiBmKGcoaCguLi5hcmdzKSkpLlxuICovXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNvbXBvc2UoKSB7XG4gIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBmdW5jcyA9IEFycmF5KF9sZW4pLCBfa2V5ID0gMDsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgIGZ1bmNzW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICB9XG5cbiAgaWYgKGZ1bmNzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoYXJnKSB7XG4gICAgICByZXR1cm4gYXJnO1xuICAgIH07XG4gIH1cblxuICBpZiAoZnVuY3MubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGZ1bmNzWzBdO1xuICB9XG5cbiAgdmFyIGxhc3QgPSBmdW5jc1tmdW5jcy5sZW5ndGggLSAxXTtcbiAgdmFyIHJlc3QgPSBmdW5jcy5zbGljZSgwLCAtMSk7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHJlc3QucmVkdWNlUmlnaHQoZnVuY3Rpb24gKGNvbXBvc2VkLCBmKSB7XG4gICAgICByZXR1cm4gZihjb21wb3NlZCk7XG4gICAgfSwgbGFzdC5hcHBseSh1bmRlZmluZWQsIGFyZ3VtZW50cykpO1xuICB9O1xufSIsImltcG9ydCBjcmVhdGVTdG9yZSBmcm9tICcuL2NyZWF0ZVN0b3JlJztcbmltcG9ydCBjb21iaW5lUmVkdWNlcnMgZnJvbSAnLi9jb21iaW5lUmVkdWNlcnMnO1xuaW1wb3J0IGJpbmRBY3Rpb25DcmVhdG9ycyBmcm9tICcuL2JpbmRBY3Rpb25DcmVhdG9ycyc7XG5pbXBvcnQgYXBwbHlNaWRkbGV3YXJlIGZyb20gJy4vYXBwbHlNaWRkbGV3YXJlJztcbmltcG9ydCBjb21wb3NlIGZyb20gJy4vY29tcG9zZSc7XG5pbXBvcnQgd2FybmluZyBmcm9tICcuL3V0aWxzL3dhcm5pbmcnO1xuXG4vKlxuKiBUaGlzIGlzIGEgZHVtbXkgZnVuY3Rpb24gdG8gY2hlY2sgaWYgdGhlIGZ1bmN0aW9uIG5hbWUgaGFzIGJlZW4gYWx0ZXJlZCBieSBtaW5pZmljYXRpb24uXG4qIElmIHRoZSBmdW5jdGlvbiBoYXMgYmVlbiBtaW5pZmllZCBhbmQgTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJywgd2FybiB0aGUgdXNlci5cbiovXG5mdW5jdGlvbiBpc0NydXNoZWQoKSB7fVxuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0eXBlb2YgaXNDcnVzaGVkLm5hbWUgPT09ICdzdHJpbmcnICYmIGlzQ3J1c2hlZC5uYW1lICE9PSAnaXNDcnVzaGVkJykge1xuICB3YXJuaW5nKCdZb3UgYXJlIGN1cnJlbnRseSB1c2luZyBtaW5pZmllZCBjb2RlIG91dHNpZGUgb2YgTk9ERV9FTlYgPT09IFxcJ3Byb2R1Y3Rpb25cXCcuICcgKyAnVGhpcyBtZWFucyB0aGF0IHlvdSBhcmUgcnVubmluZyBhIHNsb3dlciBkZXZlbG9wbWVudCBidWlsZCBvZiBSZWR1eC4gJyArICdZb3UgY2FuIHVzZSBsb29zZS1lbnZpZnkgKGh0dHBzOi8vZ2l0aHViLmNvbS96ZXJ0b3NoL2xvb3NlLWVudmlmeSkgZm9yIGJyb3dzZXJpZnkgJyArICdvciBEZWZpbmVQbHVnaW4gZm9yIHdlYnBhY2sgKGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzAwMzAwMzEpICcgKyAndG8gZW5zdXJlIHlvdSBoYXZlIHRoZSBjb3JyZWN0IGNvZGUgZm9yIHlvdXIgcHJvZHVjdGlvbiBidWlsZC4nKTtcbn1cblxuZXhwb3J0IHsgY3JlYXRlU3RvcmUsIGNvbWJpbmVSZWR1Y2VycywgYmluZEFjdGlvbkNyZWF0b3JzLCBhcHBseU1pZGRsZXdhcmUsIGNvbXBvc2UgfTsiLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7aCwgY29ubmVjdCwgbW91bnR9IGZyb20gJy4uL2luZGV4JztcbmltcG9ydCB7Y3JlYXRlU3RvcmV9IGZyb20gJ3JlZHV4JztcbmltcG9ydCB7d2FpdE5leHRUaWNrfSBmcm9tICcuL3Rlc3RVdGlsJztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdzaG91bGQgY29ubmVjdCBhIGNvbXBvbmVudCB0byBjaGFuZ2VzIG9mIHJlZHV4IHN0YXRlJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IHN0b3JlID0gY3JlYXRlU3RvcmUoKHN0YXRlLCBhY3Rpb24pID0+ICh7dmFsdWU6IGFjdGlvbi52YWx1ZX0pKTtcbiAgICBjb25zdCBDb21wID0gY29ubmVjdChzdG9yZSkocHJvcHMgPT4ge1xuICAgICAgcmV0dXJuIDxzcGFuPntwcm9wcy52YWx1ZX08L3NwYW4+XG4gICAgfSk7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbW91bnQoPENvbXAgLz4sIHt9LCBjb250YWluZXIpO1xuICAgIHlpZWxkIHdhaXROZXh0VGljaygpO1xuICAgIHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnd2hhdGV2ZXInLCB2YWx1ZTogJ2JsYWgnfSk7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHNwYW4+YmxhaDwvc3Bhbj4nKTtcbiAgICBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3doYXRldmVyJywgdmFsdWU6ICd3b290J30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxzcGFuPndvb3Q8L3NwYW4+Jyk7XG4gIH0pXG4gIC50ZXN0KCdzaG91bGQgY29ubmVjdCBhIGNvbXBvbmVudCB0byBjaGFuZ2VzIG9mIGEgc2xpY2Ugb2YgYSByZWR1eCBzdGF0ZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBzdG9yZSA9IGNyZWF0ZVN0b3JlKChzdGF0ZSA9IHt3b290OiB7dmFsdWU6ICdmb28nfSwgb3RoZXI6IHt2YWx1ZUJpczogJ2JsYWgnfX0sIGFjdGlvbikgPT4ge1xuICAgICAgY29uc3Qge3R5cGV9ID0gYWN0aW9uO1xuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgJ1dPT1QnOlxuICAgICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCB7d29vdDoge3ZhbHVlOiBhY3Rpb24udmFsdWV9fSk7XG4gICAgICAgIGNhc2UgJ05PVF9XT09UJzpcbiAgICAgICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwge290aGVyOiB7dmFsdWVCaXM6ICdhbm90aGVyX29uZSd9fSk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IENvbXAgPSBjb25uZWN0KHN0b3JlLCBzdGF0ZSA9PiBzdGF0ZS53b290KShwcm9wcyA9PiB7XG4gICAgICByZXR1cm4gPHNwYW4+e3Byb3BzLnZhbHVlfTwvc3Bhbj5cbiAgICB9KTtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBtb3VudCg8Q29tcCAvPiwge30sIGNvbnRhaW5lcik7XG4gICAgeWllbGQgd2FpdE5leHRUaWNrKCk7XG4gICAgc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICd3aGF0ZXZlcicsIHZhbHVlOiAnYmxhaCd9KTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8c3Bhbj5mb288L3NwYW4+Jyk7XG4gICAgc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdOT1RfV09PVCcsIHZhbHVlOiAnYmxhaCd9KTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8c3Bhbj5mb288L3NwYW4+Jyk7XG4gICAgc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdXT09UJywgdmFsdWU6ICdiaXAnfSk7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHNwYW4+YmlwPC9zcGFuPicpO1xuICB9KVxuICAudGVzdCgnc2hvdWxkIGdpdmUgYSBjb25kaXRpb24gdG8gdXBkYXRlIGEgY29ubmVjdGVkIGNvbXBvbmVudCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBzdG9yZSA9IGNyZWF0ZVN0b3JlKChzdGF0ZSwgYWN0aW9uKSA9PiAoe3ZhbHVlOiBhY3Rpb24udmFsdWV9KSk7XG4gICAgY29uc3QgQ29tcCA9IGNvbm5lY3Qoc3RvcmUpKHByb3BzID0+IHtcbiAgICAgIHJldHVybiA8c3Bhbj57cHJvcHMudmFsdWV9PC9zcGFuPlxuICAgIH0sIHN0YXRlID0+IHN0YXRlLCAob2xkU3RhdGUgPSB7dmFsdWU6ICdhJ30sIG5ld1N0YXRlID0ge30pID0+IHtcbiAgICAgIHJldHVybiBuZXdTdGF0ZS52YWx1ZSA+IG9sZFN0YXRlLnZhbHVlO1xuICAgIH0pO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG1vdW50KDxDb21wIC8+LCB7fSwgY29udGFpbmVyKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3doYXRldmVyJywgdmFsdWU6ICdibGFoJ30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxzcGFuPmJsYWg8L3NwYW4+Jyk7XG4gICAgc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICd3aGF0ZXZlcicsIHZhbHVlOiAnYWFhJ30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxzcGFuPmJsYWg8L3NwYW4+Jyk7XG4gICAgc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICd3aGF0ZXZlcicsIHZhbHVlOiAnenp6J30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxzcGFuPnp6ejwvc3Bhbj4nKTtcbiAgfSk7XG4iLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB1dGlsIGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgZG9tVXRpbCBmcm9tICcuL2RvbVV0aWwnO1xuaW1wb3J0IGggZnJvbSAnLi9oJztcbmltcG9ydCBsaWZlY3ljbGVzIGZyb20gJy4vbGlmZWN5Y2xlcyc7XG5pbXBvcnQgcmVuZGVyIGZyb20gJy4vcmVuZGVyJztcbmltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnXG5pbXBvcnQgd2l0aFN0YXRlIGZyb20gJy4vd2l0aFN0YXRlJztcbmltcG9ydCBjb25uZWN0IGZyb20gJy4vY29ubmVjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCh1dGlsKVxuICAudGVzdChkb21VdGlsKVxuICAudGVzdChoKVxuICAudGVzdChsaWZlY3ljbGVzKVxuICAudGVzdChyZW5kZXIpXG4gIC50ZXN0KHVwZGF0ZSlcbiAgLnRlc3Qod2l0aFN0YXRlKVxuICAudGVzdChjb25uZWN0KVxuICAucnVuKCk7XG4iXSwibmFtZXMiOlsiaW5kZXgiLCJpbmRleCQxIiwicGxhbiIsInpvcmEiLCJ0YXAiLCJoIiwibW91bnQiLCJ1cGRhdGUiLCJTeW1ib2wiLCJvYmplY3RQcm90byIsImhhc093blByb3BlcnR5Iiwic3ltVG9TdHJpbmdUYWciLCJuYXRpdmVPYmplY3RUb1N0cmluZyIsInJvb3QiLCJwb255ZmlsbCIsIiQkb2JzZXJ2YWJsZSIsInJlbmRlciIsIndpdGhTdGF0ZSIsImNvbm5lY3QiXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7O0FBSUEsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7Ozs7OztBQU1sQyxJQUFJQSxPQUFLLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDOzs7Ozs7Ozs7Ozs7OztBQWN2QyxFQUFFLENBQUMsSUFBSSxHQUFHLFVBQVUsRUFBRSxFQUFFO0VBQ3RCLGFBQWEsQ0FBQyxxQkFBcUIsR0FBRyxFQUFFLENBQUM7RUFDekMsT0FBTyxhQUFhLENBQUM7RUFDckIsU0FBUyxhQUFhLEdBQUc7SUFDdkIsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO0dBQ2pEO0NBQ0YsQ0FBQzs7Ozs7Ozs7Ozs7QUFXRixTQUFTLEVBQUUsQ0FBQyxHQUFHLEVBQUU7RUFDZixJQUFJLEdBQUcs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RUFBRTtHQUNsQixJQUFJLENBQUMsMEJBQTBCLEVBQUUsWUFBWSxDQUFDLEVBQUU7SUFDL0MsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoRCxNQUFNLElBQUksR0FBRyxDQUFDLEtBQUssTUFBTUUsS0FBQyxVQUFFLEVBQUNBLEtBQUMsVUFBSyxFQUFFLEVBQUMsS0FBTSxDQUFDLEVBQUUsRUFBQyxFQUFDLEtBQU0sQ0FBQyxRQUFRLENBQVEsRUFBSyxDQUFDLENBQUM7SUFDL0UsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLGFBQWEsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzNELENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSw0Q0FBNEMsQ0FBQyxDQUFDO0dBQzVFLENBQUM7R0FDRCxJQUFJLENBQUMsMEJBQTBCLEVBQUUsWUFBWSxDQUFDLEVBQUU7SUFDL0MsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoRCxNQUFNLElBQUksR0FBRyxDQUFDLEtBQUssTUFBTUEsS0FBQyxVQUFFLEVBQUNBLEtBQUMsVUFBSyxFQUFFLEVBQUMsS0FBTSxDQUFDLEVBQUUsRUFBQyxFQUFDLEtBQU0sQ0FBQyxRQUFRLENBQVEsRUFBSyxDQUFDLENBQUM7SUFDL0UsTUFBTSxTQUFTLEdBQUcsQ0FBQyxLQUFLLE1BQU1BLEtBQUMsZUFBTztNQUNwQ0EsS0FBQyxJQUFJLElBQUMsRUFBRSxFQUFDLEtBQUssRUFBQyxRQUFRLEVBQUMsV0FBVyxFQUFBLENBQUU7S0FDN0IsQ0FBQyxDQUFDO0lBQ1osS0FBSyxDQUFDLFNBQVMsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDaEMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLDZEQUE2RCxDQUFDLENBQUM7R0FDN0YsQ0FBQztHQUNELElBQUksQ0FB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
