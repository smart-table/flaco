import {compose} from 'smart-table-operators';
import {onMount, onUnMount, update} from '../../index';
import {sort} from 'smart-table-core';


export function combinator (directive, confMapping, subscribeMethod, ...subscribers) {
  return function (comp) {
    return function (initProp) {
      const conf = {};
      for (let k of Object.keys(confMapping)) {
        if (initProp[k]) {
          conf[confMapping[k]] = initProp[k]
        }
      }

      const dir = directive(Object.assign(conf, {table: initProp.smartTable}));
      const wrapped = (props, ...args) => comp(Object.assign(props, initProp), dir, ...args);

      const subscribe = onMount(vnode => {
        const setChange = update(wrapped, vnode);
        dir[subscribeMethod](newState => {
          setChange({stState: newState});
        });
        for (let s of subscribers) {
          s(initProp.smartTable);
        }
      });

      const unSubscribe = onUnMount(() => dir.off());

      return compose(subscribe, unSubscribe)(wrapped);
    }
  };
}

export const sortable = combinator(sort, {stSortPointer: 'pointer', stSortCycle: 'cycle'}, 'onSortToggle');
export const displaySubscriber = combinator(({table}) => table, {smartTable: 'table'}, 'onDisplayChange', (table) => {
  table.exec();
});
