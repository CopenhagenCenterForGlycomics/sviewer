/* globals document,HTMLElement,customElements,window,fetch,ShadyCSS */
'use strict';

import * as debug from 'debug-any-level';

import * as Glycan from 'glycan.js';

const module_string='sviewer:sugarframe';

const log = debug(module_string);

const Iupac = Glycan.CondensedIupac.IO;

const IupacSugar = Iupac(Glycan.Sugar);


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
  :host div {
    display: none;
  }
  :host .widget_contents {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>

<div id="styles">
<slot></slot>
</div>

<object id="targetsvg" type="image/svg+xml"></object>
`;

if (window.ShadyCSS) {
  ShadyCSS.prepareTemplate(tmpl, 'x-sugarframe');
}

let copy_styles = function() {
  let svg = this.shadowRoot.querySelector('object').contentDocument;
  var styleElement = svg.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleElement.textContent = this.shadowRoot.querySelector('slot').assignedNodes().map( node => node.textContent ).join('\n');
  svg.documentElement.appendChild(styleElement);
};

class SugarFrame extends WrapHTML {
  static get observedAttributes() {
    return [];
  }

  constructor() {
    super();
    log('Initiating SugarFrame element');
  }

  connectedCallback() {
    if (window.ShadyCSS) {
      ShadyCSS.styleElement(this);
    }
    let shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(tmpl.content.cloneNode(true));
    this.shadowRoot.getElementById('targetsvg').addEventListener('load', () => {
      copy_styles.call(this);
      this.renderer = Glycan.SVGRenderer.fromSVGElement(this.shadowRoot.querySelector('object').contentDocument.documentElement,IupacSugar);
      this.tagSupported();
    });
    this.shadowRoot.getElementById('targetsvg').setAttribute('data',this.getAttribute('src'));
    fetch('/reactions.json')
    .then((response) => response.json())
    .then((reactions) => this.reactions = reactions );

  }

  attributeChangedCallback(name) {
    if ( ! this.shadowRoot ) {
      return;
    }
    if ([].indexOf(name) >= 0 ) {
      if (this.hasAttribute(name)) {
        this.shadowRoot.getElementById('viewer').setAttribute(name,'');
      } else {
        this.shadowRoot.getElementById('viewer').removeAttribute(name);
      }
    }
  }

  tagSupported() {
    let tag_symbol = Symbol('supported');
    this.renderer.groupTag = tag_symbol;
    this.renderer.sugars.forEach( sug => {
      this.reactiongroup.supportLinkages(sug,this.reactiongroup.reactions.slice(1,60),tag_symbol);
    });
    this.renderer.refresh();
  }

  set reactions(reactions) {
    this.reactiongroup = Glycan.ReactionGroup.groupFromJSON(reactions,IupacSugar);
  }

  get reactions() {
    return this.reactiongroup;
  }

}

customElements.define('x-sugarframe',SugarFrame);

export default SugarFrame;