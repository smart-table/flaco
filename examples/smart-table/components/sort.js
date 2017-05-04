import {h, connect} from '../../../index';
import store from '../lib/store';
import json from 'smart-table-json-pointer';
import {IconSort, IconSortAsc, IconSortDesc} from './icons';

const actions = {
  toggleSort: ({pointer, direction}) => store.dispatch({type: 'sort', args: [{pointer, direction}]})
};
const sliceState = json('tableState.sort').get;
const subscribeToSort = connect(store, actions, sliceState);


const Icon = ({direction}) => {
  if (direction === 'asc') {
    return <IconSortAsc/>;
  } else if (direction === 'desc') {
    return <IconSortDesc/>;
  } else {
    return <IconSort/>;
  }
};

const SortButtonComponent = (props => {
  const {columnPointer, sortDirections = ['asc', 'desc'], pointer, direction, sort} = props;
  const actualCursor = columnPointer !== pointer ? -1 : sortDirections.indexOf(direction);
  const newCursor = (actualCursor + 1 ) % sortDirections.length;

  const toggleSort = () => sort({pointer: columnPointer, direction: sortDirections[newCursor]});

  return <button tabindex="-1" onClick={toggleSort}>
    <span class="visually-hidden">Toggle sort</span>
    <Icon direction={sortDirections[actualCursor]}/>
  </button>
});

export const SortButton = subscribeToSort((props, actions) =>
  <SortButtonComponent {...props} sort={actions.toggleSort}/>);
