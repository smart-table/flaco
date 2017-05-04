import {h} from '../../../index';

export function debounce (fn, delay = 300) {
  let timeoutId;
  return (ev) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(function () {
      fn(ev);
    }, delay);
  };
}
export const trapKeydown = (...keys) => (ev) => {
  const {keyCode} =ev;
  if (keys.indexOf(keyCode) === -1) {
    ev.stopPropagation();
  }
};