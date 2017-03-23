import h from '../../lib/h'
import component from '../../lib/component';
import {mount} from '../../lib/tree';

const main = document.getElementById('main');

const SpanCount = ({count}) => <p><span>Another child </span>{count}</p>;

const Counter = component(({count = 0, children}, setState) => {
  return <div>
    <button onClick={ev => (setState({count: count + 1}))}>Increment</button>
    <button onClick={ev => (setState({count: count - 1}))}>Decrement</button>
    <SpanCount count={count}/>
    <span>{children}</span>
  </div>
});

const m = mount((initProp) => {

  const now = Date.now();

  return (<div>
    <Counter count={initProp.firstCount}>You should see me {now}</Counter>
    <Counter count={initProp.secondCount}>You should see me too</Counter>
  </div>);
}, {firstCount: 4, secondCount: 8});

m(main);

