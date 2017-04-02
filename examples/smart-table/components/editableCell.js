import {h, withState, onMount} from '../../../index';
import {debounce} from './helper';
import {Input, autoFocus} from './inputs';

const InputCell = (props) => (
  <td onClick={props.toggleEdit(true)} class={props.className}>
    {
      props.isEditing === 'true' ?
        <Input type={props.type || 'text'} value={props.currentValue} onInput={props.onInput}
               onBlur={props.toggleEdit(false)}/>
        : <span>{props.currentValue}</span>
    }
  </td>
);

const makeEditable = comp => {
  return withState((props, setState) => {
    const toggleEdit = (val) => () => setState(Object.assign({}, props, {isEditing: val !== undefined ? val : props.isEditing !== true}));
    const fullProps = {toggleEdit, ...props};
    return comp(fullProps);
  });
};

export const EditableLastName = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.name.last;
  const onInput = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {name: {last: currentValue, first: person.name.first}});
  });

  return <InputCell isEditing={String(isEditing === true)} toggleEdit={toggleEdit} className={className}
                    currentValue={currentValue} onInput={onInput}/>
});

export const EditableFirstName = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.name.first;
  const onInput = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {name: {first: currentValue, last: person.name.last}});
  });

  return <InputCell isEditing={String(isEditing === true)} toggleEdit={toggleEdit} className={className}
                    currentValue={currentValue} onInput={onInput}/>
});


const GenderSelect = autoFocus(({onChange, toggleEdit, person}) => {
  return <select name="gender select" onChange={onChange} onBlur={toggleEdit(false)}>
    <option value="male" selected={person.gender === 'male'}>male</option>
    <option value="female" selected={person.gender === 'female'}>female</option>
  </select>
});

export const EditableGender = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.gender;

  const onChange = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {gender: currentValue});
  });
  const genderClass = person.gender === 'female' ? 'gender-female' : 'gender-male';

  return <td onClick={toggleEdit(true)} class={className}>
    {
      isEditing ? <GenderSelect onChange={onChange} toggleEdit={toggleEdit} person={person}/> :
        <span class={genderClass}>{currentValue}</span>
    }
  </td>;
});

export const EditableSize = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.size;
  const onInput = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {size: currentValue});
  });
  const ratio = Math.min((person.size - 150) / 50, 1) * 100;

  return <td class={className} onClick={toggleEdit(true)}>
    {
      isEditing ? <Input type="number" min="150" max="200" value={currentValue} onBlur={toggleEdit(false)}
                         onInput={onInput}/> :
        <span><span style={`height: ${ratio}%`} class="size-stick"></span>{currentValue}</span>
    }
  </td>;
});

export const EditableBirthDate = makeEditable((props) => {
  const {toggleEdit, person, index, className, patch, isEditing} = props;
  let currentValue = person.birthDate;

  const onInput = debounce(ev => {
    currentValue = ev.target.value;
    patch(index, {birthDate: new Date(currentValue)});
  });

  return <InputCell type="date" isEditing={String(isEditing === true)} toggleEdit={toggleEdit} className={className}
                    currentValue={currentValue.toDateString()} onInput={onInput}/>
});
