const {CondensedIupac, Mass, Sugar, Monosaccharide, LinkageLayout, SugarAwareLayout, SVGRenderer, Repeat, Reaction } = require('glycan.js');

const { createSVGWindow } = require('svgdom');

const a_window = createSVGWindow();
const a_document = a_window.document;

const isNodejs = () => { return typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node !== 'undefined'; };

class BrowserShimmedSVGRenderer extends SVGRenderer {
  constructor(layout) {
    super(a_document.documentElement,layout);
    let defs = a_document.createElementNS('http://www.w3.org/2000/svg','defs');
    this.element.canvas.appendChild(defs);
    this.element.canvas.setAttribute('xmlns','http://www.w3.org/2000/svg');
    this.element.canvas.setAttribute('xmlns:sviewer','https://glycocode.com/sviewer');
  }

  static get SYMBOLS() {
    return (! SVGRenderer.SYMBOLS && isNodejs()) ? require('fs').readFileSync('node_modules/glycan.js/sugars.svg') : SVGRenderer.SYMBOLS; 
  }

  static AppendSymbols(element) {

    const icons_elements = Promise.resolve(this.SYMBOLS).then( SYMBOLS_DEF => {
      let newdoc = createSVGWindow().document;
      newdoc.documentElement.innerHTML = SYMBOLS_DEF;
      return newdoc.documentElement;
    }).then( el => {
      return el.querySelectorAll('svg defs symbol');
    });

    return icons_elements.then( symbols => {
      for (let symbol of symbols ) {
        element.appendChild(symbol.cloneNode(true));
      }
    });
  }

  scaleToFit() {
    let min = {x: null, y: null};
    let max = {x: null, y: null};
    for (let sugar of this.sugars) {

      for (let res of sugar.composition()) {
        let element = this.rendered.get(res).residue.element;
        if (element.hidden) {
          continue;
        }
        let transform = element.getAttribute('transform').replace(/rotate\([^\)]*\)/,'').trim();
        let [translate,scale] = transform.split(/\s+/).map( el => el.replace(/[^\d\.\-,]/g,'').split(',').map(parseFloat));
        if (min.x == null || (translate[0] < min.x)) {
          min.x = translate[0];
        }
        if (max.x == null || ((translate[0] + scale[0]) > max.x) ) {
          max.x = translate[0] + scale[0];
        }

        if (min.y == null || (translate[1] < min.y)) {
          min.y = translate[1];
        }
        if (max.y == null || ((translate[1] + scale[1]) > max.y) ) {
          max.y = translate[1] + scale[1];
        }
      }
    }

    let bb = { x: min.x, y: min.y, width: max.x - min.x, height: max.y - min.y };

    let bbx=bb.x;
    let bby=bb.y;
    let bbw=bb.width;
    let bbh=bb.height;
    let vb=[bbx,bby,bbw,bbh];
    for (let svg of a_document.documentElement.childNodes) {
      svg.setAttribute('viewBox', vb.join(' ') );
      svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    }
  }

}

const Glycan = {CondensedIupac, Mass, Sugar, Monosaccharide, LinkageLayout, SugarAwareLayout, SVGRenderer: BrowserShimmedSVGRenderer, Repeat, Reaction };

const Iupac = CondensedIupac.IO;

const IupacSugar = Mass(Iupac(Sugar));

const SPACINGS = Object.freeze({"compact":0.5, "tight":0.75, "normal":1, "loose": 1.5 });

function AdjustSpacing(layout,spacing="normal") {
  return class AdjustedLayout extends layout {
    static get DELTA_X() {
      return super.DELTA_X*(SPACINGS[spacing] || 1);
    }

    static get DELTA_Y() {
      return super.DELTA_Y*(SPACINGS[spacing] || 1);
    }    
  } 
}


function parse_sequences(sequence) {
  let is_array_input = Array.isArray(sequence);
  if (! Array.isArray(sequence)) {
    sequence = [sequence];
  }
  let sugars = sequence.map( seq => {
    let sugar = new IupacSugar();
    sugar.sequence = seq;
    return sugar;
  });
  return sugars;
}

function create_renderer_for_sugars(sugars, layout=SugarAwareLayout, spacing="normal") {
  let renderer = new BrowserShimmedSVGRenderer(AdjustSpacing(layout,spacing));
  for (let sugar of sugars) {
    renderer.addSugar(sugar);
  }
  return renderer;  
}

async function serialise_rendered(sugars,renderer,is_array_input=false) {
  await BrowserShimmedSVGRenderer.AppendSymbols(renderer.element.canvas.querySelector('defs'));
  let result = sugars.map( sugar => {
    let target = renderer.element.canvas.cloneNode()
    target.appendChild(renderer.element.canvas.querySelector('defs').cloneNode(true));
    target.appendChild(renderer.rendered.get(sugar).element);
    return target.outerHTML;
  });
  if ( ! is_array_input ) {
    return result[0];
  } else {
    return result;
  }
}

async function render_iupac_sugar(sequence='Man(a1-3)Man(b1-4)GlcNAc(b1-4)GlcNAc(b1-O)Ser',options={linkage:false,oxford:false,rotate:false,leftToRight:false,spacing:"normal"}) {

  let is_array_input = Array.isArray(sequence);

  let sequences = sequence;

  if (! Array.isArray(sequence)) {
    sequences = [sequence];
  }

  let sugars = parse_sequences(sequences);

  let renderer = create_renderer_for_sugars(sugars,options.oxford ? LinkageLayout : SugarAwareLayout,options.spacing);

  renderer.LayoutEngine.LINKS = options.linkage ? true : false;
  renderer.rotate = options.rotate;
  renderer.leftToRight = options.leftToRight;
  renderer.refresh();
  renderer.scaleToFit();

  for (const [idx,identifier] of sequences.entries()) {
    renderer.rendered.get(sugars[idx]).element.setAttribute('sviewer:seq',sequences[idx]);
    if (options.title) {
      renderer.rendered.get(sugars[idx]).element.setAttribute('sviewer:title',options.title);
    }
  }
  return await serialise_rendered(sugars,renderer,Array.isArray(sequence));

};

async function render_iupac_sugar_fragment(sequence='Man(a1-3)Man(b1-4)GlcNAc(b1-4)GlcNAc(b1-O)Ser+"from(y2a)"',options={linkage:false,oxford:false,rotate:false,leftToRight: false, title:"Sugar",spacing:"normal"}) {

  let is_array_input = Array.isArray(sequence);

  let sequences = sequence;

  if (! Array.isArray(sequence)) {
    sequences = [sequence];
  }

  let sugars = parse_sequences(sequences.map( seq => seq.replace(/\+\".*/,'') ));

  let renderer = create_renderer_for_sugars(sugars,options.oxford ? LinkageLayout : SugarAwareLayout,options.spacing);

  renderer.LayoutEngine.LINKS = options.linkage ? true : false;
  renderer.rotate = options.rotate;
  renderer.leftToRight = options.leftToRight;
  renderer.refresh();

  for (const [idx,identifier] of sequences.map( seq => seq.replace(/[^"]*\"/,'').replace('"','') ).entries()) {
    let matches = identifier.match(/from\((.*)\)/);
    if ( ! matches ) {
      continue;
    }
    let position = matches[1];
    const sugar = sugars[idx];
    let wanted = sugar.composition(sugar.locate_monosaccharide(position));
    let togo = sugar.composition().filter( res => wanted.indexOf(res) < 0 );
    for (const res of togo) {
      let rendered = renderer.rendered.get(res).residue;
      let rendered_linkage = renderer.rendered.get(res).linkage;
      if (rendered.element) {
        rendered.element.parentNode.removeChild(rendered.element);
        rendered.element.hidden = true;
      }
      if (rendered_linkage && rendered_linkage.parentNode) {
        rendered_linkage.parentNode.removeChild(rendered_linkage);
      }
      if (rendered_linkage && rendered_linkage.element && rendered_linkage.element.parentNode) {
        rendered_linkage.element.parentNode.removeChild(rendered_linkage.element);          
      }

      for (const kid of res.children) {
        let kid_rendered = renderer.rendered.get(kid).linkage;
        if (kid_rendered && kid_rendered.parentNode) {
          kid_rendered.parentNode.removeChild(kid_rendered);          
        }
        if (kid_rendered && kid_rendered.element && kid_rendered.element.parentNode) {
          kid_rendered.element.parentNode.removeChild(kid_rendered.element);          
        }

      }
    }
  }

  for (const [idx,identifier] of sequences.entries()) {
    renderer.rendered.get(sugars[idx]).element.setAttribute('sviewer:seq',sequences[idx]);
    if (options.title) {
      renderer.rendered.get(sugars[idx]).element.setAttribute('sviewer:title',options.title);
    }
  }


  renderer.scaleToFit();

  return await serialise_rendered(sugars,renderer,Array.isArray(sequence));


}


export { Glycan, render_iupac_sugar, render_iupac_sugar_fragment };


