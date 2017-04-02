import zora from 'zora';
import {onMount, onUnMount, h, mount, render} from '../../index';
import {waitNextTick} from './util'

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
  .test('should run a function when component is unMounted', function * (t) {
    let unmounted = null;
    const container = document.createElement('div');
    const Item = onUnMount((n) => {
      unmounted = n;
    }, ({id}) => <li id={id}>hello world</li>);
    const containerComp = (({items}) => (<ul>
      {
        items.map(item => <Item {...item}/>)
      }
    </ul>));

    const vnode = mount(containerComp, {items: [{id: 1}, {id: 2}, {id: 3}]}, container);
    t.equal(container.innerHTML, '<ul><li id="1">hello world</li><li id="2">hello world</li><li id="3">hello world</li></ul>');
    const batch = render(vnode, containerComp({items: [{id: 1}, {id: 3}]}), container);
    t.equal(container.innerHTML, '<ul><li id="1">hello world</li><li id="3">hello world</li></ul>');
    for (let f of batch){
      f();
    }
    t.notEqual(unmounted, null);
  })