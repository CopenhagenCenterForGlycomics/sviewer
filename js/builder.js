/* globals document,HTMLElement,customElements,window,fetch,ShadyCSS */
'use strict';

import * as debug from 'debug-any-level';

import * as Glycan from 'glycan.js';
import { IupacSugar } from './sviewer';

const module_string='sviewer:builder';

const log = debug(module_string);

function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
  }
  :host x-sviewer {
    width: 100%;
    height: 100%;
    --demoted-opacity: 0.8;
    --selection-color: var(#6052E2,--selection-color);
  }
  :host .widget_contents {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
<div class="widget_contents" >
  <x-sviewer editable resizable links id="viewer"><slot></slot></x-sviewer>
</div>
`;

const demote_items = function(enabled_weight,elements,values) {
  if ( ! values ) {
    for (let el of elements) {
      el.removeAttribute('data-weight');
    }
    return;
  }
  for (let el of elements) {
    el.removeAttribute('disabled');
    if (values.indexOf(el.value) >= 0) {
      el.setAttribute('data-weight',enabled_weight);
    } else {
      el.setAttribute('data-weight','-1');
    }
  }
};

const disable_items = function(elements,values) {
  if ( ! values ) {
    for (let el of elements) {
      el.removeAttribute('disabled');
    }
    return;
  }
  for (let el of elements) {
    el.removeAttribute('data-weight');
    if (values.indexOf(el.value) >= 0) {
      el.removeAttribute('disabled');
    } else {
      el.setAttribute('disabled','');
    }
  }
};

const adapt_form = function(elements,values) {
  if (this.hasAttribute('strict')) {
    return disable_items(elements,values);
  }
  return demote_items(4,elements,values);
};

const update_donors = async function(donors) {
  let reaction_donors = donors.reactions
                              .filter( reac => reac.delta.composition().length == 2 )
                              .map( reac => [].concat(reac.delta.composition()).reverse().shift().identifier )
                              .filter( (o,i,a) => a.indexOf(o) === i );
  const viewer = this.shadowRoot.getElementById('viewer');
  let single_residue_donors = viewer.donors.concat( reaction_donors.filter( donor => viewer.donors.indexOf(donor) < 0 ) );
  let chain_donors = donors.reactions
                              .filter( reac => reac.delta.composition().length > 2 );

  let chain_map = new Map();

  for (let reactionset of chain_donors) {
    for (let reaction of reactionset.positive) {
      let reaction_sequence = reaction.delta.sequence;
      chain_map.set(reaction_sequence,reaction);
      single_residue_donors.push( reaction_sequence );
    }
  }
  let unique_donors = single_residue_donors.filter( (o,i,a) => a.indexOf(o) === i  )
                      .map( donor => {
                        if (chain_map.get(donor)) {
                          return { donor, reaction: chain_map.get(donor) };
                        }
                        return donor;
                      })
  return viewer.setDonors(unique_donors);
};

const reset_form_disabled = function(widget,viewer) {
  let sugar = viewer.renderer.sugars[0].clone();
  sugar.freeze();
  let supported = widget.reactiongroup.supportsLinkageAt(sugar);
  if (viewer.form.querySelector('input[name="donor"]')) {
    adapt_form.call(widget,Array.from(viewer.form.querySelectorAll('input[name="donor"]')).filter(el => el.value !== 'delete'),supported.donor);
  }
  adapt_form.call(widget,[...viewer.form.querySelectorAll('input[name="anomer"]')]);
  adapt_form.call(widget,[...viewer.form.querySelectorAll('input[name="linkage"]')]);
};

const wire_sviewer_events = function(viewer) {
  const widget = this;
  let changed = false;
  viewer.form.addEventListener('change',function() {
    let reactions = widget.reactiongroup;

    let donor_val = (this.querySelector('input[name="donor"]:checked') || {}).value ? this.querySelector('input[name="donor"]:checked').value : undefined;
    let linkage_val = (this.querySelector('input[name="linkage"]:checked') || {}).value ? parseInt(this.querySelector('input[name="linkage"]:checked').value) : undefined;
    let residue_val = this.residue ? this.residue : undefined;
    let sugar = viewer.renderer.sugars[0].clone();
    sugar.freeze();
    if (residue_val) {
      residue_val = sugar.locate_monosaccharide(viewer.renderer.sugars[0].location_for_monosaccharide(residue_val));
    }
    let supported = reactions.supportsLinkageAt(sugar,donor_val,linkage_val,residue_val);
    if (supported.anomerlinks && (this.querySelector('input[name="anomer"]:checked') || {}).value) {
      let existing_linkages = [...this.residue.child_linkages.keys()];
      let anomer = (this.querySelector('input[name="anomer"]:checked') || {}).value;
      supported.linkage = supported.anomerlinks
                          .filter( linkpair => linkpair.match(anomer) )
                          .map( l => parseInt(l.substr(1)) )
                          .filter( l => existing_linkages.indexOf(l) < 0);
    }
    adapt_form.call(widget,[...viewer.form.querySelectorAll('input[name="anomer"]')],supported.anomer);
    adapt_form.call(widget,[...viewer.form.querySelectorAll('input[name="linkage"]')],supported.linkage.map( link => ''+link ));
    changed = true;
  });
  viewer.form.addEventListener('reset',function() {
    if (! changed) {
      return;
    }
    window.cancelAnimationFrame(reset_form_disabled.timeout);
    reset_form_disabled.timeout = window.requestAnimationFrame( reset_form_disabled.bind(null,widget,viewer) );
    changed = false;
  });

};

if (window.ShadyCSS) {
  ShadyCSS.prepareTemplate(tmpl, 'x-sugarbuilder');
}

class SugarBuilder extends WrapHTML {
  static get observedAttributes() {
    return ['resizable','links','horizontal','strict','linkangles','renderer'];
  }

  constructor() {
    super();
    log('Initiating SugarBuilder element');
  }

  connectedCallback() {
    if (window.ShadyCSS) {
      ShadyCSS.styleElement(this);
    }
    let shadowRoot = this.attachShadow({mode: 'open'});
    let template_content = tmpl.content.cloneNode(true);
    template_content.querySelector('x-sviewer').setAttribute('sugars',this.getAttribute('sugars'));
    shadowRoot.appendChild(template_content);
    wire_sviewer_events.call(this,shadowRoot.getElementById('viewer'));
    this.attributeChangedCallback('horizontal');
    this.attributeChangedCallback('resizeable');
    this.attributeChangedCallback('linkangles');
    this.attributeChangedCallback('links');
    this.attributeChangedCallback('sugars');

    if (this.hasAttribute('reactions-src')) {
      fetch(this.getAttribute('reactions-src') || 'reactions.json')
      .then((response) => response.json())
      .then((reactions) => this.reactions = reactions )
      .then( () => reset_form_disabled(this,this.shadowRoot.getElementById('viewer')) );
    }

    this.reactiongroup = Glycan.ReactionGroup.groupFromJSON({},IupacSugar);


    if ( this.reactiongroup ) {
      update_donors.call(this,this.reactiongroup);
      // reset_form_disabled(this,this.shadowRoot.getElementById('viewer'));
    }
  }

  attributeChangedCallback(name) {
    if ( ! this.shadowRoot ) {
      return;
    }
    if (['links','horizontal','resizeable','linkangles'].indexOf(name) >= 0 ) {
      if (this.hasAttribute(name)) {
        this.shadowRoot.getElementById('viewer').setAttribute(name,'');
      } else {
        this.shadowRoot.getElementById('viewer').removeAttribute(name);
      }
    }
    if (name === 'linkangles') {
      this.attributeChangedCallback('links');
    }
    if (name === 'renderer') {
      if (this.hasAttribute(name)) {
        this.shadowRoot.getElementById('viewer').setAttribute(name,this.getAttribute(name));
      } else {
        this.shadowRoot.getElementById('viewer').removeAttribute(name);
      }
    }
    if (name === 'strict') {
      reset_form_disabled(this,this.shadowRoot.getElementById('viewer'));
    }
  }

  savePNG() {
    this.shadowRoot.getElementById('viewer').save('png');
  }

  saveSVG() {
    this.shadowRoot.getElementById('viewer').save('svg');
  }


  set sequence(sequence) {
    this.shadowRoot.getElementById('viewer').sequence = sequence;
    setTimeout( () => reset_form_disabled(this,this.shadowRoot.getElementById('viewer')),10);
  }
  get sequence() {
    return this.shadowRoot.getElementById('viewer').sequence;
  }

  get textContent() {
    return this.sequence;
  }

  get sugar() {
    return this.shadowRoot.getElementById('viewer').renderer.sugars[0];
  }

  get repeats() {
    return this.shadowRoot.getElementById('viewer').repeats;
  }

  set reactions(reactions) {

    this.reactiongroup = Glycan.ReactionGroup.groupFromJSON(reactions,IupacSugar);
    update_donors.call(this,this.reactiongroup).then( () => {
      reset_form_disabled(this,this.shadowRoot.getElementById('viewer'));
    });
    let epimerases = this.reactiongroup.reactions.filter( reac => reac.delta.root.identifier != 'Root' );
    console.log(epimerases);
  }

  get reactions() {
    return this.reactiongroup;
  }

}

customElements.define('x-sugarbuilder',SugarBuilder);

export default SugarBuilder;