import {h, VNode, VNodeLike} from './h';
import {isVNodeLike, NA} from './util';

interface HTMLElementComponentFunction {
    (...children: VNodeLike[]): VNode;

    (props: object, ...children: VNodeLike[]): VNode;
}

const HTMLElementComponentFactory = (tag: string): HTMLElementComponentFunction => (props, ...children) => {
    return isVNodeLike(props) ? h(tag, NA, props, ...children) : h(tag, props, ...children);
};

// Main root
// todo
// Document metadata
// todo
// Sectioning root
export const body = HTMLElementComponentFactory('body');
// Content sectioning
export const address = HTMLElementComponentFactory('address');
export const article = HTMLElementComponentFactory('article');
export const aside = HTMLElementComponentFactory('aside');
export const footer = HTMLElementComponentFactory('footer');
export const header = HTMLElementComponentFactory('header');
export const h1 = HTMLElementComponentFactory('h1');
export const h2 = HTMLElementComponentFactory('h2');
export const h3 = HTMLElementComponentFactory('h3');
export const h4 = HTMLElementComponentFactory('h4');
export const h5 = HTMLElementComponentFactory('h5');
export const h6 = HTMLElementComponentFactory('h6');
export const hgroup = HTMLElementComponentFactory('hgroup');
export const nav = HTMLElementComponentFactory('nav');
export const section = HTMLElementComponentFactory('section');
// Text content
export const blockquote = HTMLElementComponentFactory('blockquote');
export const dd = HTMLElementComponentFactory('dd');
export const dir = HTMLElementComponentFactory('dir');
export const div = HTMLElementComponentFactory('div');
export const dl = HTMLElementComponentFactory('dl');
export const dt = HTMLElementComponentFactory('dt');
export const figcaption = HTMLElementComponentFactory('figcaption');
export const figure = HTMLElementComponentFactory('figure');
export const hr = HTMLElementComponentFactory('hr');
export const li = HTMLElementComponentFactory('li');
export const main = HTMLElementComponentFactory('main');
export const ol = HTMLElementComponentFactory('ol');
export const p = HTMLElementComponentFactory('p');
export const pre = HTMLElementComponentFactory('pre');
export const ul = HTMLElementComponentFactory('ul');
// Inline text semantic
export const a = HTMLElementComponentFactory('a');
export const abbr = HTMLElementComponentFactory('abbr');
export const b = HTMLElementComponentFactory('b');
export const bdi = HTMLElementComponentFactory('bdi');
export const bdo = HTMLElementComponentFactory('bdo');
export const br = HTMLElementComponentFactory('br');
export const cite = HTMLElementComponentFactory('cite');
export const quote = HTMLElementComponentFactory('quote');
export const data = HTMLElementComponentFactory('data');
export const dfn = HTMLElementComponentFactory('dfn');
export const em = HTMLElementComponentFactory('em');
export const i = HTMLElementComponentFactory('i');
export const kbd = HTMLElementComponentFactory('kbd');
export const mark = HTMLElementComponentFactory('mark');
export const q = HTMLElementComponentFactory('q');
export const rp = HTMLElementComponentFactory('rp');
export const rt = HTMLElementComponentFactory('rt');
export const rtc = HTMLElementComponentFactory('rtc');
export const ruby = HTMLElementComponentFactory('ruby');
export const s = HTMLElementComponentFactory('s');
export const samp = HTMLElementComponentFactory('samp');
export const small = HTMLElementComponentFactory('small');
export const span = HTMLElementComponentFactory('span');
export const strong = HTMLElementComponentFactory('strong');
export const sub = HTMLElementComponentFactory('sub');
export const sup = HTMLElementComponentFactory('sup');
export const time = HTMLElementComponentFactory('time');
export const u = HTMLElementComponentFactory('u');
// export const var = (props, ...args) => h('var',props, ...args);
export const wbr = HTMLElementComponentFactory('wbr');
// Image and multimedia
export const area = HTMLElementComponentFactory('area');
export const audio = HTMLElementComponentFactory('audio');
export const img = HTMLElementComponentFactory('img');
export const map = HTMLElementComponentFactory('map');
export const track = HTMLElementComponentFactory('track');
export const video = HTMLElementComponentFactory('video');
// Embedded content
export const embed = HTMLElementComponentFactory('embed');
export const object = HTMLElementComponentFactory('object');
export const param = HTMLElementComponentFactory('param');
export const picture = HTMLElementComponentFactory('picture');
export const source = HTMLElementComponentFactory('source');
// Scripting
// todo
// Demarcating edit
// todo
// Table content
export const caption = HTMLElementComponentFactory('caption');
export const col = HTMLElementComponentFactory('col');
export const colgroup = HTMLElementComponentFactory('colgroup');
export const table = HTMLElementComponentFactory('table');
export const tbody = HTMLElementComponentFactory('tbody');
export const td = HTMLElementComponentFactory('td');
export const tfoot = HTMLElementComponentFactory('tfoot');
export const th = HTMLElementComponentFactory('th');
export const thead = HTMLElementComponentFactory('thead');
export const tr = HTMLElementComponentFactory('tr');
// Forms
export const button = HTMLElementComponentFactory('button');
export const datalist = HTMLElementComponentFactory('datalist');
export const fieldset = HTMLElementComponentFactory('fieldset');
export const form = HTMLElementComponentFactory('form');
export const input = HTMLElementComponentFactory('input');
export const label = HTMLElementComponentFactory('label');
export const legend = HTMLElementComponentFactory('legend');
export const meter = HTMLElementComponentFactory('meter');
export const optgroup = HTMLElementComponentFactory('optgroup');
export const option = HTMLElementComponentFactory('option');
export const output = HTMLElementComponentFactory('output');
export const progress = HTMLElementComponentFactory('progress');
export const select = HTMLElementComponentFactory('select');
export const textarea = HTMLElementComponentFactory('textarea');
// Interactive elements
// todo
