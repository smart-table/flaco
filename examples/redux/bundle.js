(function () {
'use strict';

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
function h (nodeType, props, ...children) {
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
    return typeof comp !== 'function' ? comp : h(comp, props, ...flatChildren); //functional comp vs combinator (HOC)
  }
}

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



function tap (fn) {
  return arg => {
    fn(arg);
    return arg;
  }
}

const nextTick = fn => setTimeout(fn, 0);

const pairify = holder => key => [key, holder[key]];

const isShallowEqual = (a, b) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k]);
};

const isDeepEqual = (a, b) => {
  const type = typeof a;
  if (type !== typeof b) {
    return false;
  }
  if (type === 'object') {
    if (Array.isArray(a)) {
      return a.length && b.length && a.every((item, i) => isDeepEqual(a[i], b[i]));
    } else {
      const aKeys = Object.keys(k => a.hasOwnProperty(k));
      const bKeys = Object.keys(k => b.hasOwnProperty(k));
      return aKeys.length === bKeys.length && aKeys.every(k => isDeepEqual(a[k], b[k]));
    }
  } else {
    return a === b;
  }
};

const identity = p => p;

const noop = () => {
};

const updateDomNodeFactory = (method) => (items) => tap(domNode => {
  for (let pair of items) {
    domNode[method](...pair);
  }
});

const removeEventListeners = updateDomNodeFactory('removeEventListener');
const addEventListeners = updateDomNodeFactory('addEventListener');
const setAttributes = (items) => tap((domNode) => {
  const attributes = items.filter(([key, value]) => typeof value !== 'function');
  for (let [key, value] of attributes) {
    value === false ? domNode.removeAttribute(key) : domNode.setAttribute(key, value);
  }
});
const removeAttributes = (items) => tap(domNode => {
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

const traverse = function * (vnode) {
  yield vnode;
  if (vnode.children && vnode.children.length) {
    for (let child of vnode.children) {
      yield * traverse(child);
    }
  }
};

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

  //1. transform the new vnode to a vnode connected to an actual dom element based on vnode versions diffing
  // i. note at this step occur dom insertions/removals
  // ii. it may collect sub tree to be dropped (or "unmounted")
  const {vnode, garbage} = domify(oldVnode, newVnode, parentDomNode);

  if (garbage !== null) {
    // defer un mount lifecycle as it is not "visual"
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

    // danger zone !!!!
    // change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream: oldNode may be the child of someone ...(well that is a tree data structure after all :P )
    oldNode = Object.assign(oldNode || {}, newNode);
    // end danger zone

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
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp
 * @returns {Function}
 */

//todo throw this in favor of connect only ?

/**
 * Combinator to create a Elm like app
 * @param view
 */



/*

connect(store, actions, watcher)




 */

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change
 */
var connect = curry(function (store, actions, sliceState = identity) {
  return function (comp, mapStateToProp = identity) {
    return function (initProp) {
      let updateFunc;
      let previousStateSlice;
      let componentProps = initProp;
      let unsubscriber;

      const wrapperComp = (props, ...args) => {
        return comp(props, actions, ...args);
      };

      const subscribe = onMount((vnode) => {
        updateFunc = update(wrapperComp, vnode);
        unsubscriber = store.subscribe(() => {
          const stateSlice = sliceState(store.getState());
          if (!isDeepEqual(stateSlice, previousStateSlice)) {
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
  }
}, 3);

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Built-in value references. */
var Symbol = root.Symbol;

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
var symToStringTag$1 = Symbol ? Symbol.toStringTag : undefined;

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
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

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

const reducer = (state = {}, action) => {
  const {firstCounter = 0, secondCounter = 0} = state;
  switch (action.type) {
    case 'INCREMENT_1':
      return Object.assign(state, {firstCounter: firstCounter + 1});
    case 'DECREMENT_1':
      return Object.assign(state, {firstCounter: firstCounter - 1});
    case 'INCREMENT_2':
      return Object.assign(state, {secondCounter: secondCounter + 1});
    case 'DECREMENT_2':
      return Object.assign(state, {secondCounter: secondCounter - 1});
    default:
      return state;
  }
};

const store = createStore(reducer);

const subscribeToFirstCounter = connect(store, {
  increment: () => store.dispatch({type: 'INCREMENT_1'}),
  decrement: () => store.dispatch({type: 'DECREMENT_1'})
}, state => state.firstCounter);
const subscribeToSecondCounter = connect(store, {
  increment: () => store.dispatch({type: 'INCREMENT_2'}),
  decrement: () => store.dispatch({type: 'DECREMENT_2'})
}, state => state.secondCounter);

const counter = ({count, label}, actions) => {

  const bingo = count % 2 === 0;

  return h( 'div', { bingo: bingo },
    h( 'span', null, "Count: ", count ),
    h( 'button', { onClick: actions.increment }, "increment ", label),
    h( 'button', { onClick: actions.decrement }, "decrement ", label)
  )
};

const JustReader = ({readVal}) => h( 'p', null, "I do read the count : ", readVal
);

const Counter1 = subscribeToFirstCounter(counter, state => ({count: state}));
const Counter2 = subscribeToSecondCounter(counter, state => ({count: state}));
const Reader1 = subscribeToFirstCounter(JustReader, state => ({readVal: state}));

const App = () => h( 'div', null,
  h( Counter1, { label: "Un: woot" }),
  h( Counter1, { label: "Another uno !!" }),
  h( Counter2, { label: "Dos: han" }),
  h( Reader1, null )
);

mount(App, {}, document.getElementById('main'));

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvaC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL3RyYXZlcnNlLmpzIiwiLi4vLi4vbGliL3RyZWUuanMiLCIuLi8uLi9saWIvdXBkYXRlLmpzIiwiLi4vLi4vbGliL2xpZmVDeWNsZXMuanMiLCIuLi8uLi9saWIvd2l0aFN0YXRlLmpzIiwiLi4vLi4vbGliL2VsbS5qcyIsIi4uLy4uL2xpYi9jb25uZWN0LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2xvZGFzaC1lcy9fZnJlZUdsb2JhbC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9sb2Rhc2gtZXMvX3Jvb3QuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvbG9kYXNoLWVzL19TeW1ib2wuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvbG9kYXNoLWVzL19nZXRSYXdUYWcuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvbG9kYXNoLWVzL19vYmplY3RUb1N0cmluZy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9sb2Rhc2gtZXMvX2Jhc2VHZXRUYWcuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvbG9kYXNoLWVzL19vdmVyQXJnLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2xvZGFzaC1lcy9fZ2V0UHJvdG90eXBlLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2xvZGFzaC1lcy9pc09iamVjdExpa2UuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvbG9kYXNoLWVzL2lzUGxhaW5PYmplY3QuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc3ltYm9sLW9ic2VydmFibGUvZXMvcG9ueWZpbGwuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc3ltYm9sLW9ic2VydmFibGUvZXMvaW5kZXguanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvcmVkdXgvZXMvY3JlYXRlU3RvcmUuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvcmVkdXgvZXMvdXRpbHMvd2FybmluZy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9yZWR1eC9lcy9jb21wb3NlLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3JlZHV4L2VzL2luZGV4LmpzIiwiaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9XG59KTtcblxuLyoqXG4gKiBUcmFuc2Zvcm0gaHlwZXJzY3JpcHQgaW50byB2aXJ0dWFsIGRvbSBub2RlXG4gKiBAcGFyYW0gbm9kZVR5cGVcbiAqIEBwYXJhbSBwcm9wc1xuICogQHBhcmFtIGNoaWxkcmVuXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaCAobm9kZVR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICBjb25zdCBmbGF0Q2hpbGRyZW4gPSBjaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gQXJyYXkuaXNBcnJheShjaGlsZCkgPyBjaGlsZCA6IFtjaGlsZF07XG4gICAgcmV0dXJuIGFjYy5jb25jYXQoY2hpbGRyZW5BcnJheSk7XG4gIH0sIFtdKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gbm9ybWFsaXplIHRleHQgbm9kZSB0byBoYXZlIHNhbWUgc3RydWN0dXJlIHRoYW4gcmVndWxhciBkb20gbm9kZXNcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgY2hpbGQ7XG4gICAgICByZXR1cm4gdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkIDogY3JlYXRlVGV4dFZOb2RlKGNoaWxkKTtcbiAgICB9KTtcblxuICBpZiAodHlwZW9mIG5vZGVUeXBlICE9PSAnZnVuY3Rpb24nKSB7Ly9yZWd1bGFyIGh0bWwvdGV4dCBub2RlXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGVUeXBlLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgY2hpbGRyZW46IGZsYXRDaGlsZHJlblxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZnVsbFByb3BzID0gT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IGZsYXRDaGlsZHJlbn0sIHByb3BzKTtcbiAgICBjb25zdCBjb21wID0gbm9kZVR5cGUoZnVsbFByb3BzKTtcbiAgICByZXR1cm4gdHlwZW9mIGNvbXAgIT09ICdmdW5jdGlvbicgPyBjb21wIDogaChjb21wLCBwcm9wcywgLi4uZmxhdENoaWxkcmVuKTsgLy9mdW5jdGlvbmFsIGNvbXAgdnMgY29tYmluYXRvciAoSE9DKVxuICB9XG59OyIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBjb25zdCBuZXh0VGljayA9IGZuID0+IHNldFRpbWVvdXQoZm4sIDApO1xuXG5leHBvcnQgY29uc3QgcGFpcmlmeSA9IGhvbGRlciA9PiBrZXkgPT4gW2tleSwgaG9sZGVyW2tleV1dO1xuXG5leHBvcnQgY29uc3QgaXNTaGFsbG93RXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCBhS2V5cyA9IE9iamVjdC5rZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IE9iamVjdC5rZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoKGspID0+IGFba10gPT09IGJba10pO1xufTtcblxuZXhwb3J0IGNvbnN0IGlzRGVlcEVxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgdHlwZSA9IHR5cGVvZiBhO1xuICBpZiAodHlwZSAhPT0gdHlwZW9mIGIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYSkpIHtcbiAgICAgIHJldHVybiBhLmxlbmd0aCAmJiBiLmxlbmd0aCAmJiBhLmV2ZXJ5KChpdGVtLCBpKSA9PiBpc0RlZXBFcXVhbChhW2ldLCBiW2ldKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGFLZXlzID0gT2JqZWN0LmtleXMoayA9PiBhLmhhc093blByb3BlcnR5KGspKTtcbiAgICAgIGNvbnN0IGJLZXlzID0gT2JqZWN0LmtleXMoayA9PiBiLmhhc093blByb3BlcnR5KGspKTtcbiAgICAgIHJldHVybiBhS2V5cy5sZW5ndGggPT09IGJLZXlzLmxlbmd0aCAmJiBhS2V5cy5ldmVyeShrID0+IGlzRGVlcEVxdWFsKGFba10sIGJba10pKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGEgPT09IGI7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBpZGVudGl0eSA9IHAgPT4gcDtcblxuZXhwb3J0IGNvbnN0IG5vb3AgPSAoKSA9PiB7XG59O1xuIiwiaW1wb3J0IHt0YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IHVwZGF0ZURvbU5vZGVGYWN0b3J5ID0gKG1ldGhvZCkgPT4gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IHBhaXIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlW21ldGhvZF0oLi4ucGFpcik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgncmVtb3ZlRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IGFkZEV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ2FkZEV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBzZXRBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoKGRvbU5vZGUpID0+IHtcbiAgY29uc3QgYXR0cmlidXRlcyA9IGl0ZW1zLmZpbHRlcigoW2tleSwgdmFsdWVdKSA9PiB0eXBlb2YgdmFsdWUgIT09ICdmdW5jdGlvbicpO1xuICBmb3IgKGxldCBba2V5LCB2YWx1ZV0gb2YgYXR0cmlidXRlcykge1xuICAgIHZhbHVlID09PSBmYWxzZSA/IGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGtleSkgOiBkb21Ob2RlLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgfVxufSk7XG5leHBvcnQgY29uc3QgcmVtb3ZlQXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBhdHRyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3Qgc2V0VGV4dE5vZGUgPSB2YWwgPT4gbm9kZSA9PiBub2RlLnRleHRDb250ZW50ID0gdmFsO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlRG9tTm9kZSA9IHZub2RlID0+IHtcbiAgcmV0dXJuIHZub2RlLm5vZGVUeXBlICE9PSAnVGV4dCcgP1xuICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodm5vZGUubm9kZVR5cGUpIDpcbiAgICBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShTdHJpbmcodm5vZGUucHJvcHMudmFsdWUpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudExpc3RlbmVycyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gT2JqZWN0LmtleXMocHJvcHMpXG4gICAgLmZpbHRlcihrID0+IGsuc3Vic3RyKDAsIDIpID09PSAnb24nKVxuICAgIC5tYXAoayA9PiBbay5zdWJzdHIoMikudG9Mb3dlckNhc2UoKSwgcHJvcHNba11dKTtcbn07XG4iLCJleHBvcnQgY29uc3QgdHJhdmVyc2UgPSBmdW5jdGlvbiAqICh2bm9kZSkge1xuICB5aWVsZCB2bm9kZTtcbiAgaWYgKHZub2RlLmNoaWxkcmVuICYmIHZub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgIGZvciAobGV0IGNoaWxkIG9mIHZub2RlLmNoaWxkcmVuKSB7XG4gICAgICB5aWVsZCAqIHRyYXZlcnNlKGNoaWxkKTtcbiAgICB9XG4gIH1cbn07IiwiaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7XG4gIGlzU2hhbGxvd0VxdWFsLFxuICBwYWlyaWZ5LFxuICBuZXh0VGljayxcbiAgbm9vcFxufSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlQXR0cmlidXRlcyxcbiAgc2V0QXR0cmlidXRlcyxcbiAgc2V0VGV4dE5vZGUsXG4gIGNyZWF0ZURvbU5vZGUsXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxuICBhZGRFdmVudExpc3RlbmVycyxcbiAgZ2V0RXZlbnRMaXN0ZW5lcnMsXG59IGZyb20gJy4vZG9tVXRpbCc7XG5pbXBvcnQge3RyYXZlcnNlfSBmcm9tICcuL3RyYXZlcnNlJztcblxuZnVuY3Rpb24gdXBkYXRlRXZlbnRMaXN0ZW5lcnMgKHtwcm9wczpuZXdOb2RlUHJvcHN9PXt9LCB7cHJvcHM6b2xkTm9kZVByb3BzfT17fSkge1xuICBjb25zdCBuZXdOb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMobmV3Tm9kZVByb3BzIHx8IHt9KTtcbiAgY29uc3Qgb2xkTm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG9sZE5vZGVQcm9wcyB8fCB7fSk7XG5cbiAgcmV0dXJuIG5ld05vZGVFdmVudHMubGVuZ3RoIHx8IG9sZE5vZGVFdmVudHMubGVuZ3RoID9cbiAgICBjb21wb3NlKFxuICAgICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMob2xkTm9kZUV2ZW50cyksXG4gICAgICBhZGRFdmVudExpc3RlbmVycyhuZXdOb2RlRXZlbnRzKVxuICAgICkgOiBub29wO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBdHRyaWJ1dGVzIChuZXdWTm9kZSwgb2xkVk5vZGUpIHtcbiAgY29uc3QgbmV3Vk5vZGVQcm9wcyA9IG5ld1ZOb2RlLnByb3BzIHx8IHt9O1xuICBjb25zdCBvbGRWTm9kZVByb3BzID0gb2xkVk5vZGUucHJvcHMgfHwge307XG5cbiAgaWYgKGlzU2hhbGxvd0VxdWFsKG5ld1ZOb2RlUHJvcHMsIG9sZFZOb2RlUHJvcHMpKSB7XG4gICAgcmV0dXJuIG5vb3A7XG4gIH1cblxuICBpZiAobmV3Vk5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgIHJldHVybiBzZXRUZXh0Tm9kZShuZXdWTm9kZS5wcm9wcy52YWx1ZSk7XG4gIH1cblxuICBjb25zdCBuZXdOb2RlS2V5cyA9IE9iamVjdC5rZXlzKG5ld1ZOb2RlUHJvcHMpO1xuICBjb25zdCBvbGROb2RlS2V5cyA9IE9iamVjdC5rZXlzKG9sZFZOb2RlUHJvcHMpO1xuICBjb25zdCBhdHRyaWJ1dGVzVG9SZW1vdmUgPSBvbGROb2RlS2V5cy5maWx0ZXIoayA9PiAhbmV3Tm9kZUtleXMuaW5jbHVkZXMoaykpO1xuXG4gIHJldHVybiBjb21wb3NlKFxuICAgIHJlbW92ZUF0dHJpYnV0ZXMoYXR0cmlidXRlc1RvUmVtb3ZlKSxcbiAgICBzZXRBdHRyaWJ1dGVzKG5ld05vZGVLZXlzLm1hcChwYWlyaWZ5KG5ld1ZOb2RlUHJvcHMpKSlcbiAgKTtcbn1cblxuY29uc3QgZG9tRmFjdG9yeSA9IGNyZWF0ZURvbU5vZGU7XG5cbi8vIGFwcGx5IHZub2RlIGRpZmZpbmcgdG8gYWN0dWFsIGRvbSBub2RlIChpZiBuZXcgbm9kZSA9PiBpdCB3aWxsIGJlIG1vdW50ZWQgaW50byB0aGUgcGFyZW50KVxuY29uc3QgZG9taWZ5ID0gZnVuY3Rpb24gdXBkYXRlRG9tIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpIHtcbiAgaWYgKCFvbGRWbm9kZSkgey8vdGhlcmUgaXMgbm8gcHJldmlvdXMgdm5vZGVcbiAgICBpZiAobmV3Vm5vZGUpIHsvL25ldyBub2RlID0+IHdlIGluc2VydFxuICAgICAgbmV3Vm5vZGUuZG9tID0gcGFyZW50RG9tTm9kZS5hcHBlbmRDaGlsZChkb21GYWN0b3J5KG5ld1Zub2RlKSk7XG4gICAgICByZXR1cm4ge3Zub2RlOiBuZXdWbm9kZSwgZ2FyYmFnZTogbnVsbH07XG4gICAgfSBlbHNlIHsvL2Vsc2UgKGlycmVsZXZhbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpXG4gICAgfVxuICB9IGVsc2Ugey8vdGhlcmUgaXMgYSBwcmV2aW91cyB2bm9kZVxuICAgIGlmICghbmV3Vm5vZGUpIHsvL3dlIG11c3QgcmVtb3ZlIHRoZSByZWxhdGVkIGRvbSBub2RlXG4gICAgICBwYXJlbnREb21Ob2RlLnJlbW92ZUNoaWxkKG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4gKHtnYXJiYWdlOiBvbGRWbm9kZSwgZG9tOiBudWxsfSk7XG4gICAgfSBlbHNlIGlmIChuZXdWbm9kZS5ub2RlVHlwZSAhPT0gb2xkVm5vZGUubm9kZVR5cGUpIHsvL2l0IG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IGRvbUZhY3RvcnkobmV3Vm5vZGUpO1xuICAgICAgcGFyZW50RG9tTm9kZS5yZXBsYWNlQ2hpbGQobmV3Vm5vZGUuZG9tLCBvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBvbGRWbm9kZSwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9IGVsc2Ugey8vIG9ubHkgdXBkYXRlIGF0dHJpYnV0ZXNcbiAgICAgIG5ld1Zub2RlLmRvbSA9IG9sZFZub2RlLmRvbTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogbnVsbCwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogcmVuZGVyIGEgdmlydHVhbCBkb20gbm9kZSwgZGlmZmluZyBpdCB3aXRoIGl0cyBwcmV2aW91cyB2ZXJzaW9uLCBtb3VudGluZyBpdCBpbiBhIHBhcmVudCBkb20gbm9kZVxuICogQHBhcmFtIG9sZFZub2RlXG4gKiBAcGFyYW0gbmV3Vm5vZGVcbiAqIEBwYXJhbSBwYXJlbnREb21Ob2RlXG4gKiBAcGFyYW0gb25OZXh0VGljayBjb2xsZWN0IG9wZXJhdGlvbnMgdG8gYmUgcHJvY2Vzc2VkIG9uIG5leHQgdGlja1xuICogQHJldHVybnMge0FycmF5fVxuICovXG5leHBvcnQgY29uc3QgcmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyZXIgKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSwgb25OZXh0VGljayA9IFtdKSB7XG5cbiAgLy8xLiB0cmFuc2Zvcm0gdGhlIG5ldyB2bm9kZSB0byBhIHZub2RlIGNvbm5lY3RlZCB0byBhbiBhY3R1YWwgZG9tIGVsZW1lbnQgYmFzZWQgb24gdm5vZGUgdmVyc2lvbnMgZGlmZmluZ1xuICAvLyBpLiBub3RlIGF0IHRoaXMgc3RlcCBvY2N1ciBkb20gaW5zZXJ0aW9ucy9yZW1vdmFsc1xuICAvLyBpaS4gaXQgbWF5IGNvbGxlY3Qgc3ViIHRyZWUgdG8gYmUgZHJvcHBlZCAob3IgXCJ1bm1vdW50ZWRcIilcbiAgY29uc3Qge3Zub2RlLCBnYXJiYWdlfSA9IGRvbWlmeShvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuXG4gIGlmIChnYXJiYWdlICE9PSBudWxsKSB7XG4gICAgLy8gZGVmZXIgdW4gbW91bnQgbGlmZWN5Y2xlIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgZm9yIChsZXQgZyBvZiB0cmF2ZXJzZShnYXJiYWdlKSkge1xuICAgICAgaWYgKGcub25Vbk1vdW50KSB7XG4gICAgICAgIG9uTmV4dFRpY2sucHVzaChnLm9uVW5Nb3VudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy9Ob3JtYWxpc2F0aW9uIG9mIG9sZCBub2RlIChpbiBjYXNlIG9mIGEgcmVwbGFjZSB3ZSB3aWxsIGNvbnNpZGVyIG9sZCBub2RlIGFzIGVtcHR5IG5vZGUgKG5vIGNoaWxkcmVuLCBubyBwcm9wcykpXG4gIGNvbnN0IHRlbXBPbGROb2RlID0gZ2FyYmFnZSAhPT0gbnVsbCB8fCAhb2xkVm5vZGUgPyB7bGVuZ3RoOiAwLCBjaGlsZHJlbjogW10sIHByb3BzOiB7fX0gOiBvbGRWbm9kZTtcblxuICBpZiAodm5vZGUpIHtcblxuICAgIC8vMi4gdXBkYXRlIGRvbSBhdHRyaWJ1dGVzIGJhc2VkIG9uIHZub2RlIHByb3AgZGlmZmluZy5cbiAgICAvL3N5bmNcbiAgICB1cGRhdGVBdHRyaWJ1dGVzKHZub2RlLCB0ZW1wT2xkTm9kZSkodm5vZGUuZG9tKTtcblxuICAgIC8vZmFzdCBwYXRoXG4gICAgaWYgKHZub2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICAgIHJldHVybiBvbk5leHRUaWNrO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuQ291bnQgPSBNYXRoLm1heCh0ZW1wT2xkTm9kZS5jaGlsZHJlbi5sZW5ndGgsIHZub2RlLmNoaWxkcmVuLmxlbmd0aCk7XG5cbiAgICAvL3RvZG8gY2hlY2sgZm9yIGEgbGlmZWN5Y2xlIHRvIGF2b2lkIHRvIHJ1biBvbk1vdW50IHdoZW4gY29tcG9uZW50IGhhcyBiZWVuIG1vdW50ZWQgeWV0XG4gICAgaWYgKHZub2RlLm9uTW91bnQpIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiB2bm9kZS5vbk1vdW50KCkpO1xuICAgIH1cblxuICAgIC8vYXN5bmMgd2lsbCBiZSBkZWZlcnJlZCBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGNvbnN0IHNldExpc3RlbmVycyA9IHVwZGF0ZUV2ZW50TGlzdGVuZXJzKHZub2RlLCB0ZW1wT2xkTm9kZSk7XG4gICAgaWYgKHNldExpc3RlbmVycyAhPT0gbm9vcCkge1xuICAgICAgb25OZXh0VGljay5wdXNoKCgpID0+IHNldExpc3RlbmVycyh2bm9kZS5kb20pKTtcbiAgICB9XG5cbiAgICAvLzMgcmVjdXJzaXZlbHkgdHJhdmVyc2UgY2hpbGRyZW4gdG8gdXBkYXRlIGRvbSBhbmQgY29sbGVjdCBmdW5jdGlvbnMgdG8gcHJvY2VzcyBvbiBuZXh0IHRpY2tcbiAgICBpZiAoY2hpbGRyZW5Db3VudCA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Db3VudDsgaSsrKSB7XG4gICAgICAgIC8vIHdlIHBhc3Mgb25OZXh0VGljayBhcyByZWZlcmVuY2UgKGltcHJvdmUgcGVyZjogbWVtb3J5ICsgc3BlZWQpXG4gICAgICAgIHJlbmRlcih0ZW1wT2xkTm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmRvbSwgb25OZXh0VGljayk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9uTmV4dFRpY2s7XG59O1xuXG5leHBvcnQgY29uc3QgbW91bnQgPSBjdXJyeShmdW5jdGlvbiAoY29tcCwgaW5pdFByb3AsIHJvb3QpIHtcbiAgY29uc3Qgdm5vZGUgPSBjb21wKGluaXRQcm9wIHx8IHt9KTtcbiAgY29uc3QgYmF0Y2ggPSByZW5kZXIobnVsbCwgdm5vZGUsIHJvb3QpO1xuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgd2hpbGUgKGJhdGNoLmxlbmd0aCkge1xuICAgICAgY29uc3Qgb3AgPSBiYXRjaC5zaGlmdCgpO1xuICAgICAgb3AoKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdm5vZGU7XG59KTsiLCJpbXBvcnQge3JlbmRlcn0gZnJvbSAnLi90cmVlJztcbmltcG9ydCB7bmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ3JlYXRlIGEgZnVuY3Rpb24gd2hpY2ggd2lsbCB0cmlnZ2VyIGFuIHVwZGF0ZSBvZiB0aGUgY29tcG9uZW50IHdpdGggdGhlIHBhc3NlZCBzdGF0ZVxuICogQHBhcmFtIGNvbXBcbiAqIEBwYXJhbSBpbml0aWFsVk5vZGVcbiAqIEByZXR1cm5zIHtmdW5jdGlvbigqPSwgLi4uWypdKX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdXBkYXRlIChjb21wLCBpbml0aWFsVk5vZGUpIHtcbiAgbGV0IG9sZE5vZGUgPSBpbml0aWFsVk5vZGU7XG4gIGNvbnN0IHVwZGF0ZUZ1bmMgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBtb3VudCA9IG9sZE5vZGUuZG9tLnBhcmVudE5vZGU7XG4gICAgY29uc3QgbmV3Tm9kZSA9IGNvbXAoT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IG9sZE5vZGUuY2hpbGRyZW4gfHwgW119LCBvbGROb2RlLnByb3BzLCBwcm9wcyksIC4uLmFyZ3MpO1xuICAgIGNvbnN0IG5leHRCYXRjaCA9IHJlbmRlcihvbGROb2RlLCBuZXdOb2RlLCBtb3VudCk7XG5cbiAgICAvLyBkYW5nZXIgem9uZSAhISEhXG4gICAgLy8gY2hhbmdlIGJ5IGtlZXBpbmcgdGhlIHNhbWUgcmVmZXJlbmNlIHNvIHRoZSBldmVudHVhbCBwYXJlbnQgbm9kZSBkb2VzIG5vdCBuZWVkIHRvIGJlIFwiYXdhcmVcIiB0cmVlIG1heSBoYXZlIGNoYW5nZWQgZG93bnN0cmVhbTogb2xkTm9kZSBtYXkgYmUgdGhlIGNoaWxkIG9mIHNvbWVvbmUgLi4uKHdlbGwgdGhhdCBpcyBhIHRyZWUgZGF0YSBzdHJ1Y3R1cmUgYWZ0ZXIgYWxsIDpQIClcbiAgICBvbGROb2RlID0gT2JqZWN0LmFzc2lnbihvbGROb2RlIHx8IHt9LCBuZXdOb2RlKTtcbiAgICAvLyBlbmQgZGFuZ2VyIHpvbmVcblxuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIHdoaWxlIChuZXh0QmF0Y2gubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IG9wID0gbmV4dEJhdGNoLnNoaWZ0KCk7XG4gICAgICAgIG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGU7XG4gIH07XG4gIHJldHVybiB1cGRhdGVGdW5jO1xufSIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IGxpZmVDeWNsZUZhY3RvcnkgPSBtZXRob2QgPT4gY3VycnkoKGZuLCBjb21wKSA9PiAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgY29uc3QgbiA9IGNvbXAocHJvcHMsIC4uLmFyZ3MpO1xuICBuW21ldGhvZF0gPSAoKSA9PiBmbihuLCAuLi5hcmdzKTtcbiAgcmV0dXJuIG47XG59KTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgbW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uTW91bnQnKTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgdW5tb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvblVuTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvblVuTW91bnQnKTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudH0gZnJvbSAnLi9saWZlQ3ljbGVzJztcblxuLyoqXG4gKiBDb21iaW5hdG9yIHRvIGNyZWF0ZSBhIFwic3RhdGVmdWwgY29tcG9uZW50XCI6IGllIGl0IHdpbGwgaGF2ZSBpdHMgb3duIHN0YXRlIGFuZCB0aGUgYWJpbGl0eSB0byB1cGRhdGUgaXRzIG93biB0cmVlXG4gKiBAcGFyYW0gY29tcFxuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoY29tcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAvLyB3cmFwIHRoZSBmdW5jdGlvbiBjYWxsIHdoZW4gdGhlIGNvbXBvbmVudCBoYXMgbm90IGJlZW4gbW91bnRlZCB5ZXQ6IGxhenkgZXZhbHVhdGlvbiB0byBtYWtlIHN1cmUgdGhlIHVwZGF0ZUZ1bmMgaGFzIGJlZW4gc2V0XG4gICAgICBjb25zdCBzZXRTdGF0ZSA9IChuZXdTdGF0ZSkgPT4gdXBkYXRlRnVuYyhuZXdTdGF0ZSk7XG4gICAgICByZXR1cm4gY29tcChwcm9wcywgc2V0U3RhdGUsIC4uLmFyZ3MpO1xuICAgIH07XG5cbiAgICByZXR1cm4gb25Nb3VudCgodm5vZGUpID0+IHtcbiAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUod3JhcHBlckNvbXAsIHZub2RlKTtcbiAgICB9LCB3cmFwcGVyQ29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vL3RvZG8gdGhyb3cgdGhpcyBpbiBmYXZvciBvZiBjb25uZWN0IG9ubHkgP1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgRWxtIGxpa2UgYXBwXG4gKiBAcGFyYW0gdmlld1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAodmlldykge1xuICByZXR1cm4gZnVuY3Rpb24gKHttb2RlbCwgdXBkYXRlcywgc3Vic2NyaXB0aW9ucyA9IFtdfSkge1xuICAgIGxldCBhY3Rpb25TdG9yZSA9IHt9O1xuXG4gICAgY29uc3QgY29tcCA9IHByb3BzID0+IHZpZXcobW9kZWwsIGFjdGlvblN0b3JlKTtcblxuICAgIGNvbnN0IGluaXRBY3Rpb25TdG9yZSA9ICh2bm9kZSkgPT4ge1xuICAgICAgY29uc3QgdXBkYXRlRnVuYyA9IHVwZGF0ZShjb21wLCB2bm9kZSk7XG4gICAgICBmb3IgKGxldCB1cGRhdGUgb2YgT2JqZWN0LmtleXModXBkYXRlcykpIHtcbiAgICAgICAgYWN0aW9uU3RvcmVbdXBkYXRlXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgbW9kZWwgPSB1cGRhdGVzW3VwZGF0ZV0obW9kZWwsIC4uLmFyZ3MpOyAvL3RvZG8gY29uc2lkZXIgc2lkZSBlZmZlY3RzLCBtaWRkbGV3YXJlcywgZXRjXG4gICAgICAgICAgcmV0dXJuIHVwZGF0ZUZ1bmMobW9kZWwsIGFjdGlvblN0b3JlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgaW5pdFN1YnNjcmlwdGlvbiA9IHN1YnNjcmlwdGlvbnMubWFwKHN1YiA9PiB2bm9kZSA9PiBzdWIodm5vZGUsIGFjdGlvblN0b3JlKSk7XG4gICAgY29uc3QgaW5pdEZ1bmMgPSBjb21wb3NlKGluaXRBY3Rpb25TdG9yZSwgLi4uaW5pdFN1YnNjcmlwdGlvbik7XG5cbiAgICByZXR1cm4gb25Nb3VudChpbml0RnVuYywgY29tcCk7XG4gIH07XG59O1xuXG5cbi8qXG5cbmNvbm5lY3Qoc3RvcmUsIGFjdGlvbnMsIHdhdGNoZXIpXG5cblxuXG5cbiAqLyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7b25Nb3VudCwgb25Vbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnXG5pbXBvcnQge2lzRGVlcEVxdWFsLCBpZGVudGl0eX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb25uZWN0IGNvbWJpbmF0b3I6IHdpbGwgY3JlYXRlIFwiY29udGFpbmVyXCIgY29tcG9uZW50IHdoaWNoIHdpbGwgc3Vic2NyaWJlIHRvIGEgUmVkdXggbGlrZSBzdG9yZS4gYW5kIHVwZGF0ZSBpdHMgY2hpbGRyZW4gd2hlbmV2ZXIgYSBzcGVjaWZpYyBzbGljZSBvZiBzdGF0ZSBjaGFuZ2VcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY3VycnkoZnVuY3Rpb24gKHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlID0gaWRlbnRpdHkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChjb21wLCBtYXBTdGF0ZVRvUHJvcCA9IGlkZW50aXR5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChpbml0UHJvcCkge1xuICAgICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgICBsZXQgcHJldmlvdXNTdGF0ZVNsaWNlO1xuICAgICAgbGV0IGNvbXBvbmVudFByb3BzID0gaW5pdFByb3A7XG4gICAgICBsZXQgdW5zdWJzY3JpYmVyO1xuXG4gICAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgICByZXR1cm4gY29tcChwcm9wcywgYWN0aW9ucywgLi4uYXJncyk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBzdWJzY3JpYmUgPSBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgICAgIHVuc3Vic2NyaWJlciA9IHN0b3JlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdGVTbGljZSA9IHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgaWYgKCFpc0RlZXBFcXVhbChzdGF0ZVNsaWNlLCBwcmV2aW91c1N0YXRlU2xpY2UpKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNvbXBvbmVudFByb3BzLCBtYXBTdGF0ZVRvUHJvcChzdGF0ZVNsaWNlKSk7XG4gICAgICAgICAgICB1cGRhdGVGdW5jKGNvbXBvbmVudFByb3BzKTtcbiAgICAgICAgICAgIHByZXZpb3VzU3RhdGVTbGljZSA9IHN0YXRlU2xpY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB1bnN1YnNjcmliZSA9IG9uVW5Nb3VudCgoKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlcigpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBjb21wb3NlKHN1YnNjcmliZSwgdW5zdWJzY3JpYmUpKHdyYXBwZXJDb21wKTtcbiAgICB9O1xuICB9XG59LCAzKTsiLCIvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAgZnJvbSBOb2RlLmpzLiAqL1xudmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCAmJiBnbG9iYWwuT2JqZWN0ID09PSBPYmplY3QgJiYgZ2xvYmFsO1xuXG5leHBvcnQgZGVmYXVsdCBmcmVlR2xvYmFsO1xuIiwiaW1wb3J0IGZyZWVHbG9iYWwgZnJvbSAnLi9fZnJlZUdsb2JhbC5qcyc7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXG52YXIgZnJlZVNlbGYgPSB0eXBlb2Ygc2VsZiA9PSAnb2JqZWN0JyAmJiBzZWxmICYmIHNlbGYuT2JqZWN0ID09PSBPYmplY3QgJiYgc2VsZjtcblxuLyoqIFVzZWQgYXMgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QuICovXG52YXIgcm9vdCA9IGZyZWVHbG9iYWwgfHwgZnJlZVNlbGYgfHwgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblxuZXhwb3J0IGRlZmF1bHQgcm9vdDtcbiIsImltcG9ydCByb290IGZyb20gJy4vX3Jvb3QuanMnO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBTeW1ib2wgPSByb290LlN5bWJvbDtcblxuZXhwb3J0IGRlZmF1bHQgU3ltYm9sO1xuIiwiaW1wb3J0IFN5bWJvbCBmcm9tICcuL19TeW1ib2wuanMnO1xuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGVcbiAqIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi83LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgbmF0aXZlT2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgc3ltVG9TdHJpbmdUYWcgPSBTeW1ib2wgPyBTeW1ib2wudG9TdHJpbmdUYWcgOiB1bmRlZmluZWQ7XG5cbi8qKlxuICogQSBzcGVjaWFsaXplZCB2ZXJzaW9uIG9mIGBiYXNlR2V0VGFnYCB3aGljaCBpZ25vcmVzIGBTeW1ib2wudG9TdHJpbmdUYWdgIHZhbHVlcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSByYXcgYHRvU3RyaW5nVGFnYC5cbiAqL1xuZnVuY3Rpb24gZ2V0UmF3VGFnKHZhbHVlKSB7XG4gIHZhciBpc093biA9IGhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIHN5bVRvU3RyaW5nVGFnKSxcbiAgICAgIHRhZyA9IHZhbHVlW3N5bVRvU3RyaW5nVGFnXTtcblxuICB0cnkge1xuICAgIHZhbHVlW3N5bVRvU3RyaW5nVGFnXSA9IHVuZGVmaW5lZDtcbiAgICB2YXIgdW5tYXNrZWQgPSB0cnVlO1xuICB9IGNhdGNoIChlKSB7fVxuXG4gIHZhciByZXN1bHQgPSBuYXRpdmVPYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgaWYgKHVubWFza2VkKSB7XG4gICAgaWYgKGlzT3duKSB7XG4gICAgICB2YWx1ZVtzeW1Ub1N0cmluZ1RhZ10gPSB0YWc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSB2YWx1ZVtzeW1Ub1N0cmluZ1RhZ107XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGdldFJhd1RhZztcbiIsIi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZVxuICogW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzcuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBuYXRpdmVPYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYSBzdHJpbmcgdXNpbmcgYE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjb252ZXJ0LlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29udmVydGVkIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIG5hdGl2ZU9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBvYmplY3RUb1N0cmluZztcbiIsImltcG9ydCBTeW1ib2wgZnJvbSAnLi9fU3ltYm9sLmpzJztcbmltcG9ydCBnZXRSYXdUYWcgZnJvbSAnLi9fZ2V0UmF3VGFnLmpzJztcbmltcG9ydCBvYmplY3RUb1N0cmluZyBmcm9tICcuL19vYmplY3RUb1N0cmluZy5qcyc7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBudWxsVGFnID0gJ1tvYmplY3QgTnVsbF0nLFxuICAgIHVuZGVmaW5lZFRhZyA9ICdbb2JqZWN0IFVuZGVmaW5lZF0nO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBzeW1Ub1N0cmluZ1RhZyA9IFN5bWJvbCA/IFN5bWJvbC50b1N0cmluZ1RhZyA6IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgZ2V0VGFnYCB3aXRob3V0IGZhbGxiYWNrcyBmb3IgYnVnZ3kgZW52aXJvbm1lbnRzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGB0b1N0cmluZ1RhZ2AuXG4gKi9cbmZ1bmN0aW9uIGJhc2VHZXRUYWcodmFsdWUpIHtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZFRhZyA6IG51bGxUYWc7XG4gIH1cbiAgcmV0dXJuIChzeW1Ub1N0cmluZ1RhZyAmJiBzeW1Ub1N0cmluZ1RhZyBpbiBPYmplY3QodmFsdWUpKVxuICAgID8gZ2V0UmF3VGFnKHZhbHVlKVxuICAgIDogb2JqZWN0VG9TdHJpbmcodmFsdWUpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBiYXNlR2V0VGFnO1xuIiwiLyoqXG4gKiBDcmVhdGVzIGEgdW5hcnkgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGBmdW5jYCB3aXRoIGl0cyBhcmd1bWVudCB0cmFuc2Zvcm1lZC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gd3JhcC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHRyYW5zZm9ybSBUaGUgYXJndW1lbnQgdHJhbnNmb3JtLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG92ZXJBcmcoZnVuYywgdHJhbnNmb3JtKSB7XG4gIHJldHVybiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gZnVuYyh0cmFuc2Zvcm0oYXJnKSk7XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IG92ZXJBcmc7XG4iLCJpbXBvcnQgb3ZlckFyZyBmcm9tICcuL19vdmVyQXJnLmpzJztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgZ2V0UHJvdG90eXBlID0gb3ZlckFyZyhPYmplY3QuZ2V0UHJvdG90eXBlT2YsIE9iamVjdCk7XG5cbmV4cG9ydCBkZWZhdWx0IGdldFByb3RvdHlwZTtcbiIsIi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuIEEgdmFsdWUgaXMgb2JqZWN0LWxpa2UgaWYgaXQncyBub3QgYG51bGxgXG4gKiBhbmQgaGFzIGEgYHR5cGVvZmAgcmVzdWx0IG9mIFwib2JqZWN0XCIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSA0LjAuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdExpa2Uoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc09iamVjdExpa2UobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG5leHBvcnQgZGVmYXVsdCBpc09iamVjdExpa2U7XG4iLCJpbXBvcnQgYmFzZUdldFRhZyBmcm9tICcuL19iYXNlR2V0VGFnLmpzJztcbmltcG9ydCBnZXRQcm90b3R5cGUgZnJvbSAnLi9fZ2V0UHJvdG90eXBlLmpzJztcbmltcG9ydCBpc09iamVjdExpa2UgZnJvbSAnLi9pc09iamVjdExpa2UuanMnO1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0VGFnID0gJ1tvYmplY3QgT2JqZWN0XSc7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jUHJvdG8gPSBGdW5jdGlvbi5wcm90b3R5cGUsXG4gICAgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byByZXNvbHZlIHRoZSBkZWNvbXBpbGVkIHNvdXJjZSBvZiBmdW5jdGlvbnMuICovXG52YXIgZnVuY1RvU3RyaW5nID0gZnVuY1Byb3RvLnRvU3RyaW5nO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKiogVXNlZCB0byBpbmZlciB0aGUgYE9iamVjdGAgY29uc3RydWN0b3IuICovXG52YXIgb2JqZWN0Q3RvclN0cmluZyA9IGZ1bmNUb1N0cmluZy5jYWxsKE9iamVjdCk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIHRoYXQgaXMsIGFuIG9iamVjdCBjcmVhdGVkIGJ5IHRoZVxuICogYE9iamVjdGAgY29uc3RydWN0b3Igb3Igb25lIHdpdGggYSBgW1tQcm90b3R5cGVdXWAgb2YgYG51bGxgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgMC44LjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgcGxhaW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIGZ1bmN0aW9uIEZvbygpIHtcbiAqICAgdGhpcy5hID0gMTtcbiAqIH1cbiAqXG4gKiBfLmlzUGxhaW5PYmplY3QobmV3IEZvbyk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzUGxhaW5PYmplY3QoeyAneCc6IDAsICd5JzogMCB9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzUGxhaW5PYmplY3QoT2JqZWN0LmNyZWF0ZShudWxsKSk7XG4gKiAvLyA9PiB0cnVlXG4gKi9cbmZ1bmN0aW9uIGlzUGxhaW5PYmplY3QodmFsdWUpIHtcbiAgaWYgKCFpc09iamVjdExpa2UodmFsdWUpIHx8IGJhc2VHZXRUYWcodmFsdWUpICE9IG9iamVjdFRhZykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgcHJvdG8gPSBnZXRQcm90b3R5cGUodmFsdWUpO1xuICBpZiAocHJvdG8gPT09IG51bGwpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB2YXIgQ3RvciA9IGhhc093blByb3BlcnR5LmNhbGwocHJvdG8sICdjb25zdHJ1Y3RvcicpICYmIHByb3RvLmNvbnN0cnVjdG9yO1xuICByZXR1cm4gdHlwZW9mIEN0b3IgPT0gJ2Z1bmN0aW9uJyAmJiBDdG9yIGluc3RhbmNlb2YgQ3RvciAmJlxuICAgIGZ1bmNUb1N0cmluZy5jYWxsKEN0b3IpID09IG9iamVjdEN0b3JTdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGlzUGxhaW5PYmplY3Q7XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzeW1ib2xPYnNlcnZhYmxlUG9ueWZpbGwocm9vdCkge1xuXHR2YXIgcmVzdWx0O1xuXHR2YXIgU3ltYm9sID0gcm9vdC5TeW1ib2w7XG5cblx0aWYgKHR5cGVvZiBTeW1ib2wgPT09ICdmdW5jdGlvbicpIHtcblx0XHRpZiAoU3ltYm9sLm9ic2VydmFibGUpIHtcblx0XHRcdHJlc3VsdCA9IFN5bWJvbC5vYnNlcnZhYmxlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQgPSBTeW1ib2woJ29ic2VydmFibGUnKTtcblx0XHRcdFN5bWJvbC5vYnNlcnZhYmxlID0gcmVzdWx0O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRyZXN1bHQgPSAnQEBvYnNlcnZhYmxlJztcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59O1xuIiwiLyogZ2xvYmFsIHdpbmRvdyAqL1xuaW1wb3J0IHBvbnlmaWxsIGZyb20gJy4vcG9ueWZpbGwnO1xuXG52YXIgcm9vdDtcblxuaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICByb290ID0gc2VsZjtcbn0gZWxzZSBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgcm9vdCA9IHdpbmRvdztcbn0gZWxzZSBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgcm9vdCA9IGdsb2JhbDtcbn0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgcm9vdCA9IG1vZHVsZTtcbn0gZWxzZSB7XG4gIHJvb3QgPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xufVxuXG52YXIgcmVzdWx0ID0gcG9ueWZpbGwocm9vdCk7XG5leHBvcnQgZGVmYXVsdCByZXN1bHQ7XG4iLCJpbXBvcnQgaXNQbGFpbk9iamVjdCBmcm9tICdsb2Rhc2gtZXMvaXNQbGFpbk9iamVjdCc7XG5pbXBvcnQgJCRvYnNlcnZhYmxlIGZyb20gJ3N5bWJvbC1vYnNlcnZhYmxlJztcblxuLyoqXG4gKiBUaGVzZSBhcmUgcHJpdmF0ZSBhY3Rpb24gdHlwZXMgcmVzZXJ2ZWQgYnkgUmVkdXguXG4gKiBGb3IgYW55IHVua25vd24gYWN0aW9ucywgeW91IG11c3QgcmV0dXJuIHRoZSBjdXJyZW50IHN0YXRlLlxuICogSWYgdGhlIGN1cnJlbnQgc3RhdGUgaXMgdW5kZWZpbmVkLCB5b3UgbXVzdCByZXR1cm4gdGhlIGluaXRpYWwgc3RhdGUuXG4gKiBEbyBub3QgcmVmZXJlbmNlIHRoZXNlIGFjdGlvbiB0eXBlcyBkaXJlY3RseSBpbiB5b3VyIGNvZGUuXG4gKi9cbmV4cG9ydCB2YXIgQWN0aW9uVHlwZXMgPSB7XG4gIElOSVQ6ICdAQHJlZHV4L0lOSVQnXG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBSZWR1eCBzdG9yZSB0aGF0IGhvbGRzIHRoZSBzdGF0ZSB0cmVlLlxuICogVGhlIG9ubHkgd2F5IHRvIGNoYW5nZSB0aGUgZGF0YSBpbiB0aGUgc3RvcmUgaXMgdG8gY2FsbCBgZGlzcGF0Y2goKWAgb24gaXQuXG4gKlxuICogVGhlcmUgc2hvdWxkIG9ubHkgYmUgYSBzaW5nbGUgc3RvcmUgaW4geW91ciBhcHAuIFRvIHNwZWNpZnkgaG93IGRpZmZlcmVudFxuICogcGFydHMgb2YgdGhlIHN0YXRlIHRyZWUgcmVzcG9uZCB0byBhY3Rpb25zLCB5b3UgbWF5IGNvbWJpbmUgc2V2ZXJhbCByZWR1Y2Vyc1xuICogaW50byBhIHNpbmdsZSByZWR1Y2VyIGZ1bmN0aW9uIGJ5IHVzaW5nIGBjb21iaW5lUmVkdWNlcnNgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlZHVjZXIgQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIG5leHQgc3RhdGUgdHJlZSwgZ2l2ZW5cbiAqIHRoZSBjdXJyZW50IHN0YXRlIHRyZWUgYW5kIHRoZSBhY3Rpb24gdG8gaGFuZGxlLlxuICpcbiAqIEBwYXJhbSB7YW55fSBbcHJlbG9hZGVkU3RhdGVdIFRoZSBpbml0aWFsIHN0YXRlLiBZb3UgbWF5IG9wdGlvbmFsbHkgc3BlY2lmeSBpdFxuICogdG8gaHlkcmF0ZSB0aGUgc3RhdGUgZnJvbSB0aGUgc2VydmVyIGluIHVuaXZlcnNhbCBhcHBzLCBvciB0byByZXN0b3JlIGFcbiAqIHByZXZpb3VzbHkgc2VyaWFsaXplZCB1c2VyIHNlc3Npb24uXG4gKiBJZiB5b3UgdXNlIGBjb21iaW5lUmVkdWNlcnNgIHRvIHByb2R1Y2UgdGhlIHJvb3QgcmVkdWNlciBmdW5jdGlvbiwgdGhpcyBtdXN0IGJlXG4gKiBhbiBvYmplY3Qgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBgY29tYmluZVJlZHVjZXJzYCBrZXlzLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGVuaGFuY2VyIFRoZSBzdG9yZSBlbmhhbmNlci4gWW91IG1heSBvcHRpb25hbGx5IHNwZWNpZnkgaXRcbiAqIHRvIGVuaGFuY2UgdGhlIHN0b3JlIHdpdGggdGhpcmQtcGFydHkgY2FwYWJpbGl0aWVzIHN1Y2ggYXMgbWlkZGxld2FyZSxcbiAqIHRpbWUgdHJhdmVsLCBwZXJzaXN0ZW5jZSwgZXRjLiBUaGUgb25seSBzdG9yZSBlbmhhbmNlciB0aGF0IHNoaXBzIHdpdGggUmVkdXhcbiAqIGlzIGBhcHBseU1pZGRsZXdhcmUoKWAuXG4gKlxuICogQHJldHVybnMge1N0b3JlfSBBIFJlZHV4IHN0b3JlIHRoYXQgbGV0cyB5b3UgcmVhZCB0aGUgc3RhdGUsIGRpc3BhdGNoIGFjdGlvbnNcbiAqIGFuZCBzdWJzY3JpYmUgdG8gY2hhbmdlcy5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gY3JlYXRlU3RvcmUocmVkdWNlciwgcHJlbG9hZGVkU3RhdGUsIGVuaGFuY2VyKSB7XG4gIHZhciBfcmVmMjtcblxuICBpZiAodHlwZW9mIHByZWxvYWRlZFN0YXRlID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBlbmhhbmNlciA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBlbmhhbmNlciA9IHByZWxvYWRlZFN0YXRlO1xuICAgIHByZWxvYWRlZFN0YXRlID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBlbmhhbmNlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAodHlwZW9mIGVuaGFuY2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRoZSBlbmhhbmNlciB0byBiZSBhIGZ1bmN0aW9uLicpO1xuICAgIH1cblxuICAgIHJldHVybiBlbmhhbmNlcihjcmVhdGVTdG9yZSkocmVkdWNlciwgcHJlbG9hZGVkU3RhdGUpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiByZWR1Y2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCB0aGUgcmVkdWNlciB0byBiZSBhIGZ1bmN0aW9uLicpO1xuICB9XG5cbiAgdmFyIGN1cnJlbnRSZWR1Y2VyID0gcmVkdWNlcjtcbiAgdmFyIGN1cnJlbnRTdGF0ZSA9IHByZWxvYWRlZFN0YXRlO1xuICB2YXIgY3VycmVudExpc3RlbmVycyA9IFtdO1xuICB2YXIgbmV4dExpc3RlbmVycyA9IGN1cnJlbnRMaXN0ZW5lcnM7XG4gIHZhciBpc0Rpc3BhdGNoaW5nID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZW5zdXJlQ2FuTXV0YXRlTmV4dExpc3RlbmVycygpIHtcbiAgICBpZiAobmV4dExpc3RlbmVycyA9PT0gY3VycmVudExpc3RlbmVycykge1xuICAgICAgbmV4dExpc3RlbmVycyA9IGN1cnJlbnRMaXN0ZW5lcnMuc2xpY2UoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVhZHMgdGhlIHN0YXRlIHRyZWUgbWFuYWdlZCBieSB0aGUgc3RvcmUuXG4gICAqXG4gICAqIEByZXR1cm5zIHthbnl9IFRoZSBjdXJyZW50IHN0YXRlIHRyZWUgb2YgeW91ciBhcHBsaWNhdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIGdldFN0YXRlKCkge1xuICAgIHJldHVybiBjdXJyZW50U3RhdGU7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIGNoYW5nZSBsaXN0ZW5lci4gSXQgd2lsbCBiZSBjYWxsZWQgYW55IHRpbWUgYW4gYWN0aW9uIGlzIGRpc3BhdGNoZWQsXG4gICAqIGFuZCBzb21lIHBhcnQgb2YgdGhlIHN0YXRlIHRyZWUgbWF5IHBvdGVudGlhbGx5IGhhdmUgY2hhbmdlZC4gWW91IG1heSB0aGVuXG4gICAqIGNhbGwgYGdldFN0YXRlKClgIHRvIHJlYWQgdGhlIGN1cnJlbnQgc3RhdGUgdHJlZSBpbnNpZGUgdGhlIGNhbGxiYWNrLlxuICAgKlxuICAgKiBZb3UgbWF5IGNhbGwgYGRpc3BhdGNoKClgIGZyb20gYSBjaGFuZ2UgbGlzdGVuZXIsIHdpdGggdGhlIGZvbGxvd2luZ1xuICAgKiBjYXZlYXRzOlxuICAgKlxuICAgKiAxLiBUaGUgc3Vic2NyaXB0aW9ucyBhcmUgc25hcHNob3R0ZWQganVzdCBiZWZvcmUgZXZlcnkgYGRpc3BhdGNoKClgIGNhbGwuXG4gICAqIElmIHlvdSBzdWJzY3JpYmUgb3IgdW5zdWJzY3JpYmUgd2hpbGUgdGhlIGxpc3RlbmVycyBhcmUgYmVpbmcgaW52b2tlZCwgdGhpc1xuICAgKiB3aWxsIG5vdCBoYXZlIGFueSBlZmZlY3Qgb24gdGhlIGBkaXNwYXRjaCgpYCB0aGF0IGlzIGN1cnJlbnRseSBpbiBwcm9ncmVzcy5cbiAgICogSG93ZXZlciwgdGhlIG5leHQgYGRpc3BhdGNoKClgIGNhbGwsIHdoZXRoZXIgbmVzdGVkIG9yIG5vdCwgd2lsbCB1c2UgYSBtb3JlXG4gICAqIHJlY2VudCBzbmFwc2hvdCBvZiB0aGUgc3Vic2NyaXB0aW9uIGxpc3QuXG4gICAqXG4gICAqIDIuIFRoZSBsaXN0ZW5lciBzaG91bGQgbm90IGV4cGVjdCB0byBzZWUgYWxsIHN0YXRlIGNoYW5nZXMsIGFzIHRoZSBzdGF0ZVxuICAgKiBtaWdodCBoYXZlIGJlZW4gdXBkYXRlZCBtdWx0aXBsZSB0aW1lcyBkdXJpbmcgYSBuZXN0ZWQgYGRpc3BhdGNoKClgIGJlZm9yZVxuICAgKiB0aGUgbGlzdGVuZXIgaXMgY2FsbGVkLiBJdCBpcywgaG93ZXZlciwgZ3VhcmFudGVlZCB0aGF0IGFsbCBzdWJzY3JpYmVyc1xuICAgKiByZWdpc3RlcmVkIGJlZm9yZSB0aGUgYGRpc3BhdGNoKClgIHN0YXJ0ZWQgd2lsbCBiZSBjYWxsZWQgd2l0aCB0aGUgbGF0ZXN0XG4gICAqIHN0YXRlIGJ5IHRoZSB0aW1lIGl0IGV4aXRzLlxuICAgKlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBBIGNhbGxiYWNrIHRvIGJlIGludm9rZWQgb24gZXZlcnkgZGlzcGF0Y2guXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gQSBmdW5jdGlvbiB0byByZW1vdmUgdGhpcyBjaGFuZ2UgbGlzdGVuZXIuXG4gICAqL1xuICBmdW5jdGlvbiBzdWJzY3JpYmUobGlzdGVuZXIpIHtcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGxpc3RlbmVyIHRvIGJlIGEgZnVuY3Rpb24uJyk7XG4gICAgfVxuXG4gICAgdmFyIGlzU3Vic2NyaWJlZCA9IHRydWU7XG5cbiAgICBlbnN1cmVDYW5NdXRhdGVOZXh0TGlzdGVuZXJzKCk7XG4gICAgbmV4dExpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiB1bnN1YnNjcmliZSgpIHtcbiAgICAgIGlmICghaXNTdWJzY3JpYmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaXNTdWJzY3JpYmVkID0gZmFsc2U7XG5cbiAgICAgIGVuc3VyZUNhbk11dGF0ZU5leHRMaXN0ZW5lcnMoKTtcbiAgICAgIHZhciBpbmRleCA9IG5leHRMaXN0ZW5lcnMuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBuZXh0TGlzdGVuZXJzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwYXRjaGVzIGFuIGFjdGlvbi4gSXQgaXMgdGhlIG9ubHkgd2F5IHRvIHRyaWdnZXIgYSBzdGF0ZSBjaGFuZ2UuXG4gICAqXG4gICAqIFRoZSBgcmVkdWNlcmAgZnVuY3Rpb24sIHVzZWQgdG8gY3JlYXRlIHRoZSBzdG9yZSwgd2lsbCBiZSBjYWxsZWQgd2l0aCB0aGVcbiAgICogY3VycmVudCBzdGF0ZSB0cmVlIGFuZCB0aGUgZ2l2ZW4gYGFjdGlvbmAuIEl0cyByZXR1cm4gdmFsdWUgd2lsbFxuICAgKiBiZSBjb25zaWRlcmVkIHRoZSAqKm5leHQqKiBzdGF0ZSBvZiB0aGUgdHJlZSwgYW5kIHRoZSBjaGFuZ2UgbGlzdGVuZXJzXG4gICAqIHdpbGwgYmUgbm90aWZpZWQuXG4gICAqXG4gICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9ubHkgc3VwcG9ydHMgcGxhaW4gb2JqZWN0IGFjdGlvbnMuIElmIHlvdSB3YW50IHRvXG4gICAqIGRpc3BhdGNoIGEgUHJvbWlzZSwgYW4gT2JzZXJ2YWJsZSwgYSB0aHVuaywgb3Igc29tZXRoaW5nIGVsc2UsIHlvdSBuZWVkIHRvXG4gICAqIHdyYXAgeW91ciBzdG9yZSBjcmVhdGluZyBmdW5jdGlvbiBpbnRvIHRoZSBjb3JyZXNwb25kaW5nIG1pZGRsZXdhcmUuIEZvclxuICAgKiBleGFtcGxlLCBzZWUgdGhlIGRvY3VtZW50YXRpb24gZm9yIHRoZSBgcmVkdXgtdGh1bmtgIHBhY2thZ2UuIEV2ZW4gdGhlXG4gICAqIG1pZGRsZXdhcmUgd2lsbCBldmVudHVhbGx5IGRpc3BhdGNoIHBsYWluIG9iamVjdCBhY3Rpb25zIHVzaW5nIHRoaXMgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gYWN0aW9uIEEgcGxhaW4gb2JqZWN0IHJlcHJlc2VudGluZyDigJx3aGF0IGNoYW5nZWTigJ0uIEl0IGlzXG4gICAqIGEgZ29vZCBpZGVhIHRvIGtlZXAgYWN0aW9ucyBzZXJpYWxpemFibGUgc28geW91IGNhbiByZWNvcmQgYW5kIHJlcGxheSB1c2VyXG4gICAqIHNlc3Npb25zLCBvciB1c2UgdGhlIHRpbWUgdHJhdmVsbGluZyBgcmVkdXgtZGV2dG9vbHNgLiBBbiBhY3Rpb24gbXVzdCBoYXZlXG4gICAqIGEgYHR5cGVgIHByb3BlcnR5IHdoaWNoIG1heSBub3QgYmUgYHVuZGVmaW5lZGAuIEl0IGlzIGEgZ29vZCBpZGVhIHRvIHVzZVxuICAgKiBzdHJpbmcgY29uc3RhbnRzIGZvciBhY3Rpb24gdHlwZXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IEZvciBjb252ZW5pZW5jZSwgdGhlIHNhbWUgYWN0aW9uIG9iamVjdCB5b3UgZGlzcGF0Y2hlZC5cbiAgICpcbiAgICogTm90ZSB0aGF0LCBpZiB5b3UgdXNlIGEgY3VzdG9tIG1pZGRsZXdhcmUsIGl0IG1heSB3cmFwIGBkaXNwYXRjaCgpYCB0b1xuICAgKiByZXR1cm4gc29tZXRoaW5nIGVsc2UgKGZvciBleGFtcGxlLCBhIFByb21pc2UgeW91IGNhbiBhd2FpdCkuXG4gICAqL1xuICBmdW5jdGlvbiBkaXNwYXRjaChhY3Rpb24pIHtcbiAgICBpZiAoIWlzUGxhaW5PYmplY3QoYWN0aW9uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBY3Rpb25zIG11c3QgYmUgcGxhaW4gb2JqZWN0cy4gJyArICdVc2UgY3VzdG9tIG1pZGRsZXdhcmUgZm9yIGFzeW5jIGFjdGlvbnMuJyk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhY3Rpb24udHlwZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQWN0aW9ucyBtYXkgbm90IGhhdmUgYW4gdW5kZWZpbmVkIFwidHlwZVwiIHByb3BlcnR5LiAnICsgJ0hhdmUgeW91IG1pc3NwZWxsZWQgYSBjb25zdGFudD8nKTtcbiAgICB9XG5cbiAgICBpZiAoaXNEaXNwYXRjaGluZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZWR1Y2VycyBtYXkgbm90IGRpc3BhdGNoIGFjdGlvbnMuJyk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGlzRGlzcGF0Y2hpbmcgPSB0cnVlO1xuICAgICAgY3VycmVudFN0YXRlID0gY3VycmVudFJlZHVjZXIoY3VycmVudFN0YXRlLCBhY3Rpb24pO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBpc0Rpc3BhdGNoaW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGxpc3RlbmVycyA9IGN1cnJlbnRMaXN0ZW5lcnMgPSBuZXh0TGlzdGVuZXJzO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsaXN0ZW5lcnNbaV0oKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIHRoZSByZWR1Y2VyIGN1cnJlbnRseSB1c2VkIGJ5IHRoZSBzdG9yZSB0byBjYWxjdWxhdGUgdGhlIHN0YXRlLlxuICAgKlxuICAgKiBZb3UgbWlnaHQgbmVlZCB0aGlzIGlmIHlvdXIgYXBwIGltcGxlbWVudHMgY29kZSBzcGxpdHRpbmcgYW5kIHlvdSB3YW50IHRvXG4gICAqIGxvYWQgc29tZSBvZiB0aGUgcmVkdWNlcnMgZHluYW1pY2FsbHkuIFlvdSBtaWdodCBhbHNvIG5lZWQgdGhpcyBpZiB5b3VcbiAgICogaW1wbGVtZW50IGEgaG90IHJlbG9hZGluZyBtZWNoYW5pc20gZm9yIFJlZHV4LlxuICAgKlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBuZXh0UmVkdWNlciBUaGUgcmVkdWNlciBmb3IgdGhlIHN0b3JlIHRvIHVzZSBpbnN0ZWFkLlxuICAgKiBAcmV0dXJucyB7dm9pZH1cbiAgICovXG4gIGZ1bmN0aW9uIHJlcGxhY2VSZWR1Y2VyKG5leHRSZWR1Y2VyKSB7XG4gICAgaWYgKHR5cGVvZiBuZXh0UmVkdWNlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCB0aGUgbmV4dFJlZHVjZXIgdG8gYmUgYSBmdW5jdGlvbi4nKTtcbiAgICB9XG5cbiAgICBjdXJyZW50UmVkdWNlciA9IG5leHRSZWR1Y2VyO1xuICAgIGRpc3BhdGNoKHsgdHlwZTogQWN0aW9uVHlwZXMuSU5JVCB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm9wZXJhYmlsaXR5IHBvaW50IGZvciBvYnNlcnZhYmxlL3JlYWN0aXZlIGxpYnJhcmllcy5cbiAgICogQHJldHVybnMge29ic2VydmFibGV9IEEgbWluaW1hbCBvYnNlcnZhYmxlIG9mIHN0YXRlIGNoYW5nZXMuXG4gICAqIEZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgdGhlIG9ic2VydmFibGUgcHJvcG9zYWw6XG4gICAqIGh0dHBzOi8vZ2l0aHViLmNvbS96ZW5wYXJzaW5nL2VzLW9ic2VydmFibGVcbiAgICovXG4gIGZ1bmN0aW9uIG9ic2VydmFibGUoKSB7XG4gICAgdmFyIF9yZWY7XG5cbiAgICB2YXIgb3V0ZXJTdWJzY3JpYmUgPSBzdWJzY3JpYmU7XG4gICAgcmV0dXJuIF9yZWYgPSB7XG4gICAgICAvKipcbiAgICAgICAqIFRoZSBtaW5pbWFsIG9ic2VydmFibGUgc3Vic2NyaXB0aW9uIG1ldGhvZC5cbiAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYnNlcnZlciBBbnkgb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgYXMgYW4gb2JzZXJ2ZXIuXG4gICAgICAgKiBUaGUgb2JzZXJ2ZXIgb2JqZWN0IHNob3VsZCBoYXZlIGEgYG5leHRgIG1ldGhvZC5cbiAgICAgICAqIEByZXR1cm5zIHtzdWJzY3JpcHRpb259IEFuIG9iamVjdCB3aXRoIGFuIGB1bnN1YnNjcmliZWAgbWV0aG9kIHRoYXQgY2FuXG4gICAgICAgKiBiZSB1c2VkIHRvIHVuc3Vic2NyaWJlIHRoZSBvYnNlcnZhYmxlIGZyb20gdGhlIHN0b3JlLCBhbmQgcHJldmVudCBmdXJ0aGVyXG4gICAgICAgKiBlbWlzc2lvbiBvZiB2YWx1ZXMgZnJvbSB0aGUgb2JzZXJ2YWJsZS5cbiAgICAgICAqL1xuICAgICAgc3Vic2NyaWJlOiBmdW5jdGlvbiBzdWJzY3JpYmUob2JzZXJ2ZXIpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYnNlcnZlciAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCB0aGUgb2JzZXJ2ZXIgdG8gYmUgYW4gb2JqZWN0LicpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gb2JzZXJ2ZVN0YXRlKCkge1xuICAgICAgICAgIGlmIChvYnNlcnZlci5uZXh0KSB7XG4gICAgICAgICAgICBvYnNlcnZlci5uZXh0KGdldFN0YXRlKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVTdGF0ZSgpO1xuICAgICAgICB2YXIgdW5zdWJzY3JpYmUgPSBvdXRlclN1YnNjcmliZShvYnNlcnZlU3RhdGUpO1xuICAgICAgICByZXR1cm4geyB1bnN1YnNjcmliZTogdW5zdWJzY3JpYmUgfTtcbiAgICAgIH1cbiAgICB9LCBfcmVmWyQkb2JzZXJ2YWJsZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LCBfcmVmO1xuICB9XG5cbiAgLy8gV2hlbiBhIHN0b3JlIGlzIGNyZWF0ZWQsIGFuIFwiSU5JVFwiIGFjdGlvbiBpcyBkaXNwYXRjaGVkIHNvIHRoYXQgZXZlcnlcbiAgLy8gcmVkdWNlciByZXR1cm5zIHRoZWlyIGluaXRpYWwgc3RhdGUuIFRoaXMgZWZmZWN0aXZlbHkgcG9wdWxhdGVzXG4gIC8vIHRoZSBpbml0aWFsIHN0YXRlIHRyZWUuXG4gIGRpc3BhdGNoKHsgdHlwZTogQWN0aW9uVHlwZXMuSU5JVCB9KTtcblxuICByZXR1cm4gX3JlZjIgPSB7XG4gICAgZGlzcGF0Y2g6IGRpc3BhdGNoLFxuICAgIHN1YnNjcmliZTogc3Vic2NyaWJlLFxuICAgIGdldFN0YXRlOiBnZXRTdGF0ZSxcbiAgICByZXBsYWNlUmVkdWNlcjogcmVwbGFjZVJlZHVjZXJcbiAgfSwgX3JlZjJbJCRvYnNlcnZhYmxlXSA9IG9ic2VydmFibGUsIF9yZWYyO1xufSIsIi8qKlxuICogUHJpbnRzIGEgd2FybmluZyBpbiB0aGUgY29uc29sZSBpZiBpdCBleGlzdHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgVGhlIHdhcm5pbmcgbWVzc2FnZS5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB3YXJuaW5nKG1lc3NhZ2UpIHtcbiAgLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjb25zb2xlLmVycm9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc29sZS5lcnJvcihtZXNzYWdlKTtcbiAgfVxuICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cbiAgdHJ5IHtcbiAgICAvLyBUaGlzIGVycm9yIHdhcyB0aHJvd24gYXMgYSBjb252ZW5pZW5jZSBzbyB0aGF0IGlmIHlvdSBlbmFibGVcbiAgICAvLyBcImJyZWFrIG9uIGFsbCBleGNlcHRpb25zXCIgaW4geW91ciBjb25zb2xlLFxuICAgIC8vIGl0IHdvdWxkIHBhdXNlIHRoZSBleGVjdXRpb24gYXQgdGhpcyBsaW5lLlxuICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1lbXB0eSAqL1xuICB9IGNhdGNoIChlKSB7fVxuICAvKiBlc2xpbnQtZW5hYmxlIG5vLWVtcHR5ICovXG59IiwiLyoqXG4gKiBDb21wb3NlcyBzaW5nbGUtYXJndW1lbnQgZnVuY3Rpb25zIGZyb20gcmlnaHQgdG8gbGVmdC4gVGhlIHJpZ2h0bW9zdFxuICogZnVuY3Rpb24gY2FuIHRha2UgbXVsdGlwbGUgYXJndW1lbnRzIGFzIGl0IHByb3ZpZGVzIHRoZSBzaWduYXR1cmUgZm9yXG4gKiB0aGUgcmVzdWx0aW5nIGNvbXBvc2l0ZSBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0gey4uLkZ1bmN0aW9ufSBmdW5jcyBUaGUgZnVuY3Rpb25zIHRvIGNvbXBvc2UuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IEEgZnVuY3Rpb24gb2J0YWluZWQgYnkgY29tcG9zaW5nIHRoZSBhcmd1bWVudCBmdW5jdGlvbnNcbiAqIGZyb20gcmlnaHQgdG8gbGVmdC4gRm9yIGV4YW1wbGUsIGNvbXBvc2UoZiwgZywgaCkgaXMgaWRlbnRpY2FsIHRvIGRvaW5nXG4gKiAoLi4uYXJncykgPT4gZihnKGgoLi4uYXJncykpKS5cbiAqL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjb21wb3NlKCkge1xuICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgZnVuY3MgPSBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICBmdW5jc1tfa2V5XSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgfVxuXG4gIGlmIChmdW5jcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGFyZykge1xuICAgICAgcmV0dXJuIGFyZztcbiAgICB9O1xuICB9XG5cbiAgaWYgKGZ1bmNzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBmdW5jc1swXTtcbiAgfVxuXG4gIHZhciBsYXN0ID0gZnVuY3NbZnVuY3MubGVuZ3RoIC0gMV07XG4gIHZhciByZXN0ID0gZnVuY3Muc2xpY2UoMCwgLTEpO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiByZXN0LnJlZHVjZVJpZ2h0KGZ1bmN0aW9uIChjb21wb3NlZCwgZikge1xuICAgICAgcmV0dXJuIGYoY29tcG9zZWQpO1xuICAgIH0sIGxhc3QuYXBwbHkodW5kZWZpbmVkLCBhcmd1bWVudHMpKTtcbiAgfTtcbn0iLCJpbXBvcnQgY3JlYXRlU3RvcmUgZnJvbSAnLi9jcmVhdGVTdG9yZSc7XG5pbXBvcnQgY29tYmluZVJlZHVjZXJzIGZyb20gJy4vY29tYmluZVJlZHVjZXJzJztcbmltcG9ydCBiaW5kQWN0aW9uQ3JlYXRvcnMgZnJvbSAnLi9iaW5kQWN0aW9uQ3JlYXRvcnMnO1xuaW1wb3J0IGFwcGx5TWlkZGxld2FyZSBmcm9tICcuL2FwcGx5TWlkZGxld2FyZSc7XG5pbXBvcnQgY29tcG9zZSBmcm9tICcuL2NvbXBvc2UnO1xuaW1wb3J0IHdhcm5pbmcgZnJvbSAnLi91dGlscy93YXJuaW5nJztcblxuLypcbiogVGhpcyBpcyBhIGR1bW15IGZ1bmN0aW9uIHRvIGNoZWNrIGlmIHRoZSBmdW5jdGlvbiBuYW1lIGhhcyBiZWVuIGFsdGVyZWQgYnkgbWluaWZpY2F0aW9uLlxuKiBJZiB0aGUgZnVuY3Rpb24gaGFzIGJlZW4gbWluaWZpZWQgYW5kIE5PREVfRU5WICE9PSAncHJvZHVjdGlvbicsIHdhcm4gdGhlIHVzZXIuXG4qL1xuZnVuY3Rpb24gaXNDcnVzaGVkKCkge31cblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgdHlwZW9mIGlzQ3J1c2hlZC5uYW1lID09PSAnc3RyaW5nJyAmJiBpc0NydXNoZWQubmFtZSAhPT0gJ2lzQ3J1c2hlZCcpIHtcbiAgd2FybmluZygnWW91IGFyZSBjdXJyZW50bHkgdXNpbmcgbWluaWZpZWQgY29kZSBvdXRzaWRlIG9mIE5PREVfRU5WID09PSBcXCdwcm9kdWN0aW9uXFwnLiAnICsgJ1RoaXMgbWVhbnMgdGhhdCB5b3UgYXJlIHJ1bm5pbmcgYSBzbG93ZXIgZGV2ZWxvcG1lbnQgYnVpbGQgb2YgUmVkdXguICcgKyAnWW91IGNhbiB1c2UgbG9vc2UtZW52aWZ5IChodHRwczovL2dpdGh1Yi5jb20vemVydG9zaC9sb29zZS1lbnZpZnkpIGZvciBicm93c2VyaWZ5ICcgKyAnb3IgRGVmaW5lUGx1Z2luIGZvciB3ZWJwYWNrIChodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzMwMDMwMDMxKSAnICsgJ3RvIGVuc3VyZSB5b3UgaGF2ZSB0aGUgY29ycmVjdCBjb2RlIGZvciB5b3VyIHByb2R1Y3Rpb24gYnVpbGQuJyk7XG59XG5cbmV4cG9ydCB7IGNyZWF0ZVN0b3JlLCBjb21iaW5lUmVkdWNlcnMsIGJpbmRBY3Rpb25DcmVhdG9ycywgYXBwbHlNaWRkbGV3YXJlLCBjb21wb3NlIH07IiwiaW1wb3J0IHtoLCBtb3VudCwgY29ubmVjdH0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHtjcmVhdGVTdG9yZX0gZnJvbSAncmVkdXgnO1xuXG5jb25zdCByZWR1Y2VyID0gKHN0YXRlID0ge30sIGFjdGlvbikgPT4ge1xuICBjb25zdCB7Zmlyc3RDb3VudGVyID0gMCwgc2Vjb25kQ291bnRlciA9IDB9ID0gc3RhdGU7XG4gIHN3aXRjaCAoYWN0aW9uLnR5cGUpIHtcbiAgICBjYXNlICdJTkNSRU1FTlRfMSc6XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihzdGF0ZSwge2ZpcnN0Q291bnRlcjogZmlyc3RDb3VudGVyICsgMX0pO1xuICAgIGNhc2UgJ0RFQ1JFTUVOVF8xJzpcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHN0YXRlLCB7Zmlyc3RDb3VudGVyOiBmaXJzdENvdW50ZXIgLSAxfSk7XG4gICAgY2FzZSAnSU5DUkVNRU5UXzInOlxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oc3RhdGUsIHtzZWNvbmRDb3VudGVyOiBzZWNvbmRDb3VudGVyICsgMX0pO1xuICAgIGNhc2UgJ0RFQ1JFTUVOVF8yJzpcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHN0YXRlLCB7c2Vjb25kQ291bnRlcjogc2Vjb25kQ291bnRlciAtIDF9KTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHN0YXRlO1xuICB9XG59O1xuXG5jb25zdCBzdG9yZSA9IGNyZWF0ZVN0b3JlKHJlZHVjZXIpO1xuXG5jb25zdCBzdWJzY3JpYmVUb0ZpcnN0Q291bnRlciA9IGNvbm5lY3Qoc3RvcmUsIHtcbiAgaW5jcmVtZW50OiAoKSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ0lOQ1JFTUVOVF8xJ30pLFxuICBkZWNyZW1lbnQ6ICgpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnREVDUkVNRU5UXzEnfSlcbn0sIHN0YXRlID0+IHN0YXRlLmZpcnN0Q291bnRlcik7XG5jb25zdCBzdWJzY3JpYmVUb1NlY29uZENvdW50ZXIgPSBjb25uZWN0KHN0b3JlLCB7XG4gIGluY3JlbWVudDogKCkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdJTkNSRU1FTlRfMid9KSxcbiAgZGVjcmVtZW50OiAoKSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ0RFQ1JFTUVOVF8yJ30pXG59LCBzdGF0ZSA9PiBzdGF0ZS5zZWNvbmRDb3VudGVyKTtcblxuY29uc3QgY291bnRlciA9ICh7Y291bnQsIGxhYmVsfSwgYWN0aW9ucykgPT4ge1xuXG4gIGNvbnN0IGJpbmdvID0gY291bnQgJSAyID09PSAwO1xuXG4gIHJldHVybiA8ZGl2IGJpbmdvPXtiaW5nb30+XG4gICAgPHNwYW4+Q291bnQ6IHtjb3VudH08L3NwYW4+XG4gICAgPGJ1dHRvbiBvbkNsaWNrPXthY3Rpb25zLmluY3JlbWVudH0+aW5jcmVtZW50IHtsYWJlbH08L2J1dHRvbj5cbiAgICA8YnV0dG9uIG9uQ2xpY2s9e2FjdGlvbnMuZGVjcmVtZW50fT5kZWNyZW1lbnQge2xhYmVsfTwvYnV0dG9uPlxuICA8L2Rpdj5cbn07XG5cbmNvbnN0IEp1c3RSZWFkZXIgPSAoe3JlYWRWYWx9KSA9PiA8cD5cbiAgSSBkbyByZWFkIHRoZSBjb3VudCA6IHtyZWFkVmFsfVxuPC9wPjtcblxuY29uc3QgQ291bnRlcjEgPSBzdWJzY3JpYmVUb0ZpcnN0Q291bnRlcihjb3VudGVyLCBzdGF0ZSA9PiAoe2NvdW50OiBzdGF0ZX0pKTtcbmNvbnN0IENvdW50ZXIyID0gc3Vic2NyaWJlVG9TZWNvbmRDb3VudGVyKGNvdW50ZXIsIHN0YXRlID0+ICh7Y291bnQ6IHN0YXRlfSkpO1xuY29uc3QgUmVhZGVyMSA9IHN1YnNjcmliZVRvRmlyc3RDb3VudGVyKEp1c3RSZWFkZXIsIHN0YXRlID0+ICh7cmVhZFZhbDogc3RhdGV9KSk7XG5cbmNvbnN0IEFwcCA9ICgpID0+IDxkaXY+XG4gIDxDb3VudGVyMSBsYWJlbD1cIlVuOiB3b290XCIvPlxuICA8Q291bnRlcjEgbGFiZWw9XCJBbm90aGVyIHVubyAhIVwiLz5cbiAgPENvdW50ZXIyIGxhYmVsPVwiRG9zOiBoYW5cIi8+XG4gIDxSZWFkZXIxLz5cbjwvZGl2PjtcblxubW91bnQoQXBwLCB7fSwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21haW4nKSk7Il0sIm5hbWVzIjpbIm1vdW50Iiwib2JqZWN0UHJvdG8iLCJoYXNPd25Qcm9wZXJ0eSIsInN5bVRvU3RyaW5nVGFnIiwibmF0aXZlT2JqZWN0VG9TdHJpbmciLCJyb290IiwicG9ueWZpbGwiLCIkJG9ic2VydmFibGUiXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU0sZUFBZSxHQUFHLENBQUMsS0FBSyxNQUFNO0VBQ2xDLFFBQVEsRUFBRSxNQUFNO0VBQ2hCLFFBQVEsRUFBRSxFQUFFO0VBQ1osS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDO0NBQ2YsQ0FBQyxDQUFDOzs7Ozs7Ozs7QUFTSCxBQUFlLFNBQVMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxRQUFRLEVBQUU7RUFDdkQsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEtBQUs7SUFDbkQsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFL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
