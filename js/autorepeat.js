import { CondensedIupac, Sugar, Repeat, Reaction } from 'glycan.js';

const Iupac = CondensedIupac.IO;

const IupacSugar = Iupac(Sugar);

const TYPEI = new IupacSugar();
TYPEI.sequence = 'Gal(b1-3)GlcNAc(b1-?)*';

const TYPEII = new IupacSugar();
TYPEII.sequence = 'Gal(b1-4)GlcNAc(b1-?)*';


const repeat_pattern = Symbol('pattern');

const changed = (sugar) => {
  const patterns = [TYPEI,TYPEII];
  for (let pattern of patterns) {
    let matches = sugar.match_sugar_pattern(pattern, Reaction.Comparator);
    for (let match of matches) {
      let root = match.root.children[0].original;
      let leaf = match.leaves()[0].original;
      if ((root instanceof Repeat.Monosaccharide) || (leaf instanceof Repeat.Monosaccharide)) {
        continue;
      }
      if (root.parent && (root.parent instanceof Repeat.Monosaccharide) && root.parent.repeat[repeat_pattern] === pattern) {
        let repeat = root.parent.repeat;
        root.parent.removeChild(root.parent.linkageOf(root),root);
        repeat.identifier = ''+(parseInt(repeat.identifier)+1);
        continue;
      }
      let repeat = Repeat.addToSugar(sugar,root,leaf,Repeat.MODE_MINIMAL,1,1);
      repeat[repeat_pattern] = pattern;
      repeat.identifier = '1';
    }
  }
};

export default changed;