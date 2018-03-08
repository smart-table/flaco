import {
	setAttributes,
	removeAttributes,
	addEventListeners,
	removeEventListeners,
	setTextNode,
	getEventListeners
} from '../lib/dom-util';
import {noop} from '../lib/util';
import test from 'zora';

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
	Object.defineProperty(dom, 'handlers', {value: {}});
	return dom;
};

const ownProps = (obj) => {
	const ownProperties = [];
	for (let prop in obj) {
		if (obj.hasOwnProperty(prop)) {
			ownProperties.push(prop);
		}
	}
	return ownProperties;
};

test('set attributes', t => {
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
});
test('remove attribute if value is false', t => {
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
});
test('remove attributes', t => {
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
});
test('add event listeners', t => {
	const d = fakeDom();
	const update = addEventListeners([['click', noop
	], ['input', noop]]);
	const n = update(d);
	t.equal(n, d, 'should have forwarded the node');
	t.equal(ownProps(d).length, 0);
	t.deepEqual(ownProps(d.handlers), ['click', 'input']);
	t.equal(d.handlers.click, noop);
	t.equal(d.handlers.input, noop);
});
test('remove event listeners', t => {
	const d = fakeDom();
	d.handlers.click = noop;
	d.handlers.input = noop;
	const update = removeEventListeners([['click', noop
	]]);
	const n = update(d);
	t.equal(n, d, 'should have forwarded the node');
	t.deepEqual(ownProps(d.handlers), ['input']);
	t.equal(d.handlers.input, noop);
});
test('set text node value', function * (t) {
	const node = {};
	const update = setTextNode('foo');
	update(node);
	t.equal(node.textContent, 'foo');
});
test('get event Listeners from props object', t => {
	const props = {
		onClick: () => {
		},
		input: () => {
		},
		onMousedown: () => {
		}
	};

	const events = getEventListeners(props);
	t.deepEqual(events, [
		['click', props.onClick],
		['mousedown', props.onMousedown],
	]);
});