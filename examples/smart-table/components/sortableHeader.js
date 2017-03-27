import {h} from '../../../index';
import {sortable} from '../smartTableCombinator';

export const SortableHeader = sortable((props, directive) => {
  const {stSortPointer, children, stState} = props;
  const {pointer, direction} =stState || {};

  let className = '';
  if (pointer === stSortPointer) {
    className = direction === 'asc' ? 'st-sort-asc' : (direction === 'desc' ? 'st-sort-desc' : '');
  }
  return <th>{children}<button class={className} onClick={directive.toggle}>Sort</button></th>;
});