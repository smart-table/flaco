import { h, update, onMount, mount } from '../../dist/src';
const actions = {
    down: value => state => ({ count: state.count - value }),
    up: value => state => ({ count: state.count + value })
};
const withStore = (actions, initialState) => (component) => {
    let updateFunc;
    let state = Object.assign({}, initialState);
    const actioners = {};
    for (const [key, method] of Object.entries(actions)) {
        actioners[key] = (...args) => {
            state = method(...args)(state);
            updateFunc(Object.assign({}, state));
        };
    }
    const wrapperComp = (props) => component(Object.assign(props, state), actioners);
    const setUpdateFunction = (vnode) => {
        updateFunc = update(wrapperComp, vnode);
    };
    return onMount(setUpdateFunction, wrapperComp);
};
const withCounterStore = withStore(actions, {
    count: 0
});
const CounterView = (props) => {
    const { value, increment, decrement } = props;
    return h("div", null,
        h("p", null,
            "The current value is ",
            h("strong", null, value)),
        h("button", { onclick: () => increment(1) }, "Increment"),
        h("button", { onclick: () => decrement(1) }, "Decrement"));
};
const App = withCounterStore((state, actions) => {
    const increment = actions.up;
    const decrement = actions.down;
    return h(CounterView, { value: state.count, increment: increment, decrement: decrement });
});
const main = document.getElementById('main');
mount(h(App, null), {}, main);
