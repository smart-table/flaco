import {default as smartTable} from 'smart-table-core';
import {mount, h} from '../../index';
import {displaySubscriber, sortable} from './smartTableCombinator';

const table = smartTable({data, tableState: {search: {}, filter: {}, sort: {}, slice: {page: 1, size: 30}}});

const SortableHeader = sortable((props, directive) => {
  const {stSortPointer, children, stState} = props;
  const {pointer, direction} =stState || {};
  let className = '';
  if (pointer === stSortPointer) {
    className = direction === 'asc' ? 'st-sort-asc' : (direction === 'desc' ? 'st-sort-desc' : '');
  }
  return <th class={className} onClick={directive.toggle}>{children}</th>;
});

const Row = ({person}) => (<tr>
  <td>{person.name.last}</td>
  <td>{person.name.first}</td>
  <td>{person.gender}</td>
  <td>{person.birthDate.toDateString()}</td>
  <td>{person.size}</td>
</tr>);


const TBody = displaySubscriber(({stState}) => {
  const persons = Array.isArray(stState) ? stState : [];

  return (<tbody>
  {
    persons.map(item => {
      const {value:person} = item;
      return <Row person={person}/>
    })
  }
  </tbody>);
});


const PersonsTable = ({smartTable}) => (
  <div>
    <p>Processing ...</p>
    <table>
      <thead>
      <tr>
        <SortableHeader stSortCycle={true} stSortPointer="name.last" smartTable={smartTable}>Last name</SortableHeader>
        <SortableHeader stSortPointer="name.first" smartTable={smartTable}>First name</SortableHeader>
        <th>Gender</th>
        <th>Birth Date</th>
        <th>Size</th>
      </tr>
      </thead>
      <TBody smartTable={smartTable}/>
    </table>
  </div>
);

// mount container
const main = document.getElementById('main');

const m = mount(PersonsTable, {smartTable: table});

m(main);
