import store from '../lib/store';
import {connect, h} from '../../../index';

const actions = {
  slice: (page, size) => store.dispatch({type: 'slice', args: [{page, size}]})
};
const sliceState = state => state.summary;
const subscribeToSummary = connect(store, actions, sliceState);

const Summary = (props) => {
  const {page, size, filteredCount} = props;
  return (<div> showing items <strong>{(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> -
    <strong>{Math.min(filteredCount, page * size)}</strong> of <strong>{filteredCount}</strong> matching items
  </div>);
};

const PageSize = props => {
  const {size, slice} = props;
  const changePageSize = (ev) => slice(1, Number(ev.target.value));
  return <div>
    <label>
      Page size
      <select tabIndex="-1" onChange={changePageSize} name="pageSize">
        <option selected={size == 20} value="20">20 items</option>
        <option selected={size == 30} value="30">30 items</option>
        <option selected={size == 50} value="50">50 items</option>
      </select>
    </label>
  </div>
};

const Pager = (props) => {
  const {page, size, filteredCount, slice} = props;
  const selectPreviousPage = () => slice(page - 1, size);
  const selectNextPage = () => slice(page + 1, size);
  const isPreviousDisabled = page === 1;
  const isNextDisabled = (filteredCount - (page * size)) <= 0;

  return (
    <div>
      <button tabIndex="-1" onClick={selectPreviousPage} disabled={isPreviousDisabled}>
        Previous
      </button>
      <small> Page - {page || 1} </small>
      <button tabIndex="-1" onClick={selectNextPage} disabled={isNextDisabled}>
        Next
      </button>
    </div>
  );
};

const SummaryFooter = subscribeToSummary(Summary);
const Pagination = subscribeToSummary((props, actions) => <Pager {...props} slice={actions.slice}/>);
const SelectPageSize = subscribeToSummary((props, actions) => <PageSize {...props} slice={actions.slice}/>);

export const Footer = () => <tfoot>
<tr>
  <td colspan="3">
    <SummaryFooter/>
  </td>
  <td colspan="2" data-keyboard-selector="button:not(:disabled)" colSpan="3">
    <Pagination/>
  </td>
  <td data-keyboard-selector="select">
    <SelectPageSize/>
  </td>
</tr>
</tfoot>;



