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

function swap (f) {
  return (a, b) => f(b, a);
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
  const compareFunc = direction === 'desc' ? swap(orderFunc) : orderFunc;

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
      return compose(String, (val) => val.toLowerCase());
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
  const operateOnTyped = compose(typeIt, operators[operator]);
  const predicateFunc = operateOnTyped(value);
  return compose(typeIt, predicateFunc);
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
    return compose(getter, every(clauses));
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
  return {get, set: curry(set)};
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

  const safeAssign = curry((base, extension) => Object.assign({}, base, extension));
  const dispatch = curry(table.dispatch.bind(table), 2);

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
        const execFunc = compose(filterFunc, searchFunc, tap(dispatchSummary), sortFunc, sliceFunc);
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

  const updateTableState = curry((pter, ev, newPartialState) => compose(
    safeAssign(pter.get(tableState)),
    tap(dispatch(ev)),
    pter.set(tableState)
  )(newPartialState));

  const resetToFirstPage = () => updateTableState(slicePointer, PAGE_CHANGED, {page: 1});

  const tableOperation = (pter, ev) => compose(
    updateTableState(pter, ev),
    resetToFirstPage,
    () => table.exec() // we wrap within a function so table.exec can be overwritten (when using with a server for example)
  );

  const api = {
    sort: tableOperation(sortPointer, TOGGLE_SORT),
    filter: tableOperation(filterPointer, FILTER_CHANGED),
    search: tableOperation(searchPointer, SEARCH_CHANGED),
    slice: compose(updateTableState(slicePointer, PAGE_CHANGED), () => table.exec()),
    exec,
    eval(state = tableState){
      return Promise.resolve()
        .then(function () {
          const sortFunc = sortFactory(sortPointer.get(state));
          const searchFunc = searchFactory(searchPointer.get(state));
          const filterFunc = filterFactory(filterPointer.get(state));
          const sliceFunc = sliceFactory(slicePointer.get(state));
          const execFunc = compose(filterFunc, searchFunc, sortFunc, sliceFunc);
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

var table$2 = function ({
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

const get = curry((array, index) => array[index]);
const replace = curry((array, newVal, index) => array.map((val, i) => (index === i ) ? newVal : val));
const patch = curry((array, newVal, index) => replace(array, Object.assign(array[index], newVal), index));
const remove = curry((array, index) => array.filter((val, i) => index !== i));
const insert = curry((array, newVal, index) => [...array.slice(0, index), newVal, ...array.slice(index)]);

var crud = function ({data, table}) {
  // empty and refill data keeping the same reference
  const mutateData = (newData) => {
    data.splice(0);
    data.push(...newData);
  };
  const refresh = compose(mutateData, table.exec);
  return {
    update(index,newVal){
      return compose(replace(data,newVal),refresh)(index);
    },
    patch(index, newVal){
      return patch(data, newVal, index);
    },
    remove: compose(remove(data), refresh),
    insert(newVal, index = 0){
      return compose(insert(data, newVal), refresh)(index);
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

const createTextVNode$1 = (value) => ({
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
      return type === 'object' || type === 'function' ? child : createTextVNode$1(child);
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

const nextTick$1 = fn => setTimeout(fn, 0);

const pairify$1 = holder => key => [key, holder[key]];

const isShallowEqual$1 = (a, b) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k]);
};

const ownKeys$1 = obj => Object.keys(obj).filter(k => obj.hasOwnProperty(k));

const isDeepEqual$1 = (a, b) => {
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
    return a.length && b.length && a.every((item, i) => isDeepEqual$1(a[i], b[i]));
  }

  const aKeys = ownKeys$1(a);
  const bKeys = ownKeys$1(b);
  return aKeys.length === bKeys.length && aKeys.every(k => isDeepEqual$1(a[k], b[k]));
};

const identity$1 = p => p;

const noop$1 = () => {
};

const updateDomNodeFactory$1 = (method) => (items) => tap$1(domNode => {
  for (let pair of items) {
    domNode[method](...pair);
  }
});

const removeEventListeners$1 = updateDomNodeFactory$1('removeEventListener');
const addEventListeners$1 = updateDomNodeFactory$1('addEventListener');
const setAttributes$1 = (items) => tap$1((domNode) => {
  const attributes = items.filter(([key, value]) => typeof value !== 'function');
  for (let [key, value] of attributes) {
    value === false ? domNode.removeAttribute(key) : domNode.setAttribute(key, value);
  }
});
const removeAttributes$1 = (items) => tap$1(domNode => {
  for (let attr of items) {
    domNode.removeAttribute(attr);
  }
});

const setTextNode$1 = val => node => node.textContent = val;

const createDomNode$1 = vnode => {
  return vnode.nodeType !== 'Text' ?
    document.createElement(vnode.nodeType) :
    document.createTextNode(String(vnode.props.value));
};

const getEventListeners$1 = (props) => {
  return Object.keys(props)
    .filter(k => k.substr(0, 2) === 'on')
    .map(k => [k.substr(2).toLowerCase(), props[k]]);
};

const traverse$1 = function * (vnode) {
  yield vnode;
  if (vnode.children && vnode.children.length) {
    for (let child of vnode.children) {
      yield * traverse$1(child);
    }
  }
};

function updateEventListeners$1 ({props:newNodeProps}={}, {props:oldNodeProps}={}) {
  const newNodeEvents = getEventListeners$1(newNodeProps || {});
  const oldNodeEvents = getEventListeners$1(oldNodeProps || {});

  return newNodeEvents.length || oldNodeEvents.length ?
    compose$1(
      removeEventListeners$1(oldNodeEvents),
      addEventListeners$1(newNodeEvents)
    ) : noop$1;
}

function updateAttributes$1 (newVNode, oldVNode) {
  const newVNodeProps = newVNode.props || {};
  const oldVNodeProps = oldVNode.props || {};

  if (isShallowEqual$1(newVNodeProps, oldVNodeProps)) {
    return noop$1;
  }

  if (newVNode.nodeType === 'Text') {
    return setTextNode$1(newVNode.props.value);
  }

  const newNodeKeys = Object.keys(newVNodeProps);
  const oldNodeKeys = Object.keys(oldVNodeProps);
  const attributesToRemove = oldNodeKeys.filter(k => !newNodeKeys.includes(k));

  return compose$1(
    removeAttributes$1(attributesToRemove),
    setAttributes$1(newNodeKeys.map(pairify$1(newVNodeProps)))
  );
}

const domFactory$1 = createDomNode$1;

// apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
const domify$1 = function updateDom (oldVnode, newVnode, parentDomNode) {
  if (!oldVnode) {//there is no previous vnode
    if (newVnode) {//new node => we insert
      newVnode.dom = parentDomNode.appendChild(domFactory$1(newVnode));
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
      newVnode.dom = domFactory$1(newVnode);
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
const render$1 = function renderer (oldVnode, newVnode, parentDomNode, onNextTick = []) {

  //1. transform the new vnode to a vnode connected to an actual dom element based on vnode versions diffing
  // i. note at this step occur dom insertions/removals
  // ii. it may collect sub tree to be dropped (or "unmounted")
  const {vnode, garbage} = domify$1(oldVnode, newVnode, parentDomNode);

  if (garbage !== null) {
    // defer unmount lifecycle as it is not "visual"
    for (let g of traverse$1(garbage)) {
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

    updateAttributes$1(vnode, tempOldNode)(vnode.dom);

    //fast path
    if (vnode.nodeType === 'Text') {
      return onNextTick;
    }

    if (vnode.onMount && vnode.lifeCycle === 1) {
      onNextTick.push(() => vnode.onMount());
    }

    const childrenCount = Math.max(tempOldNode.children.length, vnode.children.length);

    //async will be deferred as it is not "visual"
    const setListeners = updateEventListeners$1(vnode, tempOldNode);
    if (setListeners !== noop$1) {
      onNextTick.push(() => setListeners(vnode.dom));
    }

    //3 recursively traverse children to update dom and collect functions to process on next tick
    if (childrenCount > 0) {
      for (let i = 0; i < childrenCount; i++) {
        // we pass onNextTick as reference (improve perf: memory + speed)
        render$1(tempOldNode.children[i], vnode.children[i], vnode.dom, onNextTick);
      }
    }
  }

  return onNextTick;
};

/**
 * Create a function which will trigger an update of the component with the passed state
 * @param comp
 * @param initialVNode
 * @returns {function(*=, ...[*])}
 */
function update$1 (comp, initialVNode) {
  let oldNode = initialVNode;
  const updateFunc = (props, ...args) => {
    const mount$$1 = oldNode.dom.parentNode;
    const newNode = comp(Object.assign({children: oldNode.children || []}, oldNode.props, props), ...args);
    const nextBatch = render$1(oldNode, newNode, mount$$1);

    // danger zone !!!!
    // change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream: oldNode may be the child of someone ...(well that is a tree data structure after all :P )
    oldNode = Object.assign(oldNode || {}, newNode);
    // end danger zone

    nextTick$1(function () {
      for (let op of nextBatch) {
        op();
      }
    });
    return newNode;
  };
  return updateFunc;
}

const lifeCycleFactory$1 = method => curry$1((fn, comp) => (props, ...args) => {
  const n = comp(props, ...args);
  n[method] = () => fn(n, ...args);
  return n;
});

/**
 * life cycle: when the component is mounted
 */
const onMount$1 = lifeCycleFactory$1('onMount');

/**
 * life cycle: when the component is unmounted
 */
const onUnMount$1 = lifeCycleFactory$1('onUnMount');

const onUpdate$1 = lifeCycleFactory$1('onUpdate');

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp
 * @returns {Function}
 */

//todo throw this in favor of connect only ?

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change under specific circumstances
 */
var connect$1 = function (store, actions = {}, sliceState = identity$1) {
  return function (comp, mapStateToProp = identity$1, shouldUpate = (a, b) => isDeepEqual$1(a, b) === false) {
    return function (initProp) {
      let componentProps = initProp;
      let updateFunc, previousStateSlice, unsubscriber;

      const wrapperComp = (props, ...args) => {
        return comp(props, actions, ...args);
      };

      const subscribe = onMount$1((vnode) => {
        updateFunc = update$1(wrapperComp, vnode);
        unsubscriber = store.subscribe(() => {
          const stateSlice = sliceState(store.getState());
          if (shouldUpate(previousStateSlice, stateSlice) === true) {
            Object.assign(componentProps, mapStateToProp(stateSlice));
            updateFunc(componentProps);
            previousStateSlice = stateSlice;
          }
        });
      });

      const unsubscribe = onUnMount$1(() => {
        unsubscriber();
      });

      return compose$1(subscribe, unsubscribe)(wrapperComp);
    };
  };
};

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

const autoFocus = onMount$1(n => n.dom.focus());
const Input = autoFocus(props => {
  delete  props.children; //no children for inputs
  return h$1( 'input', props)
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
const subscribeToDisplay = connect$1(store, actions, sliceState);
const focusFirstCell = onUpdate$1(vnode => {
  const firstCell = vnode.dom.querySelector('td');
  if (firstCell !== null) {
    firstCell.focus();
  }
});

const TBody = focusFirstCell(({persons = [], patch, remove}) => {
  return persons.length ? h$1( 'tbody', null,
    persons.map(({value, index}) => h$1( 'tr', null,
        h$1( EditableLastName, { className: "col-lastname", person: value, index: index, patch: patch }),
        h$1( EditableFirstName, { className: "col-firstname", person: value, index: index, patch: patch }),
        h$1( EditableBirthDate, { className: "col-birthdate", person: value, index: index, patch: patch }),
        h$1( EditableGender, { className: "col-gender fixed-size", person: value, index: index, patch: patch }),
        h$1( EditableSize, { className: "col-size fixed-size", person: value, index: index, patch: patch }),
        h$1( 'td', { class: "fixed-size col-actions", 'data-keyboard-selector': "button" },
          h$1( 'button', { tabindex: "-1", onClick: () => remove(index) }, "R")
        )
      ))
    ) : h$1( 'tbody', null,
    h$1( 'tr', null,
      h$1( 'td', { tabIndex: "-1", colSpan: "6" }, "There is no data matching your request")
    )
    )
});

const PersonListComponent = (props, actions) => {
  return h$1( TBody, { persons: props.persons, remove: actions.remove, patch: actions.patch })
};

const PersonList = subscribeToDisplay(PersonListComponent, mapStateToProp, doesUpdateList);

const actions$1 = {};
const sliceState$1 = state => ({isProcessing: state.isProcessing});
const subscribeToProcessing = connect$1(store, actions$1, sliceState$1);

const LoadingIndicator = ({isProcessing}) => {
  const className = isProcessing === true ? 'st-working' : '';
  const message = isProcessing === true ? 'loading persons data' : 'data loaded';
  return h$1( 'div', { id: "overlay", 'aria-live': "assertive", role: "alert", class: className },
    message
  );
};
const WorkInProgress = subscribeToProcessing(LoadingIndicator);

const actions$2 = {
  toggleSort: ({pointer: pointer$$1, direction}) => store.dispatch({type: 'sort', args: [{pointer: pointer$$1, direction}]})
};
const sliceState$2 = pointer('tableState.sort').get;
const subscribeToSort = connect$1(store, actions$2, sliceState$2);

const SortButtonComponent = (props => {
  const {columnPointer, sortDirections = ['asc', 'desc'], pointer: pointer$$1, direction, sort} = props;
  const actualCursor = columnPointer !== pointer$$1 ? -1 : sortDirections.indexOf(direction);
  const newCursor = (actualCursor + 1 ) % sortDirections.length;
  const toggleSort = () => sort({pointer: columnPointer, direction: sortDirections[newCursor]});
  return h$1( 'button', { tabindex: "-1", onClick: toggleSort }, "B")
});

const SortButton = subscribeToSort((props, actions) =>
  h$1( SortButtonComponent, Object.assign({}, props, { sort: actions.toggleSort })));

const actions$3 = {
  search: (value, scope) => store.dispatch({type: 'search', args: [{value, scope}]})
};
const sliceState$3 = pointer('tableState.search').get;
const noNeedForUpdate = state => false;// always return the same value
const searchable = connect$1(store, actions$3, sliceState$3);

const SearchInput = (props) => (h$1( 'label', null,
  h$1( 'span', null, props.children ),
  h$1( 'input', { tabindex: "0", type: "search", onInput: props.onInput, placeholder: props.placeholder })
));

const SearchRow = searchable((props, actions) => {
  const onInput = debounce(ev => actions.search(ev.target.value, ['name.last', 'name.first']), 300);
  delete props.children;
  return h$1( 'tr', props,
    h$1( 'th', { 'data-keyboard-selector': "input" },
      h$1( SearchInput, { placeholder: "Case sensitive search on surname and name", onInput: onInput }, "Search:")
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
  return h( 'button', { 'aria-haspopup': "true", tabindex: "-1", class: isActive ? 'active-filter' : '', 'aria-controls': controlled, onClick: onClick }, "F")
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

  return h$1( 'th', { class: className, 'data-keyboard-selector': "button" },
    children,
    h$1( 'div', { class: "buttons-container" },
      h$1( SortButton, { columnPointer: columnPointer, sortDirections: sortDirections }),
      h$1( ToggleFilterButton, { columnPointer: columnPointer })
    )
  )
};


const Headers = () => {

  return h$1( 'thead', null,
  h$1( SearchRow, { class: "filter-row" }),
  h$1( 'tr', null,
    h$1( ColumnHeader, { className: "col-lastname", columnPointer: "name.last", sortDirections: ['asc', 'desc', 'none'] }, "Surname"),
    h$1( ColumnHeader, { className: "col-firstname", columnPointer: "name.first" }, "Name"),
    h$1( ColumnHeader, { className: "col-birthdate", sortDirections: ['desc', 'asc'], columnPointer: "birthDate" }, "Date of birth"),
    h$1( ColumnHeader, { className: "col-gender fixed-size", columnPointer: "gender" }, "Gender"),
    h$1( ColumnHeader, { className: "col-size fixed-size", columnPointer: "size" }, "Size"),
    h$1( 'th', { 'data-keyboard-skip': true, class: "fixed-size col-actions" })
  ),
  h$1( FilterRow, { scope: "name.last" },
    h$1( 'label', null,
      h$1( 'span', null, "surname includes:" ),
      h$1( 'input', { 'aria-describedby': "filter-name-last-instruction", onKeyDown: trapKeydown(27, 38, 40), type: "text", placeholder: "case insensitive surname value" })
    )
  ),
  h$1( FilterRow, { scope: "name.first" },
    h$1( 'label', null,
      h$1( 'span', null, "name includes:" ),
      h$1( 'input', { onKeyDown: trapKeydown(27, 38, 40), type: "text", placeholder: "case insensitive name value" })
    )
  ),
  h$1( FilterRow, { scope: "birthDate" },
    h$1( 'label', null,
      h$1( 'span', null, "born after:" ),
      h$1( 'input', { onKeyDown: trapKeydown(27), 'data-operator': "gt", type: "date" })
    )
  ),
  h$1( FilterRow, { scope: "gender" },
    h$1( 'label', null,
      h$1( 'span', null, "gender is:" ),
      h$1( 'select', { onKeyDown: trapKeydown(27), 'data-operator': "is" },
        h$1( 'option', { value: "" }, "-"),
        h$1( 'option', { value: "female" }, "female"),
        h$1( 'option', { value: "male" }, "male")
      )
    )
  ),
  h$1( FilterRow, { scope: "size" },
    h$1( 'label', null,
      h$1( 'span', null, "taller than:" ),
      h$1( 'input', { onKeyDown: trapKeydown(27), min: "150", max: "200", step: "1", type: "range", 'data-operator': "gt" })
    ),
    h$1( 'label', null,
      h$1( 'span', null, "smaller than:" ),
      h$1( 'input', { onKeyDown: trapKeydown(27), min: "150", max: "200", step: "1", type: "range", 'data-operator': "lt" })
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJub2RlX21vZHVsZXMvZmxhY28vbGliL2guanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZsYWNvL2xpYi91dGlsLmpzIiwibm9kZV9tb2R1bGVzL2ZsYWNvL2xpYi9kb21VdGlsLmpzIiwibm9kZV9tb2R1bGVzL2ZsYWNvL2xpYi90cmF2ZXJzZS5qcyIsIm5vZGVfbW9kdWxlcy9mbGFjby9saWIvdHJlZS5qcyIsIm5vZGVfbW9kdWxlcy9mbGFjby9saWIvdXBkYXRlLmpzIiwibm9kZV9tb2R1bGVzL2ZsYWNvL2xpYi9saWZlQ3ljbGVzLmpzIiwibm9kZV9tb2R1bGVzL2ZsYWNvL2xpYi93aXRoU3RhdGUuanMiLCJub2RlX21vZHVsZXMvZmxhY28vbGliL2VsbS5qcyIsIm5vZGVfbW9kdWxlcy9mbGFjby9saWIvY29ubmVjdC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc29ydC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1maWx0ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc2VhcmNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3NsaWNlLmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWV2ZW50cy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy90YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy90YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jcnVkL2NydWQuanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY3J1ZC9pbmRleC5qcyIsImxpYi9yZWR1eFNtYXJ0VGFibGUuanMiLCJsaWIvc3RvcmUuanMiLCIuLi8uLi9saWIvaC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL3RyYXZlcnNlLmpzIiwiLi4vLi4vbGliL3RyZWUuanMiLCIuLi8uLi9saWIvdXBkYXRlLmpzIiwiLi4vLi4vbGliL2xpZmVDeWNsZXMuanMiLCIuLi8uLi9saWIvd2l0aFN0YXRlLmpzIiwiLi4vLi4vbGliL2VsbS5qcyIsIi4uLy4uL2xpYi9jb25uZWN0LmpzIiwiY29tcG9uZW50cy9oZWxwZXIuanMiLCJjb21wb25lbnRzL2lucHV0cy5qcyIsImNvbXBvbmVudHMvZWRpdGFibGVDZWxsLmpzIiwiY29tcG9uZW50cy90Ym9keS5qcyIsImNvbXBvbmVudHMvbG9hZGluZ0luZGljYXRvci5qcyIsImNvbXBvbmVudHMvc29ydC5qcyIsImNvbXBvbmVudHMvc2VhcmNoLmpzIiwiY29tcG9uZW50cy9maWx0ZXIuanMiLCJjb21wb25lbnRzL2hlYWRlcnMuanMiLCJjb21wb25lbnRzL2Zvb3Rlci5qcyIsIi4uLy4uLy4uL3NtYXJ0LXRhYmxlLWtleWJvYXJkL2xpYi91dGlsLmpzIiwiLi4vLi4vLi4vc21hcnQtdGFibGUta2V5Ym9hcmQvbGliL2NlbGwuanMiLCIuLi8uLi8uLi9zbWFydC10YWJsZS1rZXlib2FyZC9saWIvcm93LmpzIiwiLi4vLi4vLi4vc21hcnQtdGFibGUta2V5Ym9hcmQvbGliL2tleWdyaWQuanMiLCIuLi8uLi8uLi9zbWFydC10YWJsZS1rZXlib2FyZC9pbmRleC5qcyIsImluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGNyZWF0ZVRleHRWTm9kZSA9ICh2YWx1ZSkgPT4gKHtcbiAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgY2hpbGRyZW46IFtdLFxuICBwcm9wczoge3ZhbHVlfVxufSk7XG5cbi8qKlxuICogVHJhbnNmb3JtIGh5cGVyc2NyaXB0IGludG8gdmlydHVhbCBkb20gbm9kZVxuICogQHBhcmFtIG5vZGVUeXBlXG4gKiBAcGFyYW0gcHJvcHNcbiAqIEBwYXJhbSBjaGlsZHJlblxuICogQHJldHVybnMgeyp9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGggKG5vZGVUeXBlLCBwcm9wcywgLi4uY2hpbGRyZW4pIHtcbiAgY29uc3QgZmxhdENoaWxkcmVuID0gY2hpbGRyZW4ucmVkdWNlKChhY2MsIGNoaWxkKSA9PiB7XG4gICAgY29uc3QgY2hpbGRyZW5BcnJheSA9IEFycmF5LmlzQXJyYXkoY2hpbGQpID8gY2hpbGQgOiBbY2hpbGRdO1xuICAgIHJldHVybiBhY2MuY29uY2F0KGNoaWxkcmVuQXJyYXkpO1xuICB9LCBbXSlcbiAgICAubWFwKGNoaWxkID0+IHtcbiAgICAgIC8vIG5vcm1hbGl6ZSB0ZXh0IG5vZGUgdG8gaGF2ZSBzYW1lIHN0cnVjdHVyZSB0aGFuIHJlZ3VsYXIgZG9tIG5vZGVzXG4gICAgICBjb25zdCB0eXBlID0gdHlwZW9mIGNoaWxkO1xuICAgICAgcmV0dXJuIHR5cGUgPT09ICdvYmplY3QnIHx8IHR5cGUgPT09ICdmdW5jdGlvbicgPyBjaGlsZCA6IGNyZWF0ZVRleHRWTm9kZShjaGlsZCk7XG4gICAgfSk7XG5cbiAgaWYgKHR5cGVvZiBub2RlVHlwZSAhPT0gJ2Z1bmN0aW9uJykgey8vcmVndWxhciBodG1sL3RleHQgbm9kZVxuICAgIHJldHVybiB7XG4gICAgICBub2RlVHlwZSxcbiAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgIGNoaWxkcmVuOiBmbGF0Q2hpbGRyZW5cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBmbGF0Q2hpbGRyZW59LCBwcm9wcyk7XG4gICAgY29uc3QgY29tcCA9IG5vZGVUeXBlKGZ1bGxQcm9wcyk7XG4gICAgcmV0dXJuIHR5cGVvZiBjb21wICE9PSAnZnVuY3Rpb24nID8gY29tcCA6IGgoY29tcCwgcHJvcHMsIC4uLmZsYXRDaGlsZHJlbik7IC8vZnVuY3Rpb25hbCBjb21wIHZzIGNvbWJpbmF0b3IgKEhPQylcbiAgfVxufTsiLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgbmV4dFRpY2sgPSBmbiA9PiBzZXRUaW1lb3V0KGZuLCAwKTtcblxuZXhwb3J0IGNvbnN0IHBhaXJpZnkgPSBob2xkZXIgPT4ga2V5ID0+IFtrZXksIGhvbGRlcltrZXldXTtcblxuZXhwb3J0IGNvbnN0IGlzU2hhbGxvd0VxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgYUtleXMgPSBPYmplY3Qua2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBPYmplY3Qua2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KChrKSA9PiBhW2tdID09PSBiW2tdKTtcbn07XG5cbmNvbnN0IG93bktleXMgPSBvYmogPT4gT2JqZWN0LmtleXMob2JqKS5maWx0ZXIoayA9PiBvYmouaGFzT3duUHJvcGVydHkoaykpO1xuXG5leHBvcnQgY29uc3QgaXNEZWVwRXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCB0eXBlID0gdHlwZW9mIGE7XG5cbiAgLy9zaG9ydCBwYXRoKHMpXG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gdHlwZW9mIGIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gYSA9PT0gYjtcbiAgfVxuXG4gIC8vIG9iamVjdHMgLi4uXG4gIGlmIChhID09PSBudWxsIHx8IGIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xuICAgIHJldHVybiBhLmxlbmd0aCAmJiBiLmxlbmd0aCAmJiBhLmV2ZXJ5KChpdGVtLCBpKSA9PiBpc0RlZXBFcXVhbChhW2ldLCBiW2ldKSk7XG4gIH1cblxuICBjb25zdCBhS2V5cyA9IG93bktleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gb3duS2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KGsgPT4gaXNEZWVwRXF1YWwoYVtrXSwgYltrXSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGlkZW50aXR5ID0gcCA9PiBwO1xuXG5leHBvcnQgY29uc3Qgbm9vcCA9ICgpID0+IHtcbn07XG4iLCJpbXBvcnQge3RhcH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgdXBkYXRlRG9tTm9kZUZhY3RvcnkgPSAobWV0aG9kKSA9PiAoaXRlbXMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgcGFpciBvZiBpdGVtcykge1xuICAgIGRvbU5vZGVbbWV0aG9kXSguLi5wYWlyKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCByZW1vdmVFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdyZW1vdmVFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3QgYWRkRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgnYWRkRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IHNldEF0dHJpYnV0ZXMgPSAoaXRlbXMpID0+IHRhcCgoZG9tTm9kZSkgPT4ge1xuICBjb25zdCBhdHRyaWJ1dGVzID0gaXRlbXMuZmlsdGVyKChba2V5LCB2YWx1ZV0pID0+IHR5cGVvZiB2YWx1ZSAhPT0gJ2Z1bmN0aW9uJyk7XG4gIGZvciAobGV0IFtrZXksIHZhbHVlXSBvZiBhdHRyaWJ1dGVzKSB7XG4gICAgdmFsdWUgPT09IGZhbHNlID8gZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoa2V5KSA6IGRvbU5vZGUuc2V0QXR0cmlidXRlKGtleSwgdmFsdWUpO1xuICB9XG59KTtcbmV4cG9ydCBjb25zdCByZW1vdmVBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IGF0dHIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCBzZXRUZXh0Tm9kZSA9IHZhbCA9PiBub2RlID0+IG5vZGUudGV4dENvbnRlbnQgPSB2YWw7XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVEb21Ob2RlID0gdm5vZGUgPT4ge1xuICByZXR1cm4gdm5vZGUubm9kZVR5cGUgIT09ICdUZXh0JyA/XG4gICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh2bm9kZS5ub2RlVHlwZSkgOlxuICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFN0cmluZyh2bm9kZS5wcm9wcy52YWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldEV2ZW50TGlzdGVuZXJzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcylcbiAgICAuZmlsdGVyKGsgPT4gay5zdWJzdHIoMCwgMikgPT09ICdvbicpXG4gICAgLm1hcChrID0+IFtrLnN1YnN0cigyKS50b0xvd2VyQ2FzZSgpLCBwcm9wc1trXV0pO1xufTtcbiIsImV4cG9ydCBjb25zdCB0cmF2ZXJzZSA9IGZ1bmN0aW9uICogKHZub2RlKSB7XG4gIHlpZWxkIHZub2RlO1xuICBpZiAodm5vZGUuY2hpbGRyZW4gJiYgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2Ygdm5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIHlpZWxkICogdHJhdmVyc2UoY2hpbGQpO1xuICAgIH1cbiAgfVxufTsiLCJpbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgaXNTaGFsbG93RXF1YWwsXG4gIHBhaXJpZnksXG4gIG5leHRUaWNrLFxuICBub29wXG59IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQge1xuICByZW1vdmVBdHRyaWJ1dGVzLFxuICBzZXRBdHRyaWJ1dGVzLFxuICBzZXRUZXh0Tm9kZSxcbiAgY3JlYXRlRG9tTm9kZSxcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMsXG4gIGFkZEV2ZW50TGlzdGVuZXJzLFxuICBnZXRFdmVudExpc3RlbmVycyxcbn0gZnJvbSAnLi9kb21VdGlsJztcbmltcG9ydCB7dHJhdmVyc2V9IGZyb20gJy4vdHJhdmVyc2UnO1xuXG5mdW5jdGlvbiB1cGRhdGVFdmVudExpc3RlbmVycyAoe3Byb3BzOm5ld05vZGVQcm9wc309e30sIHtwcm9wczpvbGROb2RlUHJvcHN9PXt9KSB7XG4gIGNvbnN0IG5ld05vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhuZXdOb2RlUHJvcHMgfHwge30pO1xuICBjb25zdCBvbGROb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMob2xkTm9kZVByb3BzIHx8IHt9KTtcblxuICByZXR1cm4gbmV3Tm9kZUV2ZW50cy5sZW5ndGggfHwgb2xkTm9kZUV2ZW50cy5sZW5ndGggP1xuICAgIGNvbXBvc2UoXG4gICAgICByZW1vdmVFdmVudExpc3RlbmVycyhvbGROb2RlRXZlbnRzKSxcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKG5ld05vZGVFdmVudHMpXG4gICAgKSA6IG5vb3A7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUF0dHJpYnV0ZXMgKG5ld1ZOb2RlLCBvbGRWTm9kZSkge1xuICBjb25zdCBuZXdWTm9kZVByb3BzID0gbmV3Vk5vZGUucHJvcHMgfHwge307XG4gIGNvbnN0IG9sZFZOb2RlUHJvcHMgPSBvbGRWTm9kZS5wcm9wcyB8fCB7fTtcblxuICBpZiAoaXNTaGFsbG93RXF1YWwobmV3Vk5vZGVQcm9wcywgb2xkVk5vZGVQcm9wcykpIHtcbiAgICByZXR1cm4gbm9vcDtcbiAgfVxuXG4gIGlmIChuZXdWTm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgcmV0dXJuIHNldFRleHROb2RlKG5ld1ZOb2RlLnByb3BzLnZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IG5ld05vZGVLZXlzID0gT2JqZWN0LmtleXMobmV3Vk5vZGVQcm9wcyk7XG4gIGNvbnN0IG9sZE5vZGVLZXlzID0gT2JqZWN0LmtleXMob2xkVk5vZGVQcm9wcyk7XG4gIGNvbnN0IGF0dHJpYnV0ZXNUb1JlbW92ZSA9IG9sZE5vZGVLZXlzLmZpbHRlcihrID0+ICFuZXdOb2RlS2V5cy5pbmNsdWRlcyhrKSk7XG5cbiAgcmV0dXJuIGNvbXBvc2UoXG4gICAgcmVtb3ZlQXR0cmlidXRlcyhhdHRyaWJ1dGVzVG9SZW1vdmUpLFxuICAgIHNldEF0dHJpYnV0ZXMobmV3Tm9kZUtleXMubWFwKHBhaXJpZnkobmV3Vk5vZGVQcm9wcykpKVxuICApO1xufVxuXG5jb25zdCBkb21GYWN0b3J5ID0gY3JlYXRlRG9tTm9kZTtcblxuLy8gYXBwbHkgdm5vZGUgZGlmZmluZyB0byBhY3R1YWwgZG9tIG5vZGUgKGlmIG5ldyBub2RlID0+IGl0IHdpbGwgYmUgbW91bnRlZCBpbnRvIHRoZSBwYXJlbnQpXG5jb25zdCBkb21pZnkgPSBmdW5jdGlvbiB1cGRhdGVEb20gKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSkge1xuICBpZiAoIW9sZFZub2RlKSB7Ly90aGVyZSBpcyBubyBwcmV2aW91cyB2bm9kZVxuICAgIGlmIChuZXdWbm9kZSkgey8vbmV3IG5vZGUgPT4gd2UgaW5zZXJ0XG4gICAgICBuZXdWbm9kZS5kb20gPSBwYXJlbnREb21Ob2RlLmFwcGVuZENoaWxkKGRvbUZhY3RvcnkobmV3Vm5vZGUpKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICByZXR1cm4ge3Zub2RlOiBuZXdWbm9kZSwgZ2FyYmFnZTogbnVsbH07XG4gICAgfSBlbHNlIHsvL2Vsc2UgKGlycmVsZXZhbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpXG4gICAgfVxuICB9IGVsc2Ugey8vdGhlcmUgaXMgYSBwcmV2aW91cyB2bm9kZVxuICAgIGlmICghbmV3Vm5vZGUpIHsvL3dlIG11c3QgcmVtb3ZlIHRoZSByZWxhdGVkIGRvbSBub2RlXG4gICAgICBwYXJlbnREb21Ob2RlLnJlbW92ZUNoaWxkKG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4gKHtnYXJiYWdlOiBvbGRWbm9kZSwgZG9tOiBudWxsfSk7XG4gICAgfSBlbHNlIGlmIChuZXdWbm9kZS5ub2RlVHlwZSAhPT0gb2xkVm5vZGUubm9kZVR5cGUpIHsvL2l0IG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IGRvbUZhY3RvcnkobmV3Vm5vZGUpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHBhcmVudERvbU5vZGUucmVwbGFjZUNoaWxkKG5ld1Zub2RlLmRvbSwgb2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogb2xkVm5vZGUsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfSBlbHNlIHsvLyBvbmx5IHVwZGF0ZSBhdHRyaWJ1dGVzXG4gICAgICBuZXdWbm9kZS5kb20gPSBvbGRWbm9kZS5kb207XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSBvbGRWbm9kZS5saWZlQ3ljbGUgKyAxO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBudWxsLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiByZW5kZXIgYSB2aXJ0dWFsIGRvbSBub2RlLCBkaWZmaW5nIGl0IHdpdGggaXRzIHByZXZpb3VzIHZlcnNpb24sIG1vdW50aW5nIGl0IGluIGEgcGFyZW50IGRvbSBub2RlXG4gKiBAcGFyYW0gb2xkVm5vZGVcbiAqIEBwYXJhbSBuZXdWbm9kZVxuICogQHBhcmFtIHBhcmVudERvbU5vZGVcbiAqIEBwYXJhbSBvbk5leHRUaWNrIGNvbGxlY3Qgb3BlcmF0aW9ucyB0byBiZSBwcm9jZXNzZWQgb24gbmV4dCB0aWNrXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmV4cG9ydCBjb25zdCByZW5kZXIgPSBmdW5jdGlvbiByZW5kZXJlciAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlLCBvbk5leHRUaWNrID0gW10pIHtcblxuICAvLzEuIHRyYW5zZm9ybSB0aGUgbmV3IHZub2RlIHRvIGEgdm5vZGUgY29ubmVjdGVkIHRvIGFuIGFjdHVhbCBkb20gZWxlbWVudCBiYXNlZCBvbiB2bm9kZSB2ZXJzaW9ucyBkaWZmaW5nXG4gIC8vIGkuIG5vdGUgYXQgdGhpcyBzdGVwIG9jY3VyIGRvbSBpbnNlcnRpb25zL3JlbW92YWxzXG4gIC8vIGlpLiBpdCBtYXkgY29sbGVjdCBzdWIgdHJlZSB0byBiZSBkcm9wcGVkIChvciBcInVubW91bnRlZFwiKVxuICBjb25zdCB7dm5vZGUsIGdhcmJhZ2V9ID0gZG9taWZ5KG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSk7XG5cbiAgaWYgKGdhcmJhZ2UgIT09IG51bGwpIHtcbiAgICAvLyBkZWZlciB1bm1vdW50IGxpZmVjeWNsZSBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGZvciAobGV0IGcgb2YgdHJhdmVyc2UoZ2FyYmFnZSkpIHtcbiAgICAgIGlmIChnLm9uVW5Nb3VudCkge1xuICAgICAgICBvbk5leHRUaWNrLnB1c2goZy5vblVuTW91bnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vTm9ybWFsaXNhdGlvbiBvZiBvbGQgbm9kZSAoaW4gY2FzZSBvZiBhIHJlcGxhY2Ugd2Ugd2lsbCBjb25zaWRlciBvbGQgbm9kZSBhcyBlbXB0eSBub2RlIChubyBjaGlsZHJlbiwgbm8gcHJvcHMpKVxuICBjb25zdCB0ZW1wT2xkTm9kZSA9IGdhcmJhZ2UgIT09IG51bGwgfHwgIW9sZFZub2RlID8ge2xlbmd0aDogMCwgY2hpbGRyZW46IFtdLCBwcm9wczoge319IDogb2xkVm5vZGU7XG5cbiAgaWYgKHZub2RlKSB7XG5cbiAgICAvLzIuIHVwZGF0ZSBkb20gYXR0cmlidXRlcyBiYXNlZCBvbiB2bm9kZSBwcm9wIGRpZmZpbmcuXG4gICAgLy9zeW5jXG4gICAgaWYgKHZub2RlLm9uVXBkYXRlICYmIHZub2RlLmxpZmVDeWNsZSA+IDEpIHtcbiAgICAgIHZub2RlLm9uVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlQXR0cmlidXRlcyh2bm9kZSwgdGVtcE9sZE5vZGUpKHZub2RlLmRvbSk7XG5cbiAgICAvL2Zhc3QgcGF0aFxuICAgIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgICByZXR1cm4gb25OZXh0VGljaztcbiAgICB9XG5cbiAgICBpZiAodm5vZGUub25Nb3VudCAmJiB2bm9kZS5saWZlQ3ljbGUgPT09IDEpIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiB2bm9kZS5vbk1vdW50KCkpO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuQ291bnQgPSBNYXRoLm1heCh0ZW1wT2xkTm9kZS5jaGlsZHJlbi5sZW5ndGgsIHZub2RlLmNoaWxkcmVuLmxlbmd0aCk7XG5cbiAgICAvL2FzeW5jIHdpbGwgYmUgZGVmZXJyZWQgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBjb25zdCBzZXRMaXN0ZW5lcnMgPSB1cGRhdGVFdmVudExpc3RlbmVycyh2bm9kZSwgdGVtcE9sZE5vZGUpO1xuICAgIGlmIChzZXRMaXN0ZW5lcnMgIT09IG5vb3ApIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiBzZXRMaXN0ZW5lcnModm5vZGUuZG9tKSk7XG4gICAgfVxuXG4gICAgLy8zIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIGNoaWxkcmVuIHRvIHVwZGF0ZSBkb20gYW5kIGNvbGxlY3QgZnVuY3Rpb25zIHRvIHByb2Nlc3Mgb24gbmV4dCB0aWNrXG4gICAgaWYgKGNoaWxkcmVuQ291bnQgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuQ291bnQ7IGkrKykge1xuICAgICAgICAvLyB3ZSBwYXNzIG9uTmV4dFRpY2sgYXMgcmVmZXJlbmNlIChpbXByb3ZlIHBlcmY6IG1lbW9yeSArIHNwZWVkKVxuICAgICAgICByZW5kZXIodGVtcE9sZE5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5kb20sIG9uTmV4dFRpY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvbk5leHRUaWNrO1xufTtcblxuZXhwb3J0IGNvbnN0IG1vdW50ID0gY3VycnkoZnVuY3Rpb24gKGNvbXAsIGluaXRQcm9wLCByb290KSB7XG4gIGNvbnN0IHZub2RlID0gY29tcC5ub2RlVHlwZSAhPT0gdm9pZCAwID8gY29tcCA6IGNvbXAoaW5pdFByb3AgfHwge30pO1xuICBjb25zdCBiYXRjaCA9IHJlbmRlcihudWxsLCB2bm9kZSwgcm9vdCk7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKGxldCBvcCBvZiBiYXRjaCkge1xuICAgICAgb3AoKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdm5vZGU7XG59KTsiLCJpbXBvcnQge3JlbmRlcn0gZnJvbSAnLi90cmVlJztcbmltcG9ydCB7bmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ3JlYXRlIGEgZnVuY3Rpb24gd2hpY2ggd2lsbCB0cmlnZ2VyIGFuIHVwZGF0ZSBvZiB0aGUgY29tcG9uZW50IHdpdGggdGhlIHBhc3NlZCBzdGF0ZVxuICogQHBhcmFtIGNvbXBcbiAqIEBwYXJhbSBpbml0aWFsVk5vZGVcbiAqIEByZXR1cm5zIHtmdW5jdGlvbigqPSwgLi4uWypdKX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdXBkYXRlIChjb21wLCBpbml0aWFsVk5vZGUpIHtcbiAgbGV0IG9sZE5vZGUgPSBpbml0aWFsVk5vZGU7XG4gIGNvbnN0IHVwZGF0ZUZ1bmMgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBtb3VudCA9IG9sZE5vZGUuZG9tLnBhcmVudE5vZGU7XG4gICAgY29uc3QgbmV3Tm9kZSA9IGNvbXAoT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IG9sZE5vZGUuY2hpbGRyZW4gfHwgW119LCBvbGROb2RlLnByb3BzLCBwcm9wcyksIC4uLmFyZ3MpO1xuICAgIGNvbnN0IG5leHRCYXRjaCA9IHJlbmRlcihvbGROb2RlLCBuZXdOb2RlLCBtb3VudCk7XG5cbiAgICAvLyBkYW5nZXIgem9uZSAhISEhXG4gICAgLy8gY2hhbmdlIGJ5IGtlZXBpbmcgdGhlIHNhbWUgcmVmZXJlbmNlIHNvIHRoZSBldmVudHVhbCBwYXJlbnQgbm9kZSBkb2VzIG5vdCBuZWVkIHRvIGJlIFwiYXdhcmVcIiB0cmVlIG1heSBoYXZlIGNoYW5nZWQgZG93bnN0cmVhbTogb2xkTm9kZSBtYXkgYmUgdGhlIGNoaWxkIG9mIHNvbWVvbmUgLi4uKHdlbGwgdGhhdCBpcyBhIHRyZWUgZGF0YSBzdHJ1Y3R1cmUgYWZ0ZXIgYWxsIDpQIClcbiAgICBvbGROb2RlID0gT2JqZWN0LmFzc2lnbihvbGROb2RlIHx8IHt9LCBuZXdOb2RlKTtcbiAgICAvLyBlbmQgZGFuZ2VyIHpvbmVcblxuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGZvciAobGV0IG9wIG9mIG5leHRCYXRjaCkge1xuICAgICAgICBvcCgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlO1xuICB9O1xuICByZXR1cm4gdXBkYXRlRnVuYztcbn0iLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCBsaWZlQ3ljbGVGYWN0b3J5ID0gbWV0aG9kID0+IGN1cnJ5KChmbiwgY29tcCkgPT4gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gIGNvbnN0IG4gPSBjb21wKHByb3BzLCAuLi5hcmdzKTtcbiAgblttZXRob2RdID0gKCkgPT4gZm4obiwgLi4uYXJncyk7XG4gIHJldHVybiBuO1xufSk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvbk1vdW50Jyk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIHVubW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Vbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Vbk1vdW50Jyk7XG5cbmV4cG9ydCBjb25zdCBvblVwZGF0ZSA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVXBkYXRlJyk7IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnQsIG9uVXBkYXRlfSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgXCJzdGF0ZWZ1bCBjb21wb25lbnRcIjogaWUgaXQgd2lsbCBoYXZlIGl0cyBvd24gc3RhdGUgYW5kIHRoZSBhYmlsaXR5IHRvIHVwZGF0ZSBpdHMgb3duIHRyZWVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChjb21wKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgIC8vbGF6eSBldmFsdWF0ZSB1cGRhdGVGdW5jICh0byBtYWtlIHN1cmUgaXQgaXMgZGVmaW5lZFxuICAgICAgY29uc3Qgc2V0U3RhdGUgPSAobmV3U3RhdGUpID0+IHVwZGF0ZUZ1bmMobmV3U3RhdGUpO1xuICAgICAgcmV0dXJuIGNvbXAocHJvcHMsIHNldFN0YXRlLCAuLi5hcmdzKTtcbiAgICB9O1xuICAgIGNvbnN0IHNldFVwZGF0ZUZ1bmN0aW9uID0gKHZub2RlKSA9PiB7XG4gICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgfTtcblxuICAgIHJldHVybiBjb21wb3NlKG9uTW91bnQoc2V0VXBkYXRlRnVuY3Rpb24pLCBvblVwZGF0ZShzZXRVcGRhdGVGdW5jdGlvbikpKHdyYXBwZXJDb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcyc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbi8vdG9kbyB0aHJvdyB0aGlzIGluIGZhdm9yIG9mIGNvbm5lY3Qgb25seSA/XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh2aWV3KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe21vZGVsLCB1cGRhdGVzLCBzdWJzY3JpcHRpb25zID0gW119PXt9KSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgbGV0IGFjdGlvblN0b3JlID0ge307XG4gICAgZm9yIChsZXQgdXBkYXRlIG9mIE9iamVjdC5rZXlzKHVwZGF0ZXMpKSB7XG4gICAgICBhY3Rpb25TdG9yZVt1cGRhdGVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgbW9kZWwgPSB1cGRhdGVzW3VwZGF0ZV0obW9kZWwsIC4uLmFyZ3MpOyAvL3RvZG8gY29uc2lkZXIgc2lkZSBlZmZlY3RzLCBtaWRkbGV3YXJlcywgZXRjXG4gICAgICAgIHJldHVybiB1cGRhdGVGdW5jKG1vZGVsLCBhY3Rpb25TdG9yZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29tcCA9ICgpID0+IHZpZXcobW9kZWwsIGFjdGlvblN0b3JlKTtcblxuICAgIGNvbnN0IGluaXRBY3Rpb25TdG9yZSA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZShjb21wLCB2bm9kZSk7XG4gICAgfTtcbiAgICBjb25zdCBpbml0U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5tYXAoc3ViID0+IHZub2RlID0+IHN1Yih2bm9kZSwgYWN0aW9uU3RvcmUpKTtcbiAgICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICAgIHJldHVybiBvbk1vdW50KGluaXRGdW5jLCBjb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVuTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcydcbmltcG9ydCB7aXNEZWVwRXF1YWwsIGlkZW50aXR5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENvbm5lY3QgY29tYmluYXRvcjogd2lsbCBjcmVhdGUgXCJjb250YWluZXJcIiBjb21wb25lbnQgd2hpY2ggd2lsbCBzdWJzY3JpYmUgdG8gYSBSZWR1eCBsaWtlIHN0b3JlLiBhbmQgdXBkYXRlIGl0cyBjaGlsZHJlbiB3aGVuZXZlciBhIHNwZWNpZmljIHNsaWNlIG9mIHN0YXRlIGNoYW5nZSB1bmRlciBzcGVjaWZpYyBjaXJjdW1zdGFuY2VzXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChzdG9yZSwgYWN0aW9ucyA9IHt9LCBzbGljZVN0YXRlID0gaWRlbnRpdHkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChjb21wLCBtYXBTdGF0ZVRvUHJvcCA9IGlkZW50aXR5LCBzaG91bGRVcGF0ZSA9IChhLCBiKSA9PiBpc0RlZXBFcXVhbChhLCBiKSA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGluaXRQcm9wKSB7XG4gICAgICBsZXQgY29tcG9uZW50UHJvcHMgPSBpbml0UHJvcDtcbiAgICAgIGxldCB1cGRhdGVGdW5jLCBwcmV2aW91c1N0YXRlU2xpY2UsIHVuc3Vic2NyaWJlcjtcblxuICAgICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgcmV0dXJuIGNvbXAocHJvcHMsIGFjdGlvbnMsIC4uLmFyZ3MpO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgc3Vic2NyaWJlID0gb25Nb3VudCgodm5vZGUpID0+IHtcbiAgICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgICAgICB1bnN1YnNjcmliZXIgPSBzdG9yZS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHN0YXRlU2xpY2UgPSBzbGljZVN0YXRlKHN0b3JlLmdldFN0YXRlKCkpO1xuICAgICAgICAgIGlmIChzaG91bGRVcGF0ZShwcmV2aW91c1N0YXRlU2xpY2UsIHN0YXRlU2xpY2UpID09PSB0cnVlKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNvbXBvbmVudFByb3BzLCBtYXBTdGF0ZVRvUHJvcChzdGF0ZVNsaWNlKSk7XG4gICAgICAgICAgICB1cGRhdGVGdW5jKGNvbXBvbmVudFByb3BzKTtcbiAgICAgICAgICAgIHByZXZpb3VzU3RhdGVTbGljZSA9IHN0YXRlU2xpY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB1bnN1YnNjcmliZSA9IG9uVW5Nb3VudCgoKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlcigpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBjb21wb3NlKHN1YnNjcmliZSwgdW5zdWJzY3JpYmUpKHdyYXBwZXJDb21wKTtcbiAgICB9O1xuICB9O1xufTsiLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwb2ludGVyIChwYXRoKSB7XG5cbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgZnVuY3Rpb24gcGFydGlhbCAob2JqID0ge30sIHBhcnRzID0gW10pIHtcbiAgICBjb25zdCBwID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh0YXJnZXQsIG5ld1RyZWUpIHtcbiAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICBmb3IgKGxldCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQodGFyZ2V0KXtcbiAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSlcbiAgICB9LFxuICAgIHNldFxuICB9XG59O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuXG5mdW5jdGlvbiBzb3J0QnlQcm9wZXJ0eSAocHJvcCkge1xuICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuICAgIGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG4gICAgaWYgKGFWYWwgPT09IGJWYWwpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEZhY3RvcnkgKHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcbiAgaWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG4gIH1cblxuICBjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcbiAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuICByZXR1cm4gKGFycmF5KSA9PiBbLi4uYXJyYXldLnNvcnQoY29tcGFyZUZ1bmMpO1xufSIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uICh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEJvb2xlYW47XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBOdW1iZXI7XG4gICAgY2FzZSAnZGF0ZSc6XG4gICAgICByZXR1cm4gKHZhbCkgPT4gbmV3IERhdGUodmFsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvbXBvc2UoU3RyaW5nLCAodmFsKSA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gIH1cbn1cblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuICBpbmNsdWRlcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQuaW5jbHVkZXModmFsdWUpO1xuICB9LFxuICBpcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGlzTm90KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiAhT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGx0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8IHZhbHVlO1xuICB9LFxuICBndCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPiB2YWx1ZTtcbiAgfSxcbiAgbHRlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8PSB2YWx1ZTtcbiAgfSxcbiAgZ3RlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+PSB2YWx1ZTtcbiAgfSxcbiAgZXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSA9PSBpbnB1dDtcbiAgfSxcbiAgbm90RXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSAhPSBpbnB1dDtcbiAgfVxufTtcblxuY29uc3QgZXZlcnkgPSBmbnMgPT4gKC4uLmFyZ3MpID0+IGZucy5ldmVyeShmbiA9PiBmbiguLi5hcmdzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVkaWNhdGUgKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgY29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG4gIGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICByZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vL2F2b2lkIHVzZWxlc3MgZmlsdGVyIGxvb2t1cCAoaW1wcm92ZSBwZXJmKVxuZnVuY3Rpb24gbm9ybWFsaXplQ2xhdXNlcyAoY29uZikge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgY29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG4gIHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoKSB7XG4gICAgICBvdXRwdXRbcGF0aF0gPSB2YWxpZENsYXVzZXM7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyIChmaWx0ZXIpIHtcbiAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gIGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcbiAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICBjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG4gIH0pO1xuICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXkuZmlsdGVyKGZpbHRlclByZWRpY2F0ZSk7XG59IiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuICBjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcbiAgaWYgKCFzY29wZS5sZW5ndGggfHwgIXZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheS5maWx0ZXIoaXRlbSA9PiBzZWFyY2hQb2ludGVycy5zb21lKHAgPT4gU3RyaW5nKHAoaXRlbSkpLmluY2x1ZGVzKFN0cmluZyh2YWx1ZSkpKSlcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNsaWNlRmFjdG9yeSAoe3BhZ2UgPSAxLCBzaXplfSA9IHt9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBzbGljZUZ1bmN0aW9uIChhcnJheSA9IFtdKSB7XG4gICAgY29uc3QgYWN0dWFsU2l6ZSA9IHNpemUgfHwgYXJyYXkubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IChwYWdlIC0gMSkgKiBhY3R1YWxTaXplO1xuICAgIHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGVtaXR0ZXIgKCkge1xuXG4gIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncyl7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICBmb3IgKGxldCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgbGlzdGVuZXIoLi4uYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IGluc3RhbmNlLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJveHlMaXN0ZW5lciAoZXZlbnRNYXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7ZW1pdHRlcn0pIHtcblxuICAgIGNvbnN0IHByb3h5ID0ge307XG4gICAgbGV0IGV2ZW50TGlzdGVuZXJzID0ge307XG5cbiAgICBmb3IgKGxldCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IFtdO1xuICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gZXZlbnRMaXN0ZW5lcnNbZXZdLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHByb3h5Lm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICBjb25zdCBkaXNwbGF5ZWQgPSBleGVjRnVuYyhkYXRhKTtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRElTUExBWV9DSEFOR0VELCBkaXNwbGF5ZWQubWFwKGQgPT4ge1xuICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfRVJST1IsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9LCBwcm9jZXNzaW5nRGVsYXkpO1xuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcbiAgICBzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcbiAgICB0YXAoZGlzcGF0Y2goZXYpKSxcbiAgICBwdGVyLnNldCh0YWJsZVN0YXRlKVxuICApKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG4gIGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG4gIGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuICAgIHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuICAgIHJlc2V0VG9GaXJzdFBhZ2UsXG4gICAgKCkgPT4gdGFibGUuZXhlYygpIC8vIHdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgKTtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcbiAgICBmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcbiAgICBzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcbiAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcbiAgICBleGVjLFxuICAgIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKXtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgb25EaXNwbGF5Q2hhbmdlKGZuKXtcbiAgICAgIHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuICAgIH0sXG4gICAgZ2V0VGFibGVTdGF0ZSgpe1xuICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgY29uc3QgZmlsdGVyID0ge307XG4gICAgICBmb3IgKGxldCBwcm9wIGluIHRhYmxlU3RhdGUuZmlsdGVyKSB7XG4gICAgICAgIGZpbHRlcltwcm9wXSA9IHRhYmxlU3RhdGUuZmlsdGVyW3Byb3BdLm1hcCh2ID0+IE9iamVjdC5hc3NpZ24oe30sIHYpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7c29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyfTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaW5zdGFuY2UgPSBPYmplY3QuYXNzaWduKHRhYmxlLCBhcGkpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmV4cG9ydCBjb25zdCBnZXQgPSBjdXJyeSgoYXJyYXksIGluZGV4KSA9PiBhcnJheVtpbmRleF0pO1xuZXhwb3J0IGNvbnN0IHJlcGxhY2UgPSBjdXJyeSgoYXJyYXksIG5ld1ZhbCwgaW5kZXgpID0+IGFycmF5Lm1hcCgodmFsLCBpKSA9PiAoaW5kZXggPT09IGkgKSA/IG5ld1ZhbCA6IHZhbCkpO1xuZXhwb3J0IGNvbnN0IHBhdGNoID0gY3VycnkoKGFycmF5LCBuZXdWYWwsIGluZGV4KSA9PiByZXBsYWNlKGFycmF5LCBPYmplY3QuYXNzaWduKGFycmF5W2luZGV4XSwgbmV3VmFsKSwgaW5kZXgpKTtcbmV4cG9ydCBjb25zdCByZW1vdmUgPSBjdXJyeSgoYXJyYXksIGluZGV4KSA9PiBhcnJheS5maWx0ZXIoKHZhbCwgaSkgPT4gaW5kZXggIT09IGkpKTtcbmV4cG9ydCBjb25zdCBpbnNlcnQgPSBjdXJyeSgoYXJyYXksIG5ld1ZhbCwgaW5kZXgpID0+IFsuLi5hcnJheS5zbGljZSgwLCBpbmRleCksIG5ld1ZhbCwgLi4uYXJyYXkuc2xpY2UoaW5kZXgpXSk7IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtnZXQsIHJlcGxhY2UsIHBhdGNoLCByZW1vdmUsIGluc2VydH0gZnJvbSAnLi9jcnVkJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtkYXRhLCB0YWJsZX0pIHtcbiAgLy8gZW1wdHkgYW5kIHJlZmlsbCBkYXRhIGtlZXBpbmcgdGhlIHNhbWUgcmVmZXJlbmNlXG4gIGNvbnN0IG11dGF0ZURhdGEgPSAobmV3RGF0YSkgPT4ge1xuICAgIGRhdGEuc3BsaWNlKDApO1xuICAgIGRhdGEucHVzaCguLi5uZXdEYXRhKTtcbiAgfTtcbiAgY29uc3QgcmVmcmVzaCA9IGNvbXBvc2UobXV0YXRlRGF0YSwgdGFibGUuZXhlYyk7XG4gIHJldHVybiB7XG4gICAgdXBkYXRlKGluZGV4LG5ld1ZhbCl7XG4gICAgICByZXR1cm4gY29tcG9zZShyZXBsYWNlKGRhdGEsbmV3VmFsKSxyZWZyZXNoKShpbmRleCk7XG4gICAgfSxcbiAgICBwYXRjaChpbmRleCwgbmV3VmFsKXtcbiAgICAgIHJldHVybiBwYXRjaChkYXRhLCBuZXdWYWwsIGluZGV4KTtcbiAgICB9LFxuICAgIHJlbW92ZTogY29tcG9zZShyZW1vdmUoZGF0YSksIHJlZnJlc2gpLFxuICAgIGluc2VydChuZXdWYWwsIGluZGV4ID0gMCl7XG4gICAgICByZXR1cm4gY29tcG9zZShpbnNlcnQoZGF0YSwgbmV3VmFsKSwgcmVmcmVzaCkoaW5kZXgpO1xuICAgIH0sXG4gICAgZ2V0OiBnZXQoZGF0YSlcbiAgfTtcbn0iLCIvLyBpdCBpcyBsaWtlIFJlZHV4IGJ1dCB1c2luZyBzbWFydCB0YWJsZSB3aGljaCBhbHJlYWR5IGJlaGF2ZXMgbW9yZSBvciBsZXNzIGxpa2UgYSBzdG9yZSBhbmQgbGlrZSBhIHJlZHVjZXIgaW4gdGhlIHNhbWUgdGltZS5cbi8vIG9mIGNvdXJzZSB0aGlzIGltcGwgaXMgYmFzaWM6IGVycm9yIGhhbmRsaW5nIGV0YyBhcmUgbWlzc2luZyBhbmQgcmVkdWNlciBpcyBcImhhcmRjb2RlZFwiXG5jb25zdCByZWR1Y2VyRmFjdG9yeSA9IGZ1bmN0aW9uIChzbWFydFRhYmxlKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoc3RhdGUgPSB7XG4gICAgdGFibGVTdGF0ZTogc21hcnRUYWJsZS5nZXRUYWJsZVN0YXRlKCksXG4gICAgZGlzcGxheWVkOiBbXSxcbiAgICBzdW1tYXJ5OiB7fSxcbiAgICBpc1Byb2Nlc3Npbmc6IGZhbHNlXG4gIH0sIGFjdGlvbikge1xuICAgIGNvbnN0IHt0eXBlLCBhcmdzfSA9IGFjdGlvbjtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgJ1RPR0dMRV9GSUxURVInOiB7XG4gICAgICAgIGNvbnN0IHtmaWx0ZXJ9ID0gYWN0aW9uO1xuICAgICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUsIHthY3RpdmVGaWx0ZXI6IGZpbHRlcn0pO1xuICAgICAgfVxuICAgICAgZGVmYXVsdDogLy9wcm94eSB0byBzbWFydCB0YWJsZVxuICAgICAgICBpZiAoc21hcnRUYWJsZVt0eXBlXSkge1xuICAgICAgICAgIHNtYXJ0VGFibGVbdHlwZV0oLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH1cbiAgfVxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0b3JlIChzbWFydFRhYmxlKSB7XG5cbiAgY29uc3QgcmVkdWNlciA9IHJlZHVjZXJGYWN0b3J5KHNtYXJ0VGFibGUpO1xuXG4gIGxldCBjdXJyZW50U3RhdGUgPSB7XG4gICAgdGFibGVTdGF0ZTogc21hcnRUYWJsZS5nZXRUYWJsZVN0YXRlKClcbiAgfTtcbiAgbGV0IHN1bW1hcnk7XG4gIGxldCBsaXN0ZW5lcnMgPSBbXTtcblxuICBjb25zdCBicm9hZGNhc3QgPSAoKSA9PiB7XG4gICAgZm9yIChsZXQgbCBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgIGwoKTtcbiAgICB9XG4gIH07XG5cbiAgc21hcnRUYWJsZS5vbignU1VNTUFSWV9DSEFOR0VEJywgZnVuY3Rpb24gKHMpIHtcbiAgICBzdW1tYXJ5ID0gcztcbiAgfSk7XG5cbiAgc21hcnRUYWJsZS5vbignRVhFQ19DSEFOR0VEJywgZnVuY3Rpb24gKHt3b3JraW5nfSkge1xuICAgIE9iamVjdC5hc3NpZ24oY3VycmVudFN0YXRlLCB7XG4gICAgICBpc1Byb2Nlc3Npbmc6IHdvcmtpbmdcbiAgICB9KTtcbiAgICBicm9hZGNhc3QoKTtcbiAgfSk7XG5cbiAgc21hcnRUYWJsZS5vbkRpc3BsYXlDaGFuZ2UoZnVuY3Rpb24gKGRpc3BsYXllZCkge1xuICAgIE9iamVjdC5hc3NpZ24oY3VycmVudFN0YXRlLCB7XG4gICAgICB0YWJsZVN0YXRlOiBzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKSxcbiAgICAgIGRpc3BsYXllZCxcbiAgICAgIHN1bW1hcnlcbiAgICB9KTtcbiAgICBicm9hZGNhc3QoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBzdWJzY3JpYmUobGlzdGVuZXIpe1xuICAgICAgbGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmZpbHRlcihsID0+IGwgIT09IGxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldFN0YXRlKCl7XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgY3VycmVudFN0YXRlLCB7dGFibGVTdGF0ZTpzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKX0pO1xuICAgIH0sXG4gICAgZGlzcGF0Y2goYWN0aW9uID0ge30pe1xuICAgICAgY3VycmVudFN0YXRlID0gcmVkdWNlcihjdXJyZW50U3RhdGUsIGFjdGlvbik7XG4gICAgICBpZiAoYWN0aW9uLnR5cGUgJiYgIXNtYXJ0VGFibGVbYWN0aW9uLnR5cGVdKSB7XG4gICAgICAgIGJyb2FkY2FzdCgpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn0iLCJpbXBvcnQge2RlZmF1bHQgYXMgc21hcnRUYWJsZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5pbXBvcnQgY3J1ZCBmcm9tICdzbWFydC10YWJsZS1jcnVkJztcbmltcG9ydCB7Y3JlYXRlU3RvcmV9IGZyb20gJy4vcmVkdXhTbWFydFRhYmxlJztcblxuLy9kYXRhIGNvbWluZyBmcm9tIGdsb2JhbFxuY29uc3QgdGFibGVTdGF0ZSA9IHtzZWFyY2g6IHt9LCBmaWx0ZXI6IHt9LCBzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxLCBzaXplOiAyMH19O1xuLy90aGUgc21hcnQgdGFibGVcbmNvbnN0IHRhYmxlID0gc21hcnRUYWJsZSh7ZGF0YSwgdGFibGVTdGF0ZX0sIGNydWQpO1xuLy90aGUgc3RvcmVcbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZVN0b3JlKHRhYmxlKTtcbiIsImNvbnN0IGNyZWF0ZVRleHRWTm9kZSA9ICh2YWx1ZSkgPT4gKHtcbiAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgY2hpbGRyZW46IFtdLFxuICBwcm9wczoge3ZhbHVlfVxufSk7XG5cbi8qKlxuICogVHJhbnNmb3JtIGh5cGVyc2NyaXB0IGludG8gdmlydHVhbCBkb20gbm9kZVxuICogQHBhcmFtIG5vZGVUeXBlXG4gKiBAcGFyYW0gcHJvcHNcbiAqIEBwYXJhbSBjaGlsZHJlblxuICogQHJldHVybnMgeyp9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGggKG5vZGVUeXBlLCBwcm9wcywgLi4uY2hpbGRyZW4pIHtcbiAgY29uc3QgZmxhdENoaWxkcmVuID0gY2hpbGRyZW4ucmVkdWNlKChhY2MsIGNoaWxkKSA9PiB7XG4gICAgY29uc3QgY2hpbGRyZW5BcnJheSA9IEFycmF5LmlzQXJyYXkoY2hpbGQpID8gY2hpbGQgOiBbY2hpbGRdO1xuICAgIHJldHVybiBhY2MuY29uY2F0KGNoaWxkcmVuQXJyYXkpO1xuICB9LCBbXSlcbiAgICAubWFwKGNoaWxkID0+IHtcbiAgICAgIC8vIG5vcm1hbGl6ZSB0ZXh0IG5vZGUgdG8gaGF2ZSBzYW1lIHN0cnVjdHVyZSB0aGFuIHJlZ3VsYXIgZG9tIG5vZGVzXG4gICAgICBjb25zdCB0eXBlID0gdHlwZW9mIGNoaWxkO1xuICAgICAgcmV0dXJuIHR5cGUgPT09ICdvYmplY3QnIHx8IHR5cGUgPT09ICdmdW5jdGlvbicgPyBjaGlsZCA6IGNyZWF0ZVRleHRWTm9kZShjaGlsZCk7XG4gICAgfSk7XG5cbiAgaWYgKHR5cGVvZiBub2RlVHlwZSAhPT0gJ2Z1bmN0aW9uJykgey8vcmVndWxhciBodG1sL3RleHQgbm9kZVxuICAgIHJldHVybiB7XG4gICAgICBub2RlVHlwZSxcbiAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgIGNoaWxkcmVuOiBmbGF0Q2hpbGRyZW5cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBmbGF0Q2hpbGRyZW59LCBwcm9wcyk7XG4gICAgY29uc3QgY29tcCA9IG5vZGVUeXBlKGZ1bGxQcm9wcyk7XG4gICAgcmV0dXJuIHR5cGVvZiBjb21wICE9PSAnZnVuY3Rpb24nID8gY29tcCA6IGgoY29tcCwgcHJvcHMsIC4uLmZsYXRDaGlsZHJlbik7IC8vZnVuY3Rpb25hbCBjb21wIHZzIGNvbWJpbmF0b3IgKEhPQylcbiAgfVxufTsiLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgbmV4dFRpY2sgPSBmbiA9PiBzZXRUaW1lb3V0KGZuLCAwKTtcblxuZXhwb3J0IGNvbnN0IHBhaXJpZnkgPSBob2xkZXIgPT4ga2V5ID0+IFtrZXksIGhvbGRlcltrZXldXTtcblxuZXhwb3J0IGNvbnN0IGlzU2hhbGxvd0VxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgYUtleXMgPSBPYmplY3Qua2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBPYmplY3Qua2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KChrKSA9PiBhW2tdID09PSBiW2tdKTtcbn07XG5cbmNvbnN0IG93bktleXMgPSBvYmogPT4gT2JqZWN0LmtleXMob2JqKS5maWx0ZXIoayA9PiBvYmouaGFzT3duUHJvcGVydHkoaykpO1xuXG5leHBvcnQgY29uc3QgaXNEZWVwRXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCB0eXBlID0gdHlwZW9mIGE7XG5cbiAgLy9zaG9ydCBwYXRoKHMpXG4gIGlmIChhID09PSBiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gdHlwZW9mIGIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAodHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gYSA9PT0gYjtcbiAgfVxuXG4gIC8vIG9iamVjdHMgLi4uXG4gIGlmIChhID09PSBudWxsIHx8IGIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xuICAgIHJldHVybiBhLmxlbmd0aCAmJiBiLmxlbmd0aCAmJiBhLmV2ZXJ5KChpdGVtLCBpKSA9PiBpc0RlZXBFcXVhbChhW2ldLCBiW2ldKSk7XG4gIH1cblxuICBjb25zdCBhS2V5cyA9IG93bktleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gb3duS2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KGsgPT4gaXNEZWVwRXF1YWwoYVtrXSwgYltrXSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGlkZW50aXR5ID0gcCA9PiBwO1xuXG5leHBvcnQgY29uc3Qgbm9vcCA9ICgpID0+IHtcbn07XG4iLCJpbXBvcnQge3RhcH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgdXBkYXRlRG9tTm9kZUZhY3RvcnkgPSAobWV0aG9kKSA9PiAoaXRlbXMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgcGFpciBvZiBpdGVtcykge1xuICAgIGRvbU5vZGVbbWV0aG9kXSguLi5wYWlyKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCByZW1vdmVFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdyZW1vdmVFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3QgYWRkRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgnYWRkRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IHNldEF0dHJpYnV0ZXMgPSAoaXRlbXMpID0+IHRhcCgoZG9tTm9kZSkgPT4ge1xuICBjb25zdCBhdHRyaWJ1dGVzID0gaXRlbXMuZmlsdGVyKChba2V5LCB2YWx1ZV0pID0+IHR5cGVvZiB2YWx1ZSAhPT0gJ2Z1bmN0aW9uJyk7XG4gIGZvciAobGV0IFtrZXksIHZhbHVlXSBvZiBhdHRyaWJ1dGVzKSB7XG4gICAgdmFsdWUgPT09IGZhbHNlID8gZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoa2V5KSA6IGRvbU5vZGUuc2V0QXR0cmlidXRlKGtleSwgdmFsdWUpO1xuICB9XG59KTtcbmV4cG9ydCBjb25zdCByZW1vdmVBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IGF0dHIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCBzZXRUZXh0Tm9kZSA9IHZhbCA9PiBub2RlID0+IG5vZGUudGV4dENvbnRlbnQgPSB2YWw7XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVEb21Ob2RlID0gdm5vZGUgPT4ge1xuICByZXR1cm4gdm5vZGUubm9kZVR5cGUgIT09ICdUZXh0JyA/XG4gICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh2bm9kZS5ub2RlVHlwZSkgOlxuICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFN0cmluZyh2bm9kZS5wcm9wcy52YWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldEV2ZW50TGlzdGVuZXJzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcylcbiAgICAuZmlsdGVyKGsgPT4gay5zdWJzdHIoMCwgMikgPT09ICdvbicpXG4gICAgLm1hcChrID0+IFtrLnN1YnN0cigyKS50b0xvd2VyQ2FzZSgpLCBwcm9wc1trXV0pO1xufTtcbiIsImV4cG9ydCBjb25zdCB0cmF2ZXJzZSA9IGZ1bmN0aW9uICogKHZub2RlKSB7XG4gIHlpZWxkIHZub2RlO1xuICBpZiAodm5vZGUuY2hpbGRyZW4gJiYgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2Ygdm5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIHlpZWxkICogdHJhdmVyc2UoY2hpbGQpO1xuICAgIH1cbiAgfVxufTsiLCJpbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgaXNTaGFsbG93RXF1YWwsXG4gIHBhaXJpZnksXG4gIG5leHRUaWNrLFxuICBub29wXG59IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQge1xuICByZW1vdmVBdHRyaWJ1dGVzLFxuICBzZXRBdHRyaWJ1dGVzLFxuICBzZXRUZXh0Tm9kZSxcbiAgY3JlYXRlRG9tTm9kZSxcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMsXG4gIGFkZEV2ZW50TGlzdGVuZXJzLFxuICBnZXRFdmVudExpc3RlbmVycyxcbn0gZnJvbSAnLi9kb21VdGlsJztcbmltcG9ydCB7dHJhdmVyc2V9IGZyb20gJy4vdHJhdmVyc2UnO1xuXG5mdW5jdGlvbiB1cGRhdGVFdmVudExpc3RlbmVycyAoe3Byb3BzOm5ld05vZGVQcm9wc309e30sIHtwcm9wczpvbGROb2RlUHJvcHN9PXt9KSB7XG4gIGNvbnN0IG5ld05vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhuZXdOb2RlUHJvcHMgfHwge30pO1xuICBjb25zdCBvbGROb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMob2xkTm9kZVByb3BzIHx8IHt9KTtcblxuICByZXR1cm4gbmV3Tm9kZUV2ZW50cy5sZW5ndGggfHwgb2xkTm9kZUV2ZW50cy5sZW5ndGggP1xuICAgIGNvbXBvc2UoXG4gICAgICByZW1vdmVFdmVudExpc3RlbmVycyhvbGROb2RlRXZlbnRzKSxcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKG5ld05vZGVFdmVudHMpXG4gICAgKSA6IG5vb3A7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUF0dHJpYnV0ZXMgKG5ld1ZOb2RlLCBvbGRWTm9kZSkge1xuICBjb25zdCBuZXdWTm9kZVByb3BzID0gbmV3Vk5vZGUucHJvcHMgfHwge307XG4gIGNvbnN0IG9sZFZOb2RlUHJvcHMgPSBvbGRWTm9kZS5wcm9wcyB8fCB7fTtcblxuICBpZiAoaXNTaGFsbG93RXF1YWwobmV3Vk5vZGVQcm9wcywgb2xkVk5vZGVQcm9wcykpIHtcbiAgICByZXR1cm4gbm9vcDtcbiAgfVxuXG4gIGlmIChuZXdWTm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgcmV0dXJuIHNldFRleHROb2RlKG5ld1ZOb2RlLnByb3BzLnZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IG5ld05vZGVLZXlzID0gT2JqZWN0LmtleXMobmV3Vk5vZGVQcm9wcyk7XG4gIGNvbnN0IG9sZE5vZGVLZXlzID0gT2JqZWN0LmtleXMob2xkVk5vZGVQcm9wcyk7XG4gIGNvbnN0IGF0dHJpYnV0ZXNUb1JlbW92ZSA9IG9sZE5vZGVLZXlzLmZpbHRlcihrID0+ICFuZXdOb2RlS2V5cy5pbmNsdWRlcyhrKSk7XG5cbiAgcmV0dXJuIGNvbXBvc2UoXG4gICAgcmVtb3ZlQXR0cmlidXRlcyhhdHRyaWJ1dGVzVG9SZW1vdmUpLFxuICAgIHNldEF0dHJpYnV0ZXMobmV3Tm9kZUtleXMubWFwKHBhaXJpZnkobmV3Vk5vZGVQcm9wcykpKVxuICApO1xufVxuXG5jb25zdCBkb21GYWN0b3J5ID0gY3JlYXRlRG9tTm9kZTtcblxuLy8gYXBwbHkgdm5vZGUgZGlmZmluZyB0byBhY3R1YWwgZG9tIG5vZGUgKGlmIG5ldyBub2RlID0+IGl0IHdpbGwgYmUgbW91bnRlZCBpbnRvIHRoZSBwYXJlbnQpXG5jb25zdCBkb21pZnkgPSBmdW5jdGlvbiB1cGRhdGVEb20gKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSkge1xuICBpZiAoIW9sZFZub2RlKSB7Ly90aGVyZSBpcyBubyBwcmV2aW91cyB2bm9kZVxuICAgIGlmIChuZXdWbm9kZSkgey8vbmV3IG5vZGUgPT4gd2UgaW5zZXJ0XG4gICAgICBuZXdWbm9kZS5kb20gPSBwYXJlbnREb21Ob2RlLmFwcGVuZENoaWxkKGRvbUZhY3RvcnkobmV3Vm5vZGUpKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICByZXR1cm4ge3Zub2RlOiBuZXdWbm9kZSwgZ2FyYmFnZTogbnVsbH07XG4gICAgfSBlbHNlIHsvL2Vsc2UgKGlycmVsZXZhbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpXG4gICAgfVxuICB9IGVsc2Ugey8vdGhlcmUgaXMgYSBwcmV2aW91cyB2bm9kZVxuICAgIGlmICghbmV3Vm5vZGUpIHsvL3dlIG11c3QgcmVtb3ZlIHRoZSByZWxhdGVkIGRvbSBub2RlXG4gICAgICBwYXJlbnREb21Ob2RlLnJlbW92ZUNoaWxkKG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4gKHtnYXJiYWdlOiBvbGRWbm9kZSwgZG9tOiBudWxsfSk7XG4gICAgfSBlbHNlIGlmIChuZXdWbm9kZS5ub2RlVHlwZSAhPT0gb2xkVm5vZGUubm9kZVR5cGUpIHsvL2l0IG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IGRvbUZhY3RvcnkobmV3Vm5vZGUpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHBhcmVudERvbU5vZGUucmVwbGFjZUNoaWxkKG5ld1Zub2RlLmRvbSwgb2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogb2xkVm5vZGUsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfSBlbHNlIHsvLyBvbmx5IHVwZGF0ZSBhdHRyaWJ1dGVzXG4gICAgICBuZXdWbm9kZS5kb20gPSBvbGRWbm9kZS5kb207XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSBvbGRWbm9kZS5saWZlQ3ljbGUgKyAxO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBudWxsLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiByZW5kZXIgYSB2aXJ0dWFsIGRvbSBub2RlLCBkaWZmaW5nIGl0IHdpdGggaXRzIHByZXZpb3VzIHZlcnNpb24sIG1vdW50aW5nIGl0IGluIGEgcGFyZW50IGRvbSBub2RlXG4gKiBAcGFyYW0gb2xkVm5vZGVcbiAqIEBwYXJhbSBuZXdWbm9kZVxuICogQHBhcmFtIHBhcmVudERvbU5vZGVcbiAqIEBwYXJhbSBvbk5leHRUaWNrIGNvbGxlY3Qgb3BlcmF0aW9ucyB0byBiZSBwcm9jZXNzZWQgb24gbmV4dCB0aWNrXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmV4cG9ydCBjb25zdCByZW5kZXIgPSBmdW5jdGlvbiByZW5kZXJlciAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlLCBvbk5leHRUaWNrID0gW10pIHtcblxuICAvLzEuIHRyYW5zZm9ybSB0aGUgbmV3IHZub2RlIHRvIGEgdm5vZGUgY29ubmVjdGVkIHRvIGFuIGFjdHVhbCBkb20gZWxlbWVudCBiYXNlZCBvbiB2bm9kZSB2ZXJzaW9ucyBkaWZmaW5nXG4gIC8vIGkuIG5vdGUgYXQgdGhpcyBzdGVwIG9jY3VyIGRvbSBpbnNlcnRpb25zL3JlbW92YWxzXG4gIC8vIGlpLiBpdCBtYXkgY29sbGVjdCBzdWIgdHJlZSB0byBiZSBkcm9wcGVkIChvciBcInVubW91bnRlZFwiKVxuICBjb25zdCB7dm5vZGUsIGdhcmJhZ2V9ID0gZG9taWZ5KG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSk7XG5cbiAgaWYgKGdhcmJhZ2UgIT09IG51bGwpIHtcbiAgICAvLyBkZWZlciB1bm1vdW50IGxpZmVjeWNsZSBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGZvciAobGV0IGcgb2YgdHJhdmVyc2UoZ2FyYmFnZSkpIHtcbiAgICAgIGlmIChnLm9uVW5Nb3VudCkge1xuICAgICAgICBvbk5leHRUaWNrLnB1c2goZy5vblVuTW91bnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vTm9ybWFsaXNhdGlvbiBvZiBvbGQgbm9kZSAoaW4gY2FzZSBvZiBhIHJlcGxhY2Ugd2Ugd2lsbCBjb25zaWRlciBvbGQgbm9kZSBhcyBlbXB0eSBub2RlIChubyBjaGlsZHJlbiwgbm8gcHJvcHMpKVxuICBjb25zdCB0ZW1wT2xkTm9kZSA9IGdhcmJhZ2UgIT09IG51bGwgfHwgIW9sZFZub2RlID8ge2xlbmd0aDogMCwgY2hpbGRyZW46IFtdLCBwcm9wczoge319IDogb2xkVm5vZGU7XG5cbiAgaWYgKHZub2RlKSB7XG5cbiAgICAvLzIuIHVwZGF0ZSBkb20gYXR0cmlidXRlcyBiYXNlZCBvbiB2bm9kZSBwcm9wIGRpZmZpbmcuXG4gICAgLy9zeW5jXG4gICAgaWYgKHZub2RlLm9uVXBkYXRlICYmIHZub2RlLmxpZmVDeWNsZSA+IDEpIHtcbiAgICAgIHZub2RlLm9uVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlQXR0cmlidXRlcyh2bm9kZSwgdGVtcE9sZE5vZGUpKHZub2RlLmRvbSk7XG5cbiAgICAvL2Zhc3QgcGF0aFxuICAgIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgICByZXR1cm4gb25OZXh0VGljaztcbiAgICB9XG5cbiAgICBpZiAodm5vZGUub25Nb3VudCAmJiB2bm9kZS5saWZlQ3ljbGUgPT09IDEpIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiB2bm9kZS5vbk1vdW50KCkpO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuQ291bnQgPSBNYXRoLm1heCh0ZW1wT2xkTm9kZS5jaGlsZHJlbi5sZW5ndGgsIHZub2RlLmNoaWxkcmVuLmxlbmd0aCk7XG5cbiAgICAvL2FzeW5jIHdpbGwgYmUgZGVmZXJyZWQgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBjb25zdCBzZXRMaXN0ZW5lcnMgPSB1cGRhdGVFdmVudExpc3RlbmVycyh2bm9kZSwgdGVtcE9sZE5vZGUpO1xuICAgIGlmIChzZXRMaXN0ZW5lcnMgIT09IG5vb3ApIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiBzZXRMaXN0ZW5lcnModm5vZGUuZG9tKSk7XG4gICAgfVxuXG4gICAgLy8zIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIGNoaWxkcmVuIHRvIHVwZGF0ZSBkb20gYW5kIGNvbGxlY3QgZnVuY3Rpb25zIHRvIHByb2Nlc3Mgb24gbmV4dCB0aWNrXG4gICAgaWYgKGNoaWxkcmVuQ291bnQgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuQ291bnQ7IGkrKykge1xuICAgICAgICAvLyB3ZSBwYXNzIG9uTmV4dFRpY2sgYXMgcmVmZXJlbmNlIChpbXByb3ZlIHBlcmY6IG1lbW9yeSArIHNwZWVkKVxuICAgICAgICByZW5kZXIodGVtcE9sZE5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5kb20sIG9uTmV4dFRpY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvbk5leHRUaWNrO1xufTtcblxuZXhwb3J0IGNvbnN0IG1vdW50ID0gY3VycnkoZnVuY3Rpb24gKGNvbXAsIGluaXRQcm9wLCByb290KSB7XG4gIGNvbnN0IHZub2RlID0gY29tcC5ub2RlVHlwZSAhPT0gdm9pZCAwID8gY29tcCA6IGNvbXAoaW5pdFByb3AgfHwge30pO1xuICBjb25zdCBiYXRjaCA9IHJlbmRlcihudWxsLCB2bm9kZSwgcm9vdCk7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKGxldCBvcCBvZiBiYXRjaCkge1xuICAgICAgb3AoKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdm5vZGU7XG59KTsiLCJpbXBvcnQge3JlbmRlcn0gZnJvbSAnLi90cmVlJztcbmltcG9ydCB7bmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ3JlYXRlIGEgZnVuY3Rpb24gd2hpY2ggd2lsbCB0cmlnZ2VyIGFuIHVwZGF0ZSBvZiB0aGUgY29tcG9uZW50IHdpdGggdGhlIHBhc3NlZCBzdGF0ZVxuICogQHBhcmFtIGNvbXBcbiAqIEBwYXJhbSBpbml0aWFsVk5vZGVcbiAqIEByZXR1cm5zIHtmdW5jdGlvbigqPSwgLi4uWypdKX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdXBkYXRlIChjb21wLCBpbml0aWFsVk5vZGUpIHtcbiAgbGV0IG9sZE5vZGUgPSBpbml0aWFsVk5vZGU7XG4gIGNvbnN0IHVwZGF0ZUZ1bmMgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBtb3VudCA9IG9sZE5vZGUuZG9tLnBhcmVudE5vZGU7XG4gICAgY29uc3QgbmV3Tm9kZSA9IGNvbXAoT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IG9sZE5vZGUuY2hpbGRyZW4gfHwgW119LCBvbGROb2RlLnByb3BzLCBwcm9wcyksIC4uLmFyZ3MpO1xuICAgIGNvbnN0IG5leHRCYXRjaCA9IHJlbmRlcihvbGROb2RlLCBuZXdOb2RlLCBtb3VudCk7XG5cbiAgICAvLyBkYW5nZXIgem9uZSAhISEhXG4gICAgLy8gY2hhbmdlIGJ5IGtlZXBpbmcgdGhlIHNhbWUgcmVmZXJlbmNlIHNvIHRoZSBldmVudHVhbCBwYXJlbnQgbm9kZSBkb2VzIG5vdCBuZWVkIHRvIGJlIFwiYXdhcmVcIiB0cmVlIG1heSBoYXZlIGNoYW5nZWQgZG93bnN0cmVhbTogb2xkTm9kZSBtYXkgYmUgdGhlIGNoaWxkIG9mIHNvbWVvbmUgLi4uKHdlbGwgdGhhdCBpcyBhIHRyZWUgZGF0YSBzdHJ1Y3R1cmUgYWZ0ZXIgYWxsIDpQIClcbiAgICBvbGROb2RlID0gT2JqZWN0LmFzc2lnbihvbGROb2RlIHx8IHt9LCBuZXdOb2RlKTtcbiAgICAvLyBlbmQgZGFuZ2VyIHpvbmVcblxuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGZvciAobGV0IG9wIG9mIG5leHRCYXRjaCkge1xuICAgICAgICBvcCgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlO1xuICB9O1xuICByZXR1cm4gdXBkYXRlRnVuYztcbn0iLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCBsaWZlQ3ljbGVGYWN0b3J5ID0gbWV0aG9kID0+IGN1cnJ5KChmbiwgY29tcCkgPT4gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gIGNvbnN0IG4gPSBjb21wKHByb3BzLCAuLi5hcmdzKTtcbiAgblttZXRob2RdID0gKCkgPT4gZm4obiwgLi4uYXJncyk7XG4gIHJldHVybiBuO1xufSk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvbk1vdW50Jyk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIHVubW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Vbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Vbk1vdW50Jyk7XG5cbmV4cG9ydCBjb25zdCBvblVwZGF0ZSA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVXBkYXRlJyk7IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnQsIG9uVXBkYXRlfSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgXCJzdGF0ZWZ1bCBjb21wb25lbnRcIjogaWUgaXQgd2lsbCBoYXZlIGl0cyBvd24gc3RhdGUgYW5kIHRoZSBhYmlsaXR5IHRvIHVwZGF0ZSBpdHMgb3duIHRyZWVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChjb21wKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgIC8vbGF6eSBldmFsdWF0ZSB1cGRhdGVGdW5jICh0byBtYWtlIHN1cmUgaXQgaXMgZGVmaW5lZFxuICAgICAgY29uc3Qgc2V0U3RhdGUgPSAobmV3U3RhdGUpID0+IHVwZGF0ZUZ1bmMobmV3U3RhdGUpO1xuICAgICAgcmV0dXJuIGNvbXAocHJvcHMsIHNldFN0YXRlLCAuLi5hcmdzKTtcbiAgICB9O1xuICAgIGNvbnN0IHNldFVwZGF0ZUZ1bmN0aW9uID0gKHZub2RlKSA9PiB7XG4gICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgfTtcblxuICAgIHJldHVybiBjb21wb3NlKG9uTW91bnQoc2V0VXBkYXRlRnVuY3Rpb24pLCBvblVwZGF0ZShzZXRVcGRhdGVGdW5jdGlvbikpKHdyYXBwZXJDb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcyc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbi8vdG9kbyB0aHJvdyB0aGlzIGluIGZhdm9yIG9mIGNvbm5lY3Qgb25seSA/XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh2aWV3KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe21vZGVsLCB1cGRhdGVzLCBzdWJzY3JpcHRpb25zID0gW119PXt9KSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgbGV0IGFjdGlvblN0b3JlID0ge307XG4gICAgZm9yIChsZXQgdXBkYXRlIG9mIE9iamVjdC5rZXlzKHVwZGF0ZXMpKSB7XG4gICAgICBhY3Rpb25TdG9yZVt1cGRhdGVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgbW9kZWwgPSB1cGRhdGVzW3VwZGF0ZV0obW9kZWwsIC4uLmFyZ3MpOyAvL3RvZG8gY29uc2lkZXIgc2lkZSBlZmZlY3RzLCBtaWRkbGV3YXJlcywgZXRjXG4gICAgICAgIHJldHVybiB1cGRhdGVGdW5jKG1vZGVsLCBhY3Rpb25TdG9yZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29tcCA9ICgpID0+IHZpZXcobW9kZWwsIGFjdGlvblN0b3JlKTtcblxuICAgIGNvbnN0IGluaXRBY3Rpb25TdG9yZSA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZShjb21wLCB2bm9kZSk7XG4gICAgfTtcbiAgICBjb25zdCBpbml0U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5tYXAoc3ViID0+IHZub2RlID0+IHN1Yih2bm9kZSwgYWN0aW9uU3RvcmUpKTtcbiAgICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICAgIHJldHVybiBvbk1vdW50KGluaXRGdW5jLCBjb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVuTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcydcbmltcG9ydCB7aXNEZWVwRXF1YWwsIGlkZW50aXR5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENvbm5lY3QgY29tYmluYXRvcjogd2lsbCBjcmVhdGUgXCJjb250YWluZXJcIiBjb21wb25lbnQgd2hpY2ggd2lsbCBzdWJzY3JpYmUgdG8gYSBSZWR1eCBsaWtlIHN0b3JlLiBhbmQgdXBkYXRlIGl0cyBjaGlsZHJlbiB3aGVuZXZlciBhIHNwZWNpZmljIHNsaWNlIG9mIHN0YXRlIGNoYW5nZSB1bmRlciBzcGVjaWZpYyBjaXJjdW1zdGFuY2VzXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChzdG9yZSwgYWN0aW9ucyA9IHt9LCBzbGljZVN0YXRlID0gaWRlbnRpdHkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChjb21wLCBtYXBTdGF0ZVRvUHJvcCA9IGlkZW50aXR5LCBzaG91bGRVcGF0ZSA9IChhLCBiKSA9PiBpc0RlZXBFcXVhbChhLCBiKSA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGluaXRQcm9wKSB7XG4gICAgICBsZXQgY29tcG9uZW50UHJvcHMgPSBpbml0UHJvcDtcbiAgICAgIGxldCB1cGRhdGVGdW5jLCBwcmV2aW91c1N0YXRlU2xpY2UsIHVuc3Vic2NyaWJlcjtcblxuICAgICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgcmV0dXJuIGNvbXAocHJvcHMsIGFjdGlvbnMsIC4uLmFyZ3MpO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgc3Vic2NyaWJlID0gb25Nb3VudCgodm5vZGUpID0+IHtcbiAgICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgICAgICB1bnN1YnNjcmliZXIgPSBzdG9yZS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHN0YXRlU2xpY2UgPSBzbGljZVN0YXRlKHN0b3JlLmdldFN0YXRlKCkpO1xuICAgICAgICAgIGlmIChzaG91bGRVcGF0ZShwcmV2aW91c1N0YXRlU2xpY2UsIHN0YXRlU2xpY2UpID09PSB0cnVlKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNvbXBvbmVudFByb3BzLCBtYXBTdGF0ZVRvUHJvcChzdGF0ZVNsaWNlKSk7XG4gICAgICAgICAgICB1cGRhdGVGdW5jKGNvbXBvbmVudFByb3BzKTtcbiAgICAgICAgICAgIHByZXZpb3VzU3RhdGVTbGljZSA9IHN0YXRlU2xpY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB1bnN1YnNjcmliZSA9IG9uVW5Nb3VudCgoKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlcigpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBjb21wb3NlKHN1YnNjcmliZSwgdW5zdWJzY3JpYmUpKHdyYXBwZXJDb21wKTtcbiAgICB9O1xuICB9O1xufTsiLCJpbXBvcnQge2gsIG9uTW91bnR9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcblxuZXhwb3J0IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgZGVsYXkgPSAzMDApIHtcbiAgbGV0IHRpbWVvdXRJZDtcbiAgcmV0dXJuIChldikgPT4ge1xuICAgIGlmICh0aW1lb3V0SWQpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICB9XG4gICAgdGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgZm4oZXYpO1xuICAgIH0sIGRlbGF5KTtcbiAgfTtcbn1cblxuZXhwb3J0IGNvbnN0IHRyYXBLZXlkb3duID0gKC4uLmtleXMpID0+IChldikgPT4ge1xuICBjb25zdCB7a2V5Q29kZX0gPWV2O1xuICBpZiAoa2V5cy5pbmRleE9mKGtleUNvZGUpID09PSAtMSkge1xuICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG59OyIsImltcG9ydCB7aCwgb25Nb3VudH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuXG5cbmV4cG9ydCBjb25zdCBhdXRvRm9jdXMgPSBvbk1vdW50KG4gPT4gbi5kb20uZm9jdXMoKSk7XG5leHBvcnQgY29uc3QgSW5wdXQgPSBhdXRvRm9jdXMocHJvcHMgPT4ge1xuICBkZWxldGUgIHByb3BzLmNoaWxkcmVuOyAvL25vIGNoaWxkcmVuIGZvciBpbnB1dHNcbiAgcmV0dXJuIDxpbnB1dCB7Li4ucHJvcHN9IC8+XG59KTsiLCJpbXBvcnQge2gsIHdpdGhTdGF0ZX0gZnJvbSAnZmxhY28nO1xuaW1wb3J0IHtkZWJvdW5jZSwgdHJhcEtleWRvd259IGZyb20gJy4vaGVscGVyJztcbmltcG9ydCB7SW5wdXQsIGF1dG9Gb2N1c30gZnJvbSAnLi9pbnB1dHMnO1xuXG5jb25zdCB0b2dnbGVPbktleURvd24gPSBwcm9wcyA9PiAoZXYpID0+IHtcbiAgY29uc3Qge2tleUNvZGV9ID0gZXY7XG4gIGlmIChrZXlDb2RlID09PSAxMykge1xuICAgIHByb3BzLnRvZ2dsZUVkaXQodHJ1ZSkoKTtcbiAgfSBlbHNlIGlmIChrZXlDb2RlID09PSAyNykge1xuICAgIGV2LmN1cnJlbnRUYXJnZXQuZm9jdXMoKTtcbiAgfVxufTtcblxuY29uc3QgSW5wdXRDZWxsID0gKHByb3BzKSA9PiB7XG5cbiAgY29uc3Qgb25LZXlkb3duID0gdG9nZ2xlT25LZXlEb3duKHByb3BzKVxuXG4gIHJldHVybiA8dGQgdGFiSW5kZXg9XCItMVwiIG9uS2V5RG93bj17b25LZXlkb3dufSBvbkNsaWNrPXtwcm9wcy50b2dnbGVFZGl0KHRydWUpfSBjbGFzcz17cHJvcHMuY2xhc3NOYW1lfT5cbiAgICB7XG4gICAgICBwcm9wcy5pc0VkaXRpbmcgPT09ICd0cnVlJyA/XG4gICAgICAgIDxJbnB1dCBvbktleWRvd249e3RyYXBLZXlkb3duKDI3KX0gdHlwZT17cHJvcHMudHlwZSB8fCAndGV4dCd9IHZhbHVlPXtwcm9wcy5jdXJyZW50VmFsdWV9XG4gICAgICAgICAgICAgICBvbklucHV0PXtwcm9wcy5vbklucHV0fVxuICAgICAgICAgICAgICAgb25CbHVyPXtwcm9wcy50b2dnbGVFZGl0KGZhbHNlKX0vPlxuICAgICAgICA6IDxzcGFuPntwcm9wcy5jdXJyZW50VmFsdWV9PC9zcGFuPlxuICAgIH1cbiAgPC90ZD5cbn07XG5cbmNvbnN0IG1ha2VFZGl0YWJsZSA9IGNvbXAgPT4ge1xuICByZXR1cm4gd2l0aFN0YXRlKChwcm9wcywgc2V0U3RhdGUpID0+IHtcbiAgICBjb25zdCB0b2dnbGVFZGl0ID0gKHZhbCkgPT4gKCkgPT4gc2V0U3RhdGUoT2JqZWN0LmFzc2lnbih7fSwgcHJvcHMsIHtpc0VkaXRpbmc6IHZhbCAhPT0gdm9pZCAwID8gdmFsIDogcHJvcHMuaXNFZGl0aW5nICE9PSB0cnVlfSkpO1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IHt0b2dnbGVFZGl0LCAuLi5wcm9wc307XG4gICAgcmV0dXJuIGNvbXAoZnVsbFByb3BzKTtcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVMYXN0TmFtZSA9IG1ha2VFZGl0YWJsZSgocHJvcHMpID0+IHtcbiAgY29uc3Qge3RvZ2dsZUVkaXQsIHBlcnNvbiwgaW5kZXgsIGNsYXNzTmFtZSwgcGF0Y2gsIGlzRWRpdGluZ30gPSBwcm9wcztcbiAgbGV0IGN1cnJlbnRWYWx1ZSA9IHBlcnNvbi5uYW1lLmxhc3Q7XG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7bmFtZToge2xhc3Q6IGN1cnJlbnRWYWx1ZSwgZmlyc3Q6IHBlcnNvbi5uYW1lLmZpcnN0fX0pO1xuICB9KTtcblxuICByZXR1cm4gPElucHV0Q2VsbCBpc0VkaXRpbmc9e1N0cmluZyhpc0VkaXRpbmcgPT09IHRydWUpfSB0b2dnbGVFZGl0PXt0b2dnbGVFZGl0fSBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFZhbHVlPXtjdXJyZW50VmFsdWV9IG9uSW5wdXQ9e29uSW5wdXR9Lz5cbn0pO1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVGaXJzdE5hbWUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24ubmFtZS5maXJzdDtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtuYW1lOiB7Zmlyc3Q6IGN1cnJlbnRWYWx1ZSwgbGFzdDogcGVyc29uLm5hbWUubGFzdH19KTtcbiAgfSk7XG5cbiAgcmV0dXJuIDxJbnB1dENlbGwgaXNFZGl0aW5nPXtTdHJpbmcoaXNFZGl0aW5nID09PSB0cnVlKX0gdG9nZ2xlRWRpdD17dG9nZ2xlRWRpdH0gY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRWYWx1ZT17Y3VycmVudFZhbHVlfSBvbklucHV0PXtvbklucHV0fS8+XG59KTtcblxuY29uc3QgR2VuZGVyU2VsZWN0ID0gYXV0b0ZvY3VzKCh7b25DaGFuZ2UsIHRvZ2dsZUVkaXQsIHBlcnNvbn0pID0+IHtcbiAgcmV0dXJuIDxzZWxlY3Qgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNyl9IG5hbWU9XCJnZW5kZXIgc2VsZWN0XCIgb25DaGFuZ2U9e29uQ2hhbmdlfSBvbkJsdXI9e3RvZ2dsZUVkaXQoZmFsc2UpfT5cbiAgICA8b3B0aW9uIHZhbHVlPVwibWFsZVwiIHNlbGVjdGVkPXtwZXJzb24uZ2VuZGVyID09PSAnbWFsZSd9Pm1hbGU8L29wdGlvbj5cbiAgICA8b3B0aW9uIHZhbHVlPVwiZmVtYWxlXCIgc2VsZWN0ZWQ9e3BlcnNvbi5nZW5kZXIgPT09ICdmZW1hbGUnfT5mZW1hbGU8L29wdGlvbj5cbiAgPC9zZWxlY3Q+XG59KTtcblxuZXhwb3J0IGNvbnN0IEVkaXRhYmxlR2VuZGVyID0gbWFrZUVkaXRhYmxlKChwcm9wcykgPT4ge1xuICBjb25zdCB7dG9nZ2xlRWRpdCwgcGVyc29uLCBpbmRleCwgY2xhc3NOYW1lLCBwYXRjaCwgaXNFZGl0aW5nfSA9IHByb3BzO1xuICBsZXQgY3VycmVudFZhbHVlID0gcGVyc29uLmdlbmRlcjtcblxuICBjb25zdCBvbktleWRvd24gPSB0b2dnbGVPbktleURvd24ocHJvcHMpO1xuXG4gIGNvbnN0IG9uQ2hhbmdlID0gZGVib3VuY2UoZXYgPT4ge1xuICAgIGN1cnJlbnRWYWx1ZSA9IGV2LnRhcmdldC52YWx1ZTtcbiAgICBwYXRjaChpbmRleCwge2dlbmRlcjogY3VycmVudFZhbHVlfSk7XG4gIH0pO1xuICBjb25zdCBnZW5kZXJDbGFzcyA9IHBlcnNvbi5nZW5kZXIgPT09ICdmZW1hbGUnID8gJ2dlbmRlci1mZW1hbGUnIDogJ2dlbmRlci1tYWxlJztcblxuICByZXR1cm4gPHRkIHRhYkluZGV4PVwiLTFcIiBvbktleURvd249e29uS2V5ZG93bn0gb25DbGljaz17dG9nZ2xlRWRpdCh0cnVlKX0gY2xhc3M9e2NsYXNzTmFtZX0+XG4gICAge1xuICAgICAgaXNFZGl0aW5nID8gPEdlbmRlclNlbGVjdCBvbkNoYW5nZT17b25DaGFuZ2V9IHRvZ2dsZUVkaXQ9e3RvZ2dsZUVkaXR9IHBlcnNvbj17cGVyc29ufS8+IDpcbiAgICAgICAgPHNwYW4gY2xhc3M9e2dlbmRlckNsYXNzfT57Y3VycmVudFZhbHVlfTwvc3Bhbj5cbiAgICB9XG4gIDwvdGQ+O1xufSk7XG5cbmV4cG9ydCBjb25zdCBFZGl0YWJsZVNpemUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24uc2l6ZTtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtzaXplOiBjdXJyZW50VmFsdWV9KTtcbiAgfSk7XG4gIGNvbnN0IHJhdGlvID0gTWF0aC5taW4oKHBlcnNvbi5zaXplIC0gMTUwKSAvIDUwLCAxKSAqIDEwMDtcblxuICBjb25zdCBvbktleWRvd24gPSB0b2dnbGVPbktleURvd24ocHJvcHMpO1xuXG4gIHJldHVybiA8dGQgdGFiSW5kZXg9XCItMVwiIGNsYXNzPXtjbGFzc05hbWV9IG9uS2V5RG93bj17b25LZXlkb3dufSBvbkNsaWNrPXt0b2dnbGVFZGl0KHRydWUpfT5cbiAgICB7XG4gICAgICBpc0VkaXRpbmcgPyA8SW5wdXQgb25LZXlkb3duPXt0cmFwS2V5ZG93bigyNyl9IHR5cGU9XCJudW1iZXJcIiBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiB2YWx1ZT17Y3VycmVudFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgIG9uQmx1cj17dG9nZ2xlRWRpdChmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgb25JbnB1dD17b25JbnB1dH0vPiA6XG4gICAgICAgIDxzcGFuPjxzcGFuIHN0eWxlPXtgaGVpZ2h0OiAke3JhdGlvfSVgfSBjbGFzcz1cInNpemUtc3RpY2tcIj48L3NwYW4+e2N1cnJlbnRWYWx1ZX08L3NwYW4+XG4gICAgfVxuICA8L3RkPjtcbn0pO1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVCaXJ0aERhdGUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24uYmlydGhEYXRlO1xuXG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7YmlydGhEYXRlOiBuZXcgRGF0ZShjdXJyZW50VmFsdWUpfSk7XG4gIH0pO1xuXG4gIHJldHVybiA8SW5wdXRDZWxsIHR5cGU9XCJkYXRlXCIgaXNFZGl0aW5nPXtTdHJpbmcoaXNFZGl0aW5nID09PSB0cnVlKX0gdG9nZ2xlRWRpdD17dG9nZ2xlRWRpdH0gY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRWYWx1ZT17Y3VycmVudFZhbHVlLnRvRGF0ZVN0cmluZygpfSBvbklucHV0PXtvbklucHV0fS8+XG59KTtcbiIsImltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IHtjb25uZWN0LCBoLCBvblVwZGF0ZX0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHtFZGl0YWJsZUxhc3ROYW1lLCBFZGl0YWJsZUJpcnRoRGF0ZSwgRWRpdGFibGVTaXplLCBFZGl0YWJsZUdlbmRlciwgRWRpdGFibGVGaXJzdE5hbWV9IGZyb20gJy4vZWRpdGFibGVDZWxsJztcblxuY29uc3QgbWFwU3RhdGVUb1Byb3AgPSBzdGF0ZSA9PiAoe3BlcnNvbnM6IHN0YXRlfSk7XG5jb25zdCBkb2VzVXBkYXRlTGlzdCA9IChwcmV2aW91cywgY3VycmVudCkgPT4ge1xuICBsZXQgb3V0cHV0ID0gdHJ1ZTtcbiAgaWYgKHR5cGVvZiBwcmV2aW91cyA9PT0gdHlwZW9mIGN1cnJlbnQpIHtcbiAgICBvdXRwdXQgPSBwcmV2aW91cy5sZW5ndGggIT09IGN1cnJlbnQubGVuZ3RoIHx8IHByZXZpb3VzLnNvbWUoKGksIGspID0+IHByZXZpb3VzW2tdLnZhbHVlLmlkICE9PSBjdXJyZW50W2tdLnZhbHVlLmlkKTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBzdGF0ZSA9PiBzdGF0ZS5kaXNwbGF5ZWQ7XG5jb25zdCBhY3Rpb25zID0ge1xuICByZW1vdmU6IGluZGV4ID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAncmVtb3ZlJywgYXJnczogW2luZGV4XX0pLFxuICBwYXRjaDogKGluZGV4LCB2YWx1ZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdwYXRjaCcsIGFyZ3M6IFtpbmRleCwgdmFsdWVdfSlcbn07XG5jb25zdCBzdWJzY3JpYmVUb0Rpc3BsYXkgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcbmNvbnN0IGZvY3VzRmlyc3RDZWxsID0gb25VcGRhdGUodm5vZGUgPT4ge1xuICBjb25zdCBmaXJzdENlbGwgPSB2bm9kZS5kb20ucXVlcnlTZWxlY3RvcigndGQnKTtcbiAgaWYgKGZpcnN0Q2VsbCAhPT0gbnVsbCkge1xuICAgIGZpcnN0Q2VsbC5mb2N1cygpO1xuICB9XG59KTtcblxuY29uc3QgVEJvZHkgPSBmb2N1c0ZpcnN0Q2VsbCgoe3BlcnNvbnMgPSBbXSwgcGF0Y2gsIHJlbW92ZX0pID0+IHtcbiAgcmV0dXJuIHBlcnNvbnMubGVuZ3RoID8gPHRib2R5PlxuICAgIHtcbiAgICAgIHBlcnNvbnMubWFwKCh7dmFsdWUsIGluZGV4fSkgPT4gPHRyPlxuICAgICAgICA8RWRpdGFibGVMYXN0TmFtZSBjbGFzc05hbWU9XCJjb2wtbGFzdG5hbWVcIiBwZXJzb249e3ZhbHVlfSBpbmRleD17aW5kZXh9IHBhdGNoPXtwYXRjaH0vPlxuICAgICAgICA8RWRpdGFibGVGaXJzdE5hbWUgY2xhc3NOYW1lPVwiY29sLWZpcnN0bmFtZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDxFZGl0YWJsZUJpcnRoRGF0ZSBjbGFzc05hbWU9XCJjb2wtYmlydGhkYXRlXCIgcGVyc29uPXt2YWx1ZX0gaW5kZXg9e2luZGV4fSBwYXRjaD17cGF0Y2h9Lz5cbiAgICAgICAgPEVkaXRhYmxlR2VuZGVyIGNsYXNzTmFtZT1cImNvbC1nZW5kZXIgZml4ZWQtc2l6ZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDxFZGl0YWJsZVNpemUgY2xhc3NOYW1lPVwiY29sLXNpemUgZml4ZWQtc2l6ZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDx0ZCBjbGFzcz1cImZpeGVkLXNpemUgY29sLWFjdGlvbnNcIiBkYXRhLWtleWJvYXJkLXNlbGVjdG9yPVwiYnV0dG9uXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0YWJpbmRleD1cIi0xXCIgb25DbGljaz17KCkgPT4gcmVtb3ZlKGluZGV4KX0+UlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L3RkPlxuICAgICAgPC90cj4pXG4gICAgfVxuICAgIDwvdGJvZHk+IDogPHRib2R5PlxuICAgIDx0cj5cbiAgICAgIDx0ZCB0YWJJbmRleD1cIi0xXCIgY29sU3Bhbj1cIjZcIj5UaGVyZSBpcyBubyBkYXRhIG1hdGNoaW5nIHlvdXIgcmVxdWVzdDwvdGQ+XG4gICAgPC90cj5cbiAgICA8L3Rib2R5PlxufSk7XG5cbmNvbnN0IFBlcnNvbkxpc3RDb21wb25lbnQgPSAocHJvcHMsIGFjdGlvbnMpID0+IHtcbiAgcmV0dXJuIDxUQm9keSBwZXJzb25zPXtwcm9wcy5wZXJzb25zfSByZW1vdmU9e2FjdGlvbnMucmVtb3ZlfVxuICAgICAgICAgICAgICAgIHBhdGNoPXthY3Rpb25zLnBhdGNofS8+XG59O1xuXG5leHBvcnQgY29uc3QgUGVyc29uTGlzdCA9IHN1YnNjcmliZVRvRGlzcGxheShQZXJzb25MaXN0Q29tcG9uZW50LCBtYXBTdGF0ZVRvUHJvcCwgZG9lc1VwZGF0ZUxpc3QpO1xuIiwiaW1wb3J0IHtoLCBjb25uZWN0fSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5pbXBvcnQgc3RvcmUgZnJvbSAnLi4vbGliL3N0b3JlJztcblxuXG5jb25zdCBhY3Rpb25zID0ge307XG5jb25zdCBzbGljZVN0YXRlID0gc3RhdGUgPT4gKHtpc1Byb2Nlc3Npbmc6IHN0YXRlLmlzUHJvY2Vzc2luZ30pO1xuY29uc3Qgc3Vic2NyaWJlVG9Qcm9jZXNzaW5nID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IExvYWRpbmdJbmRpY2F0b3IgPSAoe2lzUHJvY2Vzc2luZ30pID0+IHtcbiAgY29uc3QgY2xhc3NOYW1lID0gaXNQcm9jZXNzaW5nID09PSB0cnVlID8gJ3N0LXdvcmtpbmcnIDogJyc7XG4gIGNvbnN0IG1lc3NhZ2UgPSBpc1Byb2Nlc3NpbmcgPT09IHRydWUgPyAnbG9hZGluZyBwZXJzb25zIGRhdGEnIDogJ2RhdGEgbG9hZGVkJztcbiAgcmV0dXJuIDxkaXYgaWQ9XCJvdmVybGF5XCIgYXJpYS1saXZlPVwiYXNzZXJ0aXZlXCIgcm9sZT1cImFsZXJ0XCIgY2xhc3M9e2NsYXNzTmFtZX0+XG4gICAge21lc3NhZ2V9XG4gIDwvZGl2Pjtcbn07XG5leHBvcnQgY29uc3QgV29ya0luUHJvZ3Jlc3MgPSBzdWJzY3JpYmVUb1Byb2Nlc3NpbmcoTG9hZGluZ0luZGljYXRvcik7XG4iLCJpbXBvcnQge2gsIGNvbm5lY3R9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IGpzb24gZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuY29uc3QgYWN0aW9ucyA9IHtcbiAgdG9nZ2xlU29ydDogKHtwb2ludGVyLCBkaXJlY3Rpb259KSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3NvcnQnLCBhcmdzOiBbe3BvaW50ZXIsIGRpcmVjdGlvbn1dfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0ganNvbigndGFibGVTdGF0ZS5zb3J0JykuZ2V0O1xuY29uc3Qgc3Vic2NyaWJlVG9Tb3J0ID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IFNvcnRCdXR0b25Db21wb25lbnQgPSAocHJvcHMgPT4ge1xuICBjb25zdCB7Y29sdW1uUG9pbnRlciwgc29ydERpcmVjdGlvbnMgPSBbJ2FzYycsICdkZXNjJ10sIHBvaW50ZXIsIGRpcmVjdGlvbiwgc29ydH0gPSBwcm9wcztcbiAgY29uc3QgYWN0dWFsQ3Vyc29yID0gY29sdW1uUG9pbnRlciAhPT0gcG9pbnRlciA/IC0xIDogc29ydERpcmVjdGlvbnMuaW5kZXhPZihkaXJlY3Rpb24pO1xuICBjb25zdCBuZXdDdXJzb3IgPSAoYWN0dWFsQ3Vyc29yICsgMSApICUgc29ydERpcmVjdGlvbnMubGVuZ3RoO1xuICBjb25zdCB0b2dnbGVTb3J0ID0gKCkgPT4gc29ydCh7cG9pbnRlcjogY29sdW1uUG9pbnRlciwgZGlyZWN0aW9uOiBzb3J0RGlyZWN0aW9uc1tuZXdDdXJzb3JdfSk7XG4gIHJldHVybiA8YnV0dG9uIHRhYmluZGV4PVwiLTFcIiBvbkNsaWNrPXt0b2dnbGVTb3J0fT5CPC9idXR0b24+XG59KTtcblxuZXhwb3J0IGNvbnN0IFNvcnRCdXR0b24gPSBzdWJzY3JpYmVUb1NvcnQoKHByb3BzLCBhY3Rpb25zKSA9PlxuICA8U29ydEJ1dHRvbkNvbXBvbmVudCB7Li4ucHJvcHN9IHNvcnQ9e2FjdGlvbnMudG9nZ2xlU29ydH0vPik7XG4iLCJpbXBvcnQge2gsIGNvbm5lY3R9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVyJztcbmltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IGpzb24gZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuY29uc3QgYWN0aW9ucyA9IHtcbiAgc2VhcmNoOiAodmFsdWUsIHNjb3BlKSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3NlYXJjaCcsIGFyZ3M6IFt7dmFsdWUsIHNjb3BlfV19KVxufTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBqc29uKCd0YWJsZVN0YXRlLnNlYXJjaCcpLmdldDtcbmNvbnN0IG5vTmVlZEZvclVwZGF0ZSA9IHN0YXRlID0+IGZhbHNlOy8vIGFsd2F5cyByZXR1cm4gdGhlIHNhbWUgdmFsdWVcbmNvbnN0IHNlYXJjaGFibGUgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcblxuY29uc3QgU2VhcmNoSW5wdXQgPSAocHJvcHMpID0+ICg8bGFiZWw+XG4gIDxzcGFuPntwcm9wcy5jaGlsZHJlbn08L3NwYW4+XG4gIDxpbnB1dCB0YWJpbmRleD1cIjBcIiB0eXBlPVwic2VhcmNoXCIgb25JbnB1dD17cHJvcHMub25JbnB1dH0gcGxhY2Vob2xkZXI9e3Byb3BzLnBsYWNlaG9sZGVyfS8+XG48L2xhYmVsPik7XG5cbmV4cG9ydCBjb25zdCBTZWFyY2hSb3cgPSBzZWFyY2hhYmxlKChwcm9wcywgYWN0aW9ucykgPT4ge1xuICBjb25zdCBvbklucHV0ID0gZGVib3VuY2UoZXYgPT4gYWN0aW9ucy5zZWFyY2goZXYudGFyZ2V0LnZhbHVlLCBbJ25hbWUubGFzdCcsICduYW1lLmZpcnN0J10pLCAzMDApO1xuICBkZWxldGUgcHJvcHMuY2hpbGRyZW47XG4gIHJldHVybiA8dHIgey4uLnByb3BzfT5cbiAgICA8dGggZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cImlucHV0XCI+XG4gICAgICA8U2VhcmNoSW5wdXQgcGxhY2Vob2xkZXI9XCJDYXNlIHNlbnNpdGl2ZSBzZWFyY2ggb24gc3VybmFtZSBhbmQgbmFtZVwiIG9uSW5wdXQ9e29uSW5wdXR9PlNlYXJjaDo8L1NlYXJjaElucHV0PlxuICAgIDwvdGg+XG4gIDwvdHI+XG59LCBub05lZWRGb3JVcGRhdGUsIG5vTmVlZEZvclVwZGF0ZSk7IiwiaW1wb3J0IHtoLCBjb25uZWN0LCBvblVwZGF0ZX0gZnJvbSAnZmxhY28nO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5cbmNvbnN0IGZvY3VzT25PcGVuID0gb25VcGRhdGUodm5vZGUgPT4ge1xuICBjb25zdCBhaCA9IHZub2RlLnByb3BzWydhcmlhLWhpZGRlbiddO1xuICBpZiAoYWggPT09ICdmYWxzZScpIHtcbiAgICBjb25zdCBpbnB1dCA9IHZub2RlLmRvbS5xdWVyeVNlbGVjdG9yKCdpbnB1dCwgc2VsZWN0Jyk7XG4gICAgaWYgKGlucHV0KSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IGlucHV0LmZvY3VzKCksIDUpO1xuICAgIH1cbiAgfVxufSk7XG5cbmNvbnN0IGFjdGlvbnMgPSB7XG4gIHRvZ2dsZUZpbHRlck1lbnU6IChmaWx0ZXIpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnVE9HR0xFX0ZJTFRFUicsIGZpbHRlcn0pLFxuICBjb21taXRGaWx0ZXI6ICh2YWx1ZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdmaWx0ZXInLCBhcmdzOiBbdmFsdWVdfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0gc3RhdGUgPT4gKHthY3RpdmVGaWx0ZXI6IHN0YXRlLmFjdGl2ZUZpbHRlciwgZmlsdGVyQ2xhdXNlczogc3RhdGUudGFibGVTdGF0ZS5maWx0ZXJ9KTtcbmNvbnN0IHN1YnNjcmliZVRvRmlsdGVyID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IEZpbHRlclJvd0NvbXAgPSBmb2N1c09uT3BlbigocHJvcHMgPSB7fSkgPT4ge1xuICBjb25zdCB7aXNIaWRkZW4sIHRvZ2dsZUZpbHRlck1lbnUsIGNvbW1pdEZpbHRlcn0gPSBwcm9wcztcbiAgY29uc3QgY2xvc2UgPSAoKSA9PiB7XG4gICAgdG9nZ2xlRmlsdGVyTWVudShudWxsKTtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBbYXJpYS1jb250cm9scz0ke2lkTmFtZX1dYCkuZm9jdXMoKTtcbiAgfTtcbiAgY29uc3Qgb25TdWJtaXQgPSAoZXYpID0+IHtcbiAgICBjb25zdCBmb3JtID0gZXYudGFyZ2V0O1xuICAgIGNvbnN0IHtuYW1lfSA9IGZvcm07XG4gICAgY29uc3QgaW5wdXRzID0gZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCwgc2VsZWN0Jyk7XG4gICAgY29tbWl0RmlsdGVyKHtcbiAgICAgIFtuYW1lXTogWy4uLmlucHV0c10ubWFwKGlucHV0ID0+IHtcbiAgICAgICAgcmV0dXJuIHt0eXBlOiBpbnB1dC50eXBlLCB2YWx1ZTogaW5wdXQudmFsdWUsIG9wZXJhdG9yOiBpbnB1dC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3BlcmF0b3InKSB8fCAnaW5jbHVkZXMnfVxuICAgICAgfSlcbiAgICB9KTtcbiAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGNsb3NlKCk7XG4gIH07XG4gIGNvbnN0IGlkTmFtZSA9IFsnZmlsdGVyJ10uY29uY2F0KHByb3BzLnNjb3BlLnNwbGl0KCcuJykpLmpvaW4oJy0nKTtcbiAgY29uc3Qgb25LZXlEb3duID0gKGV2KSA9PiB7XG4gICAgaWYgKGV2LmNvZGUgPT09ICdFc2NhcGUnIHx8IGV2LmtleUNvZGUgPT09IDI3IHx8IGV2LmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICAgIGNsb3NlKCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGFyaWFIaWRkZW4gPSBpc0hpZGRlbiAhPT0gdHJ1ZTtcbiAgcmV0dXJuIDx0ciBpZD17aWROYW1lfSBjbGFzcz1cImZpbHRlci1yb3dcIiBvbktleWRvd249e29uS2V5RG93bn0gZGF0YS1rZXlib2FyZC1za2lwPXthcmlhSGlkZGVufVxuICAgICAgICAgICAgIGFyaWEtaGlkZGVuPXtTdHJpbmcoYXJpYUhpZGRlbil9PlxuICAgIDx0aCBjb2xzcGFuPVwiNlwiIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJpbnB1dCwgc2VsZWN0XCI+XG4gICAgICA8Zm9ybSBuYW1lPXtwcm9wcy5zY29wZX0gb25TdWJtaXQ9e29uU3VibWl0fT5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgICA8ZGl2IGNsYXNzPVwidmlzdWFsbHktaGlkZGVuXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0YWJJbmRleD1cIi0xXCI+QXBwbHk8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxwIGlkPXtpZE5hbWUgKyAnLWluc3RydWN0aW9uJ30+UHJlc3MgRW50ZXIgdG8gYWN0aXZhdGUgZmlsdGVyIG9yIGVzY2FwZSB0byBkaXNtaXNzPC9wPlxuICAgICAgPC9mb3JtPlxuICAgIDwvdGg+XG4gIDwvdHI+XG59KTtcblxuY29uc3QgRmlsdGVyQnV0dG9uID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtjb2x1bW5Qb2ludGVyLCB0b2dnbGVGaWx0ZXJNZW51LCBmaWx0ZXJDbGF1c2VzID0ge319PXByb3BzO1xuICBjb25zdCBjdXJyZW50RmlsdGVyQ2xhdXNlcyA9IGZpbHRlckNsYXVzZXNbY29sdW1uUG9pbnRlcl0gfHwgW107XG4gIGNvbnN0IGNvbnRyb2xsZWQgPSBbJ2ZpbHRlciddLmNvbmNhdChjb2x1bW5Qb2ludGVyLnNwbGl0KCcuJykpLmpvaW4oJy0nKTtcbiAgY29uc3Qgb25DbGljayA9ICgpID0+IHRvZ2dsZUZpbHRlck1lbnUoY29sdW1uUG9pbnRlcik7XG4gIGNvbnN0IGlzQWN0aXZlID0gY3VycmVudEZpbHRlckNsYXVzZXMubGVuZ3RoICYmIGN1cnJlbnRGaWx0ZXJDbGF1c2VzLnNvbWUoY2xhdXNlID0+IGNsYXVzZS52YWx1ZSk7XG4gIHJldHVybiA8YnV0dG9uIGFyaWEtaGFzcG9wdXA9XCJ0cnVlXCIgdGFiaW5kZXg9XCItMVwiIGNsYXNzPXtpc0FjdGl2ZSA/ICdhY3RpdmUtZmlsdGVyJyA6ICcnfSBhcmlhLWNvbnRyb2xzPXtjb250cm9sbGVkfVxuICAgICAgICAgICAgICAgICBvbkNsaWNrPXtvbkNsaWNrfT5GPC9idXR0b24+XG59O1xuXG5leHBvcnQgY29uc3QgVG9nZ2xlRmlsdGVyQnV0dG9uID0gc3Vic2NyaWJlVG9GaWx0ZXIoKHByb3BzLCBhY3Rpb25zKSA9PiB7XG4gIHJldHVybiA8RmlsdGVyQnV0dG9uIHsuLi5wcm9wc30gdG9nZ2xlRmlsdGVyTWVudT17YWN0aW9ucy50b2dnbGVGaWx0ZXJNZW51fS8+XG59KTtcblxuZXhwb3J0IGNvbnN0IEZpbHRlclJvdyA9IHN1YnNjcmliZVRvRmlsdGVyKChwcm9wcywgYWN0aW9ucykgPT4ge1xuICByZXR1cm4gPEZpbHRlclJvd0NvbXAgc2NvcGU9e3Byb3BzLnNjb3BlfSBpc0hpZGRlbj17cHJvcHMuYWN0aXZlRmlsdGVyID09PSBwcm9wcy5zY29wZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRvZ2dsZUZpbHRlck1lbnU9e2FjdGlvbnMudG9nZ2xlRmlsdGVyTWVudX0gY29tbWl0RmlsdGVyPXthY3Rpb25zLmNvbW1pdEZpbHRlcn0+XG5cbiAgICB7cHJvcHMuY2hpbGRyZW59XG4gIDwvRmlsdGVyUm93Q29tcD47XG59KTsiLCJpbXBvcnQge2h9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcblxuaW1wb3J0IHtTb3J0QnV0dG9ufSBmcm9tICcuL3NvcnQnO1xuaW1wb3J0IHtTZWFyY2hSb3d9IGZyb20gJy4vc2VhcmNoJztcbmltcG9ydCB7RmlsdGVyUm93LCBUb2dnbGVGaWx0ZXJCdXR0b259IGZyb20gJy4vZmlsdGVyJztcbmltcG9ydCB7dHJhcEtleWRvd259IGZyb20gJy4vaGVscGVyJztcblxuXG5jb25zdCBDb2x1bW5IZWFkZXIgPSAocHJvcHMpID0+IHtcbiAgY29uc3Qge2NvbHVtblBvaW50ZXIsIHNvcnREaXJlY3Rpb25zID0gWydhc2MnLCAnZGVzYyddLCBjbGFzc05hbWUsIGNoaWxkcmVufSA9IHByb3BzO1xuXG4gIHJldHVybiA8dGggY2xhc3M9e2NsYXNzTmFtZX0gZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cImJ1dHRvblwiPlxuICAgIHtjaGlsZHJlbn1cbiAgICA8ZGl2IGNsYXNzPVwiYnV0dG9ucy1jb250YWluZXJcIj5cbiAgICAgIDxTb3J0QnV0dG9uIGNvbHVtblBvaW50ZXI9e2NvbHVtblBvaW50ZXJ9IHNvcnREaXJlY3Rpb25zPXtzb3J0RGlyZWN0aW9uc30vPlxuICAgICAgPFRvZ2dsZUZpbHRlckJ1dHRvbiBjb2x1bW5Qb2ludGVyPXtjb2x1bW5Qb2ludGVyfS8+XG4gICAgPC9kaXY+XG4gIDwvdGg+XG59O1xuXG5cbmV4cG9ydCBjb25zdCBIZWFkZXJzID0gKCkgPT4ge1xuXG4gIHJldHVybiA8dGhlYWQ+XG4gIDxTZWFyY2hSb3cgY2xhc3M9XCJmaWx0ZXItcm93XCIvPlxuICA8dHI+XG4gICAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtbGFzdG5hbWVcIiBjb2x1bW5Qb2ludGVyPVwibmFtZS5sYXN0XCJcbiAgICAgICAgICAgICAgICAgIHNvcnREaXJlY3Rpb25zPXtbJ2FzYycsICdkZXNjJywgJ25vbmUnXX0+U3VybmFtZTwvQ29sdW1uSGVhZGVyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLWZpcnN0bmFtZVwiIGNvbHVtblBvaW50ZXI9XCJuYW1lLmZpcnN0XCI+TmFtZTwvQ29sdW1uSGVhZGVyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLWJpcnRoZGF0ZVwiIHNvcnREaXJlY3Rpb25zPXtbJ2Rlc2MnLCAnYXNjJ119XG4gICAgICAgICAgICAgICAgICBjb2x1bW5Qb2ludGVyPVwiYmlydGhEYXRlXCI+RGF0ZSBvZiBiaXJ0aDwvQ29sdW1uSGVhZGVyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLWdlbmRlciBmaXhlZC1zaXplXCIgY29sdW1uUG9pbnRlcj1cImdlbmRlclwiPkdlbmRlcjwvQ29sdW1uSGVhZGVyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLXNpemUgZml4ZWQtc2l6ZVwiIGNvbHVtblBvaW50ZXI9XCJzaXplXCI+U2l6ZTwvQ29sdW1uSGVhZGVyPlxuICAgIDx0aCBkYXRhLWtleWJvYXJkLXNraXA9e3RydWV9IGNsYXNzPVwiZml4ZWQtc2l6ZSBjb2wtYWN0aW9uc1wiPjwvdGg+XG4gIDwvdHI+XG4gIDxGaWx0ZXJSb3cgc2NvcGU9XCJuYW1lLmxhc3RcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj5zdXJuYW1lIGluY2x1ZGVzOjwvc3Bhbj5cbiAgICAgIDxpbnB1dCBhcmlhLWRlc2NyaWJlZGJ5PVwiZmlsdGVyLW5hbWUtbGFzdC1pbnN0cnVjdGlvblwiIG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcsIDM4LCA0MCl9XG4gICAgICAgICAgICAgdHlwZT1cInRleHRcIlxuICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiY2FzZSBpbnNlbnNpdGl2ZSBzdXJuYW1lIHZhbHVlXCIvPlxuICAgIDwvbGFiZWw+XG4gIDwvRmlsdGVyUm93PlxuICA8RmlsdGVyUm93IHNjb3BlPVwibmFtZS5maXJzdFwiPlxuICAgIDxsYWJlbD5cbiAgICAgIDxzcGFuPm5hbWUgaW5jbHVkZXM6PC9zcGFuPlxuICAgICAgPGlucHV0IG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcsIDM4LCA0MCl9IHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCJjYXNlIGluc2Vuc2l0aXZlIG5hbWUgdmFsdWVcIi8+XG4gICAgPC9sYWJlbD5cbiAgPC9GaWx0ZXJSb3c+XG4gIDxGaWx0ZXJSb3cgc2NvcGU9XCJiaXJ0aERhdGVcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj5ib3JuIGFmdGVyOjwvc3Bhbj5cbiAgICAgIDxpbnB1dCBvbktleURvd249e3RyYXBLZXlkb3duKDI3KX0gZGF0YS1vcGVyYXRvcj1cImd0XCIgdHlwZT1cImRhdGVcIi8+XG4gICAgPC9sYWJlbD5cbiAgPC9GaWx0ZXJSb3c+XG4gIDxGaWx0ZXJSb3cgc2NvcGU9XCJnZW5kZXJcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj5nZW5kZXIgaXM6PC9zcGFuPlxuICAgICAgPHNlbGVjdCBvbktleURvd249e3RyYXBLZXlkb3duKDI3KX0gZGF0YS1vcGVyYXRvcj1cImlzXCI+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJcIj4tPC9vcHRpb24+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJmZW1hbGVcIj5mZW1hbGU8L29wdGlvbj5cbiAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIm1hbGVcIj5tYWxlPC9vcHRpb24+XG4gICAgICA8L3NlbGVjdD5cbiAgICA8L2xhYmVsPlxuICA8L0ZpbHRlclJvdz5cbiAgPEZpbHRlclJvdyBzY29wZT1cInNpemVcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj50YWxsZXIgdGhhbjo8L3NwYW4+XG4gICAgICA8aW5wdXQgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNyl9IG1pbj1cIjE1MFwiIG1heD1cIjIwMFwiIHN0ZXA9XCIxXCIgdHlwZT1cInJhbmdlXCIgZGF0YS1vcGVyYXRvcj1cImd0XCIvPlxuICAgIDwvbGFiZWw+XG4gICAgPGxhYmVsPlxuICAgICAgPHNwYW4+c21hbGxlciB0aGFuOjwvc3Bhbj5cbiAgICAgIDxpbnB1dCBvbktleURvd249e3RyYXBLZXlkb3duKDI3KX0gbWluPVwiMTUwXCIgbWF4PVwiMjAwXCIgc3RlcD1cIjFcIiB0eXBlPVwicmFuZ2VcIiBkYXRhLW9wZXJhdG9yPVwibHRcIi8+XG4gICAgPC9sYWJlbD5cbiAgPC9GaWx0ZXJSb3c+XG4gIDwvdGhlYWQ+XG59IiwiaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5pbXBvcnQge2Nvbm5lY3QsIGh9IGZyb20gJ2ZsYWNvJztcblxuXG5jb25zdCBhY3Rpb25zID0ge1xuICBzbGljZTogKHBhZ2UsIHNpemUpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnc2xpY2UnLCBhcmdzOiBbe3BhZ2UsIHNpemV9XX0pXG59O1xuY29uc3Qgc2xpY2VTdGF0ZSA9IHN0YXRlID0+IHN0YXRlLnN1bW1hcnk7XG5jb25zdCBzdWJzY3JpYmVUb1N1bW1hcnkgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcblxuY29uc3QgU3VtbWFyeSA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7cGFnZSwgc2l6ZSwgZmlsdGVyZWRDb3VudH0gPSBwcm9wcztcbiAgcmV0dXJuICg8ZGl2PiBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+eyhwYWdlIC0gMSkgKiBzaXplICsgKGZpbHRlcmVkQ291bnQgPiAwID8gMSA6IDApfTwvc3Ryb25nPiAtXG4gICAgPHN0cm9uZz57TWF0aC5taW4oZmlsdGVyZWRDb3VudCwgcGFnZSAqIHNpemUpfTwvc3Ryb25nPiBvZiA8c3Ryb25nPntmaWx0ZXJlZENvdW50fTwvc3Ryb25nPiBtYXRjaGluZyBpdGVtc1xuICA8L2Rpdj4pO1xufTtcblxuY29uc3QgUGFnZVNpemUgPSBwcm9wcyA9PiB7XG4gIGNvbnN0IHtzaXplLCBzbGljZX0gPSBwcm9wcztcbiAgY29uc3QgY2hhbmdlUGFnZVNpemUgPSAoZXYpID0+IHNsaWNlKDEsIE51bWJlcihldi50YXJnZXQudmFsdWUpKTtcbiAgcmV0dXJuIDxkaXY+XG4gICAgPGxhYmVsPlxuICAgICAgUGFnZSBzaXplXG4gICAgICA8c2VsZWN0IHRhYkluZGV4PVwiLTFcIiBvbkNoYW5nZT17Y2hhbmdlUGFnZVNpemV9IG5hbWU9XCJwYWdlU2l6ZVwiPlxuICAgICAgICA8b3B0aW9uIHNlbGVjdGVkPXtzaXplID09IDIwfSB2YWx1ZT1cIjIwXCI+MjAgaXRlbXM8L29wdGlvbj5cbiAgICAgICAgPG9wdGlvbiBzZWxlY3RlZD17c2l6ZSA9PSAzMH0gdmFsdWU9XCIzMFwiPjMwIGl0ZW1zPC9vcHRpb24+XG4gICAgICAgIDxvcHRpb24gc2VsZWN0ZWQ9e3NpemUgPT0gNTB9IHZhbHVlPVwiNTBcIj41MCBpdGVtczwvb3B0aW9uPlxuICAgICAgPC9zZWxlY3Q+XG4gICAgPC9sYWJlbD5cbiAgPC9kaXY+XG59O1xuXG5jb25zdCBQYWdlciA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7cGFnZSwgc2l6ZSwgZmlsdGVyZWRDb3VudCwgc2xpY2V9ID0gcHJvcHM7XG4gIGNvbnN0IHNlbGVjdFByZXZpb3VzUGFnZSA9ICgpID0+IHNsaWNlKHBhZ2UgLSAxLCBzaXplKTtcbiAgY29uc3Qgc2VsZWN0TmV4dFBhZ2UgPSAoKSA9PiBzbGljZShwYWdlICsgMSwgc2l6ZSk7XG4gIGNvbnN0IGlzUHJldmlvdXNEaXNhYmxlZCA9IHBhZ2UgPT09IDE7XG4gIGNvbnN0IGlzTmV4dERpc2FibGVkID0gKGZpbHRlcmVkQ291bnQgLSAocGFnZSAqIHNpemUpKSA8PSAwO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdj5cbiAgICAgIDxidXR0b24gdGFiSW5kZXg9XCItMVwiIG9uQ2xpY2s9e3NlbGVjdFByZXZpb3VzUGFnZX0gZGlzYWJsZWQ9e2lzUHJldmlvdXNEaXNhYmxlZH0+XG4gICAgICAgIFByZXZpb3VzXG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxzbWFsbD4gUGFnZSAtIHtwYWdlIHx8IDF9IDwvc21hbGw+XG4gICAgICA8YnV0dG9uIHRhYkluZGV4PVwiLTFcIiBvbkNsaWNrPXtzZWxlY3ROZXh0UGFnZX0gZGlzYWJsZWQ9e2lzTmV4dERpc2FibGVkfT5cbiAgICAgICAgTmV4dFxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5jb25zdCBTdW1tYXJ5Rm9vdGVyID0gc3Vic2NyaWJlVG9TdW1tYXJ5KFN1bW1hcnkpO1xuY29uc3QgUGFnaW5hdGlvbiA9IHN1YnNjcmliZVRvU3VtbWFyeSgocHJvcHMsIGFjdGlvbnMpID0+IDxQYWdlciB7Li4ucHJvcHN9IHNsaWNlPXthY3Rpb25zLnNsaWNlfS8+KTtcbmNvbnN0IFNlbGVjdFBhZ2VTaXplID0gc3Vic2NyaWJlVG9TdW1tYXJ5KChwcm9wcywgYWN0aW9ucykgPT4gPFBhZ2VTaXplIHsuLi5wcm9wc30gc2xpY2U9e2FjdGlvbnMuc2xpY2V9Lz4pO1xuXG5leHBvcnQgY29uc3QgRm9vdGVyID0gKCkgPT4gPHRmb290PlxuPHRyPlxuICA8dGQgY29sc3Bhbj1cIjNcIj5cbiAgICA8U3VtbWFyeUZvb3Rlci8+XG4gIDwvdGQ+XG4gIDx0ZCBjb2xzcGFuPVwiMlwiIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJidXR0b246bm90KDpkaXNhYmxlZClcIiBjb2xTcGFuPVwiM1wiPlxuICAgIDxQYWdpbmF0aW9uLz5cbiAgPC90ZD5cbiAgPHRkIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJzZWxlY3RcIj5cbiAgICA8U2VsZWN0UGFnZVNpemUvPlxuICA8L3RkPlxuPC90cj5cbjwvdGZvb3Q+O1xuXG5cblxuIiwiZXhwb3J0IGNvbnN0IGZpbmRDb250YWluZXIgPSAoZWxlbWVudCwgc2VsZWN0b3IpID0+IGVsZW1lbnQubWF0Y2hlcyhzZWxlY3RvcikgPT09IHRydWUgPyBlbGVtZW50IDogZmluZENvbnRhaW5lcihlbGVtZW50LnBhcmVudEVsZW1lbnQsIHNlbGVjdG9yKTtcbmV4cG9ydCBjb25zdCBkYXRhU2VsZWN0b3JBdHRyaWJ1dGUgPSAnZGF0YS1rZXlib2FyZC1zZWxlY3Rvcic7XG5leHBvcnQgY29uc3QgZGF0YVNraXBBdHRyaWJ1dGUgPSAnZGF0YS1rZXlib2FyZC1za2lwJztcbmV4cG9ydCBjb25zdCB2YWxGdW5jID0gdmFsID0+ICgpID0+IHZhbDtcbmV4cG9ydCBjb25zdCB2YWxOdWxsID0gdmFsRnVuYyhudWxsKTsiLCJpbXBvcnQge1xuICBmaW5kQ29udGFpbmVyLFxuICBkYXRhU2VsZWN0b3JBdHRyaWJ1dGUsXG4gIGRhdGFTa2lwQXR0cmlidXRlLFxuICB2YWxGdW5jXG59IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWd1bGFyQ2VsbCAoZWxlbWVudCwge3Jvd1NlbGVjdG9yLCBjZWxsU2VsZWN0b3J9KSB7XG4gIGNvbnN0IHJvdyA9IGZpbmRDb250YWluZXIoZWxlbWVudCwgcm93U2VsZWN0b3IpO1xuICBjb25zdCBjZWxscyA9IFsuLi5yb3cucXVlcnlTZWxlY3RvckFsbChjZWxsU2VsZWN0b3IpXTtcbiAgY29uc3QgaW5kZXggPSBjZWxscy5pbmRleE9mKGVsZW1lbnQpO1xuICBjb25zdCByZXR1cm5FbCA9IHZhbEZ1bmMoZWxlbWVudCk7XG4gIHJldHVybiB7XG4gICAgc2VsZWN0RnJvbUFmdGVyOiByZXR1cm5FbCxcbiAgICBzZWxlY3RGcm9tQmVmb3JlOiByZXR1cm5FbCxcbiAgICBuZXh0KCl7XG4gICAgICByZXR1cm4gY2VsbHNbaW5kZXggKyAxXSAhPT0gdm9pZCAwID8gY2VsbHNbaW5kZXggKyAxXSA6IG51bGw7XG4gICAgfSxcbiAgICBwcmV2aW91cygpe1xuICAgICAgcmV0dXJuIGNlbGxzW2luZGV4IC0gMV0gIT09IHZvaWQgMCA/IGNlbGxzW2luZGV4IC0gMV0gOiBudWxsO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2tpcENlbGwgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgY29uc3QgcmVnID0gcmVndWxhckNlbGwoZWxlbWVudCwgb3B0aW9ucyk7XG4gIHJldHVybiB7XG4gICAgcHJldmlvdXM6IHJlZy5wcmV2aW91cyxcbiAgICBuZXh0OiByZWcubmV4dFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NpdGVDZWxsIChlbGVtZW50LCBvcHRpb25zKSB7XG4gIGNvbnN0IGNlbGxFbGVtZW50ID0gZmluZENvbnRhaW5lcihlbGVtZW50LCBvcHRpb25zLmNlbGxTZWxlY3Rvcik7XG4gIGNvbnN0IHNlbGVjdG9yID0gY2VsbEVsZW1lbnQuZ2V0QXR0cmlidXRlKGRhdGFTZWxlY3RvckF0dHJpYnV0ZSk7XG4gIGNvbnN0IHN1YldpZGdldHMgPSBbLi4uY2VsbEVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcildO1xuICBjb25zdCB3aWRnZXRzTGVuZ3RoID0gc3ViV2lkZ2V0cy5sZW5ndGg7XG4gIGNvbnN0IGlzU3ViV2lkZ2V0ID0gZWxlbWVudCAhPT0gY2VsbEVsZW1lbnQ7XG4gIHJldHVybiB7XG4gICAgc2VsZWN0RnJvbUJlZm9yZSgpe1xuICAgICAgcmV0dXJuIGlzU3ViV2lkZ2V0ID8gZWxlbWVudCA6IHN1YldpZGdldHNbMF07XG4gICAgfSxcbiAgICBzZWxlY3RGcm9tQWZ0ZXIoKXtcbiAgICAgIHJldHVybiBpc1N1YldpZGdldCA/IGVsZW1lbnQgOiBzdWJXaWRnZXRzW3dpZGdldHNMZW5ndGggLSAxXTtcbiAgICB9LFxuICAgIG5leHQoKXtcbiAgICAgIGNvbnN0IGluZGV4ID0gc3ViV2lkZ2V0cy5pbmRleE9mKGVsZW1lbnQpO1xuICAgICAgaWYgKGlzU3ViV2lkZ2V0ICYmIGluZGV4ICsgMSA8IHdpZGdldHNMZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHN1YldpZGdldHNbaW5kZXggKyAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZWd1bGFyQ2VsbChjZWxsRWxlbWVudCwgb3B0aW9ucykubmV4dCgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgcHJldmlvdXMoKXtcbiAgICAgIGNvbnN0IGluZGV4ID0gc3ViV2lkZ2V0cy5pbmRleE9mKGVsZW1lbnQpO1xuICAgICAgaWYgKGlzU3ViV2lkZ2V0ICYmIGluZGV4ID4gMCkge1xuICAgICAgICByZXR1cm4gc3ViV2lkZ2V0c1tpbmRleCAtIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlZ3VsYXJDZWxsKGNlbGxFbGVtZW50LCBvcHRpb25zKS5wcmV2aW91cygpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2VsbCAoZWwsIG9wdGlvbnMpIHtcbiAgaWYgKGVsID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSBpZiAoZWwuaGFzQXR0cmlidXRlKGRhdGFTa2lwQXR0cmlidXRlKSkge1xuICAgIHJldHVybiBza2lwQ2VsbChlbCwgb3B0aW9ucyk7XG4gIH0gZWxzZSBpZiAoZWwuaGFzQXR0cmlidXRlKGRhdGFTZWxlY3RvckF0dHJpYnV0ZSkgfHwgIWVsLm1hdGNoZXMob3B0aW9ucy5jZWxsU2VsZWN0b3IpKSB7XG4gICAgcmV0dXJuIGNvbXBvc2l0ZUNlbGwoZWwsIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiByZWd1bGFyQ2VsbChlbCwgb3B0aW9ucyk7XG4gIH1cbn0iLCJpbXBvcnQge2ZpbmRDb250YWluZXIsIGRhdGFTa2lwQXR0cmlidXRlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVndWxhclJvdyAoZWxlbWVudCwgZ3JpZCwge3Jvd1NlbGVjdG9yID0gJ3RyJywgY2VsbFNlbGVjdG9yID0gJ3RoLHRkJ309e30pIHtcbiAgY29uc3Qgcm93cyA9IFsuLi5ncmlkLnF1ZXJ5U2VsZWN0b3JBbGwocm93U2VsZWN0b3IpXTtcbiAgY29uc3QgY2VsbHMgPSBbLi4uZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICBjb25zdCBpbmRleCA9IHJvd3MuaW5kZXhPZihlbGVtZW50KTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2aW91cygpe1xuICAgICAgcmV0dXJuIHJvd3NbaW5kZXggLSAxXSAhPT0gdm9pZCAwID8gcm93c1tpbmRleCAtIDFdIDogbnVsbDtcbiAgICB9LFxuICAgIG5leHQoKXtcbiAgICAgIHJldHVybiByb3dzW2luZGV4ICsgMV0gIT09IHZvaWQgMCA/IHJvd3NbaW5kZXggKyAxXSA6IG51bGw7XG4gICAgfSxcbiAgICBpdGVtKGluZGV4KXtcbiAgICAgIHJldHVybiBjZWxsc1tpbmRleF0gIT09IHZvaWQgMCA/IGNlbGxzW2luZGV4XSA6IG51bGw7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2tpcFJvdyAoZWxlbWVudCwgZ3JpZCwgb3B0aW9ucykge1xuICBjb25zdCByZWd1bGFyID0gcmVndWxhclJvdyhlbGVtZW50LCBncmlkLCBvcHRpb25zKTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2aW91czogcmVndWxhci5wcmV2aW91cyxcbiAgICBuZXh0OiByZWd1bGFyLm5leHRcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJvdyAodGFyZ2V0LCBncmlkLCB7cm93U2VsZWN0b3IsIGNlbGxTZWxlY3Rvcn09e30pIHtcbiAgaWYgKHRhcmdldCA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHIgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICByZXR1cm4gci5oYXNBdHRyaWJ1dGUoZGF0YVNraXBBdHRyaWJ1dGUpID8gc2tpcFJvdyhyLCBncmlkLCB7XG4gICAgICByb3dTZWxlY3RvcixcbiAgICAgIGNlbGxTZWxlY3RvclxuICAgIH0pIDogcmVndWxhclJvdyh0YXJnZXQsIGdyaWQsIHtyb3dTZWxlY3RvciwgY2VsbFNlbGVjdG9yfSk7XG59IiwiaW1wb3J0IHtjcmVhdGVDZWxsfSBmcm9tICcuL2NlbGwnO1xuaW1wb3J0IHtjcmVhdGVSb3d9IGZyb20gJy4vcm93JztcbmltcG9ydCB7ZmluZENvbnRhaW5lcn0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIGtleUdyaWQgKGdyaWQsIG9wdGlvbnMpIHtcbiAgY29uc3Qge3Jvd1NlbGVjdG9yLCBjZWxsU2VsZWN0b3J9ID0gb3B0aW9ucztcbiAgcmV0dXJuIHtcbiAgICBtb3ZlUmlnaHQodGFyZ2V0KXtcbiAgICAgIGNvbnN0IGNlbGwgPSBjcmVhdGVDZWxsKHRhcmdldCwgb3B0aW9ucyk7XG4gICAgICBsZXQgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwoY2VsbC5uZXh0KCksIG9wdGlvbnMpO1xuICAgICAgd2hpbGUgKG5ld0NlbGwgIT09IG51bGwgJiYgbmV3Q2VsbC5zZWxlY3RGcm9tQmVmb3JlID09PSB2b2lkIDApIHtcbiAgICAgICAgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Q2VsbC5uZXh0KCksIG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld0NlbGwgIT09IG51bGwgPyBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUoKSA6IHRhcmdldDtcbiAgICB9LFxuICAgIG1vdmVMZWZ0KHRhcmdldCl7XG4gICAgICBjb25zdCBjZWxsID0gY3JlYXRlQ2VsbCh0YXJnZXQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld0NlbGwgPSBjcmVhdGVDZWxsKGNlbGwucHJldmlvdXMoKSwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Q2VsbCAhPT0gbnVsbCAmJiBuZXdDZWxsLnNlbGVjdEZyb21BZnRlciA9PT0gdm9pZCAwKSB7XG4gICAgICAgIG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld0NlbGwucHJldmlvdXMoKSwgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3Q2VsbCAhPT0gbnVsbCA/IG5ld0NlbGwuc2VsZWN0RnJvbUFmdGVyKCkgOiB0YXJnZXQ7XG4gICAgfSxcbiAgICBtb3ZlVXAodGFyZ2V0KXtcbiAgICAgIGNvbnN0IHJvd0VsZW1lbnQgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICAgICAgY29uc3QgY2VsbHMgPSBbLi4ucm93RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICAgICAgY29uc3Qgcm93ID0gY3JlYXRlUm93KHJvd0VsZW1lbnQsIGdyaWQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld1JvdyA9IGNyZWF0ZVJvdyhyb3cucHJldmlvdXMoKSwgZ3JpZCwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Um93ICE9PSBudWxsICYmIG5ld1Jvdy5pdGVtID09PSB2b2lkIDApIHtcbiAgICAgICAgbmV3Um93ID0gY3JlYXRlUm93KG5ld1Jvdy5wcmV2aW91cygpLCBncmlkLCBvcHRpb25zKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1JvdyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgfVxuXG4gICAgICBsZXQgYXNrZWRJbmRleCA9IGNlbGxzLmluZGV4T2YoZmluZENvbnRhaW5lcih0YXJnZXQsIGNlbGxTZWxlY3RvcikpO1xuICAgICAgbGV0IG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld1Jvdy5pdGVtKGFza2VkSW5kZXgpLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdDZWxsID09PSBudWxsIHx8IG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSA9PT0gdm9pZCAwICYmIGFza2VkSW5kZXggPiAwKSB7XG4gICAgICAgIGFza2VkSW5kZXgtLTtcbiAgICAgICAgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Um93Lml0ZW0oYXNrZWRJbmRleCksIG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSgpO1xuICAgIH0sXG4gICAgbW92ZURvd24odGFyZ2V0KXtcbiAgICAgIGNvbnN0IHJvd0VsZW1lbnQgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICAgICAgY29uc3QgY2VsbHMgPSBbLi4ucm93RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICAgICAgY29uc3Qgcm93ID0gY3JlYXRlUm93KHJvd0VsZW1lbnQsIGdyaWQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld1JvdyA9IGNyZWF0ZVJvdyhyb3cubmV4dCgpLCBncmlkLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdSb3cgIT09IG51bGwgJiYgbmV3Um93Lml0ZW0gPT09IHZvaWQgMCkge1xuICAgICAgICBuZXdSb3cgPSBjcmVhdGVSb3cobmV3Um93Lm5leHQoKSwgZ3JpZCwgb3B0aW9ucyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChuZXdSb3cgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICAgIH1cblxuICAgICAgbGV0IGFza2VkSW5kZXggPSBjZWxscy5pbmRleE9mKGZpbmRDb250YWluZXIodGFyZ2V0LCBjZWxsU2VsZWN0b3IpKTtcbiAgICAgIGxldCBuZXdDZWxsID0gY3JlYXRlQ2VsbChuZXdSb3cuaXRlbShhc2tlZEluZGV4KSwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Q2VsbCA9PT0gbnVsbCB8fCBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUgPT09IHZvaWQgMCAmJiBhc2tlZEluZGV4ID4gMCkge1xuICAgICAgICBhc2tlZEluZGV4LS07XG4gICAgICAgIG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld1Jvdy5pdGVtKGFza2VkSW5kZXgpLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUoKTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQge2tleUdyaWR9IGZyb20gJy4vbGliL2tleWdyaWQnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoZ3JpZCwge3Jvd1NlbGVjdG9yID0gJ3RyJywgY2VsbFNlbGVjdG9yID0gJ3RkLHRoJ309e30pIHtcbiAgbGV0IGxhc3RGb2N1cyA9IG51bGw7XG4gIGNvbnN0IGtnID0ga2V5R3JpZChncmlkLCB7cm93U2VsZWN0b3IsIGNlbGxTZWxlY3Rvcn0pO1xuXG4gIGdyaWQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsICh7dGFyZ2V0LCBrZXlDb2RlfSkgPT4ge1xuICAgIGxldCBuZXdDZWxsID0gbnVsbDtcbiAgICBpZiAoa2V5Q29kZSA9PT0gMzcpIHtcbiAgICAgIG5ld0NlbGwgPSBrZy5tb3ZlTGVmdCh0YXJnZXQpO1xuICAgIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gMzgpIHtcbiAgICAgIG5ld0NlbGwgPSBrZy5tb3ZlVXAodGFyZ2V0KTtcbiAgICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDM5KSB7XG4gICAgICBuZXdDZWxsID0ga2cubW92ZVJpZ2h0KHRhcmdldCk7XG4gICAgfSBlbHNlIGlmIChrZXlDb2RlID09PSA0MCkge1xuICAgICAgbmV3Q2VsbCA9IGtnLm1vdmVEb3duKHRhcmdldCk7XG4gICAgfVxuXG4gICAgaWYgKG5ld0NlbGwgIT09IG51bGwpIHtcbiAgICAgIG5ld0NlbGwuZm9jdXMoKTtcbiAgICAgIGlmIChsYXN0Rm9jdXMgIT09IG51bGwpIHtcbiAgICAgICAgbGFzdEZvY3VzLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnLTEnKTtcbiAgICAgIH1cbiAgICAgIG5ld0NlbGwuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG4gICAgICBsYXN0Rm9jdXMgPSBuZXdDZWxsO1xuICAgIH1cbiAgfSk7XG59IiwiaW1wb3J0IHtoLCBtb3VudCwgY29ubmVjdCwgb25VcGRhdGUsIG9uTW91bnR9IGZyb20gJ2ZsYWNvJztcbmltcG9ydCB7UGVyc29uTGlzdH0gZnJvbSAnLi9jb21wb25lbnRzL3Rib2R5JztcbmltcG9ydCB7V29ya0luUHJvZ3Jlc3N9IGZyb20gJy4vY29tcG9uZW50cy9sb2FkaW5nSW5kaWNhdG9yJztcbmltcG9ydCB7SGVhZGVyc30gZnJvbSAnLi9jb21wb25lbnRzL2hlYWRlcnMnO1xuaW1wb3J0IHtGb290ZXJ9IGZyb20gJy4vY29tcG9uZW50cy9mb290ZXInO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4vbGliL3N0b3JlJztcbmltcG9ydCBrZXlib2FyZCBmcm9tICdzbWFydC10YWJsZS1rZXlib2FyZCc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IHRhYmxlID0gb25Nb3VudChuID0+IHtcbiAgc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdleGVjJywgYXJnczogW119KTsgLy9raWNrIHNtYXJ0VGFibGVcbiAga2V5Ym9hcmQobi5kb20ucXVlcnlTZWxlY3RvcigndGFibGUnKSk7XG59KTtcblxuY29uc3QgUGVyc29uVGFibGUgPSB0YWJsZSgoKSA9PlxuICA8ZGl2IGlkPVwidGFibGUtY29udGFpbmVyXCI+XG4gICAgPFdvcmtJblByb2dyZXNzLz5cbiAgICA8dGFibGU+XG4gICAgICA8SGVhZGVycy8+XG4gICAgICA8UGVyc29uTGlzdC8+XG4gICAgICA8Rm9vdGVyLz5cbiAgICA8L3RhYmxlPlxuICA8L2Rpdj4pO1xuXG5tb3VudChQZXJzb25UYWJsZSwge30sIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluJykpOyJdLCJuYW1lcyI6WyJtb3VudCIsInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsInNtYXJ0VGFibGUiLCJjcmVhdGVUZXh0Vk5vZGUiLCJoIiwiY29tcG9zZSIsImN1cnJ5IiwidGFwIiwibmV4dFRpY2siLCJwYWlyaWZ5IiwiaXNTaGFsbG93RXF1YWwiLCJvd25LZXlzIiwiaXNEZWVwRXF1YWwiLCJpZGVudGl0eSIsIm5vb3AiLCJ1cGRhdGVEb21Ob2RlRmFjdG9yeSIsInJlbW92ZUV2ZW50TGlzdGVuZXJzIiwiYWRkRXZlbnRMaXN0ZW5lcnMiLCJzZXRBdHRyaWJ1dGVzIiwicmVtb3ZlQXR0cmlidXRlcyIsInNldFRleHROb2RlIiwiY3JlYXRlRG9tTm9kZSIsImdldEV2ZW50TGlzdGVuZXJzIiwidHJhdmVyc2UiLCJ1cGRhdGVFdmVudExpc3RlbmVycyIsInVwZGF0ZUF0dHJpYnV0ZXMiLCJkb21GYWN0b3J5IiwiZG9taWZ5IiwicmVuZGVyIiwidXBkYXRlIiwibGlmZUN5Y2xlRmFjdG9yeSIsIm9uTW91bnQiLCJvblVuTW91bnQiLCJvblVwZGF0ZSIsImNvbm5lY3QiLCJhY3Rpb25zIiwic2xpY2VTdGF0ZSIsImpzb24iXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU0sZUFBZSxHQUFHLENBQUMsS0FBSyxNQUFNO0VBQ2xDLFFBQVEsRUFBRSxNQUFNO0VBQ2hCLFFBQVEsRUFBRSxFQUFFO0VBQ1osS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDO0NBQ2YsQ0FBQyxDQUFDOzs7Ozs7Ozs7QUFTSCxBQUFlLFNBQVMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxRQUFRLEVBQUU7RUFDdkQsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEtBQUs7SUFDbkQsTUFBTSxhQUFhLEdB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
