import {h} from '../../../index';
import {summary} from '../smartTableCombinator';

export const Summary = summary(({stState = {}}) => {
  const {page, size, filteredCount} = stState;
  return (<div> showing items <strong>{(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> -
    <strong>{Math.min(filteredCount, page * size)}</strong> of <strong>{filteredCount}</strong> matching items
  </div>);
});

