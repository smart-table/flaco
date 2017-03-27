import {h} from '../../../index';
import {executionChange} from '../smartTableCombinator';

export const LoadingIndicator = executionChange(({stState}) => {
  const {working = false} = stState || {};
  const className = working === true ? 'st-working' : '';
  return <div id="overlay" class={className}>
    Processing...
  </div>;
});
