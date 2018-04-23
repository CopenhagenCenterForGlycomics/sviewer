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


const set_anomers = function(viewer,anomers) {
  if ( ! anomers ) {
    for (let anomer of viewer.form.anomer) {
      anomer.removeAttribute('disabled'); 
    }
    return;
  }
  for (let anomer of viewer.form.anomer) {
    if (anomers.indexOf(anomer.value) >= 0) {
      anomer.removeAttribute('disabled'); 
    } else {
      anomer.setAttribute('disabled','');       
    }
  }
};

const set_linkage = function(viewer,linkages) {
  if ( ! linkages ) {
    for (let linkage of viewer.form.linkage) {
      linkage.removeAttribute('disabled'); 
    }
    return;
  }
  linkages = [0].concat(linkages);
  for (let linkage of viewer.form.linkage) {
    if (linkages.indexOf(parseInt(linkage.value)) >= 0) {
      linkage.removeAttribute('disabled'); 
    } else {
      linkage.setAttribute('disabled','');       
    }
  }
};

const set_donor = function(viewer,donors) {
  if ( ! donors ) {
    for (let donor of viewer.form.donor) {
      donor.removeAttribute('disabled'); 
    }
    return;
  }
  for (let donor of viewer.form.donor) {
    if (donors.indexOf(donor.value) >= 0) {
      console.log('Enabling',donor.value);
      donor.removeAttribute('disabled'); 
    } else {
      console.log('Disabling',donor.value);
      donor.setAttribute('disabled','');       
    }
  }
};

const reset_form_disabled = function(widget,viewer) {
  let supported = widget.reactiongroup.supportsLinkageAt(viewer.renderer.sugars[0]);
  set_donor(viewer,supported.donor);
  set_anomers(viewer);
  set_linkage(viewer);
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
    set_anomers(viewer,supported.anomer);
    set_linkage(viewer,supported.linkage);
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
    .then((reactions) => this.reactions = reactions );
  }

  attributeChangedCallback(name) {
    if (['links','horizontal','resizeable'].indexOf(name) >= 0 ) {
      if (this.hasAttribute(name)) {
        this.shadowRoot.getElementById('viewer').setAttribute(name,'');
      } else {
        this.shadowRoot.getElementById('viewer').removeAttribute(name);        
      }
    }
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