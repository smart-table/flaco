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

//todo provide a generator free version (for old stupid browsers and Safari) :) (cf traverseAsArray)
const traverse = function * (vnode) {
  yield vnode;
  if (vnode.children && vnode.children.length) {
    for (let child of vnode.children) {
      yield * traverse(child);
    }
  }
};



const nextTick = fn => setTimeout(fn, 0);

const pairify = holder => key => [key, holder[key]];

const isShallowEqual = (a, b) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k]);
};

const noop = () => {
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
      parentDomNode.replaceChild(newVnode.dom, oldVnode.dom);
      return {garbage: oldVnode, vnode: newVnode};
    } else {// only update attributes
      newVnode.dom = oldVnode.dom;
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

  //1. get the actual dom element related to virtual dom diff && collect node to remove/clean
  const {vnode, garbage} = domify(oldVnode, newVnode, parentDomNode);

  if (garbage !== null) {
    // defer cleaning lifecycle
    for (let g of traverse(garbage)) {
      if (g.onUnMount) {
        onNextTick.push(g.onUnMount);
      }
    }
  }

  //Normalisation of old node (in case of a replace we will consider old node as empty node (no children, no props))
  const tempOldNode = garbage !== null || !oldVnode ? {length: 0, children: [], props: {}} : oldVnode;

  //2. update attributes
  if (vnode) {
    //sync
    updateAttributes(vnode, tempOldNode)(vnode.dom);

    //fast path
    if (vnode.nodeType === 'Text') {
      return onNextTick;
    }

    const childrenCount = Math.max(tempOldNode.children.length, vnode.children.length);

    //todo check for a lifecycle to avoid to run onMount when component has been mounted yet
    if (vnode.onMount) {
      onNextTick.push(() => vnode.onMount());
    }

    //async (not part of the view)
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
  const vnode = comp(initProp || {});
  const batch = render(null, vnode, root);
  nextTick(function () {
    while (batch.length) {
      const op = batch.shift();
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

    //todo danger zone
    oldNode = Object.assign(oldNode || {}, newNode); // change by reference so the parent node does not need to be "aware" tree may have changed downstream
    //oldnode = vnode
    //todo end danger zone

    nextTick(function () {
      while (nextBatch.length) {
        const op = nextBatch.shift();
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

/**
 * Combinator to create a "stateful component": ie it will have its own state
 * @param comp
 * @returns {Function}
 */
var withState = function (comp) {
  return function () {
    let updateFunc;
    const wrapperComp = (props, ...args) => {
      // wrap the function call when the component has not been mounted yet (lazy evaluation to make sure the updateFunc has been set);
      const setState = updateFunc ? updateFunc : (newState) => updateFunc(newState);
      return comp(props, setState, ...args);
    };

    return onMount((vnode) => {
      updateFunc = update(wrapperComp, vnode);
    }, wrapperComp);
  };
};

/**
 * Combinator to create a Elm like app
 * @param view
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9ub2RlX21vZHVsZXMvem9yYS9kaXN0L3pvcmEuZXMuanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uL3V0aWwuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vLi4vbGliL2RvbVV0aWwuanMiLCIuLi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL2guanMiLCIuLi8uLi9saWIvdHJlZS5qcyIsIi4uLy4uL2xpYi91cGRhdGUuanMiLCIuLi8uLi9saWIvbGlmZUN5Y2xlcy5qcyIsIi4uLy4uL2xpYi93aXRoU3RhdGUuanMiLCIuLi8uLi9saWIvZWxtLmpzIiwiLi4vaC5qcyIsIi4uL2luZGV4LmpzIiwiLi4vYnJvd3Nlci9yZW5kZXIuanMiLCIuLi9icm93c2VyL3VwZGF0ZS5qcyIsIi4uL2Jyb3dzZXIvdXRpbC5qcyIsIi4uL2Jyb3dzZXIvbGlmZWN5Y2xlcy5qcyIsIi4uL2Jyb3dzZXIvd2l0aFN0YXRlLmpzIiwiLi4vYnJvd3Nlci9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIHNsaWNlKCkgcmVmZXJlbmNlLlxuICovXG5cbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuLyoqXG4gKiBFeHBvc2UgYGNvYC5cbiAqL1xuXG52YXIgaW5kZXggPSBjb1snZGVmYXVsdCddID0gY28uY28gPSBjbztcblxuLyoqXG4gKiBXcmFwIHRoZSBnaXZlbiBnZW5lcmF0b3IgYGZuYCBpbnRvIGFcbiAqIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHByb21pc2UuXG4gKiBUaGlzIGlzIGEgc2VwYXJhdGUgZnVuY3Rpb24gc28gdGhhdFxuICogZXZlcnkgYGNvKClgIGNhbGwgZG9lc24ndCBjcmVhdGUgYSBuZXcsXG4gKiB1bm5lY2Vzc2FyeSBjbG9zdXJlLlxuICpcbiAqIEBwYXJhbSB7R2VuZXJhdG9yRnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuY28ud3JhcCA9IGZ1bmN0aW9uIChmbikge1xuICBjcmVhdGVQcm9taXNlLl9fZ2VuZXJhdG9yRnVuY3Rpb25fXyA9IGZuO1xuICByZXR1cm4gY3JlYXRlUHJvbWlzZTtcbiAgZnVuY3Rpb24gY3JlYXRlUHJvbWlzZSgpIHtcbiAgICByZXR1cm4gY28uY2FsbCh0aGlzLCBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpKTtcbiAgfVxufTtcblxuLyoqXG4gKiBFeGVjdXRlIHRoZSBnZW5lcmF0b3IgZnVuY3Rpb24gb3IgYSBnZW5lcmF0b3JcbiAqIGFuZCByZXR1cm4gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBjbyhnZW4pIHtcbiAgdmFyIGN0eCA9IHRoaXM7XG4gIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIC8vIHdlIHdyYXAgZXZlcnl0aGluZyBpbiBhIHByb21pc2UgdG8gYXZvaWQgcHJvbWlzZSBjaGFpbmluZyxcbiAgLy8gd2hpY2ggbGVhZHMgdG8gbWVtb3J5IGxlYWsgZXJyb3JzLlxuICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3RqL2NvL2lzc3Vlcy8xODBcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIGlmICh0eXBlb2YgZ2VuID09PSAnZnVuY3Rpb24nKSBnZW4gPSBnZW4uYXBwbHkoY3R4LCBhcmdzKTtcbiAgICBpZiAoIWdlbiB8fCB0eXBlb2YgZ2VuLm5leHQgIT09ICdmdW5jdGlvbicpIHJldHVybiByZXNvbHZlKGdlbik7XG5cbiAgICBvbkZ1bGZpbGxlZCgpO1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtNaXhlZH0gcmVzXG4gICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIG9uRnVsZmlsbGVkKHJlcykge1xuICAgICAgdmFyIHJldDtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldCA9IGdlbi5uZXh0KHJlcyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiByZWplY3QoZSk7XG4gICAgICB9XG4gICAgICBuZXh0KHJldCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXJyXG4gICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgKiBAYXBpIHByaXZhdGVcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIG9uUmVqZWN0ZWQoZXJyKSB7XG4gICAgICB2YXIgcmV0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0ID0gZ2VuLnRocm93KGVycik7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiByZWplY3QoZSk7XG4gICAgICB9XG4gICAgICBuZXh0KHJldCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBuZXh0IHZhbHVlIGluIHRoZSBnZW5lcmF0b3IsXG4gICAgICogcmV0dXJuIGEgcHJvbWlzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByZXRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gbmV4dChyZXQpIHtcbiAgICAgIGlmIChyZXQuZG9uZSkgcmV0dXJuIHJlc29sdmUocmV0LnZhbHVlKTtcbiAgICAgIHZhciB2YWx1ZSA9IHRvUHJvbWlzZS5jYWxsKGN0eCwgcmV0LnZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSAmJiBpc1Byb21pc2UodmFsdWUpKSByZXR1cm4gdmFsdWUudGhlbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCk7XG4gICAgICByZXR1cm4gb25SZWplY3RlZChuZXcgVHlwZUVycm9yKCdZb3UgbWF5IG9ubHkgeWllbGQgYSBmdW5jdGlvbiwgcHJvbWlzZSwgZ2VuZXJhdG9yLCBhcnJheSwgb3Igb2JqZWN0LCAnXG4gICAgICAgICsgJ2J1dCB0aGUgZm9sbG93aW5nIG9iamVjdCB3YXMgcGFzc2VkOiBcIicgKyBTdHJpbmcocmV0LnZhbHVlKSArICdcIicpKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSBgeWllbGRgZWQgdmFsdWUgaW50byBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gdG9Qcm9taXNlKG9iaikge1xuICBpZiAoIW9iaikgcmV0dXJuIG9iajtcbiAgaWYgKGlzUHJvbWlzZShvYmopKSByZXR1cm4gb2JqO1xuICBpZiAoaXNHZW5lcmF0b3JGdW5jdGlvbihvYmopIHx8IGlzR2VuZXJhdG9yKG9iaikpIHJldHVybiBjby5jYWxsKHRoaXMsIG9iaik7XG4gIGlmICgnZnVuY3Rpb24nID09IHR5cGVvZiBvYmopIHJldHVybiB0aHVua1RvUHJvbWlzZS5jYWxsKHRoaXMsIG9iaik7XG4gIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHJldHVybiBhcnJheVRvUHJvbWlzZS5jYWxsKHRoaXMsIG9iaik7XG4gIGlmIChpc09iamVjdChvYmopKSByZXR1cm4gb2JqZWN0VG9Qcm9taXNlLmNhbGwodGhpcywgb2JqKTtcbiAgcmV0dXJuIG9iajtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgdGh1bmsgdG8gYSBwcm9taXNlLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259XG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gdGh1bmtUb1Byb21pc2UoZm4pIHtcbiAgdmFyIGN0eCA9IHRoaXM7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgZm4uY2FsbChjdHgsIGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgaWYgKGVycikgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSByZXMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICByZXNvbHZlKHJlcyk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYW4gYXJyYXkgb2YgXCJ5aWVsZGFibGVzXCIgdG8gYSBwcm9taXNlLlxuICogVXNlcyBgUHJvbWlzZS5hbGwoKWAgaW50ZXJuYWxseS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBvYmpcbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBhcnJheVRvUHJvbWlzZShvYmopIHtcbiAgcmV0dXJuIFByb21pc2UuYWxsKG9iai5tYXAodG9Qcm9taXNlLCB0aGlzKSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBvYmplY3Qgb2YgXCJ5aWVsZGFibGVzXCIgdG8gYSBwcm9taXNlLlxuICogVXNlcyBgUHJvbWlzZS5hbGwoKWAgaW50ZXJuYWxseS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gb2JqZWN0VG9Qcm9taXNlKG9iail7XG4gIHZhciByZXN1bHRzID0gbmV3IG9iai5jb25zdHJ1Y3RvcigpO1xuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gIHZhciBwcm9taXNlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICB2YXIgcHJvbWlzZSA9IHRvUHJvbWlzZS5jYWxsKHRoaXMsIG9ialtrZXldKTtcbiAgICBpZiAocHJvbWlzZSAmJiBpc1Byb21pc2UocHJvbWlzZSkpIGRlZmVyKHByb21pc2UsIGtleSk7XG4gICAgZWxzZSByZXN1bHRzW2tleV0gPSBvYmpba2V5XTtcbiAgfVxuICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9KTtcblxuICBmdW5jdGlvbiBkZWZlcihwcm9taXNlLCBrZXkpIHtcbiAgICAvLyBwcmVkZWZpbmUgdGhlIGtleSBpbiB0aGUgcmVzdWx0XG4gICAgcmVzdWx0c1trZXldID0gdW5kZWZpbmVkO1xuICAgIHByb21pc2VzLnB1c2gocHJvbWlzZS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgIHJlc3VsdHNba2V5XSA9IHJlcztcbiAgICB9KSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVjayBpZiBgb2JqYCBpcyBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGlzUHJvbWlzZShvYmopIHtcbiAgcmV0dXJuICdmdW5jdGlvbicgPT0gdHlwZW9mIG9iai50aGVuO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGBvYmpgIGlzIGEgZ2VuZXJhdG9yLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGlzR2VuZXJhdG9yKG9iaikge1xuICByZXR1cm4gJ2Z1bmN0aW9uJyA9PSB0eXBlb2Ygb2JqLm5leHQgJiYgJ2Z1bmN0aW9uJyA9PSB0eXBlb2Ygb2JqLnRocm93O1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGBvYmpgIGlzIGEgZ2VuZXJhdG9yIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBpc0dlbmVyYXRvckZ1bmN0aW9uKG9iaikge1xuICB2YXIgY29uc3RydWN0b3IgPSBvYmouY29uc3RydWN0b3I7XG4gIGlmICghY29uc3RydWN0b3IpIHJldHVybiBmYWxzZTtcbiAgaWYgKCdHZW5lcmF0b3JGdW5jdGlvbicgPT09IGNvbnN0cnVjdG9yLm5hbWUgfHwgJ0dlbmVyYXRvckZ1bmN0aW9uJyA9PT0gY29uc3RydWN0b3IuZGlzcGxheU5hbWUpIHJldHVybiB0cnVlO1xuICByZXR1cm4gaXNHZW5lcmF0b3IoY29uc3RydWN0b3IucHJvdG90eXBlKTtcbn1cblxuLyoqXG4gKiBDaGVjayBmb3IgcGxhaW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbCkge1xuICByZXR1cm4gT2JqZWN0ID09IHZhbC5jb25zdHJ1Y3Rvcjtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29tbW9uanNNb2R1bGUoZm4sIG1vZHVsZSkge1xuXHRyZXR1cm4gbW9kdWxlID0geyBleHBvcnRzOiB7fSB9LCBmbihtb2R1bGUsIG1vZHVsZS5leHBvcnRzKSwgbW9kdWxlLmV4cG9ydHM7XG59XG5cbnZhciBrZXlzID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gdHlwZW9mIE9iamVjdC5rZXlzID09PSAnZnVuY3Rpb24nXG4gID8gT2JqZWN0LmtleXMgOiBzaGltO1xuXG5leHBvcnRzLnNoaW0gPSBzaGltO1xuZnVuY3Rpb24gc2hpbSAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIGtleXMucHVzaChrZXkpO1xuICByZXR1cm4ga2V5cztcbn1cbn0pO1xuXG52YXIgaXNfYXJndW1lbnRzID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xudmFyIHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPSAoZnVuY3Rpb24oKXtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmd1bWVudHMpXG59KSgpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBzdXBwb3J0c0FyZ3VtZW50c0NsYXNzID8gc3VwcG9ydGVkIDogdW5zdXBwb3J0ZWQ7XG5cbmV4cG9ydHMuc3VwcG9ydGVkID0gc3VwcG9ydGVkO1xuZnVuY3Rpb24gc3VwcG9ydGVkKG9iamVjdCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG59XG5cbmV4cG9ydHMudW5zdXBwb3J0ZWQgPSB1bnN1cHBvcnRlZDtcbmZ1bmN0aW9uIHVuc3VwcG9ydGVkKG9iamVjdCl7XG4gIHJldHVybiBvYmplY3QgJiZcbiAgICB0eXBlb2Ygb2JqZWN0ID09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIG9iamVjdC5sZW5ndGggPT0gJ251bWJlcicgJiZcbiAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCAnY2FsbGVlJykgJiZcbiAgICAhT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKG9iamVjdCwgJ2NhbGxlZScpIHx8XG4gICAgZmFsc2U7XG59XG59KTtcblxudmFyIGluZGV4JDEgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlKSB7XG52YXIgcFNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIG9iamVjdEtleXMgPSBrZXlzO1xudmFyIGlzQXJndW1lbnRzID0gaXNfYXJndW1lbnRzO1xuXG52YXIgZGVlcEVxdWFsID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3B0cykge1xuICBpZiAoIW9wdHMpIG9wdHMgPSB7fTtcbiAgLy8gNy4xLiBBbGwgaWRlbnRpY2FsIHZhbHVlcyBhcmUgZXF1aXZhbGVudCwgYXMgZGV0ZXJtaW5lZCBieSA9PT0uXG4gIGlmIChhY3R1YWwgPT09IGV4cGVjdGVkKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgfSBlbHNlIGlmIChhY3R1YWwgaW5zdGFuY2VvZiBEYXRlICYmIGV4cGVjdGVkIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiBhY3R1YWwuZ2V0VGltZSgpID09PSBleHBlY3RlZC5nZXRUaW1lKCk7XG5cbiAgLy8gNy4zLiBPdGhlciBwYWlycyB0aGF0IGRvIG5vdCBib3RoIHBhc3MgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnLFxuICAvLyBlcXVpdmFsZW5jZSBpcyBkZXRlcm1pbmVkIGJ5ID09LlxuICB9IGVsc2UgaWYgKCFhY3R1YWwgfHwgIWV4cGVjdGVkIHx8IHR5cGVvZiBhY3R1YWwgIT0gJ29iamVjdCcgJiYgdHlwZW9mIGV4cGVjdGVkICE9ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG9wdHMuc3RyaWN0ID8gYWN0dWFsID09PSBleHBlY3RlZCA6IGFjdHVhbCA9PSBleHBlY3RlZDtcblxuICAvLyA3LjQuIEZvciBhbGwgb3RoZXIgT2JqZWN0IHBhaXJzLCBpbmNsdWRpbmcgQXJyYXkgb2JqZWN0cywgZXF1aXZhbGVuY2UgaXNcbiAgLy8gZGV0ZXJtaW5lZCBieSBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGFzIHZlcmlmaWVkXG4gIC8vIHdpdGggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKSwgdGhlIHNhbWUgc2V0IG9mIGtleXNcbiAgLy8gKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksIGVxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeVxuICAvLyBjb3JyZXNwb25kaW5nIGtleSwgYW5kIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS4gTm90ZTogdGhpc1xuICAvLyBhY2NvdW50cyBmb3IgYm90aCBuYW1lZCBhbmQgaW5kZXhlZCBwcm9wZXJ0aWVzIG9uIEFycmF5cy5cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb2JqRXF1aXYoYWN0dWFsLCBleHBlY3RlZCwgb3B0cyk7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkT3JOdWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBpc0J1ZmZlciAoeCkge1xuICBpZiAoIXggfHwgdHlwZW9mIHggIT09ICdvYmplY3QnIHx8IHR5cGVvZiB4Lmxlbmd0aCAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgaWYgKHR5cGVvZiB4LmNvcHkgIT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHguc2xpY2UgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHgubGVuZ3RoID4gMCAmJiB0eXBlb2YgeFswXSAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIG9iakVxdWl2KGEsIGIsIG9wdHMpIHtcbiAgdmFyIGksIGtleTtcbiAgaWYgKGlzVW5kZWZpbmVkT3JOdWxsKGEpIHx8IGlzVW5kZWZpbmVkT3JOdWxsKGIpKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy8gYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LlxuICBpZiAoYS5wcm90b3R5cGUgIT09IGIucHJvdG90eXBlKSByZXR1cm4gZmFsc2U7XG4gIC8vfn5+SSd2ZSBtYW5hZ2VkIHRvIGJyZWFrIE9iamVjdC5rZXlzIHRocm91Z2ggc2NyZXd5IGFyZ3VtZW50cyBwYXNzaW5nLlxuICAvLyAgIENvbnZlcnRpbmcgdG8gYXJyYXkgc29sdmVzIHRoZSBwcm9ibGVtLlxuICBpZiAoaXNBcmd1bWVudHMoYSkpIHtcbiAgICBpZiAoIWlzQXJndW1lbnRzKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGEgPSBwU2xpY2UuY2FsbChhKTtcbiAgICBiID0gcFNsaWNlLmNhbGwoYik7XG4gICAgcmV0dXJuIGRlZXBFcXVhbChhLCBiLCBvcHRzKTtcbiAgfVxuICBpZiAoaXNCdWZmZXIoYSkpIHtcbiAgICBpZiAoIWlzQnVmZmVyKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdHJ5IHtcbiAgICB2YXIga2EgPSBvYmplY3RLZXlzKGEpLFxuICAgICAgICBrYiA9IG9iamVjdEtleXMoYik7XG4gIH0gY2F0Y2ggKGUpIHsvL2hhcHBlbnMgd2hlbiBvbmUgaXMgYSBzdHJpbmcgbGl0ZXJhbCBhbmQgdGhlIG90aGVyIGlzbid0XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vIGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoa2V5cyBpbmNvcnBvcmF0ZXNcbiAgLy8gaGFzT3duUHJvcGVydHkpXG4gIGlmIChrYS5sZW5ndGggIT0ga2IubGVuZ3RoKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy90aGUgc2FtZSBzZXQgb2Yga2V5cyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSxcbiAga2Euc29ydCgpO1xuICBrYi5zb3J0KCk7XG4gIC8vfn5+Y2hlYXAga2V5IHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoa2FbaV0gIT0ga2JbaV0pXG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy9lcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnkgY29ycmVzcG9uZGluZyBrZXksIGFuZFxuICAvL35+fnBvc3NpYmx5IGV4cGVuc2l2ZSBkZWVwIHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBrZXkgPSBrYVtpXTtcbiAgICBpZiAoIWRlZXBFcXVhbChhW2tleV0sIGJba2V5XSwgb3B0cykpIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHlwZW9mIGEgPT09IHR5cGVvZiBiO1xufVxufSk7XG5cbmNvbnN0IGFzc2VydGlvbnMgPSB7XG4gIG9rKHZhbCwgbWVzc2FnZSA9ICdzaG91bGQgYmUgdHJ1dGh5Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IEJvb2xlYW4odmFsKSxcbiAgICAgIGV4cGVjdGVkOiAndHJ1dGh5JyxcbiAgICAgIGFjdHVhbDogdmFsLFxuICAgICAgb3BlcmF0b3I6ICdvaycsXG4gICAgICBtZXNzYWdlXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UgPSAnc2hvdWxkIGJlIGVxdWl2YWxlbnQnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogaW5kZXgkMShhY3R1YWwsIGV4cGVjdGVkKSxcbiAgICAgIGFjdHVhbCxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIG9wZXJhdG9yOiAnZGVlcEVxdWFsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIGVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UgPSAnc2hvdWxkIGJlIGVxdWFsJykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGFjdHVhbCA9PT0gZXhwZWN0ZWQsXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcjogJ2VxdWFsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIG5vdE9rKHZhbCwgbWVzc2FnZSA9ICdzaG91bGQgbm90IGJlIHRydXRoeScpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiAhQm9vbGVhbih2YWwpLFxuICAgICAgZXhwZWN0ZWQ6ICdmYWxzeScsXG4gICAgICBhY3R1YWw6IHZhbCxcbiAgICAgIG9wZXJhdG9yOiAnbm90T2snLFxuICAgICAgbWVzc2FnZVxuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIG5vdERlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlID0gJ3Nob3VsZCBub3QgYmUgZXF1aXZhbGVudCcpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiAhaW5kZXgkMShhY3R1YWwsIGV4cGVjdGVkKSxcbiAgICAgIGFjdHVhbCxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIG9wZXJhdG9yOiAnbm90RGVlcEVxdWFsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIG5vdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UgPSAnc2hvdWxkIG5vdCBiZSBlcXVhbCcpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBhY3R1YWwgIT09IGV4cGVjdGVkLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdub3RFcXVhbCdcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICB0aHJvd3MoZnVuYywgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgICBsZXQgY2F1Z2h0LCBwYXNzLCBhY3R1YWw7XG4gICAgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIFtleHBlY3RlZCwgbWVzc2FnZV0gPSBbbWVzc2FnZSwgZXhwZWN0ZWRdO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgZnVuYygpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYXVnaHQgPSB7ZXJyb3J9O1xuICAgIH1cbiAgICBwYXNzID0gY2F1Z2h0ICE9PSB1bmRlZmluZWQ7XG4gICAgYWN0dWFsID0gY2F1Z2h0ICYmIGNhdWdodC5lcnJvcjtcbiAgICBpZiAoZXhwZWN0ZWQgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIHBhc3MgPSBleHBlY3RlZC50ZXN0KGFjdHVhbCkgfHwgZXhwZWN0ZWQudGVzdChhY3R1YWwgJiYgYWN0dWFsLm1lc3NhZ2UpO1xuICAgICAgZXhwZWN0ZWQgPSBTdHJpbmcoZXhwZWN0ZWQpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnZnVuY3Rpb24nICYmIGNhdWdodCkge1xuICAgICAgcGFzcyA9IGFjdHVhbCBpbnN0YW5jZW9mIGV4cGVjdGVkO1xuICAgICAgYWN0dWFsID0gYWN0dWFsLmNvbnN0cnVjdG9yO1xuICAgIH1cbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBhY3R1YWwsXG4gICAgICBvcGVyYXRvcjogJ3Rocm93cycsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlIHx8ICdzaG91bGQgdGhyb3cnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgZG9lc05vdFRocm93KGZ1bmMsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gICAgbGV0IGNhdWdodDtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnc3RyaW5nJykge1xuICAgICAgW2V4cGVjdGVkLCBtZXNzYWdlXSA9IFttZXNzYWdlLCBleHBlY3RlZF07XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBmdW5jKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNhdWdodCA9IHtlcnJvcn07XG4gICAgfVxuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGNhdWdodCA9PT0gdW5kZWZpbmVkLFxuICAgICAgZXhwZWN0ZWQ6ICdubyB0aHJvd24gZXJyb3InLFxuICAgICAgYWN0dWFsOiBjYXVnaHQgJiYgY2F1Z2h0LmVycm9yLFxuICAgICAgb3BlcmF0b3I6ICdkb2VzTm90VGhyb3cnLFxuICAgICAgbWVzc2FnZTogbWVzc2FnZSB8fCAnc2hvdWxkIG5vdCB0aHJvdydcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBmYWlsKHJlYXNvbiA9ICdmYWlsIGNhbGxlZCcpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBmYWxzZSxcbiAgICAgIGFjdHVhbDogJ2ZhaWwgY2FsbGVkJyxcbiAgICAgIGV4cGVjdGVkOiAnZmFpbCBub3QgY2FsbGVkJyxcbiAgICAgIG1lc3NhZ2U6IHJlYXNvbixcbiAgICAgIG9wZXJhdG9yOiAnZmFpbCdcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9XG59O1xuXG5mdW5jdGlvbiBhc3NlcnRpb24gKHRlc3QpIHtcbiAgcmV0dXJuIE9iamVjdC5jcmVhdGUoYXNzZXJ0aW9ucywge3Rlc3Q6IHt2YWx1ZTogdGVzdH19KTtcbn1cblxuY29uc3QgVGVzdCA9IHtcbiAgcnVuOiBmdW5jdGlvbiAoKSB7XG4gICAgY29uc3QgYXNzZXJ0ID0gYXNzZXJ0aW9uKHRoaXMpO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgcmV0dXJuIGluZGV4KHRoaXMuY29yb3V0aW5lKGFzc2VydCkpXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiB7YXNzZXJ0aW9uczogdGhpcy5hc3NlcnRpb25zLCBleGVjdXRpb25UaW1lOiBEYXRlLm5vdygpIC0gbm93fTtcbiAgICAgIH0pO1xuICB9LFxuICBhZGRBc3NlcnRpb24oKXtcbiAgICBjb25zdCBuZXdBc3NlcnRpb25zID0gWy4uLmFyZ3VtZW50c10ubWFwKGEgPT4gT2JqZWN0LmFzc2lnbih7ZGVzY3JpcHRpb246IHRoaXMuZGVzY3JpcHRpb259LCBhKSk7XG4gICAgdGhpcy5hc3NlcnRpb25zLnB1c2goLi4ubmV3QXNzZXJ0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHRlc3QgKHtkZXNjcmlwdGlvbiwgY29yb3V0aW5lLCBvbmx5ID0gZmFsc2V9KSB7XG4gIHJldHVybiBPYmplY3QuY3JlYXRlKFRlc3QsIHtcbiAgICBkZXNjcmlwdGlvbjoge3ZhbHVlOiBkZXNjcmlwdGlvbn0sXG4gICAgY29yb3V0aW5lOiB7dmFsdWU6IGNvcm91dGluZX0sXG4gICAgYXNzZXJ0aW9uczoge3ZhbHVlOiBbXX0sXG4gICAgb25seToge3ZhbHVlOiBvbmx5fSxcbiAgICBsZW5ndGg6IHtcbiAgICAgIGdldCgpe1xuICAgICAgICByZXR1cm4gdGhpcy5hc3NlcnRpb25zLmxlbmd0aFxuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHRhcE91dCAoe3Bhc3MsIG1lc3NhZ2UsIGluZGV4fSkge1xuICBjb25zdCBzdGF0dXMgPSBwYXNzID09PSB0cnVlID8gJ29rJyA6ICdub3Qgb2snO1xuICBjb25zb2xlLmxvZyhbc3RhdHVzLCBpbmRleCwgbWVzc2FnZV0uam9pbignICcpKTtcbn1cblxuZnVuY3Rpb24gY2FuRXhpdCAoKSB7XG4gIHJldHVybiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHByb2Nlc3MuZXhpdCA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gdGFwICgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICogKCkge1xuICAgIGxldCBpbmRleCA9IDE7XG4gICAgbGV0IGxhc3RJZCA9IDA7XG4gICAgbGV0IHN1Y2Nlc3MgPSAwO1xuICAgIGxldCBmYWlsdXJlID0gMDtcblxuICAgIGNvbnN0IHN0YXJUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zb2xlLmxvZygnVEFQIHZlcnNpb24gMTMnKTtcbiAgICB0cnkge1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXJ0aW9uID0geWllbGQ7XG4gICAgICAgIGlmIChhc3NlcnRpb24ucGFzcyA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHN1Y2Nlc3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmYWlsdXJlKys7XG4gICAgICAgIH1cbiAgICAgICAgYXNzZXJ0aW9uLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIGlmIChhc3NlcnRpb24uaWQgIT09IGxhc3RJZCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGAjICR7YXNzZXJ0aW9uLmRlc2NyaXB0aW9ufSAtICR7YXNzZXJ0aW9uLmV4ZWN1dGlvblRpbWV9bXNgKTtcbiAgICAgICAgICBsYXN0SWQgPSBhc3NlcnRpb24uaWQ7XG4gICAgICAgIH1cbiAgICAgICAgdGFwT3V0KGFzc2VydGlvbik7XG4gICAgICAgIGlmIChhc3NlcnRpb24ucGFzcyAhPT0gdHJ1ZSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGAgIC0tLVxuICBvcGVyYXRvcjogJHthc3NlcnRpb24ub3BlcmF0b3J9XG4gIGV4cGVjdGVkOiAke0pTT04uc3RyaW5naWZ5KGFzc2VydGlvbi5leHBlY3RlZCl9XG4gIGFjdHVhbDogJHtKU09OLnN0cmluZ2lmeShhc3NlcnRpb24uYWN0dWFsKX1cbiAgLi4uYCk7XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmxvZygnQmFpbCBvdXQhIHVuaGFuZGxlZCBleGNlcHRpb24nKTtcbiAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgaWYgKGNhbkV4aXQoKSkge1xuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZpbmFsbHkge1xuICAgICAgY29uc3QgZXhlY3V0aW9uID0gRGF0ZS5ub3coKSAtIHN0YXJUaW1lO1xuICAgICAgaWYgKGluZGV4ID4gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgXG4xLi4ke2luZGV4IC0gMX1cbiMgZHVyYXRpb24gJHtleGVjdXRpb259bXNcbiMgc3VjY2VzcyAke3N1Y2Nlc3N9XG4jIGZhaWx1cmUgJHtmYWlsdXJlfWApO1xuICAgICAgfVxuICAgICAgaWYgKGZhaWx1cmUgJiYgY2FuRXhpdCgpKSB7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbmNvbnN0IFBsYW4gPSB7XG4gIHRlc3QoZGVzY3JpcHRpb24sIGNvcm91dGluZSwgb3B0cyA9IHt9KXtcbiAgICBjb25zdCB0ZXN0SXRlbXMgPSAoIWNvcm91dGluZSAmJiBkZXNjcmlwdGlvbi50ZXN0cykgPyBbLi4uZGVzY3JpcHRpb25dIDogW3tkZXNjcmlwdGlvbiwgY29yb3V0aW5lfV07XG4gICAgdGhpcy50ZXN0cy5wdXNoKC4uLnRlc3RJdGVtcy5tYXAodD0+dGVzdChPYmplY3QuYXNzaWduKHQsIG9wdHMpKSkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIG9ubHkoZGVzY3JpcHRpb24sIGNvcm91dGluZSl7XG4gICAgcmV0dXJuIHRoaXMudGVzdChkZXNjcmlwdGlvbiwgY29yb3V0aW5lLCB7b25seTogdHJ1ZX0pO1xuICB9LFxuXG4gIHJ1bihzaW5rID0gdGFwKCkpe1xuICAgIGNvbnN0IHNpbmtJdGVyYXRvciA9IHNpbmsoKTtcbiAgICBzaW5rSXRlcmF0b3IubmV4dCgpO1xuICAgIGNvbnN0IGhhc09ubHkgPSB0aGlzLnRlc3RzLnNvbWUodD0+dC5vbmx5KTtcbiAgICBjb25zdCBydW5uYWJsZSA9IGhhc09ubHkgPyB0aGlzLnRlc3RzLmZpbHRlcih0PT50Lm9ubHkpIDogdGhpcy50ZXN0cztcbiAgICByZXR1cm4gaW5kZXgoZnVuY3Rpb24gKiAoKSB7XG4gICAgICBsZXQgaWQgPSAxO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IHJ1bm5hYmxlLm1hcCh0PT50LnJ1bigpKTtcbiAgICAgICAgZm9yIChsZXQgciBvZiByZXN1bHRzKSB7XG4gICAgICAgICAgY29uc3Qge2Fzc2VydGlvbnMsIGV4ZWN1dGlvblRpbWV9ID0geWllbGQgcjtcbiAgICAgICAgICBmb3IgKGxldCBhc3NlcnQgb2YgYXNzZXJ0aW9ucykge1xuICAgICAgICAgICAgc2lua0l0ZXJhdG9yLm5leHQoT2JqZWN0LmFzc2lnbihhc3NlcnQsIHtpZCwgZXhlY3V0aW9uVGltZX0pKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWQrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgc2lua0l0ZXJhdG9yLnRocm93KGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgc2lua0l0ZXJhdG9yLnJldHVybigpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSlcbiAgfSxcblxuICAqIFtTeW1ib2wuaXRlcmF0b3JdKCl7XG4gICAgZm9yIChsZXQgdCBvZiB0aGlzLnRlc3RzKSB7XG4gICAgICB5aWVsZCB0O1xuICAgIH1cbiAgfVxufTtcblxuZnVuY3Rpb24gcGxhbiAoKSB7XG4gIHJldHVybiBPYmplY3QuY3JlYXRlKFBsYW4sIHtcbiAgICB0ZXN0czoge3ZhbHVlOiBbXX0sXG4gICAgbGVuZ3RoOiB7XG4gICAgICBnZXQoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMudGVzdHMubGVuZ3RoXG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcGxhbjtcbiIsIi8vdG9kbyBwcm92aWRlIGEgZ2VuZXJhdG9yIGZyZWUgdmVyc2lvbiAoZm9yIG9sZCBzdHVwaWQgYnJvd3NlcnMgYW5kIFNhZmFyaSkgOikgKGNmIHRyYXZlcnNlQXNBcnJheSlcbmV4cG9ydCBjb25zdCB0cmF2ZXJzZSA9IGZ1bmN0aW9uICogKHZub2RlKSB7XG4gIHlpZWxkIHZub2RlO1xuICBpZiAodm5vZGUuY2hpbGRyZW4gJiYgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2Ygdm5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIHlpZWxkICogdHJhdmVyc2UoY2hpbGQpO1xuICAgIH1cbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IHRyYXZlcnNlQXNBcnJheSA9IGZ1bmN0aW9uICh2bm9kZSkge1xuICBjb25zdCBvdXRwdXQgPSBbXTtcbiAgb3V0cHV0LnB1c2godm5vZGUpO1xuICBpZiAodm5vZGUuY2hpbGRyZW4gJiYgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2Ygdm5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIG91dHB1dC5wdXNoKC4uLnRyYXZlcnNlQXNBcnJheShjaGlsZCkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufTtcblxuZXhwb3J0IGNvbnN0IG5leHRUaWNrID0gZm4gPT4gc2V0VGltZW91dChmbiwgMCk7XG5cbmV4cG9ydCBjb25zdCBwYWlyaWZ5ID0gaG9sZGVyID0+IGtleSA9PiBba2V5LCBob2xkZXJba2V5XV07XG5cbmV4cG9ydCBjb25zdCBpc1NoYWxsb3dFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IGFLZXlzID0gT2JqZWN0LmtleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gT2JqZWN0LmtleXMoYik7XG4gIHJldHVybiBhS2V5cy5sZW5ndGggPT09IGJLZXlzLmxlbmd0aCAmJiBhS2V5cy5ldmVyeSgoaykgPT4gYVtrXSA9PT0gYltrXSk7XG59O1xuXG5leHBvcnQgY29uc3Qgbm9vcCA9ICgpID0+IHtcbn07XG4iLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7dHJhdmVyc2UsIGlzU2hhbGxvd0VxdWFsLCBwYWlyaWZ5fSBmcm9tICcuLi9saWIvdXRpbCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnc2hvdWxkIHRyYXZlcnNlIGEgdHJlZSAoZ29pbmcgZGVlcCBmaXJzdCknLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgdHJlZSA9IHtcbiAgICAgIGlkOiAxLFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAge2lkOiAyLCBjaGlsZHJlbjogW3tpZDogM30sIHtpZDogNH1dfSxcbiAgICAgICAge2lkOiA1LCBjaGlsZHJlbjogW3tpZDogNn1dfSxcbiAgICAgICAge2lkOiA3fVxuICAgICAgXVxuICAgIH07XG5cbiAgICBjb25zdCBzZXF1ZW5jZSA9IFsuLi50cmF2ZXJzZSh0cmVlKV0ubWFwKG4gPT4gbi5pZCk7XG4gICAgdC5kZWVwRXF1YWwoc2VxdWVuY2UsIFsxLCAyLCAzLCA0LCA1LCA2LCA3XSk7XG4gIH0pXG4gIC50ZXN0KCdwYWlyIGtleSB0byB2YWx1ZSBvYmplY3Qgb2YgYW4gb2JqZWN0IChha2EgT2JqZWN0LmVudHJpZXMpJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGhvbGRlciA9IHthOiAxLCBiOiAyLCBjOiAzLCBkOiA0fTtcbiAgICBjb25zdCBmID0gcGFpcmlmeShob2xkZXIpO1xuICAgIGNvbnN0IGRhdGEgPSBPYmplY3Qua2V5cyhob2xkZXIpLm1hcChmKTtcbiAgICB0LmRlZXBFcXVhbChkYXRhLCBbWydhJywgMV0sIFsnYicsIDJdLCBbJ2MnLCAzXSwgWydkJywgNF1dKTtcbiAgfSlcbiAgLnRlc3QoJ3NoYWxsb3cgZXF1YWxpdHkgdGVzdCBvbiBvYmplY3QnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgbmVzdGVkID0ge2ZvbzogJ2Jhcid9O1xuICAgIGNvbnN0IG9iajEgPSB7YTogMSwgYjogJzInLCBjOiB0cnVlLCBkOiBuZXN0ZWR9O1xuICAgIHQub2soaXNTaGFsbG93RXF1YWwob2JqMSwge2E6IDEsIGI6ICcyJywgYzogdHJ1ZSwgZDogbmVzdGVkfSkpO1xuICAgIHQubm90T2soaXNTaGFsbG93RXF1YWwob2JqMSwge1xuICAgICAgYTogMSxcbiAgICAgIGI6ICcyJyxcbiAgICAgIGM6IHRydWUsXG4gICAgICBkOiB7Zm9vOiAnYmFyJ31cbiAgICB9KSwgJ25lc3RlZCBvYmplY3Qgc2hvdWxkIGJlIGNoZWNrZWQgYnkgcmVmZXJlbmNlJyk7XG4gICAgdC5ub3RPayhpc1NoYWxsb3dFcXVhbChvYmoxLCB7YTogMSwgYjogMiwgYzogdHJ1ZSwgZDogbmVzdGVkfSksICdleGFjdCB0eXBlIGNoZWNraW5nIG9uIHByaW1pdGl2ZScpO1xuICAgIHQubm90T2soaXNTaGFsbG93RXF1YWwob2JqMSwge2E6IDEsIGM6IHRydWUsIGQ6IG5lc3RlZH0pLCAncmV0dXJuIGZhbHNlIG9uIG1pc3NpbmcgcHJvcGVydGllcycpO1xuICAgIHQubm90T2soaXNTaGFsbG93RXF1YWwoe2E6IDEsIGM6IHRydWUsIGQ6IG5lc3RlZH0sIG9iajEpLCAncmV0dXJuIGZhbHNlIG9uIG1pc3NpbmcgcHJvcGVydGllcyAoY29tbW11dGF0aXZlJyk7XG4gIH0pO1xuIiwiZXhwb3J0IGZ1bmN0aW9uIHN3YXAgKGYpIHtcbiAgcmV0dXJuIChhLCBiKSA9PiBmKGIsIGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZSAoZmlyc3QsIC4uLmZucykge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycnkgKGZuLCBhcml0eUxlZnQpIHtcbiAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseSAoZm4pIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcCAoZm4pIHtcbiAgcmV0dXJuIGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xuICB9XG59IiwiaW1wb3J0IHt0YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IHVwZGF0ZURvbU5vZGVGYWN0b3J5ID0gKG1ldGhvZCkgPT4gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IHBhaXIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlW21ldGhvZF0oLi4ucGFpcik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgncmVtb3ZlRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IGFkZEV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ2FkZEV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBzZXRBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoKGRvbU5vZGUpID0+IHtcbiAgY29uc3QgYXR0cmlidXRlcyA9IGl0ZW1zLmZpbHRlcigoW2tleSwgdmFsdWVdKSA9PiB0eXBlb2YgdmFsdWUgIT09ICdmdW5jdGlvbicpO1xuICBmb3IgKGxldCBba2V5LCB2YWx1ZV0gb2YgYXR0cmlidXRlcykge1xuICAgIHZhbHVlID09PSBmYWxzZSA/IGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGtleSkgOiBkb21Ob2RlLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgfVxufSk7XG5leHBvcnQgY29uc3QgcmVtb3ZlQXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBhdHRyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3Qgc2V0VGV4dE5vZGUgPSB2YWwgPT4gbm9kZSA9PiBub2RlLnRleHRDb250ZW50ID0gdmFsO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlRG9tTm9kZSA9IHZub2RlID0+IHtcbiAgcmV0dXJuIHZub2RlLm5vZGVUeXBlICE9PSAnVGV4dCcgP1xuICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodm5vZGUubm9kZVR5cGUpIDpcbiAgICBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShTdHJpbmcodm5vZGUucHJvcHMudmFsdWUpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudExpc3RlbmVycyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gT2JqZWN0LmtleXMocHJvcHMpXG4gICAgLmZpbHRlcihrID0+IGsuc3Vic3RyKDAsIDIpID09PSAnb24nKVxuICAgIC5tYXAoayA9PiBbay5zdWJzdHIoMikudG9Mb3dlckNhc2UoKSwgcHJvcHNba11dKTtcbn07XG4iLCJpbXBvcnQge1xuICBzZXRBdHRyaWJ1dGVzLFxuICByZW1vdmVBdHRyaWJ1dGVzLFxuICBhZGRFdmVudExpc3RlbmVycyxcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMsXG4gIHNldFRleHROb2RlLFxuICBnZXRFdmVudExpc3RlbmVycyxcbiAgY3JlYXRlRG9tTm9kZVxufSBmcm9tICcuLi9saWIvZG9tVXRpbCc7XG5pbXBvcnQge25vb3B9IGZyb20gJy4uL2xpYi91dGlsJztcbmltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuXG5jb25zdCBkb21Qcm90byA9IHtcblxuICByZW1vdmVBdHRyaWJ1dGUoYXR0cil7XG4gICAgZGVsZXRlIHRoaXNbYXR0cl07XG4gIH0sXG5cbiAgc2V0QXR0cmlidXRlKGF0dHIsIHZhbCl7XG4gICAgdGhpc1thdHRyXSA9IHZhbDtcbiAgfSxcblxuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyKXtcbiAgICB0aGlzLmhhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XG4gIH0sXG5cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgaGFuZGxlcil7XG4gICAgZGVsZXRlIHRoaXMuaGFuZGxlcnNbZXZlbnRdO1xuICB9XG59O1xuXG5jb25zdCBmYWtlRG9tID0gKCkgPT4ge1xuICBjb25zdCBkb20gPSBPYmplY3QuY3JlYXRlKGRvbVByb3RvKTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGRvbSwgJ2hhbmRsZXJzJywge3ZhbHVlOiB7fX0pO1xuICByZXR1cm4gZG9tO1xufTtcblxuY29uc3Qgb3duUHJvcHMgPSAob2JqKSA9PiB7XG4gIGNvbnN0IG93blByb3BlcnRpZXMgPSBbXTtcbiAgZm9yIChsZXQgcHJvcCBpbiBvYmopIHtcbiAgICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICBvd25Qcm9wZXJ0aWVzLnB1c2gocHJvcCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBvd25Qcm9wZXJ0aWVzO1xufTtcblxuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ3NldCBhdHRyaWJ1dGVzJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGQgPSBmYWtlRG9tKCk7XG4gICAgY29uc3QgdXBkYXRlID0gc2V0QXR0cmlidXRlcyhbWydmb28nLCAnYmFyJ10sIFsnYmxhaCcsIDJdLCBbJ3dvb3QnLCB0cnVlXV0pO1xuICAgIGNvbnN0IG4gPSB1cGRhdGUoZCk7XG4gICAgdC5lcXVhbChuLCBkLCAnc2hvdWxkIGhhdmUgZm9yd2FyZGVkIGRvbSBub2RlJyk7XG4gICAgdC5lcXVhbChkLmZvbywgJ2JhcicpO1xuICAgIHQuZXF1YWwoZC5ibGFoLCAyKTtcbiAgICB0LmVxdWFsKGQud29vdCwgdHJ1ZSk7XG4gICAgY29uc3QgcHJvcHMgPSBvd25Qcm9wcyhkKTtcbiAgICB0LmRlZXBFcXVhbChwcm9wcywgWydmb28nLCAnYmxhaCcsICd3b290J10pO1xuICAgIGNvbnN0IGhhbmRsZXJzID0gb3duUHJvcHMoZC5oYW5kbGVycyk7XG4gICAgdC5lcXVhbChoYW5kbGVycy5sZW5ndGgsIDApO1xuICB9KVxuICAudGVzdCgncmVtb3ZlIGF0dHJpYnV0ZSBpZiB2YWx1ZSBpcyBmYWxzZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBkID0gZmFrZURvbSgpO1xuICAgIGQuZm9vID0gJ2Jhcic7XG4gICAgdC5kZWVwRXF1YWwob3duUHJvcHMoZCksIFsnZm9vJ10pO1xuICAgIGNvbnN0IHVwZGF0ZSA9IHNldEF0dHJpYnV0ZXMoW1snZm9vJywgZmFsc2VdXSk7XG4gICAgY29uc3QgbiA9IHVwZGF0ZShkKTtcbiAgICB0LmVxdWFsKG4sIGQsICdzaG91bGQgaGF2ZSBmb3J3YXJkZWQgZG9tIG5vZGUnKTtcbiAgICB0LmVxdWFsKGQuZm9vLCB1bmRlZmluZWQpO1xuICAgIHQuZXF1YWwob3duUHJvcHMoZCkubGVuZ3RoLCAwKTtcbiAgICBjb25zdCBoYW5kbGVycyA9IG93blByb3BzKGQuaGFuZGxlcnMpO1xuICAgIHQuZXF1YWwoaGFuZGxlcnMubGVuZ3RoLCAwKTtcbiAgfSlcbiAgLnRlc3QoJ3JlbW92ZSBhdHRyaWJ1dGVzJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGQgPSBmYWtlRG9tKCk7XG4gICAgZC5mb28gPSAnYmFyJztcbiAgICBkLndvb3QgPSAyO1xuICAgIGQuYmFyID0gJ2JsYWgnO1xuICAgIHQuZGVlcEVxdWFsKG93blByb3BzKGQpLCBbJ2ZvbycsICd3b290JywgJ2JhciddKTtcbiAgICBjb25zdCB1cGRhdGUgPSByZW1vdmVBdHRyaWJ1dGVzKFsnZm9vJywgJ3dvb3QnXSk7XG4gICAgY29uc3QgbiA9IHVwZGF0ZShkKTtcbiAgICB0LmVxdWFsKG4sIGQsICdzaG91bGQgaGF2ZSBmb3J3YXJkZWQgZG9tIG5vZGUnKTtcbiAgICB0LmVxdWFsKGQuYmFyLCAnYmxhaCcpO1xuICAgIHQuZXF1YWwob3duUHJvcHMoZCkubGVuZ3RoLCAxKTtcbiAgICBjb25zdCBoYW5kbGVycyA9IG93blByb3BzKGQuaGFuZGxlcnMpO1xuICAgIHQuZXF1YWwoaGFuZGxlcnMubGVuZ3RoLCAwKTtcbiAgfSlcbiAgLnRlc3QoJ2FkZCBldmVudCBsaXN0ZW5lcnMnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZCA9IGZha2VEb20oKTtcbiAgICBjb25zdCB1cGRhdGUgPSBhZGRFdmVudExpc3RlbmVycyhbWydjbGljaycsIG5vb3BcbiAgICBdLCBbJ2lucHV0Jywgbm9vcF1dKTtcbiAgICBjb25zdCBuID0gdXBkYXRlKGQpO1xuICAgIHQuZXF1YWwobiwgZCwgJ3Nob3VsZCBoYXZlIGZvcndhcmRlZCB0aGUgbm9kZScpO1xuICAgIHQuZXF1YWwob3duUHJvcHMoZCkubGVuZ3RoLCAwKTtcbiAgICB0LmRlZXBFcXVhbChvd25Qcm9wcyhkLmhhbmRsZXJzKSwgWydjbGljaycsICdpbnB1dCddKTtcbiAgICB0LmVxdWFsKGQuaGFuZGxlcnMuY2xpY2ssIG5vb3ApO1xuICAgIHQuZXF1YWwoZC5oYW5kbGVycy5pbnB1dCwgbm9vcCk7XG4gIH0pXG4gIC50ZXN0KCdyZW1vdmUgZXZlbnQgbGlzdGVuZXJzJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGQgPSBmYWtlRG9tKCk7XG4gICAgZC5oYW5kbGVycy5jbGljayA9IG5vb3A7XG4gICAgZC5oYW5kbGVycy5pbnB1dCA9IG5vb3A7XG4gICAgY29uc3QgdXBkYXRlID0gcmVtb3ZlRXZlbnRMaXN0ZW5lcnMoW1snY2xpY2snLCBub29wXG4gICAgXV0pO1xuICAgIGNvbnN0IG4gPSB1cGRhdGUoZCk7XG4gICAgdC5lcXVhbChuLCBkLCAnc2hvdWxkIGhhdmUgZm9yd2FyZGVkIHRoZSBub2RlJyk7XG4gICAgdC5kZWVwRXF1YWwob3duUHJvcHMoZC5oYW5kbGVycyksIFsnaW5wdXQnXSk7XG4gICAgdC5lcXVhbChkLmhhbmRsZXJzLmlucHV0LCBub29wKTtcbiAgfSlcbiAgLnRlc3QoJ3NldCB0ZXh0IG5vZGUgdmFsdWUnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3Qgbm9kZSA9IHt9O1xuICAgIGNvbnN0IHVwZGF0ZSA9IHNldFRleHROb2RlKCdmb28nKTtcbiAgICB1cGRhdGUobm9kZSk7XG4gICAgdC5lcXVhbChub2RlLnRleHRDb250ZW50LCAnZm9vJyk7XG4gIH0pXG4gIC50ZXN0KCdnZXQgZXZlbnQgTGlzdGVuZXJzIGZyb20gcHJvcHMgb2JqZWN0JywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IHByb3BzID0ge1xuICAgICAgb25DbGljazogKCkgPT4ge1xuICAgICAgfSxcbiAgICAgIGlucHV0OiAoKSA9PiB7XG4gICAgICB9LFxuICAgICAgb25Nb3VzZWRvd246ICgpID0+IHtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgZXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMocHJvcHMpO1xuICAgIHQuZGVlcEVxdWFsKGV2ZW50cywgW1xuICAgICAgWydjbGljaycsIHByb3BzLm9uQ2xpY2tdLFxuICAgICAgWydtb3VzZWRvd24nLCBwcm9wcy5vbk1vdXNlZG93bl0sXG4gICAgXSk7XG4gIH0pXG4gIC8vIC50ZXN0KCdjcmVhdGUgdGV4dCBkb20gbm9kZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgLy8gICBkb2N1bWVudCA9IGRvY3VtZW50IHx8IHtcbiAgLy8gICAgICAgY3JlYXRlRWxlbWVudDogKGFyZykgPT4ge1xuICAvLyAgICAgICAgIHJldHVybiB7ZWxlbWVudDogYXJnfTtcbiAgLy8gICAgICAgfSxcbiAgLy8gICAgICAgY3JlYXRlVGV4dE5vZGU6IChhcmcpID0+IHtcbiAgLy8gICAgICAgICByZXR1cm4ge3RleHQ6IGFyZ307XG4gIC8vICAgICAgIH1cbiAgLy8gICAgIH07XG4gIC8vICAgY29uc3QgbiA9IGNyZWF0ZURvbU5vZGUoe25vZGVUeXBlOidUZXh0Jyxwcm9wczp7dmFsdWU6J2Zvbyd9fSk7XG4gIC8vICAgdC5kZWVwRXF1YWwobix7dGV4dDonZm9vJ30pO1xuICAvLyB9KSIsImNvbnN0IGNyZWF0ZVRleHRWTm9kZSA9ICh2YWx1ZSkgPT4gKHtcbiAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgY2hpbGRyZW46IFtdLFxuICBwcm9wczoge3ZhbHVlfVxufSk7XG5cbi8qKlxuICogVHJhbnNmb3JtIGh5cGVyc2NyaXB0IGludG8gdmlydHVhbCBkb20gbm9kZVxuICogQHBhcmFtIG5vZGVUeXBlXG4gKiBAcGFyYW0gcHJvcHNcbiAqIEBwYXJhbSBjaGlsZHJlblxuICogQHJldHVybnMgeyp9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGggKG5vZGVUeXBlLCBwcm9wcywgLi4uY2hpbGRyZW4pIHtcbiAgY29uc3QgZmxhdENoaWxkcmVuID0gY2hpbGRyZW4ucmVkdWNlKChhY2MsIGNoaWxkKSA9PiB7XG4gICAgY29uc3QgY2hpbGRyZW5BcnJheSA9IEFycmF5LmlzQXJyYXkoY2hpbGQpID8gY2hpbGQgOiBbY2hpbGRdO1xuICAgIHJldHVybiBhY2MuY29uY2F0KGNoaWxkcmVuQXJyYXkpO1xuICB9LCBbXSlcbiAgICAubWFwKGNoaWxkID0+IHtcbiAgICAgIC8vIG5vcm1hbGl6ZSB0ZXh0IG5vZGUgdG8gaGF2ZSBzYW1lIHN0cnVjdHVyZSB0aGFuIHJlZ3VsYXIgZG9tIG5vZGVzXG4gICAgICBjb25zdCB0eXBlID0gdHlwZW9mIGNoaWxkO1xuICAgICAgcmV0dXJuIHR5cGUgPT09ICdvYmplY3QnIHx8IHR5cGUgPT09ICdmdW5jdGlvbicgPyBjaGlsZCA6IGNyZWF0ZVRleHRWTm9kZShjaGlsZCk7XG4gICAgfSk7XG5cbiAgaWYgKHR5cGVvZiBub2RlVHlwZSAhPT0gJ2Z1bmN0aW9uJykgey8vcmVndWxhciBodG1sL3RleHQgbm9kZVxuICAgIHJldHVybiB7XG4gICAgICBub2RlVHlwZSxcbiAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgIGNoaWxkcmVuOiBmbGF0Q2hpbGRyZW5cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBmbGF0Q2hpbGRyZW59LCBwcm9wcyk7XG4gICAgY29uc3QgY29tcCA9IG5vZGVUeXBlKGZ1bGxQcm9wcyk7XG4gICAgcmV0dXJuIHR5cGVvZiBjb21wICE9PSAnZnVuY3Rpb24nID8gY29tcCA6IGgoY29tcCwgcHJvcHMsIC4uLmZsYXRDaGlsZHJlbik7IC8vZnVuY3Rpb25hbCBjb21wIHZzIGNvbWJpbmF0b3IgKEhPQylcbiAgfVxufTsiLCJpbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgaXNTaGFsbG93RXF1YWwsXG4gIHBhaXJpZnksXG4gIHRyYXZlcnNlLFxuICBuZXh0VGljayxcbiAgbm9vcFxufSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlQXR0cmlidXRlcyxcbiAgc2V0QXR0cmlidXRlcyxcbiAgc2V0VGV4dE5vZGUsXG4gIGNyZWF0ZURvbU5vZGUsXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxuICBhZGRFdmVudExpc3RlbmVycyxcbiAgZ2V0RXZlbnRMaXN0ZW5lcnMsXG59IGZyb20gJy4vZG9tVXRpbCc7XG5cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzICh7cHJvcHM6bmV3Tm9kZVByb3BzfT17fSwge3Byb3BzOm9sZE5vZGVQcm9wc309e30pIHtcbiAgY29uc3QgbmV3Tm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG5ld05vZGVQcm9wcyB8fCB7fSk7XG4gIGNvbnN0IG9sZE5vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhvbGROb2RlUHJvcHMgfHwge30pO1xuXG4gIHJldHVybiBuZXdOb2RlRXZlbnRzLmxlbmd0aCB8fCBvbGROb2RlRXZlbnRzLmxlbmd0aCA/XG4gICAgY29tcG9zZShcbiAgICAgIHJlbW92ZUV2ZW50TGlzdGVuZXJzKG9sZE5vZGVFdmVudHMpLFxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcnMobmV3Tm9kZUV2ZW50cylcbiAgICApIDogbm9vcDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQXR0cmlidXRlcyAobmV3Vk5vZGUsIG9sZFZOb2RlKSB7XG4gIGNvbnN0IG5ld1ZOb2RlUHJvcHMgPSBuZXdWTm9kZS5wcm9wcyB8fCB7fTtcbiAgY29uc3Qgb2xkVk5vZGVQcm9wcyA9IG9sZFZOb2RlLnByb3BzIHx8IHt9O1xuXG4gIGlmIChpc1NoYWxsb3dFcXVhbChuZXdWTm9kZVByb3BzLCBvbGRWTm9kZVByb3BzKSkge1xuICAgIHJldHVybiBub29wO1xuICB9XG5cbiAgaWYgKG5ld1ZOb2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICByZXR1cm4gc2V0VGV4dE5vZGUobmV3Vk5vZGUucHJvcHMudmFsdWUpO1xuICB9XG5cbiAgY29uc3QgbmV3Tm9kZUtleXMgPSBPYmplY3Qua2V5cyhuZXdWTm9kZVByb3BzKTtcbiAgY29uc3Qgb2xkTm9kZUtleXMgPSBPYmplY3Qua2V5cyhvbGRWTm9kZVByb3BzKTtcbiAgY29uc3QgYXR0cmlidXRlc1RvUmVtb3ZlID0gb2xkTm9kZUtleXMuZmlsdGVyKGsgPT4gIW5ld05vZGVLZXlzLmluY2x1ZGVzKGspKTtcblxuICByZXR1cm4gY29tcG9zZShcbiAgICByZW1vdmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXNUb1JlbW92ZSksXG4gICAgc2V0QXR0cmlidXRlcyhuZXdOb2RlS2V5cy5tYXAocGFpcmlmeShuZXdWTm9kZVByb3BzKSkpXG4gICk7XG59XG5cbmNvbnN0IGRvbUZhY3RvcnkgPSBjcmVhdGVEb21Ob2RlO1xuXG4vLyBhcHBseSB2bm9kZSBkaWZmaW5nIHRvIGFjdHVhbCBkb20gbm9kZSAoaWYgbmV3IG5vZGUgPT4gaXQgd2lsbCBiZSBtb3VudGVkIGludG8gdGhlIHBhcmVudClcbmNvbnN0IGRvbWlmeSA9IGZ1bmN0aW9uIHVwZGF0ZURvbSAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlKSB7XG4gIGlmICghb2xkVm5vZGUpIHsvL3RoZXJlIGlzIG5vIHByZXZpb3VzIHZub2RlXG4gICAgaWYgKG5ld1Zub2RlKSB7Ly9uZXcgbm9kZSA9PiB3ZSBpbnNlcnRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IHBhcmVudERvbU5vZGUuYXBwZW5kQ2hpbGQoZG9tRmFjdG9yeShuZXdWbm9kZSkpO1xuICAgICAgcmV0dXJuIHt2bm9kZTogbmV3Vm5vZGUsIGdhcmJhZ2U6IG51bGx9O1xuICAgIH0gZWxzZSB7Ly9lbHNlIChpcnJlbGV2YW50KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBvcGVyYXRpb24nKVxuICAgIH1cbiAgfSBlbHNlIHsvL3RoZXJlIGlzIGEgcHJldmlvdXMgdm5vZGVcbiAgICBpZiAoIW5ld1Zub2RlKSB7Ly93ZSBtdXN0IHJlbW92ZSB0aGUgcmVsYXRlZCBkb20gbm9kZVxuICAgICAgcGFyZW50RG9tTm9kZS5yZW1vdmVDaGlsZChvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuICh7Z2FyYmFnZTogb2xkVm5vZGUsIGRvbTogbnVsbH0pO1xuICAgIH0gZWxzZSBpZiAobmV3Vm5vZGUubm9kZVR5cGUgIT09IG9sZFZub2RlLm5vZGVUeXBlKSB7Ly9pdCBtdXN0IGJlIHJlcGxhY2VkXG4gICAgICBuZXdWbm9kZS5kb20gPSBkb21GYWN0b3J5KG5ld1Zub2RlKTtcbiAgICAgIHBhcmVudERvbU5vZGUucmVwbGFjZUNoaWxkKG5ld1Zub2RlLmRvbSwgb2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogb2xkVm5vZGUsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfSBlbHNlIHsvLyBvbmx5IHVwZGF0ZSBhdHRyaWJ1dGVzXG4gICAgICBuZXdWbm9kZS5kb20gPSBvbGRWbm9kZS5kb207XG4gICAgICByZXR1cm4ge2dhcmJhZ2U6IG51bGwsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIHJlbmRlciBhIHZpcnR1YWwgZG9tIG5vZGUsIGRpZmZpbmcgaXQgd2l0aCBpdHMgcHJldmlvdXMgdmVyc2lvbiwgbW91bnRpbmcgaXQgaW4gYSBwYXJlbnQgZG9tIG5vZGVcbiAqIEBwYXJhbSBvbGRWbm9kZVxuICogQHBhcmFtIG5ld1Zub2RlXG4gKiBAcGFyYW0gcGFyZW50RG9tTm9kZVxuICogQHBhcmFtIG9uTmV4dFRpY2sgY29sbGVjdCBvcGVyYXRpb25zIHRvIGJlIHByb2Nlc3NlZCBvbiBuZXh0IHRpY2tcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZXhwb3J0IGNvbnN0IHJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcmVyIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUsIG9uTmV4dFRpY2sgPSBbXSkge1xuXG4gIC8vMS4gZ2V0IHRoZSBhY3R1YWwgZG9tIGVsZW1lbnQgcmVsYXRlZCB0byB2aXJ0dWFsIGRvbSBkaWZmICYmIGNvbGxlY3Qgbm9kZSB0byByZW1vdmUvY2xlYW5cbiAgY29uc3Qge3Zub2RlLCBnYXJiYWdlfSA9IGRvbWlmeShvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuXG4gIGlmIChnYXJiYWdlICE9PSBudWxsKSB7XG4gICAgLy8gZGVmZXIgY2xlYW5pbmcgbGlmZWN5Y2xlXG4gICAgZm9yIChsZXQgZyBvZiB0cmF2ZXJzZShnYXJiYWdlKSkge1xuICAgICAgaWYgKGcub25Vbk1vdW50KSB7XG4gICAgICAgIG9uTmV4dFRpY2sucHVzaChnLm9uVW5Nb3VudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy9Ob3JtYWxpc2F0aW9uIG9mIG9sZCBub2RlIChpbiBjYXNlIG9mIGEgcmVwbGFjZSB3ZSB3aWxsIGNvbnNpZGVyIG9sZCBub2RlIGFzIGVtcHR5IG5vZGUgKG5vIGNoaWxkcmVuLCBubyBwcm9wcykpXG4gIGNvbnN0IHRlbXBPbGROb2RlID0gZ2FyYmFnZSAhPT0gbnVsbCB8fCAhb2xkVm5vZGUgPyB7bGVuZ3RoOiAwLCBjaGlsZHJlbjogW10sIHByb3BzOiB7fX0gOiBvbGRWbm9kZTtcblxuICAvLzIuIHVwZGF0ZSBhdHRyaWJ1dGVzXG4gIGlmICh2bm9kZSkge1xuICAgIC8vc3luY1xuICAgIHVwZGF0ZUF0dHJpYnV0ZXModm5vZGUsIHRlbXBPbGROb2RlKSh2bm9kZS5kb20pO1xuXG4gICAgLy9mYXN0IHBhdGhcbiAgICBpZiAodm5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgICAgcmV0dXJuIG9uTmV4dFRpY2s7XG4gICAgfVxuXG4gICAgY29uc3QgY2hpbGRyZW5Db3VudCA9IE1hdGgubWF4KHRlbXBPbGROb2RlLmNoaWxkcmVuLmxlbmd0aCwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKTtcblxuICAgIC8vdG9kbyBjaGVjayBmb3IgYSBsaWZlY3ljbGUgdG8gYXZvaWQgdG8gcnVuIG9uTW91bnQgd2hlbiBjb21wb25lbnQgaGFzIGJlZW4gbW91bnRlZCB5ZXRcbiAgICBpZiAodm5vZGUub25Nb3VudCkge1xuICAgICAgb25OZXh0VGljay5wdXNoKCgpID0+IHZub2RlLm9uTW91bnQoKSk7XG4gICAgfVxuXG4gICAgLy9hc3luYyAobm90IHBhcnQgb2YgdGhlIHZpZXcpXG4gICAgY29uc3Qgc2V0TGlzdGVuZXJzID0gdXBkYXRlRXZlbnRMaXN0ZW5lcnModm5vZGUsIHRlbXBPbGROb2RlKTtcbiAgICBpZiAoc2V0TGlzdGVuZXJzICE9PSBub29wKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gc2V0TGlzdGVuZXJzKHZub2RlLmRvbSkpO1xuICAgIH1cblxuICAgIC8vMyByZWN1cnNpdmVseSB0cmF2ZXJzZSBjaGlsZHJlbiB0byB1cGRhdGUgZG9tIGFuZCBjb2xsZWN0IGZ1bmN0aW9ucyB0byBwcm9jZXNzIG9uIG5leHQgdGlja1xuICAgIGlmIChjaGlsZHJlbkNvdW50ID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbkNvdW50OyBpKyspIHtcbiAgICAgICAgLy8gd2UgcGFzcyBvbk5leHRUaWNrIGFzIHJlZmVyZW5jZSAoaW1wcm92ZSBwZXJmOiBtZW1vcnkgKyBzcGVlZClcbiAgICAgICAgcmVuZGVyKHRlbXBPbGROb2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuZG9tLCBvbk5leHRUaWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb25OZXh0VGljaztcbn07XG5cbmV4cG9ydCBjb25zdCBtb3VudCA9IGN1cnJ5KGZ1bmN0aW9uIChjb21wLCBpbml0UHJvcCwgcm9vdCkge1xuICBjb25zdCB2bm9kZSA9IGNvbXAoaW5pdFByb3AgfHwge30pO1xuICBjb25zdCBiYXRjaCA9IHJlbmRlcihudWxsLCB2bm9kZSwgcm9vdCk7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICB3aGlsZSAoYmF0Y2gubGVuZ3RoKSB7XG4gICAgICBjb25zdCBvcCA9IGJhdGNoLnNoaWZ0KCk7XG4gICAgICBvcCgpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiB2bm9kZTtcbn0pOyIsImltcG9ydCB7cmVuZGVyfSBmcm9tICcuL3RyZWUnO1xuaW1wb3J0IHtuZXh0VGlja30gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDcmVhdGUgYSBmdW5jdGlvbiB3aGljaCB3aWxsIHRyaWdnZXIgYW4gdXBkYXRlIG9mIHRoZSBjb21wb25lbnQgd2l0aCB0aGUgcGFzc2VkIHN0YXRlXG4gKiBAcGFyYW0gY29tcFxuICogQHBhcmFtIGluaXRpYWxWTm9kZVxuICogQHJldHVybnMge2Z1bmN0aW9uKCo9LCAuLi5bKl0pfVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB1cGRhdGUgKGNvbXAsIGluaXRpYWxWTm9kZSkge1xuICBsZXQgb2xkTm9kZSA9IGluaXRpYWxWTm9kZTtcbiAgY29uc3QgdXBkYXRlRnVuYyA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IG1vdW50ID0gb2xkTm9kZS5kb20ucGFyZW50Tm9kZTtcbiAgICBjb25zdCBuZXdOb2RlID0gY29tcChPYmplY3QuYXNzaWduKHtjaGlsZHJlbjogb2xkTm9kZS5jaGlsZHJlbiB8fCBbXX0sIG9sZE5vZGUucHJvcHMsIHByb3BzKSwgLi4uYXJncyk7XG4gICAgY29uc3QgbmV4dEJhdGNoID0gcmVuZGVyKG9sZE5vZGUsIG5ld05vZGUsIG1vdW50KTtcblxuICAgIC8vdG9kbyBkYW5nZXIgem9uZVxuICAgIG9sZE5vZGUgPSBPYmplY3QuYXNzaWduKG9sZE5vZGUgfHwge30sIG5ld05vZGUpOyAvLyBjaGFuZ2UgYnkgcmVmZXJlbmNlIHNvIHRoZSBwYXJlbnQgbm9kZSBkb2VzIG5vdCBuZWVkIHRvIGJlIFwiYXdhcmVcIiB0cmVlIG1heSBoYXZlIGNoYW5nZWQgZG93bnN0cmVhbVxuICAgIC8vb2xkbm9kZSA9IHZub2RlXG4gICAgLy90b2RvIGVuZCBkYW5nZXIgem9uZVxuXG4gICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgd2hpbGUgKG5leHRCYXRjaC5sZW5ndGgpIHtcbiAgICAgICAgY29uc3Qgb3AgPSBuZXh0QmF0Y2guc2hpZnQoKTtcbiAgICAgICAgb3AoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZTtcbiAgfTtcbiAgcmV0dXJuIHVwZGF0ZUZ1bmM7XG59IiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgbGlmZUN5Y2xlRmFjdG9yeSA9IG1ldGhvZCA9PiBjdXJyeSgoZm4sIGNvbXApID0+IChwcm9wcywgLi4uYXJncykgPT4ge1xuICBjb25zdCBuID0gY29tcChwcm9wcywgLi4uYXJncyk7XG4gIG5bbWV0aG9kXSA9ICgpID0+IGZuKG4sIC4uLmFyZ3MpO1xuICByZXR1cm4gbjtcbn0pO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyB1bm1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVW5Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVW5Nb3VudCcpOyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgXCJzdGF0ZWZ1bCBjb21wb25lbnRcIjogaWUgaXQgd2lsbCBoYXZlIGl0cyBvd24gc3RhdGVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChjb21wKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgIC8vIHdyYXAgdGhlIGZ1bmN0aW9uIGNhbGwgd2hlbiB0aGUgY29tcG9uZW50IGhhcyBub3QgYmVlbiBtb3VudGVkIHlldCAobGF6eSBldmFsdWF0aW9uIHRvIG1ha2Ugc3VyZSB0aGUgdXBkYXRlRnVuYyBoYXMgYmVlbiBzZXQpO1xuICAgICAgY29uc3Qgc2V0U3RhdGUgPSB1cGRhdGVGdW5jID8gdXBkYXRlRnVuYyA6IChuZXdTdGF0ZSkgPT4gdXBkYXRlRnVuYyhuZXdTdGF0ZSk7XG4gICAgICByZXR1cm4gY29tcChwcm9wcywgc2V0U3RhdGUsIC4uLmFyZ3MpO1xuICAgIH07XG5cbiAgICByZXR1cm4gb25Nb3VudCgodm5vZGUpID0+IHtcbiAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUod3JhcHBlckNvbXAsIHZub2RlKTtcbiAgICB9LCB3cmFwcGVyQ29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgRWxtIGxpa2UgYXBwXG4gKiBAcGFyYW0gdmlld1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAodmlldykge1xuXG4gIHJldHVybiBmdW5jdGlvbiAoe21vZGVsLCB1cGRhdGVzLCBzdWJzY3JpcHRpb25zID0gW119KSB7XG4gICAgbGV0IGFjdGlvblN0b3JlID0ge307XG5cbiAgICBjb25zdCBjb21wID0gcHJvcHMgPT4gdmlldyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuXG4gICAgY29uc3QgaW5pdEFjdGlvblN0b3JlID0gKHZub2RlKSA9PiB7XG4gICAgICBjb25zdCB1cGRhdGVGdW5jID0gdXBkYXRlKGNvbXAsIHZub2RlKTtcbiAgICAgIGZvciAobGV0IHVwZGF0ZSBvZiBPYmplY3Qua2V5cyh1cGRhdGVzKSkge1xuICAgICAgICBhY3Rpb25TdG9yZVt1cGRhdGVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgICBtb2RlbCA9IHVwZGF0ZXNbdXBkYXRlXShtb2RlbCwgLi4uYXJncyk7IC8vdG9kbyBjb25zaWRlciBzaWRlIGVmZmVjdHMsIG1pZGRsZXdhcmVzLCBldGNcbiAgICAgICAgICByZXR1cm4gdXBkYXRlRnVuYyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBpbml0U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5tYXAoc3ViID0+IHZub2RlID0+IHN1Yih2bm9kZSwgYWN0aW9uU3RvcmUpKTtcbiAgICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICAgIHJldHVybiBvbk1vdW50KGluaXRGdW5jLCBjb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQge2h9IGZyb20gJy4uL2luZGV4JztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdjcmVhdGUgcmVndWxhciBodG1sIG5vZGUnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3Qgdm5vZGUgPSBoKCdkaXYnLCB7aWQ6ICdzb21lSWQnLCBcImNsYXNzXCI6ICdzcGVjaWFsJ30pO1xuICAgIHQuZGVlcEVxdWFsKHZub2RlLCB7bm9kZVR5cGU6ICdkaXYnLCBwcm9wczoge2lkOiAnc29tZUlkJywgXCJjbGFzc1wiOiAnc3BlY2lhbCd9LCBjaGlsZHJlbjogW119KTtcbiAgfSlcbiAgLnRlc3QoJ2NyZWF0ZSByZWd1bGFyIGh0bWwgbm9kZSB3aXRoIHRleHQgbm9kZSBjaGlsZHJlbicsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCB2bm9kZSA9IGgoJ2RpdicsIHtpZDogJ3NvbWVJZCcsIFwiY2xhc3NcIjogJ3NwZWNpYWwnfSwgJ2ZvbycpO1xuICAgIHQuZGVlcEVxdWFsKHZub2RlLCB7XG4gICAgICBub2RlVHlwZTogJ2RpdicsIHByb3BzOiB7aWQ6ICdzb21lSWQnLCBcImNsYXNzXCI6ICdzcGVjaWFsJ30sIGNoaWxkcmVuOiBbe1xuICAgICAgICBub2RlVHlwZTogJ1RleHQnLFxuICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgIHByb3BzOiB7dmFsdWU6ICdmb28nfVxuICAgICAgfV1cbiAgICB9KTtcbiAgfSlcbiAgLnRlc3QoJ2NyZWF0ZSByZWd1bGFyIGh0bWwgd2l0aCBjaGlsZHJlbicsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCB2bm9kZSA9IGgoJ3VsJywge2lkOiAnY29sbGVjdGlvbid9LCBoKCdsaScsIHtpZDogMX0sICdpdGVtMScpLCBoKCdsaScsIHtpZDogMn0sICdpdGVtMicpKTtcbiAgICB0LmRlZXBFcXVhbCh2bm9kZSwge1xuICAgICAgbm9kZVR5cGU6ICd1bCcsXG4gICAgICBwcm9wczoge2lkOiAnY29sbGVjdGlvbid9LFxuICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAge1xuICAgICAgICAgIG5vZGVUeXBlOiAnbGknLFxuICAgICAgICAgIHByb3BzOiB7aWQ6IDF9LFxuICAgICAgICAgIGNoaWxkcmVuOiBbe1xuICAgICAgICAgICAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgICAgICAgICAgIHByb3BzOiB7dmFsdWU6ICdpdGVtMSd9LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtdXG4gICAgICAgICAgfV1cbiAgICAgICAgfSwge1xuICAgICAgICAgIG5vZGVUeXBlOiAnbGknLFxuICAgICAgICAgIHByb3BzOiB7aWQ6IDJ9LFxuICAgICAgICAgIGNoaWxkcmVuOiBbe1xuICAgICAgICAgICAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgICAgICAgICAgIHByb3BzOiB7dmFsdWU6ICdpdGVtMid9LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtdXG4gICAgICAgICAgfV1cbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuICB9KVxuICAudGVzdCgndXNlIGZ1bmN0aW9uIGFzIGNvbXBvbmVudCBwYXNzaW5nIHRoZSBjaGlsZHJlbiBhcyBwcm9wJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGZvbyA9IChwcm9wcykgPT4gaCgncCcsIHByb3BzKTtcbiAgICBjb25zdCB2bm9kZSA9IGgoZm9vLCB7aWQ6IDF9LCAnaGVsbG8gd29ybGQnKTtcbiAgICB0LmRlZXBFcXVhbCh2bm9kZSwge1xuICAgICAgbm9kZVR5cGU6ICdwJyxcbiAgICAgIHByb3BzOiB7XG4gICAgICAgIGNoaWxkcmVuOiBbe1xuICAgICAgICAgIG5vZGVUeXBlOiAnVGV4dCcsXG4gICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgIHByb3BzOiB7dmFsdWU6ICdoZWxsbyB3b3JsZCd9XG4gICAgICAgIH1dLFxuICAgICAgICBpZDogMVxuICAgICAgfSxcbiAgICAgIGNoaWxkcmVuOiBbXVxuICAgIH0pO1xuICB9KVxuICAudGVzdCgndXNlIG5lc3RlZCBjb21iaW5hdG9yIHRvIGNyZWF0ZSB2bm9kZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBjb21iaW5hdG9yID0gKCkgPT4gKCkgPT4gKCkgPT4gKCkgPT4gKHByb3BzKSA9PiBoKCdwJywge2lkOiAnZm9vJ30pO1xuICAgIGNvbnN0IHZub2RlID0gaChjb21iaW5hdG9yLCB7fSk7XG4gICAgdC5kZWVwRXF1YWwodm5vZGUsIHtub2RlVHlwZTogJ3AnLCBwcm9wczoge2lkOiAnZm9vJ30sIGNoaWxkcmVuOiBbXX0pO1xuICB9KVxuXG4iLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB1dGlsIGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgZG9tVXRpbCBmcm9tICcuL2RvbVV0aWwnO1xuaW1wb3J0IGggZnJvbSAnLi9oJztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KHV0aWwpXG4gIC50ZXN0KGRvbVV0aWwpXG4gIC50ZXN0KGgpO1xuIiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQge21vdW50LCBofSBmcm9tICcuLi8uLi9pbmRleCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnbW91bnQgYSBzaW1wbGUgY29tcG9uZW50JywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IENvbXAgPSAocHJvcHMpID0+ICg8aDE+PHNwYW4gaWQ9e3Byb3BzLmlkfT57cHJvcHMuZ3JlZXRpbmd9PC9zcGFuPjwvaDE+KTtcbiAgICBtb3VudChDb21wLCB7aWQ6IDEyMywgZ3JlZXRpbmc6ICdoZWxsbyB3b3JsZCd9LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxoMT48c3BhbiBpZD1cIjEyM1wiPmhlbGxvIHdvcmxkPC9zcGFuPjwvaDE+Jyk7XG4gIH0pXG4gIC50ZXN0KCdtb3VudCBjb21wb3NlZCBjb21wb25lbnQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgQ29tcCA9IChwcm9wcykgPT4gKDxoMT48c3BhbiBpZD17cHJvcHMuaWR9Pntwcm9wcy5ncmVldGluZ308L3NwYW4+PC9oMT4pO1xuICAgIGNvbnN0IENvbnRhaW5lciA9IChwcm9wcykgPT4gKDxzZWN0aW9uPlxuICAgICAgPENvbXAgaWQ9XCI1NjdcIiBncmVldGluZz1cImhlbGxvIHlvdVwiLz5cbiAgICA8L3NlY3Rpb24+KTtcbiAgICBtb3VudChDb250YWluZXIsIHt9LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxzZWN0aW9uPjxoMT48c3BhbiBpZD1cIjU2N1wiPmhlbGxvIHlvdTwvc3Bhbj48L2gxPjwvc2VjdGlvbj4nKTtcbiAgfSlcbiAgLnRlc3QoJ21vdW50IGEgY29tcG9uZW50IHdpdGggaW5uZXIgY2hpbGQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgQ29tcCA9IChwcm9wcykgPT4gKDxoMT48c3BhbiBpZD17cHJvcHMuaWR9Pntwcm9wcy5ncmVldGluZ308L3NwYW4+PC9oMT4pO1xuICAgIGNvbnN0IENvbnRhaW5lciA9IChwcm9wcykgPT4gKDxzZWN0aW9uPntwcm9wcy5jaGlsZHJlbn08L3NlY3Rpb24+KTtcbiAgICBtb3VudCgoKSA9PiA8Q29udGFpbmVyPjxDb21wIGlkPVwiNTY3XCIgZ3JlZXRpbmc9XCJoZWxsbyB3b3JsZFwiLz48L0NvbnRhaW5lcj4sIHt9LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxzZWN0aW9uPjxoMT48c3BhbiBpZD1cIjU2N1wiPmhlbGxvIHdvcmxkPC9zcGFuPjwvaDE+PC9zZWN0aW9uPicpO1xuICB9KVxuIiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQge3VwZGF0ZSwgbW91bnQsIGh9IGZyb20gJy4uLy4uL2luZGV4JztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdnaXZlIGFiaWxpdHkgdG8gdXBkYXRlIGEgbm9kZSAoYW5kIGl0cyBkZXNjZW5kYW50KScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb25zdCBjb21wID0gKCh7aWQsIGNvbnRlbnR9KSA9PiAoPHAgaWQ9e2lkfT57Y29udGVudH08L3A+KSk7XG4gICAgY29uc3QgaW5pdGlhbFZub2RlID0gbW91bnQoY29tcCwge2lkOiAxMjMsIGNvbnRlbnQ6ICdoZWxsbyB3b3JsZCd9LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxwIGlkPVwiMTIzXCI+aGVsbG8gd29ybGQ8L3A+Jyk7XG4gICAgY29uc3QgdXBkYXRlRnVuYyA9IHVwZGF0ZShjb21wLCBpbml0aWFsVm5vZGUpO1xuICAgIHVwZGF0ZUZ1bmMoe2lkOiA1NjcsIGNvbnRlbnQ6ICdib25qb3VyIG1vbmRlJ30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxwIGlkPVwiNTY3XCI+Ym9uam91ciBtb25kZTwvcD4nKTtcbiAgfSk7XG4iLCJleHBvcnQgZnVuY3Rpb24gd2FpdE5leHRUaWNrICgpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSwgMilcbiAgfSlcbn0iLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7b25Nb3VudCwgb25Vbk1vdW50LCBoLCBtb3VudCwgcmVuZGVyfSBmcm9tICcuLi8uLi9pbmRleCc7XG5pbXBvcnQge3dhaXROZXh0VGlja30gZnJvbSAnLi91dGlsJ1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ3Nob3VsZCBydW4gYSBmdW5jdGlvbiB3aGVuIGNvbXBvbmVudCBpcyBtb3VudGVkJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGxldCBjb3VudGVyID0gMDtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb25zdCBjb21wID0gKCkgPT4gPHA+aGVsbG8gd29ybGQ8L3A+O1xuICAgIGNvbnN0IHdpdGhNb3VudCA9IG9uTW91bnQoKCkgPT4ge1xuICAgICAgY291bnRlcisrXG4gICAgfSwgY29tcCk7XG4gICAgbW91bnQod2l0aE1vdW50LCB7fSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvdW50ZXIsIDApO1xuICAgIHlpZWxkIHdhaXROZXh0VGljaygpO1xuICAgIHQuZXF1YWwoY291bnRlciwgMSk7XG4gIH0pXG4gIC50ZXN0KCdzaG91bGQgcnVuIGEgZnVuY3Rpb24gd2hlbiBjb21wb25lbnQgaXMgdW5Nb3VudGVkJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGxldCB1bm1vdW50ZWQgPSBudWxsO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IEl0ZW0gPSBvblVuTW91bnQoKG4pID0+IHtcbiAgICAgIHVubW91bnRlZCA9IG47XG4gICAgfSwgKHtpZH0pID0+IDxsaSBpZD17aWR9PmhlbGxvIHdvcmxkPC9saT4pO1xuICAgIGNvbnN0IGNvbnRhaW5lckNvbXAgPSAoKHtpdGVtc30pID0+ICg8dWw+XG4gICAgICB7XG4gICAgICAgIGl0ZW1zLm1hcChpdGVtID0+IDxJdGVtIHsuLi5pdGVtfS8+KVxuICAgICAgfVxuICAgIDwvdWw+KSk7XG5cbiAgICBjb25zdCB2bm9kZSA9IG1vdW50KGNvbnRhaW5lckNvbXAsIHtpdGVtczogW3tpZDogMX0sIHtpZDogMn0sIHtpZDogM31dfSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8dWw+PGxpIGlkPVwiMVwiPmhlbGxvIHdvcmxkPC9saT48bGkgaWQ9XCIyXCI+aGVsbG8gd29ybGQ8L2xpPjxsaSBpZD1cIjNcIj5oZWxsbyB3b3JsZDwvbGk+PC91bD4nKTtcbiAgICBjb25zdCBiYXRjaCA9IHJlbmRlcih2bm9kZSwgY29udGFpbmVyQ29tcCh7aXRlbXM6IFt7aWQ6IDF9LCB7aWQ6IDN9XX0pLCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzx1bD48bGkgaWQ9XCIxXCI+aGVsbG8gd29ybGQ8L2xpPjxsaSBpZD1cIjNcIj5oZWxsbyB3b3JsZDwvbGk+PC91bD4nKTtcbiAgICBmb3IgKGxldCBmIG9mIGJhdGNoKXtcbiAgICAgIGYoKTtcbiAgICB9XG4gICAgdC5ub3RFcXVhbCh1bm1vdW50ZWQsIG51bGwpO1xuICB9KSIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHtoLCB3aXRoU3RhdGUsIG1vdW50fSBmcm9tICcuLi8uLi9pbmRleCc7XG5pbXBvcnQge3dhaXROZXh0VGlja30gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdiaW5kIGFuIHVwZGF0ZSBmdW5jdGlvbiB0byBhIGNvbXBvbmVudCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgdXBkYXRlID0gbnVsbDtcbiAgICBjb25zdCBDb21wID0gd2l0aFN0YXRlKCh7Zm9vfSwgc2V0U3RhdGUpID0+IHtcbiAgICAgIGlmICghdXBkYXRlKSB7XG4gICAgICAgIHVwZGF0ZSA9IHNldFN0YXRlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIDxwPntmb299PC9wPjtcbiAgICB9KTtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBtb3VudCgoe2Zvb30pID0+IDxDb21wIGZvbz17Zm9vfS8+LCB7Zm9vOiAnYmFyJ30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHA+YmFyPC9wPicpO1xuICAgIHlpZWxkIHdhaXROZXh0VGljaygpO1xuICAgIHVwZGF0ZSh7Zm9vOiAnYmlzJ30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxwPmJpczwvcD4nKTtcbiAgfSlcbiAgLnRlc3QoJ3Nob3VsZCBjcmVhdGUgaXNvbGF0ZWQgc3RhdGUgZm9yIGVhY2ggY29tcG9uZW50JywgZnVuY3Rpb24gKiAodCkge1xuICAgIGxldCB1cGRhdGUxID0gbnVsbDtcbiAgICBsZXQgdXBkYXRlMiA9IG51bGw7XG4gICAgY29uc3QgQ29tcCA9IHdpdGhTdGF0ZSgoe2Zvb30sIHNldFN0YXRlKSA9PiB7XG4gICAgICBpZiAoIXVwZGF0ZTEpIHtcbiAgICAgICAgdXBkYXRlMSA9IHNldFN0YXRlO1xuICAgICAgfSBlbHNlIGlmICghdXBkYXRlMikge1xuICAgICAgICB1cGRhdGUyID0gc2V0U3RhdGU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiA8cD57Zm9vfTwvcD47XG4gICAgfSk7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbW91bnQoKHtmb28xLCBmb28yfSkgPT4gPGRpdj48Q29tcCBmb289e2ZvbzF9Lz48Q29tcCBmb289e2ZvbzJ9Lz48L2Rpdj4sIHtmb28xOiAnYmFyJywgZm9vMjogJ2JhcjInfSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8ZGl2PjxwPmJhcjwvcD48cD5iYXIyPC9wPjwvZGl2PicpO1xuICAgIHlpZWxkIHdhaXROZXh0VGljaygpO1xuICAgIHVwZGF0ZTEoe2ZvbzogJ2Jpcyd9KTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8ZGl2PjxwPmJpczwvcD48cD5iYXIyPC9wPjwvZGl2PicpO1xuICAgIHVwZGF0ZTIoe2ZvbzogJ2JsYWgnfSk7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPGRpdj48cD5iaXM8L3A+PHA+YmxhaDwvcD48L2Rpdj4nKTtcbiAgfSkiLCJpbXBvcnQgaW5kZXggZnJvbSAnLi4vaW5kZXgnO1xuaW1wb3J0IHJlbmRlciBmcm9tICcuL3JlbmRlcic7XG5pbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCBsaWZlY3ljbGVzIGZyb20gJy4vbGlmZWN5Y2xlcyc7XG5pbXBvcnQgd2l0aFN0YXRlIGZyb20gJy4vd2l0aFN0YXRlJztcbmltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoaW5kZXgpXG4gIC50ZXN0KHJlbmRlcilcbiAgLnRlc3QodXBkYXRlKVxuICAudGVzdChsaWZlY3ljbGVzKVxuICAudGVzdCh3aXRoU3RhdGUpXG4gIC5ydW4oKTtcblxuIl0sIm5hbWVzIjpbImluZGV4IiwiaW5kZXgkMSIsInBsYW4iLCJ6b3JhIiwidGFwIiwiaCIsIm1vdW50IiwidXBkYXRlIiwicmVuZGVyIiwid2l0aFN0YXRlIl0sIm1hcHBpbmdzIjoiOzs7QUFBQTs7OztBQUlBLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDOzs7Ozs7QUFNbEMsSUFBSUEsT0FBSyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7QUFjdkMsRUFBRSxDQUFDLElBQUksR0FBRyxVQUFVLEVBQUUsRUFBRTtFQUN0QixhQUFhLENBQUMscUJBQXFCLEdBQUcsRUFBRSxDQUFDO0VBQ3pDLE9BQU8sYUFBYSxDQUFDO0VBQ3JCLFNBQVMsYUFBYSxHQUFHO0lBQ3ZCLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztHQUNqRDtDQUNGLENBQUM7Ozs7Ozs7Ozs7O0FBV0YsU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFO0VBQ2YsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDO0VBQ2YsSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7Ozs7O0VBS3BDLE9BQU8sSUFBSSxPQUFPLENBQUMsU0FBUyxPQUFPLEVBQUUsTUFBTSxFQUFFO0lBQzNDLElBQUksT0FBTyxHQUFHLEtBQUssVUFBVSxFQUFFLEVBQUEsR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUE7SUFDMUQsSUFBSSxDQUFDLEdBQUcsSUFBSSxPQUFPLEdBQUcsQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFLEVBQUEs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
