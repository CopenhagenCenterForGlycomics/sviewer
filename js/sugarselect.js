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

  #options label:first-child {
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: Helvetica, Arial, sans-serif;
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
  #options label[checked] {
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
    max-height: min(calc(33.33% - 20px),4em);
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
const CACHED_NEW_ROOTS = {};

const sequences_to_reactions = function(seqs) {
  console.time('sequences_to_reactions');
  let reactions = [];
  let seen_reactions = {};
  let new_roots = [];
  for (let seq of seqs) {
    let new_reactions = [];
    if ( ! CACHED_REACTIONS[seq]) {
      let clazz = this.SugarClass;
      let sug = new clazz();
      sug.sequence = seq;
      for (let res of sug.composition()) {
        if (res == sug.root) {
          if (new_roots.indexOf(res.identifier) < 0) {
            new_roots.push(res.identifier);
            CACHED_NEW_ROOTS[seq] = res.identifier;
            if (res.children.length < 1) {
              seqs.splice(seqs.indexOf(seq),1);
            }
          }
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
      if (CACHED_NEW_ROOTS[seq] && new_roots.indexOf(CACHED_NEW_ROOTS[seq]) < 0) {
        new_roots.push(CACHED_NEW_ROOTS[seq]);
      }
    }
    for (let reaction_seq of new_reactions) {
      if ( ! seen_reactions[reaction_seq] ) {
        reactions.push([reaction_seq]);
        seen_reactions[reaction_seq] = 1;
      }
    }
  }
  let result =  { "ALL" : { reactions } };
  console.timeEnd('sequences_to_reactions');
  return ({reactions: result,new_roots});
}

const accept_options = function(slot,target,max_children=10) {
  console.time('accept_options');
  const passed_options = (slot.assignedNodes({flatten: true }).filter( node => node.nodeType === Node.ELEMENT_NODE ));
  if (passed_options.length > 0 && passed_options[0].accepted ) {
    return;
  }
  if (passed_options.length > 0) {
    passed_options[0].accepted = true;
  }
  let clear_button = target.firstElementChild;
  let new_children = [clear_button];
  for (let node of passed_options) {
    let a_label = label_template.content.cloneNode(true);
    a_label.firstElementChild.querySelector('ccg-sviewer-lite').SugarClass = this.SugarClass;
    a_label.firstElementChild.querySelector('ccg-sviewer-lite').textContent = node.textContent;
    a_label.firstElementChild.querySelector('input').setAttribute('value',node.textContent);
    a_label.firstElementChild.querySelector('input').addEventListener('change', ev => {
      for (let node of target.querySelectorAll('label[checked]')) {
        node.removeAttribute('checked');
      }
      if (ev.target.checked) {
        ev.target.parentNode.setAttribute('checked','');
      }
    });
    new_children.push(a_label);
  }
  let sequences = [...passed_options].map( node => node.textContent );
  let {reactions,new_roots} = sequences_to_reactions.call(this,sequences);
  for (let new_root of new_roots) {
    sequences.splice(0,0,new_root);
  }
  sequences = sequences.filter( (o,i,a) => a.indexOf(o) == i )
  target.replaceChildren(...(new_children.slice(0,max_children)));
  this.options = sequences;
  console.timeEnd('accept_options');
  return(reactions);
};

const wire_events = function() {
  this.shadowRoot.getElementById('options').addEventListener('change', () => {
    if (this.shadowRoot.getElementById('options').glycan.value == '') {
      this.reset();
      let event = new Event('change',{bubbles: true});
      this.dispatchEvent(event);
      return;
    }
    this.value = this.shadowRoot.getElementById('options').glycan.value;
    let event = new Event('change',{bubbles: true});
    this.dispatchEvent(event);
  });
  this.shadowRoot.getElementById('builder').addEventListener('change', () => {
    let input_seq = this.shadowRoot.querySelector('#builder').sequence;
    if ((this.value !== input_seq) && ((this.options.indexOf(input_seq) >= 0) || input_seq == '') ) {
      this.value = input_seq;
      let event = new Event('change',{bubbles: true});
      this.dispatchEvent(event);
    }
    this.updateDisabled(input_seq);
  });
};

class SugarSelect extends WrapHTML {

  #SugarClass = IupacSugar;
  #options = [];

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
      this.refreshOptions();
    }

    slot.addEventListener('slotchange', () => {
      this.refreshOptions();
    });

    wire_events.call(this);

    for (let attr of ['links','linkangles']) {
      this.attributeChangedCallback(attr);
    }

  }

  refreshOptions() {
    let slot = this.shadowRoot.getElementById('glycanoptions');
    let max_display = parseInt(window.getComputedStyle(this).getPropertyValue('--max-select-display'));
    const reactions = accept_options.call(this,slot,this.shadowRoot.getElementById('options'),max_display);
    if (! reactions ) {
      return;
    }
    this.shadowRoot.getElementById('builder').reactions = reactions;
    this.updateDisabled(this.value);
  }

  get options() {
    return this.#options;
  }

  set options(sequences) {
    this.#options = sequences;
  }

  get value() {
    return this.shadowRoot.querySelector('#options').glycan.value;
  }

  set value(seq) {
    if (this.options.indexOf(seq) < 0) {
      return;
    }
    this.shadowRoot.querySelector('#builder').sequence = seq;
    this.shadowRoot.querySelector('#options').glycan.value = seq;
    this.updateDisabled(seq);
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

  updateDisabled(reference_sequence) {
    let enabled_count = 0;
    console.time('updateDisabled');
    let option_els = [...this.shadowRoot.querySelectorAll('label')].filter( el => (el.firstElementChild.getAttribute('type') == 'radio') && el.querySelector('ccg-sviewer-lite') );
    let max_display = parseInt(window.getComputedStyle(this).getPropertyValue('--max-select-display'));
    if (max_display < 0) {
      max_display = option_els.length;
    }

    for (let seq of this.options) {
      if (! seq) {
        continue;
      }
      let clazz = this.SugarClass;
      let sug = new clazz();
      sug.sequence = seq;
      let curr_sug_seq = reference_sequence;
      let curr_sug = new clazz();
      curr_sug.sequence = curr_sug_seq;
      let retval = sug.match_sugar_pattern(curr_sug,comparator);
      let no_pattern_match = curr_sug_seq != '' && retval.length < 1;
      let oligo_match = [...sug.composition()].length > 1;
      if (no_pattern_match && oligo_match) {
        continue;
      } else {
        let option  = option_els[enabled_count];
        option.removeAttribute('checked');
        option.querySelector('input').value = seq;
        option.querySelector('ccg-sviewer-lite').textContent = seq;
        option.querySelector('ccg-sviewer-lite').fullRefresh();

        enabled_count += 1;
        if (curr_sug.sequence == sug.sequence) {
          option.querySelector('input').click();
          option.setAttribute('checked','');
        }
        option.removeAttribute('disabled');
        if ((enabled_count + 1) == max_display) {
          return;
        }
      }
    }
    while ((enabled_count + 1) < max_display) {
      option_els[enabled_count].removeAttribute('checked');
      option_els[enabled_count].setAttribute('disabled','true');
      enabled_count += 1;
    }
    console.timeEnd('updateDisabled');
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