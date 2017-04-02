import {h, connect, onUpdate} from '../../../index';
import store from '../lib/store';

const focusOnOpen = onUpdate(vnode => {
  const ah = vnode.props['aria-hidden'];
  if (ah === 'false') {
    const input = vnode.dom.querySelector('input, select');
    if (input) {
      setTimeout(() => input.focus(), 5);
    }
  }
});

const actions = {
  toggleFilterMenu: (filter) => store.dispatch({type: 'TOGGLE_FILTER', filter}),
  commitFilter: (value) => store.dispatch({type: 'filter', args: [value]})
};
const sliceState = state => ({activeFilter: state.activeFilter, filterClauses: state.tableState.filter});
const subscribeToFilter = connect(store, actions, sliceState);

const FilterRowComp = focusOnOpen((props = {}) => {
  const {isHidden, toggleFilterMenu, commitFilter} = props;
  const close = () => {
    toggleFilterMenu(null);
    document.querySelector(`[aria-controls=${idName}]`).focus();
  };
  const onSubmit = (ev) => {
    const form = ev.target;
    const {name} = form;
    const inputs = form.querySelectorAll('input, select');
    commitFilter({
      [name]: [...inputs].map(input => {
        return {type: input.type, value: input.value, operator: input.getAttribute('data-operator') || 'includes'}
      })
    });
    ev.preventDefault();
    close();
  };
  const idName = ['filter'].concat(props.scope.split('.')).join('-');
  const onKeyDown = (ev) => {
    if (ev.code === 'Escape' || ev.keyCode === 27 || ev.key === 'Escape') {
      close();
    }
  };

  return <tr id={idName} class="filter-row" onKeydown={onKeyDown} aria-hidden={String(isHidden !== true)}>
    <th colspan="6">
      <form name={props.scope} onSubmit={onSubmit}>
        {props.children}
        <div class="buttons-container">
          <button>Apply</button>
          <button onClick={close} type="button">Cancel</button>
        </div>
      </form>
    </th>
  </tr>
});

const FilterButton = (props) => {
  const {columnPointer, toggleFilterMenu, filterClauses = {}}=props;
  const currentFilterClauses = filterClauses[columnPointer] || [];
  const controlled = ['filter'].concat(columnPointer.split('.')).join('-');
  const onClick = () => toggleFilterMenu(columnPointer);
  const isActive = currentFilterClauses.length && currentFilterClauses.some(clause => clause.value);
  return <button class={isActive ? 'active-filter' : ''} aria-controls={controlled} onClick={onClick}>F</button>
};

export const ToggleFilterButton = subscribeToFilter((props, actions) => {
  return <FilterButton {...props} toggleFilterMenu={actions.toggleFilterMenu}/>
});

export const FilterRow = subscribeToFilter((props, actions) => {
  return <FilterRowComp scope={props.scope} isHidden={props.activeFilter === props.scope}
                        toggleFilterMenu={actions.toggleFilterMenu} commitFilter={actions.commitFilter}>
    {props.children}
  </FilterRowComp>;
});