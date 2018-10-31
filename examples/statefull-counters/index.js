import { mount, h, withState, withIdempotentState } from '../../dist/src';
const CounterView = ({ value = 0, increment, decrement }) => {
    return h("div", null,
        h("p", null,
            "The value is ",
            value),
        h("button", { onclick: increment }, "Increment"),
        h("button", { onclick: decrement }, "Decrement"));
};
// @ts-ignore
const Counter = withIdempotentState(({ value = 0 }, update) => {
    const increment = () => {
        console.log('foo');
        update({ value: value + 1 });
    };
    const decrement = () => {
        console.log('bar');
        update({ value: value - 1 });
    };
    return h(CounterView, { value: value, increment: increment, decrement: decrement });
});
const ContainerView = ({ onclick }) => {
    return h("div", null,
        "// @ts-ignore",
        h(Counter, { key: 1, value: 0 })
    // @ts-ignore
    ,
        "// @ts-ignore",
        h(Counter, { key: 2, value: 10 }),
        h("button", { onclick: onclick }, "Evil update"));
};
// @ts-ignore
const Container = withState((props, update) => {
    // @ts-ignore
    const onclick = () => update({});
    // @ts-ignore
    return h(ContainerView, Object.assign({ onclick: onclick }, props));
});
const fragment1 = document.createDocumentFragment();
const fragment2 = document.createDocumentFragment();
const main = document.getElementById('main');
// @ts-ignore
mount(h(Container, null), {}, main);
// mount(<Counter value={10} />, {}, fragment2);
// main.appendChild(fragment1);
// main.appendChild(fragment2);
