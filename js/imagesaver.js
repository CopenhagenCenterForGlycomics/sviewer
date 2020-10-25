/* globals document,MouseEvent,window,Blob,XMLSerializer,Image,HTMLCanvasElement */

let download = (uri,filename='image.png') => {
  var evt = new MouseEvent('click', {
    view: window,
    bubbles: false,
    cancelable: true
  });
  var a = document.createElement('a');
  document.body.appendChild(a);
  a.style = 'display: none';
  a.setAttribute('download', filename);
  a.setAttribute('href', uri);
  a.dispatchEvent(evt);
};

const rect_tmpl = document.createElement('template');

rect_tmpl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><rect  x="0" y="0" width="100" height="100" fill="#fff" opacity="0" /></svg>';

let save = async (widget,svg,format='png',filename='image') => {
  let data = await prepare(widget,svg,format);
  download(data,`${filename}.${format}`);
}

let prepare = (widget,svg,format='png') => {
  if (format === 'png' && (svg instanceof HTMLCanvasElement)) {
    let uri = svg.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    return Promise.resolve(uri);
  }
  let canvas = document.createElement('canvas');
  canvas.width=widget.getBoundingClientRect().width;
  canvas.height=widget.getBoundingClientRect().height;
  let ctx = canvas.getContext('2d');
  let new_svg = svg.cloneNode(true);
  if (widget.shadowRoot.getElementById('icons')) {
    let defs = widget.shadowRoot.getElementById('icons').querySelector('defs');
    new_svg.appendChild(defs.cloneNode(true));
    for (let symbol of new_svg.querySelectorAll('defs symbol')) {
      symbol.insertBefore(rect_tmpl.content.cloneNode(true).firstChild.firstChild, symbol.firstChild);
    }
  }
  for (let strokes of new_svg.querySelectorAll('symbol *[stroke-width]')) {
    if (strokes.getAttribute('fill') === 'none') {
      continue;
    }
  }

  for (let use of new_svg.querySelectorAll('use')) {
    use.setAttribute('xlink:href',use.getAttribute('xlink:href').replace(/.*#/,'#'));
  }
  let data = (new XMLSerializer()).serializeToString(new_svg);

  if (format === 'svg') {
    if(!data.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        data = data.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if(!data.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
        data = data.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    //add xml declaration
    data = '<?xml version="1.0" standalone="no"?>\r\n' + data;

    return Promise.resolve('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(data));
  }

  var img = new Image();
  var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  var url = window.URL.createObjectURL(svgBlob);


  return new Promise( resolve => {
    img.onload = function () {
      ctx.drawImage(img, 0, 0);
      window.URL.revokeObjectURL(url);

      let uri = canvas
          .toDataURL('image/png')
          .replace('image/png', 'image/octet-stream');
      resolve(uri);
    };
    img.src = url;
  });

};

export default save;
export { prepare, download };
