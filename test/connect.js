import test from 'zora';
import {h, connect, mount} from '../index';
import {createStore} from 'redux';
import {waitNextTick} from './test-util';

test('should connect a component to changes of redux state', async t => {
	const store = createStore((state, action) => ({value: action.value}));
	const Comp = connect(store)(props => {
		return <span>{props.value}</span>
	});
	const container = document.createElement('div');
	mount(<Comp/>, {}, container);
	await waitNextTick();
	store.dispatch({type: 'whatever', value: 'blah'});
	t.equal(container.innerHTML, '<span>blah</span>');
	store.dispatch({type: 'whatever', value: 'woot'});
	t.equal(container.innerHTML, '<span>woot</span>');
});
test('should connect a component to changes of a slice of a redux state', async t => {
	const store = createStore((state = {woot: {value: 'foo'}, other: {valueBis: 'blah'}}, action) => {
		const {type} = action;
		switch (type) {
			case 'WOOT':
				return Object.assign({}, {woot: {value: action.value}});
			case 'NOT_WOOT':
				return Object.assign({}, {other: {valueBis: 'another_one'}});
			default:
				return state;
		}
	});
	const Comp = connect(store, state => state.woot)(props => {
		return <span>{props.value}</span>
	});
	const container = document.createElement('div');
	mount(<Comp/>, {}, container);
	await waitNextTick();
	store.dispatch({type: 'whatever', value: 'blah'});
	t.equal(container.innerHTML, '<span>foo</span>');
	store.dispatch({type: 'NOT_WOOT', value: 'blah'});
	t.equal(container.innerHTML, '<span>foo</span>');
	store.dispatch({type: 'WOOT', value: 'bip'});
	t.equal(container.innerHTML, '<span>bip</span>');
});
test('should give a condition to update a connected component', async t => {
	const store = createStore((state, action) => ({value: action.value}));
	const Comp = connect(store)(props => {
		return <span>{props.value}</span>
	}, state => state, (oldState = {value: 'a'}, newState = {}) => {
		return newState.value > oldState.value;
	});
	const container = document.createElement('div');
	mount(<Comp/>, {}, container);
	await waitNextTick();
	store.dispatch({type: 'whatever', value: 'blah'});
	t.equal(container.innerHTML, '<span>blah</span>');
	store.dispatch({type: 'whatever', value: 'aaa'});
	t.equal(container.innerHTML, '<span>blah</span>');
	store.dispatch({type: 'whatever', value: 'zzz'});
	t.equal(container.innerHTML, '<span>zzz</span>');
});
