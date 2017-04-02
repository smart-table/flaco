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
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change
 */
var connect = function (store, actions = {}, sliceState = identity) {
  return function (comp, mapStateToProp = identity, shouldUpate = (a, b) => !isDeepEqual(a, b)) {
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
          if (shouldUpate(previousStateSlice, stateSlice)) {
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

var table$2 = function ({
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

var table$1 = function ({
  sortFactory: sortFactory$$1 = sortFactory,
  filterFactory = filter$1,
  searchFactory = search$1,
  tableState = {sort: {}, slice: {page: 1}, filter: {}, search: {}},
  data = []
}, ...tableDirectives) {

  const coreTable = table$2({sortFactory: sortFactory$$1, filterFactory, tableState, data, searchFactory});

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
const table = table$1({data, tableState}, crud);
//the store
var store = createStore(table);

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

const autoFocus = onMount(n => n.dom.focus());
const Input = autoFocus(props => {
  delete  props.children; //no children for inputs
  return h( 'input', props)
});

const InputCell = (props) => (
  h( 'td', { onClick: props.toggleEdit(true), class: props.className },
    props.isEditing === 'true' ?
        h( Input, { type: props.type || 'text', value: props.currentValue, onInput: props.onInput, onBlur: props.toggleEdit(false) })
        : h( 'span', null, props.currentValue )
  )
);

const makeEditable = comp => {
  return withState((props, setState) => {
    const toggleEdit = (val) => () => setState(Object.assign({}, props, {isEditing: val !== undefined ? val : props.isEditing !== true}));
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
  return h( 'select', { name: "gender select", onChange: onChange, onBlur: toggleEdit(false) },
    h( 'option', { value: "male", selected: person.gender === 'male' }, "male"),
    h( 'option', { value: "female", selected: person.gender === 'female' }, "female")
  )
});

const EditableGender = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.gender;

  const onChange = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {gender: currentValue});
  });
  const genderClass = person.gender === 'female' ? 'gender-female' : 'gender-male';

  return h( 'td', { onClick: toggleEdit(true), class: className },
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

  return h( 'td', { class: className, onClick: toggleEdit(true) },
    isEditing ? h( Input, { type: "number", min: "150", max: "200", value: currentValue, onBlur: toggleEdit(false), onInput: onInput }) :
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

const TBody = ({persons = [], patch, remove}) => {
  return h( 'tbody', null,
  persons.map(({value, index}) => h( 'tr', null,
      h( EditableLastName, { className: "col-lastname", person: value, index: index, patch: patch }),
      h( EditableFirstName, { className: "col-firstname", person: value, index: index, patch: patch }),
      h( EditableBirthDate, { className: "col-birthdate", person: value, index: index, patch: patch }),
      h( EditableGender, { className: "col-gender fixed-size", person: value, index: index, patch: patch }),
      h( EditableSize, { className: "col-size fixed-size", person: value, index: index, patch: patch }),
      h( 'td', { class: "fixed-size col-actions" },
        h( 'button', { onClick: () => remove(index) }, "R")
      )
    ))
  )
};

const PersonListComponent = (props, actions) => {
  return h( TBody, { persons: props.persons, remove: actions.remove, patch: actions.patch })
};


const PersonList = subscribeToDisplay(PersonListComponent, mapStateToProp, doesUpdateList);

const actions$1 = {};
const sliceState$1 = state => ({isProcessing: state.isProcessing});
const subscribeToProcessing = connect(store, actions$1, sliceState$1);

const LoadingIndicator = ({isProcessing}) => {
  const className = isProcessing === true ? 'st-working' : '';
  return h( 'div', { id: "overlay", class: className }, "Processing");
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
  return h( 'button', { onClick: toggleSort }, "S")
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
  h( 'input', { type: "search", onInput: props.onInput, placeholder: props.placeholder })
));

const SearchRow = searchable((props, actions) => {
  const onInput = debounce(ev => actions.search(ev.target.value, ['name.last', 'name.first']), 300);
  delete props.children;
  return h( 'tr', props,
    h( 'th', null,
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

  return h( 'tr', { id: idName, class: "filter-row", onKeydown: onKeyDown, 'aria-hidden': String(isHidden !== true) },
    h( 'th', { colspan: "6" },
      h( 'form', { name: props.scope, onSubmit: onSubmit },
        props.children,
        h( 'div', { class: "buttons-container" },
          h( 'button', null, "Apply" ),
          h( 'button', { onClick: close, type: "button" }, "Cancel")
        )
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
  return h( 'button', { class: isActive ? 'active-filter' : '', 'aria-controls': controlled, onClick: onClick }, "F")
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

  return h( 'th', { class: className },
    children,
    h( 'div', { class: "buttons-container" },
      h( SortButton, { columnPointer: columnPointer, sortDirections: sortDirections }),
      h( ToggleFilterButton, { columnPointer: columnPointer })
    )
  )
};


const Headers = () => (h( 'thead', null,
h( SearchRow, { class: "filter-row" }),
h( 'tr', null,
  h( ColumnHeader, { className: "col-lastname", columnPointer: "name.last", sortDirections: ['asc', 'desc', 'none'] }, "Surname"),
  h( ColumnHeader, { className: "col-firstname", columnPointer: "name.first" }, "Name"),
  h( ColumnHeader, { className: "col-birthdate", sortDirections: ['desc', 'asc'], columnPointer: "birthDate" }, "Date of birth"),
  h( ColumnHeader, { className: "col-gender fixed-size", columnPointer: "gender" }, "Gender"),
  h( ColumnHeader, { className: "col-size fixed-size", columnPointer: "size" }, "Size"),
  h( 'th', { class: "fixed-size col-actions" })
),
h( FilterRow, { scope: "name.last" },
  h( 'label', null,
    h( 'span', null, "surname includes:" ),
    h( 'input', { type: "text", placeholder: "case insensitive surname value" })
  )
),
h( FilterRow, { scope: "name.first" },
  h( 'label', null,
    h( 'span', null, "name includes:" ),
    h( 'input', { type: "text", placeholder: "case insensitive name value" })
  )
),
h( FilterRow, { scope: "birthDate" },
  h( 'label', null,
    h( 'span', null, "born after:" ),
    h( 'input', { 'data-operator': "gt", type: "date" })
  )
),
h( FilterRow, { scope: "gender" },
  h( 'label', null,
    h( 'span', null, "gender is:" ),
    h( 'select', { 'data-operator': "is" },
      h( 'option', { value: "" }, "-"),
      h( 'option', { value: "female" }, "female"),
      h( 'option', { value: "male" }, "male")
    )
  )
),
h( FilterRow, { scope: "size" },
  h( 'label', null,
    h( 'span', null, "taller than:" ),
    h( 'input', { min: "150", max: "200", step: "1", type: "range", 'data-operator': "gt" })
  ),
  h( 'label', null,
    h( 'span', null, "smaller than:" ),
    h( 'input', { min: "150", max: "200", step: "1", type: "range", 'data-operator': "lt" })
  )
)
));

const actions$5 = {
  slice: (page, size) => store.dispatch({type: 'slice', args: [{page, size}]})
};
const sliceState$5 = state => state.summary;
const subscribeToSummary = connect(store, actions$5, sliceState$5);

const summary$1 = (props) => {
  const {page, size, filteredCount} = props;
  return (h( 'div', null, " showing items ", h( 'strong', null, (page - 1) * size + (filteredCount > 0 ? 1 : 0) ), " - ", h( 'strong', null, Math.min(filteredCount, page * size) ), " of ", h( 'strong', null, filteredCount ), " matching items" ));
};

const Pager = (props) => {
  const {page, size, filteredCount, slice} = props;
  const selectPreviousPage = () => slice(page - 1, size);
  const selectNextPage = () => slice(page + 1, size);
  const isPreviousDisabled = page === 1;
  const isNextDisabled = (filteredCount - (page * size)) <= 0;

  return (h( 'div', null,
    h( 'div', null,
      h( 'button', { onClick: selectPreviousPage, disabled: isPreviousDisabled }, "Previous"),
      h( 'small', null, " Page - ", page || 1, " " ),
      h( 'button', { onClick: selectNextPage, disabled: isNextDisabled }, "Next")
    )
    /*<div>*/
    /*<label>*/
    /*Page size*/
    /*<select onChange={ev => {*/
    /*directive.changePageSize(Number(ev.target.value))*/
    /*}} name="pageSize">*/
    /*<option selected={size == 15} value="15">15 items</option>*/
    /*<option selected={size == 25} value="25">25 items</option>*/
    /*<option selected={size == 50} value="50">50 items</option>*/
    /*</select>*/
    /*</label>*/
    /*</div>*/
  ));
};

const SummaryFooter = subscribeToSummary(summary$1);
const Pagination = subscribeToSummary((props, actions) => h( Pager, Object.assign({}, props, { slice: actions.slice })));

const Footer = () => h( 'tfoot', null,
h( 'tr', null,
  h( 'td', { colspan: "3" },
    h( SummaryFooter, null )
  ),
  h( 'td', { colSpan: "3" },
    h( Pagination, null )
  )
)
);

const PersonTable = onMount(() => {
  store.dispatch({type: 'exec', args: []}); //kick smartTable
}, () =>
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvaC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1vcGVyYXRvcnMvaW5kZXguanMiLCIuLi8uLi9saWIvdXRpbC5qcyIsIi4uLy4uL2xpYi9kb21VdGlsLmpzIiwiLi4vLi4vbGliL3RyYXZlcnNlLmpzIiwiLi4vLi4vbGliL3RyZWUuanMiLCIuLi8uLi9saWIvdXBkYXRlLmpzIiwiLi4vLi4vbGliL2xpZmVDeWNsZXMuanMiLCIuLi8uLi9saWIvd2l0aFN0YXRlLmpzIiwiLi4vLi4vbGliL2VsbS5qcyIsIi4uLy4uL2xpYi9jb25uZWN0LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNydWQvY3J1ZC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jcnVkL2luZGV4LmpzIiwibGliL3JlZHV4U21hcnRUYWJsZS5qcyIsImxpYi9zdG9yZS5qcyIsImNvbXBvbmVudHMvaGVscGVyLmpzIiwiY29tcG9uZW50cy9pbnB1dHMuanMiLCJjb21wb25lbnRzL2VkaXRhYmxlQ2VsbC5qcyIsImNvbXBvbmVudHMvdGJvZHkuanMiLCJjb21wb25lbnRzL2xvYWRpbmdJbmRpY2F0b3IuanMiLCJjb21wb25lbnRzL3NvcnQuanMiLCJjb21wb25lbnRzL3NlYXJjaC5qcyIsImNvbXBvbmVudHMvZmlsdGVyLmpzIiwiY29tcG9uZW50cy9oZWFkZXJzLmpzIiwiY29tcG9uZW50cy9mb290ZXIuanMiLCJpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBjcmVhdGVUZXh0Vk5vZGUgPSAodmFsdWUpID0+ICh7XG4gIG5vZGVUeXBlOiAnVGV4dCcsXG4gIGNoaWxkcmVuOiBbXSxcbiAgcHJvcHM6IHt2YWx1ZX1cbn0pO1xuXG4vKipcbiAqIFRyYW5zZm9ybSBoeXBlcnNjcmlwdCBpbnRvIHZpcnR1YWwgZG9tIG5vZGVcbiAqIEBwYXJhbSBub2RlVHlwZVxuICogQHBhcmFtIHByb3BzXG4gKiBAcGFyYW0gY2hpbGRyZW5cbiAqIEByZXR1cm5zIHsqfVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBoIChub2RlVHlwZSwgcHJvcHMsIC4uLmNoaWxkcmVuKSB7XG4gIGNvbnN0IGZsYXRDaGlsZHJlbiA9IGNoaWxkcmVuLnJlZHVjZSgoYWNjLCBjaGlsZCkgPT4ge1xuICAgIGNvbnN0IGNoaWxkcmVuQXJyYXkgPSBBcnJheS5pc0FycmF5KGNoaWxkKSA/IGNoaWxkIDogW2NoaWxkXTtcbiAgICByZXR1cm4gYWNjLmNvbmNhdChjaGlsZHJlbkFycmF5KTtcbiAgfSwgW10pXG4gICAgLm1hcChjaGlsZCA9PiB7XG4gICAgICAvLyBub3JtYWxpemUgdGV4dCBub2RlIHRvIGhhdmUgc2FtZSBzdHJ1Y3R1cmUgdGhhbiByZWd1bGFyIGRvbSBub2Rlc1xuICAgICAgY29uc3QgdHlwZSA9IHR5cGVvZiBjaGlsZDtcbiAgICAgIHJldHVybiB0eXBlID09PSAnb2JqZWN0JyB8fCB0eXBlID09PSAnZnVuY3Rpb24nID8gY2hpbGQgOiBjcmVhdGVUZXh0Vk5vZGUoY2hpbGQpO1xuICAgIH0pO1xuXG4gIGlmICh0eXBlb2Ygbm9kZVR5cGUgIT09ICdmdW5jdGlvbicpIHsvL3JlZ3VsYXIgaHRtbC90ZXh0IG5vZGVcbiAgICByZXR1cm4ge1xuICAgICAgbm9kZVR5cGUsXG4gICAgICBwcm9wczogcHJvcHMsXG4gICAgICBjaGlsZHJlbjogZmxhdENoaWxkcmVuXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBmdWxsUHJvcHMgPSBPYmplY3QuYXNzaWduKHtjaGlsZHJlbjogZmxhdENoaWxkcmVufSwgcHJvcHMpO1xuICAgIGNvbnN0IGNvbXAgPSBub2RlVHlwZShmdWxsUHJvcHMpO1xuICAgIHJldHVybiB0eXBlb2YgY29tcCAhPT0gJ2Z1bmN0aW9uJyA/IGNvbXAgOiBoKGNvbXAsIHByb3BzLCAuLi5mbGF0Q2hpbGRyZW4pOyAvL2Z1bmN0aW9uYWwgY29tcCB2cyBjb21iaW5hdG9yIChIT0MpXG4gIH1cbn07IiwiZXhwb3J0IGZ1bmN0aW9uIHN3YXAgKGYpIHtcbiAgcmV0dXJuIChhLCBiKSA9PiBmKGIsIGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZSAoZmlyc3QsIC4uLmZucykge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycnkgKGZuLCBhcml0eUxlZnQpIHtcbiAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseSAoZm4pIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcCAoZm4pIHtcbiAgcmV0dXJuIGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IG5leHRUaWNrID0gZm4gPT4gc2V0VGltZW91dChmbiwgMCk7XG5cbmV4cG9ydCBjb25zdCBwYWlyaWZ5ID0gaG9sZGVyID0+IGtleSA9PiBba2V5LCBob2xkZXJba2V5XV07XG5cbmV4cG9ydCBjb25zdCBpc1NoYWxsb3dFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IGFLZXlzID0gT2JqZWN0LmtleXMoYSk7XG4gIGNvbnN0IGJLZXlzID0gT2JqZWN0LmtleXMoYik7XG4gIHJldHVybiBhS2V5cy5sZW5ndGggPT09IGJLZXlzLmxlbmd0aCAmJiBhS2V5cy5ldmVyeSgoaykgPT4gYVtrXSA9PT0gYltrXSk7XG59O1xuXG5jb25zdCBvd25LZXlzID0gb2JqID0+IE9iamVjdC5rZXlzKG9iaikuZmlsdGVyKGsgPT4gb2JqLmhhc093blByb3BlcnR5KGspKTtcblxuZXhwb3J0IGNvbnN0IGlzRGVlcEVxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgdHlwZSA9IHR5cGVvZiBhO1xuXG4gIC8vc2hvcnQgcGF0aChzKVxuICBpZiAoYSA9PT0gYikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKHR5cGUgIT09IHR5cGVvZiBiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKHR5cGUgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIGEgPT09IGI7XG4gIH1cblxuICAvLyBvYmplY3RzIC4uLlxuICBpZiAoYSA9PT0gbnVsbCB8fCBiID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkoYSkpIHtcbiAgICByZXR1cm4gYS5sZW5ndGggJiYgYi5sZW5ndGggJiYgYS5ldmVyeSgoaXRlbSwgaSkgPT4gaXNEZWVwRXF1YWwoYVtpXSwgYltpXSkpO1xuICB9XG5cbiAgY29uc3QgYUtleXMgPSBvd25LZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IG93bktleXMoYik7XG4gIHJldHVybiBhS2V5cy5sZW5ndGggPT09IGJLZXlzLmxlbmd0aCAmJiBhS2V5cy5ldmVyeShrID0+IGlzRGVlcEVxdWFsKGFba10sIGJba10pKTtcbn07XG5cbmV4cG9ydCBjb25zdCBpZGVudGl0eSA9IHAgPT4gcDtcblxuZXhwb3J0IGNvbnN0IG5vb3AgPSAoKSA9PiB7XG59O1xuIiwiaW1wb3J0IHt0YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IHVwZGF0ZURvbU5vZGVGYWN0b3J5ID0gKG1ldGhvZCkgPT4gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IHBhaXIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlW21ldGhvZF0oLi4ucGFpcik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgncmVtb3ZlRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IGFkZEV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ2FkZEV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBzZXRBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoKGRvbU5vZGUpID0+IHtcbiAgY29uc3QgYXR0cmlidXRlcyA9IGl0ZW1zLmZpbHRlcigoW2tleSwgdmFsdWVdKSA9PiB0eXBlb2YgdmFsdWUgIT09ICdmdW5jdGlvbicpO1xuICBmb3IgKGxldCBba2V5LCB2YWx1ZV0gb2YgYXR0cmlidXRlcykge1xuICAgIHZhbHVlID09PSBmYWxzZSA/IGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGtleSkgOiBkb21Ob2RlLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgfVxufSk7XG5leHBvcnQgY29uc3QgcmVtb3ZlQXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBhdHRyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3Qgc2V0VGV4dE5vZGUgPSB2YWwgPT4gbm9kZSA9PiBub2RlLnRleHRDb250ZW50ID0gdmFsO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlRG9tTm9kZSA9IHZub2RlID0+IHtcbiAgcmV0dXJuIHZub2RlLm5vZGVUeXBlICE9PSAnVGV4dCcgP1xuICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodm5vZGUubm9kZVR5cGUpIDpcbiAgICBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShTdHJpbmcodm5vZGUucHJvcHMudmFsdWUpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudExpc3RlbmVycyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gT2JqZWN0LmtleXMocHJvcHMpXG4gICAgLmZpbHRlcihrID0+IGsuc3Vic3RyKDAsIDIpID09PSAnb24nKVxuICAgIC5tYXAoayA9PiBbay5zdWJzdHIoMikudG9Mb3dlckNhc2UoKSwgcHJvcHNba11dKTtcbn07XG4iLCJleHBvcnQgY29uc3QgdHJhdmVyc2UgPSBmdW5jdGlvbiAqICh2bm9kZSkge1xuICB5aWVsZCB2bm9kZTtcbiAgaWYgKHZub2RlLmNoaWxkcmVuICYmIHZub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgIGZvciAobGV0IGNoaWxkIG9mIHZub2RlLmNoaWxkcmVuKSB7XG4gICAgICB5aWVsZCAqIHRyYXZlcnNlKGNoaWxkKTtcbiAgICB9XG4gIH1cbn07IiwiaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7XG4gIGlzU2hhbGxvd0VxdWFsLFxuICBwYWlyaWZ5LFxuICBuZXh0VGljayxcbiAgbm9vcFxufSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlQXR0cmlidXRlcyxcbiAgc2V0QXR0cmlidXRlcyxcbiAgc2V0VGV4dE5vZGUsXG4gIGNyZWF0ZURvbU5vZGUsXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxuICBhZGRFdmVudExpc3RlbmVycyxcbiAgZ2V0RXZlbnRMaXN0ZW5lcnMsXG59IGZyb20gJy4vZG9tVXRpbCc7XG5pbXBvcnQge3RyYXZlcnNlfSBmcm9tICcuL3RyYXZlcnNlJztcblxuZnVuY3Rpb24gdXBkYXRlRXZlbnRMaXN0ZW5lcnMgKHtwcm9wczpuZXdOb2RlUHJvcHN9PXt9LCB7cHJvcHM6b2xkTm9kZVByb3BzfT17fSkge1xuICBjb25zdCBuZXdOb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMobmV3Tm9kZVByb3BzIHx8IHt9KTtcbiAgY29uc3Qgb2xkTm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG9sZE5vZGVQcm9wcyB8fCB7fSk7XG5cbiAgcmV0dXJuIG5ld05vZGVFdmVudHMubGVuZ3RoIHx8IG9sZE5vZGVFdmVudHMubGVuZ3RoID9cbiAgICBjb21wb3NlKFxuICAgICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMob2xkTm9kZUV2ZW50cyksXG4gICAgICBhZGRFdmVudExpc3RlbmVycyhuZXdOb2RlRXZlbnRzKVxuICAgICkgOiBub29wO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBdHRyaWJ1dGVzIChuZXdWTm9kZSwgb2xkVk5vZGUpIHtcbiAgY29uc3QgbmV3Vk5vZGVQcm9wcyA9IG5ld1ZOb2RlLnByb3BzIHx8IHt9O1xuICBjb25zdCBvbGRWTm9kZVByb3BzID0gb2xkVk5vZGUucHJvcHMgfHwge307XG5cbiAgaWYgKGlzU2hhbGxvd0VxdWFsKG5ld1ZOb2RlUHJvcHMsIG9sZFZOb2RlUHJvcHMpKSB7XG4gICAgcmV0dXJuIG5vb3A7XG4gIH1cblxuICBpZiAobmV3Vk5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgIHJldHVybiBzZXRUZXh0Tm9kZShuZXdWTm9kZS5wcm9wcy52YWx1ZSk7XG4gIH1cblxuICBjb25zdCBuZXdOb2RlS2V5cyA9IE9iamVjdC5rZXlzKG5ld1ZOb2RlUHJvcHMpO1xuICBjb25zdCBvbGROb2RlS2V5cyA9IE9iamVjdC5rZXlzKG9sZFZOb2RlUHJvcHMpO1xuICBjb25zdCBhdHRyaWJ1dGVzVG9SZW1vdmUgPSBvbGROb2RlS2V5cy5maWx0ZXIoayA9PiAhbmV3Tm9kZUtleXMuaW5jbHVkZXMoaykpO1xuXG4gIHJldHVybiBjb21wb3NlKFxuICAgIHJlbW92ZUF0dHJpYnV0ZXMoYXR0cmlidXRlc1RvUmVtb3ZlKSxcbiAgICBzZXRBdHRyaWJ1dGVzKG5ld05vZGVLZXlzLm1hcChwYWlyaWZ5KG5ld1ZOb2RlUHJvcHMpKSlcbiAgKTtcbn1cblxuY29uc3QgZG9tRmFjdG9yeSA9IGNyZWF0ZURvbU5vZGU7XG5cbi8vIGFwcGx5IHZub2RlIGRpZmZpbmcgdG8gYWN0dWFsIGRvbSBub2RlIChpZiBuZXcgbm9kZSA9PiBpdCB3aWxsIGJlIG1vdW50ZWQgaW50byB0aGUgcGFyZW50KVxuY29uc3QgZG9taWZ5ID0gZnVuY3Rpb24gdXBkYXRlRG9tIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpIHtcbiAgaWYgKCFvbGRWbm9kZSkgey8vdGhlcmUgaXMgbm8gcHJldmlvdXMgdm5vZGVcbiAgICBpZiAobmV3Vm5vZGUpIHsvL25ldyBub2RlID0+IHdlIGluc2VydFxuICAgICAgbmV3Vm5vZGUuZG9tID0gcGFyZW50RG9tTm9kZS5hcHBlbmRDaGlsZChkb21GYWN0b3J5KG5ld1Zub2RlKSk7XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSAxO1xuICAgICAgcmV0dXJuIHt2bm9kZTogbmV3Vm5vZGUsIGdhcmJhZ2U6IG51bGx9O1xuICAgIH0gZWxzZSB7Ly9lbHNlIChpcnJlbGV2YW50KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBvcGVyYXRpb24nKVxuICAgIH1cbiAgfSBlbHNlIHsvL3RoZXJlIGlzIGEgcHJldmlvdXMgdm5vZGVcbiAgICBpZiAoIW5ld1Zub2RlKSB7Ly93ZSBtdXN0IHJlbW92ZSB0aGUgcmVsYXRlZCBkb20gbm9kZVxuICAgICAgcGFyZW50RG9tTm9kZS5yZW1vdmVDaGlsZChvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuICh7Z2FyYmFnZTogb2xkVm5vZGUsIGRvbTogbnVsbH0pO1xuICAgIH0gZWxzZSBpZiAobmV3Vm5vZGUubm9kZVR5cGUgIT09IG9sZFZub2RlLm5vZGVUeXBlKSB7Ly9pdCBtdXN0IGJlIHJlcGxhY2VkXG4gICAgICBuZXdWbm9kZS5kb20gPSBkb21GYWN0b3J5KG5ld1Zub2RlKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICBwYXJlbnREb21Ob2RlLnJlcGxhY2VDaGlsZChuZXdWbm9kZS5kb20sIG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4ge2dhcmJhZ2U6IG9sZFZub2RlLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH0gZWxzZSB7Ly8gb25seSB1cGRhdGUgYXR0cmlidXRlc1xuICAgICAgbmV3Vm5vZGUuZG9tID0gb2xkVm5vZGUuZG9tO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gb2xkVm5vZGUubGlmZUN5Y2xlICsgMTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogbnVsbCwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogcmVuZGVyIGEgdmlydHVhbCBkb20gbm9kZSwgZGlmZmluZyBpdCB3aXRoIGl0cyBwcmV2aW91cyB2ZXJzaW9uLCBtb3VudGluZyBpdCBpbiBhIHBhcmVudCBkb20gbm9kZVxuICogQHBhcmFtIG9sZFZub2RlXG4gKiBAcGFyYW0gbmV3Vm5vZGVcbiAqIEBwYXJhbSBwYXJlbnREb21Ob2RlXG4gKiBAcGFyYW0gb25OZXh0VGljayBjb2xsZWN0IG9wZXJhdGlvbnMgdG8gYmUgcHJvY2Vzc2VkIG9uIG5leHQgdGlja1xuICogQHJldHVybnMge0FycmF5fVxuICovXG5leHBvcnQgY29uc3QgcmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyZXIgKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSwgb25OZXh0VGljayA9IFtdKSB7XG5cbiAgLy8xLiB0cmFuc2Zvcm0gdGhlIG5ldyB2bm9kZSB0byBhIHZub2RlIGNvbm5lY3RlZCB0byBhbiBhY3R1YWwgZG9tIGVsZW1lbnQgYmFzZWQgb24gdm5vZGUgdmVyc2lvbnMgZGlmZmluZ1xuICAvLyBpLiBub3RlIGF0IHRoaXMgc3RlcCBvY2N1ciBkb20gaW5zZXJ0aW9ucy9yZW1vdmFsc1xuICAvLyBpaS4gaXQgbWF5IGNvbGxlY3Qgc3ViIHRyZWUgdG8gYmUgZHJvcHBlZCAob3IgXCJ1bm1vdW50ZWRcIilcbiAgY29uc3Qge3Zub2RlLCBnYXJiYWdlfSA9IGRvbWlmeShvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuXG4gIGlmIChnYXJiYWdlICE9PSBudWxsKSB7XG4gICAgLy8gZGVmZXIgdW4gbW91bnQgbGlmZWN5Y2xlIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgZm9yIChsZXQgZyBvZiB0cmF2ZXJzZShnYXJiYWdlKSkge1xuICAgICAgaWYgKGcub25Vbk1vdW50KSB7XG4gICAgICAgIG9uTmV4dFRpY2sucHVzaChnLm9uVW5Nb3VudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy9Ob3JtYWxpc2F0aW9uIG9mIG9sZCBub2RlIChpbiBjYXNlIG9mIGEgcmVwbGFjZSB3ZSB3aWxsIGNvbnNpZGVyIG9sZCBub2RlIGFzIGVtcHR5IG5vZGUgKG5vIGNoaWxkcmVuLCBubyBwcm9wcykpXG4gIGNvbnN0IHRlbXBPbGROb2RlID0gZ2FyYmFnZSAhPT0gbnVsbCB8fCAhb2xkVm5vZGUgPyB7bGVuZ3RoOiAwLCBjaGlsZHJlbjogW10sIHByb3BzOiB7fX0gOiBvbGRWbm9kZTtcblxuICBpZiAodm5vZGUpIHtcblxuICAgIC8vMi4gdXBkYXRlIGRvbSBhdHRyaWJ1dGVzIGJhc2VkIG9uIHZub2RlIHByb3AgZGlmZmluZy5cbiAgICAvL3N5bmNcblxuICAgIGlmICh2bm9kZS5vblVwZGF0ZSAmJiB2bm9kZS5saWZlQ3ljbGUgPiAxKSB7XG4gICAgICB2bm9kZS5vblVwZGF0ZSgpO1xuICAgIH1cblxuICAgIHVwZGF0ZUF0dHJpYnV0ZXModm5vZGUsIHRlbXBPbGROb2RlKSh2bm9kZS5kb20pO1xuXG4gICAgLy9mYXN0IHBhdGhcbiAgICBpZiAodm5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgICAgcmV0dXJuIG9uTmV4dFRpY2s7XG4gICAgfVxuXG4gICAgaWYgKHZub2RlLm9uTW91bnQgJiYgdm5vZGUubGlmZUN5Y2xlID09PSAxKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gdm5vZGUub25Nb3VudCgpKTtcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbkNvdW50ID0gTWF0aC5tYXgodGVtcE9sZE5vZGUuY2hpbGRyZW4ubGVuZ3RoLCB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpO1xuXG4gICAgLy9hc3luYyB3aWxsIGJlIGRlZmVycmVkIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgY29uc3Qgc2V0TGlzdGVuZXJzID0gdXBkYXRlRXZlbnRMaXN0ZW5lcnModm5vZGUsIHRlbXBPbGROb2RlKTtcbiAgICBpZiAoc2V0TGlzdGVuZXJzICE9PSBub29wKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gc2V0TGlzdGVuZXJzKHZub2RlLmRvbSkpO1xuICAgIH1cblxuICAgIC8vMyByZWN1cnNpdmVseSB0cmF2ZXJzZSBjaGlsZHJlbiB0byB1cGRhdGUgZG9tIGFuZCBjb2xsZWN0IGZ1bmN0aW9ucyB0byBwcm9jZXNzIG9uIG5leHQgdGlja1xuICAgIGlmIChjaGlsZHJlbkNvdW50ID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbkNvdW50OyBpKyspIHtcbiAgICAgICAgLy8gd2UgcGFzcyBvbk5leHRUaWNrIGFzIHJlZmVyZW5jZSAoaW1wcm92ZSBwZXJmOiBtZW1vcnkgKyBzcGVlZClcbiAgICAgICAgcmVuZGVyKHRlbXBPbGROb2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuZG9tLCBvbk5leHRUaWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb25OZXh0VGljaztcbn07XG5cbmV4cG9ydCBjb25zdCBtb3VudCA9IGN1cnJ5KGZ1bmN0aW9uIChjb21wLCBpbml0UHJvcCwgcm9vdCkge1xuICBjb25zdCB2bm9kZSA9IGNvbXAoaW5pdFByb3AgfHwge30pO1xuICBjb25zdCBiYXRjaCA9IHJlbmRlcihudWxsLCB2bm9kZSwgcm9vdCk7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKGxldCBvcCBvZiBiYXRjaCkge1xuICAgICAgb3AoKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdm5vZGU7XG59KTsiLCJpbXBvcnQge3JlbmRlcn0gZnJvbSAnLi90cmVlJztcbmltcG9ydCB7bmV4dFRpY2t9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogQ3JlYXRlIGEgZnVuY3Rpb24gd2hpY2ggd2lsbCB0cmlnZ2VyIGFuIHVwZGF0ZSBvZiB0aGUgY29tcG9uZW50IHdpdGggdGhlIHBhc3NlZCBzdGF0ZVxuICogQHBhcmFtIGNvbXBcbiAqIEBwYXJhbSBpbml0aWFsVk5vZGVcbiAqIEByZXR1cm5zIHtmdW5jdGlvbigqPSwgLi4uWypdKX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdXBkYXRlIChjb21wLCBpbml0aWFsVk5vZGUpIHtcbiAgbGV0IG9sZE5vZGUgPSBpbml0aWFsVk5vZGU7XG4gIGNvbnN0IHVwZGF0ZUZ1bmMgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBtb3VudCA9IG9sZE5vZGUuZG9tLnBhcmVudE5vZGU7XG4gICAgY29uc3QgbmV3Tm9kZSA9IGNvbXAoT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IG9sZE5vZGUuY2hpbGRyZW4gfHwgW119LCBvbGROb2RlLnByb3BzLCBwcm9wcyksIC4uLmFyZ3MpO1xuICAgIGNvbnN0IG5leHRCYXRjaCA9IHJlbmRlcihvbGROb2RlLCBuZXdOb2RlLCBtb3VudCk7XG5cbiAgICAvLyBkYW5nZXIgem9uZSAhISEhXG4gICAgLy8gY2hhbmdlIGJ5IGtlZXBpbmcgdGhlIHNhbWUgcmVmZXJlbmNlIHNvIHRoZSBldmVudHVhbCBwYXJlbnQgbm9kZSBkb2VzIG5vdCBuZWVkIHRvIGJlIFwiYXdhcmVcIiB0cmVlIG1heSBoYXZlIGNoYW5nZWQgZG93bnN0cmVhbTogb2xkTm9kZSBtYXkgYmUgdGhlIGNoaWxkIG9mIHNvbWVvbmUgLi4uKHdlbGwgdGhhdCBpcyBhIHRyZWUgZGF0YSBzdHJ1Y3R1cmUgYWZ0ZXIgYWxsIDpQIClcbiAgICBvbGROb2RlID0gT2JqZWN0LmFzc2lnbihvbGROb2RlIHx8IHt9LCBuZXdOb2RlKTtcbiAgICAvLyBlbmQgZGFuZ2VyIHpvbmVcblxuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGZvciAobGV0IG9wIG9mIG5leHRCYXRjaCkge1xuICAgICAgICBvcCgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlO1xuICB9O1xuICByZXR1cm4gdXBkYXRlRnVuYztcbn0iLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCBsaWZlQ3ljbGVGYWN0b3J5ID0gbWV0aG9kID0+IGN1cnJ5KChmbiwgY29tcCkgPT4gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gIGNvbnN0IG4gPSBjb21wKHByb3BzLCAuLi5hcmdzKTtcbiAgblttZXRob2RdID0gKCkgPT4gZm4obiwgLi4uYXJncyk7XG4gIHJldHVybiBuO1xufSk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvbk1vdW50Jyk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIHVubW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Vbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Vbk1vdW50Jyk7XG5cbmV4cG9ydCBjb25zdCBvblVwZGF0ZSA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVXBkYXRlJyk7IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnQsIG9uVXBkYXRlfSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgXCJzdGF0ZWZ1bCBjb21wb25lbnRcIjogaWUgaXQgd2lsbCBoYXZlIGl0cyBvd24gc3RhdGUgYW5kIHRoZSBhYmlsaXR5IHRvIHVwZGF0ZSBpdHMgb3duIHRyZWVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChjb21wKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgIC8vbGF6eSBldmFsdWF0ZSB1cGRhdGVGdW5jICh0byBtYWtlIHN1cmUgaXQgaXMgZGVmaW5lZFxuICAgICAgY29uc3Qgc2V0U3RhdGUgPSAobmV3U3RhdGUpID0+IHVwZGF0ZUZ1bmMobmV3U3RhdGUpO1xuICAgICAgcmV0dXJuIGNvbXAocHJvcHMsIHNldFN0YXRlLCAuLi5hcmdzKTtcbiAgICB9O1xuICAgIGNvbnN0IHNldFVwZGF0ZUZ1bmN0aW9uID0gKHZub2RlKSA9PiB7XG4gICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgfTtcblxuICAgIHJldHVybiBjb21wb3NlKG9uTW91bnQoc2V0VXBkYXRlRnVuY3Rpb24pLCBvblVwZGF0ZShzZXRVcGRhdGVGdW5jdGlvbikpKHdyYXBwZXJDb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcyc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbi8vdG9kbyB0aHJvdyB0aGlzIGluIGZhdm9yIG9mIGNvbm5lY3Qgb25seSA/XG5cbi8qKlxuICogQ29tYmluYXRvciB0byBjcmVhdGUgYSBFbG0gbGlrZSBhcHBcbiAqIEBwYXJhbSB2aWV3XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh2aWV3KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe21vZGVsLCB1cGRhdGVzLCBzdWJzY3JpcHRpb25zID0gW119KSB7XG4gICAgbGV0IGFjdGlvblN0b3JlID0ge307XG5cbiAgICBjb25zdCBjb21wID0gcHJvcHMgPT4gdmlldyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuXG4gICAgY29uc3QgaW5pdEFjdGlvblN0b3JlID0gKHZub2RlKSA9PiB7XG4gICAgICBjb25zdCB1cGRhdGVGdW5jID0gdXBkYXRlKGNvbXAsIHZub2RlKTtcbiAgICAgIGZvciAobGV0IHVwZGF0ZSBvZiBPYmplY3Qua2V5cyh1cGRhdGVzKSkge1xuICAgICAgICBhY3Rpb25TdG9yZVt1cGRhdGVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgICBtb2RlbCA9IHVwZGF0ZXNbdXBkYXRlXShtb2RlbCwgLi4uYXJncyk7IC8vdG9kbyBjb25zaWRlciBzaWRlIGVmZmVjdHMsIG1pZGRsZXdhcmVzLCBldGNcbiAgICAgICAgICByZXR1cm4gdXBkYXRlRnVuYyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBpbml0U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5tYXAoc3ViID0+IHZub2RlID0+IHN1Yih2bm9kZSwgYWN0aW9uU3RvcmUpKTtcbiAgICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICAgIHJldHVybiBvbk1vdW50KGluaXRGdW5jLCBjb21wKTtcbiAgfTtcbn07XG5cblxuLypcblxuY29ubmVjdChzdG9yZSwgYWN0aW9ucywgd2F0Y2hlcilcblxuXG5cblxuICovIiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVuTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcydcbmltcG9ydCB7aXNEZWVwRXF1YWwsIGlkZW50aXR5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENvbm5lY3QgY29tYmluYXRvcjogd2lsbCBjcmVhdGUgXCJjb250YWluZXJcIiBjb21wb25lbnQgd2hpY2ggd2lsbCBzdWJzY3JpYmUgdG8gYSBSZWR1eCBsaWtlIHN0b3JlLiBhbmQgdXBkYXRlIGl0cyBjaGlsZHJlbiB3aGVuZXZlciBhIHNwZWNpZmljIHNsaWNlIG9mIHN0YXRlIGNoYW5nZVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc3RvcmUsIGFjdGlvbnMgPSB7fSwgc2xpY2VTdGF0ZSA9IGlkZW50aXR5KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoY29tcCwgbWFwU3RhdGVUb1Byb3AgPSBpZGVudGl0eSwgc2hvdWxkVXBhdGUgPSAoYSwgYikgPT4gIWlzRGVlcEVxdWFsKGEsIGIpKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChpbml0UHJvcCkge1xuICAgICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgICBsZXQgcHJldmlvdXNTdGF0ZVNsaWNlO1xuICAgICAgbGV0IGNvbXBvbmVudFByb3BzID0gaW5pdFByb3A7XG4gICAgICBsZXQgdW5zdWJzY3JpYmVyO1xuXG4gICAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgICByZXR1cm4gY29tcChwcm9wcywgYWN0aW9ucywgLi4uYXJncyk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBzdWJzY3JpYmUgPSBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgICAgIHVuc3Vic2NyaWJlciA9IHN0b3JlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdGVTbGljZSA9IHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgaWYgKHNob3VsZFVwYXRlKHByZXZpb3VzU3RhdGVTbGljZSwgc3RhdGVTbGljZSkpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50UHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHN0YXRlU2xpY2UpKTtcbiAgICAgICAgICAgIHVwZGF0ZUZ1bmMoY29tcG9uZW50UHJvcHMpO1xuICAgICAgICAgICAgcHJldmlvdXNTdGF0ZVNsaWNlID0gc3RhdGVTbGljZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gb25Vbk1vdW50KCgpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmVyKCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNvbXBvc2Uoc3Vic2NyaWJlLCB1bnN1YnNjcmliZSkod3JhcHBlckNvbXApO1xuICAgIH07XG4gIH07XG59OyIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBvaW50ZXIgKHBhdGgpIHtcblxuICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblxuICBmdW5jdGlvbiBwYXJ0aWFsIChvYmogPSB7fSwgcGFydHMgPSBbXSkge1xuICAgIGNvbnN0IHAgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgcmV0dXJuIChjdXJyZW50ID09PSB1bmRlZmluZWQgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHRhcmdldCwgbmV3VHJlZSkge1xuICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgIGNvbnN0IFtsZWFmLCAuLi5pbnRlcm1lZGlhdGVdID0gcGFydHMucmV2ZXJzZSgpO1xuICAgIGZvciAobGV0IGtleSBvZiBpbnRlcm1lZGlhdGUucmV2ZXJzZSgpKSB7XG4gICAgICBpZiAoY3VycmVudFtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGN1cnJlbnRbbGVhZl0gPSBPYmplY3QuYXNzaWduKGN1cnJlbnRbbGVhZl0gfHwge30sIG5ld1RyZWUpO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldCh0YXJnZXQpe1xuICAgICAgcmV0dXJuIHBhcnRpYWwodGFyZ2V0LCBbLi4ucGFydHNdKVxuICAgIH0sXG4gICAgc2V0XG4gIH1cbn07XG4iLCJpbXBvcnQge3N3YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5cbmZ1bmN0aW9uIHNvcnRCeVByb3BlcnR5IChwcm9wKSB7XG4gIGNvbnN0IHByb3BHZXR0ZXIgPSBwb2ludGVyKHByb3ApLmdldDtcbiAgcmV0dXJuIChhLCBiKSA9PiB7XG4gICAgY29uc3QgYVZhbCA9IHByb3BHZXR0ZXIoYSk7XG4gICAgY29uc3QgYlZhbCA9IHByb3BHZXR0ZXIoYik7XG5cbiAgICBpZiAoYVZhbCA9PT0gYlZhbCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgaWYgKGJWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGlmIChhVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiBhVmFsIDwgYlZhbCA/IC0xIDogMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzb3J0RmFjdG9yeSAoe3BvaW50ZXIsIGRpcmVjdGlvbn0gPSB7fSkge1xuICBpZiAoIXBvaW50ZXIgfHwgZGlyZWN0aW9uID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gWy4uLmFycmF5XTtcbiAgfVxuXG4gIGNvbnN0IG9yZGVyRnVuYyA9IHNvcnRCeVByb3BlcnR5KHBvaW50ZXIpO1xuICBjb25zdCBjb21wYXJlRnVuYyA9IGRpcmVjdGlvbiA9PT0gJ2Rlc2MnID8gc3dhcChvcmRlckZ1bmMpIDogb3JkZXJGdW5jO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IFsuLi5hcnJheV0uc29ydChjb21wYXJlRnVuYyk7XG59IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZnVuY3Rpb24gdHlwZUV4cHJlc3Npb24gKHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gQm9vbGVhbjtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICBjYXNlICdkYXRlJzpcbiAgICAgIHJldHVybiAodmFsKSA9PiBuZXcgRGF0ZSh2YWwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsICh2YWwpID0+IHZhbC50b0xvd2VyQ2FzZSgpKTtcbiAgfVxufVxuXG5jb25zdCBvcGVyYXRvcnMgPSB7XG4gIGluY2x1ZGVzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dC5pbmNsdWRlcyh2YWx1ZSk7XG4gIH0sXG4gIGlzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgaXNOb3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+ICFPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgbHQodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDwgdmFsdWU7XG4gIH0sXG4gIGd0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+IHZhbHVlO1xuICB9LFxuICBsdGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDw9IHZhbHVlO1xuICB9LFxuICBndGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID49IHZhbHVlO1xuICB9LFxuICBlcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlID09IGlucHV0O1xuICB9LFxuICBub3RFcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlICE9IGlucHV0O1xuICB9XG59O1xuXG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByZWRpY2F0ZSAoe3ZhbHVlID0gJycsIG9wZXJhdG9yID0gJ2luY2x1ZGVzJywgdHlwZSA9ICdzdHJpbmcnfSkge1xuICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgY29uc3Qgb3BlcmF0ZU9uVHlwZWQgPSBjb21wb3NlKHR5cGVJdCwgb3BlcmF0b3JzW29wZXJhdG9yXSk7XG4gIGNvbnN0IHByZWRpY2F0ZUZ1bmMgPSBvcGVyYXRlT25UeXBlZCh2YWx1ZSk7XG4gIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59XG5cbi8vYXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5mdW5jdGlvbiBub3JtYWxpemVDbGF1c2VzIChjb25mKSB7XG4gIGNvbnN0IG91dHB1dCA9IHt9O1xuICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgdmFsaWRQYXRoLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgaWYgKHZhbGlkQ2xhdXNlcy5sZW5ndGgpIHtcbiAgICAgIG91dHB1dFtwYXRoXSA9IHZhbGlkQ2xhdXNlcztcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaWx0ZXIgKGZpbHRlcikge1xuICBjb25zdCBub3JtYWxpemVkQ2xhdXNlcyA9IG5vcm1hbGl6ZUNsYXVzZXMoZmlsdGVyKTtcbiAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgIGNvbnN0IGdldHRlciA9IHBvaW50ZXIocGF0aCkuZ2V0O1xuICAgIGNvbnN0IGNsYXVzZXMgPSBub3JtYWxpemVkQ2xhdXNlc1twYXRoXS5tYXAocHJlZGljYXRlKTtcbiAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgfSk7XG4gIGNvbnN0IGZpbHRlclByZWRpY2F0ZSA9IGV2ZXJ5KGZ1bmNMaXN0KTtcblxuICByZXR1cm4gKGFycmF5KSA9PiBhcnJheS5maWx0ZXIoZmlsdGVyUHJlZGljYXRlKTtcbn0iLCJpbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc2VhcmNoQ29uZiA9IHt9KSB7XG4gIGNvbnN0IHt2YWx1ZSwgc2NvcGUgPSBbXX0gPSBzZWFyY2hDb25mO1xuICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICBpZiAoIXNjb3BlLmxlbmd0aCB8fCAhdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiBTdHJpbmcocChpdGVtKSkuaW5jbHVkZXMoU3RyaW5nKHZhbHVlKSkpKVxuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2xpY2VGYWN0b3J5ICh7cGFnZSA9IDEsIHNpemV9ID0ge30pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHNsaWNlRnVuY3Rpb24gKGFycmF5ID0gW10pIHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZW1pdHRlciAoKSB7XG5cbiAgY29uc3QgbGlzdGVuZXJzTGlzdHMgPSB7fTtcbiAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgb24oZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSAobGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdKS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIGRpc3BhdGNoKGV2ZW50LCAuLi5hcmdzKXtcbiAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIG9mZihldmVudCwgLi4ubGlzdGVuZXJzKXtcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgT2JqZWN0LmtleXMobGlzdGVuZXJzTGlzdHMpLmZvckVhY2goZXYgPT4gaW5zdGFuY2Uub2ZmKGV2KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSBsaXN0ZW5lcnMubGVuZ3RoID8gbGlzdC5maWx0ZXIobGlzdGVuZXIgPT4gIWxpc3RlbmVycy5pbmNsdWRlcyhsaXN0ZW5lcikpIDogW107XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuICB9O1xuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm94eUxpc3RlbmVyIChldmVudE1hcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHtlbWl0dGVyfSkge1xuXG4gICAgY29uc3QgcHJveHkgPSB7fTtcbiAgICBsZXQgZXZlbnRMaXN0ZW5lcnMgPSB7fTtcblxuICAgIGZvciAobGV0IGV2IG9mIE9iamVjdC5rZXlzKGV2ZW50TWFwKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gZXZlbnRNYXBbZXZdO1xuICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICBwcm94eVttZXRob2RdID0gZnVuY3Rpb24gKC4uLmxpc3RlbmVycykge1xuICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgIGVtaXR0ZXIub24oZXYsIC4uLmxpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJveHksIHtcbiAgICAgIG9mZihldil7XG4gICAgICAgIGlmICghZXYpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhldmVudExpc3RlbmVycykuZm9yRWFjaChldmVudE5hbWUgPT4gcHJveHkub2ZmKGV2ZW50TmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudExpc3RlbmVyc1tldl0pIHtcbiAgICAgICAgICBlbWl0dGVyLm9mZihldiwgLi4uZXZlbnRMaXN0ZW5lcnNbZXZdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgVE9HR0xFX1NPUlQgPSAnVE9HR0xFX1NPUlQnO1xuZXhwb3J0IGNvbnN0IERJU1BMQVlfQ0hBTkdFRCA9ICdESVNQTEFZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFBBR0VfQ0hBTkdFRCA9ICdDSEFOR0VfUEFHRSc7XG5leHBvcnQgY29uc3QgRVhFQ19DSEFOR0VEID0gJ0VYRUNfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRklMVEVSX0NIQU5HRUQgPSAnRklMVEVSX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNVTU1BUllfQ0hBTkdFRCA9ICdTVU1NQVJZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNFQVJDSF9DSEFOR0VEID0gJ1NFQVJDSF9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBFWEVDX0VSUk9SID0gJ0VYRUNfRVJST1InOyIsImltcG9ydCBzbGljZSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge2N1cnJ5LCB0YXAsIGNvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtlbWl0dGVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHNsaWNlRmFjdG9yeSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge1xuICBTVU1NQVJZX0NIQU5HRUQsXG4gIFRPR0dMRV9TT1JULFxuICBESVNQTEFZX0NIQU5HRUQsXG4gIFBBR0VfQ0hBTkdFRCxcbiAgRVhFQ19DSEFOR0VELFxuICBGSUxURVJfQ0hBTkdFRCxcbiAgU0VBUkNIX0NIQU5HRUQsXG4gIEVYRUNfRVJST1Jcbn0gZnJvbSAnLi4vZXZlbnRzJztcblxuZnVuY3Rpb24gY3VycmllZFBvaW50ZXIgKHBhdGgpIHtcbiAgY29uc3Qge2dldCwgc2V0fSA9IHBvaW50ZXIocGF0aCk7XG4gIHJldHVybiB7Z2V0LCBzZXQ6IGN1cnJ5KHNldCl9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSxcbiAgdGFibGVTdGF0ZSxcbiAgZGF0YSxcbiAgZmlsdGVyRmFjdG9yeSxcbiAgc2VhcmNoRmFjdG9yeVxufSkge1xuICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgY29uc3Qgc29ydFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc29ydCcpO1xuICBjb25zdCBzbGljZVBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2xpY2UnKTtcbiAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzZWFyY2gnKTtcblxuICBjb25zdCBzYWZlQXNzaWduID0gY3VycnkoKGJhc2UsIGV4dGVuc2lvbikgPT4gT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwgZXh0ZW5zaW9uKSk7XG4gIGNvbnN0IGRpc3BhdGNoID0gY3VycnkodGFibGUuZGlzcGF0Y2guYmluZCh0YWJsZSksIDIpO1xuXG4gIGNvbnN0IGRpc3BhdGNoU3VtbWFyeSA9IChmaWx0ZXJlZCkgPT4ge1xuICAgIGRpc3BhdGNoKFNVTU1BUllfQ0hBTkdFRCwge1xuICAgICAgcGFnZTogdGFibGVTdGF0ZS5zbGljZS5wYWdlLFxuICAgICAgc2l6ZTogdGFibGVTdGF0ZS5zbGljZS5zaXplLFxuICAgICAgZmlsdGVyZWRDb3VudDogZmlsdGVyZWQubGVuZ3RoXG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgZXhlYyA9ICh7cHJvY2Vzc2luZ0RlbGF5ID0gMjB9ID0ge30pID0+IHtcbiAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiB0cnVlfSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCB0YXAoZGlzcGF0Y2hTdW1tYXJ5KSwgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChESVNQTEFZX0NIQU5HRUQsIGRpc3BsYXllZC5tYXAoZCA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH07XG4gICAgICAgIH0pKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19FUlJPUiwgZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH0sIHByb2Nlc3NpbmdEZWxheSk7XG4gIH07XG5cbiAgY29uc3QgdXBkYXRlVGFibGVTdGF0ZSA9IGN1cnJ5KChwdGVyLCBldiwgbmV3UGFydGlhbFN0YXRlKSA9PiBjb21wb3NlKFxuICAgIHNhZmVBc3NpZ24ocHRlci5nZXQodGFibGVTdGF0ZSkpLFxuICAgIHRhcChkaXNwYXRjaChldikpLFxuICAgIHB0ZXIuc2V0KHRhYmxlU3RhdGUpXG4gICkobmV3UGFydGlhbFN0YXRlKSk7XG5cbiAgY29uc3QgcmVzZXRUb0ZpcnN0UGFnZSA9ICgpID0+IHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQsIHtwYWdlOiAxfSk7XG5cbiAgY29uc3QgdGFibGVPcGVyYXRpb24gPSAocHRlciwgZXYpID0+IGNvbXBvc2UoXG4gICAgdXBkYXRlVGFibGVTdGF0ZShwdGVyLCBldiksXG4gICAgcmVzZXRUb0ZpcnN0UGFnZSxcbiAgICAoKSA9PiB0YWJsZS5leGVjKCkgLy8gd2Ugd3JhcCB3aXRoaW4gYSBmdW5jdGlvbiBzbyB0YWJsZS5leGVjIGNhbiBiZSBvdmVyd3JpdHRlbiAod2hlbiB1c2luZyB3aXRoIGEgc2VydmVyIGZvciBleGFtcGxlKVxuICApO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzb3J0OiB0YWJsZU9wZXJhdGlvbihzb3J0UG9pbnRlciwgVE9HR0xFX1NPUlQpLFxuICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgRklMVEVSX0NIQU5HRUQpLFxuICAgIHNlYXJjaDogdGFibGVPcGVyYXRpb24oc2VhcmNoUG9pbnRlciwgU0VBUkNIX0NIQU5HRUQpLFxuICAgIHNsaWNlOiBjb21wb3NlKHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQpLCAoKSA9PiB0YWJsZS5leGVjKCkpLFxuICAgIGV4ZWMsXG4gICAgZXZhbChzdGF0ZSA9IHRhYmxlU3RhdGUpe1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgICByZXR1cm4gZXhlY0Z1bmMoZGF0YSkubWFwKGQgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBvbkRpc3BsYXlDaGFuZ2UoZm4pe1xuICAgICAgdGFibGUub24oRElTUExBWV9DSEFOR0VELCBmbik7XG4gICAgfSxcbiAgICBnZXRUYWJsZVN0YXRlKCl7XG4gICAgICBjb25zdCBzb3J0ID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zb3J0KTtcbiAgICAgIGNvbnN0IHNlYXJjaCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2VhcmNoKTtcbiAgICAgIGNvbnN0IHNsaWNlID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zbGljZSk7XG4gICAgICBjb25zdCBmaWx0ZXIgPSB7fTtcbiAgICAgIGZvciAobGV0IHByb3AgaW4gdGFibGVTdGF0ZS5maWx0ZXIpIHtcbiAgICAgICAgZmlsdGVyW3Byb3BdID0gdGFibGVTdGF0ZS5maWx0ZXJbcHJvcF0ubWFwKHYgPT4gT2JqZWN0LmFzc2lnbih7fSwgdikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtzb3J0LCBzZWFyY2gsIHNsaWNlLCBmaWx0ZXJ9O1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBpbnN0YW5jZSA9IE9iamVjdC5hc3NpZ24odGFibGUsIGFwaSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGRhdGEubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCBzb3J0IGZyb20gJ3NtYXJ0LXRhYmxlLXNvcnQnO1xuaW1wb3J0IGZpbHRlciBmcm9tICdzbWFydC10YWJsZS1maWx0ZXInO1xuaW1wb3J0IHNlYXJjaCBmcm9tICdzbWFydC10YWJsZS1zZWFyY2gnO1xuaW1wb3J0IHRhYmxlIGZyb20gJy4vZGlyZWN0aXZlcy90YWJsZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7XG4gIHNvcnRGYWN0b3J5ID0gc29ydCxcbiAgZmlsdGVyRmFjdG9yeSA9IGZpbHRlcixcbiAgc2VhcmNoRmFjdG9yeSA9IHNlYXJjaCxcbiAgdGFibGVTdGF0ZSA9IHtzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxfSwgZmlsdGVyOiB7fSwgc2VhcmNoOiB7fX0sXG4gIGRhdGEgPSBbXVxufSwgLi4udGFibGVEaXJlY3RpdmVzKSB7XG5cbiAgY29uc3QgY29yZVRhYmxlID0gdGFibGUoe3NvcnRGYWN0b3J5LCBmaWx0ZXJGYWN0b3J5LCB0YWJsZVN0YXRlLCBkYXRhLCBzZWFyY2hGYWN0b3J5fSk7XG5cbiAgcmV0dXJuIHRhYmxlRGlyZWN0aXZlcy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBuZXdkaXIpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihhY2N1bXVsYXRvciwgbmV3ZGlyKHtcbiAgICAgIHNvcnRGYWN0b3J5LFxuICAgICAgZmlsdGVyRmFjdG9yeSxcbiAgICAgIHNlYXJjaEZhY3RvcnksXG4gICAgICB0YWJsZVN0YXRlLFxuICAgICAgZGF0YSxcbiAgICAgIHRhYmxlOiBjb3JlVGFibGVcbiAgICB9KSk7XG4gIH0sIGNvcmVUYWJsZSk7XG59IiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuZXhwb3J0IGNvbnN0IGdldCA9IGN1cnJ5KChhcnJheSwgaW5kZXgpID0+IGFycmF5W2luZGV4XSk7XG5leHBvcnQgY29uc3QgcmVwbGFjZSA9IGN1cnJ5KChhcnJheSwgbmV3VmFsLCBpbmRleCkgPT4gYXJyYXkubWFwKCh2YWwsIGkpID0+IChpbmRleCA9PT0gaSApID8gbmV3VmFsIDogdmFsKSk7XG5leHBvcnQgY29uc3QgcGF0Y2ggPSBjdXJyeSgoYXJyYXksIG5ld1ZhbCwgaW5kZXgpID0+IHJlcGxhY2UoYXJyYXksIE9iamVjdC5hc3NpZ24oYXJyYXlbaW5kZXhdLCBuZXdWYWwpLCBpbmRleCkpO1xuZXhwb3J0IGNvbnN0IHJlbW92ZSA9IGN1cnJ5KChhcnJheSwgaW5kZXgpID0+IGFycmF5LmZpbHRlcigodmFsLCBpKSA9PiBpbmRleCAhPT0gaSkpO1xuZXhwb3J0IGNvbnN0IGluc2VydCA9IGN1cnJ5KChhcnJheSwgbmV3VmFsLCBpbmRleCkgPT4gWy4uLmFycmF5LnNsaWNlKDAsIGluZGV4KSwgbmV3VmFsLCAuLi5hcnJheS5zbGljZShpbmRleCldKTsiLCJpbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQge2dldCwgcmVwbGFjZSwgcGF0Y2gsIHJlbW92ZSwgaW5zZXJ0fSBmcm9tICcuL2NydWQnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2RhdGEsIHRhYmxlfSkge1xuICAvLyBlbXB0eSBhbmQgcmVmaWxsIGRhdGEga2VlcGluZyB0aGUgc2FtZSByZWZlcmVuY2VcbiAgY29uc3QgbXV0YXRlRGF0YSA9IChuZXdEYXRhKSA9PiB7XG4gICAgZGF0YS5zcGxpY2UoMCk7XG4gICAgZGF0YS5wdXNoKC4uLm5ld0RhdGEpO1xuICB9O1xuICBjb25zdCByZWZyZXNoID0gY29tcG9zZShtdXRhdGVEYXRhLCB0YWJsZS5leGVjKTtcbiAgcmV0dXJuIHtcbiAgICB1cGRhdGUoaW5kZXgsbmV3VmFsKXtcbiAgICAgIHJldHVybiBjb21wb3NlKHJlcGxhY2UoZGF0YSxuZXdWYWwpLHJlZnJlc2gpKGluZGV4KTtcbiAgICB9LFxuICAgIHBhdGNoKGluZGV4LCBuZXdWYWwpe1xuICAgICAgcmV0dXJuIHBhdGNoKGRhdGEsIG5ld1ZhbCwgaW5kZXgpO1xuICAgIH0sXG4gICAgcmVtb3ZlOiBjb21wb3NlKHJlbW92ZShkYXRhKSwgcmVmcmVzaCksXG4gICAgaW5zZXJ0KG5ld1ZhbCwgaW5kZXggPSAwKXtcbiAgICAgIHJldHVybiBjb21wb3NlKGluc2VydChkYXRhLCBuZXdWYWwpLCByZWZyZXNoKShpbmRleCk7XG4gICAgfSxcbiAgICBnZXQ6IGdldChkYXRhKVxuICB9O1xufSIsIi8vIGl0IGlzIGxpa2UgUmVkdXggYnV0IHVzaW5nIHNtYXJ0IHRhYmxlIHdoaWNoIGFscmVhZHkgYmVoYXZlcyBtb3JlIG9yIGxlc3MgbGlrZSBhIHN0b3JlIGFuZCBsaWtlIGEgcmVkdWNlciBpbiB0aGUgc2FtZSB0aW1lLlxuLy8gb2YgY291cnNlIHRoaXMgaW1wbCBpcyBiYXNpYzogZXJyb3IgaGFuZGxpbmcgZXRjIGFyZSBtaXNzaW5nIGFuZCByZWR1Y2VyIGlzIFwiaGFyZGNvZGVkXCJcbmNvbnN0IHJlZHVjZXJGYWN0b3J5ID0gZnVuY3Rpb24gKHNtYXJ0VGFibGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChzdGF0ZSA9IHtcbiAgICB0YWJsZVN0YXRlOiBzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKSxcbiAgICBkaXNwbGF5ZWQ6IFtdLFxuICAgIHN1bW1hcnk6IHt9LFxuICAgIGlzUHJvY2Vzc2luZzogZmFsc2VcbiAgfSwgYWN0aW9uKSB7XG4gICAgY29uc3Qge3R5cGUsIGFyZ3N9ID0gYWN0aW9uO1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSAnVE9HR0xFX0ZJTFRFUic6IHtcbiAgICAgICAgY29uc3Qge2ZpbHRlcn0gPSBhY3Rpb247XG4gICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZSwge2FjdGl2ZUZpbHRlcjogZmlsdGVyfSk7XG4gICAgICB9XG4gICAgICBkZWZhdWx0OiAvL3Byb3h5IHRvIHNtYXJ0IHRhYmxlXG4gICAgICAgIGlmIChzbWFydFRhYmxlW3R5cGVdKSB7XG4gICAgICAgICAgc21hcnRUYWJsZVt0eXBlXSguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxuICB9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3RvcmUgKHNtYXJ0VGFibGUpIHtcblxuICBjb25zdCByZWR1Y2VyID0gcmVkdWNlckZhY3Rvcnkoc21hcnRUYWJsZSk7XG5cbiAgbGV0IGN1cnJlbnRTdGF0ZSA9IHtcbiAgICB0YWJsZVN0YXRlOiBzbWFydFRhYmxlLmdldFRhYmxlU3RhdGUoKVxuICB9O1xuICBsZXQgc3VtbWFyeTtcbiAgbGV0IGxpc3RlbmVycyA9IFtdO1xuXG4gIGNvbnN0IGJyb2FkY2FzdCA9ICgpID0+IHtcbiAgICBmb3IgKGxldCBsIG9mIGxpc3RlbmVycykge1xuICAgICAgbCgpO1xuICAgIH1cbiAgfTtcblxuICBzbWFydFRhYmxlLm9uKCdTVU1NQVJZX0NIQU5HRUQnLCBmdW5jdGlvbiAocykge1xuICAgIHN1bW1hcnkgPSBzO1xuICB9KTtcblxuICBzbWFydFRhYmxlLm9uKCdFWEVDX0NIQU5HRUQnLCBmdW5jdGlvbiAoe3dvcmtpbmd9KSB7XG4gICAgT2JqZWN0LmFzc2lnbihjdXJyZW50U3RhdGUsIHtcbiAgICAgIGlzUHJvY2Vzc2luZzogd29ya2luZ1xuICAgIH0pO1xuICAgIGJyb2FkY2FzdCgpO1xuICB9KTtcblxuICBzbWFydFRhYmxlLm9uRGlzcGxheUNoYW5nZShmdW5jdGlvbiAoZGlzcGxheWVkKSB7XG4gICAgT2JqZWN0LmFzc2lnbihjdXJyZW50U3RhdGUsIHtcbiAgICAgIHRhYmxlU3RhdGU6IHNtYXJ0VGFibGUuZ2V0VGFibGVTdGF0ZSgpLFxuICAgICAgZGlzcGxheWVkLFxuICAgICAgc3VtbWFyeVxuICAgIH0pO1xuICAgIGJyb2FkY2FzdCgpO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHN1YnNjcmliZShsaXN0ZW5lcil7XG4gICAgICBsaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuZmlsdGVyKGwgPT4gbCAhPT0gbGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0U3RhdGUoKXtcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBjdXJyZW50U3RhdGUsIHt0YWJsZVN0YXRlOnNtYXJ0VGFibGUuZ2V0VGFibGVTdGF0ZSgpfSk7XG4gICAgfSxcbiAgICBkaXNwYXRjaChhY3Rpb24gPSB7fSl7XG4gICAgICBjdXJyZW50U3RhdGUgPSByZWR1Y2VyKGN1cnJlbnRTdGF0ZSwgYWN0aW9uKTtcbiAgICAgIGlmIChhY3Rpb24udHlwZSAmJiAhc21hcnRUYWJsZVthY3Rpb24udHlwZV0pIHtcbiAgICAgICAgYnJvYWRjYXN0KCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufSIsImltcG9ydCB7ZGVmYXVsdCBhcyBzbWFydFRhYmxlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcbmltcG9ydCBjcnVkIGZyb20gJ3NtYXJ0LXRhYmxlLWNydWQnO1xuaW1wb3J0IHtjcmVhdGVTdG9yZX0gZnJvbSAnLi9yZWR1eFNtYXJ0VGFibGUnO1xuXG4vL2RhdGEgY29taW5nIGZyb20gZ2xvYmFsXG5jb25zdCB0YWJsZVN0YXRlID0ge3NlYXJjaDoge30sIGZpbHRlcjoge30sIHNvcnQ6IHt9LCBzbGljZToge3BhZ2U6IDEsIHNpemU6IDIwfX07XG4vL3RoZSBzbWFydCB0YWJsZVxuY29uc3QgdGFibGUgPSBzbWFydFRhYmxlKHtkYXRhLCB0YWJsZVN0YXRlfSwgY3J1ZCk7XG4vL3RoZSBzdG9yZVxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlU3RvcmUodGFibGUpO1xuIiwiZXhwb3J0IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgZGVsYXkgPSAzMDApIHtcbiAgbGV0IHRpbWVvdXRJZDtcbiAgcmV0dXJuIChldikgPT4ge1xuICAgIGlmICh0aW1lb3V0SWQpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICB9XG4gICAgdGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgZm4oZXYpO1xuICAgIH0sIGRlbGF5KTtcbiAgfTtcbn0iLCJpbXBvcnQge2gsIG9uTW91bnR9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcblxuXG5leHBvcnQgY29uc3QgYXV0b0ZvY3VzID0gb25Nb3VudChuID0+IG4uZG9tLmZvY3VzKCkpO1xuZXhwb3J0IGNvbnN0IElucHV0ID0gYXV0b0ZvY3VzKHByb3BzID0+IHtcbiAgZGVsZXRlICBwcm9wcy5jaGlsZHJlbjsgLy9ubyBjaGlsZHJlbiBmb3IgaW5wdXRzXG4gIHJldHVybiA8aW5wdXQgey4uLnByb3BzfSAvPlxufSk7IiwiaW1wb3J0IHtoLCB3aXRoU3RhdGUsIG9uTW91bnR9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVyJztcbmltcG9ydCB7SW5wdXQsIGF1dG9Gb2N1c30gZnJvbSAnLi9pbnB1dHMnO1xuXG5jb25zdCBJbnB1dENlbGwgPSAocHJvcHMpID0+IChcbiAgPHRkIG9uQ2xpY2s9e3Byb3BzLnRvZ2dsZUVkaXQodHJ1ZSl9IGNsYXNzPXtwcm9wcy5jbGFzc05hbWV9PlxuICAgIHtcbiAgICAgIHByb3BzLmlzRWRpdGluZyA9PT0gJ3RydWUnID9cbiAgICAgICAgPElucHV0IHR5cGU9e3Byb3BzLnR5cGUgfHwgJ3RleHQnfSB2YWx1ZT17cHJvcHMuY3VycmVudFZhbHVlfSBvbklucHV0PXtwcm9wcy5vbklucHV0fVxuICAgICAgICAgICAgICAgb25CbHVyPXtwcm9wcy50b2dnbGVFZGl0KGZhbHNlKX0vPlxuICAgICAgICA6IDxzcGFuPntwcm9wcy5jdXJyZW50VmFsdWV9PC9zcGFuPlxuICAgIH1cbiAgPC90ZD5cbik7XG5cbmNvbnN0IG1ha2VFZGl0YWJsZSA9IGNvbXAgPT4ge1xuICByZXR1cm4gd2l0aFN0YXRlKChwcm9wcywgc2V0U3RhdGUpID0+IHtcbiAgICBjb25zdCB0b2dnbGVFZGl0ID0gKHZhbCkgPT4gKCkgPT4gc2V0U3RhdGUoT2JqZWN0LmFzc2lnbih7fSwgcHJvcHMsIHtpc0VkaXRpbmc6IHZhbCAhPT0gdW5kZWZpbmVkID8gdmFsIDogcHJvcHMuaXNFZGl0aW5nICE9PSB0cnVlfSkpO1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IHt0b2dnbGVFZGl0LCAuLi5wcm9wc307XG4gICAgcmV0dXJuIGNvbXAoZnVsbFByb3BzKTtcbiAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVMYXN0TmFtZSA9IG1ha2VFZGl0YWJsZSgocHJvcHMpID0+IHtcbiAgY29uc3Qge3RvZ2dsZUVkaXQsIHBlcnNvbiwgaW5kZXgsIGNsYXNzTmFtZSwgcGF0Y2gsIGlzRWRpdGluZ30gPSBwcm9wcztcbiAgbGV0IGN1cnJlbnRWYWx1ZSA9IHBlcnNvbi5uYW1lLmxhc3Q7XG4gIGNvbnN0IG9uSW5wdXQgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7bmFtZToge2xhc3Q6IGN1cnJlbnRWYWx1ZSwgZmlyc3Q6IHBlcnNvbi5uYW1lLmZpcnN0fX0pO1xuICB9KTtcblxuICByZXR1cm4gPElucHV0Q2VsbCBpc0VkaXRpbmc9e1N0cmluZyhpc0VkaXRpbmcgPT09IHRydWUpfSB0b2dnbGVFZGl0PXt0b2dnbGVFZGl0fSBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFZhbHVlPXtjdXJyZW50VmFsdWV9IG9uSW5wdXQ9e29uSW5wdXR9Lz5cbn0pO1xuXG5leHBvcnQgY29uc3QgRWRpdGFibGVGaXJzdE5hbWUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24ubmFtZS5maXJzdDtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtuYW1lOiB7Zmlyc3Q6IGN1cnJlbnRWYWx1ZSwgbGFzdDogcGVyc29uLm5hbWUubGFzdH19KTtcbiAgfSk7XG5cbiAgcmV0dXJuIDxJbnB1dENlbGwgaXNFZGl0aW5nPXtTdHJpbmcoaXNFZGl0aW5nID09PSB0cnVlKX0gdG9nZ2xlRWRpdD17dG9nZ2xlRWRpdH0gY2xhc3NOYW1lPXtjbGFzc05hbWV9XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRWYWx1ZT17Y3VycmVudFZhbHVlfSBvbklucHV0PXtvbklucHV0fS8+XG59KTtcblxuXG5jb25zdCBHZW5kZXJTZWxlY3QgPSBhdXRvRm9jdXMoKHtvbkNoYW5nZSwgdG9nZ2xlRWRpdCwgcGVyc29ufSkgPT4ge1xuICByZXR1cm4gPHNlbGVjdCBuYW1lPVwiZ2VuZGVyIHNlbGVjdFwiIG9uQ2hhbmdlPXtvbkNoYW5nZX0gb25CbHVyPXt0b2dnbGVFZGl0KGZhbHNlKX0+XG4gICAgPG9wdGlvbiB2YWx1ZT1cIm1hbGVcIiBzZWxlY3RlZD17cGVyc29uLmdlbmRlciA9PT0gJ21hbGUnfT5tYWxlPC9vcHRpb24+XG4gICAgPG9wdGlvbiB2YWx1ZT1cImZlbWFsZVwiIHNlbGVjdGVkPXtwZXJzb24uZ2VuZGVyID09PSAnZmVtYWxlJ30+ZmVtYWxlPC9vcHRpb24+XG4gIDwvc2VsZWN0PlxufSk7XG5cbmV4cG9ydCBjb25zdCBFZGl0YWJsZUdlbmRlciA9IG1ha2VFZGl0YWJsZSgocHJvcHMpID0+IHtcbiAgY29uc3Qge3RvZ2dsZUVkaXQsIHBlcnNvbiwgaW5kZXgsIGNsYXNzTmFtZSwgcGF0Y2gsIGlzRWRpdGluZ30gPSBwcm9wcztcbiAgbGV0IGN1cnJlbnRWYWx1ZSA9IHBlcnNvbi5nZW5kZXI7XG5cbiAgY29uc3Qgb25DaGFuZ2UgPSBkZWJvdW5jZShldiA9PiB7XG4gICAgY3VycmVudFZhbHVlID0gZXYudGFyZ2V0LnZhbHVlO1xuICAgIHBhdGNoKGluZGV4LCB7Z2VuZGVyOiBjdXJyZW50VmFsdWV9KTtcbiAgfSk7XG4gIGNvbnN0IGdlbmRlckNsYXNzID0gcGVyc29uLmdlbmRlciA9PT0gJ2ZlbWFsZScgPyAnZ2VuZGVyLWZlbWFsZScgOiAnZ2VuZGVyLW1hbGUnO1xuXG4gIHJldHVybiA8dGQgb25DbGljaz17dG9nZ2xlRWRpdCh0cnVlKX0gY2xhc3M9e2NsYXNzTmFtZX0+XG4gICAge1xuICAgICAgaXNFZGl0aW5nID8gPEdlbmRlclNlbGVjdCBvbkNoYW5nZT17b25DaGFuZ2V9IHRvZ2dsZUVkaXQ9e3RvZ2dsZUVkaXR9IHBlcnNvbj17cGVyc29ufS8+IDpcbiAgICAgICAgPHNwYW4gY2xhc3M9e2dlbmRlckNsYXNzfT57Y3VycmVudFZhbHVlfTwvc3Bhbj5cbiAgICB9XG4gIDwvdGQ+O1xufSk7XG5cbmV4cG9ydCBjb25zdCBFZGl0YWJsZVNpemUgPSBtYWtlRWRpdGFibGUoKHByb3BzKSA9PiB7XG4gIGNvbnN0IHt0b2dnbGVFZGl0LCBwZXJzb24sIGluZGV4LCBjbGFzc05hbWUsIHBhdGNoLCBpc0VkaXRpbmd9ID0gcHJvcHM7XG4gIGxldCBjdXJyZW50VmFsdWUgPSBwZXJzb24uc2l6ZTtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtzaXplOiBjdXJyZW50VmFsdWV9KTtcbiAgfSk7XG4gIGNvbnN0IHJhdGlvID0gTWF0aC5taW4oKHBlcnNvbi5zaXplIC0gMTUwKSAvIDUwLCAxKSAqIDEwMDtcblxuICByZXR1cm4gPHRkIGNsYXNzPXtjbGFzc05hbWV9IG9uQ2xpY2s9e3RvZ2dsZUVkaXQodHJ1ZSl9PlxuICAgIHtcbiAgICAgIGlzRWRpdGluZyA/IDxJbnB1dCB0eXBlPVwibnVtYmVyXCIgbWluPVwiMTUwXCIgbWF4PVwiMjAwXCIgdmFsdWU9e2N1cnJlbnRWYWx1ZX0gb25CbHVyPXt0b2dnbGVFZGl0KGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICBvbklucHV0PXtvbklucHV0fS8+IDpcbiAgICAgICAgPHNwYW4+PHNwYW4gc3R5bGU9e2BoZWlnaHQ6ICR7cmF0aW99JWB9IGNsYXNzPVwic2l6ZS1zdGlja1wiPjwvc3Bhbj57Y3VycmVudFZhbHVlfTwvc3Bhbj5cbiAgICB9XG4gIDwvdGQ+O1xufSk7XG5cbmV4cG9ydCBjb25zdCBFZGl0YWJsZUJpcnRoRGF0ZSA9IG1ha2VFZGl0YWJsZSgocHJvcHMpID0+IHtcbiAgY29uc3Qge3RvZ2dsZUVkaXQsIHBlcnNvbiwgaW5kZXgsIGNsYXNzTmFtZSwgcGF0Y2gsIGlzRWRpdGluZ30gPSBwcm9wcztcbiAgbGV0IGN1cnJlbnRWYWx1ZSA9IHBlcnNvbi5iaXJ0aERhdGU7XG5cbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IHtcbiAgICBjdXJyZW50VmFsdWUgPSBldi50YXJnZXQudmFsdWU7XG4gICAgcGF0Y2goaW5kZXgsIHtiaXJ0aERhdGU6IG5ldyBEYXRlKGN1cnJlbnRWYWx1ZSl9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIDxJbnB1dENlbGwgdHlwZT1cImRhdGVcIiBpc0VkaXRpbmc9e1N0cmluZyhpc0VkaXRpbmcgPT09IHRydWUpfSB0b2dnbGVFZGl0PXt0b2dnbGVFZGl0fSBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFZhbHVlPXtjdXJyZW50VmFsdWUudG9EYXRlU3RyaW5nKCl9IG9uSW5wdXQ9e29uSW5wdXR9Lz5cbn0pO1xuIiwiaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5pbXBvcnQge2Nvbm5lY3QsIGh9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCB7RWRpdGFibGVMYXN0TmFtZSwgRWRpdGFibGVCaXJ0aERhdGUsIEVkaXRhYmxlU2l6ZSwgRWRpdGFibGVHZW5kZXIsIEVkaXRhYmxlRmlyc3ROYW1lfSBmcm9tICcuL2VkaXRhYmxlQ2VsbCc7XG5cblxuY29uc3QgbWFwU3RhdGVUb1Byb3AgPSBzdGF0ZSA9PiAoe3BlcnNvbnM6IHN0YXRlfSk7XG5jb25zdCBkb2VzVXBkYXRlTGlzdCA9IChwcmV2aW91cywgY3VycmVudCkgPT4ge1xuICBsZXQgb3V0cHV0ID0gdHJ1ZTtcbiAgaWYgKHR5cGVvZiBwcmV2aW91cyA9PT0gdHlwZW9mIGN1cnJlbnQpIHtcbiAgICBvdXRwdXQgPSBwcmV2aW91cy5sZW5ndGggIT09IGN1cnJlbnQubGVuZ3RoIHx8IHByZXZpb3VzLnNvbWUoKGksIGspID0+IHByZXZpb3VzW2tdLnZhbHVlLmlkICE9PSBjdXJyZW50W2tdLnZhbHVlLmlkKTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBzdGF0ZSA9PiBzdGF0ZS5kaXNwbGF5ZWQ7XG5jb25zdCBhY3Rpb25zID0ge1xuICByZW1vdmU6IGluZGV4ID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAncmVtb3ZlJywgYXJnczogW2luZGV4XX0pLFxuICBwYXRjaDogKGluZGV4LCB2YWx1ZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdwYXRjaCcsIGFyZ3M6IFtpbmRleCwgdmFsdWVdfSlcbn07XG5jb25zdCBzdWJzY3JpYmVUb0Rpc3BsYXkgPSBjb25uZWN0KHN0b3JlLCBhY3Rpb25zLCBzbGljZVN0YXRlKTtcblxuY29uc3QgVEJvZHkgPSAoe3BlcnNvbnMgPSBbXSwgcGF0Y2gsIHJlbW92ZX0pID0+IHtcbiAgcmV0dXJuIDx0Ym9keT5cbiAge1xuICAgIHBlcnNvbnMubWFwKCh7dmFsdWUsIGluZGV4fSkgPT4gPHRyPlxuICAgICAgPEVkaXRhYmxlTGFzdE5hbWUgY2xhc3NOYW1lPVwiY29sLWxhc3RuYW1lXCIgcGVyc29uPXt2YWx1ZX0gaW5kZXg9e2luZGV4fSBwYXRjaD17cGF0Y2h9Lz5cbiAgICAgIDxFZGl0YWJsZUZpcnN0TmFtZSBjbGFzc05hbWU9XCJjb2wtZmlyc3RuYW1lXCIgcGVyc29uPXt2YWx1ZX0gaW5kZXg9e2luZGV4fSBwYXRjaD17cGF0Y2h9Lz5cbiAgICAgIDxFZGl0YWJsZUJpcnRoRGF0ZSBjbGFzc05hbWU9XCJjb2wtYmlydGhkYXRlXCIgcGVyc29uPXt2YWx1ZX0gaW5kZXg9e2luZGV4fSBwYXRjaD17cGF0Y2h9Lz5cbiAgICAgIDxFZGl0YWJsZUdlbmRlciBjbGFzc05hbWU9XCJjb2wtZ2VuZGVyIGZpeGVkLXNpemVcIiBwZXJzb249e3ZhbHVlfSBpbmRleD17aW5kZXh9IHBhdGNoPXtwYXRjaH0vPlxuICAgICAgPEVkaXRhYmxlU2l6ZSBjbGFzc05hbWU9XCJjb2wtc2l6ZSBmaXhlZC1zaXplXCIgcGVyc29uPXt2YWx1ZX0gaW5kZXg9e2luZGV4fSBwYXRjaD17cGF0Y2h9Lz5cbiAgICAgIDx0ZCBjbGFzcz1cImZpeGVkLXNpemUgY29sLWFjdGlvbnNcIj5cbiAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiByZW1vdmUoaW5kZXgpfT5SXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC90ZD5cbiAgICA8L3RyPilcbiAgfVxuICA8L3Rib2R5PlxufTtcblxuY29uc3QgUGVyc29uTGlzdENvbXBvbmVudCA9IChwcm9wcywgYWN0aW9ucykgPT4ge1xuICByZXR1cm4gPFRCb2R5IHBlcnNvbnM9e3Byb3BzLnBlcnNvbnN9IHJlbW92ZT17YWN0aW9ucy5yZW1vdmV9XG4gICAgICAgICAgICAgICAgcGF0Y2g9e2FjdGlvbnMucGF0Y2h9Lz5cbn07XG5cblxuZXhwb3J0IGNvbnN0IFBlcnNvbkxpc3QgPSBzdWJzY3JpYmVUb0Rpc3BsYXkoUGVyc29uTGlzdENvbXBvbmVudCwgbWFwU3RhdGVUb1Byb3AsIGRvZXNVcGRhdGVMaXN0KTtcbiIsImltcG9ydCB7aCwgY29ubmVjdH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHN0b3JlIGZyb20gJy4uL2xpYi9zdG9yZSc7XG5cblxuY29uc3QgYWN0aW9ucyA9IHt9O1xuY29uc3Qgc2xpY2VTdGF0ZSA9IHN0YXRlID0+ICh7aXNQcm9jZXNzaW5nOiBzdGF0ZS5pc1Byb2Nlc3Npbmd9KTtcbmNvbnN0IHN1YnNjcmliZVRvUHJvY2Vzc2luZyA9IGNvbm5lY3Qoc3RvcmUsIGFjdGlvbnMsIHNsaWNlU3RhdGUpO1xuXG5jb25zdCBMb2FkaW5nSW5kaWNhdG9yID0gKHtpc1Byb2Nlc3Npbmd9KSA9PiB7XG4gIGNvbnN0IGNsYXNzTmFtZSA9IGlzUHJvY2Vzc2luZyA9PT0gdHJ1ZSA/ICdzdC13b3JraW5nJyA6ICcnO1xuICByZXR1cm4gPGRpdiBpZD1cIm92ZXJsYXlcIiBjbGFzcz17Y2xhc3NOYW1lfT5cbiAgICBQcm9jZXNzaW5nXG4gIDwvZGl2Pjtcbn07XG5leHBvcnQgY29uc3QgV29ya0luUHJvZ3Jlc3MgPSBzdWJzY3JpYmVUb1Byb2Nlc3NpbmcoTG9hZGluZ0luZGljYXRvcik7XG4iLCJpbXBvcnQge2gsIGNvbm5lY3R9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IGpzb24gZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuY29uc3QgYWN0aW9ucyA9IHtcbiAgdG9nZ2xlU29ydDogKHtwb2ludGVyLCBkaXJlY3Rpb259KSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3NvcnQnLCBhcmdzOiBbe3BvaW50ZXIsIGRpcmVjdGlvbn1dfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0ganNvbigndGFibGVTdGF0ZS5zb3J0JykuZ2V0O1xuY29uc3Qgc3Vic2NyaWJlVG9Tb3J0ID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cblxuY29uc3QgU29ydEJ1dHRvbkNvbXBvbmVudCA9IChwcm9wcyA9PiB7XG4gIGNvbnN0IHtjb2x1bW5Qb2ludGVyLCBzb3J0RGlyZWN0aW9ucyA9IFsnYXNjJywgJ2Rlc2MnXSwgcG9pbnRlciwgZGlyZWN0aW9uLCBzb3J0fSA9IHByb3BzO1xuICBjb25zdCBhY3R1YWxDdXJzb3IgPSBjb2x1bW5Qb2ludGVyICE9PSBwb2ludGVyID8gLTEgOiBzb3J0RGlyZWN0aW9ucy5pbmRleE9mKGRpcmVjdGlvbik7XG4gIGNvbnN0IG5ld0N1cnNvciA9IChhY3R1YWxDdXJzb3IgKyAxICkgJSBzb3J0RGlyZWN0aW9ucy5sZW5ndGg7XG4gIGNvbnN0IHRvZ2dsZVNvcnQgPSAoKSA9PiBzb3J0KHtwb2ludGVyOiBjb2x1bW5Qb2ludGVyLCBkaXJlY3Rpb246IHNvcnREaXJlY3Rpb25zW25ld0N1cnNvcl19KTtcbiAgcmV0dXJuIDxidXR0b24gb25DbGljaz17dG9nZ2xlU29ydH0+UzwvYnV0dG9uPlxufSk7XG5cbmV4cG9ydCBjb25zdCBTb3J0QnV0dG9uID0gc3Vic2NyaWJlVG9Tb3J0KChwcm9wcywgYWN0aW9ucykgPT5cbiAgPFNvcnRCdXR0b25Db21wb25lbnQgey4uLnByb3BzfSBzb3J0PXthY3Rpb25zLnRvZ2dsZVNvcnR9Lz4pO1xuIiwiaW1wb3J0IHtoLCBjb25uZWN0fSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICcuL2hlbHBlcic7XG5pbXBvcnQgc3RvcmUgZnJvbSAnLi4vbGliL3N0b3JlJztcbmltcG9ydCBqc29uIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmNvbnN0IGFjdGlvbnMgPSB7XG4gIHNlYXJjaDogKHZhbHVlLCBzY29wZSkgPT4gc3RvcmUuZGlzcGF0Y2goe3R5cGU6ICdzZWFyY2gnLCBhcmdzOiBbe3ZhbHVlLCBzY29wZX1dfSlcbn07XG5jb25zdCBzbGljZVN0YXRlID0ganNvbigndGFibGVTdGF0ZS5zZWFyY2gnKS5nZXQ7XG5jb25zdCBub05lZWRGb3JVcGRhdGUgPSBzdGF0ZSA9PiBmYWxzZTsvLyBhbHdheXMgcmV0dXJuIHRoZSBzYW1lIHZhbHVlXG5jb25zdCBzZWFyY2hhYmxlID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IFNlYXJjaElucHV0ID0gKHByb3BzKSA9PiAoPGxhYmVsPlxuICA8c3Bhbj57cHJvcHMuY2hpbGRyZW59PC9zcGFuPlxuICA8aW5wdXQgdHlwZT1cInNlYXJjaFwiIG9uSW5wdXQ9e3Byb3BzLm9uSW5wdXR9IHBsYWNlaG9sZGVyPXtwcm9wcy5wbGFjZWhvbGRlcn0vPlxuPC9sYWJlbD4pO1xuXG5leHBvcnQgY29uc3QgU2VhcmNoUm93ID0gc2VhcmNoYWJsZSgocHJvcHMsIGFjdGlvbnMpID0+IHtcbiAgY29uc3Qgb25JbnB1dCA9IGRlYm91bmNlKGV2ID0+IGFjdGlvbnMuc2VhcmNoKGV2LnRhcmdldC52YWx1ZSwgWyduYW1lLmxhc3QnLCAnbmFtZS5maXJzdCddKSwgMzAwKTtcbiAgZGVsZXRlIHByb3BzLmNoaWxkcmVuO1xuICByZXR1cm4gPHRyIHsuLi5wcm9wc30+XG4gICAgPHRoPlxuICAgICAgPFNlYXJjaElucHV0IHBsYWNlaG9sZGVyPVwiQ2FzZSBzZW5zaXRpdmUgc2VhcmNoIG9uIHN1cm5hbWUgYW5kIG5hbWVcIiBvbklucHV0PXtvbklucHV0fT5TZWFyY2g6PC9TZWFyY2hJbnB1dD5cbiAgICA8L3RoPlxuICA8L3RyPlxufSwgbm9OZWVkRm9yVXBkYXRlLCBub05lZWRGb3JVcGRhdGUpOyIsImltcG9ydCB7aCwgY29ubmVjdCwgb25VcGRhdGV9IGZyb20gJy4uLy4uLy4uL2luZGV4JztcbmltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuXG5jb25zdCBmb2N1c09uT3BlbiA9IG9uVXBkYXRlKHZub2RlID0+IHtcbiAgY29uc3QgYWggPSB2bm9kZS5wcm9wc1snYXJpYS1oaWRkZW4nXTtcbiAgaWYgKGFoID09PSAnZmFsc2UnKSB7XG4gICAgY29uc3QgaW5wdXQgPSB2bm9kZS5kb20ucXVlcnlTZWxlY3RvcignaW5wdXQsIHNlbGVjdCcpO1xuICAgIGlmIChpbnB1dCkge1xuICAgICAgc2V0VGltZW91dCgoKSA9PiBpbnB1dC5mb2N1cygpLCA1KTtcbiAgICB9XG4gIH1cbn0pO1xuXG5jb25zdCBhY3Rpb25zID0ge1xuICB0b2dnbGVGaWx0ZXJNZW51OiAoZmlsdGVyKSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ1RPR0dMRV9GSUxURVInLCBmaWx0ZXJ9KSxcbiAgY29tbWl0RmlsdGVyOiAodmFsdWUpID0+IHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnZmlsdGVyJywgYXJnczogW3ZhbHVlXX0pXG59O1xuY29uc3Qgc2xpY2VTdGF0ZSA9IHN0YXRlID0+ICh7YWN0aXZlRmlsdGVyOiBzdGF0ZS5hY3RpdmVGaWx0ZXIsIGZpbHRlckNsYXVzZXM6IHN0YXRlLnRhYmxlU3RhdGUuZmlsdGVyfSk7XG5jb25zdCBzdWJzY3JpYmVUb0ZpbHRlciA9IGNvbm5lY3Qoc3RvcmUsIGFjdGlvbnMsIHNsaWNlU3RhdGUpO1xuXG5jb25zdCBGaWx0ZXJSb3dDb21wID0gZm9jdXNPbk9wZW4oKHByb3BzID0ge30pID0+IHtcbiAgY29uc3Qge2lzSGlkZGVuLCB0b2dnbGVGaWx0ZXJNZW51LCBjb21taXRGaWx0ZXJ9ID0gcHJvcHM7XG4gIGNvbnN0IGNsb3NlID0gKCkgPT4ge1xuICAgIHRvZ2dsZUZpbHRlck1lbnUobnVsbCk7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgW2FyaWEtY29udHJvbHM9JHtpZE5hbWV9XWApLmZvY3VzKCk7XG4gIH07XG4gIGNvbnN0IG9uU3VibWl0ID0gKGV2KSA9PiB7XG4gICAgY29uc3QgZm9ybSA9IGV2LnRhcmdldDtcbiAgICBjb25zdCB7bmFtZX0gPSBmb3JtO1xuICAgIGNvbnN0IGlucHV0cyA9IGZvcm0ucXVlcnlTZWxlY3RvckFsbCgnaW5wdXQsIHNlbGVjdCcpO1xuICAgIGNvbW1pdEZpbHRlcih7XG4gICAgICBbbmFtZV06IFsuLi5pbnB1dHNdLm1hcChpbnB1dCA9PiB7XG4gICAgICAgIHJldHVybiB7dHlwZTogaW5wdXQudHlwZSwgdmFsdWU6IGlucHV0LnZhbHVlLCBvcGVyYXRvcjogaW5wdXQuZ2V0QXR0cmlidXRlKCdkYXRhLW9wZXJhdG9yJykgfHwgJ2luY2x1ZGVzJ31cbiAgICAgIH0pXG4gICAgfSk7XG4gICAgZXYucHJldmVudERlZmF1bHQoKTtcbiAgICBjbG9zZSgpO1xuICB9O1xuICBjb25zdCBpZE5hbWUgPSBbJ2ZpbHRlciddLmNvbmNhdChwcm9wcy5zY29wZS5zcGxpdCgnLicpKS5qb2luKCctJyk7XG4gIGNvbnN0IG9uS2V5RG93biA9IChldikgPT4ge1xuICAgIGlmIChldi5jb2RlID09PSAnRXNjYXBlJyB8fCBldi5rZXlDb2RlID09PSAyNyB8fCBldi5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgICBjbG9zZSgpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gPHRyIGlkPXtpZE5hbWV9IGNsYXNzPVwiZmlsdGVyLXJvd1wiIG9uS2V5ZG93bj17b25LZXlEb3dufSBhcmlhLWhpZGRlbj17U3RyaW5nKGlzSGlkZGVuICE9PSB0cnVlKX0+XG4gICAgPHRoIGNvbHNwYW49XCI2XCI+XG4gICAgICA8Zm9ybSBuYW1lPXtwcm9wcy5zY29wZX0gb25TdWJtaXQ9e29uU3VibWl0fT5cbiAgICAgICAge3Byb3BzLmNoaWxkcmVufVxuICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9ucy1jb250YWluZXJcIj5cbiAgICAgICAgICA8YnV0dG9uPkFwcGx5PC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXtjbG9zZX0gdHlwZT1cImJ1dHRvblwiPkNhbmNlbDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZm9ybT5cbiAgICA8L3RoPlxuICA8L3RyPlxufSk7XG5cbmNvbnN0IEZpbHRlckJ1dHRvbiA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7Y29sdW1uUG9pbnRlciwgdG9nZ2xlRmlsdGVyTWVudSwgZmlsdGVyQ2xhdXNlcyA9IHt9fT1wcm9wcztcbiAgY29uc3QgY3VycmVudEZpbHRlckNsYXVzZXMgPSBmaWx0ZXJDbGF1c2VzW2NvbHVtblBvaW50ZXJdIHx8IFtdO1xuICBjb25zdCBjb250cm9sbGVkID0gWydmaWx0ZXInXS5jb25jYXQoY29sdW1uUG9pbnRlci5zcGxpdCgnLicpKS5qb2luKCctJyk7XG4gIGNvbnN0IG9uQ2xpY2sgPSAoKSA9PiB0b2dnbGVGaWx0ZXJNZW51KGNvbHVtblBvaW50ZXIpO1xuICBjb25zdCBpc0FjdGl2ZSA9IGN1cnJlbnRGaWx0ZXJDbGF1c2VzLmxlbmd0aCAmJiBjdXJyZW50RmlsdGVyQ2xhdXNlcy5zb21lKGNsYXVzZSA9PiBjbGF1c2UudmFsdWUpO1xuICByZXR1cm4gPGJ1dHRvbiBjbGFzcz17aXNBY3RpdmUgPyAnYWN0aXZlLWZpbHRlcicgOiAnJ30gYXJpYS1jb250cm9scz17Y29udHJvbGxlZH0gb25DbGljaz17b25DbGlja30+RjwvYnV0dG9uPlxufTtcblxuZXhwb3J0IGNvbnN0IFRvZ2dsZUZpbHRlckJ1dHRvbiA9IHN1YnNjcmliZVRvRmlsdGVyKChwcm9wcywgYWN0aW9ucykgPT4ge1xuICByZXR1cm4gPEZpbHRlckJ1dHRvbiB7Li4ucHJvcHN9IHRvZ2dsZUZpbHRlck1lbnU9e2FjdGlvbnMudG9nZ2xlRmlsdGVyTWVudX0vPlxufSk7XG5cbmV4cG9ydCBjb25zdCBGaWx0ZXJSb3cgPSBzdWJzY3JpYmVUb0ZpbHRlcigocHJvcHMsIGFjdGlvbnMpID0+IHtcbiAgcmV0dXJuIDxGaWx0ZXJSb3dDb21wIHNjb3BlPXtwcm9wcy5zY29wZX0gaXNIaWRkZW49e3Byb3BzLmFjdGl2ZUZpbHRlciA9PT0gcHJvcHMuc2NvcGV9XG4gICAgICAgICAgICAgICAgICAgICAgICB0b2dnbGVGaWx0ZXJNZW51PXthY3Rpb25zLnRvZ2dsZUZpbHRlck1lbnV9IGNvbW1pdEZpbHRlcj17YWN0aW9ucy5jb21taXRGaWx0ZXJ9PlxuICAgIHtwcm9wcy5jaGlsZHJlbn1cbiAgPC9GaWx0ZXJSb3dDb21wPjtcbn0pOyIsImltcG9ydCB7aCwgY29ubmVjdH0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuXG5pbXBvcnQge1NvcnRCdXR0b259IGZyb20gJy4vc29ydCc7XG5pbXBvcnQge1NlYXJjaFJvd30gZnJvbSAnLi9zZWFyY2gnO1xuaW1wb3J0IHtGaWx0ZXJSb3csIFRvZ2dsZUZpbHRlckJ1dHRvbn0gZnJvbSAnLi9maWx0ZXInO1xuXG5cbmNvbnN0IENvbHVtbkhlYWRlciA9IChwcm9wcykgPT4ge1xuICBjb25zdCB7Y29sdW1uUG9pbnRlciwgc29ydERpcmVjdGlvbnMgPSBbJ2FzYycsICdkZXNjJ10sIGNsYXNzTmFtZSwgY2hpbGRyZW59ID0gcHJvcHM7XG5cbiAgcmV0dXJuIDx0aCBjbGFzcz17Y2xhc3NOYW1lfT5cbiAgICB7Y2hpbGRyZW59XG4gICAgPGRpdiBjbGFzcz1cImJ1dHRvbnMtY29udGFpbmVyXCI+XG4gICAgICA8U29ydEJ1dHRvbiBjb2x1bW5Qb2ludGVyPXtjb2x1bW5Qb2ludGVyfSBzb3J0RGlyZWN0aW9ucz17c29ydERpcmVjdGlvbnN9Lz5cbiAgICAgIDxUb2dnbGVGaWx0ZXJCdXR0b24gY29sdW1uUG9pbnRlcj17Y29sdW1uUG9pbnRlcn0vPlxuICAgIDwvZGl2PlxuICA8L3RoPlxufTtcblxuXG5leHBvcnQgY29uc3QgSGVhZGVycyA9ICgpID0+ICg8dGhlYWQ+XG48U2VhcmNoUm93IGNsYXNzPVwiZmlsdGVyLXJvd1wiLz5cbjx0cj5cbiAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtbGFzdG5hbWVcIiBjb2x1bW5Qb2ludGVyPVwibmFtZS5sYXN0XCJcbiAgICAgICAgICAgICAgICBzb3J0RGlyZWN0aW9ucz17Wydhc2MnLCAnZGVzYycsICdub25lJ119PlN1cm5hbWU8L0NvbHVtbkhlYWRlcj5cbiAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtZmlyc3RuYW1lXCIgY29sdW1uUG9pbnRlcj1cIm5hbWUuZmlyc3RcIj5OYW1lPC9Db2x1bW5IZWFkZXI+XG4gIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLWJpcnRoZGF0ZVwiIHNvcnREaXJlY3Rpb25zPXtbJ2Rlc2MnLCAnYXNjJ119XG4gICAgICAgICAgICAgICAgY29sdW1uUG9pbnRlcj1cImJpcnRoRGF0ZVwiPkRhdGUgb2YgYmlydGg8L0NvbHVtbkhlYWRlcj5cbiAgPENvbHVtbkhlYWRlciBjbGFzc05hbWU9XCJjb2wtZ2VuZGVyIGZpeGVkLXNpemVcIiBjb2x1bW5Qb2ludGVyPVwiZ2VuZGVyXCI+R2VuZGVyPC9Db2x1bW5IZWFkZXI+XG4gIDxDb2x1bW5IZWFkZXIgY2xhc3NOYW1lPVwiY29sLXNpemUgZml4ZWQtc2l6ZVwiIGNvbHVtblBvaW50ZXI9XCJzaXplXCI+U2l6ZTwvQ29sdW1uSGVhZGVyPlxuICA8dGggY2xhc3M9XCJmaXhlZC1zaXplIGNvbC1hY3Rpb25zXCI+PC90aD5cbjwvdHI+XG48RmlsdGVyUm93IHNjb3BlPVwibmFtZS5sYXN0XCI+XG4gIDxsYWJlbD5cbiAgICA8c3Bhbj5zdXJuYW1lIGluY2x1ZGVzOjwvc3Bhbj5cbiAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBwbGFjZWhvbGRlcj1cImNhc2UgaW5zZW5zaXRpdmUgc3VybmFtZSB2YWx1ZVwiLz5cbiAgPC9sYWJlbD5cbjwvRmlsdGVyUm93PlxuPEZpbHRlclJvdyBzY29wZT1cIm5hbWUuZmlyc3RcIj5cbiAgPGxhYmVsPlxuICAgIDxzcGFuPm5hbWUgaW5jbHVkZXM6PC9zcGFuPlxuICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIHBsYWNlaG9sZGVyPVwiY2FzZSBpbnNlbnNpdGl2ZSBuYW1lIHZhbHVlXCIvPlxuICA8L2xhYmVsPlxuPC9GaWx0ZXJSb3c+XG48RmlsdGVyUm93IHNjb3BlPVwiYmlydGhEYXRlXCI+XG4gIDxsYWJlbD5cbiAgICA8c3Bhbj5ib3JuIGFmdGVyOjwvc3Bhbj5cbiAgICA8aW5wdXQgZGF0YS1vcGVyYXRvcj1cImd0XCIgdHlwZT1cImRhdGVcIi8+XG4gIDwvbGFiZWw+XG48L0ZpbHRlclJvdz5cbjxGaWx0ZXJSb3cgc2NvcGU9XCJnZW5kZXJcIj5cbiAgPGxhYmVsPlxuICAgIDxzcGFuPmdlbmRlciBpczo8L3NwYW4+XG4gICAgPHNlbGVjdCBkYXRhLW9wZXJhdG9yPVwiaXNcIj5cbiAgICAgIDxvcHRpb24gdmFsdWU9XCJcIj4tPC9vcHRpb24+XG4gICAgICA8b3B0aW9uIHZhbHVlPVwiZmVtYWxlXCI+ZmVtYWxlPC9vcHRpb24+XG4gICAgICA8b3B0aW9uIHZhbHVlPVwibWFsZVwiPm1hbGU8L29wdGlvbj5cbiAgICA8L3NlbGVjdD5cbiAgPC9sYWJlbD5cbjwvRmlsdGVyUm93PlxuPEZpbHRlclJvdyBzY29wZT1cInNpemVcIj5cbiAgPGxhYmVsPlxuICAgIDxzcGFuPnRhbGxlciB0aGFuOjwvc3Bhbj5cbiAgICA8aW5wdXQgbWluPVwiMTUwXCIgbWF4PVwiMjAwXCIgc3RlcD1cIjFcIiB0eXBlPVwicmFuZ2VcIiBkYXRhLW9wZXJhdG9yPVwiZ3RcIi8+XG4gIDwvbGFiZWw+XG4gIDxsYWJlbD5cbiAgICA8c3Bhbj5zbWFsbGVyIHRoYW46PC9zcGFuPlxuICAgIDxpbnB1dCBtaW49XCIxNTBcIiBtYXg9XCIyMDBcIiBzdGVwPVwiMVwiIHR5cGU9XCJyYW5nZVwiIGRhdGEtb3BlcmF0b3I9XCJsdFwiLz5cbiAgPC9sYWJlbD5cbjwvRmlsdGVyUm93PlxuPC90aGVhZD4pOyIsImltcG9ydCBzdG9yZSBmcm9tICcuLi9saWIvc3RvcmUnO1xuaW1wb3J0IHtjb25uZWN0LCBofSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5cblxuY29uc3QgYWN0aW9ucyA9IHtcbiAgc2xpY2U6IChwYWdlLCBzaXplKSA9PiBzdG9yZS5kaXNwYXRjaCh7dHlwZTogJ3NsaWNlJywgYXJnczogW3twYWdlLCBzaXplfV19KVxufTtcbmNvbnN0IHNsaWNlU3RhdGUgPSBzdGF0ZSA9PiBzdGF0ZS5zdW1tYXJ5O1xuY29uc3Qgc3Vic2NyaWJlVG9TdW1tYXJ5ID0gY29ubmVjdChzdG9yZSwgYWN0aW9ucywgc2xpY2VTdGF0ZSk7XG5cbmNvbnN0IHN1bW1hcnkgPSAocHJvcHMpID0+IHtcbiAgY29uc3Qge3BhZ2UsIHNpemUsIGZpbHRlcmVkQ291bnR9ID0gcHJvcHM7XG4gIHJldHVybiAoPGRpdj4gc2hvd2luZyBpdGVtcyA8c3Ryb25nPnsocGFnZSAtIDEpICogc2l6ZSArIChmaWx0ZXJlZENvdW50ID4gMCA/IDEgOiAwKX08L3N0cm9uZz4gLVxuICAgIDxzdHJvbmc+e01hdGgubWluKGZpbHRlcmVkQ291bnQsIHBhZ2UgKiBzaXplKX08L3N0cm9uZz4gb2YgPHN0cm9uZz57ZmlsdGVyZWRDb3VudH08L3N0cm9uZz4gbWF0Y2hpbmcgaXRlbXNcbiAgPC9kaXY+KTtcbn07XG5cbmNvbnN0IFBhZ2VyID0gKHByb3BzKSA9PiB7XG4gIGNvbnN0IHtwYWdlLCBzaXplLCBmaWx0ZXJlZENvdW50LCBzbGljZX0gPSBwcm9wcztcbiAgY29uc3Qgc2VsZWN0UHJldmlvdXNQYWdlID0gKCkgPT4gc2xpY2UocGFnZSAtIDEsIHNpemUpO1xuICBjb25zdCBzZWxlY3ROZXh0UGFnZSA9ICgpID0+IHNsaWNlKHBhZ2UgKyAxLCBzaXplKTtcbiAgY29uc3QgaXNQcmV2aW91c0Rpc2FibGVkID0gcGFnZSA9PT0gMTtcbiAgY29uc3QgaXNOZXh0RGlzYWJsZWQgPSAoZmlsdGVyZWRDb3VudCAtIChwYWdlICogc2l6ZSkpIDw9IDA7XG5cbiAgcmV0dXJuICg8ZGl2PlxuICAgIDxkaXY+XG4gICAgICA8YnV0dG9uIG9uQ2xpY2s9e3NlbGVjdFByZXZpb3VzUGFnZX0gZGlzYWJsZWQ9e2lzUHJldmlvdXNEaXNhYmxlZH0+XG4gICAgICAgIFByZXZpb3VzXG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxzbWFsbD4gUGFnZSAtIHtwYWdlIHx8IDF9IDwvc21hbGw+XG4gICAgICA8YnV0dG9uIG9uQ2xpY2s9e3NlbGVjdE5leHRQYWdlfSBkaXNhYmxlZD17aXNOZXh0RGlzYWJsZWR9PlxuICAgICAgICBOZXh0XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgICB7Lyo8ZGl2PiovfVxuICAgIHsvKjxsYWJlbD4qL31cbiAgICB7LypQYWdlIHNpemUqL31cbiAgICB7Lyo8c2VsZWN0IG9uQ2hhbmdlPXtldiA9PiB7Ki99XG4gICAgey8qZGlyZWN0aXZlLmNoYW5nZVBhZ2VTaXplKE51bWJlcihldi50YXJnZXQudmFsdWUpKSovfVxuICAgIHsvKn19IG5hbWU9XCJwYWdlU2l6ZVwiPiovfVxuICAgIHsvKjxvcHRpb24gc2VsZWN0ZWQ9e3NpemUgPT0gMTV9IHZhbHVlPVwiMTVcIj4xNSBpdGVtczwvb3B0aW9uPiovfVxuICAgIHsvKjxvcHRpb24gc2VsZWN0ZWQ9e3NpemUgPT0gMjV9IHZhbHVlPVwiMjVcIj4yNSBpdGVtczwvb3B0aW9uPiovfVxuICAgIHsvKjxvcHRpb24gc2VsZWN0ZWQ9e3NpemUgPT0gNTB9IHZhbHVlPVwiNTBcIj41MCBpdGVtczwvb3B0aW9uPiovfVxuICAgIHsvKjwvc2VsZWN0PiovfVxuICAgIHsvKjwvbGFiZWw+Ki99XG4gICAgey8qPC9kaXY+Ki99XG4gIDwvZGl2Pik7XG59O1xuXG5jb25zdCBTdW1tYXJ5Rm9vdGVyID0gc3Vic2NyaWJlVG9TdW1tYXJ5KHN1bW1hcnkpO1xuY29uc3QgUGFnaW5hdGlvbiA9IHN1YnNjcmliZVRvU3VtbWFyeSgocHJvcHMsIGFjdGlvbnMpID0+IDxQYWdlciB7Li4ucHJvcHN9IHNsaWNlPXthY3Rpb25zLnNsaWNlfS8+KTtcblxuZXhwb3J0IGNvbnN0IEZvb3RlciA9ICgpID0+IDx0Zm9vdD5cbjx0cj5cbiAgPHRkIGNvbHNwYW49XCIzXCI+XG4gICAgPFN1bW1hcnlGb290ZXIvPlxuICA8L3RkPlxuICA8dGQgY29sU3Bhbj1cIjNcIj5cbiAgICA8UGFnaW5hdGlvbi8+XG4gIDwvdGQ+XG48L3RyPlxuPC90Zm9vdD47XG5cblxuXG4iLCJpbXBvcnQge2gsIG1vdW50LCBvbk1vdW50LCBjb25uZWN0fSBmcm9tICcuLi8uLi9pbmRleCc7XG5pbXBvcnQge1BlcnNvbkxpc3R9IGZyb20gJy4vY29tcG9uZW50cy90Ym9keSc7XG5pbXBvcnQge1dvcmtJblByb2dyZXNzfSBmcm9tICcuL2NvbXBvbmVudHMvbG9hZGluZ0luZGljYXRvcic7XG5pbXBvcnQge0hlYWRlcnN9IGZyb20gJy4vY29tcG9uZW50cy9oZWFkZXJzJztcbmltcG9ydCB7Rm9vdGVyfSBmcm9tICcuL2NvbXBvbmVudHMvZm9vdGVyJztcbmltcG9ydCBzdG9yZSBmcm9tICcuL2xpYi9zdG9yZSc7XG5cbmNvbnN0IFBlcnNvblRhYmxlID0gb25Nb3VudCgoKSA9PiB7XG4gIHN0b3JlLmRpc3BhdGNoKHt0eXBlOiAnZXhlYycsIGFyZ3M6IFtdfSk7IC8va2ljayBzbWFydFRhYmxlXG59LCAoKSA9PlxuICA8ZGl2IGlkPVwidGFibGUtY29udGFpbmVyXCI+XG4gICAgPFdvcmtJblByb2dyZXNzLz5cbiAgICA8dGFibGU+XG4gICAgICA8SGVhZGVycy8+XG4gICAgICA8UGVyc29uTGlzdC8+XG4gICAgICA8Rm9vdGVyLz5cbiAgICA8L3RhYmxlPlxuICA8L2Rpdj4pO1xuXG5tb3VudChQZXJzb25UYWJsZSwge30sIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluJykpOyJdLCJuYW1lcyI6WyJtb3VudCIsInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsInNtYXJ0VGFibGUiLCJhY3Rpb25zIiwic2xpY2VTdGF0ZSIsImpzb24iLCJzdW1tYXJ5Il0sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNLGVBQWUsR0FBRyxDQUFDLEtBQUssTUFBTTtFQUNsQyxRQUFRLEVBQUUsTUFBTTtFQUNoQixRQUFRLEVBQUUsRUFBRTtFQUNaLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQztDQUNmLENBQUMsQ0FBQzs7Ozs7Ozs7O0FBU0gsQUFBZSxTQUFTLENBQUMsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsUUFBUSxFQUFFO0VBQ3ZELE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxLQUFLO0lBQ25ELE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDN0QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0dBQ2xDLEVBQUUsRUFBRSxDQUFDO0tBQ0gsR0FBRyxDQUFDLEtBQUssSUFBSTs7TUFFWixNQUFNLElBQUksR0FBRyxPQUFPLEtBQUssQ0FBQztNQUMxQixPQUFPLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxLQUFLLFVBQVUsR0FBRyxLQUFLLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2xGLENBQUMsQ0FBQzs7RUFFTCxJQUFJLE9BQU8sUUFBUSxLQUFLLFVBQVUsRUFBRTtJQUNsQyxPQUFP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
