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

  @media only screen
    and (min-device-width: 320px)
    and (max-device-width: 480px)
    and (-webkit-min-device-pixel-ratio: 2) {
    x-piemenu {
      --end-angle: 135;
      --start-angle: 35;
      --icon-position-ratio: 0.1;
      --icon-size: 24px;
      width: 200px;
      height: 200px;
    }
  }
</style>
<div class="widget_contents" >
  <div id="output"></div>
  <form id="new_linkage">
    <div class="palette">
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

function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);

let wire_palette_pagezoom = () => {
  let ticking = false;
  window.addEventListener('scroll', function(e) {

  if (!ticking) {

    window.requestAnimationFrame(function() {
      let zoom = parseFloat((window.innerWidth / document.documentElement.clientWidth).toFixed(2));
      let top = window.scrollY;
      let left = window.scrollX;
      let palette = document.querySelector(':host .palette');
      let pie_parent = document.querySelector(':host .pie_parent');
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
      ticking = false;
    });
    ticking = true;
  }
  });
};


let redraw_sugar = function() {
  this.renderer.sugars[0].sequence = this.sequence;
  this.renderer.refresh();
  this.renderer.scaleToFit();
};

let initialise_renderer = function() {
  let Iupac = Glycan.CondensedIupac.IO;

  let IupacSugar = Iupac(Glycan.Sugar);

  this.renderer = new Glycan.SVGRenderer(this.shadowRoot.getElementById('output'),Glycan.FishEyeLayout);
  let sug = new IupacSugar();
  sug.sequence = 'Gal(b1-3)GlcNAc';
  this.renderer.addSugar(sug);
  this.renderer.refresh();
  this.renderer.scaleToFit();
};

let set_glycan_sequence = function() {
    if ( ! global_renderer ) {
      global_renderer = new Glycan.SVGRenderer(document.getElementById('output'),Glycan.FishEyeLayout);
    }
    console.log(seq);
    let sug = new Glycan.IupacSugar();
    sug.sequence = seq;
    sug.root.setTag(tag_symbol);
    Glycan.FishEyeLayout.LINKS = true;
    let renderer = global_renderer;

    renderer.groupTag = tag_symbol;

    renderer.addSugar(sug);

    let last_req = null;

    renderer.element.canvas.addEventListener('click', (ev) => {
      if (ev.target !== renderer.element.canvas) {
        return;
      }
      document.getElementById('new_linkage').clear();
    });

    renderer.element.canvas.addEventListener('dragleave', (ev) => {
      if (ev.relatedTarget === renderer.element.canvas) {
        setTimeout(() =>{
          document.getElementById('new_linkage').clear();
          delete document.getElementById('new_linkage').active_residue;
          delete document.getElementById('new_linkage').residue;
        },100);
        return;
      }
    });
    document.body.addEventListener('dragend', (ev) => {
      setTimeout(() =>{
        document.getElementById('new_linkage').reset();
      },100);

      Glycan.FishEyeLayout.focus = [ -1000, -1000 ];
      if (last_req) {
        cancelAnimationFrame(last_req);
      }
      last_req = requestAnimationFrame(function() {
        renderer.refresh();
      });
    });

    renderer.element.canvas.addEventListener('dragover', (ev) => {
      if (document.querySelectorAll('x-piemenu[active]').length > 0) {
        return;
      }

      Glycan.FishEyeLayout.focus = [ ev.svgX, ev.svgY ];
      let [min_x,min_y,width,height] = renderer.element.canvas.getAttribute('viewBox').split(' ').map( val => parseFloat(val) );
      let vp_zoom = parseFloat((window.innerWidth / document.documentElement.clientWidth).toFixed(2));
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

    renderer.refresh();
    renderer.scaleToFit();
    sug.composition().map( enableDropResidue.bind(null,renderer) );
};


  let show_anomer = function(residue,ev) {
    let anomer_chooser = document.getElementById('anomer_menu');
    let form = document.getElementById('new_linkage');
    form.clear && form.clear();
    console.log("Setting target to ",residue.identifier);
    delete form.active_residue;
    form.residue = residue;
    anomer_chooser.removeAttribute('active');
    let zoom = parseFloat((window.innerWidth / document.documentElement.clientWidth).toFixed(2));
    let target_pos = ev.target.getBoundingClientRect();
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
    let form = document.getElementById('new_linkage');

    target.addEventListener('dragleave', (ev) => {
      delete form.active_residue;
    });
    target.addEventListener('click', show_anomer.bind(null,residue) );
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

      form.menu_timeout = setTimeout(show_anomer.bind(null,residue,ev),500);
    });
  };


let setup_drags = function() {
    new Glycan.DragManager(document.body);
    new Glycan.DraggableForm(document.getElementById('new_linkage'));
    document.getElementById('new_linkage').addEventListener('change', function(ev) {
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
    document.getElementById('new_linkage').addEventListener('reset', function(ev) {
      delete this.residue;

      for (let sib of this['donor']) {
        sib.parentNode.classList.remove('checked');
      }

    });
    document.getElementById('new_linkage').addEventListener('submit', function(ev) {
      let new_res = new Glycan.Monosaccharide(this.donor.value);
      new_res.anomer = this.anomer.value;
      new_res.parent_linkage = this.donor.value.match(/Neu(Gc|Ac)/) ? 2 : 1;
      this.residue.addChild(parseInt(this.linkage.value),new_res);
      this.residue.balance();
      this.residue.renderer.refresh();
      enableDropResidue(this.residue.renderer,new_res);
      this.residue.renderer.scaleToFit();
      console.log(this.residue.renderer.sugars[0].sequence);
      this.reset();
    });
};

const sequence_symbol = Symbol('sequence');

class SViewer extends WrapHTML {
  constructor() {
    super();
    log('Initiating Sviewer element');

    let shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(tmpl.content.cloneNode(true));
    let slot = shadowRoot.getElementById('textcontent');
    slot.addEventListener('slotchange', () => {
      this[sequence_symbol] = (slot.assignedNodes().filter( node => node.nodeType === Node.TEXT_NODE )).map( n => n.textContent).join('');
      if (this.sequence) {
        redraw_sugar.call(this);
      }
    });
  }

  connectedCallback() {
    initialise_renderer.call(this);
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