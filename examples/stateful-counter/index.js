import h from '../../lib/h'
import {mount, withState} from '../../index';

const main = document.getElementById('main');

const SpanCount = ({count}) => <p><span>Another child </span>{count}</p>;

const Counter = withState(({count = 0}, setState) => {
  return <div>
    <button onClick={ev => (setState({count: count + 1}))}>Increment</button>
    <button onClick={ev => (setState({count: count - 1}))}>Decrement</button>
    <SpanCount count={count}/>
  </div>
});

const m = mount((initProp) => {
  return (<div>
    <Counter count={initProp.firstCount}/>
    <Counter count={initProp.secondCount}/>
  </div>);
}, {firstCount: 4, secondCount: 8});

m(main);

