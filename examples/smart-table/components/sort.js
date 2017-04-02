import {h, connect} from '../../../index';
import store from '../lib/store';
import json from 'smart-table-json-pointer';

const actions = {
  toggleSort: ({pointer, direction}) => store.dispatch({type: 'sort', args: [{pointer, direction}]})
};
const sliceState = json('tableState.sort').get;
const subscribeToSort = connect(store, actions, sliceState);


const SortButtonComponent = (props => {
  const {columnPointer, sortDirections = ['asc', 'desc'], pointer, direction, sort} = props;
  const actualCursor = columnPointer !== pointer ? -1 : sortDirections.indexOf(direction);
  const newCursor = (actualCursor + 1 ) % sortDirections.length;
  const toggleSort = () => sort({pointer: columnPointer, direction: sortDirections[newCursor]});
  return <button onClick={toggleSort}>S</button>
});

export const SortButton = subscribeToSort((props, actions) =>
  <SortButtonComponent {...props} sort={actions.toggleSort}/>);
