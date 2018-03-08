import test from 'zora';
import {h} from '../index';

test('create regular html node', t => {
	const vnode = h('div', {id: 'someId', 'class': 'special'});
	t.deepEqual(vnode, {lifeCycle: 0, nodeType: 'div', props: {id: 'someId', 'class': 'special'}, children: []});
});
test('normalize text node', t => {
	const vnode = h('div', {id: 'someId', 'class': 'special'}, 'foo', 'bar');
	t.deepEqual(vnode, {
		nodeType: 'div',
		props: {id: 'someId', class: 'special'},
		children: [{nodeType: 'Text', children: [], props: {'value': 'foobar'}, lifeCycle: 0}],
		lifeCycle: 0
	});
});
test('create regular html node with text node children', t => {
	const vnode = h('div', {id: 'someId', 'class': 'special'}, 'foo');
	t.deepEqual(vnode, {
		nodeType: 'div', lifeCycle: 0, props: {id: 'someId', 'class': 'special'}, children: [{
			nodeType: 'Text',
			children: [],
			props: {value: 'foo'},
			lifeCycle: 0
		}]
	});
});
test('create regular html with children', t => {
	const vnode = h('ul', {id: 'collection'}, h('li', {id: 1}, 'item1'), h('li', {id: 2}, 'item2'));
	t.deepEqual(vnode, {
		nodeType: 'ul',
		props: {id: 'collection'},
		lifeCycle: 0,
		children: [
			{
				nodeType: 'li',
				props: {id: 1},
				lifeCycle: 0,
				children: [{
					nodeType: 'Text',
					props: {value: 'item1'},
					children: [],
					lifeCycle: 0
				}]
			}, {
				nodeType: 'li',
				props: {id: 2},
				lifeCycle: 0,
				children: [{
					nodeType: 'Text',
					props: {value: 'item2'},
					children: [],
					lifeCycle: 0
				}]
			}
		]
	});
});
test('use function as component passing the children as prop', t => {
	const foo = (props) => h('p', props);
	const vnode = h(foo, {id: 1}, 'hello world');
	t.deepEqual(vnode, {
		nodeType: 'p',
		lifeCycle: 0,
		props: {
			children: [{
				nodeType: 'Text',
				lifeCycle: 0,
				children: [],
				props: {value: 'hello world'}
			}],
			id: 1
		},
		children: []
	});
});
test('use nested combinator to create vnode', t => {
	const combinator = () => () => () => () => (props) => h('p', {id: 'foo'});
	const vnode = h(combinator, {});
	t.deepEqual(vnode, {nodeType: 'p', lifeCycle: 0, props: {id: 'foo'}, children: []});
});
