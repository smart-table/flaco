import test from 'zora';
import { h, withState, mount } from '../dist/src';
import { waitNextTick } from './test-util';
test('bind an update function to a component', async (t) => {
    let update = null;
    const StaticComponent = (props, setState) => {
        if (!update) {
            update = setState;
        }
        return h("p", null, props.foo);
    };
    const Comp = withState(StaticComponent);
    const container = document.createElement('div');
    // @ts-ignore
    mount((props) => h(Comp, { foo: props.foo }), { foo: 'bar' }, container);
    t.equal(container.innerHTML, '<p>bar</p>');
    await waitNextTick();
    update({ foo: 'bis' });
    t.equal(container.innerHTML, '<p>bis</p>');
});
test('should create isolated state for each component', async (t) => {
    let update1 = null;
    let update2 = null;
    const Comp = withState(({ foo }, setState) => {
        if (!update1) {
            update1 = setState;
        }
        else if (!update2) {
            update2 = setState;
        }
        return h("p", null, foo);
    });
    const container = document.createElement('div');
    // @ts-ignore
    mount(({ foo1, foo2 }) => h("div", null,
        h(Comp, { foo: foo1 }),
        h(Comp, { foo: foo2 })), { foo1: 'bar', foo2: 'bar2' }, container);
    t.equal(container.innerHTML, '<div><p>bar</p><p>bar2</p></div>');
    await waitNextTick();
    update1({ foo: 'bis' });
    t.equal(container.innerHTML, '<div><p>bis</p><p>bar2</p></div>');
    update2({ foo: 'blah' });
    t.equal(container.innerHTML, '<div><p>bis</p><p>blah</p></div>');
});
