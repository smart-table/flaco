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
var connect = function (store, actions = {}, sliceState = identity) {
  return function (comp, mapStateToProp = identity, shouldUpate = (a, b) => isDeepEqual(a, b) === false) {
    return function (initProp) {
      let componentProps = initProp;
      let updateFunc, previousStateSlice, unsubscriber;

      const wrapperComp = (props, ...args) => {
        return comp(props, actions, ...args);
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
  };
};

function swap$1 (f) {
  return (a, b) => f(b, a);
}

function compose$1 (first, ...fns) {
  return (...args) => fns.reduce((previous, current) => current(previous), first(...args));
}

function curry$1 (fn, arityLeft) {
  const arity = arityLeft || fn.length;
  return (...args) => {
    const argLength = args.length || 1;
    if (arity === argLength) {
      return fn(...args);
    } else {
      const func = (...moreArgs) => fn(...args, ...moreArgs);
      return curry$1(func, arity - args.length);
    }
  };
}



function tap$1 (fn) {
  return arg => {
    fn(arg);
    return arg;
  }
}

function pointer (path) {

  const parts = path.split('.');

  function partial (obj = {}, parts = []) {
    const p = parts.shift();
    const current = obj[p];
    return (current === undefined || parts.length === 0) ?
      current : partial(current, parts);
  }

  function set (target, newTree) {
    let current = target;
    const [leaf, ...intermediate] = parts.reverse();
    for (let key of intermediate.reverse()) {
      if (current[key] === undefined) {
        current[key] = {};
        current = current[key];
      }
    }
    current[leaf] = Object.assign(current[leaf] || {}, newTree);
    return target;
  }

  return {
    get(target){
      return partial(target, [...parts])
    },
    set
  }
}

function sortByProperty (prop) {
  const propGetter = pointer(prop).get;
  return (a, b) => {
    const aVal = propGetter(a);
    const bVal = propGetter(b);

    if (aVal === bVal) {
      return 0;
    }

    if (bVal === undefined) {
      return -1;
    }

    if (aVal === undefined) {
      return 1;
    }

    return aVal < bVal ? -1 : 1;
  }
}

function sortFactory ({pointer: pointer$$1, direction} = {}) {
  if (!pointer$$1 || direction === 'none') {
    return array => [...array];
  }

  const orderFunc = sortByProperty(pointer$$1);
  const compareFunc = direction === 'desc' ? swap$1(orderFunc) : orderFunc;

  return (array) => [...array].sort(compareFunc);
}

function typeExpression (type) {
  switch (type) {
    case 'boolean':
      return Boolean;
    case 'number':
      return Number;
    case 'date':
      return (val) => new Date(val);
    default:
      return compose$1(String, (val) => val.toLowerCase());
  }
}

const operators = {
  includes(value){
    return (input) => input.includes(value);
  },
  is(value){
    return (input) => Object.is(value, input);
  },
  isNot(value){
    return (input) => !Object.is(value, input);
  },
  lt(value){
    return (input) => input < value;
  },
  gt(value){
    return (input) => input > value;
  },
  lte(value){
    return (input) => input <= value;
  },
  gte(value){
    return (input) => input >= value;
  },
  equals(value){
    return (input) => value == input;
  },
  notEquals(value){
    return (input) => value != input;
  }
};

const every = fns => (...args) => fns.every(fn => fn(...args));

function predicate ({value = '', operator = 'includes', type = 'string'}) {
  const typeIt = typeExpression(type);
  const operateOnTyped = compose$1(typeIt, operators[operator]);
  const predicateFunc = operateOnTyped(value);
  return compose$1(typeIt, predicateFunc);
}

//avoid useless filter lookup (improve perf)
function normalizeClauses (conf) {
  const output = {};
  const validPath = Object.keys(conf).filter(path => Array.isArray(conf[path]));
  validPath.forEach(path => {
    const validClauses = conf[path].filter(c => c.value !== '');
    if (validClauses.length) {
      output[path] = validClauses;
    }
  });
  return output;
}

function filter$1 (filter) {
  const normalizedClauses = normalizeClauses(filter);
  const funcList = Object.keys(normalizedClauses).map(path => {
    const getter = pointer(path).get;
    const clauses = normalizedClauses[path].map(predicate);
    return compose$1(getter, every(clauses));
  });
  const filterPredicate = every(funcList);

  return (array) => array.filter(filterPredicate);
}

var search$1 = function (searchConf = {}) {
  const {value, scope = []} = searchConf;
  const searchPointers = scope.map(field => pointer(field).get);
  if (!scope.length || !value) {
    return array => array;
  } else {
    return array => array.filter(item => searchPointers.some(p => String(p(item)).includes(String(value))))
  }
};

function sliceFactory ({page = 1, size} = {}) {
  return function sliceFunction (array = []) {
    const actualSize = size || array.length;
    const offset = (page - 1) * actualSize;
    return array.slice(offset, offset + actualSize);
  };
}

function emitter () {

  const listenersLists = {};
  const instance = {
    on(event, ...listeners){
      listenersLists[event] = (listenersLists[event] || []).concat(listeners);
      return instance;
    },
    dispatch(event, ...args){
      const listeners = listenersLists[event] || [];
      for (let listener of listeners) {
        listener(...args);
      }
      return instance;
    },
    off(event, ...listeners){
      if (!event) {
        Object.keys(listenersLists).forEach(ev => instance.off(ev));
      } else {
        const list = listenersLists[event] || [];
        listenersLists[event] = listeners.length ? list.filter(listener => !listeners.includes(listener)) : [];
      }
      return instance;
    }
  };
  return instance;
}

const TOGGLE_SORT = 'TOGGLE_SORT';
const DISPLAY_CHANGED = 'DISPLAY_CHANGED';
const PAGE_CHANGED = 'CHANGE_PAGE';
const EXEC_CHANGED = 'EXEC_CHANGED';
const FILTER_CHANGED = 'FILTER_CHANGED';
const SUMMARY_CHANGED = 'SUMMARY_CHANGED';
const SEARCH_CHANGED = 'SEARCH_CHANGED';
const EXEC_ERROR = 'EXEC_ERROR';

function curriedPointer (path) {
  const {get, set} = pointer(path);
  return {get, set: curry$1(set)};
}

var table$3 = function ({
  sortFactory,
  tableState,
  data,
  filterFactory,
  searchFactory
}) {
  const table = emitter();
  const sortPointer = curriedPointer('sort');
  const slicePointer = curriedPointer('slice');
  const filterPointer = curriedPointer('filter');
  const searchPointer = curriedPointer('search');

  const safeAssign = curry$1((base, extension) => Object.assign({}, base, extension));
  const dispatch = curry$1(table.dispatch.bind(table), 2);

  const dispatchSummary = (filtered) => {
    dispatch(SUMMARY_CHANGED, {
      page: tableState.slice.page,
      size: tableState.slice.size,
      filteredCount: filtered.length
    });
  };

  const exec = ({processingDelay = 20} = {}) => {
    table.dispatch(EXEC_CHANGED, {working: true});
    setTimeout(function () {
      try {
        const filterFunc = filterFactory(filterPointer.get(tableState));
        const searchFunc = searchFactory(searchPointer.get(tableState));
        const sortFunc = sortFactory(sortPointer.get(tableState));
        const sliceFunc = sliceFactory(slicePointer.get(tableState));
        const execFunc = compose$1(filterFunc, searchFunc, tap$1(dispatchSummary), sortFunc, sliceFunc);
        const displayed = execFunc(data);
        table.dispatch(DISPLAY_CHANGED, displayed.map(d => {
          return {index: data.indexOf(d), value: d};
        }));
      } catch (e) {
        table.dispatch(EXEC_ERROR, e);
      } finally {
        table.dispatch(EXEC_CHANGED, {working: false});
      }
    }, processingDelay);
  };

  const updateTableState = curry$1((pter, ev, newPartialState) => compose$1(
    safeAssign(pter.get(tableState)),
    tap$1(dispatch(ev)),
    pter.set(tableState)
  )(newPartialState));

  const resetToFirstPage = () => updateTableState(slicePointer, PAGE_CHANGED, {page: 1});

  const tableOperation = (pter, ev) => compose$1(
    updateTableState(pter, ev),
    resetToFirstPage,
    () => table.exec() // we wrap within a function so table.exec can be overwritten (when using with a server for example)
  );

  const api = {
    sort: tableOperation(sortPointer, TOGGLE_SORT),
    filter: tableOperation(filterPointer, FILTER_CHANGED),
    search: tableOperation(searchPointer, SEARCH_CHANGED),
    slice: compose$1(updateTableState(slicePointer, PAGE_CHANGED), () => table.exec()),
    exec,
    eval(state = tableState){
      return Promise.resolve()
        .then(function () {
          const sortFunc = sortFactory(sortPointer.get(state));
          const searchFunc = searchFactory(searchPointer.get(state));
          const filterFunc = filterFactory(filterPointer.get(state));
          const sliceFunc = sliceFactory(slicePointer.get(state));
          const execFunc = compose$1(filterFunc, searchFunc, sortFunc, sliceFunc);
          return execFunc(data).map(d => {
            return {index: data.indexOf(d), value: d}
          });
        });
    },
    onDisplayChange(fn){
      table.on(DISPLAY_CHANGED, fn);
    },
    getTableState(){
      const sort = Object.assign({}, tableState.sort);
      const search = Object.assign({}, tableState.search);
      const slice = Object.assign({}, tableState.slice);
      const filter = {};
      for (let prop in tableState.filter) {
        filter[prop] = tableState.filter[prop].map(v => Object.assign({}, v));
      }
      return {sort, search, slice, filter};
    }
  };

  const instance = Object.assign(table, api);

  Object.defineProperty(instance, 'length', {
    get(){
      return data.length;
    }
  });

  return instance;
};

var tableDirective$1 = function ({
  sortFactory: sortFactory$$1 = sortFactory,
  filterFactory = filter$1,
  searchFactory = search$1,
  tableState = {sort: {}, slice: {page: 1}, filter: {}, search: {}},
  data = []
}, ...tableDirectives) {

  const coreTable = table$3({sortFactory: sortFactory$$1, filterFactory, tableState, data, searchFactory});

  return tableDirectives.reduce((accumulator, newdir) => {
    return Object.assign(accumulator, newdir({
      sortFactory: sortFactory$$1,
      filterFactory,
      searchFactory,
      tableState,
      data,
      table: coreTable
    }));
  }, coreTable);
};

const table$2 = tableDirective$1;

const get = curry$1((array, index) => array[index]);
const replace = curry$1((array, newVal, index) => array.map((val, i) => (index === i ) ? newVal : val));
const patch = curry$1((array, newVal, index) => replace(array, Object.assign(array[index], newVal), index));
const remove = curry$1((array, index) => array.filter((val, i) => index !== i));
const insert = curry$1((array, newVal, index) => [...array.slice(0, index), newVal, ...array.slice(index)]);

var crud = function ({data, table}) {
  // empty and refill data keeping the same reference
  const mutateData = (newData) => {
    data.splice(0);
    data.push(...newData);
  };
  const refresh = compose$1(mutateData, table.exec);
  return {
    update(index,newVal){
      return compose$1(replace(data,newVal),refresh)(index);
    },
    patch(index, newVal){
      return patch(data, newVal, index);
    },
    remove: compose$1(remove(data), refresh),
    insert(newVal, index = 0){
      return compose$1(insert(data, newVal), refresh)(index);
    },
    get: get(data)
  };
};

// it is like Redux but using smart table which already behaves more or less like a store and like a reducer in the same time.
// of course this impl is basic: error handling etc are missing and reducer is "hardcoded"
const reducerFactory = function (smartTable) {
  return function (state = {
    tableState: smartTable.getTableState(),
    displayed: [],
    summary: {},
    isProcessing: false
  }, action) {
    const {type, args} = action;
    switch (type) {
      case 'TOGGLE_FILTER': {
        const {filter} = action;
        return Object.assign({}, state, {activeFilter: filter});
      }
      default: //proxy to smart table
        if (smartTable[type]) {
          smartTable[type](...args);
        }
        return state;
    }
  }
};

function createStore (smartTable) {

  const reducer = reducerFactory(smartTable);

  let currentState = {
    tableState: smartTable.getTableState()
  };
  let summary;
  let listeners = [];

  const broadcast = () => {
    for (let l of listeners) {
      l();
    }
  };

  smartTable.on('SUMMARY_CHANGED', function (s) {
    summary = s;
  });

  smartTable.on('EXEC_CHANGED', function ({working}) {
    Object.assign(currentState, {
      isProcessing: working
    });
    broadcast();
  });

  smartTable.onDisplayChange(function (displayed) {
    Object.assign(currentState, {
      tableState: smartTable.getTableState(),
      displayed,
      summary
    });
    broadcast();
  });

  return {
    subscribe(listener){
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(l => l !== listener);
      }
    },
    getState(){
      return Object.assign({}, currentState, {tableState:smartTable.getTableState()});
    },
    dispatch(action = {}){
      currentState = reducer(currentState, action);
      if (action.type && !smartTable[action.type]) {
        broadcast();
      }
    }
  };
}

//data coming from global
const tableState = {search: {}, filter: {}, sort: {}, slice: {page: 1, size: 20}};
//the smart table
const table$1 = table$2({data, tableState}, crud);
//the store
var store = createStore(table$1);

function debounce (fn, delay = 300) {
  let timeoutId;
  return (ev) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(function () {
      fn(ev);
    }, delay);
  };
}
const trapKeydown = (...keys) => (ev) => {
  const {keyCode} =ev;
  if (keys.indexOf(keyCode) === -1) {
    ev.stopPropagation();
  }
};

const autoFocus = onMount(n => n.dom.focus());
const Input = autoFocus(props => {
  delete  props.children; //no children for inputs
  return h( 'input', props)
});

const toggleOnKeyDown = props => (ev) => {
  const {keyCode} = ev;
  if (keyCode === 13) {
    props.toggleEdit(true)();
  } else if (keyCode === 27) {
    ev.currentTarget.focus();
  }
};

const InputCell = (props) => {

  const onKeydown = toggleOnKeyDown(props);

  return h( 'td', { tabIndex: "-1", onKeyDown: onKeydown, onClick: props.toggleEdit(true), class: props.className },
    props.isEditing === 'true' ?
        h( Input, { onKeydown: trapKeydown(27), type: props.type || 'text', value: props.currentValue, onInput: props.onInput, onBlur: props.toggleEdit(false) })
        : h( 'span', null, props.currentValue )
  )
};

const makeEditable = comp => {
  return withState((props, setState) => {
    const toggleEdit = (val) => () => setState(Object.assign({}, props, {isEditing: val !== void 0 ? val : props.isEditing !== true}));
    const fullProps = Object.assign({}, {toggleEdit}, props);
    return comp(fullProps);
  });
};

const EditableLastName = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.name.last;
  const onInput = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {name: {last: currentValue, first: person.name.first}});
  });

  return h( InputCell, { isEditing: String(isEditing === true), toggleEdit: toggleEdit, className: className, currentValue: currentValue, onInput: onInput })
});

const EditableFirstName = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.name.first;
  const onInput = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {name: {first: currentValue, last: person.name.last}});
  });

  return h( InputCell, { isEditing: String(isEditing === true), toggleEdit: toggleEdit, className: className, currentValue: currentValue, onInput: onInput })
});

const GenderSelect = autoFocus(({onChange, toggleEdit, person}) => {
  return h( 'select', { onKeyDown: trapKeydown(27), name: "gender select", onChange: onChange, onBlur: toggleEdit(false) },
    h( 'option', { value: "male", selected: person.gender === 'male' }, "male"),
    h( 'option', { value: "female", selected: person.gender === 'female' }, "female")
  )
});

const EditableGender = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.gender;

  const onKeydown = toggleOnKeyDown(props);

  const onChange = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {gender: currentValue});
  });
  const genderClass = person.gender === 'female' ? 'gender-female' : 'gender-male';

  return h( 'td', { tabIndex: "-1", onKeyDown: onKeydown, onClick: toggleEdit(true), class: className },
    isEditing ? h( GenderSelect, { onChange: onChange, toggleEdit: toggleEdit, person: person }) :
        h( 'span', { class: genderClass }, currentValue)
  );
});

const EditableSize = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.size;
  const onInput = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {size: currentValue});
  });
  const ratio = Math.min((person.size - 150) / 50, 1) * 100;

  const onKeydown = toggleOnKeyDown(props);

  return h( 'td', { tabIndex: "-1", class: className, onKeyDown: onKeydown, onClick: toggleEdit(true) },
    isEditing ? h( Input, { onKeydown: trapKeydown(27), type: "number", min: "150", max: "200", value: currentValue, onBlur: toggleEdit(false), onInput: onInput }) :
        h( 'span', null, h( 'span', { style: `height: ${ratio}%`, class: "size-stick" }), currentValue )
  );
});

const EditableBirthDate = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.birthDate;

  const onInput = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {birthDate: new Date(currentValue)});
  });

  return h( InputCell, { type: "date", isEditing: String(isEditing === true), toggleEdit: toggleEdit, className: className, currentValue: currentValue.toDateString(), onInput: onInput })
});

const IconFilter = () => (h( 'svg', { 'aria-hidden': "true", class: "icon", viewBox: "0 0 32 32" },
  h( 'path', {
    d: "M16 0c-8.837 0-16 2.239-16 5v3l12 12v10c0 1.105 1.791 2 4 2s4-0.895 4-2v-10l12-12v-3c0-2.761-7.163-5-16-5zM2.95 4.338c0.748-0.427 1.799-0.832 3.040-1.171 2.748-0.752 6.303-1.167 10.011-1.167s7.262 0.414 10.011 1.167c1.241 0.34 2.292 0.745 3.040 1.171 0.494 0.281 0.76 0.519 0.884 0.662-0.124 0.142-0.391 0.38-0.884 0.662-0.748 0.427-1.8 0.832-3.040 1.171-2.748 0.752-6.303 1.167-10.011 1.167s-7.262-0.414-10.011-1.167c-1.24-0.34-2.292-0.745-3.040-1.171-0.494-0.282-0.76-0.519-0.884-0.662 0.124-0.142 0.391-0.38 0.884-0.662z" })
));

const IconBin = () => (h( 'svg', { 'aria-hidden': "true", class: "icon", viewBox: "0 0 32 32" },
  h( 'path', { d: "M6 32h20l2-22h-24zM20 4v-4h-8v4h-10v6l2-2h24l2 2v-6h-10zM18 4h-4v-2h4v2z" })
));

const IconSort = () => (h( 'svg', { class: "icon", viewBox: "0 0 32 32" },
  h( 'path', { d: "M2 6h28v6h-28zM2 14h28v6h-28zM2 22h28v6h-28z" })
));

const IconSortAsc = () => (h( 'svg', { class: "icon", viewBox: "0 0 32 32" },
  h( 'path', { d: "M10 24v-24h-4v24h-5l7 7 7-7h-5z" }),
  h( 'path', { d: "M14 18h18v4h-18v-4z" }),
  h( 'path', { d: "M14 12h14v4h-14v-4z" }),
  h( 'path', { d: "M14 6h10v4h-10v-4z" }),
  h( 'path', { d: "M14 0h6v4h-6v-4z" })
));

const IconSortDesc = () => (h( 'svg', { class: "icon", viewBox: "0 0 32 32" },
  h( 'path', { d: "M10 24v-24h-4v24h-5l7 7 7-7h-5z" }),
  h( 'path', { d: "M14 0h18v4h-18v-4z" }),
  h( 'path', { d: "M14 6h14v4h-14v-4z" }),
  h( 'path', { d: "M14 12h10v4h-10v-4z" }),
  h( 'path', { d: "M14 18h6v4h-6v-4z" })
));

const mapStateToProp = state => ({persons: state});
const doesUpdateList = (previous, current) => {
  let output = true;
  if (typeof previous === typeof current) {
    output = previous.length !== current.length || previous.some((i, k) => previous[k].value.id !== current[k].value.id);
  }
  return output;
};
const sliceState = state => state.displayed;
const actions = {
  remove: index => store.dispatch({type: 'remove', args: [index]}),
  patch: (index, value) => store.dispatch({type: 'patch', args: [index, value]})
};
const subscribeToDisplay = connect(store, actions, sliceState);
const focusFirstCell = onUpdate(vnode => {
  const firstCell = vnode.dom.querySelector('td');
  if (firstCell !== null) {
    firstCell.focus();
  }
});

const TBody = focusFirstCell(({persons = [], patch, remove}) => {
  return persons.length ? h( 'tbody', null,
    persons.map(({value, index}) => h( 'tr', null,
        h( EditableLastName, { className: "col-lastname", person: value, index: index, patch: patch }),
        h( EditableFirstName, { className: "col-firstname", person: value, index: index, patch: patch }),
        h( EditableBirthDate, { className: "col-birthdate", person: value, index: index, patch: patch }),
        h( EditableGender, { className: "col-gender fixed-size", person: value, index: index, patch: patch }),
        h( EditableSize, { className: "col-size fixed-size", person: value, index: index, patch: patch }),
        h( 'td', { class: "fixed-size col-actions", 'data-keyboard-selector': "button" },
          h( 'button', { tabindex: "-1", onClick: () => remove(index) },
            h( 'span', { class: "visually-hidden" }, 'Delete ' + value.name.last + ' ' + value.name.first),
            h( IconBin, null )
          )
        )
      ))
    ) : h( 'tbody', null,
    h( 'tr', null,
      h( 'td', { tabIndex: "-1", colSpan: "6" }, "There is no data matching your request")
    )
    )
});

const PersonListComponent = (props, actions) => {
  return h( TBody, { persons: props.persons, remove: actions.remove, patch: actions.patch })
};

const PersonList = subscribeToDisplay(PersonListComponent, mapStateToProp, doesUpdateList);

const actions$1 = {};
const sliceState$1 = state => ({isProcessing: state.isProcessing});
const subscribeToProcessing = connect(store, actions$1, sliceState$1);

const LoadingIndicator = ({isProcessing}) => {
  const className = isProcessing === true ? 'st-working' : '';
  const message = isProcessing === true ? 'loading persons data' : 'data loaded';
  return h( 'div', { id: "overlay", 'aria-live': "assertive", role: "alert", class: className },
    message
  );
};
const WorkInProgress = subscribeToProcessing(LoadingIndicator);

const actions$2 = {
  toggleSort: ({pointer: pointer$$1, direction}) => store.dispatch({type: 'sort', args: [{pointer: pointer$$1, direction}]})
};
const sliceState$2 = pointer('tableState.sort').get;
const subscribeToSort = connect(store, actions$2, sliceState$2);


const Icon = ({direction}) => {
  if (direction === 'asc') {
    return h( IconSortAsc, null );
  } else if (direction === 'desc') {
    return h( IconSortDesc, null );
  } else {
    return h( IconSort, null );
  }
};

const SortButtonComponent = (props => {
  const {columnPointer, sortDirections = ['asc', 'desc'], pointer: pointer$$1, direction, sort} = props;
  const actualCursor = columnPointer !== pointer$$1 ? -1 : sortDirections.indexOf(direction);
  const newCursor = (actualCursor + 1 ) % sortDirections.length;

  const toggleSort = () => sort({pointer: columnPointer, direction: sortDirections[newCursor]});

  return h( 'button', { tabindex: "-1", onClick: toggleSort },
    h( 'span', { class: "visually-hidden" }, "Toggle sort"),
    h( Icon, { direction: sortDirections[actualCursor] })
  )
});

const SortButton = subscribeToSort((props, actions) =>
  h( SortButtonComponent, Object.assign({}, props, { sort: actions.toggleSort })));

const actions$3 = {
  search: (value, scope) => store.dispatch({type: 'search', args: [{value, scope}]})
};
const sliceState$3 = pointer('tableState.search').get;
const noNeedForUpdate = state => false;// always return the same value
const searchable = connect(store, actions$3, sliceState$3);

const SearchInput = (props) => (h( 'label', null,
  h( 'span', null, props.children ),
  h( 'input', { tabindex: "0", type: "search", onInput: props.onInput, placeholder: props.placeholder })
));

const SearchRow = searchable((props, actions) => {
  const onInput = debounce(ev => actions.search(ev.target.value, ['name.last', 'name.first']), 300);
  delete props.children;
  return h( 'tr', props,
    h( 'th', { 'data-keyboard-selector': "input" },
      h( SearchInput, { placeholder: "Case sensitive search on surname and name", onInput: onInput }, "Search:")
    )
  )
}, noNeedForUpdate, noNeedForUpdate);

const focusOnOpen = onUpdate(vnode => {
  const ah = vnode.props['aria-hidden'];
  if (ah === 'false') {
    const input = vnode.dom.querySelector('input, select');
    if (input) {
      setTimeout(() => input.focus(), 5);
    }
  }
});

const actions$4 = {
  toggleFilterMenu: (filter) => store.dispatch({type: 'TOGGLE_FILTER', filter}),
  commitFilter: (value) => store.dispatch({type: 'filter', args: [value]})
};
const sliceState$4 = state => ({activeFilter: state.activeFilter, filterClauses: state.tableState.filter});
const subscribeToFilter = connect(store, actions$4, sliceState$4);

const FilterRowComp = focusOnOpen((props = {}) => {
  const {isHidden, toggleFilterMenu, commitFilter} = props;
  const close = () => {
    toggleFilterMenu(null);
    document.querySelector(`[aria-controls=${idName}]`).focus();
  };
  const onSubmit = (ev) => {
    const form = ev.target;
    const {name} = form;
    const inputs = form.querySelectorAll('input, select');
    commitFilter({
      [name]: [...inputs].map(input => {
        return {type: input.type, value: input.value, operator: input.getAttribute('data-operator') || 'includes'}
      })
    });
    ev.preventDefault();
    close();
  };
  const idName = ['filter'].concat(props.scope.split('.')).join('-');
  const onKeyDown = (ev) => {
    if (ev.code === 'Escape' || ev.keyCode === 27 || ev.key === 'Escape') {
      close();
    }
  };

  const ariaHidden = isHidden !== true;
  return h( 'tr', { id: idName, class: "filter-row", onKeydown: onKeyDown, 'data-keyboard-skip': ariaHidden, 'aria-hidden': String(ariaHidden) },
    h( 'th', { colspan: "6", 'data-keyboard-selector': "input, select" },
      h( 'form', { name: props.scope, onSubmit: onSubmit },
        props.children,
        h( 'div', { class: "visually-hidden" },
          h( 'button', { tabIndex: "-1" }, "Apply")
        ),
        h( 'p', { id: idName + '-instruction' }, "Press Enter to activate filter or escape to dismiss")
      )
    )
  )
});

const FilterButton = (props) => {
  const {columnPointer, toggleFilterMenu, filterClauses = {}}=props;
  const currentFilterClauses = filterClauses[columnPointer] || [];
  const controlled = ['filter'].concat(columnPointer.split('.')).join('-');
  const onClick = () => toggleFilterMenu(columnPointer);
  const isActive = currentFilterClauses.length && currentFilterClauses.some(clause => clause.value);
  return h( 'button', { 'aria-haspopup': "true", tabindex: "-1", class: isActive ? 'active-filter' : '', 'aria-controls': controlled, onClick: onClick },
    h( 'span', { class: "visually-hidden" }, "Toggle Filter menu"),
    h( IconFilter, null )
  )
};

const ToggleFilterButton = subscribeToFilter((props, actions) => {
  return h( FilterButton, Object.assign({}, props, { toggleFilterMenu: actions.toggleFilterMenu }))
});

const FilterRow = subscribeToFilter((props, actions) => {
  return h( FilterRowComp, { scope: props.scope, isHidden: props.activeFilter === props.scope, toggleFilterMenu: actions.toggleFilterMenu, commitFilter: actions.commitFilter },

    props.children
  );
});

const ColumnHeader = (props) => {
  const {columnPointer, sortDirections = ['asc', 'desc'], className, children} = props;

  return h( 'th', { class: className, 'data-keyboard-selector': "button" },
    children,
    h( 'div', { class: "buttons-container" },
      h( SortButton, { columnPointer: columnPointer, sortDirections: sortDirections }),
      h( ToggleFilterButton, { columnPointer: columnPointer })
    )
  )
};

const Headers = () => {

  return h( 'thead', null,
  h( SearchRow, { class: "filter-row" }),
  h( 'tr', null,
    h( ColumnHeader, { className: "col-lastname", columnPointer: "name.last", sortDirections: ['asc', 'desc', 'none'] }, "Surname"),
    h( ColumnHeader, { className: "col-firstname", columnPointer: "name.first" }, "Name"),
    h( ColumnHeader, { className: "col-birthdate", sortDirections: ['desc', 'asc'], columnPointer: "birthDate" }, "Date of birth"),
    h( ColumnHeader, { className: "col-gender fixed-size", columnPointer: "gender" }, "Gender"),
    h( ColumnHeader, { className: "col-size fixed-size", columnPointer: "size" }, "Size"),
    h( 'th', { 'data-keyboard-skip': true, class: "fixed-size col-actions" })
  ),
  h( FilterRow, { scope: "name.last" },
    h( 'label', null,
      h( 'span', null, "surname includes:" ),
      h( 'input', { 'aria-describedby': "filter-name-last-instruction", onKeyDown: trapKeydown(27, 38, 40), type: "text", placeholder: "case insensitive surname value" })
    )
  ),
  h( FilterRow, { scope: "name.first" },
    h( 'label', null,
      h( 'span', null, "name includes:" ),
      h( 'input', { onKeyDown: trapKeydown(27, 38, 40), type: "text", placeholder: "case insensitive name value" })
    )
  ),
  h( FilterRow, { scope: "birthDate" },
    h( 'label', null,
      h( 'span', null, "born after:" ),
      h( 'input', { onKeyDown: trapKeydown(27), 'data-operator': "gt", type: "date" })
    )
  ),
  h( FilterRow, { scope: "gender" },
    h( 'label', null,
      h( 'span', null, "gender is:" ),
      h( 'select', { onKeyDown: trapKeydown(27), 'data-operator': "is" },
        h( 'option', { value: "" }, "-"),
        h( 'option', { value: "female" }, "female"),
        h( 'option', { value: "male" }, "male")
      )
    )
  ),
  h( FilterRow, { scope: "size" },
    h( 'label', null,
      h( 'span', null, "taller than:" ),
      h( 'input', { onKeyDown: trapKeydown(27), min: "150", max: "200", step: "1", type: "range", 'data-operator': "gt" })
    ),
    h( 'label', null,
      h( 'span', null, "smaller than:" ),
      h( 'input', { onKeyDown: trapKeydown(27), min: "150", max: "200", step: "1", type: "range", 'data-operator': "lt" })
    )
  )
  )
};

const actions$5 = {
  slice: (page, size) => store.dispatch({type: 'slice', args: [{page, size}]})
};
const sliceState$5 = state => state.summary;
const subscribeToSummary = connect(store, actions$5, sliceState$5);

const Summary = (props) => {
  const {page, size, filteredCount} = props;
  return (h( 'div', null, " showing items ", h( 'strong', null, (page - 1) * size + (filteredCount > 0 ? 1 : 0) ), " - ", h( 'strong', null, Math.min(filteredCount, page * size) ), " of ", h( 'strong', null, filteredCount ), " matching items" ));
};

const PageSize = props => {
  const {size, slice} = props;
  const changePageSize = (ev) => slice(1, Number(ev.target.value));
  return h( 'div', null,
    h( 'label', null, "Page size ", h( 'select', { tabIndex: "-1", onChange: changePageSize, name: "pageSize" },
        h( 'option', { selected: size == 20, value: "20" }, "20 items"),
        h( 'option', { selected: size == 30, value: "30" }, "30 items"),
        h( 'option', { selected: size == 50, value: "50" }, "50 items")
      )
    )
  )
};

const Pager = (props) => {
  const {page, size, filteredCount, slice} = props;
  const selectPreviousPage = () => slice(page - 1, size);
  const selectNextPage = () => slice(page + 1, size);
  const isPreviousDisabled = page === 1;
  const isNextDisabled = (filteredCount - (page * size)) <= 0;

  return (
    h( 'div', null,
      h( 'button', { tabIndex: "-1", onClick: selectPreviousPage, disabled: isPreviousDisabled }, "Previous"),
      h( 'small', null, " Page - ", page || 1, " " ),
      h( 'button', { tabIndex: "-1", onClick: selectNextPage, disabled: isNextDisabled }, "Next")
    )
  );
};

const SummaryFooter = subscribeToSummary(Summary);
const Pagination = subscribeToSummary((props, actions) => h( Pager, Object.assign({}, props, { slice: actions.slice })));
const SelectPageSize = subscribeToSummary((props, actions) => h( PageSize, Object.assign({}, props, { slice: actions.slice })));

const Footer = () => h( 'tfoot', null,
h( 'tr', null,
  h( 'td', { colspan: "3" },
    h( SummaryFooter, null )
  ),
  h( 'td', { colspan: "2", 'data-keyboard-selector': "button:not(:disabled)", colSpan: "3" },
    h( Pagination, null )
  ),
  h( 'td', { 'data-keyboard-selector': "select" },
    h( SelectPageSize, null )
  )
)
);

const findContainer = (element, selector) => element.matches(selector) === true ? element : findContainer(element.parentElement, selector);
const dataSelectorAttribute = 'data-keyboard-selector';
const dataSkipAttribute = 'data-keyboard-skip';
const valFunc = val => () => val;

function regularCell (element, {rowSelector, cellSelector}) {
  const row = findContainer(element, rowSelector);
  const cells = [...row.querySelectorAll(cellSelector)];
  const index = cells.indexOf(element);
  const returnEl = valFunc(element);
  return {
    selectFromAfter: returnEl,
    selectFromBefore: returnEl,
    next(){
      return cells[index + 1] !== void 0 ? cells[index + 1] : null;
    },
    previous(){
      return cells[index - 1] !== void 0 ? cells[index - 1] : null;
    }
  }
}

function skipCell (element, options) {
  const reg = regularCell(element, options);
  return {
    previous: reg.previous,
    next: reg.next
  }
}

function compositeCell (element, options) {
  const cellElement = findContainer(element, options.cellSelector);
  const selector = cellElement.getAttribute(dataSelectorAttribute);
  const subWidgets = [...cellElement.querySelectorAll(selector)];
  const widgetsLength = subWidgets.length;
  const isSubWidget = element !== cellElement;
  return {
    selectFromBefore(){
      return isSubWidget ? element : subWidgets[0];
    },
    selectFromAfter(){
      return isSubWidget ? element : subWidgets[widgetsLength - 1];
    },
    next(){
      const index = subWidgets.indexOf(element);
      if (isSubWidget && index + 1 < widgetsLength) {
        return subWidgets[index + 1];
      } else {
        return regularCell(cellElement, options).next();
      }
    },
    previous(){
      const index = subWidgets.indexOf(element);
      if (isSubWidget && index > 0) {
        return subWidgets[index - 1];
      } else {
        return regularCell(cellElement, options).previous();
      }
    }
  }
}

function createCell (el, options) {
  if (el === null) {
    return null;
  } else if (el.hasAttribute(dataSkipAttribute)) {
    return skipCell(el, options);
  } else if (el.hasAttribute(dataSelectorAttribute) || !el.matches(options.cellSelector)) {
    return compositeCell(el, options);
  } else {
    return regularCell(el, options);
  }
}

function regularRow (element, grid, {rowSelector = 'tr', cellSelector = 'th,td'}={}) {
  const rows = [...grid.querySelectorAll(rowSelector)];
  const cells = [...element.querySelectorAll(cellSelector)];
  const index = rows.indexOf(element);
  return {
    previous(){
      return rows[index - 1] !== void 0 ? rows[index - 1] : null;
    },
    next(){
      return rows[index + 1] !== void 0 ? rows[index + 1] : null;
    },
    item(index){
      return cells[index] !== void 0 ? cells[index] : null;
    }
  };
}

function skipRow (element, grid, options) {
  const regular = regularRow(element, grid, options);
  return {
    previous: regular.previous,
    next: regular.next
  };
}

function createRow (target, grid, {rowSelector, cellSelector}={}) {
  if (target === null) {
    return null;
  }
  const r = findContainer(target, rowSelector);
  return r.hasAttribute(dataSkipAttribute) ? skipRow(r, grid, {
      rowSelector,
      cellSelector
    }) : regularRow(target, grid, {rowSelector, cellSelector});
}

function keyGrid (grid, options) {
  const {rowSelector, cellSelector} = options;
  return {
    moveRight(target){
      const cell = createCell(target, options);
      let newCell = createCell(cell.next(), options);
      while (newCell !== null && newCell.selectFromBefore === void 0) {
        newCell = createCell(newCell.next(), options);
      }
      return newCell !== null ? newCell.selectFromBefore() : target;
    },
    moveLeft(target){
      const cell = createCell(target, options);
      let newCell = createCell(cell.previous(), options);
      while (newCell !== null && newCell.selectFromAfter === void 0) {
        newCell = createCell(newCell.previous(), options);
      }
      return newCell !== null ? newCell.selectFromAfter() : target;
    },
    moveUp(target){
      const rowElement = findContainer(target, rowSelector);
      const cells = [...rowElement.querySelectorAll(cellSelector)];
      const row = createRow(rowElement, grid, options);
      let newRow = createRow(row.previous(), grid, options);
      while (newRow !== null && newRow.item === void 0) {
        newRow = createRow(newRow.previous(), grid, options);
      }

      if (newRow === null) {
        return target;
      }

      let askedIndex = cells.indexOf(findContainer(target, cellSelector));
      let newCell = createCell(newRow.item(askedIndex), options);
      while (newCell === null || newCell.selectFromBefore === void 0 && askedIndex > 0) {
        askedIndex--;
        newCell = createCell(newRow.item(askedIndex), options);
      }
      return newCell.selectFromBefore();
    },
    moveDown(target){
      const rowElement = findContainer(target, rowSelector);
      const cells = [...rowElement.querySelectorAll(cellSelector)];
      const row = createRow(rowElement, grid, options);
      let newRow = createRow(row.next(), grid, options);
      while (newRow !== null && newRow.item === void 0) {
        newRow = createRow(newRow.next(), grid, options);
      }

      if (newRow === null) {
        return target;
      }

      let askedIndex = cells.indexOf(findContainer(target, cellSelector));
      let newCell = createCell(newRow.item(askedIndex), options);
      while (newCell === null || newCell.selectFromBefore === void 0 && askedIndex > 0) {
        askedIndex--;
        newCell = createCell(newRow.item(askedIndex), options);
      }
      return newCell.selectFromBefore();
    }
  }
}

var keyboard = function (grid, {rowSelector = 'tr', cellSelector = 'td,th'}={}) {
  let lastFocus = null;
  const kg = keyGrid(grid, {rowSelector, cellSelector});

  grid.addEventListener('keydown', ({target, keyCode}) => {
    let newCell = null;
    if (keyCode === 37) {
      newCell = kg.moveLeft(target);
    } else if (keyCode === 38) {
      newCell = kg.moveUp(target);
    } else if (keyCode === 39) {
      newCell = kg.moveRight(target);
    } else if (keyCode === 40) {
      newCell = kg.moveDown(target);
    }

    if (newCell !== null) {
      newCell.focus();
      if (lastFocus !== null) {
        lastFocus.setAttribute('tabindex', '-1');
      }
      newCell.setAttribute('tabindex', '0');
      lastFocus = newCell;
    }
  });
};

const table = onMount(n => {
  store.dispatch({type: 'exec', args: []}); //kick smartTable
  keyboard(n.dom.querySelector('table'));
});

const PersonTable = table(() =>
  h( 'div', { id: "table-container" },
    h( WorkInProgress, null ),
    h( 'table', null,
      h( Headers, null ),
      h( PersonList, null ),
      h( Footer, null )
    )
  ));

mount(PersonTable, {}, document.getElementById('main'));

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvaC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL3RyYXZlcnNlLmpzIiwiLi4vLi4vbGliL3RyZWUuanMiLCIuLi8uLi9saWIvdXBkYXRlLmpzIiwiLi4vLi4vbGliL2xpZmVDeWNsZXMuanMiLCIuLi8uLi9saWIvd2l0aFN0YXRlLmpzIiwiLi4vLi4vbGliL2VsbS5qcyIsIi4uLy4uL2xpYi9jb25uZWN0LmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLW9wZXJhdG9ycy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc29ydC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1maWx0ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc2VhcmNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3NsaWNlLmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWV2ZW50cy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy90YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy90YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNydWQvY3J1ZC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jcnVkL2luZGV4LmpzIiwibGliL3JlZHV4U21hcnRUYWJsZS5qcyIsImxpYi9zdG9yZS5qcyIsImNvbXBvbmVudHMvaGVscGVyLmpzIiwiY29tcG9uZW50cy9pbnB1dHMuanMiLCJjb21wb25lbnRzL2VkaXRhYmxlQ2VsbC5qcyIsImNvbXBvbmVudHMvaWNvbnMuanMiLCJjb21wb25lbnRzL3Rib2R5LmpzIiwiY29tcG9uZW50cy9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiY29tcG9uZW50cy9zb3J0LmpzIiwiY29tcG9uZW50cy9zZWFyY2guanMiLCJjb21wb25lbnRzL2ZpbHRlci5qcyIsImNvbXBvbmVudHMvaGVhZGVycy5qcyIsImNvbXBvbmVudHMvZm9vdGVyLmpzIiwiLi4vLi4vLi4vc21hcnQtdGFibGUta2V5Ym9hcmQvbGliL3V0aWwuanMiLCIuLi8uLi8uLi9zbWFydC10YWJsZS1rZXlib2FyZC9saWIvY2VsbC5qcyIsIi4uLy4uLy4uL3NtYXJ0LXRhYmxlLWtleWJvYXJkL2xpYi9yb3cuanMiLCIuLi8uLi8uLi9zbWFydC10YWJsZS1rZXlib2FyZC9saWIva2V5Z3JpZC5qcyIsIi4uLy4uLy4uL3NtYXJ0LXRhYmxlLWtleWJvYXJkL2luZGV4LmpzIiwiaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9LFxuICBsaWZlQ3ljbGU6IDBcbn0pO1xuXG4vKipcbiAqIFRyYW5zZm9ybSBoeXBlcnNjcmlwdCBpbnRvIHZpcnR1YWwgZG9tIG5vZGVcbiAqIEBwYXJhbSBub2RlVHlwZSB7RnVuY3Rpb24sIFN0cmluZ30gLSB0aGUgSFRNTCB0YWcgaWYgc3RyaW5nLCBhIGNvbXBvbmVudCBvciBjb21iaW5hdG9yIG90aGVyd2lzZVxuICogQHBhcmFtIHByb3BzIHtPYmplY3R9IC0gdGhlIGxpc3Qgb2YgcHJvcGVydGllcy9hdHRyaWJ1dGVzIGFzc29jaWF0ZWQgdG8gdGhlIHJlbGF0ZWQgbm9kZVxuICogQHBhcmFtIGNoaWxkcmVuIC0gdGhlIHZpcnR1YWwgZG9tIG5vZGVzIHJlbGF0ZWQgdG8gdGhlIGN1cnJlbnQgbm9kZSBjaGlsZHJlblxuICogQHJldHVybnMge09iamVjdH0gLSBhIHZpcnR1YWwgZG9tIG5vZGVcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaCAobm9kZVR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICBjb25zdCBmbGF0Q2hpbGRyZW4gPSBjaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gQXJyYXkuaXNBcnJheShjaGlsZCkgPyBjaGlsZCA6IFtjaGlsZF07XG4gICAgcmV0dXJuIGFjYy5jb25jYXQoY2hpbGRyZW5BcnJheSk7XG4gIH0sIFtdKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gbm9ybWFsaXplIHRleHQgbm9kZSB0byBoYXZlIHNhbWUgc3RydWN0dXJlIHRoYW4gcmVndWxhciBkb20gbm9kZXNcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgY2hpbGQ7XG4gICAgICByZXR1cm4gdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkIDogY3JlYXRlVGV4dFZOb2RlKGNoaWxkKTtcbiAgICB9KTtcblxuICBpZiAodHlwZW9mIG5vZGVUeXBlICE9PSAnZnVuY3Rpb24nKSB7Ly9yZWd1bGFyIGh0bWwvdGV4dCBub2RlXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGVUeXBlLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgY2hpbGRyZW46IGZsYXRDaGlsZHJlbixcbiAgICAgIGxpZmVDeWNsZTogMFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZnVsbFByb3BzID0gT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IGZsYXRDaGlsZHJlbn0sIHByb3BzKTtcbiAgICBjb25zdCBjb21wID0gbm9kZVR5cGUoZnVsbFByb3BzKTtcbiAgICByZXR1cm4gdHlwZW9mIGNvbXAgIT09ICdmdW5jdGlvbicgPyBjb21wIDogaChjb21wLCBwcm9wcywgLi4uZmxhdENoaWxkcmVuKTsgLy9mdW5jdGlvbmFsIGNvbXAgdnMgY29tYmluYXRvciAoSE9DKVxuICB9XG59OyIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBjb25zdCBuZXh0VGljayA9IGZuID0+IHNldFRpbWVvdXQoZm4sIDApO1xuXG5leHBvcnQgY29uc3QgcGFpcmlmeSA9IGhvbGRlciA9PiBrZXkgPT4gW2tleSwgaG9sZGVyW2tleV1dO1xuXG5leHBvcnQgY29uc3QgaXNTaGFsbG93RXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCBhS2V5cyA9IE9iamVjdC5rZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IE9iamVjdC5rZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoKGspID0+IGFba10gPT09IGJba10pO1xufTtcblxuY29uc3Qgb3duS2V5cyA9IG9iaiA9PiBPYmplY3Qua2V5cyhvYmopLmZpbHRlcihrID0+IG9iai5oYXNPd25Qcm9wZXJ0eShrKSk7XG5cbmV4cG9ydCBjb25zdCBpc0RlZXBFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IHR5cGUgPSB0eXBlb2YgYTtcblxuICAvL3Nob3J0IHBhdGgocylcbiAgaWYgKGEgPT09IGIpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSB0eXBlb2YgYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG5cbiAgLy8gb2JqZWN0cyAuLi5cbiAgaWYgKGEgPT09IG51bGwgfHwgYiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KGEpKSB7XG4gICAgcmV0dXJuIGEubGVuZ3RoICYmIGIubGVuZ3RoICYmIGEuZXZlcnkoKGl0ZW0sIGkpID0+IGlzRGVlcEVxdWFsKGFbaV0sIGJbaV0pKTtcbiAgfVxuXG4gIGNvbnN0IGFLZXlzID0gb3duS2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBvd25LZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoayA9PiBpc0RlZXBFcXVhbChhW2tdLCBiW2tdKSk7XG59O1xuXG5leHBvcnQgY29uc3QgaWRlbnRpdHkgPSBhID0+IGE7XG5cbmV4cG9ydCBjb25zdCBub29wID0gXyA9PiB7XG59O1xuIiwiaW1wb3J0IHt0YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IFNWR19OUCA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc7XG5cbmNvbnN0IHVwZGF0ZURvbU5vZGVGYWN0b3J5ID0gKG1ldGhvZCkgPT4gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IHBhaXIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlW21ldGhvZF0oLi4ucGFpcik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgncmVtb3ZlRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IGFkZEV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ2FkZEV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBzZXRBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoKGRvbU5vZGUpID0+IHtcbiAgY29uc3QgYXR0cmlidXRlcyA9IGl0ZW1zLmZpbHRlcigoW2tleSwgdmFsdWVdKSA9PiB0eXBlb2YgdmFsdWUgIT09ICdmdW5jdGlvbicpO1xuICBmb3IgKGxldCBba2V5LCB2YWx1ZV0gb2YgYXR0cmlidXRlcykge1xuICAgIHZhbHVlID09PSBmYWxzZSA/IGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGtleSkgOiBkb21Ob2RlLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgfVxufSk7XG5leHBvcnQgY29uc3QgcmVtb3ZlQXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBhdHRyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3Qgc2V0VGV4dE5vZGUgPSB2YWwgPT4gbm9kZSA9PiBub2RlLnRleHRDb250ZW50ID0gdmFsO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlRG9tTm9kZSA9ICh2bm9kZSwgcGFyZW50KSA9PiB7XG4gIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ3N2ZycpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OUCwgdm5vZGUubm9kZVR5cGUpO1xuICB9IGVsc2UgaWYgKHZub2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodm5vZGUubm9kZVR5cGUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwYXJlbnQubmFtZXNwYWNlVVJJID09PSBTVkdfTlAgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05QLCB2bm9kZS5ub2RlVHlwZSkgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHZub2RlLm5vZGVUeXBlKTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGdldEV2ZW50TGlzdGVuZXJzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcylcbiAgICAuZmlsdGVyKGsgPT4gay5zdWJzdHIoMCwgMikgPT09ICdvbicpXG4gICAgLm1hcChrID0+IFtrLnN1YnN0cigyKS50b0xvd2VyQ2FzZSgpLCBwcm9wc1trXV0pO1xufTtcbiIsImV4cG9ydCBjb25zdCB0cmF2ZXJzZSA9IGZ1bmN0aW9uICogKHZub2RlKSB7XG4gIHlpZWxkIHZub2RlO1xuICBpZiAodm5vZGUuY2hpbGRyZW4gJiYgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2Ygdm5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIHlpZWxkICogdHJhdmVyc2UoY2hpbGQpO1xuICAgIH1cbiAgfVxufTsiLCJpbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgaXNTaGFsbG93RXF1YWwsXG4gIHBhaXJpZnksXG4gIG5leHRUaWNrLFxuICBub29wXG59IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQge1xuICByZW1vdmVBdHRyaWJ1dGVzLFxuICBzZXRBdHRyaWJ1dGVzLFxuICBzZXRUZXh0Tm9kZSxcbiAgY3JlYXRlRG9tTm9kZSxcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMsXG4gIGFkZEV2ZW50TGlzdGVuZXJzLFxuICBnZXRFdmVudExpc3RlbmVycyxcbn0gZnJvbSAnLi9kb21VdGlsJztcbmltcG9ydCB7dHJhdmVyc2V9IGZyb20gJy4vdHJhdmVyc2UnO1xuXG5mdW5jdGlvbiB1cGRhdGVFdmVudExpc3RlbmVycyAoe3Byb3BzOm5ld05vZGVQcm9wc309e30sIHtwcm9wczpvbGROb2RlUHJvcHN9PXt9KSB7XG4gIGNvbnN0IG5ld05vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhuZXdOb2RlUHJvcHMgfHwge30pO1xuICBjb25zdCBvbGROb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMob2xkTm9kZVByb3BzIHx8IHt9KTtcblxuICByZXR1cm4gbmV3Tm9kZUV2ZW50cy5sZW5ndGggfHwgb2xkTm9kZUV2ZW50cy5sZW5ndGggP1xuICAgIGNvbXBvc2UoXG4gICAgICByZW1vdmVFdmVudExpc3RlbmVycyhvbGROb2RlRXZlbnRzKSxcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKG5ld05vZGVFdmVudHMpXG4gICAgKSA6IG5vb3A7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUF0dHJpYnV0ZXMgKG5ld1ZOb2RlLCBvbGRWTm9kZSkge1xuICBjb25zdCBuZXdWTm9kZVByb3BzID0gbmV3Vk5vZGUucHJvcHMgfHwge307XG4gIGNvbnN0IG9sZFZOb2RlUHJvcHMgPSBvbGRWTm9kZS5wcm9wcyB8fCB7fTtcblxuICBpZiAoaXNTaGFsbG93RXF1YWwobmV3Vk5vZGVQcm9wcywgb2xkVk5vZGVQcm9wcykpIHtcbiAgICByZXR1cm4gbm9vcDtcbiAgfVxuXG4gIGlmIChuZXdWTm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgcmV0dXJuIHNldFRleHROb2RlKG5ld1ZOb2RlLnByb3BzLnZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IG5ld05vZGVLZXlzID0gT2JqZWN0LmtleXMobmV3Vk5vZGVQcm9wcyk7XG4gIGNvbnN0IG9sZE5vZGVLZXlzID0gT2JqZWN0LmtleXMob2xkVk5vZGVQcm9wcyk7XG4gIGNvbnN0IGF0dHJpYnV0ZXNUb1JlbW92ZSA9IG9sZE5vZGVLZXlzLmZpbHRlcihrID0+ICFuZXdOb2RlS2V5cy5pbmNsdWRlcyhrKSk7XG5cbiAgcmV0dXJuIGNvbXBvc2UoXG4gICAgcmVtb3ZlQXR0cmlidXRlcyhhdHRyaWJ1dGVzVG9SZW1vdmUpLFxuICAgIHNldEF0dHJpYnV0ZXMobmV3Tm9kZUtleXMubWFwKHBhaXJpZnkobmV3Vk5vZGVQcm9wcykpKVxuICApO1xufVxuXG5jb25zdCBkb21GYWN0b3J5ID0gY3JlYXRlRG9tTm9kZTtcblxuLy8gYXBwbHkgdm5vZGUgZGlmZmluZyB0byBhY3R1YWwgZG9tIG5vZGUgKGlmIG5ldyBub2RlID0+IGl0IHdpbGwgYmUgbW91bnRlZCBpbnRvIHRoZSBwYXJlbnQpXG5jb25zdCBkb21pZnkgPSBmdW5jdGlvbiB1cGRhdGVEb20gKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSkge1xuICBpZiAoIW9sZFZub2RlKSB7Ly90aGVyZSBpcyBubyBwcmV2aW91cyB2bm9kZVxuICAgIGlmIChuZXdWbm9kZSkgey8vbmV3IG5vZGUgPT4gd2UgaW5zZXJ0XG4gICAgICBuZXdWbm9kZS5kb20gPSBwYXJlbnREb21Ob2RlLmFwcGVuZENoaWxkKGRvbUZhY3RvcnkobmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICByZXR1cm4ge3Zub2RlOiBuZXdWbm9kZSwgZ2FyYmFnZTogbnVsbH07XG4gICAgfSBlbHNlIHsvL2Vsc2UgKGlycmVsZXZhbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpXG4gICAgfVxuICB9IGVsc2Ugey8vdGhlcmUgaXMgYSBwcmV2aW91cyB2bm9kZVxuICAgIGlmICghbmV3Vm5vZGUpIHsvL3dlIG11c3QgcmVtb3ZlIHRoZSByZWxhdGVkIGRvbSBub2RlXG4gICAgICBwYXJlbnREb21Ob2RlLnJlbW92ZUNoaWxkKG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4gKHtnYXJiYWdlOiBvbGRWbm9kZSwgZG9tOiBudWxsfSk7XG4gICAgfSBlbHNlIGlmIChuZXdWbm9kZS5ub2RlVHlwZSAhPT0gb2xkVm5vZGUubm9kZVR5cGUpIHsvL2l0IG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IGRvbUZhY3RvcnkobmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHBhcmVudERvbU5vZGUucmVwbGFjZUNoaWxkKG5ld1Zub2RlLmRvbSwgb2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogb2xkVm5vZGUsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfSBlbHNlIHsvLyBvbmx5IHVwZGF0ZSBhdHRyaWJ1dGVzXG4gICAgICBuZXdWbm9kZS5kb20gPSBvbGRWbm9kZS5kb207XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSBvbGRWbm9kZS5saWZlQ3ljbGUgKyAxO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBudWxsLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiByZW5kZXIgYSB2aXJ0dWFsIGRvbSBub2RlLCBkaWZmaW5nIGl0IHdpdGggaXRzIHByZXZpb3VzIHZlcnNpb24sIG1vdW50aW5nIGl0IGluIGEgcGFyZW50IGRvbSBub2RlXG4gKiBAcGFyYW0gb2xkVm5vZGVcbiAqIEBwYXJhbSBuZXdWbm9kZVxuICogQHBhcmFtIHBhcmVudERvbU5vZGVcbiAqIEBwYXJhbSBvbk5leHRUaWNrIGNvbGxlY3Qgb3BlcmF0aW9ucyB0byBiZSBwcm9jZXNzZWQgb24gbmV4dCB0aWNrXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmV4cG9ydCBjb25zdCByZW5kZXIgPSBmdW5jdGlvbiByZW5kZXJlciAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlLCBvbk5leHRUaWNrID0gW10pIHtcblxuICAvLzEuIHRyYW5zZm9ybSB0aGUgbmV3IHZub2RlIHRvIGEgdm5vZGUgY29ubmVjdGVkIHRvIGFuIGFjdHVhbCBkb20gZWxlbWVudCBiYXNlZCBvbiB2bm9kZSB2ZXJzaW9ucyBkaWZmaW5nXG4gIC8vIGkuIG5vdGUgYXQgdGhpcyBzdGVwIG9jY3VyIGRvbSBpbnNlcnRpb25zL3JlbW92YWxzXG4gIC8vIGlpLiBpdCBtYXkgY29sbGVjdCBzdWIgdHJlZSB0byBiZSBkcm9wcGVkIChvciBcInVubW91bnRlZFwiKVxuICBjb25zdCB7dm5vZGUsIGdhcmJhZ2V9ID0gZG9taWZ5KG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSk7XG5cbiAgaWYgKGdhcmJhZ2UgIT09IG51bGwpIHtcbiAgICAvLyBkZWZlciB1bm1vdW50IGxpZmVjeWNsZSBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGZvciAobGV0IGcgb2YgdHJhdmVyc2UoZ2FyYmFnZSkpIHtcbiAgICAgIGlmIChnLm9uVW5Nb3VudCkge1xuICAgICAgICBvbk5leHRUaWNrLnB1c2goZy5vblVuTW91bnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vTm9ybWFsaXNhdGlvbiBvZiBvbGQgbm9kZSAoaW4gY2FzZSBvZiBhIHJlcGxhY2Ugd2Ugd2lsbCBjb25zaWRlciBvbGQgbm9kZSBhcyBlbXB0eSBub2RlIChubyBjaGlsZHJlbiwgbm8gcHJvcHMpKVxuICBjb25zdCB0ZW1wT2xkTm9kZSA9IGdhcmJhZ2UgIT09IG51bGwgfHwgIW9sZFZub2RlID8ge2xlbmd0aDogMCwgY2hpbGRyZW46IFtdLCBwcm9wczoge319IDogb2xkVm5vZGU7XG5cbiAgaWYgKHZub2RlKSB7XG5cbiAgICAvLzIuIHVwZGF0ZSBkb20gYXR0cmlidXRlcyBiYXNlZCBvbiB2bm9kZSBwcm9wIGRpZmZpbmcuXG4gICAgLy9zeW5jXG4gICAgaWYgKHZub2RlLm9uVXBkYXRlICYmIHZub2RlLmxpZmVDeWNsZSA+IDEpIHtcbiAgICAgIHZub2RlLm9uVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlQXR0cmlidXRlcyh2bm9kZSwgdGVtcE9sZE5vZGUpKHZub2RlLmRvbSk7XG5cbiAgICAvL2Zhc3QgcGF0aFxuICAgIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgICByZXR1cm4gb25OZXh0VGljaztcbiAgICB9XG5cbiAgICBpZiAodm5vZGUub25Nb3VudCAmJiB2bm9kZS5saWZlQ3ljbGUgPT09IDEpIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiB2bm9kZS5vbk1vdW50KCkpO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuQ291bnQgPSBNYXRoLm1heCh0ZW1wT2xkTm9kZS5jaGlsZHJlbi5sZW5ndGgsIHZub2RlLmNoaWxkcmVuLmxlbmd0aCk7XG5cbiAgICAvL2FzeW5jIHdpbGwgYmUgZGVmZXJyZWQgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBjb25zdCBzZXRMaXN0ZW5lcnMgPSB1cGRhdGVFdmVudExpc3RlbmVycyh2bm9kZSwgdGVtcE9sZE5vZGUpO1xuICAgIGlmIChzZXRMaXN0ZW5lcnMgIT09IG5vb3ApIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiBzZXRMaXN0ZW5lcnModm5vZGUuZG9tKSk7XG4gICAgfVxuXG4gICAgLy8zIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIGNoaWxkcmVuIHRvIHVwZGF0ZSBkb20gYW5kIGNvbGxlY3QgZnVuY3Rpb25zIHRvIHByb2Nlc3Mgb24gbmV4dCB0aWNrXG4gICAgaWYgKGNoaWxkcmVuQ291bnQgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuQ291bnQ7IGkrKykge1xuICAgICAgICAvLyB3ZSBwYXNzIG9uTmV4dFRpY2sgYXMgcmVmZXJlbmNlIChpbXByb3ZlIHBlcmY6IG1lbW9yeSArIHNwZWVkKVxuICAgICAgICByZW5kZXIodGVtcE9sZE5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5kb20sIG9uTmV4dFRpY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvbk5leHRUaWNrO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGh5ZHJhdGUgKHZub2RlLCBkb20pIHtcbiAgJ3VzZSBzdHJpY3QnO1xuICBjb25zdCBoeWRyYXRlZCA9IE9iamVjdC5hc3NpZ24oe30sIHZub2RlKTtcbiAgY29uc3QgZG9tQ2hpbGRyZW4gPSBBcnJheS5mcm9tKGRvbS5jaGlsZE5vZGVzKS5maWx0ZXIobiA9PiBuLm5vZGVUeXBlICE9PSAzIHx8IG4ubm9kZVZhbHVlLnRyaW0oKSAhPT0gJycpO1xuICBoeWRyYXRlZC5kb20gPSBkb207XG4gIGh5ZHJhdGVkLmNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW4ubWFwKChjaGlsZCwgaSkgPT4gaHlkcmF0ZShjaGlsZCwgZG9tQ2hpbGRyZW5baV0pKTtcbiAgcmV0dXJuIGh5ZHJhdGVkO1xufVxuXG5leHBvcnQgY29uc3QgbW91bnQgPSBjdXJyeShmdW5jdGlvbiAoY29tcCwgaW5pdFByb3AsIHJvb3QpIHtcbiAgY29uc3Qgdm5vZGUgPSBjb21wLm5vZGVUeXBlICE9PSB2b2lkIDAgPyBjb21wIDogY29tcChpbml0UHJvcCB8fCB7fSk7XG4gIGNvbnN0IG9sZFZOb2RlID0gcm9vdC5jaGlsZHJlbi5sZW5ndGggPyBoeWRyYXRlKHZub2RlLCByb290LmNoaWxkcmVuWzBdKSA6IG51bGw7XG4gIGNvbnN0IGJhdGNoID0gcmVuZGVyKG9sZFZOb2RlLCB2bm9kZSwgcm9vdCk7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKGxldCBvcCBvZiBiYXRjaCkge1xuICAgICAgb3AoKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdm5vZGU7XG59KTsiLCJpbXBvcnQge3JlbmRlcn0gZnJvbSAnLi90cmVlJztcbmltcG9ydCB7bmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ3JlYXRlIGEgZnVuY3Rpb24gd2hpY2ggd2lsbCB0cmlnZ2VyIGFuIHVwZGF0ZSBvZiB0aGUgY29tcG9uZW50IHdpdGggdGhlIHBhc3NlZCBzdGF0ZVxuICogQHBhcmFtIGNvbXAge0Z1bmN0aW9ufSAtIHRoZSBjb21wb25lbnQgdG8gdXBkYXRlXG4gKiBAcGFyYW0gaW5pdGlhbFZOb2RlIC0gdGhlIGluaXRpYWwgdmlydHVhbCBkb20gbm9kZSByZWxhdGVkIHRvIHRoZSBjb21wb25lbnQgKGllIG9uY2UgaXQgaGFzIGJlZW4gbW91bnRlZClcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSB0aGUgdXBkYXRlIGZ1bmN0aW9uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVwZGF0ZSAoY29tcCwgaW5pdGlhbFZOb2RlKSB7XG4gIGxldCBvbGROb2RlID0gaW5pdGlhbFZOb2RlO1xuICBjb25zdCB1cGRhdGVGdW5jID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgbW91bnQgPSBvbGROb2RlLmRvbS5wYXJlbnROb2RlO1xuICAgIGNvbnN0IG5ld05vZGUgPSBjb21wKE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBvbGROb2RlLmNoaWxkcmVuIHx8IFtdfSwgb2xkTm9kZS5wcm9wcywgcHJvcHMpLCAuLi5hcmdzKTtcbiAgICBjb25zdCBuZXh0QmF0Y2ggPSByZW5kZXIob2xkTm9kZSwgbmV3Tm9kZSwgbW91bnQpO1xuXG4gICAgLy8gZGFuZ2VyIHpvbmUgISEhIVxuICAgIC8vIGNoYW5nZSBieSBrZWVwaW5nIHRoZSBzYW1lIHJlZmVyZW5jZSBzbyB0aGUgZXZlbnR1YWwgcGFyZW50IG5vZGUgZG9lcyBub3QgbmVlZCB0byBiZSBcImF3YXJlXCIgdHJlZSBtYXkgaGF2ZSBjaGFuZ2VkIGRvd25zdHJlYW06IG9sZE5vZGUgbWF5IGJlIHRoZSBjaGlsZCBvZiBzb21lb25lIC4uLih3ZWxsIHRoYXQgaXMgYSB0cmVlIGRhdGEgc3RydWN0dXJlIGFmdGVyIGFsbCA6UCApXG4gICAgb2xkTm9kZSA9IE9iamVjdC5hc3NpZ24ob2xkTm9kZSB8fCB7fSwgbmV3Tm9kZSk7XG4gICAgLy8gZW5kIGRhbmdlciB6b25lXG5cbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBmb3IgKGxldCBvcCBvZiBuZXh0QmF0Y2gpIHtcbiAgICAgICAgb3AoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZTtcbiAgfTtcbiAgcmV0dXJuIHVwZGF0ZUZ1bmM7XG59IiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgbGlmZUN5Y2xlRmFjdG9yeSA9IG1ldGhvZCA9PiBjdXJyeSgoZm4sIGNvbXApID0+IChwcm9wcywgLi4uYXJncykgPT4ge1xuICBjb25zdCBuID0gY29tcChwcm9wcywgLi4uYXJncyk7XG4gIG5bbWV0aG9kXSA9ICgpID0+IGZuKG4sIC4uLmFyZ3MpO1xuICByZXR1cm4gbjtcbn0pO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyB1bm1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVW5Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVW5Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IGJlZm9yZSB0aGUgY29tcG9uZW50IGlzIHVwZGF0ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVXBkYXRlID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25VcGRhdGUnKTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudCwgb25VcGRhdGV9IGZyb20gJy4vbGlmZUN5Y2xlcyc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbi8qKlxuICogQ29tYmluYXRvciB0byBjcmVhdGUgYSBcInN0YXRlZnVsIGNvbXBvbmVudFwiOiBpZSBpdCB3aWxsIGhhdmUgaXRzIG93biBzdGF0ZSBhbmQgdGhlIGFiaWxpdHkgdG8gdXBkYXRlIGl0cyBvd24gdHJlZVxuICogQHBhcmFtIGNvbXAge0Z1bmN0aW9ufSAtIHRoZSBjb21wb25lbnRcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBhIG5ldyB3cmFwcGVkIGNvbXBvbmVudFxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoY29tcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAvL2xhenkgZXZhbHVhdGUgdXBkYXRlRnVuYyAodG8gbWFrZSBzdXJlIGl0IGlzIGRlZmluZWRcbiAgICAgIGNvbnN0IHNldFN0YXRlID0gKG5ld1N0YXRlKSA9PiB1cGRhdGVGdW5jKG5ld1N0YXRlKTtcbiAgICAgIHJldHVybiBjb21wKHByb3BzLCBzZXRTdGF0ZSwgLi4uYXJncyk7XG4gICAgfTtcbiAgICBjb25zdCBzZXRVcGRhdGVGdW5jdGlvbiA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgIH07XG5cbiAgICByZXR1cm4gY29tcG9zZShvbk1vdW50KHNldFVwZGF0ZUZ1bmN0aW9uKSwgb25VcGRhdGUoc2V0VXBkYXRlRnVuY3Rpb24pKSh3cmFwcGVyQ29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgRWxtIGxpa2UgYXBwXG4gKiBAcGFyYW0gdmlldyB7RnVuY3Rpb259IC0gYSBjb21wb25lbnQgd2hpY2ggdGFrZXMgYXMgYXJndW1lbnRzIHRoZSBjdXJyZW50IG1vZGVsIGFuZCB0aGUgbGlzdCBvZiB1cGRhdGVzXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gYSBFbG0gbGlrZSBhcHBsaWNhdGlvbiB3aG9zZSBwcm9wZXJ0aWVzIFwibW9kZWxcIiwgXCJ1cGRhdGVzXCIgYW5kIFwic3Vic2NyaXB0aW9uc1wiIHdpbGwgZGVmaW5lIHRoZSByZWxhdGVkIGRvbWFpbiBzcGVjaWZpYyBvYmplY3RzXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh2aWV3KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe21vZGVsLCB1cGRhdGVzLCBzdWJzY3JpcHRpb25zID0gW119PXt9KSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgbGV0IGFjdGlvblN0b3JlID0ge307XG4gICAgZm9yIChsZXQgdXBkYXRlIG9mIE9iamVjdC5rZXlzKHVwZGF0ZXMpKSB7XG4gICAgICBhY3Rpb25TdG9yZVt1cGRhdGVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgbW9kZWwgPSB1cGRhdGVzW3VwZGF0ZV0obW9kZWwsIC4uLmFyZ3MpOyAvL3RvZG8gY29uc2lkZXIgc2lkZSBlZmZlY3RzLCBtaWRkbGV3YXJlcywgZXRjXG4gICAgICAgIHJldHVybiB1cGRhdGVGdW5jKG1vZGVsLCBhY3Rpb25TdG9yZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29tcCA9ICgpID0+IHZpZXcobW9kZWwsIGFjdGlvblN0b3JlKTtcblxuICAgIGNvbnN0IGluaXRBY3Rpb25TdG9yZSA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZShjb21wLCB2bm9kZSk7XG4gICAgfTtcbiAgICBjb25zdCBpbml0U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5tYXAoc3ViID0+IHZub2RlID0+IHN1Yih2bm9kZSwgYWN0aW9uU3RvcmUpKTtcbiAgICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICAgIHJldHVybiBvbk1vdW50KGluaXRGdW5jLCBjb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVuTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcydcbmltcG9ydCB7aXNEZWVwRXF1YWwsIGlkZW50aXR5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENvbm5lY3QgY29tYmluYXRvcjogd2lsbCBjcmVhdGUgXCJjb250YWluZXJcIiBjb21wb25lbnQgd2hpY2ggd2lsbCBzdWJzY3JpYmUgdG8gYSBSZWR1eCBsaWtlIHN0b3JlLiBhbmQgdXBkYXRlIGl0cyBjaGlsZHJlbiB3aGVuZXZlciBhIHNwZWNpZmljIHNsaWNlIG9mIHN0YXRlIGNoYW5nZSB1bmRlciBzcGVjaWZpYyBjaXJjdW1zdGFuY2VzXG4gKiBAcGFyYW0gc3RvcmUge09iamVjdH0gLSBUaGUgc3RvcmUgKGltcGxlbWVudGluZyB0aGUgc2FtZSBhcGkgdGhhbiBSZWR1eCBzdG9yZVxuICogQHBhcmFtIGFjdGlvbnMge09iamVjdH0gW3t9XSAtIFRoZSBsaXN0IG9mIGFjdGlvbnMgdGhlIGNvbm5lY3RlZCBjb21wb25lbnQgd2lsbCBiZSBhYmxlIHRvIHRyaWdnZXJcbiAqIEBwYXJhbSBzbGljZVN0YXRlIHtGdW5jdGlvbn0gW3N0YXRlID0+IHN0YXRlXSAtIEEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnQgdGhlIHN0YXRlIGFuZCByZXR1cm4gYSBcInRyYW5zZm9ybWVkXCIgc3RhdGUgKGxpa2UgcGFydGlhbCwgZXRjKSByZWxldmFudCB0byB0aGUgY29udGFpbmVyXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBjb250YWluZXIgZmFjdG9yeSB3aXRoIHRoZSBmb2xsb3dpbmcgYXJndW1lbnRzOlxuICogIC0gY29tcDogdGhlIGNvbXBvbmVudCB0byB3cmFwIG5vdGUgdGhlIGFjdGlvbnMgb2JqZWN0IHdpbGwgYmUgcGFzc2VkIGFzIHNlY29uZCBhcmd1bWVudCBvZiB0aGUgY29tcG9uZW50IGZvciBjb252ZW5pZW5jZVxuICogIC0gbWFwU3RhdGVUb1Byb3A6IGEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnQgd2hhdCB0aGUgXCJzbGljZVN0YXRlXCIgZnVuY3Rpb24gcmV0dXJucyBhbmQgcmV0dXJucyBhbiBvYmplY3QgdG8gYmUgYmxlbmRlZCBpbnRvIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBjb21wb25lbnQgKGRlZmF1bHQgdG8gaWRlbnRpdHkgZnVuY3Rpb24pXG4gKiAgLSBzaG91bGRVcGRhdGU6IGEgZnVuY3Rpb24gd2hpY2ggdGFrZXMgYXMgYXJndW1lbnRzIHRoZSBwcmV2aW91cyBhbmQgdGhlIGN1cnJlbnQgdmVyc2lvbnMgb2Ygd2hhdCBcInNsaWNlU3RhdGVcIiBmdW5jdGlvbiByZXR1cm5zIHRvIHJldHVybnMgYSBib29sZWFuIGRlZmluaW5nIHdoZXRoZXIgdGhlIGNvbXBvbmVudCBzaG91bGQgYmUgdXBkYXRlZCAoZGVmYXVsdCB0byBhIGRlZXBFcXVhbCBjaGVjaylcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHN0b3JlLCBhY3Rpb25zID0ge30sIHNsaWNlU3RhdGUgPSBpZGVudGl0eSkge1xuICByZXR1cm4gZnVuY3Rpb24gKGNvbXAsIG1hcFN0YXRlVG9Qcm9wID0gaWRlbnRpdHksIHNob3VsZFVwYXRlID0gKGEsIGIpID0+IGlzRGVlcEVxdWFsKGEsIGIpID09PSBmYWxzZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoaW5pdFByb3ApIHtcbiAgICAgIGxldCBjb21wb25lbnRQcm9wcyA9IGluaXRQcm9wO1xuICAgICAgbGV0IHVwZGF0ZUZ1bmMsIHByZXZpb3VzU3RhdGVTbGljZSwgdW5zdWJzY3JpYmVyO1xuXG4gICAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgICByZXR1cm4gY29tcChwcm9wcywgYWN0aW9ucywgLi4uYXJncyk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBzdWJzY3JpYmUgPSBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgICAgIHVuc3Vic2NyaWJlciA9IHN0b3JlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdGVTbGljZSA9IHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgaWYgKHNob3VsZFVwYXRlKHByZXZpb3VzU3RhdGVTbGljZSwgc3RhdGVTbGljZSkgPT09IHRydWUpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50UHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHN0YXRlU2xpY2UpKTtcbiAgICAgICAgICAgIHVwZGF0ZUZ1bmMoY29tcG9uZW50UHJvcHMpO1xuICAgICAgICAgICAgcHJldmlvdXNTdGF0ZVNsaWNlID0gc3RhdGVTbGljZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gb25Vbk1vdW50KCgpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmVyKCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNvbXBvc2Uoc3Vic2NyaWJlLCB1bnN1YnNjcmliZSkod3JhcHBlckNvbXApO1xuICAgIH07XG4gIH07XG59OyIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBvaW50ZXIgKHBhdGgpIHtcblxuICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblxuICBmdW5jdGlvbiBwYXJ0aWFsIChvYmogPSB7fSwgcGFydHMgPSBbXSkge1xuICAgIGNvbnN0IHAgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgcmV0dXJuIChjdXJyZW50ID09PSB1bmRlZmluZWQgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHRhcmdldCwgbmV3VHJlZSkge1xuICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgIGNvbnN0IFtsZWFmLCAuLi5pbnRlcm1lZGlhdGVdID0gcGFydHMucmV2ZXJzZSgpO1xuICAgIGZvciAobGV0IGtleSBvZiBpbnRlcm1lZGlhdGUucmV2ZXJzZSgpKSB7XG4gICAgICBpZiAoY3VycmVudFtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGN1cnJlbnRbbGVhZl0gPSBPYmplY3QuYXNzaWduKGN1cnJlbnRbbGVhZl0gfHwge30sIG5ld1RyZWUpO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldCh0YXJnZXQpe1xuICAgICAgcmV0dXJuIHBhcnRpYWwodGFyZ2V0LCBbLi4ucGFydHNdKVxuICAgIH0sXG4gICAgc2V0XG4gIH1cbn07XG4iLCJpbXBvcnQge3N3YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5cbmZ1bmN0aW9uIHNvcnRCeVByb3BlcnR5IChwcm9wKSB7XG4gIGNvbnN0IHByb3BHZXR0ZXIgPSBwb2ludGVyKHByb3ApLmdldDtcbiAgcmV0dXJuIChhLCBiKSA9PiB7XG4gICAgY29uc3QgYVZhbCA9IHByb3BHZXR0ZXIoYSk7XG4gICAgY29uc3QgYlZhbCA9IHByb3BHZXR0ZXIoYik7XG5cbiAgICBpZiAoYVZhbCA9PT0gYlZhbCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgaWYgKGJWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGlmIChhVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiBhVmFsIDwgYlZhbCA/IC0xIDogMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzb3J0RmFjdG9yeSAoe3BvaW50ZXIsIGRpcmVjdGlvbn0gPSB7fSkge1xuICBpZiAoIXBvaW50ZXIgfHwgZGlyZWN0aW9uID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gWy4uLmFycmF5XTtcbiAgfVxuXG4gIGNvbnN0IG9yZGVyRnVuYyA9IHNvcnRCeVByb3BlcnR5KHBvaW50ZXIpO1xuICBjb25zdCBjb21wYXJlRnVuYyA9IGRpcmVjdGlvbiA9PT0gJ2Rlc2MnID8gc3dhcChvcmRlckZ1bmMpIDogb3JkZXJGdW5jO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IFsuLi5hcnJheV0uc29ydChjb21wYXJlRnVuYyk7XG59IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZnVuY3Rpb24gdHlwZUV4cHJlc3Npb24gKHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gQm9vbGVhbjtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICBjYXNlICdkYXRlJzpcbiAgICAgIHJldHVybiAodmFsKSA9PiBuZXcgRGF0ZSh2YWwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsICh2YWwpID0+IHZhbC50b0xvd2VyQ2FzZSgpKTtcbiAgfVxufVxuXG5jb25zdCBvcGVyYXRvcnMgPSB7XG4gIGluY2x1ZGVzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dC5pbmNsdWRlcyh2YWx1ZSk7XG4gIH0sXG4gIGlzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgaXNOb3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+ICFPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgbHQodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDwgdmFsdWU7XG4gIH0sXG4gIGd0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+IHZhbHVlO1xuICB9LFxuICBsdGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDw9IHZhbHVlO1xuICB9LFxuICBndGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID49IHZhbHVlO1xuICB9LFxuICBlcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlID09IGlucHV0O1xuICB9LFxuICBub3RFcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlICE9IGlucHV0O1xuICB9XG59O1xuXG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByZWRpY2F0ZSAoe3ZhbHVlID0gJycsIG9wZXJhdG9yID0gJ2luY2x1ZGVzJywgdHlwZSA9ICdzdHJpbmcnfSkge1xuICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgY29uc3Qgb3BlcmF0ZU9uVHlwZWQgPSBjb21wb3NlKHR5cGVJdCwgb3BlcmF0b3JzW29wZXJhdG9yXSk7XG4gIGNvbnN0IHByZWRpY2F0ZUZ1bmMgPSBvcGVyYXRlT25UeXBlZCh2YWx1ZSk7XG4gIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59XG5cbi8vYXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5mdW5jdGlvbiBub3JtYWxpemVDbGF1c2VzIChjb25mKSB7XG4gIGNvbnN0IG91dHB1dCA9IHt9O1xuICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgdmFsaWRQYXRoLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgaWYgKHZhbGlkQ2xhdXNlcy5sZW5ndGgpIHtcbiAgICAgIG91dHB1dFtwYXRoXSA9IHZhbGlkQ2xhdXNlcztcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaWx0ZXIgKGZpbHRlcikge1xuICBjb25zdCBub3JtYWxpemVkQ2xhdXNlcyA9IG5vcm1hbGl6ZUNsYXVzZXMoZmlsdGVyKTtcbiAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgIGNvbnN0IGdldHRlciA9IHBvaW50ZXIocGF0aCkuZ2V0O1xuICAgIGNvbnN0IGNsYXVzZXMgPSBub3JtYWxpemVkQ2xhdXNlc1twYXRoXS5tYXAocHJlZGljYXRlKTtcbiAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgfSk7XG4gIGNvbnN0IGZpbHRlclByZWRpY2F0ZSA9IGV2ZXJ5KGZ1bmNMaXN0KTtcblxuICByZXR1cm4gKGFycmF5KSA9PiBhcnJheS5maWx0ZXIoZmlsdGVyUHJlZGljYXRlKTtcbn0iLCJpbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc2VhcmNoQ29uZiA9IHt9KSB7XG4gIGNvbnN0IHt2YWx1ZSwgc2NvcGUgPSBbXX0gPSBzZWFyY2hDb25mO1xuICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICBpZiAoIXNjb3BlLmxlbmd0aCB8fCAhdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiBTdHJpbmcocChpdGVtKSkuaW5jbHVkZXMoU3RyaW5nKHZhbHVlKSkpKVxuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2xpY2VGYWN0b3J5ICh7cGFnZSA9IDEsIHNpemV9ID0ge30pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHNsaWNlRnVuY3Rpb24gKGFycmF5ID0gW10pIHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZW1pdHRlciAoKSB7XG5cbiAgY29uc3QgbGlzdGVuZXJzTGlzdHMgPSB7fTtcbiAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgb24oZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSAobGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdKS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIGRpc3BhdGNoKGV2ZW50LCAuLi5hcmdzKXtcbiAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIG9mZihldmVudCwgLi4ubGlzdGVuZXJzKXtcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgT2JqZWN0LmtleXMobGlzdGVuZXJzTGlzdHMpLmZvckVhY2goZXYgPT4gaW5zdGFuY2Uub2ZmKGV2KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSBsaXN0ZW5lcnMubGVuZ3RoID8gbGlzdC5maWx0ZXIobGlzdGVuZXIgPT4gIWxpc3RlbmVycy5pbmNsdWRlcyhsaXN0ZW5lcikpIDogW107XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuICB9O1xuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm94eUxpc3RlbmVyIChldmVudE1hcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHtlbWl0dGVyfSkge1xuXG4gICAgY29uc3QgcHJveHkgPSB7fTtcbiAgICBsZXQgZXZlbnRMaXN0ZW5lcnMgPSB7fTtcblxuICAgIGZvciAobGV0IGV2IG9mIE9iamVjdC5rZXlzKGV2ZW50TWFwKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gZXZlbnRNYXBbZXZdO1xuICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICBwcm94eVttZXRob2RdID0gZnVuY3Rpb24gKC4uLmxpc3RlbmVycykge1xuICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgIGVtaXR0ZXIub24oZXYsIC4uLmxpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJveHksIHtcbiAgICAgIG9mZihldil7XG4gICAgICAgIGlmICghZXYpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhldmVudExpc3RlbmVycykuZm9yRWFjaChldmVudE5hbWUgPT4gcHJveHkub2ZmKGV2ZW50TmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudExpc3RlbmVyc1tldl0pIHtcbiAgICAgICAgICBlbWl0dGVyLm9mZihldiwgLi4uZXZlbnRMaXN0ZW5lcnNbZXZdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgVE9HR0xFX1NPUlQgPSAnVE9HR0xFX1NPUlQnO1xuZXhwb3J0IGNvbnN0IERJU1BMQVlfQ0hBTkdFRCA9ICdESVNQTEFZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFBBR0VfQ0hBTkdFRCA9ICdDSEFOR0VfUEFHRSc7XG5leHBvcnQgY29uc3QgRVhFQ19DSEFOR0VEID0gJ0VYRUNfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRklMVEVSX0NIQU5HRUQgPSAnRklMVEVSX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNVTU1BUllfQ0hBTkdFRCA9ICdTVU1NQVJZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNFQVJDSF9DSEFOR0VEID0gJ1NFQVJDSF9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBFWEVDX0VSUk9SID0gJ0VYRUNfRVJST1InOyIsImltcG9ydCBzbGljZSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge2N1cnJ5LCB0YXAsIGNvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtlbWl0dGVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHNsaWNlRmFjdG9yeSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge1xuICBTVU1NQVJZX0NIQU5HRUQsXG4gIFRPR0dMRV9TT1JULFxuICBESVNQTEFZX0NIQU5HRUQsXG4gIFBBR0VfQ0hBTkdFRCxcbiAgRVhFQ19DSEFOR0VELFxuICBGSUxURVJfQ0hBTkdFRCxcbiAgU0VBUkNIX0NIQU5HRUQsXG4gIEVYRUNfRVJST1Jcbn0gZnJvbSAnLi4vZXZlbnRzJztcblxuZnVuY3Rpb24gY3VycmllZFBvaW50ZXIgKHBhdGgpIHtcbiAgY29uc3Qge2dldCwgc2V0fSA9IHBvaW50ZXIocGF0aCk7XG4gIHJldHVybiB7Z2V0LCBzZXQ6IGN1cnJ5KHNldCl9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSxcbiAgdGFibGVTdGF0ZSxcbiAgZGF0YSxcbiAgZmlsdGVyRmFjdG9yeSxcbiAgc2VhcmNoRmFjdG9yeVxufSkge1xuICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgY29uc3Qgc29ydFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc29ydCcpO1xuICBjb25zdCBzbGljZVBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2xpY2UnKTtcbiAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzZWFyY2gnKTtcblxuICBjb25zdCBzYWZlQXNzaWduID0gY3VycnkoKGJhc2UsIGV4dGVuc2lvbikgPT4gT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwgZXh0ZW5zaW9uKSk7XG4gIGNvbnN0IGRpc3BhdGNoID0gY3VycnkodGFibGUuZGlzcGF0Y2guYmluZCh0YWJsZSksIDIpO1xuXG4gIGNvbnN0IGRpc3BhdGNoU3VtbWFyeSA9IChmaWx0ZXJlZCkgPT4ge1xuICAgIGRpc3BhdGNoKFNVTU1BUllfQ0hBTkdFRCwge1xuICAgICAgcGFnZTogdGFibGVTdGF0ZS5zbGljZS5wYWdlLFxuICAgICAgc2l6ZTogdGFibGVTdGF0ZS5zbGljZS5zaXplLFxuICAgICAgZmlsdGVyZWRDb3VudDogZmlsdGVyZWQubGVuZ3RoXG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgZXhlYyA9ICh7cHJvY2Vzc2luZ0RlbGF5ID0gMjB9ID0ge30pID0+IHtcbiAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiB0cnVlfSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCB0YXAoZGlzcGF0Y2hTdW1tYXJ5KSwgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChESVNQTEFZX0NIQU5HRUQsIGRpc3BsYXllZC5tYXAoZCA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH07XG4gICAgICAgIH0pKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19FUlJPUiwgZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH0sIHByb2Nlc3NpbmdEZWxheSk7XG4gIH07XG5cbiAgY29uc3QgdXBkYXRlVGFibGVTdGF0ZSA9IGN1cnJ5KChwdGVyLCBldiwgbmV3UGFydGlhbFN0YXRlKSA9PiBjb21wb3NlKFxuICAgIHNhZmVBc3NpZ24ocHRlci5nZXQodGFibGVTdGF0ZSkpLFxuICAgIHRhcChkaXNwYXRjaChldikpLFxuICAgIHB0ZXIuc2V0KHRhYmxlU3RhdGUpXG4gICkobmV3UGFydGlhbFN0YXRlKSk7XG5cbiAgY29uc3QgcmVzZXRUb0ZpcnN0UGFnZSA9ICgpID0+IHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQsIHtwYWdlOiAxfSk7XG5cbiAgY29uc3QgdGFibGVPcGVyYXRpb24gPSAocHRlciwgZXYpID0+IGNvbXBvc2UoXG4gICAgdXBkYXRlVGFibGVTdGF0ZShwdGVyLCBldiksXG4gICAgcmVzZXRUb0ZpcnN0UGFnZSxcbiAgICAoKSA9PiB0YWJsZS5leGVjKCkgLy8gd2Ugd3JhcCB3aXRoaW4gYSBmdW5jdGlvbiBzbyB0YWJsZS5leGVjIGNhbiBiZSBvdmVyd3JpdHRlbiAod2hlbiB1c2luZyB3aXRoIGEgc2VydmVyIGZvciBleGFtcGxlKVxuICApO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzb3J0OiB0YWJsZU9wZXJhdGlvbihzb3J0UG9pbnRlciwgVE9HR0xFX1NPUlQpLFxuICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgRklMVEVSX0NIQU5HRUQpLFxuICAgIHNlYXJjaDogdGFibGVPcGVyYXRpb24oc2VhcmNoUG9pbnRlciwgU0VBUkNIX0NIQU5HRUQpLFxuICAgIHNsaWNlOiBjb21wb3NlKHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQpLCAoKSA9PiB0YWJsZS5leGVjKCkpLFxuICAgIGV4ZWMsXG4gICAgZXZhbChzdGF0ZSA9IHRhYmxlU3RhdGUpe1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgICByZXR1cm4gZXhlY0Z1bmMoZGF0YSkubWFwKGQgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBvbkRpc3BsYXlDaGFuZ2UoZm4pe1xuICAgICAgdGFibGUub24oRElTUExBWV9DSEFOR0VELCBmbik7XG4gICAgfSxcbiAgICBnZXRUYWJsZVN0YXRlKCl7XG4gICAgICBjb25zdCBzb3J0ID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zb3J0KTtcbiAgICAgIGNvbnN0IHNlYXJjaCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2VhcmNoKTtcbiAgICAgIGNvbnN0IHNsaWNlID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zbGljZSk7XG4gICAgICBjb25zdCBmaWx0ZXIgPSB7fTtcbiAgICAgIGZvciAobGV0IHByb3AgaW4gdGFibGVTdGF0ZS5maWx0ZXIpIHtcbiAgICAgICAgZmlsdGVyW3Byb3BdID0gdGFibGVTdGF0ZS5maWx0ZXJbcHJvcF0ubWFwKHYgPT4gT2JqZWN0LmFzc2lnbih7fSwgdikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtzb3J0LCBzZWFyY2gsIHNsaWNlLCBmaWx0ZXJ9O1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBpbnN0YW5jZSA9IE9iamVjdC5hc3NpZ24odGFibGUsIGFwaSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGRhdGEubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCBzb3J0IGZyb20gJ3NtYXJ0LXRhYmxlLXNvcnQnO1xuaW1wb3J0IGZpbHRlciBmcm9tICdzbWFydC10YWJsZS1maWx0ZXInO1xuaW1wb3J0IHNlYXJjaCBmcm9tICdzbWFydC10YWJsZS1zZWFyY2gnO1xuaW1wb3J0IHRhYmxlIGZyb20gJy4vZGlyZWN0aXZlcy90YWJsZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7XG4gIHNvcnRGYWN0b3J5ID0gc29ydCxcbiAgZmlsdGVyRmFjdG9yeSA9IGZpbHRlcixcbiAgc2VhcmNoRmFjdG9yeSA9IHNlYXJjaCxcbiAgdGFibGVTdGF0ZSA9IHtzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxfSwgZmlsdGVyOiB7fSwgc2VhcmNoOiB7fX0sXG4gIGRhdGEgPSBbXVxufSwgLi4udGFibGVEaXJlY3RpdmVzKSB7XG5cbiAgY29uc3QgY29yZVRhYmxlID0gdGFibGUoe3NvcnRGYWN0b3J5LCBmaWx0ZXJGYWN0b3J5LCB0YWJsZVN0YXRlLCBkYXRhLCBzZWFyY2hGYWN0b3J5fSk7XG5cbiAgcmV0dXJuIHRhYmxlRGlyZWN0aXZlcy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBuZXdkaXIpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihhY2N1bXVsYXRvciwgbmV3ZGlyKHtcbiAgICAgIHNvcnRGYWN0b3J5LFxuICAgICAgZmlsdGVyRmFjdG9yeSxcbiAgICAgIHNlYXJjaEZhY3RvcnksXG4gICAgICB0YWJsZVN0YXRlLFxuICAgICAgZGF0YSxcbiAgICAgIHRhYmxlOiBjb3JlVGFibGVcbiAgICB9KSk7XG4gIH0sIGNvcmVUYWJsZSk7XG59IiwiaW1wb3J0IHRhYmxlRGlyZWN0aXZlIGZyb20gJy4vc3JjL3RhYmxlJztcbmltcG9ydCBmaWx0ZXJEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9maWx0ZXInO1xuaW1wb3J0IHNlYXJjaERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NlYXJjaCc7XG5pbXBvcnQgc2xpY2VEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zbGljZSc7XG5pbXBvcnQgc29ydERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NvcnQnO1xuaW1wb3J0IHN1bW1hcnlEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zdW1tYXJ5JztcbmltcG9ydCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvd29ya2luZ0luZGljYXRvcic7XG5cbmV4cG9ydCBjb25zdCBzZWFyY2ggPSBzZWFyY2hEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc2xpY2UgPSBzbGljZURpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBzdW1tYXJ5ID0gc3VtbWFyeURpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBzb3J0ID0gc29ydERpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBmaWx0ZXIgPSBmaWx0ZXJEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgd29ya2luZ0luZGljYXRvciA9IHdvcmtpbmdJbmRpY2F0b3JEaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgdGFibGUgPSB0YWJsZURpcmVjdGl2ZTtcbmV4cG9ydCBkZWZhdWx0IHRhYmxlO1xuIiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuZXhwb3J0IGNvbnN0IGdldCA9IGN1cnJ5KChhcnJheSwgaW5kZXgpID0+IGFycmF5W2luZGV4XSk7XG5leHBvcnQgY29uc3QgcmVwbGFjZSA9IGN1cnJ5KChhcnJheSwgbmV3VmFsLCBpbmRleCkgPT4gYXJyYXkubWFwKCh2YWwsIGkpID0+IChpbmRleCA9PT0gaSApID8gbmV3VmFsIDogdmFsKSk7XG5leHBvcnQgY29uc3QgcGF0Y2ggPSBjdXJyeSgoYXJyYXksIG5ld1ZhbCwgaW5kZXgpID0+IHJlcGxhY2UoYXJyYXksIE9iamVjdC5hc3NpZ24oYXJyYXlbaW5kZXhdLCBuZXdWYWwpLCBpbmRleCkpO1xuZXhwb3J0IGNvbnN0IHJlbW92ZSA9IGN1cnJ5KChhcnJheSwgaW5kZXgpID0+IGFycmF5LmZpbHRlcigodmFsLCBpKSA9PiBpbmRleCAhPT0gaSkpO1xuZXhwb3J0IGNvbnN0IGluc2VydCA9IGN1cnJ5KChhcnJheSwgbmV3VmFsLCBpbmRleCkgPT4gWy4uLmFycmF5LnNsaWNlKDAsIGluZGV4KSwgbmV3VmFsLCAuLi5hcnJheS5zbGljZShpbmRleCldKTsiLCJpbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQge2dldCwgcmVwbGFjZSwgcGF0Y2gsIHJlbW92ZSwgaW5zZXJ0fSBmcm9tICcuL2NydWQnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2RhdGEsIHRhYmxlfSkge1xuICAvLyBlbXB0eSBhbmQgcmVmaWxsIGRhdGEga2VlcGluZyB0aGUgc2FtZSByZWZlcmVuY2VcbiAgY29uc3QgbXV0YXRlRGF0YSA9IChuZXdEYXRhKSA9PiB7XG4gICAgZGF0YS5zcGxpY2UoMCk7XG4gICAgZGF0YS5wdXNoKC4uLm5ld0RhdGEpO1xuICB9O1xuICBjb25zdCByZWZyZXNoID0gY29tcG9zZShtdXRhdGVEYXRhLCB0YWJsZS5leGVjKTtcbiAgcmV0dXJuIHtcbiAgICB1cGRhdGUoaW5kZXgsbmV3VmFsKXtcbiAgICAgIHJldHVybiBjb21wb3NlKHJlcGxhY2UoZGF0YSxuZXdWYWwpLHJlZnJlc2gpKGluZGV4KTtcbiAgICB9LFxuICAgIHBhdGNoKGluZGV4LCBuZXdWYWwpe1xuICAgICAgcmV0dXJuIHBhdGNoKGRhdGEsIG5ld1ZhbCwgaW5kZXgpO1xuICAgIH0sXG4gICAgcmVtb3ZlOiBjb21wb3NlKHJlbW92ZShkYXRhKSwgcmVmcmVzaCksXG4gICAgaW5zZXJ0KG5ld1ZhbCwgaW5kZXggPSAwKXtcbiAgICAgIHJldHVybiBjb21wb3NlKGluc2VydChkYXRhLCBuZXdWYWwpLCByZWZyZXNoKShpbmRleCk7XG4gICAgfSxcbiAgICBnZXQ6IGdldChkYXRhKVxuICB9O1xufSIsIi8vIGl0IGlzIGxpa2UgUmVkdXggYnV0IHVzaW5nIHNtYXJ0IHRhYmxlIHdoaWNoIGFscmVhZHkgYmVoYXZlcyBtb3JlIG9yIGxlc3MgbGlrZSBhIHN0b3JlIGFuZCBsaWtlIGEgcmVkdWNlciBpbiB0aGUgc2FtZSB0aW1lLlxuLy8gb2YgY291cnNlIHRoaXMgaW1wbCBpcyBiYXNpYzogZXJyb3IgaGFuZGxpbmcgZXRjIGFyZSBtaXNzaW5nIGFuZCByZWR1Y2VyIGlzIFwiaGFyZGNvZGVkXCJcbmNvbnN0IHJlZHVjZXJGYWN0b3J5ID0gZnVuY3Rpb24gKHNtYXJ0VGFibGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChzdGF0ZSA9IHtcbiAgICB0YWJsZVN0YXRlOiBzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKSxcbiAgICBkaXNwbGF5ZWQ6IFtdLFxuICAgIHN1bW1hcnk6IHt9LFxuICAgIGlzUHJvY2Vzc2luZzogZmFsc2VcbiAgfSwgYWN0aW9uKSB7XG4gICAgY29uc3Qge3R5cGUsIGFyZ3N9ID0gYWN0aW9uO1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSAnVE9HR0xFX0ZJTFRFUic6IHtcbiAgICAgICAgY29uc3Qge2ZpbHRlcn0gPSBhY3Rpb247XG4gICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZSwge2FjdGl2ZUZpbHRlcjogZmlsdGVyfSk7XG4gICAgICB9XG4gICAgICBkZWZhdWx0OiAvL3Byb3h5IHRvIHNtYXJ0IHRhYmxlXG4gICAgICAgIGlmIChzbWFydFRhYmxlW3R5cGVdKSB7XG4gICAgICAgICAgc21hcnRUYWJsZVt0eXBlXSguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxuICB9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3RvcmUgKHNtYXJ0VGFibGUpIHtcblxuICBjb25zdCByZWR1Y2VyID0gcmVkdWNlckZhY3Rvcnkoc21hcnRUYWJsZSk7XG5cbiAgbGV0IGN1cnJlbnRTdGF0ZSA9IHtcbiAgICB0YWJsZVN0YXRlOiBzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKVxuICB9O1xuICBsZXQgc3VtbWFyeTtcbiAgbGV0IGxpc3RlbmVycyA9IFtdO1xuXG4gIGNvbnN0IGJyb2FkY2FzdCA9ICgpID0+IHtcbiAgICBmb3IgKGxldCBsIG9mIGxpc3RlbmVycykge1xuICAgICAgbCgpO1xuICAgIH1cbiAgfTtcblxuICBzbWFydFRhYmxlLm9uKCdTVU1NQVJZX0NIQU5HRUQnLCBmdW5jdGlvbiAocykge1xuICAgIHN1bW1hcnkgPSBzO1xuICB9KTtcblxuICBzbWFydFRhYmxlLm9uKCdFWEVDX0NIQU5HRUQnLCBmdW5jdGlvbiAoe3dvcmtpbmd9KSB7XG4gICAgT2JqZWN0LmFzc2lnbihjdXJyZW50U3RhdGUsIHtcbiAgICAgIGlzUHJvY2Vzc2luZzogd29ya2luZ1xuICAgIH0pO1xuICAgIGJyb2FkY2FzdCgpO1xuICB9KTtcblxuICBzbWFydFRhYmxlLm9uRGlzcGxheUNoYW5nZShmdW5jdGlvbiAoZGlzcGxheWVkKSB7XG4gICAgT2JqZWN0LmFzc2lnbihjdXJyZW50U3RhdGUsIHtcbiAgICAgIHRhYmxlU3RhdGU6IHNtYXJ0VGFibGUuZ2V0VGFibGVTdGF0ZSgpLFxuICAgICAgZGlzcGxheWVkLFxuICAgICAgc3VtbWFyeVxuICAgIH0pO1xuICAgIGJyb2FkY2FzdCgpO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHN1YnNjcmliZShsaXN0ZW5lcil7XG4gICAgICBsaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuZmlsdGVyKGwgPT4gbCAhPT0gbGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0U3RhdGUoKXtcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBjdXJyZW50U3RhdGUsIHt0YWJsZVN0YXRlOnNtYXJ0VGFibGUuZ2V0VGFibGVTdGF0ZSgpfSk7XG4gICAgfSxcbiAgICBkaXNwYXRjaChhY3Rpb24gPSB7fSl7XG4gICAgICBjdXJyZW50U3RhdGUgPSByZWR1Y2VyKGN1cnJlbnRTdGF0ZSwgYWN0aW9uKTtcbiAgICAgIGlmIChhY3Rpb24udHlwZSAmJiAhc21hcnRUYWJsZVthY3Rpb24udHlwZV0pIHtcbiAgICAgICAgYnJvYWRjYXN0KCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufSIsImltcG9ydCB7ZGVmYXVsdCBhcyBzbWFydFRhYmxlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcbmltcG9ydCBjcnVkIGZyb20gJ3NtYXJ0LXRhYmxlLWNydWQnO1xuaW1wb3J0IHtjcmVhdGVTdG9yZX0gZnJvbSAnLi9yZWR1eFNtYXJ0VGFibGUnO1xuXG4vL2RhdGEgY29taW5nIGZyb20gZ2xvYmFsXG5jb25zdCB0YWJsZVN0YXRlID0ge3NlYXJjaDoge30sIGZpbHRlcjoge30sIHNvcnQ6IHt9LCBzbGljZToge3BhZ2U6IDEsIHNpemU6IDIwfX07XG4vL3RoZSBzbWFydCB0YWJsZVxuY29uc3QgdGFibGUgPSBzbWFydFRhYmxlKHtkYXRhLCB0YWJsZVN0YXRlfSwgY3J1ZCk7XG4vL3RoZSBzdG9yZVxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlU3RvcmUodGFibGUpO1xuIiwiaW1wb3J0IHtofSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWJvdW5jZSAoZm4sIGRlbGF5ID0gMzAwKSB7XG4gIGxldCB0aW1lb3V0SWQ7XG4gIHJldHVybiAoZXYpID0+IHtcbiAgICBpZiAodGltZW91dElkKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgfVxuICAgIHRpbWVvdXRJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIGZuKGV2KTtcbiAgICB9LCBkZWxheSk7XG4gIH07XG59XG5leHBvcnQgY29uc3QgdHJhcEtleWRvd24gPSAoLi4ua2V5cykgPT4gKGV2KSA9PiB7XG4gIGNvbnN0IHtrZXlDb2RlfSA9ZXY7XG4gIGlmIChrZXlzLmluZGV4T2Yoa2V5Q29kZSkgPT09IC0xKSB7XG4gICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIH1cbn07IiwiaW1wb3J0IHtoLCBvbk1vdW50fSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5cbmV4cG9ydCBjb25zdCBhdXRvRm9jdXMgPSBvbk1vdW50KG4gPT4gbi5kb20uZm9jdXMoKSk7XG5leHBvcnQgY29uc3QgSW5wdXQgPSBhdXRvRm9jdXMocHJvcHMgPT4ge1xuICBkZWxldGUgIHByb3BzLmNoaWxkcmVuOyAvL25vIGNoaWxkcmVuIGZvciBpbnB1dHNcbiAgcmV0dXJuIDxpbnB1dCB7Li4ucHJvcHN9IC8+XG59KTsiLCJpbXBvcnQge2gsIHdpdGhTdGF0ZX0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHtkZWJvdW5jZSwgdHJhcEtleWRvd259IGZyb20gJy4vaGVscGVyJztcbmltcG9ydCB7SW5wdXQsIGF1dG9Gb2N1c30gZnJvbSAnLi9pbnB1dHMnO1xuXG5jb25zdCB0b2dnbGVPbktleURvd24gPSBwcm9wcyA9PiAoZXYpID0+IHtcbiAgY29uc3Qge2tleUNvZGV9ID0gZXY7XG4gIGlmIChrZXlDb2RlID09PSAxMykge1xuICAgIHByb3BzLnRvZ2dsZUVkaXQodHJ1ZSkoKTtcbiAgfSBlbHNlIGlmIChrZXlDb2RlID09PSAyNykge1xuICAgIGV2LmN1cnJlbnRUYXJnZXQuZm9jdXMoKTtcbiAgfVxufTtcblxuY29uc3QgSW5wdXRDZWxsID0gKHByb3BzKSA9PiB7XG5cbiAgY29uc3Qgb25LZXlkb3duID0gdG9nZ2xlT25LZXlEb3duKHByb3BzKVxuXG4gIHJldHVybiA8dGQgdGFiSW5kZXg9XCItMVwiIG9uS2V5RG93bj17b25LZXlkb3dufSBvbkNsaWNrPXtwcm9wcy50b2dnbGVFZGl0KHRydWUpfSBjbGFzcz17cHJvcHMuY2xhc3NOYW1lfT5cbiAgICB7XG4gICAgICBwcm9wcy5pc0VkaXRpbmcgPT09ICd0cnVlJyA/XG4gICAgICAgIDxJbnB1dCBvbktleWRvd249e3RyYXBLZXlkb3duKDI3KX0gdHlwZT17cHJvcHMudHlwZSB8fCAndGV4dCd9IHZhbHVlPXtwcm9wcy5jdXJyZW50VmFsdWV9XG4gICAgICAgICAgICAgICBvbklucHV0PXtwcm9wcy5vbklucHV0fVxuICAgICAgICAgICAgICAgb25CbHVyPXtwcm9wcy50b2dnbGVFZGl0KGZhbHNlKX0vPlxuICAgICAgICA6IDxzcGFuPntwcm9wcy5jdXJyZW50VmFsdWV9PC9zcGFuPlxuICAgIH1cbiAgPC90ZD5cbn07XG5cbmNvbnN0IG1ha2VFZGl0YWJsZSA9IGNvbXAgPT4ge1xuICByZXR1cm4gd2l0aFN0YXRlKChwcm9wcywgc2V0U3RhdGUpID0+IHtcbiAgICBjb25zdCB0b2dnbGVFZGl0ID0gKHZhbCkgPT4gKCkgPT4gc2V0U3RhdGUoT2JqZWN0LmFzc2lnbih7fSwgcHJvcHMsIHtpc0VkaXRpbmc6IHZhbCAhPT0gdm9pZCAwID8gdmFsIDogcHJvcHMuaXNFZGl0aW5nICE9PSB0cnVlfSkpO1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IHt0b2dnbGVFZGl0LCAuLi5wcm9wc307XG4gICAgcmV0dXJuIGNvbXAoZnVsbFByb3BzKTtcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVMYXN0TmFtZSA9IG1ha2VFZGl0YWJsZSgocHJvcHMpID0+IHtcbiAgY29uc3Qge3RvZ2dsZUVkaXQsIHBlcnNvbiwgaW5kZXgsIGNsYXNzTmFtZSwgcGF0Y2gsIGlzRWRpdGluZ30gPSBwcm9wcztcbiAgbGV0IGN1cnJlbnRWYWx1ZSA9IHBlcnNvbi5uYW1lLmxhc3Q7XG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7bmFtZToge2xhc3Q6IGN1cnJlbnRWYWx1ZSwgZmlyc3Q6IHBlcnNvbi5uYW1lLmZpcnN0fX0pO1xuICB9KTtcblxuICByZXR1cm4gPElucHV0Q2VsbCBpc0VkaXRpbmc9e1N0cmluZyhpc0VkaXRpbmcgPT09IHRydWUpfSB0b2dnbGVFZGl0PXt0b2dnbGVFZGl0fSBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFZhbHVlPXtjdXJyZW50VmFsdWV9IG9uSW5wdXQ9e29uSW5wdXR9Lz5cbn0pO1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVGaXJzdE5hbWUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24ubmFtZS5maXJzdDtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtuYW1lOiB7Zmlyc3Q6IGN1cnJlbnRWYWx1ZSwgbGFzdDogcGVyc29uLm5hbWUubGFzdH19KTtcbiAgfSk7XG5cbiAgcmV0dXJuIDxJbnB1dENlbGwgaXNFZGl0aW5nPXtTdHJpbmcoaXNFZGl0aW5nID09PSB0cnVlKX0gdG9nZ2xlRWRpdD17dG9nZ2xlRWRpdH0gY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRWYWx1ZT17Y3VycmVudFZhbHVlfSBvbklucHV0PXtvbklucHV0fS8+XG59KTtcblxuY29uc3QgR2VuZGVyU2VsZWN0ID0gYXV0b0ZvY3VzKCh7b25DaGFuZ2UsIHRvZ2dsZUVkaXQsIHBlcnNvbn0pID0+IHtcbiAgcmV0dXJuIDxzZWxlY3Qgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNyl9IG5hbWU9XCJnZW5kZXIgc2VsZWN0XCIgb25DaGFuZ2U9e29uQ2hhbmdlfSBvbkJsdXI9e3RvZ2dsZUVkaXQoZmFsc2UpfT5cbiAgICA8b3B0aW9uIHZhbHVlPVwibWFsZVwiIHNlbGVjdGVkPXtwZXJzb24uZ2VuZGVyID09PSAnbWFsZSd9Pm1hbGU8L29wdGlvbj5cbiAgICA8b3B0aW9uIHZhbHVlPVwiZmVtYWxlXCIgc2VsZWN0ZWQ9e3BlcnNvbi5nZW5kZXIgPT09ICdmZW1hbGUnfT5mZW1hbGU8L29wdGlvbj5cbiAgPC9zZWxlY3Q+XG59KTtcblxuZXhwb3J0IGNvbnN0IEVkaXRhYmxlR2VuZGVyID0gbWFrZUVkaXRhYmxlKChwcm9wcykgPT4ge1xuICBjb25zdCB7dG9nZ2xlRWRpdCwgcGVyc29uLCBpbmRleCwgY2xhc3NOYW1lLCBwYXRjaCwgaXNFZGl0aW5nfSA9IHByb3BzO1xuICBsZXQgY3VycmVudFZhbHVlID0gcGVyc29uLmdlbmRlcjtcblxuICBjb25zdCBvbktleWRvd24gPSB0b2dnbGVPbktleURvd24ocHJvcHMpO1xuXG4gIGNvbnN0IG9uQ2hhbmdlID0gZGVib3VuY2UoZXYgPT4ge1xuICAgIGN1cnJlbnRWYWx1ZSA9IGV2LnRhcmdldC52YWx1ZTtcbiAgICBwYXRjaChpbmRleCwge2dlbmRlcjogY3VycmVudFZhbHVlfSk7XG4gIH0pO1xuICBjb25zdCBnZW5kZXJDbGFzcyA9IHBlcnNvbi5nZW5kZXIgPT09ICdmZW1hbGUnID8gJ2dlbmRlci1mZW1hbGUnIDogJ2dlbmRlci1tYWxlJztcblxuICByZXR1cm4gPHRkIHRhYkluZGV4PVwiLTFcIiBvbktleURvd249e29uS2V5ZG93bn0gb25DbGljaz17dG9nZ2xlRWRpdCh0cnVlKX0gY2xhc3M9e2NsYXNzTmFtZX0+XG4gICAge1xuICAgICAgaXNFZGl0aW5nID8gPEdlbmRlclNlbGVjdCBvbkNoYW5nZT17b25DaGFuZ2V9IHRvZ2dsZUVkaXQ9e3RvZ2dsZUVkaXR9IHBlcnNvbj17cGVyc29ufS8+IDpcbiAgICAgICAgPHNwYW4gY2xhc3M9e2dlbmRlckNsYXNzfT57Y3VycmVudFZhbHVlfTwvc3Bhbj5cbiAgICB9XG4gIDwvdGQ+O1xufSk7XG5cbmV4cG9ydCBjb25zdCBFZGl0YWJsZVNpemUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24uc2l6ZTtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtzaXplOiBjdXJyZW50VmFsdWV9KTtcbiAgfSk7XG4gIGNvbnN0IHJhdGlvID0gTWF0aC5taW4oKHBlcnNvbi5zaXplIC0gMTUwKSAvIDUwLCAxKSAqIDEwMDtcblxuICBjb25zdCBvbktleWRvd24gPSB0b2dnbGVPbktleURvd24ocHJvcHMpO1xuXG4gIHJldHVybiA8dGQgdGFiSW5kZXg9XCItMVwiIGNsYXNzPXtjbGFzc05hbWV9IG9uS2V5RG93bj17b25LZXlkb3dufSBvbkNsaWNrPXt0b2dnbGVFZGl0KHRydWUpfT5cbiAgICB7XG4gICAgICBpc0VkaXRpbmcgPyA8SW5wdXQgb25LZXlkb3duPXt0cmFwS2V5ZG93bigyNyl9IHR5cGU9XCJudW1iZXJcIiBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiB2YWx1ZT17Y3VycmVudFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgIG9uQmx1cj17dG9nZ2xlRWRpdChmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgb25JbnB1dD17b25JbnB1dH0vPiA6XG4gICAgICAgIDxzcGFuPjxzcGFuIHN0eWxlPXtgaGVpZ2h0OiAke3JhdGlvfSVgfSBjbGFzcz1cInNpemUtc3RpY2tcIj48L3NwYW4+e2N1cnJlbnRWYWx1ZX08L3NwYW4+XG4gICAgfVxuICA8L3RkPjtcbn0pO1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVCaXJ0aERhdGUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24uYmlydGhEYXRlO1xuXG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7YmlydGhEYXRlOiBuZXcgRGF0ZShjdXJyZW50VmFsdWUpfSk7XG4gIH0pO1xuXG4gIHJldHVybiA8SW5wdXRDZWxsIHR5cGU9XCJkYXRlXCIgaXNFZGl0aW5nPXtTdHJpbmcoaXNFZGl0aW5nID09PSB0cnVlKX0gdG9nZ2xlRWRpdD17dG9nZ2xlRWRpdH0gY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRWYWx1ZT17Y3VycmVudFZhbHVlLnRvRGF0ZVN0cmluZygpfSBvbklucHV0PXtvbklucHV0fS8+XG59KTtcbiIsImltcG9ydCB7aH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuXG5leHBvcnQgY29uc3QgSWNvbkZpbHRlciA9ICgpID0+ICg8c3ZnIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIGNsYXNzPVwiaWNvblwiIHZpZXdCb3g9XCIwIDAgMzIgMzJcIj5cbiAgPHBhdGhcbiAgICBkPVwiTTE2IDBjLTguODM3IDAtMTYgMi4yMzktMTYgNXYzbDEyIDEydjEwYzAgMS4xMDUgMS43OTEgMiA0IDJzNC0wLjg5NSA0LTJ2LTEwbDEyLTEydi0zYzAtMi43NjEtNy4xNjMtNS0xNi01ek0yLjk1IDQuMzM4YzAuNzQ4LTAuNDI3IDEuNzk5LTAuODMyIDMuMDQwLTEuMTcxIDIuNzQ4LTAuNzUyIDYuMzAzLTEuMTY3IDEwLjAxMS0xLjE2N3M3LjI2MiAwLjQxNCAxMC4wMTEgMS4xNjdjMS4yNDEgMC4zNCAyLjI5MiAwLjc0NSAzLjA0MCAxLjE3MSAwLjQ5NCAwLjI4MSAwLjc2IDAuNTE5IDAuODg0IDAuNjYyLTAuMTI0IDAuMTQyLTAuMzkxIDAuMzgtMC44ODQgMC42NjItMC43NDggMC40MjctMS44IDAuODMyLTMuMDQwIDEuMTcxLTIuNzQ4IDAuNzUyLTYuMzAzIDEuMTY3LTEwLjAxMSAxLjE2N3MtNy4yNjItMC40MTQtMTAuMDExLTEuMTY3Yy0xLjI0LTAuMzQtMi4yOTItMC43NDUtMy4wNDAtMS4xNzEtMC40OTQtMC4yODItMC43Ni0wLjUxOS0wLjg4NC0wLjY2MiAwLjEyNC0wLjE0MiAwLjM5MS0wLjM4IDAuODg0LTAuNjYyelwiPjwvcGF0aD5cbjwvc3ZnPik7XG5cbmV4cG9ydCBjb25zdCBJY29uQmluID0gKCkgPT4gKDxzdmcgYXJpYS1oaWRkZW49XCJ0cnVlXCIgY2xhc3M9XCJpY29uXCIgdmlld0JveD1cIjAgMCAzMiAzMlwiPlxuICA8cGF0aCBkPVwiTTYgMzJoMjBsMi0yMmgtMjR6TTIwIDR2LTRoLTh2NGgtMTB2NmwyLTJoMjRsMiAydi02aC0xMHpNMTggNGgtNHYtMmg0djJ6XCI+PC9wYXRoPlxuPC9zdmc+KTtcblxuZXhwb3J0IGNvbnN0IEljb25Tb3J0ID0gKCkgPT4gKDxzdmcgY2xhc3M9XCJpY29uXCIgdmlld0JveD1cIjAgMCAzMiAzMlwiPlxuICA8cGF0aCBkPVwiTTIgNmgyOHY2aC0yOHpNMiAxNGgyOHY2aC0yOHpNMiAyMmgyOHY2aC0yOHpcIj48L3BhdGg+XG48L3N2Zz4pO1xuXG5leHBvcnQgY29uc3QgSWNvblNvcnRBc2MgPSAoKSA9PiAoPHN2ZyBjbGFzcz1cImljb25cIiB2aWV3Qm94PVwiMCAwIDMyIDMyXCI+XG4gIDxwYXRoIGQ9XCJNMTAgMjR2LTI0aC00djI0aC01bDcgNyA3LTdoLTV6XCI+PC9wYXRoPlxuICA8cGF0aCBkPVwiTTE0IDE4aDE4djRoLTE4di00elwiPjwvcGF0aD5cbiAgPHBhdGggZD1cIk0xNCAxMmgxNHY0aC0xNHYtNHpcIj48L3BhdGg+XG4gIDxwYXRoIGQ9XCJNMTQgNmgxMHY0aC0xMHYtNHpcIj48L3BhdGg+XG4gIDxwYXRoIGQ9XCJNMTQgMGg2djRoLTZ2LTR6XCI+PC9wYXRoPlxuPC9zdmc+KTtcblxuZXhwb3J0IGNvbnN0IEljb25Tb3J0RGVzYyA9ICgpID0+ICg8c3ZnIGNsYXNzPVwiaWNvblwiIHZpZXdCb3g9XCIwIDAgMzIgMzJcIj5cbiAgPHBhdGggZD1cIk0xMCAyNHYtMjRoLTR2MjRoLTVsNyA3IDctN2gtNXpcIj48L3BhdGg+XG4gIDxwYXRoIGQ9XCJNMTQgMGgxOHY0aC0xOHYtNHpcIj48L3BhdGg+XG4gIDxwYXRoIGQ9XCJNMTQgNmgxNHY0aC0xNHYtNHpcIj48L3BhdGg+XG4gIDxwYXRoIGQ9XCJNMTQgMTJoMTB2NGgtMTB2LTR6XCI+PC9wYXRoPlxuICA8cGF0aCBkPVwiTTE0IDE4aDZ2NGgtNnYtNHpcIj48L3BhdGg+XG48L3N2Zz4pOyIsImltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IHtjb25uZWN0LCBoLCBvblVwZGF0ZX0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHtFZGl0YWJsZUxhc3ROYW1lLCBFZGl0YWJsZUJpcnRoRGF0ZSwgRWRpdGFibGVTaXplLCBFZGl0YWJsZUdlbmRlciwgRWRpdGFibGVGaXJzdE5hbWV9IGZyb20gJy4vZWRpdGFibGVDZWxsJztcbmltcG9ydCB7SWNvbkJpbn0gZnJvbSAnLi9pY29ucydcblxuY29uc3QgbWFwU3RhdGVUb1Byb3AgPSBzdGF0ZSA9PiAoe3BlcnNvbnM6IHN0YXRlfSk7XG5jb25zdCBkb2VzVXBkYXRlTGlzdCA9IChwcmV2aW91cywgY3VycmVudCkgPT4ge1xuICBsZXQgb3V0cHV0ID0gdHJ1ZTtcbiAgaWYgKHR5cGVvZiBwcmV2aW91cyA9PT0gdHlwZW9mIGN1cnJlbnQpIHtcbiAgICBvdXRwdXQgPSBwcmV2aW91cy5sZW5ndGggIT09IGN1cnJlbnQubGVuZ3RoIHx8IHByZXZpb3VzLnNvbWUoKGksIGspID0+IHByZXZpb3VzW2tdLnZhbHVlLmlkICE9PSBjdXJyZW50W2tdLnZhbHVlLmlkKTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBzdGF0ZSA9PiBzdGF0ZS5kaXNwbGF5ZWQ7XG5jb25zdCBhY3Rpb25zID0ge1xuICByZW1vdmU6IGluZGV4ID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAncmVtb3ZlJywgYXJnczogW2luZGV4XX0pLFxuICBwYXRjaDogKGluZGV4LCB2YWx1ZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdwYXRjaCcsIGFyZ3M6IFtpbmRleCwgdmFsdWVdfSlcbn07XG5jb25zdCBzdWJzY3JpYmVUb0Rpc3BsYXkgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcbmNvbnN0IGZvY3VzRmlyc3RDZWxsID0gb25VcGRhdGUodm5vZGUgPT4ge1xuICBjb25zdCBmaXJzdENlbGwgPSB2bm9kZS5kb20ucXVlcnlTZWxlY3RvcigndGQnKTtcbiAgaWYgKGZpcnN0Q2VsbCAhPT0gbnVsbCkge1xuICAgIGZpcnN0Q2VsbC5mb2N1cygpO1xuICB9XG59KTtcblxuY29uc3QgVEJvZHkgPSBmb2N1c0ZpcnN0Q2VsbCgoe3BlcnNvbnMgPSBbXSwgcGF0Y2gsIHJlbW92ZX0pID0+IHtcbiAgcmV0dXJuIHBlcnNvbnMubGVuZ3RoID8gPHRib2R5PlxuICAgIHtcbiAgICAgIHBlcnNvbnMubWFwKCh7dmFsdWUsIGluZGV4fSkgPT4gPHRyPlxuICAgICAgICA8RWRpdGFibGVMYXN0TmFtZSBjbGFzc05hbWU9XCJjb2wtbGFzdG5hbWVcIiBwZXJzb249e3ZhbHVlfSBpbmRleD17aW5kZXh9IHBhdGNoPXtwYXRjaH0vPlxuICAgICAgICA8RWRpdGFibGVGaXJzdE5hbWUgY2xhc3NOYW1lPVwiY29sLWZpcnN0bmFtZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDxFZGl0YWJsZUJpcnRoRGF0ZSBjbGFzc05hbWU9XCJjb2wtYmlydGhkYXRlXCIgcGVyc29uPXt2YWx1ZX0gaW5kZXg9e2luZGV4fSBwYXRjaD17cGF0Y2h9Lz5cbiAgICAgICAgPEVkaXRhYmxlR2VuZGVyIGNsYXNzTmFtZT1cImNvbC1nZW5kZXIgZml4ZWQtc2l6ZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDxFZGl0YWJsZVNpemUgY2xhc3NOYW1lPVwiY29sLXNpemUgZml4ZWQtc2l6ZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDx0ZCBjbGFzcz1cImZpeGVkLXNpemUgY29sLWFjdGlvbnNcIiBkYXRhLWtleWJvYXJkLXNlbGVjdG9yPVwiYnV0dG9uXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0YWJpbmRleD1cIi0xXCIgb25DbGljaz17KCkgPT4gcmVtb3ZlKGluZGV4KX0+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cInZpc3VhbGx5LWhpZGRlblwiPnsnRGVsZXRlICcgKyB2YWx1ZS5uYW1lLmxhc3QgKyAnICcgKyB2YWx1ZS5uYW1lLmZpcnN0fTwvc3Bhbj5cbiAgICAgICAgICAgIDxJY29uQmluLz5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC90ZD5cbiAgICAgIDwvdHI+KVxuICAgIH1cbiAgICA8L3Rib2R5PiA6IDx0Ym9keT5cbiAgICA8dHI+XG4gICAgICA8dGQgdGFiSW5kZXg9XCItMVwiIGNvbFNwYW49XCI2XCI+VGhlcmUgaXMgbm8gZGF0YSBtYXRjaGluZyB5b3VyIHJlcXVlc3Q8L3RkPlxuICAgIDwvdHI+XG4gICAgPC90Ym9keT5cbn0pO1xuXG5jb25zdCBQZXJzb25MaXN0Q29tcG9uZW50ID0gKHByb3BzLCBhY3Rpb25zKSA9PiB7XG4gIHJldHVybiA8VEJvZHkgcGVyc29ucz17cHJvcHMucGVyc29uc30gcmVtb3ZlPXthY3Rpb25zLnJlbW92ZX1cbiAgICAgICAgICAgICAgICBwYXRjaD17YWN0aW9ucy5wYXRjaH0vPlxufTtcblxuZXhwb3J0IGNvbnN0IFBlcnNvbkxpc3QgPSBzdWJzY3JpYmVUb0Rpc3BsYXkoUGVyc29uTGlzdENvbXBvbmVudCwgbWFwU3RhdGVUb1Byb3AsIGRvZXNVcGRhdGVMaXN0KTtcbiIsImltcG9ydCB7aCwgY29ubmVjdH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5cblxuY29uc3QgYWN0aW9ucyA9IHt9O1xuY29uc3Qgc2xpY2VTdGF0ZSA9IHN0YXRlID0+ICh7aXNQcm9jZXNzaW5nOiBzdGF0ZS5pc1Byb2Nlc3Npbmd9KTtcbmNvbnN0IHN1YnNjcmliZVRvUHJvY2Vzc2luZyA9IGNvbm5lY3Qoc3RvcmUsIGFjdGlvbnMsIHNsaWNlU3RhdGUpO1xuXG5jb25zdCBMb2FkaW5nSW5kaWNhdG9yID0gKHtpc1Byb2Nlc3Npbmd9KSA9PiB7XG4gIGNvbnN0IGNsYXNzTmFtZSA9IGlzUHJvY2Vzc2luZyA9PT0gdHJ1ZSA/ICdzdC13b3JraW5nJyA6ICcnO1xuICBjb25zdCBtZXNzYWdlID0gaXNQcm9jZXNzaW5nID09PSB0cnVlID8gJ2xvYWRpbmcgcGVyc29ucyBkYXRhJyA6ICdkYXRhIGxvYWRlZCc7XG4gIHJldHVybiA8ZGl2IGlkPVwib3ZlcmxheVwiIGFyaWEtbGl2ZT1cImFzc2VydGl2ZVwiIHJvbGU9XCJhbGVydFwiIGNsYXNzPXtjbGFzc05hbWV9PlxuICAgIHttZXNzYWdlfVxuICA8L2Rpdj47XG59O1xuZXhwb3J0IGNvbnN0IFdvcmtJblByb2dyZXNzID0gc3Vic2NyaWJlVG9Qcm9jZXNzaW5nKExvYWRpbmdJbmRpY2F0b3IpO1xuIiwiaW1wb3J0IHtoLCBjb25uZWN0fSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5pbXBvcnQgc3RvcmUgZnJvbSAnLi4vbGliL3N0b3JlJztcbmltcG9ydCBqc29uIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5pbXBvcnQge0ljb25Tb3J0LCBJY29uU29ydEFzYywgSWNvblNvcnREZXNjfSBmcm9tICcuL2ljb25zJztcblxuY29uc3QgYWN0aW9ucyA9IHtcbiAgdG9nZ2xlU29ydDogKHtwb2ludGVyLCBkaXJlY3Rpb259KSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3NvcnQnLCBhcmdzOiBbe3BvaW50ZXIsIGRpcmVjdGlvbn1dfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0ganNvbigndGFibGVTdGF0ZS5zb3J0JykuZ2V0O1xuY29uc3Qgc3Vic2NyaWJlVG9Tb3J0ID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cblxuY29uc3QgSWNvbiA9ICh7ZGlyZWN0aW9ufSkgPT4ge1xuICBpZiAoZGlyZWN0aW9uID09PSAnYXNjJykge1xuICAgIHJldHVybiA8SWNvblNvcnRBc2MvPjtcbiAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICdkZXNjJykge1xuICAgIHJldHVybiA8SWNvblNvcnREZXNjLz47XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIDxJY29uU29ydC8+O1xuICB9XG59O1xuXG5jb25zdCBTb3J0QnV0dG9uQ29tcG9uZW50ID0gKHByb3BzID0+IHtcbiAgY29uc3Qge2NvbHVtblBvaW50ZXIsIHNvcnREaXJlY3Rpb25zID0gWydhc2MnLCAnZGVzYyddLCBwb2ludGVyLCBkaXJlY3Rpb24sIHNvcnR9ID0gcHJvcHM7XG4gIGNvbnN0IGFjdHVhbEN1cnNvciA9IGNvbHVtblBvaW50ZXIgIT09IHBvaW50ZXIgPyAtMSA6IHNvcnREaXJlY3Rpb25zLmluZGV4T2YoZGlyZWN0aW9uKTtcbiAgY29uc3QgbmV3Q3Vyc29yID0gKGFjdHVhbEN1cnNvciArIDEgKSAlIHNvcnREaXJlY3Rpb25zLmxlbmd0aDtcblxuICBjb25zdCB0b2dnbGVTb3J0ID0gKCkgPT4gc29ydCh7cG9pbnRlcjogY29sdW1uUG9pbnRlciwgZGlyZWN0aW9uOiBzb3J0RGlyZWN0aW9uc1tuZXdDdXJzb3JdfSk7XG5cbiAgcmV0dXJuIDxidXR0b24gdGFiaW5kZXg9XCItMVwiIG9uQ2xpY2s9e3RvZ2dsZVNvcnR9PlxuICAgIDxzcGFuIGNsYXNzPVwidmlzdWFsbHktaGlkZGVuXCI+VG9nZ2xlIHNvcnQ8L3NwYW4+XG4gICAgPEljb24gZGlyZWN0aW9uPXtzb3J0RGlyZWN0aW9uc1thY3R1YWxDdXJzb3JdfS8+XG4gIDwvYnV0dG9uPlxufSk7XG5cbmV4cG9ydCBjb25zdCBTb3J0QnV0dG9uID0gc3Vic2NyaWJlVG9Tb3J0KChwcm9wcywgYWN0aW9ucykgPT5cbiAgPFNvcnRCdXR0b25Db21wb25lbnQgey4uLnByb3BzfSBzb3J0PXthY3Rpb25zLnRvZ2dsZVNvcnR9Lz4pO1xuIiwiaW1wb3J0IHtoLCBjb25uZWN0fSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICcuL2hlbHBlcic7XG5pbXBvcnQgc3RvcmUgZnJvbSAnLi4vbGliL3N0b3JlJztcbmltcG9ydCBqc29uIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmNvbnN0IGFjdGlvbnMgPSB7XG4gIHNlYXJjaDogKHZhbHVlLCBzY29wZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdzZWFyY2gnLCBhcmdzOiBbe3ZhbHVlLCBzY29wZX1dfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0ganNvbigndGFibGVTdGF0ZS5zZWFyY2gnKS5nZXQ7XG5jb25zdCBub05lZWRGb3JVcGRhdGUgPSBzdGF0ZSA9PiBmYWxzZTsvLyBhbHdheXMgcmV0dXJuIHRoZSBzYW1lIHZhbHVlXG5jb25zdCBzZWFyY2hhYmxlID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IFNlYXJjaElucHV0ID0gKHByb3BzKSA9PiAoPGxhYmVsPlxuICA8c3Bhbj57cHJvcHMuY2hpbGRyZW59PC9zcGFuPlxuICA8aW5wdXQgdGFiaW5kZXg9XCIwXCIgdHlwZT1cInNlYXJjaFwiIG9uSW5wdXQ9e3Byb3BzLm9uSW5wdXR9IHBsYWNlaG9sZGVyPXtwcm9wcy5wbGFjZWhvbGRlcn0vPlxuPC9sYWJlbD4pO1xuXG5leHBvcnQgY29uc3QgU2VhcmNoUm93ID0gc2VhcmNoYWJsZSgocHJvcHMsIGFjdGlvbnMpID0+IHtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IGFjdGlvbnMuc2VhcmNoKGV2LnRhcmdldC52YWx1ZSwgWyduYW1lLmxhc3QnLCAnbmFtZS5maXJzdCddKSwgMzAwKTtcbiAgZGVsZXRlIHByb3BzLmNoaWxkcmVuO1xuICByZXR1cm4gPHRyIHsuLi5wcm9wc30+XG4gICAgPHRoIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJpbnB1dFwiPlxuICAgICAgPFNlYXJjaElucHV0IHBsYWNlaG9sZGVyPVwiQ2FzZSBzZW5zaXRpdmUgc2VhcmNoIG9uIHN1cm5hbWUgYW5kIG5hbWVcIiBvbklucHV0PXtvbklucHV0fT5TZWFyY2g6PC9TZWFyY2hJbnB1dD5cbiAgICA8L3RoPlxuICA8L3RyPlxufSwgbm9OZWVkRm9yVXBkYXRlLCBub05lZWRGb3JVcGRhdGUpOyIsImltcG9ydCB7aCwgY29ubmVjdCwgb25VcGRhdGV9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IHtJY29uRmlsdGVyfSBmcm9tICcuL2ljb25zJztcblxuY29uc3QgZm9jdXNPbk9wZW4gPSBvblVwZGF0ZSh2bm9kZSA9PiB7XG4gIGNvbnN0IGFoID0gdm5vZGUucHJvcHNbJ2FyaWEtaGlkZGVuJ107XG4gIGlmIChhaCA9PT0gJ2ZhbHNlJykge1xuICAgIGNvbnN0IGlucHV0ID0gdm5vZGUuZG9tLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0LCBzZWxlY3QnKTtcbiAgICBpZiAoaW5wdXQpIHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gaW5wdXQuZm9jdXMoKSwgNSk7XG4gICAgfVxuICB9XG59KTtcblxuY29uc3QgYWN0aW9ucyA9IHtcbiAgdG9nZ2xlRmlsdGVyTWVudTogKGZpbHRlcikgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdUT0dHTEVfRklMVEVSJywgZmlsdGVyfSksXG4gIGNvbW1pdEZpbHRlcjogKHZhbHVlKSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ2ZpbHRlcicsIGFyZ3M6IFt2YWx1ZV19KVxufTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBzdGF0ZSA9PiAoe2FjdGl2ZUZpbHRlcjogc3RhdGUuYWN0aXZlRmlsdGVyLCBmaWx0ZXJDbGF1c2VzOiBzdGF0ZS50YWJsZVN0YXRlLmZpbHRlcn0pO1xuY29uc3Qgc3Vic2NyaWJlVG9GaWx0ZXIgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcblxuY29uc3QgRmlsdGVyUm93Q29tcCA9IGZvY3VzT25PcGVuKChwcm9wcyA9IHt9KSA9PiB7XG4gIGNvbnN0IHtpc0hpZGRlbiwgdG9nZ2xlRmlsdGVyTWVudSwgY29tbWl0RmlsdGVyfSA9IHByb3BzO1xuICBjb25zdCBjbG9zZSA9ICgpID0+IHtcbiAgICB0b2dnbGVGaWx0ZXJNZW51KG51bGwpO1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYFthcmlhLWNvbnRyb2xzPSR7aWROYW1lfV1gKS5mb2N1cygpO1xuICB9O1xuICBjb25zdCBvblN1Ym1pdCA9IChldikgPT4ge1xuICAgIGNvbnN0IGZvcm0gPSBldi50YXJnZXQ7XG4gICAgY29uc3Qge25hbWV9ID0gZm9ybTtcbiAgICBjb25zdCBpbnB1dHMgPSBmb3JtLnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0LCBzZWxlY3QnKTtcbiAgICBjb21taXRGaWx0ZXIoe1xuICAgICAgW25hbWVdOiBbLi4uaW5wdXRzXS5tYXAoaW5wdXQgPT4ge1xuICAgICAgICByZXR1cm4ge3R5cGU6IGlucHV0LnR5cGUsIHZhbHVlOiBpbnB1dC52YWx1ZSwgb3BlcmF0b3I6IGlucHV0LmdldEF0dHJpYnV0ZSgnZGF0YS1vcGVyYXRvcicpIHx8ICdpbmNsdWRlcyd9XG4gICAgICB9KVxuICAgIH0pO1xuICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gICAgY2xvc2UoKTtcbiAgfTtcbiAgY29uc3QgaWROYW1lID0gWydmaWx0ZXInXS5jb25jYXQocHJvcHMuc2NvcGUuc3BsaXQoJy4nKSkuam9pbignLScpO1xuICBjb25zdCBvbktleURvd24gPSAoZXYpID0+IHtcbiAgICBpZiAoZXYuY29kZSA9PT0gJ0VzY2FwZScgfHwgZXYua2V5Q29kZSA9PT0gMjcgfHwgZXYua2V5ID09PSAnRXNjYXBlJykge1xuICAgICAgY2xvc2UoKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgYXJpYUhpZGRlbiA9IGlzSGlkZGVuICE9PSB0cnVlO1xuICByZXR1cm4gPHRyIGlkPXtpZE5hbWV9IGNsYXNzPVwiZmlsdGVyLXJvd1wiIG9uS2V5ZG93bj17b25LZXlEb3dufSBkYXRhLWtleWJvYXJkLXNraXA9e2FyaWFIaWRkZW59XG4gICAgICAgICAgICAgYXJpYS1oaWRkZW49e1N0cmluZyhhcmlhSGlkZGVuKX0+XG4gICAgPHRoIGNvbHNwYW49XCI2XCIgZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cImlucHV0LCBzZWxlY3RcIj5cbiAgICAgIDxmb3JtIG5hbWU9e3Byb3BzLnNjb3BlfSBvblN1Ym1pdD17b25TdWJtaXR9PlxuICAgICAgICB7cHJvcHMuY2hpbGRyZW59XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ2aXN1YWxseS1oaWRkZW5cIj5cbiAgICAgICAgICA8YnV0dG9uIHRhYkluZGV4PVwiLTFcIj5BcHBseTwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPHAgaWQ9e2lkTmFtZSArICctaW5zdHJ1Y3Rpb24nfT5QcmVzcyBFbnRlciB0byBhY3RpdmF0ZSBmaWx0ZXIgb3IgZXNjYXBlIHRvIGRpc21pc3M8L3A+XG4gICAgICA8L2Zvcm0+XG4gICAgPC90aD5cbiAgPC90cj5cbn0pO1xuXG5jb25zdCBGaWx0ZXJCdXR0b24gPSAocHJvcHMpID0+IHtcbiAgY29uc3Qge2NvbHVtblBvaW50ZXIsIHRvZ2dsZUZpbHRlck1lbnUsIGZpbHRlckNsYXVzZXMgPSB7fX09cHJvcHM7XG4gIGNvbnN0IGN1cnJlbnRGaWx0ZXJDbGF1c2VzID0gZmlsdGVyQ2xhdXNlc1tjb2x1bW5Qb2ludGVyXSB8fCBbXTtcbiAgY29uc3QgY29udHJvbGxlZCA9IFsnZmlsdGVyJ10uY29uY2F0KGNvbHVtblBvaW50ZXIuc3BsaXQoJy4nKSkuam9pbignLScpO1xuICBjb25zdCBvbkNsaWNrID0gKCkgPT4gdG9nZ2xlRmlsdGVyTWVudShjb2x1bW5Qb2ludGVyKTtcbiAgY29uc3QgaXNBY3RpdmUgPSBjdXJyZW50RmlsdGVyQ2xhdXNlcy5sZW5ndGggJiYgY3VycmVudEZpbHRlckNsYXVzZXMuc29tZShjbGF1c2UgPT4gY2xhdXNlLnZhbHVlKTtcbiAgcmV0dXJuIDxidXR0b24gYXJpYS1oYXNwb3B1cD1cInRydWVcIiB0YWJpbmRleD1cIi0xXCIgY2xhc3M9e2lzQWN0aXZlID8gJ2FjdGl2ZS1maWx0ZXInIDogJyd9IGFyaWEtY29udHJvbHM9e2NvbnRyb2xsZWR9XG4gICAgICAgICAgICAgICAgIG9uQ2xpY2s9e29uQ2xpY2t9PlxuICAgIDxzcGFuIGNsYXNzPVwidmlzdWFsbHktaGlkZGVuXCI+VG9nZ2xlIEZpbHRlciBtZW51PC9zcGFuPlxuICAgIDxJY29uRmlsdGVyLz5cbiAgPC9idXR0b24+XG59O1xuXG5leHBvcnQgY29uc3QgVG9nZ2xlRmlsdGVyQnV0dG9uID0gc3Vic2NyaWJlVG9GaWx0ZXIoKHByb3BzLCBhY3Rpb25zKSA9PiB7XG4gIHJldHVybiA8RmlsdGVyQnV0dG9uIHsuLi5wcm9wc30gdG9nZ2xlRmlsdGVyTWVudT17YWN0aW9ucy50b2dnbGVGaWx0ZXJNZW51fS8+XG59KTtcblxuZXhwb3J0IGNvbnN0IEZpbHRlclJvdyA9IHN1YnNjcmliZVRvRmlsdGVyKChwcm9wcywgYWN0aW9ucykgPT4ge1xuICByZXR1cm4gPEZpbHRlclJvd0NvbXAgc2NvcGU9e3Byb3BzLnNjb3BlfSBpc0hpZGRlbj17cHJvcHMuYWN0aXZlRmlsdGVyID09PSBwcm9wcy5zY29wZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRvZ2dsZUZpbHRlck1lbnU9e2FjdGlvbnMudG9nZ2xlRmlsdGVyTWVudX0gY29tbWl0RmlsdGVyPXthY3Rpb25zLmNvbW1pdEZpbHRlcn0+XG5cbiAgICB7cHJvcHMuY2hpbGRyZW59XG4gIDwvRmlsdGVyUm93Q29tcD47XG59KTsiLCJpbXBvcnQge2h9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcblxuaW1wb3J0IHtTb3J0QnV0dG9ufSBmcm9tICcuL3NvcnQnO1xuaW1wb3J0IHtTZWFyY2hSb3d9IGZyb20gJy4vc2VhcmNoJztcbmltcG9ydCB7RmlsdGVyUm93LCBUb2dnbGVGaWx0ZXJCdXR0b259IGZyb20gJy4vZmlsdGVyJztcbmltcG9ydCB7dHJhcEtleWRvd259IGZyb20gJy4vaGVscGVyJztcblxuY29uc3QgQ29sdW1uSGVhZGVyID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtjb2x1bW5Qb2ludGVyLCBzb3J0RGlyZWN0aW9ucyA9IFsnYXNjJywgJ2Rlc2MnXSwgY2xhc3NOYW1lLCBjaGlsZHJlbn0gPSBwcm9wcztcblxuICByZXR1cm4gPHRoIGNsYXNzPXtjbGFzc05hbWV9IGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJidXR0b25cIj5cbiAgICB7Y2hpbGRyZW59XG4gICAgPGRpdiBjbGFzcz1cImJ1dHRvbnMtY29udGFpbmVyXCI+XG4gICAgICA8U29ydEJ1dHRvbiBjb2x1bW5Qb2ludGVyPXtjb2x1bW5Qb2ludGVyfSBzb3J0RGlyZWN0aW9ucz17c29ydERpcmVjdGlvbnN9Lz5cbiAgICAgIDxUb2dnbGVGaWx0ZXJCdXR0b24gY29sdW1uUG9pbnRlcj17Y29sdW1uUG9pbnRlcn0vPlxuICAgIDwvZGl2PlxuICA8L3RoPlxufTtcblxuZXhwb3J0IGNvbnN0IEhlYWRlcnMgPSAoKSA9PiB7XG5cbiAgcmV0dXJuIDx0aGVhZD5cbiAgPFNlYXJjaFJvdyBjbGFzcz1cImZpbHRlci1yb3dcIi8+XG4gIDx0cj5cbiAgICA8Q29sdW1uSGVhZGVyIGNsYXNzTmFtZT1cImNvbC1sYXN0bmFtZVwiIGNvbHVtblBvaW50ZXI9XCJuYW1lLmxhc3RcIlxuICAgICAgICAgICAgICAgICAgc29ydERpcmVjdGlvbnM9e1snYXNjJywgJ2Rlc2MnLCAnbm9uZSddfT5TdXJuYW1lPC9Db2x1bW5IZWFkZXI+XG4gICAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtZmlyc3RuYW1lXCIgY29sdW1uUG9pbnRlcj1cIm5hbWUuZmlyc3RcIj5OYW1lPC9Db2x1bW5IZWFkZXI+XG4gICAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtYmlydGhkYXRlXCIgc29ydERpcmVjdGlvbnM9e1snZGVzYycsICdhc2MnXX1cbiAgICAgICAgICAgICAgICAgIGNvbHVtblBvaW50ZXI9XCJiaXJ0aERhdGVcIj5EYXRlIG9mIGJpcnRoPC9Db2x1bW5IZWFkZXI+XG4gICAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtZ2VuZGVyIGZpeGVkLXNpemVcIiBjb2x1bW5Qb2ludGVyPVwiZ2VuZGVyXCI+R2VuZGVyPC9Db2x1bW5IZWFkZXI+XG4gICAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtc2l6ZSBmaXhlZC1zaXplXCIgY29sdW1uUG9pbnRlcj1cInNpemVcIj5TaXplPC9Db2x1bW5IZWFkZXI+XG4gICAgPHRoIGRhdGEta2V5Ym9hcmQtc2tpcD17dHJ1ZX0gY2xhc3M9XCJmaXhlZC1zaXplIGNvbC1hY3Rpb25zXCI+PC90aD5cbiAgPC90cj5cbiAgPEZpbHRlclJvdyBzY29wZT1cIm5hbWUubGFzdFwiPlxuICAgIDxsYWJlbD5cbiAgICAgIDxzcGFuPnN1cm5hbWUgaW5jbHVkZXM6PC9zcGFuPlxuICAgICAgPGlucHV0IGFyaWEtZGVzY3JpYmVkYnk9XCJmaWx0ZXItbmFtZS1sYXN0LWluc3RydWN0aW9uXCIgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNywgMzgsIDQwKX1cbiAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJjYXNlIGluc2Vuc2l0aXZlIHN1cm5hbWUgdmFsdWVcIi8+XG4gICAgPC9sYWJlbD5cbiAgPC9GaWx0ZXJSb3c+XG4gIDxGaWx0ZXJSb3cgc2NvcGU9XCJuYW1lLmZpcnN0XCI+XG4gICAgPGxhYmVsPlxuICAgICAgPHNwYW4+bmFtZSBpbmNsdWRlczo8L3NwYW4+XG4gICAgICA8aW5wdXQgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNywgMzgsIDQwKX0gdHlwZT1cInRleHRcIiBwbGFjZWhvbGRlcj1cImNhc2UgaW5zZW5zaXRpdmUgbmFtZSB2YWx1ZVwiLz5cbiAgICA8L2xhYmVsPlxuICA8L0ZpbHRlclJvdz5cbiAgPEZpbHRlclJvdyBzY29wZT1cImJpcnRoRGF0ZVwiPlxuICAgIDxsYWJlbD5cbiAgICAgIDxzcGFuPmJvcm4gYWZ0ZXI6PC9zcGFuPlxuICAgICAgPGlucHV0IG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcpfSBkYXRhLW9wZXJhdG9yPVwiZ3RcIiB0eXBlPVwiZGF0ZVwiLz5cbiAgICA8L2xhYmVsPlxuICA8L0ZpbHRlclJvdz5cbiAgPEZpbHRlclJvdyBzY29wZT1cImdlbmRlclwiPlxuICAgIDxsYWJlbD5cbiAgICAgIDxzcGFuPmdlbmRlciBpczo8L3NwYW4+XG4gICAgICA8c2VsZWN0IG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcpfSBkYXRhLW9wZXJhdG9yPVwiaXNcIj5cbiAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlwiPi08L29wdGlvbj5cbiAgICAgICAgPG9wdGlvbiB2YWx1ZT1cImZlbWFsZVwiPmZlbWFsZTwvb3B0aW9uPlxuICAgICAgICA8b3B0aW9uIHZhbHVlPVwibWFsZVwiPm1hbGU8L29wdGlvbj5cbiAgICAgIDwvc2VsZWN0PlxuICAgIDwvbGFiZWw+XG4gIDwvRmlsdGVyUm93PlxuICA8RmlsdGVyUm93IHNjb3BlPVwic2l6ZVwiPlxuICAgIDxsYWJlbD5cbiAgICAgIDxzcGFuPnRhbGxlciB0aGFuOjwvc3Bhbj5cbiAgICAgIDxpbnB1dCBvbktleURvd249e3RyYXBLZXlkb3duKDI3KX0gbWluPVwiMTUwXCIgbWF4PVwiMjAwXCIgc3RlcD1cIjFcIiB0eXBlPVwicmFuZ2VcIiBkYXRhLW9wZXJhdG9yPVwiZ3RcIi8+XG4gICAgPC9sYWJlbD5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj5zbWFsbGVyIHRoYW46PC9zcGFuPlxuICAgICAgPGlucHV0IG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcpfSBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiBzdGVwPVwiMVwiIHR5cGU9XCJyYW5nZVwiIGRhdGEtb3BlcmF0b3I9XCJsdFwiLz5cbiAgICA8L2xhYmVsPlxuICA8L0ZpbHRlclJvdz5cbiAgPC90aGVhZD5cbn0iLCJpbXBvcnQgc3RvcmUgZnJvbSAnLi4vbGliL3N0b3JlJztcbmltcG9ydCB7Y29ubmVjdCwgaH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuXG5jb25zdCBhY3Rpb25zID0ge1xuICBzbGljZTogKHBhZ2UsIHNpemUpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnc2xpY2UnLCBhcmdzOiBbe3BhZ2UsIHNpemV9XX0pXG59O1xuY29uc3Qgc2xpY2VTdGF0ZSA9IHN0YXRlID0+IHN0YXRlLnN1bW1hcnk7XG5jb25zdCBzdWJzY3JpYmVUb1N1bW1hcnkgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcblxuY29uc3QgU3VtbWFyeSA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7cGFnZSwgc2l6ZSwgZmlsdGVyZWRDb3VudH0gPSBwcm9wcztcbiAgcmV0dXJuICg8ZGl2PiBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+eyhwYWdlIC0gMSkgKiBzaXplICsgKGZpbHRlcmVkQ291bnQgPiAwID8gMSA6IDApfTwvc3Ryb25nPiAtXG4gICAgPHN0cm9uZz57TWF0aC5taW4oZmlsdGVyZWRDb3VudCwgcGFnZSAqIHNpemUpfTwvc3Ryb25nPiBvZiA8c3Ryb25nPntmaWx0ZXJlZENvdW50fTwvc3Ryb25nPiBtYXRjaGluZyBpdGVtc1xuICA8L2Rpdj4pO1xufTtcblxuY29uc3QgUGFnZVNpemUgPSBwcm9wcyA9PiB7XG4gIGNvbnN0IHtzaXplLCBzbGljZX0gPSBwcm9wcztcbiAgY29uc3QgY2hhbmdlUGFnZVNpemUgPSAoZXYpID0+IHNsaWNlKDEsIE51bWJlcihldi50YXJnZXQudmFsdWUpKTtcbiAgcmV0dXJuIDxkaXY+XG4gICAgPGxhYmVsPlxuICAgICAgUGFnZSBzaXplXG4gICAgICA8c2VsZWN0IHRhYkluZGV4PVwiLTFcIiBvbkNoYW5nZT17Y2hhbmdlUGFnZVNpemV9IG5hbWU9XCJwYWdlU2l6ZVwiPlxuICAgICAgICA8b3B0aW9uIHNlbGVjdGVkPXtzaXplID09IDIwfSB2YWx1ZT1cIjIwXCI+MjAgaXRlbXM8L29wdGlvbj5cbiAgICAgICAgPG9wdGlvbiBzZWxlY3RlZD17c2l6ZSA9PSAzMH0gdmFsdWU9XCIzMFwiPjMwIGl0ZW1zPC9vcHRpb24+XG4gICAgICAgIDxvcHRpb24gc2VsZWN0ZWQ9e3NpemUgPT0gNTB9IHZhbHVlPVwiNTBcIj41MCBpdGVtczwvb3B0aW9uPlxuICAgICAgPC9zZWxlY3Q+XG4gICAgPC9sYWJlbD5cbiAgPC9kaXY+XG59O1xuXG5jb25zdCBQYWdlciA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7cGFnZSwgc2l6ZSwgZmlsdGVyZWRDb3VudCwgc2xpY2V9ID0gcHJvcHM7XG4gIGNvbnN0IHNlbGVjdFByZXZpb3VzUGFnZSA9ICgpID0+IHNsaWNlKHBhZ2UgLSAxLCBzaXplKTtcbiAgY29uc3Qgc2VsZWN0TmV4dFBhZ2UgPSAoKSA9PiBzbGljZShwYWdlICsgMSwgc2l6ZSk7XG4gIGNvbnN0IGlzUHJldmlvdXNEaXNhYmxlZCA9IHBhZ2UgPT09IDE7XG4gIGNvbnN0IGlzTmV4dERpc2FibGVkID0gKGZpbHRlcmVkQ291bnQgLSAocGFnZSAqIHNpemUpKSA8PSAwO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdj5cbiAgICAgIDxidXR0b24gdGFiSW5kZXg9XCItMVwiIG9uQ2xpY2s9e3NlbGVjdFByZXZpb3VzUGFnZX0gZGlzYWJsZWQ9e2lzUHJldmlvdXNEaXNhYmxlZH0+XG4gICAgICAgIFByZXZpb3VzXG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxzbWFsbD4gUGFnZSAtIHtwYWdlIHx8IDF9IDwvc21hbGw+XG4gICAgICA8YnV0dG9uIHRhYkluZGV4PVwiLTFcIiBvbkNsaWNrPXtzZWxlY3ROZXh0UGFnZX0gZGlzYWJsZWQ9e2lzTmV4dERpc2FibGVkfT5cbiAgICAgICAgTmV4dFxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5jb25zdCBTdW1tYXJ5Rm9vdGVyID0gc3Vic2NyaWJlVG9TdW1tYXJ5KFN1bW1hcnkpO1xuY29uc3QgUGFnaW5hdGlvbiA9IHN1YnNjcmliZVRvU3VtbWFyeSgocHJvcHMsIGFjdGlvbnMpID0+IDxQYWdlciB7Li4ucHJvcHN9IHNsaWNlPXthY3Rpb25zLnNsaWNlfS8+KTtcbmNvbnN0IFNlbGVjdFBhZ2VTaXplID0gc3Vic2NyaWJlVG9TdW1tYXJ5KChwcm9wcywgYWN0aW9ucykgPT4gPFBhZ2VTaXplIHsuLi5wcm9wc30gc2xpY2U9e2FjdGlvbnMuc2xpY2V9Lz4pO1xuXG5leHBvcnQgY29uc3QgRm9vdGVyID0gKCkgPT4gPHRmb290PlxuPHRyPlxuICA8dGQgY29sc3Bhbj1cIjNcIj5cbiAgICA8U3VtbWFyeUZvb3Rlci8+XG4gIDwvdGQ+XG4gIDx0ZCBjb2xzcGFuPVwiMlwiIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJidXR0b246bm90KDpkaXNhYmxlZClcIiBjb2xTcGFuPVwiM1wiPlxuICAgIDxQYWdpbmF0aW9uLz5cbiAgPC90ZD5cbiAgPHRkIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJzZWxlY3RcIj5cbiAgICA8U2VsZWN0UGFnZVNpemUvPlxuICA8L3RkPlxuPC90cj5cbjwvdGZvb3Q+O1xuXG5cblxuIiwiZXhwb3J0IGNvbnN0IGZpbmRDb250YWluZXIgPSAoZWxlbWVudCwgc2VsZWN0b3IpID0+IGVsZW1lbnQubWF0Y2hlcyhzZWxlY3RvcikgPT09IHRydWUgPyBlbGVtZW50IDogZmluZENvbnRhaW5lcihlbGVtZW50LnBhcmVudEVsZW1lbnQsIHNlbGVjdG9yKTtcbmV4cG9ydCBjb25zdCBkYXRhU2VsZWN0b3JBdHRyaWJ1dGUgPSAnZGF0YS1rZXlib2FyZC1zZWxlY3Rvcic7XG5leHBvcnQgY29uc3QgZGF0YVNraXBBdHRyaWJ1dGUgPSAnZGF0YS1rZXlib2FyZC1za2lwJztcbmV4cG9ydCBjb25zdCB2YWxGdW5jID0gdmFsID0+ICgpID0+IHZhbDtcbmV4cG9ydCBjb25zdCB2YWxOdWxsID0gdmFsRnVuYyhudWxsKTsiLCJpbXBvcnQge1xuICBmaW5kQ29udGFpbmVyLFxuICBkYXRhU2VsZWN0b3JBdHRyaWJ1dGUsXG4gIGRhdGFTa2lwQXR0cmlidXRlLFxuICB2YWxGdW5jXG59IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWd1bGFyQ2VsbCAoZWxlbWVudCwge3Jvd1NlbGVjdG9yLCBjZWxsU2VsZWN0b3J9KSB7XG4gIGNvbnN0IHJvdyA9IGZpbmRDb250YWluZXIoZWxlbWVudCwgcm93U2VsZWN0b3IpO1xuICBjb25zdCBjZWxscyA9IFsuLi5yb3cucXVlcnlTZWxlY3RvckFsbChjZWxsU2VsZWN0b3IpXTtcbiAgY29uc3QgaW5kZXggPSBjZWxscy5pbmRleE9mKGVsZW1lbnQpO1xuICBjb25zdCByZXR1cm5FbCA9IHZhbEZ1bmMoZWxlbWVudCk7XG4gIHJldHVybiB7XG4gICAgc2VsZWN0RnJvbUFmdGVyOiByZXR1cm5FbCxcbiAgICBzZWxlY3RGcm9tQmVmb3JlOiByZXR1cm5FbCxcbiAgICBuZXh0KCl7XG4gICAgICByZXR1cm4gY2VsbHNbaW5kZXggKyAxXSAhPT0gdm9pZCAwID8gY2VsbHNbaW5kZXggKyAxXSA6IG51bGw7XG4gICAgfSxcbiAgICBwcmV2aW91cygpe1xuICAgICAgcmV0dXJuIGNlbGxzW2luZGV4IC0gMV0gIT09IHZvaWQgMCA/IGNlbGxzW2luZGV4IC0gMV0gOiBudWxsO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2tpcENlbGwgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgY29uc3QgcmVnID0gcmVndWxhckNlbGwoZWxlbWVudCwgb3B0aW9ucyk7XG4gIHJldHVybiB7XG4gICAgcHJldmlvdXM6IHJlZy5wcmV2aW91cyxcbiAgICBuZXh0OiByZWcubmV4dFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NpdGVDZWxsIChlbGVtZW50LCBvcHRpb25zKSB7XG4gIGNvbnN0IGNlbGxFbGVtZW50ID0gZmluZENvbnRhaW5lcihlbGVtZW50LCBvcHRpb25zLmNlbGxTZWxlY3Rvcik7XG4gIGNvbnN0IHNlbGVjdG9yID0gY2VsbEVsZW1lbnQuZ2V0QXR0cmlidXRlKGRhdGFTZWxlY3RvckF0dHJpYnV0ZSk7XG4gIGNvbnN0IHN1YldpZGdldHMgPSBbLi4uY2VsbEVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcildO1xuICBjb25zdCB3aWRnZXRzTGVuZ3RoID0gc3ViV2lkZ2V0cy5sZW5ndGg7XG4gIGNvbnN0IGlzU3ViV2lkZ2V0ID0gZWxlbWVudCAhPT0gY2VsbEVsZW1lbnQ7XG4gIHJldHVybiB7XG4gICAgc2VsZWN0RnJvbUJlZm9yZSgpe1xuICAgICAgcmV0dXJuIGlzU3ViV2lkZ2V0ID8gZWxlbWVudCA6IHN1YldpZGdldHNbMF07XG4gICAgfSxcbiAgICBzZWxlY3RGcm9tQWZ0ZXIoKXtcbiAgICAgIHJldHVybiBpc1N1YldpZGdldCA/IGVsZW1lbnQgOiBzdWJXaWRnZXRzW3dpZGdldHNMZW5ndGggLSAxXTtcbiAgICB9LFxuICAgIG5leHQoKXtcbiAgICAgIGNvbnN0IGluZGV4ID0gc3ViV2lkZ2V0cy5pbmRleE9mKGVsZW1lbnQpO1xuICAgICAgaWYgKGlzU3ViV2lkZ2V0ICYmIGluZGV4ICsgMSA8IHdpZGdldHNMZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHN1YldpZGdldHNbaW5kZXggKyAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZWd1bGFyQ2VsbChjZWxsRWxlbWVudCwgb3B0aW9ucykubmV4dCgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgcHJldmlvdXMoKXtcbiAgICAgIGNvbnN0IGluZGV4ID0gc3ViV2lkZ2V0cy5pbmRleE9mKGVsZW1lbnQpO1xuICAgICAgaWYgKGlzU3ViV2lkZ2V0ICYmIGluZGV4ID4gMCkge1xuICAgICAgICByZXR1cm4gc3ViV2lkZ2V0c1tpbmRleCAtIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlZ3VsYXJDZWxsKGNlbGxFbGVtZW50LCBvcHRpb25zKS5wcmV2aW91cygpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2VsbCAoZWwsIG9wdGlvbnMpIHtcbiAgaWYgKGVsID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSBpZiAoZWwuaGFzQXR0cmlidXRlKGRhdGFTa2lwQXR0cmlidXRlKSkge1xuICAgIHJldHVybiBza2lwQ2VsbChlbCwgb3B0aW9ucyk7XG4gIH0gZWxzZSBpZiAoZWwuaGFzQXR0cmlidXRlKGRhdGFTZWxlY3RvckF0dHJpYnV0ZSkgfHwgIWVsLm1hdGNoZXMob3B0aW9ucy5jZWxsU2VsZWN0b3IpKSB7XG4gICAgcmV0dXJuIGNvbXBvc2l0ZUNlbGwoZWwsIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiByZWd1bGFyQ2VsbChlbCwgb3B0aW9ucyk7XG4gIH1cbn0iLCJpbXBvcnQge2ZpbmRDb250YWluZXIsIGRhdGFTa2lwQXR0cmlidXRlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVndWxhclJvdyAoZWxlbWVudCwgZ3JpZCwge3Jvd1NlbGVjdG9yID0gJ3RyJywgY2VsbFNlbGVjdG9yID0gJ3RoLHRkJ309e30pIHtcbiAgY29uc3Qgcm93cyA9IFsuLi5ncmlkLnF1ZXJ5U2VsZWN0b3JBbGwocm93U2VsZWN0b3IpXTtcbiAgY29uc3QgY2VsbHMgPSBbLi4uZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICBjb25zdCBpbmRleCA9IHJvd3MuaW5kZXhPZihlbGVtZW50KTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2aW91cygpe1xuICAgICAgcmV0dXJuIHJvd3NbaW5kZXggLSAxXSAhPT0gdm9pZCAwID8gcm93c1tpbmRleCAtIDFdIDogbnVsbDtcbiAgICB9LFxuICAgIG5leHQoKXtcbiAgICAgIHJldHVybiByb3dzW2luZGV4ICsgMV0gIT09IHZvaWQgMCA/IHJvd3NbaW5kZXggKyAxXSA6IG51bGw7XG4gICAgfSxcbiAgICBpdGVtKGluZGV4KXtcbiAgICAgIHJldHVybiBjZWxsc1tpbmRleF0gIT09IHZvaWQgMCA/IGNlbGxzW2luZGV4XSA6IG51bGw7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2tpcFJvdyAoZWxlbWVudCwgZ3JpZCwgb3B0aW9ucykge1xuICBjb25zdCByZWd1bGFyID0gcmVndWxhclJvdyhlbGVtZW50LCBncmlkLCBvcHRpb25zKTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2aW91czogcmVndWxhci5wcmV2aW91cyxcbiAgICBuZXh0OiByZWd1bGFyLm5leHRcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJvdyAodGFyZ2V0LCBncmlkLCB7cm93U2VsZWN0b3IsIGNlbGxTZWxlY3Rvcn09e30pIHtcbiAgaWYgKHRhcmdldCA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHIgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICByZXR1cm4gci5oYXNBdHRyaWJ1dGUoZGF0YVNraXBBdHRyaWJ1dGUpID8gc2tpcFJvdyhyLCBncmlkLCB7XG4gICAgICByb3dTZWxlY3RvcixcbiAgICAgIGNlbGxTZWxlY3RvclxuICAgIH0pIDogcmVndWxhclJvdyh0YXJnZXQsIGdyaWQsIHtyb3dTZWxlY3RvciwgY2VsbFNlbGVjdG9yfSk7XG59IiwiaW1wb3J0IHtjcmVhdGVDZWxsfSBmcm9tICcuL2NlbGwnO1xuaW1wb3J0IHtjcmVhdGVSb3d9IGZyb20gJy4vcm93JztcbmltcG9ydCB7ZmluZENvbnRhaW5lcn0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIGtleUdyaWQgKGdyaWQsIG9wdGlvbnMpIHtcbiAgY29uc3Qge3Jvd1NlbGVjdG9yLCBjZWxsU2VsZWN0b3J9ID0gb3B0aW9ucztcbiAgcmV0dXJuIHtcbiAgICBtb3ZlUmlnaHQodGFyZ2V0KXtcbiAgICAgIGNvbnN0IGNlbGwgPSBjcmVhdGVDZWxsKHRhcmdldCwgb3B0aW9ucyk7XG4gICAgICBsZXQgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwoY2VsbC5uZXh0KCksIG9wdGlvbnMpO1xuICAgICAgd2hpbGUgKG5ld0NlbGwgIT09IG51bGwgJiYgbmV3Q2VsbC5zZWxlY3RGcm9tQmVmb3JlID09PSB2b2lkIDApIHtcbiAgICAgICAgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Q2VsbC5uZXh0KCksIG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld0NlbGwgIT09IG51bGwgPyBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUoKSA6IHRhcmdldDtcbiAgICB9LFxuICAgIG1vdmVMZWZ0KHRhcmdldCl7XG4gICAgICBjb25zdCBjZWxsID0gY3JlYXRlQ2VsbCh0YXJnZXQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld0NlbGwgPSBjcmVhdGVDZWxsKGNlbGwucHJldmlvdXMoKSwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Q2VsbCAhPT0gbnVsbCAmJiBuZXdDZWxsLnNlbGVjdEZyb21BZnRlciA9PT0gdm9pZCAwKSB7XG4gICAgICAgIG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld0NlbGwucHJldmlvdXMoKSwgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3Q2VsbCAhPT0gbnVsbCA/IG5ld0NlbGwuc2VsZWN0RnJvbUFmdGVyKCkgOiB0YXJnZXQ7XG4gICAgfSxcbiAgICBtb3ZlVXAodGFyZ2V0KXtcbiAgICAgIGNvbnN0IHJvd0VsZW1lbnQgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICAgICAgY29uc3QgY2VsbHMgPSBbLi4ucm93RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICAgICAgY29uc3Qgcm93ID0gY3JlYXRlUm93KHJvd0VsZW1lbnQsIGdyaWQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld1JvdyA9IGNyZWF0ZVJvdyhyb3cucHJldmlvdXMoKSwgZ3JpZCwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Um93ICE9PSBudWxsICYmIG5ld1Jvdy5pdGVtID09PSB2b2lkIDApIHtcbiAgICAgICAgbmV3Um93ID0gY3JlYXRlUm93KG5ld1Jvdy5wcmV2aW91cygpLCBncmlkLCBvcHRpb25zKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1JvdyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgfVxuXG4gICAgICBsZXQgYXNrZWRJbmRleCA9IGNlbGxzLmluZGV4T2YoZmluZENvbnRhaW5lcih0YXJnZXQsIGNlbGxTZWxlY3RvcikpO1xuICAgICAgbGV0IG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld1Jvdy5pdGVtKGFza2VkSW5kZXgpLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdDZWxsID09PSBudWxsIHx8IG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSA9PT0gdm9pZCAwICYmIGFza2VkSW5kZXggPiAwKSB7XG4gICAgICAgIGFza2VkSW5kZXgtLTtcbiAgICAgICAgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Um93Lml0ZW0oYXNrZWRJbmRleCksIG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSgpO1xuICAgIH0sXG4gICAgbW92ZURvd24odGFyZ2V0KXtcbiAgICAgIGNvbnN0IHJvd0VsZW1lbnQgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICAgICAgY29uc3QgY2VsbHMgPSBbLi4ucm93RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICAgICAgY29uc3Qgcm93ID0gY3JlYXRlUm93KHJvd0VsZW1lbnQsIGdyaWQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld1JvdyA9IGNyZWF0ZVJvdyhyb3cubmV4dCgpLCBncmlkLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdSb3cgIT09IG51bGwgJiYgbmV3Um93Lml0ZW0gPT09IHZvaWQgMCkge1xuICAgICAgICBuZXdSb3cgPSBjcmVhdGVSb3cobmV3Um93Lm5leHQoKSwgZ3JpZCwgb3B0aW9ucyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChuZXdSb3cgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICAgIH1cblxuICAgICAgbGV0IGFza2VkSW5kZXggPSBjZWxscy5pbmRleE9mKGZpbmRDb250YWluZXIodGFyZ2V0LCBjZWxsU2VsZWN0b3IpKTtcbiAgICAgIGxldCBuZXdDZWxsID0gY3JlYXRlQ2VsbChuZXdSb3cuaXRlbShhc2tlZEluZGV4KSwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Q2VsbCA9PT0gbnVsbCB8fCBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUgPT09IHZvaWQgMCAmJiBhc2tlZEluZGV4ID4gMCkge1xuICAgICAgICBhc2tlZEluZGV4LS07XG4gICAgICAgIG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld1Jvdy5pdGVtKGFza2VkSW5kZXgpLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUoKTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQge2tleUdyaWR9IGZyb20gJy4vbGliL2tleWdyaWQnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoZ3JpZCwge3Jvd1NlbGVjdG9yID0gJ3RyJywgY2VsbFNlbGVjdG9yID0gJ3RkLHRoJ309e30pIHtcbiAgbGV0IGxhc3RGb2N1cyA9IG51bGw7XG4gIGNvbnN0IGtnID0ga2V5R3JpZChncmlkLCB7cm93U2VsZWN0b3IsIGNlbGxTZWxlY3Rvcn0pO1xuXG4gIGdyaWQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsICh7dGFyZ2V0LCBrZXlDb2RlfSkgPT4ge1xuICAgIGxldCBuZXdDZWxsID0gbnVsbDtcbiAgICBpZiAoa2V5Q29kZSA9PT0gMzcpIHtcbiAgICAgIG5ld0NlbGwgPSBrZy5tb3ZlTGVmdCh0YXJnZXQpO1xuICAgIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gMzgpIHtcbiAgICAgIG5ld0NlbGwgPSBrZy5tb3ZlVXAodGFyZ2V0KTtcbiAgICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDM5KSB7XG4gICAgICBuZXdDZWxsID0ga2cubW92ZVJpZ2h0KHRhcmdldCk7XG4gICAgfSBlbHNlIGlmIChrZXlDb2RlID09PSA0MCkge1xuICAgICAgbmV3Q2VsbCA9IGtnLm1vdmVEb3duKHRhcmdldCk7XG4gICAgfVxuXG4gICAgaWYgKG5ld0NlbGwgIT09IG51bGwpIHtcbiAgICAgIG5ld0NlbGwuZm9jdXMoKTtcbiAgICAgIGlmIChsYXN0Rm9jdXMgIT09IG51bGwpIHtcbiAgICAgICAgbGFzdEZvY3VzLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnLTEnKTtcbiAgICAgIH1cbiAgICAgIG5ld0NlbGwuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG4gICAgICBsYXN0Rm9jdXMgPSBuZXdDZWxsO1xuICAgIH1cbiAgfSk7XG59IiwiaW1wb3J0IHtoLCBtb3VudCwgY29ubmVjdCwgb25VcGRhdGUsIG9uTW91bnR9IGZyb20gJy4uLy4uL2luZGV4JztcbmltcG9ydCB7UGVyc29uTGlzdH0gZnJvbSAnLi9jb21wb25lbnRzL3Rib2R5JztcbmltcG9ydCB7V29ya0luUHJvZ3Jlc3N9IGZyb20gJy4vY29tcG9uZW50cy9sb2FkaW5nSW5kaWNhdG9yJztcbmltcG9ydCB7SGVhZGVyc30gZnJvbSAnLi9jb21wb25lbnRzL2hlYWRlcnMnO1xuaW1wb3J0IHtGb290ZXJ9IGZyb20gJy4vY29tcG9uZW50cy9mb290ZXInO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4vbGliL3N0b3JlJztcbmltcG9ydCBrZXlib2FyZCBmcm9tICdzbWFydC10YWJsZS1rZXlib2FyZCc7XG5cbmNvbnN0IHRhYmxlID0gb25Nb3VudChuID0+IHtcbiAgc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdleGVjJywgYXJnczogW119KTsgLy9raWNrIHNtYXJ0VGFibGVcbiAga2V5Ym9hcmQobi5kb20ucXVlcnlTZWxlY3RvcigndGFibGUnKSk7XG59KTtcblxuY29uc3QgUGVyc29uVGFibGUgPSB0YWJsZSgoKSA9PlxuICA8ZGl2IGlkPVwidGFibGUtY29udGFpbmVyXCI+XG4gICAgPFdvcmtJblByb2dyZXNzLz5cbiAgICA8dGFibGU+XG4gICAgICA8SGVhZGVycy8+XG4gICAgICA8UGVyc29uTGlzdC8+XG4gICAgICA8Rm9vdGVyLz5cbiAgICA8L3RhYmxlPlxuICA8L2Rpdj4pO1xuXG5tb3VudChQZXJzb25UYWJsZSwge30sIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluJykpOyJdLCJuYW1lcyI6WyJtb3VudCIsInN3YXAiLCJjb21wb3NlIiwiY3VycnkiLCJ0YXAiLCJwb2ludGVyIiwiZmlsdGVyIiwic29ydEZhY3RvcnkiLCJzb3J0Iiwic2VhcmNoIiwidGFibGUiLCJ0YWJsZURpcmVjdGl2ZSIsInNtYXJ0VGFibGUiLCJhY3Rpb25zIiwic2xpY2VTdGF0ZSIsImpzb24iXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU0sZUFBZSxHQUFHLENBQUMsS0FBSyxNQUFNO0VBQ2xDLFFBQVEsRUFBRSxNQUFNO0VBQ2hCLFFBQVEsRUFBRSxFQUFFO0VBQ1osS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDO0VBQ2QsU0FBUyxFQUFFLENBQUM7Q0FDYixDQUFDLENBQUM7Ozs7Ozs7OztBQVNILEFBQWUsU0FBUyxDQUFDLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLFFBQVEsRUFBRTtFQUN2RCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssS0FBSztJQUNuRCxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzdELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztHQUNsQyxFQUFFLEVBQUUsQ0FBQztLQUNILEdBQUcsQ0FBQyxLQUFLLElBQUk7O01BRVosTUFBTSxJQUFJLEdBQUcsT0FBTyxLQUFLLENBQUM7TUFDMUIsT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksS0FBSyxVQUFVLEdBQUcsS0FBSyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNsRixDQUFDLENBQUM7O0VBRUwsSUFBSSxPQUFPLFFBQVEsS0FBSyxVQUFVLEVBQUU7SUFDbEMsT0FBTztNQUNMLFFBQVE7TUFDUixLQUFLLEVBQUUsS0FBSztNQUNaLFFBQVEsRUFBRSxZQUFZO01BQ3RCLFNBQVMsRUFBRSxDQUFDO0tBQ2IsQ0FBQztHQUNILE1BQU07SUFDTCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNqQyxPQUFPLE9BQU8sSUFBSSxLQUFLLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxZQUFZLENBQUMsQ0FBQztHQUM1RTtDQUNGOztBQ2pDTSxTQUFTLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxHQUFHLEVBQUU7RUFDdEMsT0FBTyxDQUFDLEdBQUcsSUFBSSxLQUFLLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxLQUFLLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQzFGOztBQUVELEFBQU8sU0FBUyxLQUFLLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRTtFQUNwQyxNQUFNLEtBQUssR0FBRyxTQUFTLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQztFQUNyQyxPQUFPLENBQUMsR0FBRyxJQUFJLEtBQUs7SUFDbEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7SUFDbkMsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO01BQ3ZCLE9BQU8sRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7S0FDcEIsTUFBTTtNQUNMLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxRQUFRLEtBQUssRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7TUFDdkQsT0FBTyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDekM7R0FDRixDQUFDO0NBQ0g7O0FBRUQsQUFBTyxBQUVOOztBQUVELEFBQU8sU0FBUyxHQUFHLEVBQUUsRUFBRSxFQUFFO0VBQ3ZCLE9BQU8sR0FBRyxJQUFJO0lBQ1osRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ1IsT0FBTyxHQUFHLENBQUM7R0FDWjs7O0FDN0JJLE1BQU0sUUFBUSxHQUFHLEVBQUUsSUFBSSxVQUFVLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDOztBQUVoRCxBQUFPLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7O0FBRTNELEFBQU8sTUFBTSxjQUFjLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLO0VBQ3RDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDN0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUM3QixPQUFPLEtBQUssQ0FBQyxNQUFNLEtBQUssS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMzRSxDQUFDOztBQUVGLE1BQU0sT0FBTyxHQUFHLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUUzRSxBQUFPLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSztFQUNuQyxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsQ0FBQzs7O0VBR3RCLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUNYLE9BQU8sSUFBSSxDQUFDO0dBQ2I7O0VBRUQsSUFBSSxJQUFJLEtBQUssT0FBTyxDQUFDLEVBQUU7SUFDckIsT0FBTyxLQUFLLENBQUM7R0FDZDs7RUFFRCxJQUFJLElBQUksS0FBSyxRQUFRLEVBQUU7SUFDckIsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0dBQ2hCOzs7RUFHRCxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksRUFBRTtJQUM1QixPQUFPLEtBQUssQ0FBQztHQUNkOztFQUVELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUNwQixPQUFPLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7R0FDOUU7O0VBRUQsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ3pCLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN6QixPQUFPLEtBQUssQ0FBQyxNQUFNLEtBQUssS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDbkYsQ0FBQzs7QUFFRixBQUFPLE1BQU0sUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBRS9CLEFBQU8sTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJO0NBQ3hCLENBQUM7O0FDM0NGLE1BQU0sTUFBTSxHQUFHLDRCQUE0QixDQUFDOztBQUU1QyxNQUFNLG9CQUFvQixHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsS0FBSyxLQUFLLEdBQUcsQ0FBQyxPQUFPLElBQUk7RUFDakUsS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEVBQUU7SUFDdEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7R0FDMUI7Q0FDRixDQUFDLENBQUM7O0FBRUgsQUFBTyxNQUFNLG9CQUFvQixHQUFHLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDaEYsQUFBTyxNQUFNLGlCQUFpQixHQUFHLG9CQUFvQixDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDMUUsQUFBTyxNQUFNLGFBQWEsR0FBRyxDQUFDLEtBQUssS0FBSyxHQUFHLENBQUMsQ0FBQyxPQUFPLEtBQUs7RUFDdkQsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxLQUFLLE9BQU8sS0FBSyxLQUFLLFVBQVUsQ0FBQyxDQUFDO0VBQy9FLEtBQUssSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxVQUFVLEVBQUU7SUFDbkMsS0FBSyxLQUFLLEtBQUssR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0dBQ25GO0NBQ0YsQ0FBQyxDQUFDO0FBQ0gsQUFBTyxNQUFNLGdCQUFnQixHQUFHLENBQUMsS0FBSyxLQUFLLEdBQUcsQ0FBQyxPQUFPLElBQUk7RUFDeEQsS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEVBQUU7SUFDdEIsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztHQUMvQjtDQUNGLENBQUMsQ0FBQzs7QUFFSCxBQUFPLE1BQU0sV0FBVyxHQUFHLEdBQUcsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUM7O0FBRWpFLEFBQU8sTUFBTSxhQUFhLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxLQUFLO0VBQzlDLElBQUksS0FBSyxDQUFDLFFBQVEsS0FBSyxLQUFLLEVBQUU7SUFDNUIsT0FBTyxRQUFRLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7R0FDekQsTUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLEtBQUssTUFBTSxFQUFFO0lBQ3BDLE9BQU8sUUFBUSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7R0FDaEQsTUFBTTtJQUNMLE9BQU8sTUFBTSxDQUFDLFlBQVksS0FBSyxNQUFNLEdBQUcsUUFBUSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0dBQ25JO0NBQ0YsQ0FBQzs7QUFFRixBQUFPLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxLQUFLLEtBQUs7RUFDMUMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztLQUN0QixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQztLQUNwQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BELENBQUM7O0FDeENLLE1BQU0sUUFBUSxHQUFHLFlBQVksS0FBSyxFQUFFO0VBQ3pDLE1BQU0sS0FBSyxDQUFDO0VBQ1osSUFBSSxLQUFLLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFO0lBQzNDLEtBQUssSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRTtNQUNoQyxRQUFRLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUN6QjtHQUNGO0NBQ0Y7O0FDV0QsU0FBUyxvQkFBb0IsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxFQUFFO0VBQy9FLE1BQU0sYUFBYSxHQUFHLGlCQUFpQixDQUFDLFlBQVksSUFBSSxFQUFFLENBQUMsQ0FBQztFQUM1RCxNQUFNLGFBQWEsR0FBRyxpQkFBaUIsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDLENBQUM7O0VBRTVELE9BQU8sYUFBYSxDQUFDLE1BQU0sSUFBSSxhQUFhLENBQUMsTUFBTTtJQUNqRCxPQUFPO01BQ0wsb0JBQW9CLENBQUMsYUFBYSxDQUFDO01BQ25DLGlCQUFpQixDQUFDLGFBQWEsQ0FBQztLQUNqQyxHQUFHLElBQUksQ0FBQztDQUNaOztBQUVELFNBQVMsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRTtFQUM3QyxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztFQUMzQyxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQzs7RUFFM0MsSUFBSSxjQUFjLENBQUMsYUFBYSxFQUFFLGFBQWEsQ0FBQyxFQUFFO0lBQ2hELE9BQU8sSUFBSSxDQUFDO0dBQ2I7O0VBRUQsSUFBSSxRQUFRLENBQUMsUUFBUSxLQUFLLE1BQU0sRUFBRTtJQUNoQyxPQUFPLFdBQVcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0dBQzFDOztFQUVELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7RUFDL0MsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztFQUMvQyxNQUFNLGtCQUFrQixHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztFQUU3RSxPQUFPLE9BQU87SUFDWixnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQztJQUNwQyxhQUFhLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztHQUN2RCxDQUFDO0NBQ0g7O0FBRUQsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDOzs7QUFHakMsTUFBTSxNQUFNLEdBQUcsU0FBUyxTQUFTLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUU7RUFDcEUsSUFBSSxDQUFDLFFBQVEsRUFBRTtJQUNiLElBQUksUUFBUSxFQUFFO01BQ1osUUFBUSxDQUFDLEdBQUcsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztNQUM5RSxRQUFRLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztNQUN2QixPQUFPLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDekMsTUFBTTtNQUNMLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLENBQUM7S0FDekM7R0FDRixNQUFNO0lBQ0wsSUFBSSxDQUFDLFFBQVEsRUFBRTtNQUNiLGFBQWEsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO01BQ3hDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsRUFBRTtLQUN6QyxNQUFNLElBQUksUUFBUSxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUMsUUFBUSxFQUFFO01BQ2xELFFBQVEsQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLFFBQVEsRUFBRSxhQUFhLENBQUMsQ0FBQztNQUNuRCxRQUFRLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztNQUN2QixhQUFhLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO01BQ3ZELE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztLQUM3QyxNQUFNO01BQ0wsUUFBUSxDQUFDLEdBQUcsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDO01BQzVCLFFBQVEsQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7TUFDNUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0tBQ3pDO0dBQ0Y7Q0FDRixDQUFDOzs7Ozs7Ozs7O0FBVUYsQUFBTyxNQUFNLE1BQU0sR0FBRyxTQUFTLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFOzs7OztFQUszRixNQUFNLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDOztFQUVuRSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7O0lBRXBCLEtBQUssSUFBSSxDQUFDLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO01BQy9CLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRTtRQUNmLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO09BQzlCO0tBQ0Y7R0FDRjs7O0VBR0QsTUFBTSxXQUFXLEdBQUcsT0FBTyxLQUFLLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDOztFQUVwRyxJQUFJLEtBQUssRUFBRTs7OztJQUlULElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBRTtNQUN6QyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7S0FDbEI7O0lBRUQsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQzs7O0lBR2hELElBQUksS0FBSyxDQUFDLFFBQVEsS0FBSyxNQUFNLEVBQUU7TUFDN0IsT0FBTyxVQUFVLENBQUM7S0FDbkI7O0lBRUQsSUFBSSxLQUFLLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxTQUFTLEtBQUssQ0FBQyxFQUFFO01BQzFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztLQUN4Qzs7SUFFRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7OztJQUduRixNQUFNLFlBQVksR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDOUQsSUFBSSxZQUFZLEtBQUssSUFBSSxFQUFFO01BQ3pCLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDaEQ7OztJQUdELElBQUksYUFBYSxHQUFHLENBQUMsRUFBRTtNQUNyQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsYUFBYSxFQUFFLENBQUMsRUFBRSxFQUFFOztRQUV0QyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUM7T0FDM0U7S0FDRjtHQUNGOztFQUVELE9BQU8sVUFBVSxDQUFDO0NBQ25CLENBQUM7O0FBRUYsQUFBTyxTQUFTLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0VBQ25DLFlBQVksQ0FBQztFQUNiLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0VBQzFDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztFQUMxRyxRQUFRLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztFQUNuQixRQUFRLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxPQUFPLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDckYsT0FBTyxRQUFRLENBQUM7Q0FDakI7O0FBRUQsQUFBTyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsVUFBVSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTtFQUN6RCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxLQUFLLEtBQUssQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0VBQ3JFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztFQUNoRixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztFQUM1QyxRQUFRLENBQUMsWUFBWTtJQUNuQixLQUFLLElBQUksRUFBRSxJQUFJLEtBQUssRUFBRTtNQUNwQixFQUFFLEVBQUUsQ0FBQztLQUNOO0dBQ0YsQ0FBQyxDQUFDO0VBQ0gsT0FBTyxLQUFLLENBQUM7Q0FDZCxDQUFDOzs7Ozs7OztBQzVKRixBQUFlLFNBQVMsTUFBTSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUU7RUFDbEQsSUFBSSxPQUFPLEdBQUcsWUFBWSxDQUFDO0VBQzNCLE1BQU0sVUFBVSxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsSUFBSSxLQUFLO0lBQ3JDLE1BQU1BLFFBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQztJQUNyQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUN2RyxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRUEsUUFBSyxDQUFDLENBQUM7Ozs7SUFJbEQsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQzs7O0lBR2hELFFBQVEsQ0FBQyxZQUFZO01BQ25CLEtBQUssSUFBSSxFQUFFLElBQUksU0FBUyxFQUFFO1FBQ3hCLEVBQUUsRUFBRSxDQUFDO09BQ047S0FDRixDQUFDLENBQUM7SUFDSCxPQUFPLE9BQU8sQ0FBQztHQUNoQixDQUFDO0VBQ0YsT0FBTyxVQUFVLENBQUM7OztBQzFCcEIsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLElBQUksS0FBSztFQUN6RSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7RUFDL0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0VBQ2pDLE9BQU8sQ0FBQyxDQUFDO0NBQ1YsQ0FBQyxDQUFDOzs7OztBQUtILEFBQU8sTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7Ozs7O0FBS25ELEFBQU8sTUFBTSxTQUFTLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUM7Ozs7O0FBS3ZELEFBQU8sTUFBTSxRQUFRLEdBQUcsZ0JBQWdCLENBQUMsVUFBVSxDQUFDOzs7Ozs7O0FDWnBELGdCQUFlLFVBQVUsSUFBSSxFQUFFO0VBQzdCLE9BQU8sWUFBWTtJQUNqQixJQUFJLFVBQVUsQ0FBQztJQUNmLE1BQU0sV0FBVyxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsSUFBSSxLQUFLOztNQUV0QyxNQUFNLFFBQVEsR0FBRyxDQUFDLFFBQVEsS0FBSyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7TUFDcEQsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0tBQ3ZDLENBQUM7SUFDRixNQUFNLGlCQUFpQixHQUFHLENBQUMsS0FBSyxLQUFLO01BQ25DLFVBQVUsR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3pDLENBQUM7O0lBRUYsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsUUFBUSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztHQUN0RixDQUFDO0NBQ0gsQ0FBQTs7Ozs7O0dDZEQsQUFxQkM7Ozs7Ozs7Ozs7OztBQ2ZELGNBQWUsVUFBVSxLQUFLLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRSxVQUFVLEdBQUcsUUFBUSxFQUFFO0VBQ25FLE9BQU8sVUFBVSxJQUFJLEVBQUUsY0FBYyxHQUFHLFFBQVEsRUFBRSxXQUFXLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxFQUFFO0lBQ3JHLE9BQU8sVUFBVSxRQUFRLEVBQUU7TUFDekIsSUFBSSxjQUFjLEdBQUcsUUFBUSxDQUFDO01BQzlCLElBQUksVUFBVSxFQUFFLGtCQUFrQixFQUFFLFlBQVksQ0FBQzs7TUFFakQsTUFBTSxXQUFXLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxJQUFJLEtBQUs7UUFDdEMsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO09BQ3RDLENBQUM7O01BRUYsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLO1FBQ25DLFVBQVUsR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3hDLFlBQVksR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU07VUFDbkMsTUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1VBQ2hELElBQUksV0FBVyxDQUFDLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxLQUFLLElBQUksRUFBRTtZQUN4RCxNQUFNLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUMxRCxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDM0Isa0JBQWtCLEdBQUcsVUFBVSxDQUFDO1dBQ2pDO1NBQ0YsQ0FBQyxDQUFDO09BQ0osQ0FBQyxDQUFDOztNQUVILE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQyxNQUFNO1FBQ2xDLFlBQVksRUFBRSxDQUFDO09BQ2hCLENBQUMsQ0FBQzs7TUFFSCxPQUFPLE9BQU8sQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDckQsQ0FBQztHQUNILENBQUM7Q0FDSCxDQUFBOztBQzVDTSxTQUFTQyxNQUFJLEVBQUUsQ0FBQyxFQUFFO0VBQ3ZCLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDMUI7O0FBRUQsQUFBTyxTQUFTQyxTQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsR0FBRyxFQUFFO0VBQ3RDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sS0FBSyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztDQUMxRjs7QUFFRCxBQUFPLFNBQVNDLE9BQUssRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFO0VBQ3BDLE1BQU0sS0FBSyxHQUFHLFNBQVMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDO0VBQ3JDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSztJQUNsQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7TUFDdkIsT0FBTyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztLQUNwQixNQUFNO01BQ0wsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFFBQVEsS0FBSyxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztNQUN2RCxPQUFPQSxPQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDekM7R0FDRixDQUFDO0NBQ0g7O0FBRUQsQUFBTyxBQUVOOztBQUVELEFBQU8sU0FBU0MsS0FBRyxFQUFFLEVBQUUsRUFBRTtFQUN2QixPQUFPLEdBQUcsSUFBSTtJQUNaLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNSLE9BQU8sR0FBRyxDQUFDO0dBQ1o7OztBQzdCWSxTQUFTLE9BQU8sRUFBRSxJQUFJLEVBQUU7O0VBRXJDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7O0VBRTlCLFNBQVMsT0FBTyxFQUFFLEdBQUcsR0FBRyxFQUFFLEVBQUUsS0FBSyxHQUFHLEVBQUUsRUFBRTtJQUN0QyxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDeEIsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZCLE9BQU8sQ0FBQyxPQUFPLEtBQUssU0FBUyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQztNQUNqRCxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztHQUNyQzs7RUFFRCxTQUFTLEdBQUcsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFO0lBQzdCLElBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQztJQUNyQixNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsWUFBWSxDQUFDLEdBQUcsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2hELEtBQUssSUFBSSxHQUFHLElBQUksWUFBWSxDQUFDLE9BQU8sRUFBRSxFQUFFO01BQ3RDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVMsRUFBRTtRQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7T0FDeEI7S0FDRjtJQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDNUQsT0FBTyxNQUFNLENBQUM7R0FDZjs7RUFFRCxPQUFPO0lBQ0wsR0FBRyxDQUFDLE1BQU0sQ0FBQztNQUNULE9BQU8sT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7S0FDbkM7SUFDRCxHQUFHO0dBQ0o7Q0FDRixBQUFDOztBQzFCRixTQUFTLGNBQWMsRUFBRSxJQUFJLEVBQUU7RUFDN0IsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQztFQUNyQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSztJQUNmLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzQixNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7O0lBRTNCLElBQUksSUFBSSxLQUFLLElBQUksRUFBRTtNQUNqQixPQUFPLENBQUMsQ0FBQztLQUNWOztJQUVELElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtNQUN0QixPQUFPLENBQUMsQ0FBQyxDQUFDO0tBQ1g7O0lBRUQsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO01BQ3RCLE9BQU8sQ0FBQyxDQUFDO0tBQ1Y7O0lBRUQsT0FBTyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztHQUM3QjtDQUNGOztBQUVELEFBQWUsU0FBUyxXQUFXLEVBQUUsQ0FBQyxTQUFBQyxVQUFPLEVBQUUsU0FBUyxDQUFDLEdBQUcsRUFBRSxFQUFFO0VBQzlELElBQUksQ0FBQ0EsVUFBTyxJQUFJLFNBQVMsS0FBSyxNQUFNLEVBQUU7SUFDcEMsT0FBTyxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO0dBQzVCOztFQUVELE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQ0EsVUFBTyxDQUFDLENBQUM7RUFDMUMsTUFBTSxXQUFXLEdBQUcsU0FBUyxLQUFLLE1BQU0sR0FBR0osTUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQzs7RUFFdkUsT0FBTyxDQUFDLEtBQUssS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDOzs7QUMvQmpELFNBQVMsY0FBYyxFQUFFLElBQUksRUFBRTtFQUM3QixRQUFRLElBQUk7SUFDVixLQUFLLFNBQVM7TUFDWixPQUFPLE9BQU8sQ0FBQztJQUNqQixLQUFLLFFBQVE7TUFDWCxPQUFPLE1BQU0sQ0FBQztJQUNoQixLQUFLLE1BQU07TUFDVCxPQUFPLENBQUMsR0FBRyxLQUFLLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2hDO01BQ0UsT0FBT0MsU0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztHQUN0RDtDQUNGOztBQUVELE1BQU0sU0FBUyxHQUFHO0VBQ2hCLFFBQVEsQ0FBQyxLQUFLLENBQUM7SUFDYixPQUFPLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7R0FDekM7RUFDRCxFQUFFLENBQUMsS0FBSyxDQUFDO0lBQ1AsT0FBTyxDQUFDLEtBQUssS0FBSyxNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztHQUMzQztFQUNELEtBQUssQ0FBQyxLQUFLLENBQUM7SUFDVixPQUFPLENBQUMsS0FBSyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7R0FDNUM7RUFDRCxFQUFFLENBQUMsS0FBSyxDQUFDO0lBQ1AsT0FBTyxDQUFDLEtBQUssS0FBSyxLQUFLLEdBQUcsS0FBSyxDQUFDO0dBQ2pDO0VBQ0QsRUFBRSxDQUFDLEtBQUssQ0FBQztJQUNQLE9BQU8sQ0FBQyxLQUFLLEtBQUssS0FBSyxHQUFHLEtBQUssQ0FBQztHQUNqQztFQUNELEdBQUcsQ0FBQyxLQUFLLENBQUM7SUFDUixPQUFPLENBQUMsS0FBSyxLQUFLLEtBQUssSUFBSSxLQUFLLENBQUM7R0FDbEM7RUFDRCxHQUFHLENBQUMsS0FBSyxDQUFDO0lBQ1IsT0FBTyxDQUFDLEtBQUssS0FBSyxLQUFLLElBQUksS0FBSyxDQUFDO0dBQ2xDO0VBQ0QsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUNYLE9BQU8sQ0FBQyxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUssQ0FBQztHQUNsQztFQUNELFNBQVMsQ0FBQyxLQUFLLENBQUM7SUFDZCxPQUFPLENBQUMsS0FBSyxLQUFLLEtBQUssSUFBSSxLQUFLLENBQUM7R0FDbEM7Q0FDRixDQUFDOztBQUVGLE1BQU0sS0FBSyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7O0FBRS9ELEFBQU8sU0FBUyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxFQUFFLFFBQVEsR0FBRyxVQUFVLEVBQUUsSUFBSSxHQUFHLFFBQVEsQ0FBQyxFQUFFO0VBQy9FLE1BQU0sTUFBTSxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUNwQyxNQUFNLGNBQWMsR0FBR0EsU0FBTyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztFQUM1RCxNQUFNLGFBQWEsR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDNUMsT0FBT0EsU0FBTyxDQUFDLE1BQU0sRUFBRSxhQUFhLENBQUMsQ0FBQztDQUN2Qzs7O0FBR0QsU0FBUyxnQkFBZ0IsRUFBRSxJQUFJLEVBQUU7RUFDL0IsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO0VBQ2xCLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDOUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUk7SUFDeEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQztJQUM1RCxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUU7TUFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksQ0FBQztLQUM3QjtHQUNGLENBQUMsQ0FBQztFQUNILE9BQU8sTUFBTSxDQUFDO0NBQ2Y7O0FBRUQsQUFBZSxTQUFTSSxRQUFNLEVBQUUsTUFBTSxFQUFFO0VBQ3RDLE1BQU0saUJBQWlCLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7RUFDbkQsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUk7SUFDMUQsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQztJQUNqQyxNQUFNLE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDdkQsT0FBT0osU0FBTyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztHQUN4QyxDQUFDLENBQUM7RUFDSCxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7O0VBRXhDLE9BQU8sQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQzs7O0FDM0VsRCxlQUFlLFVBQVUsVUFBVSxHQUFHLEVBQUUsRUFBRTtFQUN4QyxNQUFNLENBQUMsS0FBSyxFQUFFLEtBQUssR0FBRyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUM7RUFDdkMsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQzlELElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFO0lBQzNCLE9BQU8sS0FBSyxJQUFJLEtBQUssQ0FBQztHQUN2QixNQUFNO0lBQ0wsT0FBTyxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0dBQ3hHOzs7QUNUWSxTQUFTLFlBQVksRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO0VBQzNELE9BQU8sU0FBUyxhQUFhLEVBQUUsS0FBSyxHQUFHLEVBQUUsRUFBRTtJQUN6QyxNQUFNLFVBQVUsR0FBRyxJQUFJLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUN4QyxNQUFNLE1BQU0sR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDO0lBQ3ZDLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0dBQ2pELENBQUM7Q0FDSDs7QUNOTSxTQUFTLE9BQU8sSUFBSTs7RUFFekIsTUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDO0VBQzFCLE1BQU0sUUFBUSxHQUFHO0lBQ2YsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLFNBQVMsQ0FBQztNQUNyQixjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztNQUN4RSxPQUFPLFFBQVEsQ0FBQztLQUNqQjtJQUNELFFBQVEsQ0FBQyxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUM7TUFDdEIsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztNQUM5QyxLQUFLLElBQUksUUFBUSxJQUFJLFNBQVMsRUFBRTtRQUM5QixRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztPQUNuQjtNQUNELE9BQU8sUUFBUSxDQUFDO0tBQ2pCO0lBQ0QsR0FBRyxDQUFDLEtBQUssRUFBRSxHQUFHLFNBQVMsQ0FBQztNQUN0QixJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1YsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztPQUM3RCxNQUFNO1FBQ0wsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUN6QyxjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7T0FDeEc7TUFDRCxPQUFPLFFBQVEsQ0FBQztLQUNqQjtHQUNGLENBQUM7RUFDRixPQUFPLFFBQVEsQ0FBQztDQUNqQixBQUVELEFBQU87O0FDNUJBLE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQztBQUN6QyxBQUFPLE1BQU0sZUFBZSxHQUFHLGlCQUFpQixDQUFDO0FBQ2pELEFBQU8sTUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDO0FBQzFDLEFBQU8sTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDO0FBQzNDLEFBQU8sTUFBTSxjQUFjLEdBQUcsZ0JBQWdCLENBQUM7QUFDL0MsQUFBTyxNQUFNLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUNqRCxBQUFPLE1BQU0sY0FBYyxHQUFHLGdCQUFnQixDQUFDO0FBQy9DLEFBQU8sTUFBTSxVQUFVLEdBQUcsWUFBWTs7QUNTdEMsU0FBUyxjQUFjLEVBQUUsSUFBSSxFQUFFO0VBQzdCLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ2pDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFQyxPQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUMvQjs7QUFFRCxjQUFlLFVBQVU7RUFDdkIsV0FBVztFQUNYLFVBQVU7RUFDVixJQUFJO0VBQ0osYUFBYTtFQUNiLGFBQWE7Q0FDZCxFQUFFO0VBQ0QsTUFBTSxLQUFLLEdBQUcsT0FBTyxFQUFFLENBQUM7RUFDeEIsTUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQzNDLE1BQU0sWUFBWSxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztFQUM3QyxNQUFNLGFBQWEsR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7RUFDL0MsTUFBTSxhQUFhLEdBQUcsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDOztFQUUvQyxNQUFNLFVBQVUsR0FBR0EsT0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLFNBQVMsS0FBSyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztFQUNsRixNQUFNLFFBQVEsR0FBR0EsT0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOztFQUV0RCxNQUFNLGVBQWUsR0FBRyxDQUFDLFFBQVEsS0FBSztJQUNwQyxRQUFRLENBQUMsZUFBZSxFQUFFO01BQ3hCLElBQUksRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUk7TUFDM0IsSUFBSSxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSTtNQUMzQixhQUFhLEVBQUUsUUFBUSxDQUFDLE1BQU07S0FDL0IsQ0FBQyxDQUFDO0dBQ0osQ0FBQzs7RUFFRixNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsZUFBZSxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsS0FBSztJQUM1QyxLQUFLLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzlDLFVBQVUsQ0FBQyxZQUFZO01BQ3JCLElBQUk7UUFDRixNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDaEUsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUMxRCxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQzdELE1BQU0sUUFBUSxHQUFHRCxTQUFPLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRUUsS0FBRyxDQUFDLGVBQWUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1RixNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUk7VUFDakQsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztTQUMzQyxDQUFDLENBQUMsQ0FBQztPQUNMLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixLQUFLLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztPQUMvQixTQUFTO1FBQ1IsS0FBSyxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztPQUNoRDtLQUNGLEVBQUUsZUFBZSxDQUFDLENBQUM7R0FDckIsQ0FBQzs7RUFFRixNQUFNLGdCQUFnQixHQUFHRCxPQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLGVBQWUsS0FBS0QsU0FBTztJQUNuRSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNoQ0UsS0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNqQixJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQztHQUNyQixDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7O0VBRXBCLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7O0VBRXZGLE1BQU0sY0FBYyxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBS0YsU0FBTztJQUMxQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO0lBQzFCLGdCQUFnQjtJQUNoQixNQUFNLEtBQUssQ0FBQyxJQUFJLEVBQUU7R0FDbkIsQ0FBQzs7RUFFRixNQUFNLEdBQUcsR0FBRztJQUNWLElBQUksRUFBRSxjQUFjLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQztJQUM5QyxNQUFNLEVBQUUsY0FBYyxDQUFDLGFBQWEsRUFBRSxjQUFjLENBQUM7SUFDckQsTUFBTSxFQUFFLGNBQWMsQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDO0lBQ3JELEtBQUssRUFBRUEsU0FBTyxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxZQUFZLENBQUMsRUFBRSxNQUFNLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNoRixJQUFJO0lBQ0osSUFBSSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUM7TUFDdEIsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFO1NBQ3JCLElBQUksQ0FBQyxZQUFZO1VBQ2hCLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7VUFDckQsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztVQUMzRCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1VBQzNELE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7VUFDeEQsTUFBTSxRQUFRLEdBQUdBLFNBQU8sQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztVQUN0RSxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJO1lBQzdCLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1dBQzFDLENBQUMsQ0FBQztTQUNKLENBQUMsQ0FBQztLQUNOO0lBQ0QsZUFBZSxDQUFDLEVBQUUsQ0FBQztNQUNqQixLQUFLLENBQUMsRUFBRSxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUMsQ0FBQztLQUMvQjtJQUNELGFBQWEsRUFBRTtNQUNiLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztNQUNoRCxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7TUFDcEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO01BQ2xELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztNQUNsQixLQUFLLElBQUksSUFBSSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUU7UUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQ3ZFO01BQ0QsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0tBQ3RDO0dBQ0YsQ0FBQzs7RUFFRixNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQzs7RUFFM0MsTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFO0lBQ3hDLEdBQUcsRUFBRTtNQUNILE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztLQUNwQjtHQUNGLENBQUMsQ0FBQzs7RUFFSCxPQUFPLFFBQVEsQ0FBQzs7O0FDckhsQix1QkFBZSxVQUFVO0VBQ3ZCLGFBQUFLLGNBQVcsR0FBR0MsV0FBSTtFQUNsQixhQUFhLEdBQUdGLFFBQU07RUFDdEIsYUFBYSxHQUFHRyxRQUFNO0VBQ3RCLFVBQVUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQztFQUNqRSxJQUFJLEdBQUcsRUFBRTtDQUNWLEVBQUUsR0FBRyxlQUFlLEVBQUU7O0VBRXJCLE1BQU0sU0FBUyxHQUFHQyxPQUFLLENBQUMsQ0FBQyxhQUFBSCxjQUFXLEVBQUUsYUFBYSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQzs7RUFFdkYsT0FBTyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxFQUFFLE1BQU0sS0FBSztJQUNyRCxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQztNQUN2QyxhQUFBQSxjQUFXO01BQ1gsYUFBYTtNQUNiLGFBQWE7TUFDYixVQUFVO01BQ1YsSUFBSTtNQUNKLEtBQUssRUFBRSxTQUFTO0tBQ2pCLENBQUMsQ0FBQyxDQUFDO0dBQ0wsRUFBRSxTQUFTLENBQUMsQ0FBQzs7O0FDVlQsTUFBTUcsT0FBSyxHQUFHQyxnQkFBYyxDQUFDLEFBQ3BDLEFBQXFCOztBQ2JkLE1BQU0sR0FBRyxHQUFHUixPQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxLQUFLLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3pELEFBQU8sTUFBTSxPQUFPLEdBQUdBLE9BQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxLQUFLLENBQUMsS0FBSyxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM3RyxBQUFPLE1BQU0sS0FBSyxHQUFHQSxPQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssS0FBSyxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDakgsQUFBTyxNQUFNLE1BQU0sR0FBR0EsT0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssS0FBSyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyRixBQUFPLE1BQU0sTUFBTSxHQUFHQSxPQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOztBQ0hoSCxXQUFlLFVBQVUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQUU7O0VBRXRDLE1BQU0sVUFBVSxHQUFHLENBQUMsT0FBTyxLQUFLO0lBQzlCLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDZixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUM7R0FDdkIsQ0FBQztFQUNGLE1BQU0sT0FBTyxHQUFHRCxTQUFPLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUNoRCxPQUFPO0lBQ0wsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7TUFDbEIsT0FBT0EsU0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDckQ7SUFDRCxLQUFLLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztNQUNsQixPQUFPLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ25DO0lBQ0QsTUFBTSxFQUFFQSxTQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQztJQUN0QyxNQUFNLENBQUMsTUFBTSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUM7TUFDdkIsT0FBT0EsU0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDdEQ7SUFDRCxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQztHQUNmLENBQUM7OztBQ3RCSjs7QUFFQSxNQUFNLGNBQWMsR0FBRyxVQUFVLFVBQVUsRUFBRTtFQUMzQyxPQUFPLFVBQVUsS0FBSyxHQUFHO0lBQ3ZCLFVBQVUsRUFBRSxVQUFVLENBQUMsYUFBYSxFQUFFO0lBQ3RDLFNBQVMsRUFBRSxFQUFFO0lBQ2IsT0FBTyxFQUFFLEVBQUU7SUFDWCxZQUFZLEVBQUUsS0FBSztHQUNwQixFQUFFLE1BQU0sRUFBRTtJQUNULE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDO0lBQzVCLFFBQVEsSUFBSTtNQUNWLEtBQUssZUFBZSxFQUFFO1FBQ3BCLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUM7UUFDeEIsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztPQUN6RDtNQUNEO1FBQ0UsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUU7VUFDcEIsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7U0FDM0I7UUFDRCxPQUFPLEtBQUssQ0FBQztLQUNoQjtHQUNGO0NBQ0YsQ0FBQzs7QUFFRixBQUFPLFNBQVMsV0FBVyxFQUFFLFVBQVUsRUFBRTs7RUFFdkMsTUFBTSxPQUFPLEdBQUcsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDOztFQUUzQyxJQUFJLFlBQVksR0FBRztJQUNqQixVQUFVLEVBQUUsVUFBVSxDQUFDLGFBQWEsRUFBRTtHQUN2QyxDQUFDO0VBQ0YsSUFBSSxPQUFPLENBQUM7RUFDWixJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7O0VBRW5CLE1BQU0sU0FBUyxHQUFHLE1BQU07SUFDdEIsS0FBSyxJQUFJLENBQUMsSUFBSSxTQUFTLEVBQUU7TUFDdkIsQ0FBQyxFQUFFLENBQUM7S0FDTDtHQUNGLENBQUM7O0VBRUYsVUFBVSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxVQUFVLENBQUMsRUFBRTtJQUM1QyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0dBQ2IsQ0FBQyxDQUFDOztFQUVILFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRTtJQUNqRCxNQUFNLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRTtNQUMxQixZQUFZLEVBQUUsT0FBTztLQUN0QixDQUFDLENBQUM7SUFDSCxTQUFTLEVBQUUsQ0FBQztHQUNiLENBQUMsQ0FBQzs7RUFFSCxVQUFVLENBQUMsZUFBZSxDQUFDLFVBQVUsU0FBUyxFQUFFO0lBQzlDLE1BQU0sQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFO01BQzFCLFVBQVUsRUFBRSxVQUFVLENBQUMsYUFBYSxFQUFFO01BQ3RDLFNBQVM7TUFDVCxPQUFPO0tBQ1IsQ0FBQyxDQUFDO0lBQ0gsU0FBUyxFQUFFLENBQUM7R0FDYixDQUFDLENBQUM7O0VBRUgsT0FBTztJQUNMLFNBQVMsQ0FBQyxRQUFRLENBQUM7TUFDakIsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztNQUN6QixPQUFPLE1BQU07UUFDWCxTQUFTLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDO09BQ25EO0tBQ0Y7SUFDRCxRQUFRLEVBQUU7TUFDUixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ2pGO0lBQ0QsUUFBUSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7TUFDbkIsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7TUFDN0MsSUFBSSxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUMzQyxTQUFTLEVBQUUsQ0FBQztPQUNiO0tBQ0Y7R0FDRixDQUFDOzs7O0FDdkVKLE1BQU0sVUFBVSxHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzs7QUFFbEYsTUFBTVEsT0FBSyxHQUFHRSxPQUFVLENBQUMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7O0FBRW5ELFlBQWUsV0FBVyxDQUFDRixPQUFLLENBQUMsQ0FBQzs7QUNQM0IsU0FBUyxRQUFRLEVBQUUsRUFBRSxFQUFFLEtBQUssR0FBRyxHQUFHLEVBQUU7RUFDekMsSUFBSSxTQUFTLENBQUM7RUFDZCxPQUFPLENBQUMsRUFBRSxLQUFLO0lBQ2IsSUFBSSxTQUFTLEVBQUU7TUFDYixNQUFNLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQ2hDO0lBQ0QsU0FBUyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsWUFBWTtNQUN4QyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDUixFQUFFLEtBQUssQ0FBQyxDQUFDO0dBQ1gsQ0FBQztDQUNIO0FBQ0QsQUFBTyxNQUFNLFdBQVcsR0FBRyxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRSxLQUFLO0VBQzlDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUM7RUFDcEIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO0lBQ2hDLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQztHQUN0QjtDQUNGOztBQ2hCTSxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUNyRCxBQUFPLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxLQUFLLElBQUk7RUFDdEMsUUFBUSxLQUFLLENBQUMsUUFBUSxDQUFDO0VBQ3ZCLE9BQU8sR0FBQyxTQUFNLEtBQVMsQ0FBSTtDQUM1QixDQUFDOztBQ0ZGLE1BQU0sZUFBZSxHQUFHLEtBQUssSUFBSSxDQUFDLEVBQUUsS0FBSztFQUN2QyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0VBQ3JCLElBQUksT0FBTyxLQUFLLEVBQUUsRUFBRTtJQUNsQixLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7R0FDMUIsTUFBTSxJQUFJLE9BQU8sS0FBSyxFQUFFLEVBQUU7SUFDekIsRUFBRSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztHQUMxQjtDQUNGLENBQUM7O0FBRUYsTUFBTSxTQUFTLEdBQUcsQ0FBQyxLQUFLLEtBQUs7O0VBRTNCLE1BQU0sU0FBUyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQTs7RUFFeEMsT0FBTyxHQUFDLFFBQUcsUUFBUSxFQUFDLElBQUksRUFBQyxTQUFTLEVBQUMsU0FBVSxFQUFFLE9BQU8sRUFBQyxLQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBQyxLQUFNLENBQUMsU0FBUyxFQUFDO0lBQ3JHLEtBQ08sQ0FBQyxTQUFTLEtBQUssTUFBTTtRQUN4QixHQUFDLEtBQUssSUFBQyxTQUFTLEVBQUMsV0FBWSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBQyxLQUFNLENBQUMsSUFBSSxJQUFJLE1BQU0sRUFBRSxLQUFLLEVBQUMsS0FBTSxDQUFDLFlBQVksRUFDakYsT0FBTyxFQUFDLEtBQU0sQ0FBQyxPQUFPLEVBQ3RCLE1BQU0sRUFBQyxLQUFNLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFDLENBQUU7VUFDdkMsR0FBQyxZQUFJLEVBQUMsS0FBTSxDQUFDLFlBQVksRUFBUTtHQUVwQztDQUNOLENBQUM7O0FBRUYsTUFBTSxZQUFZLEdBQUcsSUFBSSxJQUFJO0VBQzNCLE9BQU8sU0FBUyxDQUFDLENBQUMsS0FBSyxFQUFFLFFBQVEsS0FBSztJQUNwQyxNQUFNLFVBQVUsR0FBRyxDQUFDLEdBQUcsS0FBSyxNQUFNLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsR0FBRyxLQUFLLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuSSxNQUFNLFNBQVMsR0FBRyxrQkFBQyxDQUFBLFVBQVUsQ0FBQSxFQUFFLEtBQVEsQ0FBQyxDQUFDO0lBQ3pDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0dBQ3hCLENBQUMsQ0FBQztDQUNKLENBQUM7O0FBRUYsQUFBTyxNQUFNLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxDQUFDLEtBQUssS0FBSztFQUN0RCxNQUFNLENBQUMsVUFBVSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsR0FBRyxLQUFLLENBQUM7RUFDdkUsSUFBSSxZQUFZLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7RUFDcEMsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLEVBQUUsSUFBSTtJQUM3QixZQUFZLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDL0IsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0dBQ3RFLENBQUMsQ0FBQzs7RUFFSCxPQUFPLEdBQUMsU0FBUyxJQUFDLFNBQVMsRUFBQyxNQUFPLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxFQUFFLFVBQVUsRUFBQyxVQUFXLEVBQUUsU0FBUyxFQUFDLFNBQVUsRUFDbkYsWUFBWSxFQUFDLFlBQWEsRUFBRSxPQUFPLEVBQUMsT0FBUSxFQUFDLENBQUU7Q0FDbEUsQ0FBQyxDQUFDOztBQUVILEFBQU8sTUFBTSxpQkFBaUIsR0FBRyxZQUFZLENBQUMsQ0FBQyxLQUFLLEtBQUs7RUFDdkQsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFDO0VBQ3ZFLElBQUksWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0VBQ3JDLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxFQUFFLElBQUk7SUFDN0IsWUFBWSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQy9CLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztHQUNyRSxDQUFDLENBQUM7O0VBRUgsT0FBTyxHQUFDLFNBQVMsSUFBQyxTQUFTLEVBQUMsTUFBTyxDQUFDLFNBQVMsS0FBSyxJQUFJLENBQUMsRUFBRSxVQUFVLEVBQUMsVUFBVyxFQUFFLFNBQVMsRUFBQyxTQUFVLEVBQ25GLFlBQVksRUFBQyxZQUFhLEVBQUUsT0FBTyxFQUFDLE9BQVEsRUFBQyxDQUFFO0NBQ2xFLENBQUMsQ0FBQzs7QUFFSCxNQUFNLFlBQVksR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLEtBQUs7RUFDakUsT0FBTyxHQUFDLFlBQU8sU0FBUyxFQUFDLFdBQVksQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUMsZUFBZSxFQUFDLFFBQVEsRUFBQyxRQUFTLEVBQUUsTUFBTSxFQUFDLFVBQVcsQ0FBQyxLQUFLLENBQUMsRUFBQztJQUM1RyxHQUFDLFlBQU8sS0FBSyxFQUFDLE1BQU0sRUFBQyxRQUFRLEVBQUMsTUFBTyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUMsRUFBQyxNQUFJLENBQVM7SUFDdEUsR0FBQyxZQUFPLEtBQUssRUFBQyxRQUFRLEVBQUMsUUFBUSxFQUFDLE1BQU8sQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFDLEVBQUMsUUFBTSxDQUFTO0dBQ3JFO0NBQ1YsQ0FBQyxDQUFDOztBQUVILEFBQU8sTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLENBQUMsS0FBSyxLQUFLO0VBQ3BELE1BQU0sQ0FBQyxVQUFVLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQyxHQUFHLEtBQUssQ0FBQztFQUN2RSxJQUFJLFlBQVksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDOztFQUVqQyxNQUFNLFNBQVMsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7O0VBRXpDLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxFQUFFLElBQUk7SUFDOUIsWUFBWSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQy9CLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztHQUN0QyxDQUFDLENBQUM7RUFDSCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsTUFBTSxLQUFLLFFBQVEsR0FBRyxlQUFlLEdBQUcsYUFBYSxDQUFDOztFQUVqRixPQUFPLEdBQUMsUUFBRyxRQUFRLEVBQUMsSUFBSSxFQUFDLFNBQVMsRUFBQyxTQUFVLEVBQUUsT0FBTyxFQUFDLFVBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUMsU0FBVSxFQUFDO0lBQ3pGLFNBQ1csR0FBRyxHQUFDLFlBQVksSUFBQyxRQUFRLEVBQUMsUUFBUyxFQUFFLFVBQVUsRUFBQyxVQUFXLEVBQUUsTUFBTSxFQUFDLE1BQU8sRUFBQyxDQUFFO1FBQ3JGLEdBQUMsVUFBSyxLQUFLLEVBQUMsV0FBWSxFQUFDLEVBQUMsWUFBYSxDQUFRO0dBRWhELENBQUM7Q0FDUCxDQUFDLENBQUM7O0FBRUgsQUFBTyxNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsQ0FBQyxLQUFLLEtBQUs7RUFDbEQsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFDO0VBQ3ZFLElBQUksWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7RUFDL0IsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLEVBQUUsSUFBSTtJQUM3QixZQUFZLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDL0IsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO0dBQ3BDLENBQUMsQ0FBQztFQUNILE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxHQUFHLEdBQUcsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDOztFQUUxRCxNQUFNLFNBQVMsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7O0VBRXpDLE9BQU8sR0FBQyxRQUFHLFFBQVEsRUFBQyxJQUFJLEVBQUMsS0FBSyxFQUFDLFNBQVUsRUFBRSxTQUFTLEVBQUMsU0FBVSxFQUFFLE9BQU8sRUFBQyxVQUFXLENBQUMsSUFBSSxDQUFDLEVBQUM7SUFDekYsU0FDVyxHQUFHLEdBQUMsS0FBSyxJQUFDLFNBQVMsRUFBQyxXQUFZLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFDLFFBQVEsRUFBQyxHQUFHLEVBQUMsS0FBSyxFQUFDLEdBQUcsRUFBQyxLQUFLLEVBQUMsS0FBSyxFQUFDLFlBQWEsRUFDakYsTUFBTSxFQUFDLFVBQVcsQ0FBQyxLQUFLLENBQUMsRUFDekIsT0FBTyxFQUFDLE9BQVEsRUFBQyxDQUFFO1FBQ3BDLEdBQUMsWUFBSSxFQUFDLEdBQUMsVUFBSyxLQUFLLEVBQUMsQ0FBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBQyxZQUFZLEVBQUEsQ0FBUSxFQUFBLFlBQWEsRUFBUTtHQUV4RixDQUFDO0NBQ1AsQ0FBQyxDQUFDOztBQUVILEFBQU8sTUFBTSxpQkFBaUIsR0FBRyxZQUFZLENBQUMsQ0FBQyxLQUFLLEtBQUs7RUFDdkQsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFDO0VBQ3ZFLElBQUksWUFBWSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7O0VBRXBDLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxFQUFFLElBQUk7SUFDN0IsWUFBWSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQy9CLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0dBQ25ELENBQUMsQ0FBQzs7RUFFSCxPQUFPLEdBQUMsU0FBUyxJQUFDLElBQUksRUFBQyxNQUFNLEVBQUMsU0FBUyxFQUFDLE1BQU8sQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDLEVBQUUsVUFBVSxFQUFDLFVBQVcsRUFBRSxTQUFTLEVBQUMsU0FBVSxFQUMvRixZQUFZLEVBQUMsWUFBYSxDQUFDLFlBQVksRUFBRSxFQUFFLE9BQU8sRUFBQyxPQUFRLEVBQUMsQ0FBRTtDQUNqRixDQUFDLENBQUM7O0FDckhJLE1BQU0sVUFBVSxHQUFHLE9BQU8sR0FBQyxTQUFJLGFBQVcsRUFBQyxNQUFNLEVBQUMsS0FBSyxFQUFDLE1BQU0sRUFBQyxPQUFPLEVBQUMsV0FBVyxFQUFBO0VBQ3ZGLEdBQUM7SUFDQyxDQUFDLEVBQUMsNmdCQUE2Z0IsRUFBQSxDQUFRO0NBQ3JoQixDQUFDLENBQUM7O0FBRVIsQUFBTyxNQUFNLE9BQU8sR0FBRyxPQUFPLEdBQUMsU0FBSSxhQUFXLEVBQUMsTUFBTSxFQUFDLEtBQUssRUFBQyxNQUFNLEVBQUMsT0FBTyxFQUFDLFdBQVcsRUFBQTtFQUNwRixHQUFDLFVBQUssQ0FBQyxFQUFDLDBFQUEwRSxFQUFBLENBQVE7Q0FDdEYsQ0FBQyxDQUFDOztBQUVSLEFBQU8sTUFBTSxRQUFRLEdBQUcsT0FBTyxHQUFDLFNBQUksS0FBSyxFQUFDLE1BQU0sRUFBQyxPQUFPLEVBQUMsV0FBVyxFQUFBO0VBQ2xFLEdBQUMsVUFBSyxDQUFDLEVBQUMsOENBQThDLEVBQUEsQ0FBUTtDQUMxRCxDQUFDLENBQUM7O0FBRVIsQUFBTyxNQUFNLFdBQVcsR0FBRyxPQUFPLEdBQUMsU0FBSSxLQUFLLEVBQUMsTUFBTSxFQUFDLE9BQU8sRUFBQyxXQUFXLEVBQUE7RUFDckUsR0FBQyxVQUFLLENBQUMsRUFBQyxpQ0FBaUMsRUFBQSxDQUFRO0VBQ2pELEdBQUMsVUFBSyxDQUFDLEVBQUMscUJBQXFCLEVBQUEsQ0FBUTtFQUNyQyxHQUFDLFVBQUssQ0FBQyxFQUFDLHFCQUFxQixFQUFBLENBQVE7RUFDckMsR0FBQyxVQUFLLENBQUMsRUFBQyxvQkFBb0IsRUFBQSxDQUFRO0VBQ3BDLEdBQUMsVUFBSyxDQUFDLEVBQUMsa0JBQWtCLEVBQUEsQ0FBUTtDQUM5QixDQUFDLENBQUM7O0FBRVIsQUFBTyxNQUFNLFlBQVksR0FBRyxPQUFPLEdBQUMsU0FBSSxLQUFLLEVBQUMsTUFBTSxFQUFDLE9BQU8sRUFBQyxXQUFXLEVBQUE7RUFDdEUsR0FBQyxVQUFLLENBQUMsRUFBQyxpQ0FBaUMsRUFBQSxDQUFRO0VBQ2pELEdBQUMsVUFBSyxDQUFDLEVBQUMsb0JBQW9CLEVBQUEsQ0FBUTtFQUNwQyxHQUFDLFVBQUssQ0FBQyxFQUFDLG9CQUFvQixFQUFBLENBQVE7RUFDcEMsR0FBQyxVQUFLLENBQUMsRUFBQyxxQkFBcUIsRUFBQSxDQUFRO0VBQ3JDLEdBQUMsVUFBSyxDQUFDLEVBQUMsbUJBQW1CLEVBQUEsQ0FBUTtDQUMvQixDQUFDOztBQ3hCUCxNQUFNLGNBQWMsR0FBRyxLQUFLLEtBQUssQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNuRCxNQUFNLGNBQWMsR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLEtBQUs7RUFDNUMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDO0VBQ2xCLElBQUksT0FBTyxRQUFRLEtBQUssT0FBTyxPQUFPLEVBQUU7SUFDdEMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLEtBQUssT0FBTyxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0dBQ3RIO0VBQ0QsT0FBTyxNQUFNLENBQUM7Q0FDZixDQUFDO0FBQ0YsTUFBTSxVQUFVLEdBQUcsS0FBSyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUM7QUFDNUMsTUFBTSxPQUFPLEdBQUc7RUFDZCxNQUFNLEVBQUUsS0FBSyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7RUFDaEUsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztDQUMvRSxDQUFDO0FBQ0YsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMvRCxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsS0FBSyxJQUFJO0VBQ3ZDLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ2hELElBQUksU0FBUyxLQUFLLElBQUksRUFBRTtJQUN0QixTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7R0FDbkI7Q0FDRixDQUFDLENBQUM7O0FBRUgsTUFBTSxLQUFLLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztFQUM5RCxPQUFPLE9BQU8sQ0FBQyxNQUFNLEdBQUcsR0FBQyxhQUFLO0lBQzVCLE9BQ1MsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxHQUFDLFVBQUU7UUFDakMsR0FBQyxnQkFBZ0IsSUFBQyxTQUFTLEVBQUMsY0FBYyxFQUFDLE1BQU0sRUFBQyxLQUFNLEVBQUUsS0FBSyxFQUFDLEtBQU0sRUFBRSxLQUFLLEVBQUMsS0FBTSxFQUFDLENBQUU7UUFDdkYsR0FBQyxpQkFBaUIsSUFBQyxTQUFTLEVBQUMsZUFBZSxFQUFDLE1BQU0sRUFBQyxLQUFNLEVBQUUsS0FBSyxFQUFDLEtBQU0sRUFBRSxLQUFLLEVBQUMsS0FBTSxFQUFDLENBQUU7UUFDekYsR0FBQyxpQkFBaUIsSUFBQyxTQUFTLEVBQUMsZUFBZSxFQUFDLE1BQU0sRUFBQyxLQUFNLEVBQUUsS0FBSyxFQUFDLEtBQU0sRUFBRSxLQUFLLEVBQUMsS0FBTSxFQUFDLENBQUU7UUFDekYsR0FBQyxjQUFjLElBQUMsU0FBUyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sRUFBQyxLQUFNLEVBQUUsS0FBSyxFQUFDLEtBQU0sRUFBRSxLQUFLLEVBQUMsS0FBTSxFQUFDLENBQUU7UUFDOUYsR0FBQyxZQUFZLElBQUMsU0FBUyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sRUFBQyxLQUFNLEVBQUUsS0FBSyxFQUFDLEtBQU0sRUFBRSxLQUFLLEVBQUMsS0FBTSxFQUFDLENBQUU7UUFDMUYsR0FBQyxRQUFHLEtBQUssRUFBQyx3QkFBd0IsRUFBQyx3QkFBc0IsRUFBQyxRQUFRLEVBQUE7VUFDaEUsR0FBQyxZQUFPLFFBQVEsRUFBQyxJQUFJLEVBQUMsT0FBTyxFQUFDLE1BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFDO1lBQ2pELEdBQUMsVUFBSyxLQUFLLEVBQUMsaUJBQWlCLEVBQUEsRUFBQyxTQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFRO1lBQzNGLEdBQUMsT0FBTyxNQUFBLEVBQUU7V0FDSDtTQUNOO09BQ0YsQ0FBQztLQUVBLEdBQUcsR0FBQyxhQUFLO0lBQ2pCLEdBQUMsVUFBRTtNQUNELEdBQUMsUUFBRyxRQUFRLEVBQUMsSUFBSSxFQUFDLE9BQU8sRUFBQyxHQUFHLEVBQUEsRUFBQyx3Q0FBc0MsQ0FBSztLQUN0RTtLQUNHO0NBQ1gsQ0FBQyxDQUFDOztBQUVILE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxLQUFLO0VBQzlDLE9BQU8sR0FBQyxLQUFLLElBQUMsT0FBTyxFQUFDLEtBQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFDLE9BQVEsQ0FBQyxNQUFNLEVBQzlDLEtBQUssRUFBQyxPQUFRLENBQUMsS0FBSyxFQUFDLENBQUU7Q0FDdEMsQ0FBQzs7QUFFRixBQUFPLE1BQU0sVUFBVSxHQUFHLGtCQUFrQixDQUFDLG1CQUFtQixFQUFFLGNBQWMsRUFBRSxjQUFjLENBQUMsQ0FBQzs7QUNuRGxHLE1BQU1HLFNBQU8sR0FBRyxFQUFFLENBQUM7QUFDbkIsTUFBTUMsWUFBVSxHQUFHLEtBQUssS0FBSyxDQUFDLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztBQUNqRSxNQUFNLHFCQUFxQixHQUFHLE9BQU8sQ0FBQyxLQUFLLEVBQUVELFNBQU8sRUFBRUMsWUFBVSxDQUFDLENBQUM7O0FBRWxFLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxLQUFLO0VBQzNDLE1BQU0sU0FBUyxHQUFHLFlBQVksS0FBSyxJQUFJLEdBQUcsWUFBWSxHQUFHLEVBQUUsQ0FBQztFQUM1RCxNQUFNLE9BQU8sR0FBRyxZQUFZLEtBQUssSUFBSSxHQUFHLHNCQUFzQixHQUFHLGFBQWEsQ0FBQztFQUMvRSxPQUFPLEdBQUMsU0FBSSxFQUFFLEVBQUMsU0FBUyxFQUFDLFdBQVMsRUFBQyxXQUFXLEVBQUMsSUFBSSxFQUFDLE9BQU8sRUFBQyxLQUFLLEVBQUMsU0FBVSxFQUFDO0lBQzNFLE9BQVE7R0FDSixDQUFDO0NBQ1IsQ0FBQztBQUNGLEFBQU8sTUFBTSxjQUFjLEdBQUcscUJBQXFCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzs7QUNWdEUsTUFBTUQsU0FBTyxHQUFHO0VBQ2QsVUFBVSxFQUFFLENBQUMsQ0FBQyxTQUFBUixVQUFPLEVBQUUsU0FBUyxDQUFDLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxTQUFBQSxVQUFPLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ25HLENBQUM7QUFDRixNQUFNUyxZQUFVLEdBQUdDLE9BQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUMvQyxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsS0FBSyxFQUFFRixTQUFPLEVBQUVDLFlBQVUsQ0FBQyxDQUFDOzs7QUFHNUQsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLO0VBQzVCLElBQUksU0FBUyxLQUFLLEtBQUssRUFBRTtJQUN2QixPQUFPLEdBQUMsV0FBVyxNQUFBLEVBQUUsQ0FBQztHQUN2QixNQUFNLElBQUksU0FBUyxLQUFLLE1BQU0sRUFBRTtJQUMvQixPQUFPLEdBQUMsWUFBWSxNQUFBLEVBQUUsQ0FBQztHQUN4QixNQUFNO0lBQ0wsT0FBTyxHQUFDLFFBQVEsTUFBQSxFQUFFLENBQUM7R0FDcEI7Q0FDRixDQUFDOztBQUVGLE1BQU0sbUJBQW1CLElBQUksS0FBSyxJQUFJO0VBQ3BDLE1BQU0sQ0FBQyxhQUFhLEVBQUUsY0FBYyxHQUFHLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxFQUFFLFNBQUFULFVBQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDO0VBQzFGLE1BQU0sWUFBWSxHQUFHLGFBQWEsS0FBS0EsVUFBTyxHQUFHLENBQUMsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7RUFDeEYsTUFBTSxTQUFTLEdBQUcsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxLQUFLLGNBQWMsQ0FBQyxNQUFNLENBQUM7O0VBRTlELE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7RUFFOUYsT0FBTyxHQUFDLFlBQU8sUUFBUSxFQUFDLElBQUksRUFBQyxPQUFPLEVBQUMsVUFBVyxFQUFDO0lBQy9DLEdBQUMsVUFBSyxLQUFLLEVBQUMsaUJBQWlCLEVBQUEsRUFBQyxhQUFXLENBQU87SUFDaEQsR0FBQyxJQUFJLElBQUMsU0FBUyxFQUFDLGNBQWUsQ0FBQyxZQUFZLENBQUMsRUFBQyxDQUFFO0dBQ3pDO0NBQ1YsQ0FBQyxDQUFDOztBQUVILEFBQU8sTUFBTSxVQUFVLEdBQUcsZUFBZSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU87RUFDdkQsR0FBQyxtQkFBbUIsb0JBQUMsS0FBUyxFQUFFLEVBQUEsSUFBSSxFQUFDLE9BQVEsQ0FBQyxVQUFVLEdBQUMsQ0FBRSxDQUFDLENBQUM7O0FDL0IvRCxNQUFNUSxTQUFPLEdBQUc7RUFDZCxNQUFNLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNuRixDQUFDO0FBQ0YsTUFBTUMsWUFBVSxHQUFHQyxPQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDakQsTUFBTSxlQUFlLEdBQUcsS0FBSyxJQUFJLEtBQUssQ0FBQztBQUN2QyxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsS0FBSyxFQUFFRixTQUFPLEVBQUVDLFlBQVUsQ0FBQyxDQUFDOztBQUV2RCxNQUFNLFdBQVcsR0FBRyxDQUFDLEtBQUssTUFBTSxHQUFDLGFBQUs7RUFDcEMsR0FBQyxZQUFJLEVBQUMsS0FBTSxDQUFDLFFBQVEsRUFBUTtFQUM3QixHQUFDLFdBQU0sUUFBUSxFQUFDLEdBQUcsRUFBQyxJQUFJLEVBQUMsUUFBUSxFQUFDLE9BQU8sRUFBQyxLQUFNLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBQyxLQUFNLENBQUMsV0FBVyxFQUFDLENBQUU7Q0FDckYsQ0FBQyxDQUFDOztBQUVWLEFBQU8sTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSztFQUN0RCxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsRUFBRSxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztFQUNsRyxPQUFPLEtBQUssQ0FBQyxRQUFRLENBQUM7RUFDdEIsT0FBTyxHQUFDLE1BQUcsS0FBUztJQUNsQixHQUFDLFFBQUcsd0JBQXNCLEVBQUMsT0FBTyxFQUFBO01BQ2hDLEdBQUMsV0FBVyxJQUFDLFdBQVcsRUFBQywyQ0FBMkMsRUFBQyxPQUFPLEVBQUMsT0FBUSxFQUFDLEVBQUMsU0FBTyxDQUFjO0tBQ3pHO0dBQ0Y7Q0FDTixFQUFFLGVBQWUsRUFBRSxlQUFlLENBQUM7O0FDckJwQyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsS0FBSyxJQUFJO0VBQ3BDLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7RUFDdEMsSUFBSSxFQUFFLEtBQUssT0FBTyxFQUFFO0lBQ2xCLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3ZELElBQUksS0FBSyxFQUFFO01BQ1QsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3BDO0dBQ0Y7Q0FDRixDQUFDLENBQUM7O0FBRUgsTUFBTUQsU0FBTyxHQUFHO0VBQ2QsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFNLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7RUFDN0UsWUFBWSxFQUFFLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Q0FDekUsQ0FBQztBQUNGLE1BQU1DLFlBQVUsR0FBRyxLQUFLLEtBQUssQ0FBQyxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ3pHLE1BQU0saUJBQWlCLEdBQUcsT0FBTyxDQUFDLEtBQUssRUFBRUQsU0FBTyxFQUFFQyxZQUFVLENBQUMsQ0FBQzs7QUFFOUQsTUFBTSxhQUFhLEdBQUcsV0FBVyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUUsS0FBSztFQUNoRCxNQUFNLENBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxHQUFHLEtBQUssQ0FBQztFQUN6RCxNQUFNLEtBQUssR0FBRyxNQUFNO0lBQ2xCLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZCLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7R0FDN0QsQ0FBQztFQUNGLE1BQU0sUUFBUSxHQUFHLENBQUMsRUFBRSxLQUFLO0lBQ3ZCLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUM7SUFDdkIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztJQUNwQixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDdEQsWUFBWSxDQUFDO01BQ1gsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUk7UUFDL0IsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxJQUFJLFVBQVUsQ0FBQztPQUMzRyxDQUFDO0tBQ0gsQ0FBQyxDQUFDO0lBQ0gsRUFBRSxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBQ3BCLEtBQUssRUFBRSxDQUFDO0dBQ1QsQ0FBQztFQUNGLE1BQU0sTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ25FLE1BQU0sU0FBUyxHQUFHLENBQUMsRUFBRSxLQUFLO0lBQ3hCLElBQUksRUFBRSxDQUFDLElBQUksS0FBSyxRQUFRLElBQUksRUFBRSxDQUFDLE9BQU8sS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsS0FBSyxRQUFRLEVBQUU7TUFDcEUsS0FBSyxFQUFFLENBQUM7S0FDVDtHQUNGLENBQUM7O0VBRUYsTUFBTSxVQUFVLEdBQUcsUUFBUSxLQUFLLElBQUksQ0FBQztFQUNyQyxPQUFPLEdBQUMsUUFBRyxFQUFFLEVBQUMsTUFBTyxFQUFFLEtBQUssRUFBQyxZQUFZLEVBQUMsU0FBUyxFQUFDLFNBQVUsRUFBRSxvQkFBa0IsRUFBQyxVQUFXLEVBQ25GLGFBQVcsRUFBQyxNQUFPLENBQUMsVUFBVSxDQUFDLEVBQUM7SUFDekMsR0FBQyxRQUFHLE9BQU8sRUFBQyxHQUFHLEVBQUMsd0JBQXNCLEVBQUMsZUFBZSxFQUFBO01BQ3BELEdBQUMsVUFBSyxJQUFJLEVBQUMsS0FBTSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUMsUUFBUyxFQUFDO1FBQzFDLEtBQU0sQ0FBQyxRQUFRO1FBQ2YsR0FBQyxTQUFJLEtBQUssRUFBQyxpQkFBaUIsRUFBQTtVQUMxQixHQUFDLFlBQU8sUUFBUSxFQUFDLElBQUksRUFBQSxFQUFDLE9BQUssQ0FBUztTQUNoQztRQUNOLEdBQUMsT0FBRSxFQUFFLEVBQUMsTUFBTyxHQUFHLGNBQWMsRUFBQyxFQUFDLHFEQUFtRCxDQUFJO09BQ2xGO0tBQ0o7R0FDRjtDQUNOLENBQUMsQ0FBQzs7QUFFSCxNQUFNLFlBQVksR0FBRyxDQUFDLEtBQUssS0FBSztFQUM5QixNQUFNLENBQUMsYUFBYSxFQUFFLGdCQUFnQixFQUFFLGFBQWEsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUM7RUFDbEUsTUFBTSxvQkFBb0IsR0FBRyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDO0VBQ2hFLE1BQU0sVUFBVSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDekUsTUFBTSxPQUFPLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztFQUN0RCxNQUFNLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLElBQUksb0JBQW9CLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDbEcsT0FBTyxHQUFDLFlBQU8sZUFBYSxFQUFDLE1BQU0sRUFBQyxRQUFRLEVBQUMsSUFBSSxFQUFDLEtBQUssRUFBQyxRQUFTLEdBQUcsZUFBZSxHQUFHLEVBQUUsRUFBRSxlQUFhLEVBQUMsVUFBVyxFQUNwRyxPQUFPLEVBQUMsT0FBUSxFQUFDO0lBQzlCLEdBQUMsVUFBSyxLQUFLLEVBQUMsaUJBQWlCLEVBQUEsRUFBQyxvQkFBa0IsQ0FBTztJQUN2RCxHQUFDLFVBQVUsTUFBQSxFQUFFO0dBQ047Q0FDVixDQUFDOztBQUVGLEFBQU8sTUFBTSxrQkFBa0IsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLEtBQUssRUFBRSxPQUFPLEtBQUs7RUFDdEUsT0FBTyxHQUFDLFlBQVksb0JBQUMsS0FBUyxFQUFFLEVBQUEsZ0JBQWdCLEVBQUMsT0FBUSxDQUFDLGdCQUFnQixHQUFDLENBQUU7Q0FDOUUsQ0FBQyxDQUFDOztBQUVILEFBQU8sTUFBTSxTQUFTLEdBQUcsaUJBQWlCLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxLQUFLO0VBQzdELE9BQU8sR0FBQyxhQUFhLElBQUMsS0FBSyxFQUFDLEtBQU0sQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFDLEtBQU0sQ0FBQyxZQUFZLEtBQUssS0FBSyxDQUFDLEtBQUssRUFDaEUsZ0JBQWdCLEVBQUMsT0FBUSxDQUFDLGdCQUFnQixFQUFFLFlBQVksRUFBQyxPQUFRLENBQUMsWUFBWSxFQUFDOztJQUVuRyxLQUFNLENBQUMsUUFBUTtHQUNELENBQUM7Q0FDbEIsQ0FBQzs7QUM3RUYsTUFBTSxZQUFZLEdBQUcsQ0FBQyxLQUFLLEtBQUs7RUFDOUIsTUFBTSxDQUFDLGFBQWEsRUFBRSxjQUFjLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQzs7RUFFckYsT0FBTyxHQUFDLFFBQUcsS0FBSyxFQUFDLFNBQVUsRUFBRSx3QkFBc0IsRUFBQyxRQUFRLEVBQUE7SUFDMUQsUUFBUztJQUNULEdBQUMsU0FBSSxLQUFLLEVBQUMsbUJBQW1CLEVBQUE7TUFDNUIsR0FBQyxVQUFVLElBQUMsYUFBYSxFQUFDLGFBQWMsRUFBRSxjQUFjLEVBQUMsY0FBZSxFQUFDLENBQUU7TUFDM0UsR0FBQyxrQkFBa0IsSUFBQyxhQUFhLEVBQUMsYUFBYyxFQUFDLENBQUU7S0FDL0M7R0FDSDtDQUNOLENBQUM7O0FBRUYsQUFBTyxNQUFNLE9BQU8sR0FBRyxNQUFNOztFQUUzQixPQUFPLEdBQUMsYUFBSztFQUNiLEdBQUMsU0FBUyxJQUFDLEtBQUssRUFBQyxZQUFZLEVBQUEsQ0FBRTtFQUMvQixHQUFDLFVBQUU7SUFDRCxHQUFDLFlBQVksSUFBQyxTQUFTLEVBQUMsY0FBYyxFQUFDLGFBQWEsRUFBQyxXQUFXLEVBQ2xELGNBQWMsRUFBQyxDQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLEVBQUMsRUFBQyxTQUFPLENBQWU7SUFDN0UsR0FBQyxZQUFZLElBQUMsU0FBUyxFQUFDLGVBQWUsRUFBQyxhQUFhLEVBQUMsWUFBWSxFQUFBLEVBQUMsTUFBSSxDQUFlO0lBQ3RGLEdBQUMsWUFBWSxJQUFDLFNBQVMsRUFBQyxlQUFlLEVBQUMsY0FBYyxFQUFDLENBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxFQUN6RCxhQUFhLEVBQUMsV0FBVyxFQUFBLEVBQUMsZUFBYSxDQUFlO0lBQ3BFLEdBQUMsWUFBWSxJQUFDLFNBQVMsRUFBQyx1QkFBdUIsRUFBQyxhQUFhLEVBQUMsUUFBUSxFQUFBLEVBQUMsUUFBTSxDQUFlO0lBQzVGLEdBQUMsWUFBWSxJQUFDLFNBQVMsRUFBQyxxQkFBcUIsRUFBQyxhQUFhLEVBQUMsTUFBTSxFQUFBLEVBQUMsTUFBSSxDQUFlO0lBQ3RGLEdBQUMsUUFBRyxvQkFBa0IsRUFBQyxJQUFLLEVBQUUsS0FBSyxFQUFDLHdCQUF3QixFQUFBLENBQU07R0FDL0Q7RUFDTCxHQUFDLFNBQVMsSUFBQyxLQUFLLEVBQUMsV0FBVyxFQUFBO0lBQzFCLEdBQUMsYUFBSztNQUNKLEdBQUMsWUFBSSxFQUFDLG1CQUFpQixFQUFPO01BQzlCLEdBQUMsV0FBTSxrQkFBZ0IsRUFBQyw4QkFBOEIsRUFBQyxTQUFTLEVBQUMsV0FBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQ2xGLElBQUksRUFBQyxNQUFNLEVBQ1gsV0FBVyxFQUFDLGdDQUFnQyxFQUFBLENBQUU7S0FDL0M7R0FDRTtFQUNaLEdBQUMsU0FBUyxJQUFDLEtBQUssRUFBQyxZQUFZLEVBQUE7SUFDM0IsR0FBQyxhQUFLO01BQ0osR0FBQyxZQUFJLEVBQUMsZ0JBQWMsRUFBTztNQUMzQixHQUFDLFdBQU0sU0FBUyxFQUFDLFdBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBQyxNQUFNLEVBQUMsV0FBVyxFQUFDLDZCQUE2QixFQUFBLENBQUU7S0FDNUY7R0FDRTtFQUNaLEdBQUMsU0FBUyxJQUFDLEtBQUssRUFBQyxXQUFXLEVBQUE7SUFDMUIsR0FBQyxhQUFLO01BQ0osR0FBQyxZQUFJLEVBQUMsYUFBVyxFQUFPO01BQ3hCLEdBQUMsV0FBTSxTQUFTLEVBQUMsV0FBWSxDQUFDLEVBQUUsQ0FBQyxFQUFFLGVBQWEsRUFBQyxJQUFJLEVBQUMsSUFBSSxFQUFDLE1BQU0sRUFBQSxDQUFFO0tBQzdEO0dBQ0U7RUFDWixHQUFDLFNBQVMsSUFBQyxLQUFLLEVBQUMsUUFBUSxFQUFBO0lBQ3ZCLEdBQUMsYUFBSztNQUNKLEdBQUMsWUFBSSxFQUFDLFlBQVUsRUFBTztNQUN2QixHQUFDLFlBQU8sU0FBUyxFQUFDLFdBQVksQ0FBQyxFQUFFLENBQUMsRUFBRSxlQUFhLEVBQUMsSUFBSSxFQUFBO1FBQ3BELEdBQUMsWUFBTyxLQUFLLEVBQUMsRUFBRSxFQUFBLEVBQUMsR0FBQyxDQUFTO1FBQzNCLEdBQUMsWUFBTyxLQUFLLEVBQUMsUUFBUSxFQUFBLEVBQUMsUUFBTSxDQUFTO1FBQ3RDLEdBQUMsWUFBTyxLQUFLLEVBQUMsTUFBTSxFQUFBLEVBQUMsTUFBSSxDQUFTO09BQzNCO0tBQ0g7R0FDRTtFQUNaLEdBQUMsU0FBUyxJQUFDLEtBQUssRUFBQyxNQUFNLEVBQUE7SUFDckIsR0FBQyxhQUFLO01BQ0osR0FBQyxZQUFJLEVBQUMsY0FBWSxFQUFPO01BQ3pCLEdBQUMsV0FBTSxTQUFTLEVBQUMsV0FBWSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBQyxLQUFLLEVBQUMsR0FBRyxFQUFDLEtBQUssRUFBQyxJQUFJLEVBQUMsR0FBRyxFQUFDLElBQUksRUFBQyxPQUFPLEVBQUMsZUFBYSxFQUFDLElBQUksRUFBQSxDQUFFO0tBQzNGO0lBQ1IsR0FBQyxhQUFLO01BQ0osR0FBQyxZQUFJLEVBQUMsZUFBYSxFQUFPO01BQzFCLEdBQUMsV0FBTSxTQUFTLEVBQUMsV0FBWSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBQyxLQUFLLEVBQUMsR0FBRyxFQUFDLEtBQUssRUFBQyxJQUFJLEVBQUMsR0FBRyxFQUFDLElBQUksRUFBQyxPQUFPLEVBQUMsZUFBYSxFQUFDLElBQUksRUFBQSxDQUFFO0tBQzNGO0dBQ0U7R0FDSjs7O0FDdEVWLE1BQU1ELFNBQU8sR0FBRztFQUNkLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEtBQUssS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzdFLENBQUM7QUFDRixNQUFNQyxZQUFVLEdBQUcsS0FBSyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDMUMsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsS0FBSyxFQUFFRCxTQUFPLEVBQUVDLFlBQVUsQ0FBQyxDQUFDOztBQUUvRCxNQUFNLE9BQU8sR0FBRyxDQUFDLEtBQUssS0FBSztFQUN6QixNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsR0FBRyxLQUFLLENBQUM7RUFDMUMsUUFBUSxHQUFDLFdBQUcsRUFBQyxpQkFBZSxFQUFBLEdBQUMsY0FBTSxFQUFDLENBQUUsSUFBSSxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksYUFBYSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQVUsRUFBQSxLQUM1RixFQUFBLEdBQUMsY0FBTSxFQUFDLElBQUssQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsRUFBVSxFQUFBLE1BQUksRUFBQSxHQUFDLGNBQU0sRUFBQyxhQUFjLEVBQVUsRUFBQSxpQkFDN0YsRUFBTSxFQUFFO0NBQ1QsQ0FBQzs7QUFFRixNQUFNLFFBQVEsR0FBRyxLQUFLLElBQUk7RUFDeEIsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUM7RUFDNUIsTUFBTSxjQUFjLEdBQUcsQ0FBQyxFQUFFLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQ2pFLE9BQU8sR0FBQyxXQUFHO0lBQ1QsR0FBQyxhQUFLLEVBQUMsWUFFTCxFQUFBLEdBQUMsWUFBTyxRQUFRLEVBQUMsSUFBSSxFQUFDLFFBQVEsRUFBQyxjQUFlLEVBQUUsSUFBSSxFQUFDLFVBQVUsRUFBQTtRQUM3RCxHQUFDLFlBQU8sUUFBUSxFQUFDLElBQUssSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFDLElBQUksRUFBQSxFQUFDLFVBQVEsQ0FBUztRQUMxRCxHQUFDLFlBQU8sUUFBUSxFQUFDLElBQUssSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFDLElBQUksRUFBQSxFQUFDLFVBQVEsQ0FBUztRQUMxRCxHQUFDLFlBQU8sUUFBUSxFQUFDLElBQUssSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFDLElBQUksRUFBQSxFQUFDLFVBQVEsQ0FBUztPQUNuRDtLQUNIO0dBQ0o7Q0FDUCxDQUFDOztBQUVGLE1BQU0sS0FBSyxHQUFHLENBQUMsS0FBSyxLQUFLO0VBQ3ZCLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUM7RUFDakQsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0VBQ3ZELE1BQU0sY0FBYyxHQUFHLE1BQU0sS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7RUFDbkQsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDO0VBQ3RDLE1BQU0sY0FBYyxHQUFHLENBQUMsYUFBYSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7O0VBRTVEO0lBQ0UsR0FBQyxXQUFHO01BQ0YsR0FBQyxZQUFPLFFBQVEsRUFBQyxJQUFJLEVBQUMsT0FBTyxFQUFDLGtCQUFtQixFQUFFLFFBQVEsRUFBQyxrQkFBbUIsRUFBQyxFQUFDLFVBRWpGLENBQVM7TUFDVCxHQUFDLGFBQUssRUFBQyxVQUFRLEVBQUEsSUFBSyxJQUFJLENBQUMsRUFBQyxHQUFDLEVBQVE7TUFDbkMsR0FBQyxZQUFPLFFBQVEsRUFBQyxJQUFJLEVBQUMsT0FBTyxFQUFDLGNBQWUsRUFBRSxRQUFRLEVBQUMsY0FBZSxFQUFDLEVBQUMsTUFFekUsQ0FBUztLQUNMO0lBQ047Q0FDSCxDQUFDOztBQUVGLE1BQU0sYUFBYSxHQUFHLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2xELE1BQU0sVUFBVSxHQUFHLGtCQUFrQixDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSyxHQUFDLEtBQUssb0JBQUMsS0FBUyxFQUFFLEVBQUEsS0FBSyxFQUFDLE9BQVEsQ0FBQyxLQUFLLEdBQUMsQ0FBRSxDQUFDLENBQUM7QUFDckcsTUFBTSxjQUFjLEdBQUcsa0JBQWtCLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxLQUFLLEdBQUMsUUFBUSxvQkFBQyxLQUFTLEVBQUUsRUFBQSxLQUFLLEVBQUMsT0FBUSxDQUFDLEtBQUssR0FBQyxDQUFFLENBQUMsQ0FBQzs7QUFFNUcsQUFBTyxNQUFNLE1BQU0sR0FBRyxNQUFNLEdBQUMsYUFBSztBQUNsQyxHQUFDLFVBQUU7RUFDRCxHQUFDLFFBQUcsT0FBTyxFQUFDLEdBQUcsRUFBQTtJQUNiLEdBQUMsYUFBYSxNQUFBLEVBQUU7R0FDYjtFQUNMLEdBQUMsUUFBRyxPQUFPLEVBQUMsR0FBRyxFQUFDLHdCQUFzQixFQUFDLHVCQUF1QixFQUFDLE9BQU8sRUFBQyxHQUFHLEVBQUE7SUFDeEUsR0FBQyxVQUFVLE1BQUEsRUFBRTtHQUNWO0VBQ0wsR0FBQyxRQUFHLHdCQUFzQixFQUFDLFFBQVEsRUFBQTtJQUNqQyxHQUFDLGNBQWMsTUFBQSxFQUFFO0dBQ2Q7Q0FDRjtDQUNHLENBQUM7O0FDbkVGLE1BQU0sYUFBYSxHQUFHLENBQUMsT0FBTyxFQUFFLFFBQVEsS0FBSyxPQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLElBQUksR0FBRyxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDbEosQUFBTyxNQUFNLHFCQUFxQixHQUFHLHdCQUF3QixDQUFDO0FBQzlELEFBQU8sTUFBTSxpQkFBaUIsR0FBRyxvQkFBb0IsQ0FBQztBQUN0RCxBQUFPLE1BQU0sT0FBTyxHQUFHLEdBQUcsSUFBSSxNQUFNLEdBQUcsQ0FBQyxBQUN4QyxBQUFPOztBQ0dBLFNBQVMsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDLFdBQVcsRUFBRSxZQUFZLENBQUMsRUFBRTtFQUNqRSxNQUFNLEdBQUcsR0FBRyxhQUFhLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0VBQ2hELE1BQU0sS0FBSyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztFQUN0RCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0VBQ3JDLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztFQUNsQyxPQUFPO0lBQ0wsZUFBZSxFQUFFLFFBQVE7SUFDekIsZ0JBQWdCLEVBQUUsUUFBUTtJQUMxQixJQUFJLEVBQUU7TUFDSixPQUFPLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7S0FDOUQ7SUFDRCxRQUFRLEVBQUU7TUFDUixPQUFPLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7S0FDOUQ7R0FDRjtDQUNGOztBQUVELEFBQU8sU0FBUyxRQUFRLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRTtFQUMxQyxNQUFNLEdBQUcsR0FBRyxXQUFXLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0VBQzFDLE9BQU87SUFDTCxRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVE7SUFDdEIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO0dBQ2Y7Q0FDRjs7QUFFRCxBQUFPLFNBQVMsYUFBYSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUU7RUFDL0MsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7RUFDakUsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0VBQ2pFLE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBRyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztFQUMvRCxNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDO0VBQ3hDLE1BQU0sV0FBVyxHQUFHLE9BQU8sS0FBSyxXQUFXLENBQUM7RUFDNUMsT0FBTztJQUNMLGdCQUFnQixFQUFFO01BQ2hCLE9BQU8sV0FBVyxHQUFHLE9BQU8sR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDOUM7SUFDRCxlQUFlLEVBQUU7TUFDZixPQUFPLFdBQVcsR0FBRyxPQUFPLEdBQUcsVUFBVSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQztLQUM5RDtJQUNELElBQUksRUFBRTtNQUNKLE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7TUFDMUMsSUFBSSxXQUFXLElBQUksS0FBSyxHQUFHLENBQUMsR0FBRyxhQUFhLEVBQUU7UUFDNUMsT0FBTyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO09BQzlCLE1BQU07UUFDTCxPQUFPLFdBQVcsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7T0FDakQ7S0FDRjtJQUNELFFBQVEsRUFBRTtNQUNSLE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7TUFDMUMsSUFBSSxXQUFXLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtRQUM1QixPQUFPLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7T0FDOUIsTUFBTTtRQUNMLE9BQU8sV0FBVyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztPQUNyRDtLQUNGO0dBQ0Y7Q0FDRjs7QUFFRCxBQUFPLFNBQVMsVUFBVSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUU7RUFDdkMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFO0lBQ2YsT0FBTyxJQUFJLENBQUM7R0FDYixNQUFNLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO0lBQzdDLE9BQU8sUUFBUSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztHQUM5QixNQUFNLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUU7SUFDdEYsT0FBTyxhQUFhLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0dBQ25DLE1BQU07SUFDTCxPQUFPLFdBQVcsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7R0FDakM7OztBQ3ZFSSxTQUFTLFVBQVUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsV0FBVyxHQUFHLElBQUksRUFBRSxZQUFZLEdBQUcsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFO0VBQzFGLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztFQUNyRCxNQUFNLEtBQUssR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7RUFDMUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztFQUNwQyxPQUFPO0lBQ0wsUUFBUSxFQUFFO01BQ1IsT0FBTyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO0tBQzVEO0lBQ0QsSUFBSSxFQUFFO01BQ0osT0FBTyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO0tBQzVEO0lBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQztNQUNULE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUM7S0FDdEQ7R0FDRixDQUFDO0NBQ0g7O0FBRUQsQUFBTyxTQUFTLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtFQUMvQyxNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztFQUNuRCxPQUFPO0lBQ0wsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO0lBQzFCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtHQUNuQixDQUFDO0NBQ0g7O0FBRUQsQUFBTyxTQUFTLFNBQVMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDLEVBQUUsRUFBRTtFQUN2RSxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7SUFDbkIsT0FBTyxJQUFJLENBQUM7R0FDYjtFQUNELE1BQU0sQ0FBQyxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7RUFDN0MsT0FBTyxDQUFDLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUU7TUFDeEQsV0FBVztNQUNYLFlBQVk7S0FDYixDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQzs7O0FDL0J4RCxTQUFTLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO0VBQ3RDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLEdBQUcsT0FBTyxDQUFDO0VBQzVDLE9BQU87SUFDTCxTQUFTLENBQUMsTUFBTSxDQUFDO01BQ2YsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztNQUN6QyxJQUFJLE9BQU8sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO01BQy9DLE9BQU8sT0FBTyxLQUFLLElBQUksSUFBSSxPQUFPLENBQUMsZ0JBQWdCLEtBQUssS0FBSyxDQUFDLEVBQUU7UUFDOUQsT0FBTyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7T0FDL0M7TUFDRCxPQUFPLE9BQU8sS0FBSyxJQUFJLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixFQUFFLEdBQUcsTUFBTSxDQUFDO0tBQy9EO0lBQ0QsUUFBUSxDQUFDLE1BQU0sQ0FBQztNQUNkLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7TUFDekMsSUFBSSxPQUFPLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztNQUNuRCxPQUFPLE9BQU8sS0FBSyxJQUFJLElBQUksT0FBTyxDQUFDLGVBQWUsS0FBSyxLQUFLLENBQUMsRUFBRTtRQUM3RCxPQUFPLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztPQUNuRDtNQUNELE9BQU8sT0FBTyxLQUFLLElBQUksR0FBRyxPQUFPLENBQUMsZUFBZSxFQUFFLEdBQUcsTUFBTSxDQUFDO0tBQzlEO0lBQ0QsTUFBTSxDQUFDLE1BQU0sQ0FBQztNQUNaLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7TUFDdEQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO01BQzdELE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO01BQ2pELElBQUksTUFBTSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO01BQ3RELE9BQU8sTUFBTSxLQUFLLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxFQUFFO1FBQ2hELE1BQU0sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztPQUN0RDs7TUFFRCxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7UUFDbkIsT0FBTyxNQUFNLENBQUM7T0FDZjs7TUFFRCxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztNQUNwRSxJQUFJLE9BQU8sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztNQUMzRCxPQUFPLE9BQU8sS0FBSyxJQUFJLElBQUksT0FBTyxDQUFDLGdCQUFnQixLQUFLLEtBQUssQ0FBQyxJQUFJLFVBQVUsR0FBRyxDQUFDLEVBQUU7UUFDaEYsVUFBVSxFQUFFLENBQUM7UUFDYixPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7T0FDeEQ7TUFDRCxPQUFPLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0tBQ25DO0lBQ0QsUUFBUSxDQUFDLE1BQU0sQ0FBQztNQUNkLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7TUFDdEQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO01BQzdELE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO01BQ2pELElBQUksTUFBTSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO01BQ2xELE9BQU8sTUFBTSxLQUFLLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxFQUFFO1FBQ2hELE1BQU0sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztPQUNsRDs7TUFFRCxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7UUFDbkIsT0FBTyxNQUFNLENBQUM7T0FDZjs7TUFFRCxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztNQUNwRSxJQUFJLE9BQU8sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztNQUMzRCxPQUFPLE9BQU8sS0FBSyxJQUFJLElBQUksT0FBTyxDQUFDLGdCQUFnQixLQUFLLEtBQUssQ0FBQyxJQUFJLFVBQVUsR0FBRyxDQUFDLEVBQUU7UUFDaEYsVUFBVSxFQUFFLENBQUM7UUFDYixPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7T0FDeEQ7TUFDRCxPQUFPLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0tBQ25DO0dBQ0Y7OztBQy9ESCxlQUFlLFVBQVUsSUFBSSxFQUFFLENBQUMsV0FBVyxHQUFHLElBQUksRUFBRSxZQUFZLEdBQUcsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFO0VBQzlFLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQztFQUNyQixNQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUM7O0VBRXRELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsS0FBSztJQUN0RCxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUM7SUFDbkIsSUFBSSxPQUFPLEtBQUssRUFBRSxFQUFFO01BQ2xCLE9BQU8sR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQy9CLE1BQU0sSUFBSSxPQUFPLEtBQUssRUFBRSxFQUFFO01BQ3pCLE9BQU8sR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQzdCLE1BQU0sSUFBSSxPQUFPLEtBQUssRUFBRSxFQUFFO01BQ3pCLE9BQU8sR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ2hDLE1BQU0sSUFBSSxPQUFPLEtBQUssRUFBRSxFQUFFO01BQ3pCLE9BQU8sR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQy9COztJQUVELElBQUksT0FBTyxLQUFLLElBQUksRUFBRTtNQUNwQixPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7TUFDaEIsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO1FBQ3RCLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO09BQzFDO01BQ0QsT0FBTyxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7TUFDdEMsU0FBUyxHQUFHLE9BQU8sQ0FBQztLQUNyQjtHQUNGLENBQUMsQ0FBQzs7O0FDbEJMLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxDQUFDLElBQUk7RUFDekIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7RUFDekMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Q0FDeEMsQ0FBQyxDQUFDOztBQUVILE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQztFQUN4QixHQUFDLFNBQUksRUFBRSxFQUFDLGlCQUFpQixFQUFBO0lBQ3ZCLEdBQUMsY0FBYyxNQUFBLEVBQUU7SUFDakIsR0FBQyxhQUFLO01BQ0osR0FBQyxPQUFPLE1BQUEsRUFBRTtNQUNWLEdBQUMsVUFBVSxNQUFBLEVBQUU7TUFDYixHQUFDLE1BQU0sTUFBQSxFQUFFO0tBQ0g7R0FDSixDQUFDLENBQUM7O0FBRVYsS0FBSyxDQUFDLFdBQVcsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQzs7In0=
