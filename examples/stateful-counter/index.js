import {mount, connect, withState, h} from '../../index';

const main = document.getElementById('main');

const actions = {};

const reducer = function (state = {
  attempts: 0, secret: {found: false}
}, action) {
  const {type, args} = action;
  switch (type) {
    case 'PASSWORD_FAIL': {
      return Object.assign({}, state, {attempts: state.attempts + 1});
    }
    case 'PASSWORD_SUCCEED': {
      return Object.assign({}, state, {secret: {found: true, timestamp: Date.now()}});
    }
    default:
      return state;
  }
};

const store = {
  subscribe(){

  },
  getState(){

  },
  dispatch(action = {}){

  }
};

/**
 * presentational components
 */
const FormComp = ({onSubmit}) => {
  return <div>
    <form>
      <label>
        <span>Try to find the secret password (answer is "flaco")</span>
        <input name="password" type="password"/>
      </label>
    </form>
  </div>
};

const CountDisplay = ({count}) => <p>You already have tried <strong>{count}</strong> times</p>;

const SecretContent = ({reset, date}) => <div>
  <p>Congratulations you have found the secret code at <strong>{(new Date(date)).toLocaleDateString()}</strong></p>
  <p>To reset, please press the following button
    <button onClick={reset}>Reset</button>
  </p>
</div>;

/**
 * Container factories
 */

//the bound containers will subscribe to change in the attempt count and update accordingly but will not be able to trigger actions
const attemptSliceState = state => ({attempts: state.attempts});
const attemptActions = {};
const subscribeToAttemptsCount = connect(store, attemptActions, attemptSliceState);

//the bound containers will be able to trigger some actions but will never be updated:
//slice state function will return a constant so the component will never be updated
const triggerActions = connect(store, actions, state => 'NO_UPDATE');

//the bound containers will be able to trigger some actions and will also listen to changes in the secret slice of the state
const secretSliceState = state => ({secret: state.secret});
const relevantActions = {};
const secretiveComponents = connect(store, relevantActions, secretSliceState);

/**
 * Connected components
 */

const SecretForm = triggerActions((props, actions) => {
  const onSubmit = ev => {
    const input = ev.target['password'];
    if (input === 'falco') {
      actions.success();
    } else {
      actions.fail();
    }
  };

  return <FormComp onSumbit={onSubmit}/>
});

//a function that map the return slice of state to a set of properties
const mapStateToProp = slice => ({count: slice.attempts});
const AttemptCounter = subscribeToAttemptsCount(({count}) => {
  return <CountDisplay count={count}/>
}, mapStateToProp);

const mapSecretStateToProp = slice => ({isSecretFound: slice.found, date: slice.timestamp});
// a function which should tell whether the component should update or not (by default it checks with deep equality the state slice)
const shouldUpdate = (previousSlice, currentSlice) => previousSlice.found !== currentSlice.found;
const SecretSection = secretiveComponents(({isSecretFound, date}, actions) => {
  return isSecretFound ? <SecretContent date={date} reset={actions.reset}/> : <p>Try to find the secret</p>;
}, mapSecretStateToProp, shouldUpdate);


mount(() => <div>
  <SecretForm/>
  <AttemptCounter/>
  <SecretSection/>
</div>, {}, document.getElementById('main'));


// const SpanCount = ({count}) => <p><span>Another child </span>{count}</p>;
//
// const Counter = withState(({count = 0}, setState) => {
//   return <div>
//     <button onClick={ev => (setState({count: count + 1}))}>Increment</button>
//     <button onClick={ev => (setState({count: count - 1}))}>Decrement</button>
//     <SpanCount count={count}/>
//   </div>
// });
//
// const m = mount((initProp) => {
//   return (<div>
//     <Counter count={initProp.firstCount}/>
//     <Counter count={initProp.secondCount}/>
//   </div>);
// }, {firstCount: 4, secondCount: 8});
//
// m(main);