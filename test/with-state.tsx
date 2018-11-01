import test from 'zora';
import {h, withState, mount, VNode, withIdempotentState} from '../dist/src';
import {waitNextTick} from './test-util';

interface ComponentInput {
    foo: any
}

interface KeyableComponentInput extends ComponentInput {
    key: number
}

test('withState: bind an update function to a component', async t => {
    let update = null;

    const StaticComponent = (props: ComponentInput, setState): VNode => {
        if (!update) {
            update = setState;
        }
        return <p>{props.foo}</p>;
    };
    const Comp = withState<ComponentInput>(StaticComponent);
    const container = document.createElement('div');
    mount((props: ComponentInput) => <Comp foo={props.foo}/>, {foo: 'bar'}, container);
    t.equal(container.innerHTML, '<p>bar</p>');
    await waitNextTick();
    update({foo: 'bis'});
    t.equal(container.innerHTML, '<p>bis</p>');
});
test('withState: should create isolated state for each component', async t => {
    let update1 = null;
    let update2 = null;
    const Comp = withState<ComponentInput>(({foo}: ComponentInput, setState) => {
        if (!update1) {
            update1 = setState;
        } else if (!update2) {
            update2 = setState;
        }

        return <p>{foo}</p>;
    });
    const container = document.createElement('div');
    mount(({foo1, foo2}) => <div><Comp foo={foo1}/><Comp foo={foo2}/></div>, {foo1: 'bar', foo2: 'bar2'}, container);
    t.equal(container.innerHTML, '<div><p>bar</p><p>bar2</p></div>');
    await waitNextTick();
    update1({foo: 'bis'});
    t.equal(container.innerHTML, '<div><p>bis</p><p>bar2</p></div>');
    update2({foo: 'blah'});
    t.equal(container.innerHTML, '<div><p>bis</p><p>blah</p></div>');
});
test('withIdempotentState: bind an update function to a component', async t => {
    let update = null;

    const StaticComponent = (props: ComponentInput, setState): VNode => {
        if (!update) {
            update = setState;
        }
        return <p>{props.foo}</p>;
    };
    const Comp = withIdempotentState<KeyableComponentInput>(StaticComponent);
    const container = document.createElement('div');
    mount((props: ComponentInput) => <Comp key={1} foo={props.foo}/>, {foo: 'bar'}, container);
    t.equal(container.innerHTML, '<p>bar</p>');
    await waitNextTick();
    update({foo: 'bis'});
    t.equal(container.innerHTML, '<p>bis</p>');
});
test('withIdempotentState: should create isolated state for each component', async t => {
    let update1 = null;
    let update2 = null;
    const Comp = withIdempotentState<KeyableComponentInput>(({foo}: ComponentInput, setState) => {
        if (!update1) {
            update1 = setState;
        } else if (!update2) {
            update2 = setState;
        }

        return <p>{foo}</p>;
    });
    const container = document.createElement('div');
    mount(({foo1, foo2}) => <div><Comp key={1} foo={foo1}/><Comp key={2} foo={foo2}/></div>, {
        foo1: 'bar',
        foo2: 'bar2'
    }, container);
    t.equal(container.innerHTML, '<div><p>bar</p><p>bar2</p></div>');
    await waitNextTick();
    update1({foo: 'bis'});
    t.equal(container.innerHTML, '<div><p>bis</p><p>bar2</p></div>');
    update2({foo: 'blah'});
    t.equal(container.innerHTML, '<div><p>bis</p><p>blah</p></div>');
});

test('withIdempotentState: component should not be reset when container is updated', async t => {
    let update = null;
    let containerUpdate = null;

    const StaticComponent = (props: ComponentInput, setState): VNode => {
        if (!update) {
            update = setState;
        }
        return <p>{props.foo}</p>;
    };
    const Comp = withIdempotentState<KeyableComponentInput>(StaticComponent);
    const Container = withState((props: { children: VNode[] }, setState) => {
        if (!containerUpdate) {
            containerUpdate = setState;
        }
        return <div>{props.children}</div>;
    });

    const appContainer = document.createElement('div');
    mount((props: ComponentInput) => <Container><Comp key={1}
                                                      foo={props.foo}/>
    </Container>, {foo: 'bar'}, appContainer);
    t.equal(appContainer.innerHTML, '<div><p>bar</p></div>');
    await waitNextTick();
    update({foo: 'bis'});
    t.equal(appContainer.innerHTML, '<div><p>bis</p></div>');
    containerUpdate({});
    await waitNextTick();
    t.equal(appContainer.innerHTML, '<div><p>bis</p></div>', 'inner component should not have changed');
    update({foo: 'bisbis'});
    await waitNextTick();
    t.equal(appContainer.innerHTML, '<div><p>bisbis</p></div>', 'inner component should not have changed');
});
