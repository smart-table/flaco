import {h} from '../../../index';
import {pager} from '../smartTableCombinator';

export const Pager = pager(({stState = {}}, directive) => {
  const {page, size} =stState;
  const isPreviousDisabled = !directive.isPreviousPageEnabled();
  const isNextDisabled = !directive.isNextPageEnabled();
  return (<div>
    <div>
      <button onClick={directive.selectPreviousPage} disabled={isPreviousDisabled}>Previous</button>
      <small> Page - {page || 1} </small>
      <button onClick={directive.selectNextPage} disabled={isNextDisabled}>Next</button>
    </div>
    <div>
      <label>
        Page size
        <select onChange={ev => {
          directive.changePageSize(Number(ev.target.value))
        }} name="pageSize">
          <option selected={size == 20} value="20">20 items</option>
          <option selected={size == 50} value="50">50 items</option>
          <option selected={size == 100} value="100">100 items</option>
        </select>
      </label>
    </div>
  </div>);
});
