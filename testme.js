let { render_iupac_sugar } = require('.');
render_iupac_sugar(['Gal','Glc']).then( res => console.log(res[0]) );