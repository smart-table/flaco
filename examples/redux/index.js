import {h, mount, connect} from '../../index';
import {createStore} from 'redux';

const reducer = (state = {}, action) => {
  const {firstCounter = 0, secondCounter = 0} = state;
  switch (action.type) {
    case 'INCREMENT_1':
      return Object.assign(state, {firstCounter: firstCounter + 1});
    case 'DECREMENT_1':
      return Object.assign(state, {firstCounter: firstCounter - 1});
    case 'INCREMENT_2':
      return Object.assign(state, {secondCounter: secondCounter + 1});
    case 'DECREMENT_2':
      return Object.assign(state, {secondCounter: secondCounter - 1});
    default:
      return state;
  }
};

const store = createStore(reducer);

const subscribeToFirstCounter = connect(store, {
  increment: () => store.dispatch({type: 'INCREMENT_1'}),
  decrement: () => store.dispatch({type: 'DECREMENT_1'})
}, state => state.firstCounter);
const subscribeToSecondCounter = connect(store, {
  increment: () => store.dispatch({type: 'INCREMENT_2'}),
  decrement: () => store.dispatch({type: 'DECREMENT_2'})
}, state => state.secondCounter);

const counter = ({count, label}, actions) => {

  const bingo = count % 2 === 0;

  return <div bingo={bingo}>
    <span>Count: {count}</span>
    <button onClick={actions.increment}>increment {label}</button>
    <button onClick={actions.decrement}>decrement {label}</button>
  </div>
};

const JustReader = ({readVal}) => <p>
  I do read the count : {readVal}
</p>;

const Counter1 = subscribeToFirstCounter(counter, state => ({count: state}));
const Counter2 = subscribeToSecondCounter(counter, state => ({count: state}));
const Reader1 = subscribeToFirstCounter(JustReader, state => ({readVal: state}));

const App = () => <div>
  <Counter1 label="Un: woot"/>
  <Counter1 label="Another uno !!"/>
  <Counter2 label="Dos: han"/>
  <Reader1/>
</div>;

mount(App, {}, document.getElementById('main'));