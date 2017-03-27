import {h} from '../../../index';
import {displaySubscriber} from '../smartTableCombinator';

const Row = ({person, removeItem, index}) => (<tr>
  <td>
    <label class="select-checkbox">
      <span class="visually-hidden"> select {person.name.last + ' ' + person.name.first}</span>
      <input type="checkbox"/>
    </label>
  </td>
  <td>{person.name.last}</td>
  <td>{person.name.first}</td>
  <td>{person.gender}</td>
  <td>{person.birthDate.toDateString()}</td>
  <td>{person.size}</td>
  <td>
    <button>Edit</button>
    <button onClick={removeItem}>Remove</button>
  </td>
</tr>);

export const TBody = displaySubscriber(({smartTable, stState = []}) => {
  return (<tbody>
  {
    stState.map(item => {
      const {value:person, index} = item;
      return <Row person={person} index={index} removeItem={() => smartTable.remove(index)}/>
    })
  }
  </tbody>);
});