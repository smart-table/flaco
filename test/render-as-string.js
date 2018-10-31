import test from 'zora';
import { h, renderAsString } from '../dist/src';
test('render a simple component', t => {
    const Comp = props => h("h1", null,
        h("span", { id: props.id }, props.greeting));
    const output = renderAsString(Comp, { id: 123, greeting: 'hello world' });
    t.equal(output, '<h1><span id="123">hello world</span></h1>');
});
test('render nested components', t => {
    const Comp = props => h("h1", null,
        h("span", { id: props.id }, props.greeting));
    const Main = props => h("main", null,
        h(Comp, { id: 123, greeting: "Hello world" }),
        h("div", null,
            h("p", null, "Some other content")));
    const output = renderAsString(Main, {});
    t.equal(output, `<main><h1><span id="123">Hello world</span></h1><div><p>Some other content</p></div></main>`);
});
test('should drop event listeners', t => {
    const Comp = props => h("button", { onClick: () => { console.log('foo'); } },
        h("span", { id: props.id }, props.greeting));
    const output = renderAsString(Comp, { id: 123, greeting: 'hello world' });
    t.equal(output, '<button><span id="123">hello world</span></button>');
});
test('should handle boolean attributes accordingly to html specification', t => {
    const Comp = props => h("details", { open: props.open },
        h("summary", null, "Some details"),
        h("p", null, "Some details content"));
    const openOutput = renderAsString(Comp, { open: true });
    t.equal(openOutput, '<details open><summary>Some details</summary><p>Some details content</p></details>');
    const closeOutput = renderAsString(Comp, { open: false });
    t.equal(closeOutput, '<details><summary>Some details</summary><p>Some details content</p></details>');
});
test('should prevent html injection', t => {
    const Comp = props => h("button", { id: props.id }, "Hello world");
    const props = {
        id: '"><script>console.log("owned")</script>'
    };
    const output = renderAsString(Comp, props);
    t.equal(output, `<button id="\"&gt;&lt;script&gt;console.log(\"owned\")&lt;/script&gt;">Hello world</button>`);
});
