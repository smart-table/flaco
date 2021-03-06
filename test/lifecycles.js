import test from 'zora';
import { onMount, onUnMount, h, mount, render } from '../dist/src';
import { waitNextTick } from './test-util';
test('should run a function when component is mounted', async (t) => {
    let counter = 0;
    const container = document.createElement('div');
    const comp = () => h("p", null, "hello world");
    const withMount = onMount(() => {
        counter++;
    }, comp);
    mount(withMount, {}, container);
    t.equal(counter, 0);
    await waitNextTick();
    t.equal(counter, 1);
});
test('should compose the mount function when there are many', async (t) => {
    let counter = 0;
    const container = document.createElement('div');
    const comp = () => h("p", null, "hello world");
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
});
test('should run a function when component is unMounted', t => {
    let unmounted = null;
    const container = document.createElement('div');
    const Item = onUnMount((n) => {
        unmounted = n;
    }, ({ id }) => h("li", { id: id }, "hello world"));
    const containerComp = (({ items }) => (h("ul", null, items.map(item => h(Item, Object.assign({}, item))))));
    const vnode = mount(containerComp, { items: [{ id: 1 }, { id: 2 }, { id: 3 }] }, container);
    t.equal(container.innerHTML, '<ul><li id="1">hello world</li><li id="2">hello world</li><li id="3">hello world</li></ul>');
    const batch = render(vnode, containerComp({ items: [{ id: 1 }, { id: 3 }] }), container);
    t.equal(container.innerHTML, '<ul><li id="1">hello world</li><li id="3">hello world</li></ul>');
    for (let f of batch) {
        f();
    }
    t.notEqual(unmounted, null);
});
