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
        let transform = element.getAttribute('transform').trim();
        let [translate,scale] = transform.split(/\s+/).map( el => el.replace(/[^\d\.\-,]/g,'').split(',').map(parseFloat));
        if (min.x == null || translate[0] < min.x) {
          min.x = translate[0];
        }
        if (max.x == null || translate[0] + scale[0] > max.x ) {
          max.x = translate[0] + scale[0];
        }

        if (min.y == null || translate[1] < min.y) {
          min.y = translate[1];
        }
        if (max.y == null || translate[1] + scale[1] > max.y ) {
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


async function render_iupac_sugar(sequence='Man(a1-3)Man(b1-4)GlcNAc(b1-4)GlcNAc(b1-O)Ser',options={linkage:false,oxford:false}) {
  let sugar = new IupacSugar();
  sugar.sequence = sequence;
  let renderer = new BrowserShimmedSVGRenderer(options.oxford ? LinkageLayout : SugarAwareLayout);
  renderer.addSugar(sugar);
  renderer.LayoutEngine.LINKS = options.linkage ? true : false;
  renderer.rotate = false;
  renderer.refresh();
  renderer.scaleToFit();
  return BrowserShimmedSVGRenderer.AppendSymbols(renderer.element.canvas.querySelector('defs')).then( () => {
    return renderer.element.canvas.outerHTML;
  });
};


export { Glycan, render_iupac_sugar };


