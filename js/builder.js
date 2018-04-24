/* globals document,HTMLElement,customElements,window,fetch,ShadyCSS */
'use strict';

import * as debug from 'debug-any-level';

import * as Glycan from 'glycan.js';

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
    if (values.indexOf(el.value) >= 0) {
      console.log('Enabling',el.value);
      el.removeAttribute('disabled');
    } else {
      console.log('Disabling',el.value);
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

const reset_form_disabled = function(widget,viewer) {
  let supported = widget.reactiongroup.supportsLinkageAt(viewer.renderer.sugars[0]);
  adapt_form.call(widget,viewer.form.donor,supported.donor);
  adapt_form.call(widget,viewer.form.anomer);
  adapt_form.call(widget,viewer.form.linkage);
};

const wire_sviewer_events = function(viewer) {
  const widget = this;
  let changed = false;
  viewer.form.addEventListener('change',function() {
    let reactions = widget.reactiongroup;

    let donor_val = this.donor.value ? this.donor.value : undefined;
    let linkage_val = this.linkage.value ? parseInt(this.linkage.value) : undefined;
    let residue_val = this.residue ? this.residue : undefined;
    let supported = reactions.supportsLinkageAt(viewer.renderer.sugars[0],donor_val,linkage_val,residue_val);
    adapt_form.call(widget,viewer.form.anomer,supported.anomer);
    adapt_form.call(widget,viewer.form.linkage,supported.linkage.map( link => ''+link ));
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
    return ['resizable','links','horizontal'];
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
    shadowRoot.appendChild(tmpl.content.cloneNode(true));
    wire_sviewer_events.call(this,shadowRoot.getElementById('viewer'));
    this.attributeChangedCallback('links');
    this.attributeChangedCallback('horizontal');
    this.attributeChangedCallback('resizeable');

    fetch('/reactions.json')
    .then((response) => response.json())
    .then((reactions) => this.reactions = reactions )
    .then( () => reset_form_disabled(this,this.shadowRoot.getElementById('viewer')) );

    if ( this.sequence && this.reactiongroup ) {
      reset_form_disabled(this,this.shadowRoot.getElementById('viewer'));
    }
  }

  attributeChangedCallback(name) {
    if ( ! this.shadowRoot ) {
      return;
    }
    if (['links','horizontal','resizeable'].indexOf(name) >= 0 ) {
      if (this.hasAttribute(name)) {
        this.shadowRoot.getElementById('viewer').setAttribute(name,'');
      } else {
        this.shadowRoot.getElementById('viewer').removeAttribute(name);
      }
    }
  }

  set sequence(sequence) {
    this.shadowRoot.getElementById('viewer').sequence = sequence;
    reset_form_disabled(this,this.shadowRoot.getElementById('viewer'));
  }
  get sequence() {
    return this.shadowRoot.getElementById('viewer').sequence;
  }

  get textContent() {
    return this.sequence;
  }

  set reactions(reactions) {

    let Iupac = Glycan.CondensedIupac.IO;

    let IupacSugar = Iupac(Glycan.Sugar);

    this.reactiongroup = Glycan.ReactionGroup.groupFromJSON(reactions,IupacSugar);
  }

  get reactions() {
    return this.reactiongroup;
  }

}

customElements.define('x-sugarbuilder',SugarBuilder);

export default SugarBuilder;