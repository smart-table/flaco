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

const traverse = function * (vnode) {
  yield vnode;
  if (vnode.children && vnode.children.length) {
    for (let child of vnode.children) {
      yield * traverse(child);
    }
  }
};

const nextTick = fn => setTimeout(fn, 0);

const pairify = holder => key => [key, holder[key]];

const isShallowEqual = (a, b) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k]);
};

const noop = () => {
};

const updateDomNodeFactory = (method) => (listeners) => tap(domNode => {
  for (let pair of listeners) {
    domNode[method](...pair);
  }
});

const removeAttributes = updateDomNodeFactory('removeAttribute');
const removeEventListeners = updateDomNodeFactory('removeEventListener');
const addEventListeners = updateDomNodeFactory('addEventListener');
const setAttributes = compose(
  pairs => pairs.filter(([key, value]) => typeof value !== 'function'), //only keep primitives
  updateDomNodeFactory('setAttribute')
);

const setTextNode = val => node => node.textContent = val;

const createDomNode = vnode => {
  return vnode.nodeType !== 'Text' ?
    document.createElement(vnode.nodeType) :
    document.createTextNode(String(vnode.props.value));
};

const getEventListeners = (props) => {
  return Object.keys(props).filter(k => k.substr(0, 2) === 'on')
    .map(k => [k.substr(2).toLowerCase(), props[k]]);
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
    } else if (newVnode.nodeType !== newVnode.nodeType) {//it must be replaced
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
  const tempOldNode = oldVnode ? oldVnode : {length: 0, children: [], props: {}};

  //1. get the actual dom element related to virtual dom diff && collect node to remove/clean
  const {vnode, garbage} = domify(oldVnode, newVnode, parentDomNode);

  if (garbage !== null) {
    // defer cleaning lifecycle
    for (let g of traverse(garbage)) {
      if (g.onUnMount) {
        onNextTick.push(() => g.onUnMount);
      }
    }
  }

  //2. update attributes
  if (vnode) {
    //sync
    updateAttributes(vnode, tempOldNode)(vnode.dom);

    //fast path
    if (vnode.nodeType === 'Text') {
      return onNextTick;
    }

    const childrenCount = Math.max(tempOldNode.children.length, vnode.children.length);

    if (vnode.lifeCycle === 1 && vnode.onMount) {
      onNextTick.push(() => vnode.onMount());
    }

    //async (not part of the view)
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

/**
 * Mount a component into a root dom node
 */
const mount = curry(function (comp, initProp, root) {
  const batch = render(null, comp(initProp || {}), root);
  nextTick(function () {
    while (batch.length) {
      const op = batch.shift();
      op();
    }
  });
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
    oldNode = newNode;
    nextTick(function () {
      while (nextBatch.length) {
        const op = nextBatch.shift();
        op();
      }
    });
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
 * Combinator to create a "stateful component": ie it will have its own state
 * @param comp
 * @returns {Function}
 */

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

let startTime;
let lastMeasure;

function startMeasure (name, cb) {
  startTime = performance.now();
  performance.mark('start ' + name);
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
        performance.mark('end ' + last);
        performance.measure(last, 'start ' + last, 'end ' + last);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL3N0b3JlLmpzIiwiLi4vLi4vLi4vbGliL2guanMiLCIuLi9yb3dzLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLW9wZXJhdG9ycy9pbmRleC5qcyIsIi4uLy4uLy4uL2xpYi91dGlsLmpzIiwiLi4vLi4vLi4vbGliL2RvbVV0aWwuanMiLCIuLi8uLi8uLi9saWIvdHJlZS5qcyIsIi4uLy4uLy4uL2xpYi91cGRhdGUuanMiLCIuLi8uLi8uLi9saWIvbGlmZUN5Y2xlcy5qcyIsIi4uLy4uLy4uL2xpYi9jb21wb25lbnQuanMiLCIuLi8uLi8uLi9saWIvZWxtLmpzIiwiLi4vaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsibGV0IGlkID0gMVxuXG5jb25zdCByYW5kID0gTWF0aC5yYW5kb21cblxuZnVuY3Rpb24gYnVpbGREYXRhIChjb3VudCkge1xuICBjb25zdCBhZGplY3RpdmVzID0gW1xuICAgIFwicHJldHR5XCIsXG4gICAgXCJsYXJnZVwiLFxuICAgIFwiYmlnXCIsXG4gICAgXCJzbWFsbFwiLFxuICAgIFwidGFsbFwiLFxuICAgIFwic2hvcnRcIixcbiAgICBcImxvbmdcIixcbiAgICBcImhhbmRzb21lXCIsXG4gICAgXCJwbGFpblwiLFxuICAgIFwicXVhaW50XCIsXG4gICAgXCJjbGVhblwiLFxuICAgIFwiZWxlZ2FudFwiLFxuICAgIFwiZWFzeVwiLFxuICAgIFwiYW5ncnlcIixcbiAgICBcImNyYXp5XCIsXG4gICAgXCJoZWxwZnVsXCIsXG4gICAgXCJtdXNoeVwiLFxuICAgIFwib2RkXCIsXG4gICAgXCJ1bnNpZ2h0bHlcIixcbiAgICBcImFkb3JhYmxlXCIsXG4gICAgXCJpbXBvcnRhbnRcIixcbiAgICBcImluZXhwZW5zaXZlXCIsXG4gICAgXCJjaGVhcFwiLFxuICAgIFwiZXhwZW5zaXZlXCIsXG4gICAgXCJmYW5jeVwiLFxuICBdXG5cbiAgY29uc3QgY29sb3VycyA9IFtcbiAgICBcInJlZFwiLFxuICAgIFwieWVsbG93XCIsXG4gICAgXCJibHVlXCIsXG4gICAgXCJncmVlblwiLFxuICAgIFwicGlua1wiLFxuICAgIFwiYnJvd25cIixcbiAgICBcInB1cnBsZVwiLFxuICAgIFwiYnJvd25cIixcbiAgICBcIndoaXRlXCIsXG4gICAgXCJibGFja1wiLFxuICAgIFwib3JhbmdlXCIsXG4gIF1cblxuICBjb25zdCBub3VucyA9IFtcbiAgICBcInRhYmxlXCIsXG4gICAgXCJjaGFpclwiLFxuICAgIFwiaG91c2VcIixcbiAgICBcImJicVwiLFxuICAgIFwiZGVza1wiLFxuICAgIFwiY2FyXCIsXG4gICAgXCJwb255XCIsXG4gICAgXCJjb29raWVcIixcbiAgICBcInNhbmR3aWNoXCIsXG4gICAgXCJidXJnZXJcIixcbiAgICBcInBpenphXCIsXG4gICAgXCJtb3VzZVwiLFxuICAgIFwia2V5Ym9hcmRcIixcbiAgXVxuXG4gIHJldHVybiBuZXcgQXJyYXkoY291bnQpLmZpbGwoMCkubWFwKF8gPT4gKHtcbiAgICBpZDogaWQrKyxcbiAgICBsYWJlbDogYCR7YWRqZWN0aXZlc1tcbiAgICByYW5kKCkgKiAxMDAwICUgYWRqZWN0aXZlcy5sZW5ndGggPj4gMF19ICR7Y29sb3Vyc1tcbiAgICByYW5kKCkgKiAxMDAwICUgY29sb3Vycy5sZW5ndGggPj4gMF19ICR7bm91bnNbXG4gICAgcmFuZCgpICogMTAwMCAlIG5vdW5zLmxlbmd0aCA+PiAwXX1gXG4gIH0pKVxufVxuXG5jb25zdCBtb2RlbCA9IHtcbiAgZGF0YTogW10sXG4gIHNlbGVjdGVkOiBmYWxzZVxufVxuXG5jb25zdCByZWR1Y2VycyA9IHtcbiAgcnVuOiBtb2RlbCA9PiAoe1xuICAgIGRhdGE6IGJ1aWxkRGF0YSgxMDAwKSxcbiAgICBzZWxlY3RlZDogdW5kZWZpbmVkXG4gIH0pLFxuXG4gIGFkZDogbW9kZWwgPT4gKHtcbiAgICBkYXRhOiBtb2RlbC5kYXRhLmNvbmNhdChidWlsZERhdGEoMTAwMCkpLFxuICAgIHNlbGVjdGVkOiB1bmRlZmluZWRcbiAgfSksXG5cbiAgcnVuTG90czogbW9kZWwgPT4gKHtcbiAgICBkYXRhOiBidWlsZERhdGEoMTAwMDApLFxuICAgIHNlbGVjdGVkOiB1bmRlZmluZWRcbiAgfSksXG5cbiAgY2xlYXI6IG1vZGVsID0+ICh7XG4gICAgZGF0YTogW10sXG4gICAgc2VsZWN0ZWQ6IHVuZGVmaW5lZFxuICB9KSxcblxuICB1cGRhdGU6IG1vZGVsID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogbW9kZWwuZGF0YS5tYXAoKGQsIGkpID0+IHtcbiAgICAgICAgaWYgKGkgJSAxMCA9PT0gMCkge1xuICAgICAgICAgIGQubGFiZWwgPSBgJHtkLmxhYmVsfSAhISFgXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRcbiAgICAgIH0pLFxuICAgICAgc2VsZWN0ZWQ6IHVuZGVmaW5lZFxuICAgIH1cbiAgfSxcblxuICBzd2FwUm93czogbW9kZWwgPT4ge1xuICAgIGlmIChtb2RlbC5kYXRhLmxlbmd0aCA8PSAxMCkge1xuICAgICAgcmV0dXJuIG1vZGVsXG4gICAgfVxuXG4gICAgY29uc3QgdGVtcCA9IG1vZGVsLmRhdGFbNF1cbiAgICBtb2RlbC5kYXRhWzRdID0gbW9kZWwuZGF0YVs5XVxuICAgIG1vZGVsLmRhdGFbOV0gPSB0ZW1wXG5cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogbW9kZWwuZGF0YSxcbiAgICAgIHNlbGVjdGVkOiBtb2RlbC5zZWxlY3RlZFxuICAgIH1cbiAgfSxcblxuICBzZWxlY3Q6IChtb2RlbCwgZGF0YSkgPT4gKHtcbiAgICBkYXRhOiBtb2RlbC5kYXRhLFxuICAgIHNlbGVjdGVkOiBkYXRhLmlkXG4gIH0pLFxuXG4gIGRlbGV0ZTogKG1vZGVsLCBkYXRhKSA9PiAoe1xuICAgIGRhdGE6IG1vZGVsLmRhdGEuZmlsdGVyKGQgPT4gZC5pZCAhPT0gZGF0YS5pZClcbiAgfSlcbn1cblxuZXhwb3J0IHtcbiAgbW9kZWwsIHJlZHVjZXJzXG59XG5cbiIsImNvbnN0IGNyZWF0ZVRleHRWTm9kZSA9ICh2YWx1ZSkgPT4gKHtcbiAgbm9kZVR5cGU6ICdUZXh0JyxcbiAgY2hpbGRyZW46IFtdLFxuICBwcm9wczoge3ZhbHVlfVxufSk7XG5cbi8qKlxuICogVHJhbnNmb3JtIGh5cGVyc2NyaXB0IGludG8gdmlydHVhbCBkb20gbm9kZVxuICogQHBhcmFtIG5vZGVUeXBlXG4gKiBAcGFyYW0gcHJvcHNcbiAqIEBwYXJhbSBjaGlsZHJlblxuICogQHJldHVybnMgeyp9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGggKG5vZGVUeXBlLCBwcm9wcywgLi4uY2hpbGRyZW4pIHtcbiAgY29uc3QgZmxhdENoaWxkcmVuID0gY2hpbGRyZW4ucmVkdWNlKChhY2MsIGNoaWxkKSA9PiB7XG4gICAgY29uc3QgY2hpbGRyZW5BcnJheSA9IEFycmF5LmlzQXJyYXkoY2hpbGQpID8gY2hpbGQgOiBbY2hpbGRdO1xuICAgIHJldHVybiBhY2MuY29uY2F0KGNoaWxkcmVuQXJyYXkpO1xuICB9LCBbXSlcbiAgICAubWFwKGNoaWxkID0+IHtcbiAgICAgIC8vIG5vcm1hbGl6ZSB0ZXh0IG5vZGUgdG8gaGF2ZSBzYW1lIHN0cnVjdHVyZSB0aGFuIHJlZ3VsYXIgZG9tIG5vZGVzXG4gICAgICBjb25zdCB0eXBlID0gdHlwZW9mIGNoaWxkO1xuICAgICAgcmV0dXJuIHR5cGUgPT09ICdvYmplY3QnIHx8IHR5cGUgPT09ICdmdW5jdGlvbicgPyBjaGlsZCA6IGNyZWF0ZVRleHRWTm9kZShjaGlsZCk7XG4gICAgfSk7XG5cbiAgaWYgKHR5cGVvZiBub2RlVHlwZSAhPT0gJ2Z1bmN0aW9uJykgey8vcmVndWxhciBodG1sL3RleHQgbm9kZVxuICAgIHJldHVybiB7XG4gICAgICBub2RlVHlwZSxcbiAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgIGNoaWxkcmVuOiBmbGF0Q2hpbGRyZW5cbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGZ1bGxQcm9wcyA9IE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBmbGF0Q2hpbGRyZW59LCBwcm9wcyk7XG4gICAgY29uc3QgY29tcCA9IG5vZGVUeXBlKGZ1bGxQcm9wcyk7XG4gICAgcmV0dXJuIHR5cGVvZiBjb21wICE9PSAnZnVuY3Rpb24nID8gY29tcCA6IGgoY29tcCwgcHJvcHMsIC4uLmZsYXRDaGlsZHJlbik7IC8vZnVuY3Rpb25hbCBjb21wIHZzIGNvbWJpbmF0b3IgKEhPQylcbiAgfVxufTsiLCJpbXBvcnQgIGggZnJvbSBcIi4uLy4uL2xpYi9oXCJcblxuZXhwb3J0IGRlZmF1bHQgKHttb2RlbCwgYWN0aW9uc30pID0+IG1vZGVsLmRhdGEubWFwKCh7aWQsIGxhYmVsfSwgaSkgPT5cbiAgPHRyIGNsYXNzPXtpZCA9PT0gbW9kZWwuc2VsZWN0ZWQgPyBcImRhbmdlclwiIDogXCJcIn0+XG4gICAgPHRkIGNsYXNzPVwiY29sLW1kLTFcIj57aWR9PC90ZD5cbiAgICA8dGQgY2xhc3M9XCJjb2wtbWQtNFwiPlxuICAgICAgPGEgb25jbGljaz17XyA9PiBhY3Rpb25zLnNlbGVjdCh7aWR9KX0+e2xhYmVsfTwvYT5cbiAgICA8L3RkPlxuICAgIDx0ZCBjbGFzcz1cImNvbC1tZC0xXCI+XG4gICAgICA8YSBvbmNsaWNrPXtfID0+IGFjdGlvbnMuZGVsZXRlKHtpZH0pfT5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImdseXBoaWNvbiBnbHlwaGljb24tcmVtb3ZlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+XG4gICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgPC9hPlxuICAgIDwvdGQ+XG4gICAgPHRkIGNsYXNzPVwiY29sLW1kLTZcIj48L3RkPlxuICA8L3RyPlxuKVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHN3YXAgKGYpIHtcbiAgcmV0dXJuIChhLCBiKSA9PiBmKGIsIGEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZSAoZmlyc3QsIC4uLmZucykge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycnkgKGZuLCBhcml0eUxlZnQpIHtcbiAgY29uc3QgYXJpdHkgPSBhcml0eUxlZnQgfHwgZm4ubGVuZ3RoO1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCBhcmdMZW5ndGggPSBhcmdzLmxlbmd0aCB8fCAxO1xuICAgIGlmIChhcml0eSA9PT0gYXJnTGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZm4oLi4uYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZ1bmMgPSAoLi4ubW9yZUFyZ3MpID0+IGZuKC4uLmFyZ3MsIC4uLm1vcmVBcmdzKTtcbiAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseSAoZm4pIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcCAoZm4pIHtcbiAgcmV0dXJuIGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IHRyYXZlcnNlID0gZnVuY3Rpb24gKiAodm5vZGUpIHtcbiAgeWllbGQgdm5vZGU7XG4gIGlmICh2bm9kZS5jaGlsZHJlbiAmJiB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICBmb3IgKGxldCBjaGlsZCBvZiB2bm9kZS5jaGlsZHJlbikge1xuICAgICAgeWllbGQgKiB0cmF2ZXJzZShjaGlsZCk7XG4gICAgfVxuICB9XG59O1xuXG5leHBvcnQgY29uc3QgbmV4dFRpY2sgPSBmbiA9PiBzZXRUaW1lb3V0KGZuLCAwKTtcblxuZXhwb3J0IGNvbnN0IHBhaXJpZnkgPSBob2xkZXIgPT4ga2V5ID0+IFtrZXksIGhvbGRlcltrZXldXTtcblxuZXhwb3J0IGNvbnN0IGlzU2hhbGxvd0VxdWFsID0gKGEsIGIpID0+IHtcbiAgY29uc3QgYUtleXMgPSBPYmplY3Qua2V5cyhhKTtcbiAgY29uc3QgYktleXMgPSBPYmplY3Qua2V5cyhiKTtcbiAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoICYmIGFLZXlzLmV2ZXJ5KChrKSA9PiBhW2tdID09PSBiW2tdKTtcbn07XG5cbmV4cG9ydCBjb25zdCBub29wID0gKCkgPT4ge1xufTtcbiIsImltcG9ydCB7dGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG5jb25zdCB1cGRhdGVEb21Ob2RlRmFjdG9yeSA9IChtZXRob2QpID0+IChsaXN0ZW5lcnMpID0+IHRhcChkb21Ob2RlID0+IHtcbiAgZm9yIChsZXQgcGFpciBvZiBsaXN0ZW5lcnMpIHtcbiAgICBkb21Ob2RlW21ldGhvZF0oLi4ucGFpcik7XG4gIH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVtb3ZlQXR0cmlidXRlcyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdyZW1vdmVBdHRyaWJ1dGUnKTtcbmV4cG9ydCBjb25zdCByZW1vdmVFdmVudExpc3RlbmVycyA9IHVwZGF0ZURvbU5vZGVGYWN0b3J5KCdyZW1vdmVFdmVudExpc3RlbmVyJyk7XG5leHBvcnQgY29uc3QgYWRkRXZlbnRMaXN0ZW5lcnMgPSB1cGRhdGVEb21Ob2RlRmFjdG9yeSgnYWRkRXZlbnRMaXN0ZW5lcicpO1xuZXhwb3J0IGNvbnN0IHNldEF0dHJpYnV0ZXMgPSBjb21wb3NlKFxuICBwYWlycyA9PiBwYWlycy5maWx0ZXIoKFtrZXksIHZhbHVlXSkgPT4gdHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nKSwgLy9vbmx5IGtlZXAgcHJpbWl0aXZlc1xuICB1cGRhdGVEb21Ob2RlRmFjdG9yeSgnc2V0QXR0cmlidXRlJylcbik7XG5cbmV4cG9ydCBjb25zdCBzZXRUZXh0Tm9kZSA9IHZhbCA9PiBub2RlID0+IG5vZGUudGV4dENvbnRlbnQgPSB2YWw7XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVEb21Ob2RlID0gdm5vZGUgPT4ge1xuICByZXR1cm4gdm5vZGUubm9kZVR5cGUgIT09ICdUZXh0JyA/XG4gICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh2bm9kZS5ub2RlVHlwZSkgOlxuICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFN0cmluZyh2bm9kZS5wcm9wcy52YWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldEV2ZW50TGlzdGVuZXJzID0gKHByb3BzKSA9PiB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhwcm9wcykuZmlsdGVyKGsgPT4gay5zdWJzdHIoMCwgMikgPT09ICdvbicpXG4gICAgLm1hcChrID0+IFtrLnN1YnN0cigyKS50b0xvd2VyQ2FzZSgpLCBwcm9wc1trXV0pO1xufTtcbiIsImltcG9ydCB7Y29tcG9zZSwgY3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQge1xuICBpc1NoYWxsb3dFcXVhbCxcbiAgcGFpcmlmeSxcbiAgdHJhdmVyc2UsXG4gIG5leHRUaWNrLFxuICBub29wXG59IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQge1xuICByZW1vdmVBdHRyaWJ1dGVzLFxuICBzZXRBdHRyaWJ1dGVzLFxuICBzZXRUZXh0Tm9kZSxcbiAgY3JlYXRlRG9tTm9kZSxcbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMsXG4gIGFkZEV2ZW50TGlzdGVuZXJzLFxuICBnZXRFdmVudExpc3RlbmVycyxcbn0gZnJvbSAnLi9kb21VdGlsJztcblxuZnVuY3Rpb24gdXBkYXRlRXZlbnRMaXN0ZW5lcnMgKHtwcm9wczpuZXdOb2RlUHJvcHN9PXt9LCB7cHJvcHM6b2xkTm9kZVByb3BzfT17fSkge1xuICBjb25zdCBuZXdOb2RlRXZlbnRzID0gZ2V0RXZlbnRMaXN0ZW5lcnMobmV3Tm9kZVByb3BzIHx8IHt9KTtcbiAgY29uc3Qgb2xkTm9kZUV2ZW50cyA9IGdldEV2ZW50TGlzdGVuZXJzKG9sZE5vZGVQcm9wcyB8fCB7fSk7XG5cbiAgcmV0dXJuIG5ld05vZGVFdmVudHMubGVuZ3RoIHx8IG9sZE5vZGVFdmVudHMubGVuZ3RoID9cbiAgICBjb21wb3NlKFxuICAgICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMob2xkTm9kZUV2ZW50cyksXG4gICAgICBhZGRFdmVudExpc3RlbmVycyhuZXdOb2RlRXZlbnRzKVxuICAgICkgOiBub29wO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBdHRyaWJ1dGVzIChuZXdWTm9kZSwgb2xkVk5vZGUpIHtcbiAgY29uc3QgbmV3Vk5vZGVQcm9wcyA9IG5ld1ZOb2RlLnByb3BzIHx8IHt9O1xuICBjb25zdCBvbGRWTm9kZVByb3BzID0gb2xkVk5vZGUucHJvcHMgfHwge307XG5cbiAgaWYgKGlzU2hhbGxvd0VxdWFsKG5ld1ZOb2RlUHJvcHMsIG9sZFZOb2RlUHJvcHMpKSB7XG4gICAgcmV0dXJuIG5vb3A7XG4gIH1cblxuICBpZiAobmV3Vk5vZGUubm9kZVR5cGUgPT09ICdUZXh0Jykge1xuICAgIHJldHVybiBzZXRUZXh0Tm9kZShuZXdWTm9kZS5wcm9wcy52YWx1ZSk7XG4gIH1cblxuICBjb25zdCBuZXdOb2RlS2V5cyA9IE9iamVjdC5rZXlzKG5ld1ZOb2RlUHJvcHMpO1xuICBjb25zdCBvbGROb2RlS2V5cyA9IE9iamVjdC5rZXlzKG9sZFZOb2RlUHJvcHMpO1xuICBjb25zdCBhdHRyaWJ1dGVzVG9SZW1vdmUgPSBvbGROb2RlS2V5cy5maWx0ZXIoayA9PiAhbmV3Tm9kZUtleXMuaW5jbHVkZXMoaykpO1xuXG4gIHJldHVybiBjb21wb3NlKFxuICAgIHJlbW92ZUF0dHJpYnV0ZXMoYXR0cmlidXRlc1RvUmVtb3ZlKSxcbiAgICBzZXRBdHRyaWJ1dGVzKG5ld05vZGVLZXlzLm1hcChwYWlyaWZ5KG5ld1ZOb2RlUHJvcHMpKSlcbiAgKTtcbn1cblxuY29uc3QgZG9tRmFjdG9yeSA9IGNyZWF0ZURvbU5vZGU7XG5cbi8vIGFwcGx5IHZub2RlIGRpZmZpbmcgdG8gYWN0dWFsIGRvbSBub2RlIChpZiBuZXcgbm9kZSA9PiBpdCB3aWxsIGJlIG1vdW50ZWQgaW50byB0aGUgcGFyZW50KVxuY29uc3QgZG9taWZ5ID0gZnVuY3Rpb24gdXBkYXRlRG9tIChvbGRWbm9kZSwgbmV3Vm5vZGUsIHBhcmVudERvbU5vZGUpIHtcbiAgaWYgKCFvbGRWbm9kZSkgey8vdGhlcmUgaXMgbm8gcHJldmlvdXMgdm5vZGVcbiAgICBpZiAobmV3Vm5vZGUpIHsvL25ldyBub2RlID0+IHdlIGluc2VydFxuICAgICAgbmV3Vm5vZGUuZG9tID0gcGFyZW50RG9tTm9kZS5hcHBlbmRDaGlsZChkb21GYWN0b3J5KG5ld1Zub2RlKSk7XG4gICAgICBuZXdWbm9kZS5saWZlQ3ljbGUgPSAxO1xuICAgICAgcmV0dXJuIHt2bm9kZTogbmV3Vm5vZGUsIGdhcmJhZ2U6IG51bGx9O1xuICAgIH0gZWxzZSB7Ly9lbHNlIChpcnJlbGV2YW50KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBvcGVyYXRpb24nKVxuICAgIH1cbiAgfSBlbHNlIHsvL3RoZXJlIGlzIGEgcHJldmlvdXMgdm5vZGVcbiAgICBpZiAoIW5ld1Zub2RlKSB7Ly93ZSBtdXN0IHJlbW92ZSB0aGUgcmVsYXRlZCBkb20gbm9kZVxuICAgICAgcGFyZW50RG9tTm9kZS5yZW1vdmVDaGlsZChvbGRWbm9kZS5kb20pO1xuICAgICAgcmV0dXJuICh7Z2FyYmFnZTogb2xkVm5vZGUsIGRvbTogbnVsbH0pO1xuICAgIH0gZWxzZSBpZiAobmV3Vm5vZGUubm9kZVR5cGUgIT09IG5ld1Zub2RlLm5vZGVUeXBlKSB7Ly9pdCBtdXN0IGJlIHJlcGxhY2VkXG4gICAgICBuZXdWbm9kZS5kb20gPSBkb21GYWN0b3J5KG5ld1Zub2RlKTtcbiAgICAgIG5ld1Zub2RlLmxpZmVDeWNsZSA9IDE7XG4gICAgICBwYXJlbnREb21Ob2RlLnJlcGxhY2VDaGlsZChuZXdWbm9kZS5kb20sIG9sZFZub2RlLmRvbSk7XG4gICAgICByZXR1cm4ge2dhcmJhZ2U6IG9sZFZub2RlLCB2bm9kZTogbmV3Vm5vZGV9O1xuICAgIH0gZWxzZSB7Ly8gb25seSB1cGRhdGUgYXR0cmlidXRlc1xuICAgICAgbmV3Vm5vZGUuZG9tID0gb2xkVm5vZGUuZG9tO1xuICAgICAgbmV3Vm5vZGUubGlmZUN5Y2xlID0gb2xkVm5vZGUubGlmZUN5Y2xlICsgMTtcbiAgICAgIHJldHVybiB7Z2FyYmFnZTogbnVsbCwgdm5vZGU6IG5ld1Zub2RlfTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogcmVuZGVyIGEgdmlydHVhbCBkb20gbm9kZSwgZGlmZmluZyBpdCB3aXRoIGl0cyBwcmV2aW91cyB2ZXJzaW9uLCBtb3VudGluZyBpdCBpbiBhIHBhcmVudCBkb20gbm9kZVxuICogQHBhcmFtIG9sZFZub2RlXG4gKiBAcGFyYW0gbmV3Vm5vZGVcbiAqIEBwYXJhbSBwYXJlbnREb21Ob2RlXG4gKiBAcGFyYW0gb25OZXh0VGljayBjb2xsZWN0IG9wZXJhdGlvbnMgdG8gYmUgcHJvY2Vzc2VkIG9uIG5leHQgdGlja1xuICogQHJldHVybnMge0FycmF5fVxuICovXG5leHBvcnQgY29uc3QgcmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyZXIgKG9sZFZub2RlLCBuZXdWbm9kZSwgcGFyZW50RG9tTm9kZSwgb25OZXh0VGljayA9IFtdKSB7XG4gIGNvbnN0IHRlbXBPbGROb2RlID0gb2xkVm5vZGUgPyBvbGRWbm9kZSA6IHtsZW5ndGg6IDAsIGNoaWxkcmVuOiBbXSwgcHJvcHM6IHt9fTtcblxuICAvLzEuIGdldCB0aGUgYWN0dWFsIGRvbSBlbGVtZW50IHJlbGF0ZWQgdG8gdmlydHVhbCBkb20gZGlmZiAmJiBjb2xsZWN0IG5vZGUgdG8gcmVtb3ZlL2NsZWFuXG4gIGNvbnN0IHt2bm9kZSwgZ2FyYmFnZX0gPSBkb21pZnkob2xkVm5vZGUsIG5ld1Zub2RlLCBwYXJlbnREb21Ob2RlKTtcblxuICBpZiAoZ2FyYmFnZSAhPT0gbnVsbCkge1xuICAgIC8vIGRlZmVyIGNsZWFuaW5nIGxpZmVjeWNsZVxuICAgIGZvciAobGV0IGcgb2YgdHJhdmVyc2UoZ2FyYmFnZSkpIHtcbiAgICAgIGlmIChnLm9uVW5Nb3VudCkge1xuICAgICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gZy5vblVuTW91bnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vMi4gdXBkYXRlIGF0dHJpYnV0ZXNcbiAgaWYgKHZub2RlKSB7XG4gICAgLy9zeW5jXG4gICAgdXBkYXRlQXR0cmlidXRlcyh2bm9kZSwgdGVtcE9sZE5vZGUpKHZub2RlLmRvbSk7XG5cbiAgICAvL2Zhc3QgcGF0aFxuICAgIGlmICh2bm9kZS5ub2RlVHlwZSA9PT0gJ1RleHQnKSB7XG4gICAgICByZXR1cm4gb25OZXh0VGljaztcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZHJlbkNvdW50ID0gTWF0aC5tYXgodGVtcE9sZE5vZGUuY2hpbGRyZW4ubGVuZ3RoLCB2bm9kZS5jaGlsZHJlbi5sZW5ndGgpO1xuXG4gICAgaWYgKHZub2RlLmxpZmVDeWNsZSA9PT0gMSAmJiB2bm9kZS5vbk1vdW50KSB7XG4gICAgICBvbk5leHRUaWNrLnB1c2goKCkgPT4gdm5vZGUub25Nb3VudCgpKTtcbiAgICB9XG5cbiAgICAvL2FzeW5jIChub3QgcGFydCBvZiB0aGUgdmlldylcbiAgICBjb25zdCBzZXRMaXN0ZW5lcnMgPSB1cGRhdGVFdmVudExpc3RlbmVycyh2bm9kZSwgdGVtcE9sZE5vZGUpO1xuICAgIGlmIChzZXRMaXN0ZW5lcnMgIT09IG5vb3ApIHtcbiAgICAgIG9uTmV4dFRpY2sucHVzaCgoKSA9PiBzZXRMaXN0ZW5lcnModm5vZGUuZG9tKSk7XG4gICAgfVxuXG4gICAgLy8zIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIGNoaWxkcmVuIHRvIHVwZGF0ZSBkb20gYW5kIGNvbGxlY3QgZnVuY3Rpb25zIHRvIHByb2Nlc3Mgb24gbmV4dCB0aWNrXG4gICAgaWYgKGNoaWxkcmVuQ291bnQgPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuQ291bnQ7IGkrKykge1xuICAgICAgICAvLyB3ZSBwYXNzIG9uTmV4dFRpY2sgYXMgcmVmZXJlbmNlIChpbXByb3ZlIHBlcmY6IG1lbW9yeSArIHNwZWVkKVxuICAgICAgICByZW5kZXIodGVtcE9sZE5vZGUuY2hpbGRyZW5baV0sIHZub2RlLmNoaWxkcmVuW2ldLCB2bm9kZS5kb20sIG9uTmV4dFRpY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvbk5leHRUaWNrO1xufTtcblxuLyoqXG4gKiBNb3VudCBhIGNvbXBvbmVudCBpbnRvIGEgcm9vdCBkb20gbm9kZVxuICovXG5leHBvcnQgY29uc3QgbW91bnQgPSBjdXJyeShmdW5jdGlvbiAoY29tcCwgaW5pdFByb3AsIHJvb3QpIHtcbiAgY29uc3QgYmF0Y2ggPSByZW5kZXIobnVsbCwgY29tcChpbml0UHJvcCB8fCB7fSksIHJvb3QpO1xuICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgd2hpbGUgKGJhdGNoLmxlbmd0aCkge1xuICAgICAgY29uc3Qgb3AgPSBiYXRjaC5zaGlmdCgpO1xuICAgICAgb3AoKTtcbiAgICB9XG4gIH0pO1xufSk7IiwiaW1wb3J0IHtyZW5kZXJ9IGZyb20gJy4vdHJlZSc7XG5pbXBvcnQge25leHRUaWNrfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgdHJpZ2dlciBhbiB1cGRhdGUgb2YgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBwYXNzZWQgc3RhdGVcbiAqIEBwYXJhbSBjb21wXG4gKiBAcGFyYW0gaW5pdGlhbFZOb2RlXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb24oKj0sIC4uLlsqXSl9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVwZGF0ZSAoY29tcCwgaW5pdGlhbFZOb2RlKSB7XG4gIGxldCBvbGROb2RlID0gaW5pdGlhbFZOb2RlO1xuICBjb25zdCB1cGRhdGVGdW5jID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgbW91bnQgPSBvbGROb2RlLmRvbS5wYXJlbnROb2RlO1xuICAgIGNvbnN0IG5ld05vZGUgPSBjb21wKE9iamVjdC5hc3NpZ24oe2NoaWxkcmVuOiBvbGROb2RlLmNoaWxkcmVuIHx8IFtdfSwgb2xkTm9kZS5wcm9wcywgcHJvcHMpLCAuLi5hcmdzKTtcbiAgICBjb25zdCBuZXh0QmF0Y2ggPSByZW5kZXIob2xkTm9kZSwgbmV3Tm9kZSwgbW91bnQpO1xuICAgIG9sZE5vZGUgPSBuZXdOb2RlO1xuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIHdoaWxlIChuZXh0QmF0Y2gubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IG9wID0gbmV4dEJhdGNoLnNoaWZ0KCk7XG4gICAgICAgIG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG4gIHJldHVybiB1cGRhdGVGdW5jO1xufSIsImltcG9ydCB7Y3Vycnl9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5cbmNvbnN0IGxpZmVDeWNsZUZhY3RvcnkgPSBtZXRob2QgPT4gY3VycnkoKGZuLCBjb21wKSA9PiAocHJvcHMsIC4uLmFyZ3MpID0+IHtcbiAgY29uc3QgbiA9IGNvbXAocHJvcHMsIC4uLmFyZ3MpO1xuICBuW21ldGhvZF0gPSAoKSA9PiBmbihuLCAuLi5hcmdzKTtcbiAgcmV0dXJuIG47XG59KTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgbW91bnRlZFxuICovXG5leHBvcnQgY29uc3Qgb25Nb3VudCA9IGxpZmVDeWNsZUZhY3RvcnkoJ29uTW91bnQnKTtcblxuLyoqXG4gKiBsaWZlIGN5Y2xlOiB3aGVuIHRoZSBjb21wb25lbnQgaXMgdW5tb3VudGVkXG4gKi9cbmV4cG9ydCBjb25zdCBvblVuTW91bnQgPSBsaWZlQ3ljbGVGYWN0b3J5KCdvblVuTW91bnQnKTsiLCJpbXBvcnQgdXBkYXRlIGZyb20gJy4vdXBkYXRlJztcbmltcG9ydCB7b25Nb3VudH0gZnJvbSAnLi9saWZlQ3ljbGVzJztcblxuLyoqXG4gKiBDb21iaW5hdG9yIHRvIGNyZWF0ZSBhIFwic3RhdGVmdWwgY29tcG9uZW50XCI6IGllIGl0IHdpbGwgaGF2ZSBpdHMgb3duIHN0YXRlXG4gKiBAcGFyYW0gY29tcFxuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoY29tcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGxldCB1cGRhdGVGdW5jO1xuICAgIGNvbnN0IHdyYXBwZXJDb21wID0gKHByb3BzLCAuLi5hcmdzKSA9PiB7XG4gICAgICAvLyB3cmFwIHRoZSBmdW5jdGlvbiBjYWxsIHdoZW4gdGhlIGNvbXBvbmVudCBoYXMgbm90IGJlZW4gbW91bnRlZCB5ZXQgKGxhenkgZXZhbHVhdGlvbiB0byBtYWtlIHN1cmUgdGhlIHVwZGF0ZUZ1bmMgaGFzIGJlZW4gc2V0KTtcbiAgICAgIGNvbnN0IHNldFN0YXRlID0gdXBkYXRlRnVuYyA/IHVwZGF0ZUZ1bmMgOiAobmV3U3RhdGUpID0+IHVwZGF0ZUZ1bmMobmV3U3RhdGUpO1xuICAgICAgcmV0dXJuIGNvbXAocHJvcHMsIHNldFN0YXRlLCAuLi5hcmdzKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIG9uTW91bnQoKHZub2RlKSA9PiB7XG4gICAgICB1cGRhdGVGdW5jID0gdXBkYXRlKHdyYXBwZXJDb21wLCB2bm9kZSk7XG4gICAgfSwgd3JhcHBlckNvbXApO1xuICB9O1xufSIsImltcG9ydCB1cGRhdGUgZnJvbSAnLi91cGRhdGUnO1xuaW1wb3J0IHtvbk1vdW50fSBmcm9tICcuL2xpZmVDeWNsZXMnO1xuaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuXG4vKipcbiAqIENvbWJpbmF0b3IgdG8gY3JlYXRlIGEgRWxtIGxpa2UgYXBwXG4gKiBAcGFyYW0gdmlld1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAodmlldykge1xuXG4gIHJldHVybiBmdW5jdGlvbiAoe21vZGVsLCB1cGRhdGVzLCBzdWJzY3JpcHRpb25zID0gW119KSB7XG4gICAgbGV0IGFjdGlvblN0b3JlID0ge307XG5cbiAgICBjb25zdCBjb21wID0gcHJvcHMgPT4gdmlldyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuXG4gICAgY29uc3QgaW5pdEFjdGlvblN0b3JlID0gKHZub2RlKSA9PiB7XG4gICAgICBjb25zdCB1cGRhdGVGdW5jID0gdXBkYXRlKGNvbXAsIHZub2RlKTtcbiAgICAgIGZvciAobGV0IHVwZGF0ZSBvZiBPYmplY3Qua2V5cyh1cGRhdGVzKSkge1xuICAgICAgICBhY3Rpb25TdG9yZVt1cGRhdGVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgICBtb2RlbCA9IHVwZGF0ZXNbdXBkYXRlXShtb2RlbCwgLi4uYXJncyk7IC8vdG9kbyBjb25zaWRlciBzaWRlIGVmZmVjdHMsIG1pZGRsZXdhcmVzLCBldGNcbiAgICAgICAgICByZXR1cm4gdXBkYXRlRnVuYyhtb2RlbCwgYWN0aW9uU3RvcmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBpbml0U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5tYXAoc3ViID0+IHZub2RlID0+IHN1Yih2bm9kZSwgYWN0aW9uU3RvcmUpKTtcbiAgICBjb25zdCBpbml0RnVuYyA9IGNvbXBvc2UoaW5pdEFjdGlvblN0b3JlLCAuLi5pbml0U3Vic2NyaXB0aW9uKTtcblxuICAgIHJldHVybiBvbk1vdW50KGluaXRGdW5jLCBjb21wKTtcbiAgfTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xuaW1wb3J0IHttb2RlbCwgcmVkdWNlcnN9IGZyb20gXCIuL3N0b3JlXCJcbmltcG9ydCBSb3dzVmlldyBmcm9tIFwiLi9yb3dzXCJcbmltcG9ydCB7ZWxtIGFzIGFwcCwgaCwgbW91bnR9IGZyb20gJy4uLy4uL2luZGV4J1xuXG5sZXQgc3RhcnRUaW1lO1xubGV0IGxhc3RNZWFzdXJlO1xuXG5mdW5jdGlvbiBzdGFydE1lYXN1cmUgKG5hbWUsIGNiKSB7XG4gIHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpXG4gIHBlcmZvcm1hbmNlLm1hcmsoJ3N0YXJ0ICcgKyBuYW1lKTtcbiAgbGFzdE1lYXN1cmUgPSBuYW1lO1xuICBjYigpO1xufVxuXG5mdW5jdGlvbiBzdG9wTWVhc3VyZSAoKSB7XG4gIGNvbnN0IGxhc3QgPSBsYXN0TWVhc3VyZTtcblxuICBpZiAobGFzdE1lYXN1cmUpIHtcbiAgICB3aW5kb3cuc2V0VGltZW91dChcbiAgICAgIGZ1bmN0aW9uIG1ldGFTdG9wTWVhc3VyZSAoKSB7XG4gICAgICAgIGxhc3RNZWFzdXJlID0gbnVsbFxuICAgICAgICBjb25zdCBzdG9wID0gcGVyZm9ybWFuY2Uubm93KClcbiAgICAgICAgcGVyZm9ybWFuY2UubWFyaygnZW5kICcgKyBsYXN0KTtcbiAgICAgICAgcGVyZm9ybWFuY2UubWVhc3VyZShsYXN0LCAnc3RhcnQgJyArIGxhc3QsICdlbmQgJyArIGxhc3QpO1xuICAgICAgICBjb25zb2xlLmxvZyhsYXN0ICsgXCIgdG9vayBcIiArIChzdG9wIC0gc3RhcnRUaW1lKSlcbiAgICAgIH0sXG4gICAgICAwXG4gICAgKVxuICB9XG59XG5cbmZ1bmN0aW9uIHZpZXcgKG1vZGVsLCBhY3Rpb25zKSB7XG4gIHN0b3BNZWFzdXJlKClcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwianVtYm90cm9uXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJyb3dcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLW1kLTZcIj5cbiAgICAgICAgICAgIDxoMT5GbGFjbyAwLjEuMDwvaDE+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1tZC02XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicm93XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtc20tNiBzbWFsbHBhZFwiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgIGlkPVwicnVuXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFwicnVuXCIsIGFjdGlvbnMucnVuKX0+XG4gICAgICAgICAgICAgICAgICBDcmVhdGUgMSwwMDAgcm93c1xuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1zbS02IHNtYWxscGFkXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tYmxvY2tcIlxuICAgICAgICAgICAgICAgICAgaWQ9XCJydW5sb3RzXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFxuICAgICAgICAgICAgICAgICAgICAgIFwicnVuTG90c1wiLFxuICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbnMucnVuTG90c1xuICAgICAgICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICAgIENyZWF0ZSAxMCwwMDAgcm93c1xuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbC1zbS02IHNtYWxscGFkXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzcz1cImJ0biBidG4tcHJpbWFyeSBidG4tYmxvY2tcIlxuICAgICAgICAgICAgICAgICAgaWQ9XCJhZGRcIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17XyA9PlxuICAgICAgICAgICAgICAgICAgICBzdGFydE1lYXN1cmUoXCJhZGRcIiwgYWN0aW9ucy5hZGQpfT5cbiAgICAgICAgICAgICAgICAgIEFwcGVuZCAxLDAwMCByb3dzXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLXNtLTYgc21hbGxwYWRcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9ja1wiXG4gICAgICAgICAgICAgICAgICBpZD1cInVwZGF0ZVwiXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXtfID0+XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TWVhc3VyZShcInVwZGF0ZVwiLCBhY3Rpb25zLnVwZGF0ZSl9PlxuICAgICAgICAgICAgICAgICAgVXBkYXRlIGV2ZXJ5IDEwdGggcm93XG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29sLXNtLTYgc21hbGxwYWRcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9ja1wiXG4gICAgICAgICAgICAgICAgICBpZD1cImNsZWFyXCJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e18gPT5cbiAgICAgICAgICAgICAgICAgICAgc3RhcnRNZWFzdXJlKFwiY2xlYXJcIiwgYWN0aW9ucy5jbGVhcil9PlxuICAgICAgICAgICAgICAgICAgQ2xlYXJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb2wtc20tNiBzbWFsbHBhZFwiPlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJidG4gYnRuLXByaW1hcnkgYnRuLWJsb2NrXCJcbiAgICAgICAgICAgICAgICAgIGlkPVwic3dhcHJvd3NcIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17XyA9PlxuICAgICAgICAgICAgICAgICAgICBzdGFydE1lYXN1cmUoXG4gICAgICAgICAgICAgICAgICAgICAgXCJzd2FwUm93c1wiLFxuICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbnMuc3dhcFJvd3NcbiAgICAgICAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAgICBTd2FwIFJvd3NcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLWhvdmVyIHRhYmxlLXN0cmlwZWQgdGVzdC1kYXRhXCI+XG4gICAgICAgIDx0Ym9keT5cbiAgICAgICAgPFJvd3NWaWV3IG1vZGVsPXttb2RlbH0gYWN0aW9ucz17YWN0aW9uc30vPlxuICAgICAgICA8L3Rib2R5PlxuICAgICAgPC90YWJsZT5cbiAgICAgIDxzcGFuXG4gICAgICAgIGNsYXNzPVwicHJlbG9hZGljb24gZ2x5cGhpY29uIGdseXBoaWNvbi1yZW1vdmVcIlxuICAgICAgICBhcmlhLWhpZGRlbj1cInRydWVcIlxuICAgICAgLz5cbiAgICA8L2Rpdj4pO1xufVxuXG5jb25zdCBCZW5jaCA9IGFwcCh2aWV3KTtcblxubW91bnQoKHttb2RlbCwgdXBkYXRlc30pID0+ICg8QmVuY2ggbW9kZWw9e21vZGVsfSB1cGRhdGVzPXt1cGRhdGVzfS8+KSwge1xuICBtb2RlbCwgdXBkYXRlczogcmVkdWNlcnNcbn0sIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibWFpblwiKSk7XG4iXSwibmFtZXMiOlsibW91bnQiLCJ1cGRhdGUiLCJtb2RlbCJdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQUVWLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUE7O0FBRXhCLFNBQVMsU0FBUyxFQUFFLEtBQUssRUFBRTtFQUN6QixNQUFNLFVBQVUsR0FBRztJQUNqQixRQUFRO0lBQ1IsT0FBTztJQUNQLEtBQUs7SUFDTCxPQUFPO0lBQ1AsTUFBTTtJQUNOLE9BQU87SUFDUCxNQUFNO0lBQ04sVUFBVTtJQUNWLE9BQU87SUFDUCxRQUFRO0lBQ1IsT0FBTztJQUNQLFNBQVM7SUFDVCxNQUFNO0lBQ04sT0FBTztJQUNQLE9BQU87SUFDUCxTQUFTO0lBQ1QsT0FBTztJQUNQLEtBQUs7SUFDTCxXQUFXO0lBQ1gsVUFBVTtJQUNWLFdBQVc7SUFDWCxhQUFhO0lBQ2IsT0FBTztJQUNQLFdBQVc7SUFDWCxPQUFPO0dBQ1IsQ0FBQTs7RUFFRCxNQUFNLE9BQU8sR0FBRztJQUNkLEtBQUs7SUFDTCxRQUFRO0lBQ1IsTUFBTTtJQUNOLE9BQU87SUFDUCxNQUFNO0lBQ04sT0FBTztJQUNQLFFBQVE7SUFDUixPQUFPO0lBQ1AsT0FBTztJQUNQLE9BQU87SUFDUCxRQUFRO0dBQ1QsQ0FBQTs7RUFFRCxNQUFNLEtBQUssR0FBRztJQUNaLE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTztJQUNQLEtBQUs7SUFDTCxNQUFNO0lBQ04sS0FBSztJQUNMLE1BQU07SUFDTixRQUFRO0lBQ1IsVUFBVTtJQUNWLFFBQVE7SUFDUixPQUFPO0lBQ1AsT0FBTztJQUNQLFVBQVU7R0FDWCxDQUFB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
