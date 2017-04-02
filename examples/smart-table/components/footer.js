import store from '../lib/store';
import {connect, h} from '../../../index';


const actions = {
  slice: (page, size) => store.dispatch({type: 'slice', args: [{page, size}]})
};
const sliceState = state => state.summary;
const subscribeToSummary = connect(store, actions, sliceState);

const summary = (props) => {
  const {page, size, filteredCount} = props;
  return (<div> showing items <strong>{(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> -
    <strong>{Math.min(filteredCount, page * size)}</strong> of <strong>{filteredCount}</strong> matching items
  </div>);
};

const Pager = (props) => {
  const {page, size, filteredCount, slice} = props;
  const selectPreviousPage = () => slice(page - 1, size);
  const selectNextPage = () => slice(page + 1, size);
  const isPreviousDisabled = page === 1;
  const isNextDisabled = (filteredCount - (page * size)) <= 0;

  return (<div>
    <div>
      <button onClick={selectPreviousPage} disabled={isPreviousDisabled}>
        Previous
      </button>
      <small> Page - {page || 1} </small>
      <button onClick={selectNextPage} disabled={isNextDisabled}>
        Next
      </button>
    </div>
    {/*<div>*/}
    {/*<label>*/}
    {/*Page size*/}
    {/*<select onChange={ev => {*/}
    {/*directive.changePageSize(Number(ev.target.value))*/}
    {/*}} name="pageSize">*/}
    {/*<option selected={size == 15} value="15">15 items</option>*/}
    {/*<option selected={size == 25} value="25">25 items</option>*/}
    {/*<option selected={size == 50} value="50">50 items</option>*/}
    {/*</select>*/}
    {/*</label>*/}
    {/*</div>*/}
  </div>);
};

const SummaryFooter = subscribeToSummary(summary);
const Pagination = subscribeToSummary((props, actions) => <Pager {...props} slice={actions.slice}/>);

export const Footer = () => <tfoot>
<tr>
  <td colspan="3">
    <SummaryFooter/>
  </td>
  <td colSpan="3">
    <Pagination/>
  </td>
</tr>
</tfoot>;



