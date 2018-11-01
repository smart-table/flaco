import { mount, h, withState, withIdempotentState } from '../../dist/src';
// Pure and stateless view component
const CounterView = ({ value = 0, increment, decrement }) => {
    return h("div", null,
        h("p", null,
            "The value is ",
            value),
        h("button", { onclick: increment }, "Increment"),
        h("button", { onclick: decrement }, "Decrement"));
};
// Statefull and Connected Component
const UpdatableCounter = ({ value = 0 }, update) => {
    const increment = () => {
        update({ value: value + 1 });
    };
    const decrement = () => {
        update({ value: value - 1 });
    };
    return h(CounterView, { value: value, increment: increment, decrement: decrement });
};
const IdempotentCounter = withIdempotentState(UpdatableCounter);
const StatefullCounter = withState(UpdatableCounter);
// Statefull counters
const StatefullContainerView = ({ onclick }) => {
    return h("section", null,
        h("h1", null, "Statefull counters"),
        h("p", null, "The counters manage their own state. It means when one is incremented or decremented, only that one gets updated."),
        h("p", null, "However if you update the container (by clicking the evil update). The container will recreate its counters and the counters will be fresh new instances"),
        h(StatefullCounter, { value: 0 }),
        h(StatefullCounter, { value: 10 }),
        h("button", { onclick: onclick }, "Evil update"));
};
const StatefullContainer = withState((props, update) => {
    const onclick = () => update({});
    return h(StatefullContainerView, Object.assign({ onclick: onclick }, props));
});
// Application with Idempotent counters
const IdempotentContainerView = ({ onclick }) => {
    return h("section", null,
        h("h1", null, "Idempotent counters"),
        h("p", null,
            "It has ",
            h("em", null, "idempotent counters"),
            ". It means that even if the container is updated, the old instances of the counters are kept and values are not reset"),
        h(IdempotentCounter, { key: 1, value: 0 }),
        h(IdempotentCounter, { key: 2, value: 10 }),
        h("button", { onclick: onclick }, "Evil update"));
};
// @ts-ignore
const IdempotentContainer = withState((props, update) => {
    const onclick = () => update({});
    return h(IdempotentContainerView, Object.assign({ onclick: onclick }, props));
});
const main = document.getElementById('main');
const fragment1 = document.createDocumentFragment();
const fragment2 = document.createDocumentFragment();
mount(h(StatefullContainer, null), {}, fragment1);
mount(h(IdempotentContainer, null), {}, fragment2);
main.appendChild(fragment1);
main.appendChild(fragment2);
