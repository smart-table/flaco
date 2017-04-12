# Flaco

[![CircleCI](https://circleci.com/gh/smart-table/flaco.svg?style=svg)](https://circleci.com/gh/smart-table/flaco)

**currently in Beta**, API may change or break pretty often.

Yet another view engine based on [hyperscript](https://github.com/hyperhype/hyperscript) and virtual dom.

In **Flaco**, the base unit, component, is *just* [pure](https://github.com/hemanth/functional-programming-jargon#purity) and *stateless* functions which should be deterministic and easy to test.
You can then use any combinator (aka higher order function) to give more specificity (perhaps loosing the purity or statelessness) to your components and embrace the programming paradigm you prefer (stateful components, [Elm](https://guide.elm-lang.org/) or [Redux](https://github.com/reactjs/redux) like architecture, observables, etc)

Ah, and Flaco is about **2kb**  minified and gzipped while providing a wide range of *features*, difficult to beat (that is about 400 lines of source code) !

## Installation

``yarn add flaco``

or 

``npm install --save flaco``

If you wish to benefit from [JSX](https://facebook.github.io/react/docs/introducing-jsx.html) syntax, tell your transpiler to use the **h** pragma instead of the default "createElement" set for [React](https://facebook.github.io/react/) in most of the module bundlers.

example with [Rollup](rollupjs.org) and [buble](https://buble.surge.sh/)
<details><summary>Rollup configuration file</summary>
```Javascript
//rollup.config.js

import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./path/to/entry/file.js",
  plugins: [
    node({jsnext:true}),
    buble({
      jsx: 'h', //here you specify the pragma you want to use
      target:{chrome:52}
    })
  ],
  dest: "./path/to/output/bundle.js",
  moduleName: "myBundle",
  format: "iife"
};
```
</details>

## Usage

### Create a component

```Jsx
//hello.js
import {h} from 'flaco';

export const HelloWorld = ({hello:'Hello', world:'World'} = {}) => (<h1>{hello} ... {world} !</h1>);
```
It should have the syntax sugar the JSX can provide.

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

With [Elm](https://guide.elm-lang.org/), application state (or **model**) is global and can only be modified through **updates**. Any change in the model will make the **view** render with the updated state.
For convenience, Flaco will pass updates as second argument of the view.
Use the elm combinator on your view component and then mount it anywhere with the initial model and the list of available updates.
Your updates should return a new state of the model

```Jsx
import {elm as app, h, mount} from 'flaco';

const model = {
  firstCounter: {count: 3},
  secondCounter: {count: -1},
};

const updates = {
  incrementFirst: (model, ev) => {
    console.log(ev) // can use some other parameters if needed !
    return Object.assign({}, model, {firstCounter: {count: model.firstCounter.count + 1}})
  },
  decrementFirst: (model) => Object.assign({}, model, {firstCounter: {count: model.firstCounter.count - 1}}),
  incrementSecond: (model) => Object.assign({}, model, {secondCounter: {count: model.secondCounter.count + 1}}),
  decrementSecond: (model) => Object.assign({}, model, {secondCounter: {count: model.secondCounter.count - 1}})
};

const view = (model, updates) => {
  return (<div>
    <div>
      <button onClick={updates.incrementFirst}>Increment</button>
      <button onClick={updates.decrementFirst}>Decrement</button>
      <span>{model.firstCounter.count}</span>
    </div>
    <div>
      <button onClick={updates.incrementSecond}>Increment</button>
      <button onClick={updates.decrementSecond}>Decrement</button>
      <span>{model.secondCounter.count}</span>
    </div>
  </div>);
};

const App = app(view);

mount((props) => <App model={props.model} updates={props.updates}/>, {model, updates}, document.getElementById('main'));
```

[CodePen](http://codepen.io/lorenzofox3/pen/NjWdRw)

Note you can have multiple apps in the same document. However you should make sure updates and models are in their isolated silos.

#### Global/Partial application state (Redux store like)

Redux itself has been inspired by Elm architecture and share some patterns. Lately, it has been one of the most popular application state container.
The **connect** combinator allows you to create a [Container component](https://medium.com/@learnreact/container-components-c0e67432e005) which will listen to changes of a specific slice of the global state. These containers help you to have a more fine grained control on which part of the dom tree you want to update.

Assuming you have the following redux configuration:

```Javascript
import {createStore} from 'redux';

// action creators
const fail = () => ({type: 'PASSWORD_FAIL'});
const succeed = () => ({type: 'PASSWORD_SUCCEED'});
const reset = () => ({type: 'RESET'});

//reducer
const initialState = {
  attempts: 0, secret: {found: false}
};
const reducer = function (state = initialState, action) {
  const {type} = action;
  switch (type) {
    case 'PASSWORD_FAIL': {
      return Object.assign({}, state, {attempts: state.attempts + 1});
    }
    case 'PASSWORD_SUCCEED': {
      return Object.assign({}, state, {secret: {found: true, timestamp: Date.now()}});
    }
    case 'RESET': {
      return initialState;
    }
    default:
      return state;
  }
};

//store
const store = createStore(reducer);

//boundActions
const actions = {
  fail: () => store.dispatch(fail()),
  succeed: () => store.dispatch(succeed()),
  reset: () => store.dispatch(reset()),
};
```

And the following presentational components:

```Jsx
const FormComp = ({onSubmit}) => (<form onSubmit={onSubmit}>
  <label>
    <span>Try to find the secret password (answer is "flaco")</span>
    <input name="password" type="password"/>
  </label>
  <input type="submit" value="Try !"/>
</form>);

const CountDisplay = ({count = 0}={}) => <p>You already have tried <strong>{count}</strong> times</p>;

const SecretContent = ({reset, date}) => <div>
  <p>Congratulations you have found the secret code at <strong>{(new Date(date)).toLocaleTimeString()}</strong></p>
  <p>To reset, please press the following button
    <button onClick={reset}>Reset</button>
  </p>
</div>;
```

Then you can create your containers and connect the components as follow

```Jsx
//the bound containers will subscribe to change in the attempt count and update accordingly but will not be able to trigger actions
const attemptSliceState = state => ({attempts: state.attempts});
const attemptActions = {}; //empty
const subscribeToAttemptsCount = connect(store, attemptActions, attemptSliceState);

//the bound containers will be able to trigger actions but won't be updated:
//slice state function will return a constant so the component will never be updated
const triggerActions = connect(store, actions, state => 'NO_UPDATE');

//the bound containers will be able to trigger some actions and will also listen to changes in the secret slice of the state
const secretSliceState = state => state.secret;
const secretiveComponents = connect(store, {reset: actions.reset}, secretSliceState);

/**
 * Connected components
 */

const SecretForm = triggerActions((props, actions) => {
  const onSubmit = ev => {
    const input = ev.target['password'];
    if (input.value === 'falco') {
      actions.succeed();
    } else {
      actions.fail();
    }
    ev.preventDefault();
  };

  return <FormComp onSubmit={onSubmit}/>
});

//a function that map the return slice of state to a set of properties
const mapStateToProp = slice => ({count: slice.attempts});
const AttemptCounter = subscribeToAttemptsCount(({count}) => <CountDisplay count={count}/>, mapStateToProp);

const mapSecretStateToProp = slice => ({isSecretFound: slice.found, date: slice.timestamp});
// a function which should tell whether the component should update or not (by default it checks with deep equality the state slice)
const shouldUpdate = (previousSlice = {}, currentSlice = {}) => previousSlice.found !== currentSlice.found;
const SecretSection = secretiveComponents(({isSecretFound, date}, actions) => {
  return isSecretFound ?
    <div>
      <SecretContent date={date} reset={actions.reset}/>
    </div> :
    <div>
      <p>Try to find the secret</p>
    </div>;
}, mapSecretStateToProp, shouldUpdate);


mount(() => <div>
  <SecretForm/>
  <AttemptCounter/>
  <SecretSection/>
</div>, {}, document.getElementById('main'));
```

[CodePen](http://codepen.io/lorenzofox3/pen/eWYgWx)

### Life cycles

Flaco allow you to hook yourself into different life cycles of the components. This is useful to create your own update logic and your own combinators.

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

## More examples

The repo comes with few examples you can run by
1. going into the folder (ie ``cd ./examples/stateful-counter``)
2. installing the dependencies with ``yarn`` or ``npm install``
3. building/bundling the app ``yarn build`` or ``npm run build``
4. and serving/browsing the index.html file.

### [stateful-counter](./examples/stateful-counter)

//todo

### [benchmark-elm-like](./examples/benchmark-elm-like)

//todo

### [todomvc-redux](./examples/todomvc-redux)

//todo

### [smart-table](./examples/smart-table)

//todo

## Contributing

### Test

``yarn test`` or ``npm test``

### Reporting an issue

Any **bug** or **troubleshooting** need to come with an **isolated running example** (ex: a [codepen]() reproducing your issue only - we don't need the whole app) or will simply be ignored.
