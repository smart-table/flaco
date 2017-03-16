import h from './lib/h'
import {updateTree} from './lib/render';
import recyclerFactory from './lib/recycler';

function itemify (string) {
  const items = [];
  const numbers = Math.ceil(Math.random() * 1000);
  console.log(numbers)
  for (let i = 0; i < numbers; i++) {
    items.push({id: i, value: string + i + ' ' + Date.now()});
  }

  return items;
}

const Item = ({item, children}) => (<li id={item.id}>{children}</li>);

const div = ({title, items = []}) => (
  <div>
    <ul>
      {
        items.map(item => (<Item item={item}>{item.value}</Item>))
      }
    </ul>
  </div>);

let mainElement = document.getElementById('main');
console.time('set');
let oldVnode = div({items: itemify('foo')});
const main = updateTree(mainElement, null, oldVnode);
console.timeEnd('set');

const recycler = recyclerFactory();

const [b] = document.getElementsByTagName('button');
b.addEventListener('click', () => {
  console.time('update');
  const newVnode = div({items: itemify('updated at')});
  const garbage = updateTree(mainElement, oldVnode, newVnode, recycler.create);
  oldVnode = newVnode;
  console.timeEnd('update');
  recycler.collect(garbage || []);
});




