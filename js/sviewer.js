/* globals document,HTMLElement,HTMLLabelElement,MutationObserver,Event,customElements,window,requestAnimationFrame,cancelAnimationFrame,ShadyCSS,Node,ResizeObserver */
'use strict';

import * as debug from 'debug-any-level';

import {CondensedIupac, Mass, Sugar, Monosaccharide, LinkageLayoutFishEye, SugarAwareLayoutFishEye, SVGRenderer, CanvasRenderer, Repeat, Reaction } from 'glycan.js';

import { RoughCanvasRenderer } from 'rough-glycan.js';

import { default as ImageSaver, prepare as prepareImage } from './imagesaver';

import Highlighter from './highlighter';

import { default as repeatCallback, ModifiableRepeat } from './autorepeat';

import { DraggableForm, DragManager, ShadowDragDropTouch } from 'DragMenus';

const module_string='sviewer:sviewer';

const log = debug(module_string);

const Iupac = CondensedIupac.IO;

const IupacSugar = Mass(Iupac(Sugar));

class IupacReaction extends Iupac(Reaction) {}

const sequence_symbol = Symbol('sequence');

const donors_symbol = Symbol('donors');

const repeats_symbol = Symbol('repeats');

const highlighter_symbol = Symbol('highlighter');

const RESIDUE_SELECTION_TIMEOUT = 500;

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
    --palette-icon-size: 32px;
    --demoted-opacity: 0.5;
    --sugars-url:/sugars.svg;
    --palette-background-color: #eee;
    --selection-color: var(#6052E2,--selection-color);
    --button-default-background-color: var(#eee,--button-default-background-color);
    --button-color: var(#000,--button-color);
  }

  :host([resizeable]) {
    resize: both;
    overflow: auto;
  }

  :host([resizeable]) .widget_contents {
    width: calc(100% - 5px);
    height: calc(100% - 5px);
  }

  :host #output {
    display: flex;
    justify-content: center;
  }

  :host .widget_contents > div > svg {
    width: 100%;
    height: 100%;
    pointer-events: auto;
    font-family: Helvetica, sans-serif;
  }

  :host .widget_contents > div > canvas {
    object-fit: contain;
    width: 100%;
    height: 100%;
  }

  :host .widget_contents > div > svg * {
    -moz-transition: all 0.1s ease-in-out;
    -o-transition: all 0.1s ease-in-out;
    -webkit-transition: all 0.1s ease-in-out;
    transition: all 0.1s ease-in-out;
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
    z-index: 1;
    pointer-events: none;
  }

  :host .widget_contents > div {
    position: absolute;
    top: 0px;
    left: 0px;
    height: 100%;
    width: 100%;
  }

  :host([editable]) .highlight_canvas {
    position: absolute;
    left: 0px;
    width: 100%;
    top: var(--palette-height);
    height: calc( 100% - var(--palette-height));
  }

  :host([editable]) .widget_contents > div {
    top: var(--palette-height);
    height: calc( 100% - var(--palette-height));
  }

  :host .palette {
    display: none;
  }

  :host([editable]) .widget_contents {
    margin-top: var(--palette-height, 0px);
    height: calc( 100% - var(--palette-height, 0px));
  }

  :host([editable]) .palette {
    display: flex;
    flex-flow: row wrap;
    align-items: flex-start;
    justify-content: space-between;
    margin-top: calc(-1 *  var(--palette-height, 0px));
  }

  :host([editable]) .palette:after {
    content: "";
    flex: auto;
  }


  :host .palette {
    position: absolute;
    top: 0px;
    left: 0px;
    right: 0px;
    background: var(--palette-background-color);
    pointer-events: auto;
    overflow: hidden;
    width: var(--expandedwidth);
    background: none;
    height: auto;
    min-height: calc(var(--palette-icon-size) + 5px);
  }

  :host #palette_closer_wrap {
    filter: drop-shadow(3px 2px 2px rgba(50, 50, 0, 0.5));
  }

  :host #palette_closer:hover {
    background-color: var(--selection-color);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Cstyle%3E* %7B stroke-width: 0.05; stroke: rgba(0,0,0,1); fill: none;%7D line %7B stroke: rgba(255,255,255,1) %7D %3C/style%3E%3Ccircle cx='0.5' cy='0.5' r='0.4' /%3E%3Cline x1='0.5' y1='0.25' x2='0.5' y2='0.75' /%3E%3Cline y1='0.5' x1='0.25' y2='0.5' x2='0.75' /%3E%3C/svg%3E");
  }

  :host #palette_closer {
    background-color: var(--button-default-background-color);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Cstyle%3E* %7B stroke-width: 0.05; stroke: rgba(0,0,0,1); fill: none;%7D line %7B stroke: rgba(255,255,255,1) %7D %3C/style%3E%3Ccircle cx='0.5' cy='0.5' r='0.4' /%3E%3Cline x1='0.5' y1='0.25' x2='0.5' y2='0.75' /%3E%3Cline y1='0.5' x1='0.25' y2='0.5' x2='0.75' /%3E%3C/svg%3E");

    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Ccircle cx='0.5' cy='0.5' r='0.4' /%3E%3Cline x1='0.5' y1='0.25' x2='0.5' y2='0.75' /%3E%3Cline y1='0.5' x1='0.25' y2='0.5' x2='0.75' /%3E%3C/svg%3E");
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Ccircle cx='0.5' cy='0.5' r='0.4' /%3E%3Cline x1='0.5' y1='0.25' x2='0.5' y2='0.75' /%3E%3Cline y1='0.5' x1='0.25' y2='0.5' x2='0.75' /%3E%3C/svg%3E");

    width: var(--palette-icon-size);
    height: var(--palette-icon-size);
    -moz-transition: all 0.5s ease-in-out;
    -o-transition: all 0.5s ease-in-out;
    -webkit-transition: all 0.5s ease-in-out;
    transition: transform 0.5s ease-in-out;
    background-repeat: no-repeat;
    position: relative;
    cursor: pointer;
  }
  :host(:not(.dragging)) .palette.expanded #palette_closer {
    transform: rotate(405deg);
  }

  :host(.dragging) .palette.expanded {
    pointer-events: none;
  }

  :host .palette label {
    transform: translate(calc(-1 * (var(--palette-item-count) + 1) * (var(--palette-icon-size) + 12px) ),0px);
    transition: transform 0.5s ease-in-out;
  }

  :host(:not(.dragging)) .palette.expanded label {
    flex: 1;
    transform: translate(0px,0px);
    min-width: var(--palette-icon-size);
    min-height: var(--palette-icon-size);
    max-width: var(--palette-icon-size);
    max-height: var(--palette-icon-size);
  }

  :host(:not(.dragging)) .palette.expanded {
    width: var(--expandedwidth);
    background: var(--palette-background-color);
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

  @keyframes piemenuselection {
    0% {
      background-position: right top;
      color: #000000;
    }
    100% {
      background-position: left top;
      color: #ffffff;
    }
  }


  :host x-piemenu label.dragover {
    background: linear-gradient(var(--slice-background-rotate-angle),var(--selection-color) 50%, var(--palette-background-color) 50%);
    background-size: 375% 100%;
    animation: piemenuselection 650ms;
  }

  :host x-piemenu button.hover, x-piemenu label.hover, x-piemenu button:hover, x-piemenu label:hover {
    background: var(--selection-color);
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

    :host([editable]) .widget_contents {
      margin-top: 0px;
      height: 100%;
      overflow: hidden;
    }

    :host([editable]) .palette {
      margin-top: 0px;
    }

  }
  :host .palette label svg {
    pointer-events: none;
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

    cursor: move; /* fallback if grab cursor is unsupported */
    cursor: grab;
    cursor: -moz-grab;
    cursor: -webkit-grab;

    background: rgba(255,255,255,0.8);
    width: var(--palette-icon-size);
    height: var(--palette-icon-size);

    -webkit-user-drag: element;
    border-radius: 5px;
    box-shadow: 2px 2px 2px rgba(90,90,90,0.6);
    padding: 0.5px;
    margin-right: 2px;
    margin-left: 2px;
    border: solid rgba(90,90,90,0.5) 0.5px;
    padding-left: 7px;
  }

  :host .palette label[draggable]:before {
    position: absolute;
    content: '';
    height: 75%;
    left: 2px;
    top: calc(12.5% - 2px);
    width: 2px;
    background-image: linear-gradient(0deg, #999, #999 40%, transparent 40%, transparent 100%);
    background-size: 1px 25%;
    border: none;
  }

  :host .palette label[draggable].checked {
    background: var(--selection-color);
  }

  :host .palette label input[value="delete"] {
    display: none;
  }

  :host .palette label[draggable] input {
    display: none;
  }

</style>
<div class="widget_contents" >
  <div id="icons"></div>
  <div id="output"></div>
  <form id="new_linkage">
    <div id="palette" class="palette expanded">
    <div id="palette_closer_wrap">
    <div id="palette_closer" onclick="this.parentNode.parentNode.classList.toggle('expanded')"></div>
    </div>
    <label id="palette_delete">
    <svg viewBox="-100 -100 812 812">
      <g>
      <path d="m510.81 85.933c-29.254-14.929-58.367-16.325-59.592-16.375-0.246-0.012-0.492-0.017-0.737-0.017h-46.303c3e-3 -0.139 0.022-0.273 0.022-0.415 0-26.812-12.761-48.09-35.931-59.913-16.138-8.234-31.876-9.122-33.618-9.194-0.244-0.013-0.49-0.019-0.736-0.019h-55.832c-0.246 0-0.492 6e-3 -0.737 0.017-1.741 0.074-17.48 0.96-33.616 9.194-23.172 11.824-35.932 33.102-35.932 59.913 0 0.142 0.017 0.276 0.022 0.415h-46.303c-0.246 0-0.492 6e-3 -0.737 0.017-1.226 0.051-30.337 1.446-59.593 16.375-28.241 14.41-61.905 44.075-61.905 103.55 0 9.581 7.767 17.35 17.35 17.35h15.245l67.087 390.76c1.43 8.328 8.65 14.416 17.099 14.416h299.87c8.449 0 15.67-6.088 17.099-14.416l67.087-390.76h15.245c9.581 0 17.35-7.768 17.35-17.35-1e-3 -59.473-33.666-89.138-61.907-103.55zm-435.41 86.197c4.22-24.493 17.846-42.891 40.665-54.828 21.272-11.123 43.329-12.888 45.936-13.063h288c2.585 0.172 24.08 1.906 45.034 12.6 23.361 11.922 37.29 30.475 41.562 55.29l-461.2 1e-3zm167.1-103c0-13.566 5.156-22.656 16.226-28.599 8.889-4.773 18.372-5.701 19.886-5.825h54.742c1.736 0.142 11.12 1.102 19.92 5.825 11.07 5.944 16.228 15.033 16.228 28.599 0 0.142 0.017 0.276 0.022 0.415h-127.04c2e-3 -0.139 0.02-0.275 0.02-0.415zm198.81 508.18h-270.62l-63.605-370.47h397.83l-63.605 370.47z"/>
      <path d="m306 519.57c9.581 0 17.35-7.768 17.35-17.35v-244.31c0-9.581-7.768-17.35-17.35-17.35-9.583 0-17.35 7.768-17.35 17.35v244.31c0 9.582 7.769 17.35 17.35 17.35z"/>
      <path d="m203.78 503.75c0.801 9.022 8.373 15.816 17.261 15.816 0.513 0 1.032-0.023 1.553-0.068 9.545-0.847 16.596-9.273 15.749-18.816l-21.687-244.31c-0.847-9.545-9.265-16.609-18.817-15.749-9.545 0.847-16.595 9.27-15.748 18.816l21.689 244.31z"/>
      <path d="m389.4 519.5c0.52 0.045 1.04 0.068 1.553 0.068 8.889 0 16.462-6.794 17.263-15.816l21.687-244.31c0.847-9.545-6.202-17.968-15.748-18.816-9.544-0.856-17.968 6.204-18.817 15.749l-21.687 244.31c-0.847 9.544 6.204 17.97 15.749 18.817z"/>
      </g>
    </svg>
    <input name="donor" value="delete" type="radio"></label>
    </div>
    <div class="pie_parent">
      <x-piemenu name="anomer" id="anomer_menu" data-next="linkage_menu">
        <label><span>α</span><input name="anomer" value="a" type="radio"></label>
        <label><span>β</span><input name="anomer" value="b" type="radio"></label>
        <label><span>?</span><input name="anomer" value="u" type="radio"></label>
      </x-piemenu>
      <x-piemenu name="linkage" id="linkage_menu">
        <label><span>N</span><input name="linkage" value="${Monosaccharide.LINKAGES.N}" type="radio"></label>
        <label><span>O</span><input name="linkage" value="${Monosaccharide.LINKAGES.O}" type="radio"></label>
        <label><span>?</span><input name="linkage" value="0" type="radio"></label>
        <label><span>1</span><input name="linkage" value="1" type="radio"></label>
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
  if ( ! this.hasAttribute('editable')) {
    return;
  }
  let zoom = parseFloat((window.innerWidth / window.document.documentElement.clientWidth).toFixed(2));
  let top = window.scrollY;
  let left = window.scrollX;
  let palette = this.shadowRoot.querySelector('.palette');
  let pie_parent = this.shadowRoot.querySelector('.pie_parent');

  let widget_pos = palette.parentNode.parentNode.getBoundingClientRect();


  if (widget_pos.top < 0 || widget_pos.left < 0) {
    let fs_left = widget_pos.left < 0 ? -1*widget_pos.left : 0;
    let fs_top = widget_pos.top < 0 ? -1*widget_pos.top : 0;
    palette.style.position = 'absolute';
    palette.style.transformOrigin = `${fs_left}px ${fs_top}px`;
    // Viewport width
    if ( palette.classList.contains('expanded') ) {
      palette.style.setProperty('--expandedwidth',document.documentElement.clientWidth+'px');
    }
    palette.style.transform = `scale(${zoom}) translate(${fs_left}px,${fs_top}px)`;
  } else {
    palette.style.position = 'absolute';
    if ( palette.classList.contains('expanded') ) {
      palette.style.setProperty('--expandedwidth',(1/zoom*100).toFixed(2)+'%');
    }
    palette.style.transformOrigin = `${0}px ${0}px`;
    palette.style.transform = `scale(${zoom}) translate(${0}px,0px)`;
  }

  let looper = palette;
  let offsetLeft = 0;
  while (looper.parentNode) {
    offsetLeft += looper.offsetLeft;
    looper = looper.parentNode;
  }

  left -= offsetLeft/zoom;

  pie_parent.style.transformOrigin = `${window.scrollX}px ${top}px`;
  pie_parent.style.transform = `scale(${zoom}) translate(${left}px,${top}px)`;

  state.ticking = false;
};


let window_scroll_listener = (state) => {
  if (! state.ticking) {
    window.requestAnimationFrame(rescale_widget_chrome.bind(state.owner,state));
    state.ticking = true;
  }
};

let create_scroll_listener = (state) => {
  return () => window_scroll_listener(state);
};

let wire_palette_pagezoom = function() {
  let state = { ticking: false, owner: this };
  let scroll_listener = create_scroll_listener(state);
  window.removeEventListener('scroll',scroll_listener);
  window.addEventListener('scroll', scroll_listener);
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
  this.highlightResidues();
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
  let left_pos = (((vals.left +0.5*vals.width - 0.5*anomer_size.width)/zoom) - palette_left).toFixed(2);
  let top_pos = (((vals.top+0.5*vals.height  - 0.5*anomer_size.height)/zoom) - palette_top).toFixed(2);
  left_pos = ((vals.left + 0.5*vals.width - 0.5*anomer_size.width)/zoom).toFixed(2);

  anomer_chooser.style.transformOrigin = `${left_pos}px ${top_pos}px`;
  anomer_chooser.style.transform = `scale(1) translate(${left_pos}px,${top_pos}px)`;
  setTimeout( () => {
    if ([...anomer_chooser.querySelectorAll('label:not([data-disabled])')].length === 1) {
      anomer_chooser.querySelector('label:not([data-disabled])').click();
    } else {
      setTimeout( () => {
        anomer_chooser.setAttribute('active',null);
      },100);
    }
  },0);

  anomer_chooser.clear();
};

let enableDropResidue = function(renderer,residue) {
  residue.renderer = renderer;
  if (! renderer.rendered.has(residue)) {
    return;
  }
  let target = renderer.rendered.get(residue).residue.element;
  if ( ! target ) {
    return;
  }
  if (target.style.pointerEvents === 'all') {
    return;
  }
  target.style.pointerEvents = 'all';
  let form = this.form;

  target.addEventListener('dragleave', () => {
    delete form.active_residue;
    if (form.menu_timeout) {
      clearTimeout(form.menu_timeout);
    }
    if ( ! form.active_center ) {
      form.clear();
    }
    this.highlightResidues();
  });

  target.addEventListener('click', (ev) => {
    if (form.querySelector('input[name="donor"]:checked').value === 'delete') {
      let parent = residue.parent;
      parent.removeChild(parent.linkageOf(residue),residue);
      parent.balance();
      parent.renderer.refresh();
      this.sequence = this.renderer.sugars[0].sequence;
      this.form.reset();
      return;
    }
    if (form.querySelector('input[name="donor"]:checked').value) {
      show_anomer.bind(this,residue)(ev.target);
    }
  });
  target.addEventListener('dragenter', (ev) => {
    if (! this.hasAttribute('editable')) {
      return;
    }
    if (! form.active_center) {
      this.highlightResidues([residue]);
    }

    if (form.residue === residue) {
      return;
    }

    if (form.active_residue === residue) {
      return;
    }

    if (form.active_center) {
      let center = form.active_center;
      if (center.r < 75) {
        center.r = 75;
      }
      if ( Math.pow(ev.clientX - center.left,2) + Math.pow(ev.clientY - center.top,2) < Math.pow(1*center.r,2) ) {
        return;
      }
    }

    form.clear();

    // We should wait for a drag over at least 300 ms after
    // to set the target
    form.active_residue = residue;

    if (form.menu_timeout) {
      clearTimeout(form.menu_timeout);
    }

    form.menu_timeout = setTimeout(show_anomer.bind(this,residue,ev.target),RESIDUE_SELECTION_TIMEOUT);
  });
};

let redraw_sugar = function() {
  if ( ! this.renderer || ! this.renderer.sugars ) {
    return;
  }
  if (this.renderer.sugars[0].sequence !== this.sequence) {
    this.renderer.sugars[0].sequence = this.sequence;
  }
  this.renderer.refresh().then( () => {
    if (this.hasAttribute('editable')) {
      for (let residue of this.renderer.sugars[0].composition() ) {
        enableDropResidue.call( this, this.renderer,residue );
      }
    }
    this.scaleToFit();
  });
};


let wire_renderer_canvas_events = function() {
  let canvas = this.renderer.element.canvas;

  this.addEventListener('drag', ()=> {
    this.classList.add('dragging');
  });

  canvas.addEventListener('click', (ev) => {
    if (ev.target !== canvas) {
      return;
    }
    this.form.clear();
  });

  canvas.addEventListener('dragleave', (ev) => {
    if (ev.relatedTarget === canvas) {
      if (this.form.active_center) {
        let center = this.form.active_center;
        if (center.r < 75) {
          center.r = 75;
        }
        if ( Math.pow(ev.clientX - center.left,2) + Math.pow(ev.clientY - center.top,2) < Math.pow(1*center.r,2) ) {
          return;
        }
      }

      this.form.clear();
      delete this.form.active_residue;
      delete this.form.residue;
      if (this.form.menu_timeout) {
        clearTimeout(this.form.menu_timeout);
      }
      this.highlightResidues();

      return;
    }
  });

  this.addEventListener('dragend', () => {
    this.classList.remove('dragging');
    this.highlightResidues();
    setTimeout(() =>{
      this.form.reset();
    },100);
  });

};

let wire_renderer_fisheye = function(arg) {
  let canvas = this.renderer.element.canvas;
  let renderer = this.renderer;

  canvas.addEventListener('dragover', () => {
    this.classList.add('dragging');
  });

  document.addEventListener('dragend', () => {
    this.classList.remove('dragging');
  });

  if ( ! arg ) {
    return;
  }

  let last_req;
  canvas.addEventListener('dragover', (ev) => {
    if (this.shadowRoot.querySelectorAll('x-piemenu[active]').length > 0) {
      return;
    }
    if (! this.hasAttribute('editable')) {
      return;
    }
    this.LayoutEngine.focus = [ ev.sugarX, ev.sugarY ];
    let vp_zoom = parseFloat((window.innerWidth / window.document.documentElement.clientWidth).toFixed(2));
    let candidate_zoom = parseFloat((vp_zoom * vp_zoom * 3).toFixed(2));
    this.LayoutEngine.zoom = candidate_zoom < 0.1 ? 0.1 : candidate_zoom;
    this.LayoutEngine.lock_residues = true;
    if (last_req) {
      cancelAnimationFrame(last_req);
    }
    last_req = requestAnimationFrame(function() {
      renderer.refresh();
    });
  });

  document.addEventListener('dragend', () => {
    this.LayoutEngine.focus = [ -1000, -1000 ];
    if (last_req) {
      cancelAnimationFrame(last_req);
    }
    last_req = requestAnimationFrame(function() {
      renderer.refresh();
    });
  });

};

const update_repeats = function() {
  let repeats = this.renderer.sugars[0].repeats;
  this[repeats_symbol].length = 0;
  this[repeats_symbol].push(...repeats.map( repeat => new ModifiableRepeat(repeat,this) ));
};

const update_icon_text_orientation = function() {
  let is_rotated = this.renderer.rotate;
  for (let text of this.shadowRoot.querySelectorAll('#icons symbol text')) {
    if (is_rotated) {
      text.setAttribute('transform','rotate(90,50,50)');
    } else {
      text.removeAttribute('transform');
    }
  }
};

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
      for (let sib of this.querySelectorAll(`input[name="${targ.name}"]`)) {
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
    for (let sib of this.querySelectorAll('input[name="donor"]')) {
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
              let current_parts = new Set((label.getAttribute('part') || '').split(', '));
              if (current_parts.has('donor-disabled')) {
                current_parts.delete('donor-disabled');
              }
              if (label.querySelector('input[disabled]')) {
                label.setAttribute('data-disabled','');
                current_parts.add('donor-disabled');
              } else {
                label.removeAttribute('data-disabled');
              }
              label.setAttribute('part', [...current_parts].join(', '));

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

const active_palette_population_symbol = Symbol('ACTIVE_POPULATION');

let ensure_sugar_icon = (defs_block,sequence) => {
  let safe_seq = sequence.toLowerCase().replace(/[()]/g,'_');
  let existing;
  try {
    existing = defs_block.querySelector(`#${safe_seq}`);
  } catch(error) {
    console.log(error)
    return Promise.resolve();
  }
  if (existing) {
    return Promise.resolve();
  }
  SugarAwareLayoutFishEye.LINKS = false;
  let sugar_renderer = new SVGRenderer(defs_block,SugarAwareLayoutFishEye);
  let sug = new IupacSugar();
  sug.sequence = sequence;
  sugar_renderer.element.canvas.setAttribute('id',safe_seq);
  sugar_renderer.rotate = true;
  sugar_renderer.addSugar(sug);
  return sugar_renderer.refresh().then( () => {
    let a_use = document.createElementNS('http://www.w3.org/2000/svg','use');
    a_use.setAttributeNS('http://www.w3.org/1999/xlink','href','#'+safe_seq);
    a_use.style.visibility = 'hidden';
    defs_block.parentNode.parentNode.style.display = 'block';
    defs_block.parentNode.appendChild(a_use);
    sugar_renderer.element.canvas.getBBox = () => {
      return a_use.getBBox();
    };
    sugar_renderer.scaleToFit({side: 0.25, top: 0.5});
    a_use.parentNode.removeChild(a_use);
    defs_block.parentNode.parentNode.style.display = 'none';
    sugar_renderer.element.canvas.setAttribute('preserveAspectRatio','xMidYMid meet');
  });
};

let populate_palette = function(widget,palette,donors=['Gal','Glc','Man','GalNAc','GlcNAc','NeuAc','NeuGc','GlcA','IdoA','Xyl','Fuc']) {
  let icons = widget.shadowRoot.getElementById('icons');

  while (palette.lastElementChild && palette.lastElementChild.getAttribute('id') !== 'palette_delete') {
    palette.removeChild(palette.lastElementChild);
  }

  let process_token = Symbol('ACTIVE');

  widget[active_palette_population_symbol] = process_token;

  widget[donors_symbol] = donors;
  return Promise.resolve(SVGRenderer.SYMBOLS)
  .then( (xml) => icons.innerHTML = xml )
  .then( async () => {
    if (widget[active_palette_population_symbol] !== process_token) {
      return;
    }
    delete widget[active_palette_population_symbol];

    let exportparts = 'donor-button, donor-disabled';
    for (let sug of widget.donors) {

      let safe_seq = sug.toLowerCase().replace(/[()]/g,'_');

      await ensure_sugar_icon(icons.querySelector('defs'),sug);

      let palette_entry = palette_template.content.cloneNode(true);
      palette_entry.querySelector('use').setAttribute('xlink:href',`#${safe_seq}`);
      palette_entry.querySelector('input').setAttribute('value',sug);
      palette_entry.querySelector('label').setAttribute('data-donor',sug.toLowerCase());
      palette_entry.querySelector('label').setAttribute('part',`donor-button`);

      palette.appendChild(palette_entry);
      wire_palette_watcher(palette.lastElementChild);
    }
    widget.setAttribute('exportparts',exportparts);

    palette.style.setProperty( '--palette-item-count', palette.children.length);
  });
};

let extend_sugar = function(residue,donor_value,anomer_value,linkage_value) {

  let sug = new IupacSugar();

  sug.sequence = donor_value;

  let new_res = sug.root;

  new_res.anomer = anomer_value;

  new_res.parent_linkage = donor_value.match(/Neu(Gc|Ac)/) ? 2 : 1;

  let delta = `${sug.sequence}(${new_res.anomer}${new_res.parent_linkage}-${linkage_value})`;

  let reaction_string = `${residue.identifier}(u?-?)*+"{${delta}@y2a}"`;


  let reaction = new IupacReaction();
  reaction.sequence = reaction_string;

  // if (this.querySelector('input[name="donor"]:checked').reaction) {
  //   reaction = this.querySelector('input[name="donor"]:checked').reaction;
  // }

  let renderer = residue.renderer;

  if ( (residue instanceof Repeat.Monosaccharide) &&
       (residue.repeat.mode === Repeat.MODE_MINIMAL) ) {

    if ( (! residue.endsRepeat || residue.repeat.root.identifier !== new_res.identifier) &&
         (['Fuc','HSO3'].indexOf(new_res.identifier) >= 0) ) {
      residue.original.addChild(parseInt(linkage_value),new_res);
    } else {
      residue.addChild(parseInt(linkage_value),new_res);
    }
    return [ ...sug.composition() ];
  } else {
    return reaction.execute(renderer.sugars[0],residue);
  }
}

let form_action = function(widget,ev) {
  ev.preventDefault();
  ev.stopPropagation();

  let donor_value = (this.querySelector('input[name="donor"]:checked') || {}).value;

  if ( ! donor_value ) {
    return;
  }

  let possible_anomers = [...this.querySelectorAll('input[name="anomer"]:not([disabled])')];

  if ( ! this.querySelector('input[name="anomer"]:checked') && possible_anomers.length === 1) {
    possible_anomers[0].checked = true;
  }

  let possible_linkages = [...this.querySelectorAll('input[name="linkage"]:not([disabled])')];
  if ( ! this.querySelector('input[name="linkage"]:checked') && possible_linkages.length === 1) {
    possible_linkages[0].checked = true;
  }


  let anomer_value = this.querySelector('input[name="anomer"]:checked').value;

  let linkage_value = this.querySelector('input[name="linkage"]:checked').value;

  let renderer = this.residue.renderer;

  let original_location = renderer.sugars[0].location_for_monosaccharide(this.residue);

  let added = widget.extendSugar(this.residue,donor_value,anomer_value,linkage_value);

  // If the editing procedure removes the residue from the tree
  // we should get the original residue back again.
  // FIXME - This might be a source of pain if the linkages are ambiguous
  // and the addition of a child makes the branch ordering flip around

  this.residue = renderer.sugars[0].locate_monosaccharide(original_location);

  this.residue.balance();

  repeatCallback(renderer.sugars[0]);

  renderer.refresh().then( () => {
    for (let new_res of added ) {
      enableDropResidue.call( widget, renderer,new_res);
    }
    widget.scaleToFit();
    widget.highlightResidues();
  });
  widget.sequence = renderer.sugars[0].sequence;
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
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const palette = this.shadowRoot.getElementById('palette');
      this.style.setProperty( '--palette-height', (palette.offsetHeight - 32)+'px');
    }).observe(this.shadowRoot.getElementById('palette'));
  }
  if (this.hasAttribute('editable')) {
    this.shadowRoot.querySelector('#anomer_menu').addEventListener('click', () => {
      setTimeout( () => {
        const linkage_chooser = this.shadowRoot.querySelector('#linkage_menu');
        if (! linkage_chooser) {
          return;
        }
        if ([...linkage_chooser.querySelectorAll('label:not([data-disabled])')].length === 1) {
          this.form.clear();
          linkage_chooser.querySelector('label:not([data-disabled])').click();
          this.form.reset();
        }
      },0);
    }, {capture: true});
  }
  log.info('Initialised global events');
};

let initialise_renderer = function() {
  if ( ! this.shadowRoot ) {
    return;
  }
  this.LayoutEngine.LINKS = this.hasAttribute('links') ? true : false;

  let renderer_class = this.hasAttribute('renderer') ? (this.constructor.RegisteredRenderers.get(this.getAttribute('renderer')) || SVGRenderer) : SVGRenderer;

  if ( this.renderer ) {
    while (this.shadowRoot.getElementById('output').firstChild) {
      this.shadowRoot.getElementById('output').removeChild(this.shadowRoot.getElementById('output').firstChild);
    }
    this.renderer = null;
  }

  this.renderer = new renderer_class(this.shadowRoot.getElementById('output'),this.LayoutEngine);
  this.renderer.rotate = this.hasAttribute('horizontal');

  update_icon_text_orientation.call(this);

  log.info('Wiring canvas events');
  wire_renderer_canvas_events.call(this);
  wire_renderer_fisheye.call(this);
  log.info('Wired canvas events');
  let sug = new IupacSugar();
  this.renderer.addSugar(sug);
  if (this.sequence) {
    redraw_sugar.call(this);
    if (sug.repeats.length > 0) { 
      repeatCallback(sug);
    }
    update_repeats.call(this);
  }
};

if (window.ShadyCSS) {
  ShadyCSS.prepareTemplate(tmpl, 'x-sviewer');
}

const renderers = new Map(Object.entries({
  svg: SVGRenderer,
  canvas: CanvasRenderer,
  sketch: RoughCanvasRenderer
}));

class SViewer extends WrapHTML {

  static get observedAttributes() {
    return ['links','horizontal','linkangles','sugars','renderer'];
  }

  static get RegisteredRenderers() {
    return renderers;
  }

  constructor() {
    super();
    this[repeats_symbol] = [];
    log('Initiating Sviewer element');
  }


  fullRefresh() {
    return this.renderer.refresh().then( () => {
      if (this.hasAttribute('editable')) {
        for (let residue of this.renderer.sugars[0].composition() ) {
          enableDropResidue.call( this, this.renderer,residue );
        }
      }
      this.scaleToFit();
    });
  }

  scaleToFit() {
    let padding = Object.assign({}, this.renderer.constructor.DEFAULT_PADDING || { top: 0, side: 0 });
    let padding_side = window.getComputedStyle(this).getPropertyValue('--sugar-padding-side');
    let padding_top = window.getComputedStyle(this).getPropertyValue('--sugar-padding-top');

    if ( padding_side && typeof padding_side !== 'undefined' ) {
      padding.side = parseFloat(padding_side);
    }
    if ( padding_top && typeof padding_top !== 'undefined' ) {
      padding.top = parseFloat(padding_top);
    }
    return this.renderer.scaleToFit(padding);
  }

  async toDataURL(format='image/svg') {
    if (format == 'image/svg') {
      format = 'svg'
    }
    if (format == 'image/png') {
      format = 'png'
    }
    let data = await prepareImage(this,this.renderer.element.canvas,format);
    return data;
  }

  save(format='svg') {
    ImageSaver(this,this.renderer.element.canvas,format,this.sequence);
  }

  get LayoutEngine() {
    if (this.hasAttribute('linkangles')) {
      return LinkageLayoutFishEye;
    } else {
      return SugarAwareLayoutFishEye;
    }
  }

  attributeChangedCallback(name) {
    if (name === 'renderer') {
      initialise_renderer.call(this);
      return;
    }
    if (name === 'links') {
      if (this.hasAttribute('links')) {
        this.LayoutEngine.LINKS = true;
      } else {
        this.LayoutEngine.LINKS = false;
      }
      if (this.renderer) {
        this.renderer.refresh();
        this.scaleToFit();
      }
    }
    if (name === 'sugars') {
      if (this.hasAttribute('sugars')) {
        this.style.setProperty( '--sugars-url', this.getAttribute('sugars'));
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

      update_icon_text_orientation.call(this);

      this.renderer.refresh();
      setTimeout(() => this.scaleToFit(),500);
    }
    if (name === 'linkangles') {
      this.LayoutEngine.LINKS = this.renderer.LayoutEngine.LINKS;
      this.renderer.LayoutEngine = this.LayoutEngine;
      this.renderer.refresh();
      this.scaleToFit();
    }
  }

  connectedCallback() {
    if (window.ShadyCSS) {
      ShadyCSS.styleElement(this);
    }
    let shadowRoot = this.attachShadow({mode: 'open'});

    new ShadowDragDropTouch(this);

    shadowRoot.appendChild(tmpl.content.cloneNode(true));

    this.form = this.shadowRoot.getElementById('new_linkage');

    let slot = this.shadowRoot.getElementById('textcontent');

    this[sequence_symbol] = slot.assignedNodes({flatten: true})[0].textContent;

    slot.addEventListener('slotchange', () => {
      let newseq = (slot.assignedNodes({flatten: true }).filter( node => node.nodeType === Node.TEXT_NODE )).map( n => n.textContent).join('');
      newseq = newseq.replace(/^\s+/,'').replace(/\s+$/,'');
      if (newseq !== this.sequence) {
        this[sequence_symbol] = newseq;
      }
      if (this.sequence) {
        redraw_sugar.call(this);
      }
    });

    populate_palette(this,this.shadowRoot.getElementById('palette'))
    .then( () => {
      initialise_renderer.call(this);
      initialise_events.call(this);
    });

    setTimeout(() => {
      this.shadowRoot.querySelector('#palette').classList.remove('expanded');
    },1000);

    const max_opacity = 0.3;

    let selection_highlighter = new Highlighter(this,'selection');
    selection_highlighter.setStates({angle:0, opacity:0}, { angle: 2*Math.PI, opacity: max_opacity });
    selection_highlighter.duration = RESIDUE_SELECTION_TIMEOUT - 50;
    selection_highlighter.draw = ({ angle, opacity },{x, y, width, height, zoom},ctx) => {
      ctx.beginPath();
      ctx.lineWidth = parseFloat((10 / Math.max(zoom,1)).toFixed(2));
      if (opacity >= max_opacity) {
        ctx.strokeStyle = window.getComputedStyle(this).getPropertyValue('--selection-color');
      } else {
        ctx.strokeStyle = `rgba(0,0,0,${opacity.toFixed(2)})`;
      }
      ctx.arc( x+0.5*width,y+0.5*height, 1.5*width/2,-0.5*Math.PI, angle-0.5*Math.PI, false );
      ctx.stroke();
    };
    this[highlighter_symbol] = selection_highlighter;
  }

  get donors() {
    return Object.freeze([].concat(this[donors_symbol]));
  }

  setDonors(donors) {
    return populate_palette(this,this.shadowRoot.getElementById('palette'),[].concat(donors));
  }

  set donors(donors) {
    this.setDonors(donors);
  }

  set sequence(seq) {
    if (this.sequence !== seq) {
      let slot = this.shadowRoot.getElementById('textcontent');
      let text = (slot.assignedNodes({flatten: true }).filter( node => node.nodeType === Node.TEXT_NODE ))[0];
      text.textContent = seq;
      slot.dispatchEvent(new Event('slotchange'));
      repeatCallback(this.renderer.sugars[0]);
      update_repeats.call(this);
      let event = new Event('change',{bubbles: true});
      this.dispatchEvent(event);
    }
    return seq;
  }
  get sequence() {
    return this[sequence_symbol];
  }

  get repeats() {
    return this[repeats_symbol];
  }

  extendSugar(residue,donor_value,anomer_value,linkage_value) {
    return extend_sugar.call(this,residue,donor_value,anomer_value,linkage_value);
  }

  highlightResidues(residues=[]) {
    this[highlighter_symbol].highlight(residues);
  }

}

customElements.define('x-sviewer',SViewer);

export default SViewer;
export { IupacSugar };