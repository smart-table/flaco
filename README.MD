# Flaco

[![CircleCI](https://circleci.com/gh/smart-table/flaco.svg?style=svg)](https://circleci.com/gh/smart-table/flaco)

Yet another view engine based on [hyperscript](https://github.com/hyperhype/hyperscript) and virtual dom.

In **Flaco**, the base unit, component, is *just* [pure](https://github.com/hemanth/functional-programming-jargon#purity) functions which should be deterministic and easy to test.
You can then use any combinator (aka higher order function) to give more specificity (perhaps loosing the purity or statelessness) to your components and embrace the UI architecture you prefer (stateful components, [Elm](https://guide.elm-lang.org/) or [Redux](https://github.com/reactjs/redux) like architecture, observables, etc)

Ah, and Flaco is about **2kb**  minified and gzipped while providing a wide range of *features*, difficult to beat (that is about 400 lines of source code) !

## Installation

``yarn add flaco``

or

``npm install --save flaco``

If you wish to benefit from [JSX](https://facebook.github.io/react/docs/introducing-jsx.html) syntax, tell your transpiler to use the **h** pragma instead of the default "createElement" set for [React](https://facebook.github.io/react/) in most of the module bundlers.

## Usage

### Create a component

```Jsx
//hello.js
import {h} from 'flaco';

export const HelloWorld = ({hello = 'Hello', world = 'World'} = {}) => (<h1>{hello} ... {world} !</h1>);
```
Or if you don't want to use JSX and keep the vanilla JS syntax

```Javascript
import {h, NA} from 'flaco';

// NA stands for "No attributes" replace by an object if you wish to pass some attributes
export const HelloWorld = ({hello = 'Hello', world = 'World'} = {}) => h('h1', NA, `${hello}...${world}`);
```
Flaco come with built in convenient functions for standard HTML Elements:
```Javascript
import {h1} from 'flaco';

export const HelloWorld = ({hello = 'Hello', world = 'World'} = {}) => h1(`${hello}...${world}`);
```

### Mount a component

Having a component is pretty useless if you don't put it anywhere. For that, you can use the **mount** function

```Jsx
import {mount} from 'flaco';
import {HelloWorld} from './hello.js';

mount(HelloWorld, {hello:'Buenas dias', world:'mundo'}, document.getElementById('someContainer'));
// or mount(<HelloWorld hello='Buenas dias', world='mundo'/>,{},document.getElementById('someContainer'));
```

Note the mount function is [curried](https://github.com/hemanth/functional-programming-jargon#currying) so you can somehow reuse it to mount it in different places for example

```Jsx
const mountInFrench = mount(HelloWorld, {hello:'Bonjour', world:'monde'});

mountInFrench(document.getElementById('here'));
mountInFrench(document.getElementById('andThere'));
```

[See in CodePen](http://codepen.io/lorenzofox3/pen/GmRNzp)

If the node you try to mount your component in has already a dom tree, flaco will try to *hydrate* the dom tree. It means that with flaco you can have [progressive web app](https://dev.opera.com/articles/pwa-resources/) without changing a single line of code !

### Use combinator to create state ... (or the beginning of the end)

Without any doubt, you will want the user to interact with your shiny user interface and you will need somehow to manage application states. Flaco itself does not make any assumption on how to do it but provide few combinators (higher order function for your components) to create common patterns.
They are shipped with the core module but don't worry with any good module bundler (like Rollup) you'll be able to tree shake the parts you don't use (and anyway the full Flaco lib remains probably one of the smallest UI library you may know)

#### Self contained state

In some cases, you don't need the state of a particular component to be managed globally or shared. Only the component itself, should be aware of its own encapsulated state and able to edit it.
That could be a collapse/expanding section for example.

To create such behaviour you can use the **withState** combinator: it will create a scope specific to a component instance and allow it to update itself (by passing an update function as second argument to your component)

```Jsx
//expandable.js
import {withState, h} from 'flaco';

const ExpandableSection = withState((props, setState) => {
    const {sectionId, expanded, children} = props;
    const exp = expanded === 'true' || expanded === true;
    const toggle = () => setState(Object.assign({}, props, {expanded: !exp}));
    return (
      <div>
        <button
          onClick={toggle} aria-expanded={exp ? 'true' : 'false'}
          aria-controls={sectionId}>
          {exp ? 'Collapse' : 'Expand'}
        </button>
        <div aria-hidden={String(!exp)} id={sectionId}>
          {children}
        </div>
      </div>
    );
  }
);
```

We have now a "reusable component" you can mount anywhere, share across projects, etc.

```Jsx
import {mount} from 'flaco';
import ExpandableSection from './expandable.js'

mount(() => (
    <div>
      <ExpandableSection sectionId="first" expanded="true"><strong>Expanded</strong> by default
        section</ExpandableSection>
      <ExpandableSection sectionId="second" expanded="false"><strong>Not expanded</strong> by default
        section</ExpandableSection>
    </div>
  ),
  {},
  document.getElementById('main'));
```

[See in CodePen](http://codepen.io/lorenzofox3/pen/ZKELYj)

#### Global application state (the Elm way)

Note you can have multiple apps in the same document. However you should make sure updates and models are in their isolated silos.

### Life cycles

Flaco allows you to hook yourself into different life cycles of the components. This is useful to create your own update logic and your own combinators.

#### onMount

Will occur when a component has been mounted into the DOM

#### onUnmount

Will occur when a component has been unmounted (ie removed from the DOM)

#### onUpdate

Will occur before the component is updated (it won't be triggered when the component is mounted)

#### Use an update function

The lifecycle combined with the **update** factory will be useful to create your own update logic

You can create a combinator which will force the update every second for example.

```Jsx
import {onMount,onUnMount,h,mount} from 'flaco';
const main = document.getElementById('main');

const pollEverySecond = function (comp) {
  return function (initProp) {
    let timer;

    const createInterval = onMount(vnode => {
      const updateFunc = update(comp, vnode);
      timer = setInterval(() => {
        updateFunc(Object.assign({}, initProp, {timestamp: Math.floor(Date.now())}));
      }, 1000);
    });

    const clean = onUnMount(() => clearInterval(timer));

    return clean(createInterval(comp));
  };
};


const DisplaySeconds = ({timestamp, startDate, event}) => <p>
  <strong>{Math.floor(timestamp - startDate.getTime())}</strong> seconds have passed since <strong>{event}</strong>
</p>;

const Clock = pollEverySecond(DisplaySeconds);

mount(() => <div>
  <Clock startDate={new Date(1987, 4, 21)} event="I was born"/>
  <Clock startDate={new Date(1955, 8, 27)} event="My Mom was born"/>
</div>, {}, main);
```

See [Codepen](http://codepen.io/lorenzofox3/pen/ybLgEG);

## Contributing

### Test

``yarn test`` or ``npm test``

### Reporting an issue

Any **bug** or **troubleshooting** need to come with an **isolated running example** (ex: a [codepen]() reproducing your issue only - we don't need the whole app) or will simply be ignored.
