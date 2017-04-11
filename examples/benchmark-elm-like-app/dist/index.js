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

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp
 * @returns {Function}
 */

//todo throw this in favor of connect only ?

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL3N0b3JlLmpzIiwiLi4vLi4vLi4vbGliL2guanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vLi4vLi4vbGliL3V0aWwuanMiLCIuLi8uLi8uLi9saWIvZG9tVXRpbC5qcyIsIi4uLy4uLy4uL2xpYi90cmF2ZXJzZS5qcyIsIi4uLy4uLy4uL2xpYi90cmVlLmpzIiwiLi4vLi4vLi4vbGliL3VwZGF0ZS5qcyIsIi4uLy4uLy4uL2xpYi9saWZlQ3ljbGVzLmpzIiwiLi4vLi4vLi4vbGliL3dpdGhTdGF0ZS5qcyIsIi4uLy4uLy4uL2xpYi9lbG0uanMiLCIuLi8uLi8uLi9saWIvY29ubmVjdC5qcyIsIi4uL3Jvd3MuanMiLCIuLi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgaWQgPSAxXG5cbmNvbnN0IHJhbmQgPSBNYXRoLnJhbmRvbVxuXG5mdW5jdGlvbiBidWlsZERhdGEgKGNvdW50KSB7XG4gIGNvbnN0IGFkamVjdGl2ZXMgPSBbXG4gICAgXCJwcmV0dHlcIixcbiAgICBcImxhcmdlXCIsXG4gICAgXCJiaWdcIixcbiAgICBcInNtYWxsXCIsXG4gICAgXCJ0YWxsXCIsXG4gICAgXCJzaG9ydFwiLFxuICAgIFwibG9uZ1wiLFxuICAgIFwiaGFuZHNvbWVcIixcbiAgICBcInBsYWluXCIsXG4gICAgXCJxdWFpbnRcIixcbiAgICBcImNsZWFuXCIsXG4gICAgXCJlbGVnYW50XCIsXG4gICAgXCJlYXN5XCIsXG4gICAgXCJhbmdyeVwiLFxuICAgIFwiY3JhenlcIixcbiAgICBcImhlbHBmdWxcIixcbiAgICBcIm11c2h5XCIsXG4gICAgXCJvZGRcIixcbiAgICBcInVuc2lnaHRseVwiLFxuICAgIFwiYWRvcmFibGVcIixcbiAgICBcImltcG9ydGFudFwiLFxuICAgIFwiaW5leHBlbnNpdmVcIixcbiAgICBcImNoZWFwXCIsXG4gICAgXCJleHBlbnNpdmVcIixcbiAgICBcImZhbmN5XCIsXG4gIF1cblxuICBjb25zdCBjb2xvdXJzID0gW1xuICAgIFwicmVkXCIsXG4gICAgXCJ5ZWxsb3dcIixcbiAgICBcImJsdWVcIixcbiAgICBcImdyZWVuXCIsXG4gICAgXCJwaW5rXCIsXG4gICAgXCJicm93blwiLFxuICAgIFwicHVycGxlXCIsXG4gICAgXCJicm93blwiLFxuICAgIFwid2hpdGVcIixcbiAgICBcImJsYWNrXCIsXG4gICAgXCJvcmFuZ2VcIixcbiAgXVxuXG4gIGNvbnN0IG5vdW5zID0gW1xuICAgIFwidGFibGVcIixcbiAgICBcImNoYWlyXCIsXG4gICAgXCJob3VzZVwiLFxuICAgIFwiYmJxXCIsXG4gICAgXCJkZXNrXCIsXG4gICAgXCJjYXJcIixcbiAgICBcInBvbnlcIixcbiAgICBcImNvb2tpZVwiLFxuICAgIFwic2FuZHdpY2hcIixcbiAgICBcImJ1cmdlclwiLFxuICAgIFwicGl6emFcIixcbiAgICBcIm1vdXNlXCIsXG4gICAgXCJrZXlib2FyZFwiLFxuICBdXG5cbiAgcmV0dXJuIG5ldyBBcnJheShjb3VudCkuZmlsbCgwKS5tYXAoXyA9PiAoe1xuICAgIGlkOiBpZCsrLFxuICAgIGxhYmVsOiBgJHthZGplY3RpdmVzW1xuICAgIHJhbmQoKSAqIDEwMDAgJSBhZGplY3RpdmVzLmxlbmd0aCA+PiAwXX0gJHtjb2xvdXJzW1xuICAgIHJhbmQoKSAqIDEwMDAgJSBjb2xvdXJzLmxlbmd0aCA+PiAwXX0gJHtub3Vuc1tcbiAgICByYW5kKCkgKiAxMDAwICUgbm91bnMubGVuZ3RoID4+IDBdfWBcbiAgfSkpXG59XG5cbmNvbnN0IG1vZGVsID0ge1xuICBkYXRhOiBbXSxcbiAgc2VsZWN0ZWQ6IGZhbHNlXG59XG5cbmNvbnN0IHJlZHVjZXJzID0ge1xuICBydW46IG1vZGVsID0+ICh7XG4gICAgZGF0YTogYnVpbGREYXRhKDEwMDApLFxuICAgIHNlbGVjdGVkOiB1bmRlZmluZWRcbiAgfSksXG5cbiAgYWRkOiBtb2RlbCA9PiAoe1xuICAgIGRhdGE6IG1vZGVsLmRhdGEuY29uY2F0KGJ1aWxkRGF0YSgxMDAwKSksXG4gICAgc2VsZWN0ZWQ6IHVuZGVmaW5lZFxuICB9KSxcblxuICBydW5Mb3RzOiBtb2RlbCA9PiAoe1xuICAgIGRhdGE6IGJ1aWxkRGF0YSgxMDAwMCksXG4gICAgc2VsZWN0ZWQ6IHVuZGVmaW5lZFxuICB9KSxcblxuICBjbGVhcjogbW9kZWwgPT4gKHtcbiAgICBkYXRhOiBbXSxcbiAgICBzZWxlY3RlZDogdW5kZWZpbmVkXG4gIH0pLFxuXG4gIHVwZGF0ZTogbW9kZWwgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiBtb2RlbC5kYXRhLm1hcCgoZCwgaSkgPT4ge1xuICAgICAgICBpZiAoaSAlIDEwID09PSAwKSB7XG4gICAgICAgICAgZC5sYWJlbCA9IGAke2QubGFiZWx9ICEhIWBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZFxuICAgICAgfSksXG4gICAgICBzZWxlY3RlZDogdW5kZWZpbmVkXG4gICAgfVxuICB9LFxuXG4gIHN3YXBSb3dzOiBtb2RlbCA9PiB7XG4gICAgaWYgKG1vZGVsLmRhdGEubGVuZ3RoIDw9IDEwKSB7XG4gICAgICByZXR1cm4gbW9kZWxcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gbW9kZWwuZGF0YVs0XVxuICAgIG1vZGVsLmRhdGFbNF0gPSBtb2RlbC5kYXRhWzldXG4gICAgbW9kZWwuZGF0YVs5XSA9IHRlbXBcblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiBtb2RlbC5kYXRhLFxuICAgICAgc2VsZWN0ZWQ6IG1vZGVsLnNlbGVjdGVkXG4gICAgfVxuICB9LFxuXG4gIHNlbGVjdDogKG1vZGVsLCBkYXRhKSA9PiAoe1xuICAgIGRhdGE6IG1vZGVsLmRhdGEsXG4gICAgc2VsZWN0ZWQ6IGRhdGEuaWRcbiAgfSksXG5cbiAgZGVsZXRlOiAobW9kZWwsIGRhdGEpID0+ICh7XG4gICAgZGF0YTogbW9kZWwuZGF0YS5maWx0ZXIoZCA9PiBkLmlkICE9PSBkYXRhLmlkKVxuICB9KVxufVxuXG5leHBvcnQge1xuICBtb2RlbCwgcmVkdWNlcnNcbn1cblxuIiwiY29uc3QgY3JlYXRlVGV4dFZOb2RlID0gKHZhbHVlKSA9PiAoe1xuICBub2RlVHlwZTogJ1RleHQnLFxuICBjaGlsZHJlbjogW10sXG4gIHByb3BzOiB7dmFsdWV9XG59KTtcblxuLyoqXG4gKiBUcmFuc2Zvcm0gaHlwZXJzY3JpcHQgaW50byB2aXJ0dWFsIGRvbSBub2RlXG4gKiBAcGFyYW0gbm9kZVR5cGVcbiAqIEBwYXJhbSBwcm9wc1xuICogQHBhcmFtIGNoaWxkcmVuXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gaCAobm9kZVR5cGUsIHByb3BzLCAuLi5jaGlsZHJlbikge1xuICBjb25zdCBmbGF0Q2hpbGRyZW4gPSBjaGlsZHJlbi5yZWR1Y2UoKGFjYywgY2hpbGQpID0+IHtcbiAgICBjb25zdCBjaGlsZHJlbkFycmF5ID0gQXJyYXkuaXNBcnJheShjaGlsZCkgPyBjaGlsZCA6IFtjaGlsZF07XG4gICAgcmV0dXJuIGFjYy5jb25jYXQoY2hpbGRyZW5BcnJheSk7XG4gIH0sIFtdKVxuICAgIC5tYXAoY2hpbGQgPT4ge1xuICAgICAgLy8gbm9ybWFsaXplIHRleHQgbm9kZSB0byBoYXZlIHNhbWUgc3RydWN0dXJlIHRoYW4gcmVndWxhciBkb20gbm9kZXNcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgY2hpbGQ7XG4gICAgICByZXR1cm4gdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkIDogY3JlYXRlVGV4dFZOb2RlKGNoaWxkKTtcbiAgICB9KTtcblxuICBpZiAodHlwZW9mIG5vZGVUeXBlICE9PSAnZnVuY3Rpb24nKSB7Ly9yZWd1bGFyIGh0bWwvdGV4dCBub2RlXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGVUeXBlLFxuICAgICAgcHJvcHM6IHByb3BzLFxuICAgICAgY2hpbGRyZW46IGZsYXRDaGlsZHJlblxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZnVsbFByb3BzID0gT2JqZWN0LmFzc2lnbih7Y2hpbGRyZW46IGZsYXRDaGlsZHJlbn0sIHByb3BzKTtcbiAgICBjb25zdCBjb21wID0gbm9kZVR5cGUoZnVsbFByb3BzKTtcbiAgICByZXR1cm4gdHlwZW9mIGNvbXAgIT09ICdmdW5jdGlvbicgPyBjb21wIDogaChjb21wLCBwcm9wcywgLi4uZmxhdENoaWxkcmVuKTsgLy9mdW5jdGlvbmFsIGNvbXAgdnMgY29tYmluYXRvciAoSE9DKVxuICB9XG59OyIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBjb25zdCBuZXh0VGljayA9IGZuID0+IHNldFRpbWVvdXQoZm4sIDApO1xuXG5leHBvcnQgY29uc3QgcGFpcmlmeSA9IGhvbGRlciA9PiBrZXkgPT4gW2tleSwgaG9sZGVyW2tleV1dO1xuXG5leHBvcnQgY29uc3QgaXNTaGFsbG93RXF1YWwgPSAoYSwgYikgPT4ge1xuICBjb25zdCBhS2V5cyA9IE9iamVjdC5rZXlzKGEpO1xuICBjb25zdCBiS2V5cyA9IE9iamVjdC5rZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoKGspID0+IGFba10gPT09IGJba10pO1xufTtcblxuY29uc3Qgb3duS2V5cyA9IG9iaiA9PiBPYmplY3Qua2V5cyhvYmopLmZpbHRlcihrID0+IG9iai5oYXNPd25Qcm9wZXJ0eShrKSk7XG5cbmV4cG9ydCBjb25zdCBpc0RlZXBFcXVhbCA9IChhLCBiKSA9PiB7XG4gIGNvbnN0IHR5cGUgPSB0eXBlb2YgYTtcblxuICAvL3Nob3J0IHBhdGgocylcbiAgaWYgKGEgPT09IGIpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSB0eXBlb2YgYikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICh0eXBlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBhID09PSBiO1xuICB9XG5cbiAgLy8gb2JqZWN0cyAuLi5cbiAgaWYgKGEgPT09IG51bGwgfHwgYiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KGEpKSB7XG4gICAgcmV0dXJuIGEubGVuZ3RoICYmIGIubGVuZ3RoICYmIGEuZXZlcnkoKGl0ZW0sIGkpID0+IGlzRGVlcEVxdWFsKGFbaV0sIGJbaV0pKTtcbiAgfVxuXG4gIGNvbnN0IGFLZXlzID0gb3duS2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBvd25LZXlzKGIpO1xuICByZXR1cm4gYUtleXMubGVuZ3RoID09PSBiS2V5cy5sZW5ndGggJiYgYUtleXMuZXZlcnkoayA9PiBpc0RlZXBFcXVhbChhW2tdLCBiW2tdKSk7XG59O1xuXG5leHBvcnQgY29uc3QgaWRlbnRpdHkgPSBwID0+IHA7XG5cbmV4cG9ydCBjb25zdCBub29wID0gKCkgPT4ge1xufTtcbiIsImltcG9ydCB7dGFwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCB1cGRhdGVEb21Ob2RlRmFjdG9yeSA9IChtZXRob2QpID0+IChpdGVtcykgPT4gdGFwKGRvbU5vZGUgPT4ge1xuICBmb3IgKGxldCBwYWlyIG9mIGl0ZW1zKSB7XG4gICAgZG9tTm9kZVttZXRob2RdKC4uLnBhaXIpO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IHJlbW92ZUV2ZW50TGlzdGVuZXJzID0gdXBkYXRlRG9tTm9kZUZhY3RvcnkoJ3JlbW92ZUV2ZW50TGlzdGVuZXInKTtcbmV4cG9ydCBjb25zdCBhZGRFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdhZGRFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3Qgc2V0QXR0cmlidXRlcyA9IChpdGVtcykgPT4gdGFwKChkb21Ob2RlKSA9PiB7XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBpdGVtcy5maWx0ZXIoKFtrZXksIHZhbHVlXSkgPT4gdHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nKTtcbiAgZm9yIChsZXQgW2tleSwgdmFsdWVdIG9mIGF0dHJpYnV0ZXMpIHtcbiAgICB2YWx1ZSA9PT0gZmFsc2UgPyBkb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZShrZXkpIDogZG9tTm9kZS5zZXRBdHRyaWJ1dGUoa2V5LCB2YWx1ZSk7XG4gIH1cbn0pO1xuZXhwb3J0IGNvbnN0IHJlbW92ZUF0dHJpYnV0ZXMgPSAoaXRlbXMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgYXR0ciBvZiBpdGVtcykge1xuICAgIGRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IHNldFRleHROb2RlID0gdmFsID0+IG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudCA9IHZhbDtcblxuZXhwb3J0IGNvbnN0IGNyZWF0ZURvbU5vZGUgPSB2bm9kZSA9PiB7XG4gIHJldHVybiB2bm9kZS5ub2RlVHlwZSAhPT0gJ1RleHQnID9cbiAgICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHZub2RlLm5vZGVUeXBlKSA6XG4gICAgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoU3RyaW5nKHZub2RlLnByb3BzLnZhbHVlKSk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0RXZlbnRMaXN0ZW5lcnMgPSAocHJvcHMpID0+IHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BzKVxuICAgIC5maWx0ZXIoayA9PiBrLnN1YnN0cigwLCAyKSA9PT0gJ29uJylcbiAgICAubWFwKGsgPT4gW2suc3Vic3RyKDIpLnRvTG93ZXJDYXNlKCksIHByb3BzW2tdXSk7XG59O1xuIiwiZXhwb3J0IGNvbnN0IHRyYXZlcnNlID0gZnVuY3Rpb24gKiAodm5vZGUpIHtcbiAgeWllbGQgdm5vZGU7XG4gIGlmICh2bm9kZS5jaGlsZHJlbiAmJiB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICBmb3IgKGxldCBjaGlsZCBvZiB2bm9kZS5jaGlsZHJlbikge1xuICAgICAgeWllbGQgKiB0cmF2ZXJzZShjaGlsZCk7XG4gICAgfVxuICB9XG59OyIsImltcG9ydCB7Y29tcG9zZSwgY3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQge1xuICBpc1NoYWxsb3dFcXVhbCxcbiAgcGFpcmlmeSxcbiAgbmV4dFRpY2ssXG4gIG5vb3Bcbn0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7XG4gIHJlbW92ZUF0dHJpYnV0ZXMsXG4gIHNldEF0dHJpYnV0ZXMsXG4gIHNldFRleHROb2RlLFxuICBjcmVhdGVEb21Ob2RlLFxuICByZW1vdmVFdmVudExpc3RlbmVycyxcbiAgYWRkRXZlbnRMaXN0ZW5lcnMsXG4gIGdldEV2ZW50TGlzdGVuZXJzLFxufSBmcm9tICcuL2RvbVV0aWwnO1xuaW1wb3J0IHt0cmF2ZXJzZX0gZnJvbSAnLi90cmF2ZXJzZSc7XG5cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzICh7cHJvcHM6bmV3Tm9kZVByb3BzfT17fSwge3Byb3BzOm9sZE5vZGVQcm9wc309e30pIHtcbiAgY29uc3QgbmV3Tm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG5ld05vZGVQcm9wcyB8fCB7fSk7XG4gIGNvbnN0IG9sZE5vZGVFdmVudHMgPSBnZXRFdmVudExpc3RlbmVycyhvbGROb2RlUHJvcHMgfHwge30pO1xuXG4gIHJldHVybiBuZXdOb2RlRXZlbnRzLmxlbmd0aCB8fCBvbGROb2RlRXZlbnRzLmxlbmd0aCA/XG4gICAgY29tcG9zZShcbiAgICAgIHJlbW92ZUV2ZW50TGlzdGVuZXJzKG9sZE5vZGVFdmVudHMpLFxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcnMobmV3Tm9kZUV2ZW50cylcbiAgICApIDogbm9vcDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQXR0cmlidXRlcyAobmV3Vk5vZGUsIG9sZFZOb2RlKSB7XG4gIGNvbnN0IG5ld1ZOb2RlUHJvcHMgPSBuZXdWTm9kZS5wcm9wcyB8fCB7fTtcbiAgY29uc3Qgb2xkVk5vZGVQcm9wcyA9IG9sZFZOb2RlLnByb3BzIHx8IHt9O1xuXG4gIGlmIChpc1NoYWxsb3dFcXVhbChuZXdWTm9kZVByb3BzLCBvbGRWTm9kZVByb3BzKSkge1xuICAgIHJldHVybiBub29wO1xuICB9XG5cbiAgaWYgKG5ld1ZOb2RlLm5vZGVUeXBlID09PSAnVGV4dCcpIHtcbiAgICByZXR1cm4gc2V0VGV4dE5vZGUobmV3Vk5vZGUucHJvcHMudmFsdWUpO1xuICB9XG5cbiAgY29uc3QgbmV3Tm9kZUtleXMgPSBPYmplY3Qua2V5cyhuZXdWTm9kZVByb3BzKTtcbiAgY29uc3Qgb2xkTm9kZUtleXMgPSBPYmplY3Qua2V5cyhvbGRWTm9kZVByb3BzKTtcbiAgY29uc3QgYXR0cmlidXRlc1RvUmVtb3ZlID0gb2xkTm9kZUtleXMuZmlsdGVyKGsgPT4gIW5ld05vZGVLZXlzLmluY2x1ZGVzKGspKTtcblxuICByZXR1cm4gY29tcG9zZShcbiAgICByZW1vdmVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXNUb1JlbW92ZSksXG4gICAgc2V0QXR0cmlidXRlcyhuZXdOb2RlS2V5cy5tYXAocGFpcmlmeShuZXdWTm9kZVByb3BzKSkpXG4gICk7XG59XG5cbmNvbnN0IGRvbUZhY3RvcnkgPSBjcmVhdGVEb21Ob2RlO1xuXG4vLyBhcHBseSB2bm9kZSBkaWZmaW5nIHRvIGFjdHVhbCBkb20gbm9kZSAoaWYgbmV3IG5vZGUgPT4gaXQgd2lsbCBiZSBtb3VudGVkIGludG8gdGhlIHBhcmVudClcbmNvbnN0IGRvbWlmeSA9IGZ1bmN0aW9uIHVwZGF0ZURvbSAob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlKSB7XG4gIGlmICghb2xkVm5vZGUpIHsvL3RoZXJlIGlzIG5vIHByZXZpb3VzIHZub2RlXG4gICAgaWYgKG5ld1Zub2RlKSB7Ly9uZXcgbm9kZSA9PiB3ZSBpbnNlcnRcbiAgICAgIG5ld1Zub2RlLmRvbSA9IHBhcmVudERvbU5vZGUuYXBwZW5kQ2hpbGQoZG9tRmFjdG9yeShuZXdWbm9kZSkpO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gMTtcbiAgICAgIHJldHVybiB7dm5vZGU6IG5ld1Zub2RlLCBnYXJiYWdlOiBudWxsfTtcbiAgICB9IGVsc2Ugey8vZWxzZSAoaXJyZWxldmFudClcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgb3BlcmF0aW9uJylcbiAgICB9XG4gIH0gZWxzZSB7Ly90aGVyZSBpcyBhIHByZXZpb3VzIHZub2RlXG4gICAgaWYgKCFuZXdWbm9kZSkgey8vd2UgbXVzdCByZW1vdmUgdGhlIHJlbGF0ZWQgZG9tIG5vZGVcbiAgICAgIHBhcmVudERvbU5vZGUucmVtb3ZlQ2hpbGQob2xkVm5vZGUuZG9tKTtcbiAgICAgIHJldHVybiAoe2dhcmJhZ2U6IG9sZFZub2RlLCBkb206IG51bGx9KTtcbiAgICB9IGVsc2UgaWYgKG5ld1Zub2RlLm5vZGVUeXBlICE9PSBvbGRWbm9kZS5ub2RlVHlwZSkgey8vaXQgbXVzdCBiZSByZXBsYWNlZFxuICAgICAgbmV3Vm5vZGUuZG9tID0gZG9tRmFjdG9yeShuZXdWbm9kZSk7XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSAxO1xuICAgICAgcGFyZW50RG9tTm9kZS5yZXBsYWNlQ2hpbGQobmV3Vm5vZGUuZG9tLCBvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuIHtnYXJiYWdlOiBvbGRWbm9kZSwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9IGVsc2Ugey8vIG9ubHkgdXBkYXRlIGF0dHJpYnV0ZXNcbiAgICAgIG5ld1Zub2RlLmRvbSA9IG9sZFZub2RlLmRvbTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IG9sZFZub2RlLmxpZmVDeWNsZSArIDE7XG4gICAgICByZXR1cm4ge2dhcmJhZ2U6IG51bGwsIHZub2RlOiBuZXdWbm9kZX07XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIHJlbmRlciBhIHZpcnR1YWwgZG9tIG5vZGUsIGRpZmZpbmcgaXQgd2l0aCBpdHMgcHJldmlvdXMgdmVyc2lvbiwgbW91bnRpbmcgaXQgaW4gYSBwYXJlbnQgZG9tIG5vZGVcbiAqIEBwYXJhbSBvbGRWbm9kZVxuICogQHBhcmFtIG5ld1Zub2RlXG4gKiBAcGFyYW0gcGFyZW50RG9tTm9kZVxuICogQHBhcmFtIG9uTmV4dFRpY2sgY29sbGVjdCBvcGVyYXRpb25zIHRvIGJlIHByb2Nlc3NlZCBvbiBuZXh0IHRpY2tcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZXhwb3J0IGNvbnN0IHJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcmVyIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUsIG9uTmV4dFRpY2sgPSBbXSkge1xuXG4gIC8vMS4gdHJhbnNmb3JtIHRoZSBuZXcgdm5vZGUgdG8gYSB2bm9kZSBjb25uZWN0ZWQgdG8gYW4gYWN0dWFsIGRvbSBlbGVtZW50IGJhc2VkIG9uIHZub2RlIHZlcnNpb25zIGRpZmZpbmdcbiAgLy8gaS4gbm90ZSBhdCB0aGlzIHN0ZXAgb2NjdXIgZG9tIGluc2VydGlvbnMvcmVtb3ZhbHNcbiAgLy8gaWkuIGl0IG1heSBjb2xsZWN0IHN1YiB0cmVlIHRvIGJlIGRyb3BwZWQgKG9yIFwidW5tb3VudGVkXCIpXG4gIGNvbnN0IHt2bm9kZSwgZ2FyYmFnZX0gPSBkb21pZnkob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlKTtcblxuICBpZiAoZ2FyYmFnZSAhPT0gbnVsbCkge1xuICAgIC8vIGRlZmVyIHVubW91bnQgbGlmZWN5Y2xlIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgZm9yIChsZXQgZyBvZiB0cmF2ZXJzZShnYXJiYWdlKSkge1xuICAgICAgaWYgKGcub25Vbk1vdW50KSB7XG4gICAgICAgIG9uTmV4dFRpY2sucHVzaChnLm9uVW5Nb3VudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy9Ob3JtYWxpc2F0aW9uIG9mIG9sZCBub2RlIChpbiBjYXNlIG9mIGEgcmVwbGFjZSB3ZSB3aWxsIGNvbnNpZGVyIG9sZCBub2RlIGFzIGVtcHR5IG5vZGUgKG5vIGNoaWxkcmVuLCBubyBwcm9wcykpXG4gIGNvbnN0IHRlbXBPbGROb2RlID0gZ2FyYmFnZSAhPT0gbnVsbCB8fCAhb2xkVm5vZGUgPyB7bGVuZ3RoOiAwLCBjaGlsZHJlbjogW10sIHByb3BzOiB7fX0gOiBvbGRWbm9kZTtcblxuICBpZiAodm5vZGUpIHtcblxuICAgIC8vMi4gdXBkYXRlIGRvbSBhdHRyaWJ1dGVzIGJhc2VkIG9uIHZub2RlIHByb3AgZGlmZmluZy5cbiAgICAvL3N5bmNcblxuICAgIGlmICh2bm9kZS5vblVwZGF0ZSAmJiB2bm9kZS5saWZlQ3ljbGUgPiAxKSB7XG4gICAgICB2bm9kZS5vblVwZGF0ZSgpO1xuICAgIH1cblxuICAgIHVwZGF0ZUF0dHJpYnV0ZXModm5vZGUsIHRlbXBPbGROb2RlKSh2bm9kZS5kb20pO1xuXG4gICAgLy9mYXN0IHBhdGhcbiAgICBpZiAodm5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgICAgcmV0dXJuIG9uTmV4dFRpY2s7XG4gICAgfVxuXG4gICAgaWYgKHZub2RlLm9uTW91bnQgJiYgdm5vZGUubGlmZUN5Y2xlID09PSAxKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gdm5vZGUub25Nb3VudCgpKTtcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbkNvdW50ID0gTWF0aC5tYXgodGVtcE9sZE5vZGUuY2hpbGRyZW4ubGVuZ3RoLCB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpO1xuXG4gICAgLy9hc3luYyB3aWxsIGJlIGRlZmVycmVkIGFzIGl0IGlzIG5vdCBcInZpc3VhbFwiXG4gICAgY29uc3Qgc2V0TGlzdGVuZXJzID0gdXBkYXRlRXZlbnRMaXN0ZW5lcnModm5vZGUsIHRlbXBPbGROb2RlKTtcbiAgICBpZiAoc2V0TGlzdGVuZXJzICE9PSBub29wKSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gc2V0TGlzdGVuZXJzKHZub2RlLmRvbSkpO1xuICAgIH1cblxuICAgIC8vMyByZWN1cnNpdmVseSB0cmF2ZXJzZSBjaGlsZHJlbiB0byB1cGRhdGUgZG9tIGFuZCBjb2xsZWN0IGZ1bmN0aW9ucyB0byBwcm9jZXNzIG9uIG5leHQgdGlja1xuICAgIGlmIChjaGlsZHJlbkNvdW50ID4gMCkge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbkNvdW50OyBpKyspIHtcbiAgICAgICAgLy8gd2UgcGFzcyBvbk5leHRUaWNrIGFzIHJlZmVyZW5jZSAoaW1wcm92ZSBwZXJmOiBtZW1vcnkgKyBzcGVlZClcbiAgICAgICAgcmVuZGVyKHRlbXBPbGROb2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5jaGlsZHJlbltpXSwgdm5vZGUuZG9tLCBvbk5leHRUaWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb25OZXh0VGljaztcbn07XG5cbmV4cG9ydCBjb25zdCBtb3VudCA9IGN1cnJ5KGZ1bmN0aW9uIChjb21wLCBpbml0UHJvcCwgcm9vdCkge1xuICBjb25zdCB2bm9kZSA9IGNvbXAubm9kZVR5cGUgIT09IHZvaWQgMCA/IGNvbXAgOiBjb21wKGluaXRQcm9wIHx8IHt9KTtcbiAgY29uc3QgYmF0Y2ggPSByZW5kZXIobnVsbCwgdm5vZGUsIHJvb3QpO1xuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgZm9yIChsZXQgb3Agb2YgYmF0Y2gpIHtcbiAgICAgIG9wKCk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHZub2RlO1xufSk7IiwiaW1wb3J0IHtyZW5kZXJ9IGZyb20gJy4vdHJlZSc7XG5pbXBvcnQge25leHRUaWNrfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgdHJpZ2dlciBhbiB1cGRhdGUgb2YgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBwYXNzZWQgc3RhdGVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcGFyYW0gaW5pdGlhbFZOb2RlXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb24oKj0sIC4uLlsqXSl9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVwZGF0ZSAoY29tcCwgaW5pdGlhbFZOb2RlKSB7XG4gIGxldCBvbGROb2RlID0gaW5pdGlhbFZOb2RlO1xuICBjb25zdCB1cGRhdGVGdW5jID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgbW91bnQgPSBvbGROb2RlLmRvbS5wYXJlbnROb2RlO1xuICAgIGNvbnN0IG5ld05vZGUgPSBjb21wKE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBvbGROb2RlLmNoaWxkcmVuIHx8IFtdfSwgb2xkTm9kZS5wcm9wcywgcHJvcHMpLCAuLi5hcmdzKTtcbiAgICBjb25zdCBuZXh0QmF0Y2ggPSByZW5kZXIob2xkTm9kZSwgbmV3Tm9kZSwgbW91bnQpO1xuXG4gICAgLy8gZGFuZ2VyIHpvbmUgISEhIVxuICAgIC8vIGNoYW5nZSBieSBrZWVwaW5nIHRoZSBzYW1lIHJlZmVyZW5jZSBzbyB0aGUgZXZlbnR1YWwgcGFyZW50IG5vZGUgZG9lcyBub3QgbmVlZCB0byBiZSBcImF3YXJlXCIgdHJlZSBtYXkgaGF2ZSBjaGFuZ2VkIGRvd25zdHJlYW06IG9sZE5vZGUgbWF5IGJlIHRoZSBjaGlsZCBvZiBzb21lb25lIC4uLih3ZWxsIHRoYXQgaXMgYSB0cmVlIGRhdGEgc3RydWN0dXJlIGFmdGVyIGFsbCA6UCApXG4gICAgb2xkTm9kZSA9IE9iamVjdC5hc3NpZ24ob2xkTm9kZSB8fCB7fSwgbmV3Tm9kZSk7XG4gICAgLy8gZW5kIGRhbmdlciB6b25lXG5cbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBmb3IgKGxldCBvcCBvZiBuZXh0QmF0Y2gpIHtcbiAgICAgICAgb3AoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZTtcbiAgfTtcbiAgcmV0dXJuIHVwZGF0ZUZ1bmM7XG59IiwiaW1wb3J0IHtjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuY29uc3QgbGlmZUN5Y2xlRmFjdG9yeSA9IG1ldGhvZCA9PiBjdXJyeSgoZm4sIGNvbXApID0+IChwcm9wcywgLi4uYXJncykgPT4ge1xuICBjb25zdCBuID0gY29tcChwcm9wcywgLi4uYXJncyk7XG4gIG5bbWV0aG9kXSA9ICgpID0+IGZuKG4sIC4uLmFyZ3MpO1xuICByZXR1cm4gbjtcbn0pO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvbk1vdW50ID0gbGlmZUN5Y2xlRmFjdG9yeSgnb25Nb3VudCcpO1xuXG4vKipcbiAqIGxpZmUgY3ljbGU6IHdoZW4gdGhlIGNvbXBvbmVudCBpcyB1bm1vdW50ZWRcbiAqL1xuZXhwb3J0IGNvbnN0IG9uVW5Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uVW5Nb3VudCcpO1xuXG5leHBvcnQgY29uc3Qgb25VcGRhdGUgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvblVwZGF0ZScpOyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50LCBvblVwZGF0ZX0gZnJvbSAnLi9saWZlQ3ljbGVzJztcbmltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcblxuLyoqXG4gKiBDb21iaW5hdG9yIHRvIGNyZWF0ZSBhIFwic3RhdGVmdWwgY29tcG9uZW50XCI6IGllIGl0IHdpbGwgaGF2ZSBpdHMgb3duIHN0YXRlIGFuZCB0aGUgYWJpbGl0eSB0byB1cGRhdGUgaXRzIG93biB0cmVlXG4gKiBAcGFyYW0gY29tcFxuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoY29tcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAvL2xhenkgZXZhbHVhdGUgdXBkYXRlRnVuYyAodG8gbWFrZSBzdXJlIGl0IGlzIGRlZmluZWRcbiAgICAgIGNvbnN0IHNldFN0YXRlID0gKG5ld1N0YXRlKSA9PiB1cGRhdGVGdW5jKG5ld1N0YXRlKTtcbiAgICAgIHJldHVybiBjb21wKHByb3BzLCBzZXRTdGF0ZSwgLi4uYXJncyk7XG4gICAgfTtcbiAgICBjb25zdCBzZXRVcGRhdGVGdW5jdGlvbiA9ICh2bm9kZSkgPT4ge1xuICAgICAgdXBkYXRlRnVuYyA9IHVwZGF0ZSh3cmFwcGVyQ29tcCwgdm5vZGUpO1xuICAgIH07XG5cbiAgICByZXR1cm4gY29tcG9zZShvbk1vdW50KHNldFVwZGF0ZUZ1bmN0aW9uKSwgb25VcGRhdGUoc2V0VXBkYXRlRnVuY3Rpb24pKSh3cmFwcGVyQ29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vL3RvZG8gdGhyb3cgdGhpcyBpbiBmYXZvciBvZiBjb25uZWN0IG9ubHkgP1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAodmlldykge1xuICByZXR1cm4gZnVuY3Rpb24gKHttb2RlbCwgdXBkYXRlcywgc3Vic2NyaXB0aW9ucyA9IFtdfT17fSkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGxldCBhY3Rpb25TdG9yZSA9IHt9O1xuICAgIGZvciAobGV0IHVwZGF0ZSBvZiBPYmplY3Qua2V5cyh1cGRhdGVzKSkge1xuICAgICAgYWN0aW9uU3RvcmVbdXBkYXRlXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIG1vZGVsID0gdXBkYXRlc1t1cGRhdGVdKG1vZGVsLCAuLi5hcmdzKTsgLy90b2RvIGNvbnNpZGVyIHNpZGUgZWZmZWN0cywgbWlkZGxld2FyZXMsIGV0Y1xuICAgICAgICByZXR1cm4gdXBkYXRlRnVuYyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbXAgPSAoKSA9PiB2aWV3KG1vZGVsLCBhY3Rpb25TdG9yZSk7XG5cbiAgICBjb25zdCBpbml0QWN0aW9uU3RvcmUgPSAodm5vZGUpID0+IHtcbiAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUoY29tcCwgdm5vZGUpO1xuICAgIH07XG4gICAgY29uc3QgaW5pdFN1YnNjcmlwdGlvbiA9IHN1YnNjcmlwdGlvbnMubWFwKHN1YiA9PiB2bm9kZSA9PiBzdWIodm5vZGUsIGFjdGlvblN0b3JlKSk7XG4gICAgY29uc3QgaW5pdEZ1bmMgPSBjb21wb3NlKGluaXRBY3Rpb25TdG9yZSwgLi4uaW5pdFN1YnNjcmlwdGlvbik7XG5cbiAgICByZXR1cm4gb25Nb3VudChpbml0RnVuYywgY29tcCk7XG4gIH07XG59OyIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtjb21wb3NlLCBjdXJyeX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7b25Nb3VudCwgb25Vbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnXG5pbXBvcnQge2lzRGVlcEVxdWFsLCBpZGVudGl0eX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBDb25uZWN0IGNvbWJpbmF0b3I6IHdpbGwgY3JlYXRlIFwiY29udGFpbmVyXCIgY29tcG9uZW50IHdoaWNoIHdpbGwgc3Vic2NyaWJlIHRvIGEgUmVkdXggbGlrZSBzdG9yZS4gYW5kIHVwZGF0ZSBpdHMgY2hpbGRyZW4gd2hlbmV2ZXIgYSBzcGVjaWZpYyBzbGljZSBvZiBzdGF0ZSBjaGFuZ2UgdW5kZXIgc3BlY2lmaWMgY2lyY3Vtc3RhbmNlc1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc3RvcmUsIGFjdGlvbnMgPSB7fSwgc2xpY2VTdGF0ZSA9IGlkZW50aXR5KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoY29tcCwgbWFwU3RhdGVUb1Byb3AgPSBpZGVudGl0eSwgc2hvdWxkVXBhdGUgPSAoYSwgYikgPT4gaXNEZWVwRXF1YWwoYSwgYikgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChpbml0UHJvcCkge1xuICAgICAgbGV0IGNvbXBvbmVudFByb3BzID0gaW5pdFByb3A7XG4gICAgICBsZXQgdXBkYXRlRnVuYywgcHJldmlvdXNTdGF0ZVNsaWNlLCB1bnN1YnNjcmliZXI7XG5cbiAgICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIHJldHVybiBjb21wKHByb3BzLCBhY3Rpb25zLCAuLi5hcmdzKTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHN1YnNjcmliZSA9IG9uTW91bnQoKHZub2RlKSA9PiB7XG4gICAgICAgIHVwZGF0ZUZ1bmMgPSB1cGRhdGUod3JhcHBlckNvbXAsIHZub2RlKTtcbiAgICAgICAgdW5zdWJzY3JpYmVyID0gc3RvcmUuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBzdGF0ZVNsaWNlID0gc2xpY2VTdGF0ZShzdG9yZS5nZXRTdGF0ZSgpKTtcbiAgICAgICAgICBpZiAoc2hvdWxkVXBhdGUocHJldmlvdXNTdGF0ZVNsaWNlLCBzdGF0ZVNsaWNlKSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihjb21wb25lbnRQcm9wcywgbWFwU3RhdGVUb1Byb3Aoc3RhdGVTbGljZSkpO1xuICAgICAgICAgICAgdXBkYXRlRnVuYyhjb21wb25lbnRQcm9wcyk7XG4gICAgICAgICAgICBwcmV2aW91c1N0YXRlU2xpY2UgPSBzdGF0ZVNsaWNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdW5zdWJzY3JpYmUgPSBvblVuTW91bnQoKCkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZXIoKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gY29tcG9zZShzdWJzY3JpYmUsIHVuc3Vic2NyaWJlKSh3cmFwcGVyQ29tcCk7XG4gICAgfTtcbiAgfTtcbn07IiwiaW1wb3J0IHtofSBmcm9tIFwiLi4vLi4vaW5kZXhcIlxuXG5leHBvcnQgZGVmYXVsdCAoe21vZGVsLCBhY3Rpb25zfSkgPT4gbW9kZWwuZGF0YS5tYXAoKHtpZCwgbGFiZWx9LCBpKSA9PlxuICA8dHIgY2xhc3M9e2lkID09PSBtb2RlbC5zZWxlY3RlZCA/IFwiZGFuZ2VyXCIgOiBcIlwifT5cbiAgICA8dGQgY2xhc3M9XCJjb2wtbWQtMVwiPntpZH08L3RkPlxuICAgIDx0ZCBjbGFzcz1cImNvbC1tZC00XCI+XG4gICAgICA8YSBvbmNsaWNrPXtfID0+IGFjdGlvbnMuc2VsZWN0KHtpZH0pfT57bGFiZWx9PC9hPlxuICAgIDwvdGQ+XG4gICAgPHRkIGNsYXNzPVwiY29sLW1kLTFcIj5cbiAgICAgIDxhIG9uY2xpY2s9e18gPT4gYWN0aW9ucy5kZWxldGUoe2lkfSl9PlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZ2x5cGhpY29uIGdseXBoaWNvbi1yZW1vdmVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj5cbiAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICA8L2E+XG4gICAgPC90ZD5cbiAgICA8dGQgY2xhc3M9XCJjb2wtbWQtNlwiPjwvdGQ+XG4gIDwvdHI+XG4pXG4iLCIndXNlIHN0cmljdCc7XG5pbXBvcnQge21vZGVsLCByZWR1Y2Vyc30gZnJvbSBcIi4vc3RvcmVcIlxuaW1wb3J0IFJvd3NWaWV3IGZyb20gXCIuL3Jvd3NcIlxuaW1wb3J0IHtlbG0gYXMgYXBwLCBoLCBtb3VudH0gZnJvbSAnLi4vLi4vaW5kZXgnXG5cbmxldCBzdGFydFRpbWU7XG5sZXQgbGFzdE1lYXN1cmU7XG5cbmZ1bmN0aW9uIHN0YXJ0TWVhc3VyZSAobmFtZSwgY2IpIHtcbiAgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KClcbiAgLy8gcGVyZm9ybWFuY2UubWFyaygnc3RhcnQgJyArIG5hbWUpO1xuICBsYXN0TWVhc3VyZSA9IG5hbWU7XG4gIGNiKCk7XG59XG5cbmZ1bmN0aW9uIHN0b3BNZWFzdXJlICgpIHtcbiAgY29uc3QgbGFzdCA9IGxhc3RNZWFzdXJlO1xuXG4gIGlmIChsYXN0TWVhc3VyZSkge1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KFxuICAgICAgZnVuY3Rpb24gbWV0YVN0b3BNZWFzdXJlICgpIHtcbiAgICAgICAgbGFzdE1lYXN1cmUgPSBudWxsXG4gICAgICAgIGNvbnN0IHN0b3AgPSBwZXJmb3JtYW5jZS5ub3coKVxuICAgICAgICAvLyBwZXJmb3JtYW5jZS5tYXJrKCdlbmQgJyArIGxhc3QpO1xuICAgICAgICAvLyBwZXJmb3JtYW5jZS5tZWFzdXJlKGxhc3QsICdzdGFydCAnICsgbGFzdCwgJ2VuZCAnICsgbGFzdCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGxhc3QgKyBcIiB0b29rIFwiICsgKHN0b3AgLSBzdGFydFRpbWUpKVxuICAgICAgfSxcbiAgICAgIDBcbiAgICApXG4gIH1cbn1cblxuZnVuY3Rpb24gdmlldyAobW9kZWwsIGFjdGlvbnMpIHtcbiAgc3RvcE1lYXN1cmUoKVxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3M9XCJjb250YWluZXJcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJqdW1ib3Ryb25cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInJvd1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtbWQtNlwiPlxuICAgICAgICAgICAgPGgxPkZsYWNvIDAuMS4wPC9oMT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLW1kLTZcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJyb3dcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1zbS02IHNtYWxscGFkXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tYmxvY2tcIlxuICAgICAgICAgICAgICAgICAgaWQ9XCJydW5cIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17XyA9PlxuICAgICAgICAgICAgICAgICAgICBzdGFydE1lYXN1cmUoXCJydW5cIiwgYWN0aW9ucy5ydW4pfT5cbiAgICAgICAgICAgICAgICAgIENyZWF0ZSAxLDAwMCByb3dzXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLXNtLTYgc21hbGxwYWRcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9ja1wiXG4gICAgICAgICAgICAgICAgICBpZD1cInJ1bmxvdHNcIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17XyA9PlxuICAgICAgICAgICAgICAgICAgICBzdGFydE1lYXN1cmUoXG4gICAgICAgICAgICAgICAgICAgICAgXCJydW5Mb3RzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgYWN0aW9ucy5ydW5Mb3RzXG4gICAgICAgICAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICAgICAgQ3JlYXRlIDEwLDAwMCByb3dzXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLXNtLTYgc21hbGxwYWRcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9ja1wiXG4gICAgICAgICAgICAgICAgICBpZD1cImFkZFwiXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtfID0+XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TWVhc3VyZShcImFkZFwiLCBhY3Rpb25zLmFkZCl9PlxuICAgICAgICAgICAgICAgICAgQXBwZW5kIDEsMDAwIHJvd3NcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtc20tNiBzbWFsbHBhZFwiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgIGlkPVwidXBkYXRlXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFwidXBkYXRlXCIsIGFjdGlvbnMudXBkYXRlKX0+XG4gICAgICAgICAgICAgICAgICBVcGRhdGUgZXZlcnkgMTB0aCByb3dcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtc20tNiBzbWFsbHBhZFwiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgIGlkPVwiY2xlYXJcIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17XyA9PlxuICAgICAgICAgICAgICAgICAgICBzdGFydE1lYXN1cmUoXCJjbGVhclwiLCBhY3Rpb25zLmNsZWFyKX0+XG4gICAgICAgICAgICAgICAgICBDbGVhclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1zbS02IHNtYWxscGFkXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tYmxvY2tcIlxuICAgICAgICAgICAgICAgICAgaWQ9XCJzd2Fwcm93c1wiXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtfID0+XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TWVhc3VyZShcbiAgICAgICAgICAgICAgICAgICAgICBcInN3YXBSb3dzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgYWN0aW9ucy5zd2FwUm93c1xuICAgICAgICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICAgIFN3YXAgUm93c1xuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPHRhYmxlIGNsYXNzPVwidGFibGUgdGFibGUtaG92ZXIgdGFibGUtc3RyaXBlZCB0ZXN0LWRhdGFcIj5cbiAgICAgICAgPHRib2R5PlxuICAgICAgICA8Um93c1ZpZXcgbW9kZWw9e21vZGVsfSBhY3Rpb25zPXthY3Rpb25zfS8+XG4gICAgICAgIDwvdGJvZHk+XG4gICAgICA8L3RhYmxlPlxuICAgICAgPHNwYW5cbiAgICAgICAgY2xhc3M9XCJwcmVsb2FkaWNvbiBnbHlwaGljb24gZ2x5cGhpY29uLXJlbW92ZVwiXG4gICAgICAgIGFyaWEtaGlkZGVuPVwidHJ1ZVwiXG4gICAgICAvPlxuICAgIDwvZGl2Pik7XG59XG5cbmNvbnN0IEJlbmNoID0gYXBwKHZpZXcpO1xuXG5tb3VudCgoe21vZGVsLCB1cGRhdGVzfSkgPT4gKDxCZW5jaCBtb2RlbD17bW9kZWx9IHVwZGF0ZXM9e3VwZGF0ZXN9Lz4pLCB7XG4gIG1vZGVsLCB1cGRhdGVzOiByZWR1Y2Vyc1xufSwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJtYWluXCIpKTtcbiJdLCJuYW1lcyI6WyJtb3VudCIsInVwZGF0ZSIsIm1vZGVsIl0sIm1hcHBpbmdzIjoiOzs7QUFBQSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBRVYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQTs7QUFFeEIsU0FBUyxTQUFTLEVBQUUsS0FBSyxFQUFFO0VBQ3pCLE1BQU0sVUFBVSxHQUFHO0lBQ2pCLFFBQVE7SUFDUixPQUFPO0lBQ1As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
