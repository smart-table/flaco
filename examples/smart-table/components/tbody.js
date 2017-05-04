import store from '../lib/store';
import {connect, h, onUpdate} from '../../../index';
import {EditableLastName, EditableBirthDate, EditableSize, EditableGender, EditableFirstName} from './editableCell';
import {IconBin} from './icons'

const mapStateToProp = state => ({persons: state});
const doesUpdateList = (previous, current) => {
  let output = true;
  if (typeof previous === typeof current) {
    output = previous.length !== current.length || previous.some((i, k) => previous[k].value.id !== current[k].value.id);
  }
  return output;
};
const sliceState = state => state.displayed;
const actions = {
  remove: index => store.dispatch({type: 'remove', args: [index]}),
  patch: (index, value) => store.dispatch({type: 'patch', args: [index, value]})
};
const subscribeToDisplay = connect(store, actions, sliceState);
const focusFirstCell = onUpdate(vnode => {
  const firstCell = vnode.dom.querySelector('td');
  if (firstCell !== null) {
    firstCell.focus();
  }
});

const TBody = focusFirstCell(({persons = [], patch, remove}) => {
  return persons.length ? <tbody>
    {
      persons.map(({value, index}) => <tr>
        <EditableLastName className="col-lastname" person={value} index={index} patch={patch}/>
        <EditableFirstName className="col-firstname" person={value} index={index} patch={patch}/>
        <EditableBirthDate className="col-birthdate" person={value} index={index} patch={patch}/>
        <EditableGender className="col-gender fixed-size" person={value} index={index} patch={patch}/>
        <EditableSize className="col-size fixed-size" person={value} index={index} patch={patch}/>
        <td class="fixed-size col-actions" data-keyboard-selector="button">
          <button tabindex="-1" onClick={() => remove(index)}>
            <span class="visually-hidden">{'Delete ' + value.name.last + ' ' + value.name.first}</span>
            <IconBin/>
          </button>
        </td>
      </tr>)
    }
    </tbody> : <tbody>
    <tr>
      <td tabIndex="-1" colSpan="6">There is no data matching your request</td>
    </tr>
    </tbody>
});

const PersonListComponent = (props, actions) => {
  return <TBody persons={props.persons} remove={actions.remove}
                patch={actions.patch}/>
};

export const PersonList = subscribeToDisplay(PersonListComponent, mapStateToProp, doesUpdateList);
