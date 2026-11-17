import { DraggableForm, DragManager, ShadowDragDropTouch } from 'DragMenus';

export { IupacSugar } from './lite';

import {default as SViewerLite} from './lite';

export { SViewerLite }
export { registerRenderer, RegisteredRenderers } from './lite';

let wire_drag_functions = function() {
  if (this.form) {
    new DragManager(this);
    new DraggableForm(this.form);
  }
};

// sviewer no longer registers any renderer by name itself - it used to list
// text/fiziko/heraldic/.../celtic here directly, which meant sviewer depended
// on every one of those packages whether a given consumer used it or not
// (see workbench/plans/theme-takeover-architecture.md, Phase 5). Each site
// now registers only the renderer names it actually wants, via lite.js's
// registerRenderer(), from its own renderers.js - e.g. glycome's
// src/js/renderers.js, workbench's js/renderers.js. Those import from
// 'sviewer/lite' directly rather than this file's bare 'sviewer' re-export
// above (the re-export works for Node's own "main"-field resolution, but
// this package's "module" field points bundlers like webpack at main.js
// instead, which only exposes namespaced bundles, not this flat name - see
// glycome's renderers.js for the full explanation). A consumer that doesn't
// register a name it then uses sees ccg-sviewer-lite's own console warning
// (lite.js's getRendererClass) rather than a silent fallback to plain
// SVGRenderer.

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