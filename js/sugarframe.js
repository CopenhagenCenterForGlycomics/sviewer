/* globals document,HTMLElement,customElements,window,fetch,ShadyCSS */
'use strict';

import * as debug from 'debug-any-level';

import * as Glycan from 'glycan.js';

const module_string='sviewer:sugarframe';

const log = debug(module_string);

const Iupac = Glycan.CondensedIupac.IO;

const IupacSugar = Iupac(Glycan.Sugar);

const NLINKED_CORE = new IupacSugar();
NLINKED_CORE.sequence = 'Man(a1-3)[Man(a1-6)]Man(b1-4)GlcNAc(b1-4)GlcNAc(b1-N)Asn';

const HEPG2_GENES = ['CSGALNACT1',
'ALG10',
'FUT8',
'GCNT3',
'ST3GAL6',
'MGAT5',
'PIGZ',
'KDELC2',
'C1GALT1',
'B4GALNT4',
'ALG6',
'CHSY1',
'PIGA',
'ALG1',
'FUT10',
'EXTL2',
'TMTC4',
'FKTN',
'B4GALNT1',
'ALG10B',
'EXT1',
'ALG8',
'POMT2',
'KDELC1',
'PIGV',
'B4GALT7',
'GALNT11',
'B4GALNT3',
'GALNT10',
'PIGB',
'DPY19L1',
'B4GALT5',
'ALG14',
'DPY19L4',
'ALG5',
'FUT11',
'GXYLT1',
'DPM1',
'EXTL3',
'GCNT2',
'TMTC3',
'PIGM',
'DPY19L3',
'XYLT2',
'ALG12',
'ST3GAL3',
'STT3B',
'B3GNT3',
'FUT6',
'GCNT1',
'FUT1',
'ST6GALNAC6',
'B3GAT3',
'CHPF',
'ST3GAL4',
'CSGALNACT2',
'MGAT4A',
'GALNT1',
'FKRP',
'C1GALT1C1',
'B3GNT2',
'OGT',
'ST6GALNAC4',
'B4GALT1',
'MFNG',
'CHPF2',
'STT3A',
'ALG2',
'RFNG',
'B4GALT4',
'ST6GAL1',
'MGAT1',
'B4GALT3',
'ST3GAL1',
'MGAT4B',
'GALNT2',
'B3GALT6',
'POFUT2',
'POGLUT1',
'ALG9',
'MGAT2',
'EXT2',
'B4GALT2',
'POMT1',
'ST3GAL2',
'ALG3',
'UGCG',
'POFUT1',
'ALG13',
'TMEM5',
'ALG11',
'POMGNT1',
'B3GALNT2'];


const HEK_GENES = [
'B3GALT6',
'PIGV',
'ST3GAL3',
'B4GALT2',
'POMGNT1',
'ALG6',
'ST6GALNAC3',
'ST6GALNAC5',
'ALG14',
'EXTL2',
'PIGM',
'B4GALT3',
'GALNT2',
'B3GALNT2',
'CSGALNACT2',
'FUT11',
'B4GALNT4',
'GALNT18',
'EXT2',
'B3GAT3',
'B4GAT1',
'ALG8',
'KDELC2',
'ALG9',
'ST3GAL4',
'STT3A',
'B4GALNT3',
'TMTC1',
'ALG10',
'ALG10B',
'GXYLT1',
'GALNT6',
'B4GALNT1',
'DPY19L2',
'TMEM5',
'TMTC2',
'TMTC3',
'GALNT4',
'B3GNT4',
'B3GLCT',
'ALG5',
'ALG11',
'TMTC4',
'KDELC1',
'MGAT2',
'FUT8',
'GALNT16',
'POMT2',
'PIGB',
'ST8SIA2',
'CHSY1',
'ALG1',
'XYLT1',
'ST3GAL2',
'XYLT2',
'ST6GALNAC1',
'ST6GALNAC2',
'MGAT5B',
'RFNG',
'B4GALT6',
'GALNT1',
'ST8SIA5',
'COLGALT1',
'DPY19L3',
'FKRP',
'B3GNT2',
'ST3GAL5',
'MGAT4A',
'MGAT5',
'GALNT13',
'GALNT3',
'CHPF',
'POFUT1',
'B4GALT5',
'DPM1',
'POFUT2',
'MGAT3',
'ALG12',
'STT3B',
'POMGNT2',
'EOGT',
'GXYLT2',
'ST3GAL6',
'POGLUT1',
'B4GALT4',
'B3GALNT1',
'B3GNT5',
'ST6GAL1',
'XXYLT1',
'ALG3',
'UGT8',
'GALNT7',
'CHSY3',
'GALNT10',
'B4GALT7',
'MGAT1',
'MGAT4B',
'GCNT2',
'B3GAT2',
'C1GALT1',
'DPY19L1',
'CHPF2',
'GALNT11',
'EXTL3',
'FUT10',
'DPY19L4',
'EXT1',
'ST3GAL1',
'B4GALT1',
'GCNT1',
'GALNT12',
'ALG2',
'FKTN',
'UGCG',
'ST6GALNAC4',
'ST6GALNAC6',
'POMT1',
'PIGA',
'OGT',
'ALG13',
'C1GALT1C1'
];

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
  <feMorphology operator="dilate" in="feather_back" radius="10"/>
  <feColorMatrix mode="matrix" values="0 0 0 0 0.1
                                       0 0 0 0 0.1
                                       0 0 0 0 0.1
                                       0 0 0 1 0" result="outeroutline"/>
  <feComposite in2="outeroutline" in="feather_back" result="outline"/>
  <feComposite in2="outline" in="SourceGraphic"/>
`;

if (window.ShadyCSS) {
  ShadyCSS.prepareTemplate(tmpl, 'x-sugarframe');
}

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
      this.reactiongroup.supportLinkages(sug,this.reactiongroup.reactions,tag_symbol);
      let matches = sug.match_sugar_pattern(NLINKED_CORE, Glycan.Reaction.Comparator );
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
    let wanted_reactions = [];
    console.log('We have',HEK_GENES.length,'HEK293 genes');
    console.log('We have',HEPG2_GENES.length,'HEPG2 genes');

    for (let gene of HEPG2_GENES) {
      if (reactions[gene]) {
        wanted_reactions[gene] = reactions[gene];
      }
    }
    this.reactiongroup = Glycan.ReactionGroup.groupFromJSON(wanted_reactions,IupacSugar);
  }

  get reactions() {
    return this.reactiongroup;
  }

}

customElements.define('x-sugarframe',SugarFrame);

export default SugarFrame;