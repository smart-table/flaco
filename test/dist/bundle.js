var test = (function () {
'use strict';

const stringify = JSON.stringify;
const printTestHeader = test => console.log(`# ${test.description} - ${test.executionTime}ms`);
const printTestCase = (assertion, id) => {
	const pass = assertion.pass;
	const status = pass === true ? 'ok' : 'not ok';
	console.log(`${status} ${id} ${assertion.message}`);
	if (pass !== true) {
		console.log(`  ---
    operator: ${assertion.operator}
    expected: ${stringify(assertion.expected)}
    actual: ${stringify(assertion.actual)}
    at: ${assertion.at || ''}
  ...
`);
	}
};
const printSummary = ({ count, pass, fail, skipped, executionTime }) => {
	console.log(`
1..${count}
# duration ${executionTime}ms
# ${skipped > 0 ? '🚨' : ''}tests ${count} (${skipped} skipped)
# pass  ${pass}
# ${fail > 0 ? '🚨' : ''}fail  ${fail} 
		`);
};

var tap = ({ displaySkipped = false } = {}) => function* () {
	const startTime = Date.now();
	let pass = 0;
	let fail = 0;
	let id = 0;
	let skipped = 0;
	console.log('TAP version 13');
	try {
		/* eslint-disable no-constant-condition */
		while (true) {
			const test = yield;

			if (test.items.length === 0) {
				skipped++;
			}

			if (test.items.length > 0 || displaySkipped === true) {
				printTestHeader(test);
			}

			for (const assertion of test.items) {
				id++;
				if (assertion.pass === true) {
					pass++;
				} else {
					fail++;
				}
				printTestCase(assertion, id);
			}
		}
		/* eslint-enable no-constant-condition */
	} catch (err) {
		console.log('Bail out! unhandled exception');
		throw err;
	} finally {
		const executionTime = Date.now() - startTime;
		printSummary({ count: id, executionTime, skipped, pass, fail });
	}
};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var keys = createCommonjsModule(function (module, exports) {
	exports = module.exports = typeof Object.keys === 'function' ? Object.keys : shim;

	exports.shim = shim;
	function shim(obj) {
		var keys = [];
		for (var key in obj) keys.push(key);
		return keys;
	}
});

var keys_1 = keys.shim;

var is_arguments = createCommonjsModule(function (module, exports) {
	var supportsArgumentsClass = function () {
		return Object.prototype.toString.call(arguments);
	}() == '[object Arguments]';

	exports = module.exports = supportsArgumentsClass ? supported : unsupported;

	exports.supported = supported;
	function supported(object) {
		return Object.prototype.toString.call(object) == '[object Arguments]';
	}

	exports.unsupported = unsupported;
	function unsupported(object) {
		return object && typeof object == 'object' && typeof object.length == 'number' && Object.prototype.hasOwnProperty.call(object, 'callee') && !Object.prototype.propertyIsEnumerable.call(object, 'callee') || false;
	}
});

var is_arguments_1 = is_arguments.supported;
var is_arguments_2 = is_arguments.unsupported;

var deepEqual_1 = createCommonjsModule(function (module) {
	var pSlice = Array.prototype.slice;

	var deepEqual = module.exports = function (actual, expected, opts) {
		if (!opts) opts = {};
		// 7.1. All identical values are equivalent, as determined by ===.
		if (actual === expected) {
			return true;
		} else if (actual instanceof Date && expected instanceof Date) {
			return actual.getTime() === expected.getTime();

			// 7.3. Other pairs that do not both pass typeof value == 'object',
			// equivalence is determined by ==.
		} else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
			return opts.strict ? actual === expected : actual == expected;

			// 7.4. For all other Object pairs, including Array objects, equivalence is
			// determined by having the same number of owned properties (as verified
			// with Object.prototype.hasOwnProperty.call), the same set of keys
			// (although not necessarily the same order), equivalent values for every
			// corresponding key, and an identical 'prototype' property. Note: this
			// accounts for both named and indexed properties on Arrays.
		} else {
			return objEquiv(actual, expected, opts);
		}
	};

	function isUndefinedOrNull(value) {
		return value === null || value === undefined;
	}

	function isBuffer(x) {
		if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
		if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
			return false;
		}
		if (x.length > 0 && typeof x[0] !== 'number') return false;
		return true;
	}

	function objEquiv(a, b, opts) {
		var i, key;
		if (isUndefinedOrNull(a) || isUndefinedOrNull(b)) return false;
		// an identical 'prototype' property.
		if (a.prototype !== b.prototype) return false;
		//~~~I've managed to break Object.keys through screwy arguments passing.
		//   Converting to array solves the problem.
		if (is_arguments(a)) {
			if (!is_arguments(b)) {
				return false;
			}
			a = pSlice.call(a);
			b = pSlice.call(b);
			return deepEqual(a, b, opts);
		}
		if (isBuffer(a)) {
			if (!isBuffer(b)) {
				return false;
			}
			if (a.length !== b.length) return false;
			for (i = 0; i < a.length; i++) {
				if (a[i] !== b[i]) return false;
			}
			return true;
		}
		try {
			var ka = keys(a),
			    kb = keys(b);
		} catch (e) {
			//happens when one is a string literal and the other isn't
			return false;
		}
		// having the same number of owned properties (keys incorporates
		// hasOwnProperty)
		if (ka.length != kb.length) return false;
		//the same set of keys (although not necessarily the same order),
		ka.sort();
		kb.sort();
		//~~~cheap key test
		for (i = ka.length - 1; i >= 0; i--) {
			if (ka[i] != kb[i]) return false;
		}
		//equivalent values for every corresponding key, and
		//~~~possibly expensive deep test
		for (i = ka.length - 1; i >= 0; i--) {
			key = ka[i];
			if (!deepEqual(a[key], b[key], opts)) return false;
		}
		return typeof a === typeof b;
	}
});

const getAssertionLocation = () => {
	const err = new Error();
	const stack = (err.stack || '').split('\n');
	return (stack[3] || '').replace(/^at/i, '').trim();
};
const assertMethodHook = fn => function (...args) {
	const assertResult = fn(...args);

	if (assertResult.pass === false) {
		assertResult.at = getAssertionLocation();
	}

	this.collect(assertResult);
	return assertResult;
};

const Assertion = {
	ok: assertMethodHook((val, message = 'should be truthy') => ({
		pass: Boolean(val),
		actual: val,
		expected: true,
		message,
		operator: 'ok'
	})),
	deepEqual: assertMethodHook((actual, expected, message = 'should be equivalent') => ({
		pass: deepEqual_1(actual, expected),
		actual,
		expected,
		message,
		operator: 'deepEqual'
	})),
	equal: assertMethodHook((actual, expected, message = 'should be equal') => ({
		pass: actual === expected,
		actual,
		expected,
		message,
		operator: 'equal'
	})),
	notOk: assertMethodHook((val, message = 'should not be truthy') => ({
		pass: !val,
		expected: false,
		actual: val,
		message,
		operator: 'notOk'
	})),
	notDeepEqual: assertMethodHook((actual, expected, message = 'should not be equivalent') => ({
		pass: !deepEqual_1(actual, expected),
		actual,
		expected,
		message,
		operator: 'notDeepEqual'
	})),
	notEqual: assertMethodHook((actual, expected, message = 'should not be equal') => ({
		pass: actual !== expected,
		actual,
		expected,
		message,
		operator: 'notEqual'
	})),
	throws: assertMethodHook((func, expected, message) => {
		let caught;
		let pass;
		let actual;
		if (typeof expected === 'string') {
			[expected, message] = [message, expected];
		}
		try {
			func();
		} catch (err) {
			caught = { error: err };
		}
		pass = caught !== undefined;
		actual = caught && caught.error;
		if (expected instanceof RegExp) {
			pass = expected.test(actual) || expected.test(actual && actual.message);
			expected = String(expected);
		} else if (typeof expected === 'function' && caught) {
			pass = actual instanceof expected;
			actual = actual.constructor;
		}
		return {
			pass,
			expected,
			actual,
			operator: 'throws',
			message: message || 'should throw'
		};
	}),
	doesNotThrow: assertMethodHook((func, expected, message) => {
		let caught;
		if (typeof expected === 'string') {
			[expected, message] = [message, expected];
		}
		try {
			func();
		} catch (err) {
			caught = { error: err };
		}
		return {
			pass: caught === undefined,
			expected: 'no thrown error',
			actual: caught && caught.error,
			operator: 'doesNotThrow',
			message: message || 'should not throw'
		};
	}),
	fail: assertMethodHook((message = 'fail called') => ({
		pass: false,
		actual: 'fail called',
		expected: 'fail not called',
		message,
		operator: 'fail'
	}))
};

var assert = collect => Object.create(Assertion, { collect: { value: collect } });

const noop = () => {};

const skip = description => test('SKIPPED - ' + description, noop);

const Test = {
	async run() {
		const collect = assertion => this.items.push(assertion);
		const start = Date.now();
		await Promise.resolve(this.spec(assert(collect)));
		const executionTime = Date.now() - start;
		return Object.assign(this, {
			executionTime
		});
	},
	skip() {
		return skip(this.description);
	}
};

function test(description, spec, { only = false } = {}) {
	return Object.create(Test, {
		items: { value: [] },
		only: { value: only },
		spec: { value: spec },
		description: { value: description }
	});
}

const onNextTick = val => new Promise(resolve => setTimeout(() => resolve(val), 0));

const PlanProto = {
	[Symbol.iterator]() {
		return this.items[Symbol.iterator]();
	},
	test(description, spec, opts) {
		if (!spec && description.test) {
			// If it is a plan
			this.items.push(...description);
		} else {
			this.items.push(test(description, spec, opts));
		}
		return this;
	},
	only(description, spec) {
		return this.test(description, spec, { only: true });
	},
	skip(description, spec) {
		if (!spec && description.test) {
			// If it is a plan we skip the whole plan
			for (const t of description) {
				this.items.push(t.skip());
			}
		} else {
			this.items.push(skip(description));
		}
		return this;
	},
	async run(sink = tap()) {
		const sinkIterator = sink();
		sinkIterator.next();
		try {
			const hasOnly = this.items.some(t => t.only);
			const tests = hasOnly ? this.items.map(t => t.only ? t : t.skip()) : this.items;
			const runningTests = tests.map(t => t.run());
			/* eslint-disable no-await-in-loop */
			for (const r of runningTests) {
				const executedTest = await onNextTick(r); // Force to resolve on next tick so consumer can do something with previous iteration result (until async iterator are natively supported ...)
				sinkIterator.next(executedTest);
			}
			/* eslint-enable no-await-in-loop */
		} catch (err) {
			sinkIterator.throw(err);
		} finally {
			sinkIterator.return();
		}
	}
};

function factory() {
	return Object.create(PlanProto, {
		items: { value: [] }, length: {
			get() {
				return this.items.length;
			}
		}
	});
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

const noop$1 = () => {};

function* traverse(vnode) {
	yield vnode;
	if (vnode.children && vnode.children.length > 0) {
		for (const child of vnode.children) {
			yield* traverse(child);
		}
	}
}

var util = factory().test('should traverse a tree (going deep first)', t => {
  const tree = {
    id: 1,
    children: [{ id: 2, children: [{ id: 3 }, { id: 4 }] }, { id: 5, children: [{ id: 6 }] }, { id: 7 }]
  };

  const sequence = [...traverse(tree)].map(n => n.id);
  t.deepEqual(sequence, [1, 2, 3, 4, 5, 6, 7]);
}).test('pair key to value object of an object (aka Object.entries)', t => {
  const holder = { a: 1, b: 2, c: 3, d: 4 };
  const f = pairify(holder);
  const data = Object.keys(holder).map(f);
  t.deepEqual(data, [['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
}).test('shallow equality test on object', t => {
  const nested = { foo: 'bar' };
  const obj1 = { a: 1, b: '2', c: true, d: nested };
  t.ok(isShallowEqual(obj1, { a: 1, b: '2', c: true, d: nested }));
  t.notOk(isShallowEqual(obj1, {
    a: 1,
    b: '2',
    c: true,
    d: { foo: 'bar' }
  }), 'nested object should be checked by reference');
  t.notOk(isShallowEqual(obj1, { a: 1, b: 2, c: true, d: nested }), 'exact type checking on primitive');
  t.notOk(isShallowEqual(obj1, { a: 1, c: true, d: nested }), 'return false on missing properties');
  t.notOk(isShallowEqual({ a: 1, c: true, d: nested }, obj1), 'return false on missing properties (commmutative');
});

function compose(first, ...fns) {
  return (...args) => fns.reduce((previous, current) => current(previous), first(...args));
}

function curry(fn, arityLeft) {
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



function tap$1(fn) {
  return arg => {
    fn(arg);
    return arg;
  };
}

/* eslint-disable no-undef */
const SVG_NP = 'http://www.w3.org/2000/svg';

const updateDomNodeFactory = method => items => tap$1(domNode => {
	for (const pair of items) {
		domNode[method](...pair);
	}
});

const removeEventListeners = updateDomNodeFactory('removeEventListener');

const addEventListeners = updateDomNodeFactory('addEventListener');

const setAttributes = items => tap$1(domNode => {
	const attributes = items.filter(pair => typeof pair.value !== 'function');
	for (const [key, value] of attributes) {
		if (value === false) {
			domNode.removeAttribute(key);
		} else {
			domNode.setAttribute(key, value);
		}
	}
});

const removeAttributes = items => tap$1(domNode => {
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
	return parent.namespaceURI === SVG_NP ? document.createElementNS(SVG_NP, vnode.nodeType) : document.createElement(vnode.nodeType);
};

const getEventListeners = props => Object.keys(props).filter(k => k.substr(0, 2) === 'on').map(k => [k.substr(2).toLowerCase(), props[k]]);
/* eslint-enable no-undef */

const domProto = {

	removeAttribute(attr) {
		delete this[attr];
	},

	setAttribute(attr, val) {
		this[attr] = val;
	},

	addEventListener(event, handler) {
		this.handlers[event] = handler;
	},

	removeEventListener(event, handler) {
		delete this.handlers[event];
	}
};

const fakeDom = () => {
	const dom = Object.create(domProto);
	Object.defineProperty(dom, 'handlers', { value: {} });
	return dom;
};

const ownProps = obj => {
	const ownProperties = [];
	for (let prop in obj) {
		if (obj.hasOwnProperty(prop)) {
			ownProperties.push(prop);
		}
	}
	return ownProperties;
};

var domUtil = factory().test('set attributes', t => {
	const d = fakeDom();
	const update = setAttributes([['foo', 'bar'], ['blah', 2], ['woot', true]]);
	const n = update(d);
	t.equal(n, d, 'should have forwarded dom node');
	t.equal(d.foo, 'bar');
	t.equal(d.blah, 2);
	t.equal(d.woot, true);
	const props = ownProps(d);
	t.deepEqual(props, ['foo', 'blah', 'woot']);
	const handlers = ownProps(d.handlers);
	t.equal(handlers.length, 0);
}).test('remove attribute if value is false', t => {
	const d = fakeDom();
	d.foo = 'bar';
	t.deepEqual(ownProps(d), ['foo']);
	const update = setAttributes([['foo', false]]);
	const n = update(d);
	t.equal(n, d, 'should have forwarded dom node');
	t.equal(d.foo, undefined);
	t.equal(ownProps(d).length, 0);
	const handlers = ownProps(d.handlers);
	t.equal(handlers.length, 0);
}).test('remove attributes', t => {
	const d = fakeDom();
	d.foo = 'bar';
	d.woot = 2;
	d.bar = 'blah';
	t.deepEqual(ownProps(d), ['foo', 'woot', 'bar']);
	const update = removeAttributes(['foo', 'woot']);
	const n = update(d);
	t.equal(n, d, 'should have forwarded dom node');
	t.equal(d.bar, 'blah');
	t.equal(ownProps(d).length, 1);
	const handlers = ownProps(d.handlers);
	t.equal(handlers.length, 0);
}).test('add event listeners', t => {
	const d = fakeDom();
	const update = addEventListeners([['click', noop$1], ['input', noop$1]]);
	const n = update(d);
	t.equal(n, d, 'should have forwarded the node');
	t.equal(ownProps(d).length, 0);
	t.deepEqual(ownProps(d.handlers), ['click', 'input']);
	t.equal(d.handlers.click, noop$1);
	t.equal(d.handlers.input, noop$1);
}).test('remove event listeners', t => {
	const d = fakeDom();
	d.handlers.click = noop$1;
	d.handlers.input = noop$1;
	const update = removeEventListeners([['click', noop$1]]);
	const n = update(d);
	t.equal(n, d, 'should have forwarded the node');
	t.deepEqual(ownProps(d.handlers), ['input']);
	t.equal(d.handlers.input, noop$1);
}).test('set text node value', function* (t) {
	const node = {};
	const update = setTextNode('foo');
	update(node);
	t.equal(node.textContent, 'foo');
}).test('get event Listeners from props object', t => {
	const props = {
		onClick: () => {},
		input: () => {},
		onMousedown: () => {}
	};

	const events = getEventListeners(props);
	t.deepEqual(events, [['click', props.onClick], ['mousedown', props.onMousedown]]);
});

const createTextVNode = value => ({
	nodeType: 'Text',
	children: [],
	props: { value },
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

	if (typeof nodeType !== 'function') {
		// Regular html/text node
		return {
			nodeType,
			props,
			children: normalizedChildren,
			lifeCycle: 0
		};
	}

	const fullProps = Object.assign({ children: normalizedChildren }, props);
	const comp = nodeType(fullProps);
	const compType = typeof comp;
	/* eslint-disable no-negated-condition */
	return compType !== 'function' ? comp : h(comp, props, ...normalizedChildren); // Functional comp vs combinator (HOC)
	/* eslint-enable no-negated-condition */
}

const updateEventListeners = ({ props: newNodeProps } = {}, { props: oldNodeProps } = {}) => {
	const newNodeEvents = getEventListeners(newNodeProps || {});
	const oldNodeEvents = getEventListeners(oldNodeProps || {});

	return newNodeEvents.length || oldNodeEvents.length ? compose(removeEventListeners(oldNodeEvents), addEventListeners(newNodeEvents)) : noop$1;
};

const updateAttributes = (newVNode, oldVNode) => {
	const newVNodeProps = newVNode.props || {};
	const oldVNodeProps = oldVNode.props || {};

	if (isShallowEqual(newVNodeProps, oldVNodeProps)) {
		return noop$1;
	}

	if (newVNode.nodeType === 'Text') {
		return setTextNode(newVNode.props.value);
	}

	const newNodeKeys = Object.keys(newVNodeProps);
	const oldNodeKeys = Object.keys(oldVNodeProps);
	const attributesToRemove = oldNodeKeys.filter(k => !newNodeKeys.includes(k));

	return compose(removeAttributes(attributesToRemove), setAttributes(newNodeKeys.map(pairify(newVNodeProps))));
};

const domFactory = createDomNode;

// Apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
const domify = (oldVnode, newVnode, parentDomNode) => {
	if (!oldVnode && newVnode) {
		// There is no previous vnode
		newVnode.dom = parentDomNode.appendChild(domFactory(newVnode, parentDomNode));
		newVnode.lifeCycle = 1;
		return { vnode: newVnode, garbage: null };
	}

	// There is a previous vnode
	if (!newVnode) {
		// We must remove the related dom node
		parentDomNode.removeChild(oldVnode.dom);
		return { garbage: oldVnode, dom: null };
	} else if (newVnode.nodeType !== oldVnode.nodeType) {
		// It must be replaced
		newVnode.dom = domFactory(newVnode, parentDomNode);
		newVnode.lifeCycle = 1;
		parentDomNode.replaceChild(newVnode.dom, oldVnode.dom);
		return { garbage: oldVnode, vnode: newVnode };
	}

	// Only update attributes
	newVnode.dom = oldVnode.dom;
	// Pass the unMountHook
	if (oldVnode.onUnMount) {
		newVnode.onUnMount = oldVnode.onUnMount;
	}
	newVnode.lifeCycle = oldVnode.lifeCycle + 1;
	return { garbage: null, vnode: newVnode };
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
	const { vnode, garbage } = domify(oldVnode, newVnode, parentDomNode);

	if (garbage !== null) {
		// Defer unmount lifecycle as it is not "visual"
		for (const g of traverse(garbage)) {
			if (g.onUnMount) {
				onNextTick.push(g.onUnMount);
			}
		}
	}

	// Normalisation of old node (in case of a replace we will consider old node as empty node (no children, no props))
	const tempOldNode = garbage !== null || !oldVnode ? { length: 0, children: [], props: {} } : oldVnode;

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
		if (setListeners !== noop$1) {
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
var update = ((comp, initialVNode) => {
	let oldNode = initialVNode;
	return (props, ...args) => {
		const mount$$1 = oldNode.dom.parentNode;
		const newNode = comp(Object.assign({ children: oldNode.children || [] }, oldNode.props, props), ...args);
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
});

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
var withState = (comp => () => {
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
});

const defaultUpdate = (a, b) => isDeepEqual(a, b) === false;

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change under specific circumstances
 * @param store {Object} - The store (implementing the same api than Redux store
 * @param sliceState {Function} [state => state] - A function which takes as argument the state and return a "transformed" state (like partial, etc) relevant to the container
 * @returns {Function} - A container factory with the following arguments:
 *  - mapStateToProp: a function which takes as argument what the "sliceState" function returns and returns an object to be blended into the properties of the component (default to identity function)
 *  - shouldUpdate: a function which takes as arguments the previous and the current versions of what "sliceState" function returns to returns a boolean defining whether the component should be updated (default to a deepEqual check)
 */
var connect = ((store, sliceState = identity) => (comp, mapStateToProp = identity, shouldUpate = defaultUpdate) => initProp => {
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
});

var h$1 = factory().test('create regular html node', t => {
	const vnode = h('div', { id: 'someId', 'class': 'special' });
	t.deepEqual(vnode, { lifeCycle: 0, nodeType: 'div', props: { id: 'someId', 'class': 'special' }, children: [] });
}).test('normalize text node', t => {
	const vnode = h('div', { id: 'someId', 'class': 'special' }, 'foo', 'bar');
	t.deepEqual(vnode, {
		nodeType: 'div',
		props: { id: 'someId', class: 'special' },
		children: [{ nodeType: 'Text', children: [], props: { 'value': 'foobar' }, lifeCycle: 0 }],
		lifeCycle: 0
	});
}).test('create regular html node with text node children', t => {
	const vnode = h('div', { id: 'someId', 'class': 'special' }, 'foo');
	t.deepEqual(vnode, {
		nodeType: 'div', lifeCycle: 0, props: { id: 'someId', 'class': 'special' }, children: [{
			nodeType: 'Text',
			children: [],
			props: { value: 'foo' },
			lifeCycle: 0
		}]
	});
}).test('create regular html with children', t => {
	const vnode = h('ul', { id: 'collection' }, h('li', { id: 1 }, 'item1'), h('li', { id: 2 }, 'item2'));
	t.deepEqual(vnode, {
		nodeType: 'ul',
		props: { id: 'collection' },
		lifeCycle: 0,
		children: [{
			nodeType: 'li',
			props: { id: 1 },
			lifeCycle: 0,
			children: [{
				nodeType: 'Text',
				props: { value: 'item1' },
				children: [],
				lifeCycle: 0
			}]
		}, {
			nodeType: 'li',
			props: { id: 2 },
			lifeCycle: 0,
			children: [{
				nodeType: 'Text',
				props: { value: 'item2' },
				children: [],
				lifeCycle: 0
			}]
		}]
	});
}).test('use function as component passing the children as prop', t => {
	const foo = props => h('p', props);
	const vnode = h(foo, { id: 1 }, 'hello world');
	t.deepEqual(vnode, {
		nodeType: 'p',
		lifeCycle: 0,
		props: {
			children: [{
				nodeType: 'Text',
				lifeCycle: 0,
				children: [],
				props: { value: 'hello world' }
			}],
			id: 1
		},
		children: []
	});
}).test('use nested combinator to create vnode', t => {
	const combinator = () => () => () => () => props => h('p', { id: 'foo' });
	const vnode = h(combinator, {});
	t.deepEqual(vnode, { nodeType: 'p', lifeCycle: 0, props: { id: 'foo' }, children: [] });
});

const waitNextTick = () => new Promise(function (resolve) {
	setTimeout(function () {
		resolve();
	}, 2);
});

var lifecycles = factory().test('should run a function when component is mounted', async t => {
	let counter = 0;
	const container = document.createElement('div');
	const comp = () => h(
		'p',
		null,
		'hello world'
	);
	const withMount = onMount(() => {
		counter++;
	}, comp);
	mount(withMount, {}, container);
	t.equal(counter, 0);
	await waitNextTick();
	t.equal(counter, 1);
}).test('should compose the mount function when there are many', async t => {
	let counter = 0;
	const container = document.createElement('div');
	const comp = () => h(
		'p',
		null,
		'hello world'
	);
	const withMount = onMount(() => {
		counter++;
	}, comp);
	const Combined = onMount(() => {
		counter = counter * 10;
	}, withMount);
	mount(Combined, {}, container);
	t.equal(counter, 0);
	await waitNextTick();
	t.equal(counter, 10);
}).test('should run a function when component is unMounted', t => {
	let unmounted = null;
	const container = document.createElement('div');
	const Item = onUnMount(n => {
		unmounted = n;
	}, ({ id }) => h(
		'li',
		{ id: id },
		'hello world'
	));
	const containerComp = ({ items }) => h(
		'ul',
		null,
		items.map(item => h(Item, item))
	);

	const vnode = mount(containerComp, { items: [{ id: 1 }, { id: 2 }, { id: 3 }] }, container);
	t.equal(container.innerHTML, '<ul><li id="1">hello world</li><li id="2">hello world</li><li id="3">hello world</li></ul>');
	const batch = render(vnode, containerComp({ items: [{ id: 1 }, { id: 3 }] }), container);
	t.equal(container.innerHTML, '<ul><li id="1">hello world</li><li id="3">hello world</li></ul>');
	for (let f of batch) {
		f();
	}
	t.notEqual(unmounted, null);
});

var render$1 = factory().test('mount a simple component', t => {
	const container = document.createElement('div');
	const Comp = props => h(
		'h1',
		null,
		h(
			'span',
			{ id: props.id },
			props.greeting
		)
	);
	mount(Comp, { id: 123, greeting: 'hello world' }, container);
	t.equal(container.innerHTML, '<h1><span id="123">hello world</span></h1>');
}).test('mount composed component', t => {
	const container = document.createElement('div');
	const Comp = props => h(
		'h1',
		null,
		h(
			'span',
			{ id: props.id },
			props.greeting
		)
	);
	const Container = props => h(
		'section',
		null,
		h(Comp, { id: '567', greeting: 'hello you' })
	);
	mount(Container, {}, container);
	t.equal(container.innerHTML, '<section><h1><span id="567">hello you</span></h1></section>');
}).test('mount a component with inner child', t => {
	const container = document.createElement('div');
	const Comp = props => h(
		'h1',
		null,
		h(
			'span',
			{ id: props.id },
			props.greeting
		)
	);
	const Container = props => h(
		'section',
		null,
		props.children
	);
	mount(() => h(
		Container,
		null,
		h(Comp, { id: '567', greeting: 'hello world' })
	), {}, container);
	t.equal(container.innerHTML, '<section><h1><span id="567">hello world</span></h1></section>');
});

var update$1 = factory().test('give ability to update a node (and its descendant)', t => {
	const container = document.createElement('div');
	const comp = ({ id, content }) => h(
		'p',
		{ id: id },
		content
	);
	const initialVnode = mount(comp, { id: 123, content: 'hello world' }, container);
	t.equal(container.innerHTML, '<p id="123">hello world</p>');
	const updateFunc = update(comp, initialVnode);
	updateFunc({ id: 567, content: 'bonjour monde' });
	t.equal(container.innerHTML, '<p id="567">bonjour monde</p>');
});

var withState$1 = factory().test('bind an update function to a component', async t => {
  let update$$1 = null;
  const Comp = withState(({ foo }, setState) => {
    if (!update$$1) {
      update$$1 = setState;
    }
    return h(
      'p',
      null,
      foo
    );
  });
  const container = document.createElement('div');
  mount(({ foo }) => h(Comp, { foo: foo }), { foo: 'bar' }, container);
  t.equal(container.innerHTML, '<p>bar</p>');
  await waitNextTick();
  update$$1({ foo: 'bis' });
  t.equal(container.innerHTML, '<p>bis</p>');
}).test('should create isolated state for each component', async t => {
  let update1 = null;
  let update2 = null;
  const Comp = withState(({ foo }, setState) => {
    if (!update1) {
      update1 = setState;
    } else if (!update2) {
      update2 = setState;
    }

    return h(
      'p',
      null,
      foo
    );
  });
  const container = document.createElement('div');
  mount(({ foo1, foo2 }) => h(
    'div',
    null,
    h(Comp, { foo: foo1 }),
    h(Comp, { foo: foo2 })
  ), { foo1: 'bar', foo2: 'bar2' }, container);
  t.equal(container.innerHTML, '<div><p>bar</p><p>bar2</p></div>');
  await waitNextTick();
  update1({ foo: 'bis' });
  t.equal(container.innerHTML, '<div><p>bis</p><p>bar2</p></div>');
  update2({ foo: 'blah' });
  t.equal(container.innerHTML, '<div><p>bis</p><p>blah</p></div>');
});

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Built-in value references. */
var Symbol$1 = root.Symbol;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

/** Used for built-in method references. */
var objectProto$1 = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString$1 = objectProto$1.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString$1.call(value);
}

/** `Object#toString` result references. */
var nullTag = '[object Null]';
var undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag$1 = Symbol$1 ? Symbol$1.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return symToStringTag$1 && symToStringTag$1 in Object(value) ? getRawTag(value) : objectToString(value);
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function (arg) {
    return func(transform(arg));
  };
}

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var funcProto = Function.prototype;
var objectProto$2 = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty$1 = objectProto$2.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty$1.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
}

function symbolObservablePonyfill(root) {
	var result;
	var Symbol = root.Symbol;

	if (typeof Symbol === 'function') {
		if (Symbol.observable) {
			result = Symbol.observable;
		} else {
			result = Symbol('observable');
			Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
}

/* global window */
var root$2;

if (typeof self !== 'undefined') {
  root$2 = self;
} else if (typeof window !== 'undefined') {
  root$2 = window;
} else if (typeof global !== 'undefined') {
  root$2 = global;
} else if (typeof module !== 'undefined') {
  root$2 = module;
} else {
  root$2 = Function('return this')();
}

var result = symbolObservablePonyfill(root$2);

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var ActionTypes = {
  INIT: '@@redux/INIT'

  /**
   * Creates a Redux store that holds the state tree.
   * The only way to change the data in the store is to call `dispatch()` on it.
   *
   * There should only be a single store in your app. To specify how different
   * parts of the state tree respond to actions, you may combine several reducers
   * into a single reducer function by using `combineReducers`.
   *
   * @param {Function} reducer A function that returns the next state tree, given
   * the current state tree and the action to handle.
   *
   * @param {any} [preloadedState] The initial state. You may optionally specify it
   * to hydrate the state from the server in universal apps, or to restore a
   * previously serialized user session.
   * If you use `combineReducers` to produce the root reducer function, this must be
   * an object with the same shape as `combineReducers` keys.
   *
   * @param {Function} [enhancer] The store enhancer. You may optionally specify it
   * to enhance the store with third-party capabilities such as middleware,
   * time travel, persistence, etc. The only store enhancer that ships with Redux
   * is `applyMiddleware()`.
   *
   * @returns {Store} A Redux store that lets you read the state, dispatch actions
   * and subscribe to changes.
   */
};function createStore(reducer, preloadedState, enhancer) {
  var _ref2;

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.');
    }

    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.');
  }

  var currentReducer = reducer;
  var currentState = preloadedState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return currentState;
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.');
    }

    var isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
    }

    if (typeof action.type === 'undefined') {
      throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant?');
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = currentListeners = nextListeners;
    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      listener();
    }

    return action;
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.');
    }

    currentReducer = nextReducer;
    dispatch({ type: ActionTypes.INIT });
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */
  function observable() {
    var _ref;

    var outerSubscribe = subscribe;
    return _ref = {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe: function subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.');
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState());
          }
        }

        observeState();
        var unsubscribe = outerSubscribe(observeState);
        return { unsubscribe: unsubscribe };
      }
    }, _ref[result] = function () {
      return this;
    }, _ref;
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT });

  return _ref2 = {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  }, _ref2[result] = observable, _ref2;
}

/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
  /* eslint-enable no-console */
  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message);
    /* eslint-disable no-empty */
  } catch (e) {}
  /* eslint-enable no-empty */
}

/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

/*
* This is a dummy function to check if the function name has been altered by minification.
* If the function has been minified and NODE_ENV !== 'production', warn the user.
*/
function isCrushed() {}

if ("dev" !== 'production' && typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
  warning('You are currently using minified code outside of NODE_ENV === \'production\'. ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or DefinePlugin for webpack (http://stackoverflow.com/questions/30030031) ' + 'to ensure you have the correct code for your production build.');
}

var connect$1 = factory().test('should connect a component to changes of redux state', async t => {
  const store = createStore((state, action) => ({ value: action.value }));
  const Comp = connect(store)(props => {
    return h(
      'span',
      null,
      props.value
    );
  });
  const container = document.createElement('div');
  mount(h(Comp, null), {}, container);
  await waitNextTick();
  store.dispatch({ type: 'whatever', value: 'blah' });
  t.equal(container.innerHTML, '<span>blah</span>');
  store.dispatch({ type: 'whatever', value: 'woot' });
  t.equal(container.innerHTML, '<span>woot</span>');
}).test('should connect a component to changes of a slice of a redux state', async t => {
  const store = createStore((state = { woot: { value: 'foo' }, other: { valueBis: 'blah' } }, action) => {
    const { type } = action;
    switch (type) {
      case 'WOOT':
        return Object.assign({}, { woot: { value: action.value } });
      case 'NOT_WOOT':
        return Object.assign({}, { other: { valueBis: 'another_one' } });
      default:
        return state;
    }
  });
  const Comp = connect(store, state => state.woot)(props => {
    return h(
      'span',
      null,
      props.value
    );
  });
  const container = document.createElement('div');
  mount(h(Comp, null), {}, container);
  await waitNextTick();
  store.dispatch({ type: 'whatever', value: 'blah' });
  t.equal(container.innerHTML, '<span>foo</span>');
  store.dispatch({ type: 'NOT_WOOT', value: 'blah' });
  t.equal(container.innerHTML, '<span>foo</span>');
  store.dispatch({ type: 'WOOT', value: 'bip' });
  t.equal(container.innerHTML, '<span>bip</span>');
}).test('should give a condition to update a connected component', async t => {
  const store = createStore((state, action) => ({ value: action.value }));
  const Comp = connect(store)(props => {
    return h(
      'span',
      null,
      props.value
    );
  }, state => state, (oldState = { value: 'a' }, newState = {}) => {
    return newState.value > oldState.value;
  });
  const container = document.createElement('div');
  mount(h(Comp, null), {}, container);
  await waitNextTick();
  store.dispatch({ type: 'whatever', value: 'blah' });
  t.equal(container.innerHTML, '<span>blah</span>');
  store.dispatch({ type: 'whatever', value: 'aaa' });
  t.equal(container.innerHTML, '<span>blah</span>');
  store.dispatch({ type: 'whatever', value: 'zzz' });
  t.equal(container.innerHTML, '<span>zzz</span>');
});

var index = factory().test(util).test(domUtil).test(h$1).test(lifecycles).test(render$1).test(update$1).test(withState$1).test(connect$1).run();

return index;

}());
//# sourceMappingURL=bundle.js.map
