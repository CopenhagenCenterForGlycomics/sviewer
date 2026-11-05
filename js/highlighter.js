import { Tween, autoPlay } from 'es6-tween';

const canvas_template = document.createElement('template');

canvas_template.innerHTML = `
<canvas class="highlight_canvas">
</canvas>
`;

function create_canvas(viewer,identifier) {
  let template_instance = canvas_template.content.cloneNode(true);
  template_instance.querySelector('canvas').setAttribute('id',identifier);
  let existing_highlight = viewer.shadowRoot.querySelector('canvas.highlight_canvas');
  let new_canvas = template_instance.firstElementChild;
  if (existing_highlight) {
     existing_highlight.insertAdjacentElement('afterend',new_canvas);
  } else {
     viewer.shadowRoot.insertBefore(new_canvas,viewer.shadowRoot.firstElementChild);
  }
  return new_canvas;
}


function create_offscreen(target,scale_factor) {
    var offScreenCanvas = document.createElement('canvas');
    offScreenCanvas.width = target.width || 1;
    offScreenCanvas.height = target.height || 1;
    return offScreenCanvas;
}

const active_tweens = new WeakMap();
const part_elements = Symbol('part_elements');

// Mirrors whatever this Highlighter is currently drawing (the 'selection'
// ring, the 'available' dashed circle, or any future named Highlighter)
// onto each highlighted residue's own icon, via the `part` attribute
// already used for per-residue ::part() styling (see renderIcon()'s
// `part="residue_location_N"`). Named after the Highlighter's own
// `identifier` (e.g. 'selection'/'available'), so CSS from outside the
// shadow root can target the icon itself in sync with the canvas drawing -
// e.g. `::part(selection)`, `::part(available)` - without each call site
// having to manage it by hand. Tracks the previously-touched elements so a
// residue dropped from the next `highlight()` call gets its token removed,
// not left stuck on.
function updatePartTokens(highlighter,residues) {
  let renderer = highlighter.viewer.renderer;
  let current = new Set();
  for (let res of residues) {
    let element = renderer.rendered.get(res)?.residue?.element;
    if (element) {
      current.add(element);
    }
  }
  let previous = highlighter[part_elements] || new Set();
  for (let element of previous) {
    if ( ! current.has(element)) {
      element.part.remove(highlighter.identifier);
    }
  }
  for (let element of current) {
    element.part.add(highlighter.identifier);
  }
  highlighter[part_elements] = current;
}

function performHighlight(residues=[]) {
  updatePartTokens(this,residues);
  let canv = this.canvas;
  const ctx = canv.getContext('2d');
  const zoom = Math.ceil(parseFloat(( window.document.documentElement.clientWidth / window.innerWidth).toFixed(2)));

  const scale_factor = Math.max(1,zoom);

  if (active_tweens.get(this)) {
    active_tweens.get(this).stop();
    active_tweens.delete(this);
  }

  ctx.clearRect(0, 0, canv.width, canv.height);

  let boundingrect = canv.getBoundingClientRect();
  canv.width = scale_factor*boundingrect.width;
  canv.height = scale_factor*boundingrect.height;
  ctx.scale(scale_factor,scale_factor);

  let offscreen = create_offscreen(canv,scale_factor);

  let offscreen_ctx = offscreen.getContext('2d');

  let renderer = this.viewer.renderer;

  let {start,end} = this.states;

  let tween = new Tween({...start})
  .to({...end}, this.duration);

  tween.on('update', () => {
    offscreen_ctx.clearRect(0, 0, canv.width, canv.height);
  });

  for (let res of residues) {
    let layout = renderer.layoutFor(res);
    if ( ! layout ) {
      continue;
    }

    let {x,y,width,height} = renderer.screenCoordinatesFromLayout(layout);

    x = x-boundingrect.left;
    y = y-boundingrect.top;

    tween.on('update', (state) => {
      // `res` lets draw() react to per-residue live state (e.g. whether
      // THIS residue is the one currently hovered) rather than just drawing
      // identical geometry for every highlighted residue.
      this.draw(state,{x, y, width, height, zoom },offscreen_ctx,res);
    });
  }

  autoPlay(true);
  active_tweens.set(this,tween);
  let tween_done = false;
  tween.on('complete', () => {
    tween_done = true;
  });

  let updater = () => {
    ctx.clearRect(0, 0, canv.width, canv.height);
    ctx.drawImage(offscreen, 0, 0);
    if ( ! tween_done ) {
      window.requestAnimationFrame(updater);
    }
  };
  window.requestAnimationFrame(updater);

  tween.start();

}

const canvas_symbol = Symbol('canvas');
const state_end = Symbol('state_end');
const state_start = Symbol('state_start');
const parent_viewer = Symbol('viewer');

class Highlighter {

  constructor(viewer,identifier) {
    this[parent_viewer] = viewer;
    this[canvas_symbol] = create_canvas(viewer,identifier);
    this.duration = 100
    this.draw = () => {}
  }

  get viewer() {
    return this[parent_viewer];
  }

  get canvas() {
    return this[canvas_symbol];
  }

  get identifier() {
    return this.canvas.getAttribute('id');
  }

  highlight(residues=[]) {
    return performHighlight.call(this,residues);
  }

  setStates(start,end) {
    this[state_start] = Object.freeze(start);
    this[state_end] = Object.freeze(end);
  }

  get states() {
    return { start: this[state_start] , end: this[state_end] };
  }

}

export default Highlighter;