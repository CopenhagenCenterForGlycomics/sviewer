const {CondensedIupac, Mass, Sugar, Monosaccharide, LinkageLayout, SugarAwareLayout, SVGRenderer, SVGCanvas, Repeat, Reaction } = require('glycan.js');

const { createSVGWindow, SVGSVGElement } = require('svgdom');

const isNodejs = () => { return typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node !== 'undefined'; };

const a_window = createSVGWindow();
const a_document = a_window.document;

const upgrade_symbol_elements = (canvas,symbols) => {

  // Should be AppendSymbols ?

  // let icons = canvas.ownerDocument.createElement('div');
  // icons.innerHTML = symbols.replace(/<\?.*\?>/,'');

  // let ids = [...icons.querySelectorAll('defs symbol')].map( el => el.getAttribute('id'));
  // for (let symbol of canvas.querySelectorAll('symbol')) {
  //   if (ids.indexOf(symbol.getAttribute('id')) >= 0) {
  //     symbol.parentNode.removeChild(symbol);
  //   }
  // }
  // for (let defs of icons.querySelectorAll('defs')) {
  //   canvas.appendChild(defs);
  // }
};

class BrowserShimmedSVGRenderer extends SVGRenderer {
  constructor(layout) {
    super(a_document.documentElement,layout);
    if (layout) {
      let defs = a_document.createElementNS('http://www.w3.org/2000/svg','defs');
      this.element.canvas.appendChild(defs);
      this.element.canvas.setAttribute('xmlns','http://www.w3.org/2000/svg');
      this.element.canvas.setAttribute('xmlns:sviewer','https://glycocode.com/sviewer');
    }
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
    for (let svg of a_document.documentElement.childNodes.filter( node => node instanceof SVGSVGElement )) {
      svg.setAttribute('viewBox', vb.join(' ') );
      svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    }
  }

  static fromSVGString(svg_string,sugar_class) {
    const static_window = createSVGWindow();
    const static_document = a_window.document;
    static_document.documentElement.innerHTML = svg_string;
    let element = static_document.childNodes[0];
    element.ownerDocument = static_document;
    return this.fromSVGElement(element,sugar_class);
  }

  static fromSVGElement(element,sugar_class) {
    let renderer = new BrowserShimmedStaticSVGRenderer();

    // We don't seem to be using the container so
    // we can skip setting it
    // renderer[container_symbol] = element.parentNode;

    renderer.element = new SVGCanvas(element);

    renderer.element.canvas.parentNode.removeChild(renderer.element.canvas);

    renderer.element.canvas = element;

    upgrade_symbol_elements(element,SVGRenderer.SYMBOLS);

    let sugar_elements = element.querySelectorAll('g');
    for (let group of sugar_elements) {
      if (! group.hasAttribute('glycanjs:sequence')) {
        continue;
      }
      let sugar = new sugar_class();
      sugar.sequence = group.getAttribute('glycanjs:sequence');
      renderer.addSugar(sugar);
      renderer.rendered.set(sugar,renderer.element.group(group));
      for (let icon of group.querySelectorAll('use')) {
        if ( ! icon.hasAttribute('glycanjs:location') ) {
          continue;
        }
        let rendered_data = { residue: { element: icon } };
        if (icon.parentNode !== group) {
          group.appendChild(icon);
        }
        renderer.rendered.set( sugar.locate_monosaccharide(icon.getAttribute('glycanjs:location')), rendered_data );
      }
      for (let link of group.querySelectorAll('g')) {
        if ( ! link.hasAttribute('glycanjs:location') ) {
          continue;
        }
        if (link.parentNode !== group) {
          group.appendChild(link);
          renderer.element.sendToBack(link);
        }
        let rendered_data = renderer.rendered.get( sugar.locate_monosaccharide(link.getAttribute('glycanjs:location')) );
        if ( ! rendered_data ) {
          console.log('ERROR loading linkage for ',sugar.sequence,'missing residue at',link.getAttribute('glycanjs:location'));
          continue;
        }
        rendered_data.linkage = link;
      }
    }
    return renderer;
  }

}

class BrowserShimmedStaticSVGRenderer extends BrowserShimmedSVGRenderer {
  layoutFor(residue) {
    let {x,y,width,height} = this.rendered.get(residue).residue.element.getBoundingClientRect();
    return {x,y,width,height};
  }

  screenCoordinatesFromLayout(layout) {
    return layout;
  }
}

export { BrowserShimmedSVGRenderer, BrowserShimmedStaticSVGRenderer };