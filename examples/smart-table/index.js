import {default as smartTable} from 'smart-table-core';
import crud from 'smart-table-crud';
import {mount, h} from '../../index';
import {TBody} from './components/tbody';
import {SortableHeader} from './components/sortableHeader';
import {Summary} from './components/summary';
import {LoadingIndicator} from './components/loadingIndicator';
import {Pager} from './components/pagination';
import {SearchBox} from './components/search';

//data coming from global
const tableState = {search: {}, filter: {}, sort: {}, slice: {page: 1, size: 20}};
const table = smartTable({data, tableState}, crud);

const PersonsTable = ({smartTable}) => (
  <div id="table-container">
    <LoadingIndicator id="overlay" smartTable={smartTable}/>
    <table>
      <thead>
      <SearchBox stSearchScope={['name.last', 'name.first']} smartTable={smartTable}/>
      <tr>
        <th>
          <label class="select-checkbox">
            <span class="visually-hidden"> select all</span>
            <input type="checkbox"/>
          </label>
        </th>
        <SortableHeader smartTable={smartTable} stSortCycle={true} stSortPointer="name.last">Last name</SortableHeader>
        <SortableHeader smartTable={smartTable} stSortPointer="name.first">First name</SortableHeader>
        <SortableHeader smartTable={smartTable} stSortPointer="gender">Gender</SortableHeader>
        <SortableHeader smartTable={smartTable} stSortPointer="birthDate">Birth Date</SortableHeader>
        <SortableHeader smartTable={smartTable} stSortPointer="size">Size</SortableHeader>
      </tr>
      </thead>
      <TBody smartTable={smartTable}/>
      <tfoot>
      <tr>
        <td colSpan="3">
          <Summary smartTable={smartTable}/>
        </td>
        <td colSpan="3">
          <Pager smartTable={smartTable}/>
        </td>
      </tr>
      </tfoot>
    </table>
  </div>
);

// mount container
const main = document.getElementById('main');

const m = mount(PersonsTable, {smartTable: table});

m(main);
