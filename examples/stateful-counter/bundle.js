(function () {
'use strict';

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
      children: flatChildren,
      lifeCycle: 0
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





const noop = _ => {
};

const SVG_NP = 'http://www.w3.org/2000/svg';

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

const main = document.getElementById('main');

const SpanCount = ({count}) => h( 'p', null, h( 'span', null, "Another child " ), count );

const Counter = withState(({count = 0}, setState) => {
  return h( 'div', null,
    h( 'button', { onClick: ev => (setState({count: count + 1})) }, "Increment"),
    h( 'button', { onClick: ev => (setState({count: count - 1})) }, "Decrement"),
    h( SpanCount, { count: count })
  )
});

const m = mount((initProp) => {
  return (h( 'div', null,
    h( Counter, { count: initProp.firstCount }),
    h( Counter, { count: initProp.secondCount })
  ));
}, {firstCount: 4, secondCount: 8});

m(main);

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvaC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL3RyYXZlcnNlLmpzIiwiLi4vLi4vbGliL3RyZWUuanMiLCIuLi8uLi9saWIvdXBkYXRlLmpzIiwiLi4vLi4vbGliL2xpZmVDeWNsZXMuanMiLCIuLi8uLi9saWIvd2l0aFN0YXRlLmpzIiwiLi4vLi4vbGliL2VsbS5qcyIsIi4uLy4uL2xpYi9jb25uZWN0LmpzIiwiaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9LFxuICBsaWZlQ3ljbGU6IDBcbn0pO1xuXG4vKipcbiAqIFRyYW5zZm9ybSBoeXBlcnNjcmlwdCBpbnRvIHZpcnR1YWwgZG9tIG5vZGVcbiAqIEBwYXJhbSBub2RlVHlwZSB7RnVuY3Rpb24sIFN0cmluZ30gLSB0aGUgSFRNTCB0YWcgaWYgc3RyaW5nLCBhIGNvbXBvbmVudCBvciBjb21iaW5hdG9yIG90aGVyd2lzZVxuICogQHBhcmFtIHByb3BzIHtPYmplY3R9IC0gdGhlIGxpc3Qgb2YgcHJvcGVydGllcy9hdHRyaWJ1dGVzIGFzc29jaWF0ZWQgdG8gdGhlIHJlbGF0ZWQgbm9kZVxuICogQHBhcmFtIGNoaWxkcmVuIC0gdGhlIHZpcnR1YWwgZG9tIG5vZGVzIHJlbGF0ZWQgdG8gdGhlIGN1cnJlbnQgbm9kZSBjaGlsZHJlblxuICogQHJldHVybnMge09iamVjdH0gLSBhIHZpcnR1YWwgZG9tIG5vZGVcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaCAobm9kZVR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICBjb25zdCBmbGF0Q2hpbGRyZW4gPSBjaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gQXJyYXkuaXNBcnJheShjaGlsZCkgPyBjaGlsZCA6IFtjaGlsZF07XG4gICAgcmV0dXJuIGFjYy5jb25jYXQoY2hpbGRyZW5BcnJheSk7XG4gIH0sIFtdKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gbm9ybWFsaXplIHRleHQgbm9kZSB0byBoYXZlIHNhbWUgc3RydWN0dXJlIHRoYW4gcmVndWxhciBkb20gbm9kZXNcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgY2hpbGQ7XG4gICAgICByZXR1cm4gdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkIDogY3JlYXRlVGV4dFZOb2RlKGNoaWxkKTtcbiAgICB9KTtcblxuICBpZiAodHlwZW9mIG5vZGVUeXBlICE9PSAnZnVuY3Rpb24nKSB7Ly9yZWd1bGFyIGh0bWwvdGV4dCBub2RlXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGVUeXBlLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgY2hpbGRyZW46IGZsYXRDaGlsZHJlbixcbiAgICAgIGxpZmVDeWNsZTogMFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZnVsbFByb3BzID0gT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IGZsYXRDaGlsZHJlbn0sIHByb3BzKTtcbiAgICBjb25zdCBjb21wID0gbm9kZVR5cGUoZnVsbFByb3BzKTtcbiAgICByZXR1cm4gdHlwZW9mIGNvbXAgIT09ICdmdW5jdGlvbicgPyBjb21wIDogaChjb21wLCBwcm9wcywgLi4uZmxhdENoaWxkcmVuKTsgLy9mdW5jdGlvbmFsIGNvbXAgdnMgY29tYmluYXRvciAoSE9DKVxuICB9XG59OyIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBjb25zdCBuZXh0VGljayA9IGZuID0+IHNldFRpbWVvdXQoZm4sIDApO1xuXG5leHBvcnQgY29uc3QgcGFpcmlmeSA9IGhvbGRlciA9PiBrZXkgPT4gW2tleSwgaG9sZGVyW2tleV1dO1xuXG5leHBvcnQgY29uc3QgaXNTaGFsbG93RXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCBhS2V5cyA9IE9iamVjdC5rZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IE9iamVjdC5rZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoKGspID0+IGFba10gPT09IGJba10pO1xufTtcblxuY29uc3Qgb3duS2V5cyA9IG9iaiA9PiBPYmplY3Qua2V5cyhvYmopLmZpbHRlcihrID0+IG9iai5oYXNPd25Qcm9wZXJ0eShrKSk7XG5cbmV4cG9ydCBjb25zdCBpc0RlZXBFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IHR5cGUgPSB0eXBlb2YgYTtcblxuICAvL3Nob3J0IHBhdGgocylcbiAgaWYgKGEgPT09IGIpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSB0eXBlb2YgYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG5cbiAgLy8gb2JqZWN0cyAuLi5cbiAgaWYgKGEgPT09IG51bGwgfHwgYiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KGEpKSB7XG4gICAgcmV0dXJuIGEubGVuZ3RoICYmIGIubGVuZ3RoICYmIGEuZXZlcnkoKGl0ZW0sIGkpID0+IGlzRGVlcEVxdWFsKGFbaV0sIGJbaV0pKTtcbiAgfVxuXG4gIGNvbnN0IGFLZXlzID0gb3duS2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBvd25LZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoayA9PiBpc0RlZXBFcXVhbChhW2tdLCBiW2tdKSk7XG59O1xuXG5leHBvcnQgY29uc3QgaWRlbnRpdHkgPSBhID0+IGE7XG5cbmV4cG9ydCBjb25zdCBub29wID0gXyA9PiB7XG59O1xuIiwiaW1wb3J0IHt0YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IFNWR19OUCA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc7XG5cbmNvbnN0IHVwZGF0ZURvbU5vZGVGYWN0b3J5ID0gKG1ldGhvZCkgPT4gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IHBhaXIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlW21ldGhvZF0oLi4ucGFpcik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgncmVtb3ZlRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IGFkZEV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ2FkZEV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBzZXRBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoKGRvbU5vZGUpID0+IHtcbiAgY29uc3QgYXR0cmlidXRlcyA9IGl0ZW1zLmZpbHRlcigoW2tleSwgdmFsdWVdKSA9PiB0eXBlb2YgdmFsdWUgIT09ICdmdW5jdGlvbicpO1xuICBmb3IgKGxldCBba2V5LCB2YWx1ZV0gb2YgYXR0cmlidXRlcykge1xuICAgIHZhbHVlID09PSBmYWxzZSA/IGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGtleSkgOiBkb21Ob2RlLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgfVxufSk7XG5leHBvcnQgY29uc3QgcmVtb3ZlQXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBhdHRyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3Qgc2V0VGV4dE5vZGUgPSB2YWwgPT4gbm9kZSA9PiBub2RlLnRleHRDb250ZW50ID0gdmFsO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlRG9tTm9kZSA9ICh2bm9kZSwgcGFyZW50KSA9PiB7XG4gIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ3N2ZycpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OUCwgdm5vZGUubm9kZVR5cGUpO1xuICB9IGVsc2UgaWYgKHZub2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodm5vZGUubm9kZVR5cGUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwYXJlbnQubmFtZXNwYWNlVVJJID09PSBTVkdfTlAgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05QLCB2bm9kZS5ub2RlVHlwZSkgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHZub2RlLm5vZGVUeXBlKTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGdldEV2ZW50TGlzdGVuZXJzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcylcbiAgICAuZmlsdGVyKGsgPT4gay5zdWJzdHIoMCwgMikgPT09ICdvbicpXG4gICAgLm1hcChrID0+IFtrLnN1YnN0cigyKS50b0xvd2VyQ2FzZSgpLCBwcm9wc1trXV0pO1xufTtcbiIsImV4cG9ydCBjb25zdCB0cmF2ZXJzZSA9IGZ1bmN0aW9uICogKHZub2RlKSB7XG4gIHlpZWxkIHZub2RlO1xuICBpZiAodm5vZGUuY2hpbGRyZW4gJiYgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2Ygdm5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIHlpZWxkICogdHJhdmVyc2UoY2hpbGQpO1xuICAgIH1cbiAgfVxufTsiLCJpbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgaXNTaGFsbG93RXF1YWwsXG4gIHBhaXJpZnksXG4gIG5leHRUaWNrLFxuICBub29wXG59IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQge1xuICByZW1vdmVBdHRyaWJ1dGVzLFxuICBzZXRBdHRyaWJ1dGVzLFxuICBzZXRUZXh0Tm9kZSxcbiAgY3JlYXRlRG9tTm9kZSxcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMsXG4gIGFkZEV2ZW50TGlzdGVuZXJzLFxuICBnZXRFdmVudExpc3RlbmVycyxcbn0gZnJvbSAnLi9kb21VdGlsJztcbmltcG9ydCB7dHJhdmVyc2V9IGZyb20gJy4vdHJhdmVyc2UnO1xuXG5mdW5jdGlvbiB1cGRhdGVFdmVudExpc3RlbmVycyAoe3Byb3BzOm5ld05vZGVQcm9wc309e30sIHtwcm9wczpvbGROb2RlUHJvcHN9PXt9KSB7XG4gIGNvbnN0IG5ld05vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhuZXdOb2RlUHJvcHMgfHwge30pO1xuICBjb25zdCBvbGROb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMob2xkTm9kZVByb3BzIHx8IHt9KTtcblxuICByZXR1cm4gbmV3Tm9kZUV2ZW50cy5sZW5ndGggfHwgb2xkTm9kZUV2ZW50cy5sZW5ndGggP1xuICAgIGNvbXBvc2UoXG4gICAgICByZW1vdmVFdmVudExpc3RlbmVycyhvbGROb2RlRXZlbnRzKSxcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKG5ld05vZGVFdmVudHMpXG4gICAgKSA6IG5vb3A7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUF0dHJpYnV0ZXMgKG5ld1ZOb2RlLCBvbGRWTm9kZSkge1xuICBjb25zdCBuZXdWTm9kZVByb3BzID0gbmV3Vk5vZGUucHJvcHMgfHwge307XG4gIGNvbnN0IG9sZFZOb2RlUHJvcHMgPSBvbGRWTm9kZS5wcm9wcyB8fCB7fTtcblxuICBpZiAoaXNTaGFsbG93RXF1YWwobmV3Vk5vZGVQcm9wcywgb2xkVk5vZGVQcm9wcykpIHtcbiAgICByZXR1cm4gbm9vcDtcbiAgfVxuXG4gIGlmIChuZXdWTm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgcmV0dXJuIHNldFRleHROb2RlKG5ld1ZOb2RlLnByb3BzLnZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IG5ld05vZGVLZXlzID0gT2JqZWN0LmtleXMobmV3Vk5vZGVQcm9wcyk7XG4gIGNvbnN0IG9sZE5vZGVLZXlzID0gT2JqZWN0LmtleXMob2xkVk5vZGVQcm9wcyk7XG4gIGNvbnN0IGF0dHJpYnV0ZXNUb1JlbW92ZSA9IG9sZE5vZGVLZXlzLmZpbHRlcihrID0+ICFuZXdOb2RlS2V5cy5pbmNsdWRlcyhrKSk7XG5cbiAgcmV0dXJuIGNvbXBvc2UoXG4gICAgcmVtb3ZlQXR0cmlidXRlcyhhdHRyaWJ1dGVzVG9SZW1vdmUpLFxuICAgIHNldEF0dHJpYnV0ZXMobmV3Tm9kZUtleXMubWFwKHBhaXJpZnkobmV3Vk5vZGVQcm9wcykpKVxuICApO1xufVxuXG5jb25zdCBkb21GYWN0b3J5ID0gY3JlYXRlRG9tTm9kZTtcblxuLy8gYXBwbHkgdm5vZGUgZGlmZmluZyB0byBhY3R1YWwgZG9tIG5vZGUgKGlmIG5ldyBub2RlID0+IGl0IHdpbGwgYmUgbW91bnRlZCBpbnRvIHRoZSBwYXJlbnQpXG5jb25zdCBkb21pZnkgPSBmdW5jdGlvbiB1cGRhdGVEb20gKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSkge1xuICBpZiAoIW9sZFZub2RlKSB7Ly90aGVyZSBpcyBubyBwcmV2aW91cyB2bm9kZVxuICAgIGlmIChuZXdWbm9kZSkgey8vbmV3IG5vZGUgPT4gd2UgaW5zZXJ0XG4gICAgICBuZXdWbm9kZS5kb20gPSBwYXJlbnREb21Ob2RlLmFwcGVuZENoaWxkKGRvbUZhY3RvcnkobmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICByZXR1cm4ge3Zub2RlOiBuZXdWbm9kZSwgZ2FyYmFnZTogbnVsbH07XG4gICAgfSBlbHNlIHsvL2Vsc2UgKGlycmVsZXZhbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpXG4gICAgfVxuICB9IGVsc2Ugey8vdGhlcmUgaXMgYSBwcmV2aW91cyB2bm9kZVxuICAgIGlmICghbmV3Vm5vZGUpIHsvL3dlIG11c3QgcmVtb3ZlIHRoZSByZWxhdGVkIGRvbSBub2RlXG4gICAgICBwYXJlbnREb21Ob2RlLnJlbW92ZUNoaWxkKG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4gKHtnYXJiYWdlOiBvbGRWbm9kZSwgZG9tOiBudWxsfSk7XG4gICAgfSBlbHNlIGlmIChuZXdWbm9kZS5ub2RlVHlwZSAhPT0gb2xkVm5vZGUubm9kZVR5cGUpIHsvL2l0IG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IGRvbUZhY3RvcnkobmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHBhcmVudERvbU5vZGUucmVwbGFjZUNoaWxkKG5ld1Zub2RlLmRvbSwgb2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogb2xkVm5vZGUsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfSBlbHNlIHsvLyBvbmx5IHVwZGF0ZSBhdHRyaWJ1dGVzXG4gICAgICBuZXdWbm9kZS5kb20gPSBvbGRWbm9kZS5kb207XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSBvbGRWbm9kZS5saWZlQ3ljbGUgKyAxO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBudWxsLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiByZW5kZXIgYSB2aXJ0dWFsIGRvbSBub2RlLCBkaWZmaW5nIGl0IHdpdGggaXRzIHByZXZpb3VzIHZlcnNpb24sIG1vdW50aW5nIGl0IGluIGEgcGFyZW50IGRvbSBub2RlXG4gKiBAcGFyYW0gb2xkVm5vZGVcbiAqIEBwYXJhbSBuZXdWbm9kZVxuICogQHBhcmFtIHBhcmVudERvbU5vZGVcbiAqIEBwYXJhbSBvbk5leHRUaWNrIGNvbGxlY3Qgb3BlcmF0aW9ucyB0byBiZSBwcm9jZXNzZWQgb24gbmV4dCB0aWNrXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmV4cG9ydCBjb25zdCByZW5kZXIgPSBmdW5jdGlvbiByZW5kZXJlciAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlLCBvbk5leHRUaWNrID0gW10pIHtcblxuICAvLzEuIHRyYW5zZm9ybSB0aGUgbmV3IHZub2RlIHRvIGEgdm5vZGUgY29ubmVjdGVkIHRvIGFuIGFjdHVhbCBkb20gZWxlbWVudCBiYXNlZCBvbiB2bm9kZSB2ZXJzaW9ucyBkaWZmaW5nXG4gIC8vIGkuIG5vdGUgYXQgdGhpcyBzdGVwIG9jY3VyIGRvbSBpbnNlcnRpb25zL3JlbW92YWxzXG4gIC8vIGlpLiBpdCBtYXkgY29sbGVjdCBzdWIgdHJlZSB0byBiZSBkcm9wcGVkIChvciBcInVubW91bnRlZFwiKVxuICBjb25zdCB7dm5vZGUsIGdhcmJhZ2V9ID0gZG9taWZ5KG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSk7XG5cbiAgaWYgKGdhcmJhZ2UgIT09IG51bGwpIHtcbiAgICAvLyBkZWZlciB1bm1vdW50IGxpZmVjeWNsZSBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGZvciAobGV0IGcgb2YgdHJhdmVyc2UoZ2FyYmFnZSkpIHtcbiAgICAgIGlmIChnLm9uVW5Nb3VudCkge1xuICAgICAgICBvbk5leHRUaWNrLnB1c2goZy5vblVuTW91bnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vTm9ybWFsaXNhdGlvbiBvZiBvbGQgbm9kZSAoaW4gY2FzZSBvZiBhIHJlcGxhY2Ugd2Ugd2lsbCBjb25zaWRlciBvbGQgbm9kZSBhcyBlbXB0eSBub2RlIChubyBjaGlsZHJlbiwgbm8gcHJvcHMpKVxuICBjb25zdCB0ZW1wT2xkTm9kZSA9IGdhcmJhZ2UgIT09IG51bGwgfHwgIW9sZFZub2RlID8ge2xlbmd0aDogMCwgY2hpbGRyZW46IFtdLCBwcm9wczoge319IDogb2xkVm5vZGU7XG5cbiAgaWYgKHZub2RlKSB7XG5cbiAgICAvLzIuIHVwZGF0ZSBkb20gYXR0cmlidXRlcyBiYXNlZCBvbiB2bm9kZSBwcm9wIGRpZmZpbmcuXG4gICAgLy9zeW5jXG4gICAgaWYgKHZub2RlLm9uVXBkYXRlICYmIHZub2RlLmxpZmVDeWNsZSA+IDEpIHtcbiAgICAgIHZub2RlLm9uVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlQXR0cmlidXRlcyh2bm9kZSwgdGVtcE9sZE5vZGUpKHZub2RlLmRvbSk7XG5cbiAgICAvL2Zhc3QgcGF0aFxuICAgIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgICByZXR1cm4gb25OZXh0VGljaztcbiAgICB9XG5cbiAgICBpZiAodm5vZGUub25Nb3VudCAmJiB2bm9kZS5saWZlQ3ljbGUgPT09IDEpIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiB2bm9kZS5vbk1vdW50KCkpO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuQ291bnQgPSBNYXRoLm1heCh0ZW1wT2xkTm9kZS5jaGlsZHJlbi5sZW5ndGgsIHZub2RlLmNoaWxkcmVuLmxlbmd0aCk7XG5cbiAgICAvL2FzeW5jIHdpbGwgYmUgZGVmZXJyZWQgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBjb25zdCBzZXRMaXN0ZW5lcnMgPSB1cGRhdGVFdmVudExpc3RlbmVycyh2bm9kZSwgdGVtcE9sZE5vZGUpO1xuICAgIGlmIChzZXRMaXN0ZW5lcnMgIT09IG5vb3ApIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiBzZXRMaXN0ZW5lcnModm5vZGUuZG9tKSk7XG4gICAgfVxuXG4gICAgLy8zIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIGNoaWxkcmVuIHRvIHVwZGF0ZSBkb20gYW5kIGNvbGxlY3QgZnVuY3Rpb25zIHRvIHByb2Nlc3Mgb24gbmV4dCB0aWNrXG4gICAgaWYgKGNoaWxkcmVuQ291bnQgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuQ291bnQ7IGkrKykge1xuICAgICAgICAvLyB3ZSBwYXNzIG9uTmV4dFRpY2sgYXMgcmVmZXJlbmNlIChpbXByb3ZlIHBlcmY6IG1lbW9yeSArIHNwZWVkKVxuICAgICAgICByZW5kZXIodGVtcE9sZE5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5kb20sIG9uTmV4dFRpY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvbk5leHRUaWNrO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGh5ZHJhdGUgKHZub2RlLCBkb20pIHtcbiAgJ3VzZSBzdHJpY3QnO1xuICBjb25zdCBoeWRyYXRlZCA9IE9iamVjdC5hc3NpZ24oe30sIHZub2RlKTtcbiAgY29uc3QgZG9tQ2hpbGRyZW4gPSBBcnJheS5mcm9tKGRvbS5jaGlsZE5vZGVzKS5maWx0ZXIobiA9PiBuLm5vZGVUeXBlICE9PSAzIHx8IG4ubm9kZVZhbHVlLnRyaW0oKSAhPT0gJycpO1xuICBoeWRyYXRlZC5kb20gPSBkb207XG4gIGh5ZHJhdGVkLmNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW4ubWFwKChjaGlsZCwgaSkgPT4gaHlkcmF0ZShjaGlsZCwgZG9tQ2hpbGRyZW5baV0pKTtcbiAgcmV0dXJuIGh5ZHJhdGVkO1xufVxuXG5leHBvcnQgY29uc3QgbW91bnQgPSBjdXJyeShmdW5jdGlvbiAoY29tcCwgaW5pdFByb3AsIHJvb3QpIHtcbiAgY29uc3Qgdm5vZGUgPSBjb21wLm5vZGVUeXBlICE9PSB2b2lkIDAgPyBjb21wIDogY29tcChpbml0UHJvcCB8fCB7fSk7XG4gIGNvbnN0IG9sZFZOb2RlID0gcm9vdC5jaGlsZHJlbi5sZW5ndGggPyBoeWRyYXRlKHZub2RlLCByb290LmNoaWxkcmVuWzBdKSA6IG51bGw7XG4gIGNvbnN0IGJhdGNoID0gcmVuZGVyKG9sZFZOb2RlLCB2bm9kZSwgcm9vdCk7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKGxldCBvcCBvZiBiYXRjaCkge1xuICAgICAgb3AoKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdm5vZGU7XG59KTsiLCJpbXBvcnQge3JlbmRlcn0gZnJvbSAnLi90cmVlJztcbmltcG9ydCB7bmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ3JlYXRlIGEgZnVuY3Rpb24gd2hpY2ggd2lsbCB0cmlnZ2VyIGFuIHVwZGF0ZSBvZiB0aGUgY29tcG9uZW50IHdpdGggdGhlIHBhc3NlZCBzdGF0ZVxuICogQHBhcmFtIGNvbXAge0Z1bmN0aW9ufSAtIHRoZSBjb21wb25lbnQgdG8gdXBkYXRlXG4gKiBAcGFyYW0gaW5pdGlhbFZOb2RlIC0gdGhlIGluaXRpYWwgdmlydHVhbCBkb20gbm9kZSByZWxhdGVkIHRvIHRoZSBjb21wb25lbnQgKGllIG9uY2UgaXQgaGFzIGJlZW4gbW91bnRlZClcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSB0aGUgdXBkYXRlIGZ1bmN0aW9uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVwZGF0ZSAoY29tcCwgaW5pdGlhbFZOb2RlKSB7XG4gIGxldCBvbGROb2RlID0gaW5pdGlhbFZOb2RlO1xuICBjb25zdCB1cGRhdGVGdW5jID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgbW91bnQgPSBvbGROb2RlLmRvbS5wYXJlbnROb2RlO1xuICAgIGNvbnN0IG5ld05vZGUgPSBjb21wKE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBvbGROb2RlLmNoaWxkcmVuIHx8IFtdfSwgb2xkTm9kZS5wcm9wcywgcHJvcHMpLCAuLi5hcmdzKTtcbiAgICBjb25zdCBuZXh0QmF0Y2ggPSByZW5kZXIob2xkTm9kZSwgbmV3Tm9kZSwgbW91bnQpO1xuXG4gICAgLy8gZGFuZ2VyIHpvbmUgISEhIVxuICAgIC8vIGNoYW5nZSBieSBrZWVwaW5nIHRoZSBzYW1lIHJlZmVyZW5jZSBzbyB0aGUgZXZlbnR1YWwgcGFyZW50IG5vZGUgZG9lcyBub3QgbmVlZCB0byBiZSBcImF3YXJlXCIgdHJlZSBtYXkgaGF2ZSBjaGFuZ2VkIGRvd25zdHJlYW06IG9sZE5vZGUgbWF5IGJlIHRoZSBjaGlsZCBvZiBzb21lb25lIC4uLih3ZWxsIHRoYXQgaXMgYSB0cmVlIGRhdGEgc3RydWN0dXJlIGFmdGVyIGFsbCA6UCApXG4gICAgb2xkTm9kZSA9IE9iamVjdC5hc3NpZ24ob2xkTm9kZSB8fCB7fSwgbmV3Tm9kZSk7XG4gICAgLy8gZW5kIGRhbmdlciB6b25lXG5cbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBmb3IgKGxldCBvcCBvZiBuZXh0QmF0Y2gpIHtcbiAgICAgICAgb3AoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZTtcbiAgfTtcbiAgcmV0dXJuIHVwZGF0ZUZ1bmM7XG59IiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgbGlmZUN5Y2xlRmFjdG9yeSA9IG1ldGhvZCA9PiBjdXJyeSgoZm4sIGNvbXApID0+IChwcm9wcywgLi4uYXJncykgPT4ge1xuICBjb25zdCBuID0gY29tcChwcm9wcywgLi4uYXJncyk7XG4gIG5bbWV0aG9kXSA9ICgpID0+IGZuKG4sIC4uLmFyZ3MpO1xuICByZXR1cm4gbjtcbn0pO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyB1bm1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVW5Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVW5Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IGJlZm9yZSB0aGUgY29tcG9uZW50IGlzIHVwZGF0ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVXBkYXRlID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25VcGRhdGUnKTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudCwgb25VcGRhdGV9IGZyb20gJy4vbGlmZUN5Y2xlcyc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbi8qKlxuICogQ29tYmluYXRvciB0byBjcmVhdGUgYSBcInN0YXRlZnVsIGNvbXBvbmVudFwiOiBpZSBpdCB3aWxsIGhhdmUgaXRzIG93biBzdGF0ZSBhbmQgdGhlIGFiaWxpdHkgdG8gdXBkYXRlIGl0cyBvd24gdHJlZVxuICogQHBhcmFtIGNvbXAge0Z1bmN0aW9ufSAtIHRoZSBjb21wb25lbnRcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBhIG5ldyB3cmFwcGVkIGNvbXBvbmVudFxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoY29tcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAvL2xhenkgZXZhbHVhdGUgdXBkYXRlRnVuYyAodG8gbWFrZSBzdXJlIGl0IGlzIGRlZmluZWRcbiAgICAgIGNvbnN0IHNldFN0YXRlID0gKG5ld1N0YXRlKSA9PiB1cGRhdGVGdW5jKG5ld1N0YXRlKTtcbiAgICAgIHJldHVybiBjb21wKHByb3BzLCBzZXRTdGF0ZSwgLi4uYXJncyk7XG4gICAgfTtcbiAgICBjb25zdCBzZXRVcGRhdGVGdW5jdGlvbiA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgIH07XG5cbiAgICByZXR1cm4gY29tcG9zZShvbk1vdW50KHNldFVwZGF0ZUZ1bmN0aW9uKSwgb25VcGRhdGUoc2V0VXBkYXRlRnVuY3Rpb24pKSh3cmFwcGVyQ29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgRWxtIGxpa2UgYXBwXG4gKiBAcGFyYW0gdmlldyB7RnVuY3Rpb259IC0gYSBjb21wb25lbnQgd2hpY2ggdGFrZXMgYXMgYXJndW1lbnRzIHRoZSBjdXJyZW50IG1vZGVsIGFuZCB0aGUgbGlzdCBvZiB1cGRhdGVzXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gYSBFbG0gbGlrZSBhcHBsaWNhdGlvbiB3aG9zZSBwcm9wZXJ0aWVzIFwibW9kZWxcIiwgXCJ1cGRhdGVzXCIgYW5kIFwic3Vic2NyaXB0aW9uc1wiIHdpbGwgZGVmaW5lIHRoZSByZWxhdGVkIGRvbWFpbiBzcGVjaWZpYyBvYmplY3RzXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh2aWV3KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe21vZGVsLCB1cGRhdGVzLCBzdWJzY3JpcHRpb25zID0gW119PXt9KSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgbGV0IGFjdGlvblN0b3JlID0ge307XG4gICAgZm9yIChsZXQgdXBkYXRlIG9mIE9iamVjdC5rZXlzKHVwZGF0ZXMpKSB7XG4gICAgICBhY3Rpb25TdG9yZVt1cGRhdGVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgbW9kZWwgPSB1cGRhdGVzW3VwZGF0ZV0obW9kZWwsIC4uLmFyZ3MpOyAvL3RvZG8gY29uc2lkZXIgc2lkZSBlZmZlY3RzLCBtaWRkbGV3YXJlcywgZXRjXG4gICAgICAgIHJldHVybiB1cGRhdGVGdW5jKG1vZGVsLCBhY3Rpb25TdG9yZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29tcCA9ICgpID0+IHZpZXcobW9kZWwsIGFjdGlvblN0b3JlKTtcblxuICAgIGNvbnN0IGluaXRBY3Rpb25TdG9yZSA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZShjb21wLCB2bm9kZSk7XG4gICAgfTtcbiAgICBjb25zdCBpbml0U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5tYXAoc3ViID0+IHZub2RlID0+IHN1Yih2bm9kZSwgYWN0aW9uU3RvcmUpKTtcbiAgICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICAgIHJldHVybiBvbk1vdW50KGluaXRGdW5jLCBjb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVuTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcydcbmltcG9ydCB7aXNEZWVwRXF1YWwsIGlkZW50aXR5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENvbm5lY3QgY29tYmluYXRvcjogd2lsbCBjcmVhdGUgXCJjb250YWluZXJcIiBjb21wb25lbnQgd2hpY2ggd2lsbCBzdWJzY3JpYmUgdG8gYSBSZWR1eCBsaWtlIHN0b3JlLiBhbmQgdXBkYXRlIGl0cyBjaGlsZHJlbiB3aGVuZXZlciBhIHNwZWNpZmljIHNsaWNlIG9mIHN0YXRlIGNoYW5nZSB1bmRlciBzcGVjaWZpYyBjaXJjdW1zdGFuY2VzXG4gKiBAcGFyYW0gc3RvcmUge09iamVjdH0gLSBUaGUgc3RvcmUgKGltcGxlbWVudGluZyB0aGUgc2FtZSBhcGkgdGhhbiBSZWR1eCBzdG9yZVxuICogQHBhcmFtIGFjdGlvbnMge09iamVjdH0gW3t9XSAtIFRoZSBsaXN0IG9mIGFjdGlvbnMgdGhlIGNvbm5lY3RlZCBjb21wb25lbnQgd2lsbCBiZSBhYmxlIHRvIHRyaWdnZXJcbiAqIEBwYXJhbSBzbGljZVN0YXRlIHtGdW5jdGlvbn0gW3N0YXRlID0+IHN0YXRlXSAtIEEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnQgdGhlIHN0YXRlIGFuZCByZXR1cm4gYSBcInRyYW5zZm9ybWVkXCIgc3RhdGUgKGxpa2UgcGFydGlhbCwgZXRjKSByZWxldmFudCB0byB0aGUgY29udGFpbmVyXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBjb250YWluZXIgZmFjdG9yeSB3aXRoIHRoZSBmb2xsb3dpbmcgYXJndW1lbnRzOlxuICogIC0gY29tcDogdGhlIGNvbXBvbmVudCB0byB3cmFwIG5vdGUgdGhlIGFjdGlvbnMgb2JqZWN0IHdpbGwgYmUgcGFzc2VkIGFzIHNlY29uZCBhcmd1bWVudCBvZiB0aGUgY29tcG9uZW50IGZvciBjb252ZW5pZW5jZVxuICogIC0gbWFwU3RhdGVUb1Byb3A6IGEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnQgd2hhdCB0aGUgXCJzbGljZVN0YXRlXCIgZnVuY3Rpb24gcmV0dXJucyBhbmQgcmV0dXJucyBhbiBvYmplY3QgdG8gYmUgYmxlbmRlZCBpbnRvIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBjb21wb25lbnQgKGRlZmF1bHQgdG8gaWRlbnRpdHkgZnVuY3Rpb24pXG4gKiAgLSBzaG91bGRVcGRhdGU6IGEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnRzIHRoZSBwcmV2aW91cyBhbmQgdGhlIGN1cnJlbnQgdmVyc2lvbnMgb2Ygd2hhdCBcInNsaWNlU3RhdGVcIiBmdW5jdGlvbiByZXR1cm5zIHRvIHJldHVybnMgYSBib29sZWFuIGRlZmluaW5nIHdoZXRoZXIgdGhlIGNvbXBvbmVudCBzaG91bGQgYmUgdXBkYXRlZCAoZGVmYXVsdCB0byBhIGRlZXBFcXVhbCBjaGVjaylcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHN0b3JlLCBhY3Rpb25zID0ge30sIHNsaWNlU3RhdGUgPSBpZGVudGl0eSkge1xuICByZXR1cm4gZnVuY3Rpb24gKGNvbXAsIG1hcFN0YXRlVG9Qcm9wID0gaWRlbnRpdHksIHNob3VsZFVwYXRlID0gKGEsIGIpID0+IGlzRGVlcEVxdWFsKGEsIGIpID09PSBmYWxzZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoaW5pdFByb3ApIHtcbiAgICAgIGxldCBjb21wb25lbnRQcm9wcyA9IGluaXRQcm9wO1xuICAgICAgbGV0IHVwZGF0ZUZ1bmMsIHByZXZpb3VzU3RhdGVTbGljZSwgdW5zdWJzY3JpYmVyO1xuXG4gICAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgICByZXR1cm4gY29tcChwcm9wcywgYWN0aW9ucywgLi4uYXJncyk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBzdWJzY3JpYmUgPSBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgICAgIHVuc3Vic2NyaWJlciA9IHN0b3JlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdGVTbGljZSA9IHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgaWYgKHNob3VsZFVwYXRlKHByZXZpb3VzU3RhdGVTbGljZSwgc3RhdGVTbGljZSkgPT09IHRydWUpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50UHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHN0YXRlU2xpY2UpKTtcbiAgICAgICAgICAgIHVwZGF0ZUZ1bmMoY29tcG9uZW50UHJvcHMpO1xuICAgICAgICAgICAgcHJldmlvdXNTdGF0ZVNsaWNlID0gc3RhdGVTbGljZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gb25Vbk1vdW50KCgpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmVyKCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNvbXBvc2Uoc3Vic2NyaWJlLCB1bnN1YnNjcmliZSkod3JhcHBlckNvbXApO1xuICAgIH07XG4gIH07XG59OyIsImltcG9ydCB7bW91bnQsIHdpdGhTdGF0ZSwgaH0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuXG5jb25zdCBtYWluID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21haW4nKTtcblxuY29uc3QgU3BhbkNvdW50ID0gKHtjb3VudH0pID0+IDxwPjxzcGFuPkFub3RoZXIgY2hpbGQgPC9zcGFuPntjb3VudH08L3A+O1xuXG5jb25zdCBDb3VudGVyID0gd2l0aFN0YXRlKCh7Y291bnQgPSAwfSwgc2V0U3RhdGUpID0+IHtcbiAgcmV0dXJuIDxkaXY+XG4gICAgPGJ1dHRvbiBvbkNsaWNrPXtldiA9PiAoc2V0U3RhdGUoe2NvdW50OiBjb3VudCArIDF9KSl9PkluY3JlbWVudDwvYnV0dG9uPlxuICAgIDxidXR0b24gb25DbGljaz17ZXYgPT4gKHNldFN0YXRlKHtjb3VudDogY291bnQgLSAxfSkpfT5EZWNyZW1lbnQ8L2J1dHRvbj5cbiAgICA8U3BhbkNvdW50IGNvdW50PXtjb3VudH0vPlxuICA8L2Rpdj5cbn0pO1xuXG5jb25zdCBtID0gbW91bnQoKGluaXRQcm9wKSA9PiB7XG4gIHJldHVybiAoPGRpdj5cbiAgICA8Q291bnRlciBjb3VudD17aW5pdFByb3AuZmlyc3RDb3VudH0vPlxuICAgIDxDb3VudGVyIGNvdW50PXtpbml0UHJvcC5zZWNvbmRDb3VudH0vPlxuICA8L2Rpdj4pO1xufSwge2ZpcnN0Q291bnQ6IDQsIHNlY29uZENvdW50OiA4fSk7XG5cbm0obWFpbik7Il0sIm5hbWVzIjpbIm1vdW50Il0sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNLGVBQWUsR0FBRyxDQUFDLEtBQUssTUFBTTtFQUNsQyxRQUFRLEVBQUUsTUFBTTtFQUNoQixRQUFRLEVBQUUsRUFBRTtFQUNaLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQztFQUNkLFNBQVMsRUFBRSxDQUFDO0NBQ2IsQ0FBQyxDQUFDOzs7Ozs7Ozs7QUFTSCxBQUFlLFNBQVMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxRQUFRLEVBQUU7RUFDdkQsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEtBQUs7SUFDbkQsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLEdB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
