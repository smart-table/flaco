import {h, mount, onMount, connect} from '../../index';
import {PersonList} from './components/tbody';
import {WorkInProgress} from './components/loadingIndicator';
import {Headers} from './components/headers';
import {Footer} from './components/footer';
import store from './lib/store';

const PersonTable = onMount(() => {
  store.dispatch({type: 'exec', args: []}); //kick smartTable
}, () =>
  <div id="table-container">
    <WorkInProgress/>
    <table>
      <Headers/>
      <PersonList/>
      <Footer/>
    </table>
  </div>);

mount(PersonTable, {}, document.getElementById('main'));