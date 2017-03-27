import {h} from '../../../index';
import {searchable} from '../smartTableCombinator';
import {debounce} from './helper';

export const SearchBox = searchable((props, directive) => {
  return (<tr>
    <th colSpan="5">
      <label>
        Search
        <input placeholder={'Case sensitive search on '+props.stSearchScope.join(', ') } onInput={debounce((ev => {
          directive.search(ev.target.value);
        }))} type="search"/>
      </label>
    </th>
  </tr>);
});