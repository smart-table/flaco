(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.flaco = global.flaco || {})));
}(this, (function (exports) { 'use strict';

var createTextVNode = function (value) { return ({
  nodeType: 'Text',
  children: [],
  props: {value: value},
  lifeCycle: 0
}); };

/**
 * Transform hyperscript into virtual dom node
 * @param nodeType {Function, String} - the HTML tag if string, a component or combinator otherwise
 * @param props {Object} - the list of properties/attributes associated to the related node
 * @param children - the virtual dom nodes related to the current node children
 * @returns {Object} - a virtual dom node
 */
function h (nodeType, props) {
  var children = [], len = arguments.length - 2;
  while ( len-- > 0 ) children[ len ] = arguments[ len + 2 ];

  var flatChildren = children.reduce(function (acc, child) {
    var childrenArray = Array.isArray(child) ? child : [child];
    return acc.concat(childrenArray);
  }, [])
    .map(function (child) {
      // normalize text node to have same structure than regular dom nodes
      var type = typeof child;
      return type === 'object' || type === 'function' ? child : createTextVNode(child);
    });

  if (typeof nodeType !== 'function') {//regular html/text node
    return {
      nodeType: nodeType,
      props: props,
      children: flatChildren,
      lifeCycle: 0
    };
  } else {
    var fullProps = Object.assign({children: flatChildren}, props);
    var comp = nodeType(fullProps);
    return typeof comp !== 'function' ? comp : h.apply(void 0, [ comp, props ].concat( flatChildren )); //functional comp vs combinator (HOC)
  }
}

function compose (first) {
  var fns = [], len = arguments.length - 1;
  while ( len-- > 0 ) fns[ len ] = arguments[ len + 1 ];

  return function () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    return fns.reduce(function (previous, current) { return current(previous); }, first.apply(void 0, args));
  };
}

function curry (fn, arityLeft) {
  var arity = arityLeft || fn.length;
  return function () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    var argLength = args.length || 1;
    if (arity === argLength) {
      return fn.apply(void 0, args);
    } else {
      var func = function () {
        var moreArgs = [], len = arguments.length;
        while ( len-- ) moreArgs[ len ] = arguments[ len ];

        return fn.apply(void 0, args.concat( moreArgs ));
      };
      return curry(func, arity - args.length);
    }
  };
}



function tap (fn) {
  return function (arg) {
    fn(arg);
    return arg;
  }
}

var nextTick = function (fn) { return setTimeout(fn, 0); };

var pairify = function (holder) { return function (key) { return [key, holder[key]]; }; };

var isShallowEqual = function (a, b) {
  var aKeys = Object.keys(a);
  var bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every(function (k) { return a[k] === b[k]; });
};

var ownKeys = function (obj) { return Object.keys(obj).filter(function (k) { return obj.hasOwnProperty(k); }); };

var isDeepEqual = function (a, b) {
  var type = typeof a;

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
    return a.length && b.length && a.every(function (item, i) { return isDeepEqual(a[i], b[i]); });
  }

  var aKeys = ownKeys(a);
  var bKeys = ownKeys(b);
  return aKeys.length === bKeys.length && aKeys.every(function (k) { return isDeepEqual(a[k], b[k]); });
};

var identity = function (a) { return a; };

var noop = function (_) {
};

var SVG_NP = 'http://www.w3.org/2000/svg';

var updateDomNodeFactory = function (method) { return function (items) { return tap(function (domNode) {
  for (var i = 0, list = items; i < list.length; i += 1) {
    var pair = list[i];

    domNode[method].apply(domNode, pair);
  }
}); }; };

var removeEventListeners = updateDomNodeFactory('removeEventListener');

var addEventListeners = updateDomNodeFactory('addEventListener');

var setAttributes = function (items) { return tap(function (domNode) {
  var attributes = items.filter(function (ref) {
    var key = ref[0];
    var value = ref[1];

    return typeof value !== 'function';
  });
  for (var i = 0, list = attributes; i < list.length; i += 1) {
    var ref = list[i];
    var key = ref[0];
    var value = ref[1];

    value === false ? domNode.removeAttribute(key) : domNode.setAttribute(key, value);
  }
}); };

var removeAttributes = function (items) { return tap(function (domNode) {
  for (var i = 0, list = items; i < list.length; i += 1) {
    var attr = list[i];

    domNode.removeAttribute(attr);
  }
}); };

var setTextNode = function (val) { return function (node) { return node.textContent = val; }; };

var createDomNode = function (vnode, parent) {
  if (vnode.nodeType === 'svg') {
    return document.createElementNS(SVG_NP, vnode.nodeType);
  } else if (vnode.nodeType === 'Text') {
    return document.createTextNode(vnode.nodeType);
  } else {
    return parent.namespaceURI === SVG_NP ? document.createElementNS(SVG_NP, vnode.nodeType) : document.createElement(vnode.nodeType);
  }
};

var getEventListeners = function (props) {
  return Object.keys(props)
    .filter(function (k) { return k.substr(0, 2) === 'on'; })
    .map(function (k) { return [k.substr(2).toLowerCase(), props[k]]; });
};

/**
 * generator free version of ./traverse.js
 * @param vnode
 * @returns {Array}
 */
var traverse =  function (vnode) {
  var output = [];
  output.push(vnode);
  if (vnode.children && vnode.children.length) {
    for (var i = 0, list = vnode.children; i < list.length; i += 1) {
      var child = list[i];

      output.push.apply(output, traverse(child));
    }
  }
  return output;
};

var updateEventListeners = function (ref, ref$1) {
  if ( ref === void 0 ) ref={};
  var newNodeProps = ref.props;
  if ( ref$1 === void 0 ) ref$1={};
  var oldNodeProps = ref$1.props;

  var newNodeEvents = getEventListeners(newNodeProps || {});
  var oldNodeEvents = getEventListeners(oldNodeProps || {});

  return newNodeEvents.length || oldNodeEvents.length ?
    compose(
      removeEventListeners(oldNodeEvents),
      addEventListeners(newNodeEvents)
    ) : noop;
};

var updateAttributes = function (newVNode, oldVNode) {
  var newVNodeProps = newVNode.props || {};
  var oldVNodeProps = oldVNode.props || {};

  if (isShallowEqual(newVNodeProps, oldVNodeProps)) {
    return noop;
  }

  if (newVNode.nodeType === 'Text') {
    return setTextNode(newVNode.props.value);
  }

  var newNodeKeys = Object.keys(newVNodeProps);
  var oldNodeKeys = Object.keys(oldVNodeProps);
  var attributesToRemove = oldNodeKeys.filter(function (k) { return !newNodeKeys.includes(k); });

  return compose(
    removeAttributes(attributesToRemove),
    setAttributes(newNodeKeys.map(pairify(newVNodeProps)))
  );
};

var domFactory = createDomNode;

// apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
var domify = function (oldVnode, newVnode, parentDomNode) {
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
var render = function (oldVnode, newVnode, parentDomNode, onNextTick) {
  if ( onNextTick === void 0 ) onNextTick = [];


  //1. transform the new vnode to a vnode connected to an actual dom element based on vnode versions diffing
  // i. note at this step occur dom insertions/removals
  // ii. it may collect sub tree to be dropped (or "unmounted")
  var ref = domify(oldVnode, newVnode, parentDomNode);
  var vnode = ref.vnode;
  var garbage = ref.garbage;

  if (garbage !== null) {
    // defer unmount lifecycle as it is not "visual"
    for (var i$1 = 0, list = traverse(garbage); i$1 < list.length; i$1 += 1) {
      var g = list[i$1];

      if (g.onUnMount) {
        onNextTick.push(g.onUnMount);
      }
    }
  }

  //Normalisation of old node (in case of a replace we will consider old node as empty node (no children, no props))
  var tempOldNode = garbage !== null || !oldVnode ? {length: 0, children: [], props: {}} : oldVnode;

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
      onNextTick.push(function () { return vnode.onMount(); });
    }

    var childrenCount = Math.max(tempOldNode.children.length, vnode.children.length);

    //async will be deferred as it is not "visual"
    var setListeners = updateEventListeners(vnode, tempOldNode);
    if (setListeners !== noop) {
      onNextTick.push(function () { return setListeners(vnode.dom); });
    }

    //3 recursively traverse children to update dom and collect functions to process on next tick
    if (childrenCount > 0) {
      for (var i = 0; i < childrenCount; i++) {
        // we pass onNextTick as reference (improve perf: memory + speed)
        render(tempOldNode.children[i], vnode.children[i], vnode.dom, onNextTick);
      }
    }
  }

  return onNextTick;
};

var hydrate = function (vnode, dom) {
  'use strict';
  var hydrated = Object.assign({}, vnode);
  var domChildren = Array.from(dom.childNodes).filter(function (n) { return n.nodeType !== 3 || n.nodeValue.trim() !== ''; });
  hydrated.dom = dom;
  hydrated.children = vnode.children.map(function (child, i) { return hydrate(child, domChildren[i]); });
  return hydrated;
};

var mount = curry(function (comp, initProp, root) {
  var vnode = comp.nodeType !== void 0 ? comp : comp(initProp || {});
  var oldVNode = root.children.length ? hydrate(vnode, root.children[0]) : null;
  var batch = render(oldVNode, vnode, root);
  nextTick(function () {
    for (var i = 0, list = batch; i < list.length; i += 1) {
      var op = list[i];

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
var update = function (comp, initialVNode) {
  var oldNode = initialVNode;
  return function (props) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    var mount$$1 = oldNode.dom.parentNode;
    var newNode = comp.apply(void 0, [ Object.assign({children: oldNode.children || []}, oldNode.props, props) ].concat( args ));
    var nextBatch = render(oldNode, newNode, mount$$1);

    // danger zone !!!!
    // change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream: oldNode may be the child of someone ...(well that is a tree data structure after all :P )
    oldNode = Object.assign(oldNode || {}, newNode);
    // end danger zone

    nextTick(function (_) {
      for (var i = 0, list = nextBatch; i < list.length; i += 1) {
        var op = list[i];

        op();
      }
    });
    return newNode;
  };
};

var lifeCycleFactory = function (method) { return curry(function (fn, comp) { return function (props) {
  var args = [], len = arguments.length - 1;
  while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

  var n = comp.apply(void 0, [ props ].concat( args ));
  var applyFn = function () { return fn.apply(void 0, [ n ].concat( args )); };
  var current = n[method];
  n[method] = current ? compose(current, applyFn) : applyFn;
  return n;
}; }); };

/**
 * life cycle: when the component is mounted
 */
var onMount = lifeCycleFactory('onMount');

/**
 * life cycle: when the component is unmounted
 */
var onUnMount = lifeCycleFactory('onUnMount');

/**
 * life cycle: before the component is updated
 */
var onUpdate = lifeCycleFactory('onUpdate');

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp {Function} - the component
 * @returns {Function} - a new wrapped component
 */
var withState = function (comp) { return function () {
  var updateFunc;
  var wrapperComp = function (props) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    //lazy evaluate updateFunc (to make sure it is defined
    var setState = function (newState) { return updateFunc(newState); };
    return comp.apply(void 0, [ props, setState ].concat( args ));
  };
  var setUpdateFunction = function (vnode) {
    updateFunc = update(wrapperComp, vnode);
  };

  return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
}; };

/**
 * Combinator to create a Elm like app
 * @param view {Function} - a component which takes as arguments the current model and the list of updates
 * @returns {Function} - a Elm like application whose properties "model", "updates" and "subscriptions" will define the related domain specific objects
 */
var elm = function (view) { return function (ref) {
  if ( ref === void 0 ) ref={};
  var model = ref.model;
  var updates = ref.updates;
  var subscriptions = ref.subscriptions; if ( subscriptions === void 0 ) subscriptions = [];

  var updateFunc;
  var actionStore = {};
  var loop = function () {
    var update$1 = list[i];

    actionStore[update$1] = function () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      model = updates[update$1].apply(updates, [ model ].concat( args )); //todo consider side effects, middlewares, etc
      return updateFunc(model, actionStore);
    };
  };

  for (var i = 0, list = Object.keys(updates); i < list.length; i += 1) loop();

  var comp = function () { return view(model, actionStore); };

  var initActionStore = function (vnode) {
    updateFunc = update(comp, vnode);
  };
  var initSubscription = subscriptions.map(function (sub) { return function (vnode) { return sub(vnode, actionStore); }; });
  var initFunc = compose.apply(void 0, [ initActionStore ].concat( initSubscription ));

  return onMount(initFunc, comp);
}; };

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change under specific circumstances
 * @param store {Object} - The store (implementing the same api than Redux store
 * @param sliceState {Function} [state => state] - A function which takes as argument the state and return a "transformed" state (like partial, etc) relevant to the container
 * @returns {Function} - A container factory with the following arguments:
 *  - mapStateToProp: a function which takes as argument what the "sliceState" function returns and returns an object to be blended into the properties of the component (default to identity function)
 *  - shouldUpdate: a function which takes as arguments the previous and the current versions of what "sliceState" function returns to returns a boolean defining whether the component should be updated (default to a deepEqual check)
 */
var connect = function (store, sliceState) {
    if ( sliceState === void 0 ) sliceState = identity;

    return function (comp, mapStateToProp, shouldUpate) {
      if ( mapStateToProp === void 0 ) mapStateToProp = identity;
      if ( shouldUpate === void 0 ) shouldUpate = function (a, b) { return isDeepEqual(a, b) === false; };

      return function (initProp) {
      var componentProps = initProp;
      var updateFunc, previousStateSlice, unsubscriber;

      var wrapperComp = function (props) {
        var args = [], len = arguments.length - 1;
        while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

        return comp.apply(void 0, [ Object.assign(props, mapStateToProp(sliceState(store.getState()))) ].concat( args ));
      };

      var subscribe = onMount(function (vnode) {
        updateFunc = update(wrapperComp, vnode);
        unsubscriber = store.subscribe(function () {
          var stateSlice = sliceState(store.getState());
          if (shouldUpate(previousStateSlice, stateSlice) === true) {
            Object.assign(componentProps, mapStateToProp(stateSlice));
            updateFunc(componentProps);
            previousStateSlice = stateSlice;
          }
        });
      });

      var unsubscribe = onUnMount(function () {
        unsubscriber();
      });

      return compose(subscribe, unsubscribe)(wrapperComp);
    };

    }};

exports.h = h;
exports.elm = elm;
exports.withState = withState;
exports.render = render;
exports.mount = mount;
exports.update = update;
exports.isDeepEqual = isDeepEqual;
exports.onMount = onMount;
exports.onUnMount = onUnMount;
exports.connect = connect;
exports.onUpdate = onUpdate;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=flaco.legacy.js.map
