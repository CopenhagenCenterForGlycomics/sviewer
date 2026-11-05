import { SNFGFiziko } from 'glycan.js/renderers/fiziko';
import { SNFGHeraldic } from 'glycan.js/renderers/heraldic';
import { SugarTextRenderer } from 'glycan.js/renderers/text';

import { DraggableForm, DragManager, ShadowDragDropTouch } from 'DragMenus';

export { IupacSugar } from './lite';

import {default as SViewerLite, RegisteredRenderers as renderers} from './lite';

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
//
// Registered directly into lite.js's own shared `renderers` Map (imported
// above as `renderers`) rather than a separate Map of our own - SViewer used
// to override RegisteredRenderers with an entirely different Map object,
// which meant any ccg-sviewer-lite element (whose own RegisteredRenderers
// getter reads lite.js's Map, unaffected by this override) silently
// couldn't resolve 'text'/'fiziko'/'heraldic'/etc. at all, falling back to
// plain SVGRenderer no matter what its `renderer` attribute said - even
// though the attribute itself was set correctly.
renderers.set('text', SugarTextRenderer);
renderers.set('sketch', () => import(/* webpackChunkName: "renderer-sketch" */ 'rough-glycan.js').then(m => m.RoughCanvasRenderer));
renderers.set('sketch-svg', () => import(/* webpackChunkName: "renderer-sketch" */ 'rough-glycan.js').then(m => m.RoughSVGRenderer));
renderers.set('fiziko', SNFGFiziko);
renderers.set('heraldic', SNFGHeraldic);
renderers.set('legra', () => import(/* webpackChunkName: "renderer-legra" */ 'legra-glycan.js').then(m => m.LegraCanvasRenderer));
renderers.set('zdog', () => import(/* webpackChunkName: "renderer-zdog" */ 'zdog-glycan.js').then(m => m.ZDogCanvasRenderer));
renderers.set('isomer', () => import(/* webpackChunkName: "renderer-isomer" */ 'isomer-glycan.js').then(m => m.IsomerCanvasRenderer));
renderers.set('phoria', () => import(/* webpackChunkName: "renderer-phoria" */ 'phoria-glycan.js').then(m => m.PhoriaCanvasRenderer));

class SViewer extends SViewerLite {

  connectedCallback() {

    super.connectedCallback();

    new ShadowDragDropTouch(this);

    wire_drag_functions.call(this);
    this.form.style.display = 'block';

  }
}

customElements.define('ccg-sviewer',SViewer);

export default SViewer;