import h from "./lib/h";
import withState from "./lib/withState";
import elm from "./lib/elm";
import {mount, render} from './lib/tree';
import update from './lib/update';
import {onMount, onUnMount, onUpdate} from './lib/lifeCycles';
import connect from './lib/connect';
import {isDeepEqual} from './lib/util'

export {
  h,
  elm,
  withState,
  render,
  mount,
  update,
  isDeepEqual,
  onMount,
  onUnMount,
  connect,
  onUpdate
};