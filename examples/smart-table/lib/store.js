import {default as smartTable} from 'smart-table-core';
import crud from 'smart-table-crud';
import {createStore} from './reduxSmartTable';

//data coming from global
const tableState = {search: {}, filter: {}, sort: {}, slice: {page: 1, size: 20}};
//the smart table
const table = smartTable({data, tableState}, crud);
//the store
export default createStore(table);
