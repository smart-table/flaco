import zora from 'zora';
import {h} from '../index';

export default zora()
  .test('create regular html node', function * (t) {
    const vnode = h('div', {id: 'someId', "class": 'special'});
    t.deepEqual(vnode, {nodeType: 'div', props: {id: 'someId', "class": 'special'}, children: []});
  })
  .test('create regular html node with text node children', function * (t) {
    const vnode = h('div', {id: 'someId', "class": 'special'}, 'foo');
    t.deepEqual(vnode, {
      nodeType: 'div', props: {id: 'someId', "class": 'special'}, children: [{
        nodeType: 'Text',
        children: [],
        props: {value: 'foo'}
      }]
    });
  })
  .test('create regular html with children', function * (t) {
    const vnode = h('ul', {id: 'collection'}, h('li', {id: 1}, 'item1'), h('li', {id: 2}, 'item2'));
    t.deepEqual(vnode, {
      nodeType: 'ul',
      props: {id: 'collection'},
      children: [
        {
          nodeType: 'li',
          props: {id: 1},
          children: [{
            nodeType: 'Text',
            props: {value: 'item1'},
            children: []
          }]
        }, {
          nodeType: 'li',
          props: {id: 2},
          children: [{
            nodeType: 'Text',
            props: {value: 'item2'},
            children: []
          }]
        }
      ]
    });
  })
  .test('use function as component passing the children as prop', function * (t) {
    const foo = (props) => h('p', props);
    const vnode = h(foo, {id: 1}, 'hello world');
    t.deepEqual(vnode, {
      nodeType: 'p',
      props: {
        children: [{
          nodeType: 'Text',
          children: [],
          props: {value: 'hello world'}
        }],
        id: 1
      },
      children: []
    });
  })
  .test('use nested combinator to create vnode', function * (t) {
    const combinator = () => () => () => () => (props) => h('p', {id: 'foo'});
    const vnode = h(combinator, {});
    t.deepEqual(vnode, {nodeType: 'p', props: {id: 'foo'}, children: []});
  })

