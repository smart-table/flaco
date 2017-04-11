import {h, connect} from '../../../index';
import {debounce} from './helper';
import store from '../lib/store';
import json from 'smart-table-json-pointer';

const actions = {
  search: (value, scope) => store.dispatch({type: 'search', args: [{value, scope}]})
};
const sliceState = json('tableState.search').get;
const noNeedForUpdate = state => false;// always return the same value
const searchable = connect(store, actions, sliceState);

const SearchInput = (props) => (<label>
  <span>{props.children}</span>
  <input tabindex="0" type="search" onInput={props.onInput} placeholder={props.placeholder}/>
</label>);

export const SearchRow = searchable((props, actions) => {
  const onInput = debounce(ev => actions.search(ev.target.value, ['name.last', 'name.first']), 300);
  delete props.children;
  return <tr {...props}>
    <th data-keyboard-selector="input">
      <SearchInput placeholder="Case sensitive search on surname and name" onInput={onInput}>Search:</SearchInput>
    </th>
  </tr>
}, noNeedForUpdate, noNeedForUpdate);