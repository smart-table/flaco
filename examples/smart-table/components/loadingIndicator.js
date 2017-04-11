import {h, connect} from '../../../index';
import store from '../lib/store';


const actions = {};
const sliceState = state => ({isProcessing: state.isProcessing});
const subscribeToProcessing = connect(store, actions, sliceState);

const LoadingIndicator = ({isProcessing}) => {
  const className = isProcessing === true ? 'st-working' : '';
  const message = isProcessing === true ? 'loading persons data' : 'data loaded';
  return <div id="overlay" aria-live="assertive" role="alert" class={className}>
    {message}
  </div>;
};
export const WorkInProgress = subscribeToProcessing(LoadingIndicator);
