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
var app = function (view) {
  return function ({model, updates, subscriptions = []}) {
    let actionStore = {};

    const comp = props => view(model, actionStore);

    const initActionStore = (vnode) => {
      const updateFunc = update(comp, vnode);
      for (let update$$1 of Object.keys(updates)) {
        actionStore[update$$1] = (...args) => {
          model = updates[update$$1](model, ...args); //todo consider side effects, middlewares, etc
          return updateFunc(model, actionStore);
        };
      }
    };
    const initSubscription = subscriptions.map(sub => vnode => sub(vnode, actionStore));
    const initFunc = compose(initActionStore, ...initSubscription);

    return onMount(initFunc, comp);
  };
};


/*

connect(store, actions, watcher)




 */

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL3N0b3JlLmpzIiwiLi4vLi4vLi4vbGliL2guanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vLi4vLi4vbGliL3V0aWwuanMiLCIuLi8uLi8uLi9saWIvZG9tVXRpbC5qcyIsIi4uLy4uLy4uL2xpYi90cmF2ZXJzZS5qcyIsIi4uLy4uLy4uL2xpYi90cmVlLmpzIiwiLi4vLi4vLi4vbGliL3VwZGF0ZS5qcyIsIi4uLy4uLy4uL2xpYi9saWZlQ3ljbGVzLmpzIiwiLi4vLi4vLi4vbGliL3dpdGhTdGF0ZS5qcyIsIi4uLy4uLy4uL2xpYi9lbG0uanMiLCIuLi8uLi8uLi9saWIvY29ubmVjdC5qcyIsIi4uL3Jvd3MuanMiLCIuLi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgaWQgPSAxXG5cbmNvbnN0IHJhbmQgPSBNYXRoLnJhbmRvbVxuXG5mdW5jdGlvbiBidWlsZERhdGEgKGNvdW50KSB7XG4gIGNvbnN0IGFkamVjdGl2ZXMgPSBbXG4gICAgXCJwcmV0dHlcIixcbiAgICBcImxhcmdlXCIsXG4gICAgXCJiaWdcIixcbiAgICBcInNtYWxsXCIsXG4gICAgXCJ0YWxsXCIsXG4gICAgXCJzaG9ydFwiLFxuICAgIFwibG9uZ1wiLFxuICAgIFwiaGFuZHNvbWVcIixcbiAgICBcInBsYWluXCIsXG4gICAgXCJxdWFpbnRcIixcbiAgICBcImNsZWFuXCIsXG4gICAgXCJlbGVnYW50XCIsXG4gICAgXCJlYXN5XCIsXG4gICAgXCJhbmdyeVwiLFxuICAgIFwiY3JhenlcIixcbiAgICBcImhlbHBmdWxcIixcbiAgICBcIm11c2h5XCIsXG4gICAgXCJvZGRcIixcbiAgICBcInVuc2lnaHRseVwiLFxuICAgIFwiYWRvcmFibGVcIixcbiAgICBcImltcG9ydGFudFwiLFxuICAgIFwiaW5leHBlbnNpdmVcIixcbiAgICBcImNoZWFwXCIsXG4gICAgXCJleHBlbnNpdmVcIixcbiAgICBcImZhbmN5XCIsXG4gIF1cblxuICBjb25zdCBjb2xvdXJzID0gW1xuICAgIFwicmVkXCIsXG4gICAgXCJ5ZWxsb3dcIixcbiAgICBcImJsdWVcIixcbiAgICBcImdyZWVuXCIsXG4gICAgXCJwaW5rXCIsXG4gICAgXCJicm93blwiLFxuICAgIFwicHVycGxlXCIsXG4gICAgXCJicm93blwiLFxuICAgIFwid2hpdGVcIixcbiAgICBcImJsYWNrXCIsXG4gICAgXCJvcmFuZ2VcIixcbiAgXVxuXG4gIGNvbnN0IG5vdW5zID0gW1xuICAgIFwidGFibGVcIixcbiAgICBcImNoYWlyXCIsXG4gICAgXCJob3VzZVwiLFxuICAgIFwiYmJxXCIsXG4gICAgXCJkZXNrXCIsXG4gICAgXCJjYXJcIixcbiAgICBcInBvbnlcIixcbiAgICBcImNvb2tpZVwiLFxuICAgIFwic2FuZHdpY2hcIixcbiAgICBcImJ1cmdlclwiLFxuICAgIFwicGl6emFcIixcbiAgICBcIm1vdXNlXCIsXG4gICAgXCJrZXlib2FyZFwiLFxuICBdXG5cbiAgcmV0dXJuIG5ldyBBcnJheShjb3VudCkuZmlsbCgwKS5tYXAoXyA9PiAoe1xuICAgIGlkOiBpZCsrLFxuICAgIGxhYmVsOiBgJHthZGplY3RpdmVzW1xuICAgIHJhbmQoKSAqIDEwMDAgJSBhZGplY3RpdmVzLmxlbmd0aCA+PiAwXX0gJHtjb2xvdXJzW1xuICAgIHJhbmQoKSAqIDEwMDAgJSBjb2xvdXJzLmxlbmd0aCA+PiAwXX0gJHtub3Vuc1tcbiAgICByYW5kKCkgKiAxMDAwICUgbm91bnMubGVuZ3RoID4+IDBdfWBcbiAgfSkpXG59XG5cbmNvbnN0IG1vZGVsID0ge1xuICBkYXRhOiBbXSxcbiAgc2VsZWN0ZWQ6IGZhbHNlXG59XG5cbmNvbnN0IHJlZHVjZXJzID0ge1xuICBydW46IG1vZGVsID0+ICh7XG4gICAgZGF0YTogYnVpbGREYXRhKDEwMDApLFxuICAgIHNlbGVjdGVkOiB1bmRlZmluZWRcbiAgfSksXG5cbiAgYWRkOiBtb2RlbCA9PiAoe1xuICAgIGRhdGE6IG1vZGVsLmRhdGEuY29uY2F0KGJ1aWxkRGF0YSgxMDAwKSksXG4gICAgc2VsZWN0ZWQ6IHVuZGVmaW5lZFxuICB9KSxcblxuICBydW5Mb3RzOiBtb2RlbCA9PiAoe1xuICAgIGRhdGE6IGJ1aWxkRGF0YSgxMDAwMCksXG4gICAgc2VsZWN0ZWQ6IHVuZGVmaW5lZFxuICB9KSxcblxuICBjbGVhcjogbW9kZWwgPT4gKHtcbiAgICBkYXRhOiBbXSxcbiAgICBzZWxlY3RlZDogdW5kZWZpbmVkXG4gIH0pLFxuXG4gIHVwZGF0ZTogbW9kZWwgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiBtb2RlbC5kYXRhLm1hcCgoZCwgaSkgPT4ge1xuICAgICAgICBpZiAoaSAlIDEwID09PSAwKSB7XG4gICAgICAgICAgZC5sYWJlbCA9IGAke2QubGFiZWx9ICEhIWBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZFxuICAgICAgfSksXG4gICAgICBzZWxlY3RlZDogdW5kZWZpbmVkXG4gICAgfVxuICB9LFxuXG4gIHN3YXBSb3dzOiBtb2RlbCA9PiB7XG4gICAgaWYgKG1vZGVsLmRhdGEubGVuZ3RoIDw9IDEwKSB7XG4gICAgICByZXR1cm4gbW9kZWxcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gbW9kZWwuZGF0YVs0XVxuICAgIG1vZGVsLmRhdGFbNF0gPSBtb2RlbC5kYXRhWzldXG4gICAgbW9kZWwuZGF0YVs5XSA9IHRlbXBcblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiBtb2RlbC5kYXRhLFxuICAgICAgc2VsZWN0ZWQ6IG1vZGVsLnNlbGVjdGVkXG4gICAgfVxuICB9LFxuXG4gIHNlbGVjdDogKG1vZGVsLCBkYXRhKSA9PiAoe1xuICAgIGRhdGE6IG1vZGVsLmRhdGEsXG4gICAgc2VsZWN0ZWQ6IGRhdGEuaWRcbiAgfSksXG5cbiAgZGVsZXRlOiAobW9kZWwsIGRhdGEpID0+ICh7XG4gICAgZGF0YTogbW9kZWwuZGF0YS5maWx0ZXIoZCA9PiBkLmlkICE9PSBkYXRhLmlkKVxuICB9KVxufVxuXG5leHBvcnQge1xuICBtb2RlbCwgcmVkdWNlcnNcbn1cblxuIiwiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9XG59KTtcblxuLyoqXG4gKiBUcmFuc2Zvcm0gaHlwZXJzY3JpcHQgaW50byB2aXJ0dWFsIGRvbSBub2RlXG4gKiBAcGFyYW0gbm9kZVR5cGVcbiAqIEBwYXJhbSBwcm9wc1xuICogQHBhcmFtIGNoaWxkcmVuXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaCAobm9kZVR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICBjb25zdCBmbGF0Q2hpbGRyZW4gPSBjaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gQXJyYXkuaXNBcnJheShjaGlsZCkgPyBjaGlsZCA6IFtjaGlsZF07XG4gICAgcmV0dXJuIGFjYy5jb25jYXQoY2hpbGRyZW5BcnJheSk7XG4gIH0sIFtdKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gbm9ybWFsaXplIHRleHQgbm9kZSB0byBoYXZlIHNhbWUgc3RydWN0dXJlIHRoYW4gcmVndWxhciBkb20gbm9kZXNcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgY2hpbGQ7XG4gICAgICByZXR1cm4gdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkIDogY3JlYXRlVGV4dFZOb2RlKGNoaWxkKTtcbiAgICB9KTtcblxuICBpZiAodHlwZW9mIG5vZGVUeXBlICE9PSAnZnVuY3Rpb24nKSB7Ly9yZWd1bGFyIGh0bWwvdGV4dCBub2RlXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGVUeXBlLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgY2hpbGRyZW46IGZsYXRDaGlsZHJlblxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZnVsbFByb3BzID0gT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IGZsYXRDaGlsZHJlbn0sIHByb3BzKTtcbiAgICBjb25zdCBjb21wID0gbm9kZVR5cGUoZnVsbFByb3BzKTtcbiAgICByZXR1cm4gdHlwZW9mIGNvbXAgIT09ICdmdW5jdGlvbicgPyBjb21wIDogaChjb21wLCBwcm9wcywgLi4uZmxhdENoaWxkcmVuKTsgLy9mdW5jdGlvbmFsIGNvbXAgdnMgY29tYmluYXRvciAoSE9DKVxuICB9XG59OyIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBjb25zdCBuZXh0VGljayA9IGZuID0+IHNldFRpbWVvdXQoZm4sIDApO1xuXG5leHBvcnQgY29uc3QgcGFpcmlmeSA9IGhvbGRlciA9PiBrZXkgPT4gW2tleSwgaG9sZGVyW2tleV1dO1xuXG5leHBvcnQgY29uc3QgaXNTaGFsbG93RXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCBhS2V5cyA9IE9iamVjdC5rZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IE9iamVjdC5rZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoKGspID0+IGFba10gPT09IGJba10pO1xufTtcblxuY29uc3QgaXNPd24gPSAob2JqKSA9PiBrID0+IG9iai5oYXNPd25Qcm9wZXJ0eShrKVxuXG5leHBvcnQgY29uc3QgaXNEZWVwRXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCB0eXBlID0gdHlwZW9mIGE7XG4gIGlmICh0eXBlICE9PSB0eXBlb2YgYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAodHlwZSA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xuICAgICAgcmV0dXJuIGEubGVuZ3RoICYmIGIubGVuZ3RoICYmIGEuZXZlcnkoKGl0ZW0sIGkpID0+IGlzRGVlcEVxdWFsKGFbaV0sIGJbaV0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYUtleXMgPSBPYmplY3Qua2V5cyhhKS5maWx0ZXIoaXNPd24oYSkpO1xuICAgICAgY29uc3QgYktleXMgPSBPYmplY3Qua2V5cyhiKS5maWx0ZXIoaXNPd24oYikpO1xuICAgICAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KGsgPT4gaXNEZWVwRXF1YWwoYVtrXSwgYltrXSkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYSA9PT0gYjtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGlkZW50aXR5ID0gcCA9PiBwO1xuXG5leHBvcnQgY29uc3Qgbm9vcCA9ICgpID0+IHtcbn07XG4iLCJpbXBvcnQge3RhcH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgdXBkYXRlRG9tTm9kZUZhY3RvcnkgPSAobWV0aG9kKSA9PiAoaXRlbXMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgcGFpciBvZiBpdGVtcykge1xuICAgIGRvbU5vZGVbbWV0aG9kXSguLi5wYWlyKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCByZW1vdmVFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdyZW1vdmVFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3QgYWRkRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgnYWRkRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IHNldEF0dHJpYnV0ZXMgPSAoaXRlbXMpID0+IHRhcCgoZG9tTm9kZSkgPT4ge1xuICBjb25zdCBhdHRyaWJ1dGVzID0gaXRlbXMuZmlsdGVyKChba2V5LCB2YWx1ZV0pID0+IHR5cGVvZiB2YWx1ZSAhPT0gJ2Z1bmN0aW9uJyk7XG4gIGZvciAobGV0IFtrZXksIHZhbHVlXSBvZiBhdHRyaWJ1dGVzKSB7XG4gICAgdmFsdWUgPT09IGZhbHNlID8gZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoa2V5KSA6IGRvbU5vZGUuc2V0QXR0cmlidXRlKGtleSwgdmFsdWUpO1xuICB9XG59KTtcbmV4cG9ydCBjb25zdCByZW1vdmVBdHRyaWJ1dGVzID0gKGl0ZW1zKSA9PiB0YXAoZG9tTm9kZSA9PiB7XG4gIGZvciAobGV0IGF0dHIgb2YgaXRlbXMpIHtcbiAgICBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCBzZXRUZXh0Tm9kZSA9IHZhbCA9PiBub2RlID0+IG5vZGUudGV4dENvbnRlbnQgPSB2YWw7XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVEb21Ob2RlID0gdm5vZGUgPT4ge1xuICByZXR1cm4gdm5vZGUubm9kZVR5cGUgIT09ICdUZXh0JyA/XG4gICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh2bm9kZS5ub2RlVHlwZSkgOlxuICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFN0cmluZyh2bm9kZS5wcm9wcy52YWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldEV2ZW50TGlzdGVuZXJzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcylcbiAgICAuZmlsdGVyKGsgPT4gay5zdWJzdHIoMCwgMikgPT09ICdvbicpXG4gICAgLm1hcChrID0+IFtrLnN1YnN0cigyKS50b0xvd2VyQ2FzZSgpLCBwcm9wc1trXV0pO1xufTtcbiIsImV4cG9ydCBjb25zdCB0cmF2ZXJzZSA9IGZ1bmN0aW9uICogKHZub2RlKSB7XG4gIHlpZWxkIHZub2RlO1xuICBpZiAodm5vZGUuY2hpbGRyZW4gJiYgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZm9yIChsZXQgY2hpbGQgb2Ygdm5vZGUuY2hpbGRyZW4pIHtcbiAgICAgIHlpZWxkICogdHJhdmVyc2UoY2hpbGQpO1xuICAgIH1cbiAgfVxufTsiLCJpbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgaXNTaGFsbG93RXF1YWwsXG4gIHBhaXJpZnksXG4gIG5leHRUaWNrLFxuICBub29wXG59IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQge1xuICByZW1vdmVBdHRyaWJ1dGVzLFxuICBzZXRBdHRyaWJ1dGVzLFxuICBzZXRUZXh0Tm9kZSxcbiAgY3JlYXRlRG9tTm9kZSxcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMsXG4gIGFkZEV2ZW50TGlzdGVuZXJzLFxuICBnZXRFdmVudExpc3RlbmVycyxcbn0gZnJvbSAnLi9kb21VdGlsJztcbmltcG9ydCB7dHJhdmVyc2V9IGZyb20gJy4vdHJhdmVyc2UnO1xuXG5mdW5jdGlvbiB1cGRhdGVFdmVudExpc3RlbmVycyAoe3Byb3BzOm5ld05vZGVQcm9wc309e30sIHtwcm9wczpvbGROb2RlUHJvcHN9PXt9KSB7XG4gIGNvbnN0IG5ld05vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhuZXdOb2RlUHJvcHMgfHwge30pO1xuICBjb25zdCBvbGROb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMob2xkTm9kZVByb3BzIHx8IHt9KTtcblxuICByZXR1cm4gbmV3Tm9kZUV2ZW50cy5sZW5ndGggfHwgb2xkTm9kZUV2ZW50cy5sZW5ndGggP1xuICAgIGNvbXBvc2UoXG4gICAgICByZW1vdmVFdmVudExpc3RlbmVycyhvbGROb2RlRXZlbnRzKSxcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKG5ld05vZGVFdmVudHMpXG4gICAgKSA6IG5vb3A7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUF0dHJpYnV0ZXMgKG5ld1ZOb2RlLCBvbGRWTm9kZSkge1xuICBjb25zdCBuZXdWTm9kZVByb3BzID0gbmV3Vk5vZGUucHJvcHMgfHwge307XG4gIGNvbnN0IG9sZFZOb2RlUHJvcHMgPSBvbGRWTm9kZS5wcm9wcyB8fCB7fTtcblxuICBpZiAoaXNTaGFsbG93RXF1YWwobmV3Vk5vZGVQcm9wcywgb2xkVk5vZGVQcm9wcykpIHtcbiAgICByZXR1cm4gbm9vcDtcbiAgfVxuXG4gIGlmIChuZXdWTm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgcmV0dXJuIHNldFRleHROb2RlKG5ld1ZOb2RlLnByb3BzLnZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IG5ld05vZGVLZXlzID0gT2JqZWN0LmtleXMobmV3Vk5vZGVQcm9wcyk7XG4gIGNvbnN0IG9sZE5vZGVLZXlzID0gT2JqZWN0LmtleXMob2xkVk5vZGVQcm9wcyk7XG4gIGNvbnN0IGF0dHJpYnV0ZXNUb1JlbW92ZSA9IG9sZE5vZGVLZXlzLmZpbHRlcihrID0+ICFuZXdOb2RlS2V5cy5pbmNsdWRlcyhrKSk7XG5cbiAgcmV0dXJuIGNvbXBvc2UoXG4gICAgcmVtb3ZlQXR0cmlidXRlcyhhdHRyaWJ1dGVzVG9SZW1vdmUpLFxuICAgIHNldEF0dHJpYnV0ZXMobmV3Tm9kZUtleXMubWFwKHBhaXJpZnkobmV3Vk5vZGVQcm9wcykpKVxuICApO1xufVxuXG5jb25zdCBkb21GYWN0b3J5ID0gY3JlYXRlRG9tTm9kZTtcblxuLy8gYXBwbHkgdm5vZGUgZGlmZmluZyB0byBhY3R1YWwgZG9tIG5vZGUgKGlmIG5ldyBub2RlID0+IGl0IHdpbGwgYmUgbW91bnRlZCBpbnRvIHRoZSBwYXJlbnQpXG5jb25zdCBkb21pZnkgPSBmdW5jdGlvbiB1cGRhdGVEb20gKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSkge1xuICBpZiAoIW9sZFZub2RlKSB7Ly90aGVyZSBpcyBubyBwcmV2aW91cyB2bm9kZVxuICAgIGlmIChuZXdWbm9kZSkgey8vbmV3IG5vZGUgPT4gd2UgaW5zZXJ0XG4gICAgICBuZXdWbm9kZS5kb20gPSBwYXJlbnREb21Ob2RlLmFwcGVuZENoaWxkKGRvbUZhY3RvcnkobmV3Vm5vZGUpKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICByZXR1cm4ge3Zub2RlOiBuZXdWbm9kZSwgZ2FyYmFnZTogbnVsbH07XG4gICAgfSBlbHNlIHsvL2Vsc2UgKGlycmVsZXZhbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG9wZXJhdGlvbicpXG4gICAgfVxuICB9IGVsc2Ugey8vdGhlcmUgaXMgYSBwcmV2aW91cyB2bm9kZVxuICAgIGlmICghbmV3Vm5vZGUpIHsvL3dlIG11c3QgcmVtb3ZlIHRoZSByZWxhdGVkIGRvbSBub2RlXG4gICAgICBwYXJlbnREb21Ob2RlLnJlbW92ZUNoaWxkKG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4gKHtnYXJiYWdlOiBvbGRWbm9kZSwgZG9tOiBudWxsfSk7XG4gICAgfSBlbHNlIGlmIChuZXdWbm9kZS5ub2RlVHlwZSAhPT0gb2xkVm5vZGUubm9kZVR5cGUpIHsvL2l0IG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IGRvbUZhY3RvcnkobmV3Vm5vZGUpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHBhcmVudERvbU5vZGUucmVwbGFjZUNoaWxkKG5ld1Zub2RlLmRvbSwgb2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogb2xkVm5vZGUsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfSBlbHNlIHsvLyBvbmx5IHVwZGF0ZSBhdHRyaWJ1dGVzXG4gICAgICBuZXdWbm9kZS5kb20gPSBvbGRWbm9kZS5kb207XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSBvbGRWbm9kZS5saWZlQ3ljbGUgKyAxO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBudWxsLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiByZW5kZXIgYSB2aXJ0dWFsIGRvbSBub2RlLCBkaWZmaW5nIGl0IHdpdGggaXRzIHByZXZpb3VzIHZlcnNpb24sIG1vdW50aW5nIGl0IGluIGEgcGFyZW50IGRvbSBub2RlXG4gKiBAcGFyYW0gb2xkVm5vZGVcbiAqIEBwYXJhbSBuZXdWbm9kZVxuICogQHBhcmFtIHBhcmVudERvbU5vZGVcbiAqIEBwYXJhbSBvbk5leHRUaWNrIGNvbGxlY3Qgb3BlcmF0aW9ucyB0byBiZSBwcm9jZXNzZWQgb24gbmV4dCB0aWNrXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKi9cbmV4cG9ydCBjb25zdCByZW5kZXIgPSBmdW5jdGlvbiByZW5kZXJlciAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlLCBvbk5leHRUaWNrID0gW10pIHtcblxuICAvLzEuIHRyYW5zZm9ybSB0aGUgbmV3IHZub2RlIHRvIGEgdm5vZGUgY29ubmVjdGVkIHRvIGFuIGFjdHVhbCBkb20gZWxlbWVudCBiYXNlZCBvbiB2bm9kZSB2ZXJzaW9ucyBkaWZmaW5nXG4gIC8vIGkuIG5vdGUgYXQgdGhpcyBzdGVwIG9jY3VyIGRvbSBpbnNlcnRpb25zL3JlbW92YWxzXG4gIC8vIGlpLiBpdCBtYXkgY29sbGVjdCBzdWIgdHJlZSB0byBiZSBkcm9wcGVkIChvciBcInVubW91bnRlZFwiKVxuICBjb25zdCB7dm5vZGUsIGdhcmJhZ2V9ID0gZG9taWZ5KG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSk7XG5cbiAgaWYgKGdhcmJhZ2UgIT09IG51bGwpIHtcbiAgICAvLyBkZWZlciB1biBtb3VudCBsaWZlY3ljbGUgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBmb3IgKGxldCBnIG9mIHRyYXZlcnNlKGdhcmJhZ2UpKSB7XG4gICAgICBpZiAoZy5vblVuTW91bnQpIHtcbiAgICAgICAgb25OZXh0VGljay5wdXNoKGcub25Vbk1vdW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvL05vcm1hbGlzYXRpb24gb2Ygb2xkIG5vZGUgKGluIGNhc2Ugb2YgYSByZXBsYWNlIHdlIHdpbGwgY29uc2lkZXIgb2xkIG5vZGUgYXMgZW1wdHkgbm9kZSAobm8gY2hpbGRyZW4sIG5vIHByb3BzKSlcbiAgY29uc3QgdGVtcE9sZE5vZGUgPSBnYXJiYWdlICE9PSBudWxsIHx8ICFvbGRWbm9kZSA/IHtsZW5ndGg6IDAsIGNoaWxkcmVuOiBbXSwgcHJvcHM6IHt9fSA6IG9sZFZub2RlO1xuXG4gIGlmICh2bm9kZSkge1xuXG4gICAgLy8yLiB1cGRhdGUgZG9tIGF0dHJpYnV0ZXMgYmFzZWQgb24gdm5vZGUgcHJvcCBkaWZmaW5nLlxuICAgIC8vc3luY1xuXG4gICAgaWYgKHZub2RlLm9uVXBkYXRlICYmIHZub2RlLmxpZmVDeWNsZSA+IDEpIHtcbiAgICAgIHZub2RlLm9uVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlQXR0cmlidXRlcyh2bm9kZSwgdGVtcE9sZE5vZGUpKHZub2RlLmRvbSk7XG5cbiAgICAvL2Zhc3QgcGF0aFxuICAgIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgICByZXR1cm4gb25OZXh0VGljaztcbiAgICB9XG5cbiAgICBpZiAodm5vZGUub25Nb3VudCAmJiB2bm9kZS5saWZlQ3ljbGUgPT09IDEpIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiB2bm9kZS5vbk1vdW50KCkpO1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuQ291bnQgPSBNYXRoLm1heCh0ZW1wT2xkTm9kZS5jaGlsZHJlbi5sZW5ndGgsIHZub2RlLmNoaWxkcmVuLmxlbmd0aCk7XG5cbiAgICAvL2FzeW5jIHdpbGwgYmUgZGVmZXJyZWQgYXMgaXQgaXMgbm90IFwidmlzdWFsXCJcbiAgICBjb25zdCBzZXRMaXN0ZW5lcnMgPSB1cGRhdGVFdmVudExpc3RlbmVycyh2bm9kZSwgdGVtcE9sZE5vZGUpO1xuICAgIGlmIChzZXRMaXN0ZW5lcnMgIT09IG5vb3ApIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiBzZXRMaXN0ZW5lcnModm5vZGUuZG9tKSk7XG4gICAgfVxuXG4gICAgLy8zIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIGNoaWxkcmVuIHRvIHVwZGF0ZSBkb20gYW5kIGNvbGxlY3QgZnVuY3Rpb25zIHRvIHByb2Nlc3Mgb24gbmV4dCB0aWNrXG4gICAgaWYgKGNoaWxkcmVuQ291bnQgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuQ291bnQ7IGkrKykge1xuICAgICAgICAvLyB3ZSBwYXNzIG9uTmV4dFRpY2sgYXMgcmVmZXJlbmNlIChpbXByb3ZlIHBlcmY6IG1lbW9yeSArIHNwZWVkKVxuICAgICAgICByZW5kZXIodGVtcE9sZE5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5kb20sIG9uTmV4dFRpY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvbk5leHRUaWNrO1xufTtcblxuZXhwb3J0IGNvbnN0IG1vdW50ID0gY3VycnkoZnVuY3Rpb24gKGNvbXAsIGluaXRQcm9wLCByb290KSB7XG4gIGNvbnN0IHZub2RlID0gY29tcChpbml0UHJvcCB8fCB7fSk7XG4gIGNvbnN0IGJhdGNoID0gcmVuZGVyKG51bGwsIHZub2RlLCByb290KTtcbiAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgIHdoaWxlIChiYXRjaC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG9wID0gYmF0Y2guc2hpZnQoKTtcbiAgICAgIG9wKCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHZub2RlO1xufSk7IiwiaW1wb3J0IHtyZW5kZXJ9IGZyb20gJy4vdHJlZSc7XG5pbXBvcnQge25leHRUaWNrfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgdHJpZ2dlciBhbiB1cGRhdGUgb2YgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBwYXNzZWQgc3RhdGVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcGFyYW0gaW5pdGlhbFZOb2RlXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb24oKj0sIC4uLlsqXSl9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVwZGF0ZSAoY29tcCwgaW5pdGlhbFZOb2RlKSB7XG4gIGxldCBvbGROb2RlID0gaW5pdGlhbFZOb2RlO1xuICBjb25zdCB1cGRhdGVGdW5jID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgbW91bnQgPSBvbGROb2RlLmRvbS5wYXJlbnROb2RlO1xuICAgIGNvbnN0IG5ld05vZGUgPSBjb21wKE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBvbGROb2RlLmNoaWxkcmVuIHx8IFtdfSwgb2xkTm9kZS5wcm9wcywgcHJvcHMpLCAuLi5hcmdzKTtcbiAgICBjb25zdCBuZXh0QmF0Y2ggPSByZW5kZXIob2xkTm9kZSwgbmV3Tm9kZSwgbW91bnQpO1xuXG4gICAgLy8gZGFuZ2VyIHpvbmUgISEhIVxuICAgIC8vIGNoYW5nZSBieSBrZWVwaW5nIHRoZSBzYW1lIHJlZmVyZW5jZSBzbyB0aGUgZXZlbnR1YWwgcGFyZW50IG5vZGUgZG9lcyBub3QgbmVlZCB0byBiZSBcImF3YXJlXCIgdHJlZSBtYXkgaGF2ZSBjaGFuZ2VkIGRvd25zdHJlYW06IG9sZE5vZGUgbWF5IGJlIHRoZSBjaGlsZCBvZiBzb21lb25lIC4uLih3ZWxsIHRoYXQgaXMgYSB0cmVlIGRhdGEgc3RydWN0dXJlIGFmdGVyIGFsbCA6UCApXG4gICAgb2xkTm9kZSA9IE9iamVjdC5hc3NpZ24ob2xkTm9kZSB8fCB7fSwgbmV3Tm9kZSk7XG4gICAgLy8gZW5kIGRhbmdlciB6b25lXG5cbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICB3aGlsZSAobmV4dEJhdGNoLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBvcCA9IG5leHRCYXRjaC5zaGlmdCgpO1xuICAgICAgICBvcCgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlO1xuICB9O1xuICByZXR1cm4gdXBkYXRlRnVuYztcbn0iLCJpbXBvcnQge2N1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCBsaWZlQ3ljbGVGYWN0b3J5ID0gbWV0aG9kID0+IGN1cnJ5KChmbiwgY29tcCkgPT4gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gIGNvbnN0IG4gPSBjb21wKHByb3BzLCAuLi5hcmdzKTtcbiAgblttZXRob2RdID0gKCkgPT4gZm4obiwgLi4uYXJncyk7XG4gIHJldHVybiBuO1xufSk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvbk1vdW50Jyk7XG5cbi8qKlxuICogbGlmZSBjeWNsZTogd2hlbiB0aGUgY29tcG9uZW50IGlzIHVubW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Vbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Vbk1vdW50Jyk7XG5cbmV4cG9ydCBjb25zdCBvblVwZGF0ZSA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVXBkYXRlJyk7IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnQsIG9uVXBkYXRlfSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgXCJzdGF0ZWZ1bCBjb21wb25lbnRcIjogaWUgaXQgd2lsbCBoYXZlIGl0cyBvd24gc3RhdGUgYW5kIHRoZSBhYmlsaXR5IHRvIHVwZGF0ZSBpdHMgb3duIHRyZWVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChjb21wKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgY29uc3Qgd3JhcHBlckNvbXAgPSAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgICAgIC8vIHdyYXAgdGhlIGZ1bmN0aW9uIGNhbGwgd2hlbiB0aGUgY29tcG9uZW50IGhhcyBub3QgYmVlbiBtb3VudGVkIHlldDogbGF6eSBldmFsdWF0aW9uIHRvIG1ha2Ugc3VyZSB0aGUgdXBkYXRlRnVuYyBoYXMgYmVlbiBzZXRcbiAgICAgIGNvbnN0IHNldFN0YXRlID0gKG5ld1N0YXRlKSA9PiB1cGRhdGVGdW5jKG5ld1N0YXRlKTtcbiAgICAgIHJldHVybiBjb21wKHByb3BzLCBzZXRTdGF0ZSwgLi4uYXJncyk7XG4gICAgfTtcblxuICAgIHJldHVybiBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgIH0sIHdyYXBwZXJDb21wKTtcbiAgfTtcbn07IiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge29uTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcyc7XG5pbXBvcnQge2NvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbi8vdG9kbyB0aHJvdyB0aGlzIGluIGZhdm9yIG9mIGNvbm5lY3Qgb25seSA/XG5cbi8qKlxuICogQ29tYmluYXRvciB0byBjcmVhdGUgYSBFbG0gbGlrZSBhcHBcbiAqIEBwYXJhbSB2aWV3XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh2aWV3KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoe21vZGVsLCB1cGRhdGVzLCBzdWJzY3JpcHRpb25zID0gW119KSB7XG4gICAgbGV0IGFjdGlvblN0b3JlID0ge307XG5cbiAgICBjb25zdCBjb21wID0gcHJvcHMgPT4gdmlldyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuXG4gICAgY29uc3QgaW5pdEFjdGlvblN0b3JlID0gKHZub2RlKSA9PiB7XG4gICAgICBjb25zdCB1cGRhdGVGdW5jID0gdXBkYXRlKGNvbXAsIHZub2RlKTtcbiAgICAgIGZvciAobGV0IHVwZGF0ZSBvZiBPYmplY3Qua2V5cyh1cGRhdGVzKSkge1xuICAgICAgICBhY3Rpb25TdG9yZVt1cGRhdGVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgICBtb2RlbCA9IHVwZGF0ZXNbdXBkYXRlXShtb2RlbCwgLi4uYXJncyk7IC8vdG9kbyBjb25zaWRlciBzaWRlIGVmZmVjdHMsIG1pZGRsZXdhcmVzLCBldGNcbiAgICAgICAgICByZXR1cm4gdXBkYXRlRnVuYyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBpbml0U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5tYXAoc3ViID0+IHZub2RlID0+IHN1Yih2bm9kZSwgYWN0aW9uU3RvcmUpKTtcbiAgICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICAgIHJldHVybiBvbk1vdW50KGluaXRGdW5jLCBjb21wKTtcbiAgfTtcbn07XG5cblxuLypcblxuY29ubmVjdChzdG9yZSwgYWN0aW9ucywgd2F0Y2hlcilcblxuXG5cblxuICovIiwiaW1wb3J0IHVwZGF0ZSBmcm9tICcuL3VwZGF0ZSc7XG5pbXBvcnQge2NvbXBvc2UsIGN1cnJ5fSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVuTW91bnR9IGZyb20gJy4vbGlmZUN5Y2xlcydcbmltcG9ydCB7aXNEZWVwRXF1YWwsIGlkZW50aXR5fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENvbm5lY3QgY29tYmluYXRvcjogd2lsbCBjcmVhdGUgXCJjb250YWluZXJcIiBjb21wb25lbnQgd2hpY2ggd2lsbCBzdWJzY3JpYmUgdG8gYSBSZWR1eCBsaWtlIHN0b3JlLiBhbmQgdXBkYXRlIGl0cyBjaGlsZHJlbiB3aGVuZXZlciBhIHNwZWNpZmljIHNsaWNlIG9mIHN0YXRlIGNoYW5nZVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc3RvcmUsIGFjdGlvbnMgPSB7fSwgc2xpY2VTdGF0ZSA9IGlkZW50aXR5KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoY29tcCwgbWFwU3RhdGVUb1Byb3AgPSBpZGVudGl0eSwgc2hvdWxkVXBhdGUgPSAoYSwgYikgPT4gIWlzRGVlcEVxdWFsKGEsIGIpKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChpbml0UHJvcCkge1xuICAgICAgbGV0IHVwZGF0ZUZ1bmM7XG4gICAgICBsZXQgcHJldmlvdXNTdGF0ZVNsaWNlO1xuICAgICAgbGV0IGNvbXBvbmVudFByb3BzID0gaW5pdFByb3A7XG4gICAgICBsZXQgdW5zdWJzY3JpYmVyO1xuXG4gICAgICBjb25zdCB3cmFwcGVyQ29tcCA9IChwcm9wcywgLi4uYXJncykgPT4ge1xuICAgICAgICByZXR1cm4gY29tcChwcm9wcywgYWN0aW9ucywgLi4uYXJncyk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBzdWJzY3JpYmUgPSBvbk1vdW50KCh2bm9kZSkgPT4ge1xuICAgICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgICAgIHVuc3Vic2NyaWJlciA9IHN0b3JlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdGVTbGljZSA9IHNsaWNlU3RhdGUoc3RvcmUuZ2V0U3RhdGUoKSk7XG4gICAgICAgICAgaWYgKHNob3VsZFVwYXRlKHByZXZpb3VzU3RhdGVTbGljZSwgc3RhdGVTbGljZSkpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oY29tcG9uZW50UHJvcHMsIG1hcFN0YXRlVG9Qcm9wKHN0YXRlU2xpY2UpKTtcbiAgICAgICAgICAgIHVwZGF0ZUZ1bmMoY29tcG9uZW50UHJvcHMpO1xuICAgICAgICAgICAgcHJldmlvdXNTdGF0ZVNsaWNlID0gc3RhdGVTbGljZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gb25Vbk1vdW50KCgpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmVyKCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNvbXBvc2Uoc3Vic2NyaWJlLCB1bnN1YnNjcmliZSkod3JhcHBlckNvbXApO1xuICAgIH07XG4gIH07XG59OyIsImltcG9ydCB7aH0gZnJvbSBcIi4uLy4uL2luZGV4XCJcblxuZXhwb3J0IGRlZmF1bHQgKHttb2RlbCwgYWN0aW9uc30pID0+IG1vZGVsLmRhdGEubWFwKCh7aWQsIGxhYmVsfSwgaSkgPT5cbiAgPHRyIGNsYXNzPXtpZCA9PT0gbW9kZWwuc2VsZWN0ZWQgPyBcImRhbmdlclwiIDogXCJcIn0+XG4gICAgPHRkIGNsYXNzPVwiY29sLW1kLTFcIj57aWR9PC90ZD5cbiAgICA8dGQgY2xhc3M9XCJjb2wtbWQtNFwiPlxuICAgICAgPGEgb25jbGljaz17XyA9PiBhY3Rpb25zLnNlbGVjdCh7aWR9KX0+e2xhYmVsfTwvYT5cbiAgICA8L3RkPlxuICAgIDx0ZCBjbGFzcz1cImNvbC1tZC0xXCI+XG4gICAgICA8YSBvbmNsaWNrPXtfID0+IGFjdGlvbnMuZGVsZXRlKHtpZH0pfT5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImdseXBoaWNvbiBnbHlwaGljb24tcmVtb3ZlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+XG4gICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPC9hPlxuICAgIDwvdGQ+XG4gICAgPHRkIGNsYXNzPVwiY29sLW1kLTZcIj48L3RkPlxuICA8L3RyPlxuKVxuIiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IHttb2RlbCwgcmVkdWNlcnN9IGZyb20gXCIuL3N0b3JlXCJcbmltcG9ydCBSb3dzVmlldyBmcm9tIFwiLi9yb3dzXCJcbmltcG9ydCB7ZWxtIGFzIGFwcCwgaCwgbW91bnR9IGZyb20gJy4uLy4uL2luZGV4J1xuXG5sZXQgc3RhcnRUaW1lO1xubGV0IGxhc3RNZWFzdXJlO1xuXG5mdW5jdGlvbiBzdGFydE1lYXN1cmUgKG5hbWUsIGNiKSB7XG4gIHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpXG4gIC8vIHBlcmZvcm1hbmNlLm1hcmsoJ3N0YXJ0ICcgKyBuYW1lKTtcbiAgbGFzdE1lYXN1cmUgPSBuYW1lO1xuICBjYigpO1xufVxuXG5mdW5jdGlvbiBzdG9wTWVhc3VyZSAoKSB7XG4gIGNvbnN0IGxhc3QgPSBsYXN0TWVhc3VyZTtcblxuICBpZiAobGFzdE1lYXN1cmUpIHtcbiAgICB3aW5kb3cuc2V0VGltZW91dChcbiAgICAgIGZ1bmN0aW9uIG1ldGFTdG9wTWVhc3VyZSAoKSB7XG4gICAgICAgIGxhc3RNZWFzdXJlID0gbnVsbFxuICAgICAgICBjb25zdCBzdG9wID0gcGVyZm9ybWFuY2Uubm93KClcbiAgICAgICAgLy8gcGVyZm9ybWFuY2UubWFyaygnZW5kICcgKyBsYXN0KTtcbiAgICAgICAgLy8gcGVyZm9ybWFuY2UubWVhc3VyZShsYXN0LCAnc3RhcnQgJyArIGxhc3QsICdlbmQgJyArIGxhc3QpO1xuICAgICAgICBjb25zb2xlLmxvZyhsYXN0ICsgXCIgdG9vayBcIiArIChzdG9wIC0gc3RhcnRUaW1lKSlcbiAgICAgIH0sXG4gICAgICAwXG4gICAgKVxuICB9XG59XG5cbmZ1bmN0aW9uIHZpZXcgKG1vZGVsLCBhY3Rpb25zKSB7XG4gIHN0b3BNZWFzdXJlKClcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwianVtYm90cm9uXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJyb3dcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLW1kLTZcIj5cbiAgICAgICAgICAgIDxoMT5GbGFjbyAwLjEuMDwvaDE+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1tZC02XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicm93XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtc20tNiBzbWFsbHBhZFwiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgIGlkPVwicnVuXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFwicnVuXCIsIGFjdGlvbnMucnVuKX0+XG4gICAgICAgICAgICAgICAgICBDcmVhdGUgMSwwMDAgcm93c1xuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1zbS02IHNtYWxscGFkXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tYmxvY2tcIlxuICAgICAgICAgICAgICAgICAgaWQ9XCJydW5sb3RzXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFxuICAgICAgICAgICAgICAgICAgICAgIFwicnVuTG90c1wiLFxuICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbnMucnVuTG90c1xuICAgICAgICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICAgIENyZWF0ZSAxMCwwMDAgcm93c1xuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1zbS02IHNtYWxscGFkXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tYmxvY2tcIlxuICAgICAgICAgICAgICAgICAgaWQ9XCJhZGRcIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17XyA9PlxuICAgICAgICAgICAgICAgICAgICBzdGFydE1lYXN1cmUoXCJhZGRcIiwgYWN0aW9ucy5hZGQpfT5cbiAgICAgICAgICAgICAgICAgIEFwcGVuZCAxLDAwMCByb3dzXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLXNtLTYgc21hbGxwYWRcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9ja1wiXG4gICAgICAgICAgICAgICAgICBpZD1cInVwZGF0ZVwiXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtfID0+XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TWVhc3VyZShcInVwZGF0ZVwiLCBhY3Rpb25zLnVwZGF0ZSl9PlxuICAgICAgICAgICAgICAgICAgVXBkYXRlIGV2ZXJ5IDEwdGggcm93XG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLXNtLTYgc21hbGxwYWRcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9ja1wiXG4gICAgICAgICAgICAgICAgICBpZD1cImNsZWFyXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFwiY2xlYXJcIiwgYWN0aW9ucy5jbGVhcil9PlxuICAgICAgICAgICAgICAgICAgQ2xlYXJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtc20tNiBzbWFsbHBhZFwiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgIGlkPVwic3dhcHJvd3NcIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17XyA9PlxuICAgICAgICAgICAgICAgICAgICBzdGFydE1lYXN1cmUoXG4gICAgICAgICAgICAgICAgICAgICAgXCJzd2FwUm93c1wiLFxuICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbnMuc3dhcFJvd3NcbiAgICAgICAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAgICBTd2FwIFJvd3NcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLWhvdmVyIHRhYmxlLXN0cmlwZWQgdGVzdC1kYXRhXCI+XG4gICAgICAgIDx0Ym9keT5cbiAgICAgICAgPFJvd3NWaWV3IG1vZGVsPXttb2RlbH0gYWN0aW9ucz17YWN0aW9uc30vPlxuICAgICAgICA8L3Rib2R5PlxuICAgICAgPC90YWJsZT5cbiAgICAgIDxzcGFuXG4gICAgICAgIGNsYXNzPVwicHJlbG9hZGljb24gZ2x5cGhpY29uIGdseXBoaWNvbi1yZW1vdmVcIlxuICAgICAgICBhcmlhLWhpZGRlbj1cInRydWVcIlxuICAgICAgLz5cbiAgICA8L2Rpdj4pO1xufVxuXG5jb25zdCBCZW5jaCA9IGFwcCh2aWV3KTtcblxubW91bnQoKHttb2RlbCwgdXBkYXRlc30pID0+ICg8QmVuY2ggbW9kZWw9e21vZGVsfSB1cGRhdGVzPXt1cGRhdGVzfS8+KSwge1xuICBtb2RlbCwgdXBkYXRlczogcmVkdWNlcnNcbn0sIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibWFpblwiKSk7XG4iXSwibmFtZXMiOlsibW91bnQiLCJ1cGRhdGUiLCJtb2RlbCJdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQUVWLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUE7O0FBRXhCLFNBQVMsU0FBUyxFQUFFLEtBQUssRUFBRTtFQUN6QixNQUFNLFVBQVUsR0FBRztJQUNqQixRQUFRO0lBQ1IsT0FBTztJQUNQLEtBQUs7SUFDTCxPQUFPO0lBQ1As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
