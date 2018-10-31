import test from 'zora';
import {h, renderAsString} from '../dist/src';

test('render a simple component', t => {
    const Comp = props => <h1><span id={props.id}>{props.greeting}</span></h1>;
    const output = renderAsString(Comp, {id: 123, greeting: 'hello world'});
    t.equal(output, '<h1><span id="123">hello world</span></h1>');
});

test('render nested components', t => {
    const Comp = props => <h1><span id={props.id}>{props.greeting}</span></h1>;
    const Main = props => <main>
        <Comp id={123} greeting="Hello world"/>
        <div><p>Some other content</p></div>
    </main>;
    const output = renderAsString(Main, {});
    t.equal(output, `<main><h1><span id="123">Hello world</span></h1><div><p>Some other content</p></div></main>`);
});

test('should drop event listeners', t => {
    const Comp = props => <button onClick={() => {console.log('foo')}}><span
        id={props.id}>{props.greeting}</span></button>;
    const output = renderAsString(Comp, {id: 123, greeting: 'hello world'});
    t.equal(output, '<button><span id="123">hello world</span></button>');
});

test('should handle boolean attributes accordingly to html specification', t => {
    const Comp = props => <details open={props.open}>
    <summary>Some details</summary>
    <p>Some details content</p></details>;
    const openOutput = renderAsString(Comp, {open: true});
    t.equal(openOutput, '<details open><summary>Some details</summary><p>Some details content</p></details>');
    const closeOutput = renderAsString(Comp, {open: false});
    t.equal(closeOutput, '<details><summary>Some details</summary><p>Some details content</p></details>');
});

test('should prevent html injection', t => {
    const Comp = props => <button id={props.id}>Hello world</button>;
    const props = {
        id: '"><script>console.log("owned")</script>'
    };
    const output = renderAsString(Comp, props);
    t.equal(output, `<button id="\"&gt;&lt;script&gt;console.log(\"owned\")&lt;/script&gt;">Hello world</button>`)
});
