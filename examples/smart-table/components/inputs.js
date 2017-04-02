import {h, onMount} from '../../../index';


export const autoFocus = onMount(n => n.dom.focus());
export const Input = autoFocus(props => {
  delete  props.children; //no children for inputs
  return <input {...props} />
});