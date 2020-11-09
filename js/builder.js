/* globals document,HTMLElement,customElements,window,fetch,ShadyCSS */
'use strict';

import * as debug from 'debug-any-level';

import { CondensedIupac, Reaction, ReactionGroup, Repeat } from 'glycan.js';
import { default as SViewer, IupacSugar } from './sviewer';

import Highlighter from './highlighter';


const Iupac = CondensedIupac.IO;

class IupacReaction extends Iupac(Reaction) {}

const module_string='sviewer:builder';

const log = debug(module_string);

function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);

const donor_map_symbol = Symbol('donor_map');

class Builder extends SViewer {
  extendSugar(residue,donor_value,anomer_value,linkage_value) {
    return extend_sugar.call(this,residue,donor_value,anomer_value,linkage_value);
  }
}

customElements.define('x-builder',Builder);

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    --selection-color: #333;
    --button-default-background-color: #555;
    --demoted-opacity: 0.8;
  }
  :host {
    display: block;
    position: relative;
  }

  :host x-builder {
    width: 100%;
    height: 100%;
  }

  :host .widget_contents {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
<div class="widget_contents" >
  <x-builder editable resizable links id="viewer"><slot></slot></x-builder>
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
  let donor_descriptors = viewer.donors.concat( reaction_donors.filter( donor => viewer.donors.indexOf(donor) < 0 ) );
  let chain_donors = donors.reactions
                              .filter( reac => reac.delta.composition().length > 2 || reac.delta.root.identifier !== 'Root' );

  let donor_reaction_map = new Map();

  for (let reactionset of chain_donors) {
    for (let reaction of reactionset.positive) {
      let reaction_sequence = reaction.delta.sequence.replace(/\([abu]\d+-\d+\)$/,'');
      if (reaction.delta.root.identifier !== 'Root') {
        let donor_res = reaction.delta.root.children[0];
        if ( ! donor_res ) {
          continue;
        }
        reaction_sequence = donor_res.toSugar(reaction.delta.constructor).sequence;
      }
      if ( ! donor_reaction_map.has(reaction_sequence) ) {
        donor_reaction_map.set( reaction_sequence, new Map());
      }
      donor_reaction_map.get(reaction_sequence).set(reaction.delta.sequence,reaction);
      donor_descriptors.push( reaction_sequence );
    }
  }

  viewer[donor_map_symbol] = donor_reaction_map;

  let unique_donors = donor_descriptors.filter( (o,i,a) => a.indexOf(o) === i  );
  return viewer.setDonors(unique_donors);
};

function extend_sugar(residue,donor_value,anomer_value,linkage_value) {
  let sug = new IupacSugar();

  sug.sequence = donor_value;

  let new_res = sug.root;

  new_res.anomer = anomer_value;

  new_res.parent_linkage = donor_value.match(/Neu(Gc|Ac)/) ? 2 : 1;

  let delta = `${sug.sequence}(${new_res.anomer}${new_res.parent_linkage}-${linkage_value})`;

  let reaction_string = `${residue.identifier}(u?-?)*+"{${delta}@y2a}"`;

  let reaction = new IupacReaction();
  reaction.sequence = reaction_string;

  let donor_map = this[donor_map_symbol];
  if (donor_map.has(donor_value)) {
    let donor_reactions = donor_map.get(donor_value);
    for (let donor_reaction of donor_reactions.values()) {
      let child = donor_reaction.delta.root.children[0];
      let child_linkage = donor_reaction.delta.root.linkageOf(child);
      if (child.anomer == anomer_value && child_linkage == linkage_value) {
        reaction = donor_reaction;
      }
    }
  }

  let renderer = residue.renderer;
  if ( (residue instanceof Repeat.Monosaccharide) &&
       (residue.repeat.mode === Repeat.MODE_MINIMAL) ) {
    if ( (! residue.endsRepeat || residue.repeat.root.identifier !== new_res.identifier) &&
         (['Fuc','HSO3'].indexOf(new_res.identifier) >= 0) ) {
      reaction.execute(renderer.sugars[0],residue);
    }
    return [ ...sug.composition() ];
  } else {
    return reaction.execute(renderer.sugars[0],residue);
  }

}

const reset_form_disabled = function(widget,viewer) {
  let sugar = viewer.renderer.sugars[0].clone();
  sugar.freeze();
  viewer.available.highlight();
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
    viewer.available.highlight();
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
    if (supported.substrate) {      
      viewer.available.highlight(supported.substrate.map( res => sugar.location_for_monosaccharide(res) ).map( loc => viewer.renderer.sugars[0].locate_monosaccharide(loc) ));
    }
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
    viewer.available.highlight();
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
    template_content.querySelector('x-builder').setAttribute('sugars',this.getAttribute('sugars'));
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

    this.reactiongroup = ReactionGroup.groupFromJSON({},IupacSugar);


    if ( this.reactiongroup ) {
      update_donors.call(this,this.reactiongroup);
      // reset_form_disabled(this,this.shadowRoot.getElementById('viewer'));
    }

    let selection_highlighter = new Highlighter(shadowRoot.getElementById('viewer'),'available');
    selection_highlighter.setStates({opacity:0}, { opacity: 1 });
    selection_highlighter.duration = 10;
    selection_highlighter.draw = ({ angle, opacity },{x, y, width, height, zoom},ctx) => {
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = parseFloat((2 / Math.max(zoom,1)).toFixed(2));
      ctx.strokeStyle = `rgba(0,0,0,0.5)`;
      ctx.arc( x+0.5*width,y+0.5*height, 1.2*width/2,-0.5*Math.PI, 2*Math.PI, false );
      ctx.stroke();
    };
    shadowRoot.getElementById('viewer').available = selection_highlighter;

    shadowRoot.getElementById('viewer').addEventListener('change', (ev) => {
      let event = new Event('change',{bubbles: true});
      this.dispatchEvent(event);
    });

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

  async toDataURL(format) {
    return this.shadowRoot.getElementById('viewer').toDataURL(format);
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

    this.reactiongroup = ReactionGroup.groupFromJSON(reactions,IupacSugar);
    update_donors.call(this,this.reactiongroup).then( () => {
      reset_form_disabled(this,this.shadowRoot.getElementById('viewer'));
    });
  }

  get reactions() {
    return this.reactiongroup;
  }

}

customElements.define('x-sugarbuilder',SugarBuilder);

export default SugarBuilder;