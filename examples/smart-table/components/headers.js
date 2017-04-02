import {h, connect} from '../../../index';

import {SortButton} from './sort';
import {SearchRow} from './search';
import {FilterRow, ToggleFilterButton} from './filter';


const ColumnHeader = (props) => {
  const {columnPointer, sortDirections = ['asc', 'desc'], className, children} = props;

  return <th class={className}>
    {children}
    <div class="buttons-container">
      <SortButton columnPointer={columnPointer} sortDirections={sortDirections}/>
      <ToggleFilterButton columnPointer={columnPointer}/>
    </div>
  </th>
};


export const Headers = () => (<thead>
<SearchRow class="filter-row"/>
<tr>
  <ColumnHeader className="col-lastname" columnPointer="name.last"
                sortDirections={['asc', 'desc', 'none']}>Surname</ColumnHeader>
  <ColumnHeader className="col-firstname" columnPointer="name.first">Name</ColumnHeader>
  <ColumnHeader className="col-birthdate" sortDirections={['desc', 'asc']}
                columnPointer="birthDate">Date of birth</ColumnHeader>
  <ColumnHeader className="col-gender fixed-size" columnPointer="gender">Gender</ColumnHeader>
  <ColumnHeader className="col-size fixed-size" columnPointer="size">Size</ColumnHeader>
  <th class="fixed-size col-actions"></th>
</tr>
<FilterRow scope="name.last">
  <label>
    <span>surname includes:</span>
    <input type="text" placeholder="case insensitive surname value"/>
  </label>
</FilterRow>
<FilterRow scope="name.first">
  <label>
    <span>name includes:</span>
    <input type="text" placeholder="case insensitive name value"/>
  </label>
</FilterRow>
<FilterRow scope="birthDate">
  <label>
    <span>born after:</span>
    <input data-operator="gt" type="date"/>
  </label>
</FilterRow>
<FilterRow scope="gender">
  <label>
    <span>gender is:</span>
    <select data-operator="is">
      <option value="">-</option>
      <option value="female">female</option>
      <option value="male">male</option>
    </select>
  </label>
</FilterRow>
<FilterRow scope="size">
  <label>
    <span>taller than:</span>
    <input min="150" max="200" step="1" type="range" data-operator="gt"/>
  </label>
  <label>
    <span>smaller than:</span>
    <input min="150" max="200" step="1" type="range" data-operator="lt"/>
  </label>
</FilterRow>
</thead>);