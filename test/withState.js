import zora from 'zora';
import {h, withState, mount} from '../index';
import {waitNextTick} from './testUtil';

export default zora()
  .test('bind an update function to a component', function * (t) {
    let update = null;
    const Comp = withState(({foo}, setState) => {
      if (!update) {
        update = setState;
      }
      return <p>{foo}</p>;
    });
    const container = document.createElement('div');
    mount(({foo}) => <Comp foo={foo}/>, {foo: 'bar'}, container);
    t.equal(container.innerHTML, '<p>bar</p>');
    yield waitNextTick();
    update({foo: 'bis'});
    t.equal(container.innerHTML, '<p>bis</p>');
  })
  .test('should create isolated state for each component', function * (t) {
    let update1 = null;
    let update2 = null;
    const Comp = withState(({foo}, setState) => {
      if (!update1) {
        update1 = setState;
      } else if (!update2) {
        update2 = setState;
      }

      return <p>{foo}</p>;
    });
    const container = document.createElement('div');
    mount(({foo1, foo2}) => <div><Comp foo={foo1}/><Comp foo={foo2}/></div>, {foo1: 'bar', foo2: 'bar2'}, container);
    t.equal(container.innerHTML, '<div><p>bar</p><p>bar2</p></div>');
    yield waitNextTick();
    update1({foo: 'bis'});
    t.equal(container.innerHTML, '<div><p>bis</p><p>bar2</p></div>');
    update2({foo: 'blah'});
    t.equal(container.innerHTML, '<div><p>bis</p><p>blah</p></div>');
  });