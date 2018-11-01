import { h, mount, onMount, onUnMount, onUpdate, update } from '../../dist/src';
import { compose } from 'smart-table-operators';
const updateEverySecond = (comp) => (intialValues) => {
    let updateFunc;
    const timer = setInterval(() => {
        const newState = Object.assign({}, intialValues, { timestamp: Date.now() });
        updateFunc(newState);
    }, 1000);
    const setUpdateFunction = (vnode) => {
        updateFunc = update(comp, vnode);
    };
    const clean = () => {
        clearInterval(timer);
    };
    return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction), onUnMount(clean))(comp);
};
const ClockView = ({ eventTime, label, timestamp }) => {
    const secondEllapsed = Math.trunc((timestamp - eventTime) / 1000);
    return h("p", null,
        "Since ",
        h("strong", null, label),
        ", ",
        h("em", null, secondEllapsed),
        " seconds have passed !");
};
const Clock = updateEverySecond(ClockView);
const App = () => h("div", null,
    h(Clock, { label: "my birth", eventTime: (new Date(1987, 4, 21)).getTime(), timestamp: Date.now() }),
    h(Clock, { label: "my mother's birth", eventTime: (new Date(1958, 7, 27)).getTime(), timestamp: Date.now() }));
mount(h(App, null), {}, document.getElementById('main'));
