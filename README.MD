# Flaco

**currently in Beta**, API may change or break pretty often.

Yet another view engine based on [hyperscript]() and virtual dom.

In **Flaco**, the base unit, component, is *just* [pure]() and [stateless]() functions which should be deterministic and easy to test. 
You can then use any combinator (aka higher order function) to give more specificity (perhaps loosing the purity or statelessness) to your components and embrace the programming paradigm you prefer (stateful components, [Elm]() or [Redux]() like architecture, observables, etc) 

Ah, and Flaco is made of less than **300** lines of code while providing a wide range of *features*, difficult to beat !

## Installation

```yarn add flaco```

or 

```npm install --save flaco```

If you wish to benefit from [JSX]() syntax, tell your transpiler to use the **h** pragma instead of the default "createElement" set for [React]().

example with [Rollup]() and [buble]()
```Javascript
//rollup.config.js

import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./path/to/entry/file.js",
  plugins: [
    node({jsnext:true}),
    buble({
      jsx: 'h', //here you specifiy the pragma you want to use
      target:{chrome:52}
    })
  ],
  dest: "./path/to/output/bundle.js",
  moduleName: "myBundle",
  format: "iife"
};
```

## Usage

### Create a component

```Jsx
//hello.js
import {h} from 'flaco';

export const HelloWorld = ({hello:'Hello', world:'World'} = {}) => (<h1>{hello} ... {world} !</h1>);
```

It should have the sugar the JSX syntax can provide.

### Mount a component

Having a component is pretty useless if you don't put it anywhere. For that, you can use the **mount** function

```Jsx
import {mount} from 'flaco';
import {HelloWorld} from './hello.js;

mount(HelloWorld, {hello:'Buenas dias', world:'mundo'}, document.getElementById('someContainer'));
```

Note the mount function is [curried]() so you can somehow reuse it to mount it in different places for example
 
```Jsx
const mountInFrench = mount(HelloWorld, {hello:'Bonjour', world:'monde'});    
 
mountInFrench(document.getElementById('here')); 
mountInFrench(document.getElementById('andThere')); 
```

[See in CodePen]()

### Use combinator to create state ... (or the beginning of the end)

Without any doubt, you will want the user to interact with your shiny user interface and you will need somehow to manage application states. Flaco itself does not make any assumption on how to do it but provide few combinators (higher order function for your components) to create common patterns.
They are shipped with the core module but don't worry with any good module bundler (like [Rollup]()) you'll be able to tree shake the parts you don't use (and anyway the full Flaco lib remains probably one of the smallest UI framework you may know)
   
#### Self contained state

In some cases, you don't need the state of a particular component to be managed globally or shared. Only it, can be aware of its own encapsulated state and able to edit it. 
That could be a collapse/expanding section for example.

To create such behaviour you can use the *withState* combinator: it will create a scope specific to a component instance and allow it to update itself (by passing a second argument to your component)

```Jsx
//expandable.js
import {withState} from 'flaco';

const ExpandableSection = withState(({sectionId, expanded, children},setState) => {
    const exp = expanded === 'true';
    return (
    <div>
        <button onClick={()=>setState({expanded:!exp}) aria-expanded={exp ? 'true' : 'false'} aria-controls={sectionId}>{exp ? 'Collapse' : 'Expand'</button> 
        <div id={sectionId}>
            {children}
        </div>
    </div>
    );
}));
```

We have now a "reusable component" you can mount anywhere, share across projects, etc

```Jsx
import {mount} from 'flaco';
import ExpandableSection from './expandable.js'

mount(()=>(
<div>
    <ExpandableSection sectionId="first" expanded="true"><strong>Expanded</strong> by default section</ExpandableSection>
    <ExpandableSection sectionId="second" expanded="false"><strong>Not expanded</strong> by default section</ExpandableSection>
</div>
), 
{},
document.getElementById('main'));
```

[See in CodePen]()

#### Global/Partial application state ([Redux]() store like)

// blah

#### Global application state (the [Elm]() way)

// blah

#### Life cycles

// blah blah

## More examples

// blah blah

## Contributing

### Test

//bla bla

### Reporting an issue

//bla blah




