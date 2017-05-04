import {h, mount, onMount} from '../../index';
import {PersonList} from './components/tbody';
import {WorkInProgress} from './components/loadingIndicator';
import {Headers} from './components/headers';
import {Footer} from './components/footer';
import store from './lib/store';
import keyboard from 'smart-table-keyboard';

const table = onMount(n => {
  store.dispatch({type: 'exec', args: []}); //kick smartTable
  keyboard(n.dom.querySelector('table'));
});

const PersonTable = table(() =>
  <div id="table-container">
    <WorkInProgress/>
    <table>
      <Headers/>
      <PersonList/>
      <Footer/>
    </table>
  </div>);

mount(PersonTable, {}, document.getElementById('main'));