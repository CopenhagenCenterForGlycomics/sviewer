const {CondensedIupac, Mass, Sugar, Monosaccharide, LinkageLayoutFishEye, SugarAwareLayout, SVGRenderer, CanvasRenderer, Repeat, Reaction } = require('glycan.js');

const fs = require('fs');

const Iupac = CondensedIupac.IO;

const IupacSugar = Mass(Iupac(Sugar));

const { createSVGWindow } = require('svgdom');

let sugar = new IupacSugar();
sugar.sequence = 'Man(a1-3)Man(b1-4)GlcNAc(b1-4)GlcNAc(b1-O)Ser';

const window = createSVGWindow();
const document = window.document;

let renderer = new SVGRenderer(document.documentElement,SugarAwareLayout);

const svg = document.documentElement.firstChild;

let defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
svg.appendChild(defs);

function AppendSymbols(element) {

  const icons_elements = Promise.resolve(fs.readFileSync('node_modules/glycan.js/sugars.svg')).then( SYMBOLS_DEF => {
    let newdoc = createSVGWindow().document;
    newdoc.documentElement.innerHTML = SYMBOLS_DEF;
    return newdoc.documentElement;
  }).then( el => {
    return el.querySelectorAll('svg defs');
  });

  return icons_elements.then( symbols => {
    for (let symbol of symbols ) {
      element.appendChild(symbol.cloneNode(true));
    }
  });

}

renderer.addSugar(sugar);

renderer.LayoutEngine.LINKS = false;
renderer.rotate = false;
renderer.refresh();

let min = {x: null, y: null};
let max = {x: null, y: null};

for (let res of sugar.composition()) {
  let element = renderer.rendered.get(res).residue.element;
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

let bb = { x: min.x, y: min.y, width: max.x - min.x, height: max.y - min.y };

let bbx=bb.x;
let bby=bb.y;
let bbw=bb.width;
let bbh=bb.height;
let vb=[bbx,bby,bbw,bbh];
svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
svg.setAttribute('viewBox', vb.join(' ') );
svg.setAttribute('preserveAspectRatio','xMidYMid meet');
AppendSymbols(defs).then( () => {
  console.log(svg.outerHTML);  
})
