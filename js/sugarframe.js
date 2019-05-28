/* globals document,HTMLElement,customElements,window,ShadyCSS,CustomEvent */
'use strict';

import * as debug from 'debug-any-level';

import { CondensedIupac, Sugar, SVGRenderer, Reaction, ReactionGroup } from 'glycan.js';

const module_string='sviewer:sugarframe';

const log = debug(module_string);

const Iupac = CondensedIupac.IO;

const IupacSugar = Iupac(Sugar);

const NLINKED_CORE = new IupacSugar();
NLINKED_CORE.sequence = 'Man(a1-3)[Man(a1-6)]Man(b1-4)GlcNAc(b1-4)GlcNAc(b1-N)Asn';

function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);

const highlight_filter = Symbol('highlight');

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
    --highlight-stroke: #000;
    --highlight-stroke-opacity: 1;
    --highlight-fill-opacity: 1;
    --highlight-fill: #fff;
  }

  :host div {
    display: none;
  }

  :host .widget_contents {
    width: 100%;
    height: 100%;
    position: relative;
  }

  #styles {
    display: none;
  }
</style>

<div id="styles">
<slot></slot>
</div>

<object id="targetsvg" type="image/svg+xml"></object>
`;

const FILTER_TEXT = `
  <feColorMatrix mode="matrix" in="SourceGraphic" values="0 0 0 0 0
                                                          0 0 0 0 0
                                                          0 0 0 0 0
                                                          0 0 0 1 0" result="blacksource"/>
  <feGaussianBlur in="blacksource" stdDeviation="10" result="blur" />
  <feColorMatrix mode="matrix" in="blur" values="0 0 0 0 0
                                                 0 0 0 0 0
                                                 0 0 0 0 0
                                                 0 0 0 30 -3" result="contrastup"/>
  <feMorphology operator="dilate" in="contrastup" radius="3"/>
  <feColorMatrix mode="matrix"           values="0 0 0 0 1
                                                 0 0 0 0 1
                                                 0 0 0 0 1
                                                 0 0 0 0.3 0" result="feather_back"/>
  <feMorphology operator="dilate" in="feather_back" radius="5"/>
  <feColorMatrix mode="matrix" values="0 0 0 0 0.1
                                       0 0 0 0 0.1
                                       0 0 0 0 0.1
                                       0 0 0 1 0" result="outeroutline"/>
  <feComposite in2="outeroutline" in="feather_back" result="outline"/>
  <feComposite in2="outline" in="SourceGraphic"/>
`;

const hex_to_component = (hex) => {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  } : null;
};

const mixin_colours = (hex,opacity) => {
  let c = hex_to_component(hex.replace(/^\s+/,''));
  return `0 0 0 0 ${(c.r/255).toFixed(1)} 0 0 0 0 ${(c.g/255).toFixed(1)} 0 0 0 0 ${(c.b/255).toFixed(1)} 0 0 0 ${opacity} 0`;
};

const update_highlight_colours = function() {
  let filter = this[highlight_filter];
  let actual_style = window.getComputedStyle(this);
  let stroke = actual_style.getPropertyValue('--highlight-stroke');
  let fill = actual_style.getPropertyValue('--highlight-fill');
  let stroke_opacity = actual_style.getPropertyValue('--highlight-stroke-opacity');
  let fill_opacity = actual_style.getPropertyValue('--highlight-fill-opacity');
  filter.querySelector('feColorMatrix[result="outeroutline"]').setAttribute('values',mixin_colours(stroke,stroke_opacity));
  filter.querySelector('feColorMatrix[result="feather_back"]').setAttribute('values',mixin_colours(fill,fill_opacity));
};

const make_filter = function(svg) {
  const filter = svg.createElementNS('http://www.w3.org/2000/svg','filter');
  filter.innerHTML = FILTER_TEXT;
  filter.setAttribute('id','highlight');
  filter.setAttribute('filterUnits','objectBoundingBox');
  filter.setAttribute('y','-40%');
  filter.setAttribute('x','-40%');
  filter.setAttribute('width','180%');
  filter.setAttribute('height','180%');

  this[highlight_filter] = filter;
  svg.documentElement.appendChild(filter);
  update_highlight_colours.call(this);
};

const copy_styles = function() {
  let svg = this.shadowRoot.querySelector('object').contentDocument;
  var styleElement = svg.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleElement.textContent = this.shadowRoot.querySelector('slot').assignedNodes().map( node => node.textContent ).join('\n');
  svg.documentElement.appendChild(styleElement);
  make_filter.call(this,svg);
};

class SugarFrame extends WrapHTML {

  static get observedAttributes() {
    return [];
  }

  constructor() {
    super();
    if (window.ShadyCSS) {
      ShadyCSS.prepareTemplate(tmpl, this.tagName.toLowerCase());
    }
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
      this.renderer = SVGRenderer.fromSVGElement(this.shadowRoot.querySelector('object').contentDocument.documentElement,IupacSugar);
      for (let sugar of this.renderer.sugars) {
        sugar.freeze();
      }
      this.tagSupported();
      this.dispatchEvent(new CustomEvent('load', {
        bubbles: true,
      }));
    });
    this.shadowRoot.getElementById('targetsvg').setAttribute('data',this.getAttribute('src'));
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

  tagSupported(tag_symbol=Symbol('supported')) {
    if ( ! this.reactiongroup ) {
      return;
    }
    this.renderer.groupTag = Symbol('unsupported');
    this.renderer.refresh();
    this.renderer.groupTag = tag_symbol;
    this.renderer.sugars.forEach( sug => {
      this.reactiongroup.supportLinkages(sug,this.reactiongroup.reactions,tag_symbol);
      let matches = sug.match_sugar_pattern(NLINKED_CORE, Reaction.Comparator );
      if (matches.length > 0) {
        matches[0].composition().forEach( traced => traced.original.setTag(tag_symbol) );
      }
      sug.root.setTag(tag_symbol);

      for (let residue of sug.breadth_first_traversal()) {
        if ( ! residue.parent ) {
          continue;
        }
        if (! residue.parent.getTag(tag_symbol)) {
          residue.setTag(tag_symbol,null);
        }
      }
    });
    this.renderer.refresh();
  }

  set reactions(reactions) {
    if ( ! reactions ) {
      return;
    }
    this.reactiongroup = ReactionGroup.groupFromJSON(reactions,IupacSugar);
    if (this.renderer) {
      this.tagSupported();
    }
  }

  get reactions() {
    return this.reactiongroup;
  }

}

customElements.define('x-sugarframe',SugarFrame);

export default SugarFrame;