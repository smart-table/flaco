import {ComponentFunction, h, update, onMount, mount, VNode} from '../../dist/src';

interface CounterState {
    count: number
}

interface CounterActions {
    down: Function
    up: Function
}

const actions = {
    down: value => state => ({count: state.count - value}),
    up: value => state => ({count: state.count + value})
};

const withStore = <T, K>(actions: T, initialState: K) => (component: ComponentFunction) => {
    let updateFunc;
    let state: K = Object.assign({}, initialState);

    const actioners = {};

    for (const [key, method] of Object.entries(actions)) {
        actioners[key] = (...args) => {
            state = method(...args)(state);
            updateFunc(Object.assign({}, state));
        };
    }

    const wrapperComp: ComponentFunction = (props) => component(Object.assign(props, state), actioners);

    const setUpdateFunction = (vnode: VNode) => {
        updateFunc = update(wrapperComp, vnode);
    };

    return onMount(setUpdateFunction, wrapperComp);
};

const withCounterStore = withStore<CounterActions, CounterState>(actions, {
    count: 0
});

interface CounterInput {
    value: number;
    increment: Function;
    decrement: Function;
}

const CounterView = (props: CounterInput) => {
    const {value, increment, decrement} = props;
    return <div>
        <p>The current value is <strong>{value}</strong></p>
        <button onclick={() => increment(1)}>Increment</button>
        <button onclick={() => decrement(1)}>Decrement</button>
    </div>;
};

const App = withCounterStore((state: CounterState, actions) => {
    const increment = actions.up;
    const decrement = actions.down;
    return <CounterView value={state.count} increment={increment} decrement={decrement}/>;
});

const main = document.getElementById('main');

mount(<App/>, {}, main);

