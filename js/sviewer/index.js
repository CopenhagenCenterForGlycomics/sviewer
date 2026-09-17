import { SNFGFiziko } from 'glycan.js/renderers/fiziko';

import { SVGRenderer, CanvasRenderer } from 'glycan.js';

import { DraggableForm, DragManager, ShadowDragDropTouch } from 'DragMenus';

export { IupacSugar } from './lite';

import {default as SViewerLite} from './lite';

export { SViewerLite }

let wire_drag_functions = function() {
  if (this.form) {
    new DragManager(this);
    new DraggableForm(this.form);
  }
};

// sketch/legra each pull in a whole extra drawing library (roughjs, legra)
// that only matters for those two rarely-used renderer modes - loading
// them lazily (a function here, resolved by getRendererClass()) keeps
// roughjs/legra out of the main bundle, in their own webpack chunk that's
// only fetched the first time that renderer is actually selected.
const renderers = new Map(Object.entries({
  svg: SVGRenderer,
  canvas: CanvasRenderer,
  sketch: () => import(/* webpackChunkName: "renderer-sketch" */ 'rough-glycan.js').then(m => m.RoughCanvasRenderer),
  fiziko: SNFGFiziko,
  legra: () => import(/* webpackChunkName: "renderer-legra" */ 'legra-glycan.js').then(m => m.LegraCanvasRenderer),
  zdog: () => import(/* webpackChunkName: "renderer-zdog" */ 'zdog-glycan.js').then(m => m.ZDogCanvasRenderer),
}));

class SViewer extends SViewerLite {

  static get RegisteredRenderers() {
    return renderers;
  }


  connectedCallback() {

    super.connectedCallback();

    new ShadowDragDropTouch(this);

    wire_drag_functions.call(this);
    this.form.style.display = 'block';

  }
}

customElements.define('ccg-sviewer',SViewer);

export default SViewer;