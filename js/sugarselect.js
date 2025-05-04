/* globals document,HTMLElement,customElements,window,ShadyCSS,CustomEvent */
'use strict';

import * as debug from 'debug-any-level';

import * as SViewer from './sviewer';
import * as CacheSViewer from './sviewer/cache-sviewer';


import { CondensedIupac, Sugar, SVGRenderer, Reaction, ReactionGroup, comparator } from 'glycan.js';

const ELEMENT_NAME = 'ccg-sugarselect';

const module_string='sviewer:sugarselect';

const log = debug(module_string);

const IupacSugar = SViewer.IupacSugar;

const NLINKED_CORE = new IupacSugar();
NLINKED_CORE.sequence = 'Man(a1-3)[Man(a1-6)]Man(b1-4)GlcNAc(b1-4)GlcNAc(b1-N)Asn';

function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    min-width: calc(22em + 30px);
    min-height: calc(15em + 30px);
    --max-select-display: -1;
    --drop-shadow-color: rgba(50, 50, 0, 0.5);
    --drop-shadow-offset: 2px;
    --drop-shadow-size: 1px;
  }

  :host, :host * {
    user-select: none;
    -webkit-user-select: none; /* Safari */
    -moz-user-select: none;    /* Firefox */
    -ms-user-select: none;     /* IE 10+ */
  }

  #output {
    display: flex;
    flex-direction: row;
    top: 0px;
    left: 0px;
    width: 100%;
    height: 100%;
    min-height: 10em;
    gap: 5px;
  }
  #builder {
    display: block;
    width: 50%;
    height: 100%;
    flex: 1 0 20em;
  }

  #options {
    pointer-events: none;
  }

  #options label {
    pointer-events: auto;
    box-shadow: var(--drop-shadow-offset) var(--drop-shadow-offset) var(--drop-shadow-size) var(--drop-shadow-color);
  }

  #options label:not(:has(ccg-sviewer-lite)) {
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: Helvetica, Arial, sans-serif;
  }

  #options label[disabled] {
    display: none;
  }
  #options label:has(input[type="radio"]:checked) {
    background: var(--selection-color);
  }
  #options {
    margin-top: 10px;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: flex-start;
    max-width: calc(50% - 20px);
    max-height: calc(100% - 20px);
    gap: 10px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  #options label:hover {
    background: var(--selection-color);
  }
  #options label {
    cursor: pointer;
  }

  #options label[hide], #options label[disabled] {
    display: none;
  }
  #options label {
    aspect-ratio: 1 / 1;
    flex: 1 1 min(calc(33.33% - 10px),10em);
    max-width: min(calc(33.33% - 20px),4em);
    min-width: 3em;
    border-radius: 10px;
    background: var(--button-default-background-color,#555);
  }
  #options label input {
    position: fixed;
    opacity: 0;
    pointer-events: none;
  }
  #options ccg-sviewer-lite {
    width: 100%;
    height: 100%;
    position: relative;
  }
  ::part(donor-disabled) {
    display: none;
  }
</style>

<div id="output">
  <ccg-sugarbuilder exportparts="donor-button, donor-disabled" strict id="builder"> </ccg-sugarbuilder>
  <slot id="glycanoptions"> </slot>
  <form id="options">
    <label><input type="radio" name="glycan" value=""/>Clear</label>
  </form>
</div>
`;

const label_template = document.createElement('template');

label_template.innerHTML = `
<label><input type="radio" name="glycan" value=""/><ccg-sviewer-lite links renderer="png"></ccg-sviewer-lite></label>
`;

const reset_template = document.createElement('template');

reset_template.innerHTML = `
<button>None</button>
`;

const CACHED_REACTIONS = {};

const sequences_to_reactions = function(seqs) {
  let reactions = [];
  let seen_reactions = {};
  for (let seq of seqs) {
    let new_reactions = [];
    if ( ! CACHED_REACTIONS[seq]) {
      let clazz = this.SugarClass;
      let sug = new clazz();
      sug.sequence = seq;
      for (let res of sug.composition()) {
        if (res == sug.root) {
          continue;
        }
        let pos = sug.location_for_monosaccharide(res);
        let output = sug.clone();
        let target = output.locate_monosaccharide(pos);
        let wanted = output.paths(output.root,target).flat();
        for (let toremove of output.composition()) {
          if (! toremove.parent || wanted.indexOf(toremove) >= 0) {
            continue;
          }
          let parent = toremove.parent;
          let linkage = parent.linkageOf(toremove);
          parent.removeChild(linkage,toremove);
        }
        let parent = target.parent;
        let linkage = parent.linkageOf(target);
        let parent_link = target.parent_linkage;
        let anomer = target.anomer;
        let parent_location = output.location_for_monosaccharide(parent);
        parent.removeChild(linkage,target);
        let reaction_seq = `${output.sequence}+"{${target.identifier}(${anomer}${parent_link}-${linkage})}@${parent_location}"`;
        if (new_reactions.indexOf(reaction_seq) < 0) {
          new_reactions.push(reaction_seq);
        }
      }
      CACHED_REACTIONS[seq] = new_reactions;
    } else {
      new_reactions = CACHED_REACTIONS[seq];
    }
    for (let reaction_seq of new_reactions) {
      if ( ! seen_reactions[reaction_seq] ) {
        reactions.push([reaction_seq]);
        seen_reactions[reaction_seq] = 1;
      }
    }
  }
  let result =  { "ALL" : { reactions } };
  return (result);
}

const accept_options = function(slot,target) {
  const passed_options = (slot.assignedNodes({flatten: true }).filter( node => node.nodeType === Node.ELEMENT_NODE ));
  let clear_button = target.firstElementChild;
  let new_children = [clear_button];
  for (let node of passed_options) {
    let a_label = label_template.content.cloneNode(true);
    a_label.firstElementChild.querySelector('ccg-sviewer-lite').SugarClass = this.SugarClass;
    a_label.firstElementChild.querySelector('ccg-sviewer-lite').textContent = node.textContent;
    a_label.firstElementChild.querySelector('input').setAttribute('value',node.textContent);
    new_children.push(a_label);
  }
  target.replaceChildren(...new_children);
  let sequences = [...passed_options].map( node => node.textContent );
  return sequences_to_reactions.call(this,sequences);
};

const wire_events = function() {
  this.shadowRoot.getElementById('options').addEventListener('change', () => {
    if (this.shadowRoot.getElementById('options').glycan.value == '') {
      this.reset();
      return;
    }
    this.shadowRoot.getElementById('builder').sequence = this.shadowRoot.getElementById('options').glycan.value;
  });
  this.shadowRoot.getElementById('builder').addEventListener('change', () => {
    this.updateDisabled();
    let event = new Event('change',{bubbles: true});
    this.dispatchEvent(event);
  });
};

class SugarSelect extends WrapHTML {

  #SugarClass = IupacSugar;

  static get observedAttributes() {
    return [];
  }

  constructor() {
    super();
    log('Initiating SugarSelect element');
  }

  connectedCallback() {
    let shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(tmpl.content.cloneNode(true));
    shadowRoot.getElementById('builder').reactions = {};
    this.SugarClass = this.SugarClass;

    let slot = this.shadowRoot.getElementById('glycanoptions');
    const passed_options = (slot.assignedNodes({flatten: true }).filter( node => node.nodeType === Node.ELEMENT_NODE ));

    if (passed_options.length > 0) {
      shadowRoot.getElementById('builder').reactions = accept_options.call(this,slot,this.shadowRoot.getElementById('options'));
      this.updateDisabled();
    }

    slot.addEventListener('slotchange', () => {
      shadowRoot.getElementById('builder').reactions = accept_options.call(this,slot,this.shadowRoot.getElementById('options'));
      this.updateDisabled();
    });

    wire_events.call(this);

    for (let attr of ['links','linkangles']) {
      this.attributeChangedCallback(attr);
    }

  }

  get value() {
    return this.shadowRoot.querySelector('#options').glycan.value;
  }

  get SugarClass() {
    return this.#SugarClass;
  }

  set SugarClass(clazz) {
    this.#SugarClass = clazz;
    if (this.shadowRoot) {
      this.shadowRoot.querySelector('#builder').shadowRoot.querySelector('#viewer').SugarClass = clazz;
    }
  }

  reset() {
    this.shadowRoot.querySelector('#builder').sequence = '';
  }

  updateDisabled() {
    let enabled_count = 0;
    for (let option of [...this.shadowRoot.querySelectorAll('label')].filter( el => el.firstElementChild.getAttribute('type') == 'radio' )) {
      let seq = option.querySelector('input').value;
      if (! seq) {
        continue;
      }
      let clazz = this.SugarClass;
      let sug = new clazz();
      sug.sequence = seq;
      let curr_sug_seq = this.shadowRoot.querySelector('#builder').sequence;
      let curr_sug = new clazz();
      curr_sug.sequence = curr_sug_seq;
      let retval = sug.match_sugar_pattern(curr_sug,comparator);
      let pattern_match = curr_sug_seq != '' && retval.length < 1;
      let oligo_match = [...sug.composition()].length > 1;
      if (pattern_match && oligo_match) {
        option.setAttribute('disabled','');
        if (option.querySelector('input').checked) {
          option.querySelector('input').checked = false;
        }
      } else {
        enabled_count += 1;
        if (curr_sug.sequence == sug.sequence) {
          option.querySelector('input').checked = true;
        }
        option.removeAttribute('disabled');
      }
      if ( ! option.hasAttribute('disabled') ) {
        let max_display = parseInt(window.getComputedStyle(this).getPropertyValue('--max-select-display'));
        if (max_display < 0) {
          max_display = Infinity;
        }
        if (enabled_count > max_display) {
          option.setAttribute('hide','');
        } else {
          option.querySelector('ccg-sviewer-lite').fullRefresh();
          option.removeAttribute('hide');
        }
      }
    }
  }


  attributeChangedCallback(name) {
    if ( ! this.shadowRoot ) {
      return;
    }
    if (['links','linkangles'].indexOf(name) >= 0 ) {
      if (this.hasAttribute(name)) {
        this.shadowRoot.getElementById('builder').setAttribute(name,'');
      } else {
        this.shadowRoot.getElementById('builder').removeAttribute(name);
      }
    }
  }



}

customElements.define(ELEMENT_NAME,SugarSelect);

export default SugarSelect;