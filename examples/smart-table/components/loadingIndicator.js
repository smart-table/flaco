import {h, connect} from '../../../index';
import store from '../lib/store';


const actions = {};
const sliceState = state => ({isProcessing: state.isProcessing});
const subscribeToProcessing = connect(store, actions, sliceState);

const LoadingIndicator = ({isProcessing}) => {
  const className = isProcessing === true ? 'st-working' : '';
  return <div id="overlay" class={className}>
    Processing
  </div>;
};
export const WorkInProgress = subscribeToProcessing(LoadingIndicator);
