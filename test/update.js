import zora from 'zora';
import {update, mount, h} from '../index';

export default zora()
  .test('give ability to update a node (and its descendant)', function * (t) {
    const container = document.createElement('div');
    const comp = (({id, content}) => (<p id={id}>{content}</p>));
    const initialVnode = mount(comp, {id: 123, content: 'hello world'}, container);
    t.equal(container.innerHTML, '<p id="123">hello world</p>');
    const updateFunc = update(comp, initialVnode);
    updateFunc({id: 567, content: 'bonjour monde'});
    t.equal(container.innerHTML, '<p id="567">bonjour monde</p>');
  });
