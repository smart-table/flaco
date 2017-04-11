var test = (function () {
'use strict';

/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

var index$2 = co['default'] = co.co = co;

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
    return index$2(this.coroutine(assert))
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
    return index$2(function * () {
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





const noop = () => {
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

const createDomNode = vnode => {
  return vnode.nodeType !== 'Text' ?
    document.createElement(vnode.nodeType) :
    document.createTextNode(String(vnode.props.value));
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
  // .test('create text dom node', function * (t) {
  //   document = document || {
  //       createElement: (arg) => {
  //         return {element: arg};
  //       },
  //       createTextNode: (arg) => {
  //         return {text: arg};
  //       }
  //     };
  //   const n = createDomNode({nodeType:'Text',props:{value:'foo'}});
  //   t.deepEqual(n,{text:'foo'});
  // })

const createTextVNode = (value) => ({
  nodeType: 'Text',
  children: [],
  props: {value}
});

/**
 * Transform hyperscript into virtual dom node
 * @param nodeType
 * @param props
 * @param children
 * @returns {*}
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
      children: flatChildren
    };
  } else {
    const fullProps = Object.assign({children: flatChildren}, props);
    const comp = nodeType(fullProps);
    return typeof comp !== 'function' ? comp : h$1(comp, props, ...flatChildren); //functional comp vs combinator (HOC)
  }
}

function updateEventListeners ({props:newNodeProps}={}, {props:oldNodeProps}={}) {
  const newNodeEvents = getEventListeners(newNodeProps || {});
  const oldNodeEvents = getEventListeners(oldNodeProps || {});

  return newNodeEvents.length || oldNodeEvents.length ?
    compose(
      removeEventListeners(oldNodeEvents),
      addEventListeners(newNodeEvents)
    ) : noop;
}

function updateAttributes (newVNode, oldVNode) {
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
}

const domFactory = createDomNode;

// apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
const domify = function updateDom (oldVnode, newVnode, parentDomNode) {
  if (!oldVnode) {//there is no previous vnode
    if (newVnode) {//new node => we insert
      newVnode.dom = parentDomNode.appendChild(domFactory(newVnode));
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
      newVnode.dom = domFactory(newVnode);
      newVnode.lifeCycle = 1;
      parentDomNode.replaceChild(newVnode.dom, oldVnode.dom);
      return {garbage: oldVnode, vnode: newVnode};
    } else {// only update attributes
      newVnode.dom = oldVnode.dom;
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
const render = function renderer (oldVnode, newVnode, parentDomNode, onNextTick = []) {

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

const mount = curry(function (comp, initProp, root) {
  const vnode = comp.nodeType !== void 0 ? comp : comp(initProp || {});
  const batch = render(null, vnode, root);
  nextTick(function () {
    for (let op of batch) {
      op();
    }
  });
  return vnode;
});

/**
 * Create a function which will trigger an update of the component with the passed state
 * @param comp
 * @param initialVNode
 * @returns {function(*=, ...[*])}
 */
function update (comp, initialVNode) {
  let oldNode = initialVNode;
  const updateFunc = (props, ...args) => {
    const mount$$1 = oldNode.dom.parentNode;
    const newNode = comp(Object.assign({children: oldNode.children || []}, oldNode.props, props), ...args);
    const nextBatch = render(oldNode, newNode, mount$$1);

    // danger zone !!!!
    // change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream: oldNode may be the child of someone ...(well that is a tree data structure after all :P )
    oldNode = Object.assign(oldNode || {}, newNode);
    // end danger zone

    nextTick(function () {
      for (let op of nextBatch) {
        op();
      }
    });
    return newNode;
  };
  return updateFunc;
}

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

const onUpdate = lifeCycleFactory('onUpdate');

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp
 * @returns {Function}
 */
var withState = function (comp) {
  return function () {
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
};

//todo throw this in favor of connect only ?

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change under specific circumstances
 */

var h$$1 = plan$1()
  .test('create regular html node', function * (t) {
    const vnode = h$1('div', {id: 'someId', "class": 'special'});
    t.deepEqual(vnode, {nodeType: 'div', props: {id: 'someId', "class": 'special'}, children: []});
  })
  .test('create regular html node with text node children', function * (t) {
    const vnode = h$1('div', {id: 'someId', "class": 'special'}, 'foo');
    t.deepEqual(vnode, {
      nodeType: 'div', props: {id: 'someId', "class": 'special'}, children: [{
        nodeType: 'Text',
        children: [],
        props: {value: 'foo'}
      }]
    });
  })
  .test('create regular html with children', function * (t) {
    const vnode = h$1('ul', {id: 'collection'}, h$1('li', {id: 1}, 'item1'), h$1('li', {id: 2}, 'item2'));
    t.deepEqual(vnode, {
      nodeType: 'ul',
      props: {id: 'collection'},
      children: [
        {
          nodeType: 'li',
          props: {id: 1},
          children: [{
            nodeType: 'Text',
            props: {value: 'item1'},
            children: []
          }]
        }, {
          nodeType: 'li',
          props: {id: 2},
          children: [{
            nodeType: 'Text',
            props: {value: 'item2'},
            children: []
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
      props: {
        children: [{
          nodeType: 'Text',
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
    t.deepEqual(vnode, {nodeType: 'p', props: {id: 'foo'}, children: []});
  });

var index$1 = plan$1()
  .test(util)
  .test(domUtil)
  .test(h$$1);

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

var index = plan$1()
  .test(index$1)
  .test(render$1)
  .test(update$1)
  .test(lifecycles)
  .test(withState$1)
  .run();

return index;

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9ub2RlX21vZHVsZXMvem9yYS9kaXN0L3pvcmEuZXMuanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi90cmF2ZXJzZS5qcyIsIi4uL3V0aWwuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vLi4vbGliL2RvbVV0aWwuanMiLCIuLi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL2guanMiLCIuLi8uLi9saWIvdHJlZS5qcyIsIi4uLy4uL2xpYi91cGRhdGUuanMiLCIuLi8uLi9saWIvbGlmZUN5Y2xlcy5qcyIsIi4uLy4uL2xpYi93aXRoU3RhdGUuanMiLCIuLi8uLi9saWIvZWxtLmpzIiwiLi4vLi4vbGliL2Nvbm5lY3QuanMiLCIuLi9oLmpzIiwiLi4vaW5kZXguanMiLCIuLi9icm93c2VyL3JlbmRlci5qcyIsIi4uL2Jyb3dzZXIvdXBkYXRlLmpzIiwiLi4vYnJvd3Nlci91dGlsLmpzIiwiLi4vYnJvd3Nlci9saWZlY3ljbGVzLmpzIiwiLi4vYnJvd3Nlci93aXRoU3RhdGUuanMiLCIuLi9icm93c2VyL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogc2xpY2UoKSByZWZlcmVuY2UuXG4gKi9cblxudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4vKipcbiAqIEV4cG9zZSBgY29gLlxuICovXG5cbnZhciBpbmRleCA9IGNvWydkZWZhdWx0J10gPSBjby5jbyA9IGNvO1xuXG4vKipcbiAqIFdyYXAgdGhlIGdpdmVuIGdlbmVyYXRvciBgZm5gIGludG8gYVxuICogZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgcHJvbWlzZS5cbiAqIFRoaXMgaXMgYSBzZXBhcmF0ZSBmdW5jdGlvbiBzbyB0aGF0XG4gKiBldmVyeSBgY28oKWAgY2FsbCBkb2Vzbid0IGNyZWF0ZSBhIG5ldyxcbiAqIHVubmVjZXNzYXJ5IGNsb3N1cmUuXG4gKlxuICogQHBhcmFtIHtHZW5lcmF0b3JGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5jby53cmFwID0gZnVuY3Rpb24gKGZuKSB7XG4gIGNyZWF0ZVByb21pc2UuX19nZW5lcmF0b3JGdW5jdGlvbl9fID0gZm47XG4gIHJldHVybiBjcmVhdGVQcm9taXNlO1xuICBmdW5jdGlvbiBjcmVhdGVQcm9taXNlKCkge1xuICAgIHJldHVybiBjby5jYWxsKHRoaXMsIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpO1xuICB9XG59O1xuXG4vKipcbiAqIEV4ZWN1dGUgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiBvciBhIGdlbmVyYXRvclxuICogYW5kIHJldHVybiBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGNvKGdlbikge1xuICB2YXIgY3R4ID0gdGhpcztcbiAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgLy8gd2Ugd3JhcCBldmVyeXRoaW5nIGluIGEgcHJvbWlzZSB0byBhdm9pZCBwcm9taXNlIGNoYWluaW5nLFxuICAvLyB3aGljaCBsZWFkcyB0byBtZW1vcnkgbGVhayBlcnJvcnMuXG4gIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vdGovY28vaXNzdWVzLzE4MFxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgaWYgKHR5cGVvZiBnZW4gPT09ICdmdW5jdGlvbicpIGdlbiA9IGdlbi5hcHBseShjdHgsIGFyZ3MpO1xuICAgIGlmICghZ2VuIHx8IHR5cGVvZiBnZW4ubmV4dCAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHJlc29sdmUoZ2VuKTtcblxuICAgIG9uRnVsZmlsbGVkKCk7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge01peGVkfSByZXNcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gb25GdWxmaWxsZWQocmVzKSB7XG4gICAgICB2YXIgcmV0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0ID0gZ2VuLm5leHQocmVzKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIG5leHQocmV0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnJcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gb25SZWplY3RlZChlcnIpIHtcbiAgICAgIHZhciByZXQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXQgPSBnZW4udGhyb3coZXJyKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIG5leHQocmV0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIG5leHQgdmFsdWUgaW4gdGhlIGdlbmVyYXRvcixcbiAgICAgKiByZXR1cm4gYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJldFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBuZXh0KHJldCkge1xuICAgICAgaWYgKHJldC5kb25lKSByZXR1cm4gcmVzb2x2ZShyZXQudmFsdWUpO1xuICAgICAgdmFyIHZhbHVlID0gdG9Qcm9taXNlLmNhbGwoY3R4LCByZXQudmFsdWUpO1xuICAgICAgaWYgKHZhbHVlICYmIGlzUHJvbWlzZSh2YWx1ZSkpIHJldHVybiB2YWx1ZS50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKTtcbiAgICAgIHJldHVybiBvblJlamVjdGVkKG5ldyBUeXBlRXJyb3IoJ1lvdSBtYXkgb25seSB5aWVsZCBhIGZ1bmN0aW9uLCBwcm9taXNlLCBnZW5lcmF0b3IsIGFycmF5LCBvciBvYmplY3QsICdcbiAgICAgICAgKyAnYnV0IHRoZSBmb2xsb3dpbmcgb2JqZWN0IHdhcyBwYXNzZWQ6IFwiJyArIFN0cmluZyhyZXQudmFsdWUpICsgJ1wiJykpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhIGB5aWVsZGBlZCB2YWx1ZSBpbnRvIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmpcbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiB0b1Byb21pc2Uob2JqKSB7XG4gIGlmICghb2JqKSByZXR1cm4gb2JqO1xuICBpZiAoaXNQcm9taXNlKG9iaikpIHJldHVybiBvYmo7XG4gIGlmIChpc0dlbmVyYXRvckZ1bmN0aW9uKG9iaikgfHwgaXNHZW5lcmF0b3Iob2JqKSkgcmV0dXJuIGNvLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIG9iaikgcmV0dXJuIHRodW5rVG9Qcm9taXNlLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkgcmV0dXJuIGFycmF5VG9Qcm9taXNlLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKGlzT2JqZWN0KG9iaikpIHJldHVybiBvYmplY3RUb1Byb21pc2UuY2FsbCh0aGlzLCBvYmopO1xuICByZXR1cm4gb2JqO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0aHVuayB0byBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn1cbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiB0aHVua1RvUHJvbWlzZShmbikge1xuICB2YXIgY3R4ID0gdGhpcztcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICBmbi5jYWxsKGN0eCwgZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KGVycik7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpIHJlcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgIHJlc29sdmUocmVzKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBhcnJheSBvZiBcInlpZWxkYWJsZXNcIiB0byBhIHByb21pc2UuXG4gKiBVc2VzIGBQcm9taXNlLmFsbCgpYCBpbnRlcm5hbGx5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IG9ialxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGFycmF5VG9Qcm9taXNlKG9iaikge1xuICByZXR1cm4gUHJvbWlzZS5hbGwob2JqLm1hcCh0b1Byb21pc2UsIHRoaXMpKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGFuIG9iamVjdCBvZiBcInlpZWxkYWJsZXNcIiB0byBhIHByb21pc2UuXG4gKiBVc2VzIGBQcm9taXNlLmFsbCgpYCBpbnRlcm5hbGx5LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBvYmplY3RUb1Byb21pc2Uob2JqKXtcbiAgdmFyIHJlc3VsdHMgPSBuZXcgb2JqLmNvbnN0cnVjdG9yKCk7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgdmFyIHByb21pc2VzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgIHZhciBwcm9taXNlID0gdG9Qcm9taXNlLmNhbGwodGhpcywgb2JqW2tleV0pO1xuICAgIGlmIChwcm9taXNlICYmIGlzUHJvbWlzZShwcm9taXNlKSkgZGVmZXIocHJvbWlzZSwga2V5KTtcbiAgICBlbHNlIHJlc3VsdHNba2V5XSA9IG9ialtrZXldO1xuICB9XG4gIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGRlZmVyKHByb21pc2UsIGtleSkge1xuICAgIC8vIHByZWRlZmluZSB0aGUga2V5IGluIHRoZSByZXN1bHRcbiAgICByZXN1bHRzW2tleV0gPSB1bmRlZmluZWQ7XG4gICAgcHJvbWlzZXMucHVzaChwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgICAgcmVzdWx0c1trZXldID0gcmVzO1xuICAgIH0pKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIGBvYmpgIGlzIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNQcm9taXNlKG9iaikge1xuICByZXR1cm4gJ2Z1bmN0aW9uJyA9PSB0eXBlb2Ygb2JqLnRoZW47XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYSBnZW5lcmF0b3IuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNHZW5lcmF0b3Iob2JqKSB7XG4gIHJldHVybiAnZnVuY3Rpb24nID09IHR5cGVvZiBvYmoubmV4dCAmJiAnZnVuY3Rpb24nID09IHR5cGVvZiBvYmoudGhyb3c7XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYSBnZW5lcmF0b3IgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGlzR2VuZXJhdG9yRnVuY3Rpb24ob2JqKSB7XG4gIHZhciBjb25zdHJ1Y3RvciA9IG9iai5jb25zdHJ1Y3RvcjtcbiAgaWYgKCFjb25zdHJ1Y3RvcikgcmV0dXJuIGZhbHNlO1xuICBpZiAoJ0dlbmVyYXRvckZ1bmN0aW9uJyA9PT0gY29uc3RydWN0b3IubmFtZSB8fCAnR2VuZXJhdG9yRnVuY3Rpb24nID09PSBjb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSkgcmV0dXJuIHRydWU7XG4gIHJldHVybiBpc0dlbmVyYXRvcihjb25zdHJ1Y3Rvci5wcm90b3R5cGUpO1xufVxuXG4vKipcbiAqIENoZWNrIGZvciBwbGFpbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNPYmplY3QodmFsKSB7XG4gIHJldHVybiBPYmplY3QgPT0gdmFsLmNvbnN0cnVjdG9yO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21tb25qc01vZHVsZShmbiwgbW9kdWxlKSB7XG5cdHJldHVybiBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IH0sIGZuKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMpLCBtb2R1bGUuZXhwb3J0cztcbn1cblxudmFyIGtleXMgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbidcbiAgPyBPYmplY3Qua2V5cyA6IHNoaW07XG5cbmV4cG9ydHMuc2hpbSA9IHNoaW07XG5mdW5jdGlvbiBzaGltIChvYmopIHtcbiAgdmFyIGtleXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikga2V5cy5wdXNoKGtleSk7XG4gIHJldHVybiBrZXlzO1xufVxufSk7XG5cbnZhciBpc19hcmd1bWVudHMgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG52YXIgc3VwcG9ydHNBcmd1bWVudHNDbGFzcyA9IChmdW5jdGlvbigpe1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZ3VtZW50cylcbn0pKCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPyBzdXBwb3J0ZWQgOiB1bnN1cHBvcnRlZDtcblxuZXhwb3J0cy5zdXBwb3J0ZWQgPSBzdXBwb3J0ZWQ7XG5mdW5jdGlvbiBzdXBwb3J0ZWQob2JqZWN0KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcbn1cblxuZXhwb3J0cy51bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuZnVuY3Rpb24gdW5zdXBwb3J0ZWQob2JqZWN0KXtcbiAgcmV0dXJuIG9iamVjdCAmJlxuICAgIHR5cGVvZiBvYmplY3QgPT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygb2JqZWN0Lmxlbmd0aCA9PSAnbnVtYmVyJyAmJlxuICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsICdjYWxsZWUnKSAmJlxuICAgICFPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwob2JqZWN0LCAnY2FsbGVlJykgfHxcbiAgICBmYWxzZTtcbn1cbn0pO1xuXG52YXIgaW5kZXgkMSA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUpIHtcbnZhciBwU2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgb2JqZWN0S2V5cyA9IGtleXM7XG52YXIgaXNBcmd1bWVudHMgPSBpc19hcmd1bWVudHM7XG5cbnZhciBkZWVwRXF1YWwgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKSB7XG4gIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAvLyA3LjEuIEFsbCBpZGVudGljYWwgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBhcyBkZXRlcm1pbmVkIGJ5ID09PS5cbiAgaWYgKGFjdHVhbCA9PT0gZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICB9IGVsc2UgaWYgKGFjdHVhbCBpbnN0YW5jZW9mIERhdGUgJiYgZXhwZWN0ZWQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIGFjdHVhbC5nZXRUaW1lKCkgPT09IGV4cGVjdGVkLmdldFRpbWUoKTtcblxuICAvLyA3LjMuIE90aGVyIHBhaXJzIHRoYXQgZG8gbm90IGJvdGggcGFzcyB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcsXG4gIC8vIGVxdWl2YWxlbmNlIGlzIGRldGVybWluZWQgYnkgPT0uXG4gIH0gZWxzZSBpZiAoIWFjdHVhbCB8fCAhZXhwZWN0ZWQgfHwgdHlwZW9mIGFjdHVhbCAhPSAnb2JqZWN0JyAmJiB0eXBlb2YgZXhwZWN0ZWQgIT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gb3B0cy5zdHJpY3QgPyBhY3R1YWwgPT09IGV4cGVjdGVkIDogYWN0dWFsID09IGV4cGVjdGVkO1xuXG4gIC8vIDcuNC4gRm9yIGFsbCBvdGhlciBPYmplY3QgcGFpcnMsIGluY2x1ZGluZyBBcnJheSBvYmplY3RzLCBlcXVpdmFsZW5jZSBpc1xuICAvLyBkZXRlcm1pbmVkIGJ5IGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoYXMgdmVyaWZpZWRcbiAgLy8gd2l0aCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwpLCB0aGUgc2FtZSBzZXQgb2Yga2V5c1xuICAvLyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSwgZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5XG4gIC8vIGNvcnJlc3BvbmRpbmcga2V5LCBhbmQgYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LiBOb3RlOiB0aGlzXG4gIC8vIGFjY291bnRzIGZvciBib3RoIG5hbWVkIGFuZCBpbmRleGVkIHByb3BlcnRpZXMgb24gQXJyYXlzLlxuICB9IGVsc2Uge1xuICAgIHJldHVybiBvYmpFcXVpdihhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWRPck51bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzQnVmZmVyICh4KSB7XG4gIGlmICgheCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcgfHwgdHlwZW9mIHgubGVuZ3RoICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICBpZiAodHlwZW9mIHguY29weSAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgeC5zbGljZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoeC5sZW5ndGggPiAwICYmIHR5cGVvZiB4WzBdICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gb2JqRXF1aXYoYSwgYiwgb3B0cykge1xuICB2YXIgaSwga2V5O1xuICBpZiAoaXNVbmRlZmluZWRPck51bGwoYSkgfHwgaXNVbmRlZmluZWRPck51bGwoYikpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvLyBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuXG4gIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHJldHVybiBmYWxzZTtcbiAgLy9+fn5JJ3ZlIG1hbmFnZWQgdG8gYnJlYWsgT2JqZWN0LmtleXMgdGhyb3VnaCBzY3Jld3kgYXJndW1lbnRzIHBhc3NpbmcuXG4gIC8vICAgQ29udmVydGluZyB0byBhcnJheSBzb2x2ZXMgdGhlIHByb2JsZW0uXG4gIGlmIChpc0FyZ3VtZW50cyhhKSkge1xuICAgIGlmICghaXNBcmd1bWVudHMoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYSA9IHBTbGljZS5jYWxsKGEpO1xuICAgIGIgPSBwU2xpY2UuY2FsbChiKTtcbiAgICByZXR1cm4gZGVlcEVxdWFsKGEsIGIsIG9wdHMpO1xuICB9XG4gIGlmIChpc0J1ZmZlcihhKSkge1xuICAgIGlmICghaXNCdWZmZXIoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB0cnkge1xuICAgIHZhciBrYSA9IG9iamVjdEtleXMoYSksXG4gICAgICAgIGtiID0gb2JqZWN0S2V5cyhiKTtcbiAgfSBjYXRjaCAoZSkgey8vaGFwcGVucyB3aGVuIG9uZSBpcyBhIHN0cmluZyBsaXRlcmFsIGFuZCB0aGUgb3RoZXIgaXNuJ3RcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy8gaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChrZXlzIGluY29ycG9yYXRlc1xuICAvLyBoYXNPd25Qcm9wZXJ0eSlcbiAgaWYgKGthLmxlbmd0aCAhPSBrYi5sZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvL3RoZSBzYW1lIHNldCBvZiBrZXlzIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLFxuICBrYS5zb3J0KCk7XG4gIGtiLnNvcnQoKTtcbiAgLy9+fn5jaGVhcCBrZXkgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChrYVtpXSAhPSBrYltpXSlcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvL2VxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeSBjb3JyZXNwb25kaW5nIGtleSwgYW5kXG4gIC8vfn5+cG9zc2libHkgZXhwZW5zaXZlIGRlZXAgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGtleSA9IGthW2ldO1xuICAgIGlmICghZGVlcEVxdWFsKGFba2V5XSwgYltrZXldLCBvcHRzKSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gdHlwZW9mIGI7XG59XG59KTtcblxuY29uc3QgYXNzZXJ0aW9ucyA9IHtcbiAgb2sodmFsLCBtZXNzYWdlID0gJ3Nob3VsZCBiZSB0cnV0aHknKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogQm9vbGVhbih2YWwpLFxuICAgICAgZXhwZWN0ZWQ6ICd0cnV0aHknLFxuICAgICAgYWN0dWFsOiB2YWwsXG4gICAgICBvcGVyYXRvcjogJ29rJyxcbiAgICAgIG1lc3NhZ2VcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBkZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgYmUgZXF1aXZhbGVudCcpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBpbmRleCQxKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdkZWVwRXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgZXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgYmUgZXF1YWwnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogYWN0dWFsID09PSBleHBlY3RlZCxcbiAgICAgIGFjdHVhbCxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIG9wZXJhdG9yOiAnZXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90T2sodmFsLCBtZXNzYWdlID0gJ3Nob3VsZCBub3QgYmUgdHJ1dGh5Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6ICFCb29sZWFuKHZhbCksXG4gICAgICBleHBlY3RlZDogJ2ZhbHN5JyxcbiAgICAgIGFjdHVhbDogdmFsLFxuICAgICAgb3BlcmF0b3I6ICdub3RPaycsXG4gICAgICBtZXNzYWdlXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90RGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UgPSAnc2hvdWxkIG5vdCBiZSBlcXVpdmFsZW50Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6ICFpbmRleCQxKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdub3REZWVwRXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgbm90IGJlIGVxdWFsJykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGFjdHVhbCAhPT0gZXhwZWN0ZWQsXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcjogJ25vdEVxdWFsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIHRocm93cyhmdW5jLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICAgIGxldCBjYXVnaHQsIHBhc3MsIGFjdHVhbDtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnc3RyaW5nJykge1xuICAgICAgW2V4cGVjdGVkLCBtZXNzYWdlXSA9IFttZXNzYWdlLCBleHBlY3RlZF07XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBmdW5jKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNhdWdodCA9IHtlcnJvcn07XG4gICAgfVxuICAgIHBhc3MgPSBjYXVnaHQgIT09IHVuZGVmaW5lZDtcbiAgICBhY3R1YWwgPSBjYXVnaHQgJiYgY2F1Z2h0LmVycm9yO1xuICAgIGlmIChleHBlY3RlZCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcGFzcyA9IGV4cGVjdGVkLnRlc3QoYWN0dWFsKSB8fCBleHBlY3RlZC50ZXN0KGFjdHVhbCAmJiBhY3R1YWwubWVzc2FnZSk7XG4gICAgICBleHBlY3RlZCA9IFN0cmluZyhleHBlY3RlZCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdmdW5jdGlvbicgJiYgY2F1Z2h0KSB7XG4gICAgICBwYXNzID0gYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWQ7XG4gICAgICBhY3R1YWwgPSBhY3R1YWwuY29uc3RydWN0b3I7XG4gICAgfVxuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3MsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIGFjdHVhbCxcbiAgICAgIG9wZXJhdG9yOiAndGhyb3dzJyxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UgfHwgJ3Nob3VsZCB0aHJvdydcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBkb2VzTm90VGhyb3coZnVuYywgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgICBsZXQgY2F1Z2h0O1xuICAgIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBbZXhwZWN0ZWQsIG1lc3NhZ2VdID0gW21lc3NhZ2UsIGV4cGVjdGVkXTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGZ1bmMoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY2F1Z2h0ID0ge2Vycm9yfTtcbiAgICB9XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogY2F1Z2h0ID09PSB1bmRlZmluZWQsXG4gICAgICBleHBlY3RlZDogJ25vIHRocm93biBlcnJvcicsXG4gICAgICBhY3R1YWw6IGNhdWdodCAmJiBjYXVnaHQuZXJyb3IsXG4gICAgICBvcGVyYXRvcjogJ2RvZXNOb3RUaHJvdycsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlIHx8ICdzaG91bGQgbm90IHRocm93J1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIGZhaWwocmVhc29uID0gJ2ZhaWwgY2FsbGVkJykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGZhbHNlLFxuICAgICAgYWN0dWFsOiAnZmFpbCBjYWxsZWQnLFxuICAgICAgZXhwZWN0ZWQ6ICdmYWlsIG5vdCBjYWxsZWQnLFxuICAgICAgbWVzc2FnZTogcmVhc29uLFxuICAgICAgb3BlcmF0b3I6ICdmYWlsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGFzc2VydGlvbiAodGVzdCkge1xuICByZXR1cm4gT2JqZWN0LmNyZWF0ZShhc3NlcnRpb25zLCB7dGVzdDoge3ZhbHVlOiB0ZXN0fX0pO1xufVxuXG5jb25zdCBUZXN0ID0ge1xuICBydW46IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBhc3NlcnQgPSBhc3NlcnRpb24odGhpcyk7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICByZXR1cm4gaW5kZXgodGhpcy5jb3JvdXRpbmUoYXNzZXJ0KSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHthc3NlcnRpb25zOiB0aGlzLmFzc2VydGlvbnMsIGV4ZWN1dGlvblRpbWU6IERhdGUubm93KCkgLSBub3d9O1xuICAgICAgfSk7XG4gIH0sXG4gIGFkZEFzc2VydGlvbigpe1xuICAgIGNvbnN0IG5ld0Fzc2VydGlvbnMgPSBbLi4uYXJndW1lbnRzXS5tYXAoYSA9PiBPYmplY3QuYXNzaWduKHtkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmlwdGlvbn0sIGEpKTtcbiAgICB0aGlzLmFzc2VydGlvbnMucHVzaCguLi5uZXdBc3NlcnRpb25zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxufTtcblxuZnVuY3Rpb24gdGVzdCAoe2Rlc2NyaXB0aW9uLCBjb3JvdXRpbmUsIG9ubHkgPSBmYWxzZX0pIHtcbiAgcmV0dXJuIE9iamVjdC5jcmVhdGUoVGVzdCwge1xuICAgIGRlc2NyaXB0aW9uOiB7dmFsdWU6IGRlc2NyaXB0aW9ufSxcbiAgICBjb3JvdXRpbmU6IHt2YWx1ZTogY29yb3V0aW5lfSxcbiAgICBhc3NlcnRpb25zOiB7dmFsdWU6IFtdfSxcbiAgICBvbmx5OiB7dmFsdWU6IG9ubHl9LFxuICAgIGxlbmd0aDoge1xuICAgICAgZ2V0KCl7XG4gICAgICAgIHJldHVybiB0aGlzLmFzc2VydGlvbnMubGVuZ3RoXG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gdGFwT3V0ICh7cGFzcywgbWVzc2FnZSwgaW5kZXh9KSB7XG4gIGNvbnN0IHN0YXR1cyA9IHBhc3MgPT09IHRydWUgPyAnb2snIDogJ25vdCBvayc7XG4gIGNvbnNvbGUubG9nKFtzdGF0dXMsIGluZGV4LCBtZXNzYWdlXS5qb2luKCcgJykpO1xufVxuXG5mdW5jdGlvbiBjYW5FeGl0ICgpIHtcbiAgcmV0dXJuIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcHJvY2Vzcy5leGl0ID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiB0YXAgKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKiAoKSB7XG4gICAgbGV0IGluZGV4ID0gMTtcbiAgICBsZXQgbGFzdElkID0gMDtcbiAgICBsZXQgc3VjY2VzcyA9IDA7XG4gICAgbGV0IGZhaWx1cmUgPSAwO1xuXG4gICAgY29uc3Qgc3RhclRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKCdUQVAgdmVyc2lvbiAxMycpO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBjb25zdCBhc3NlcnRpb24gPSB5aWVsZDtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5wYXNzID09PSB0cnVlKSB7XG4gICAgICAgICAgc3VjY2VzcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZhaWx1cmUrKztcbiAgICAgICAgfVxuICAgICAgICBhc3NlcnRpb24uaW5kZXggPSBpbmRleDtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5pZCAhPT0gbGFzdElkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYCMgJHthc3NlcnRpb24uZGVzY3JpcHRpb259IC0gJHthc3NlcnRpb24uZXhlY3V0aW9uVGltZX1tc2ApO1xuICAgICAgICAgIGxhc3RJZCA9IGFzc2VydGlvbi5pZDtcbiAgICAgICAgfVxuICAgICAgICB0YXBPdXQoYXNzZXJ0aW9uKTtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5wYXNzICE9PSB0cnVlKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYCAgLS0tXG4gIG9wZXJhdG9yOiAke2Fzc2VydGlvbi5vcGVyYXRvcn1cbiAgZXhwZWN0ZWQ6ICR7SlNPTi5zdHJpbmdpZnkoYXNzZXJ0aW9uLmV4cGVjdGVkKX1cbiAgYWN0dWFsOiAke0pTT04uc3RyaW5naWZ5KGFzc2VydGlvbi5hY3R1YWwpfVxuICAuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdCYWlsIG91dCEgdW5oYW5kbGVkIGV4Y2VwdGlvbicpO1xuICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgICBpZiAoY2FuRXhpdCgpKSB7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZmluYWxseSB7XG4gICAgICBjb25zdCBleGVjdXRpb24gPSBEYXRlLm5vdygpIC0gc3RhclRpbWU7XG4gICAgICBpZiAoaW5kZXggPiAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBcbjEuLiR7aW5kZXggLSAxfVxuIyBkdXJhdGlvbiAke2V4ZWN1dGlvbn1tc1xuIyBzdWNjZXNzICR7c3VjY2Vzc31cbiMgZmFpbHVyZSAke2ZhaWx1cmV9YCk7XG4gICAgICB9XG4gICAgICBpZiAoZmFpbHVyZSAmJiBjYW5FeGl0KCkpIHtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuY29uc3QgUGxhbiA9IHtcbiAgdGVzdChkZXNjcmlwdGlvbiwgY29yb3V0aW5lLCBvcHRzID0ge30pe1xuICAgIGNvbnN0IHRlc3RJdGVtcyA9ICghY29yb3V0aW5lICYmIGRlc2NyaXB0aW9uLnRlc3RzKSA/IFsuLi5kZXNjcmlwdGlvbl0gOiBbe2Rlc2NyaXB0aW9uLCBjb3JvdXRpbmV9XTtcbiAgICB0aGlzLnRlc3RzLnB1c2goLi4udGVzdEl0ZW1zLm1hcCh0PT50ZXN0KE9iamVjdC5hc3NpZ24odCwgb3B0cykpKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgb25seShkZXNjcmlwdGlvbiwgY29yb3V0aW5lKXtcbiAgICByZXR1cm4gdGhpcy50ZXN0KGRlc2NyaXB0aW9uLCBjb3JvdXRpbmUsIHtvbmx5OiB0cnVlfSk7XG4gIH0sXG5cbiAgcnVuKHNpbmsgPSB0YXAoKSl7XG4gICAgY29uc3Qgc2lua0l0ZXJhdG9yID0gc2luaygpO1xuICAgIHNpbmtJdGVyYXRvci5uZXh0KCk7XG4gICAgY29uc3QgaGFzT25seSA9IHRoaXMudGVzdHMuc29tZSh0PT50Lm9ubHkpO1xuICAgIGNvbnN0IHJ1bm5hYmxlID0gaGFzT25seSA/IHRoaXMudGVzdHMuZmlsdGVyKHQ9PnQub25seSkgOiB0aGlzLnRlc3RzO1xuICAgIHJldHVybiBpbmRleChmdW5jdGlvbiAqICgpIHtcbiAgICAgIGxldCBpZCA9IDE7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gcnVubmFibGUubWFwKHQ9PnQucnVuKCkpO1xuICAgICAgICBmb3IgKGxldCByIG9mIHJlc3VsdHMpIHtcbiAgICAgICAgICBjb25zdCB7YXNzZXJ0aW9ucywgZXhlY3V0aW9uVGltZX0gPSB5aWVsZCByO1xuICAgICAgICAgIGZvciAobGV0IGFzc2VydCBvZiBhc3NlcnRpb25zKSB7XG4gICAgICAgICAgICBzaW5rSXRlcmF0b3IubmV4dChPYmplY3QuYXNzaWduKGFzc2VydCwge2lkLCBleGVjdXRpb25UaW1lfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYXRjaCAoZSkge1xuICAgICAgICBzaW5rSXRlcmF0b3IudGhyb3coZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBzaW5rSXRlcmF0b3IucmV0dXJuKCk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKVxuICB9LFxuXG4gICogW1N5bWJvbC5pdGVyYXRvcl0oKXtcbiAgICBmb3IgKGxldCB0IG9mIHRoaXMudGVzdHMpIHtcbiAgICAgIHlpZWxkIHQ7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBwbGFuICgpIHtcbiAgcmV0dXJuIE9iamVjdC5jcmVhdGUoUGxhbiwge1xuICAgIHRlc3RzOiB7dmFsdWU6IFtdfSxcbiAgICBsZW5ndGg6IHtcbiAgICAgIGdldCgpe1xuICAgICAgICByZXR1cm4gdGhpcy50ZXN0cy5sZW5ndGhcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwbGFuO1xuIiwiZXhwb3J0IGNvbnN0IG5leHRUaWNrID0gZm4gPT4gc2V0VGltZW91dChmbiwgMCk7XG5cbmV4cG9ydCBjb25zdCBwYWlyaWZ5ID0gaG9sZGVyID0+IGtleSA9PiBba2V5LCBob2xkZXJba2V5XV07XG5cbmV4cG9ydCBjb25zdCBpc1NoYWxsb3dFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IGFLZXlzID0gT2JqZWN0LmtleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gT2JqZWN0LmtleXMoYik7XG4gIHJldHVybiBhS2V5cy5sZW5ndGggPT09IGJLZXlzLmxlbmd0aCAmJiBhS2V5cy5ldmVyeSgoaykgPT4gYVtrXSA9PT0gYltrXSk7XG59O1xuXG5jb25zdCBvd25LZXlzID0gb2JqID0+IE9iamVjdC5rZXlzKG9iaikuZmlsdGVyKGsgPT4gb2JqLmhhc093blByb3BlcnR5KGspKTtcblxuZXhwb3J0IGNvbnN0IGlzRGVlcEVxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgdHlwZSA9IHR5cGVvZiBhO1xuXG4gIC8vc2hvcnQgcGF0aChzKVxuICBpZiAoYSA9PT0gYikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKHR5cGUgIT09IHR5cGVvZiBiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKHR5cGUgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIGEgPT09IGI7XG4gIH1cblxuICAvLyBvYmplY3RzIC4uLlxuICBpZiAoYSA9PT0gbnVsbCB8fCBiID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkoYSkpIHtcbiAgICByZXR1cm4gYS5sZW5ndGggJiYgYi5sZW5ndGggJiYgYS5ldmVyeSgoaXRlbSwgaSkgPT4gaXNEZWVwRXF1YWwoYVtpXSwgYltpXSkpO1xuICB9XG5cbiAgY29uc3QgYUtleXMgPSBvd25LZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IG93bktleXMoYik7XG4gIHJldHVybiBhS2V5cy5sZW5ndGggPT09IGJLZXlzLmxlbmd0aCAmJiBhS2V5cy5ldmVyeShrID0+IGlzRGVlcEVxdWFsKGFba10sIGJba10pKTtcbn07XG5cbmV4cG9ydCBjb25zdCBpZGVudGl0eSA9IHAgPT4gcDtcblxuZXhwb3J0IGNvbnN0IG5vb3AgPSAoKSA9PiB7XG59O1xuIiwiZXhwb3J0IGNvbnN0IHRyYXZlcnNlID0gZnVuY3Rpb24gKiAodm5vZGUpIHtcbiAgeWllbGQgdm5vZGU7XG4gIGlmICh2bm9kZS5jaGlsZHJlbiAmJiB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICBmb3IgKGxldCBjaGlsZCBvZiB2bm9kZS5jaGlsZHJlbikge1xuICAgICAgeWllbGQgKiB0cmF2ZXJzZShjaGlsZCk7XG4gICAgfVxuICB9XG59OyIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHtpc1NoYWxsb3dFcXVhbCwgcGFpcmlmeX0gZnJvbSAnLi4vbGliL3V0aWwnO1xuaW1wb3J0IHt0cmF2ZXJzZX0gZnJvbSAnLi4vbGliL3RyYXZlcnNlJztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdzaG91bGQgdHJhdmVyc2UgYSB0cmVlIChnb2luZyBkZWVwIGZpcnN0KScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCB0cmVlID0ge1xuICAgICAgaWQ6IDEsXG4gICAgICBjaGlsZHJlbjogW1xuICAgICAgICB7aWQ6IDIsIGNoaWxkcmVuOiBbe2lkOiAzfSwge2lkOiA0fV19LFxuICAgICAgICB7aWQ6IDUsIGNoaWxkcmVuOiBbe2lkOiA2fV19LFxuICAgICAgICB7aWQ6IDd9XG4gICAgICBdXG4gICAgfTtcblxuICAgIGNvbnN0IHNlcXVlbmNlID0gWy4uLnRyYXZlcnNlKHRyZWUpXS5tYXAobiA9PiBuLmlkKTtcbiAgICB0LmRlZXBFcXVhbChzZXF1ZW5jZSwgWzEsIDIsIDMsIDQsIDUsIDYsIDddKTtcbiAgfSlcbiAgLnRlc3QoJ3BhaXIga2V5IHRvIHZhbHVlIG9iamVjdCBvZiBhbiBvYmplY3QgKGFrYSBPYmplY3QuZW50cmllcyknLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgaG9sZGVyID0ge2E6IDEsIGI6IDIsIGM6IDMsIGQ6IDR9O1xuICAgIGNvbnN0IGYgPSBwYWlyaWZ5KGhvbGRlcik7XG4gICAgY29uc3QgZGF0YSA9IE9iamVjdC5rZXlzKGhvbGRlcikubWFwKGYpO1xuICAgIHQuZGVlcEVxdWFsKGRhdGEsIFtbJ2EnLCAxXSwgWydiJywgMl0sIFsnYycsIDNdLCBbJ2QnLCA0XV0pO1xuICB9KVxuICAudGVzdCgnc2hhbGxvdyBlcXVhbGl0eSB0ZXN0IG9uIG9iamVjdCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBuZXN0ZWQgPSB7Zm9vOiAnYmFyJ307XG4gICAgY29uc3Qgb2JqMSA9IHthOiAxLCBiOiAnMicsIGM6IHRydWUsIGQ6IG5lc3RlZH07XG4gICAgdC5vayhpc1NoYWxsb3dFcXVhbChvYmoxLCB7YTogMSwgYjogJzInLCBjOiB0cnVlLCBkOiBuZXN0ZWR9KSk7XG4gICAgdC5ub3RPayhpc1NoYWxsb3dFcXVhbChvYmoxLCB7XG4gICAgICBhOiAxLFxuICAgICAgYjogJzInLFxuICAgICAgYzogdHJ1ZSxcbiAgICAgIGQ6IHtmb286ICdiYXInfVxuICAgIH0pLCAnbmVzdGVkIG9iamVjdCBzaG91bGQgYmUgY2hlY2tlZCBieSByZWZlcmVuY2UnKTtcbiAgICB0Lm5vdE9rKGlzU2hhbGxvd0VxdWFsKG9iajEsIHthOiAxLCBiOiAyLCBjOiB0cnVlLCBkOiBuZXN0ZWR9KSwgJ2V4YWN0IHR5cGUgY2hlY2tpbmcgb24gcHJpbWl0aXZlJyk7XG4gICAgdC5ub3RPayhpc1NoYWxsb3dFcXVhbChvYmoxLCB7YTogMSwgYzogdHJ1ZSwgZDogbmVzdGVkfSksICdyZXR1cm4gZmFsc2Ugb24gbWlzc2luZyBwcm9wZXJ0aWVzJyk7XG4gICAgdC5ub3RPayhpc1NoYWxsb3dFcXVhbCh7YTogMSwgYzogdHJ1ZSwgZDogbmVzdGVkfSwgb2JqMSksICdyZXR1cm4gZmFsc2Ugb24gbWlzc2luZyBwcm9wZXJ0aWVzIChjb21tbXV0YXRpdmUnKTtcbiAgfSk7XG4iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJpbXBvcnQge3RhcH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgdXBkYXRlRG9tTm9kZUZhY3RvcnkgPSAobWV0aG9kKSA9PiAoaXRlbXMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgcGFpciBvZiBpdGVtcykge1xuICAgIGRvbU5vZGVbbWV0aG9kXSguLi5wYWlyKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCByZW1vdmVFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdyZW1vdmVFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3QgYWRkRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgnYWRkRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IHNldEF0dHJpYnV0ZXMgPSAoaXRlbXMpID0+IHRhcCgoZG9tTm9kZSkgPT4ge1xuICBjb25zdCBhdHRyaWJ1dGVzID0gaXRlbXMuZmlsdGVyKChba2V5LCB2YWx1ZV0pID0+IHR5cGVvZiB2YWx1ZSAhPT0gJ2Z1bmN0aW9uJyk7XG4gIGZvciAobGV0IFtrZXksIHZhbHVlXSBvZiBhdHRyaWJ1dGVzKSB7XG4gICAgdmFsdWUgPT09IGZhbHNlID8gZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoa2V5KSA6IGRvbU5vZGUuc2V0QXR0cmlidXRlKGtleSwgdmFsdWUpO1xuICB9XG59KTtcbmV4cG9ydCBjb25zdCByZW1vdmVBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IGF0dHIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCBzZXRUZXh0Tm9kZSA9IHZhbCA9PiBub2RlID0+IG5vZGUudGV4dENvbnRlbnQgPSB2YWw7XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVEb21Ob2RlID0gdm5vZGUgPT4ge1xuICByZXR1cm4gdm5vZGUubm9kZVR5cGUgIT09ICdUZXh0JyA/XG4gICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh2bm9kZS5ub2RlVHlwZSkgOlxuICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFN0cmluZyh2bm9kZS5wcm9wcy52YWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldEV2ZW50TGlzdGVuZXJzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcylcbiAgICAuZmlsdGVyKGsgPT4gay5zdWJzdHIoMCwgMikgPT09ICdvbicpXG4gICAgLm1hcChrID0+IFtrLnN1YnN0cigyKS50b0xvd2VyQ2FzZSgpLCBwcm9wc1trXV0pO1xufTtcbiIsImltcG9ydCB7XG4gIHNldEF0dHJpYnV0ZXMsXG4gIHJlbW92ZUF0dHJpYnV0ZXMsXG4gIGFkZEV2ZW50TGlzdGVuZXJzLFxuICByZW1vdmVFdmVudExpc3RlbmVycyxcbiAgc2V0VGV4dE5vZGUsXG4gIGdldEV2ZW50TGlzdGVuZXJzLFxuICBjcmVhdGVEb21Ob2RlXG59IGZyb20gJy4uL2xpYi9kb21VdGlsJztcbmltcG9ydCB7bm9vcH0gZnJvbSAnLi4vbGliL3V0aWwnO1xuaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5cbmNvbnN0IGRvbVByb3RvID0ge1xuXG4gIHJlbW92ZUF0dHJpYnV0ZShhdHRyKXtcbiAgICBkZWxldGUgdGhpc1thdHRyXTtcbiAgfSxcblxuICBzZXRBdHRyaWJ1dGUoYXR0ciwgdmFsKXtcbiAgICB0aGlzW2F0dHJdID0gdmFsO1xuICB9LFxuXG4gIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIpe1xuICAgIHRoaXMuaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcjtcbiAgfSxcblxuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyKXtcbiAgICBkZWxldGUgdGhpcy5oYW5kbGVyc1tldmVudF07XG4gIH1cbn07XG5cbmNvbnN0IGZha2VEb20gPSAoKSA9PiB7XG4gIGNvbnN0IGRvbSA9IE9iamVjdC5jcmVhdGUoZG9tUHJvdG8pO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZG9tLCAnaGFuZGxlcnMnLCB7dmFsdWU6IHt9fSk7XG4gIHJldHVybiBkb207XG59O1xuXG5jb25zdCBvd25Qcm9wcyA9IChvYmopID0+IHtcbiAgY29uc3Qgb3duUHJvcGVydGllcyA9IFtdO1xuICBmb3IgKGxldCBwcm9wIGluIG9iaikge1xuICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIG93blByb3BlcnRpZXMucHVzaChwcm9wKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG93blByb3BlcnRpZXM7XG59O1xuXG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnc2V0IGF0dHJpYnV0ZXMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZCA9IGZha2VEb20oKTtcbiAgICBjb25zdCB1cGRhdGUgPSBzZXRBdHRyaWJ1dGVzKFtbJ2ZvbycsICdiYXInXSwgWydibGFoJywgMl0sIFsnd29vdCcsIHRydWVdXSk7XG4gICAgY29uc3QgbiA9IHVwZGF0ZShkKTtcbiAgICB0LmVxdWFsKG4sIGQsICdzaG91bGQgaGF2ZSBmb3J3YXJkZWQgZG9tIG5vZGUnKTtcbiAgICB0LmVxdWFsKGQuZm9vLCAnYmFyJyk7XG4gICAgdC5lcXVhbChkLmJsYWgsIDIpO1xuICAgIHQuZXF1YWwoZC53b290LCB0cnVlKTtcbiAgICBjb25zdCBwcm9wcyA9IG93blByb3BzKGQpO1xuICAgIHQuZGVlcEVxdWFsKHByb3BzLCBbJ2ZvbycsICdibGFoJywgJ3dvb3QnXSk7XG4gICAgY29uc3QgaGFuZGxlcnMgPSBvd25Qcm9wcyhkLmhhbmRsZXJzKTtcbiAgICB0LmVxdWFsKGhhbmRsZXJzLmxlbmd0aCwgMCk7XG4gIH0pXG4gIC50ZXN0KCdyZW1vdmUgYXR0cmlidXRlIGlmIHZhbHVlIGlzIGZhbHNlJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGQgPSBmYWtlRG9tKCk7XG4gICAgZC5mb28gPSAnYmFyJztcbiAgICB0LmRlZXBFcXVhbChvd25Qcm9wcyhkKSwgWydmb28nXSk7XG4gICAgY29uc3QgdXBkYXRlID0gc2V0QXR0cmlidXRlcyhbWydmb28nLCBmYWxzZV1dKTtcbiAgICBjb25zdCBuID0gdXBkYXRlKGQpO1xuICAgIHQuZXF1YWwobiwgZCwgJ3Nob3VsZCBoYXZlIGZvcndhcmRlZCBkb20gbm9kZScpO1xuICAgIHQuZXF1YWwoZC5mb28sIHVuZGVmaW5lZCk7XG4gICAgdC5lcXVhbChvd25Qcm9wcyhkKS5sZW5ndGgsIDApO1xuICAgIGNvbnN0IGhhbmRsZXJzID0gb3duUHJvcHMoZC5oYW5kbGVycyk7XG4gICAgdC5lcXVhbChoYW5kbGVycy5sZW5ndGgsIDApO1xuICB9KVxuICAudGVzdCgncmVtb3ZlIGF0dHJpYnV0ZXMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZCA9IGZha2VEb20oKTtcbiAgICBkLmZvbyA9ICdiYXInO1xuICAgIGQud29vdCA9IDI7XG4gICAgZC5iYXIgPSAnYmxhaCc7XG4gICAgdC5kZWVwRXF1YWwob3duUHJvcHMoZCksIFsnZm9vJywgJ3dvb3QnLCAnYmFyJ10pO1xuICAgIGNvbnN0IHVwZGF0ZSA9IHJlbW92ZUF0dHJpYnV0ZXMoWydmb28nLCAnd29vdCddKTtcbiAgICBjb25zdCBuID0gdXBkYXRlKGQpO1xuICAgIHQuZXF1YWwobiwgZCwgJ3Nob3VsZCBoYXZlIGZvcndhcmRlZCBkb20gbm9kZScpO1xuICAgIHQuZXF1YWwoZC5iYXIsICdibGFoJyk7XG4gICAgdC5lcXVhbChvd25Qcm9wcyhkKS5sZW5ndGgsIDEpO1xuICAgIGNvbnN0IGhhbmRsZXJzID0gb3duUHJvcHMoZC5oYW5kbGVycyk7XG4gICAgdC5lcXVhbChoYW5kbGVycy5sZW5ndGgsIDApO1xuICB9KVxuICAudGVzdCgnYWRkIGV2ZW50IGxpc3RlbmVycycsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBkID0gZmFrZURvbSgpO1xuICAgIGNvbnN0IHVwZGF0ZSA9IGFkZEV2ZW50TGlzdGVuZXJzKFtbJ2NsaWNrJywgbm9vcFxuICAgIF0sIFsnaW5wdXQnLCBub29wXV0pO1xuICAgIGNvbnN0IG4gPSB1cGRhdGUoZCk7XG4gICAgdC5lcXVhbChuLCBkLCAnc2hvdWxkIGhhdmUgZm9yd2FyZGVkIHRoZSBub2RlJyk7XG4gICAgdC5lcXVhbChvd25Qcm9wcyhkKS5sZW5ndGgsIDApO1xuICAgIHQuZGVlcEVxdWFsKG93blByb3BzKGQuaGFuZGxlcnMpLCBbJ2NsaWNrJywgJ2lucHV0J10pO1xuICAgIHQuZXF1YWwoZC5oYW5kbGVycy5jbGljaywgbm9vcCk7XG4gICAgdC5lcXVhbChkLmhhbmRsZXJzLmlucHV0LCBub29wKTtcbiAgfSlcbiAgLnRlc3QoJ3JlbW92ZSBldmVudCBsaXN0ZW5lcnMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZCA9IGZha2VEb20oKTtcbiAgICBkLmhhbmRsZXJzLmNsaWNrID0gbm9vcDtcbiAgICBkLmhhbmRsZXJzLmlucHV0ID0gbm9vcDtcbiAgICBjb25zdCB1cGRhdGUgPSByZW1vdmVFdmVudExpc3RlbmVycyhbWydjbGljaycsIG5vb3BcbiAgICBdXSk7XG4gICAgY29uc3QgbiA9IHVwZGF0ZShkKTtcbiAgICB0LmVxdWFsKG4sIGQsICdzaG91bGQgaGF2ZSBmb3J3YXJkZWQgdGhlIG5vZGUnKTtcbiAgICB0LmRlZXBFcXVhbChvd25Qcm9wcyhkLmhhbmRsZXJzKSwgWydpbnB1dCddKTtcbiAgICB0LmVxdWFsKGQuaGFuZGxlcnMuaW5wdXQsIG5vb3ApO1xuICB9KVxuICAudGVzdCgnc2V0IHRleHQgbm9kZSB2YWx1ZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBub2RlID0ge307XG4gICAgY29uc3QgdXBkYXRlID0gc2V0VGV4dE5vZGUoJ2ZvbycpO1xuICAgIHVwZGF0ZShub2RlKTtcbiAgICB0LmVxdWFsKG5vZGUudGV4dENvbnRlbnQsICdmb28nKTtcbiAgfSlcbiAgLnRlc3QoJ2dldCBldmVudCBMaXN0ZW5lcnMgZnJvbSBwcm9wcyBvYmplY3QnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgcHJvcHMgPSB7XG4gICAgICBvbkNsaWNrOiAoKSA9PiB7XG4gICAgICB9LFxuICAgICAgaW5wdXQ6ICgpID0+IHtcbiAgICAgIH0sXG4gICAgICBvbk1vdXNlZG93bjogKCkgPT4ge1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBldmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhwcm9wcyk7XG4gICAgdC5kZWVwRXF1YWwoZXZlbnRzLCBbXG4gICAgICBbJ2NsaWNrJywgcHJvcHMub25DbGlja10sXG4gICAgICBbJ21vdXNlZG93bicsIHByb3BzLm9uTW91c2Vkb3duXSxcbiAgICBdKTtcbiAgfSlcbiAgLy8gLnRlc3QoJ2NyZWF0ZSB0ZXh0IGRvbSBub2RlJywgZnVuY3Rpb24gKiAodCkge1xuICAvLyAgIGRvY3VtZW50ID0gZG9jdW1lbnQgfHwge1xuICAvLyAgICAgICBjcmVhdGVFbGVtZW50OiAoYXJnKSA9PiB7XG4gIC8vICAgICAgICAgcmV0dXJuIHtlbGVtZW50OiBhcmd9O1xuICAvLyAgICAgICB9LFxuICAvLyAgICAgICBjcmVhdGVUZXh0Tm9kZTogKGFyZykgPT4ge1xuICAvLyAgICAgICAgIHJldHVybiB7dGV4dDogYXJnfTtcbiAgLy8gICAgICAgfVxuICAvLyAgICAgfTtcbiAgLy8gICBjb25zdCBuID0gY3JlYXRlRG9tTm9kZSh7bm9kZVR5cGU6J1RleHQnLHByb3BzOnt2YWx1ZTonZm9vJ319KTtcbiAgLy8gICB0LmRlZXBFcXVhbChuLHt0ZXh0Oidmb28nfSk7XG4gIC8vIH0pIiwiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9XG59KTtcblxuLyoqXG4gKiBUcmFuc2Zvcm0gaHlwZXJzY3JpcHQgaW50byB2aXJ0dWFsIGRvbSBub2RlXG4gKiBAcGFyYW0gbm9kZVR5cGVcbiAqIEBwYXJhbSBwcm9wc1xuICogQHBhcmFtIGNoaWxkcmVuXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaCAobm9kZVR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICBjb25zdCBmbGF0Q2hpbGRyZW4gPSBjaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gQXJyYXkuaXNBcnJheShjaGlsZCkgPyBjaGlsZCA6IFtjaGlsZF07XG4gICAgcmV0dXJuIGFjYy5jb25jYXQoY2hpbGRyZW5BcnJheSk7XG4gIH0sIFtdKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gbm9ybWFsaXplIHRleHQgbm9kZSB0byBoYXZlIHNhbWUgc3RydWN0dXJlIHRoYW4gcmVndWxhciBkb20gbm9kZXNcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgY2hpbGQ7XG4gICAgICByZXR1cm4gdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkIDogY3JlYXRlVGV4dFZOb2RlKGNoaWxkKTtcbiAgICB9KTtcblxuICBpZiAodHlwZW9mIG5vZGVUeXBlICE9PSAnZnVuY3Rpb24nKSB7Ly9yZWd1bGFyIGh0bWwvdGV4dCBub2RlXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGVUeXBlLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgY2hpbGRyZW46IGZsYXRDaGlsZHJlblxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZnVsbFByb3BzID0gT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IGZsYXRDaGlsZHJlbn0sIHByb3BzKTtcbiAgICBjb25zdCBjb21wID0gbm9kZVR5cGUoZnVsbFByb3BzKTtcbiAgICByZXR1cm4gdHlwZW9mIGNvbXAgIT09ICdmdW5jdGlvbicgPyBjb21wIDogaChjb21wLCBwcm9wcywgLi4uZmxhdENoaWxkcmVuKTsgLy9mdW5jdGlvbmFsIGNvbXAgdnMgY29tYmluYXRvciAoSE9DKVxuICB9XG59OyIsImltcG9ydCB7Y29tcG9zZSwgY3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQge1xuICBpc1NoYWxsb3dFcXVhbCxcbiAgcGFpcmlmeSxcbiAgbmV4dFRpY2ssXG4gIG5vb3Bcbn0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7XG4gIHJlbW92ZUF0dHJpYnV0ZXMsXG4gIHNldEF0dHJpYnV0ZXMsXG4gIHNldFRleHROb2RlLFxuICBjcmVhdGVEb21Ob2RlLFxuICByZW1vdmVFdmVudExpc3RlbmVycyxcbiAgYWRkRXZlbnRMaXN0ZW5lcnMsXG4gIGdldEV2ZW50TGlzdGVuZXJzLFxufSBmcm9tICcuL2RvbVV0aWwnO1xuaW1wb3J0IHt0cmF2ZXJzZX0gZnJvbSAnLi90cmF2ZXJzZSc7XG5cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzICh7cHJvcHM6bmV3Tm9kZVByb3BzfT17fSwge3Byb3BzOm9sZE5vZGVQcm9wc309e30pIHtcbiAgY29uc3QgbmV3Tm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG5ld05vZGVQcm9wcyB8fCB7fSk7XG4gIGNvbnN0IG9sZE5vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhvbGROb2RlUHJvcHMgfHwge30pO1xuXG4gIHJldHVybiBuZXdOb2RlRXZlbnRzLmxlbmd0aCB8fCBvbGROb2RlRXZlbnRzLmxlbmd0aCA/XG4gICAgY29tcG9zZShcbiAgICAgIHJlbW92ZUV2ZW50TGlzdGVuZXJzKG9sZE5vZGVFdmVudHMpLFxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcnMobmV3Tm9kZUV2ZW50cylcbiAgICApIDogbm9vcDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQXR0cmlidXRlcyAobmV3Vk5vZGUsIG9sZFZOb2RlKSB7XG4gIGNvbnN0IG5ld1ZOb2RlUHJvcHMgPSBuZXdWTm9kZS5wcm9wcyB8fCB7fTtcbiAgY29uc3Qgb2xkVk5vZGVQcm9wcyA9IG9sZFZOb2RlLnByb3BzIHx8IHt9O1xuXG4gIGlmIChpc1NoYWxsb3dFcXVhbChuZXdWTm9kZVByb3BzLCBvbGRWTm9kZVByb3BzKSkge1xuICAgIHJldHVybiBub29wO1xuICB9XG5cbiAgaWYgKG5ld1ZOb2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICByZXR1cm4gc2V0VGV4dE5vZGUobmV3Vk5vZGUucHJvcHMudmFsdWUpO1xuICB9XG5cbiAgY29uc3QgbmV3Tm9kZUtleXMgPSBPYmplY3Qua2V5cyhuZXdWTm9kZVByb3BzKTtcbiAgY29uc3Qgb2xkTm9kZUtleXMgPSBPYmplY3Qua2V5cyhvbGRWTm9kZVByb3BzKTtcbiAgY29uc3QgYXR0cmlidXRlc1RvUmVtb3ZlID0gb2xkTm9kZUtleXMuZmlsdGVyKGsgPT4gIW5ld05vZGVLZXlzLmluY2x1ZGVzKGspKTtcblxuICByZXR1cm4gY29tcG9zZShcbiAgICByZW1vdmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXNUb1JlbW92ZSksXG4gICAgc2V0QXR0cmlidXRlcyhuZXdOb2RlS2V5cy5tYXAocGFpcmlmeShuZXdWTm9kZVByb3BzKSkpXG4gICk7XG59XG5cbmNvbnN0IGRvbUZhY3RvcnkgPSBjcmVhdGVEb21Ob2RlO1xuXG4vLyBhcHBseSB2bm9kZSBkaWZmaW5nIHRvIGFjdHVhbCBkb20gbm9kZSAoaWYgbmV3IG5vZGUgPT4gaXQgd2lsbCBiZSBtb3VudGVkIGludG8gdGhlIHBhcmVudClcbmNvbnN0IGRvbWlmeSA9IGZ1bmN0aW9uIHVwZGF0ZURvbSAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlKSB7XG4gIGlmICghb2xkVm5vZGUpIHsvL3RoZXJlIGlzIG5vIHByZXZpb3VzIHZub2RlXG4gICAgaWYgKG5ld1Zub2RlKSB7Ly9uZXcgbm9kZSA9PiB3ZSBpbnNlcnRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IHBhcmVudERvbU5vZGUuYXBwZW5kQ2hpbGQoZG9tRmFjdG9yeShuZXdWbm9kZSkpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHJldHVybiB7dm5vZGU6IG5ld1Zub2RlLCBnYXJiYWdlOiBudWxsfTtcbiAgICB9IGVsc2Ugey8vZWxzZSAoaXJyZWxldmFudClcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgb3BlcmF0aW9uJylcbiAgICB9XG4gIH0gZWxzZSB7Ly90aGVyZSBpcyBhIHByZXZpb3VzIHZub2RlXG4gICAgaWYgKCFuZXdWbm9kZSkgey8vd2UgbXVzdCByZW1vdmUgdGhlIHJlbGF0ZWQgZG9tIG5vZGVcbiAgICAgIHBhcmVudERvbU5vZGUucmVtb3ZlQ2hpbGQob2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiAoe2dhcmJhZ2U6IG9sZFZub2RlLCBkb206IG51bGx9KTtcbiAgICB9IGVsc2UgaWYgKG5ld1Zub2RlLm5vZGVUeXBlICE9PSBvbGRWbm9kZS5ub2RlVHlwZSkgey8vaXQgbXVzdCBiZSByZXBsYWNlZFxuICAgICAgbmV3Vm5vZGUuZG9tID0gZG9tRmFjdG9yeShuZXdWbm9kZSk7XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSAxO1xuICAgICAgcGFyZW50RG9tTm9kZS5yZXBsYWNlQ2hpbGQobmV3Vm5vZGUuZG9tLCBvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBvbGRWbm9kZSwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9IGVsc2Ugey8vIG9ubHkgdXBkYXRlIGF0dHJpYnV0ZXNcbiAgICAgIG5ld1Zub2RlLmRvbSA9IG9sZFZub2RlLmRvbTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IG9sZFZub2RlLmxpZmVDeWNsZSArIDE7XG4gICAgICByZXR1cm4ge2dhcmJhZ2U6IG51bGwsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIHJlbmRlciBhIHZpcnR1YWwgZG9tIG5vZGUsIGRpZmZpbmcgaXQgd2l0aCBpdHMgcHJldmlvdXMgdmVyc2lvbiwgbW91bnRpbmcgaXQgaW4gYSBwYXJlbnQgZG9tIG5vZGVcbiAqIEBwYXJhbSBvbGRWbm9kZVxuICogQHBhcmFtIG5ld1Zub2RlXG4gKiBAcGFyYW0gcGFyZW50RG9tTm9kZVxuICogQHBhcmFtIG9uTmV4dFRpY2sgY29sbGVjdCBvcGVyYXRpb25zIHRvIGJlIHByb2Nlc3NlZCBvbiBuZXh0IHRpY2tcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZXhwb3J0IGNvbnN0IHJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcmVyIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUsIG9uTmV4dFRpY2sgPSBbXSkge1xuXG4gIC8vMS4gdHJhbnNmb3JtIHRoZSBuZXcgdm5vZGUgdG8gYSB2bm9kZSBjb25uZWN0ZWQgdG8gYW4gYWN0dWFsIGRvbSBlbGVtZW50IGJhc2VkIG9uIHZub2RlIHZlcnNpb25zIGRpZmZpbmdcbiAgLy8gaS4gbm90ZSBhdCB0aGlzIHN0ZXAgb2NjdXIgZG9tIGluc2VydGlvbnMvcmVtb3ZhbHNcbiAgLy8gaWkuIGl0IG1heSBjb2xsZWN0IHN1YiB0cmVlIHRvIGJlIGRyb3BwZWQgKG9yIFwidW5tb3VudGVkXCIpXG4gIGNvbnN0IHt2bm9kZSwgZ2FyYmFnZX0gPSBkb21pZnkob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlKTtcblxuICBpZiAoZ2FyYmFnZSAhPT0gbnVsbCkge1xuICAgIC8vIGRlZmVyIHVubW91bnQgbGlmZWN5Y2xlIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgZm9yIChsZXQgZyBvZiB0cmF2ZXJzZShnYXJiYWdlKSkge1xuICAgICAgaWYgKGcub25Vbk1vdW50KSB7XG4gICAgICAgIG9uTmV4dFRpY2sucHVzaChnLm9uVW5Nb3VudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy9Ob3JtYWxpc2F0aW9uIG9mIG9sZCBub2RlIChpbiBjYXNlIG9mIGEgcmVwbGFjZSB3ZSB3aWxsIGNvbnNpZGVyIG9sZCBub2RlIGFzIGVtcHR5IG5vZGUgKG5vIGNoaWxkcmVuLCBubyBwcm9wcykpXG4gIGNvbnN0IHRlbXBPbGROb2RlID0gZ2FyYmFnZSAhPT0gbnVsbCB8fCAhb2xkVm5vZGUgPyB7bGVuZ3RoOiAwLCBjaGlsZHJlbjogW10sIHByb3BzOiB7fX0gOiBvbGRWbm9kZTtcblxuICBpZiAodm5vZGUpIHtcblxuICAgIC8vMi4gdXBkYXRlIGRvbSBhdHRyaWJ1dGVzIGJhc2VkIG9uIHZub2RlIHByb3AgZGlmZmluZy5cbiAgICAvL3N5bmNcbiAgICBpZiAodm5vZGUub25VcGRhdGUgJiYgdm5vZGUubGlmZUN5Y2xlID4gMSkge1xuICAgICAgdm5vZGUub25VcGRhdGUoKTtcbiAgICB9XG5cbiAgICB1cGRhdGVBdHRyaWJ1dGVzKHZub2RlLCB0ZW1wT2xkTm9kZSkodm5vZGUuZG9tKTtcblxuICAgIC8vZmFzdCBwYXRoXG4gICAgaWYgKHZub2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICAgIHJldHVybiBvbk5leHRUaWNrO1xuICAgIH1cblxuICAgIGlmICh2bm9kZS5vbk1vdW50ICYmIHZub2RlLmxpZmVDeWNsZSA9PT0gMSkge1xuICAgICAgb25OZXh0VGljay5wdXNoKCgpID0+IHZub2RlLm9uTW91bnQoKSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2hpbGRyZW5Db3VudCA9IE1hdGgubWF4KHRlbXBPbGROb2RlLmNoaWxkcmVuLmxlbmd0aCwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKTtcblxuICAgIC8vYXN5bmMgd2lsbCBiZSBkZWZlcnJlZCBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGNvbnN0IHNldExpc3RlbmVycyA9IHVwZGF0ZUV2ZW50TGlzdGVuZXJzKHZub2RlLCB0ZW1wT2xkTm9kZSk7XG4gICAgaWYgKHNldExpc3RlbmVycyAhPT0gbm9vcCkge1xuICAgICAgb25OZXh0VGljay5wdXNoKCgpID0+IHNldExpc3RlbmVycyh2bm9kZS5kb20pKTtcbiAgICB9XG5cbiAgICAvLzMgcmVjdXJzaXZlbHkgdHJhdmVyc2UgY2hpbGRyZW4gdG8gdXBkYXRlIGRvbSBhbmQgY29sbGVjdCBmdW5jdGlvbnMgdG8gcHJvY2VzcyBvbiBuZXh0IHRpY2tcbiAgICBpZiAoY2hpbGRyZW5Db3VudCA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Db3VudDsgaSsrKSB7XG4gICAgICAgIC8vIHdlIHBhc3Mgb25OZXh0VGljayBhcyByZWZlcmVuY2UgKGltcHJvdmUgcGVyZjogbWVtb3J5ICsgc3BlZWQpXG4gICAgICAgIHJlbmRlcih0ZW1wT2xkTm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmRvbSwgb25OZXh0VGljayk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9uTmV4dFRpY2s7XG59O1xuXG5leHBvcnQgY29uc3QgbW91bnQgPSBjdXJyeShmdW5jdGlvbiAoY29tcCwgaW5pdFByb3AsIHJvb3QpIHtcbiAgY29uc3Qgdm5vZGUgPSBjb21wLm5vZGVUeXBlICE9PSB2b2lkIDAgPyBjb21wIDogY29tcChpbml0UHJvcCB8fCB7fSk7XG4gIGNvbnN0IGJhdGNoID0gcmVuZGVyKG51bGwsIHZub2RlLCByb290KTtcbiAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgIGZvciAobGV0IG9wIG9mIGJhdGNoKSB7XG4gICAgICBvcCgpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiB2bm9kZTtcbn0pOyIsImltcG9ydCB7cmVuZGVyfSBmcm9tICcuL3RyZWUnO1xuaW1wb3J0IHtuZXh0VGlja30gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDcmVhdGUgYSBmdW5jdGlvbiB3aGljaCB3aWxsIHRyaWdnZXIgYW4gdXBkYXRlIG9mIHRoZSBjb21wb25lbnQgd2l0aCB0aGUgcGFzc2VkIHN0YXRlXG4gKiBAcGFyYW0gY29tcFxuICogQHBhcmFtIGluaXRpYWxWTm9kZVxuICogQHJldHVybnMge2Z1bmN0aW9uKCo9LCAuLi5bKl0pfVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB1cGRhdGUgKGNvbXAsIGluaXRpYWxWTm9kZSkge1xuICBsZXQgb2xkTm9kZSA9IGluaXRpYWxWTm9kZTtcbiAgY29uc3QgdXBkYXRlRnVuYyA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IG1vdW50ID0gb2xkTm9kZS5kb20ucGFyZW50Tm9kZTtcbiAgICBjb25zdCBuZXdOb2RlID0gY29tcChPYmplY3QuYXNzaWduKHtjaGlsZHJlbjogb2xkTm9kZS5jaGlsZHJlbiB8fCBbXX0sIG9sZE5vZGUucHJvcHMsIHByb3BzKSwgLi4uYXJncyk7XG4gICAgY29uc3QgbmV4dEJhdGNoID0gcmVuZGVyKG9sZE5vZGUsIG5ld05vZGUsIG1vdW50KTtcblxuICAgIC8vIGRhbmdlciB6b25lICEhISFcbiAgICAvLyBjaGFuZ2UgYnkga2VlcGluZyB0aGUgc2FtZSByZWZlcmVuY2Ugc28gdGhlIGV2ZW50dWFsIHBhcmVudCBub2RlIGRvZXMgbm90IG5lZWQgdG8gYmUgXCJhd2FyZVwiIHRyZWUgbWF5IGhhdmUgY2hhbmdlZCBkb3duc3RyZWFtOiBvbGROb2RlIG1heSBiZSB0aGUgY2hpbGQgb2Ygc29tZW9uZSAuLi4od2VsbCB0aGF0IGlzIGEgdHJlZSBkYXRhIHN0cnVjdHVyZSBhZnRlciBhbGwgOlAgKVxuICAgIG9sZE5vZGUgPSBPYmplY3QuYXNzaWduKG9sZE5vZGUgfHwge30sIG5ld05vZGUpO1xuICAgIC8vIGVuZCBkYW5nZXIgem9uZVxuXG4gICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgZm9yIChsZXQgb3Agb2YgbmV4dEJhdGNoKSB7XG4gICAgICAgIG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGU7XG4gIH07XG4gIHJldHVybiB1cGRhdGVGdW5jO1xufSIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IGxpZmVDeWNsZUZhY3RvcnkgPSBtZXRob2QgPT4gY3VycnkoKGZuLCBjb21wKSA9PiAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgY29uc3QgbiA9IGNvbXAocHJvcHMsIC4uLmFyZ3MpO1xuICBuW21ldGhvZF0gPSAoKSA9PiBmbihuLCAuLi5hcmdzKTtcbiAgcmV0dXJuIG47XG59KTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgbW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uTW91bnQnKTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgdW5tb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvblVuTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvblVuTW91bnQnKTtcblxuZXhwb3J0IGNvbnN0IG9uVXBkYXRlID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25VcGRhdGUnKTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudCwgb25VcGRhdGV9IGZyb20gJy4vbGlmZUN5Y2xlcyc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbi8qKlxuICogQ29tYmluYXRvciB0byBjcmVhdGUgYSBcInN0YXRlZnVsIGNvbXBvbmVudFwiOiBpZSBpdCB3aWxsIGhhdmUgaXRzIG93biBzdGF0ZSBhbmQgdGhlIGFiaWxpdHkgdG8gdXBkYXRlIGl0cyBvd24gdHJlZVxuICogQHBhcmFtIGNvbXBcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGNvbXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBsZXQgdXBkYXRlRnVuYztcbiAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgLy9sYXp5IGV2YWx1YXRlIHVwZGF0ZUZ1bmMgKHRvIG1ha2Ugc3VyZSBpdCBpcyBkZWZpbmVkXG4gICAgICBjb25zdCBzZXRTdGF0ZSA9IChuZXdTdGF0ZSkgPT4gdXBkYXRlRnVuYyhuZXdTdGF0ZSk7XG4gICAgICByZXR1cm4gY29tcChwcm9wcywgc2V0U3RhdGUsIC4uLmFyZ3MpO1xuICAgIH07XG4gICAgY29uc3Qgc2V0VXBkYXRlRnVuY3Rpb24gPSAodm5vZGUpID0+IHtcbiAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUod3JhcHBlckNvbXAsIHZub2RlKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBvc2Uob25Nb3VudChzZXRVcGRhdGVGdW5jdGlvbiksIG9uVXBkYXRlKHNldFVwZGF0ZUZ1bmN0aW9uKSkod3JhcHBlckNvbXApO1xuICB9O1xufTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudH0gZnJvbSAnLi9saWZlQ3ljbGVzJztcbmltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuLy90b2RvIHRocm93IHRoaXMgaW4gZmF2b3Igb2YgY29ubmVjdCBvbmx5ID9cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHZpZXcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7bW9kZWwsIHVwZGF0ZXMsIHN1YnNjcmlwdGlvbnMgPSBbXX09e30pIHtcbiAgICBsZXQgdXBkYXRlRnVuYztcbiAgICBsZXQgYWN0aW9uU3RvcmUgPSB7fTtcbiAgICBmb3IgKGxldCB1cGRhdGUgb2YgT2JqZWN0LmtleXModXBkYXRlcykpIHtcbiAgICAgIGFjdGlvblN0b3JlW3VwZGF0ZV0gPSAoLi4uYXJncykgPT4ge1xuICAgICAgICBtb2RlbCA9IHVwZGF0ZXNbdXBkYXRlXShtb2RlbCwgLi4uYXJncyk7IC8vdG9kbyBjb25zaWRlciBzaWRlIGVmZmVjdHMsIG1pZGRsZXdhcmVzLCBldGNcbiAgICAgICAgcmV0dXJuIHVwZGF0ZUZ1bmMobW9kZWwsIGFjdGlvblN0b3JlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb21wID0gKCkgPT4gdmlldyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuXG4gICAgY29uc3QgaW5pdEFjdGlvblN0b3JlID0gKHZub2RlKSA9PiB7XG4gICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKGNvbXAsIHZub2RlKTtcbiAgICB9O1xuICAgIGNvbnN0IGluaXRTdWJzY3JpcHRpb24gPSBzdWJzY3JpcHRpb25zLm1hcChzdWIgPT4gdm5vZGUgPT4gc3ViKHZub2RlLCBhY3Rpb25TdG9yZSkpO1xuICAgIGNvbnN0IGluaXRGdW5jID0gY29tcG9zZShpbml0QWN0aW9uU3RvcmUsIC4uLmluaXRTdWJzY3JpcHRpb24pO1xuXG4gICAgcmV0dXJuIG9uTW91bnQoaW5pdEZ1bmMsIGNvbXApO1xuICB9O1xufTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7Y29tcG9zZSwgY3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQge29uTW91bnQsIG9uVW5Nb3VudH0gZnJvbSAnLi9saWZlQ3ljbGVzJ1xuaW1wb3J0IHtpc0RlZXBFcXVhbCwgaWRlbnRpdHl9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ29ubmVjdCBjb21iaW5hdG9yOiB3aWxsIGNyZWF0ZSBcImNvbnRhaW5lclwiIGNvbXBvbmVudCB3aGljaCB3aWxsIHN1YnNjcmliZSB0byBhIFJlZHV4IGxpa2Ugc3RvcmUuIGFuZCB1cGRhdGUgaXRzIGNoaWxkcmVuIHdoZW5ldmVyIGEgc3BlY2lmaWMgc2xpY2Ugb2Ygc3RhdGUgY2hhbmdlIHVuZGVyIHNwZWNpZmljIGNpcmN1bXN0YW5jZXNcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHN0b3JlLCBhY3Rpb25zID0ge30sIHNsaWNlU3RhdGUgPSBpZGVudGl0eSkge1xuICByZXR1cm4gZnVuY3Rpb24gKGNvbXAsIG1hcFN0YXRlVG9Qcm9wID0gaWRlbnRpdHksIHNob3VsZFVwYXRlID0gKGEsIGIpID0+IGlzRGVlcEVxdWFsKGEsIGIpID09PSBmYWxzZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoaW5pdFByb3ApIHtcbiAgICAgIGxldCBjb21wb25lbnRQcm9wcyA9IGluaXRQcm9wO1xuICAgICAgbGV0IHVwZGF0ZUZ1bmMsIHByZXZpb3VzU3RhdGVTbGljZSwgdW5zdWJzY3JpYmVyO1xuXG4gICAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgICByZXR1cm4gY29tcChwcm9wcywgYWN0aW9ucywgLi4uYXJncyk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBzdWJzY3JpYmUgPSBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgICAgIHVuc3Vic2NyaWJlciA9IHN0b3JlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdGVTbGljZSA9IHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgaWYgKHNob3VsZFVwYXRlKHByZXZpb3VzU3RhdGVTbGljZSwgc3RhdGVTbGljZSkgPT09IHRydWUpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50UHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHN0YXRlU2xpY2UpKTtcbiAgICAgICAgICAgIHVwZGF0ZUZ1bmMoY29tcG9uZW50UHJvcHMpO1xuICAgICAgICAgICAgcHJldmlvdXNTdGF0ZVNsaWNlID0gc3RhdGVTbGljZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gb25Vbk1vdW50KCgpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmVyKCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNvbXBvc2Uoc3Vic2NyaWJlLCB1bnN1YnNjcmliZSkod3JhcHBlckNvbXApO1xuICAgIH07XG4gIH07XG59OyIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHtofSBmcm9tICcuLi9pbmRleCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnY3JlYXRlIHJlZ3VsYXIgaHRtbCBub2RlJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IHZub2RlID0gaCgnZGl2Jywge2lkOiAnc29tZUlkJywgXCJjbGFzc1wiOiAnc3BlY2lhbCd9KTtcbiAgICB0LmRlZXBFcXVhbCh2bm9kZSwge25vZGVUeXBlOiAnZGl2JywgcHJvcHM6IHtpZDogJ3NvbWVJZCcsIFwiY2xhc3NcIjogJ3NwZWNpYWwnfSwgY2hpbGRyZW46IFtdfSk7XG4gIH0pXG4gIC50ZXN0KCdjcmVhdGUgcmVndWxhciBodG1sIG5vZGUgd2l0aCB0ZXh0IG5vZGUgY2hpbGRyZW4nLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3Qgdm5vZGUgPSBoKCdkaXYnLCB7aWQ6ICdzb21lSWQnLCBcImNsYXNzXCI6ICdzcGVjaWFsJ30sICdmb28nKTtcbiAgICB0LmRlZXBFcXVhbCh2bm9kZSwge1xuICAgICAgbm9kZVR5cGU6ICdkaXYnLCBwcm9wczoge2lkOiAnc29tZUlkJywgXCJjbGFzc1wiOiAnc3BlY2lhbCd9LCBjaGlsZHJlbjogW3tcbiAgICAgICAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICBwcm9wczoge3ZhbHVlOiAnZm9vJ31cbiAgICAgIH1dXG4gICAgfSk7XG4gIH0pXG4gIC50ZXN0KCdjcmVhdGUgcmVndWxhciBodG1sIHdpdGggY2hpbGRyZW4nLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3Qgdm5vZGUgPSBoKCd1bCcsIHtpZDogJ2NvbGxlY3Rpb24nfSwgaCgnbGknLCB7aWQ6IDF9LCAnaXRlbTEnKSwgaCgnbGknLCB7aWQ6IDJ9LCAnaXRlbTInKSk7XG4gICAgdC5kZWVwRXF1YWwodm5vZGUsIHtcbiAgICAgIG5vZGVUeXBlOiAndWwnLFxuICAgICAgcHJvcHM6IHtpZDogJ2NvbGxlY3Rpb24nfSxcbiAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBub2RlVHlwZTogJ2xpJyxcbiAgICAgICAgICBwcm9wczoge2lkOiAxfSxcbiAgICAgICAgICBjaGlsZHJlbjogW3tcbiAgICAgICAgICAgIG5vZGVUeXBlOiAnVGV4dCcsXG4gICAgICAgICAgICBwcm9wczoge3ZhbHVlOiAnaXRlbTEnfSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXVxuICAgICAgICAgIH1dXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBub2RlVHlwZTogJ2xpJyxcbiAgICAgICAgICBwcm9wczoge2lkOiAyfSxcbiAgICAgICAgICBjaGlsZHJlbjogW3tcbiAgICAgICAgICAgIG5vZGVUeXBlOiAnVGV4dCcsXG4gICAgICAgICAgICBwcm9wczoge3ZhbHVlOiAnaXRlbTInfSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXVxuICAgICAgICAgIH1dXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfSlcbiAgLnRlc3QoJ3VzZSBmdW5jdGlvbiBhcyBjb21wb25lbnQgcGFzc2luZyB0aGUgY2hpbGRyZW4gYXMgcHJvcCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBmb28gPSAocHJvcHMpID0+IGgoJ3AnLCBwcm9wcyk7XG4gICAgY29uc3Qgdm5vZGUgPSBoKGZvbywge2lkOiAxfSwgJ2hlbGxvIHdvcmxkJyk7XG4gICAgdC5kZWVwRXF1YWwodm5vZGUsIHtcbiAgICAgIG5vZGVUeXBlOiAncCcsXG4gICAgICBwcm9wczoge1xuICAgICAgICBjaGlsZHJlbjogW3tcbiAgICAgICAgICBub2RlVHlwZTogJ1RleHQnLFxuICAgICAgICAgIGNoaWxkcmVuOiBbXSxcbiAgICAgICAgICBwcm9wczoge3ZhbHVlOiAnaGVsbG8gd29ybGQnfVxuICAgICAgICB9XSxcbiAgICAgICAgaWQ6IDFcbiAgICAgIH0sXG4gICAgICBjaGlsZHJlbjogW11cbiAgICB9KTtcbiAgfSlcbiAgLnRlc3QoJ3VzZSBuZXN0ZWQgY29tYmluYXRvciB0byBjcmVhdGUgdm5vZGUnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgY29tYmluYXRvciA9ICgpID0+ICgpID0+ICgpID0+ICgpID0+IChwcm9wcykgPT4gaCgncCcsIHtpZDogJ2Zvbyd9KTtcbiAgICBjb25zdCB2bm9kZSA9IGgoY29tYmluYXRvciwge30pO1xuICAgIHQuZGVlcEVxdWFsKHZub2RlLCB7bm9kZVR5cGU6ICdwJywgcHJvcHM6IHtpZDogJ2Zvbyd9LCBjaGlsZHJlbjogW119KTtcbiAgfSlcblxuIiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQgdXRpbCBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IGRvbVV0aWwgZnJvbSAnLi9kb21VdGlsJztcbmltcG9ydCBoIGZyb20gJy4vaCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCh1dGlsKVxuICAudGVzdChkb21VdGlsKVxuICAudGVzdChoKTtcbiIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHttb3VudCwgaH0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ21vdW50IGEgc2ltcGxlIGNvbXBvbmVudCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb25zdCBDb21wID0gKHByb3BzKSA9PiAoPGgxPjxzcGFuIGlkPXtwcm9wcy5pZH0+e3Byb3BzLmdyZWV0aW5nfTwvc3Bhbj48L2gxPik7XG4gICAgbW91bnQoQ29tcCwge2lkOiAxMjMsIGdyZWV0aW5nOiAnaGVsbG8gd29ybGQnfSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8aDE+PHNwYW4gaWQ9XCIxMjNcIj5oZWxsbyB3b3JsZDwvc3Bhbj48L2gxPicpO1xuICB9KVxuICAudGVzdCgnbW91bnQgY29tcG9zZWQgY29tcG9uZW50JywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IENvbXAgPSAocHJvcHMpID0+ICg8aDE+PHNwYW4gaWQ9e3Byb3BzLmlkfT57cHJvcHMuZ3JlZXRpbmd9PC9zcGFuPjwvaDE+KTtcbiAgICBjb25zdCBDb250YWluZXIgPSAocHJvcHMpID0+ICg8c2VjdGlvbj5cbiAgICAgIDxDb21wIGlkPVwiNTY3XCIgZ3JlZXRpbmc9XCJoZWxsbyB5b3VcIi8+XG4gICAgPC9zZWN0aW9uPik7XG4gICAgbW91bnQoQ29udGFpbmVyLCB7fSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8c2VjdGlvbj48aDE+PHNwYW4gaWQ9XCI1NjdcIj5oZWxsbyB5b3U8L3NwYW4+PC9oMT48L3NlY3Rpb24+Jyk7XG4gIH0pXG4gIC50ZXN0KCdtb3VudCBhIGNvbXBvbmVudCB3aXRoIGlubmVyIGNoaWxkJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IENvbXAgPSAocHJvcHMpID0+ICg8aDE+PHNwYW4gaWQ9e3Byb3BzLmlkfT57cHJvcHMuZ3JlZXRpbmd9PC9zcGFuPjwvaDE+KTtcbiAgICBjb25zdCBDb250YWluZXIgPSAocHJvcHMpID0+ICg8c2VjdGlvbj57cHJvcHMuY2hpbGRyZW59PC9zZWN0aW9uPik7XG4gICAgbW91bnQoKCkgPT4gPENvbnRhaW5lcj48Q29tcCBpZD1cIjU2N1wiIGdyZWV0aW5nPVwiaGVsbG8gd29ybGRcIi8+PC9Db250YWluZXI+LCB7fSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8c2VjdGlvbj48aDE+PHNwYW4gaWQ9XCI1NjdcIj5oZWxsbyB3b3JsZDwvc3Bhbj48L2gxPjwvc2VjdGlvbj4nKTtcbiAgfSlcbiIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHt1cGRhdGUsIG1vdW50LCBofSBmcm9tICcuLi8uLi9pbmRleCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnZ2l2ZSBhYmlsaXR5IHRvIHVwZGF0ZSBhIG5vZGUgKGFuZCBpdHMgZGVzY2VuZGFudCknLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgY29tcCA9ICgoe2lkLCBjb250ZW50fSkgPT4gKDxwIGlkPXtpZH0+e2NvbnRlbnR9PC9wPikpO1xuICAgIGNvbnN0IGluaXRpYWxWbm9kZSA9IG1vdW50KGNvbXAsIHtpZDogMTIzLCBjb250ZW50OiAnaGVsbG8gd29ybGQnfSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8cCBpZD1cIjEyM1wiPmhlbGxvIHdvcmxkPC9wPicpO1xuICAgIGNvbnN0IHVwZGF0ZUZ1bmMgPSB1cGRhdGUoY29tcCwgaW5pdGlhbFZub2RlKTtcbiAgICB1cGRhdGVGdW5jKHtpZDogNTY3LCBjb250ZW50OiAnYm9uam91ciBtb25kZSd9KTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8cCBpZD1cIjU2N1wiPmJvbmpvdXIgbW9uZGU8L3A+Jyk7XG4gIH0pO1xuIiwiZXhwb3J0IGZ1bmN0aW9uIHdhaXROZXh0VGljayAoKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0sIDIpXG4gIH0pXG59IiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQge29uTW91bnQsIG9uVW5Nb3VudCwgaCwgbW91bnQsIHJlbmRlcn0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHt3YWl0TmV4dFRpY2t9IGZyb20gJy4vdXRpbCdcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdzaG91bGQgcnVuIGEgZnVuY3Rpb24gd2hlbiBjb21wb25lbnQgaXMgbW91bnRlZCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgY291bnRlciA9IDA7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgY29tcCA9ICgpID0+IDxwPmhlbGxvIHdvcmxkPC9wPjtcbiAgICBjb25zdCB3aXRoTW91bnQgPSBvbk1vdW50KCgpID0+IHtcbiAgICAgIGNvdW50ZXIrK1xuICAgIH0sIGNvbXApO1xuICAgIG1vdW50KHdpdGhNb3VudCwge30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb3VudGVyLCAwKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICB0LmVxdWFsKGNvdW50ZXIsIDEpO1xuICB9KVxuICAudGVzdCgnc2hvdWxkIHJ1biBhIGZ1bmN0aW9uIHdoZW4gY29tcG9uZW50IGlzIHVuTW91bnRlZCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgdW5tb3VudGVkID0gbnVsbDtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb25zdCBJdGVtID0gb25Vbk1vdW50KChuKSA9PiB7XG4gICAgICB1bm1vdW50ZWQgPSBuO1xuICAgIH0sICh7aWR9KSA9PiA8bGkgaWQ9e2lkfT5oZWxsbyB3b3JsZDwvbGk+KTtcbiAgICBjb25zdCBjb250YWluZXJDb21wID0gKCh7aXRlbXN9KSA9PiAoPHVsPlxuICAgICAge1xuICAgICAgICBpdGVtcy5tYXAoaXRlbSA9PiA8SXRlbSB7Li4uaXRlbX0vPilcbiAgICAgIH1cbiAgICA8L3VsPikpO1xuXG4gICAgY29uc3Qgdm5vZGUgPSBtb3VudChjb250YWluZXJDb21wLCB7aXRlbXM6IFt7aWQ6IDF9LCB7aWQ6IDJ9LCB7aWQ6IDN9XX0sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHVsPjxsaSBpZD1cIjFcIj5oZWxsbyB3b3JsZDwvbGk+PGxpIGlkPVwiMlwiPmhlbGxvIHdvcmxkPC9saT48bGkgaWQ9XCIzXCI+aGVsbG8gd29ybGQ8L2xpPjwvdWw+Jyk7XG4gICAgY29uc3QgYmF0Y2ggPSByZW5kZXIodm5vZGUsIGNvbnRhaW5lckNvbXAoe2l0ZW1zOiBbe2lkOiAxfSwge2lkOiAzfV19KSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8dWw+PGxpIGlkPVwiMVwiPmhlbGxvIHdvcmxkPC9saT48bGkgaWQ9XCIzXCI+aGVsbG8gd29ybGQ8L2xpPjwvdWw+Jyk7XG4gICAgZm9yIChsZXQgZiBvZiBiYXRjaCl7XG4gICAgICBmKCk7XG4gICAgfVxuICAgIHQubm90RXF1YWwodW5tb3VudGVkLCBudWxsKTtcbiAgfSkiLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7aCwgd2l0aFN0YXRlLCBtb3VudH0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHt3YWl0TmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnYmluZCBhbiB1cGRhdGUgZnVuY3Rpb24gdG8gYSBjb21wb25lbnQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgbGV0IHVwZGF0ZSA9IG51bGw7XG4gICAgY29uc3QgQ29tcCA9IHdpdGhTdGF0ZSgoe2Zvb30sIHNldFN0YXRlKSA9PiB7XG4gICAgICBpZiAoIXVwZGF0ZSkge1xuICAgICAgICB1cGRhdGUgPSBzZXRTdGF0ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiA8cD57Zm9vfTwvcD47XG4gICAgfSk7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbW91bnQoKHtmb299KSA9PiA8Q29tcCBmb289e2Zvb30vPiwge2ZvbzogJ2Jhcid9LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxwPmJhcjwvcD4nKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICB1cGRhdGUoe2ZvbzogJ2Jpcyd9KTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8cD5iaXM8L3A+Jyk7XG4gIH0pXG4gIC50ZXN0KCdzaG91bGQgY3JlYXRlIGlzb2xhdGVkIHN0YXRlIGZvciBlYWNoIGNvbXBvbmVudCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgdXBkYXRlMSA9IG51bGw7XG4gICAgbGV0IHVwZGF0ZTIgPSBudWxsO1xuICAgIGNvbnN0IENvbXAgPSB3aXRoU3RhdGUoKHtmb299LCBzZXRTdGF0ZSkgPT4ge1xuICAgICAgaWYgKCF1cGRhdGUxKSB7XG4gICAgICAgIHVwZGF0ZTEgPSBzZXRTdGF0ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXVwZGF0ZTIpIHtcbiAgICAgICAgdXBkYXRlMiA9IHNldFN0YXRlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gPHA+e2Zvb308L3A+O1xuICAgIH0pO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG1vdW50KCh7Zm9vMSwgZm9vMn0pID0+IDxkaXY+PENvbXAgZm9vPXtmb28xfS8+PENvbXAgZm9vPXtmb28yfS8+PC9kaXY+LCB7Zm9vMTogJ2JhcicsIGZvbzI6ICdiYXIyJ30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPGRpdj48cD5iYXI8L3A+PHA+YmFyMjwvcD48L2Rpdj4nKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICB1cGRhdGUxKHtmb286ICdiaXMnfSk7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPGRpdj48cD5iaXM8L3A+PHA+YmFyMjwvcD48L2Rpdj4nKTtcbiAgICB1cGRhdGUyKHtmb286ICdibGFoJ30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxkaXY+PHA+YmlzPC9wPjxwPmJsYWg8L3A+PC9kaXY+Jyk7XG4gIH0pIiwiaW1wb3J0IGluZGV4IGZyb20gJy4uL2luZGV4JztcbmltcG9ydCByZW5kZXIgZnJvbSAnLi9yZW5kZXInO1xuaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQgbGlmZWN5Y2xlcyBmcm9tICcuL2xpZmVjeWNsZXMnO1xuaW1wb3J0IHdpdGhTdGF0ZSBmcm9tICcuL3dpdGhTdGF0ZSc7XG5pbXBvcnQgem9yYSBmcm9tICd6b3JhJztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KGluZGV4KVxuICAudGVzdChyZW5kZXIpXG4gIC50ZXN0KHVwZGF0ZSlcbiAgLnRlc3QobGlmZWN5Y2xlcylcbiAgLnRlc3Qod2l0aFN0YXRlKVxuICAucnVuKCk7XG5cbiJdLCJuYW1lcyI6WyJpbmRleCIsImluZGV4JDEiLCJwbGFuIiwiem9yYSIsInRhcCIsImgiLCJtb3VudCIsInVwZGF0ZSIsInJlbmRlciIsIndpdGhTdGF0ZSJdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7QUFJQSxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQzs7Ozs7O0FBTWxDLElBQUlBLE9BQUssR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FB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RUFBRSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVCLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztPQUNSO0tBQ0YsQ0FBQzs7SUFFRixNQUFNLFFBQVEsR0FBRyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0dBQzlDLENBQUM7R0FDRCxJQUFJLENBQUMsNERBQTRELEVBQUUsWUFBWSxDQUFDLEVBQUU7SUFDakYsTUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDeEMsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzFCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0dBQzdELENBQUM7R0FDRCxJQUFJLENBQUMsaUNBQWlDLEVBQUUsWUFBWSxDQUFDLEVBQUU7SUFDdEQsTUFBTSxNQUFNLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxD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
