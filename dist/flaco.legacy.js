(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.flaco = global.flaco || {})));
}(this, (function (exports) { 'use strict';

var createTextVNode = function (value) { return ({
  nodeType: 'Text',
  children: [],
  props: {value: value}
}); };

/**
 * Transform hyperscript into virtual dom node
 * @param nodeType
 * @param props
 * @param children
 * @returns {*}
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
      children: flatChildren
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

var noop = function () {
};

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

var createDomNode = function (vnode) {
  return vnode.nodeType !== 'Text' ?
    document.createElement(vnode.nodeType) :
    document.createTextNode(String(vnode.props.value));
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
var traverse = function (vnode) {
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

function updateEventListeners (ref, ref$1) {
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
}

function updateAttributes (newVNode, oldVNode) {
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
}

var domFactory = createDomNode;

// apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
var domify = function updateDom (oldVnode, newVnode, parentDomNode) {
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
var render = function renderer (oldVnode, newVnode, parentDomNode, onNextTick) {
  if ( onNextTick === void 0 ) onNextTick = [];


  //1. transform the new vnode to a vnode connected to an actual dom element based on vnode versions diffing
  // i. note at this step occur dom insertions/removals
  // ii. it may collect sub tree to be dropped (or "unmounted")
  var ref = domify(oldVnode, newVnode, parentDomNode);
  var vnode = ref.vnode;
  var garbage = ref.garbage;

  if (garbage !== null) {
    // defer un mount lifecycle as it is not "visual"
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
    updateAttributes(vnode, tempOldNode)(vnode.dom);

    //fast path
    if (vnode.nodeType === 'Text') {
      return onNextTick;
    }

    var childrenCount = Math.max(tempOldNode.children.length, vnode.children.length);

    //todo check for a lifecycle to avoid to run onMount when component has been mounted yet
    if (vnode.onMount) {
      onNextTick.push(function () { return vnode.onMount(); });
    }

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

var mount = curry(function (comp, initProp, root) {
  var vnode = comp(initProp || {});
  var batch = render(null, vnode, root);
  nextTick(function () {
    while (batch.length) {
      var op = batch.shift();
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
  var oldNode = initialVNode;
  var updateFunc = function (props) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    var mount$$1 = oldNode.dom.parentNode;
    var newNode = comp.apply(void 0, [ Object.assign({children: oldNode.children || []}, oldNode.props, props) ].concat( args ));
    var nextBatch = render(oldNode, newNode, mount$$1);

    // danger zone !!!!
    // change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream: oldNode may be the child of someone ...(well that is a tree data structure after all :P )
    oldNode = Object.assign(oldNode || {}, newNode);
    // end danger zone

    nextTick(function () {
      while (nextBatch.length) {
        var op = nextBatch.shift();
        op();
      }
    });
    return newNode;
  };
  return updateFunc;
}

var lifeCycleFactory = function (method) { return curry(function (fn, comp) { return function (props) {
  var args = [], len = arguments.length - 1;
  while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

  var n = comp.apply(void 0, [ props ].concat( args ));
  n[method] = function () { return fn.apply(void 0, [ n ].concat( args )); };
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
 * Combinator to create a "stateful component": ie it will have its own state
 * @param comp
 * @returns {Function}
 */
var withState = function (comp) {
  return function () {
    var updateFunc;
    var wrapperComp = function (props) {
      var args = [], len = arguments.length - 1;
      while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

      // wrap the function call when the component has not been mounted yet (lazy evaluation to make sure the updateFunc has been set);
      var setState = function (newState) { return updateFunc(newState); };
      return comp.apply(void 0, [ props, setState ].concat( args ));
    };

    return onMount(function (vnode) {
      updateFunc = update(wrapperComp, vnode);
    }, wrapperComp);
  };
};

/**
 * Combinator to create a Elm like app
 * @param view
 */
var elm = function (view) {

  return function (ref) {
    var model = ref.model;
    var updates = ref.updates;
    var subscriptions = ref.subscriptions; if ( subscriptions === void 0 ) subscriptions = [];

    var actionStore = {};

    var comp = function (props) { return view(model, actionStore); };

    var initActionStore = function (vnode) {
      var updateFunc = update(comp, vnode);
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
    };
    var initSubscription = subscriptions.map(function (sub) { return function (vnode) { return sub(vnode, actionStore); }; });
    var initFunc = compose.apply(void 0, [ initActionStore ].concat( initSubscription ));

    return onMount(initFunc, comp);
  };
};

exports.h = h;
exports.elm = elm;
exports.withState = withState;
exports.render = render;
exports.mount = mount;
exports.update = update;
exports.onMount = onMount;
exports.onUnMount = onUnMount;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=flaco.legacy.js.map
