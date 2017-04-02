import index from '../index';
import render from './render';
import update from './update';
import lifecycles from './lifecycles';
import withState from './withState';
import zora from 'zora';

export default zora()
  .test(index)
  .test(render)
  .test(update)
  .test(lifecycles)
  .test(withState)
  .run();

