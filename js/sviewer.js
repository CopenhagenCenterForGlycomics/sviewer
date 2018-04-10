/* globals document,HTMLElement,customElements,window */
'use strict';

import * as debug from 'debug-any-level';

import * as Glycan from 'glycan.js';

const module_string='sviewer:sviewer';

const log = debug(module_string);

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
  }

  :host[resizeable] {
    resize: both;
    overflow: auto;
  }

  :host[resizeable] .widget_contents > div > svg {
    width: calc(100% - 5px);
    height: calc(100% - 5px);
  }

  :host .widget_contents > div > svg {
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }

  :host .widget_contents > div > svg * {
    -moz-transition: all 0.5s ease-in-out;
    -o-transition: all 0.5s ease-in-out;
    -webkit-transition: all 0.5s ease-in-out;
    transition: all 0.5s ease-in-out;
  }

  :host .widget_contents > div > svg {
    -moz-transition: all 0.5s ease-in-out;
    -o-transition: all 0.5s ease-in-out;
    -webkit-transition: all 0.5s ease-in-out;
    transition: all 0.5s ease-in-out;
  }

  :host .widget_contents {
    position: absolute;
    left: 0px;
    right: 0px;
    top: 0px;
    bottom: 0px;
    width: 100%;
    height: 100%;
  }

  :host .pie_parent {
    position: fixed;
    top: 0px;
    left: 0px;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  :host .widget_contents > div {
    position: absolute;
    top: 0px;
    left: 0px;
    height: 100%;
    width: 100%;
  }

  :host .palette {
    position: absolute;
    top: 0px;
    left: 0px;
    right: 0px;
    background: #eee;
    pointer-events: auto;
  }

  :host #textbox {
    pointer-events: none;
  }

  :host x-piemenu {
    position: absolute;
    top: 0px;
    left: 0px;
    pointer-events: none;
    width: 150px;
    height: 150px;
    z-index: 2;
    --end-angle: 60;
    --start-angle: -60;
    --icon-size: 10px;
  }

  :host x-piemenu[active] label {
    pointer-events: all;
  }

  :host x-piemenu button, x-piemenu label {
    font-family: sans-serif;
    font-size: var(--icon-size);
  }

  :host x-piemenu button.hover, x-piemenu label.hover, x-piemenu button:hover, x-piemenu label:hover {
    background: #6052E2;
    color: #ffffff;
  }

  :host #icons {
    display: none;
  }

  @media only screen
    and (min-device-width: 320px)
    and (max-device-width: 480px)
    and (-webkit-min-device-pixel-ratio: 2) {
    :host x-piemenu {
      --end-angle: 135;
      --start-angle: 35;
      --icon-position-ratio: 0.1;
      --icon-size: 24px;
      width: 200px;
      height: 200px;
    }
  }
  :host .palette label.checked {
    background: #faa;
  }

  :host .palette label[draggable] {
    display: block;
    width: 25px;
    height: 25px;
    -webkit-user-drag: element;
    float: left;
  }
  :host .palette label[draggable] input {
    display: none;
  }

</style>
<div class="widget_contents" >
  <div id="icons"></div>
  <div id="output"></div>
  <form id="new_linkage">
    <div id="palette" class="palette">
    <label draggable="true">
    <svg width="100%" height="100%" viewBox="0 0 100 100">
      <use x="0.0" y="0.0" width="100" height="100" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#gal"></use>
    </svg>
    <input name="donor" value="Gal" type="radio">
    </label>
    </div>
    <div class="pie_parent">
      <x-piemenu name="anomer" id="anomer_menu" data-next="linkage_menu">
        <label><span>α</span><input name="anomer" value="a" type="radio"></label>
        <label><span>β</span><input name="anomer" value="b" type="radio"></label>
        <label><span>?</span><input name="anomer" value="?" type="radio"></label>
      </x-piemenu>
      <x-piemenu name="linkage" id="linkage_menu">
        <label><span>2</span><input name="linkage" value="2" type="radio"></label>
        <label><span>3</span><input name="linkage" value="3" type="radio"></label>
        <label><span>4</span><input name="linkage" value="4" type="radio"></label>
        <label><span>6</span><input name="linkage" value="6" type="radio"></label>
        <label><span>8</span><input name="linkage" value="8" type="radio"></label>
      </x-piemenu>
    </div>
  </form>
  <div id="textbox">
    <slot id="textcontent"></slot>
  </div>
</div>
`;

const palette_template = document.createElement('template');

palette_template.innerHTML = `
  <label draggable="true">
  <svg width="100%" height="100%" viewBox="0 0 100 100">
    <use x="0.0" y="0.0" width="100" height="100" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#neuac"></use>
  </svg>
  <input name="donor" value="NeuAc" type="radio">
  </label>
`;

function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);


let rescale_widget_chrome = function(state) {
  let zoom = parseFloat((window.innerWidth / window.document.documentElement.clientWidth).toFixed(2));
  let top = window.scrollY;
  let left = window.scrollX;
  let palette = this.shadowRoot.querySelector('.palette');
  let pie_parent = this.shadowRoot.querySelector('.pie_parent');
  palette.style.transformOrigin = `${window.scrollX}px ${top}px`;
  let widget_pos = palette.parentNode.parentNode.getBoundingClientRect();
  if (widget_pos.top < 0 && widget_pos.left < 0) {
    palette.style.position = 'fixed';
  } else {
    palette.style.position = 'absolute';
  }

  if (zoom < 0.8) {
    left -= palette.parentNode.parentNode.offsetLeft/zoom;
    palette.style.width = (50/zoom)+'%';
  } else {
    palette.style.width='100%';
  }
  palette.style.transform = `scale(${zoom}) translate(${left}px,${top}px)`;
  pie_parent.style.transformOrigin = `${window.scrollX}px ${top}px`;
  pie_parent.style.transform = `scale(${zoom}) translate(${left}px,${top}px)`;
  state.ticking = false;
};

let window_scroll_listener = () => {
  let state = window_scroll_listener.state;
  if (! window_scroll_listener.state.ticking) {
    window.requestAnimationFrame(rescale_widget_chrome.bind(state.owner,state));
    window_scroll_listener.state.ticking = true;
  }
};

let wire_palette_pagezoom = function() {
  window_scroll_listener.state = { ticking: false, owner: this };
  window.removeEventListener('scroll',window_scroll_listener);
  window.addEventListener('scroll', window_scroll_listener);
};

let unwire_palette_pagezoom = () => {
  window.removeEventListener('scroll',window_scroll_listener);
}

let redraw_sugar = function() {
  this.renderer.sugars[0].sequence = this.sequence;
  this.renderer.refresh();
  for (let residue of this.renderer.sugars[0].composition() ) {
    enableDropResidue.call( this, this.renderer,residue );
  }
  this.renderer.scaleToFit();
};

let initialise_events = function() {
  console.log("Initialising global events");
  wire_drag_functions.call(this);
  wire_palette_pagezoom.call(this);
  wire_form_check_class.call(this);
  wire_form_action.call(this);
  console.log("Initialised global events");
};

let initialise_renderer = function() {
  let Iupac = Glycan.CondensedIupac.IO;

  let IupacSugar = Iupac(Glycan.Sugar);

  this.renderer = new Glycan.SVGRenderer(this.shadowRoot.getElementById('output'),Glycan.FishEyeLayout);
  console.log("Wiring canvas events");
  wire_renderer_canvas_events.call(this);
  wire_renderer_fisheye.call(this);
  console.log("Wired canvas events");
  let sug = new IupacSugar();
  sug.sequence = this.sequence || 'Gal';
  this.renderer.addSugar(sug);
  this.renderer.refresh();
  this.renderer.scaleToFit();
};

let wire_renderer_canvas_events = function() {
  let canvas = this.renderer.element.canvas;
  let renderer = this.renderer;

  canvas.addEventListener('click', (ev) => {
    if (ev.target !== canvas) {
      return;
    }
    this.form.clear();
  });

  canvas.addEventListener('dragleave', (ev) => {
    if (ev.relatedTarget === canvas) {
      setTimeout(() =>{
        this.form.clear();
        delete this.form.active_residue;
        delete this.form.residue;
      },100);
      return;
    }
  });

  this.addEventListener('dragend', (ev) => {
    setTimeout(() =>{
      this.form.reset();
    },100);
  });

};

let wire_renderer_fisheye = function() {

  let canvas = this.renderer.element.canvas;
  let renderer = this.renderer;

  let last_req;
  canvas.addEventListener('dragmove', (ev) => {
    if (this.shadowRoot.querySelectorAll('x-piemenu[active]').length > 0) {
      return;
    }
    Glycan.FishEyeLayout.focus = [ ev.svgX, ev.svgY ];
    let vp_zoom = parseFloat((window.innerWidth / window.document.documentElement.clientWidth).toFixed(2));
    let candidate_zoom = parseFloat((vp_zoom * vp_zoom * 3).toFixed(2));
    Glycan.FishEyeLayout.zoom = candidate_zoom < 0.1 ? 0.1 : candidate_zoom;
    Glycan.FishEyeLayout.lock_residues = true;
    if (last_req) {
      cancelAnimationFrame(last_req);
    }
    last_req = requestAnimationFrame(function() {
      renderer.refresh();
    });
  });

  this.addEventListener('dragend', (ev) => {
    Glycan.FishEyeLayout.focus = [ -1000, -1000 ];
    if (last_req) {
      cancelAnimationFrame(last_req);
    }
    last_req = requestAnimationFrame(function() {
      renderer.refresh();
    });
  });

};

// let set_glycan_sequence = function() {

//     Glycan.FishEyeLayout.LINKS = true;
//     let renderer = global_renderer;

//     renderer.refresh();
//     renderer.scaleToFit();
//     sug.composition().map( enableDropResidue.bind(null,renderer) );
// };


let show_anomer = function(residue,target) {
  let anomer_chooser = this.shadowRoot.getElementById('anomer_menu');
  let form = this.form;
  form.clear && form.clear();
  console.log("Setting target to ",residue.identifier);
  delete form.active_residue;
  form.residue = residue;
  anomer_chooser.removeAttribute('active');
  let zoom = parseFloat((window.innerWidth / window.document.documentElement.clientWidth).toFixed(2));
  let target_pos = target.getBoundingClientRect();
  let vals = { top: target_pos.top ,left: target_pos.left ,width: target_pos.width ,height: target_pos.height };
  let anomer_size = anomer_chooser.getBoundingClientRect();
  let palette_top = (anomer_chooser.parentNode.getBoundingClientRect().top/zoom);
  let palette_left = (anomer_chooser.parentNode.getBoundingClientRect().left/zoom);

  let left_pos = (((vals.left + 0.5*vals.width - 0.5*anomer_size.width)/zoom) - palette_left).toFixed(2);
  let top_pos = (((vals.top+0.5*vals.height  - 0.5*anomer_size.height)/zoom) - palette_top).toFixed(2);

  anomer_chooser.style.transformOrigin = `${left_pos}px ${top_pos}px`;
  anomer_chooser.style.transform = `scale(1) translate(${left_pos}px,${top_pos}px)`;
  anomer_chooser.setAttribute('active',true);
  anomer_chooser.clear();
};

let enableDropResidue = function(renderer,residue) {
  residue.renderer = renderer;
  let target = renderer.rendered.get(residue).residue;
  target.style.pointerEvents = 'all';
  let form = this.form;

  target.addEventListener('dragleave', (ev) => {
    delete form.active_residue;
  });

  target.addEventListener('click', (ev) => show_anomer.bind(this,residue)(ev.target) );
  target.addEventListener('dragenter', (ev) => {
    if (form.residue === residue) {
      return;
    }

    if (form.active_residue === residue) {
      return;
    }

    form.clear();

    // We should wait for a drag over at least 300 ms after
    // to set the target
    form.active_residue = residue;

    if (form.menu_timeout) {
      clearTimeout(form.menu_timeout);
    }

    form.menu_timeout = setTimeout(show_anomer.bind(this,residue,ev.target),500);
  });
};


let wire_drag_functions = function() {
  new Glycan.DragManager(this);
  new Glycan.DraggableForm(this.form);
};

let wire_form_check_class = function() {
  this.form.addEventListener('change', function(ev) {
    if (ev.target && ev.target.parentNode instanceof HTMLLabelElement) {
      let targ = ev.target;
      if (targ.name !== 'donor') {
        return;
      }
      for (let sib of this[targ.name]) {
        if (sib === targ) {
          sib.parentNode.classList.add('checked');
        } else {
          sib.parentNode.classList.remove('checked');
        }
      }
    }
  });
  this.form.addEventListener('reset', function(ev) {
    delete this.residue;

    for (let sib of this['donor']) {
      sib.parentNode.classList.remove('checked');
    }
  });
};

let populate_palette = function(widget,palette) {
  let icons = widget.shadowRoot.getElementById('icons');
  widget.donors=['Gal','Glc','GalNAc'];
  fetch('/sugars.svg')
  .then((response) => response.text())
  .then( (xml) => icons.innerHTML = xml )
  .then( () => {
    for (let sug of widget.donors) {
      let palette_entry = palette_template.content.cloneNode(true);
      palette_entry.querySelector('use').setAttribute('xlink:href',`#${sug.toLowerCase()}`);
      palette_entry.querySelector('input').setAttribute('value',sug);
      palette.appendChild(palette_entry);
    }
  });
};

let form_action = function(widget,ev) {
  ev.preventDefault();
  ev.stopPropagation();

  let new_res = new Glycan.Monosaccharide(this.donor.value);
  new_res.anomer = this.anomer.value;
  new_res.parent_linkage = this.donor.value.match(/Neu(Gc|Ac)/) ? 2 : 1;
  this.residue.addChild(parseInt(this.linkage.value),new_res);
  this.residue.balance();
  this.residue.renderer.refresh();
  enableDropResidue.call( widget, this.residue.renderer,new_res);
  this.residue.renderer.scaleToFit();
  widget.sequence = this.residue.renderer.sugars[0].sequence;
  this.reset();
  return false;
};

let wire_form_action = function(){
  this.form.addEventListener('finished', form_action.bind(this.form,this));
};

const sequence_symbol = Symbol('sequence');

ShadyCSS.prepareTemplate(tmpl, 'x-sviewer');


class SViewer extends WrapHTML {
  constructor() {
    super();
    log('Initiating Sviewer element');

    ShadyCSS.styleElement(this);

    let shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(tmpl.content.cloneNode(true));

    this.form = shadowRoot.getElementById('new_linkage');

    let slot = shadowRoot.getElementById('textcontent');

    slot.addEventListener('slotchange', () => {
      this[sequence_symbol] = (slot.assignedNodes().filter( node => node.nodeType === Node.TEXT_NODE )).map( n => n.textContent).join('');
      if (this.sequence) {
        redraw_sugar.call(this);
      }
    });

    populate_palette(this,shadowRoot.getElementById('palette'));
  }

  connectedCallback() {
    initialise_renderer.call(this);
    initialise_events.call(this);
  }

  set sequence(seq) {
    this.textContent = seq;
    return seq;
  }
  get sequence() {
    return this[sequence_symbol];
  }
}

customElements.define('x-sviewer',SViewer);

export default SViewer;