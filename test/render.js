import test from 'zora';
import { mount, h } from '../dist/src';
test('mount a simple component', t => {
    const container = document.createElement('div');
    const Comp = (props) => (h("h1", null,
        h("span", { id: props.id }, props.greeting)));
    mount(Comp, { id: 123, greeting: 'hello world' }, container);
    t.equal(container.innerHTML, '<h1><span id="123">hello world</span></h1>');
});
test('mount composed component', t => {
    const container = document.createElement('div');
    const Comp = (props) => (h("h1", null,
        h("span", { id: props.id }, props.greeting)));
    const Container = (props) => (h("section", null,
        h(Comp, { id: "567", greeting: "hello you" })));
    mount(Container, {}, container);
    t.equal(container.innerHTML, '<section><h1><span id="567">hello you</span></h1></section>');
});
test('mount a component with inner child', t => {
    const container = document.createElement('div');
    const Comp = (props) => (h("h1", null,
        h("span", { id: props.id }, props.greeting)));
    const Container = (props) => (h("section", null, props.children));
    mount(() => h(Container, null,
        h(Comp, { id: "567", greeting: "hello world" })), {}, container);
    t.equal(container.innerHTML, '<section><h1><span id="567">hello world</span></h1></section>');
});
/*
test('mount component with fragment node', t => {
    const container = document.createElement('div');
    const Comp = (props) => <fragment>
        <div id="1">
            <fragment>
                <div id="3"></div>
                <div id="4"></div>
            </fragment>
        </div>
        <div id="2">
            {props.children}
        </div>
    </fragment>;
    mount(<Comp>
        <span>hello</span>
    </Comp>, {}, container);
    t.equal(container.innerHTML, '<section><h1><span id="567">hello world</span></h1></section>');
});
*/
