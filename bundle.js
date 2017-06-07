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
var connect = (store, actions = {}, sliceState = identity) =>
  (comp, mapStateToProp = identity, shouldUpate = (a, b) => isDeepEqual(a, b) === false) =>
    (initProp) => {
      let componentProps = initProp;
      let updateFunc, previousStateSlice, unsubscriber;

      const wrapperComp = (props, ...args) => {
        return comp(Object.assign(props, mapStateToProp(sliceState(store.getState()))), actions, ...args);
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
  );
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

  return h( InputCell, { isEditing: String(isEditing === true), toggleEdit: toggleEdit, className: className, currentValue: currentValue, onInput: onInput });
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
  return h( FilterButton, Object.assign({}, props, { toggleFilterMenu: actions.toggleFilterMenu }));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJsaWIvaC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCJsaWIvdXRpbC5qcyIsImxpYi9kb21VdGlsLmpzIiwibGliL3RyYXZlcnNlLmpzIiwibGliL3RyZWUuanMiLCJsaWIvdXBkYXRlLmpzIiwibGliL2xpZmVDeWNsZXMuanMiLCJsaWIvd2l0aFN0YXRlLmpzIiwibGliL2VsbS5qcyIsImxpYi9jb25uZWN0LmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLW9wZXJhdG9ycy9pbmRleC5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvaW5kZXguanMiLCJleGFtcGxlcy9zbWFydC10YWJsZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc29ydC9pbmRleC5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1maWx0ZXIvaW5kZXguanMiLCJleGFtcGxlcy9zbWFydC10YWJsZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc2VhcmNoL2luZGV4LmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3NsaWNlLmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWV2ZW50cy9pbmRleC5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9ldmVudHMuanMiLCJleGFtcGxlcy9zbWFydC10YWJsZS9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy90YWJsZS5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy90YWJsZS5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL2luZGV4LmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNydWQvY3J1ZC5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jcnVkL2luZGV4LmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvbGliL3JlZHV4U21hcnRUYWJsZS5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL2xpYi9zdG9yZS5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL2NvbXBvbmVudHMvaGVscGVyLmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvY29tcG9uZW50cy9pbnB1dHMuanMiLCJleGFtcGxlcy9zbWFydC10YWJsZS9jb21wb25lbnRzL2VkaXRhYmxlQ2VsbC5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL2NvbXBvbmVudHMvaWNvbnMuanMiLCJleGFtcGxlcy9zbWFydC10YWJsZS9jb21wb25lbnRzL3Rib2R5LmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvY29tcG9uZW50cy9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvY29tcG9uZW50cy9zb3J0LmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvY29tcG9uZW50cy9zZWFyY2guanMiLCJleGFtcGxlcy9zbWFydC10YWJsZS9jb21wb25lbnRzL2ZpbHRlci5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL2NvbXBvbmVudHMvaGVhZGVycy5qcyIsImV4YW1wbGVzL3NtYXJ0LXRhYmxlL2NvbXBvbmVudHMvZm9vdGVyLmpzIiwiLi4vc21hcnQtdGFibGUta2V5Ym9hcmQvbGliL3V0aWwuanMiLCIuLi9zbWFydC10YWJsZS1rZXlib2FyZC9saWIvY2VsbC5qcyIsIi4uL3NtYXJ0LXRhYmxlLWtleWJvYXJkL2xpYi9yb3cuanMiLCIuLi9zbWFydC10YWJsZS1rZXlib2FyZC9saWIva2V5Z3JpZC5qcyIsIi4uL3NtYXJ0LXRhYmxlLWtleWJvYXJkL2luZGV4LmpzIiwiZXhhbXBsZXMvc21hcnQtdGFibGUvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9LFxuICBsaWZlQ3ljbGU6IDBcbn0pO1xuXG4vKipcbiAqIFRyYW5zZm9ybSBoeXBlcnNjcmlwdCBpbnRvIHZpcnR1YWwgZG9tIG5vZGVcbiAqIEBwYXJhbSBub2RlVHlwZSB7RnVuY3Rpb24sIFN0cmluZ30gLSB0aGUgSFRNTCB0YWcgaWYgc3RyaW5nLCBhIGNvbXBvbmVudCBvciBjb21iaW5hdG9yIG90aGVyd2lzZVxuICogQHBhcmFtIHByb3BzIHtPYmplY3R9IC0gdGhlIGxpc3Qgb2YgcHJvcGVydGllcy9hdHRyaWJ1dGVzIGFzc29jaWF0ZWQgdG8gdGhlIHJlbGF0ZWQgbm9kZVxuICogQHBhcmFtIGNoaWxkcmVuIC0gdGhlIHZpcnR1YWwgZG9tIG5vZGVzIHJlbGF0ZWQgdG8gdGhlIGN1cnJlbnQgbm9kZSBjaGlsZHJlblxuICogQHJldHVybnMge09iamVjdH0gLSBhIHZpcnR1YWwgZG9tIG5vZGVcbiAqL1xuZXhwb3J0IGRlZmF1bHQgIGZ1bmN0aW9uIGggKG5vZGVUeXBlLCBwcm9wcywgLi4uY2hpbGRyZW4pIHtcbiAgY29uc3QgZmxhdENoaWxkcmVuID0gY2hpbGRyZW4ucmVkdWNlKChhY2MsIGNoaWxkKSA9PiB7XG4gICAgY29uc3QgY2hpbGRyZW5BcnJheSA9IEFycmF5LmlzQXJyYXkoY2hpbGQpID8gY2hpbGQgOiBbY2hpbGRdO1xuICAgIHJldHVybiBhY2MuY29uY2F0KGNoaWxkcmVuQXJyYXkpO1xuICB9LCBbXSlcbiAgICAubWFwKGNoaWxkID0+IHtcbiAgICAgIC8vIG5vcm1hbGl6ZSB0ZXh0IG5vZGUgdG8gaGF2ZSBzYW1lIHN0cnVjdHVyZSB0aGFuIHJlZ3VsYXIgZG9tIG5vZGVzXG4gICAgICBjb25zdCB0eXBlID0gdHlwZW9mIGNoaWxkO1xuICAgICAgcmV0dXJuIHR5cGUgPT09ICdvYmplY3QnIHx8IHR5cGUgPT09ICdmdW5jdGlvbicgPyBjaGlsZCA6IGNyZWF0ZVRleHRWTm9kZShjaGlsZCk7XG4gICAgfSk7XG5cbiAgaWYgKHR5cGVvZiBub2RlVHlwZSAhPT0gJ2Z1bmN0aW9uJykgey8vcmVndWxhciBodG1sL3RleHQgbm9kZVxuICAgIHJldHVybiB7XG4gICAgICBub2RlVHlwZSxcbiAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgIGNoaWxkcmVuOiBmbGF0Q2hpbGRyZW4sXG4gICAgICBsaWZlQ3ljbGU6IDBcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBmbGF0Q2hpbGRyZW59LCBwcm9wcyk7XG4gICAgY29uc3QgY29tcCA9IG5vZGVUeXBlKGZ1bGxQcm9wcyk7XG4gICAgcmV0dXJuIHR5cGVvZiBjb21wICE9PSAnZnVuY3Rpb24nID8gY29tcCA6IGgoY29tcCwgcHJvcHMsIC4uLmZsYXRDaGlsZHJlbik7IC8vZnVuY3Rpb25hbCBjb21wIHZzIGNvbWJpbmF0b3IgKEhPQylcbiAgfVxufTsiLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgbmV4dFRpY2sgPSBmbiA9PiBzZXRUaW1lb3V0KGZuLCAwKTtcblxuZXhwb3J0IGNvbnN0IHBhaXJpZnkgPSBob2xkZXIgPT4ga2V5ID0+IFtrZXksIGhvbGRlcltrZXldXTtcblxuZXhwb3J0IGNvbnN0IGlzU2hhbGxvd0VxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgYUtleXMgPSBPYmplY3Qua2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBPYmplY3Qua2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KChrKSA9PiBhW2tdID09PSBiW2tdKTtcbn07XG5cbmNvbnN0IG93bktleXMgPSBvYmogPT4gT2JqZWN0LmtleXMob2JqKS5maWx0ZXIoayA9PiBvYmouaGFzT3duUHJvcGVydHkoaykpO1xuXG5leHBvcnQgY29uc3QgaXNEZWVwRXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCB0eXBlID0gdHlwZW9mIGE7XG5cbiAgLy9zaG9ydCBwYXRoKHMpXG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gdHlwZW9mIGIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gYSA9PT0gYjtcbiAgfVxuXG4gIC8vIG9iamVjdHMgLi4uXG4gIGlmIChhID09PSBudWxsIHx8IGIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xuICAgIHJldHVybiBhLmxlbmd0aCAmJiBiLmxlbmd0aCAmJiBhLmV2ZXJ5KChpdGVtLCBpKSA9PiBpc0RlZXBFcXVhbChhW2ldLCBiW2ldKSk7XG4gIH1cblxuICBjb25zdCBhS2V5cyA9IG93bktleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gb3duS2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KGsgPT4gaXNEZWVwRXF1YWwoYVtrXSwgYltrXSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGlkZW50aXR5ID0gYSA9PiBhO1xuXG5leHBvcnQgY29uc3Qgbm9vcCA9IF8gPT4ge1xufTtcbiIsImltcG9ydCB7dGFwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCBTVkdfTlAgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuXG5jb25zdCB1cGRhdGVEb21Ob2RlRmFjdG9yeSA9IChtZXRob2QpID0+IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBwYWlyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZVttZXRob2RdKC4uLnBhaXIpO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IHJlbW92ZUV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ3JlbW92ZUV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBhZGRFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdhZGRFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3Qgc2V0QXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKChkb21Ob2RlKSA9PiB7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBpdGVtcy5maWx0ZXIoKFtrZXksIHZhbHVlXSkgPT4gdHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nKTtcbiAgZm9yIChsZXQgW2tleSwgdmFsdWVdIG9mIGF0dHJpYnV0ZXMpIHtcbiAgICB2YWx1ZSA9PT0gZmFsc2UgPyBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShrZXkpIDogZG9tTm9kZS5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZSk7XG4gIH1cbn0pO1xuZXhwb3J0IGNvbnN0IHJlbW92ZUF0dHJpYnV0ZXMgPSAoaXRlbXMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgYXR0ciBvZiBpdGVtcykge1xuICAgIGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IHNldFRleHROb2RlID0gdmFsID0+IG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudCA9IHZhbDtcblxuZXhwb3J0IGNvbnN0IGNyZWF0ZURvbU5vZGUgPSAodm5vZGUsIHBhcmVudCkgPT4ge1xuICBpZiAodm5vZGUubm9kZVR5cGUgPT09ICdzdmcnKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTlAsIHZub2RlLm5vZGVUeXBlKTtcbiAgfSBlbHNlIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZub2RlLm5vZGVUeXBlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcGFyZW50Lm5hbWVzcGFjZVVSSSA9PT0gU1ZHX05QID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OUCwgdm5vZGUubm9kZVR5cGUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh2bm9kZS5ub2RlVHlwZSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudExpc3RlbmVycyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gT2JqZWN0LmtleXMocHJvcHMpXG4gICAgLmZpbHRlcihrID0+IGsuc3Vic3RyKDAsIDIpID09PSAnb24nKVxuICAgIC5tYXAoayA9PiBbay5zdWJzdHIoMikudG9Mb3dlckNhc2UoKSwgcHJvcHNba11dKTtcbn07XG4iLCJleHBvcnQgY29uc3QgdHJhdmVyc2UgPSBmdW5jdGlvbiAqICh2bm9kZSkge1xuICB5aWVsZCB2bm9kZTtcbiAgaWYgKHZub2RlLmNoaWxkcmVuICYmIHZub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgIGZvciAobGV0IGNoaWxkIG9mIHZub2RlLmNoaWxkcmVuKSB7XG4gICAgICB5aWVsZCAqIHRyYXZlcnNlKGNoaWxkKTtcbiAgICB9XG4gIH1cbn07IiwiaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7XG4gIGlzU2hhbGxvd0VxdWFsLFxuICBwYWlyaWZ5LFxuICBuZXh0VGljayxcbiAgbm9vcFxufSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlQXR0cmlidXRlcyxcbiAgc2V0QXR0cmlidXRlcyxcbiAgc2V0VGV4dE5vZGUsXG4gIGNyZWF0ZURvbU5vZGUsXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxuICBhZGRFdmVudExpc3RlbmVycyxcbiAgZ2V0RXZlbnRMaXN0ZW5lcnMsXG59IGZyb20gJy4vZG9tVXRpbCc7XG5pbXBvcnQge3RyYXZlcnNlfSBmcm9tICcuL3RyYXZlcnNlJztcblxuY29uc3QgdXBkYXRlRXZlbnRMaXN0ZW5lcnMgPSAoe3Byb3BzOm5ld05vZGVQcm9wc309e30sIHtwcm9wczpvbGROb2RlUHJvcHN9PXt9KSA9PiB7XG4gIGNvbnN0IG5ld05vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhuZXdOb2RlUHJvcHMgfHwge30pO1xuICBjb25zdCBvbGROb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMob2xkTm9kZVByb3BzIHx8IHt9KTtcblxuICByZXR1cm4gbmV3Tm9kZUV2ZW50cy5sZW5ndGggfHwgb2xkTm9kZUV2ZW50cy5sZW5ndGggP1xuICAgIGNvbXBvc2UoXG4gICAgICByZW1vdmVFdmVudExpc3RlbmVycyhvbGROb2RlRXZlbnRzKSxcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKG5ld05vZGVFdmVudHMpXG4gICAgKSA6IG5vb3A7XG59O1xuXG5jb25zdCB1cGRhdGVBdHRyaWJ1dGVzID0gKG5ld1ZOb2RlLCBvbGRWTm9kZSkgPT4ge1xuICBjb25zdCBuZXdWTm9kZVByb3BzID0gbmV3Vk5vZGUucHJvcHMgfHwge307XG4gIGNvbnN0IG9sZFZOb2RlUHJvcHMgPSBvbGRWTm9kZS5wcm9wcyB8fCB7fTtcblxuICBpZiAoaXNTaGFsbG93RXF1YWwobmV3Vk5vZGVQcm9wcywgb2xkVk5vZGVQcm9wcykpIHtcbiAgICByZXR1cm4gbm9vcDtcbiAgfVxuXG4gIGlmIChuZXdWTm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgcmV0dXJuIHNldFRleHROb2RlKG5ld1ZOb2RlLnByb3BzLnZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IG5ld05vZGVLZXlzID0gT2JqZWN0LmtleXMobmV3Vk5vZGVQcm9wcyk7XG4gIGNvbnN0IG9sZE5vZGVLZXlzID0gT2JqZWN0LmtleXMob2xkVk5vZGVQcm9wcyk7XG4gIGNvbnN0IGF0dHJpYnV0ZXNUb1JlbW92ZSA9IG9sZE5vZGVLZXlzLmZpbHRlcihrID0+ICFuZXdOb2RlS2V5cy5pbmNsdWRlcyhrKSk7XG5cbiAgcmV0dXJuIGNvbXBvc2UoXG4gICAgcmVtb3ZlQXR0cmlidXRlcyhhdHRyaWJ1dGVzVG9SZW1vdmUpLFxuICAgIHNldEF0dHJpYnV0ZXMobmV3Tm9kZUtleXMubWFwKHBhaXJpZnkobmV3Vk5vZGVQcm9wcykpKVxuICApO1xufTtcblxuY29uc3QgZG9tRmFjdG9yeSA9IGNyZWF0ZURvbU5vZGU7XG5cbi8vIGFwcGx5IHZub2RlIGRpZmZpbmcgdG8gYWN0dWFsIGRvbSBub2RlIChpZiBuZXcgbm9kZSA9PiBpdCB3aWxsIGJlIG1vdW50ZWQgaW50byB0aGUgcGFyZW50KVxuY29uc3QgZG9taWZ5ID0gKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSkgPT4ge1xuICBpZiAoIW9sZFZub2RlKSB7Ly90aGVyZSBpcyBubyBwcmV2aW91cyB2bm9kZVxuICAgIGlmIChuZXdWbm9kZSkgey8vbmV3IG5vZGUgPT4gd2UgaW5zZXJ0XG4gICAgICBuZXdWbm9kZS5kb20gPSBwYXJlbnREb21Ob2RlLmFwcGVuZENoaWxkKGRvbUZhY3RvcnkobmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICByZXR1cm4ge3Zub2RlOiBuZXdWbm9kZSwgZ2FyYmFnZTogbnVsbH07XG4gICAgfSBlbHNlIHsvL2Vsc2UgKGlycmVsZXZhbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpXG4gICAgfVxuICB9IGVsc2Ugey8vdGhlcmUgaXMgYSBwcmV2aW91cyB2bm9kZVxuICAgIGlmICghbmV3Vm5vZGUpIHsvL3dlIG11c3QgcmVtb3ZlIHRoZSByZWxhdGVkIGRvbSBub2RlXG4gICAgICBwYXJlbnREb21Ob2RlLnJlbW92ZUNoaWxkKG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4gKHtnYXJiYWdlOiBvbGRWbm9kZSwgZG9tOiBudWxsfSk7XG4gICAgfSBlbHNlIGlmIChuZXdWbm9kZS5ub2RlVHlwZSAhPT0gb2xkVm5vZGUubm9kZVR5cGUpIHsvL2l0IG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IGRvbUZhY3RvcnkobmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHBhcmVudERvbU5vZGUucmVwbGFjZUNoaWxkKG5ld1Zub2RlLmRvbSwgb2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogb2xkVm5vZGUsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfSBlbHNlIHsvLyBvbmx5IHVwZGF0ZSBhdHRyaWJ1dGVzXG4gICAgICBuZXdWbm9kZS5kb20gPSBvbGRWbm9kZS5kb207XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSBvbGRWbm9kZS5saWZlQ3ljbGUgKyAxO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBudWxsLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiByZW5kZXIgYSB2aXJ0dWFsIGRvbSBub2RlLCBkaWZmaW5nIGl0IHdpdGggaXRzIHByZXZpb3VzIHZlcnNpb24sIG1vdW50aW5nIGl0IGluIGEgcGFyZW50IGRvbSBub2RlXG4gKiBAcGFyYW0gb2xkVm5vZGVcbiAqIEBwYXJhbSBuZXdWbm9kZVxuICogQHBhcmFtIHBhcmVudERvbU5vZGVcbiAqIEBwYXJhbSBvbk5leHRUaWNrIGNvbGxlY3Qgb3BlcmF0aW9ucyB0byBiZSBwcm9jZXNzZWQgb24gbmV4dCB0aWNrXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmV4cG9ydCBjb25zdCByZW5kZXIgPSAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlLCBvbk5leHRUaWNrID0gW10pID0+IHtcblxuICAvLzEuIHRyYW5zZm9ybSB0aGUgbmV3IHZub2RlIHRvIGEgdm5vZGUgY29ubmVjdGVkIHRvIGFuIGFjdHVhbCBkb20gZWxlbWVudCBiYXNlZCBvbiB2bm9kZSB2ZXJzaW9ucyBkaWZmaW5nXG4gIC8vIGkuIG5vdGUgYXQgdGhpcyBzdGVwIG9jY3VyIGRvbSBpbnNlcnRpb25zL3JlbW92YWxzXG4gIC8vIGlpLiBpdCBtYXkgY29sbGVjdCBzdWIgdHJlZSB0byBiZSBkcm9wcGVkIChvciBcInVubW91bnRlZFwiKVxuICBjb25zdCB7dm5vZGUsIGdhcmJhZ2V9ID0gZG9taWZ5KG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSk7XG5cbiAgaWYgKGdhcmJhZ2UgIT09IG51bGwpIHtcbiAgICAvLyBkZWZlciB1bm1vdW50IGxpZmVjeWNsZSBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGZvciAobGV0IGcgb2YgdHJhdmVyc2UoZ2FyYmFnZSkpIHtcbiAgICAgIGlmIChnLm9uVW5Nb3VudCkge1xuICAgICAgICBvbk5leHRUaWNrLnB1c2goZy5vblVuTW91bnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vTm9ybWFsaXNhdGlvbiBvZiBvbGQgbm9kZSAoaW4gY2FzZSBvZiBhIHJlcGxhY2Ugd2Ugd2lsbCBjb25zaWRlciBvbGQgbm9kZSBhcyBlbXB0eSBub2RlIChubyBjaGlsZHJlbiwgbm8gcHJvcHMpKVxuICBjb25zdCB0ZW1wT2xkTm9kZSA9IGdhcmJhZ2UgIT09IG51bGwgfHwgIW9sZFZub2RlID8ge2xlbmd0aDogMCwgY2hpbGRyZW46IFtdLCBwcm9wczoge319IDogb2xkVm5vZGU7XG5cbiAgaWYgKHZub2RlKSB7XG5cbiAgICAvLzIuIHVwZGF0ZSBkb20gYXR0cmlidXRlcyBiYXNlZCBvbiB2bm9kZSBwcm9wIGRpZmZpbmcuXG4gICAgLy9zeW5jXG4gICAgaWYgKHZub2RlLm9uVXBkYXRlICYmIHZub2RlLmxpZmVDeWNsZSA+IDEpIHtcbiAgICAgIHZub2RlLm9uVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlQXR0cmlidXRlcyh2bm9kZSwgdGVtcE9sZE5vZGUpKHZub2RlLmRvbSk7XG5cbiAgICAvL2Zhc3QgcGF0aFxuICAgIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgICByZXR1cm4gb25OZXh0VGljaztcbiAgICB9XG5cbiAgICBpZiAodm5vZGUub25Nb3VudCAmJiB2bm9kZS5saWZlQ3ljbGUgPT09IDEpIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiB2bm9kZS5vbk1vdW50KCkpO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuQ291bnQgPSBNYXRoLm1heCh0ZW1wT2xkTm9kZS5jaGlsZHJlbi5sZW5ndGgsIHZub2RlLmNoaWxkcmVuLmxlbmd0aCk7XG5cbiAgICAvL2FzeW5jIHdpbGwgYmUgZGVmZXJyZWQgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBjb25zdCBzZXRMaXN0ZW5lcnMgPSB1cGRhdGVFdmVudExpc3RlbmVycyh2bm9kZSwgdGVtcE9sZE5vZGUpO1xuICAgIGlmIChzZXRMaXN0ZW5lcnMgIT09IG5vb3ApIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiBzZXRMaXN0ZW5lcnModm5vZGUuZG9tKSk7XG4gICAgfVxuXG4gICAgLy8zIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIGNoaWxkcmVuIHRvIHVwZGF0ZSBkb20gYW5kIGNvbGxlY3QgZnVuY3Rpb25zIHRvIHByb2Nlc3Mgb24gbmV4dCB0aWNrXG4gICAgaWYgKGNoaWxkcmVuQ291bnQgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuQ291bnQ7IGkrKykge1xuICAgICAgICAvLyB3ZSBwYXNzIG9uTmV4dFRpY2sgYXMgcmVmZXJlbmNlIChpbXByb3ZlIHBlcmY6IG1lbW9yeSArIHNwZWVkKVxuICAgICAgICByZW5kZXIodGVtcE9sZE5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5kb20sIG9uTmV4dFRpY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvbk5leHRUaWNrO1xufTtcblxuZXhwb3J0IGNvbnN0IGh5ZHJhdGUgPSAodm5vZGUsIGRvbSkgPT4ge1xuICAndXNlIHN0cmljdCc7XG4gIGNvbnN0IGh5ZHJhdGVkID0gT2JqZWN0LmFzc2lnbih7fSwgdm5vZGUpO1xuICBjb25zdCBkb21DaGlsZHJlbiA9IEFycmF5LmZyb20oZG9tLmNoaWxkTm9kZXMpLmZpbHRlcihuID0+IG4ubm9kZVR5cGUgIT09IDMgfHwgbi5ub2RlVmFsdWUudHJpbSgpICE9PSAnJyk7XG4gIGh5ZHJhdGVkLmRvbSA9IGRvbTtcbiAgaHlkcmF0ZWQuY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlbi5tYXAoKGNoaWxkLCBpKSA9PiBoeWRyYXRlKGNoaWxkLCBkb21DaGlsZHJlbltpXSkpO1xuICByZXR1cm4gaHlkcmF0ZWQ7XG59O1xuXG5leHBvcnQgY29uc3QgbW91bnQgPSBjdXJyeSgoY29tcCwgaW5pdFByb3AsIHJvb3QpID0+IHtcbiAgY29uc3Qgdm5vZGUgPSBjb21wLm5vZGVUeXBlICE9PSB2b2lkIDAgPyBjb21wIDogY29tcChpbml0UHJvcCB8fCB7fSk7XG4gIGNvbnN0IG9sZFZOb2RlID0gcm9vdC5jaGlsZHJlbi5sZW5ndGggPyBoeWRyYXRlKHZub2RlLCByb290LmNoaWxkcmVuWzBdKSA6IG51bGw7XG4gIGNvbnN0IGJhdGNoID0gcmVuZGVyKG9sZFZOb2RlLCB2bm9kZSwgcm9vdCk7XG4gIG5leHRUaWNrKCgpID0+IHtcbiAgICBmb3IgKGxldCBvcCBvZiBiYXRjaCkge1xuICAgICAgb3AoKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdm5vZGU7XG59KTsiLCJpbXBvcnQge3JlbmRlcn0gZnJvbSAnLi90cmVlJztcbmltcG9ydCB7bmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ3JlYXRlIGEgZnVuY3Rpb24gd2hpY2ggd2lsbCB0cmlnZ2VyIGFuIHVwZGF0ZSBvZiB0aGUgY29tcG9uZW50IHdpdGggdGhlIHBhc3NlZCBzdGF0ZVxuICogQHBhcmFtIGNvbXAge0Z1bmN0aW9ufSAtIHRoZSBjb21wb25lbnQgdG8gdXBkYXRlXG4gKiBAcGFyYW0gaW5pdGlhbFZOb2RlIC0gdGhlIGluaXRpYWwgdmlydHVhbCBkb20gbm9kZSByZWxhdGVkIHRvIHRoZSBjb21wb25lbnQgKGllIG9uY2UgaXQgaGFzIGJlZW4gbW91bnRlZClcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSB0aGUgdXBkYXRlIGZ1bmN0aW9uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVwZGF0ZSAoY29tcCwgaW5pdGlhbFZOb2RlKSB7XG4gIGxldCBvbGROb2RlID0gaW5pdGlhbFZOb2RlO1xuICBjb25zdCB1cGRhdGVGdW5jID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgbW91bnQgPSBvbGROb2RlLmRvbS5wYXJlbnROb2RlO1xuICAgIGNvbnN0IG5ld05vZGUgPSBjb21wKE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBvbGROb2RlLmNoaWxkcmVuIHx8IFtdfSwgb2xkTm9kZS5wcm9wcywgcHJvcHMpLCAuLi5hcmdzKTtcbiAgICBjb25zdCBuZXh0QmF0Y2ggPSByZW5kZXIob2xkTm9kZSwgbmV3Tm9kZSwgbW91bnQpO1xuXG4gICAgLy8gZGFuZ2VyIHpvbmUgISEhIVxuICAgIC8vIGNoYW5nZSBieSBrZWVwaW5nIHRoZSBzYW1lIHJlZmVyZW5jZSBzbyB0aGUgZXZlbnR1YWwgcGFyZW50IG5vZGUgZG9lcyBub3QgbmVlZCB0byBiZSBcImF3YXJlXCIgdHJlZSBtYXkgaGF2ZSBjaGFuZ2VkIGRvd25zdHJlYW06IG9sZE5vZGUgbWF5IGJlIHRoZSBjaGlsZCBvZiBzb21lb25lIC4uLih3ZWxsIHRoYXQgaXMgYSB0cmVlIGRhdGEgc3RydWN0dXJlIGFmdGVyIGFsbCA6UCApXG4gICAgb2xkTm9kZSA9IE9iamVjdC5hc3NpZ24ob2xkTm9kZSB8fCB7fSwgbmV3Tm9kZSk7XG4gICAgLy8gZW5kIGRhbmdlciB6b25lXG5cbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBmb3IgKGxldCBvcCBvZiBuZXh0QmF0Y2gpIHtcbiAgICAgICAgb3AoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZTtcbiAgfTtcbiAgcmV0dXJuIHVwZGF0ZUZ1bmM7XG59IiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgbGlmZUN5Y2xlRmFjdG9yeSA9IG1ldGhvZCA9PiBjdXJyeSgoZm4sIGNvbXApID0+IChwcm9wcywgLi4uYXJncykgPT4ge1xuICBjb25zdCBuID0gY29tcChwcm9wcywgLi4uYXJncyk7XG4gIG5bbWV0aG9kXSA9ICgpID0+IGZuKG4sIC4uLmFyZ3MpO1xuICByZXR1cm4gbjtcbn0pO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyB1bm1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVW5Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVW5Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IGJlZm9yZSB0aGUgY29tcG9uZW50IGlzIHVwZGF0ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVXBkYXRlID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25VcGRhdGUnKTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudCwgb25VcGRhdGV9IGZyb20gJy4vbGlmZUN5Y2xlcyc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbi8qKlxuICogQ29tYmluYXRvciB0byBjcmVhdGUgYSBcInN0YXRlZnVsIGNvbXBvbmVudFwiOiBpZSBpdCB3aWxsIGhhdmUgaXRzIG93biBzdGF0ZSBhbmQgdGhlIGFiaWxpdHkgdG8gdXBkYXRlIGl0cyBvd24gdHJlZVxuICogQHBhcmFtIGNvbXAge0Z1bmN0aW9ufSAtIHRoZSBjb21wb25lbnRcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBhIG5ldyB3cmFwcGVkIGNvbXBvbmVudFxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoY29tcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAvL2xhenkgZXZhbHVhdGUgdXBkYXRlRnVuYyAodG8gbWFrZSBzdXJlIGl0IGlzIGRlZmluZWRcbiAgICAgIGNvbnN0IHNldFN0YXRlID0gKG5ld1N0YXRlKSA9PiB1cGRhdGVGdW5jKG5ld1N0YXRlKTtcbiAgICAgIHJldHVybiBjb21wKHByb3BzLCBzZXRTdGF0ZSwgLi4uYXJncyk7XG4gICAgfTtcbiAgICBjb25zdCBzZXRVcGRhdGVGdW5jdGlvbiA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgIH07XG5cbiAgICByZXR1cm4gY29tcG9zZShvbk1vdW50KHNldFVwZGF0ZUZ1bmN0aW9uKSwgb25VcGRhdGUoc2V0VXBkYXRlRnVuY3Rpb24pKSh3cmFwcGVyQ29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgRWxtIGxpa2UgYXBwXG4gKiBAcGFyYW0gdmlldyB7RnVuY3Rpb259IC0gYSBjb21wb25lbnQgd2hpY2ggdGFrZXMgYXMgYXJndW1lbnRzIHRoZSBjdXJyZW50IG1vZGVsIGFuZCB0aGUgbGlzdCBvZiB1cGRhdGVzXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gYSBFbG0gbGlrZSBhcHBsaWNhdGlvbiB3aG9zZSBwcm9wZXJ0aWVzIFwibW9kZWxcIiwgXCJ1cGRhdGVzXCIgYW5kIFwic3Vic2NyaXB0aW9uc1wiIHdpbGwgZGVmaW5lIHRoZSByZWxhdGVkIGRvbWFpbiBzcGVjaWZpYyBvYmplY3RzXG4gKi9cbmV4cG9ydCBkZWZhdWx0ICAodmlldykgPT4gKHttb2RlbCwgdXBkYXRlcywgc3Vic2NyaXB0aW9ucyA9IFtdfT17fSkgPT4ge1xuICBsZXQgdXBkYXRlRnVuYztcbiAgbGV0IGFjdGlvblN0b3JlID0ge307XG4gIGZvciAobGV0IHVwZGF0ZSBvZiBPYmplY3Qua2V5cyh1cGRhdGVzKSkge1xuICAgIGFjdGlvblN0b3JlW3VwZGF0ZV0gPSAoLi4uYXJncykgPT4ge1xuICAgICAgbW9kZWwgPSB1cGRhdGVzW3VwZGF0ZV0obW9kZWwsIC4uLmFyZ3MpOyAvL3RvZG8gY29uc2lkZXIgc2lkZSBlZmZlY3RzLCBtaWRkbGV3YXJlcywgZXRjXG4gICAgICByZXR1cm4gdXBkYXRlRnVuYyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGNvbXAgPSAoKSA9PiB2aWV3KG1vZGVsLCBhY3Rpb25TdG9yZSk7XG5cbiAgY29uc3QgaW5pdEFjdGlvblN0b3JlID0gKHZub2RlKSA9PiB7XG4gICAgdXBkYXRlRnVuYyA9IHVwZGF0ZShjb21wLCB2bm9kZSk7XG4gIH07XG4gIGNvbnN0IGluaXRTdWJzY3JpcHRpb24gPSBzdWJzY3JpcHRpb25zLm1hcChzdWIgPT4gdm5vZGUgPT4gc3ViKHZub2RlLCBhY3Rpb25TdG9yZSkpO1xuICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICByZXR1cm4gb25Nb3VudChpbml0RnVuYywgY29tcCk7XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7b25Nb3VudCwgb25Vbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnXG5pbXBvcnQge2lzRGVlcEVxdWFsLCBpZGVudGl0eX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb25uZWN0IGNvbWJpbmF0b3I6IHdpbGwgY3JlYXRlIFwiY29udGFpbmVyXCIgY29tcG9uZW50IHdoaWNoIHdpbGwgc3Vic2NyaWJlIHRvIGEgUmVkdXggbGlrZSBzdG9yZS4gYW5kIHVwZGF0ZSBpdHMgY2hpbGRyZW4gd2hlbmV2ZXIgYSBzcGVjaWZpYyBzbGljZSBvZiBzdGF0ZSBjaGFuZ2UgdW5kZXIgc3BlY2lmaWMgY2lyY3Vtc3RhbmNlc1xuICogQHBhcmFtIHN0b3JlIHtPYmplY3R9IC0gVGhlIHN0b3JlIChpbXBsZW1lbnRpbmcgdGhlIHNhbWUgYXBpIHRoYW4gUmVkdXggc3RvcmVcbiAqIEBwYXJhbSBhY3Rpb25zIHtPYmplY3R9IFt7fV0gLSBUaGUgbGlzdCBvZiBhY3Rpb25zIHRoZSBjb25uZWN0ZWQgY29tcG9uZW50IHdpbGwgYmUgYWJsZSB0byB0cmlnZ2VyXG4gKiBAcGFyYW0gc2xpY2VTdGF0ZSB7RnVuY3Rpb259IFtzdGF0ZSA9PiBzdGF0ZV0gLSBBIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50IHRoZSBzdGF0ZSBhbmQgcmV0dXJuIGEgXCJ0cmFuc2Zvcm1lZFwiIHN0YXRlIChsaWtlIHBhcnRpYWwsIGV0YykgcmVsZXZhbnQgdG8gdGhlIGNvbnRhaW5lclxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIEEgY29udGFpbmVyIGZhY3Rvcnkgd2l0aCB0aGUgZm9sbG93aW5nIGFyZ3VtZW50czpcbiAqICAtIGNvbXA6IHRoZSBjb21wb25lbnQgdG8gd3JhcCBub3RlIHRoZSBhY3Rpb25zIG9iamVjdCB3aWxsIGJlIHBhc3NlZCBhcyBzZWNvbmQgYXJndW1lbnQgb2YgdGhlIGNvbXBvbmVudCBmb3IgY29udmVuaWVuY2VcbiAqICAtIG1hcFN0YXRlVG9Qcm9wOiBhIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50IHdoYXQgdGhlIFwic2xpY2VTdGF0ZVwiIGZ1bmN0aW9uIHJldHVybnMgYW5kIHJldHVybnMgYW4gb2JqZWN0IHRvIGJlIGJsZW5kZWQgaW50byB0aGUgcHJvcGVydGllcyBvZiB0aGUgY29tcG9uZW50IChkZWZhdWx0IHRvIGlkZW50aXR5IGZ1bmN0aW9uKVxuICogIC0gc2hvdWxkVXBkYXRlOiBhIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50cyB0aGUgcHJldmlvdXMgYW5kIHRoZSBjdXJyZW50IHZlcnNpb25zIG9mIHdoYXQgXCJzbGljZVN0YXRlXCIgZnVuY3Rpb24gcmV0dXJucyB0byByZXR1cm5zIGEgYm9vbGVhbiBkZWZpbmluZyB3aGV0aGVyIHRoZSBjb21wb25lbnQgc2hvdWxkIGJlIHVwZGF0ZWQgKGRlZmF1bHQgdG8gYSBkZWVwRXF1YWwgY2hlY2spXG4gKi9cbmV4cG9ydCBkZWZhdWx0ICAoc3RvcmUsIGFjdGlvbnMgPSB7fSwgc2xpY2VTdGF0ZSA9IGlkZW50aXR5KSA9PlxuICAoY29tcCwgbWFwU3RhdGVUb1Byb3AgPSBpZGVudGl0eSwgc2hvdWxkVXBhdGUgPSAoYSwgYikgPT4gaXNEZWVwRXF1YWwoYSwgYikgPT09IGZhbHNlKSA9PlxuICAgIChpbml0UHJvcCkgPT4ge1xuICAgICAgbGV0IGNvbXBvbmVudFByb3BzID0gaW5pdFByb3A7XG4gICAgICBsZXQgdXBkYXRlRnVuYywgcHJldmlvdXNTdGF0ZVNsaWNlLCB1bnN1YnNjcmliZXI7XG5cbiAgICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIHJldHVybiBjb21wKE9iamVjdC5hc3NpZ24ocHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSkpKSwgYWN0aW9ucywgLi4uYXJncyk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBzdWJzY3JpYmUgPSBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgICAgIHVuc3Vic2NyaWJlciA9IHN0b3JlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdGVTbGljZSA9IHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgaWYgKHNob3VsZFVwYXRlKHByZXZpb3VzU3RhdGVTbGljZSwgc3RhdGVTbGljZSkgPT09IHRydWUpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50UHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHN0YXRlU2xpY2UpKTtcbiAgICAgICAgICAgIHVwZGF0ZUZ1bmMoY29tcG9uZW50UHJvcHMpO1xuICAgICAgICAgICAgcHJldmlvdXNTdGF0ZVNsaWNlID0gc3RhdGVTbGljZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gb25Vbk1vdW50KCgpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmVyKCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNvbXBvc2Uoc3Vic2NyaWJlLCB1bnN1YnNjcmliZSkod3JhcHBlckNvbXApO1xuICAgIH0iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwb2ludGVyIChwYXRoKSB7XG5cbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgZnVuY3Rpb24gcGFydGlhbCAob2JqID0ge30sIHBhcnRzID0gW10pIHtcbiAgICBjb25zdCBwID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh0YXJnZXQsIG5ld1RyZWUpIHtcbiAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICBmb3IgKGxldCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQodGFyZ2V0KXtcbiAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSlcbiAgICB9LFxuICAgIHNldFxuICB9XG59O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuXG5mdW5jdGlvbiBzb3J0QnlQcm9wZXJ0eSAocHJvcCkge1xuICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuICAgIGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG4gICAgaWYgKGFWYWwgPT09IGJWYWwpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEZhY3RvcnkgKHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcbiAgaWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG4gIH1cblxuICBjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcbiAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuICByZXR1cm4gKGFycmF5KSA9PiBbLi4uYXJyYXldLnNvcnQoY29tcGFyZUZ1bmMpO1xufSIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uICh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEJvb2xlYW47XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBOdW1iZXI7XG4gICAgY2FzZSAnZGF0ZSc6XG4gICAgICByZXR1cm4gKHZhbCkgPT4gbmV3IERhdGUodmFsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvbXBvc2UoU3RyaW5nLCAodmFsKSA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gIH1cbn1cblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuICBpbmNsdWRlcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQuaW5jbHVkZXModmFsdWUpO1xuICB9LFxuICBpcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGlzTm90KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiAhT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGx0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8IHZhbHVlO1xuICB9LFxuICBndCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPiB2YWx1ZTtcbiAgfSxcbiAgbHRlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8PSB2YWx1ZTtcbiAgfSxcbiAgZ3RlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+PSB2YWx1ZTtcbiAgfSxcbiAgZXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSA9PSBpbnB1dDtcbiAgfSxcbiAgbm90RXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSAhPSBpbnB1dDtcbiAgfVxufTtcblxuY29uc3QgZXZlcnkgPSBmbnMgPT4gKC4uLmFyZ3MpID0+IGZucy5ldmVyeShmbiA9PiBmbiguLi5hcmdzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVkaWNhdGUgKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgY29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG4gIGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICByZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vL2F2b2lkIHVzZWxlc3MgZmlsdGVyIGxvb2t1cCAoaW1wcm92ZSBwZXJmKVxuZnVuY3Rpb24gbm9ybWFsaXplQ2xhdXNlcyAoY29uZikge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgY29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG4gIHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoKSB7XG4gICAgICBvdXRwdXRbcGF0aF0gPSB2YWxpZENsYXVzZXM7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyIChmaWx0ZXIpIHtcbiAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gIGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcbiAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICBjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG4gIH0pO1xuICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXkuZmlsdGVyKGZpbHRlclByZWRpY2F0ZSk7XG59IiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuICBjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcbiAgaWYgKCFzY29wZS5sZW5ndGggfHwgIXZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheS5maWx0ZXIoaXRlbSA9PiBzZWFyY2hQb2ludGVycy5zb21lKHAgPT4gU3RyaW5nKHAoaXRlbSkpLmluY2x1ZGVzKFN0cmluZyh2YWx1ZSkpKSlcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNsaWNlRmFjdG9yeSAoe3BhZ2UgPSAxLCBzaXplfSA9IHt9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBzbGljZUZ1bmN0aW9uIChhcnJheSA9IFtdKSB7XG4gICAgY29uc3QgYWN0dWFsU2l6ZSA9IHNpemUgfHwgYXJyYXkubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IChwYWdlIC0gMSkgKiBhY3R1YWxTaXplO1xuICAgIHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGVtaXR0ZXIgKCkge1xuXG4gIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncyl7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICBmb3IgKGxldCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgbGlzdGVuZXIoLi4uYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IGluc3RhbmNlLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJveHlMaXN0ZW5lciAoZXZlbnRNYXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7ZW1pdHRlcn0pIHtcblxuICAgIGNvbnN0IHByb3h5ID0ge307XG4gICAgbGV0IGV2ZW50TGlzdGVuZXJzID0ge307XG5cbiAgICBmb3IgKGxldCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IFtdO1xuICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gZXZlbnRMaXN0ZW5lcnNbZXZdLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHByb3h5Lm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICBjb25zdCBkaXNwbGF5ZWQgPSBleGVjRnVuYyhkYXRhKTtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRElTUExBWV9DSEFOR0VELCBkaXNwbGF5ZWQubWFwKGQgPT4ge1xuICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfRVJST1IsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9LCBwcm9jZXNzaW5nRGVsYXkpO1xuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcbiAgICBzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcbiAgICB0YXAoZGlzcGF0Y2goZXYpKSxcbiAgICBwdGVyLnNldCh0YWJsZVN0YXRlKVxuICApKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG4gIGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG4gIGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuICAgIHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuICAgIHJlc2V0VG9GaXJzdFBhZ2UsXG4gICAgKCkgPT4gdGFibGUuZXhlYygpIC8vIHdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgKTtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcbiAgICBmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcbiAgICBzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcbiAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcbiAgICBleGVjLFxuICAgIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKXtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgb25EaXNwbGF5Q2hhbmdlKGZuKXtcbiAgICAgIHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuICAgIH0sXG4gICAgZ2V0VGFibGVTdGF0ZSgpe1xuICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgY29uc3QgZmlsdGVyID0ge307XG4gICAgICBmb3IgKGxldCBwcm9wIGluIHRhYmxlU3RhdGUuZmlsdGVyKSB7XG4gICAgICAgIGZpbHRlcltwcm9wXSA9IHRhYmxlU3RhdGUuZmlsdGVyW3Byb3BdLm1hcCh2ID0+IE9iamVjdC5hc3NpZ24oe30sIHYpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7c29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyfTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaW5zdGFuY2UgPSBPYmplY3QuYXNzaWduKHRhYmxlLCBhcGkpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImltcG9ydCB0YWJsZURpcmVjdGl2ZSBmcm9tICcuL3NyYy90YWJsZSc7XG5pbXBvcnQgZmlsdGVyRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvZmlsdGVyJztcbmltcG9ydCBzZWFyY2hEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zZWFyY2gnO1xuaW1wb3J0IHNsaWNlRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc2xpY2UnO1xuaW1wb3J0IHNvcnREaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zb3J0JztcbmltcG9ydCBzdW1tYXJ5RGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeSc7XG5pbXBvcnQgd29ya2luZ0luZGljYXRvckRpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3InO1xuXG5leHBvcnQgY29uc3Qgc2VhcmNoID0gc2VhcmNoRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHNsaWNlID0gc2xpY2VEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc3VtbWFyeSA9IHN1bW1hcnlEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc29ydCA9IHNvcnREaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgZmlsdGVyID0gZmlsdGVyRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHdvcmtpbmdJbmRpY2F0b3IgPSB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gdGFibGVEaXJlY3RpdmU7XG5leHBvcnQgZGVmYXVsdCB0YWJsZTtcbiIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmV4cG9ydCBjb25zdCBnZXQgPSBjdXJyeSgoYXJyYXksIGluZGV4KSA9PiBhcnJheVtpbmRleF0pO1xuZXhwb3J0IGNvbnN0IHJlcGxhY2UgPSBjdXJyeSgoYXJyYXksIG5ld1ZhbCwgaW5kZXgpID0+IGFycmF5Lm1hcCgodmFsLCBpKSA9PiAoaW5kZXggPT09IGkgKSA/IG5ld1ZhbCA6IHZhbCkpO1xuZXhwb3J0IGNvbnN0IHBhdGNoID0gY3VycnkoKGFycmF5LCBuZXdWYWwsIGluZGV4KSA9PiByZXBsYWNlKGFycmF5LCBPYmplY3QuYXNzaWduKGFycmF5W2luZGV4XSwgbmV3VmFsKSwgaW5kZXgpKTtcbmV4cG9ydCBjb25zdCByZW1vdmUgPSBjdXJyeSgoYXJyYXksIGluZGV4KSA9PiBhcnJheS5maWx0ZXIoKHZhbCwgaSkgPT4gaW5kZXggIT09IGkpKTtcbmV4cG9ydCBjb25zdCBpbnNlcnQgPSBjdXJyeSgoYXJyYXksIG5ld1ZhbCwgaW5kZXgpID0+IFsuLi5hcnJheS5zbGljZSgwLCBpbmRleCksIG5ld1ZhbCwgLi4uYXJyYXkuc2xpY2UoaW5kZXgpXSk7IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtnZXQsIHJlcGxhY2UsIHBhdGNoLCByZW1vdmUsIGluc2VydH0gZnJvbSAnLi9jcnVkJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtkYXRhLCB0YWJsZX0pIHtcbiAgLy8gZW1wdHkgYW5kIHJlZmlsbCBkYXRhIGtlZXBpbmcgdGhlIHNhbWUgcmVmZXJlbmNlXG4gIGNvbnN0IG11dGF0ZURhdGEgPSAobmV3RGF0YSkgPT4ge1xuICAgIGRhdGEuc3BsaWNlKDApO1xuICAgIGRhdGEucHVzaCguLi5uZXdEYXRhKTtcbiAgfTtcbiAgY29uc3QgcmVmcmVzaCA9IGNvbXBvc2UobXV0YXRlRGF0YSwgdGFibGUuZXhlYyk7XG4gIHJldHVybiB7XG4gICAgdXBkYXRlKGluZGV4LG5ld1ZhbCl7XG4gICAgICByZXR1cm4gY29tcG9zZShyZXBsYWNlKGRhdGEsbmV3VmFsKSxyZWZyZXNoKShpbmRleCk7XG4gICAgfSxcbiAgICBwYXRjaChpbmRleCwgbmV3VmFsKXtcbiAgICAgIHJldHVybiBwYXRjaChkYXRhLCBuZXdWYWwsIGluZGV4KTtcbiAgICB9LFxuICAgIHJlbW92ZTogY29tcG9zZShyZW1vdmUoZGF0YSksIHJlZnJlc2gpLFxuICAgIGluc2VydChuZXdWYWwsIGluZGV4ID0gMCl7XG4gICAgICByZXR1cm4gY29tcG9zZShpbnNlcnQoZGF0YSwgbmV3VmFsKSwgcmVmcmVzaCkoaW5kZXgpO1xuICAgIH0sXG4gICAgZ2V0OiBnZXQoZGF0YSlcbiAgfTtcbn0iLCIvLyBpdCBpcyBsaWtlIFJlZHV4IGJ1dCB1c2luZyBzbWFydCB0YWJsZSB3aGljaCBhbHJlYWR5IGJlaGF2ZXMgbW9yZSBvciBsZXNzIGxpa2UgYSBzdG9yZSBhbmQgbGlrZSBhIHJlZHVjZXIgaW4gdGhlIHNhbWUgdGltZS5cbi8vIG9mIGNvdXJzZSB0aGlzIGltcGwgaXMgYmFzaWM6IGVycm9yIGhhbmRsaW5nIGV0YyBhcmUgbWlzc2luZyBhbmQgcmVkdWNlciBpcyBcImhhcmRjb2RlZFwiXG5jb25zdCByZWR1Y2VyRmFjdG9yeSA9IGZ1bmN0aW9uIChzbWFydFRhYmxlKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoc3RhdGUgPSB7XG4gICAgdGFibGVTdGF0ZTogc21hcnRUYWJsZS5nZXRUYWJsZVN0YXRlKCksXG4gICAgZGlzcGxheWVkOiBbXSxcbiAgICBzdW1tYXJ5OiB7fSxcbiAgICBpc1Byb2Nlc3Npbmc6IGZhbHNlXG4gIH0sIGFjdGlvbikge1xuICAgIGNvbnN0IHt0eXBlLCBhcmdzfSA9IGFjdGlvbjtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgJ1RPR0dMRV9GSUxURVInOiB7XG4gICAgICAgIGNvbnN0IHtmaWx0ZXJ9ID0gYWN0aW9uO1xuICAgICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUsIHthY3RpdmVGaWx0ZXI6IGZpbHRlcn0pO1xuICAgICAgfVxuICAgICAgZGVmYXVsdDogLy9wcm94eSB0byBzbWFydCB0YWJsZVxuICAgICAgICBpZiAoc21hcnRUYWJsZVt0eXBlXSkge1xuICAgICAgICAgIHNtYXJ0VGFibGVbdHlwZV0oLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH1cbiAgfVxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0b3JlIChzbWFydFRhYmxlKSB7XG5cbiAgY29uc3QgcmVkdWNlciA9IHJlZHVjZXJGYWN0b3J5KHNtYXJ0VGFibGUpO1xuXG4gIGxldCBjdXJyZW50U3RhdGUgPSB7XG4gICAgdGFibGVTdGF0ZTogc21hcnRUYWJsZS5nZXRUYWJsZVN0YXRlKClcbiAgfTtcbiAgbGV0IHN1bW1hcnk7XG4gIGxldCBsaXN0ZW5lcnMgPSBbXTtcblxuICBjb25zdCBicm9hZGNhc3QgPSAoKSA9PiB7XG4gICAgZm9yIChsZXQgbCBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgIGwoKTtcbiAgICB9XG4gIH07XG5cbiAgc21hcnRUYWJsZS5vbignU1VNTUFSWV9DSEFOR0VEJywgZnVuY3Rpb24gKHMpIHtcbiAgICBzdW1tYXJ5ID0gcztcbiAgfSk7XG5cbiAgc21hcnRUYWJsZS5vbignRVhFQ19DSEFOR0VEJywgZnVuY3Rpb24gKHt3b3JraW5nfSkge1xuICAgIE9iamVjdC5hc3NpZ24oY3VycmVudFN0YXRlLCB7XG4gICAgICBpc1Byb2Nlc3Npbmc6IHdvcmtpbmdcbiAgICB9KTtcbiAgICBicm9hZGNhc3QoKTtcbiAgfSk7XG5cbiAgc21hcnRUYWJsZS5vbkRpc3BsYXlDaGFuZ2UoZnVuY3Rpb24gKGRpc3BsYXllZCkge1xuICAgIE9iamVjdC5hc3NpZ24oY3VycmVudFN0YXRlLCB7XG4gICAgICB0YWJsZVN0YXRlOiBzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKSxcbiAgICAgIGRpc3BsYXllZCxcbiAgICAgIHN1bW1hcnlcbiAgICB9KTtcbiAgICBicm9hZGNhc3QoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBzdWJzY3JpYmUobGlzdGVuZXIpe1xuICAgICAgbGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmZpbHRlcihsID0+IGwgIT09IGxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldFN0YXRlKCl7XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgY3VycmVudFN0YXRlLCB7dGFibGVTdGF0ZTpzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKX0pO1xuICAgIH0sXG4gICAgZGlzcGF0Y2goYWN0aW9uID0ge30pe1xuICAgICAgY3VycmVudFN0YXRlID0gcmVkdWNlcihjdXJyZW50U3RhdGUsIGFjdGlvbik7XG4gICAgICBpZiAoYWN0aW9uLnR5cGUgJiYgIXNtYXJ0VGFibGVbYWN0aW9uLnR5cGVdKSB7XG4gICAgICAgIGJyb2FkY2FzdCgpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn0iLCJpbXBvcnQge2RlZmF1bHQgYXMgc21hcnRUYWJsZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5pbXBvcnQgY3J1ZCBmcm9tICdzbWFydC10YWJsZS1jcnVkJztcbmltcG9ydCB7Y3JlYXRlU3RvcmV9IGZyb20gJy4vcmVkdXhTbWFydFRhYmxlJztcblxuLy9kYXRhIGNvbWluZyBmcm9tIGdsb2JhbFxuY29uc3QgdGFibGVTdGF0ZSA9IHtzZWFyY2g6IHt9LCBmaWx0ZXI6IHt9LCBzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxLCBzaXplOiAyMH19O1xuLy90aGUgc21hcnQgdGFibGVcbmNvbnN0IHRhYmxlID0gc21hcnRUYWJsZSh7ZGF0YSwgdGFibGVTdGF0ZX0sIGNydWQpO1xuLy90aGUgc3RvcmVcbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZVN0b3JlKHRhYmxlKTtcbiIsImltcG9ydCB7aH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuXG5leHBvcnQgZnVuY3Rpb24gZGVib3VuY2UgKGZuLCBkZWxheSA9IDMwMCkge1xuICBsZXQgdGltZW91dElkO1xuICByZXR1cm4gKGV2KSA9PiB7XG4gICAgaWYgKHRpbWVvdXRJZCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgIH1cbiAgICB0aW1lb3V0SWQgPSB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICBmbihldik7XG4gICAgfSwgZGVsYXkpO1xuICB9O1xufVxuZXhwb3J0IGNvbnN0IHRyYXBLZXlkb3duID0gKC4uLmtleXMpID0+IChldikgPT4ge1xuICBjb25zdCB7a2V5Q29kZX0gPWV2O1xuICBpZiAoa2V5cy5pbmRleE9mKGtleUNvZGUpID09PSAtMSkge1xuICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG59OyIsImltcG9ydCB7aCwgb25Nb3VudH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuXG5leHBvcnQgY29uc3QgYXV0b0ZvY3VzID0gb25Nb3VudChuID0+IG4uZG9tLmZvY3VzKCkpO1xuZXhwb3J0IGNvbnN0IElucHV0ID0gYXV0b0ZvY3VzKHByb3BzID0+IHtcbiAgZGVsZXRlICBwcm9wcy5jaGlsZHJlbjsgLy9ubyBjaGlsZHJlbiBmb3IgaW5wdXRzXG4gIHJldHVybiA8aW5wdXQgey4uLnByb3BzfSAvPlxufSk7IiwiaW1wb3J0IHtoLCB3aXRoU3RhdGV9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCB7ZGVib3VuY2UsIHRyYXBLZXlkb3dufSBmcm9tICcuL2hlbHBlcic7XG5pbXBvcnQge0lucHV0LCBhdXRvRm9jdXN9IGZyb20gJy4vaW5wdXRzJztcblxuY29uc3QgdG9nZ2xlT25LZXlEb3duID0gcHJvcHMgPT4gKGV2KSA9PiB7XG4gIGNvbnN0IHtrZXlDb2RlfSA9IGV2O1xuICBpZiAoa2V5Q29kZSA9PT0gMTMpIHtcbiAgICBwcm9wcy50b2dnbGVFZGl0KHRydWUpKCk7XG4gIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gMjcpIHtcbiAgICBldi5jdXJyZW50VGFyZ2V0LmZvY3VzKCk7XG4gIH1cbn07XG5cbmNvbnN0IElucHV0Q2VsbCA9IChwcm9wcykgPT4ge1xuXG4gIGNvbnN0IG9uS2V5ZG93biA9IHRvZ2dsZU9uS2V5RG93bihwcm9wcyk7XG5cbiAgcmV0dXJuIDx0ZCB0YWJJbmRleD1cIi0xXCIgb25LZXlEb3duPXtvbktleWRvd259IG9uQ2xpY2s9e3Byb3BzLnRvZ2dsZUVkaXQodHJ1ZSl9IGNsYXNzPXtwcm9wcy5jbGFzc05hbWV9PlxuICAgIHtcbiAgICAgIHByb3BzLmlzRWRpdGluZyA9PT0gJ3RydWUnID9cbiAgICAgICAgPElucHV0IG9uS2V5ZG93bj17dHJhcEtleWRvd24oMjcpfSB0eXBlPXtwcm9wcy50eXBlIHx8ICd0ZXh0J30gdmFsdWU9e3Byb3BzLmN1cnJlbnRWYWx1ZX1cbiAgICAgICAgICAgICAgIG9uSW5wdXQ9e3Byb3BzLm9uSW5wdXR9XG4gICAgICAgICAgICAgICBvbkJsdXI9e3Byb3BzLnRvZ2dsZUVkaXQoZmFsc2UpfS8+XG4gICAgICAgIDogPHNwYW4+e3Byb3BzLmN1cnJlbnRWYWx1ZX08L3NwYW4+XG4gICAgfVxuICA8L3RkPjtcbn07XG5cbmNvbnN0IG1ha2VFZGl0YWJsZSA9IGNvbXAgPT4ge1xuICByZXR1cm4gd2l0aFN0YXRlKChwcm9wcywgc2V0U3RhdGUpID0+IHtcbiAgICBjb25zdCB0b2dnbGVFZGl0ID0gKHZhbCkgPT4gKCkgPT4gc2V0U3RhdGUoT2JqZWN0LmFzc2lnbih7fSwgcHJvcHMsIHtpc0VkaXRpbmc6IHZhbCAhPT0gdm9pZCAwID8gdmFsIDogcHJvcHMuaXNFZGl0aW5nICE9PSB0cnVlfSkpO1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IHt0b2dnbGVFZGl0LCAuLi5wcm9wc307XG4gICAgcmV0dXJuIGNvbXAoZnVsbFByb3BzKTtcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVMYXN0TmFtZSA9IG1ha2VFZGl0YWJsZSgocHJvcHMpID0+IHtcbiAgY29uc3Qge3RvZ2dsZUVkaXQsIHBlcnNvbiwgaW5kZXgsIGNsYXNzTmFtZSwgcGF0Y2gsIGlzRWRpdGluZ30gPSBwcm9wcztcbiAgbGV0IGN1cnJlbnRWYWx1ZSA9IHBlcnNvbi5uYW1lLmxhc3Q7XG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7bmFtZToge2xhc3Q6IGN1cnJlbnRWYWx1ZSwgZmlyc3Q6IHBlcnNvbi5uYW1lLmZpcnN0fX0pO1xuICB9KTtcblxuICByZXR1cm4gPElucHV0Q2VsbCBpc0VkaXRpbmc9e1N0cmluZyhpc0VkaXRpbmcgPT09IHRydWUpfSB0b2dnbGVFZGl0PXt0b2dnbGVFZGl0fSBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFZhbHVlPXtjdXJyZW50VmFsdWV9IG9uSW5wdXQ9e29uSW5wdXR9Lz47XG59KTtcblxuZXhwb3J0IGNvbnN0IEVkaXRhYmxlRmlyc3ROYW1lID0gbWFrZUVkaXRhYmxlKChwcm9wcykgPT4ge1xuICBjb25zdCB7dG9nZ2xlRWRpdCwgcGVyc29uLCBpbmRleCwgY2xhc3NOYW1lLCBwYXRjaCwgaXNFZGl0aW5nfSA9IHByb3BzO1xuICBsZXQgY3VycmVudFZhbHVlID0gcGVyc29uLm5hbWUuZmlyc3Q7XG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7bmFtZToge2ZpcnN0OiBjdXJyZW50VmFsdWUsIGxhc3Q6IHBlcnNvbi5uYW1lLmxhc3R9fSk7XG4gIH0pO1xuXG4gIHJldHVybiA8SW5wdXRDZWxsIGlzRWRpdGluZz17U3RyaW5nKGlzRWRpdGluZyA9PT0gdHJ1ZSl9IHRvZ2dsZUVkaXQ9e3RvZ2dsZUVkaXR9IGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50VmFsdWU9e2N1cnJlbnRWYWx1ZX0gb25JbnB1dD17b25JbnB1dH0vPlxufSk7XG5cbmNvbnN0IEdlbmRlclNlbGVjdCA9IGF1dG9Gb2N1cygoe29uQ2hhbmdlLCB0b2dnbGVFZGl0LCBwZXJzb259KSA9PiB7XG4gIHJldHVybiA8c2VsZWN0IG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcpfSBuYW1lPVwiZ2VuZGVyIHNlbGVjdFwiIG9uQ2hhbmdlPXtvbkNoYW5nZX0gb25CbHVyPXt0b2dnbGVFZGl0KGZhbHNlKX0+XG4gICAgPG9wdGlvbiB2YWx1ZT1cIm1hbGVcIiBzZWxlY3RlZD17cGVyc29uLmdlbmRlciA9PT0gJ21hbGUnfT5tYWxlPC9vcHRpb24+XG4gICAgPG9wdGlvbiB2YWx1ZT1cImZlbWFsZVwiIHNlbGVjdGVkPXtwZXJzb24uZ2VuZGVyID09PSAnZmVtYWxlJ30+ZmVtYWxlPC9vcHRpb24+XG4gIDwvc2VsZWN0PlxufSk7XG5cbmV4cG9ydCBjb25zdCBFZGl0YWJsZUdlbmRlciA9IG1ha2VFZGl0YWJsZSgocHJvcHMpID0+IHtcbiAgY29uc3Qge3RvZ2dsZUVkaXQsIHBlcnNvbiwgaW5kZXgsIGNsYXNzTmFtZSwgcGF0Y2gsIGlzRWRpdGluZ30gPSBwcm9wcztcbiAgbGV0IGN1cnJlbnRWYWx1ZSA9IHBlcnNvbi5nZW5kZXI7XG5cbiAgY29uc3Qgb25LZXlkb3duID0gdG9nZ2xlT25LZXlEb3duKHByb3BzKTtcblxuICBjb25zdCBvbkNoYW5nZSA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtnZW5kZXI6IGN1cnJlbnRWYWx1ZX0pO1xuICB9KTtcbiAgY29uc3QgZ2VuZGVyQ2xhc3MgPSBwZXJzb24uZ2VuZGVyID09PSAnZmVtYWxlJyA/ICdnZW5kZXItZmVtYWxlJyA6ICdnZW5kZXItbWFsZSc7XG5cbiAgcmV0dXJuIDx0ZCB0YWJJbmRleD1cIi0xXCIgb25LZXlEb3duPXtvbktleWRvd259IG9uQ2xpY2s9e3RvZ2dsZUVkaXQodHJ1ZSl9IGNsYXNzPXtjbGFzc05hbWV9PlxuICAgIHtcbiAgICAgIGlzRWRpdGluZyA/IDxHZW5kZXJTZWxlY3Qgb25DaGFuZ2U9e29uQ2hhbmdlfSB0b2dnbGVFZGl0PXt0b2dnbGVFZGl0fSBwZXJzb249e3BlcnNvbn0vPiA6XG4gICAgICAgIDxzcGFuIGNsYXNzPXtnZW5kZXJDbGFzc30+e2N1cnJlbnRWYWx1ZX08L3NwYW4+XG4gICAgfVxuICA8L3RkPjtcbn0pO1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVTaXplID0gbWFrZUVkaXRhYmxlKChwcm9wcykgPT4ge1xuICBjb25zdCB7dG9nZ2xlRWRpdCwgcGVyc29uLCBpbmRleCwgY2xhc3NOYW1lLCBwYXRjaCwgaXNFZGl0aW5nfSA9IHByb3BzO1xuICBsZXQgY3VycmVudFZhbHVlID0gcGVyc29uLnNpemU7XG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7c2l6ZTogY3VycmVudFZhbHVlfSk7XG4gIH0pO1xuICBjb25zdCByYXRpbyA9IE1hdGgubWluKChwZXJzb24uc2l6ZSAtIDE1MCkgLyA1MCwgMSkgKiAxMDA7XG5cbiAgY29uc3Qgb25LZXlkb3duID0gdG9nZ2xlT25LZXlEb3duKHByb3BzKTtcblxuICByZXR1cm4gPHRkIHRhYkluZGV4PVwiLTFcIiBjbGFzcz17Y2xhc3NOYW1lfSBvbktleURvd249e29uS2V5ZG93bn0gb25DbGljaz17dG9nZ2xlRWRpdCh0cnVlKX0+XG4gICAge1xuICAgICAgaXNFZGl0aW5nID8gPElucHV0IG9uS2V5ZG93bj17dHJhcEtleWRvd24oMjcpfSB0eXBlPVwibnVtYmVyXCIgbWluPVwiMTUwXCIgbWF4PVwiMjAwXCIgdmFsdWU9e2N1cnJlbnRWYWx1ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICBvbkJsdXI9e3RvZ2dsZUVkaXQoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICAgICAgIG9uSW5wdXQ9e29uSW5wdXR9Lz4gOlxuICAgICAgICA8c3Bhbj48c3BhbiBzdHlsZT17YGhlaWdodDogJHtyYXRpb30lYH0gY2xhc3M9XCJzaXplLXN0aWNrXCI+PC9zcGFuPntjdXJyZW50VmFsdWV9PC9zcGFuPlxuICAgIH1cbiAgPC90ZD47XG59KTtcblxuZXhwb3J0IGNvbnN0IEVkaXRhYmxlQmlydGhEYXRlID0gbWFrZUVkaXRhYmxlKChwcm9wcykgPT4ge1xuICBjb25zdCB7dG9nZ2xlRWRpdCwgcGVyc29uLCBpbmRleCwgY2xhc3NOYW1lLCBwYXRjaCwgaXNFZGl0aW5nfSA9IHByb3BzO1xuICBsZXQgY3VycmVudFZhbHVlID0gcGVyc29uLmJpcnRoRGF0ZTtcblxuICBjb25zdCBvbklucHV0ID0gZGVib3VuY2UoZXYgPT4ge1xuICAgIGN1cnJlbnRWYWx1ZSA9IGV2LnRhcmdldC52YWx1ZTtcbiAgICBwYXRjaChpbmRleCwge2JpcnRoRGF0ZTogbmV3IERhdGUoY3VycmVudFZhbHVlKX0pO1xuICB9KTtcblxuICByZXR1cm4gPElucHV0Q2VsbCB0eXBlPVwiZGF0ZVwiIGlzRWRpdGluZz17U3RyaW5nKGlzRWRpdGluZyA9PT0gdHJ1ZSl9IHRvZ2dsZUVkaXQ9e3RvZ2dsZUVkaXR9IGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50VmFsdWU9e2N1cnJlbnRWYWx1ZS50b0RhdGVTdHJpbmcoKX0gb25JbnB1dD17b25JbnB1dH0vPlxufSk7XG4iLCJpbXBvcnQge2h9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcblxuZXhwb3J0IGNvbnN0IEljb25GaWx0ZXIgPSAoKSA9PiAoPHN2ZyBhcmlhLWhpZGRlbj1cInRydWVcIiBjbGFzcz1cImljb25cIiB2aWV3Qm94PVwiMCAwIDMyIDMyXCI+XG4gIDxwYXRoXG4gICAgZD1cIk0xNiAwYy04LjgzNyAwLTE2IDIuMjM5LTE2IDV2M2wxMiAxMnYxMGMwIDEuMTA1IDEuNzkxIDIgNCAyczQtMC44OTUgNC0ydi0xMGwxMi0xMnYtM2MwLTIuNzYxLTcuMTYzLTUtMTYtNXpNMi45NSA0LjMzOGMwLjc0OC0wLjQyNyAxLjc5OS0wLjgzMiAzLjA0MC0xLjE3MSAyLjc0OC0wLjc1MiA2LjMwMy0xLjE2NyAxMC4wMTEtMS4xNjdzNy4yNjIgMC40MTQgMTAuMDExIDEuMTY3YzEuMjQxIDAuMzQgMi4yOTIgMC43NDUgMy4wNDAgMS4xNzEgMC40OTQgMC4yODEgMC43NiAwLjUxOSAwLjg4NCAwLjY2Mi0wLjEyNCAwLjE0Mi0wLjM5MSAwLjM4LTAuODg0IDAuNjYyLTAuNzQ4IDAuNDI3LTEuOCAwLjgzMi0zLjA0MCAxLjE3MS0yLjc0OCAwLjc1Mi02LjMwMyAxLjE2Ny0xMC4wMTEgMS4xNjdzLTcuMjYyLTAuNDE0LTEwLjAxMS0xLjE2N2MtMS4yNC0wLjM0LTIuMjkyLTAuNzQ1LTMuMDQwLTEuMTcxLTAuNDk0LTAuMjgyLTAuNzYtMC41MTktMC44ODQtMC42NjIgMC4xMjQtMC4xNDIgMC4zOTEtMC4zOCAwLjg4NC0wLjY2MnpcIj48L3BhdGg+XG48L3N2Zz4pO1xuXG5leHBvcnQgY29uc3QgSWNvbkJpbiA9ICgpID0+ICg8c3ZnIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIGNsYXNzPVwiaWNvblwiIHZpZXdCb3g9XCIwIDAgMzIgMzJcIj5cbiAgPHBhdGggZD1cIk02IDMyaDIwbDItMjJoLTI0ek0yMCA0di00aC04djRoLTEwdjZsMi0yaDI0bDIgMnYtNmgtMTB6TTE4IDRoLTR2LTJoNHYyelwiPjwvcGF0aD5cbjwvc3ZnPik7XG5cbmV4cG9ydCBjb25zdCBJY29uU29ydCA9ICgpID0+ICg8c3ZnIGNsYXNzPVwiaWNvblwiIHZpZXdCb3g9XCIwIDAgMzIgMzJcIj5cbiAgPHBhdGggZD1cIk0yIDZoMjh2NmgtMjh6TTIgMTRoMjh2NmgtMjh6TTIgMjJoMjh2NmgtMjh6XCI+PC9wYXRoPlxuPC9zdmc+KTtcblxuZXhwb3J0IGNvbnN0IEljb25Tb3J0QXNjID0gKCkgPT4gKDxzdmcgY2xhc3M9XCJpY29uXCIgdmlld0JveD1cIjAgMCAzMiAzMlwiPlxuICA8cGF0aCBkPVwiTTEwIDI0di0yNGgtNHYyNGgtNWw3IDcgNy03aC01elwiPjwvcGF0aD5cbiAgPHBhdGggZD1cIk0xNCAxOGgxOHY0aC0xOHYtNHpcIj48L3BhdGg+XG4gIDxwYXRoIGQ9XCJNMTQgMTJoMTR2NGgtMTR2LTR6XCI+PC9wYXRoPlxuICA8cGF0aCBkPVwiTTE0IDZoMTB2NGgtMTB2LTR6XCI+PC9wYXRoPlxuICA8cGF0aCBkPVwiTTE0IDBoNnY0aC02di00elwiPjwvcGF0aD5cbjwvc3ZnPik7XG5cbmV4cG9ydCBjb25zdCBJY29uU29ydERlc2MgPSAoKSA9PiAoPHN2ZyBjbGFzcz1cImljb25cIiB2aWV3Qm94PVwiMCAwIDMyIDMyXCI+XG4gIDxwYXRoIGQ9XCJNMTAgMjR2LTI0aC00djI0aC01bDcgNyA3LTdoLTV6XCI+PC9wYXRoPlxuICA8cGF0aCBkPVwiTTE0IDBoMTh2NGgtMTh2LTR6XCI+PC9wYXRoPlxuICA8cGF0aCBkPVwiTTE0IDZoMTR2NGgtMTR2LTR6XCI+PC9wYXRoPlxuICA8cGF0aCBkPVwiTTE0IDEyaDEwdjRoLTEwdi00elwiPjwvcGF0aD5cbiAgPHBhdGggZD1cIk0xNCAxOGg2djRoLTZ2LTR6XCI+PC9wYXRoPlxuPC9zdmc+KTsiLCJpbXBvcnQgc3RvcmUgZnJvbSAnLi4vbGliL3N0b3JlJztcbmltcG9ydCB7Y29ubmVjdCwgaCwgb25VcGRhdGV9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCB7RWRpdGFibGVMYXN0TmFtZSwgRWRpdGFibGVCaXJ0aERhdGUsIEVkaXRhYmxlU2l6ZSwgRWRpdGFibGVHZW5kZXIsIEVkaXRhYmxlRmlyc3ROYW1lfSBmcm9tICcuL2VkaXRhYmxlQ2VsbCc7XG5pbXBvcnQge0ljb25CaW59IGZyb20gJy4vaWNvbnMnXG5cbmNvbnN0IG1hcFN0YXRlVG9Qcm9wID0gc3RhdGUgPT4gKHtwZXJzb25zOiBzdGF0ZX0pO1xuY29uc3QgZG9lc1VwZGF0ZUxpc3QgPSAocHJldmlvdXMsIGN1cnJlbnQpID0+IHtcbiAgbGV0IG91dHB1dCA9IHRydWU7XG4gIGlmICh0eXBlb2YgcHJldmlvdXMgPT09IHR5cGVvZiBjdXJyZW50KSB7XG4gICAgb3V0cHV0ID0gcHJldmlvdXMubGVuZ3RoICE9PSBjdXJyZW50Lmxlbmd0aCB8fCBwcmV2aW91cy5zb21lKChpLCBrKSA9PiBwcmV2aW91c1trXS52YWx1ZS5pZCAhPT0gY3VycmVudFtrXS52YWx1ZS5pZCk7XG4gIH1cbiAgcmV0dXJuIG91dHB1dDtcbn07XG5jb25zdCBzbGljZVN0YXRlID0gc3RhdGUgPT4gc3RhdGUuZGlzcGxheWVkO1xuY29uc3QgYWN0aW9ucyA9IHtcbiAgcmVtb3ZlOiBpbmRleCA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3JlbW92ZScsIGFyZ3M6IFtpbmRleF19KSxcbiAgcGF0Y2g6IChpbmRleCwgdmFsdWUpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAncGF0Y2gnLCBhcmdzOiBbaW5kZXgsIHZhbHVlXX0pXG59O1xuY29uc3Qgc3Vic2NyaWJlVG9EaXNwbGF5ID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5jb25zdCBmb2N1c0ZpcnN0Q2VsbCA9IG9uVXBkYXRlKHZub2RlID0+IHtcbiAgY29uc3QgZmlyc3RDZWxsID0gdm5vZGUuZG9tLnF1ZXJ5U2VsZWN0b3IoJ3RkJyk7XG4gIGlmIChmaXJzdENlbGwgIT09IG51bGwpIHtcbiAgICBmaXJzdENlbGwuZm9jdXMoKTtcbiAgfVxufSk7XG5cbmNvbnN0IFRCb2R5ID0gZm9jdXNGaXJzdENlbGwoKHtwZXJzb25zID0gW10sIHBhdGNoLCByZW1vdmV9KSA9PiB7XG4gIHJldHVybiBwZXJzb25zLmxlbmd0aCA/IDx0Ym9keT5cbiAgICB7XG4gICAgICBwZXJzb25zLm1hcCgoe3ZhbHVlLCBpbmRleH0pID0+IDx0cj5cbiAgICAgICAgPEVkaXRhYmxlTGFzdE5hbWUgY2xhc3NOYW1lPVwiY29sLWxhc3RuYW1lXCIgcGVyc29uPXt2YWx1ZX0gaW5kZXg9e2luZGV4fSBwYXRjaD17cGF0Y2h9Lz5cbiAgICAgICAgPEVkaXRhYmxlRmlyc3ROYW1lIGNsYXNzTmFtZT1cImNvbC1maXJzdG5hbWVcIiBwZXJzb249e3ZhbHVlfSBpbmRleD17aW5kZXh9IHBhdGNoPXtwYXRjaH0vPlxuICAgICAgICA8RWRpdGFibGVCaXJ0aERhdGUgY2xhc3NOYW1lPVwiY29sLWJpcnRoZGF0ZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDxFZGl0YWJsZUdlbmRlciBjbGFzc05hbWU9XCJjb2wtZ2VuZGVyIGZpeGVkLXNpemVcIiBwZXJzb249e3ZhbHVlfSBpbmRleD17aW5kZXh9IHBhdGNoPXtwYXRjaH0vPlxuICAgICAgICA8RWRpdGFibGVTaXplIGNsYXNzTmFtZT1cImNvbC1zaXplIGZpeGVkLXNpemVcIiBwZXJzb249e3ZhbHVlfSBpbmRleD17aW5kZXh9IHBhdGNoPXtwYXRjaH0vPlxuICAgICAgICA8dGQgY2xhc3M9XCJmaXhlZC1zaXplIGNvbC1hY3Rpb25zXCIgZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cImJ1dHRvblwiPlxuICAgICAgICAgIDxidXR0b24gdGFiaW5kZXg9XCItMVwiIG9uQ2xpY2s9eygpID0+IHJlbW92ZShpbmRleCl9PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ2aXN1YWxseS1oaWRkZW5cIj57J0RlbGV0ZSAnICsgdmFsdWUubmFtZS5sYXN0ICsgJyAnICsgdmFsdWUubmFtZS5maXJzdH08L3NwYW4+XG4gICAgICAgICAgICA8SWNvbkJpbi8+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvdGQ+XG4gICAgICA8L3RyPilcbiAgICB9XG4gICAgPC90Ym9keT4gOiA8dGJvZHk+XG4gICAgPHRyPlxuICAgICAgPHRkIHRhYkluZGV4PVwiLTFcIiBjb2xTcGFuPVwiNlwiPlRoZXJlIGlzIG5vIGRhdGEgbWF0Y2hpbmcgeW91ciByZXF1ZXN0PC90ZD5cbiAgICA8L3RyPlxuICAgIDwvdGJvZHk+XG59KTtcblxuY29uc3QgUGVyc29uTGlzdENvbXBvbmVudCA9IChwcm9wcywgYWN0aW9ucykgPT4ge1xuICByZXR1cm4gPFRCb2R5IHBlcnNvbnM9e3Byb3BzLnBlcnNvbnN9IHJlbW92ZT17YWN0aW9ucy5yZW1vdmV9XG4gICAgICAgICAgICAgICAgcGF0Y2g9e2FjdGlvbnMucGF0Y2h9Lz5cbn07XG5cbmV4cG9ydCBjb25zdCBQZXJzb25MaXN0ID0gc3Vic2NyaWJlVG9EaXNwbGF5KFBlcnNvbkxpc3RDb21wb25lbnQsIG1hcFN0YXRlVG9Qcm9wLCBkb2VzVXBkYXRlTGlzdCk7XG4iLCJpbXBvcnQge2gsIGNvbm5lY3R9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuXG5cbmNvbnN0IGFjdGlvbnMgPSB7fTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBzdGF0ZSA9PiAoe2lzUHJvY2Vzc2luZzogc3RhdGUuaXNQcm9jZXNzaW5nfSk7XG5jb25zdCBzdWJzY3JpYmVUb1Byb2Nlc3NpbmcgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcblxuY29uc3QgTG9hZGluZ0luZGljYXRvciA9ICh7aXNQcm9jZXNzaW5nfSkgPT4ge1xuICBjb25zdCBjbGFzc05hbWUgPSBpc1Byb2Nlc3NpbmcgPT09IHRydWUgPyAnc3Qtd29ya2luZycgOiAnJztcbiAgY29uc3QgbWVzc2FnZSA9IGlzUHJvY2Vzc2luZyA9PT0gdHJ1ZSA/ICdsb2FkaW5nIHBlcnNvbnMgZGF0YScgOiAnZGF0YSBsb2FkZWQnO1xuICByZXR1cm4gPGRpdiBpZD1cIm92ZXJsYXlcIiBhcmlhLWxpdmU9XCJhc3NlcnRpdmVcIiByb2xlPVwiYWxlcnRcIiBjbGFzcz17Y2xhc3NOYW1lfT5cbiAgICB7bWVzc2FnZX1cbiAgPC9kaXY+O1xufTtcbmV4cG9ydCBjb25zdCBXb3JrSW5Qcm9ncmVzcyA9IHN1YnNjcmliZVRvUHJvY2Vzc2luZyhMb2FkaW5nSW5kaWNhdG9yKTtcbiIsImltcG9ydCB7aCwgY29ubmVjdH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5pbXBvcnQganNvbiBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtJY29uU29ydCwgSWNvblNvcnRBc2MsIEljb25Tb3J0RGVzY30gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IGFjdGlvbnMgPSB7XG4gIHRvZ2dsZVNvcnQ6ICh7cG9pbnRlciwgZGlyZWN0aW9ufSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdzb3J0JywgYXJnczogW3twb2ludGVyLCBkaXJlY3Rpb259XX0pXG59O1xuY29uc3Qgc2xpY2VTdGF0ZSA9IGpzb24oJ3RhYmxlU3RhdGUuc29ydCcpLmdldDtcbmNvbnN0IHN1YnNjcmliZVRvU29ydCA9IGNvbm5lY3Qoc3RvcmUsIGFjdGlvbnMsIHNsaWNlU3RhdGUpO1xuXG5cbmNvbnN0IEljb24gPSAoe2RpcmVjdGlvbn0pID0+IHtcbiAgaWYgKGRpcmVjdGlvbiA9PT0gJ2FzYycpIHtcbiAgICByZXR1cm4gPEljb25Tb3J0QXNjLz47XG4gIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAnZGVzYycpIHtcbiAgICByZXR1cm4gPEljb25Tb3J0RGVzYy8+O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiA8SWNvblNvcnQvPjtcbiAgfVxufTtcblxuY29uc3QgU29ydEJ1dHRvbkNvbXBvbmVudCA9IChwcm9wcyA9PiB7XG4gIGNvbnN0IHtjb2x1bW5Qb2ludGVyLCBzb3J0RGlyZWN0aW9ucyA9IFsnYXNjJywgJ2Rlc2MnXSwgcG9pbnRlciwgZGlyZWN0aW9uLCBzb3J0fSA9IHByb3BzO1xuICBjb25zdCBhY3R1YWxDdXJzb3IgPSBjb2x1bW5Qb2ludGVyICE9PSBwb2ludGVyID8gLTEgOiBzb3J0RGlyZWN0aW9ucy5pbmRleE9mKGRpcmVjdGlvbik7XG4gIGNvbnN0IG5ld0N1cnNvciA9IChhY3R1YWxDdXJzb3IgKyAxICkgJSBzb3J0RGlyZWN0aW9ucy5sZW5ndGg7XG5cbiAgY29uc3QgdG9nZ2xlU29ydCA9ICgpID0+IHNvcnQoe3BvaW50ZXI6IGNvbHVtblBvaW50ZXIsIGRpcmVjdGlvbjogc29ydERpcmVjdGlvbnNbbmV3Q3Vyc29yXX0pO1xuXG4gIHJldHVybiA8YnV0dG9uIHRhYmluZGV4PVwiLTFcIiBvbkNsaWNrPXt0b2dnbGVTb3J0fT5cbiAgICA8c3BhbiBjbGFzcz1cInZpc3VhbGx5LWhpZGRlblwiPlRvZ2dsZSBzb3J0PC9zcGFuPlxuICAgIDxJY29uIGRpcmVjdGlvbj17c29ydERpcmVjdGlvbnNbYWN0dWFsQ3Vyc29yXX0vPlxuICA8L2J1dHRvbj5cbn0pO1xuXG5leHBvcnQgY29uc3QgU29ydEJ1dHRvbiA9IHN1YnNjcmliZVRvU29ydCgocHJvcHMsIGFjdGlvbnMpID0+XG4gIDxTb3J0QnV0dG9uQ29tcG9uZW50IHsuLi5wcm9wc30gc29ydD17YWN0aW9ucy50b2dnbGVTb3J0fS8+KTtcbiIsImltcG9ydCB7aCwgY29ubmVjdH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnLi9oZWxwZXInO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5pbXBvcnQganNvbiBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5jb25zdCBhY3Rpb25zID0ge1xuICBzZWFyY2g6ICh2YWx1ZSwgc2NvcGUpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnc2VhcmNoJywgYXJnczogW3t2YWx1ZSwgc2NvcGV9XX0pXG59O1xuY29uc3Qgc2xpY2VTdGF0ZSA9IGpzb24oJ3RhYmxlU3RhdGUuc2VhcmNoJykuZ2V0O1xuY29uc3Qgbm9OZWVkRm9yVXBkYXRlID0gc3RhdGUgPT4gZmFsc2U7Ly8gYWx3YXlzIHJldHVybiB0aGUgc2FtZSB2YWx1ZVxuY29uc3Qgc2VhcmNoYWJsZSA9IGNvbm5lY3Qoc3RvcmUsIGFjdGlvbnMsIHNsaWNlU3RhdGUpO1xuXG5jb25zdCBTZWFyY2hJbnB1dCA9IChwcm9wcykgPT4gKDxsYWJlbD5cbiAgPHNwYW4+e3Byb3BzLmNoaWxkcmVufTwvc3Bhbj5cbiAgPGlucHV0IHRhYmluZGV4PVwiMFwiIHR5cGU9XCJzZWFyY2hcIiBvbklucHV0PXtwcm9wcy5vbklucHV0fSBwbGFjZWhvbGRlcj17cHJvcHMucGxhY2Vob2xkZXJ9Lz5cbjwvbGFiZWw+KTtcblxuZXhwb3J0IGNvbnN0IFNlYXJjaFJvdyA9IHNlYXJjaGFibGUoKHByb3BzLCBhY3Rpb25zKSA9PiB7XG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiBhY3Rpb25zLnNlYXJjaChldi50YXJnZXQudmFsdWUsIFsnbmFtZS5sYXN0JywgJ25hbWUuZmlyc3QnXSksIDMwMCk7XG4gIGRlbGV0ZSBwcm9wcy5jaGlsZHJlbjtcbiAgcmV0dXJuIDx0ciB7Li4ucHJvcHN9PlxuICAgIDx0aCBkYXRhLWtleWJvYXJkLXNlbGVjdG9yPVwiaW5wdXRcIj5cbiAgICAgIDxTZWFyY2hJbnB1dCBwbGFjZWhvbGRlcj1cIkNhc2Ugc2Vuc2l0aXZlIHNlYXJjaCBvbiBzdXJuYW1lIGFuZCBuYW1lXCIgb25JbnB1dD17b25JbnB1dH0+U2VhcmNoOjwvU2VhcmNoSW5wdXQ+XG4gICAgPC90aD5cbiAgPC90cj5cbn0sIG5vTmVlZEZvclVwZGF0ZSwgbm9OZWVkRm9yVXBkYXRlKTsiLCJpbXBvcnQge2gsIGNvbm5lY3QsIG9uVXBkYXRlfSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5pbXBvcnQgc3RvcmUgZnJvbSAnLi4vbGliL3N0b3JlJztcbmltcG9ydCB7SWNvbkZpbHRlcn0gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IGZvY3VzT25PcGVuID0gb25VcGRhdGUodm5vZGUgPT4ge1xuICBjb25zdCBhaCA9IHZub2RlLnByb3BzWydhcmlhLWhpZGRlbiddO1xuICBpZiAoYWggPT09ICdmYWxzZScpIHtcbiAgICBjb25zdCBpbnB1dCA9IHZub2RlLmRvbS5xdWVyeVNlbGVjdG9yKCdpbnB1dCwgc2VsZWN0Jyk7XG4gICAgaWYgKGlucHV0KSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IGlucHV0LmZvY3VzKCksIDUpO1xuICAgIH1cbiAgfVxufSk7XG5cbmNvbnN0IGFjdGlvbnMgPSB7XG4gIHRvZ2dsZUZpbHRlck1lbnU6IChmaWx0ZXIpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnVE9HR0xFX0ZJTFRFUicsIGZpbHRlcn0pLFxuICBjb21taXRGaWx0ZXI6ICh2YWx1ZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdmaWx0ZXInLCBhcmdzOiBbdmFsdWVdfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0gc3RhdGUgPT4gKHthY3RpdmVGaWx0ZXI6IHN0YXRlLmFjdGl2ZUZpbHRlciwgZmlsdGVyQ2xhdXNlczogc3RhdGUudGFibGVTdGF0ZS5maWx0ZXJ9KTtcbmNvbnN0IHN1YnNjcmliZVRvRmlsdGVyID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IEZpbHRlclJvd0NvbXAgPSBmb2N1c09uT3BlbigocHJvcHMgPSB7fSkgPT4ge1xuICBjb25zdCB7aXNIaWRkZW4sIHRvZ2dsZUZpbHRlck1lbnUsIGNvbW1pdEZpbHRlcn0gPSBwcm9wcztcbiAgY29uc3QgY2xvc2UgPSAoKSA9PiB7XG4gICAgdG9nZ2xlRmlsdGVyTWVudShudWxsKTtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBbYXJpYS1jb250cm9scz0ke2lkTmFtZX1dYCkuZm9jdXMoKTtcbiAgfTtcbiAgY29uc3Qgb25TdWJtaXQgPSAoZXYpID0+IHtcbiAgICBjb25zdCBmb3JtID0gZXYudGFyZ2V0O1xuICAgIGNvbnN0IHtuYW1lfSA9IGZvcm07XG4gICAgY29uc3QgaW5wdXRzID0gZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCwgc2VsZWN0Jyk7XG4gICAgY29tbWl0RmlsdGVyKHtcbiAgICAgIFtuYW1lXTogWy4uLmlucHV0c10ubWFwKGlucHV0ID0+IHtcbiAgICAgICAgcmV0dXJuIHt0eXBlOiBpbnB1dC50eXBlLCB2YWx1ZTogaW5wdXQudmFsdWUsIG9wZXJhdG9yOiBpbnB1dC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3BlcmF0b3InKSB8fCAnaW5jbHVkZXMnfVxuICAgICAgfSlcbiAgICB9KTtcbiAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGNsb3NlKCk7XG4gIH07XG4gIGNvbnN0IGlkTmFtZSA9IFsnZmlsdGVyJ10uY29uY2F0KHByb3BzLnNjb3BlLnNwbGl0KCcuJykpLmpvaW4oJy0nKTtcbiAgY29uc3Qgb25LZXlEb3duID0gKGV2KSA9PiB7XG4gICAgaWYgKGV2LmNvZGUgPT09ICdFc2NhcGUnIHx8IGV2LmtleUNvZGUgPT09IDI3IHx8IGV2LmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICAgIGNsb3NlKCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGFyaWFIaWRkZW4gPSBpc0hpZGRlbiAhPT0gdHJ1ZTtcbiAgcmV0dXJuIDx0ciBpZD17aWROYW1lfSBjbGFzcz1cImZpbHRlci1yb3dcIiBvbktleWRvd249e29uS2V5RG93bn0gZGF0YS1rZXlib2FyZC1za2lwPXthcmlhSGlkZGVufVxuICAgICAgICAgICAgIGFyaWEtaGlkZGVuPXtTdHJpbmcoYXJpYUhpZGRlbil9PlxuICAgIDx0aCBjb2xzcGFuPVwiNlwiIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJpbnB1dCwgc2VsZWN0XCI+XG4gICAgICA8Zm9ybSBuYW1lPXtwcm9wcy5zY29wZX0gb25TdWJtaXQ9e29uU3VibWl0fT5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgICA8ZGl2IGNsYXNzPVwidmlzdWFsbHktaGlkZGVuXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0YWJJbmRleD1cIi0xXCI+QXBwbHk8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxwIGlkPXtpZE5hbWUgKyAnLWluc3RydWN0aW9uJ30+UHJlc3MgRW50ZXIgdG8gYWN0aXZhdGUgZmlsdGVyIG9yIGVzY2FwZSB0byBkaXNtaXNzPC9wPlxuICAgICAgPC9mb3JtPlxuICAgIDwvdGg+XG4gIDwvdHI+XG59KTtcblxuY29uc3QgRmlsdGVyQnV0dG9uID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtjb2x1bW5Qb2ludGVyLCB0b2dnbGVGaWx0ZXJNZW51LCBmaWx0ZXJDbGF1c2VzID0ge319PXByb3BzO1xuICBjb25zdCBjdXJyZW50RmlsdGVyQ2xhdXNlcyA9IGZpbHRlckNsYXVzZXNbY29sdW1uUG9pbnRlcl0gfHwgW107XG4gIGNvbnN0IGNvbnRyb2xsZWQgPSBbJ2ZpbHRlciddLmNvbmNhdChjb2x1bW5Qb2ludGVyLnNwbGl0KCcuJykpLmpvaW4oJy0nKTtcbiAgY29uc3Qgb25DbGljayA9ICgpID0+IHRvZ2dsZUZpbHRlck1lbnUoY29sdW1uUG9pbnRlcik7XG4gIGNvbnN0IGlzQWN0aXZlID0gY3VycmVudEZpbHRlckNsYXVzZXMubGVuZ3RoICYmIGN1cnJlbnRGaWx0ZXJDbGF1c2VzLnNvbWUoY2xhdXNlID0+IGNsYXVzZS52YWx1ZSk7XG4gIHJldHVybiA8YnV0dG9uIGFyaWEtaGFzcG9wdXA9XCJ0cnVlXCIgdGFiaW5kZXg9XCItMVwiIGNsYXNzPXtpc0FjdGl2ZSA/ICdhY3RpdmUtZmlsdGVyJyA6ICcnfSBhcmlhLWNvbnRyb2xzPXtjb250cm9sbGVkfVxuICAgICAgICAgICAgICAgICBvbkNsaWNrPXtvbkNsaWNrfT5cbiAgICA8c3BhbiBjbGFzcz1cInZpc3VhbGx5LWhpZGRlblwiPlRvZ2dsZSBGaWx0ZXIgbWVudTwvc3Bhbj5cbiAgICA8SWNvbkZpbHRlci8+XG4gIDwvYnV0dG9uPlxufTtcblxuZXhwb3J0IGNvbnN0IFRvZ2dsZUZpbHRlckJ1dHRvbiA9IHN1YnNjcmliZVRvRmlsdGVyKChwcm9wcywgYWN0aW9ucykgPT4ge1xuICByZXR1cm4gPEZpbHRlckJ1dHRvbiB7Li4ucHJvcHN9IHRvZ2dsZUZpbHRlck1lbnU9e2FjdGlvbnMudG9nZ2xlRmlsdGVyTWVudX0vPjtcbn0pO1xuXG5leHBvcnQgY29uc3QgRmlsdGVyUm93ID0gc3Vic2NyaWJlVG9GaWx0ZXIoKHByb3BzLCBhY3Rpb25zKSA9PiB7XG4gIHJldHVybiA8RmlsdGVyUm93Q29tcCBzY29wZT17cHJvcHMuc2NvcGV9IGlzSGlkZGVuPXtwcm9wcy5hY3RpdmVGaWx0ZXIgPT09IHByb3BzLnNjb3BlfVxuICAgICAgICAgICAgICAgICAgICAgICAgdG9nZ2xlRmlsdGVyTWVudT17YWN0aW9ucy50b2dnbGVGaWx0ZXJNZW51fSBjb21taXRGaWx0ZXI9e2FjdGlvbnMuY29tbWl0RmlsdGVyfT5cblxuICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgPC9GaWx0ZXJSb3dDb21wPjtcbn0pOyIsImltcG9ydCB7aH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuXG5pbXBvcnQge1NvcnRCdXR0b259IGZyb20gJy4vc29ydCc7XG5pbXBvcnQge1NlYXJjaFJvd30gZnJvbSAnLi9zZWFyY2gnO1xuaW1wb3J0IHtGaWx0ZXJSb3csIFRvZ2dsZUZpbHRlckJ1dHRvbn0gZnJvbSAnLi9maWx0ZXInO1xuaW1wb3J0IHt0cmFwS2V5ZG93bn0gZnJvbSAnLi9oZWxwZXInO1xuXG5jb25zdCBDb2x1bW5IZWFkZXIgPSAocHJvcHMpID0+IHtcbiAgY29uc3Qge2NvbHVtblBvaW50ZXIsIHNvcnREaXJlY3Rpb25zID0gWydhc2MnLCAnZGVzYyddLCBjbGFzc05hbWUsIGNoaWxkcmVufSA9IHByb3BzO1xuXG4gIHJldHVybiA8dGggY2xhc3M9e2NsYXNzTmFtZX0gZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cImJ1dHRvblwiPlxuICAgIHtjaGlsZHJlbn1cbiAgICA8ZGl2IGNsYXNzPVwiYnV0dG9ucy1jb250YWluZXJcIj5cbiAgICAgIDxTb3J0QnV0dG9uIGNvbHVtblBvaW50ZXI9e2NvbHVtblBvaW50ZXJ9IHNvcnREaXJlY3Rpb25zPXtzb3J0RGlyZWN0aW9uc30vPlxuICAgICAgPFRvZ2dsZUZpbHRlckJ1dHRvbiBjb2x1bW5Qb2ludGVyPXtjb2x1bW5Qb2ludGVyfS8+XG4gICAgPC9kaXY+XG4gIDwvdGg+XG59O1xuXG5leHBvcnQgY29uc3QgSGVhZGVycyA9ICgpID0+IHtcblxuICByZXR1cm4gPHRoZWFkPlxuICA8U2VhcmNoUm93IGNsYXNzPVwiZmlsdGVyLXJvd1wiLz5cbiAgPHRyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLWxhc3RuYW1lXCIgY29sdW1uUG9pbnRlcj1cIm5hbWUubGFzdFwiXG4gICAgICAgICAgICAgICAgICBzb3J0RGlyZWN0aW9ucz17Wydhc2MnLCAnZGVzYycsICdub25lJ119PlN1cm5hbWU8L0NvbHVtbkhlYWRlcj5cbiAgICA8Q29sdW1uSGVhZGVyIGNsYXNzTmFtZT1cImNvbC1maXJzdG5hbWVcIiBjb2x1bW5Qb2ludGVyPVwibmFtZS5maXJzdFwiPk5hbWU8L0NvbHVtbkhlYWRlcj5cbiAgICA8Q29sdW1uSGVhZGVyIGNsYXNzTmFtZT1cImNvbC1iaXJ0aGRhdGVcIiBzb3J0RGlyZWN0aW9ucz17WydkZXNjJywgJ2FzYyddfVxuICAgICAgICAgICAgICAgICAgY29sdW1uUG9pbnRlcj1cImJpcnRoRGF0ZVwiPkRhdGUgb2YgYmlydGg8L0NvbHVtbkhlYWRlcj5cbiAgICA8Q29sdW1uSGVhZGVyIGNsYXNzTmFtZT1cImNvbC1nZW5kZXIgZml4ZWQtc2l6ZVwiIGNvbHVtblBvaW50ZXI9XCJnZW5kZXJcIj5HZW5kZXI8L0NvbHVtbkhlYWRlcj5cbiAgICA8Q29sdW1uSGVhZGVyIGNsYXNzTmFtZT1cImNvbC1zaXplIGZpeGVkLXNpemVcIiBjb2x1bW5Qb2ludGVyPVwic2l6ZVwiPlNpemU8L0NvbHVtbkhlYWRlcj5cbiAgICA8dGggZGF0YS1rZXlib2FyZC1za2lwPXt0cnVlfSBjbGFzcz1cImZpeGVkLXNpemUgY29sLWFjdGlvbnNcIj48L3RoPlxuICA8L3RyPlxuICA8RmlsdGVyUm93IHNjb3BlPVwibmFtZS5sYXN0XCI+XG4gICAgPGxhYmVsPlxuICAgICAgPHNwYW4+c3VybmFtZSBpbmNsdWRlczo8L3NwYW4+XG4gICAgICA8aW5wdXQgYXJpYS1kZXNjcmliZWRieT1cImZpbHRlci1uYW1lLWxhc3QtaW5zdHJ1Y3Rpb25cIiBvbktleURvd249e3RyYXBLZXlkb3duKDI3LCAzOCwgNDApfVxuICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cImNhc2UgaW5zZW5zaXRpdmUgc3VybmFtZSB2YWx1ZVwiLz5cbiAgICA8L2xhYmVsPlxuICA8L0ZpbHRlclJvdz5cbiAgPEZpbHRlclJvdyBzY29wZT1cIm5hbWUuZmlyc3RcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj5uYW1lIGluY2x1ZGVzOjwvc3Bhbj5cbiAgICAgIDxpbnB1dCBvbktleURvd249e3RyYXBLZXlkb3duKDI3LCAzOCwgNDApfSB0eXBlPVwidGV4dFwiIHBsYWNlaG9sZGVyPVwiY2FzZSBpbnNlbnNpdGl2ZSBuYW1lIHZhbHVlXCIvPlxuICAgIDwvbGFiZWw+XG4gIDwvRmlsdGVyUm93PlxuICA8RmlsdGVyUm93IHNjb3BlPVwiYmlydGhEYXRlXCI+XG4gICAgPGxhYmVsPlxuICAgICAgPHNwYW4+Ym9ybiBhZnRlcjo8L3NwYW4+XG4gICAgICA8aW5wdXQgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNyl9IGRhdGEtb3BlcmF0b3I9XCJndFwiIHR5cGU9XCJkYXRlXCIvPlxuICAgIDwvbGFiZWw+XG4gIDwvRmlsdGVyUm93PlxuICA8RmlsdGVyUm93IHNjb3BlPVwiZ2VuZGVyXCI+XG4gICAgPGxhYmVsPlxuICAgICAgPHNwYW4+Z2VuZGVyIGlzOjwvc3Bhbj5cbiAgICAgIDxzZWxlY3Qgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNyl9IGRhdGEtb3BlcmF0b3I9XCJpc1wiPlxuICAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+LTwvb3B0aW9uPlxuICAgICAgICA8b3B0aW9uIHZhbHVlPVwiZmVtYWxlXCI+ZmVtYWxlPC9vcHRpb24+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJtYWxlXCI+bWFsZTwvb3B0aW9uPlxuICAgICAgPC9zZWxlY3Q+XG4gICAgPC9sYWJlbD5cbiAgPC9GaWx0ZXJSb3c+XG4gIDxGaWx0ZXJSb3cgc2NvcGU9XCJzaXplXCI+XG4gICAgPGxhYmVsPlxuICAgICAgPHNwYW4+dGFsbGVyIHRoYW46PC9zcGFuPlxuICAgICAgPGlucHV0IG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcpfSBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiBzdGVwPVwiMVwiIHR5cGU9XCJyYW5nZVwiIGRhdGEtb3BlcmF0b3I9XCJndFwiLz5cbiAgICA8L2xhYmVsPlxuICAgIDxsYWJlbD5cbiAgICAgIDxzcGFuPnNtYWxsZXIgdGhhbjo8L3NwYW4+XG4gICAgICA8aW5wdXQgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNyl9IG1pbj1cIjE1MFwiIG1heD1cIjIwMFwiIHN0ZXA9XCIxXCIgdHlwZT1cInJhbmdlXCIgZGF0YS1vcGVyYXRvcj1cImx0XCIvPlxuICAgIDwvbGFiZWw+XG4gIDwvRmlsdGVyUm93PlxuICA8L3RoZWFkPlxufSIsImltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IHtjb25uZWN0LCBofSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5cbmNvbnN0IGFjdGlvbnMgPSB7XG4gIHNsaWNlOiAocGFnZSwgc2l6ZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdzbGljZScsIGFyZ3M6IFt7cGFnZSwgc2l6ZX1dfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0gc3RhdGUgPT4gc3RhdGUuc3VtbWFyeTtcbmNvbnN0IHN1YnNjcmliZVRvU3VtbWFyeSA9IGNvbm5lY3Qoc3RvcmUsIGFjdGlvbnMsIHNsaWNlU3RhdGUpO1xuXG5jb25zdCBTdW1tYXJ5ID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtwYWdlLCBzaXplLCBmaWx0ZXJlZENvdW50fSA9IHByb3BzO1xuICByZXR1cm4gKDxkaXY+IHNob3dpbmcgaXRlbXMgPHN0cm9uZz57KHBhZ2UgLSAxKSAqIHNpemUgKyAoZmlsdGVyZWRDb3VudCA+IDAgPyAxIDogMCl9PC9zdHJvbmc+IC1cbiAgICA8c3Ryb25nPntNYXRoLm1pbihmaWx0ZXJlZENvdW50LCBwYWdlICogc2l6ZSl9PC9zdHJvbmc+IG9mIDxzdHJvbmc+e2ZpbHRlcmVkQ291bnR9PC9zdHJvbmc+IG1hdGNoaW5nIGl0ZW1zXG4gIDwvZGl2Pik7XG59O1xuXG5jb25zdCBQYWdlU2l6ZSA9IHByb3BzID0+IHtcbiAgY29uc3Qge3NpemUsIHNsaWNlfSA9IHByb3BzO1xuICBjb25zdCBjaGFuZ2VQYWdlU2l6ZSA9IChldikgPT4gc2xpY2UoMSwgTnVtYmVyKGV2LnRhcmdldC52YWx1ZSkpO1xuICByZXR1cm4gPGRpdj5cbiAgICA8bGFiZWw+XG4gICAgICBQYWdlIHNpemVcbiAgICAgIDxzZWxlY3QgdGFiSW5kZXg9XCItMVwiIG9uQ2hhbmdlPXtjaGFuZ2VQYWdlU2l6ZX0gbmFtZT1cInBhZ2VTaXplXCI+XG4gICAgICAgIDxvcHRpb24gc2VsZWN0ZWQ9e3NpemUgPT0gMjB9IHZhbHVlPVwiMjBcIj4yMCBpdGVtczwvb3B0aW9uPlxuICAgICAgICA8b3B0aW9uIHNlbGVjdGVkPXtzaXplID09IDMwfSB2YWx1ZT1cIjMwXCI+MzAgaXRlbXM8L29wdGlvbj5cbiAgICAgICAgPG9wdGlvbiBzZWxlY3RlZD17c2l6ZSA9PSA1MH0gdmFsdWU9XCI1MFwiPjUwIGl0ZW1zPC9vcHRpb24+XG4gICAgICA8L3NlbGVjdD5cbiAgICA8L2xhYmVsPlxuICA8L2Rpdj5cbn07XG5cbmNvbnN0IFBhZ2VyID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtwYWdlLCBzaXplLCBmaWx0ZXJlZENvdW50LCBzbGljZX0gPSBwcm9wcztcbiAgY29uc3Qgc2VsZWN0UHJldmlvdXNQYWdlID0gKCkgPT4gc2xpY2UocGFnZSAtIDEsIHNpemUpO1xuICBjb25zdCBzZWxlY3ROZXh0UGFnZSA9ICgpID0+IHNsaWNlKHBhZ2UgKyAxLCBzaXplKTtcbiAgY29uc3QgaXNQcmV2aW91c0Rpc2FibGVkID0gcGFnZSA9PT0gMTtcbiAgY29uc3QgaXNOZXh0RGlzYWJsZWQgPSAoZmlsdGVyZWRDb3VudCAtIChwYWdlICogc2l6ZSkpIDw9IDA7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2PlxuICAgICAgPGJ1dHRvbiB0YWJJbmRleD1cIi0xXCIgb25DbGljaz17c2VsZWN0UHJldmlvdXNQYWdlfSBkaXNhYmxlZD17aXNQcmV2aW91c0Rpc2FibGVkfT5cbiAgICAgICAgUHJldmlvdXNcbiAgICAgIDwvYnV0dG9uPlxuICAgICAgPHNtYWxsPiBQYWdlIC0ge3BhZ2UgfHwgMX0gPC9zbWFsbD5cbiAgICAgIDxidXR0b24gdGFiSW5kZXg9XCItMVwiIG9uQ2xpY2s9e3NlbGVjdE5leHRQYWdlfSBkaXNhYmxlZD17aXNOZXh0RGlzYWJsZWR9PlxuICAgICAgICBOZXh0XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmNvbnN0IFN1bW1hcnlGb290ZXIgPSBzdWJzY3JpYmVUb1N1bW1hcnkoU3VtbWFyeSk7XG5jb25zdCBQYWdpbmF0aW9uID0gc3Vic2NyaWJlVG9TdW1tYXJ5KChwcm9wcywgYWN0aW9ucykgPT4gPFBhZ2VyIHsuLi5wcm9wc30gc2xpY2U9e2FjdGlvbnMuc2xpY2V9Lz4pO1xuY29uc3QgU2VsZWN0UGFnZVNpemUgPSBzdWJzY3JpYmVUb1N1bW1hcnkoKHByb3BzLCBhY3Rpb25zKSA9PiA8UGFnZVNpemUgey4uLnByb3BzfSBzbGljZT17YWN0aW9ucy5zbGljZX0vPik7XG5cbmV4cG9ydCBjb25zdCBGb290ZXIgPSAoKSA9PiA8dGZvb3Q+XG48dHI+XG4gIDx0ZCBjb2xzcGFuPVwiM1wiPlxuICAgIDxTdW1tYXJ5Rm9vdGVyLz5cbiAgPC90ZD5cbiAgPHRkIGNvbHNwYW49XCIyXCIgZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cImJ1dHRvbjpub3QoOmRpc2FibGVkKVwiIGNvbFNwYW49XCIzXCI+XG4gICAgPFBhZ2luYXRpb24vPlxuICA8L3RkPlxuICA8dGQgZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cInNlbGVjdFwiPlxuICAgIDxTZWxlY3RQYWdlU2l6ZS8+XG4gIDwvdGQ+XG48L3RyPlxuPC90Zm9vdD47XG5cblxuXG4iLCJleHBvcnQgY29uc3QgZmluZENvbnRhaW5lciA9IChlbGVtZW50LCBzZWxlY3RvcikgPT4gZWxlbWVudC5tYXRjaGVzKHNlbGVjdG9yKSA9PT0gdHJ1ZSA/IGVsZW1lbnQgOiBmaW5kQ29udGFpbmVyKGVsZW1lbnQucGFyZW50RWxlbWVudCwgc2VsZWN0b3IpO1xuZXhwb3J0IGNvbnN0IGRhdGFTZWxlY3RvckF0dHJpYnV0ZSA9ICdkYXRhLWtleWJvYXJkLXNlbGVjdG9yJztcbmV4cG9ydCBjb25zdCBkYXRhU2tpcEF0dHJpYnV0ZSA9ICdkYXRhLWtleWJvYXJkLXNraXAnO1xuZXhwb3J0IGNvbnN0IHZhbEZ1bmMgPSB2YWwgPT4gKCkgPT4gdmFsO1xuZXhwb3J0IGNvbnN0IHZhbE51bGwgPSB2YWxGdW5jKG51bGwpOyIsImltcG9ydCB7XG4gIGZpbmRDb250YWluZXIsXG4gIGRhdGFTZWxlY3RvckF0dHJpYnV0ZSxcbiAgZGF0YVNraXBBdHRyaWJ1dGUsXG4gIHZhbEZ1bmNcbn0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ3VsYXJDZWxsIChlbGVtZW50LCB7cm93U2VsZWN0b3IsIGNlbGxTZWxlY3Rvcn0pIHtcbiAgY29uc3Qgcm93ID0gZmluZENvbnRhaW5lcihlbGVtZW50LCByb3dTZWxlY3Rvcik7XG4gIGNvbnN0IGNlbGxzID0gWy4uLnJvdy5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICBjb25zdCBpbmRleCA9IGNlbGxzLmluZGV4T2YoZWxlbWVudCk7XG4gIGNvbnN0IHJldHVybkVsID0gdmFsRnVuYyhlbGVtZW50KTtcbiAgcmV0dXJuIHtcbiAgICBzZWxlY3RGcm9tQWZ0ZXI6IHJldHVybkVsLFxuICAgIHNlbGVjdEZyb21CZWZvcmU6IHJldHVybkVsLFxuICAgIG5leHQoKXtcbiAgICAgIHJldHVybiBjZWxsc1tpbmRleCArIDFdICE9PSB2b2lkIDAgPyBjZWxsc1tpbmRleCArIDFdIDogbnVsbDtcbiAgICB9LFxuICAgIHByZXZpb3VzKCl7XG4gICAgICByZXR1cm4gY2VsbHNbaW5kZXggLSAxXSAhPT0gdm9pZCAwID8gY2VsbHNbaW5kZXggLSAxXSA6IG51bGw7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBza2lwQ2VsbCAoZWxlbWVudCwgb3B0aW9ucykge1xuICBjb25zdCByZWcgPSByZWd1bGFyQ2VsbChlbGVtZW50LCBvcHRpb25zKTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2aW91czogcmVnLnByZXZpb3VzLFxuICAgIG5leHQ6IHJlZy5uZXh0XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2l0ZUNlbGwgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgY29uc3QgY2VsbEVsZW1lbnQgPSBmaW5kQ29udGFpbmVyKGVsZW1lbnQsIG9wdGlvbnMuY2VsbFNlbGVjdG9yKTtcbiAgY29uc3Qgc2VsZWN0b3IgPSBjZWxsRWxlbWVudC5nZXRBdHRyaWJ1dGUoZGF0YVNlbGVjdG9yQXR0cmlidXRlKTtcbiAgY29uc3Qgc3ViV2lkZ2V0cyA9IFsuLi5jZWxsRWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKV07XG4gIGNvbnN0IHdpZGdldHNMZW5ndGggPSBzdWJXaWRnZXRzLmxlbmd0aDtcbiAgY29uc3QgaXNTdWJXaWRnZXQgPSBlbGVtZW50ICE9PSBjZWxsRWxlbWVudDtcbiAgcmV0dXJuIHtcbiAgICBzZWxlY3RGcm9tQmVmb3JlKCl7XG4gICAgICByZXR1cm4gaXNTdWJXaWRnZXQgPyBlbGVtZW50IDogc3ViV2lkZ2V0c1swXTtcbiAgICB9LFxuICAgIHNlbGVjdEZyb21BZnRlcigpe1xuICAgICAgcmV0dXJuIGlzU3ViV2lkZ2V0ID8gZWxlbWVudCA6IHN1YldpZGdldHNbd2lkZ2V0c0xlbmd0aCAtIDFdO1xuICAgIH0sXG4gICAgbmV4dCgpe1xuICAgICAgY29uc3QgaW5kZXggPSBzdWJXaWRnZXRzLmluZGV4T2YoZWxlbWVudCk7XG4gICAgICBpZiAoaXNTdWJXaWRnZXQgJiYgaW5kZXggKyAxIDwgd2lkZ2V0c0xlbmd0aCkge1xuICAgICAgICByZXR1cm4gc3ViV2lkZ2V0c1tpbmRleCArIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlZ3VsYXJDZWxsKGNlbGxFbGVtZW50LCBvcHRpb25zKS5uZXh0KCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBwcmV2aW91cygpe1xuICAgICAgY29uc3QgaW5kZXggPSBzdWJXaWRnZXRzLmluZGV4T2YoZWxlbWVudCk7XG4gICAgICBpZiAoaXNTdWJXaWRnZXQgJiYgaW5kZXggPiAwKSB7XG4gICAgICAgIHJldHVybiBzdWJXaWRnZXRzW2luZGV4IC0gMV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVndWxhckNlbGwoY2VsbEVsZW1lbnQsIG9wdGlvbnMpLnByZXZpb3VzKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDZWxsIChlbCwgb3B0aW9ucykge1xuICBpZiAoZWwgPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBlbHNlIGlmIChlbC5oYXNBdHRyaWJ1dGUoZGF0YVNraXBBdHRyaWJ1dGUpKSB7XG4gICAgcmV0dXJuIHNraXBDZWxsKGVsLCBvcHRpb25zKTtcbiAgfSBlbHNlIGlmIChlbC5oYXNBdHRyaWJ1dGUoZGF0YVNlbGVjdG9yQXR0cmlidXRlKSB8fCAhZWwubWF0Y2hlcyhvcHRpb25zLmNlbGxTZWxlY3RvcikpIHtcbiAgICByZXR1cm4gY29tcG9zaXRlQ2VsbChlbCwgb3B0aW9ucyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHJlZ3VsYXJDZWxsKGVsLCBvcHRpb25zKTtcbiAgfVxufSIsImltcG9ydCB7ZmluZENvbnRhaW5lciwgZGF0YVNraXBBdHRyaWJ1dGV9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWd1bGFyUm93IChlbGVtZW50LCBncmlkLCB7cm93U2VsZWN0b3IgPSAndHInLCBjZWxsU2VsZWN0b3IgPSAndGgsdGQnfT17fSkge1xuICBjb25zdCByb3dzID0gWy4uLmdyaWQucXVlcnlTZWxlY3RvckFsbChyb3dTZWxlY3RvcildO1xuICBjb25zdCBjZWxscyA9IFsuLi5lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoY2VsbFNlbGVjdG9yKV07XG4gIGNvbnN0IGluZGV4ID0gcm93cy5pbmRleE9mKGVsZW1lbnQpO1xuICByZXR1cm4ge1xuICAgIHByZXZpb3VzKCl7XG4gICAgICByZXR1cm4gcm93c1tpbmRleCAtIDFdICE9PSB2b2lkIDAgPyByb3dzW2luZGV4IC0gMV0gOiBudWxsO1xuICAgIH0sXG4gICAgbmV4dCgpe1xuICAgICAgcmV0dXJuIHJvd3NbaW5kZXggKyAxXSAhPT0gdm9pZCAwID8gcm93c1tpbmRleCArIDFdIDogbnVsbDtcbiAgICB9LFxuICAgIGl0ZW0oaW5kZXgpe1xuICAgICAgcmV0dXJuIGNlbGxzW2luZGV4XSAhPT0gdm9pZCAwID8gY2VsbHNbaW5kZXhdIDogbnVsbDtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBza2lwUm93IChlbGVtZW50LCBncmlkLCBvcHRpb25zKSB7XG4gIGNvbnN0IHJlZ3VsYXIgPSByZWd1bGFyUm93KGVsZW1lbnQsIGdyaWQsIG9wdGlvbnMpO1xuICByZXR1cm4ge1xuICAgIHByZXZpb3VzOiByZWd1bGFyLnByZXZpb3VzLFxuICAgIG5leHQ6IHJlZ3VsYXIubmV4dFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUm93ICh0YXJnZXQsIGdyaWQsIHtyb3dTZWxlY3RvciwgY2VsbFNlbGVjdG9yfT17fSkge1xuICBpZiAodGFyZ2V0ID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgY29uc3QgciA9IGZpbmRDb250YWluZXIodGFyZ2V0LCByb3dTZWxlY3Rvcik7XG4gIHJldHVybiByLmhhc0F0dHJpYnV0ZShkYXRhU2tpcEF0dHJpYnV0ZSkgPyBza2lwUm93KHIsIGdyaWQsIHtcbiAgICAgIHJvd1NlbGVjdG9yLFxuICAgICAgY2VsbFNlbGVjdG9yXG4gICAgfSkgOiByZWd1bGFyUm93KHRhcmdldCwgZ3JpZCwge3Jvd1NlbGVjdG9yLCBjZWxsU2VsZWN0b3J9KTtcbn0iLCJpbXBvcnQge2NyZWF0ZUNlbGx9IGZyb20gJy4vY2VsbCc7XG5pbXBvcnQge2NyZWF0ZVJvd30gZnJvbSAnLi9yb3cnO1xuaW1wb3J0IHtmaW5kQ29udGFpbmVyfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgZnVuY3Rpb24ga2V5R3JpZCAoZ3JpZCwgb3B0aW9ucykge1xuICBjb25zdCB7cm93U2VsZWN0b3IsIGNlbGxTZWxlY3Rvcn0gPSBvcHRpb25zO1xuICByZXR1cm4ge1xuICAgIG1vdmVSaWdodCh0YXJnZXQpe1xuICAgICAgY29uc3QgY2VsbCA9IGNyZWF0ZUNlbGwodGFyZ2V0LCBvcHRpb25zKTtcbiAgICAgIGxldCBuZXdDZWxsID0gY3JlYXRlQ2VsbChjZWxsLm5leHQoKSwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Q2VsbCAhPT0gbnVsbCAmJiBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUgPT09IHZvaWQgMCkge1xuICAgICAgICBuZXdDZWxsID0gY3JlYXRlQ2VsbChuZXdDZWxsLm5leHQoKSwgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3Q2VsbCAhPT0gbnVsbCA/IG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSgpIDogdGFyZ2V0O1xuICAgIH0sXG4gICAgbW92ZUxlZnQodGFyZ2V0KXtcbiAgICAgIGNvbnN0IGNlbGwgPSBjcmVhdGVDZWxsKHRhcmdldCwgb3B0aW9ucyk7XG4gICAgICBsZXQgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwoY2VsbC5wcmV2aW91cygpLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdDZWxsICE9PSBudWxsICYmIG5ld0NlbGwuc2VsZWN0RnJvbUFmdGVyID09PSB2b2lkIDApIHtcbiAgICAgICAgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Q2VsbC5wcmV2aW91cygpLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXdDZWxsICE9PSBudWxsID8gbmV3Q2VsbC5zZWxlY3RGcm9tQWZ0ZXIoKSA6IHRhcmdldDtcbiAgICB9LFxuICAgIG1vdmVVcCh0YXJnZXQpe1xuICAgICAgY29uc3Qgcm93RWxlbWVudCA9IGZpbmRDb250YWluZXIodGFyZ2V0LCByb3dTZWxlY3Rvcik7XG4gICAgICBjb25zdCBjZWxscyA9IFsuLi5yb3dFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoY2VsbFNlbGVjdG9yKV07XG4gICAgICBjb25zdCByb3cgPSBjcmVhdGVSb3cocm93RWxlbWVudCwgZ3JpZCwgb3B0aW9ucyk7XG4gICAgICBsZXQgbmV3Um93ID0gY3JlYXRlUm93KHJvdy5wcmV2aW91cygpLCBncmlkLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdSb3cgIT09IG51bGwgJiYgbmV3Um93Lml0ZW0gPT09IHZvaWQgMCkge1xuICAgICAgICBuZXdSb3cgPSBjcmVhdGVSb3cobmV3Um93LnByZXZpb3VzKCksIGdyaWQsIG9wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICBpZiAobmV3Um93ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgICB9XG5cbiAgICAgIGxldCBhc2tlZEluZGV4ID0gY2VsbHMuaW5kZXhPZihmaW5kQ29udGFpbmVyKHRhcmdldCwgY2VsbFNlbGVjdG9yKSk7XG4gICAgICBsZXQgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Um93Lml0ZW0oYXNrZWRJbmRleCksIG9wdGlvbnMpO1xuICAgICAgd2hpbGUgKG5ld0NlbGwgPT09IG51bGwgfHwgbmV3Q2VsbC5zZWxlY3RGcm9tQmVmb3JlID09PSB2b2lkIDAgJiYgYXNrZWRJbmRleCA+IDApIHtcbiAgICAgICAgYXNrZWRJbmRleC0tO1xuICAgICAgICBuZXdDZWxsID0gY3JlYXRlQ2VsbChuZXdSb3cuaXRlbShhc2tlZEluZGV4KSwgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3Q2VsbC5zZWxlY3RGcm9tQmVmb3JlKCk7XG4gICAgfSxcbiAgICBtb3ZlRG93bih0YXJnZXQpe1xuICAgICAgY29uc3Qgcm93RWxlbWVudCA9IGZpbmRDb250YWluZXIodGFyZ2V0LCByb3dTZWxlY3Rvcik7XG4gICAgICBjb25zdCBjZWxscyA9IFsuLi5yb3dFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoY2VsbFNlbGVjdG9yKV07XG4gICAgICBjb25zdCByb3cgPSBjcmVhdGVSb3cocm93RWxlbWVudCwgZ3JpZCwgb3B0aW9ucyk7XG4gICAgICBsZXQgbmV3Um93ID0gY3JlYXRlUm93KHJvdy5uZXh0KCksIGdyaWQsIG9wdGlvbnMpO1xuICAgICAgd2hpbGUgKG5ld1JvdyAhPT0gbnVsbCAmJiBuZXdSb3cuaXRlbSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIG5ld1JvdyA9IGNyZWF0ZVJvdyhuZXdSb3cubmV4dCgpLCBncmlkLCBvcHRpb25zKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1JvdyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgfVxuXG4gICAgICBsZXQgYXNrZWRJbmRleCA9IGNlbGxzLmluZGV4T2YoZmluZENvbnRhaW5lcih0YXJnZXQsIGNlbGxTZWxlY3RvcikpO1xuICAgICAgbGV0IG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld1Jvdy5pdGVtKGFza2VkSW5kZXgpLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdDZWxsID09PSBudWxsIHx8IG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSA9PT0gdm9pZCAwICYmIGFza2VkSW5kZXggPiAwKSB7XG4gICAgICAgIGFza2VkSW5kZXgtLTtcbiAgICAgICAgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Um93Lml0ZW0oYXNrZWRJbmRleCksIG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSgpO1xuICAgIH1cbiAgfVxufSIsImltcG9ydCB7a2V5R3JpZH0gZnJvbSAnLi9saWIva2V5Z3JpZCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChncmlkLCB7cm93U2VsZWN0b3IgPSAndHInLCBjZWxsU2VsZWN0b3IgPSAndGQsdGgnfT17fSkge1xuICBsZXQgbGFzdEZvY3VzID0gbnVsbDtcbiAgY29uc3Qga2cgPSBrZXlHcmlkKGdyaWQsIHtyb3dTZWxlY3RvciwgY2VsbFNlbGVjdG9yfSk7XG5cbiAgZ3JpZC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKHt0YXJnZXQsIGtleUNvZGV9KSA9PiB7XG4gICAgbGV0IG5ld0NlbGwgPSBudWxsO1xuICAgIGlmIChrZXlDb2RlID09PSAzNykge1xuICAgICAgbmV3Q2VsbCA9IGtnLm1vdmVMZWZ0KHRhcmdldCk7XG4gICAgfSBlbHNlIGlmIChrZXlDb2RlID09PSAzOCkge1xuICAgICAgbmV3Q2VsbCA9IGtnLm1vdmVVcCh0YXJnZXQpO1xuICAgIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gMzkpIHtcbiAgICAgIG5ld0NlbGwgPSBrZy5tb3ZlUmlnaHQodGFyZ2V0KTtcbiAgICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDQwKSB7XG4gICAgICBuZXdDZWxsID0ga2cubW92ZURvd24odGFyZ2V0KTtcbiAgICB9XG5cbiAgICBpZiAobmV3Q2VsbCAhPT0gbnVsbCkge1xuICAgICAgbmV3Q2VsbC5mb2N1cygpO1xuICAgICAgaWYgKGxhc3RGb2N1cyAhPT0gbnVsbCkge1xuICAgICAgICBsYXN0Rm9jdXMuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICctMScpO1xuICAgICAgfVxuICAgICAgbmV3Q2VsbC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgICAgIGxhc3RGb2N1cyA9IG5ld0NlbGw7XG4gICAgfVxuICB9KTtcbn0iLCJpbXBvcnQge2gsIG1vdW50LCBvbk1vdW50fSBmcm9tICcuLi8uLi9pbmRleCc7XG5pbXBvcnQge1BlcnNvbkxpc3R9IGZyb20gJy4vY29tcG9uZW50cy90Ym9keSc7XG5pbXBvcnQge1dvcmtJblByb2dyZXNzfSBmcm9tICcuL2NvbXBvbmVudHMvbG9hZGluZ0luZGljYXRvcic7XG5pbXBvcnQge0hlYWRlcnN9IGZyb20gJy4vY29tcG9uZW50cy9oZWFkZXJzJztcbmltcG9ydCB7Rm9vdGVyfSBmcm9tICcuL2NvbXBvbmVudHMvZm9vdGVyJztcbmltcG9ydCBzdG9yZSBmcm9tICcuL2xpYi9zdG9yZSc7XG5pbXBvcnQga2V5Ym9hcmQgZnJvbSAnc21hcnQtdGFibGUta2V5Ym9hcmQnO1xuXG5jb25zdCB0YWJsZSA9IG9uTW91bnQobiA9PiB7XG4gIHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnZXhlYycsIGFyZ3M6IFtdfSk7IC8va2ljayBzbWFydFRhYmxlXG4gIGtleWJvYXJkKG4uZG9tLnF1ZXJ5U2VsZWN0b3IoJ3RhYmxlJykpO1xufSk7XG5cbmNvbnN0IFBlcnNvblRhYmxlID0gdGFibGUoKCkgPT5cbiAgPGRpdiBpZD1cInRhYmxlLWNvbnRhaW5lclwiPlxuICAgIDxXb3JrSW5Qcm9ncmVzcy8+XG4gICAgPHRhYmxlPlxuICAgICAgPEhlYWRlcnMvPlxuICAgICAgPFBlcnNvbkxpc3QvPlxuICAgICAgPEZvb3Rlci8+XG4gICAgPC90YWJsZT5cbiAgPC9kaXY+KTtcblxubW91bnQoUGVyc29uVGFibGUsIHt9LCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWFpbicpKTsiXSwibmFtZXMiOlsibW91bnQiLCJzd2FwIiwiY29tcG9zZSIsImN1cnJ5IiwidGFwIiwicG9pbnRlciIsImZpbHRlciIsInNvcnRGYWN0b3J5Iiwic29ydCIsInNlYXJjaCIsInRhYmxlIiwidGFibGVEaXJlY3RpdmUiLCJzbWFydFRhYmxlIiwiYWN0aW9ucyIsInNsaWNlU3RhdGUiLCJqc29uIl0sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNLGVBQWUsR0FBRyxDQUFDLEtBQUssTUFBTTtFQUNsQyxRQUFRLEVBQUUsTUFBTTtFQUNoQixRQUFRLEVBQUUsRUFBRTtFQUNaLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQztFQUNkLFNBQVMsRUFBRSxDQUFDO0NBQ2IsQ0FBQyxDQUFDOzs7Ozs7Ozs7QUFTSCxBQUFnQixTQUFTLENBQUMsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsUUFBUSxFQUFFO0VBQ3hELE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxLQUFLO0lBQ25E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
