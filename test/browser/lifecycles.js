import zora from 'zora';
import {onMount, onUnMount, h, mount} from '../../index';

function waitNextTick () {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, 2)
  })
}


export default zora()
  .test('should run a function when component is mounted', function * (t) {
    let counter = 0;
    const container = document.createElement('div');
    const comp = () => <p>hello world</p>;
    const withMount = onMount(() => {
      counter++
    }, comp);
    mount(withMount, {}, container);
    t.equal(counter, 0);
    yield waitNextTick();
    t.equal(counter, 1);
  })
  // .test('should run a function when component is unMounted', function * (t) {
  //   let unmounted = null;
  //   const container = document.createElement('div');
  //   const containerComp = (({items}) =>());
  //   const Item = onUnMount((n) => {
  //     unmounted = n;
  //   }, ({id}) => <li id={id}>hello world</li>);
  //   t.equal(unmounted, null);
  //   yield waitNextTick();
  //   t.equal(unmounted.id, 1);
  // })