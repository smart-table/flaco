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

function hydrate (vnode, dom) {
  'use strict';
  const hydrated = Object.assign({}, vnode);
  const domChildren = Array.from(dom.childNodes).filter(n => n.nodeType !== 3 || n.nodeValue.trim() !== '');
  hydrated.dom = dom;
  hydrated.children = vnode.children.map((child, i) => hydrate(child, domChildren[i]));
  return hydrated;
}

const mount = curry(function (comp, initProp, root) {
  const vnode = comp.nodeType !== void 0 ? comp : comp(initProp || {});
  const oldVNode = root.children.length ? hydrate(vnode, root.children[0]) : null;
  const batch = render(oldVNode, vnode, root);
  nextTick(function () {
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

/**
 * life cycle: before the component is updated
 */
const onUpdate = lifeCycleFactory('onUpdate');

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp {Function} - the component
 * @returns {Function} - a new wrapped component
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

/**
 * Combinator to create a Elm like app
 * @param view {Function} - a component which takes as arguments the current model and the list of updates
 * @returns {Function} - a Elm like application whose properties "model", "updates" and "subscriptions" will define the related domain specific objects
 */

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change under specific circumstances
 * @param store {Object} - The store (implementing the same api than Redux store
 * @param actions {Object} [{}] - The list of actions the connected component will be able to trigger
 * @param sliceState {Function} [state => state] - A function which takes as argument the state and return a "transformed" state (like partial, etc) relevant to the container
 * @returns {Function} - A container factory with the following arguments:
 *  - comp: the component to wrap note the actions object will be passed as second argument of the component for convenience
 *  - mapStateToProp: a function which takes as argument what the "sliceState" function returns and returns an object to be blended into the properties of the component (default to identity function)
 *  - shouldUpdate: a function which takes as arguments the previous and the current versions of what "sliceState" function returns to returns a boolean defining whether the component should be updated (default to a deepEqual check)
 */

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9ub2RlX21vZHVsZXMvem9yYS9kaXN0L3pvcmEuZXMuanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi90cmF2ZXJzZS5qcyIsIi4uL3V0aWwuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vLi4vbGliL2RvbVV0aWwuanMiLCIuLi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL2guanMiLCIuLi8uLi9saWIvdHJlZS5qcyIsIi4uLy4uL2xpYi91cGRhdGUuanMiLCIuLi8uLi9saWIvbGlmZUN5Y2xlcy5qcyIsIi4uLy4uL2xpYi93aXRoU3RhdGUuanMiLCIuLi8uLi9saWIvZWxtLmpzIiwiLi4vLi4vbGliL2Nvbm5lY3QuanMiLCIuLi9oLmpzIiwiLi4vaW5kZXguanMiLCIuLi9icm93c2VyL3JlbmRlci5qcyIsIi4uL2Jyb3dzZXIvdXBkYXRlLmpzIiwiLi4vYnJvd3Nlci91dGlsLmpzIiwiLi4vYnJvd3Nlci9saWZlY3ljbGVzLmpzIiwiLi4vYnJvd3Nlci93aXRoU3RhdGUuanMiLCIuLi9icm93c2VyL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogc2xpY2UoKSByZWZlcmVuY2UuXG4gKi9cblxudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4vKipcbiAqIEV4cG9zZSBgY29gLlxuICovXG5cbnZhciBpbmRleCA9IGNvWydkZWZhdWx0J10gPSBjby5jbyA9IGNvO1xuXG4vKipcbiAqIFdyYXAgdGhlIGdpdmVuIGdlbmVyYXRvciBgZm5gIGludG8gYVxuICogZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgcHJvbWlzZS5cbiAqIFRoaXMgaXMgYSBzZXBhcmF0ZSBmdW5jdGlvbiBzbyB0aGF0XG4gKiBldmVyeSBgY28oKWAgY2FsbCBkb2Vzbid0IGNyZWF0ZSBhIG5ldyxcbiAqIHVubmVjZXNzYXJ5IGNsb3N1cmUuXG4gKlxuICogQHBhcmFtIHtHZW5lcmF0b3JGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5jby53cmFwID0gZnVuY3Rpb24gKGZuKSB7XG4gIGNyZWF0ZVByb21pc2UuX19nZW5lcmF0b3JGdW5jdGlvbl9fID0gZm47XG4gIHJldHVybiBjcmVhdGVQcm9taXNlO1xuICBmdW5jdGlvbiBjcmVhdGVQcm9taXNlKCkge1xuICAgIHJldHVybiBjby5jYWxsKHRoaXMsIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpO1xuICB9XG59O1xuXG4vKipcbiAqIEV4ZWN1dGUgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiBvciBhIGdlbmVyYXRvclxuICogYW5kIHJldHVybiBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGNvKGdlbikge1xuICB2YXIgY3R4ID0gdGhpcztcbiAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgLy8gd2Ugd3JhcCBldmVyeXRoaW5nIGluIGEgcHJvbWlzZSB0byBhdm9pZCBwcm9taXNlIGNoYWluaW5nLFxuICAvLyB3aGljaCBsZWFkcyB0byBtZW1vcnkgbGVhayBlcnJvcnMuXG4gIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vdGovY28vaXNzdWVzLzE4MFxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgaWYgKHR5cGVvZiBnZW4gPT09ICdmdW5jdGlvbicpIGdlbiA9IGdlbi5hcHBseShjdHgsIGFyZ3MpO1xuICAgIGlmICghZ2VuIHx8IHR5cGVvZiBnZW4ubmV4dCAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHJlc29sdmUoZ2VuKTtcblxuICAgIG9uRnVsZmlsbGVkKCk7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge01peGVkfSByZXNcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gb25GdWxmaWxsZWQocmVzKSB7XG4gICAgICB2YXIgcmV0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0ID0gZ2VuLm5leHQocmVzKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIG5leHQocmV0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnJcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqIEBhcGkgcHJpdmF0ZVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gb25SZWplY3RlZChlcnIpIHtcbiAgICAgIHZhciByZXQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXQgPSBnZW4udGhyb3coZXJyKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIG5leHQocmV0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIG5leHQgdmFsdWUgaW4gdGhlIGdlbmVyYXRvcixcbiAgICAgKiByZXR1cm4gYSBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJldFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICogQGFwaSBwcml2YXRlXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBuZXh0KHJldCkge1xuICAgICAgaWYgKHJldC5kb25lKSByZXR1cm4gcmVzb2x2ZShyZXQudmFsdWUpO1xuICAgICAgdmFyIHZhbHVlID0gdG9Qcm9taXNlLmNhbGwoY3R4LCByZXQudmFsdWUpO1xuICAgICAgaWYgKHZhbHVlICYmIGlzUHJvbWlzZSh2YWx1ZSkpIHJldHVybiB2YWx1ZS50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKTtcbiAgICAgIHJldHVybiBvblJlamVjdGVkKG5ldyBUeXBlRXJyb3IoJ1lvdSBtYXkgb25seSB5aWVsZCBhIGZ1bmN0aW9uLCBwcm9taXNlLCBnZW5lcmF0b3IsIGFycmF5LCBvciBvYmplY3QsICdcbiAgICAgICAgKyAnYnV0IHRoZSBmb2xsb3dpbmcgb2JqZWN0IHdhcyBwYXNzZWQ6IFwiJyArIFN0cmluZyhyZXQudmFsdWUpICsgJ1wiJykpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhIGB5aWVsZGBlZCB2YWx1ZSBpbnRvIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmpcbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiB0b1Byb21pc2Uob2JqKSB7XG4gIGlmICghb2JqKSByZXR1cm4gb2JqO1xuICBpZiAoaXNQcm9taXNlKG9iaikpIHJldHVybiBvYmo7XG4gIGlmIChpc0dlbmVyYXRvckZ1bmN0aW9uKG9iaikgfHwgaXNHZW5lcmF0b3Iob2JqKSkgcmV0dXJuIGNvLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIG9iaikgcmV0dXJuIHRodW5rVG9Qcm9taXNlLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkgcmV0dXJuIGFycmF5VG9Qcm9taXNlLmNhbGwodGhpcywgb2JqKTtcbiAgaWYgKGlzT2JqZWN0KG9iaikpIHJldHVybiBvYmplY3RUb1Byb21pc2UuY2FsbCh0aGlzLCBvYmopO1xuICByZXR1cm4gb2JqO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSB0aHVuayB0byBhIHByb21pc2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn1cbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiB0aHVua1RvUHJvbWlzZShmbikge1xuICB2YXIgY3R4ID0gdGhpcztcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICBmbi5jYWxsKGN0eCwgZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICBpZiAoZXJyKSByZXR1cm4gcmVqZWN0KGVycik7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpIHJlcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgIHJlc29sdmUocmVzKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBhcnJheSBvZiBcInlpZWxkYWJsZXNcIiB0byBhIHByb21pc2UuXG4gKiBVc2VzIGBQcm9taXNlLmFsbCgpYCBpbnRlcm5hbGx5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IG9ialxuICogQHJldHVybiB7UHJvbWlzZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGFycmF5VG9Qcm9taXNlKG9iaikge1xuICByZXR1cm4gUHJvbWlzZS5hbGwob2JqLm1hcCh0b1Byb21pc2UsIHRoaXMpKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGFuIG9iamVjdCBvZiBcInlpZWxkYWJsZXNcIiB0byBhIHByb21pc2UuXG4gKiBVc2VzIGBQcm9taXNlLmFsbCgpYCBpbnRlcm5hbGx5LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBvYmplY3RUb1Byb21pc2Uob2JqKXtcbiAgdmFyIHJlc3VsdHMgPSBuZXcgb2JqLmNvbnN0cnVjdG9yKCk7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgdmFyIHByb21pc2VzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgIHZhciBwcm9taXNlID0gdG9Qcm9taXNlLmNhbGwodGhpcywgb2JqW2tleV0pO1xuICAgIGlmIChwcm9taXNlICYmIGlzUHJvbWlzZShwcm9taXNlKSkgZGVmZXIocHJvbWlzZSwga2V5KTtcbiAgICBlbHNlIHJlc3VsdHNba2V5XSA9IG9ialtrZXldO1xuICB9XG4gIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGRlZmVyKHByb21pc2UsIGtleSkge1xuICAgIC8vIHByZWRlZmluZSB0aGUga2V5IGluIHRoZSByZXN1bHRcbiAgICByZXN1bHRzW2tleV0gPSB1bmRlZmluZWQ7XG4gICAgcHJvbWlzZXMucHVzaChwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgICAgcmVzdWx0c1trZXldID0gcmVzO1xuICAgIH0pKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIGBvYmpgIGlzIGEgcHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNQcm9taXNlKG9iaikge1xuICByZXR1cm4gJ2Z1bmN0aW9uJyA9PSB0eXBlb2Ygb2JqLnRoZW47XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYSBnZW5lcmF0b3IuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNHZW5lcmF0b3Iob2JqKSB7XG4gIHJldHVybiAnZnVuY3Rpb24nID09IHR5cGVvZiBvYmoubmV4dCAmJiAnZnVuY3Rpb24nID09IHR5cGVvZiBvYmoudGhyb3c7XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYG9iamAgaXMgYSBnZW5lcmF0b3IgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGlzR2VuZXJhdG9yRnVuY3Rpb24ob2JqKSB7XG4gIHZhciBjb25zdHJ1Y3RvciA9IG9iai5jb25zdHJ1Y3RvcjtcbiAgaWYgKCFjb25zdHJ1Y3RvcikgcmV0dXJuIGZhbHNlO1xuICBpZiAoJ0dlbmVyYXRvckZ1bmN0aW9uJyA9PT0gY29uc3RydWN0b3IubmFtZSB8fCAnR2VuZXJhdG9yRnVuY3Rpb24nID09PSBjb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSkgcmV0dXJuIHRydWU7XG4gIHJldHVybiBpc0dlbmVyYXRvcihjb25zdHJ1Y3Rvci5wcm90b3R5cGUpO1xufVxuXG4vKipcbiAqIENoZWNrIGZvciBwbGFpbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gaXNPYmplY3QodmFsKSB7XG4gIHJldHVybiBPYmplY3QgPT0gdmFsLmNvbnN0cnVjdG9yO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21tb25qc01vZHVsZShmbiwgbW9kdWxlKSB7XG5cdHJldHVybiBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IH0sIGZuKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMpLCBtb2R1bGUuZXhwb3J0cztcbn1cblxudmFyIGtleXMgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbidcbiAgPyBPYmplY3Qua2V5cyA6IHNoaW07XG5cbmV4cG9ydHMuc2hpbSA9IHNoaW07XG5mdW5jdGlvbiBzaGltIChvYmopIHtcbiAgdmFyIGtleXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikga2V5cy5wdXNoKGtleSk7XG4gIHJldHVybiBrZXlzO1xufVxufSk7XG5cbnZhciBpc19hcmd1bWVudHMgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG52YXIgc3VwcG9ydHNBcmd1bWVudHNDbGFzcyA9IChmdW5jdGlvbigpe1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZ3VtZW50cylcbn0pKCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPyBzdXBwb3J0ZWQgOiB1bnN1cHBvcnRlZDtcblxuZXhwb3J0cy5zdXBwb3J0ZWQgPSBzdXBwb3J0ZWQ7XG5mdW5jdGlvbiBzdXBwb3J0ZWQob2JqZWN0KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcbn1cblxuZXhwb3J0cy51bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuZnVuY3Rpb24gdW5zdXBwb3J0ZWQob2JqZWN0KXtcbiAgcmV0dXJuIG9iamVjdCAmJlxuICAgIHR5cGVvZiBvYmplY3QgPT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygb2JqZWN0Lmxlbmd0aCA9PSAnbnVtYmVyJyAmJlxuICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsICdjYWxsZWUnKSAmJlxuICAgICFPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwob2JqZWN0LCAnY2FsbGVlJykgfHxcbiAgICBmYWxzZTtcbn1cbn0pO1xuXG52YXIgaW5kZXgkMSA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUpIHtcbnZhciBwU2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgb2JqZWN0S2V5cyA9IGtleXM7XG52YXIgaXNBcmd1bWVudHMgPSBpc19hcmd1bWVudHM7XG5cbnZhciBkZWVwRXF1YWwgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKSB7XG4gIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAvLyA3LjEuIEFsbCBpZGVudGljYWwgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBhcyBkZXRlcm1pbmVkIGJ5ID09PS5cbiAgaWYgKGFjdHVhbCA9PT0gZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICB9IGVsc2UgaWYgKGFjdHVhbCBpbnN0YW5jZW9mIERhdGUgJiYgZXhwZWN0ZWQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIGFjdHVhbC5nZXRUaW1lKCkgPT09IGV4cGVjdGVkLmdldFRpbWUoKTtcblxuICAvLyA3LjMuIE90aGVyIHBhaXJzIHRoYXQgZG8gbm90IGJvdGggcGFzcyB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcsXG4gIC8vIGVxdWl2YWxlbmNlIGlzIGRldGVybWluZWQgYnkgPT0uXG4gIH0gZWxzZSBpZiAoIWFjdHVhbCB8fCAhZXhwZWN0ZWQgfHwgdHlwZW9mIGFjdHVhbCAhPSAnb2JqZWN0JyAmJiB0eXBlb2YgZXhwZWN0ZWQgIT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gb3B0cy5zdHJpY3QgPyBhY3R1YWwgPT09IGV4cGVjdGVkIDogYWN0dWFsID09IGV4cGVjdGVkO1xuXG4gIC8vIDcuNC4gRm9yIGFsbCBvdGhlciBPYmplY3QgcGFpcnMsIGluY2x1ZGluZyBBcnJheSBvYmplY3RzLCBlcXVpdmFsZW5jZSBpc1xuICAvLyBkZXRlcm1pbmVkIGJ5IGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoYXMgdmVyaWZpZWRcbiAgLy8gd2l0aCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwpLCB0aGUgc2FtZSBzZXQgb2Yga2V5c1xuICAvLyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSwgZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5XG4gIC8vIGNvcnJlc3BvbmRpbmcga2V5LCBhbmQgYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LiBOb3RlOiB0aGlzXG4gIC8vIGFjY291bnRzIGZvciBib3RoIG5hbWVkIGFuZCBpbmRleGVkIHByb3BlcnRpZXMgb24gQXJyYXlzLlxuICB9IGVsc2Uge1xuICAgIHJldHVybiBvYmpFcXVpdihhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWRPck51bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzQnVmZmVyICh4KSB7XG4gIGlmICgheCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcgfHwgdHlwZW9mIHgubGVuZ3RoICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICBpZiAodHlwZW9mIHguY29weSAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgeC5zbGljZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoeC5sZW5ndGggPiAwICYmIHR5cGVvZiB4WzBdICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gb2JqRXF1aXYoYSwgYiwgb3B0cykge1xuICB2YXIgaSwga2V5O1xuICBpZiAoaXNVbmRlZmluZWRPck51bGwoYSkgfHwgaXNVbmRlZmluZWRPck51bGwoYikpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvLyBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuXG4gIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHJldHVybiBmYWxzZTtcbiAgLy9+fn5JJ3ZlIG1hbmFnZWQgdG8gYnJlYWsgT2JqZWN0LmtleXMgdGhyb3VnaCBzY3Jld3kgYXJndW1lbnRzIHBhc3NpbmcuXG4gIC8vICAgQ29udmVydGluZyB0byBhcnJheSBzb2x2ZXMgdGhlIHByb2JsZW0uXG4gIGlmIChpc0FyZ3VtZW50cyhhKSkge1xuICAgIGlmICghaXNBcmd1bWVudHMoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYSA9IHBTbGljZS5jYWxsKGEpO1xuICAgIGIgPSBwU2xpY2UuY2FsbChiKTtcbiAgICByZXR1cm4gZGVlcEVxdWFsKGEsIGIsIG9wdHMpO1xuICB9XG4gIGlmIChpc0J1ZmZlcihhKSkge1xuICAgIGlmICghaXNCdWZmZXIoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB0cnkge1xuICAgIHZhciBrYSA9IG9iamVjdEtleXMoYSksXG4gICAgICAgIGtiID0gb2JqZWN0S2V5cyhiKTtcbiAgfSBjYXRjaCAoZSkgey8vaGFwcGVucyB3aGVuIG9uZSBpcyBhIHN0cmluZyBsaXRlcmFsIGFuZCB0aGUgb3RoZXIgaXNuJ3RcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy8gaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChrZXlzIGluY29ycG9yYXRlc1xuICAvLyBoYXNPd25Qcm9wZXJ0eSlcbiAgaWYgKGthLmxlbmd0aCAhPSBrYi5sZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvL3RoZSBzYW1lIHNldCBvZiBrZXlzIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLFxuICBrYS5zb3J0KCk7XG4gIGtiLnNvcnQoKTtcbiAgLy9+fn5jaGVhcCBrZXkgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChrYVtpXSAhPSBrYltpXSlcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvL2VxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeSBjb3JyZXNwb25kaW5nIGtleSwgYW5kXG4gIC8vfn5+cG9zc2libHkgZXhwZW5zaXZlIGRlZXAgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGtleSA9IGthW2ldO1xuICAgIGlmICghZGVlcEVxdWFsKGFba2V5XSwgYltrZXldLCBvcHRzKSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gdHlwZW9mIGI7XG59XG59KTtcblxuY29uc3QgYXNzZXJ0aW9ucyA9IHtcbiAgb2sodmFsLCBtZXNzYWdlID0gJ3Nob3VsZCBiZSB0cnV0aHknKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogQm9vbGVhbih2YWwpLFxuICAgICAgZXhwZWN0ZWQ6ICd0cnV0aHknLFxuICAgICAgYWN0dWFsOiB2YWwsXG4gICAgICBvcGVyYXRvcjogJ29rJyxcbiAgICAgIG1lc3NhZ2VcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBkZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgYmUgZXF1aXZhbGVudCcpIHtcbiAgICBjb25zdCBhc3NlcnRpb25SZXN1bHQgPSB7XG4gICAgICBwYXNzOiBpbmRleCQxKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdkZWVwRXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgZXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgYmUgZXF1YWwnKSB7XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogYWN0dWFsID09PSBleHBlY3RlZCxcbiAgICAgIGFjdHVhbCxcbiAgICAgIGV4cGVjdGVkLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIG9wZXJhdG9yOiAnZXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90T2sodmFsLCBtZXNzYWdlID0gJ3Nob3VsZCBub3QgYmUgdHJ1dGh5Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6ICFCb29sZWFuKHZhbCksXG4gICAgICBleHBlY3RlZDogJ2ZhbHN5JyxcbiAgICAgIGFjdHVhbDogdmFsLFxuICAgICAgb3BlcmF0b3I6ICdub3RPaycsXG4gICAgICBtZXNzYWdlXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90RGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UgPSAnc2hvdWxkIG5vdCBiZSBlcXVpdmFsZW50Jykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6ICFpbmRleCQxKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgICAgYWN0dWFsLFxuICAgICAgZXhwZWN0ZWQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgb3BlcmF0b3I6ICdub3REZWVwRXF1YWwnXG4gICAgfTtcbiAgICB0aGlzLnRlc3QuYWRkQXNzZXJ0aW9uKGFzc2VydGlvblJlc3VsdCk7XG4gICAgcmV0dXJuIGFzc2VydGlvblJlc3VsdDtcbiAgfSxcbiAgbm90RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSA9ICdzaG91bGQgbm90IGJlIGVxdWFsJykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGFjdHVhbCAhPT0gZXhwZWN0ZWQsXG4gICAgICBhY3R1YWwsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBvcGVyYXRvcjogJ25vdEVxdWFsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIHRocm93cyhmdW5jLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICAgIGxldCBjYXVnaHQsIHBhc3MsIGFjdHVhbDtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnc3RyaW5nJykge1xuICAgICAgW2V4cGVjdGVkLCBtZXNzYWdlXSA9IFttZXNzYWdlLCBleHBlY3RlZF07XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBmdW5jKCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNhdWdodCA9IHtlcnJvcn07XG4gICAgfVxuICAgIHBhc3MgPSBjYXVnaHQgIT09IHVuZGVmaW5lZDtcbiAgICBhY3R1YWwgPSBjYXVnaHQgJiYgY2F1Z2h0LmVycm9yO1xuICAgIGlmIChleHBlY3RlZCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcGFzcyA9IGV4cGVjdGVkLnRlc3QoYWN0dWFsKSB8fCBleHBlY3RlZC50ZXN0KGFjdHVhbCAmJiBhY3R1YWwubWVzc2FnZSk7XG4gICAgICBleHBlY3RlZCA9IFN0cmluZyhleHBlY3RlZCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdmdW5jdGlvbicgJiYgY2F1Z2h0KSB7XG4gICAgICBwYXNzID0gYWN0dWFsIGluc3RhbmNlb2YgZXhwZWN0ZWQ7XG4gICAgICBhY3R1YWwgPSBhY3R1YWwuY29uc3RydWN0b3I7XG4gICAgfVxuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3MsXG4gICAgICBleHBlY3RlZCxcbiAgICAgIGFjdHVhbCxcbiAgICAgIG9wZXJhdG9yOiAndGhyb3dzJyxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UgfHwgJ3Nob3VsZCB0aHJvdydcbiAgICB9O1xuICAgIHRoaXMudGVzdC5hZGRBc3NlcnRpb24oYXNzZXJ0aW9uUmVzdWx0KTtcbiAgICByZXR1cm4gYXNzZXJ0aW9uUmVzdWx0O1xuICB9LFxuICBkb2VzTm90VGhyb3coZnVuYywgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgICBsZXQgY2F1Z2h0O1xuICAgIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBbZXhwZWN0ZWQsIG1lc3NhZ2VdID0gW21lc3NhZ2UsIGV4cGVjdGVkXTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGZ1bmMoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY2F1Z2h0ID0ge2Vycm9yfTtcbiAgICB9XG4gICAgY29uc3QgYXNzZXJ0aW9uUmVzdWx0ID0ge1xuICAgICAgcGFzczogY2F1Z2h0ID09PSB1bmRlZmluZWQsXG4gICAgICBleHBlY3RlZDogJ25vIHRocm93biBlcnJvcicsXG4gICAgICBhY3R1YWw6IGNhdWdodCAmJiBjYXVnaHQuZXJyb3IsXG4gICAgICBvcGVyYXRvcjogJ2RvZXNOb3RUaHJvdycsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlIHx8ICdzaG91bGQgbm90IHRocm93J1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH0sXG4gIGZhaWwocmVhc29uID0gJ2ZhaWwgY2FsbGVkJykge1xuICAgIGNvbnN0IGFzc2VydGlvblJlc3VsdCA9IHtcbiAgICAgIHBhc3M6IGZhbHNlLFxuICAgICAgYWN0dWFsOiAnZmFpbCBjYWxsZWQnLFxuICAgICAgZXhwZWN0ZWQ6ICdmYWlsIG5vdCBjYWxsZWQnLFxuICAgICAgbWVzc2FnZTogcmVhc29uLFxuICAgICAgb3BlcmF0b3I6ICdmYWlsJ1xuICAgIH07XG4gICAgdGhpcy50ZXN0LmFkZEFzc2VydGlvbihhc3NlcnRpb25SZXN1bHQpO1xuICAgIHJldHVybiBhc3NlcnRpb25SZXN1bHQ7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGFzc2VydGlvbiAodGVzdCkge1xuICByZXR1cm4gT2JqZWN0LmNyZWF0ZShhc3NlcnRpb25zLCB7dGVzdDoge3ZhbHVlOiB0ZXN0fX0pO1xufVxuXG5jb25zdCBUZXN0ID0ge1xuICBydW46IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBhc3NlcnQgPSBhc3NlcnRpb24odGhpcyk7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICByZXR1cm4gaW5kZXgodGhpcy5jb3JvdXRpbmUoYXNzZXJ0KSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHthc3NlcnRpb25zOiB0aGlzLmFzc2VydGlvbnMsIGV4ZWN1dGlvblRpbWU6IERhdGUubm93KCkgLSBub3d9O1xuICAgICAgfSk7XG4gIH0sXG4gIGFkZEFzc2VydGlvbigpe1xuICAgIGNvbnN0IG5ld0Fzc2VydGlvbnMgPSBbLi4uYXJndW1lbnRzXS5tYXAoYSA9PiBPYmplY3QuYXNzaWduKHtkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmlwdGlvbn0sIGEpKTtcbiAgICB0aGlzLmFzc2VydGlvbnMucHVzaCguLi5uZXdBc3NlcnRpb25zKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxufTtcblxuZnVuY3Rpb24gdGVzdCAoe2Rlc2NyaXB0aW9uLCBjb3JvdXRpbmUsIG9ubHkgPSBmYWxzZX0pIHtcbiAgcmV0dXJuIE9iamVjdC5jcmVhdGUoVGVzdCwge1xuICAgIGRlc2NyaXB0aW9uOiB7dmFsdWU6IGRlc2NyaXB0aW9ufSxcbiAgICBjb3JvdXRpbmU6IHt2YWx1ZTogY29yb3V0aW5lfSxcbiAgICBhc3NlcnRpb25zOiB7dmFsdWU6IFtdfSxcbiAgICBvbmx5OiB7dmFsdWU6IG9ubHl9LFxuICAgIGxlbmd0aDoge1xuICAgICAgZ2V0KCl7XG4gICAgICAgIHJldHVybiB0aGlzLmFzc2VydGlvbnMubGVuZ3RoXG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gdGFwT3V0ICh7cGFzcywgbWVzc2FnZSwgaW5kZXh9KSB7XG4gIGNvbnN0IHN0YXR1cyA9IHBhc3MgPT09IHRydWUgPyAnb2snIDogJ25vdCBvayc7XG4gIGNvbnNvbGUubG9nKFtzdGF0dXMsIGluZGV4LCBtZXNzYWdlXS5qb2luKCcgJykpO1xufVxuXG5mdW5jdGlvbiBjYW5FeGl0ICgpIHtcbiAgcmV0dXJuIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcHJvY2Vzcy5leGl0ID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiB0YXAgKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKiAoKSB7XG4gICAgbGV0IGluZGV4ID0gMTtcbiAgICBsZXQgbGFzdElkID0gMDtcbiAgICBsZXQgc3VjY2VzcyA9IDA7XG4gICAgbGV0IGZhaWx1cmUgPSAwO1xuXG4gICAgY29uc3Qgc3RhclRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKCdUQVAgdmVyc2lvbiAxMycpO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBjb25zdCBhc3NlcnRpb24gPSB5aWVsZDtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5wYXNzID09PSB0cnVlKSB7XG4gICAgICAgICAgc3VjY2VzcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZhaWx1cmUrKztcbiAgICAgICAgfVxuICAgICAgICBhc3NlcnRpb24uaW5kZXggPSBpbmRleDtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5pZCAhPT0gbGFzdElkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYCMgJHthc3NlcnRpb24uZGVzY3JpcHRpb259IC0gJHthc3NlcnRpb24uZXhlY3V0aW9uVGltZX1tc2ApO1xuICAgICAgICAgIGxhc3RJZCA9IGFzc2VydGlvbi5pZDtcbiAgICAgICAgfVxuICAgICAgICB0YXBPdXQoYXNzZXJ0aW9uKTtcbiAgICAgICAgaWYgKGFzc2VydGlvbi5wYXNzICE9PSB0cnVlKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYCAgLS0tXG4gIG9wZXJhdG9yOiAke2Fzc2VydGlvbi5vcGVyYXRvcn1cbiAgZXhwZWN0ZWQ6ICR7SlNPTi5zdHJpbmdpZnkoYXNzZXJ0aW9uLmV4cGVjdGVkKX1cbiAgYWN0dWFsOiAke0pTT04uc3RyaW5naWZ5KGFzc2VydGlvbi5hY3R1YWwpfVxuICAuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdCYWlsIG91dCEgdW5oYW5kbGVkIGV4Y2VwdGlvbicpO1xuICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgICBpZiAoY2FuRXhpdCgpKSB7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZmluYWxseSB7XG4gICAgICBjb25zdCBleGVjdXRpb24gPSBEYXRlLm5vdygpIC0gc3RhclRpbWU7XG4gICAgICBpZiAoaW5kZXggPiAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBcbjEuLiR7aW5kZXggLSAxfVxuIyBkdXJhdGlvbiAke2V4ZWN1dGlvbn1tc1xuIyBzdWNjZXNzICR7c3VjY2Vzc31cbiMgZmFpbHVyZSAke2ZhaWx1cmV9YCk7XG4gICAgICB9XG4gICAgICBpZiAoZmFpbHVyZSAmJiBjYW5FeGl0KCkpIHtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuY29uc3QgUGxhbiA9IHtcbiAgdGVzdChkZXNjcmlwdGlvbiwgY29yb3V0aW5lLCBvcHRzID0ge30pe1xuICAgIGNvbnN0IHRlc3RJdGVtcyA9ICghY29yb3V0aW5lICYmIGRlc2NyaXB0aW9uLnRlc3RzKSA/IFsuLi5kZXNjcmlwdGlvbl0gOiBbe2Rlc2NyaXB0aW9uLCBjb3JvdXRpbmV9XTtcbiAgICB0aGlzLnRlc3RzLnB1c2goLi4udGVzdEl0ZW1zLm1hcCh0PT50ZXN0KE9iamVjdC5hc3NpZ24odCwgb3B0cykpKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgb25seShkZXNjcmlwdGlvbiwgY29yb3V0aW5lKXtcbiAgICByZXR1cm4gdGhpcy50ZXN0KGRlc2NyaXB0aW9uLCBjb3JvdXRpbmUsIHtvbmx5OiB0cnVlfSk7XG4gIH0sXG5cbiAgcnVuKHNpbmsgPSB0YXAoKSl7XG4gICAgY29uc3Qgc2lua0l0ZXJhdG9yID0gc2luaygpO1xuICAgIHNpbmtJdGVyYXRvci5uZXh0KCk7XG4gICAgY29uc3QgaGFzT25seSA9IHRoaXMudGVzdHMuc29tZSh0PT50Lm9ubHkpO1xuICAgIGNvbnN0IHJ1bm5hYmxlID0gaGFzT25seSA/IHRoaXMudGVzdHMuZmlsdGVyKHQ9PnQub25seSkgOiB0aGlzLnRlc3RzO1xuICAgIHJldHVybiBpbmRleChmdW5jdGlvbiAqICgpIHtcbiAgICAgIGxldCBpZCA9IDE7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gcnVubmFibGUubWFwKHQ9PnQucnVuKCkpO1xuICAgICAgICBmb3IgKGxldCByIG9mIHJlc3VsdHMpIHtcbiAgICAgICAgICBjb25zdCB7YXNzZXJ0aW9ucywgZXhlY3V0aW9uVGltZX0gPSB5aWVsZCByO1xuICAgICAgICAgIGZvciAobGV0IGFzc2VydCBvZiBhc3NlcnRpb25zKSB7XG4gICAgICAgICAgICBzaW5rSXRlcmF0b3IubmV4dChPYmplY3QuYXNzaWduKGFzc2VydCwge2lkLCBleGVjdXRpb25UaW1lfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYXRjaCAoZSkge1xuICAgICAgICBzaW5rSXRlcmF0b3IudGhyb3coZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBzaW5rSXRlcmF0b3IucmV0dXJuKCk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKVxuICB9LFxuXG4gICogW1N5bWJvbC5pdGVyYXRvcl0oKXtcbiAgICBmb3IgKGxldCB0IG9mIHRoaXMudGVzdHMpIHtcbiAgICAgIHlpZWxkIHQ7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBwbGFuICgpIHtcbiAgcmV0dXJuIE9iamVjdC5jcmVhdGUoUGxhbiwge1xuICAgIHRlc3RzOiB7dmFsdWU6IFtdfSxcbiAgICBsZW5ndGg6IHtcbiAgICAgIGdldCgpe1xuICAgICAgICByZXR1cm4gdGhpcy50ZXN0cy5sZW5ndGhcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwbGFuO1xuIiwiZXhwb3J0IGNvbnN0IG5leHRUaWNrID0gZm4gPT4gc2V0VGltZW91dChmbiwgMCk7XG5cbmV4cG9ydCBjb25zdCBwYWlyaWZ5ID0gaG9sZGVyID0+IGtleSA9PiBba2V5LCBob2xkZXJba2V5XV07XG5cbmV4cG9ydCBjb25zdCBpc1NoYWxsb3dFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IGFLZXlzID0gT2JqZWN0LmtleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gT2JqZWN0LmtleXMoYik7XG4gIHJldHVybiBhS2V5cy5sZW5ndGggPT09IGJLZXlzLmxlbmd0aCAmJiBhS2V5cy5ldmVyeSgoaykgPT4gYVtrXSA9PT0gYltrXSk7XG59O1xuXG5jb25zdCBvd25LZXlzID0gb2JqID0+IE9iamVjdC5rZXlzKG9iaikuZmlsdGVyKGsgPT4gb2JqLmhhc093blByb3BlcnR5KGspKTtcblxuZXhwb3J0IGNvbnN0IGlzRGVlcEVxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgdHlwZSA9IHR5cGVvZiBhO1xuXG4gIC8vc2hvcnQgcGF0aChzKVxuICBpZiAoYSA9PT0gYikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKHR5cGUgIT09IHR5cGVvZiBiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKHR5cGUgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIGEgPT09IGI7XG4gIH1cblxuICAvLyBvYmplY3RzIC4uLlxuICBpZiAoYSA9PT0gbnVsbCB8fCBiID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkoYSkpIHtcbiAgICByZXR1cm4gYS5sZW5ndGggJiYgYi5sZW5ndGggJiYgYS5ldmVyeSgoaXRlbSwgaSkgPT4gaXNEZWVwRXF1YWwoYVtpXSwgYltpXSkpO1xuICB9XG5cbiAgY29uc3QgYUtleXMgPSBvd25LZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IG93bktleXMoYik7XG4gIHJldHVybiBhS2V5cy5sZW5ndGggPT09IGJLZXlzLmxlbmd0aCAmJiBhS2V5cy5ldmVyeShrID0+IGlzRGVlcEVxdWFsKGFba10sIGJba10pKTtcbn07XG5cbmV4cG9ydCBjb25zdCBpZGVudGl0eSA9IGEgPT4gYTtcblxuZXhwb3J0IGNvbnN0IG5vb3AgPSBfID0+IHtcbn07XG4iLCJleHBvcnQgY29uc3QgdHJhdmVyc2UgPSBmdW5jdGlvbiAqICh2bm9kZSkge1xuICB5aWVsZCB2bm9kZTtcbiAgaWYgKHZub2RlLmNoaWxkcmVuICYmIHZub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgIGZvciAobGV0IGNoaWxkIG9mIHZub2RlLmNoaWxkcmVuKSB7XG4gICAgICB5aWVsZCAqIHRyYXZlcnNlKGNoaWxkKTtcbiAgICB9XG4gIH1cbn07IiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQge2lzU2hhbGxvd0VxdWFsLCBwYWlyaWZ5fSBmcm9tICcuLi9saWIvdXRpbCc7XG5pbXBvcnQge3RyYXZlcnNlfSBmcm9tICcuLi9saWIvdHJhdmVyc2UnO1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ3Nob3VsZCB0cmF2ZXJzZSBhIHRyZWUgKGdvaW5nIGRlZXAgZmlyc3QpJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IHRyZWUgPSB7XG4gICAgICBpZDogMSxcbiAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgIHtpZDogMiwgY2hpbGRyZW46IFt7aWQ6IDN9LCB7aWQ6IDR9XX0sXG4gICAgICAgIHtpZDogNSwgY2hpbGRyZW46IFt7aWQ6IDZ9XX0sXG4gICAgICAgIHtpZDogN31cbiAgICAgIF1cbiAgICB9O1xuXG4gICAgY29uc3Qgc2VxdWVuY2UgPSBbLi4udHJhdmVyc2UodHJlZSldLm1hcChuID0+IG4uaWQpO1xuICAgIHQuZGVlcEVxdWFsKHNlcXVlbmNlLCBbMSwgMiwgMywgNCwgNSwgNiwgN10pO1xuICB9KVxuICAudGVzdCgncGFpciBrZXkgdG8gdmFsdWUgb2JqZWN0IG9mIGFuIG9iamVjdCAoYWthIE9iamVjdC5lbnRyaWVzKScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBob2xkZXIgPSB7YTogMSwgYjogMiwgYzogMywgZDogNH07XG4gICAgY29uc3QgZiA9IHBhaXJpZnkoaG9sZGVyKTtcbiAgICBjb25zdCBkYXRhID0gT2JqZWN0LmtleXMoaG9sZGVyKS5tYXAoZik7XG4gICAgdC5kZWVwRXF1YWwoZGF0YSwgW1snYScsIDFdLCBbJ2InLCAyXSwgWydjJywgM10sIFsnZCcsIDRdXSk7XG4gIH0pXG4gIC50ZXN0KCdzaGFsbG93IGVxdWFsaXR5IHRlc3Qgb24gb2JqZWN0JywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IG5lc3RlZCA9IHtmb286ICdiYXInfTtcbiAgICBjb25zdCBvYmoxID0ge2E6IDEsIGI6ICcyJywgYzogdHJ1ZSwgZDogbmVzdGVkfTtcbiAgICB0Lm9rKGlzU2hhbGxvd0VxdWFsKG9iajEsIHthOiAxLCBiOiAnMicsIGM6IHRydWUsIGQ6IG5lc3RlZH0pKTtcbiAgICB0Lm5vdE9rKGlzU2hhbGxvd0VxdWFsKG9iajEsIHtcbiAgICAgIGE6IDEsXG4gICAgICBiOiAnMicsXG4gICAgICBjOiB0cnVlLFxuICAgICAgZDoge2ZvbzogJ2Jhcid9XG4gICAgfSksICduZXN0ZWQgb2JqZWN0IHNob3VsZCBiZSBjaGVja2VkIGJ5IHJlZmVyZW5jZScpO1xuICAgIHQubm90T2soaXNTaGFsbG93RXF1YWwob2JqMSwge2E6IDEsIGI6IDIsIGM6IHRydWUsIGQ6IG5lc3RlZH0pLCAnZXhhY3QgdHlwZSBjaGVja2luZyBvbiBwcmltaXRpdmUnKTtcbiAgICB0Lm5vdE9rKGlzU2hhbGxvd0VxdWFsKG9iajEsIHthOiAxLCBjOiB0cnVlLCBkOiBuZXN0ZWR9KSwgJ3JldHVybiBmYWxzZSBvbiBtaXNzaW5nIHByb3BlcnRpZXMnKTtcbiAgICB0Lm5vdE9rKGlzU2hhbGxvd0VxdWFsKHthOiAxLCBjOiB0cnVlLCBkOiBuZXN0ZWR9LCBvYmoxKSwgJ3JldHVybiBmYWxzZSBvbiBtaXNzaW5nIHByb3BlcnRpZXMgKGNvbW1tdXRhdGl2ZScpO1xuICB9KTtcbiIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImltcG9ydCB7dGFwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCB1cGRhdGVEb21Ob2RlRmFjdG9yeSA9IChtZXRob2QpID0+IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBwYWlyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZVttZXRob2RdKC4uLnBhaXIpO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IHJlbW92ZUV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ3JlbW92ZUV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBhZGRFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdhZGRFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3Qgc2V0QXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKChkb21Ob2RlKSA9PiB7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBpdGVtcy5maWx0ZXIoKFtrZXksIHZhbHVlXSkgPT4gdHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nKTtcbiAgZm9yIChsZXQgW2tleSwgdmFsdWVdIG9mIGF0dHJpYnV0ZXMpIHtcbiAgICB2YWx1ZSA9PT0gZmFsc2UgPyBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShrZXkpIDogZG9tTm9kZS5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZSk7XG4gIH1cbn0pO1xuZXhwb3J0IGNvbnN0IHJlbW92ZUF0dHJpYnV0ZXMgPSAoaXRlbXMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgYXR0ciBvZiBpdGVtcykge1xuICAgIGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IHNldFRleHROb2RlID0gdmFsID0+IG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudCA9IHZhbDtcblxuZXhwb3J0IGNvbnN0IGNyZWF0ZURvbU5vZGUgPSB2bm9kZSA9PiB7XG4gIHJldHVybiB2bm9kZS5ub2RlVHlwZSAhPT0gJ1RleHQnID9cbiAgICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHZub2RlLm5vZGVUeXBlKSA6XG4gICAgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoU3RyaW5nKHZub2RlLnByb3BzLnZhbHVlKSk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0RXZlbnRMaXN0ZW5lcnMgPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BzKVxuICAgIC5maWx0ZXIoayA9PiBrLnN1YnN0cigwLCAyKSA9PT0gJ29uJylcbiAgICAubWFwKGsgPT4gW2suc3Vic3RyKDIpLnRvTG93ZXJDYXNlKCksIHByb3BzW2tdXSk7XG59O1xuIiwiaW1wb3J0IHtcbiAgc2V0QXR0cmlidXRlcyxcbiAgcmVtb3ZlQXR0cmlidXRlcyxcbiAgYWRkRXZlbnRMaXN0ZW5lcnMsXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxuICBzZXRUZXh0Tm9kZSxcbiAgZ2V0RXZlbnRMaXN0ZW5lcnMsXG4gIGNyZWF0ZURvbU5vZGVcbn0gZnJvbSAnLi4vbGliL2RvbVV0aWwnO1xuaW1wb3J0IHtub29wfSBmcm9tICcuLi9saWIvdXRpbCc7XG5pbXBvcnQgem9yYSBmcm9tICd6b3JhJztcblxuY29uc3QgZG9tUHJvdG8gPSB7XG5cbiAgcmVtb3ZlQXR0cmlidXRlKGF0dHIpe1xuICAgIGRlbGV0ZSB0aGlzW2F0dHJdO1xuICB9LFxuXG4gIHNldEF0dHJpYnV0ZShhdHRyLCB2YWwpe1xuICAgIHRoaXNbYXR0cl0gPSB2YWw7XG4gIH0sXG5cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgaGFuZGxlcil7XG4gICAgdGhpcy5oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xuICB9LFxuXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIpe1xuICAgIGRlbGV0ZSB0aGlzLmhhbmRsZXJzW2V2ZW50XTtcbiAgfVxufTtcblxuY29uc3QgZmFrZURvbSA9ICgpID0+IHtcbiAgY29uc3QgZG9tID0gT2JqZWN0LmNyZWF0ZShkb21Qcm90byk7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShkb20sICdoYW5kbGVycycsIHt2YWx1ZToge319KTtcbiAgcmV0dXJuIGRvbTtcbn07XG5cbmNvbnN0IG93blByb3BzID0gKG9iaikgPT4ge1xuICBjb25zdCBvd25Qcm9wZXJ0aWVzID0gW107XG4gIGZvciAobGV0IHByb3AgaW4gb2JqKSB7XG4gICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgb3duUHJvcGVydGllcy5wdXNoKHByb3ApO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb3duUHJvcGVydGllcztcbn07XG5cblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdzZXQgYXR0cmlidXRlcycsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBkID0gZmFrZURvbSgpO1xuICAgIGNvbnN0IHVwZGF0ZSA9IHNldEF0dHJpYnV0ZXMoW1snZm9vJywgJ2JhciddLCBbJ2JsYWgnLCAyXSwgWyd3b290JywgdHJ1ZV1dKTtcbiAgICBjb25zdCBuID0gdXBkYXRlKGQpO1xuICAgIHQuZXF1YWwobiwgZCwgJ3Nob3VsZCBoYXZlIGZvcndhcmRlZCBkb20gbm9kZScpO1xuICAgIHQuZXF1YWwoZC5mb28sICdiYXInKTtcbiAgICB0LmVxdWFsKGQuYmxhaCwgMik7XG4gICAgdC5lcXVhbChkLndvb3QsIHRydWUpO1xuICAgIGNvbnN0IHByb3BzID0gb3duUHJvcHMoZCk7XG4gICAgdC5kZWVwRXF1YWwocHJvcHMsIFsnZm9vJywgJ2JsYWgnLCAnd29vdCddKTtcbiAgICBjb25zdCBoYW5kbGVycyA9IG93blByb3BzKGQuaGFuZGxlcnMpO1xuICAgIHQuZXF1YWwoaGFuZGxlcnMubGVuZ3RoLCAwKTtcbiAgfSlcbiAgLnRlc3QoJ3JlbW92ZSBhdHRyaWJ1dGUgaWYgdmFsdWUgaXMgZmFsc2UnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgZCA9IGZha2VEb20oKTtcbiAgICBkLmZvbyA9ICdiYXInO1xuICAgIHQuZGVlcEVxdWFsKG93blByb3BzKGQpLCBbJ2ZvbyddKTtcbiAgICBjb25zdCB1cGRhdGUgPSBzZXRBdHRyaWJ1dGVzKFtbJ2ZvbycsIGZhbHNlXV0pO1xuICAgIGNvbnN0IG4gPSB1cGRhdGUoZCk7XG4gICAgdC5lcXVhbChuLCBkLCAnc2hvdWxkIGhhdmUgZm9yd2FyZGVkIGRvbSBub2RlJyk7XG4gICAgdC5lcXVhbChkLmZvbywgdW5kZWZpbmVkKTtcbiAgICB0LmVxdWFsKG93blByb3BzKGQpLmxlbmd0aCwgMCk7XG4gICAgY29uc3QgaGFuZGxlcnMgPSBvd25Qcm9wcyhkLmhhbmRsZXJzKTtcbiAgICB0LmVxdWFsKGhhbmRsZXJzLmxlbmd0aCwgMCk7XG4gIH0pXG4gIC50ZXN0KCdyZW1vdmUgYXR0cmlidXRlcycsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBkID0gZmFrZURvbSgpO1xuICAgIGQuZm9vID0gJ2Jhcic7XG4gICAgZC53b290ID0gMjtcbiAgICBkLmJhciA9ICdibGFoJztcbiAgICB0LmRlZXBFcXVhbChvd25Qcm9wcyhkKSwgWydmb28nLCAnd29vdCcsICdiYXInXSk7XG4gICAgY29uc3QgdXBkYXRlID0gcmVtb3ZlQXR0cmlidXRlcyhbJ2ZvbycsICd3b290J10pO1xuICAgIGNvbnN0IG4gPSB1cGRhdGUoZCk7XG4gICAgdC5lcXVhbChuLCBkLCAnc2hvdWxkIGhhdmUgZm9yd2FyZGVkIGRvbSBub2RlJyk7XG4gICAgdC5lcXVhbChkLmJhciwgJ2JsYWgnKTtcbiAgICB0LmVxdWFsKG93blByb3BzKGQpLmxlbmd0aCwgMSk7XG4gICAgY29uc3QgaGFuZGxlcnMgPSBvd25Qcm9wcyhkLmhhbmRsZXJzKTtcbiAgICB0LmVxdWFsKGhhbmRsZXJzLmxlbmd0aCwgMCk7XG4gIH0pXG4gIC50ZXN0KCdhZGQgZXZlbnQgbGlzdGVuZXJzJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGQgPSBmYWtlRG9tKCk7XG4gICAgY29uc3QgdXBkYXRlID0gYWRkRXZlbnRMaXN0ZW5lcnMoW1snY2xpY2snLCBub29wXG4gICAgXSwgWydpbnB1dCcsIG5vb3BdXSk7XG4gICAgY29uc3QgbiA9IHVwZGF0ZShkKTtcbiAgICB0LmVxdWFsKG4sIGQsICdzaG91bGQgaGF2ZSBmb3J3YXJkZWQgdGhlIG5vZGUnKTtcbiAgICB0LmVxdWFsKG93blByb3BzKGQpLmxlbmd0aCwgMCk7XG4gICAgdC5kZWVwRXF1YWwob3duUHJvcHMoZC5oYW5kbGVycyksIFsnY2xpY2snLCAnaW5wdXQnXSk7XG4gICAgdC5lcXVhbChkLmhhbmRsZXJzLmNsaWNrLCBub29wKTtcbiAgICB0LmVxdWFsKGQuaGFuZGxlcnMuaW5wdXQsIG5vb3ApO1xuICB9KVxuICAudGVzdCgncmVtb3ZlIGV2ZW50IGxpc3RlbmVycycsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBkID0gZmFrZURvbSgpO1xuICAgIGQuaGFuZGxlcnMuY2xpY2sgPSBub29wO1xuICAgIGQuaGFuZGxlcnMuaW5wdXQgPSBub29wO1xuICAgIGNvbnN0IHVwZGF0ZSA9IHJlbW92ZUV2ZW50TGlzdGVuZXJzKFtbJ2NsaWNrJywgbm9vcFxuICAgIF1dKTtcbiAgICBjb25zdCBuID0gdXBkYXRlKGQpO1xuICAgIHQuZXF1YWwobiwgZCwgJ3Nob3VsZCBoYXZlIGZvcndhcmRlZCB0aGUgbm9kZScpO1xuICAgIHQuZGVlcEVxdWFsKG93blByb3BzKGQuaGFuZGxlcnMpLCBbJ2lucHV0J10pO1xuICAgIHQuZXF1YWwoZC5oYW5kbGVycy5pbnB1dCwgbm9vcCk7XG4gIH0pXG4gIC50ZXN0KCdzZXQgdGV4dCBub2RlIHZhbHVlJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IG5vZGUgPSB7fTtcbiAgICBjb25zdCB1cGRhdGUgPSBzZXRUZXh0Tm9kZSgnZm9vJyk7XG4gICAgdXBkYXRlKG5vZGUpO1xuICAgIHQuZXF1YWwobm9kZS50ZXh0Q29udGVudCwgJ2ZvbycpO1xuICB9KVxuICAudGVzdCgnZ2V0IGV2ZW50IExpc3RlbmVycyBmcm9tIHByb3BzIG9iamVjdCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBwcm9wcyA9IHtcbiAgICAgIG9uQ2xpY2s6ICgpID0+IHtcbiAgICAgIH0sXG4gICAgICBpbnB1dDogKCkgPT4ge1xuICAgICAgfSxcbiAgICAgIG9uTW91c2Vkb3duOiAoKSA9PiB7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKHByb3BzKTtcbiAgICB0LmRlZXBFcXVhbChldmVudHMsIFtcbiAgICAgIFsnY2xpY2snLCBwcm9wcy5vbkNsaWNrXSxcbiAgICAgIFsnbW91c2Vkb3duJywgcHJvcHMub25Nb3VzZWRvd25dLFxuICAgIF0pO1xuICB9KVxuICAvLyAudGVzdCgnY3JlYXRlIHRleHQgZG9tIG5vZGUnLCBmdW5jdGlvbiAqICh0KSB7XG4gIC8vICAgZG9jdW1lbnQgPSBkb2N1bWVudCB8fCB7XG4gIC8vICAgICAgIGNyZWF0ZUVsZW1lbnQ6IChhcmcpID0+IHtcbiAgLy8gICAgICAgICByZXR1cm4ge2VsZW1lbnQ6IGFyZ307XG4gIC8vICAgICAgIH0sXG4gIC8vICAgICAgIGNyZWF0ZVRleHROb2RlOiAoYXJnKSA9PiB7XG4gIC8vICAgICAgICAgcmV0dXJuIHt0ZXh0OiBhcmd9O1xuICAvLyAgICAgICB9XG4gIC8vICAgICB9O1xuICAvLyAgIGNvbnN0IG4gPSBjcmVhdGVEb21Ob2RlKHtub2RlVHlwZTonVGV4dCcscHJvcHM6e3ZhbHVlOidmb28nfX0pO1xuICAvLyAgIHQuZGVlcEVxdWFsKG4se3RleHQ6J2Zvbyd9KTtcbiAgLy8gfSkiLCJjb25zdCBjcmVhdGVUZXh0Vk5vZGUgPSAodmFsdWUpID0+ICh7XG4gIG5vZGVUeXBlOiAnVGV4dCcsXG4gIGNoaWxkcmVuOiBbXSxcbiAgcHJvcHM6IHt2YWx1ZX0sXG4gIGxpZmVDeWNsZTogMFxufSk7XG5cbi8qKlxuICogVHJhbnNmb3JtIGh5cGVyc2NyaXB0IGludG8gdmlydHVhbCBkb20gbm9kZVxuICogQHBhcmFtIG5vZGVUeXBlIHtGdW5jdGlvbiwgU3RyaW5nfSAtIHRoZSBIVE1MIHRhZyBpZiBzdHJpbmcsIGEgY29tcG9uZW50IG9yIGNvbWJpbmF0b3Igb3RoZXJ3aXNlXG4gKiBAcGFyYW0gcHJvcHMge09iamVjdH0gLSB0aGUgbGlzdCBvZiBwcm9wZXJ0aWVzL2F0dHJpYnV0ZXMgYXNzb2NpYXRlZCB0byB0aGUgcmVsYXRlZCBub2RlXG4gKiBAcGFyYW0gY2hpbGRyZW4gLSB0aGUgdmlydHVhbCBkb20gbm9kZXMgcmVsYXRlZCB0byB0aGUgY3VycmVudCBub2RlIGNoaWxkcmVuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSAtIGEgdmlydHVhbCBkb20gbm9kZVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBoIChub2RlVHlwZSwgcHJvcHMsIC4uLmNoaWxkcmVuKSB7XG4gIGNvbnN0IGZsYXRDaGlsZHJlbiA9IGNoaWxkcmVuLnJlZHVjZSgoYWNjLCBjaGlsZCkgPT4ge1xuICAgIGNvbnN0IGNoaWxkcmVuQXJyYXkgPSBBcnJheS5pc0FycmF5KGNoaWxkKSA/IGNoaWxkIDogW2NoaWxkXTtcbiAgICByZXR1cm4gYWNjLmNvbmNhdChjaGlsZHJlbkFycmF5KTtcbiAgfSwgW10pXG4gICAgLm1hcChjaGlsZCA9PiB7XG4gICAgICAvLyBub3JtYWxpemUgdGV4dCBub2RlIHRvIGhhdmUgc2FtZSBzdHJ1Y3R1cmUgdGhhbiByZWd1bGFyIGRvbSBub2Rlc1xuICAgICAgY29uc3QgdHlwZSA9IHR5cGVvZiBjaGlsZDtcbiAgICAgIHJldHVybiB0eXBlID09PSAnb2JqZWN0JyB8fCB0eXBlID09PSAnZnVuY3Rpb24nID8gY2hpbGQgOiBjcmVhdGVUZXh0Vk5vZGUoY2hpbGQpO1xuICAgIH0pO1xuXG4gIGlmICh0eXBlb2Ygbm9kZVR5cGUgIT09ICdmdW5jdGlvbicpIHsvL3JlZ3VsYXIgaHRtbC90ZXh0IG5vZGVcbiAgICByZXR1cm4ge1xuICAgICAgbm9kZVR5cGUsXG4gICAgICBwcm9wczogcHJvcHMsXG4gICAgICBjaGlsZHJlbjogZmxhdENoaWxkcmVuLFxuICAgICAgbGlmZUN5Y2xlOiAwXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBmdWxsUHJvcHMgPSBPYmplY3QuYXNzaWduKHtjaGlsZHJlbjogZmxhdENoaWxkcmVufSwgcHJvcHMpO1xuICAgIGNvbnN0IGNvbXAgPSBub2RlVHlwZShmdWxsUHJvcHMpO1xuICAgIHJldHVybiB0eXBlb2YgY29tcCAhPT0gJ2Z1bmN0aW9uJyA/IGNvbXAgOiBoKGNvbXAsIHByb3BzLCAuLi5mbGF0Q2hpbGRyZW4pOyAvL2Z1bmN0aW9uYWwgY29tcCB2cyBjb21iaW5hdG9yIChIT0MpXG4gIH1cbn07IiwiaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7XG4gIGlzU2hhbGxvd0VxdWFsLFxuICBwYWlyaWZ5LFxuICBuZXh0VGljayxcbiAgbm9vcFxufSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlQXR0cmlidXRlcyxcbiAgc2V0QXR0cmlidXRlcyxcbiAgc2V0VGV4dE5vZGUsXG4gIGNyZWF0ZURvbU5vZGUsXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxuICBhZGRFdmVudExpc3RlbmVycyxcbiAgZ2V0RXZlbnRMaXN0ZW5lcnMsXG59IGZyb20gJy4vZG9tVXRpbCc7XG5pbXBvcnQge3RyYXZlcnNlfSBmcm9tICcuL3RyYXZlcnNlJztcblxuZnVuY3Rpb24gdXBkYXRlRXZlbnRMaXN0ZW5lcnMgKHtwcm9wczpuZXdOb2RlUHJvcHN9PXt9LCB7cHJvcHM6b2xkTm9kZVByb3BzfT17fSkge1xuICBjb25zdCBuZXdOb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMobmV3Tm9kZVByb3BzIHx8IHt9KTtcbiAgY29uc3Qgb2xkTm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG9sZE5vZGVQcm9wcyB8fCB7fSk7XG5cbiAgcmV0dXJuIG5ld05vZGVFdmVudHMubGVuZ3RoIHx8IG9sZE5vZGVFdmVudHMubGVuZ3RoID9cbiAgICBjb21wb3NlKFxuICAgICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMob2xkTm9kZUV2ZW50cyksXG4gICAgICBhZGRFdmVudExpc3RlbmVycyhuZXdOb2RlRXZlbnRzKVxuICAgICkgOiBub29wO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBdHRyaWJ1dGVzIChuZXdWTm9kZSwgb2xkVk5vZGUpIHtcbiAgY29uc3QgbmV3Vk5vZGVQcm9wcyA9IG5ld1ZOb2RlLnByb3BzIHx8IHt9O1xuICBjb25zdCBvbGRWTm9kZVByb3BzID0gb2xkVk5vZGUucHJvcHMgfHwge307XG5cbiAgaWYgKGlzU2hhbGxvd0VxdWFsKG5ld1ZOb2RlUHJvcHMsIG9sZFZOb2RlUHJvcHMpKSB7XG4gICAgcmV0dXJuIG5vb3A7XG4gIH1cblxuICBpZiAobmV3Vk5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgIHJldHVybiBzZXRUZXh0Tm9kZShuZXdWTm9kZS5wcm9wcy52YWx1ZSk7XG4gIH1cblxuICBjb25zdCBuZXdOb2RlS2V5cyA9IE9iamVjdC5rZXlzKG5ld1ZOb2RlUHJvcHMpO1xuICBjb25zdCBvbGROb2RlS2V5cyA9IE9iamVjdC5rZXlzKG9sZFZOb2RlUHJvcHMpO1xuICBjb25zdCBhdHRyaWJ1dGVzVG9SZW1vdmUgPSBvbGROb2RlS2V5cy5maWx0ZXIoayA9PiAhbmV3Tm9kZUtleXMuaW5jbHVkZXMoaykpO1xuXG4gIHJldHVybiBjb21wb3NlKFxuICAgIHJlbW92ZUF0dHJpYnV0ZXMoYXR0cmlidXRlc1RvUmVtb3ZlKSxcbiAgICBzZXRBdHRyaWJ1dGVzKG5ld05vZGVLZXlzLm1hcChwYWlyaWZ5KG5ld1ZOb2RlUHJvcHMpKSlcbiAgKTtcbn1cblxuY29uc3QgZG9tRmFjdG9yeSA9IGNyZWF0ZURvbU5vZGU7XG5cbi8vIGFwcGx5IHZub2RlIGRpZmZpbmcgdG8gYWN0dWFsIGRvbSBub2RlIChpZiBuZXcgbm9kZSA9PiBpdCB3aWxsIGJlIG1vdW50ZWQgaW50byB0aGUgcGFyZW50KVxuY29uc3QgZG9taWZ5ID0gZnVuY3Rpb24gdXBkYXRlRG9tIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpIHtcbiAgaWYgKCFvbGRWbm9kZSkgey8vdGhlcmUgaXMgbm8gcHJldmlvdXMgdm5vZGVcbiAgICBpZiAobmV3Vm5vZGUpIHsvL25ldyBub2RlID0+IHdlIGluc2VydFxuICAgICAgbmV3Vm5vZGUuZG9tID0gcGFyZW50RG9tTm9kZS5hcHBlbmRDaGlsZChkb21GYWN0b3J5KG5ld1Zub2RlKSk7XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSAxO1xuICAgICAgcmV0dXJuIHt2bm9kZTogbmV3Vm5vZGUsIGdhcmJhZ2U6IG51bGx9O1xuICAgIH0gZWxzZSB7Ly9lbHNlIChpcnJlbGV2YW50KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBvcGVyYXRpb24nKVxuICAgIH1cbiAgfSBlbHNlIHsvL3RoZXJlIGlzIGEgcHJldmlvdXMgdm5vZGVcbiAgICBpZiAoIW5ld1Zub2RlKSB7Ly93ZSBtdXN0IHJlbW92ZSB0aGUgcmVsYXRlZCBkb20gbm9kZVxuICAgICAgcGFyZW50RG9tTm9kZS5yZW1vdmVDaGlsZChvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuICh7Z2FyYmFnZTogb2xkVm5vZGUsIGRvbTogbnVsbH0pO1xuICAgIH0gZWxzZSBpZiAobmV3Vm5vZGUubm9kZVR5cGUgIT09IG9sZFZub2RlLm5vZGVUeXBlKSB7Ly9pdCBtdXN0IGJlIHJlcGxhY2VkXG4gICAgICBuZXdWbm9kZS5kb20gPSBkb21GYWN0b3J5KG5ld1Zub2RlKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICBwYXJlbnREb21Ob2RlLnJlcGxhY2VDaGlsZChuZXdWbm9kZS5kb20sIG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4ge2dhcmJhZ2U6IG9sZFZub2RlLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH0gZWxzZSB7Ly8gb25seSB1cGRhdGUgYXR0cmlidXRlc1xuICAgICAgbmV3Vm5vZGUuZG9tID0gb2xkVm5vZGUuZG9tO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gb2xkVm5vZGUubGlmZUN5Y2xlICsgMTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogbnVsbCwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogcmVuZGVyIGEgdmlydHVhbCBkb20gbm9kZSwgZGlmZmluZyBpdCB3aXRoIGl0cyBwcmV2aW91cyB2ZXJzaW9uLCBtb3VudGluZyBpdCBpbiBhIHBhcmVudCBkb20gbm9kZVxuICogQHBhcmFtIG9sZFZub2RlXG4gKiBAcGFyYW0gbmV3Vm5vZGVcbiAqIEBwYXJhbSBwYXJlbnREb21Ob2RlXG4gKiBAcGFyYW0gb25OZXh0VGljayBjb2xsZWN0IG9wZXJhdGlvbnMgdG8gYmUgcHJvY2Vzc2VkIG9uIG5leHQgdGlja1xuICogQHJldHVybnMge0FycmF5fVxuICovXG5leHBvcnQgY29uc3QgcmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyZXIgKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSwgb25OZXh0VGljayA9IFtdKSB7XG5cbiAgLy8xLiB0cmFuc2Zvcm0gdGhlIG5ldyB2bm9kZSB0byBhIHZub2RlIGNvbm5lY3RlZCB0byBhbiBhY3R1YWwgZG9tIGVsZW1lbnQgYmFzZWQgb24gdm5vZGUgdmVyc2lvbnMgZGlmZmluZ1xuICAvLyBpLiBub3RlIGF0IHRoaXMgc3RlcCBvY2N1ciBkb20gaW5zZXJ0aW9ucy9yZW1vdmFsc1xuICAvLyBpaS4gaXQgbWF5IGNvbGxlY3Qgc3ViIHRyZWUgdG8gYmUgZHJvcHBlZCAob3IgXCJ1bm1vdW50ZWRcIilcbiAgY29uc3Qge3Zub2RlLCBnYXJiYWdlfSA9IGRvbWlmeShvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuXG4gIGlmIChnYXJiYWdlICE9PSBudWxsKSB7XG4gICAgLy8gZGVmZXIgdW5tb3VudCBsaWZlY3ljbGUgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBmb3IgKGxldCBnIG9mIHRyYXZlcnNlKGdhcmJhZ2UpKSB7XG4gICAgICBpZiAoZy5vblVuTW91bnQpIHtcbiAgICAgICAgb25OZXh0VGljay5wdXNoKGcub25Vbk1vdW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvL05vcm1hbGlzYXRpb24gb2Ygb2xkIG5vZGUgKGluIGNhc2Ugb2YgYSByZXBsYWNlIHdlIHdpbGwgY29uc2lkZXIgb2xkIG5vZGUgYXMgZW1wdHkgbm9kZSAobm8gY2hpbGRyZW4sIG5vIHByb3BzKSlcbiAgY29uc3QgdGVtcE9sZE5vZGUgPSBnYXJiYWdlICE9PSBudWxsIHx8ICFvbGRWbm9kZSA/IHtsZW5ndGg6IDAsIGNoaWxkcmVuOiBbXSwgcHJvcHM6IHt9fSA6IG9sZFZub2RlO1xuXG4gIGlmICh2bm9kZSkge1xuXG4gICAgLy8yLiB1cGRhdGUgZG9tIGF0dHJpYnV0ZXMgYmFzZWQgb24gdm5vZGUgcHJvcCBkaWZmaW5nLlxuICAgIC8vc3luY1xuICAgIGlmICh2bm9kZS5vblVwZGF0ZSAmJiB2bm9kZS5saWZlQ3ljbGUgPiAxKSB7XG4gICAgICB2bm9kZS5vblVwZGF0ZSgpO1xuICAgIH1cblxuICAgIHVwZGF0ZUF0dHJpYnV0ZXModm5vZGUsIHRlbXBPbGROb2RlKSh2bm9kZS5kb20pO1xuXG4gICAgLy9mYXN0IHBhdGhcbiAgICBpZiAodm5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgICAgcmV0dXJuIG9uTmV4dFRpY2s7XG4gICAgfVxuXG4gICAgaWYgKHZub2RlLm9uTW91bnQgJiYgdm5vZGUubGlmZUN5Y2xlID09PSAxKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gdm5vZGUub25Nb3VudCgpKTtcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbkNvdW50ID0gTWF0aC5tYXgodGVtcE9sZE5vZGUuY2hpbGRyZW4ubGVuZ3RoLCB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpO1xuXG4gICAgLy9hc3luYyB3aWxsIGJlIGRlZmVycmVkIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgY29uc3Qgc2V0TGlzdGVuZXJzID0gdXBkYXRlRXZlbnRMaXN0ZW5lcnModm5vZGUsIHRlbXBPbGROb2RlKTtcbiAgICBpZiAoc2V0TGlzdGVuZXJzICE9PSBub29wKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gc2V0TGlzdGVuZXJzKHZub2RlLmRvbSkpO1xuICAgIH1cblxuICAgIC8vMyByZWN1cnNpdmVseSB0cmF2ZXJzZSBjaGlsZHJlbiB0byB1cGRhdGUgZG9tIGFuZCBjb2xsZWN0IGZ1bmN0aW9ucyB0byBwcm9jZXNzIG9uIG5leHQgdGlja1xuICAgIGlmIChjaGlsZHJlbkNvdW50ID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbkNvdW50OyBpKyspIHtcbiAgICAgICAgLy8gd2UgcGFzcyBvbk5leHRUaWNrIGFzIHJlZmVyZW5jZSAoaW1wcm92ZSBwZXJmOiBtZW1vcnkgKyBzcGVlZClcbiAgICAgICAgcmVuZGVyKHRlbXBPbGROb2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuZG9tLCBvbk5leHRUaWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb25OZXh0VGljaztcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBoeWRyYXRlICh2bm9kZSwgZG9tKSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgY29uc3QgaHlkcmF0ZWQgPSBPYmplY3QuYXNzaWduKHt9LCB2bm9kZSk7XG4gIGNvbnN0IGRvbUNoaWxkcmVuID0gQXJyYXkuZnJvbShkb20uY2hpbGROb2RlcykuZmlsdGVyKG4gPT4gbi5ub2RlVHlwZSAhPT0gMyB8fCBuLm5vZGVWYWx1ZS50cmltKCkgIT09ICcnKTtcbiAgaHlkcmF0ZWQuZG9tID0gZG9tO1xuICBoeWRyYXRlZC5jaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuLm1hcCgoY2hpbGQsIGkpID0+IGh5ZHJhdGUoY2hpbGQsIGRvbUNoaWxkcmVuW2ldKSk7XG4gIHJldHVybiBoeWRyYXRlZDtcbn1cblxuZXhwb3J0IGNvbnN0IG1vdW50ID0gY3VycnkoZnVuY3Rpb24gKGNvbXAsIGluaXRQcm9wLCByb290KSB7XG4gIGNvbnN0IHZub2RlID0gY29tcC5ub2RlVHlwZSAhPT0gdm9pZCAwID8gY29tcCA6IGNvbXAoaW5pdFByb3AgfHwge30pO1xuICBjb25zdCBvbGRWTm9kZSA9IHJvb3QuY2hpbGRyZW4ubGVuZ3RoID8gaHlkcmF0ZSh2bm9kZSwgcm9vdC5jaGlsZHJlblswXSkgOiBudWxsO1xuICBjb25zdCBiYXRjaCA9IHJlbmRlcihvbGRWTm9kZSwgdm5vZGUsIHJvb3QpO1xuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgZm9yIChsZXQgb3Agb2YgYmF0Y2gpIHtcbiAgICAgIG9wKCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHZub2RlO1xufSk7IiwiaW1wb3J0IHtyZW5kZXJ9IGZyb20gJy4vdHJlZSc7XG5pbXBvcnQge25leHRUaWNrfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgdHJpZ2dlciBhbiB1cGRhdGUgb2YgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBwYXNzZWQgc3RhdGVcbiAqIEBwYXJhbSBjb21wIHtGdW5jdGlvbn0gLSB0aGUgY29tcG9uZW50IHRvIHVwZGF0ZVxuICogQHBhcmFtIGluaXRpYWxWTm9kZSAtIHRoZSBpbml0aWFsIHZpcnR1YWwgZG9tIG5vZGUgcmVsYXRlZCB0byB0aGUgY29tcG9uZW50IChpZSBvbmNlIGl0IGhhcyBiZWVuIG1vdW50ZWQpXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gdGhlIHVwZGF0ZSBmdW5jdGlvblxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB1cGRhdGUgKGNvbXAsIGluaXRpYWxWTm9kZSkge1xuICBsZXQgb2xkTm9kZSA9IGluaXRpYWxWTm9kZTtcbiAgY29uc3QgdXBkYXRlRnVuYyA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IG1vdW50ID0gb2xkTm9kZS5kb20ucGFyZW50Tm9kZTtcbiAgICBjb25zdCBuZXdOb2RlID0gY29tcChPYmplY3QuYXNzaWduKHtjaGlsZHJlbjogb2xkTm9kZS5jaGlsZHJlbiB8fCBbXX0sIG9sZE5vZGUucHJvcHMsIHByb3BzKSwgLi4uYXJncyk7XG4gICAgY29uc3QgbmV4dEJhdGNoID0gcmVuZGVyKG9sZE5vZGUsIG5ld05vZGUsIG1vdW50KTtcblxuICAgIC8vIGRhbmdlciB6b25lICEhISFcbiAgICAvLyBjaGFuZ2UgYnkga2VlcGluZyB0aGUgc2FtZSByZWZlcmVuY2Ugc28gdGhlIGV2ZW50dWFsIHBhcmVudCBub2RlIGRvZXMgbm90IG5lZWQgdG8gYmUgXCJhd2FyZVwiIHRyZWUgbWF5IGhhdmUgY2hhbmdlZCBkb3duc3RyZWFtOiBvbGROb2RlIG1heSBiZSB0aGUgY2hpbGQgb2Ygc29tZW9uZSAuLi4od2VsbCB0aGF0IGlzIGEgdHJlZSBkYXRhIHN0cnVjdHVyZSBhZnRlciBhbGwgOlAgKVxuICAgIG9sZE5vZGUgPSBPYmplY3QuYXNzaWduKG9sZE5vZGUgfHwge30sIG5ld05vZGUpO1xuICAgIC8vIGVuZCBkYW5nZXIgem9uZVxuXG4gICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgZm9yIChsZXQgb3Agb2YgbmV4dEJhdGNoKSB7XG4gICAgICAgIG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGU7XG4gIH07XG4gIHJldHVybiB1cGRhdGVGdW5jO1xufSIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IGxpZmVDeWNsZUZhY3RvcnkgPSBtZXRob2QgPT4gY3VycnkoKGZuLCBjb21wKSA9PiAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgY29uc3QgbiA9IGNvbXAocHJvcHMsIC4uLmFyZ3MpO1xuICBuW21ldGhvZF0gPSAoKSA9PiBmbihuLCAuLi5hcmdzKTtcbiAgcmV0dXJuIG47XG59KTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgbW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uTW91bnQnKTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgdW5tb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvblVuTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvblVuTW91bnQnKTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiBiZWZvcmUgdGhlIGNvbXBvbmVudCBpcyB1cGRhdGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvblVwZGF0ZSA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVXBkYXRlJyk7IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnQsIG9uVXBkYXRlfSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgXCJzdGF0ZWZ1bCBjb21wb25lbnRcIjogaWUgaXQgd2lsbCBoYXZlIGl0cyBvd24gc3RhdGUgYW5kIHRoZSBhYmlsaXR5IHRvIHVwZGF0ZSBpdHMgb3duIHRyZWVcbiAqIEBwYXJhbSBjb21wIHtGdW5jdGlvbn0gLSB0aGUgY29tcG9uZW50XG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gYSBuZXcgd3JhcHBlZCBjb21wb25lbnRcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGNvbXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBsZXQgdXBkYXRlRnVuYztcbiAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgLy9sYXp5IGV2YWx1YXRlIHVwZGF0ZUZ1bmMgKHRvIG1ha2Ugc3VyZSBpdCBpcyBkZWZpbmVkXG4gICAgICBjb25zdCBzZXRTdGF0ZSA9IChuZXdTdGF0ZSkgPT4gdXBkYXRlRnVuYyhuZXdTdGF0ZSk7XG4gICAgICByZXR1cm4gY29tcChwcm9wcywgc2V0U3RhdGUsIC4uLmFyZ3MpO1xuICAgIH07XG4gICAgY29uc3Qgc2V0VXBkYXRlRnVuY3Rpb24gPSAodm5vZGUpID0+IHtcbiAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUod3JhcHBlckNvbXAsIHZub2RlKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBvc2Uob25Nb3VudChzZXRVcGRhdGVGdW5jdGlvbiksIG9uVXBkYXRlKHNldFVwZGF0ZUZ1bmN0aW9uKSkod3JhcHBlckNvbXApO1xuICB9O1xufTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudH0gZnJvbSAnLi9saWZlQ3ljbGVzJztcbmltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuLyoqXG4gKiBDb21iaW5hdG9yIHRvIGNyZWF0ZSBhIEVsbSBsaWtlIGFwcFxuICogQHBhcmFtIHZpZXcge0Z1bmN0aW9ufSAtIGEgY29tcG9uZW50IHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50cyB0aGUgY3VycmVudCBtb2RlbCBhbmQgdGhlIGxpc3Qgb2YgdXBkYXRlc1xuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIGEgRWxtIGxpa2UgYXBwbGljYXRpb24gd2hvc2UgcHJvcGVydGllcyBcIm1vZGVsXCIsIFwidXBkYXRlc1wiIGFuZCBcInN1YnNjcmlwdGlvbnNcIiB3aWxsIGRlZmluZSB0aGUgcmVsYXRlZCBkb21haW4gc3BlY2lmaWMgb2JqZWN0c1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAodmlldykge1xuICByZXR1cm4gZnVuY3Rpb24gKHttb2RlbCwgdXBkYXRlcywgc3Vic2NyaXB0aW9ucyA9IFtdfT17fSkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGxldCBhY3Rpb25TdG9yZSA9IHt9O1xuICAgIGZvciAobGV0IHVwZGF0ZSBvZiBPYmplY3Qua2V5cyh1cGRhdGVzKSkge1xuICAgICAgYWN0aW9uU3RvcmVbdXBkYXRlXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIG1vZGVsID0gdXBkYXRlc1t1cGRhdGVdKG1vZGVsLCAuLi5hcmdzKTsgLy90b2RvIGNvbnNpZGVyIHNpZGUgZWZmZWN0cywgbWlkZGxld2FyZXMsIGV0Y1xuICAgICAgICByZXR1cm4gdXBkYXRlRnVuYyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbXAgPSAoKSA9PiB2aWV3KG1vZGVsLCBhY3Rpb25TdG9yZSk7XG5cbiAgICBjb25zdCBpbml0QWN0aW9uU3RvcmUgPSAodm5vZGUpID0+IHtcbiAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUoY29tcCwgdm5vZGUpO1xuICAgIH07XG4gICAgY29uc3QgaW5pdFN1YnNjcmlwdGlvbiA9IHN1YnNjcmlwdGlvbnMubWFwKHN1YiA9PiB2bm9kZSA9PiBzdWIodm5vZGUsIGFjdGlvblN0b3JlKSk7XG4gICAgY29uc3QgaW5pdEZ1bmMgPSBjb21wb3NlKGluaXRBY3Rpb25TdG9yZSwgLi4uaW5pdFN1YnNjcmlwdGlvbik7XG5cbiAgICByZXR1cm4gb25Nb3VudChpbml0RnVuYywgY29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7b25Nb3VudCwgb25Vbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnXG5pbXBvcnQge2lzRGVlcEVxdWFsLCBpZGVudGl0eX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb25uZWN0IGNvbWJpbmF0b3I6IHdpbGwgY3JlYXRlIFwiY29udGFpbmVyXCIgY29tcG9uZW50IHdoaWNoIHdpbGwgc3Vic2NyaWJlIHRvIGEgUmVkdXggbGlrZSBzdG9yZS4gYW5kIHVwZGF0ZSBpdHMgY2hpbGRyZW4gd2hlbmV2ZXIgYSBzcGVjaWZpYyBzbGljZSBvZiBzdGF0ZSBjaGFuZ2UgdW5kZXIgc3BlY2lmaWMgY2lyY3Vtc3RhbmNlc1xuICogQHBhcmFtIHN0b3JlIHtPYmplY3R9IC0gVGhlIHN0b3JlIChpbXBsZW1lbnRpbmcgdGhlIHNhbWUgYXBpIHRoYW4gUmVkdXggc3RvcmVcbiAqIEBwYXJhbSBhY3Rpb25zIHtPYmplY3R9IFt7fV0gLSBUaGUgbGlzdCBvZiBhY3Rpb25zIHRoZSBjb25uZWN0ZWQgY29tcG9uZW50IHdpbGwgYmUgYWJsZSB0byB0cmlnZ2VyXG4gKiBAcGFyYW0gc2xpY2VTdGF0ZSB7RnVuY3Rpb259IFtzdGF0ZSA9PiBzdGF0ZV0gLSBBIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50IHRoZSBzdGF0ZSBhbmQgcmV0dXJuIGEgXCJ0cmFuc2Zvcm1lZFwiIHN0YXRlIChsaWtlIHBhcnRpYWwsIGV0YykgcmVsZXZhbnQgdG8gdGhlIGNvbnRhaW5lclxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIEEgY29udGFpbmVyIGZhY3Rvcnkgd2l0aCB0aGUgZm9sbG93aW5nIGFyZ3VtZW50czpcbiAqICAtIGNvbXA6IHRoZSBjb21wb25lbnQgdG8gd3JhcCBub3RlIHRoZSBhY3Rpb25zIG9iamVjdCB3aWxsIGJlIHBhc3NlZCBhcyBzZWNvbmQgYXJndW1lbnQgb2YgdGhlIGNvbXBvbmVudCBmb3IgY29udmVuaWVuY2VcbiAqICAtIG1hcFN0YXRlVG9Qcm9wOiBhIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50IHdoYXQgdGhlIFwic2xpY2VTdGF0ZVwiIGZ1bmN0aW9uIHJldHVybnMgYW5kIHJldHVybnMgYW4gb2JqZWN0IHRvIGJlIGJsZW5kZWQgaW50byB0aGUgcHJvcGVydGllcyBvZiB0aGUgY29tcG9uZW50IChkZWZhdWx0IHRvIGlkZW50aXR5IGZ1bmN0aW9uKVxuICogIC0gc2hvdWxkVXBkYXRlOiBhIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50cyB0aGUgcHJldmlvdXMgYW5kIHRoZSBjdXJyZW50IHZlcnNpb25zIG9mIHdoYXQgXCJzbGljZVN0YXRlXCIgZnVuY3Rpb24gcmV0dXJucyB0byByZXR1cm5zIGEgYm9vbGVhbiBkZWZpbmluZyB3aGV0aGVyIHRoZSBjb21wb25lbnQgc2hvdWxkIGJlIHVwZGF0ZWQgKGRlZmF1bHQgdG8gYSBkZWVwRXF1YWwgY2hlY2spXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChzdG9yZSwgYWN0aW9ucyA9IHt9LCBzbGljZVN0YXRlID0gaWRlbnRpdHkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChjb21wLCBtYXBTdGF0ZVRvUHJvcCA9IGlkZW50aXR5LCBzaG91bGRVcGF0ZSA9IChhLCBiKSA9PiBpc0RlZXBFcXVhbChhLCBiKSA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGluaXRQcm9wKSB7XG4gICAgICBsZXQgY29tcG9uZW50UHJvcHMgPSBpbml0UHJvcDtcbiAgICAgIGxldCB1cGRhdGVGdW5jLCBwcmV2aW91c1N0YXRlU2xpY2UsIHVuc3Vic2NyaWJlcjtcblxuICAgICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgcmV0dXJuIGNvbXAocHJvcHMsIGFjdGlvbnMsIC4uLmFyZ3MpO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgc3Vic2NyaWJlID0gb25Nb3VudCgodm5vZGUpID0+IHtcbiAgICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgICAgICB1bnN1YnNjcmliZXIgPSBzdG9yZS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHN0YXRlU2xpY2UgPSBzbGljZVN0YXRlKHN0b3JlLmdldFN0YXRlKCkpO1xuICAgICAgICAgIGlmIChzaG91bGRVcGF0ZShwcmV2aW91c1N0YXRlU2xpY2UsIHN0YXRlU2xpY2UpID09PSB0cnVlKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNvbXBvbmVudFByb3BzLCBtYXBTdGF0ZVRvUHJvcChzdGF0ZVNsaWNlKSk7XG4gICAgICAgICAgICB1cGRhdGVGdW5jKGNvbXBvbmVudFByb3BzKTtcbiAgICAgICAgICAgIHByZXZpb3VzU3RhdGVTbGljZSA9IHN0YXRlU2xpY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB1bnN1YnNjcmliZSA9IG9uVW5Nb3VudCgoKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlcigpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBjb21wb3NlKHN1YnNjcmliZSwgdW5zdWJzY3JpYmUpKHdyYXBwZXJDb21wKTtcbiAgICB9O1xuICB9O1xufTsiLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7aH0gZnJvbSAnLi4vaW5kZXgnO1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ2NyZWF0ZSByZWd1bGFyIGh0bWwgbm9kZScsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCB2bm9kZSA9IGgoJ2RpdicsIHtpZDogJ3NvbWVJZCcsIFwiY2xhc3NcIjogJ3NwZWNpYWwnfSk7XG4gICAgdC5kZWVwRXF1YWwodm5vZGUsIHtsaWZlQ3ljbGU6IDAsIG5vZGVUeXBlOiAnZGl2JywgcHJvcHM6IHtpZDogJ3NvbWVJZCcsIFwiY2xhc3NcIjogJ3NwZWNpYWwnfSwgY2hpbGRyZW46IFtdfSk7XG4gIH0pXG4gIC50ZXN0KCdjcmVhdGUgcmVndWxhciBodG1sIG5vZGUgd2l0aCB0ZXh0IG5vZGUgY2hpbGRyZW4nLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3Qgdm5vZGUgPSBoKCdkaXYnLCB7aWQ6ICdzb21lSWQnLCBcImNsYXNzXCI6ICdzcGVjaWFsJ30sICdmb28nKTtcbiAgICB0LmRlZXBFcXVhbCh2bm9kZSwge1xuICAgICAgbm9kZVR5cGU6ICdkaXYnLCBsaWZlQ3ljbGU6IDAsIHByb3BzOiB7aWQ6ICdzb21lSWQnLCBcImNsYXNzXCI6ICdzcGVjaWFsJ30sIGNoaWxkcmVuOiBbe1xuICAgICAgICBub2RlVHlwZTogJ1RleHQnLFxuICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgIHByb3BzOiB7dmFsdWU6ICdmb28nfSxcbiAgICAgICAgbGlmZUN5Y2xlOiAwXG4gICAgICB9XVxuICAgIH0pO1xuICB9KVxuICAudGVzdCgnY3JlYXRlIHJlZ3VsYXIgaHRtbCB3aXRoIGNoaWxkcmVuJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IHZub2RlID0gaCgndWwnLCB7aWQ6ICdjb2xsZWN0aW9uJ30sIGgoJ2xpJywge2lkOiAxfSwgJ2l0ZW0xJyksIGgoJ2xpJywge2lkOiAyfSwgJ2l0ZW0yJykpO1xuICAgIHQuZGVlcEVxdWFsKHZub2RlLCB7XG4gICAgICBub2RlVHlwZTogJ3VsJyxcbiAgICAgIHByb3BzOiB7aWQ6ICdjb2xsZWN0aW9uJ30sXG4gICAgICBsaWZlQ3ljbGU6IDAsXG4gICAgICBjaGlsZHJlbjogW1xuICAgICAgICB7XG4gICAgICAgICAgbm9kZVR5cGU6ICdsaScsXG4gICAgICAgICAgcHJvcHM6IHtpZDogMX0sXG4gICAgICAgICAgbGlmZUN5Y2xlOiAwLFxuICAgICAgICAgIGNoaWxkcmVuOiBbe1xuICAgICAgICAgICAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgICAgICAgICAgIHByb3BzOiB7dmFsdWU6ICdpdGVtMSd9LFxuICAgICAgICAgICAgY2hpbGRyZW46IFtdLFxuICAgICAgICAgICAgbGlmZUN5Y2xlOiAwXG4gICAgICAgICAgfV1cbiAgICAgICAgfSwge1xuICAgICAgICAgIG5vZGVUeXBlOiAnbGknLFxuICAgICAgICAgIHByb3BzOiB7aWQ6IDJ9LFxuICAgICAgICAgIGxpZmVDeWNsZTogMCxcbiAgICAgICAgICBjaGlsZHJlbjogW3tcbiAgICAgICAgICAgIG5vZGVUeXBlOiAnVGV4dCcsXG4gICAgICAgICAgICBwcm9wczoge3ZhbHVlOiAnaXRlbTInfSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXSxcbiAgICAgICAgICAgIGxpZmVDeWNsZTogMFxuICAgICAgICAgIH1dXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfSlcbiAgLnRlc3QoJ3VzZSBmdW5jdGlvbiBhcyBjb21wb25lbnQgcGFzc2luZyB0aGUgY2hpbGRyZW4gYXMgcHJvcCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBmb28gPSAocHJvcHMpID0+IGgoJ3AnLCBwcm9wcyk7XG4gICAgY29uc3Qgdm5vZGUgPSBoKGZvbywge2lkOiAxfSwgJ2hlbGxvIHdvcmxkJyk7XG4gICAgdC5kZWVwRXF1YWwodm5vZGUsIHtcbiAgICAgIG5vZGVUeXBlOiAncCcsXG4gICAgICBsaWZlQ3ljbGU6IDAsXG4gICAgICBwcm9wczoge1xuICAgICAgICBjaGlsZHJlbjogW3tcbiAgICAgICAgICBub2RlVHlwZTogJ1RleHQnLFxuICAgICAgICAgIGxpZmVDeWNsZTogMCxcbiAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgcHJvcHM6IHt2YWx1ZTogJ2hlbGxvIHdvcmxkJ31cbiAgICAgICAgfV0sXG4gICAgICAgIGlkOiAxXG4gICAgICB9LFxuICAgICAgY2hpbGRyZW46IFtdXG4gICAgfSk7XG4gIH0pXG4gIC50ZXN0KCd1c2UgbmVzdGVkIGNvbWJpbmF0b3IgdG8gY3JlYXRlIHZub2RlJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGNvbWJpbmF0b3IgPSAoKSA9PiAoKSA9PiAoKSA9PiAoKSA9PiAocHJvcHMpID0+IGgoJ3AnLCB7aWQ6ICdmb28nfSk7XG4gICAgY29uc3Qgdm5vZGUgPSBoKGNvbWJpbmF0b3IsIHt9KTtcbiAgICB0LmRlZXBFcXVhbCh2bm9kZSwge25vZGVUeXBlOiAncCcsIGxpZmVDeWNsZTogMCwgcHJvcHM6IHtpZDogJ2Zvbyd9LCBjaGlsZHJlbjogW119KTtcbiAgfSlcblxuIiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQgdXRpbCBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IGRvbVV0aWwgZnJvbSAnLi9kb21VdGlsJztcbmltcG9ydCBoIGZyb20gJy4vaCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCh1dGlsKVxuICAudGVzdChkb21VdGlsKVxuICAudGVzdChoKTtcbiIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHttb3VudCwgaH0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuXG5leHBvcnQgZGVmYXVsdCB6b3JhKClcbiAgLnRlc3QoJ21vdW50IGEgc2ltcGxlIGNvbXBvbmVudCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb25zdCBDb21wID0gKHByb3BzKSA9PiAoPGgxPjxzcGFuIGlkPXtwcm9wcy5pZH0+e3Byb3BzLmdyZWV0aW5nfTwvc3Bhbj48L2gxPik7XG4gICAgbW91bnQoQ29tcCwge2lkOiAxMjMsIGdyZWV0aW5nOiAnaGVsbG8gd29ybGQnfSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8aDE+PHNwYW4gaWQ9XCIxMjNcIj5oZWxsbyB3b3JsZDwvc3Bhbj48L2gxPicpO1xuICB9KVxuICAudGVzdCgnbW91bnQgY29tcG9zZWQgY29tcG9uZW50JywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IENvbXAgPSAocHJvcHMpID0+ICg8aDE+PHNwYW4gaWQ9e3Byb3BzLmlkfT57cHJvcHMuZ3JlZXRpbmd9PC9zcGFuPjwvaDE+KTtcbiAgICBjb25zdCBDb250YWluZXIgPSAocHJvcHMpID0+ICg8c2VjdGlvbj5cbiAgICAgIDxDb21wIGlkPVwiNTY3XCIgZ3JlZXRpbmc9XCJoZWxsbyB5b3VcIi8+XG4gICAgPC9zZWN0aW9uPik7XG4gICAgbW91bnQoQ29udGFpbmVyLCB7fSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8c2VjdGlvbj48aDE+PHNwYW4gaWQ9XCI1NjdcIj5oZWxsbyB5b3U8L3NwYW4+PC9oMT48L3NlY3Rpb24+Jyk7XG4gIH0pXG4gIC50ZXN0KCdtb3VudCBhIGNvbXBvbmVudCB3aXRoIGlubmVyIGNoaWxkJywgZnVuY3Rpb24gKiAodCkge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IENvbXAgPSAocHJvcHMpID0+ICg8aDE+PHNwYW4gaWQ9e3Byb3BzLmlkfT57cHJvcHMuZ3JlZXRpbmd9PC9zcGFuPjwvaDE+KTtcbiAgICBjb25zdCBDb250YWluZXIgPSAocHJvcHMpID0+ICg8c2VjdGlvbj57cHJvcHMuY2hpbGRyZW59PC9zZWN0aW9uPik7XG4gICAgbW91bnQoKCkgPT4gPENvbnRhaW5lcj48Q29tcCBpZD1cIjU2N1wiIGdyZWV0aW5nPVwiaGVsbG8gd29ybGRcIi8+PC9Db250YWluZXI+LCB7fSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8c2VjdGlvbj48aDE+PHNwYW4gaWQ9XCI1NjdcIj5oZWxsbyB3b3JsZDwvc3Bhbj48L2gxPjwvc2VjdGlvbj4nKTtcbiAgfSlcbiIsImltcG9ydCB6b3JhIGZyb20gJ3pvcmEnO1xuaW1wb3J0IHt1cGRhdGUsIG1vdW50LCBofSBmcm9tICcuLi8uLi9pbmRleCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnZ2l2ZSBhYmlsaXR5IHRvIHVwZGF0ZSBhIG5vZGUgKGFuZCBpdHMgZGVzY2VuZGFudCknLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgY29tcCA9ICgoe2lkLCBjb250ZW50fSkgPT4gKDxwIGlkPXtpZH0+e2NvbnRlbnR9PC9wPikpO1xuICAgIGNvbnN0IGluaXRpYWxWbm9kZSA9IG1vdW50KGNvbXAsIHtpZDogMTIzLCBjb250ZW50OiAnaGVsbG8gd29ybGQnfSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8cCBpZD1cIjEyM1wiPmhlbGxvIHdvcmxkPC9wPicpO1xuICAgIGNvbnN0IHVwZGF0ZUZ1bmMgPSB1cGRhdGUoY29tcCwgaW5pdGlhbFZub2RlKTtcbiAgICB1cGRhdGVGdW5jKHtpZDogNTY3LCBjb250ZW50OiAnYm9uam91ciBtb25kZSd9KTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8cCBpZD1cIjU2N1wiPmJvbmpvdXIgbW9uZGU8L3A+Jyk7XG4gIH0pO1xuIiwiZXhwb3J0IGZ1bmN0aW9uIHdhaXROZXh0VGljayAoKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0sIDIpXG4gIH0pXG59IiwiaW1wb3J0IHpvcmEgZnJvbSAnem9yYSc7XG5pbXBvcnQge29uTW91bnQsIG9uVW5Nb3VudCwgaCwgbW91bnQsIHJlbmRlcn0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHt3YWl0TmV4dFRpY2t9IGZyb20gJy4vdXRpbCdcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KCdzaG91bGQgcnVuIGEgZnVuY3Rpb24gd2hlbiBjb21wb25lbnQgaXMgbW91bnRlZCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgY291bnRlciA9IDA7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgY29tcCA9ICgpID0+IDxwPmhlbGxvIHdvcmxkPC9wPjtcbiAgICBjb25zdCB3aXRoTW91bnQgPSBvbk1vdW50KCgpID0+IHtcbiAgICAgIGNvdW50ZXIrK1xuICAgIH0sIGNvbXApO1xuICAgIG1vdW50KHdpdGhNb3VudCwge30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb3VudGVyLCAwKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICB0LmVxdWFsKGNvdW50ZXIsIDEpO1xuICB9KVxuICAudGVzdCgnc2hvdWxkIHJ1biBhIGZ1bmN0aW9uIHdoZW4gY29tcG9uZW50IGlzIHVuTW91bnRlZCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgdW5tb3VudGVkID0gbnVsbDtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb25zdCBJdGVtID0gb25Vbk1vdW50KChuKSA9PiB7XG4gICAgICB1bm1vdW50ZWQgPSBuO1xuICAgIH0sICh7aWR9KSA9PiA8bGkgaWQ9e2lkfT5oZWxsbyB3b3JsZDwvbGk+KTtcbiAgICBjb25zdCBjb250YWluZXJDb21wID0gKCh7aXRlbXN9KSA9PiAoPHVsPlxuICAgICAge1xuICAgICAgICBpdGVtcy5tYXAoaXRlbSA9PiA8SXRlbSB7Li4uaXRlbX0vPilcbiAgICAgIH1cbiAgICA8L3VsPikpO1xuXG4gICAgY29uc3Qgdm5vZGUgPSBtb3VudChjb250YWluZXJDb21wLCB7aXRlbXM6IFt7aWQ6IDF9LCB7aWQ6IDJ9LCB7aWQ6IDN9XX0sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPHVsPjxsaSBpZD1cIjFcIj5oZWxsbyB3b3JsZDwvbGk+PGxpIGlkPVwiMlwiPmhlbGxvIHdvcmxkPC9saT48bGkgaWQ9XCIzXCI+aGVsbG8gd29ybGQ8L2xpPjwvdWw+Jyk7XG4gICAgY29uc3QgYmF0Y2ggPSByZW5kZXIodm5vZGUsIGNvbnRhaW5lckNvbXAoe2l0ZW1zOiBbe2lkOiAxfSwge2lkOiAzfV19KSwgY29udGFpbmVyKTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8dWw+PGxpIGlkPVwiMVwiPmhlbGxvIHdvcmxkPC9saT48bGkgaWQ9XCIzXCI+aGVsbG8gd29ybGQ8L2xpPjwvdWw+Jyk7XG4gICAgZm9yIChsZXQgZiBvZiBiYXRjaCl7XG4gICAgICBmKCk7XG4gICAgfVxuICAgIHQubm90RXF1YWwodW5tb3VudGVkLCBudWxsKTtcbiAgfSkiLCJpbXBvcnQgem9yYSBmcm9tICd6b3JhJztcbmltcG9ydCB7aCwgd2l0aFN0YXRlLCBtb3VudH0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHt3YWl0TmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBkZWZhdWx0IHpvcmEoKVxuICAudGVzdCgnYmluZCBhbiB1cGRhdGUgZnVuY3Rpb24gdG8gYSBjb21wb25lbnQnLCBmdW5jdGlvbiAqICh0KSB7XG4gICAgbGV0IHVwZGF0ZSA9IG51bGw7XG4gICAgY29uc3QgQ29tcCA9IHdpdGhTdGF0ZSgoe2Zvb30sIHNldFN0YXRlKSA9PiB7XG4gICAgICBpZiAoIXVwZGF0ZSkge1xuICAgICAgICB1cGRhdGUgPSBzZXRTdGF0ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiA8cD57Zm9vfTwvcD47XG4gICAgfSk7XG4gICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbW91bnQoKHtmb299KSA9PiA8Q29tcCBmb289e2Zvb30vPiwge2ZvbzogJ2Jhcid9LCBjb250YWluZXIpO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxwPmJhcjwvcD4nKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICB1cGRhdGUoe2ZvbzogJ2Jpcyd9KTtcbiAgICB0LmVxdWFsKGNvbnRhaW5lci5pbm5lckhUTUwsICc8cD5iaXM8L3A+Jyk7XG4gIH0pXG4gIC50ZXN0KCdzaG91bGQgY3JlYXRlIGlzb2xhdGVkIHN0YXRlIGZvciBlYWNoIGNvbXBvbmVudCcsIGZ1bmN0aW9uICogKHQpIHtcbiAgICBsZXQgdXBkYXRlMSA9IG51bGw7XG4gICAgbGV0IHVwZGF0ZTIgPSBudWxsO1xuICAgIGNvbnN0IENvbXAgPSB3aXRoU3RhdGUoKHtmb299LCBzZXRTdGF0ZSkgPT4ge1xuICAgICAgaWYgKCF1cGRhdGUxKSB7XG4gICAgICAgIHVwZGF0ZTEgPSBzZXRTdGF0ZTtcbiAgICAgIH0gZWxzZSBpZiAoIXVwZGF0ZTIpIHtcbiAgICAgICAgdXBkYXRlMiA9IHNldFN0YXRlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gPHA+e2Zvb308L3A+O1xuICAgIH0pO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG1vdW50KCh7Zm9vMSwgZm9vMn0pID0+IDxkaXY+PENvbXAgZm9vPXtmb28xfS8+PENvbXAgZm9vPXtmb28yfS8+PC9kaXY+LCB7Zm9vMTogJ2JhcicsIGZvbzI6ICdiYXIyJ30sIGNvbnRhaW5lcik7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPGRpdj48cD5iYXI8L3A+PHA+YmFyMjwvcD48L2Rpdj4nKTtcbiAgICB5aWVsZCB3YWl0TmV4dFRpY2soKTtcbiAgICB1cGRhdGUxKHtmb286ICdiaXMnfSk7XG4gICAgdC5lcXVhbChjb250YWluZXIuaW5uZXJIVE1MLCAnPGRpdj48cD5iaXM8L3A+PHA+YmFyMjwvcD48L2Rpdj4nKTtcbiAgICB1cGRhdGUyKHtmb286ICdibGFoJ30pO1xuICAgIHQuZXF1YWwoY29udGFpbmVyLmlubmVySFRNTCwgJzxkaXY+PHA+YmlzPC9wPjxwPmJsYWg8L3A+PC9kaXY+Jyk7XG4gIH0pIiwiaW1wb3J0IGluZGV4IGZyb20gJy4uL2luZGV4JztcbmltcG9ydCByZW5kZXIgZnJvbSAnLi9yZW5kZXInO1xuaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQgbGlmZWN5Y2xlcyBmcm9tICcuL2xpZmVjeWNsZXMnO1xuaW1wb3J0IHdpdGhTdGF0ZSBmcm9tICcuL3dpdGhTdGF0ZSc7XG5pbXBvcnQgem9yYSBmcm9tICd6b3JhJztcblxuZXhwb3J0IGRlZmF1bHQgem9yYSgpXG4gIC50ZXN0KGluZGV4KVxuICAudGVzdChyZW5kZXIpXG4gIC50ZXN0KHVwZGF0ZSlcbiAgLnRlc3QobGlmZWN5Y2xlcylcbiAgLnRlc3Qod2l0aFN0YXRlKVxuICAucnVuKCk7XG5cbiJdLCJuYW1lcyI6WyJpbmRleCIsImluZGV4JDEiLCJwbGFuIiwiem9yYSIsInRhcCIsImgiLCJtb3VudCIsInVwZGF0ZSIsInJlbmRlciIsIndpdGhTdGF0ZSJdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7QUFJQSxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQzs7Ozs7O0FBTWxDLElBQUlBLE9BQUssR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7Ozs7Ozs7Ozs7Ozs7O0FBY3ZDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsVUFBVSxFQUFFLEVBQUU7RUFDdEIsYUFBYSxDQUFDLHFCQUFxQixHQUFHLEVBQUUsQ0FBQztFQUN6QyxPQUFPLGFBQWEsQ0FBQztFQUNyQixTQUFTLGFBQWEsR0FBRztJQUN2QixPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxD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
