
import { ReactionGroup, SEQUENCE_CACHEKEY } from 'glycan.js';


const primary_cache_key = Symbol('primary_cache');
const secondary_cache_key = Symbol('secondary_cache');


const prepare_reactions = function(json,sugar_class) {

  let ABO = json.ABO;
  let B4GALNT2 = json.B4GALNT2;
  let MGAT2 = json.MGAT2;
  let MGAT3 = json.MGAT3;
  let MGAT4A = json.MGAT4A;
  let MGAT4B = json.MGAT4B;
  let MGAT4C = json.MGAT4C;
  let MGAT5 = json.MGAT5;
  let MGAT5B = json.MGAT5B;
  let GCNT3 = json.GCNT3;
  let GCNT4 = json.GCNT4;
  let CHST5 = json.CHST5;
  let CHST7 = json.CHST7;
  let CHST4 = json.CHST4;
  let CHST2 = json.CHST2;
  let HS3ST1 = json.HS3ST1;
  let HS3ST2 = json.HS3ST2;
  let HS3ST4 = json.HS3ST4;
  let HS3ST5 = json.HS3ST5;
  let HS3ST6 = json.HS3ST6;
  let HS3ST3A1 = json.HS3ST3A1;
  let HS3ST3B1 = json.HS3ST3B1;
  let HS6ST1 = json.HS6ST1;
  let HS6ST2 = json.HS6ST2;
  let HS6ST3 = json.HS6ST3;

  delete json.ABO;
  delete json.B4GALNT2;
  delete json.MGAT2;
  delete json.MGAT3;
  delete json.MGAT4A;
  delete json.MGAT4B;
  delete json.MGAT4C;
  delete json.MGAT5;
  delete json.MGAT5B;
  delete json.GCNT3;
  delete json.GCNT4;
  delete json.CHST5;
  delete json.CHST7;
  delete json.CHST4;
  delete json.CHST2;
  delete json.HS3ST1;
  delete json.HS3ST2;
  delete json.HS3ST4;
  delete json.HS3ST5;
  delete json.HS3ST6;
  delete json.HS3ST3A1;
  delete json.HS3ST3B1;
  delete json.HS6ST1;
  delete json.HS6ST2;
  delete json.HS6ST3;

  if (json.FUT8) {
    json.FUT8.reactions = json.FUT8.reactions.map( reacs => reacs.filter( r => r.indexOf('!') < 0 ) );
  }

  if ( ! (json.NDST1 || json.NDST2 || json.NDST3 || json.NDST4) ) {
    json["hs_epimerase"] = {
    "reactions" : [
       [
          "GlcA(b1-4)GlcNAc(a1-4)*(u?-?)Xyl(b1-O)Ser+\"{GlcN}@y4a\"",
          "IdoA(b1-4)GlcNAc(a1-4)*(u?-?)Xyl(b1-O)Ser+\"{GlcN}@y4a\""
       ]
    ]
    }
  }

  if ( ! (json.PIGL) ) {
    json["PIGL"] = {
    "reactions" : [
       [
          "GlcNAc(a1-6)PI+\"{GlcN}@y2a\""
       ]
    ]
    }
  }

  json.ANY = {
    "reactions" : [
    ["Any(a1-O)Ser+\"{Gal(b1-3)}@y2a\""],
    ["Any(a1-O)Ser+\"{GlcNAc(b1-3)}@y2a\""],
    ["Any(a1-O)Ser+\"{GalNAc(b1-3)}@y2a\""],
    ["Any(a1-O)Ser+\"{NeuAc(a2-3)}@y2a\""],
    ["Ser+\"{Any(a1-O)}@y1a\""]
    ]
  };

  // Fix for GPI anchor

  for (let gene of Object.keys(json)) {
    json[gene].reactions = json[gene].reactions.map( reactionset => reactionset.map( reaction => reaction.replace('[acyl(u?-?)]','') ));
  }

  let primaryGroup = ReactionGroup.groupFromJSON(json,sugar_class,['hs_epimerase','PIGL','NDST1','NDST2','NDST3','NDST4','GLCE','DSE','DSEL']);

  let secondary = {
    ABO,
    B4GALNT2,
    MGAT2,
    MGAT3,
    MGAT4A,
    MGAT4B,
    MGAT4C,
    MGAT5,
    MGAT5B,
    GCNT3,
    GCNT4,
    CHST5,
    CHST7,
    CHST4,
    CHST2,
    HS3ST1,
    HS3ST2,
    HS3ST4,
    HS3ST5,
    HS3ST6,
    HS3ST3A1,
    HS3ST3B1,
    HS6ST1,
    HS6ST2,
    HS6ST3,
  };

  secondary = Object.entries(secondary)
              .filter( ([key,val]) => val )
              .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});

  let secondaryGroup;

  if (Object.keys(secondary).length > 0) {
    secondaryGroup = ReactionGroup.groupFromJSON(secondary,sugar_class);
  }

  return { primaryGroup, secondaryGroup };
}

const tag_supported_primary = function(tag_symbol=Symbol('supported'),sugars,reactionsGroup,cacheKey=null) {
  sugars.forEach( sug => {
    reactionsGroup.supportLinkages(sug,reactionsGroup.reactions,tag_symbol,cacheKey);

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
  return tag_symbol;
}

const tag_supported_secondary = function(tag_symbol=Symbol('supported'),sugars,reactionsGroup,cacheKey=null) {
  for (let frozen_sugar of sugars) {

    // Tag all potential residues that could work
    // with a secondary reaction

    let potential = Symbol('potential');
    reactionsGroup.supportLinkages(frozen_sugar,reactionsGroup.reactions,potential,cacheKey);

    // Tag the potential residues with their actual
    // location in the sugar - we're going to
    // clone the sugar and remove "dead" residues
    // so we cant expect that the locations will
    // be the same

    let attach_symb = Symbol('cached_attachment');
    let no_attachments = true;
    for (let res of frozen_sugar.composition_for_tag(potential)) {
      res.setTag(attach_symb,frozen_sugar.location_for_monosaccharide(res));
      no_attachments = false;
    }

    if (no_attachments) {
      continue;
    }

    let sug = frozen_sugar.clone();

    // Prune all the "dead" residues (either unsupported)
    // or not a potential target for this enzyme

    for (let res of sug.composition() ) {
      if ( ! res.getTag(tag_symbol) && ! res.getTag(potential) ) {
        res.parent.removeChild(res.parent.linkageOf(res),res);
      }
    }

    // Find the actual valid attachments that are left over
    // after the pruning.
    const valid_attach = Symbol('valid_attach');
    reactionsGroup.supportLinkages(sug,reactionsGroup.reactions,valid_attach,SEQUENCE_CACHEKEY);
    let actual_attach = sug.composition_for_tag(valid_attach);

    // If there's a location tag, use it to find the original residue!
    for (let res of actual_attach) {
      if (res.getTag(attach_symb)) {
        frozen_sugar.locate_monosaccharide(res.getTag(attach_symb)).setTag(tag_symbol);
      }
    }
  }
}

const tag_supported = function(tag_symbol=Symbol('supported'),sugars,reactions,sugar_class) {

  const {primaryGroup,secondaryGroup} = prepare_reactions(reactions,sugar_class);

  // Do a first round only on
  // reactions that are "simple"
  // or should not wait for the
  // execution of reactions for other genes

  tag_supported_primary(tag_symbol,sugars,primaryGroup,primary_cache_key);

  if (secondaryGroup) {

    tag_supported_secondary(tag_symbol,sugars,secondaryGroup,secondary_cache_key);

  }

  return tag_symbol;

}

export { tag_supported };
