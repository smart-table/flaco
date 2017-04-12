(function () {
'use strict';

let id = 1;

const rand = Math.random;

function buildData (count) {
  const adjectives = [
    "pretty",
    "large",
    "big",
    "small",
    "tall",
    "short",
    "long",
    "handsome",
    "plain",
    "quaint",
    "clean",
    "elegant",
    "easy",
    "angry",
    "crazy",
    "helpful",
    "mushy",
    "odd",
    "unsightly",
    "adorable",
    "important",
    "inexpensive",
    "cheap",
    "expensive",
    "fancy",
  ];

  const colours = [
    "red",
    "yellow",
    "blue",
    "green",
    "pink",
    "brown",
    "purple",
    "brown",
    "white",
    "black",
    "orange",
  ];

  const nouns = [
    "table",
    "chair",
    "house",
    "bbq",
    "desk",
    "car",
    "pony",
    "cookie",
    "sandwich",
    "burger",
    "pizza",
    "mouse",
    "keyboard",
  ];

  return new Array(count).fill(0).map(_ => ({
    id: id++,
    label: `${adjectives[
    rand() * 1000 % adjectives.length >> 0]} ${colours[
    rand() * 1000 % colours.length >> 0]} ${nouns[
    rand() * 1000 % nouns.length >> 0]}`
  }))
}

const model = {
  data: [],
  selected: false
};

const reducers = {
  run: model => ({
    data: buildData(1000),
    selected: undefined
  }),

  add: model => ({
    data: model.data.concat(buildData(1000)),
    selected: undefined
  }),

  runLots: model => ({
    data: buildData(10000),
    selected: undefined
  }),

  clear: model => ({
    data: [],
    selected: undefined
  }),

  update: model => {
    return {
      data: model.data.map((d, i) => {
        if (i % 10 === 0) {
          d.label = `${d.label} !!!`;
        }
        return d
      }),
      selected: undefined
    }
  },

  swapRows: model => {
    if (model.data.length <= 10) {
      return model
    }

    const temp = model.data[4];
    model.data[4] = model.data[9];
    model.data[9] = temp;

    return {
      data: model.data,
      selected: model.selected
    }
  },

  select: (model, data) => ({
    data: model.data,
    selected: data.id
  }),

  delete: (model, data) => ({
    data: model.data.filter(d => d.id !== data.id)
  })
};

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

function hydrate (vnode, dom) {
  'use strict';
  const hydrated = Object.assign({}, vnode);
  const domChildren = dom.children;
  hydrated.dom = dom;
  hydrated.children.map((child, i) => hydrate(child, domChildren[i]));
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

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp {Function} - the component
 * @returns {Function} - a new wrapped component
 */

/**
 * Combinator to create a Elm like app
 * @param view {Function} - a component which takes as arguments the current model and the list of updates
 * @returns {Function} - a Elm like application whose properties "model", "updates" and "subscriptions" will define the related domain specific objects
 */
var app = function (view) {
  return function ({model, updates, subscriptions = []}={}) {
    let updateFunc;
    let actionStore = {};
    for (let update$$1 of Object.keys(updates)) {
      actionStore[update$$1] = (...args) => {
        model = updates[update$$1](model, ...args); //todo consider side effects, middlewares, etc
        return updateFunc(model, actionStore);
      };
    }

    const comp = () => view(model, actionStore);

    const initActionStore = (vnode) => {
      updateFunc = update(comp, vnode);
    };
    const initSubscription = subscriptions.map(sub => vnode => sub(vnode, actionStore));
    const initFunc = compose(initActionStore, ...initSubscription);

    return onMount(initFunc, comp);
  };
};

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

var RowsView = ({model, actions}) => model.data.map(({id, label}, i) =>
  h( 'tr', { class: id === model.selected ? "danger" : "" },
    h( 'td', { class: "col-md-1" }, id),
    h( 'td', { class: "col-md-4" },
      h( 'a', { onclick: _ => actions.select({id}) }, label)
    ),
    h( 'td', { class: "col-md-1" },
      h( 'a', { onclick: _ => actions.delete({id}) },
                h( 'span', { class: "glyphicon glyphicon-remove", 'aria-hidden': "true" }
                )
      )
    ),
    h( 'td', { class: "col-md-6" })
  )
);

let startTime;
let lastMeasure;

function startMeasure (name, cb) {
  startTime = performance.now();
  // performance.mark('start ' + name);
  lastMeasure = name;
  cb();
}

function stopMeasure () {
  const last = lastMeasure;

  if (lastMeasure) {
    window.setTimeout(
      function metaStopMeasure () {
        lastMeasure = null;
        const stop = performance.now();
        // performance.mark('end ' + last);
        // performance.measure(last, 'start ' + last, 'end ' + last);
        console.log(last + " took " + (stop - startTime));
      },
      0
    );
  }
}

function view (model$$1, actions) {
  stopMeasure();
  return (
    h( 'div', { class: "container" },
      h( 'div', { class: "jumbotron" },
        h( 'div', { class: "row" },
          h( 'div', { class: "col-md-6" },
            h( 'h1', null, "Flaco 0.1.0" )
          ),
          h( 'div', { class: "col-md-6" },
            h( 'div', { class: "row" },
              h( 'div', { class: "col-sm-6 smallpad" },
                h( 'button', {
                  type: "button", class: "btn btn-primary btn-block", id: "run", onClick: _ =>
                    startMeasure("run", actions.run) }, "Create 1,000 rows")
              ),
              h( 'div', { class: "col-sm-6 smallpad" },
                h( 'button', {
                  type: "button", class: "btn btn-primary btn-block", id: "runlots", onClick: _ =>
                    startMeasure(
                      "runLots",
                      actions.runLots
                    ) }, "Create 10,000 rows")
              ),
              h( 'div', { class: "col-sm-6 smallpad" },
                h( 'button', {
                  type: "button", class: "btn btn-primary btn-block", id: "add", onClick: _ =>
                    startMeasure("add", actions.add) }, "Append 1,000 rows")
              ),
              h( 'div', { class: "col-sm-6 smallpad" },
                h( 'button', {
                  type: "button", class: "btn btn-primary btn-block", id: "update", onClick: _ =>
                    startMeasure("update", actions.update) }, "Update every 10th row")
              ),
              h( 'div', { class: "col-sm-6 smallpad" },
                h( 'button', {
                  type: "button", class: "btn btn-primary btn-block", id: "clear", onClick: _ =>
                    startMeasure("clear", actions.clear) }, "Clear")
              ),
              h( 'div', { class: "col-sm-6 smallpad" },
                h( 'button', {
                  type: "button", class: "btn btn-primary btn-block", id: "swaprows", onClick: _ =>
                    startMeasure(
                      "swapRows",
                      actions.swapRows
                    ) }, "Swap Rows")
              )
            )
          )
        )
      ),
      h( 'table', { class: "table table-hover table-striped test-data" },
        h( 'tbody', null,
        h( RowsView, { model: model$$1, actions: actions })
        )
      ),
      h( 'span', {
        class: "preloadicon glyphicon glyphicon-remove", 'aria-hidden': "true" })
    ));
}

const Bench = app(view);

mount(({model: model$$1, updates}) => (h( Bench, { model: model$$1, updates: updates })), {
  model, updates: reducers
}, document.getElementById("main"));

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL3N0b3JlLmpzIiwiLi4vLi4vLi4vbGliL2guanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vLi4vLi4vbGliL3V0aWwuanMiLCIuLi8uLi8uLi9saWIvZG9tVXRpbC5qcyIsIi4uLy4uLy4uL2xpYi90cmF2ZXJzZS5qcyIsIi4uLy4uLy4uL2xpYi90cmVlLmpzIiwiLi4vLi4vLi4vbGliL3VwZGF0ZS5qcyIsIi4uLy4uLy4uL2xpYi9saWZlQ3ljbGVzLmpzIiwiLi4vLi4vLi4vbGliL3dpdGhTdGF0ZS5qcyIsIi4uLy4uLy4uL2xpYi9lbG0uanMiLCIuLi8uLi8uLi9saWIvY29ubmVjdC5qcyIsIi4uL3Jvd3MuanMiLCIuLi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgaWQgPSAxXG5cbmNvbnN0IHJhbmQgPSBNYXRoLnJhbmRvbVxuXG5mdW5jdGlvbiBidWlsZERhdGEgKGNvdW50KSB7XG4gIGNvbnN0IGFkamVjdGl2ZXMgPSBbXG4gICAgXCJwcmV0dHlcIixcbiAgICBcImxhcmdlXCIsXG4gICAgXCJiaWdcIixcbiAgICBcInNtYWxsXCIsXG4gICAgXCJ0YWxsXCIsXG4gICAgXCJzaG9ydFwiLFxuICAgIFwibG9uZ1wiLFxuICAgIFwiaGFuZHNvbWVcIixcbiAgICBcInBsYWluXCIsXG4gICAgXCJxdWFpbnRcIixcbiAgICBcImNsZWFuXCIsXG4gICAgXCJlbGVnYW50XCIsXG4gICAgXCJlYXN5XCIsXG4gICAgXCJhbmdyeVwiLFxuICAgIFwiY3JhenlcIixcbiAgICBcImhlbHBmdWxcIixcbiAgICBcIm11c2h5XCIsXG4gICAgXCJvZGRcIixcbiAgICBcInVuc2lnaHRseVwiLFxuICAgIFwiYWRvcmFibGVcIixcbiAgICBcImltcG9ydGFudFwiLFxuICAgIFwiaW5leHBlbnNpdmVcIixcbiAgICBcImNoZWFwXCIsXG4gICAgXCJleHBlbnNpdmVcIixcbiAgICBcImZhbmN5XCIsXG4gIF1cblxuICBjb25zdCBjb2xvdXJzID0gW1xuICAgIFwicmVkXCIsXG4gICAgXCJ5ZWxsb3dcIixcbiAgICBcImJsdWVcIixcbiAgICBcImdyZWVuXCIsXG4gICAgXCJwaW5rXCIsXG4gICAgXCJicm93blwiLFxuICAgIFwicHVycGxlXCIsXG4gICAgXCJicm93blwiLFxuICAgIFwid2hpdGVcIixcbiAgICBcImJsYWNrXCIsXG4gICAgXCJvcmFuZ2VcIixcbiAgXVxuXG4gIGNvbnN0IG5vdW5zID0gW1xuICAgIFwidGFibGVcIixcbiAgICBcImNoYWlyXCIsXG4gICAgXCJob3VzZVwiLFxuICAgIFwiYmJxXCIsXG4gICAgXCJkZXNrXCIsXG4gICAgXCJjYXJcIixcbiAgICBcInBvbnlcIixcbiAgICBcImNvb2tpZVwiLFxuICAgIFwic2FuZHdpY2hcIixcbiAgICBcImJ1cmdlclwiLFxuICAgIFwicGl6emFcIixcbiAgICBcIm1vdXNlXCIsXG4gICAgXCJrZXlib2FyZFwiLFxuICBdXG5cbiAgcmV0dXJuIG5ldyBBcnJheShjb3VudCkuZmlsbCgwKS5tYXAoXyA9PiAoe1xuICAgIGlkOiBpZCsrLFxuICAgIGxhYmVsOiBgJHthZGplY3RpdmVzW1xuICAgIHJhbmQoKSAqIDEwMDAgJSBhZGplY3RpdmVzLmxlbmd0aCA+PiAwXX0gJHtjb2xvdXJzW1xuICAgIHJhbmQoKSAqIDEwMDAgJSBjb2xvdXJzLmxlbmd0aCA+PiAwXX0gJHtub3Vuc1tcbiAgICByYW5kKCkgKiAxMDAwICUgbm91bnMubGVuZ3RoID4+IDBdfWBcbiAgfSkpXG59XG5cbmNvbnN0IG1vZGVsID0ge1xuICBkYXRhOiBbXSxcbiAgc2VsZWN0ZWQ6IGZhbHNlXG59XG5cbmNvbnN0IHJlZHVjZXJzID0ge1xuICBydW46IG1vZGVsID0+ICh7XG4gICAgZGF0YTogYnVpbGREYXRhKDEwMDApLFxuICAgIHNlbGVjdGVkOiB1bmRlZmluZWRcbiAgfSksXG5cbiAgYWRkOiBtb2RlbCA9PiAoe1xuICAgIGRhdGE6IG1vZGVsLmRhdGEuY29uY2F0KGJ1aWxkRGF0YSgxMDAwKSksXG4gICAgc2VsZWN0ZWQ6IHVuZGVmaW5lZFxuICB9KSxcblxuICBydW5Mb3RzOiBtb2RlbCA9PiAoe1xuICAgIGRhdGE6IGJ1aWxkRGF0YSgxMDAwMCksXG4gICAgc2VsZWN0ZWQ6IHVuZGVmaW5lZFxuICB9KSxcblxuICBjbGVhcjogbW9kZWwgPT4gKHtcbiAgICBkYXRhOiBbXSxcbiAgICBzZWxlY3RlZDogdW5kZWZpbmVkXG4gIH0pLFxuXG4gIHVwZGF0ZTogbW9kZWwgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiBtb2RlbC5kYXRhLm1hcCgoZCwgaSkgPT4ge1xuICAgICAgICBpZiAoaSAlIDEwID09PSAwKSB7XG4gICAgICAgICAgZC5sYWJlbCA9IGAke2QubGFiZWx9ICEhIWBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZFxuICAgICAgfSksXG4gICAgICBzZWxlY3RlZDogdW5kZWZpbmVkXG4gICAgfVxuICB9LFxuXG4gIHN3YXBSb3dzOiBtb2RlbCA9PiB7XG4gICAgaWYgKG1vZGVsLmRhdGEubGVuZ3RoIDw9IDEwKSB7XG4gICAgICByZXR1cm4gbW9kZWxcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gbW9kZWwuZGF0YVs0XVxuICAgIG1vZGVsLmRhdGFbNF0gPSBtb2RlbC5kYXRhWzldXG4gICAgbW9kZWwuZGF0YVs5XSA9IHRlbXBcblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiBtb2RlbC5kYXRhLFxuICAgICAgc2VsZWN0ZWQ6IG1vZGVsLnNlbGVjdGVkXG4gICAgfVxuICB9LFxuXG4gIHNlbGVjdDogKG1vZGVsLCBkYXRhKSA9PiAoe1xuICAgIGRhdGE6IG1vZGVsLmRhdGEsXG4gICAgc2VsZWN0ZWQ6IGRhdGEuaWRcbiAgfSksXG5cbiAgZGVsZXRlOiAobW9kZWwsIGRhdGEpID0+ICh7XG4gICAgZGF0YTogbW9kZWwuZGF0YS5maWx0ZXIoZCA9PiBkLmlkICE9PSBkYXRhLmlkKVxuICB9KVxufVxuXG5leHBvcnQge1xuICBtb2RlbCwgcmVkdWNlcnNcbn1cblxuIiwiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9LFxuICBsaWZlQ3ljbGU6IDBcbn0pO1xuXG4vKipcbiAqIFRyYW5zZm9ybSBoeXBlcnNjcmlwdCBpbnRvIHZpcnR1YWwgZG9tIG5vZGVcbiAqIEBwYXJhbSBub2RlVHlwZSB7RnVuY3Rpb24sIFN0cmluZ30gLSB0aGUgSFRNTCB0YWcgaWYgc3RyaW5nLCBhIGNvbXBvbmVudCBvciBjb21iaW5hdG9yIG90aGVyd2lzZVxuICogQHBhcmFtIHByb3BzIHtPYmplY3R9IC0gdGhlIGxpc3Qgb2YgcHJvcGVydGllcy9hdHRyaWJ1dGVzIGFzc29jaWF0ZWQgdG8gdGhlIHJlbGF0ZWQgbm9kZVxuICogQHBhcmFtIGNoaWxkcmVuIC0gdGhlIHZpcnR1YWwgZG9tIG5vZGVzIHJlbGF0ZWQgdG8gdGhlIGN1cnJlbnQgbm9kZSBjaGlsZHJlblxuICogQHJldHVybnMge09iamVjdH0gLSBhIHZpcnR1YWwgZG9tIG5vZGVcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaCAobm9kZVR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICBjb25zdCBmbGF0Q2hpbGRyZW4gPSBjaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gQXJyYXkuaXNBcnJheShjaGlsZCkgPyBjaGlsZCA6IFtjaGlsZF07XG4gICAgcmV0dXJuIGFjYy5jb25jYXQoY2hpbGRyZW5BcnJheSk7XG4gIH0sIFtdKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gbm9ybWFsaXplIHRleHQgbm9kZSB0byBoYXZlIHNhbWUgc3RydWN0dXJlIHRoYW4gcmVndWxhciBkb20gbm9kZXNcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgY2hpbGQ7XG4gICAgICByZXR1cm4gdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkIDogY3JlYXRlVGV4dFZOb2RlKGNoaWxkKTtcbiAgICB9KTtcblxuICBpZiAodHlwZW9mIG5vZGVUeXBlICE9PSAnZnVuY3Rpb24nKSB7Ly9yZWd1bGFyIGh0bWwvdGV4dCBub2RlXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGVUeXBlLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgY2hpbGRyZW46IGZsYXRDaGlsZHJlbixcbiAgICAgIGxpZmVDeWNsZTogMFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZnVsbFByb3BzID0gT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IGZsYXRDaGlsZHJlbn0sIHByb3BzKTtcbiAgICBjb25zdCBjb21wID0gbm9kZVR5cGUoZnVsbFByb3BzKTtcbiAgICByZXR1cm4gdHlwZW9mIGNvbXAgIT09ICdmdW5jdGlvbicgPyBjb21wIDogaChjb21wLCBwcm9wcywgLi4uZmxhdENoaWxkcmVuKTsgLy9mdW5jdGlvbmFsIGNvbXAgdnMgY29tYmluYXRvciAoSE9DKVxuICB9XG59OyIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBjb25zdCBuZXh0VGljayA9IGZuID0+IHNldFRpbWVvdXQoZm4sIDApO1xuXG5leHBvcnQgY29uc3QgcGFpcmlmeSA9IGhvbGRlciA9PiBrZXkgPT4gW2tleSwgaG9sZGVyW2tleV1dO1xuXG5leHBvcnQgY29uc3QgaXNTaGFsbG93RXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCBhS2V5cyA9IE9iamVjdC5rZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IE9iamVjdC5rZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoKGspID0+IGFba10gPT09IGJba10pO1xufTtcblxuY29uc3Qgb3duS2V5cyA9IG9iaiA9PiBPYmplY3Qua2V5cyhvYmopLmZpbHRlcihrID0+IG9iai5oYXNPd25Qcm9wZXJ0eShrKSk7XG5cbmV4cG9ydCBjb25zdCBpc0RlZXBFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IHR5cGUgPSB0eXBlb2YgYTtcblxuICAvL3Nob3J0IHBhdGgocylcbiAgaWYgKGEgPT09IGIpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSB0eXBlb2YgYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG5cbiAgLy8gb2JqZWN0cyAuLi5cbiAgaWYgKGEgPT09IG51bGwgfHwgYiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KGEpKSB7XG4gICAgcmV0dXJuIGEubGVuZ3RoICYmIGIubGVuZ3RoICYmIGEuZXZlcnkoKGl0ZW0sIGkpID0+IGlzRGVlcEVxdWFsKGFbaV0sIGJbaV0pKTtcbiAgfVxuXG4gIGNvbnN0IGFLZXlzID0gb3duS2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBvd25LZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoayA9PiBpc0RlZXBFcXVhbChhW2tdLCBiW2tdKSk7XG59O1xuXG5leHBvcnQgY29uc3QgaWRlbnRpdHkgPSBhID0+IGE7XG5cbmV4cG9ydCBjb25zdCBub29wID0gXyA9PiB7XG59O1xuIiwiaW1wb3J0IHt0YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IHVwZGF0ZURvbU5vZGVGYWN0b3J5ID0gKG1ldGhvZCkgPT4gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IHBhaXIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlW21ldGhvZF0oLi4ucGFpcik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgncmVtb3ZlRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IGFkZEV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ2FkZEV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBzZXRBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoKGRvbU5vZGUpID0+IHtcbiAgY29uc3QgYXR0cmlidXRlcyA9IGl0ZW1zLmZpbHRlcigoW2tleSwgdmFsdWVdKSA9PiB0eXBlb2YgdmFsdWUgIT09ICdmdW5jdGlvbicpO1xuICBmb3IgKGxldCBba2V5LCB2YWx1ZV0gb2YgYXR0cmlidXRlcykge1xuICAgIHZhbHVlID09PSBmYWxzZSA/IGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGtleSkgOiBkb21Ob2RlLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKTtcbiAgfVxufSk7XG5leHBvcnQgY29uc3QgcmVtb3ZlQXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBhdHRyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3Qgc2V0VGV4dE5vZGUgPSB2YWwgPT4gbm9kZSA9PiBub2RlLnRleHRDb250ZW50ID0gdmFsO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlRG9tTm9kZSA9IHZub2RlID0+IHtcbiAgcmV0dXJuIHZub2RlLm5vZGVUeXBlICE9PSAnVGV4dCcgP1xuICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodm5vZGUubm9kZVR5cGUpIDpcbiAgICBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShTdHJpbmcodm5vZGUucHJvcHMudmFsdWUpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudExpc3RlbmVycyA9IChwcm9wcykgPT4ge1xuICByZXR1cm4gT2JqZWN0LmtleXMocHJvcHMpXG4gICAgLmZpbHRlcihrID0+IGsuc3Vic3RyKDAsIDIpID09PSAnb24nKVxuICAgIC5tYXAoayA9PiBbay5zdWJzdHIoMikudG9Mb3dlckNhc2UoKSwgcHJvcHNba11dKTtcbn07XG4iLCJleHBvcnQgY29uc3QgdHJhdmVyc2UgPSBmdW5jdGlvbiAqICh2bm9kZSkge1xuICB5aWVsZCB2bm9kZTtcbiAgaWYgKHZub2RlLmNoaWxkcmVuICYmIHZub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgIGZvciAobGV0IGNoaWxkIG9mIHZub2RlLmNoaWxkcmVuKSB7XG4gICAgICB5aWVsZCAqIHRyYXZlcnNlKGNoaWxkKTtcbiAgICB9XG4gIH1cbn07IiwiaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7XG4gIGlzU2hhbGxvd0VxdWFsLFxuICBwYWlyaWZ5LFxuICBuZXh0VGljayxcbiAgbm9vcFxufSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlQXR0cmlidXRlcyxcbiAgc2V0QXR0cmlidXRlcyxcbiAgc2V0VGV4dE5vZGUsXG4gIGNyZWF0ZURvbU5vZGUsXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXJzLFxuICBhZGRFdmVudExpc3RlbmVycyxcbiAgZ2V0RXZlbnRMaXN0ZW5lcnMsXG59IGZyb20gJy4vZG9tVXRpbCc7XG5pbXBvcnQge3RyYXZlcnNlfSBmcm9tICcuL3RyYXZlcnNlJztcblxuZnVuY3Rpb24gdXBkYXRlRXZlbnRMaXN0ZW5lcnMgKHtwcm9wczpuZXdOb2RlUHJvcHN9PXt9LCB7cHJvcHM6b2xkTm9kZVByb3BzfT17fSkge1xuICBjb25zdCBuZXdOb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMobmV3Tm9kZVByb3BzIHx8IHt9KTtcbiAgY29uc3Qgb2xkTm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG9sZE5vZGVQcm9wcyB8fCB7fSk7XG5cbiAgcmV0dXJuIG5ld05vZGVFdmVudHMubGVuZ3RoIHx8IG9sZE5vZGVFdmVudHMubGVuZ3RoID9cbiAgICBjb21wb3NlKFxuICAgICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMob2xkTm9kZUV2ZW50cyksXG4gICAgICBhZGRFdmVudExpc3RlbmVycyhuZXdOb2RlRXZlbnRzKVxuICAgICkgOiBub29wO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBdHRyaWJ1dGVzIChuZXdWTm9kZSwgb2xkVk5vZGUpIHtcbiAgY29uc3QgbmV3Vk5vZGVQcm9wcyA9IG5ld1ZOb2RlLnByb3BzIHx8IHt9O1xuICBjb25zdCBvbGRWTm9kZVByb3BzID0gb2xkVk5vZGUucHJvcHMgfHwge307XG5cbiAgaWYgKGlzU2hhbGxvd0VxdWFsKG5ld1ZOb2RlUHJvcHMsIG9sZFZOb2RlUHJvcHMpKSB7XG4gICAgcmV0dXJuIG5vb3A7XG4gIH1cblxuICBpZiAobmV3Vk5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgIHJldHVybiBzZXRUZXh0Tm9kZShuZXdWTm9kZS5wcm9wcy52YWx1ZSk7XG4gIH1cblxuICBjb25zdCBuZXdOb2RlS2V5cyA9IE9iamVjdC5rZXlzKG5ld1ZOb2RlUHJvcHMpO1xuICBjb25zdCBvbGROb2RlS2V5cyA9IE9iamVjdC5rZXlzKG9sZFZOb2RlUHJvcHMpO1xuICBjb25zdCBhdHRyaWJ1dGVzVG9SZW1vdmUgPSBvbGROb2RlS2V5cy5maWx0ZXIoayA9PiAhbmV3Tm9kZUtleXMuaW5jbHVkZXMoaykpO1xuXG4gIHJldHVybiBjb21wb3NlKFxuICAgIHJlbW92ZUF0dHJpYnV0ZXMoYXR0cmlidXRlc1RvUmVtb3ZlKSxcbiAgICBzZXRBdHRyaWJ1dGVzKG5ld05vZGVLZXlzLm1hcChwYWlyaWZ5KG5ld1ZOb2RlUHJvcHMpKSlcbiAgKTtcbn1cblxuY29uc3QgZG9tRmFjdG9yeSA9IGNyZWF0ZURvbU5vZGU7XG5cbi8vIGFwcGx5IHZub2RlIGRpZmZpbmcgdG8gYWN0dWFsIGRvbSBub2RlIChpZiBuZXcgbm9kZSA9PiBpdCB3aWxsIGJlIG1vdW50ZWQgaW50byB0aGUgcGFyZW50KVxuY29uc3QgZG9taWZ5ID0gZnVuY3Rpb24gdXBkYXRlRG9tIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpIHtcbiAgaWYgKCFvbGRWbm9kZSkgey8vdGhlcmUgaXMgbm8gcHJldmlvdXMgdm5vZGVcbiAgICBpZiAobmV3Vm5vZGUpIHsvL25ldyBub2RlID0+IHdlIGluc2VydFxuICAgICAgbmV3Vm5vZGUuZG9tID0gcGFyZW50RG9tTm9kZS5hcHBlbmRDaGlsZChkb21GYWN0b3J5KG5ld1Zub2RlKSk7XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSAxO1xuICAgICAgcmV0dXJuIHt2bm9kZTogbmV3Vm5vZGUsIGdhcmJhZ2U6IG51bGx9O1xuICAgIH0gZWxzZSB7Ly9lbHNlIChpcnJlbGV2YW50KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBvcGVyYXRpb24nKVxuICAgIH1cbiAgfSBlbHNlIHsvL3RoZXJlIGlzIGEgcHJldmlvdXMgdm5vZGVcbiAgICBpZiAoIW5ld1Zub2RlKSB7Ly93ZSBtdXN0IHJlbW92ZSB0aGUgcmVsYXRlZCBkb20gbm9kZVxuICAgICAgcGFyZW50RG9tTm9kZS5yZW1vdmVDaGlsZChvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuICh7Z2FyYmFnZTogb2xkVm5vZGUsIGRvbTogbnVsbH0pO1xuICAgIH0gZWxzZSBpZiAobmV3Vm5vZGUubm9kZVR5cGUgIT09IG9sZFZub2RlLm5vZGVUeXBlKSB7Ly9pdCBtdXN0IGJlIHJlcGxhY2VkXG4gICAgICBuZXdWbm9kZS5kb20gPSBkb21GYWN0b3J5KG5ld1Zub2RlKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICBwYXJlbnREb21Ob2RlLnJlcGxhY2VDaGlsZChuZXdWbm9kZS5kb20sIG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4ge2dhcmJhZ2U6IG9sZFZub2RlLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH0gZWxzZSB7Ly8gb25seSB1cGRhdGUgYXR0cmlidXRlc1xuICAgICAgbmV3Vm5vZGUuZG9tID0gb2xkVm5vZGUuZG9tO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gb2xkVm5vZGUubGlmZUN5Y2xlICsgMTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogbnVsbCwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogcmVuZGVyIGEgdmlydHVhbCBkb20gbm9kZSwgZGlmZmluZyBpdCB3aXRoIGl0cyBwcmV2aW91cyB2ZXJzaW9uLCBtb3VudGluZyBpdCBpbiBhIHBhcmVudCBkb20gbm9kZVxuICogQHBhcmFtIG9sZFZub2RlXG4gKiBAcGFyYW0gbmV3Vm5vZGVcbiAqIEBwYXJhbSBwYXJlbnREb21Ob2RlXG4gKiBAcGFyYW0gb25OZXh0VGljayBjb2xsZWN0IG9wZXJhdGlvbnMgdG8gYmUgcHJvY2Vzc2VkIG9uIG5leHQgdGlja1xuICogQHJldHVybnMge0FycmF5fVxuICovXG5leHBvcnQgY29uc3QgcmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyZXIgKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSwgb25OZXh0VGljayA9IFtdKSB7XG5cbiAgLy8xLiB0cmFuc2Zvcm0gdGhlIG5ldyB2bm9kZSB0byBhIHZub2RlIGNvbm5lY3RlZCB0byBhbiBhY3R1YWwgZG9tIGVsZW1lbnQgYmFzZWQgb24gdm5vZGUgdmVyc2lvbnMgZGlmZmluZ1xuICAvLyBpLiBub3RlIGF0IHRoaXMgc3RlcCBvY2N1ciBkb20gaW5zZXJ0aW9ucy9yZW1vdmFsc1xuICAvLyBpaS4gaXQgbWF5IGNvbGxlY3Qgc3ViIHRyZWUgdG8gYmUgZHJvcHBlZCAob3IgXCJ1bm1vdW50ZWRcIilcbiAgY29uc3Qge3Zub2RlLCBnYXJiYWdlfSA9IGRvbWlmeShvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpO1xuXG4gIGlmIChnYXJiYWdlICE9PSBudWxsKSB7XG4gICAgLy8gZGVmZXIgdW5tb3VudCBsaWZlY3ljbGUgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBmb3IgKGxldCBnIG9mIHRyYXZlcnNlKGdhcmJhZ2UpKSB7XG4gICAgICBpZiAoZy5vblVuTW91bnQpIHtcbiAgICAgICAgb25OZXh0VGljay5wdXNoKGcub25Vbk1vdW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvL05vcm1hbGlzYXRpb24gb2Ygb2xkIG5vZGUgKGluIGNhc2Ugb2YgYSByZXBsYWNlIHdlIHdpbGwgY29uc2lkZXIgb2xkIG5vZGUgYXMgZW1wdHkgbm9kZSAobm8gY2hpbGRyZW4sIG5vIHByb3BzKSlcbiAgY29uc3QgdGVtcE9sZE5vZGUgPSBnYXJiYWdlICE9PSBudWxsIHx8ICFvbGRWbm9kZSA/IHtsZW5ndGg6IDAsIGNoaWxkcmVuOiBbXSwgcHJvcHM6IHt9fSA6IG9sZFZub2RlO1xuXG4gIGlmICh2bm9kZSkge1xuXG4gICAgLy8yLiB1cGRhdGUgZG9tIGF0dHJpYnV0ZXMgYmFzZWQgb24gdm5vZGUgcHJvcCBkaWZmaW5nLlxuICAgIC8vc3luY1xuICAgIGlmICh2bm9kZS5vblVwZGF0ZSAmJiB2bm9kZS5saWZlQ3ljbGUgPiAxKSB7XG4gICAgICB2bm9kZS5vblVwZGF0ZSgpO1xuICAgIH1cblxuICAgIHVwZGF0ZUF0dHJpYnV0ZXModm5vZGUsIHRlbXBPbGROb2RlKSh2bm9kZS5kb20pO1xuXG4gICAgLy9mYXN0IHBhdGhcbiAgICBpZiAodm5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgICAgcmV0dXJuIG9uTmV4dFRpY2s7XG4gICAgfVxuXG4gICAgaWYgKHZub2RlLm9uTW91bnQgJiYgdm5vZGUubGlmZUN5Y2xlID09PSAxKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gdm5vZGUub25Nb3VudCgpKTtcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbkNvdW50ID0gTWF0aC5tYXgodGVtcE9sZE5vZGUuY2hpbGRyZW4ubGVuZ3RoLCB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpO1xuXG4gICAgLy9hc3luYyB3aWxsIGJlIGRlZmVycmVkIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgY29uc3Qgc2V0TGlzdGVuZXJzID0gdXBkYXRlRXZlbnRMaXN0ZW5lcnModm5vZGUsIHRlbXBPbGROb2RlKTtcbiAgICBpZiAoc2V0TGlzdGVuZXJzICE9PSBub29wKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gc2V0TGlzdGVuZXJzKHZub2RlLmRvbSkpO1xuICAgIH1cblxuICAgIC8vMyByZWN1cnNpdmVseSB0cmF2ZXJzZSBjaGlsZHJlbiB0byB1cGRhdGUgZG9tIGFuZCBjb2xsZWN0IGZ1bmN0aW9ucyB0byBwcm9jZXNzIG9uIG5leHQgdGlja1xuICAgIGlmIChjaGlsZHJlbkNvdW50ID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbkNvdW50OyBpKyspIHtcbiAgICAgICAgLy8gd2UgcGFzcyBvbk5leHRUaWNrIGFzIHJlZmVyZW5jZSAoaW1wcm92ZSBwZXJmOiBtZW1vcnkgKyBzcGVlZClcbiAgICAgICAgcmVuZGVyKHRlbXBPbGROb2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuZG9tLCBvbk5leHRUaWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb25OZXh0VGljaztcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBoeWRyYXRlICh2bm9kZSwgZG9tKSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgY29uc3QgaHlkcmF0ZWQgPSBPYmplY3QuYXNzaWduKHt9LCB2bm9kZSk7XG4gIGNvbnN0IGRvbUNoaWxkcmVuID0gZG9tLmNoaWxkcmVuO1xuICBoeWRyYXRlZC5kb20gPSBkb207XG4gIGh5ZHJhdGVkLmNoaWxkcmVuLm1hcCgoY2hpbGQsIGkpID0+IGh5ZHJhdGUoY2hpbGQsIGRvbUNoaWxkcmVuW2ldKSk7XG4gIHJldHVybiBoeWRyYXRlZDtcbn1cblxuZXhwb3J0IGNvbnN0IG1vdW50ID0gY3VycnkoZnVuY3Rpb24gKGNvbXAsIGluaXRQcm9wLCByb290KSB7XG4gIGNvbnN0IHZub2RlID0gY29tcC5ub2RlVHlwZSAhPT0gdm9pZCAwID8gY29tcCA6IGNvbXAoaW5pdFByb3AgfHwge30pO1xuICBjb25zdCBvbGRWTm9kZSA9IHJvb3QuY2hpbGRyZW4ubGVuZ3RoID8gaHlkcmF0ZSh2bm9kZSwgcm9vdC5jaGlsZHJlblswXSkgOiBudWxsO1xuICBjb25zdCBiYXRjaCA9IHJlbmRlcihvbGRWTm9kZSwgdm5vZGUsIHJvb3QpO1xuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgZm9yIChsZXQgb3Agb2YgYmF0Y2gpIHtcbiAgICAgIG9wKCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHZub2RlO1xufSk7IiwiaW1wb3J0IHtyZW5kZXJ9IGZyb20gJy4vdHJlZSc7XG5pbXBvcnQge25leHRUaWNrfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgdHJpZ2dlciBhbiB1cGRhdGUgb2YgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBwYXNzZWQgc3RhdGVcbiAqIEBwYXJhbSBjb21wIHtGdW5jdGlvbn0gLSB0aGUgY29tcG9uZW50IHRvIHVwZGF0ZVxuICogQHBhcmFtIGluaXRpYWxWTm9kZSAtIHRoZSBpbml0aWFsIHZpcnR1YWwgZG9tIG5vZGUgcmVsYXRlZCB0byB0aGUgY29tcG9uZW50IChpZSBvbmNlIGl0IGhhcyBiZWVuIG1vdW50ZWQpXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gdGhlIHVwZGF0ZSBmdW5jdGlvblxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB1cGRhdGUgKGNvbXAsIGluaXRpYWxWTm9kZSkge1xuICBsZXQgb2xkTm9kZSA9IGluaXRpYWxWTm9kZTtcbiAgY29uc3QgdXBkYXRlRnVuYyA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IG1vdW50ID0gb2xkTm9kZS5kb20ucGFyZW50Tm9kZTtcbiAgICBjb25zdCBuZXdOb2RlID0gY29tcChPYmplY3QuYXNzaWduKHtjaGlsZHJlbjogb2xkTm9kZS5jaGlsZHJlbiB8fCBbXX0sIG9sZE5vZGUucHJvcHMsIHByb3BzKSwgLi4uYXJncyk7XG4gICAgY29uc3QgbmV4dEJhdGNoID0gcmVuZGVyKG9sZE5vZGUsIG5ld05vZGUsIG1vdW50KTtcblxuICAgIC8vIGRhbmdlciB6b25lICEhISFcbiAgICAvLyBjaGFuZ2UgYnkga2VlcGluZyB0aGUgc2FtZSByZWZlcmVuY2Ugc28gdGhlIGV2ZW50dWFsIHBhcmVudCBub2RlIGRvZXMgbm90IG5lZWQgdG8gYmUgXCJhd2FyZVwiIHRyZWUgbWF5IGhhdmUgY2hhbmdlZCBkb3duc3RyZWFtOiBvbGROb2RlIG1heSBiZSB0aGUgY2hpbGQgb2Ygc29tZW9uZSAuLi4od2VsbCB0aGF0IGlzIGEgdHJlZSBkYXRhIHN0cnVjdHVyZSBhZnRlciBhbGwgOlAgKVxuICAgIG9sZE5vZGUgPSBPYmplY3QuYXNzaWduKG9sZE5vZGUgfHwge30sIG5ld05vZGUpO1xuICAgIC8vIGVuZCBkYW5nZXIgem9uZVxuXG4gICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgZm9yIChsZXQgb3Agb2YgbmV4dEJhdGNoKSB7XG4gICAgICAgIG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGU7XG4gIH07XG4gIHJldHVybiB1cGRhdGVGdW5jO1xufSIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IGxpZmVDeWNsZUZhY3RvcnkgPSBtZXRob2QgPT4gY3VycnkoKGZuLCBjb21wKSA9PiAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgY29uc3QgbiA9IGNvbXAocHJvcHMsIC4uLmFyZ3MpO1xuICBuW21ldGhvZF0gPSAoKSA9PiBmbihuLCAuLi5hcmdzKTtcbiAgcmV0dXJuIG47XG59KTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgbW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uTW91bnQnKTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgdW5tb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvblVuTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvblVuTW91bnQnKTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiBiZWZvcmUgdGhlIGNvbXBvbmVudCBpcyB1cGRhdGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvblVwZGF0ZSA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVXBkYXRlJyk7IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnQsIG9uVXBkYXRlfSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgXCJzdGF0ZWZ1bCBjb21wb25lbnRcIjogaWUgaXQgd2lsbCBoYXZlIGl0cyBvd24gc3RhdGUgYW5kIHRoZSBhYmlsaXR5IHRvIHVwZGF0ZSBpdHMgb3duIHRyZWVcbiAqIEBwYXJhbSBjb21wIHtGdW5jdGlvbn0gLSB0aGUgY29tcG9uZW50XG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gYSBuZXcgd3JhcHBlZCBjb21wb25lbnRcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGNvbXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBsZXQgdXBkYXRlRnVuYztcbiAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgLy9sYXp5IGV2YWx1YXRlIHVwZGF0ZUZ1bmMgKHRvIG1ha2Ugc3VyZSBpdCBpcyBkZWZpbmVkXG4gICAgICBjb25zdCBzZXRTdGF0ZSA9IChuZXdTdGF0ZSkgPT4gdXBkYXRlRnVuYyhuZXdTdGF0ZSk7XG4gICAgICByZXR1cm4gY29tcChwcm9wcywgc2V0U3RhdGUsIC4uLmFyZ3MpO1xuICAgIH07XG4gICAgY29uc3Qgc2V0VXBkYXRlRnVuY3Rpb24gPSAodm5vZGUpID0+IHtcbiAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUod3JhcHBlckNvbXAsIHZub2RlKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBvc2Uob25Nb3VudChzZXRVcGRhdGVGdW5jdGlvbiksIG9uVXBkYXRlKHNldFVwZGF0ZUZ1bmN0aW9uKSkod3JhcHBlckNvbXApO1xuICB9O1xufTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudH0gZnJvbSAnLi9saWZlQ3ljbGVzJztcbmltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuLyoqXG4gKiBDb21iaW5hdG9yIHRvIGNyZWF0ZSBhIEVsbSBsaWtlIGFwcFxuICogQHBhcmFtIHZpZXcge0Z1bmN0aW9ufSAtIGEgY29tcG9uZW50IHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50cyB0aGUgY3VycmVudCBtb2RlbCBhbmQgdGhlIGxpc3Qgb2YgdXBkYXRlc1xuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIGEgRWxtIGxpa2UgYXBwbGljYXRpb24gd2hvc2UgcHJvcGVydGllcyBcIm1vZGVsXCIsIFwidXBkYXRlc1wiIGFuZCBcInN1YnNjcmlwdGlvbnNcIiB3aWxsIGRlZmluZSB0aGUgcmVsYXRlZCBkb21haW4gc3BlY2lmaWMgb2JqZWN0c1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAodmlldykge1xuICByZXR1cm4gZnVuY3Rpb24gKHttb2RlbCwgdXBkYXRlcywgc3Vic2NyaXB0aW9ucyA9IFtdfT17fSkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGxldCBhY3Rpb25TdG9yZSA9IHt9O1xuICAgIGZvciAobGV0IHVwZGF0ZSBvZiBPYmplY3Qua2V5cyh1cGRhdGVzKSkge1xuICAgICAgYWN0aW9uU3RvcmVbdXBkYXRlXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIG1vZGVsID0gdXBkYXRlc1t1cGRhdGVdKG1vZGVsLCAuLi5hcmdzKTsgLy90b2RvIGNvbnNpZGVyIHNpZGUgZWZmZWN0cywgbWlkZGxld2FyZXMsIGV0Y1xuICAgICAgICByZXR1cm4gdXBkYXRlRnVuYyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbXAgPSAoKSA9PiB2aWV3KG1vZGVsLCBhY3Rpb25TdG9yZSk7XG5cbiAgICBjb25zdCBpbml0QWN0aW9uU3RvcmUgPSAodm5vZGUpID0+IHtcbiAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUoY29tcCwgdm5vZGUpO1xuICAgIH07XG4gICAgY29uc3QgaW5pdFN1YnNjcmlwdGlvbiA9IHN1YnNjcmlwdGlvbnMubWFwKHN1YiA9PiB2bm9kZSA9PiBzdWIodm5vZGUsIGFjdGlvblN0b3JlKSk7XG4gICAgY29uc3QgaW5pdEZ1bmMgPSBjb21wb3NlKGluaXRBY3Rpb25TdG9yZSwgLi4uaW5pdFN1YnNjcmlwdGlvbik7XG5cbiAgICByZXR1cm4gb25Nb3VudChpbml0RnVuYywgY29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7b25Nb3VudCwgb25Vbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnXG5pbXBvcnQge2lzRGVlcEVxdWFsLCBpZGVudGl0eX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb25uZWN0IGNvbWJpbmF0b3I6IHdpbGwgY3JlYXRlIFwiY29udGFpbmVyXCIgY29tcG9uZW50IHdoaWNoIHdpbGwgc3Vic2NyaWJlIHRvIGEgUmVkdXggbGlrZSBzdG9yZS4gYW5kIHVwZGF0ZSBpdHMgY2hpbGRyZW4gd2hlbmV2ZXIgYSBzcGVjaWZpYyBzbGljZSBvZiBzdGF0ZSBjaGFuZ2UgdW5kZXIgc3BlY2lmaWMgY2lyY3Vtc3RhbmNlc1xuICogQHBhcmFtIHN0b3JlIHtPYmplY3R9IC0gVGhlIHN0b3JlIChpbXBsZW1lbnRpbmcgdGhlIHNhbWUgYXBpIHRoYW4gUmVkdXggc3RvcmVcbiAqIEBwYXJhbSBhY3Rpb25zIHtPYmplY3R9IFt7fV0gLSBUaGUgbGlzdCBvZiBhY3Rpb25zIHRoZSBjb25uZWN0ZWQgY29tcG9uZW50IHdpbGwgYmUgYWJsZSB0byB0cmlnZ2VyXG4gKiBAcGFyYW0gc2xpY2VTdGF0ZSB7RnVuY3Rpb259IFtzdGF0ZSA9PiBzdGF0ZV0gLSBBIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50IHRoZSBzdGF0ZSBhbmQgcmV0dXJuIGEgXCJ0cmFuc2Zvcm1lZFwiIHN0YXRlIChsaWtlIHBhcnRpYWwsIGV0YykgcmVsZXZhbnQgdG8gdGhlIGNvbnRhaW5lclxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIEEgY29udGFpbmVyIGZhY3Rvcnkgd2l0aCB0aGUgZm9sbG93aW5nIGFyZ3VtZW50czpcbiAqICAtIGNvbXA6IHRoZSBjb21wb25lbnQgdG8gd3JhcCBub3RlIHRoZSBhY3Rpb25zIG9iamVjdCB3aWxsIGJlIHBhc3NlZCBhcyBzZWNvbmQgYXJndW1lbnQgb2YgdGhlIGNvbXBvbmVudCBmb3IgY29udmVuaWVuY2VcbiAqICAtIG1hcFN0YXRlVG9Qcm9wOiBhIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50IHdoYXQgdGhlIFwic2xpY2VTdGF0ZVwiIGZ1bmN0aW9uIHJldHVybnMgYW5kIHJldHVybnMgYW4gb2JqZWN0IHRvIGJlIGJsZW5kZWQgaW50byB0aGUgcHJvcGVydGllcyBvZiB0aGUgY29tcG9uZW50IChkZWZhdWx0IHRvIGlkZW50aXR5IGZ1bmN0aW9uKVxuICogIC0gc2hvdWxkVXBkYXRlOiBhIGZ1bmN0aW9uIHdoaWNoIHRha2VzIGFzIGFyZ3VtZW50cyB0aGUgcHJldmlvdXMgYW5kIHRoZSBjdXJyZW50IHZlcnNpb25zIG9mIHdoYXQgXCJzbGljZVN0YXRlXCIgZnVuY3Rpb24gcmV0dXJucyB0byByZXR1cm5zIGEgYm9vbGVhbiBkZWZpbmluZyB3aGV0aGVyIHRoZSBjb21wb25lbnQgc2hvdWxkIGJlIHVwZGF0ZWQgKGRlZmF1bHQgdG8gYSBkZWVwRXF1YWwgY2hlY2spXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChzdG9yZSwgYWN0aW9ucyA9IHt9LCBzbGljZVN0YXRlID0gaWRlbnRpdHkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChjb21wLCBtYXBTdGF0ZVRvUHJvcCA9IGlkZW50aXR5LCBzaG91bGRVcGF0ZSA9IChhLCBiKSA9PiBpc0RlZXBFcXVhbChhLCBiKSA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGluaXRQcm9wKSB7XG4gICAgICBsZXQgY29tcG9uZW50UHJvcHMgPSBpbml0UHJvcDtcbiAgICAgIGxldCB1cGRhdGVGdW5jLCBwcmV2aW91c1N0YXRlU2xpY2UsIHVuc3Vic2NyaWJlcjtcblxuICAgICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgcmV0dXJuIGNvbXAocHJvcHMsIGFjdGlvbnMsIC4uLmFyZ3MpO1xuICAgICAgfTtcblxuICAgICAgY29uc3Qgc3Vic2NyaWJlID0gb25Nb3VudCgodm5vZGUpID0+IHtcbiAgICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgICAgICB1bnN1YnNjcmliZXIgPSBzdG9yZS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHN0YXRlU2xpY2UgPSBzbGljZVN0YXRlKHN0b3JlLmdldFN0YXRlKCkpO1xuICAgICAgICAgIGlmIChzaG91bGRVcGF0ZShwcmV2aW91c1N0YXRlU2xpY2UsIHN0YXRlU2xpY2UpID09PSB0cnVlKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGNvbXBvbmVudFByb3BzLCBtYXBTdGF0ZVRvUHJvcChzdGF0ZVNsaWNlKSk7XG4gICAgICAgICAgICB1cGRhdGVGdW5jKGNvbXBvbmVudFByb3BzKTtcbiAgICAgICAgICAgIHByZXZpb3VzU3RhdGVTbGljZSA9IHN0YXRlU2xpY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB1bnN1YnNjcmliZSA9IG9uVW5Nb3VudCgoKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlcigpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBjb21wb3NlKHN1YnNjcmliZSwgdW5zdWJzY3JpYmUpKHdyYXBwZXJDb21wKTtcbiAgICB9O1xuICB9O1xufTsiLCJpbXBvcnQge2h9IGZyb20gXCIuLi8uLi9pbmRleFwiXG5cbmV4cG9ydCBkZWZhdWx0ICh7bW9kZWwsIGFjdGlvbnN9KSA9PiBtb2RlbC5kYXRhLm1hcCgoe2lkLCBsYWJlbH0sIGkpID0+XG4gIDx0ciBjbGFzcz17aWQgPT09IG1vZGVsLnNlbGVjdGVkID8gXCJkYW5nZXJcIiA6IFwiXCJ9PlxuICAgIDx0ZCBjbGFzcz1cImNvbC1tZC0xXCI+e2lkfTwvdGQ+XG4gICAgPHRkIGNsYXNzPVwiY29sLW1kLTRcIj5cbiAgICAgIDxhIG9uY2xpY2s9e18gPT4gYWN0aW9ucy5zZWxlY3Qoe2lkfSl9PntsYWJlbH08L2E+XG4gICAgPC90ZD5cbiAgICA8dGQgY2xhc3M9XCJjb2wtbWQtMVwiPlxuICAgICAgPGEgb25jbGljaz17XyA9PiBhY3Rpb25zLmRlbGV0ZSh7aWR9KX0+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJnbHlwaGljb24gZ2x5cGhpY29uLXJlbW92ZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPlxuICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgIDwvYT5cbiAgICA8L3RkPlxuICAgIDx0ZCBjbGFzcz1cImNvbC1tZC02XCI+PC90ZD5cbiAgPC90cj5cbilcbiIsIid1c2Ugc3RyaWN0JztcbmltcG9ydCB7bW9kZWwsIHJlZHVjZXJzfSBmcm9tIFwiLi9zdG9yZVwiXG5pbXBvcnQgUm93c1ZpZXcgZnJvbSBcIi4vcm93c1wiXG5pbXBvcnQge2VsbSBhcyBhcHAsIGgsIG1vdW50fSBmcm9tICcuLi8uLi9pbmRleCdcblxubGV0IHN0YXJ0VGltZTtcbmxldCBsYXN0TWVhc3VyZTtcblxuZnVuY3Rpb24gc3RhcnRNZWFzdXJlIChuYW1lLCBjYikge1xuICBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKVxuICAvLyBwZXJmb3JtYW5jZS5tYXJrKCdzdGFydCAnICsgbmFtZSk7XG4gIGxhc3RNZWFzdXJlID0gbmFtZTtcbiAgY2IoKTtcbn1cblxuZnVuY3Rpb24gc3RvcE1lYXN1cmUgKCkge1xuICBjb25zdCBsYXN0ID0gbGFzdE1lYXN1cmU7XG5cbiAgaWYgKGxhc3RNZWFzdXJlKSB7XG4gICAgd2luZG93LnNldFRpbWVvdXQoXG4gICAgICBmdW5jdGlvbiBtZXRhU3RvcE1lYXN1cmUgKCkge1xuICAgICAgICBsYXN0TWVhc3VyZSA9IG51bGxcbiAgICAgICAgY29uc3Qgc3RvcCA9IHBlcmZvcm1hbmNlLm5vdygpXG4gICAgICAgIC8vIHBlcmZvcm1hbmNlLm1hcmsoJ2VuZCAnICsgbGFzdCk7XG4gICAgICAgIC8vIHBlcmZvcm1hbmNlLm1lYXN1cmUobGFzdCwgJ3N0YXJ0ICcgKyBsYXN0LCAnZW5kICcgKyBsYXN0KTtcbiAgICAgICAgY29uc29sZS5sb2cobGFzdCArIFwiIHRvb2sgXCIgKyAoc3RvcCAtIHN0YXJ0VGltZSkpXG4gICAgICB9LFxuICAgICAgMFxuICAgIClcbiAgfVxufVxuXG5mdW5jdGlvbiB2aWV3IChtb2RlbCwgYWN0aW9ucykge1xuICBzdG9wTWVhc3VyZSgpXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxuICAgICAgPGRpdiBjbGFzcz1cImp1bWJvdHJvblwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwicm93XCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1tZC02XCI+XG4gICAgICAgICAgICA8aDE+RmxhY28gMC4xLjA8L2gxPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtbWQtNlwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInJvd1wiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLXNtLTYgc21hbGxwYWRcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9ja1wiXG4gICAgICAgICAgICAgICAgICBpZD1cInJ1blwiXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtfID0+XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TWVhc3VyZShcInJ1blwiLCBhY3Rpb25zLnJ1bil9PlxuICAgICAgICAgICAgICAgICAgQ3JlYXRlIDEsMDAwIHJvd3NcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtc20tNiBzbWFsbHBhZFwiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgIGlkPVwicnVubG90c1wiXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtfID0+XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TWVhc3VyZShcbiAgICAgICAgICAgICAgICAgICAgICBcInJ1bkxvdHNcIixcbiAgICAgICAgICAgICAgICAgICAgICBhY3Rpb25zLnJ1bkxvdHNcbiAgICAgICAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAgICBDcmVhdGUgMTAsMDAwIHJvd3NcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtc20tNiBzbWFsbHBhZFwiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgIGlkPVwiYWRkXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFwiYWRkXCIsIGFjdGlvbnMuYWRkKX0+XG4gICAgICAgICAgICAgICAgICBBcHBlbmQgMSwwMDAgcm93c1xuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1zbS02IHNtYWxscGFkXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tYmxvY2tcIlxuICAgICAgICAgICAgICAgICAgaWQ9XCJ1cGRhdGVcIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17XyA9PlxuICAgICAgICAgICAgICAgICAgICBzdGFydE1lYXN1cmUoXCJ1cGRhdGVcIiwgYWN0aW9ucy51cGRhdGUpfT5cbiAgICAgICAgICAgICAgICAgIFVwZGF0ZSBldmVyeSAxMHRoIHJvd1xuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1zbS02IHNtYWxscGFkXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tYmxvY2tcIlxuICAgICAgICAgICAgICAgICAgaWQ9XCJjbGVhclwiXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtfID0+XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TWVhc3VyZShcImNsZWFyXCIsIGFjdGlvbnMuY2xlYXIpfT5cbiAgICAgICAgICAgICAgICAgIENsZWFyXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLXNtLTYgc21hbGxwYWRcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9ja1wiXG4gICAgICAgICAgICAgICAgICBpZD1cInN3YXByb3dzXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFxuICAgICAgICAgICAgICAgICAgICAgIFwic3dhcFJvd3NcIixcbiAgICAgICAgICAgICAgICAgICAgICBhY3Rpb25zLnN3YXBSb3dzXG4gICAgICAgICAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICAgICAgU3dhcCBSb3dzXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8dGFibGUgY2xhc3M9XCJ0YWJsZSB0YWJsZS1ob3ZlciB0YWJsZS1zdHJpcGVkIHRlc3QtZGF0YVwiPlxuICAgICAgICA8dGJvZHk+XG4gICAgICAgIDxSb3dzVmlldyBtb2RlbD17bW9kZWx9IGFjdGlvbnM9e2FjdGlvbnN9Lz5cbiAgICAgICAgPC90Ym9keT5cbiAgICAgIDwvdGFibGU+XG4gICAgICA8c3BhblxuICAgICAgICBjbGFzcz1cInByZWxvYWRpY29uIGdseXBoaWNvbiBnbHlwaGljb24tcmVtb3ZlXCJcbiAgICAgICAgYXJpYS1oaWRkZW49XCJ0cnVlXCJcbiAgICAgIC8+XG4gICAgPC9kaXY+KTtcbn1cblxuY29uc3QgQmVuY2ggPSBhcHAodmlldyk7XG5cbm1vdW50KCh7bW9kZWwsIHVwZGF0ZXN9KSA9PiAoPEJlbmNoIG1vZGVsPXttb2RlbH0gdXBkYXRlcz17dXBkYXRlc30vPiksIHtcbiAgbW9kZWwsIHVwZGF0ZXM6IHJlZHVjZXJzXG59LCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm1haW5cIikpO1xuIl0sIm5hbWVzIjpbIm1vdW50IiwidXBkYXRlIiwibW9kZWwiXSwibWFwcGluZ3MiOiI7OztBQUFBLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQTs7QUFFVixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFBOztBQUV4QixTQUFTLFNBQVMsRUFBRSxLQUFLLEVBQUU7RUFDekIsTUFBTSxVQUFVLEdBQUc7SUFDakIsUUFBUTtJQUNSLE9BQU87SUFDUCxLQUFLO0lBQ0wsT0FBTztJQUNQLE1BQU07SUFDTixPQUFPO0lBQ1AsTUFBTTtJQUNOLFVBQVU7SUFDVixPQUFPO0lBQ1AsUUFBUTtJQUNSLE9BQU87SUFDUCxTQUFTO0lBQ1QsTUFBTTtJQUNOLE9BQU87SUFDUCxPQUFPO0lBQ1AsU0FBUztJQUNULE9BQU87SUFDUCxLQUFLO0lBQ0wsV0FBVztJQUNYLFVBQVU7SUFDVixXQUFXO0lBQ1gsYUFBYTtJQUNiLE9BQU87SUFDUCxXQUFXO0lBQ1gsT0FBTztHQUNSLENBQUE7O0VBRUQsTUFBTSxPQUFPLEdBQUc7SUFDZCxLQUFLO0lBQ0wsUUFBUTtJQUNSLE1BQU07SUFDTixPQUFPO0lBQ1AsTUFBTTtJQUNOLE9BQU87SUFDUCxRQUFRO0lBQ1IsT0FBTztJQUNQLE9BQU87SUFDUCxPQUFPO0lBQ1AsUUFBUTtHQUNULENBQUE7O0VBRUQsTUFBTSxLQUFLLEdBQUc7SUFDWixPQUFPO0lBQ1AsT0FBTztJQUNQLE9BQU87SUFDUCxLQUFLO0lBQ0wsTUFBTTtJQUNOLEtBQUs7SUFDTCxNQUFNO0lBQ04sUUFBUTtJQUNSLFVBQVU7SUFDVixRQUFRO0lBQ1IsT0FBTztJQUNQLE9BQU87SUFDUCxVQUFVO0dBQ1gsQ0FBQTs7RUFFRCxPQUFPLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLO0lBQ3hDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDUixLQUFLLEVBQUUsQ0FBQyxFQUFFLFVBQVU7SUFDcEIsSUFBSSxFQUFFLEdBQUcsSUFBSSxHQUFHLFVBQVUsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU87SUFDbEQsSUFBSSxFQUFFLEdBQUcsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUs7SUFDN0MsSUFBSSxFQUFFLEdBQUcsSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztHQUNyQyxDQUFDLENBQUM7Q0FDSjs7QUFFRCxNQUFNLEtBQUssR0FBRztFQUNaLElBQUksRUFBRSxFQUFFO0VBQ1IsUUFBUSxFQUFFLEtBQUs7Q0FDaEIsQ0FBQTs7QUFFRCxNQUFNLFFBQVEsR0FBRztFQUNmLEdBQUcsRUFBRSxLQUFLLEtBQUs7SUFDYixJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQztJQUNyQixRQUFRLEVBQUUsU0FBUztHQUNwQixDQUFDOztFQUVGLEdBQUcsRUFBRSxLQUFLLEtBQUs7SUFDYixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hDLFFBQVEsRUFBRSxTQUFTO0dBQ3BCLENBQUM7O0VBRUYsT0FBTyxFQUFFLEtBQUssS0FBSztJQUNqQixJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQztJQUN0QixRQUFRLEVBQUUsU0FBUztHQUNwQixDQUFDOztFQUVGLEtBQUssRUFBRSxLQUFLLEtBQUs7SUFDZixJQUFJLEVBQUUsRUFBRTtJQUNSLFFBQVEsRUFBRSxTQUFTO0dBQ3BCLENBQUM7O0VBRUYsTUFBTSxFQUFFLEtBQUssSUFBSTtJQUNmLE9BQU87TUFDTCxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLO1FBQzdCLElBQUksQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUU7VUFDaEIsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTtTQUMzQjtRQUNELE9BQU8sQ0FBQztPQUNULENBQUM7TUFDRixRQUFRLEVBQUUsU0FBUztLQUNwQjtHQUNGOztFQUVELFFBQVEsRUFBRSxLQUFLLElBQUk7SUFDakIsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxFQUFFLEVBQUU7TUFDM0IsT0FBTyxLQUFLO0tBQ2I7O0lBRUQsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUMxQixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFDN0IsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUE7O0lBRXBCLE9BQU87TUFDTCxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7TUFDaEIsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRO0tBQ3pCO0dBQ0Y7O0VBRUQsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksTUFBTTtJQUN4QixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7SUFDaEIsUUFBUSxFQUFFLElBQUksQ0FBQyxFQUFFO0dBQ2xCLENBQUM7O0VBRUYsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksTUFBTTtJQUN4QixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLEVBQUUsQ0FBQztHQUMvQyxDQUFDO0NBQ0gsQ0FBQSxBQUVELEFBRUM7O0FDeklELE1BQU0sZUFBZSxHQUFHLENBQUMsS0FBSyxNQUFNO0VBQ2xDLFFBQVEsRUFBRSxNQUFNO0VBQ2hCLFFBQVEsRUFBRSxFQUFFO0VBQ1osS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDO0VBQ2QsU0FBUyxFQUFFLENBQUM7Q0FDYixDQUFDLENBQUM7Ozs7Ozs7OztBQVNILEFBQWUsU0FBUyxDQUFDLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLFFBQVEsRUFBRTtFQUN2RCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssS0FBSztJQUNuRCxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzdELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztHQUNsQyxFQUFFLEVBQUUsQ0FBQztLQUNILEdBQUcsQ0FBQyxLQUFLLElBQUk7O01BRVosTUFBTSxJQUFJLEdBQUcsT0FBTyxLQUFLLENBQUM7TUFDMUIsT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksS0FBSyxVQUFVLEdBQUcsS0FBSyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNsRixDQUFDLENBQUM7O0VBRUwsSUFBSSxPQUFPLFFBQVEsS0FBSyxVQUFVLEVBQUU7SUFDbEMsT0FBTztNQUNMLFFBQVE7TUFDUixLQUFLLEVBQUUsS0FBSztNQUNaLFFBQVEsRUFBRSxZQUFZO01BQ3RCLFNBQVMsRUFBRSxDQUFDO0tBQ2IsQ0FBQztHQUNILE1BQU07SUFDTCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNqQyxPQUFPLE9BQU8sSUFBSSxLQUFLLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxZQUFZLENBQUMsQ0FBQztHQUM1RTtDQUNGOztBQ2pDTSxTQUFTLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxHQUFHLEVBQUU7RUFDdEMsT0FBTyxDQUFDLEdBQUcsSUFBSSxLQUFLLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxLQUFLLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQzFGOztBQUVELEFBQU8sU0FBUyxLQUFLLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRTtFQUNwQyxNQUFNLEtBQUssR0FBRyxTQUFTLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQztFQUNyQyxPQUFPLENBQUMsR0FBRyxJQUFJLEtBQUs7SUFDbEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7SUFDbkMsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO01BQ3ZCLE9BQU8sRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7S0FDcEIsTUFBTTtNQUNMLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxRQUFRLEtBQUssRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7TUFDdkQsT0FBTyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDekM7R0FDRixDQUFDO0NBQ0g7O0FBRUQsQUFBTyxBQUVOOztBQUVELEFBQU8sU0FBUyxHQUFHLEVBQUUsRUFBRSxFQUFFO0VBQ3ZCLE9BQU8sR0FBRyxJQUFJO0lBQ1osRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ1IsT0FBTyxHQUFHLENBQUM7R0FDWjs7O0FDN0JJLE1BQU0sUUFBUSxHQUFHLEVBQUUsSUFBSSxVQUFVLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDOztBQUVoRCxBQUFPLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7O0FBRTNELEFBQU8sTUFBTSxjQUFjLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLO0VBQ3RDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDN0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUM3QixPQUFPLEtBQUssQ0FBQyxNQUFNLEtBQUssS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMzRSxDQUFDOztBQUVGLEFBRUEsQUFBTyxBQUNMLEFBR0EsQUFJQSxBQUlBLEFBS0EsQUFJQSxBQUlBLEFBQ0EsQUFDQSxBQUNBOztBQUVGLEFBQU8sQUFBd0I7O0FBRS9CLEFBQU8sTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJO0NBQ3hCLENBQUM7O0FDM0NGLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLEtBQUssR0FBRyxDQUFDLE9BQU8sSUFBSTtFQUNqRSxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtJQUN0QixPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztHQUMxQjtDQUNGLENBQUMsQ0FBQzs7QUFFSCxBQUFPLE1BQU0sb0JBQW9CLEdBQUcsb0JBQW9CLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUNoRixBQUFPLE1BQU0saUJBQWlCLEdBQUcsb0JBQW9CLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUMxRSxBQUFPLE1BQU0sYUFBYSxHQUFHLENBQUMsS0FBSyxLQUFLLEdBQUcsQ0FBQyxDQUFDLE9BQU8sS0FBSztFQUN2RCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEtBQUssT0FBTyxLQUFLLEtBQUssVUFBVSxDQUFDLENBQUM7RUFDL0UsS0FBSyxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLFVBQVUsRUFBRTtJQUNuQyxLQUFLLEtBQUssS0FBSyxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7R0FDbkY7Q0FDRixDQUFDLENBQUM7QUFDSCxBQUFPLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxLQUFLLEtBQUssR0FBRyxDQUFDLE9BQU8sSUFBSTtFQUN4RCxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtJQUN0QixPQUFPLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0dBQy9CO0NBQ0YsQ0FBQyxDQUFDOztBQUVILEFBQU8sTUFBTSxXQUFXLEdBQUcsR0FBRyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQzs7QUFFakUsQUFBTyxNQUFNLGFBQWEsR0FBRyxLQUFLLElBQUk7RUFDcEMsT0FBTyxLQUFLLENBQUMsUUFBUSxLQUFLLE1BQU07SUFDOUIsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO0lBQ3RDLFFBQVEsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztDQUN0RCxDQUFDOztBQUVGLEFBQU8sTUFBTSxpQkFBaUIsR0FBRyxDQUFDLEtBQUssS0FBSztFQUMxQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0tBQ3RCLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDO0tBQ3BDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEQsQ0FBQzs7QUNsQ0ssTUFBTSxRQUFRLEdBQUcsWUFBWSxLQUFLLEVBQUU7RUFDekMsTUFBTSxLQUFLLENBQUM7RUFDWixJQUFJLEtBQUssQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUU7SUFDM0MsS0FBSyxJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO01BQ2hDLFFBQVEsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ3pCO0dBQ0Y7Q0FDRjs7QUNXRCxTQUFTLG9CQUFvQixFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLEVBQUU7RUFDL0UsTUFBTSxhQUFhLEdBQUcsaUJBQWlCLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0VBQzVELE1BQU0sYUFBYSxHQUFHLGlCQUFpQixDQUFDLFlBQVksSUFBSSxFQUFFLENBQUMsQ0FBQzs7RUFFNUQsT0FBTyxhQUFhLENBQUMsTUFBTSxJQUFJLGFBQWEsQ0FBQyxNQUFNO0lBQ2pELE9BQU87TUFDTCxvQkFBb0IsQ0FBQyxhQUFhLENBQUM7TUFDbkMsaUJBQWlCLENBQUMsYUFBYSxDQUFDO0tBQ2pDLEdBQUcsSUFBSSxDQUFDO0NBQ1o7O0FBRUQsU0FBUyxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO0VBQzdDLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO0VBQzNDLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDOztFQUUzQyxJQUFJLGNBQWMsQ0FBQyxhQUFhLEVBQUUsYUFBYSxDQUFDLEVBQUU7SUFDaEQsT0FBTyxJQUFJLENBQUM7R0FDYjs7RUFFRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLEtBQUssTUFBTSxFQUFFO0lBQ2hDLE9BQU8sV0FBVyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7R0FDMUM7O0VBRUQsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztFQUMvQyxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0VBQy9DLE1BQU0sa0JBQWtCLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0VBRTdFLE9BQU8sT0FBTztJQUNaLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDO0lBQ3BDLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0dBQ3ZELENBQUM7Q0FDSDs7QUFFRCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUM7OztBQUdqQyxNQUFNLE1BQU0sR0FBRyxTQUFTLFNBQVMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRTtFQUNwRSxJQUFJLENBQUMsUUFBUSxFQUFFO0lBQ2IsSUFBSSxRQUFRLEVBQUU7TUFDWixRQUFRLENBQUMsR0FBRyxHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7TUFDL0QsUUFBUSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7TUFDdkIsT0FBTyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQ3pDLE1BQU07TUFDTCxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDO0tBQ3pDO0dBQ0YsTUFBTTtJQUNMLElBQUksQ0FBQyxRQUFRLEVBQUU7TUFDYixhQUFhLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztNQUN4QyxRQUFRLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUU7S0FDekMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxRQUFRLEtBQUssUUFBUSxDQUFDLFFBQVEsRUFBRTtNQUNsRCxRQUFRLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztNQUNwQyxRQUFRLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztNQUN2QixhQUFhLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO01BQ3ZELE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztLQUM3QyxNQUFNO01BQ0wsUUFBUSxDQUFDLEdBQUcsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDO01BQzVCLFFBQVEsQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7TUFDNUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0tBQ3pDO0dBQ0Y7Q0FDRixDQUFDOzs7Ozs7Ozs7O0FBVUYsQUFBTyxNQUFNLE1BQU0sR0FBRyxTQUFTLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFOzs7OztFQUszRixNQUFNLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDOztFQUVuRSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7O0lBRXBCLEtBQUssSUFBSSxDQUFDLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO01BQy9CLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRTtRQUNmLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO09BQzlCO0tBQ0Y7R0FDRjs7O0VBR0QsTUFBTSxXQUFXLEdBQUcsT0FBTyxLQUFLLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDOztFQUVwRyxJQUFJLEtBQUssRUFBRTs7OztJQUlULElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBRTtNQUN6QyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7S0FDbEI7O0lBRUQsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQzs7O0lBR2hELElBQUksS0FBSyxDQUFDLFFBQVEsS0FBSyxNQUFNLEVBQUU7TUFDN0IsT0FBTyxVQUFVLENBQUM7S0FDbkI7O0lBRUQsSUFBSSxLQUFLLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxTQUFTLEtBQUssQ0FBQyxFQUFFO01BQzFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztLQUN4Qzs7SUFFRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7OztJQUduRixNQUFNLFlBQVksR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDOUQsSUFBSSxZQUFZLEtBQUssSUFBSSxFQUFFO01BQ3pCLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDaEQ7OztJQUdELElBQUksYUFBYSxHQUFHLENBQUMsRUFBRTtNQUNyQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsYUFBYSxFQUFFLENBQUMsRUFBRSxFQUFFOztRQUV0QyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUM7T0FDM0U7S0FDRjtHQUNGOztFQUVELE9BQU8sVUFBVSxDQUFDO0NBQ25CLENBQUM7O0FBRUYsQUFBTyxTQUFTLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0VBQ25DLFlBQVksQ0FBQztFQUNiLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0VBQzFDLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUM7RUFDakMsUUFBUSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7RUFDbkIsUUFBUSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNwRSxPQUFPLFFBQVEsQ0FBQztDQUNqQjs7QUFFRCxBQUFPLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxVQUFVLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO0VBQ3pELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEtBQUssS0FBSyxDQUFDLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUM7RUFDckUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO0VBQ2hGLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0VBQzVDLFFBQVEsQ0FBQyxZQUFZO0lBQ25CLEtBQUssSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFO01BQ3BCLEVBQUUsRUFBRSxDQUFDO0tBQ047R0FDRixDQUFDLENBQUM7RUFDSCxPQUFPLEtBQUssQ0FBQztDQUNkLENBQUM7Ozs7Ozs7O0FDNUpGLEFBQWUsU0FBUyxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRTtFQUNsRCxJQUFJLE9BQU8sR0FBRyxZQUFZLENBQUM7RUFDM0IsTUFBTSxVQUFVLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxJQUFJLEtBQUs7SUFDckMsTUFBTUEsUUFBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDO0lBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQ3ZHLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFQSxRQUFLLENBQUMsQ0FBQzs7OztJQUlsRCxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDOzs7SUFHaEQsUUFBUSxDQUFDLFlBQVk7TUFDbkIsS0FBSyxJQUFJLEVBQUUsSUFBSSxTQUFTLEVBQUU7UUFDeEIsRUFBRSxFQUFFLENBQUM7T0FDTjtLQUNGLENBQUMsQ0FBQztJQUNILE9BQU8sT0FBTyxDQUFDO0dBQ2hCLENBQUM7RUFDRixPQUFPLFVBQVUsQ0FBQzs7O0FDMUJwQixNQUFNLGdCQUFnQixHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLEdBQUcsSUFBSSxLQUFLO0VBQ3pFLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztFQUMvQixDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7RUFDakMsT0FBTyxDQUFDLENBQUM7Q0FDVixDQUFDLENBQUM7Ozs7O0FBS0gsQUFBTyxNQUFNLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQzs7Ozs7QUFLbkQsQUFBTyxBQUFnRDs7OztHQUt2RCxBQUFPOzs7Ozs7R0NaUCxBQWNDOzs7Ozs7O0FDZEQsVUFBZSxVQUFVLElBQUksRUFBRTtFQUM3QixPQUFPLFVBQVUsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLGFBQWEsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7SUFDeEQsSUFBSSxVQUFVLENBQUM7SUFDZixJQUFJLFdBQVcsR0FBRyxFQUFFLENBQUM7SUFDckIsS0FBSyxJQUFJQyxTQUFNLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRTtNQUN2QyxXQUFXLENBQUNBLFNBQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEtBQUs7UUFDakMsS0FBSyxHQUFHLE9BQU8sQ0FBQ0EsU0FBTSxDQUFDLENBQUMsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDeEMsT0FBTyxVQUFVLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDO09BQ3ZDLENBQUE7S0FDRjs7SUFFRCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUM7O0lBRTVDLE1BQU0sZUFBZSxHQUFHLENBQUMsS0FBSyxLQUFLO01BQ2pDLFVBQVUsR0FBRyxNQUFNLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ2xDLENBQUM7SUFDRixNQUFNLGdCQUFnQixHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEtBQUssSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDcEYsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLGVBQWUsRUFBRSxHQUFHLGdCQUFnQixDQUFDLENBQUM7O0lBRS9ELE9BQU8sT0FBTyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztHQUNoQyxDQUFDO0NBQ0gsQ0FBQTs7Ozs7Ozs7Ozs7R0NmRCxBQTZCQzs7QUMxQ0QsZUFBZSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztFQUNqRSxHQUFDLFFBQUcsS0FBSyxFQUFDLEVBQUcsS0FBSyxLQUFLLENBQUMsUUFBUSxHQUFHLFFBQVEsR0FBRyxFQUFFLEVBQUM7SUFDL0MsR0FBQyxRQUFHLEtBQUssRUFBQyxVQUFVLEVBQUEsRUFBQyxFQUFHLENBQU07SUFDOUIsR0FBQyxRQUFHLEtBQUssRUFBQyxVQUFVLEVBQUE7TUFDbEIsR0FBQyxPQUFFLE9BQU8sRUFBQyxDQUFFLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUMsRUFBQyxLQUFNLENBQUs7S0FDL0M7SUFDTCxHQUFDLFFBQUcsS0FBSyxFQUFDLFVBQVUsRUFBQTtNQUNsQixHQUFDLE9BQUUsT0FBTyxFQUFDLENBQUUsSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBQztnQkFDNUIsR0FBQyxVQUFLLEtBQUssRUFBQyw0QkFBNEIsRUFBQyxhQUFXLEVBQUMsTUFBTSxFQUFBO2lCQUNwRDtPQUNiO0tBQ0Q7SUFDTCxHQUFDLFFBQUcsS0FBSyxFQUFDLFVBQVUsRUFBQSxDQUFNO0dBQ3ZCO0NBQ04sQ0FBQTs7QUNYRCxJQUFJLFNBQVMsQ0FBQztBQUNkLElBQUksV0FBVyxDQUFDOztBQUVoQixTQUFTLFlBQVksRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO0VBQy9CLFNBQVMsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUE7O0VBRTdCLFdBQVcsR0FBRyxJQUFJLENBQUM7RUFDbkIsRUFBRSxFQUFFLENBQUM7Q0FDTjs7QUFFRCxTQUFTLFdBQVcsSUFBSTtFQUN0QixNQUFNLElBQUksR0FBRyxXQUFXLENBQUM7O0VBRXpCLElBQUksV0FBVyxFQUFFO0lBQ2YsTUFBTSxDQUFDLFVBQVU7TUFDZixTQUFTLGVBQWUsSUFBSTtRQUMxQixXQUFXLEdBQUcsSUFBSSxDQUFBO1FBQ2xCLE1BQU0sSUFBSSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQTs7O1FBRzlCLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLFFBQVEsSUFBSSxJQUFJLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQTtPQUNsRDtNQUNELENBQUM7S0FDRixDQUFBO0dBQ0Y7Q0FDRjs7QUFFRCxTQUFTLElBQUksRUFBRUMsUUFBSyxFQUFFLE9BQU8sRUFBRTtFQUM3QixXQUFXLEVBQUUsQ0FBQTtFQUNiO0lBQ0UsR0FBQyxTQUFJLEtBQUssRUFBQyxXQUFXLEVBQUE7TUFDcEIsR0FBQyxTQUFJLEtBQUssRUFBQyxXQUFXLEVBQUE7UUFDcEIsR0FBQyxTQUFJLEtBQUssRUFBQyxLQUFLLEVBQUE7VUFDZCxHQUFDLFNBQUksS0FBSyxFQUFDLFVBQVUsRUFBQTtZQUNuQixHQUFDLFVBQUUsRUFBQyxhQUFXLEVBQUs7V0FDaEI7VUFDTixHQUFDLFNBQUksS0FBSyxFQUFDLFVBQVUsRUFBQTtZQUNuQixHQUFDLFNBQUksS0FBSyxFQUFDLEtBQUssRUFBQTtjQUNkLEdBQUMsU0FBSSxLQUFLLEVBQUMsbUJBQW1CLEVBQUE7Z0JBQzVCLEdBQUM7a0JBQ0MsSUFBSSxFQUFDLFFBQVEsRUFDYixLQUFLLEVBQUMsMkJBQTJCLEVBQ2pDLEVBQUUsRUFBQyxLQUFLLEVBQ1IsT0FBTyxFQUFDLENBQUU7b0JBQ1IsWUFBWSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUMsRUFBQyxtQkFFdEMsQ0FBUztlQUNMO2NBQ04sR0FBQyxTQUFJLEtBQUssRUFBQyxtQkFBbUIsRUFBQTtnQkFDNUIsR0FBQztrQkFDQyxJQUFJLEVBQUMsUUFBUSxFQUNiLEtBQUssRUFBQywyQkFBMkIsRUFDakMsRUFBRSxFQUFDLFNBQVMsRUFDWixPQUFPLEVBQUMsQ0FBRTtvQkFDUixZQUFZO3NCQUNWLFNBQVM7c0JBQ1QsT0FBTyxDQUFDLE9BQU87cUJBQ2hCLEVBQUMsRUFBQyxvQkFFUCxDQUFTO2VBQ0w7Y0FDTixHQUFDLFNBQUksS0FBSyxFQUFDLG1CQUFtQixFQUFBO2dCQUM1QixHQUFDO2tCQUNDLElBQUksRUFBQyxRQUFRLEVBQ2IsS0FBSyxFQUFDLDJCQUEyQixFQUNqQyxFQUFFLEVBQUMsS0FBSyxFQUNSLE9BQU8sRUFBQyxDQUFFO29CQUNSLFlBQVksQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFDLEVBQUMsbUJBRXRDLENBQVM7ZUFDTDtjQUNOLEdBQUMsU0FBSSxLQUFLLEVBQUMsbUJBQW1CLEVBQUE7Z0JBQzVCLEdBQUM7a0JBQ0MsSUFBSSxFQUFDLFFBQVEsRUFDYixLQUFLLEVBQUMsMkJBQTJCLEVBQ2pDLEVBQUUsRUFBQyxRQUFRLEVBQ1gsT0FBTyxFQUFDLENBQUU7b0JBQ1IsWUFBWSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUMsRUFBQyx1QkFFNUMsQ0FBUztlQUNMO2NBQ04sR0FBQyxTQUFJLEtBQUssRUFBQyxtQkFBbUIsRUFBQTtnQkFDNUIsR0FBQztrQkFDQyxJQUFJLEVBQUMsUUFBUSxFQUNiLEtBQUssRUFBQywyQkFBMkIsRUFDakMsRUFBRSxFQUFDLE9BQU8sRUFDVixPQUFPLEVBQUMsQ0FBRTtvQkFDUixZQUFZLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBQyxFQUFDLE9BRTFDLENBQVM7ZUFDTDtjQUNOLEdBQUMsU0FBSSxLQUFLLEVBQUMsbUJBQW1CLEVBQUE7Z0JBQzVCLEdBQUM7a0JBQ0MsSUFBSSxFQUFDLFFBQVEsRUFDYixLQUFLLEVBQUMsMkJBQTJCLEVBQ2pDLEVBQUUsRUFBQyxVQUFVLEVBQ2IsT0FBTyxFQUFDLENBQUU7b0JBQ1IsWUFBWTtzQkFDVixVQUFVO3NCQUNWLE9BQU8sQ0FBQyxRQUFRO3FCQUNqQixFQUFDLEVBQUMsV0FFUCxDQUFTO2VBQ0w7YUFDRjtXQUNGO1NBQ0Y7T0FDRjtNQUNOLEdBQUMsV0FBTSxLQUFLLEVBQUMsMkNBQTJDLEVBQUE7UUFDdEQsR0FBQyxhQUFLO1FBQ04sR0FBQyxRQUFRLElBQUMsS0FBSyxFQUFDQSxRQUFNLEVBQUUsT0FBTyxFQUFDLE9BQVEsRUFBQyxDQUFFO1NBQ25DO09BQ0Y7TUFDUixHQUFDO1FBQ0MsS0FBSyxFQUFDLHdDQUF3QyxFQUM5QyxhQUFXLEVBQUMsTUFBTSxFQUFBLENBQ2xCO0tBQ0UsRUFBRTtDQUNYOztBQUVELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQzs7QUFFeEIsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFBQSxRQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBQyxLQUFLLElBQUMsS0FBSyxFQUFDQSxRQUFNLEVBQUUsT0FBTyxFQUFDLE9BQVEsRUFBQyxDQUFFLENBQUMsRUFBRTtFQUN0RSxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVE7Q0FDekIsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7OyJ9
