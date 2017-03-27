import zora from 'zora';
import util from './util';
import domUtil from './domUtil';
import h from './h';

export default zora()
  .test(util)
  .test(domUtil)
  .test(h);
