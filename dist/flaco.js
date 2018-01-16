(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.flaco = {})));
}(this, (function (exports) { 'use strict';

const createTextVNode = value => ({
	nodeType: 'Text',
	children: [],
	props: {value},
	lifeCycle: 0
});

const normalize = (children, currentText = '', normalized = []) => {
	if (children.length === 0) {
		if (currentText) {
			normalized.push(createTextVNode(currentText));
		}
		return normalized;
	}

	const child = children.shift();
	const type = typeof child;
	if (type === 'object' || type === 'function') {
		if (currentText) {
			normalized.push(createTextVNode(currentText));
			currentText = '';
		}
		normalized.push(child);
	} else {
		currentText += child;
	}

	return normalize(children, currentText, normalized);
};

/**
 * Transform hyperscript into virtual dom node
 * @param nodeType {Function, String} - the HTML tag if string, a component or combinator otherwise
 * @param props {Object} - the list of properties/attributes associated to the related node
 * @param children - the virtual dom nodes related to the current node children
 * @returns {Object} - a virtual dom node
 */
function h(nodeType, props, ...children) {
	const flatChildren = [];
	for (const c of children) {
		if (Array.isArray(c)) {
			flatChildren.push(...c);
		} else {
			flatChildren.push(c);
		}
	}

	const normalizedChildren = normalize(flatChildren);

	if (typeof nodeType !== 'function') { // Regular html/text node
		return {
			nodeType,
			props,
			children: normalizedChildren,
			lifeCycle: 0
		};
	}

	const fullProps = Object.assign({children: normalizedChildren}, props);
	const comp = nodeType(fullProps);
	const compType = typeof comp;
	/* eslint-disable no-negated-condition */
	return compType !== 'function' ? comp : h(comp, props, ...normalizedChildren); // Functional comp vs combinator (HOC)
	/* eslint-enable no-negated-condition */
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
	return aKeys.length === bKeys.length && aKeys.every(k => a[k] === b[k]);
};

const ownKeys = obj => Object.getOwnPropertyNames(obj);

const isDeepEqual = (a, b) => {
	const type = typeof a;
	const typeB = typeof b;

	// Short path(s)
	if (a === b) {
		return true;
	}

	if (type !== typeB) {
		return false;
	}

	if (type !== 'object') {
		return a === b;
	}

	// Objects ...
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

const noop = () => {};

/* eslint-disable no-undef */
const SVG_NP = 'http://www.w3.org/2000/svg';

const updateDomNodeFactory = method => items => tap(domNode => {
	for (const pair of items) {
		domNode[method](...pair);
	}
});

const removeEventListeners = updateDomNodeFactory('removeEventListener');

const addEventListeners = updateDomNodeFactory('addEventListener');

const setAttributes = items => tap(domNode => {
	const attributes = items.filter(pair => typeof pair.value !== 'function');
	for (const [key, value] of attributes) {
		if (value === false) {
			domNode.removeAttribute(key);
		} else {
			domNode.setAttribute(key, value);
		}
	}
});

const removeAttributes = items => tap(domNode => {
	for (const attr of items) {
		domNode.removeAttribute(attr);
	}
});

const setTextNode = val => node => {
	node.textContent = val;
};

const createDomNode = (vnode, parent) => {
	if (vnode.nodeType === 'svg') {
		return document.createElementNS(SVG_NP, vnode.nodeType);
	} else if (vnode.nodeType === 'Text') {
		return document.createTextNode(vnode.nodeType);
	}
	return parent.namespaceURI === SVG_NP ?
		document.createElementNS(SVG_NP, vnode.nodeType) :
		document.createElement(vnode.nodeType);
};

const getEventListeners = props => Object.keys(props)
	.filter(k => k.substr(0, 2) === 'on')
	.map(k => [k.substr(2).toLowerCase(), props[k]]);
/* eslint-enable no-undef */

function * traverse(vnode) {
	yield vnode;
	if (vnode.children && vnode.children.length > 0) {
		for (const child of vnode.children) {
			yield * traverse(child);
		}
	}
}

const updateEventListeners = ({props: newNodeProps} = {}, {props: oldNodeProps} = {}) => {
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

// Apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
const domify = (oldVnode, newVnode, parentDomNode) => {
	if (!oldVnode && newVnode) { // There is no previous vnode
		newVnode.dom = parentDomNode.appendChild(domFactory(newVnode, parentDomNode));
		newVnode.lifeCycle = 1;
		return {vnode: newVnode, garbage: null};
	}

	// There is a previous vnode
	if (!newVnode) { // We must remove the related dom node
		parentDomNode.removeChild(oldVnode.dom);
		return ({garbage: oldVnode, dom: null});
	} else if (newVnode.nodeType !== oldVnode.nodeType) { // It must be replaced
		newVnode.dom = domFactory(newVnode, parentDomNode);
		newVnode.lifeCycle = 1;
		parentDomNode.replaceChild(newVnode.dom, oldVnode.dom);
		return {garbage: oldVnode, vnode: newVnode};
	}

	// Only update attributes
	newVnode.dom = oldVnode.dom;
	// Pass the unMountHook
	if (oldVnode.onUnMount) {
		newVnode.onUnMount = oldVnode.onUnMount;
	}
	newVnode.lifeCycle = oldVnode.lifeCycle + 1;
	return {garbage: null, vnode: newVnode};
};

/**
 * Render a virtual dom node, diffing it with its previous version, mounting it in a parent dom node
 * @param oldVnode
 * @param newVnode
 * @param parentDomNode
 * @param onNextTick collect operations to be processed on next tick
 * @returns {Array}
 */
const render = (oldVnode, newVnode, parentDomNode, onNextTick = []) => {
	// 1. transform the new vnode to a vnode connected to an actual dom element based on vnode versions diffing
	// 	i. note at this step occur dom insertions/removals
	// 	ii. it may collect sub tree to be dropped (or "unmounted")
	const {vnode, garbage} = domify(oldVnode, newVnode, parentDomNode);

	if (garbage !== null) {
		// Defer unmount lifecycle as it is not "visual"
		for (const g of traverse(garbage)) {
			if (g.onUnMount) {
				onNextTick.push(g.onUnMount);
			}
		}
	}

	// Normalisation of old node (in case of a replace we will consider old node as empty node (no children, no props))
	const tempOldNode = garbage !== null || !oldVnode ? {length: 0, children: [], props: {}} : oldVnode;

	if (vnode) {
		// 2. update dom attributes based on vnode prop diffing.
		// Sync
		if (vnode.onUpdate && vnode.lifeCycle > 1) {
			vnode.onUpdate();
		}

		updateAttributes(vnode, tempOldNode)(vnode.dom);

		// Fast path
		if (vnode.nodeType === 'Text') {
			return onNextTick;
		}

		if (vnode.onMount && vnode.lifeCycle === 1) {
			onNextTick.push(() => vnode.onMount());
		}

		const childrenCount = Math.max(tempOldNode.children.length, vnode.children.length);

		// Async will be deferred as it is not "visual"
		const setListeners = updateEventListeners(vnode, tempOldNode);
		if (setListeners !== noop) {
			onNextTick.push(() => setListeners(vnode.dom));
		}

		// 3. recursively traverse children to update dom and collect functions to process on next tick
		if (childrenCount > 0) {
			for (let i = 0; i < childrenCount; i++) {
				// We pass onNextTick as reference (improve perf: memory + speed)
				render(tempOldNode.children[i], vnode.children[i], vnode.dom, onNextTick);
			}
		}
	}

	return onNextTick;
};

const hydrate = (vnode, dom) => {
	const hydrated = Object.assign({}, vnode);
	const domChildren = Array.from(dom.childNodes).filter(n => n.nodeType !== 3 || n.nodeValue.trim() !== '');
	hydrated.dom = dom;
	hydrated.children = vnode.children.map((child, i) => hydrate(child, domChildren[i]));
	return hydrated;
};

const mount = curry((comp, initProp, root) => {
	/* eslint-disable no-negated-condition */
	/* eslint-disable no-void */
	const vnode = comp.nodeType !== void 0 ? comp : comp(initProp || {});
	/* eslint-enable no-void */
	/* eslint-enable no-negated-condition */
	const oldVNode = root.children.length ? hydrate(vnode, root.children[0]) : null;
	const batch = render(oldVNode, vnode, root);
	nextTick(() => {
		for (const op of batch) {
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
var update = (comp, initialVNode) => {
	let oldNode = initialVNode;
	return (props, ...args) => {
		const mount$$1 = oldNode.dom.parentNode;
		const newNode = comp(Object.assign({children: oldNode.children || []}, oldNode.props, props), ...args);
		const nextBatch = render(oldNode, newNode, mount$$1);

		// Danger zone !!!!
		// Change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream: oldNode may be the child of someone ...(well that is a tree data structure after all :P )
		oldNode = Object.assign(oldNode || {}, newNode);
		// End danger zone

		nextTick(() => {
			for (const op of nextBatch) {
				op();
			}
		});

		return newNode;
	};
};

const lifeCycleFactory = method => curry((fn, comp) => (props, ...args) => {
	const n = comp(props, ...args);
	const applyFn = () => fn(n, ...args);
	const current = n[method];
	n[method] = current ? compose(current, applyFn) : applyFn;
	return n;
});

/**
 * Life cycle: when the component is mounted
 */
const onMount = lifeCycleFactory('onMount');

/**
 * Life cycle: when the component is unmounted
 */
const onUnMount = lifeCycleFactory('onUnMount');

/**
 * Life cycle: before the component is updated
 */
const onUpdate = lifeCycleFactory('onUpdate');

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp {Function} - the component
 * @returns {Function} - a new wrapped component
 */
var withState = comp => () => {
	let updateFunc;
	const wrapperComp = (props, ...args) => {
		// Lazy evaluate updateFunc (to make sure it is defined
		const setState = newState => updateFunc(newState);
		return comp(props, setState, ...args);
	};
	const setUpdateFunction = vnode => {
		updateFunc = update(wrapperComp, vnode);
	};

	return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
};

/**
 * Combinator to create a Elm like app
 * @param view {Function} - a component which takes as arguments the current model and the list of updates
 * @returns {Function} - a Elm like application whose properties "model", "updates" and "subscriptions" will define the related domain specific objects
 */
var elm = view => ({model, updates, subscriptions = []} = {}) => {
	let updateFunc;
	const actionStore = {};
	for (const update$$1 of Object.keys(updates)) {
		actionStore[update$$1] = () => updateFunc(model, actionStore);
	}

	const comp = () => view(model, actionStore);

	const initActionStore = vnode => {
		updateFunc = update(comp, vnode);
	};
	const initSubscription = subscriptions.map(sub => vnode => sub(vnode, actionStore));
	const initFunc = compose(initActionStore, ...initSubscription);

	return onMount(initFunc, comp);
};

const defaultUpdate = (a, b) => isDeepEqual(a, b) === false;

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change under specific circumstances
 * @param store {Object} - The store (implementing the same api than Redux store
 * @param sliceState {Function} [state => state] - A function which takes as argument the state and return a "transformed" state (like partial, etc) relevant to the container
 * @returns {Function} - A container factory with the following arguments:
 *  - mapStateToProp: a function which takes as argument what the "sliceState" function returns and returns an object to be blended into the properties of the component (default to identity function)
 *  - shouldUpdate: a function which takes as arguments the previous and the current versions of what "sliceState" function returns to returns a boolean defining whether the component should be updated (default to a deepEqual check)
 */
var connect = (store, sliceState = identity) =>
	(comp, mapStateToProp = identity, shouldUpate = defaultUpdate) => initProp => {
		const componentProps = initProp;
		let updateFunc;
		let previousStateSlice;
		let unsubscriber;

		const wrapperComp = (props, ...args) => {
			return comp(Object.assign(props, mapStateToProp(sliceState(store.getState()))), ...args);
		};

		const subscribe = onMount(vnode => {
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

exports.h = h;
exports.elm = elm;
exports.withState = withState;
exports.render = render;
exports.mount = mount;
exports.update = update;
exports.isDeepEqual = isDeepEqual;
exports.onMount = onMount;
exports.onUnMount = onUnMount;
exports.connect = connect;
exports.onUpdate = onUpdate;

Object.defineProperty(exports, '__esModule', { value: true });

})));
