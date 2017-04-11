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
  const vnode = comp(initProp || {});
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
 * Combinator to create a Elm like app
 * @param view
 */



/*

connect(store, actions, watcher)




 */

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
          h( 'button', { tabindex: "-1", onClick: () => remove(index) }, "R")
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

const SortButtonComponent = (props => {
  const {columnPointer, sortDirections = ['asc', 'desc'], pointer: pointer$$1, direction, sort} = props;
  const actualCursor = columnPointer !== pointer$$1 ? -1 : sortDirections.indexOf(direction);
  const newCursor = (actualCursor + 1 ) % sortDirections.length;
  const toggleSort = () => sort({pointer: columnPointer, direction: sortDirections[newCursor]});
  return h( 'button', { tabindex: "-1", onClick: toggleSort }, "B")
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvaC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL3RyYXZlcnNlLmpzIiwiLi4vLi4vbGliL3RyZWUuanMiLCIuLi8uLi9saWIvdXBkYXRlLmpzIiwiLi4vLi4vbGliL2xpZmVDeWNsZXMuanMiLCIuLi8uLi9saWIvd2l0aFN0YXRlLmpzIiwiLi4vLi4vbGliL2VsbS5qcyIsIi4uLy4uL2xpYi9jb25uZWN0LmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLW9wZXJhdG9ycy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc29ydC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1maWx0ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc2VhcmNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3NsaWNlLmpzIiwibm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWV2ZW50cy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy90YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy90YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jcnVkL2NydWQuanMiLCJub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY3J1ZC9pbmRleC5qcyIsImxpYi9yZWR1eFNtYXJ0VGFibGUuanMiLCJsaWIvc3RvcmUuanMiLCJjb21wb25lbnRzL2hlbHBlci5qcyIsImNvbXBvbmVudHMvaW5wdXRzLmpzIiwiY29tcG9uZW50cy9lZGl0YWJsZUNlbGwuanMiLCJjb21wb25lbnRzL3Rib2R5LmpzIiwiY29tcG9uZW50cy9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiY29tcG9uZW50cy9zb3J0LmpzIiwiY29tcG9uZW50cy9zZWFyY2guanMiLCJjb21wb25lbnRzL2ZpbHRlci5qcyIsImNvbXBvbmVudHMvaGVhZGVycy5qcyIsImNvbXBvbmVudHMvZm9vdGVyLmpzIiwiLi4vLi4vLi4vc21hcnQtdGFibGUta2V5Ym9hcmQvbGliL3V0aWwuanMiLCIuLi8uLi8uLi9zbWFydC10YWJsZS1rZXlib2FyZC9saWIvY2VsbC5qcyIsIi4uLy4uLy4uL3NtYXJ0LXRhYmxlLWtleWJvYXJkL2xpYi9yb3cuanMiLCIuLi8uLi8uLi9zbWFydC10YWJsZS1rZXlib2FyZC9saWIva2V5Z3JpZC5qcyIsIi4uLy4uLy4uL3NtYXJ0LXRhYmxlLWtleWJvYXJkL2luZGV4LmpzIiwiaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9XG59KTtcblxuLyoqXG4gKiBUcmFuc2Zvcm0gaHlwZXJzY3JpcHQgaW50byB2aXJ0dWFsIGRvbSBub2RlXG4gKiBAcGFyYW0gbm9kZVR5cGVcbiAqIEBwYXJhbSBwcm9wc1xuICogQHBhcmFtIGNoaWxkcmVuXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaCAobm9kZVR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICBjb25zdCBmbGF0Q2hpbGRyZW4gPSBjaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gQXJyYXkuaXNBcnJheShjaGlsZCkgPyBjaGlsZCA6IFtjaGlsZF07XG4gICAgcmV0dXJuIGFjYy5jb25jYXQoY2hpbGRyZW5BcnJheSk7XG4gIH0sIFtdKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gbm9ybWFsaXplIHRleHQgbm9kZSB0byBoYXZlIHNhbWUgc3RydWN0dXJlIHRoYW4gcmVndWxhciBkb20gbm9kZXNcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgY2hpbGQ7XG4gICAgICByZXR1cm4gdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkIDogY3JlYXRlVGV4dFZOb2RlKGNoaWxkKTtcbiAgICB9KTtcblxuICBpZiAodHlwZW9mIG5vZGVUeXBlICE9PSAnZnVuY3Rpb24nKSB7Ly9yZWd1bGFyIGh0bWwvdGV4dCBub2RlXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGVUeXBlLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgY2hpbGRyZW46IGZsYXRDaGlsZHJlblxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZnVsbFByb3BzID0gT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IGZsYXRDaGlsZHJlbn0sIHByb3BzKTtcbiAgICBjb25zdCBjb21wID0gbm9kZVR5cGUoZnVsbFByb3BzKTtcbiAgICByZXR1cm4gdHlwZW9mIGNvbXAgIT09ICdmdW5jdGlvbicgPyBjb21wIDogaChjb21wLCBwcm9wcywgLi4uZmxhdENoaWxkcmVuKTsgLy9mdW5jdGlvbmFsIGNvbXAgdnMgY29tYmluYXRvciAoSE9DKVxuICB9XG59OyIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBjb25zdCBuZXh0VGljayA9IGZuID0+IHNldFRpbWVvdXQoZm4sIDApO1xuXG5leHBvcnQgY29uc3QgcGFpcmlmeSA9IGhvbGRlciA9PiBrZXkgPT4gW2tleSwgaG9sZGVyW2tleV1dO1xuXG5leHBvcnQgY29uc3QgaXNTaGFsbG93RXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCBhS2V5cyA9IE9iamVjdC5rZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IE9iamVjdC5rZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoKGspID0+IGFba10gPT09IGJba10pO1xufTtcblxuY29uc3Qgb3duS2V5cyA9IG9iaiA9PiBPYmplY3Qua2V5cyhvYmopLmZpbHRlcihrID0+IG9iai5oYXNPd25Qcm9wZXJ0eShrKSk7XG5cbmV4cG9ydCBjb25zdCBpc0RlZXBFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IHR5cGUgPSB0eXBlb2YgYTtcblxuICAvL3Nob3J0IHBhdGgocylcbiAgaWYgKGEgPT09IGIpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSB0eXBlb2YgYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG5cbiAgLy8gb2JqZWN0cyAuLi5cbiAgaWYgKGEgPT09IG51bGwgfHwgYiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KGEpKSB7XG4gICAgcmV0dXJuIGEubGVuZ3RoICYmIGIubGVuZ3RoICYmIGEuZXZlcnkoKGl0ZW0sIGkpID0+IGlzRGVlcEVxdWFsKGFbaV0sIGJbaV0pKTtcbiAgfVxuXG4gIGNvbnN0IGFLZXlzID0gb3duS2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBvd25LZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoayA9PiBpc0RlZXBFcXVhbChhW2tdLCBiW2tdKSk7XG59O1xuXG5leHBvcnQgY29uc3QgaWRlbnRpdHkgPSBwID0+IHA7XG5cbmV4cG9ydCBjb25zdCBub29wID0gKCkgPT4ge1xufTtcbiIsImltcG9ydCB7dGFwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCB1cGRhdGVEb21Ob2RlRmFjdG9yeSA9IChtZXRob2QpID0+IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBwYWlyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZVttZXRob2RdKC4uLnBhaXIpO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IHJlbW92ZUV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ3JlbW92ZUV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBhZGRFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdhZGRFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3Qgc2V0QXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKChkb21Ob2RlKSA9PiB7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBpdGVtcy5maWx0ZXIoKFtrZXksIHZhbHVlXSkgPT4gdHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nKTtcbiAgZm9yIChsZXQgW2tleSwgdmFsdWVdIG9mIGF0dHJpYnV0ZXMpIHtcbiAgICB2YWx1ZSA9PT0gZmFsc2UgPyBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShrZXkpIDogZG9tTm9kZS5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZSk7XG4gIH1cbn0pO1xuZXhwb3J0IGNvbnN0IHJlbW92ZUF0dHJpYnV0ZXMgPSAoaXRlbXMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgYXR0ciBvZiBpdGVtcykge1xuICAgIGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IHNldFRleHROb2RlID0gdmFsID0+IG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudCA9IHZhbDtcblxuZXhwb3J0IGNvbnN0IGNyZWF0ZURvbU5vZGUgPSB2bm9kZSA9PiB7XG4gIHJldHVybiB2bm9kZS5ub2RlVHlwZSAhPT0gJ1RleHQnID9cbiAgICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHZub2RlLm5vZGVUeXBlKSA6XG4gICAgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoU3RyaW5nKHZub2RlLnByb3BzLnZhbHVlKSk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0RXZlbnRMaXN0ZW5lcnMgPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BzKVxuICAgIC5maWx0ZXIoayA9PiBrLnN1YnN0cigwLCAyKSA9PT0gJ29uJylcbiAgICAubWFwKGsgPT4gW2suc3Vic3RyKDIpLnRvTG93ZXJDYXNlKCksIHByb3BzW2tdXSk7XG59O1xuIiwiZXhwb3J0IGNvbnN0IHRyYXZlcnNlID0gZnVuY3Rpb24gKiAodm5vZGUpIHtcbiAgeWllbGQgdm5vZGU7XG4gIGlmICh2bm9kZS5jaGlsZHJlbiAmJiB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICBmb3IgKGxldCBjaGlsZCBvZiB2bm9kZS5jaGlsZHJlbikge1xuICAgICAgeWllbGQgKiB0cmF2ZXJzZShjaGlsZCk7XG4gICAgfVxuICB9XG59OyIsImltcG9ydCB7Y29tcG9zZSwgY3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQge1xuICBpc1NoYWxsb3dFcXVhbCxcbiAgcGFpcmlmeSxcbiAgbmV4dFRpY2ssXG4gIG5vb3Bcbn0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7XG4gIHJlbW92ZUF0dHJpYnV0ZXMsXG4gIHNldEF0dHJpYnV0ZXMsXG4gIHNldFRleHROb2RlLFxuICBjcmVhdGVEb21Ob2RlLFxuICByZW1vdmVFdmVudExpc3RlbmVycyxcbiAgYWRkRXZlbnRMaXN0ZW5lcnMsXG4gIGdldEV2ZW50TGlzdGVuZXJzLFxufSBmcm9tICcuL2RvbVV0aWwnO1xuaW1wb3J0IHt0cmF2ZXJzZX0gZnJvbSAnLi90cmF2ZXJzZSc7XG5cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzICh7cHJvcHM6bmV3Tm9kZVByb3BzfT17fSwge3Byb3BzOm9sZE5vZGVQcm9wc309e30pIHtcbiAgY29uc3QgbmV3Tm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG5ld05vZGVQcm9wcyB8fCB7fSk7XG4gIGNvbnN0IG9sZE5vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhvbGROb2RlUHJvcHMgfHwge30pO1xuXG4gIHJldHVybiBuZXdOb2RlRXZlbnRzLmxlbmd0aCB8fCBvbGROb2RlRXZlbnRzLmxlbmd0aCA/XG4gICAgY29tcG9zZShcbiAgICAgIHJlbW92ZUV2ZW50TGlzdGVuZXJzKG9sZE5vZGVFdmVudHMpLFxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcnMobmV3Tm9kZUV2ZW50cylcbiAgICApIDogbm9vcDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQXR0cmlidXRlcyAobmV3Vk5vZGUsIG9sZFZOb2RlKSB7XG4gIGNvbnN0IG5ld1ZOb2RlUHJvcHMgPSBuZXdWTm9kZS5wcm9wcyB8fCB7fTtcbiAgY29uc3Qgb2xkVk5vZGVQcm9wcyA9IG9sZFZOb2RlLnByb3BzIHx8IHt9O1xuXG4gIGlmIChpc1NoYWxsb3dFcXVhbChuZXdWTm9kZVByb3BzLCBvbGRWTm9kZVByb3BzKSkge1xuICAgIHJldHVybiBub29wO1xuICB9XG5cbiAgaWYgKG5ld1ZOb2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICByZXR1cm4gc2V0VGV4dE5vZGUobmV3Vk5vZGUucHJvcHMudmFsdWUpO1xuICB9XG5cbiAgY29uc3QgbmV3Tm9kZUtleXMgPSBPYmplY3Qua2V5cyhuZXdWTm9kZVByb3BzKTtcbiAgY29uc3Qgb2xkTm9kZUtleXMgPSBPYmplY3Qua2V5cyhvbGRWTm9kZVByb3BzKTtcbiAgY29uc3QgYXR0cmlidXRlc1RvUmVtb3ZlID0gb2xkTm9kZUtleXMuZmlsdGVyKGsgPT4gIW5ld05vZGVLZXlzLmluY2x1ZGVzKGspKTtcblxuICByZXR1cm4gY29tcG9zZShcbiAgICByZW1vdmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXNUb1JlbW92ZSksXG4gICAgc2V0QXR0cmlidXRlcyhuZXdOb2RlS2V5cy5tYXAocGFpcmlmeShuZXdWTm9kZVByb3BzKSkpXG4gICk7XG59XG5cbmNvbnN0IGRvbUZhY3RvcnkgPSBjcmVhdGVEb21Ob2RlO1xuXG4vLyBhcHBseSB2bm9kZSBkaWZmaW5nIHRvIGFjdHVhbCBkb20gbm9kZSAoaWYgbmV3IG5vZGUgPT4gaXQgd2lsbCBiZSBtb3VudGVkIGludG8gdGhlIHBhcmVudClcbmNvbnN0IGRvbWlmeSA9IGZ1bmN0aW9uIHVwZGF0ZURvbSAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlKSB7XG4gIGlmICghb2xkVm5vZGUpIHsvL3RoZXJlIGlzIG5vIHByZXZpb3VzIHZub2RlXG4gICAgaWYgKG5ld1Zub2RlKSB7Ly9uZXcgbm9kZSA9PiB3ZSBpbnNlcnRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IHBhcmVudERvbU5vZGUuYXBwZW5kQ2hpbGQoZG9tRmFjdG9yeShuZXdWbm9kZSkpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHJldHVybiB7dm5vZGU6IG5ld1Zub2RlLCBnYXJiYWdlOiBudWxsfTtcbiAgICB9IGVsc2Ugey8vZWxzZSAoaXJyZWxldmFudClcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgb3BlcmF0aW9uJylcbiAgICB9XG4gIH0gZWxzZSB7Ly90aGVyZSBpcyBhIHByZXZpb3VzIHZub2RlXG4gICAgaWYgKCFuZXdWbm9kZSkgey8vd2UgbXVzdCByZW1vdmUgdGhlIHJlbGF0ZWQgZG9tIG5vZGVcbiAgICAgIHBhcmVudERvbU5vZGUucmVtb3ZlQ2hpbGQob2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiAoe2dhcmJhZ2U6IG9sZFZub2RlLCBkb206IG51bGx9KTtcbiAgICB9IGVsc2UgaWYgKG5ld1Zub2RlLm5vZGVUeXBlICE9PSBvbGRWbm9kZS5ub2RlVHlwZSkgey8vaXQgbXVzdCBiZSByZXBsYWNlZFxuICAgICAgbmV3Vm5vZGUuZG9tID0gZG9tRmFjdG9yeShuZXdWbm9kZSk7XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSAxO1xuICAgICAgcGFyZW50RG9tTm9kZS5yZXBsYWNlQ2hpbGQobmV3Vm5vZGUuZG9tLCBvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBvbGRWbm9kZSwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9IGVsc2Ugey8vIG9ubHkgdXBkYXRlIGF0dHJpYnV0ZXNcbiAgICAgIG5ld1Zub2RlLmRvbSA9IG9sZFZub2RlLmRvbTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IG9sZFZub2RlLmxpZmVDeWNsZSArIDE7XG4gICAgICByZXR1cm4ge2dhcmJhZ2U6IG51bGwsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIHJlbmRlciBhIHZpcnR1YWwgZG9tIG5vZGUsIGRpZmZpbmcgaXQgd2l0aCBpdHMgcHJldmlvdXMgdmVyc2lvbiwgbW91bnRpbmcgaXQgaW4gYSBwYXJlbnQgZG9tIG5vZGVcbiAqIEBwYXJhbSBvbGRWbm9kZVxuICogQHBhcmFtIG5ld1Zub2RlXG4gKiBAcGFyYW0gcGFyZW50RG9tTm9kZVxuICogQHBhcmFtIG9uTmV4dFRpY2sgY29sbGVjdCBvcGVyYXRpb25zIHRvIGJlIHByb2Nlc3NlZCBvbiBuZXh0IHRpY2tcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZXhwb3J0IGNvbnN0IHJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcmVyIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUsIG9uTmV4dFRpY2sgPSBbXSkge1xuXG4gIC8vMS4gdHJhbnNmb3JtIHRoZSBuZXcgdm5vZGUgdG8gYSB2bm9kZSBjb25uZWN0ZWQgdG8gYW4gYWN0dWFsIGRvbSBlbGVtZW50IGJhc2VkIG9uIHZub2RlIHZlcnNpb25zIGRpZmZpbmdcbiAgLy8gaS4gbm90ZSBhdCB0aGlzIHN0ZXAgb2NjdXIgZG9tIGluc2VydGlvbnMvcmVtb3ZhbHNcbiAgLy8gaWkuIGl0IG1heSBjb2xsZWN0IHN1YiB0cmVlIHRvIGJlIGRyb3BwZWQgKG9yIFwidW5tb3VudGVkXCIpXG4gIGNvbnN0IHt2bm9kZSwgZ2FyYmFnZX0gPSBkb21pZnkob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlKTtcblxuICBpZiAoZ2FyYmFnZSAhPT0gbnVsbCkge1xuICAgIC8vIGRlZmVyIHVuIG1vdW50IGxpZmVjeWNsZSBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGZvciAobGV0IGcgb2YgdHJhdmVyc2UoZ2FyYmFnZSkpIHtcbiAgICAgIGlmIChnLm9uVW5Nb3VudCkge1xuICAgICAgICBvbk5leHRUaWNrLnB1c2goZy5vblVuTW91bnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vTm9ybWFsaXNhdGlvbiBvZiBvbGQgbm9kZSAoaW4gY2FzZSBvZiBhIHJlcGxhY2Ugd2Ugd2lsbCBjb25zaWRlciBvbGQgbm9kZSBhcyBlbXB0eSBub2RlIChubyBjaGlsZHJlbiwgbm8gcHJvcHMpKVxuICBjb25zdCB0ZW1wT2xkTm9kZSA9IGdhcmJhZ2UgIT09IG51bGwgfHwgIW9sZFZub2RlID8ge2xlbmd0aDogMCwgY2hpbGRyZW46IFtdLCBwcm9wczoge319IDogb2xkVm5vZGU7XG5cbiAgaWYgKHZub2RlKSB7XG5cbiAgICAvLzIuIHVwZGF0ZSBkb20gYXR0cmlidXRlcyBiYXNlZCBvbiB2bm9kZSBwcm9wIGRpZmZpbmcuXG4gICAgLy9zeW5jXG5cbiAgICBpZiAodm5vZGUub25VcGRhdGUgJiYgdm5vZGUubGlmZUN5Y2xlID4gMSkge1xuICAgICAgdm5vZGUub25VcGRhdGUoKTtcbiAgICB9XG5cbiAgICB1cGRhdGVBdHRyaWJ1dGVzKHZub2RlLCB0ZW1wT2xkTm9kZSkodm5vZGUuZG9tKTtcblxuICAgIC8vZmFzdCBwYXRoXG4gICAgaWYgKHZub2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICAgIHJldHVybiBvbk5leHRUaWNrO1xuICAgIH1cblxuICAgIGlmICh2bm9kZS5vbk1vdW50ICYmIHZub2RlLmxpZmVDeWNsZSA9PT0gMSkge1xuICAgICAgb25OZXh0VGljay5wdXNoKCgpID0+IHZub2RlLm9uTW91bnQoKSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2hpbGRyZW5Db3VudCA9IE1hdGgubWF4KHRlbXBPbGROb2RlLmNoaWxkcmVuLmxlbmd0aCwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKTtcblxuICAgIC8vYXN5bmMgd2lsbCBiZSBkZWZlcnJlZCBhcyBpdCBpcyBub3QgXCJ2aXN1YWxcIlxuICAgIGNvbnN0IHNldExpc3RlbmVycyA9IHVwZGF0ZUV2ZW50TGlzdGVuZXJzKHZub2RlLCB0ZW1wT2xkTm9kZSk7XG4gICAgaWYgKHNldExpc3RlbmVycyAhPT0gbm9vcCkge1xuICAgICAgb25OZXh0VGljay5wdXNoKCgpID0+IHNldExpc3RlbmVycyh2bm9kZS5kb20pKTtcbiAgICB9XG5cbiAgICAvLzMgcmVjdXJzaXZlbHkgdHJhdmVyc2UgY2hpbGRyZW4gdG8gdXBkYXRlIGRvbSBhbmQgY29sbGVjdCBmdW5jdGlvbnMgdG8gcHJvY2VzcyBvbiBuZXh0IHRpY2tcbiAgICBpZiAoY2hpbGRyZW5Db3VudCA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Db3VudDsgaSsrKSB7XG4gICAgICAgIC8vIHdlIHBhc3Mgb25OZXh0VGljayBhcyByZWZlcmVuY2UgKGltcHJvdmUgcGVyZjogbWVtb3J5ICsgc3BlZWQpXG4gICAgICAgIHJlbmRlcih0ZW1wT2xkTm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmRvbSwgb25OZXh0VGljayk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9uTmV4dFRpY2s7XG59O1xuXG5leHBvcnQgY29uc3QgbW91bnQgPSBjdXJyeShmdW5jdGlvbiAoY29tcCwgaW5pdFByb3AsIHJvb3QpIHtcbiAgY29uc3Qgdm5vZGUgPSBjb21wKGluaXRQcm9wIHx8IHt9KTtcbiAgY29uc3QgYmF0Y2ggPSByZW5kZXIobnVsbCwgdm5vZGUsIHJvb3QpO1xuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgZm9yIChsZXQgb3Agb2YgYmF0Y2gpIHtcbiAgICAgIG9wKCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHZub2RlO1xufSk7IiwiaW1wb3J0IHtyZW5kZXJ9IGZyb20gJy4vdHJlZSc7XG5pbXBvcnQge25leHRUaWNrfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgdHJpZ2dlciBhbiB1cGRhdGUgb2YgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBwYXNzZWQgc3RhdGVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcGFyYW0gaW5pdGlhbFZOb2RlXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb24oKj0sIC4uLlsqXSl9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVwZGF0ZSAoY29tcCwgaW5pdGlhbFZOb2RlKSB7XG4gIGxldCBvbGROb2RlID0gaW5pdGlhbFZOb2RlO1xuICBjb25zdCB1cGRhdGVGdW5jID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgbW91bnQgPSBvbGROb2RlLmRvbS5wYXJlbnROb2RlO1xuICAgIGNvbnN0IG5ld05vZGUgPSBjb21wKE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBvbGROb2RlLmNoaWxkcmVuIHx8IFtdfSwgb2xkTm9kZS5wcm9wcywgcHJvcHMpLCAuLi5hcmdzKTtcbiAgICBjb25zdCBuZXh0QmF0Y2ggPSByZW5kZXIob2xkTm9kZSwgbmV3Tm9kZSwgbW91bnQpO1xuXG4gICAgLy8gZGFuZ2VyIHpvbmUgISEhIVxuICAgIC8vIGNoYW5nZSBieSBrZWVwaW5nIHRoZSBzYW1lIHJlZmVyZW5jZSBzbyB0aGUgZXZlbnR1YWwgcGFyZW50IG5vZGUgZG9lcyBub3QgbmVlZCB0byBiZSBcImF3YXJlXCIgdHJlZSBtYXkgaGF2ZSBjaGFuZ2VkIGRvd25zdHJlYW06IG9sZE5vZGUgbWF5IGJlIHRoZSBjaGlsZCBvZiBzb21lb25lIC4uLih3ZWxsIHRoYXQgaXMgYSB0cmVlIGRhdGEgc3RydWN0dXJlIGFmdGVyIGFsbCA6UCApXG4gICAgb2xkTm9kZSA9IE9iamVjdC5hc3NpZ24ob2xkTm9kZSB8fCB7fSwgbmV3Tm9kZSk7XG4gICAgLy8gZW5kIGRhbmdlciB6b25lXG5cbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBmb3IgKGxldCBvcCBvZiBuZXh0QmF0Y2gpIHtcbiAgICAgICAgb3AoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZTtcbiAgfTtcbiAgcmV0dXJuIHVwZGF0ZUZ1bmM7XG59IiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgbGlmZUN5Y2xlRmFjdG9yeSA9IG1ldGhvZCA9PiBjdXJyeSgoZm4sIGNvbXApID0+IChwcm9wcywgLi4uYXJncykgPT4ge1xuICBjb25zdCBuID0gY29tcChwcm9wcywgLi4uYXJncyk7XG4gIG5bbWV0aG9kXSA9ICgpID0+IGZuKG4sIC4uLmFyZ3MpO1xuICByZXR1cm4gbjtcbn0pO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyB1bm1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVW5Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVW5Nb3VudCcpO1xuXG5leHBvcnQgY29uc3Qgb25VcGRhdGUgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvblVwZGF0ZScpOyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVwZGF0ZX0gZnJvbSAnLi9saWZlQ3ljbGVzJztcbmltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuLyoqXG4gKiBDb21iaW5hdG9yIHRvIGNyZWF0ZSBhIFwic3RhdGVmdWwgY29tcG9uZW50XCI6IGllIGl0IHdpbGwgaGF2ZSBpdHMgb3duIHN0YXRlIGFuZCB0aGUgYWJpbGl0eSB0byB1cGRhdGUgaXRzIG93biB0cmVlXG4gKiBAcGFyYW0gY29tcFxuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoY29tcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAvL2xhenkgZXZhbHVhdGUgdXBkYXRlRnVuYyAodG8gbWFrZSBzdXJlIGl0IGlzIGRlZmluZWRcbiAgICAgIGNvbnN0IHNldFN0YXRlID0gKG5ld1N0YXRlKSA9PiB1cGRhdGVGdW5jKG5ld1N0YXRlKTtcbiAgICAgIHJldHVybiBjb21wKHByb3BzLCBzZXRTdGF0ZSwgLi4uYXJncyk7XG4gICAgfTtcbiAgICBjb25zdCBzZXRVcGRhdGVGdW5jdGlvbiA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgIH07XG5cbiAgICByZXR1cm4gY29tcG9zZShvbk1vdW50KHNldFVwZGF0ZUZ1bmN0aW9uKSwgb25VcGRhdGUoc2V0VXBkYXRlRnVuY3Rpb24pKSh3cmFwcGVyQ29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vL3RvZG8gdGhyb3cgdGhpcyBpbiBmYXZvciBvZiBjb25uZWN0IG9ubHkgP1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgRWxtIGxpa2UgYXBwXG4gKiBAcGFyYW0gdmlld1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAodmlldykge1xuICByZXR1cm4gZnVuY3Rpb24gKHttb2RlbCwgdXBkYXRlcywgc3Vic2NyaXB0aW9ucyA9IFtdfSkge1xuICAgIGxldCBhY3Rpb25TdG9yZSA9IHt9O1xuXG4gICAgY29uc3QgY29tcCA9IHByb3BzID0+IHZpZXcobW9kZWwsIGFjdGlvblN0b3JlKTtcblxuICAgIGNvbnN0IGluaXRBY3Rpb25TdG9yZSA9ICh2bm9kZSkgPT4ge1xuICAgICAgY29uc3QgdXBkYXRlRnVuYyA9IHVwZGF0ZShjb21wLCB2bm9kZSk7XG4gICAgICBmb3IgKGxldCB1cGRhdGUgb2YgT2JqZWN0LmtleXModXBkYXRlcykpIHtcbiAgICAgICAgYWN0aW9uU3RvcmVbdXBkYXRlXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgbW9kZWwgPSB1cGRhdGVzW3VwZGF0ZV0obW9kZWwsIC4uLmFyZ3MpOyAvL3RvZG8gY29uc2lkZXIgc2lkZSBlZmZlY3RzLCBtaWRkbGV3YXJlcywgZXRjXG4gICAgICAgICAgcmV0dXJuIHVwZGF0ZUZ1bmMobW9kZWwsIGFjdGlvblN0b3JlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgaW5pdFN1YnNjcmlwdGlvbiA9IHN1YnNjcmlwdGlvbnMubWFwKHN1YiA9PiB2bm9kZSA9PiBzdWIodm5vZGUsIGFjdGlvblN0b3JlKSk7XG4gICAgY29uc3QgaW5pdEZ1bmMgPSBjb21wb3NlKGluaXRBY3Rpb25TdG9yZSwgLi4uaW5pdFN1YnNjcmlwdGlvbik7XG5cbiAgICByZXR1cm4gb25Nb3VudChpbml0RnVuYywgY29tcCk7XG4gIH07XG59O1xuXG5cbi8qXG5cbmNvbm5lY3Qoc3RvcmUsIGFjdGlvbnMsIHdhdGNoZXIpXG5cblxuXG5cbiAqLyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7b25Nb3VudCwgb25Vbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnXG5pbXBvcnQge2lzRGVlcEVxdWFsLCBpZGVudGl0eX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb25uZWN0IGNvbWJpbmF0b3I6IHdpbGwgY3JlYXRlIFwiY29udGFpbmVyXCIgY29tcG9uZW50IHdoaWNoIHdpbGwgc3Vic2NyaWJlIHRvIGEgUmVkdXggbGlrZSBzdG9yZS4gYW5kIHVwZGF0ZSBpdHMgY2hpbGRyZW4gd2hlbmV2ZXIgYSBzcGVjaWZpYyBzbGljZSBvZiBzdGF0ZSBjaGFuZ2UgdW5kZXIgc3BlY2lmaWMgY2lyY3Vtc3RhbmNlc1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc3RvcmUsIGFjdGlvbnMgPSB7fSwgc2xpY2VTdGF0ZSA9IGlkZW50aXR5KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoY29tcCwgbWFwU3RhdGVUb1Byb3AgPSBpZGVudGl0eSwgc2hvdWxkVXBhdGUgPSAoYSwgYikgPT4gaXNEZWVwRXF1YWwoYSwgYikgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChpbml0UHJvcCkge1xuICAgICAgbGV0IGNvbXBvbmVudFByb3BzID0gaW5pdFByb3A7XG4gICAgICBsZXQgdXBkYXRlRnVuYywgcHJldmlvdXNTdGF0ZVNsaWNlLCB1bnN1YnNjcmliZXI7XG5cbiAgICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIHJldHVybiBjb21wKHByb3BzLCBhY3Rpb25zLCAuLi5hcmdzKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHN1YnNjcmliZSA9IG9uTW91bnQoKHZub2RlKSA9PiB7XG4gICAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUod3JhcHBlckNvbXAsIHZub2RlKTtcbiAgICAgICAgdW5zdWJzY3JpYmVyID0gc3RvcmUuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBzdGF0ZVNsaWNlID0gc2xpY2VTdGF0ZShzdG9yZS5nZXRTdGF0ZSgpKTtcbiAgICAgICAgICBpZiAoc2hvdWxkVXBhdGUocHJldmlvdXNTdGF0ZVNsaWNlLCBzdGF0ZVNsaWNlKSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihjb21wb25lbnRQcm9wcywgbWFwU3RhdGVUb1Byb3Aoc3RhdGVTbGljZSkpO1xuICAgICAgICAgICAgdXBkYXRlRnVuYyhjb21wb25lbnRQcm9wcyk7XG4gICAgICAgICAgICBwcmV2aW91c1N0YXRlU2xpY2UgPSBzdGF0ZVNsaWNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdW5zdWJzY3JpYmUgPSBvblVuTW91bnQoKCkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZXIoKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gY29tcG9zZShzdWJzY3JpYmUsIHVuc3Vic2NyaWJlKSh3cmFwcGVyQ29tcCk7XG4gICAgfTtcbiAgfTtcbn07IiwiZXhwb3J0IGZ1bmN0aW9uIHN3YXAgKGYpIHtcbiAgcmV0dXJuIChhLCBiKSA9PiBmKGIsIGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZSAoZmlyc3QsIC4uLmZucykge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycnkgKGZuLCBhcml0eUxlZnQpIHtcbiAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseSAoZm4pIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcCAoZm4pIHtcbiAgcmV0dXJuIGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcG9pbnRlciAocGF0aCkge1xuXG4gIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuXG4gIGZ1bmN0aW9uIHBhcnRpYWwgKG9iaiA9IHt9LCBwYXJ0cyA9IFtdKSB7XG4gICAgY29uc3QgcCA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgY29uc3QgY3VycmVudCA9IG9ialtwXTtcbiAgICByZXR1cm4gKGN1cnJlbnQgPT09IHVuZGVmaW5lZCB8fCBwYXJ0cy5sZW5ndGggPT09IDApID9cbiAgICAgIGN1cnJlbnQgOiBwYXJ0aWFsKGN1cnJlbnQsIHBhcnRzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldCAodGFyZ2V0LCBuZXdUcmVlKSB7XG4gICAgbGV0IGN1cnJlbnQgPSB0YXJnZXQ7XG4gICAgY29uc3QgW2xlYWYsIC4uLmludGVybWVkaWF0ZV0gPSBwYXJ0cy5yZXZlcnNlKCk7XG4gICAgZm9yIChsZXQga2V5IG9mIGludGVybWVkaWF0ZS5yZXZlcnNlKCkpIHtcbiAgICAgIGlmIChjdXJyZW50W2tleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjdXJyZW50W2tleV0gPSB7fTtcbiAgICAgICAgY3VycmVudCA9IGN1cnJlbnRba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgY3VycmVudFtsZWFmXSA9IE9iamVjdC5hc3NpZ24oY3VycmVudFtsZWFmXSB8fCB7fSwgbmV3VHJlZSk7XG4gICAgcmV0dXJuIHRhcmdldDtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZ2V0KHRhcmdldCl7XG4gICAgICByZXR1cm4gcGFydGlhbCh0YXJnZXQsIFsuLi5wYXJ0c10pXG4gICAgfSxcbiAgICBzZXRcbiAgfVxufTtcbiIsImltcG9ydCB7c3dhcH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cblxuZnVuY3Rpb24gc29ydEJ5UHJvcGVydHkgKHByb3ApIHtcbiAgY29uc3QgcHJvcEdldHRlciA9IHBvaW50ZXIocHJvcCkuZ2V0O1xuICByZXR1cm4gKGEsIGIpID0+IHtcbiAgICBjb25zdCBhVmFsID0gcHJvcEdldHRlcihhKTtcbiAgICBjb25zdCBiVmFsID0gcHJvcEdldHRlcihiKTtcblxuICAgIGlmIChhVmFsID09PSBiVmFsKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBpZiAoYlZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgaWYgKGFWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFWYWwgPCBiVmFsID8gLTEgOiAxO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNvcnRGYWN0b3J5ICh7cG9pbnRlciwgZGlyZWN0aW9ufSA9IHt9KSB7XG4gIGlmICghcG9pbnRlciB8fCBkaXJlY3Rpb24gPT09ICdub25lJykge1xuICAgIHJldHVybiBhcnJheSA9PiBbLi4uYXJyYXldO1xuICB9XG5cbiAgY29uc3Qgb3JkZXJGdW5jID0gc29ydEJ5UHJvcGVydHkocG9pbnRlcik7XG4gIGNvbnN0IGNvbXBhcmVGdW5jID0gZGlyZWN0aW9uID09PSAnZGVzYycgPyBzd2FwKG9yZGVyRnVuYykgOiBvcmRlckZ1bmM7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gWy4uLmFycmF5XS5zb3J0KGNvbXBhcmVGdW5jKTtcbn0iLCJpbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5mdW5jdGlvbiB0eXBlRXhwcmVzc2lvbiAodHlwZSkge1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBCb29sZWFuO1xuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gTnVtYmVyO1xuICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgcmV0dXJuICh2YWwpID0+IG5ldyBEYXRlKHZhbCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBjb21wb3NlKFN0cmluZywgKHZhbCkgPT4gdmFsLnRvTG93ZXJDYXNlKCkpO1xuICB9XG59XG5cbmNvbnN0IG9wZXJhdG9ycyA9IHtcbiAgaW5jbHVkZXModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0LmluY2x1ZGVzKHZhbHVlKTtcbiAgfSxcbiAgaXModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IE9iamVjdC5pcyh2YWx1ZSwgaW5wdXQpO1xuICB9LFxuICBpc05vdCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gIU9iamVjdC5pcyh2YWx1ZSwgaW5wdXQpO1xuICB9LFxuICBsdCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPCB2YWx1ZTtcbiAgfSxcbiAgZ3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID4gdmFsdWU7XG4gIH0sXG4gIGx0ZSh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPD0gdmFsdWU7XG4gIH0sXG4gIGd0ZSh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPj0gdmFsdWU7XG4gIH0sXG4gIGVxdWFscyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gdmFsdWUgPT0gaW5wdXQ7XG4gIH0sXG4gIG5vdEVxdWFscyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gdmFsdWUgIT0gaW5wdXQ7XG4gIH1cbn07XG5cbmNvbnN0IGV2ZXJ5ID0gZm5zID0+ICguLi5hcmdzKSA9PiBmbnMuZXZlcnkoZm4gPT4gZm4oLi4uYXJncykpO1xuXG5leHBvcnQgZnVuY3Rpb24gcHJlZGljYXRlICh7dmFsdWUgPSAnJywgb3BlcmF0b3IgPSAnaW5jbHVkZXMnLCB0eXBlID0gJ3N0cmluZyd9KSB7XG4gIGNvbnN0IHR5cGVJdCA9IHR5cGVFeHByZXNzaW9uKHR5cGUpO1xuICBjb25zdCBvcGVyYXRlT25UeXBlZCA9IGNvbXBvc2UodHlwZUl0LCBvcGVyYXRvcnNbb3BlcmF0b3JdKTtcbiAgY29uc3QgcHJlZGljYXRlRnVuYyA9IG9wZXJhdGVPblR5cGVkKHZhbHVlKTtcbiAgcmV0dXJuIGNvbXBvc2UodHlwZUl0LCBwcmVkaWNhdGVGdW5jKTtcbn1cblxuLy9hdm9pZCB1c2VsZXNzIGZpbHRlciBsb29rdXAgKGltcHJvdmUgcGVyZilcbmZ1bmN0aW9uIG5vcm1hbGl6ZUNsYXVzZXMgKGNvbmYpIHtcbiAgY29uc3Qgb3V0cHV0ID0ge307XG4gIGNvbnN0IHZhbGlkUGF0aCA9IE9iamVjdC5rZXlzKGNvbmYpLmZpbHRlcihwYXRoID0+IEFycmF5LmlzQXJyYXkoY29uZltwYXRoXSkpO1xuICB2YWxpZFBhdGguZm9yRWFjaChwYXRoID0+IHtcbiAgICBjb25zdCB2YWxpZENsYXVzZXMgPSBjb25mW3BhdGhdLmZpbHRlcihjID0+IGMudmFsdWUgIT09ICcnKTtcbiAgICBpZiAodmFsaWRDbGF1c2VzLmxlbmd0aCkge1xuICAgICAgb3V0cHV0W3BhdGhdID0gdmFsaWRDbGF1c2VzO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZpbHRlciAoZmlsdGVyKSB7XG4gIGNvbnN0IG5vcm1hbGl6ZWRDbGF1c2VzID0gbm9ybWFsaXplQ2xhdXNlcyhmaWx0ZXIpO1xuICBjb25zdCBmdW5jTGlzdCA9IE9iamVjdC5rZXlzKG5vcm1hbGl6ZWRDbGF1c2VzKS5tYXAocGF0aCA9PiB7XG4gICAgY29uc3QgZ2V0dGVyID0gcG9pbnRlcihwYXRoKS5nZXQ7XG4gICAgY29uc3QgY2xhdXNlcyA9IG5vcm1hbGl6ZWRDbGF1c2VzW3BhdGhdLm1hcChwcmVkaWNhdGUpO1xuICAgIHJldHVybiBjb21wb3NlKGdldHRlciwgZXZlcnkoY2xhdXNlcykpO1xuICB9KTtcbiAgY29uc3QgZmlsdGVyUHJlZGljYXRlID0gZXZlcnkoZnVuY0xpc3QpO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IGFycmF5LmZpbHRlcihmaWx0ZXJQcmVkaWNhdGUpO1xufSIsImltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChzZWFyY2hDb25mID0ge30pIHtcbiAgY29uc3Qge3ZhbHVlLCBzY29wZSA9IFtdfSA9IHNlYXJjaENvbmY7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXJzID0gc2NvcGUubWFwKGZpZWxkID0+IHBvaW50ZXIoZmllbGQpLmdldCk7XG4gIGlmICghc2NvcGUubGVuZ3RoIHx8ICF2YWx1ZSkge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXkuZmlsdGVyKGl0ZW0gPT4gc2VhcmNoUG9pbnRlcnMuc29tZShwID0+IFN0cmluZyhwKGl0ZW0pKS5pbmNsdWRlcyhTdHJpbmcodmFsdWUpKSkpXG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzbGljZUZhY3RvcnkgKHtwYWdlID0gMSwgc2l6ZX0gPSB7fSkge1xuICByZXR1cm4gZnVuY3Rpb24gc2xpY2VGdW5jdGlvbiAoYXJyYXkgPSBbXSkge1xuICAgIGNvbnN0IGFjdHVhbFNpemUgPSBzaXplIHx8IGFycmF5Lmxlbmd0aDtcbiAgICBjb25zdCBvZmZzZXQgPSAocGFnZSAtIDEpICogYWN0dWFsU2l6ZTtcbiAgICByZXR1cm4gYXJyYXkuc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBhY3R1YWxTaXplKTtcbiAgfTtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBlbWl0dGVyICgpIHtcblxuICBjb25zdCBsaXN0ZW5lcnNMaXN0cyA9IHt9O1xuICBjb25zdCBpbnN0YW5jZSA9IHtcbiAgICBvbihldmVudCwgLi4ubGlzdGVuZXJzKXtcbiAgICAgIGxpc3RlbmVyc0xpc3RzW2V2ZW50XSA9IChsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW10pLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH0sXG4gICAgZGlzcGF0Y2goZXZlbnQsIC4uLmFyZ3Mpe1xuICAgICAgY29uc3QgbGlzdGVuZXJzID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgZm9yIChsZXQgbGlzdGVuZXIgb2YgbGlzdGVuZXJzKSB7XG4gICAgICAgIGxpc3RlbmVyKC4uLmFyZ3MpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH0sXG4gICAgb2ZmKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgaWYgKCFldmVudCkge1xuICAgICAgICBPYmplY3Qua2V5cyhsaXN0ZW5lcnNMaXN0cykuZm9yRWFjaChldiA9PiBpbnN0YW5jZS5vZmYoZXYpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICAgIGxpc3RlbmVyc0xpc3RzW2V2ZW50XSA9IGxpc3RlbmVycy5sZW5ndGggPyBsaXN0LmZpbHRlcihsaXN0ZW5lciA9PiAhbGlzdGVuZXJzLmluY2x1ZGVzKGxpc3RlbmVyKSkgOiBbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9XG4gIH07XG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb3h5TGlzdGVuZXIgKGV2ZW50TWFwKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe2VtaXR0ZXJ9KSB7XG5cbiAgICBjb25zdCBwcm94eSA9IHt9O1xuICAgIGxldCBldmVudExpc3RlbmVycyA9IHt9O1xuXG4gICAgZm9yIChsZXQgZXYgb2YgT2JqZWN0LmtleXMoZXZlbnRNYXApKSB7XG4gICAgICBjb25zdCBtZXRob2QgPSBldmVudE1hcFtldl07XG4gICAgICBldmVudExpc3RlbmVyc1tldl0gPSBbXTtcbiAgICAgIHByb3h5W21ldGhvZF0gPSBmdW5jdGlvbiAoLi4ubGlzdGVuZXJzKSB7XG4gICAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IGV2ZW50TGlzdGVuZXJzW2V2XS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgICAgZW1pdHRlci5vbihldiwgLi4ubGlzdGVuZXJzKTtcbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihwcm94eSwge1xuICAgICAgb2ZmKGV2KXtcbiAgICAgICAgaWYgKCFldikge1xuICAgICAgICAgIE9iamVjdC5rZXlzKGV2ZW50TGlzdGVuZXJzKS5mb3JFYWNoKGV2ZW50TmFtZSA9PiBwcm94eS5vZmYoZXZlbnROYW1lKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXJzW2V2XSkge1xuICAgICAgICAgIGVtaXR0ZXIub2ZmKGV2LCAuLi5ldmVudExpc3RlbmVyc1tldl0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSIsImV4cG9ydCBjb25zdCBUT0dHTEVfU09SVCA9ICdUT0dHTEVfU09SVCc7XG5leHBvcnQgY29uc3QgRElTUExBWV9DSEFOR0VEID0gJ0RJU1BMQVlfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgUEFHRV9DSEFOR0VEID0gJ0NIQU5HRV9QQUdFJztcbmV4cG9ydCBjb25zdCBFWEVDX0NIQU5HRUQgPSAnRVhFQ19DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBGSUxURVJfQ0hBTkdFRCA9ICdGSUxURVJfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgU1VNTUFSWV9DSEFOR0VEID0gJ1NVTU1BUllfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgU0VBUkNIX0NIQU5HRUQgPSAnU0VBUkNIX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEVYRUNfRVJST1IgPSAnRVhFQ19FUlJPUic7IiwiaW1wb3J0IHNsaWNlIGZyb20gJy4uL3NsaWNlJztcbmltcG9ydCB7Y3VycnksIHRhcCwgY29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5pbXBvcnQge2VtaXR0ZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5pbXBvcnQgc2xpY2VGYWN0b3J5IGZyb20gJy4uL3NsaWNlJztcbmltcG9ydCB7XG4gIFNVTU1BUllfQ0hBTkdFRCxcbiAgVE9HR0xFX1NPUlQsXG4gIERJU1BMQVlfQ0hBTkdFRCxcbiAgUEFHRV9DSEFOR0VELFxuICBFWEVDX0NIQU5HRUQsXG4gIEZJTFRFUl9DSEFOR0VELFxuICBTRUFSQ0hfQ0hBTkdFRCxcbiAgRVhFQ19FUlJPUlxufSBmcm9tICcuLi9ldmVudHMnO1xuXG5mdW5jdGlvbiBjdXJyaWVkUG9pbnRlciAocGF0aCkge1xuICBjb25zdCB7Z2V0LCBzZXR9ID0gcG9pbnRlcihwYXRoKTtcbiAgcmV0dXJuIHtnZXQsIHNldDogY3Vycnkoc2V0KX07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7XG4gIHNvcnRGYWN0b3J5LFxuICB0YWJsZVN0YXRlLFxuICBkYXRhLFxuICBmaWx0ZXJGYWN0b3J5LFxuICBzZWFyY2hGYWN0b3J5XG59KSB7XG4gIGNvbnN0IHRhYmxlID0gZW1pdHRlcigpO1xuICBjb25zdCBzb3J0UG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzb3J0Jyk7XG4gIGNvbnN0IHNsaWNlUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzbGljZScpO1xuICBjb25zdCBmaWx0ZXJQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ2ZpbHRlcicpO1xuICBjb25zdCBzZWFyY2hQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NlYXJjaCcpO1xuXG4gIGNvbnN0IHNhZmVBc3NpZ24gPSBjdXJyeSgoYmFzZSwgZXh0ZW5zaW9uKSA9PiBPYmplY3QuYXNzaWduKHt9LCBiYXNlLCBleHRlbnNpb24pKTtcbiAgY29uc3QgZGlzcGF0Y2ggPSBjdXJyeSh0YWJsZS5kaXNwYXRjaC5iaW5kKHRhYmxlKSwgMik7XG5cbiAgY29uc3QgZGlzcGF0Y2hTdW1tYXJ5ID0gKGZpbHRlcmVkKSA9PiB7XG4gICAgZGlzcGF0Y2goU1VNTUFSWV9DSEFOR0VELCB7XG4gICAgICBwYWdlOiB0YWJsZVN0YXRlLnNsaWNlLnBhZ2UsXG4gICAgICBzaXplOiB0YWJsZVN0YXRlLnNsaWNlLnNpemUsXG4gICAgICBmaWx0ZXJlZENvdW50OiBmaWx0ZXJlZC5sZW5ndGhcbiAgICB9KTtcbiAgfTtcblxuICBjb25zdCBleGVjID0gKHtwcm9jZXNzaW5nRGVsYXkgPSAyMH0gPSB7fSkgPT4ge1xuICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfQ0hBTkdFRCwge3dvcmtpbmc6IHRydWV9KTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2VhcmNoRnVuYyA9IHNlYXJjaEZhY3Rvcnkoc2VhcmNoUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNsaWNlRnVuYyA9IHNsaWNlRmFjdG9yeShzbGljZVBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3QgZXhlY0Z1bmMgPSBjb21wb3NlKGZpbHRlckZ1bmMsIHNlYXJjaEZ1bmMsIHRhcChkaXNwYXRjaFN1bW1hcnkpLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgY29uc3QgZGlzcGxheWVkID0gZXhlY0Z1bmMoZGF0YSk7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKERJU1BMQVlfQ0hBTkdFRCwgZGlzcGxheWVkLm1hcChkID0+IHtcbiAgICAgICAgICByZXR1cm4ge2luZGV4OiBkYXRhLmluZGV4T2YoZCksIHZhbHVlOiBkfTtcbiAgICAgICAgfSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0VSUk9SLCBlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfQ0hBTkdFRCwge3dvcmtpbmc6IGZhbHNlfSk7XG4gICAgICB9XG4gICAgfSwgcHJvY2Vzc2luZ0RlbGF5KTtcbiAgfTtcblxuICBjb25zdCB1cGRhdGVUYWJsZVN0YXRlID0gY3VycnkoKHB0ZXIsIGV2LCBuZXdQYXJ0aWFsU3RhdGUpID0+IGNvbXBvc2UoXG4gICAgc2FmZUFzc2lnbihwdGVyLmdldCh0YWJsZVN0YXRlKSksXG4gICAgdGFwKGRpc3BhdGNoKGV2KSksXG4gICAgcHRlci5zZXQodGFibGVTdGF0ZSlcbiAgKShuZXdQYXJ0aWFsU3RhdGUpKTtcblxuICBjb25zdCByZXNldFRvRmlyc3RQYWdlID0gKCkgPT4gdXBkYXRlVGFibGVTdGF0ZShzbGljZVBvaW50ZXIsIFBBR0VfQ0hBTkdFRCwge3BhZ2U6IDF9KTtcblxuICBjb25zdCB0YWJsZU9wZXJhdGlvbiA9IChwdGVyLCBldikgPT4gY29tcG9zZShcbiAgICB1cGRhdGVUYWJsZVN0YXRlKHB0ZXIsIGV2KSxcbiAgICByZXNldFRvRmlyc3RQYWdlLFxuICAgICgpID0+IHRhYmxlLmV4ZWMoKSAvLyB3ZSB3cmFwIHdpdGhpbiBhIGZ1bmN0aW9uIHNvIHRhYmxlLmV4ZWMgY2FuIGJlIG92ZXJ3cml0dGVuICh3aGVuIHVzaW5nIHdpdGggYSBzZXJ2ZXIgZm9yIGV4YW1wbGUpXG4gICk7XG5cbiAgY29uc3QgYXBpID0ge1xuICAgIHNvcnQ6IHRhYmxlT3BlcmF0aW9uKHNvcnRQb2ludGVyLCBUT0dHTEVfU09SVCksXG4gICAgZmlsdGVyOiB0YWJsZU9wZXJhdGlvbihmaWx0ZXJQb2ludGVyLCBGSUxURVJfQ0hBTkdFRCksXG4gICAgc2VhcmNoOiB0YWJsZU9wZXJhdGlvbihzZWFyY2hQb2ludGVyLCBTRUFSQ0hfQ0hBTkdFRCksXG4gICAgc2xpY2U6IGNvbXBvc2UodXBkYXRlVGFibGVTdGF0ZShzbGljZVBvaW50ZXIsIFBBR0VfQ0hBTkdFRCksICgpID0+IHRhYmxlLmV4ZWMoKSksXG4gICAgZXhlYyxcbiAgICBldmFsKHN0YXRlID0gdGFibGVTdGF0ZSl7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2VhcmNoRnVuYyA9IHNlYXJjaEZhY3Rvcnkoc2VhcmNoUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNsaWNlRnVuYyA9IHNsaWNlRmFjdG9yeShzbGljZVBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZXhlY0Z1bmMgPSBjb21wb3NlKGZpbHRlckZ1bmMsIHNlYXJjaEZ1bmMsIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICAgIHJldHVybiBleGVjRnVuYyhkYXRhKS5tYXAoZCA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge2luZGV4OiBkYXRhLmluZGV4T2YoZCksIHZhbHVlOiBkfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIG9uRGlzcGxheUNoYW5nZShmbil7XG4gICAgICB0YWJsZS5vbihESVNQTEFZX0NIQU5HRUQsIGZuKTtcbiAgICB9LFxuICAgIGdldFRhYmxlU3RhdGUoKXtcbiAgICAgIGNvbnN0IHNvcnQgPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNvcnQpO1xuICAgICAgY29uc3Qgc2VhcmNoID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zZWFyY2gpO1xuICAgICAgY29uc3Qgc2xpY2UgPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNsaWNlKTtcbiAgICAgIGNvbnN0IGZpbHRlciA9IHt9O1xuICAgICAgZm9yIChsZXQgcHJvcCBpbiB0YWJsZVN0YXRlLmZpbHRlcikge1xuICAgICAgICBmaWx0ZXJbcHJvcF0gPSB0YWJsZVN0YXRlLmZpbHRlcltwcm9wXS5tYXAodiA9PiBPYmplY3QuYXNzaWduKHt9LCB2KSk7XG4gICAgICB9XG4gICAgICByZXR1cm4ge3NvcnQsIHNlYXJjaCwgc2xpY2UsIGZpbHRlcn07XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGluc3RhbmNlID0gT2JqZWN0LmFzc2lnbih0YWJsZSwgYXBpKTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaW5zdGFuY2UsICdsZW5ndGgnLCB7XG4gICAgZ2V0KCl7XG4gICAgICByZXR1cm4gZGF0YS5sZW5ndGg7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59IiwiaW1wb3J0IHNvcnQgZnJvbSAnc21hcnQtdGFibGUtc29ydCc7XG5pbXBvcnQgZmlsdGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWZpbHRlcic7XG5pbXBvcnQgc2VhcmNoIGZyb20gJ3NtYXJ0LXRhYmxlLXNlYXJjaCc7XG5pbXBvcnQgdGFibGUgZnJvbSAnLi9kaXJlY3RpdmVzL3RhYmxlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnkgPSBzb3J0LFxuICBmaWx0ZXJGYWN0b3J5ID0gZmlsdGVyLFxuICBzZWFyY2hGYWN0b3J5ID0gc2VhcmNoLFxuICB0YWJsZVN0YXRlID0ge3NvcnQ6IHt9LCBzbGljZToge3BhZ2U6IDF9LCBmaWx0ZXI6IHt9LCBzZWFyY2g6IHt9fSxcbiAgZGF0YSA9IFtdXG59LCAuLi50YWJsZURpcmVjdGl2ZXMpIHtcblxuICBjb25zdCBjb3JlVGFibGUgPSB0YWJsZSh7c29ydEZhY3RvcnksIGZpbHRlckZhY3RvcnksIHRhYmxlU3RhdGUsIGRhdGEsIHNlYXJjaEZhY3Rvcnl9KTtcblxuICByZXR1cm4gdGFibGVEaXJlY3RpdmVzLnJlZHVjZSgoYWNjdW11bGF0b3IsIG5ld2RpcikgPT4ge1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKGFjY3VtdWxhdG9yLCBuZXdkaXIoe1xuICAgICAgc29ydEZhY3RvcnksXG4gICAgICBmaWx0ZXJGYWN0b3J5LFxuICAgICAgc2VhcmNoRmFjdG9yeSxcbiAgICAgIHRhYmxlU3RhdGUsXG4gICAgICBkYXRhLFxuICAgICAgdGFibGU6IGNvcmVUYWJsZVxuICAgIH0pKTtcbiAgfSwgY29yZVRhYmxlKTtcbn0iLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5leHBvcnQgY29uc3QgZ2V0ID0gY3VycnkoKGFycmF5LCBpbmRleCkgPT4gYXJyYXlbaW5kZXhdKTtcbmV4cG9ydCBjb25zdCByZXBsYWNlID0gY3VycnkoKGFycmF5LCBuZXdWYWwsIGluZGV4KSA9PiBhcnJheS5tYXAoKHZhbCwgaSkgPT4gKGluZGV4ID09PSBpICkgPyBuZXdWYWwgOiB2YWwpKTtcbmV4cG9ydCBjb25zdCBwYXRjaCA9IGN1cnJ5KChhcnJheSwgbmV3VmFsLCBpbmRleCkgPT4gcmVwbGFjZShhcnJheSwgT2JqZWN0LmFzc2lnbihhcnJheVtpbmRleF0sIG5ld1ZhbCksIGluZGV4KSk7XG5leHBvcnQgY29uc3QgcmVtb3ZlID0gY3VycnkoKGFycmF5LCBpbmRleCkgPT4gYXJyYXkuZmlsdGVyKCh2YWwsIGkpID0+IGluZGV4ICE9PSBpKSk7XG5leHBvcnQgY29uc3QgaW5zZXJ0ID0gY3VycnkoKGFycmF5LCBuZXdWYWwsIGluZGV4KSA9PiBbLi4uYXJyYXkuc2xpY2UoMCwgaW5kZXgpLCBuZXdWYWwsIC4uLmFycmF5LnNsaWNlKGluZGV4KV0pOyIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7Z2V0LCByZXBsYWNlLCBwYXRjaCwgcmVtb3ZlLCBpbnNlcnR9IGZyb20gJy4vY3J1ZCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7ZGF0YSwgdGFibGV9KSB7XG4gIC8vIGVtcHR5IGFuZCByZWZpbGwgZGF0YSBrZWVwaW5nIHRoZSBzYW1lIHJlZmVyZW5jZVxuICBjb25zdCBtdXRhdGVEYXRhID0gKG5ld0RhdGEpID0+IHtcbiAgICBkYXRhLnNwbGljZSgwKTtcbiAgICBkYXRhLnB1c2goLi4ubmV3RGF0YSk7XG4gIH07XG4gIGNvbnN0IHJlZnJlc2ggPSBjb21wb3NlKG11dGF0ZURhdGEsIHRhYmxlLmV4ZWMpO1xuICByZXR1cm4ge1xuICAgIHVwZGF0ZShpbmRleCxuZXdWYWwpe1xuICAgICAgcmV0dXJuIGNvbXBvc2UocmVwbGFjZShkYXRhLG5ld1ZhbCkscmVmcmVzaCkoaW5kZXgpO1xuICAgIH0sXG4gICAgcGF0Y2goaW5kZXgsIG5ld1ZhbCl7XG4gICAgICByZXR1cm4gcGF0Y2goZGF0YSwgbmV3VmFsLCBpbmRleCk7XG4gICAgfSxcbiAgICByZW1vdmU6IGNvbXBvc2UocmVtb3ZlKGRhdGEpLCByZWZyZXNoKSxcbiAgICBpbnNlcnQobmV3VmFsLCBpbmRleCA9IDApe1xuICAgICAgcmV0dXJuIGNvbXBvc2UoaW5zZXJ0KGRhdGEsIG5ld1ZhbCksIHJlZnJlc2gpKGluZGV4KTtcbiAgICB9LFxuICAgIGdldDogZ2V0KGRhdGEpXG4gIH07XG59IiwiLy8gaXQgaXMgbGlrZSBSZWR1eCBidXQgdXNpbmcgc21hcnQgdGFibGUgd2hpY2ggYWxyZWFkeSBiZWhhdmVzIG1vcmUgb3IgbGVzcyBsaWtlIGEgc3RvcmUgYW5kIGxpa2UgYSByZWR1Y2VyIGluIHRoZSBzYW1lIHRpbWUuXG4vLyBvZiBjb3Vyc2UgdGhpcyBpbXBsIGlzIGJhc2ljOiBlcnJvciBoYW5kbGluZyBldGMgYXJlIG1pc3NpbmcgYW5kIHJlZHVjZXIgaXMgXCJoYXJkY29kZWRcIlxuY29uc3QgcmVkdWNlckZhY3RvcnkgPSBmdW5jdGlvbiAoc21hcnRUYWJsZSkge1xuICByZXR1cm4gZnVuY3Rpb24gKHN0YXRlID0ge1xuICAgIHRhYmxlU3RhdGU6IHNtYXJ0VGFibGUuZ2V0VGFibGVTdGF0ZSgpLFxuICAgIGRpc3BsYXllZDogW10sXG4gICAgc3VtbWFyeToge30sXG4gICAgaXNQcm9jZXNzaW5nOiBmYWxzZVxuICB9LCBhY3Rpb24pIHtcbiAgICBjb25zdCB7dHlwZSwgYXJnc30gPSBhY3Rpb247XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlICdUT0dHTEVfRklMVEVSJzoge1xuICAgICAgICBjb25zdCB7ZmlsdGVyfSA9IGFjdGlvbjtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHN0YXRlLCB7YWN0aXZlRmlsdGVyOiBmaWx0ZXJ9KTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IC8vcHJveHkgdG8gc21hcnQgdGFibGVcbiAgICAgICAgaWYgKHNtYXJ0VGFibGVbdHlwZV0pIHtcbiAgICAgICAgICBzbWFydFRhYmxlW3R5cGVdKC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG4gIH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdG9yZSAoc21hcnRUYWJsZSkge1xuXG4gIGNvbnN0IHJlZHVjZXIgPSByZWR1Y2VyRmFjdG9yeShzbWFydFRhYmxlKTtcblxuICBsZXQgY3VycmVudFN0YXRlID0ge1xuICAgIHRhYmxlU3RhdGU6IHNtYXJ0VGFibGUuZ2V0VGFibGVTdGF0ZSgpXG4gIH07XG4gIGxldCBzdW1tYXJ5O1xuICBsZXQgbGlzdGVuZXJzID0gW107XG5cbiAgY29uc3QgYnJvYWRjYXN0ID0gKCkgPT4ge1xuICAgIGZvciAobGV0IGwgb2YgbGlzdGVuZXJzKSB7XG4gICAgICBsKCk7XG4gICAgfVxuICB9O1xuXG4gIHNtYXJ0VGFibGUub24oJ1NVTU1BUllfQ0hBTkdFRCcsIGZ1bmN0aW9uIChzKSB7XG4gICAgc3VtbWFyeSA9IHM7XG4gIH0pO1xuXG4gIHNtYXJ0VGFibGUub24oJ0VYRUNfQ0hBTkdFRCcsIGZ1bmN0aW9uICh7d29ya2luZ30pIHtcbiAgICBPYmplY3QuYXNzaWduKGN1cnJlbnRTdGF0ZSwge1xuICAgICAgaXNQcm9jZXNzaW5nOiB3b3JraW5nXG4gICAgfSk7XG4gICAgYnJvYWRjYXN0KCk7XG4gIH0pO1xuXG4gIHNtYXJ0VGFibGUub25EaXNwbGF5Q2hhbmdlKGZ1bmN0aW9uIChkaXNwbGF5ZWQpIHtcbiAgICBPYmplY3QuYXNzaWduKGN1cnJlbnRTdGF0ZSwge1xuICAgICAgdGFibGVTdGF0ZTogc21hcnRUYWJsZS5nZXRUYWJsZVN0YXRlKCksXG4gICAgICBkaXNwbGF5ZWQsXG4gICAgICBzdW1tYXJ5XG4gICAgfSk7XG4gICAgYnJvYWRjYXN0KCk7XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3Vic2NyaWJlKGxpc3RlbmVyKXtcbiAgICAgIGxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcbiAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5maWx0ZXIobCA9PiBsICE9PSBsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXRTdGF0ZSgpe1xuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIGN1cnJlbnRTdGF0ZSwge3RhYmxlU3RhdGU6c21hcnRUYWJsZS5nZXRUYWJsZVN0YXRlKCl9KTtcbiAgICB9LFxuICAgIGRpc3BhdGNoKGFjdGlvbiA9IHt9KXtcbiAgICAgIGN1cnJlbnRTdGF0ZSA9IHJlZHVjZXIoY3VycmVudFN0YXRlLCBhY3Rpb24pO1xuICAgICAgaWYgKGFjdGlvbi50eXBlICYmICFzbWFydFRhYmxlW2FjdGlvbi50eXBlXSkge1xuICAgICAgICBicm9hZGNhc3QoKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59IiwiaW1wb3J0IHtkZWZhdWx0IGFzIHNtYXJ0VGFibGV9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuaW1wb3J0IGNydWQgZnJvbSAnc21hcnQtdGFibGUtY3J1ZCc7XG5pbXBvcnQge2NyZWF0ZVN0b3JlfSBmcm9tICcuL3JlZHV4U21hcnRUYWJsZSc7XG5cbi8vZGF0YSBjb21pbmcgZnJvbSBnbG9iYWxcbmNvbnN0IHRhYmxlU3RhdGUgPSB7c2VhcmNoOiB7fSwgZmlsdGVyOiB7fSwgc29ydDoge30sIHNsaWNlOiB7cGFnZTogMSwgc2l6ZTogMjB9fTtcbi8vdGhlIHNtYXJ0IHRhYmxlXG5jb25zdCB0YWJsZSA9IHNtYXJ0VGFibGUoe2RhdGEsIHRhYmxlU3RhdGV9LCBjcnVkKTtcbi8vdGhlIHN0b3JlXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVTdG9yZSh0YWJsZSk7XG4iLCJpbXBvcnQge2gsIG9uTW91bnR9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcblxuZXhwb3J0IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgZGVsYXkgPSAzMDApIHtcbiAgbGV0IHRpbWVvdXRJZDtcbiAgcmV0dXJuIChldikgPT4ge1xuICAgIGlmICh0aW1lb3V0SWQpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICB9XG4gICAgdGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgZm4oZXYpO1xuICAgIH0sIGRlbGF5KTtcbiAgfTtcbn1cblxuZXhwb3J0IGNvbnN0IHRyYXBLZXlkb3duID0gKC4uLmtleXMpID0+IChldikgPT4ge1xuICBjb25zdCB7a2V5Q29kZX0gPWV2O1xuICBpZiAoa2V5cy5pbmRleE9mKGtleUNvZGUpID09PSAtMSkge1xuICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG59OyIsImltcG9ydCB7aCwgb25Nb3VudH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuXG5cbmV4cG9ydCBjb25zdCBhdXRvRm9jdXMgPSBvbk1vdW50KG4gPT4gbi5kb20uZm9jdXMoKSk7XG5leHBvcnQgY29uc3QgSW5wdXQgPSBhdXRvRm9jdXMocHJvcHMgPT4ge1xuICBkZWxldGUgIHByb3BzLmNoaWxkcmVuOyAvL25vIGNoaWxkcmVuIGZvciBpbnB1dHNcbiAgcmV0dXJuIDxpbnB1dCB7Li4ucHJvcHN9IC8+XG59KTsiLCJpbXBvcnQge2gsIHdpdGhTdGF0ZSwgb25Nb3VudH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHtkZWJvdW5jZSwgdHJhcEtleWRvd259IGZyb20gJy4vaGVscGVyJztcbmltcG9ydCB7SW5wdXQsIGF1dG9Gb2N1c30gZnJvbSAnLi9pbnB1dHMnO1xuXG5jb25zdCB0b2dnbGVPbktleURvd24gPSBwcm9wcyA9PiAoZXYpID0+IHtcbiAgY29uc3Qge2tleUNvZGV9ID0gZXY7XG4gIGlmIChrZXlDb2RlID09PSAxMykge1xuICAgIHByb3BzLnRvZ2dsZUVkaXQodHJ1ZSkoKTtcbiAgfSBlbHNlIGlmIChrZXlDb2RlID09PSAyNykge1xuICAgIGV2LmN1cnJlbnRUYXJnZXQuZm9jdXMoKTtcbiAgfVxufTtcblxuY29uc3QgSW5wdXRDZWxsID0gKHByb3BzKSA9PiB7XG5cbiAgY29uc3Qgb25LZXlkb3duID0gdG9nZ2xlT25LZXlEb3duKHByb3BzKVxuXG4gIHJldHVybiA8dGQgdGFiSW5kZXg9XCItMVwiIG9uS2V5RG93bj17b25LZXlkb3dufSBvbkNsaWNrPXtwcm9wcy50b2dnbGVFZGl0KHRydWUpfSBjbGFzcz17cHJvcHMuY2xhc3NOYW1lfT5cbiAgICB7XG4gICAgICBwcm9wcy5pc0VkaXRpbmcgPT09ICd0cnVlJyA/XG4gICAgICAgIDxJbnB1dCBvbktleWRvd249e3RyYXBLZXlkb3duKDI3KX0gdHlwZT17cHJvcHMudHlwZSB8fCAndGV4dCd9IHZhbHVlPXtwcm9wcy5jdXJyZW50VmFsdWV9XG4gICAgICAgICAgICAgICBvbklucHV0PXtwcm9wcy5vbklucHV0fVxuICAgICAgICAgICAgICAgb25CbHVyPXtwcm9wcy50b2dnbGVFZGl0KGZhbHNlKX0vPlxuICAgICAgICA6IDxzcGFuPntwcm9wcy5jdXJyZW50VmFsdWV9PC9zcGFuPlxuICAgIH1cbiAgPC90ZD5cbn07XG5cbmNvbnN0IG1ha2VFZGl0YWJsZSA9IGNvbXAgPT4ge1xuICByZXR1cm4gd2l0aFN0YXRlKChwcm9wcywgc2V0U3RhdGUpID0+IHtcbiAgICBjb25zdCB0b2dnbGVFZGl0ID0gKHZhbCkgPT4gKCkgPT4gc2V0U3RhdGUoT2JqZWN0LmFzc2lnbih7fSwgcHJvcHMsIHtpc0VkaXRpbmc6IHZhbCAhPT0gdm9pZCAwID8gdmFsIDogcHJvcHMuaXNFZGl0aW5nICE9PSB0cnVlfSkpO1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IHt0b2dnbGVFZGl0LCAuLi5wcm9wc307XG4gICAgcmV0dXJuIGNvbXAoZnVsbFByb3BzKTtcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVMYXN0TmFtZSA9IG1ha2VFZGl0YWJsZSgocHJvcHMpID0+IHtcbiAgY29uc3Qge3RvZ2dsZUVkaXQsIHBlcnNvbiwgaW5kZXgsIGNsYXNzTmFtZSwgcGF0Y2gsIGlzRWRpdGluZ30gPSBwcm9wcztcbiAgbGV0IGN1cnJlbnRWYWx1ZSA9IHBlcnNvbi5uYW1lLmxhc3Q7XG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7bmFtZToge2xhc3Q6IGN1cnJlbnRWYWx1ZSwgZmlyc3Q6IHBlcnNvbi5uYW1lLmZpcnN0fX0pO1xuICB9KTtcblxuICByZXR1cm4gPElucHV0Q2VsbCBpc0VkaXRpbmc9e1N0cmluZyhpc0VkaXRpbmcgPT09IHRydWUpfSB0b2dnbGVFZGl0PXt0b2dnbGVFZGl0fSBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFZhbHVlPXtjdXJyZW50VmFsdWV9IG9uSW5wdXQ9e29uSW5wdXR9Lz5cbn0pO1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVGaXJzdE5hbWUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24ubmFtZS5maXJzdDtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtuYW1lOiB7Zmlyc3Q6IGN1cnJlbnRWYWx1ZSwgbGFzdDogcGVyc29uLm5hbWUubGFzdH19KTtcbiAgfSk7XG5cbiAgcmV0dXJuIDxJbnB1dENlbGwgaXNFZGl0aW5nPXtTdHJpbmcoaXNFZGl0aW5nID09PSB0cnVlKX0gdG9nZ2xlRWRpdD17dG9nZ2xlRWRpdH0gY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRWYWx1ZT17Y3VycmVudFZhbHVlfSBvbklucHV0PXtvbklucHV0fS8+XG59KTtcblxuY29uc3QgR2VuZGVyU2VsZWN0ID0gYXV0b0ZvY3VzKCh7b25DaGFuZ2UsIHRvZ2dsZUVkaXQsIHBlcnNvbn0pID0+IHtcbiAgcmV0dXJuIDxzZWxlY3Qgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNyl9IG5hbWU9XCJnZW5kZXIgc2VsZWN0XCIgb25DaGFuZ2U9e29uQ2hhbmdlfSBvbkJsdXI9e3RvZ2dsZUVkaXQoZmFsc2UpfT5cbiAgICA8b3B0aW9uIHZhbHVlPVwibWFsZVwiIHNlbGVjdGVkPXtwZXJzb24uZ2VuZGVyID09PSAnbWFsZSd9Pm1hbGU8L29wdGlvbj5cbiAgICA8b3B0aW9uIHZhbHVlPVwiZmVtYWxlXCIgc2VsZWN0ZWQ9e3BlcnNvbi5nZW5kZXIgPT09ICdmZW1hbGUnfT5mZW1hbGU8L29wdGlvbj5cbiAgPC9zZWxlY3Q+XG59KTtcblxuZXhwb3J0IGNvbnN0IEVkaXRhYmxlR2VuZGVyID0gbWFrZUVkaXRhYmxlKChwcm9wcykgPT4ge1xuICBjb25zdCB7dG9nZ2xlRWRpdCwgcGVyc29uLCBpbmRleCwgY2xhc3NOYW1lLCBwYXRjaCwgaXNFZGl0aW5nfSA9IHByb3BzO1xuICBsZXQgY3VycmVudFZhbHVlID0gcGVyc29uLmdlbmRlcjtcblxuICBjb25zdCBvbktleWRvd24gPSB0b2dnbGVPbktleURvd24ocHJvcHMpO1xuXG4gIGNvbnN0IG9uQ2hhbmdlID0gZGVib3VuY2UoZXYgPT4ge1xuICAgIGN1cnJlbnRWYWx1ZSA9IGV2LnRhcmdldC52YWx1ZTtcbiAgICBwYXRjaChpbmRleCwge2dlbmRlcjogY3VycmVudFZhbHVlfSk7XG4gIH0pO1xuICBjb25zdCBnZW5kZXJDbGFzcyA9IHBlcnNvbi5nZW5kZXIgPT09ICdmZW1hbGUnID8gJ2dlbmRlci1mZW1hbGUnIDogJ2dlbmRlci1tYWxlJztcblxuICByZXR1cm4gPHRkIHRhYkluZGV4PVwiLTFcIiBvbktleURvd249e29uS2V5ZG93bn0gb25DbGljaz17dG9nZ2xlRWRpdCh0cnVlKX0gY2xhc3M9e2NsYXNzTmFtZX0+XG4gICAge1xuICAgICAgaXNFZGl0aW5nID8gPEdlbmRlclNlbGVjdCBvbkNoYW5nZT17b25DaGFuZ2V9IHRvZ2dsZUVkaXQ9e3RvZ2dsZUVkaXR9IHBlcnNvbj17cGVyc29ufS8+IDpcbiAgICAgICAgPHNwYW4gY2xhc3M9e2dlbmRlckNsYXNzfT57Y3VycmVudFZhbHVlfTwvc3Bhbj5cbiAgICB9XG4gIDwvdGQ+O1xufSk7XG5cbmV4cG9ydCBjb25zdCBFZGl0YWJsZVNpemUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24uc2l6ZTtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtzaXplOiBjdXJyZW50VmFsdWV9KTtcbiAgfSk7XG4gIGNvbnN0IHJhdGlvID0gTWF0aC5taW4oKHBlcnNvbi5zaXplIC0gMTUwKSAvIDUwLCAxKSAqIDEwMDtcblxuICBjb25zdCBvbktleWRvd24gPSB0b2dnbGVPbktleURvd24ocHJvcHMpO1xuXG4gIHJldHVybiA8dGQgdGFiSW5kZXg9XCItMVwiIGNsYXNzPXtjbGFzc05hbWV9IG9uS2V5RG93bj17b25LZXlkb3dufSBvbkNsaWNrPXt0b2dnbGVFZGl0KHRydWUpfT5cbiAgICB7XG4gICAgICBpc0VkaXRpbmcgPyA8SW5wdXQgb25LZXlkb3duPXt0cmFwS2V5ZG93bigyNyl9IHR5cGU9XCJudW1iZXJcIiBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiB2YWx1ZT17Y3VycmVudFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgIG9uQmx1cj17dG9nZ2xlRWRpdChmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgb25JbnB1dD17b25JbnB1dH0vPiA6XG4gICAgICAgIDxzcGFuPjxzcGFuIHN0eWxlPXtgaGVpZ2h0OiAke3JhdGlvfSVgfSBjbGFzcz1cInNpemUtc3RpY2tcIj48L3NwYW4+e2N1cnJlbnRWYWx1ZX08L3NwYW4+XG4gICAgfVxuICA8L3RkPjtcbn0pO1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVCaXJ0aERhdGUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24uYmlydGhEYXRlO1xuXG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7YmlydGhEYXRlOiBuZXcgRGF0ZShjdXJyZW50VmFsdWUpfSk7XG4gIH0pO1xuXG4gIHJldHVybiA8SW5wdXRDZWxsIHR5cGU9XCJkYXRlXCIgaXNFZGl0aW5nPXtTdHJpbmcoaXNFZGl0aW5nID09PSB0cnVlKX0gdG9nZ2xlRWRpdD17dG9nZ2xlRWRpdH0gY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRWYWx1ZT17Y3VycmVudFZhbHVlLnRvRGF0ZVN0cmluZygpfSBvbklucHV0PXtvbklucHV0fS8+XG59KTtcbiIsImltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IHtjb25uZWN0LCBoLCBvblVwZGF0ZX0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHtFZGl0YWJsZUxhc3ROYW1lLCBFZGl0YWJsZUJpcnRoRGF0ZSwgRWRpdGFibGVTaXplLCBFZGl0YWJsZUdlbmRlciwgRWRpdGFibGVGaXJzdE5hbWV9IGZyb20gJy4vZWRpdGFibGVDZWxsJztcblxuY29uc3QgbWFwU3RhdGVUb1Byb3AgPSBzdGF0ZSA9PiAoe3BlcnNvbnM6IHN0YXRlfSk7XG5jb25zdCBkb2VzVXBkYXRlTGlzdCA9IChwcmV2aW91cywgY3VycmVudCkgPT4ge1xuICBsZXQgb3V0cHV0ID0gdHJ1ZTtcbiAgaWYgKHR5cGVvZiBwcmV2aW91cyA9PT0gdHlwZW9mIGN1cnJlbnQpIHtcbiAgICBvdXRwdXQgPSBwcmV2aW91cy5sZW5ndGggIT09IGN1cnJlbnQubGVuZ3RoIHx8IHByZXZpb3VzLnNvbWUoKGksIGspID0+IHByZXZpb3VzW2tdLnZhbHVlLmlkICE9PSBjdXJyZW50W2tdLnZhbHVlLmlkKTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBzdGF0ZSA9PiBzdGF0ZS5kaXNwbGF5ZWQ7XG5jb25zdCBhY3Rpb25zID0ge1xuICByZW1vdmU6IGluZGV4ID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAncmVtb3ZlJywgYXJnczogW2luZGV4XX0pLFxuICBwYXRjaDogKGluZGV4LCB2YWx1ZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdwYXRjaCcsIGFyZ3M6IFtpbmRleCwgdmFsdWVdfSlcbn07XG5jb25zdCBzdWJzY3JpYmVUb0Rpc3BsYXkgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcbmNvbnN0IGZvY3VzRmlyc3RDZWxsID0gb25VcGRhdGUodm5vZGUgPT4ge1xuICBjb25zdCBmaXJzdENlbGwgPSB2bm9kZS5kb20ucXVlcnlTZWxlY3RvcigndGQnKTtcbiAgaWYgKGZpcnN0Q2VsbCAhPT0gbnVsbCkge1xuICAgIGZpcnN0Q2VsbC5mb2N1cygpO1xuICB9XG59KTtcblxuY29uc3QgVEJvZHkgPSBmb2N1c0ZpcnN0Q2VsbCgoe3BlcnNvbnMgPSBbXSwgcGF0Y2gsIHJlbW92ZX0pID0+IHtcbiAgcmV0dXJuIHBlcnNvbnMubGVuZ3RoID8gPHRib2R5PlxuICAgIHtcbiAgICAgIHBlcnNvbnMubWFwKCh7dmFsdWUsIGluZGV4fSkgPT4gPHRyPlxuICAgICAgICA8RWRpdGFibGVMYXN0TmFtZSBjbGFzc05hbWU9XCJjb2wtbGFzdG5hbWVcIiBwZXJzb249e3ZhbHVlfSBpbmRleD17aW5kZXh9IHBhdGNoPXtwYXRjaH0vPlxuICAgICAgICA8RWRpdGFibGVGaXJzdE5hbWUgY2xhc3NOYW1lPVwiY29sLWZpcnN0bmFtZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDxFZGl0YWJsZUJpcnRoRGF0ZSBjbGFzc05hbWU9XCJjb2wtYmlydGhkYXRlXCIgcGVyc29uPXt2YWx1ZX0gaW5kZXg9e2luZGV4fSBwYXRjaD17cGF0Y2h9Lz5cbiAgICAgICAgPEVkaXRhYmxlR2VuZGVyIGNsYXNzTmFtZT1cImNvbC1nZW5kZXIgZml4ZWQtc2l6ZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDxFZGl0YWJsZVNpemUgY2xhc3NOYW1lPVwiY29sLXNpemUgZml4ZWQtc2l6ZVwiIHBlcnNvbj17dmFsdWV9IGluZGV4PXtpbmRleH0gcGF0Y2g9e3BhdGNofS8+XG4gICAgICAgIDx0ZCBjbGFzcz1cImZpeGVkLXNpemUgY29sLWFjdGlvbnNcIiBkYXRhLWtleWJvYXJkLXNlbGVjdG9yPVwiYnV0dG9uXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0YWJpbmRleD1cIi0xXCIgb25DbGljaz17KCkgPT4gcmVtb3ZlKGluZGV4KX0+UlxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L3RkPlxuICAgICAgPC90cj4pXG4gICAgfVxuICAgIDwvdGJvZHk+IDogPHRib2R5PlxuICAgIDx0cj5cbiAgICAgIDx0ZCB0YWJJbmRleD1cIi0xXCIgY29sU3Bhbj1cIjZcIj5UaGVyZSBpcyBubyBkYXRhIG1hdGNoaW5nIHlvdXIgcmVxdWVzdDwvdGQ+XG4gICAgPC90cj5cbiAgICA8L3Rib2R5PlxufSk7XG5cbmNvbnN0IFBlcnNvbkxpc3RDb21wb25lbnQgPSAocHJvcHMsIGFjdGlvbnMpID0+IHtcbiAgcmV0dXJuIDxUQm9keSBwZXJzb25zPXtwcm9wcy5wZXJzb25zfSByZW1vdmU9e2FjdGlvbnMucmVtb3ZlfVxuICAgICAgICAgICAgICAgIHBhdGNoPXthY3Rpb25zLnBhdGNofS8+XG59O1xuXG5leHBvcnQgY29uc3QgUGVyc29uTGlzdCA9IHN1YnNjcmliZVRvRGlzcGxheShQZXJzb25MaXN0Q29tcG9uZW50LCBtYXBTdGF0ZVRvUHJvcCwgZG9lc1VwZGF0ZUxpc3QpO1xuIiwiaW1wb3J0IHtoLCBjb25uZWN0fSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5pbXBvcnQgc3RvcmUgZnJvbSAnLi4vbGliL3N0b3JlJztcblxuXG5jb25zdCBhY3Rpb25zID0ge307XG5jb25zdCBzbGljZVN0YXRlID0gc3RhdGUgPT4gKHtpc1Byb2Nlc3Npbmc6IHN0YXRlLmlzUHJvY2Vzc2luZ30pO1xuY29uc3Qgc3Vic2NyaWJlVG9Qcm9jZXNzaW5nID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IExvYWRpbmdJbmRpY2F0b3IgPSAoe2lzUHJvY2Vzc2luZ30pID0+IHtcbiAgY29uc3QgY2xhc3NOYW1lID0gaXNQcm9jZXNzaW5nID09PSB0cnVlID8gJ3N0LXdvcmtpbmcnIDogJyc7XG4gIGNvbnN0IG1lc3NhZ2UgPSBpc1Byb2Nlc3NpbmcgPT09IHRydWUgPyAnbG9hZGluZyBwZXJzb25zIGRhdGEnIDogJ2RhdGEgbG9hZGVkJztcbiAgcmV0dXJuIDxkaXYgaWQ9XCJvdmVybGF5XCIgYXJpYS1saXZlPVwiYXNzZXJ0aXZlXCIgcm9sZT1cImFsZXJ0XCIgY2xhc3M9e2NsYXNzTmFtZX0+XG4gICAge21lc3NhZ2V9XG4gIDwvZGl2Pjtcbn07XG5leHBvcnQgY29uc3QgV29ya0luUHJvZ3Jlc3MgPSBzdWJzY3JpYmVUb1Byb2Nlc3NpbmcoTG9hZGluZ0luZGljYXRvcik7XG4iLCJpbXBvcnQge2gsIGNvbm5lY3R9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IGpzb24gZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuY29uc3QgYWN0aW9ucyA9IHtcbiAgdG9nZ2xlU29ydDogKHtwb2ludGVyLCBkaXJlY3Rpb259KSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3NvcnQnLCBhcmdzOiBbe3BvaW50ZXIsIGRpcmVjdGlvbn1dfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0ganNvbigndGFibGVTdGF0ZS5zb3J0JykuZ2V0O1xuY29uc3Qgc3Vic2NyaWJlVG9Tb3J0ID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IFNvcnRCdXR0b25Db21wb25lbnQgPSAocHJvcHMgPT4ge1xuICBjb25zdCB7Y29sdW1uUG9pbnRlciwgc29ydERpcmVjdGlvbnMgPSBbJ2FzYycsICdkZXNjJ10sIHBvaW50ZXIsIGRpcmVjdGlvbiwgc29ydH0gPSBwcm9wcztcbiAgY29uc3QgYWN0dWFsQ3Vyc29yID0gY29sdW1uUG9pbnRlciAhPT0gcG9pbnRlciA/IC0xIDogc29ydERpcmVjdGlvbnMuaW5kZXhPZihkaXJlY3Rpb24pO1xuICBjb25zdCBuZXdDdXJzb3IgPSAoYWN0dWFsQ3Vyc29yICsgMSApICUgc29ydERpcmVjdGlvbnMubGVuZ3RoO1xuICBjb25zdCB0b2dnbGVTb3J0ID0gKCkgPT4gc29ydCh7cG9pbnRlcjogY29sdW1uUG9pbnRlciwgZGlyZWN0aW9uOiBzb3J0RGlyZWN0aW9uc1tuZXdDdXJzb3JdfSk7XG4gIHJldHVybiA8YnV0dG9uIHRhYmluZGV4PVwiLTFcIiBvbkNsaWNrPXt0b2dnbGVTb3J0fT5CPC9idXR0b24+XG59KTtcblxuZXhwb3J0IGNvbnN0IFNvcnRCdXR0b24gPSBzdWJzY3JpYmVUb1NvcnQoKHByb3BzLCBhY3Rpb25zKSA9PlxuICA8U29ydEJ1dHRvbkNvbXBvbmVudCB7Li4ucHJvcHN9IHNvcnQ9e2FjdGlvbnMudG9nZ2xlU29ydH0vPik7XG4iLCJpbXBvcnQge2gsIGNvbm5lY3R9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVyJztcbmltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IGpzb24gZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuY29uc3QgYWN0aW9ucyA9IHtcbiAgc2VhcmNoOiAodmFsdWUsIHNjb3BlKSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3NlYXJjaCcsIGFyZ3M6IFt7dmFsdWUsIHNjb3BlfV19KVxufTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBqc29uKCd0YWJsZVN0YXRlLnNlYXJjaCcpLmdldDtcbmNvbnN0IG5vTmVlZEZvclVwZGF0ZSA9IHN0YXRlID0+IGZhbHNlOy8vIGFsd2F5cyByZXR1cm4gdGhlIHNhbWUgdmFsdWVcbmNvbnN0IHNlYXJjaGFibGUgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcblxuY29uc3QgU2VhcmNoSW5wdXQgPSAocHJvcHMpID0+ICg8bGFiZWw+XG4gIDxzcGFuPntwcm9wcy5jaGlsZHJlbn08L3NwYW4+XG4gIDxpbnB1dCB0YWJpbmRleD1cIjBcIiB0eXBlPVwic2VhcmNoXCIgb25JbnB1dD17cHJvcHMub25JbnB1dH0gcGxhY2Vob2xkZXI9e3Byb3BzLnBsYWNlaG9sZGVyfS8+XG48L2xhYmVsPik7XG5cbmV4cG9ydCBjb25zdCBTZWFyY2hSb3cgPSBzZWFyY2hhYmxlKChwcm9wcywgYWN0aW9ucykgPT4ge1xuICBjb25zdCBvbklucHV0ID0gZGVib3VuY2UoZXYgPT4gYWN0aW9ucy5zZWFyY2goZXYudGFyZ2V0LnZhbHVlLCBbJ25hbWUubGFzdCcsICduYW1lLmZpcnN0J10pLCAzMDApO1xuICBkZWxldGUgcHJvcHMuY2hpbGRyZW47XG4gIHJldHVybiA8dHIgey4uLnByb3BzfT5cbiAgICA8dGggZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cImlucHV0XCI+XG4gICAgICA8U2VhcmNoSW5wdXQgcGxhY2Vob2xkZXI9XCJDYXNlIHNlbnNpdGl2ZSBzZWFyY2ggb24gc3VybmFtZSBhbmQgbmFtZVwiIG9uSW5wdXQ9e29uSW5wdXR9PlNlYXJjaDo8L1NlYXJjaElucHV0PlxuICAgIDwvdGg+XG4gIDwvdHI+XG59LCBub05lZWRGb3JVcGRhdGUsIG5vTmVlZEZvclVwZGF0ZSk7IiwiaW1wb3J0IHtoLCBjb25uZWN0LCBvblVwZGF0ZX0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5cbmNvbnN0IGZvY3VzT25PcGVuID0gb25VcGRhdGUodm5vZGUgPT4ge1xuICBjb25zdCBhaCA9IHZub2RlLnByb3BzWydhcmlhLWhpZGRlbiddO1xuICBpZiAoYWggPT09ICdmYWxzZScpIHtcbiAgICBjb25zdCBpbnB1dCA9IHZub2RlLmRvbS5xdWVyeVNlbGVjdG9yKCdpbnB1dCwgc2VsZWN0Jyk7XG4gICAgaWYgKGlucHV0KSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IGlucHV0LmZvY3VzKCksIDUpO1xuICAgIH1cbiAgfVxufSk7XG5cbmNvbnN0IGFjdGlvbnMgPSB7XG4gIHRvZ2dsZUZpbHRlck1lbnU6IChmaWx0ZXIpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnVE9HR0xFX0ZJTFRFUicsIGZpbHRlcn0pLFxuICBjb21taXRGaWx0ZXI6ICh2YWx1ZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdmaWx0ZXInLCBhcmdzOiBbdmFsdWVdfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0gc3RhdGUgPT4gKHthY3RpdmVGaWx0ZXI6IHN0YXRlLmFjdGl2ZUZpbHRlciwgZmlsdGVyQ2xhdXNlczogc3RhdGUudGFibGVTdGF0ZS5maWx0ZXJ9KTtcbmNvbnN0IHN1YnNjcmliZVRvRmlsdGVyID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IEZpbHRlclJvd0NvbXAgPSBmb2N1c09uT3BlbigocHJvcHMgPSB7fSkgPT4ge1xuICBjb25zdCB7aXNIaWRkZW4sIHRvZ2dsZUZpbHRlck1lbnUsIGNvbW1pdEZpbHRlcn0gPSBwcm9wcztcbiAgY29uc3QgY2xvc2UgPSAoKSA9PiB7XG4gICAgdG9nZ2xlRmlsdGVyTWVudShudWxsKTtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBbYXJpYS1jb250cm9scz0ke2lkTmFtZX1dYCkuZm9jdXMoKTtcbiAgfTtcbiAgY29uc3Qgb25TdWJtaXQgPSAoZXYpID0+IHtcbiAgICBjb25zdCBmb3JtID0gZXYudGFyZ2V0O1xuICAgIGNvbnN0IHtuYW1lfSA9IGZvcm07XG4gICAgY29uc3QgaW5wdXRzID0gZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCwgc2VsZWN0Jyk7XG4gICAgY29tbWl0RmlsdGVyKHtcbiAgICAgIFtuYW1lXTogWy4uLmlucHV0c10ubWFwKGlucHV0ID0+IHtcbiAgICAgICAgcmV0dXJuIHt0eXBlOiBpbnB1dC50eXBlLCB2YWx1ZTogaW5wdXQudmFsdWUsIG9wZXJhdG9yOiBpbnB1dC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3BlcmF0b3InKSB8fCAnaW5jbHVkZXMnfVxuICAgICAgfSlcbiAgICB9KTtcbiAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGNsb3NlKCk7XG4gIH07XG4gIGNvbnN0IGlkTmFtZSA9IFsnZmlsdGVyJ10uY29uY2F0KHByb3BzLnNjb3BlLnNwbGl0KCcuJykpLmpvaW4oJy0nKTtcbiAgY29uc3Qgb25LZXlEb3duID0gKGV2KSA9PiB7XG4gICAgaWYgKGV2LmNvZGUgPT09ICdFc2NhcGUnIHx8IGV2LmtleUNvZGUgPT09IDI3IHx8IGV2LmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICAgIGNsb3NlKCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGFyaWFIaWRkZW4gPSBpc0hpZGRlbiAhPT0gdHJ1ZTtcbiAgcmV0dXJuIDx0ciBpZD17aWROYW1lfSBjbGFzcz1cImZpbHRlci1yb3dcIiBvbktleWRvd249e29uS2V5RG93bn0gZGF0YS1rZXlib2FyZC1za2lwPXthcmlhSGlkZGVufVxuICAgICAgICAgICAgIGFyaWEtaGlkZGVuPXtTdHJpbmcoYXJpYUhpZGRlbil9PlxuICAgIDx0aCBjb2xzcGFuPVwiNlwiIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJpbnB1dCwgc2VsZWN0XCI+XG4gICAgICA8Zm9ybSBuYW1lPXtwcm9wcy5zY29wZX0gb25TdWJtaXQ9e29uU3VibWl0fT5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgICA8ZGl2IGNsYXNzPVwidmlzdWFsbHktaGlkZGVuXCI+XG4gICAgICAgICAgPGJ1dHRvbiB0YWJJbmRleD1cIi0xXCI+QXBwbHk8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxwIGlkPXtpZE5hbWUgKyAnLWluc3RydWN0aW9uJ30+UHJlc3MgRW50ZXIgdG8gYWN0aXZhdGUgZmlsdGVyIG9yIGVzY2FwZSB0byBkaXNtaXNzPC9wPlxuICAgICAgPC9mb3JtPlxuICAgIDwvdGg+XG4gIDwvdHI+XG59KTtcblxuY29uc3QgRmlsdGVyQnV0dG9uID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtjb2x1bW5Qb2ludGVyLCB0b2dnbGVGaWx0ZXJNZW51LCBmaWx0ZXJDbGF1c2VzID0ge319PXByb3BzO1xuICBjb25zdCBjdXJyZW50RmlsdGVyQ2xhdXNlcyA9IGZpbHRlckNsYXVzZXNbY29sdW1uUG9pbnRlcl0gfHwgW107XG4gIGNvbnN0IGNvbnRyb2xsZWQgPSBbJ2ZpbHRlciddLmNvbmNhdChjb2x1bW5Qb2ludGVyLnNwbGl0KCcuJykpLmpvaW4oJy0nKTtcbiAgY29uc3Qgb25DbGljayA9ICgpID0+IHRvZ2dsZUZpbHRlck1lbnUoY29sdW1uUG9pbnRlcik7XG4gIGNvbnN0IGlzQWN0aXZlID0gY3VycmVudEZpbHRlckNsYXVzZXMubGVuZ3RoICYmIGN1cnJlbnRGaWx0ZXJDbGF1c2VzLnNvbWUoY2xhdXNlID0+IGNsYXVzZS52YWx1ZSk7XG4gIHJldHVybiA8YnV0dG9uIGFyaWEtaGFzcG9wdXA9XCJ0cnVlXCIgdGFiaW5kZXg9XCItMVwiIGNsYXNzPXtpc0FjdGl2ZSA/ICdhY3RpdmUtZmlsdGVyJyA6ICcnfSBhcmlhLWNvbnRyb2xzPXtjb250cm9sbGVkfVxuICAgICAgICAgICAgICAgICBvbkNsaWNrPXtvbkNsaWNrfT5GPC9idXR0b24+XG59O1xuXG5leHBvcnQgY29uc3QgVG9nZ2xlRmlsdGVyQnV0dG9uID0gc3Vic2NyaWJlVG9GaWx0ZXIoKHByb3BzLCBhY3Rpb25zKSA9PiB7XG4gIHJldHVybiA8RmlsdGVyQnV0dG9uIHsuLi5wcm9wc30gdG9nZ2xlRmlsdGVyTWVudT17YWN0aW9ucy50b2dnbGVGaWx0ZXJNZW51fS8+XG59KTtcblxuZXhwb3J0IGNvbnN0IEZpbHRlclJvdyA9IHN1YnNjcmliZVRvRmlsdGVyKChwcm9wcywgYWN0aW9ucykgPT4ge1xuICByZXR1cm4gPEZpbHRlclJvd0NvbXAgc2NvcGU9e3Byb3BzLnNjb3BlfSBpc0hpZGRlbj17cHJvcHMuYWN0aXZlRmlsdGVyID09PSBwcm9wcy5zY29wZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRvZ2dsZUZpbHRlck1lbnU9e2FjdGlvbnMudG9nZ2xlRmlsdGVyTWVudX0gY29tbWl0RmlsdGVyPXthY3Rpb25zLmNvbW1pdEZpbHRlcn0+XG5cbiAgICB7cHJvcHMuY2hpbGRyZW59XG4gIDwvRmlsdGVyUm93Q29tcD47XG59KTsiLCJpbXBvcnQge2h9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcblxuaW1wb3J0IHtTb3J0QnV0dG9ufSBmcm9tICcuL3NvcnQnO1xuaW1wb3J0IHtTZWFyY2hSb3d9IGZyb20gJy4vc2VhcmNoJztcbmltcG9ydCB7RmlsdGVyUm93LCBUb2dnbGVGaWx0ZXJCdXR0b259IGZyb20gJy4vZmlsdGVyJztcbmltcG9ydCB7dHJhcEtleWRvd259IGZyb20gJy4vaGVscGVyJztcblxuXG5jb25zdCBDb2x1bW5IZWFkZXIgPSAocHJvcHMpID0+IHtcbiAgY29uc3Qge2NvbHVtblBvaW50ZXIsIHNvcnREaXJlY3Rpb25zID0gWydhc2MnLCAnZGVzYyddLCBjbGFzc05hbWUsIGNoaWxkcmVufSA9IHByb3BzO1xuXG4gIHJldHVybiA8dGggY2xhc3M9e2NsYXNzTmFtZX0gZGF0YS1rZXlib2FyZC1zZWxlY3Rvcj1cImJ1dHRvblwiPlxuICAgIHtjaGlsZHJlbn1cbiAgICA8ZGl2IGNsYXNzPVwiYnV0dG9ucy1jb250YWluZXJcIj5cbiAgICAgIDxTb3J0QnV0dG9uIGNvbHVtblBvaW50ZXI9e2NvbHVtblBvaW50ZXJ9IHNvcnREaXJlY3Rpb25zPXtzb3J0RGlyZWN0aW9uc30vPlxuICAgICAgPFRvZ2dsZUZpbHRlckJ1dHRvbiBjb2x1bW5Qb2ludGVyPXtjb2x1bW5Qb2ludGVyfS8+XG4gICAgPC9kaXY+XG4gIDwvdGg+XG59O1xuXG5cbmV4cG9ydCBjb25zdCBIZWFkZXJzID0gKCkgPT4ge1xuXG4gIHJldHVybiA8dGhlYWQ+XG4gIDxTZWFyY2hSb3cgY2xhc3M9XCJmaWx0ZXItcm93XCIvPlxuICA8dHI+XG4gICAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtbGFzdG5hbWVcIiBjb2x1bW5Qb2ludGVyPVwibmFtZS5sYXN0XCJcbiAgICAgICAgICAgICAgICAgIHNvcnREaXJlY3Rpb25zPXtbJ2FzYycsICdkZXNjJywgJ25vbmUnXX0+U3VybmFtZTwvQ29sdW1uSGVhZGVyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLWZpcnN0bmFtZVwiIGNvbHVtblBvaW50ZXI9XCJuYW1lLmZpcnN0XCI+TmFtZTwvQ29sdW1uSGVhZGVyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLWJpcnRoZGF0ZVwiIHNvcnREaXJlY3Rpb25zPXtbJ2Rlc2MnLCAnYXNjJ119XG4gICAgICAgICAgICAgICAgICBjb2x1bW5Qb2ludGVyPVwiYmlydGhEYXRlXCI+RGF0ZSBvZiBiaXJ0aDwvQ29sdW1uSGVhZGVyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLWdlbmRlciBmaXhlZC1zaXplXCIgY29sdW1uUG9pbnRlcj1cImdlbmRlclwiPkdlbmRlcjwvQ29sdW1uSGVhZGVyPlxuICAgIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLXNpemUgZml4ZWQtc2l6ZVwiIGNvbHVtblBvaW50ZXI9XCJzaXplXCI+U2l6ZTwvQ29sdW1uSGVhZGVyPlxuICAgIDx0aCBkYXRhLWtleWJvYXJkLXNraXA9e3RydWV9IGNsYXNzPVwiZml4ZWQtc2l6ZSBjb2wtYWN0aW9uc1wiPjwvdGg+XG4gIDwvdHI+XG4gIDxGaWx0ZXJSb3cgc2NvcGU9XCJuYW1lLmxhc3RcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj5zdXJuYW1lIGluY2x1ZGVzOjwvc3Bhbj5cbiAgICAgIDxpbnB1dCBhcmlhLWRlc2NyaWJlZGJ5PVwiZmlsdGVyLW5hbWUtbGFzdC1pbnN0cnVjdGlvblwiIG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcsIDM4LCA0MCl9XG4gICAgICAgICAgICAgdHlwZT1cInRleHRcIlxuICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiY2FzZSBpbnNlbnNpdGl2ZSBzdXJuYW1lIHZhbHVlXCIvPlxuICAgIDwvbGFiZWw+XG4gIDwvRmlsdGVyUm93PlxuICA8RmlsdGVyUm93IHNjb3BlPVwibmFtZS5maXJzdFwiPlxuICAgIDxsYWJlbD5cbiAgICAgIDxzcGFuPm5hbWUgaW5jbHVkZXM6PC9zcGFuPlxuICAgICAgPGlucHV0IG9uS2V5RG93bj17dHJhcEtleWRvd24oMjcsIDM4LCA0MCl9IHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCJjYXNlIGluc2Vuc2l0aXZlIG5hbWUgdmFsdWVcIi8+XG4gICAgPC9sYWJlbD5cbiAgPC9GaWx0ZXJSb3c+XG4gIDxGaWx0ZXJSb3cgc2NvcGU9XCJiaXJ0aERhdGVcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj5ib3JuIGFmdGVyOjwvc3Bhbj5cbiAgICAgIDxpbnB1dCBvbktleURvd249e3RyYXBLZXlkb3duKDI3KX0gZGF0YS1vcGVyYXRvcj1cImd0XCIgdHlwZT1cImRhdGVcIi8+XG4gICAgPC9sYWJlbD5cbiAgPC9GaWx0ZXJSb3c+XG4gIDxGaWx0ZXJSb3cgc2NvcGU9XCJnZW5kZXJcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj5nZW5kZXIgaXM6PC9zcGFuPlxuICAgICAgPHNlbGVjdCBvbktleURvd249e3RyYXBLZXlkb3duKDI3KX0gZGF0YS1vcGVyYXRvcj1cImlzXCI+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJcIj4tPC9vcHRpb24+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJmZW1hbGVcIj5mZW1hbGU8L29wdGlvbj5cbiAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIm1hbGVcIj5tYWxlPC9vcHRpb24+XG4gICAgICA8L3NlbGVjdD5cbiAgICA8L2xhYmVsPlxuICA8L0ZpbHRlclJvdz5cbiAgPEZpbHRlclJvdyBzY29wZT1cInNpemVcIj5cbiAgICA8bGFiZWw+XG4gICAgICA8c3Bhbj50YWxsZXIgdGhhbjo8L3NwYW4+XG4gICAgICA8aW5wdXQgb25LZXlEb3duPXt0cmFwS2V5ZG93bigyNyl9IG1pbj1cIjE1MFwiIG1heD1cIjIwMFwiIHN0ZXA9XCIxXCIgdHlwZT1cInJhbmdlXCIgZGF0YS1vcGVyYXRvcj1cImd0XCIvPlxuICAgIDwvbGFiZWw+XG4gICAgPGxhYmVsPlxuICAgICAgPHNwYW4+c21hbGxlciB0aGFuOjwvc3Bhbj5cbiAgICAgIDxpbnB1dCBvbktleURvd249e3RyYXBLZXlkb3duKDI3KX0gbWluPVwiMTUwXCIgbWF4PVwiMjAwXCIgc3RlcD1cIjFcIiB0eXBlPVwicmFuZ2VcIiBkYXRhLW9wZXJhdG9yPVwibHRcIi8+XG4gICAgPC9sYWJlbD5cbiAgPC9GaWx0ZXJSb3c+XG4gIDwvdGhlYWQ+XG59IiwiaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5pbXBvcnQge2Nvbm5lY3QsIGh9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcblxuXG5jb25zdCBhY3Rpb25zID0ge1xuICBzbGljZTogKHBhZ2UsIHNpemUpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnc2xpY2UnLCBhcmdzOiBbe3BhZ2UsIHNpemV9XX0pXG59O1xuY29uc3Qgc2xpY2VTdGF0ZSA9IHN0YXRlID0+IHN0YXRlLnN1bW1hcnk7XG5jb25zdCBzdWJzY3JpYmVUb1N1bW1hcnkgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcblxuY29uc3QgU3VtbWFyeSA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7cGFnZSwgc2l6ZSwgZmlsdGVyZWRDb3VudH0gPSBwcm9wcztcbiAgcmV0dXJuICg8ZGl2PiBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+eyhwYWdlIC0gMSkgKiBzaXplICsgKGZpbHRlcmVkQ291bnQgPiAwID8gMSA6IDApfTwvc3Ryb25nPiAtXG4gICAgPHN0cm9uZz57TWF0aC5taW4oZmlsdGVyZWRDb3VudCwgcGFnZSAqIHNpemUpfTwvc3Ryb25nPiBvZiA8c3Ryb25nPntmaWx0ZXJlZENvdW50fTwvc3Ryb25nPiBtYXRjaGluZyBpdGVtc1xuICA8L2Rpdj4pO1xufTtcblxuY29uc3QgUGFnZVNpemUgPSBwcm9wcyA9PiB7XG4gIGNvbnN0IHtzaXplLCBzbGljZX0gPSBwcm9wcztcbiAgY29uc3QgY2hhbmdlUGFnZVNpemUgPSAoZXYpID0+IHNsaWNlKDEsIE51bWJlcihldi50YXJnZXQudmFsdWUpKTtcbiAgcmV0dXJuIDxkaXY+XG4gICAgPGxhYmVsPlxuICAgICAgUGFnZSBzaXplXG4gICAgICA8c2VsZWN0IHRhYkluZGV4PVwiLTFcIiBvbkNoYW5nZT17Y2hhbmdlUGFnZVNpemV9IG5hbWU9XCJwYWdlU2l6ZVwiPlxuICAgICAgICA8b3B0aW9uIHNlbGVjdGVkPXtzaXplID09IDIwfSB2YWx1ZT1cIjIwXCI+MjAgaXRlbXM8L29wdGlvbj5cbiAgICAgICAgPG9wdGlvbiBzZWxlY3RlZD17c2l6ZSA9PSAzMH0gdmFsdWU9XCIzMFwiPjMwIGl0ZW1zPC9vcHRpb24+XG4gICAgICAgIDxvcHRpb24gc2VsZWN0ZWQ9e3NpemUgPT0gNTB9IHZhbHVlPVwiNTBcIj41MCBpdGVtczwvb3B0aW9uPlxuICAgICAgPC9zZWxlY3Q+XG4gICAgPC9sYWJlbD5cbiAgPC9kaXY+XG59O1xuXG5jb25zdCBQYWdlciA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7cGFnZSwgc2l6ZSwgZmlsdGVyZWRDb3VudCwgc2xpY2V9ID0gcHJvcHM7XG4gIGNvbnN0IHNlbGVjdFByZXZpb3VzUGFnZSA9ICgpID0+IHNsaWNlKHBhZ2UgLSAxLCBzaXplKTtcbiAgY29uc3Qgc2VsZWN0TmV4dFBhZ2UgPSAoKSA9PiBzbGljZShwYWdlICsgMSwgc2l6ZSk7XG4gIGNvbnN0IGlzUHJldmlvdXNEaXNhYmxlZCA9IHBhZ2UgPT09IDE7XG4gIGNvbnN0IGlzTmV4dERpc2FibGVkID0gKGZpbHRlcmVkQ291bnQgLSAocGFnZSAqIHNpemUpKSA8PSAwO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdj5cbiAgICAgIDxidXR0b24gdGFiSW5kZXg9XCItMVwiIG9uQ2xpY2s9e3NlbGVjdFByZXZpb3VzUGFnZX0gZGlzYWJsZWQ9e2lzUHJldmlvdXNEaXNhYmxlZH0+XG4gICAgICAgIFByZXZpb3VzXG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxzbWFsbD4gUGFnZSAtIHtwYWdlIHx8IDF9IDwvc21hbGw+XG4gICAgICA8YnV0dG9uIHRhYkluZGV4PVwiLTFcIiBvbkNsaWNrPXtzZWxlY3ROZXh0UGFnZX0gZGlzYWJsZWQ9e2lzTmV4dERpc2FibGVkfT5cbiAgICAgICAgTmV4dFxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5jb25zdCBTdW1tYXJ5Rm9vdGVyID0gc3Vic2NyaWJlVG9TdW1tYXJ5KFN1bW1hcnkpO1xuY29uc3QgUGFnaW5hdGlvbiA9IHN1YnNjcmliZVRvU3VtbWFyeSgocHJvcHMsIGFjdGlvbnMpID0+IDxQYWdlciB7Li4ucHJvcHN9IHNsaWNlPXthY3Rpb25zLnNsaWNlfS8+KTtcbmNvbnN0IFNlbGVjdFBhZ2VTaXplID0gc3Vic2NyaWJlVG9TdW1tYXJ5KChwcm9wcywgYWN0aW9ucykgPT4gPFBhZ2VTaXplIHsuLi5wcm9wc30gc2xpY2U9e2FjdGlvbnMuc2xpY2V9Lz4pO1xuXG5leHBvcnQgY29uc3QgRm9vdGVyID0gKCkgPT4gPHRmb290PlxuPHRyPlxuICA8dGQgY29sc3Bhbj1cIjNcIj5cbiAgICA8U3VtbWFyeUZvb3Rlci8+XG4gIDwvdGQ+XG4gIDx0ZCBjb2xzcGFuPVwiMlwiIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJidXR0b246bm90KDpkaXNhYmxlZClcIiBjb2xTcGFuPVwiM1wiPlxuICAgIDxQYWdpbmF0aW9uLz5cbiAgPC90ZD5cbiAgPHRkIGRhdGEta2V5Ym9hcmQtc2VsZWN0b3I9XCJzZWxlY3RcIj5cbiAgICA8U2VsZWN0UGFnZVNpemUvPlxuICA8L3RkPlxuPC90cj5cbjwvdGZvb3Q+O1xuXG5cblxuIiwiZXhwb3J0IGNvbnN0IGZpbmRDb250YWluZXIgPSAoZWxlbWVudCwgc2VsZWN0b3IpID0+IGVsZW1lbnQubWF0Y2hlcyhzZWxlY3RvcikgPT09IHRydWUgPyBlbGVtZW50IDogZmluZENvbnRhaW5lcihlbGVtZW50LnBhcmVudEVsZW1lbnQsIHNlbGVjdG9yKTtcbmV4cG9ydCBjb25zdCBkYXRhU2VsZWN0b3JBdHRyaWJ1dGUgPSAnZGF0YS1rZXlib2FyZC1zZWxlY3Rvcic7XG5leHBvcnQgY29uc3QgZGF0YVNraXBBdHRyaWJ1dGUgPSAnZGF0YS1rZXlib2FyZC1za2lwJztcbmV4cG9ydCBjb25zdCB2YWxGdW5jID0gdmFsID0+ICgpID0+IHZhbDtcbmV4cG9ydCBjb25zdCB2YWxOdWxsID0gdmFsRnVuYyhudWxsKTsiLCJpbXBvcnQge1xuICBmaW5kQ29udGFpbmVyLFxuICBkYXRhU2VsZWN0b3JBdHRyaWJ1dGUsXG4gIGRhdGFTa2lwQXR0cmlidXRlLFxuICB2YWxGdW5jXG59IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWd1bGFyQ2VsbCAoZWxlbWVudCwge3Jvd1NlbGVjdG9yLCBjZWxsU2VsZWN0b3J9KSB7XG4gIGNvbnN0IHJvdyA9IGZpbmRDb250YWluZXIoZWxlbWVudCwgcm93U2VsZWN0b3IpO1xuICBjb25zdCBjZWxscyA9IFsuLi5yb3cucXVlcnlTZWxlY3RvckFsbChjZWxsU2VsZWN0b3IpXTtcbiAgY29uc3QgaW5kZXggPSBjZWxscy5pbmRleE9mKGVsZW1lbnQpO1xuICBjb25zdCByZXR1cm5FbCA9IHZhbEZ1bmMoZWxlbWVudCk7XG4gIHJldHVybiB7XG4gICAgc2VsZWN0RnJvbUFmdGVyOiByZXR1cm5FbCxcbiAgICBzZWxlY3RGcm9tQmVmb3JlOiByZXR1cm5FbCxcbiAgICBuZXh0KCl7XG4gICAgICByZXR1cm4gY2VsbHNbaW5kZXggKyAxXSAhPT0gdm9pZCAwID8gY2VsbHNbaW5kZXggKyAxXSA6IG51bGw7XG4gICAgfSxcbiAgICBwcmV2aW91cygpe1xuICAgICAgcmV0dXJuIGNlbGxzW2luZGV4IC0gMV0gIT09IHZvaWQgMCA/IGNlbGxzW2luZGV4IC0gMV0gOiBudWxsO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2tpcENlbGwgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgY29uc3QgcmVnID0gcmVndWxhckNlbGwoZWxlbWVudCwgb3B0aW9ucyk7XG4gIHJldHVybiB7XG4gICAgcHJldmlvdXM6IHJlZy5wcmV2aW91cyxcbiAgICBuZXh0OiByZWcubmV4dFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NpdGVDZWxsIChlbGVtZW50LCBvcHRpb25zKSB7XG4gIGNvbnN0IGNlbGxFbGVtZW50ID0gZmluZENvbnRhaW5lcihlbGVtZW50LCBvcHRpb25zLmNlbGxTZWxlY3Rvcik7XG4gIGNvbnN0IHNlbGVjdG9yID0gY2VsbEVsZW1lbnQuZ2V0QXR0cmlidXRlKGRhdGFTZWxlY3RvckF0dHJpYnV0ZSk7XG4gIGNvbnN0IHN1YldpZGdldHMgPSBbLi4uY2VsbEVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcildO1xuICBjb25zdCB3aWRnZXRzTGVuZ3RoID0gc3ViV2lkZ2V0cy5sZW5ndGg7XG4gIGNvbnN0IGlzU3ViV2lkZ2V0ID0gZWxlbWVudCAhPT0gY2VsbEVsZW1lbnQ7XG4gIHJldHVybiB7XG4gICAgc2VsZWN0RnJvbUJlZm9yZSgpe1xuICAgICAgcmV0dXJuIGlzU3ViV2lkZ2V0ID8gZWxlbWVudCA6IHN1YldpZGdldHNbMF07XG4gICAgfSxcbiAgICBzZWxlY3RGcm9tQWZ0ZXIoKXtcbiAgICAgIHJldHVybiBpc1N1YldpZGdldCA/IGVsZW1lbnQgOiBzdWJXaWRnZXRzW3dpZGdldHNMZW5ndGggLSAxXTtcbiAgICB9LFxuICAgIG5leHQoKXtcbiAgICAgIGNvbnN0IGluZGV4ID0gc3ViV2lkZ2V0cy5pbmRleE9mKGVsZW1lbnQpO1xuICAgICAgaWYgKGlzU3ViV2lkZ2V0ICYmIGluZGV4ICsgMSA8IHdpZGdldHNMZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHN1YldpZGdldHNbaW5kZXggKyAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZWd1bGFyQ2VsbChjZWxsRWxlbWVudCwgb3B0aW9ucykubmV4dCgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgcHJldmlvdXMoKXtcbiAgICAgIGNvbnN0IGluZGV4ID0gc3ViV2lkZ2V0cy5pbmRleE9mKGVsZW1lbnQpO1xuICAgICAgaWYgKGlzU3ViV2lkZ2V0ICYmIGluZGV4ID4gMCkge1xuICAgICAgICByZXR1cm4gc3ViV2lkZ2V0c1tpbmRleCAtIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlZ3VsYXJDZWxsKGNlbGxFbGVtZW50LCBvcHRpb25zKS5wcmV2aW91cygpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2VsbCAoZWwsIG9wdGlvbnMpIHtcbiAgaWYgKGVsID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSBpZiAoZWwuaGFzQXR0cmlidXRlKGRhdGFTa2lwQXR0cmlidXRlKSkge1xuICAgIHJldHVybiBza2lwQ2VsbChlbCwgb3B0aW9ucyk7XG4gIH0gZWxzZSBpZiAoZWwuaGFzQXR0cmlidXRlKGRhdGFTZWxlY3RvckF0dHJpYnV0ZSkgfHwgIWVsLm1hdGNoZXMob3B0aW9ucy5jZWxsU2VsZWN0b3IpKSB7XG4gICAgcmV0dXJuIGNvbXBvc2l0ZUNlbGwoZWwsIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiByZWd1bGFyQ2VsbChlbCwgb3B0aW9ucyk7XG4gIH1cbn0iLCJpbXBvcnQge2ZpbmRDb250YWluZXIsIGRhdGFTa2lwQXR0cmlidXRlfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVndWxhclJvdyAoZWxlbWVudCwgZ3JpZCwge3Jvd1NlbGVjdG9yID0gJ3RyJywgY2VsbFNlbGVjdG9yID0gJ3RoLHRkJ309e30pIHtcbiAgY29uc3Qgcm93cyA9IFsuLi5ncmlkLnF1ZXJ5U2VsZWN0b3JBbGwocm93U2VsZWN0b3IpXTtcbiAgY29uc3QgY2VsbHMgPSBbLi4uZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICBjb25zdCBpbmRleCA9IHJvd3MuaW5kZXhPZihlbGVtZW50KTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2aW91cygpe1xuICAgICAgcmV0dXJuIHJvd3NbaW5kZXggLSAxXSAhPT0gdm9pZCAwID8gcm93c1tpbmRleCAtIDFdIDogbnVsbDtcbiAgICB9LFxuICAgIG5leHQoKXtcbiAgICAgIHJldHVybiByb3dzW2luZGV4ICsgMV0gIT09IHZvaWQgMCA/IHJvd3NbaW5kZXggKyAxXSA6IG51bGw7XG4gICAgfSxcbiAgICBpdGVtKGluZGV4KXtcbiAgICAgIHJldHVybiBjZWxsc1tpbmRleF0gIT09IHZvaWQgMCA/IGNlbGxzW2luZGV4XSA6IG51bGw7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2tpcFJvdyAoZWxlbWVudCwgZ3JpZCwgb3B0aW9ucykge1xuICBjb25zdCByZWd1bGFyID0gcmVndWxhclJvdyhlbGVtZW50LCBncmlkLCBvcHRpb25zKTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2aW91czogcmVndWxhci5wcmV2aW91cyxcbiAgICBuZXh0OiByZWd1bGFyLm5leHRcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJvdyAodGFyZ2V0LCBncmlkLCB7cm93U2VsZWN0b3IsIGNlbGxTZWxlY3Rvcn09e30pIHtcbiAgaWYgKHRhcmdldCA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGNvbnN0IHIgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICByZXR1cm4gci5oYXNBdHRyaWJ1dGUoZGF0YVNraXBBdHRyaWJ1dGUpID8gc2tpcFJvdyhyLCBncmlkLCB7XG4gICAgICByb3dTZWxlY3RvcixcbiAgICAgIGNlbGxTZWxlY3RvclxuICAgIH0pIDogcmVndWxhclJvdyh0YXJnZXQsIGdyaWQsIHtyb3dTZWxlY3RvciwgY2VsbFNlbGVjdG9yfSk7XG59IiwiaW1wb3J0IHtjcmVhdGVDZWxsfSBmcm9tICcuL2NlbGwnO1xuaW1wb3J0IHtjcmVhdGVSb3d9IGZyb20gJy4vcm93JztcbmltcG9ydCB7ZmluZENvbnRhaW5lcn0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGZ1bmN0aW9uIGtleUdyaWQgKGdyaWQsIG9wdGlvbnMpIHtcbiAgY29uc3Qge3Jvd1NlbGVjdG9yLCBjZWxsU2VsZWN0b3J9ID0gb3B0aW9ucztcbiAgcmV0dXJuIHtcbiAgICBtb3ZlUmlnaHQodGFyZ2V0KXtcbiAgICAgIGNvbnN0IGNlbGwgPSBjcmVhdGVDZWxsKHRhcmdldCwgb3B0aW9ucyk7XG4gICAgICBsZXQgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwoY2VsbC5uZXh0KCksIG9wdGlvbnMpO1xuICAgICAgd2hpbGUgKG5ld0NlbGwgIT09IG51bGwgJiYgbmV3Q2VsbC5zZWxlY3RGcm9tQmVmb3JlID09PSB2b2lkIDApIHtcbiAgICAgICAgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Q2VsbC5uZXh0KCksIG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld0NlbGwgIT09IG51bGwgPyBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUoKSA6IHRhcmdldDtcbiAgICB9LFxuICAgIG1vdmVMZWZ0KHRhcmdldCl7XG4gICAgICBjb25zdCBjZWxsID0gY3JlYXRlQ2VsbCh0YXJnZXQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld0NlbGwgPSBjcmVhdGVDZWxsKGNlbGwucHJldmlvdXMoKSwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Q2VsbCAhPT0gbnVsbCAmJiBuZXdDZWxsLnNlbGVjdEZyb21BZnRlciA9PT0gdm9pZCAwKSB7XG4gICAgICAgIG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld0NlbGwucHJldmlvdXMoKSwgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3Q2VsbCAhPT0gbnVsbCA/IG5ld0NlbGwuc2VsZWN0RnJvbUFmdGVyKCkgOiB0YXJnZXQ7XG4gICAgfSxcbiAgICBtb3ZlVXAodGFyZ2V0KXtcbiAgICAgIGNvbnN0IHJvd0VsZW1lbnQgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICAgICAgY29uc3QgY2VsbHMgPSBbLi4ucm93RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICAgICAgY29uc3Qgcm93ID0gY3JlYXRlUm93KHJvd0VsZW1lbnQsIGdyaWQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld1JvdyA9IGNyZWF0ZVJvdyhyb3cucHJldmlvdXMoKSwgZ3JpZCwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Um93ICE9PSBudWxsICYmIG5ld1Jvdy5pdGVtID09PSB2b2lkIDApIHtcbiAgICAgICAgbmV3Um93ID0gY3JlYXRlUm93KG5ld1Jvdy5wcmV2aW91cygpLCBncmlkLCBvcHRpb25zKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1JvdyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgfVxuXG4gICAgICBsZXQgYXNrZWRJbmRleCA9IGNlbGxzLmluZGV4T2YoZmluZENvbnRhaW5lcih0YXJnZXQsIGNlbGxTZWxlY3RvcikpO1xuICAgICAgbGV0IG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld1Jvdy5pdGVtKGFza2VkSW5kZXgpLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdDZWxsID09PSBudWxsIHx8IG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSA9PT0gdm9pZCAwICYmIGFza2VkSW5kZXggPiAwKSB7XG4gICAgICAgIGFza2VkSW5kZXgtLTtcbiAgICAgICAgbmV3Q2VsbCA9IGNyZWF0ZUNlbGwobmV3Um93Lml0ZW0oYXNrZWRJbmRleCksIG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld0NlbGwuc2VsZWN0RnJvbUJlZm9yZSgpO1xuICAgIH0sXG4gICAgbW92ZURvd24odGFyZ2V0KXtcbiAgICAgIGNvbnN0IHJvd0VsZW1lbnQgPSBmaW5kQ29udGFpbmVyKHRhcmdldCwgcm93U2VsZWN0b3IpO1xuICAgICAgY29uc3QgY2VsbHMgPSBbLi4ucm93RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKGNlbGxTZWxlY3RvcildO1xuICAgICAgY29uc3Qgcm93ID0gY3JlYXRlUm93KHJvd0VsZW1lbnQsIGdyaWQsIG9wdGlvbnMpO1xuICAgICAgbGV0IG5ld1JvdyA9IGNyZWF0ZVJvdyhyb3cubmV4dCgpLCBncmlkLCBvcHRpb25zKTtcbiAgICAgIHdoaWxlIChuZXdSb3cgIT09IG51bGwgJiYgbmV3Um93Lml0ZW0gPT09IHZvaWQgMCkge1xuICAgICAgICBuZXdSb3cgPSBjcmVhdGVSb3cobmV3Um93Lm5leHQoKSwgZ3JpZCwgb3B0aW9ucyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChuZXdSb3cgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICAgIH1cblxuICAgICAgbGV0IGFza2VkSW5kZXggPSBjZWxscy5pbmRleE9mKGZpbmRDb250YWluZXIodGFyZ2V0LCBjZWxsU2VsZWN0b3IpKTtcbiAgICAgIGxldCBuZXdDZWxsID0gY3JlYXRlQ2VsbChuZXdSb3cuaXRlbShhc2tlZEluZGV4KSwgb3B0aW9ucyk7XG4gICAgICB3aGlsZSAobmV3Q2VsbCA9PT0gbnVsbCB8fCBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUgPT09IHZvaWQgMCAmJiBhc2tlZEluZGV4ID4gMCkge1xuICAgICAgICBhc2tlZEluZGV4LS07XG4gICAgICAgIG5ld0NlbGwgPSBjcmVhdGVDZWxsKG5ld1Jvdy5pdGVtKGFza2VkSW5kZXgpLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXdDZWxsLnNlbGVjdEZyb21CZWZvcmUoKTtcbiAgICB9XG4gIH1cbn0iLCJpbXBvcnQge2tleUdyaWR9IGZyb20gJy4vbGliL2tleWdyaWQnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoZ3JpZCwge3Jvd1NlbGVjdG9yID0gJ3RyJywgY2VsbFNlbGVjdG9yID0gJ3RkLHRoJ309e30pIHtcbiAgbGV0IGxhc3RGb2N1cyA9IG51bGw7XG4gIGNvbnN0IGtnID0ga2V5R3JpZChncmlkLCB7cm93U2VsZWN0b3IsIGNlbGxTZWxlY3Rvcn0pO1xuXG4gIGdyaWQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsICh7dGFyZ2V0LCBrZXlDb2RlfSkgPT4ge1xuICAgIGxldCBuZXdDZWxsID0gbnVsbDtcbiAgICBpZiAoa2V5Q29kZSA9PT0gMzcpIHtcbiAgICAgIG5ld0NlbGwgPSBrZy5tb3ZlTGVmdCh0YXJnZXQpO1xuICAgIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gMzgpIHtcbiAgICAgIG5ld0NlbGwgPSBrZy5tb3ZlVXAodGFyZ2V0KTtcbiAgICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDM5KSB7XG4gICAgICBuZXdDZWxsID0ga2cubW92ZVJpZ2h0KHRhcmdldCk7XG4gICAgfSBlbHNlIGlmIChrZXlDb2RlID09PSA0MCkge1xuICAgICAgbmV3Q2VsbCA9IGtnLm1vdmVEb3duKHRhcmdldCk7XG4gICAgfVxuXG4gICAgaWYgKG5ld0NlbGwgIT09IG51bGwpIHtcbiAgICAgIG5ld0NlbGwuZm9jdXMoKTtcbiAgICAgIGlmIChsYXN0Rm9jdXMgIT09IG51bGwpIHtcbiAgICAgICAgbGFzdEZvY3VzLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnLTEnKTtcbiAgICAgIH1cbiAgICAgIG5ld0NlbGwuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG4gICAgICBsYXN0Rm9jdXMgPSBuZXdDZWxsO1xuICAgIH1cbiAgfSk7XG59IiwiaW1wb3J0IHtoLCBtb3VudCwgY29ubmVjdCwgb25VcGRhdGUsIG9uTW91bnR9IGZyb20gJy4uLy4uL2luZGV4JztcbmltcG9ydCB7UGVyc29uTGlzdH0gZnJvbSAnLi9jb21wb25lbnRzL3Rib2R5JztcbmltcG9ydCB7V29ya0luUHJvZ3Jlc3N9IGZyb20gJy4vY29tcG9uZW50cy9sb2FkaW5nSW5kaWNhdG9yJztcbmltcG9ydCB7SGVhZGVyc30gZnJvbSAnLi9jb21wb25lbnRzL2hlYWRlcnMnO1xuaW1wb3J0IHtGb290ZXJ9IGZyb20gJy4vY29tcG9uZW50cy9mb290ZXInO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4vbGliL3N0b3JlJztcbmltcG9ydCBrZXlib2FyZCBmcm9tICdzbWFydC10YWJsZS1rZXlib2FyZCc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IHRhYmxlID0gb25Nb3VudChuID0+IHtcbiAgc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdleGVjJywgYXJnczogW119KTsgLy9raWNrIHNtYXJ0VGFibGVcbiAga2V5Ym9hcmQobi5kb20ucXVlcnlTZWxlY3RvcigndGFibGUnKSk7XG59KTtcblxuY29uc3QgUGVyc29uVGFibGUgPSB0YWJsZSgoKSA9PlxuICA8ZGl2IGlkPVwidGFibGUtY29udGFpbmVyXCI+XG4gICAgPFdvcmtJblByb2dyZXNzLz5cbiAgICA8dGFibGU+XG4gICAgICA8SGVhZGVycy8+XG4gICAgICA8UGVyc29uTGlzdC8+XG4gICAgICA8Rm9vdGVyLz5cbiAgICA8L3RhYmxlPlxuICA8L2Rpdj4pO1xuXG5tb3VudChQZXJzb25UYWJsZSwge30sIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluJykpOyJdLCJuYW1lcyI6WyJtb3VudCIsInN3YXAiLCJjb21wb3NlIiwiY3VycnkiLCJ0YXAiLCJwb2ludGVyIiwiZmlsdGVyIiwic29ydEZhY3RvcnkiLCJzb3J0Iiwic2VhcmNoIiwidGFibGUiLCJzbWFydFRhYmxlIiwiYWN0aW9ucyIsInNsaWNlU3RhdGUiLCJqc29uIl0sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNLGVBQWUsR0FBRyxDQUFDLEtBQUssTUFBTTtFQUNsQyxRQUFRLEVBQUUsTUFBTTtFQUNoQixRQUFRLEVBQUUsRUFBRTtFQUNaLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQztDQUNmLENBQUMsQ0FBQzs7Ozs7Ozs7O0FBU0gsQUFBZSxTQUFTLENBQUMsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsUUFBUSxFQUFFO0VBQ3ZELE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxLQUFLO0lBQ25ELE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDN0QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0dBQ2xDLEVBQUUsRUFBRSxDQUFDO0tBQ0gsR0FBRyxDQUFDLEtBQUssSUFBSTs7TUFFWixNQUFNLElBQUksR0FBRyxPQUFPLEtBQUssQ0FBQztNQUMxQixPQUFPLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxLQUFLLFVBQVUsR0FBRyxLQUFLLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2xGLENBQUMsQ0FBQzs7RUFFTCxJQUFJLE9BQU8sUUFBUSxLQUFLLFVBQVUsRUFBRTtJQUNsQyxPQUFPO01BQ0wsUUFBUTtNQUNSLEtBQUssRUFBRSxLQUFLO01BQ1osUUFBUSxFQUFFLFlBQVk7S0FDdkIsQ0FBQztHQUNILE1BQU07SUFDTCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lB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
