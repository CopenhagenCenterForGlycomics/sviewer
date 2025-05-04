import { RoughCanvasRenderer } from 'rough-glycan.js';

import { SVGRenderer, CanvasRenderer } from 'glycan.js';

import { DraggableForm, DragManager, ShadowDragDropTouch } from 'DragMenus';

export { IupacSugar } from './lite';

import {default as SViewerLite} from './lite';

let wire_drag_functions = function() {
  if (this.form) {
    new DragManager(this);
    new DraggableForm(this.form);
  }
};

const renderers = new Map(Object.entries({
  svg: SVGRenderer,
  canvas: CanvasRenderer,
  sketch: RoughCanvasRenderer
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