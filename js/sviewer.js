/* globals document,HTMLElement,HTMLLabelElement,HTMLSlotElement,MutationObserver,Event,customElements,window,requestAnimationFrame,cancelAnimationFrame,fetch,ShadyCSS,Node */
'use strict';

import * as debug from 'debug-any-level';

import * as Glycan from 'glycan.js';

import ImageSaver from './imagesaver';

import { DraggableForm, DragManager } from 'DragMenus';

const module_string='sviewer:sviewer';

const log = debug(module_string);

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
    --palette-icon-size: 32px;
    --demoted-opacity: 0.5;
  }

  :host([resizeable]) {
    resize: both;
    overflow: auto;
  }

  :host([resizeable]) .widget_contents {
    width: calc(100% - 5px);
    height: calc(100% - 5px);
  }

  :host .widget_contents > div > svg {
    width: 100%;
    height: 100%;
    pointer-events: auto;
    font-family: Helvetica, sans-serif;
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
    display: none;
  }


  :host([editable]) .palette {
    display: block;
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
    top: auto;
    bottom: 0px;
    height: auto;
    font-family: sans-serif;
  }

  :host #textbox {
    display: none;
  }


  :host([showsequence]) #textbox {
    display: block;
  }

  :host * {
    -webkit-tap-highlight-color: rgba(0,0,0,0);
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

  :host x-piemenu[active] label[data-weight^="-"] {
    opacity: calc( -1 * var(--weight) * var(--demoted-opacity) );
  }

  :host x-piemenu button, x-piemenu label {
    font-family: sans-serif;
    font-size: var(--icon-size);
  }

  :host x-piemenu button.hover, x-piemenu label.hover, x-piemenu button:hover, x-piemenu label:hover {
    background: #6052E2;
    color: #ffffff;
  }

  :host x-piemenu button[data-weight^="-"].hover, x-piemenu label[data-weight^="-"].hover, x-piemenu button[data-weight^="-"]:hover, x-piemenu label[data-weight^="-"]:hover {
    background: #FFE2E2;
    opacity: 1;
    color: #000000;
  }


  :host #icons {
    display: none;
  }

  @media only screen
    and (min-device-width: 320px)
    and (max-device-width: 480px)
    and (-webkit-min-device-pixel-ratio: 2) {
    :host {
      --palette-icon-size: 32px;
    }
    :host x-piemenu {
      --end-angle: 135;
      --start-angle: 35;
      --icon-position-ratio: 0.1;
      --icon-size: 24px;
      width: 200px;
      height: 200px;
    }
  }

  :host .palette label[data-disabled] {
    opacity: 0.2;
    pointer-events: none;
  }

  :host .palette label[data-weight^="-"] {
    opacity: var(--demoted-opacity);
  }


  :host .palette label.checked {
    background: #faa;
  }

  :host .palette label[draggable] {
    display: block;
    width: var(--palette-icon-size);
    height: var(--palette-icon-size);
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
    <slot id="textcontent"> </slot>
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

let show_anomer = function(residue,target) {
  if ( ! this.hasAttribute('editable')) {
    return;
  }
  let anomer_chooser = this.shadowRoot.getElementById('anomer_menu');
  let form = this.form;
  if (form.clear) {
    form.clear();
  }
  log.info('Setting target to',residue.identifier);
  delete form.active_residue;
  form.residue = residue;
  let event = new Event('change',{bubbles: true});
  form.dispatchEvent(event);

  anomer_chooser.removeAttribute('active');
  let zoom = parseFloat((window.innerWidth / window.document.documentElement.clientWidth).toFixed(2));
  let target_pos = target.getBoundingClientRect();
  let vals = { top: target_pos.top ,left: target_pos.left ,width: target_pos.width ,height: target_pos.height };

  if (vals.width < 5) { // Transforms are not being taken into account on the use element
                        // in Firefox. https://bugzilla.mozilla.org/show_bug.cgi?id=1066435
                        // Look for elements that are too small, and scale up.
    vals.width = vals.width * 100;
    vals.height = vals.height * 100;
  }
  let anomer_size = anomer_chooser.getBoundingClientRect();
  let palette_top = (anomer_chooser.parentNode.getBoundingClientRect().top/zoom);
  let palette_left = (anomer_chooser.parentNode.getBoundingClientRect().left/zoom);
  let left_pos = (((vals.left + 0.5*vals.width - 0.5*anomer_size.width)/zoom) - palette_left).toFixed(2);
  let top_pos = (((vals.top+0.5*vals.height  - 0.5*anomer_size.height)/zoom) - palette_top).toFixed(2);
  left_pos = ((vals.left + 0.5*vals.width - 0.5*anomer_size.width)/zoom).toFixed(2);
  anomer_chooser.style.transformOrigin = `${left_pos}px ${top_pos}px`;
  anomer_chooser.style.transform = `scale(1) translate(${left_pos}px,${top_pos}px)`;
  anomer_chooser.setAttribute('active',true);
  anomer_chooser.clear();
};

let enableDropResidue = function(renderer,residue) {
  residue.renderer = renderer;
  let target = renderer.rendered.get(residue).residue;
  if (target.style.pointerEvents === 'all') {
    return;
  }
  target.style.pointerEvents = 'all';
  let form = this.form;

  target.addEventListener('dragleave', () => {
    delete form.active_residue;
  });

  target.addEventListener('click', (ev) => show_anomer.bind(this,residue)(ev.target) );
  target.addEventListener('dragenter', (ev) => {
    if (! this.hasAttribute('editable')) {
      return;
    }
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

let redraw_sugar = function() {
  if (this.renderer.sugars[0].sequence !== this.sequence) {
    this.renderer.sugars[0].sequence = this.sequence;
  }
  this.renderer.refresh();
  for (let residue of this.renderer.sugars[0].composition() ) {
    enableDropResidue.call( this, this.renderer,residue );
  }
  this.renderer.scaleToFit();
};


let wire_renderer_canvas_events = function() {
  let canvas = this.renderer.element.canvas;

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

  this.addEventListener('dragend', () => {
    setTimeout(() =>{
      this.form.reset();
    },100);
  });

};

let wire_renderer_fisheye = function() {

  let canvas = this.renderer.element.canvas;
  let renderer = this.renderer;

  let last_req;
  canvas.addEventListener('dragover', (ev) => {
    if (this.shadowRoot.querySelectorAll('x-piemenu[active]').length > 0) {
      return;
    }
    if (! this.hasAttribute('editable')) {
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

  document.addEventListener('dragend', () => {
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


let wire_drag_functions = function() {
  new DragManager(this);
  new DraggableForm(this.form);
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
  this.form.addEventListener('reset', function() {
    delete this.residue;

    for (let sib of this.donor) {
      sib.parentNode.classList.remove('checked');
    }
  });
};

const wire_palette_watcher = (label) => {
  let config = { attributes: true, subtree: true,attributeFilter: ['disabled','data-weight'] };
  // Callback function to execute when mutations are observed
  let callback = function(mutationsList) {
      for(let mutation of mutationsList) {
          if (mutation.target === label) {
            return;
          }
          if (mutation.type == 'attributes') {
              if (label.querySelector('input[disabled]')) {
                label.setAttribute('data-disabled','');
              } else {
                label.removeAttribute('data-disabled');
              }
              if (label.querySelector('input[data-weight]')) {
                label.setAttribute('data-weight',label.querySelector('input[data-weight]').getAttribute('data-weight'));
              } else {
                label.removeAttribute('data-weight');
              }
          }
      }
  };

  let observer = new MutationObserver(callback);

  observer.observe(label, config);

  // Later, you can stop observing
  // observer.disconnect();
};

let populate_palette = function(widget,palette) {
  let icons = widget.shadowRoot.getElementById('icons');
  widget.donors=['Gal','Glc','Man','GalNAc','GlcNAc','NeuAc','NeuGc','GlcA','IdoA','Xyl','Fuc'];
  fetch('/sugars.svg')
  .then((response) => response.text())
  .then( (xml) => icons.innerHTML = xml )
  .then( () => {

    for (let sug of widget.donors) {
      let palette_entry = palette_template.content.cloneNode(true);
      palette_entry.querySelector('use').setAttribute('xlink:href',`#${sug.toLowerCase()}`);
      palette_entry.querySelector('input').setAttribute('value',sug);
      palette.appendChild(palette_entry);
      wire_palette_watcher(palette.lastElementChild);
    }
  });
};

let form_action = function(widget,ev) {
  ev.preventDefault();
  ev.stopPropagation();

  let Iupac = Glycan.CondensedIupac.IO;

  let IupacSugar = Iupac(Glycan.Sugar);

  let sug = new IupacSugar();
  sug.sequence = this.donor.value;

  let new_res = sug.root;
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

let initialise_events = function() {
  log.info('Initialising global events');
  wire_drag_functions.call(this);
  wire_palette_pagezoom.call(this);
  wire_form_check_class.call(this);
  wire_form_action.call(this);
  log.info('Initialised global events');
};

let initialise_renderer = function() {
  Glycan.FishEyeLayout.LINKS = this.hasAttribute('links') ? true : false;
  let Iupac = Glycan.CondensedIupac.IO;

  let IupacSugar = Iupac(Glycan.Sugar);

  this.renderer = new Glycan.SVGRenderer(this.shadowRoot.getElementById('output'),Glycan.FishEyeLayout);
  this.renderer.rotate = this.hasAttribute('horizontal');
  log.info('Wiring canvas events');
  wire_renderer_canvas_events.call(this);
  wire_renderer_fisheye.call(this);
  log.info('Wired canvas events');
  let sug = new IupacSugar();
  this.renderer.addSugar(sug);
  if (this.sequence) {
    redraw_sugar.call(this);
  }
};

const sequence_symbol = Symbol('sequence');

if (window.ShadyCSS) {
  ShadyCSS.prepareTemplate(tmpl, 'x-sviewer');
}

class SViewer extends WrapHTML {

  static get observedAttributes() {
    return ['links','horizontal'];
  }

  constructor() {
    super();
    log('Initiating Sviewer element');
  }


  save() {
    ImageSaver(this,this.renderer.element.canvas,'svg');
  }

  attributeChangedCallback(name) {
    if (name === 'links') {
      if (this.hasAttribute('links')) {
        Glycan.FishEyeLayout.LINKS = true;
      } else {
        Glycan.FishEyeLayout.LINKS = false;
      }
      if (this.renderer) {
        this.renderer.refresh();
        this.renderer.scaleToFit();
      }
    }
    if (name === 'horizontal') {
      if ( ! this.renderer ) {
        return;
      }

      if (this.hasAttribute('horizontal')) {
        this.renderer.rotate = true;
      } else {
        this.renderer.rotate = false;
      }
      this.renderer.refresh();
      setTimeout(() => this.renderer.scaleToFit(),500);
    }
  }

  connectedCallback() {
    if (window.ShadyCSS) {
      ShadyCSS.styleElement(this);
    }
    let shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(tmpl.content.cloneNode(true));

    this.form = this.shadowRoot.getElementById('new_linkage');

    let slot = this.shadowRoot.getElementById('textcontent');

    this[sequence_symbol] = slot.assignedNodes()[0].textContent;

    if (slot.assignedNodes()[0] instanceof HTMLSlotElement) {
      this[sequence_symbol] = slot.assignedNodes()[0].assignedNodes()[0].textContent;
    }

    slot.addEventListener('slotchange', () => {
      this[sequence_symbol] = (slot.assignedNodes().filter( node => node.nodeType === Node.TEXT_NODE )).map( n => n.textContent).join('');
      this[sequence_symbol] = this[sequence_symbol].replace(/^\s+/,'').replace(/\s+$/,'');
      slot.assignedNodes()[0].textContent = this[sequence_symbol];
      if (this.sequence) {
        redraw_sugar.call(this);
      }
    });

    populate_palette(this,this.shadowRoot.getElementById('palette'));


    initialise_renderer.call(this);
    initialise_events.call(this);
  }

  set sequence(seq) {
    if (this.sequence !== seq) {
      this.textContent = seq;
    }
    return seq;
  }
  get sequence() {
    return this[sequence_symbol];
  }
}

customElements.define('x-sviewer',SViewer);

export default SViewer;