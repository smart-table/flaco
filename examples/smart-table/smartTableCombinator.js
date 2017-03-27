import {compose} from 'smart-table-operators';
import {onMount, onUnMount, update} from '../../index';
import {sort, workingIndicator, summary as summaryDirective, slice, search} from 'smart-table-core';


export function combinator (directive, confMapping, subscribeMethod, reduceFunction = (state) => state, ...subscribers) {
  return function (comp) {
    return function (initProp) {
      const conf = {};
      for (let k of Object.keys(confMapping)) {
        if (initProp[k]) {
          conf[confMapping[k]] = initProp[k]
        }
      }

      const table = initProp.smartTable;
      const dir = directive(Object.assign(conf, {table}));
      const wrapped = (props, ...args) => comp(Object.assign(props, initProp), dir, ...args);

      const subscribe = onMount(vnode => {
        const setChange = update(wrapped, vnode);
        dir[subscribeMethod](newState => {
          setChange({stState: reduceFunction(newState, table)});
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
export const displaySubscriber = combinator(
  ({table}) => table,
  {smartTable: 'table'}, 'onDisplayChange',
  (state) => {
    return Array.isArray(state) ? state : []
  },
  (table) => {
    table.exec();
  });
export const executionChange = combinator(workingIndicator, {}, 'onExecutionChange');
export const summary = combinator(summaryDirective, {}, 'onSummaryChange');
export const pager = combinator(slice, {}, 'onSummaryChange', (state, table) => (table.getTableState().slice));
export const searchable = combinator(search, {stSearchScope: 'scope'}, 'onSearchChange');
