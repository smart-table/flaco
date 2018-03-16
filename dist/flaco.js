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
	return compType !== 'function' ? comp : h(comp, props, ...normalizedChildren); // Functional comp vs combinator (HOC)
}

const compose = (first, ...fns) => (...args) => fns.reduce((previous, current) => current(previous), first(...args));

const curry = (fn, arityLeft) => {
	const arity = arityLeft || fn.length;
	return (...args) => {
		const argLength = args.length || 1;
		if (arity === argLength) {
			return fn(...args);
		}
		const func = (...moreArgs) => fn(...args, ...moreArgs);
		return curry(func, arity - args.length);
	};
};

const tap = fn => arg => {
	fn(arg);
	return arg;
};

const nextTick = fn => setTimeout(fn, 0);

const pairify = holder => key => [key, holder[key]];

const isShallowEqual = (a, b) => {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	return aKeys.length === bKeys.length && aKeys.every(k => a[k] === b[k]);
};

const noop = () => {};

const SVG_NP = 'http://www.w3.org/2000/svg';

const updateDomNodeFactory = method => items => tap(domNode => {
	for (const pair of items) {
		domNode[method](...pair);
	}
});

const removeEventListeners = updateDomNodeFactory('removeEventListener');

const addEventListeners = updateDomNodeFactory('addEventListener');

const setAttributes = items => tap(domNode => {
	const attributes = items.filter(([key,value]) => typeof value !== 'function');
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
	const vnode = comp.nodeType !== void 0 ? comp : comp(initProp || {});
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

// Main root
// todo
// Document metadata
// todo
// Sectioning root
const body = (...args) => h('body', ...args);
// Content sectioning
const address = (...args) => h('address', ...args);
const article = (...args) => h('article', ...args);
const aside = (...args) => h('aside', ...args);
const footer = (...args) => h('footer', ...args);
const header = (...args) => h('header', ...args);
const h1 = (...args) => h('h1', ...args);
const h2 = (...args) => h('h2', ...args);
const h3 = (...args) => h('h3', ...args);
const h4 = (...args) => h('h4', ...args);
const h5 = (...args) => h('h5', ...args);
const h6 = (...args) => h('h6', ...args);
const hgroup = (...args) => h('hgroup', ...args);
const nav = (...args) => h('nav', ...args);
const section = (...args) => h('section', ...args);
// Text content
const blockquote = (...args) => h('blockquote', ...args);
const dd = (...args) => h('dd', ...args);
const dir = (...args) => h('dir', ...args);
const div = (...args) => h('div', ...args);
const dl = (...args) => h('dl', ...args);
const dt = (...args) => h('dt', ...args);
const figcaption = (...args) => h('figcaption', ...args);
const figure = (...args) => h('figure', ...args);
const hr = (...args) => h('hr', ...args);
const li = (...args) => h('li', ...args);
const main = (...args) => h('main', ...args);
const ol = (...args) => h('ol', ...args);
const p = (...args) => h('p', ...args);
const pre = (...args) => h('pre', ...args);
const ul = (...args) => h('ul', ...args);
// Inline text semantic
const a = (...args) => h('a', ...args);
const abbr = (...args) => h('abbr', ...args);
const b = (...args) => h('b', ...args);
const bdi = (...args) => h('bdi', ...args);
const bdo = (...args) => h('bdo', ...args);
const br = (...args) => h('br', ...args);
const cite = (...args) => h('cite', ...args);
const quote = (...args) => h('quote', ...args);
const data = (...args) => h('data', ...args);
const dfn = (...args) => h('dfn', ...args);
const em = (...args) => h('em', ...args);
const i = (...args) => h('i', ...args);
const kbd = (...args) => h('kbd', ...args);
const mark = (...args) => h('mark', ...args);
const q = (...args) => h('q', ...args);
const rp = (...args) => h('rp', ...args);
const rt = (...args) => h('rt', ...args);
const rtc = (...args) => h('rtc', ...args);
const ruby = (...args) => h('ruby', ...args);
const s = (...args) => h('s', ...args);
const samp = (...args) => h('samp', ...args);
const small = (...args) => h('small', ...args);
const span = (...args) => h('span', ...args);
const strong = (...args) => h('strong', ...args);
const sub = (...args) => h('sub', ...args);
const sup = (...args) => h('sup', ...args);
const time = (...args) => h('time', ...args);
const u = (...args) => h('u', ...args);
// export const var = (...args) => h('var', ...args);
const wbr = (...args) => h('wbr', ...args);
// Image and multimedia
const area = (...args) => h('area', ...args);
const audio = (...args) => h('audio', ...args);
const img = (...args) => h('img', ...args);
const map = (...args) => h('map', ...args);
const track = (...args) => h('track', ...args);
const video = (...args) => h('video', ...args);
// Embedded content
const embed = (...args) => h('embed', ...args);
const object = (...args) => h('object', ...args);
const param = (...args) => h('param', ...args);
const picture = (...args) => h('picture', ...args);
const source = (...args) => h('source', ...args);
// Scripting
// todo
// Demarcating edit
// todo
// Table content
const caption = (...args) => h('caption', ...args);
const col = (...args) => h('col', ...args);
const colgroup = (...args) => h('colgroup', ...args);
const table = (...args) => h('table', ...args);
const tbody = (...args) => h('tbody', ...args);
const td = (...args) => h('td', ...args);
const tfoot = (...args) => h('tfoot', ...args);
const th = (...args) => h('th', ...args);
const thead = (...args) => h('thead', ...args);
const tr = (...args) => h('tr', ...args);
// Forms
const button = (...args) => h('button', ...args);
const datalist = (...args) => h('datalist', ...args);
const fieldset = (...args) => h('fieldset', ...args);
const form = (...args) => h('form', ...args);
const input = (...args) => h('input', ...args);
const label = (...args) => h('label', ...args);
const legend = (...args) => h('legend', ...args);
const meter = (...args) => h('meter', ...args);
const optgroup = (...args) => h('optgroup', ...args);
const option = (...args) => h('option', ...args);
const output = (...args) => h('output', ...args);
const progress = (...args) => h('progress', ...args);
const select = (...args) => h('select', ...args);
const textarea = (...args) => h('textarea', ...args);
// Interactive elements
// todo

const filterOutFunction = props => Object
	.entries(props || {})
	.filter(([key, value]) => typeof value !== 'function');

const escapeHTML = s => String(s)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

const render$1 = curry((comp, initProp) => {
	const vnode = comp.nodeType !== void 0 ? comp : comp(initProp || {});
	const {nodeType, children, props} = vnode;
	const attributes = escapeHTML(filterOutFunction(props)
		.map(([key, value]) => typeof value === 'boolean' ? (value === true ? key : '') : `${key}="${value}"`)
		.join(' '));
	const childrenHtml = children !== void 0 && children.length > 0 ? children.map(ch => render$1(ch)()).join('') : '';
	return nodeType === 'Text' ? escapeHTML(String(props.value)) : `<${nodeType}${attributes ? ` ${attributes}` : ''}>${childrenHtml}</${nodeType}>`;
});

exports.h = h;
exports.withState = withState;
exports.render = render;
exports.mount = mount;
exports.update = update;
exports.renderAsString = render$1;
exports.body = body;
exports.address = address;
exports.article = article;
exports.aside = aside;
exports.footer = footer;
exports.header = header;
exports.h1 = h1;
exports.h2 = h2;
exports.h3 = h3;
exports.h4 = h4;
exports.h5 = h5;
exports.h6 = h6;
exports.hgroup = hgroup;
exports.nav = nav;
exports.section = section;
exports.blockquote = blockquote;
exports.dd = dd;
exports.dir = dir;
exports.div = div;
exports.dl = dl;
exports.dt = dt;
exports.figcaption = figcaption;
exports.figure = figure;
exports.hr = hr;
exports.li = li;
exports.main = main;
exports.ol = ol;
exports.p = p;
exports.pre = pre;
exports.ul = ul;
exports.a = a;
exports.abbr = abbr;
exports.b = b;
exports.bdi = bdi;
exports.bdo = bdo;
exports.br = br;
exports.cite = cite;
exports.quote = quote;
exports.data = data;
exports.dfn = dfn;
exports.em = em;
exports.i = i;
exports.kbd = kbd;
exports.mark = mark;
exports.q = q;
exports.rp = rp;
exports.rt = rt;
exports.rtc = rtc;
exports.ruby = ruby;
exports.s = s;
exports.samp = samp;
exports.small = small;
exports.span = span;
exports.strong = strong;
exports.sub = sub;
exports.sup = sup;
exports.time = time;
exports.u = u;
exports.wbr = wbr;
exports.area = area;
exports.audio = audio;
exports.img = img;
exports.map = map;
exports.track = track;
exports.video = video;
exports.embed = embed;
exports.object = object;
exports.param = param;
exports.picture = picture;
exports.source = source;
exports.caption = caption;
exports.col = col;
exports.colgroup = colgroup;
exports.table = table;
exports.tbody = tbody;
exports.td = td;
exports.tfoot = tfoot;
exports.th = th;
exports.thead = thead;
exports.tr = tr;
exports.button = button;
exports.datalist = datalist;
exports.fieldset = fieldset;
exports.form = form;
exports.input = input;
exports.label = label;
exports.legend = legend;
exports.meter = meter;
exports.optgroup = optgroup;
exports.option = option;
exports.output = output;
exports.progress = progress;
exports.select = select;
exports.textarea = textarea;
exports.onMount = onMount;
exports.onUnMount = onUnMount;
exports.onUpdate = onUpdate;

Object.defineProperty(exports, '__esModule', { value: true });

})));
