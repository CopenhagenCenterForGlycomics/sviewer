/* globals document,MouseEvent,window,Blob,XMLSerializer,Image */

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
  a.setAttribute('target', '_blank');
  a.dispatchEvent(evt);
};

let save = (widget,svg,format='png') => {
  let canvas = document.createElement('canvas');
  canvas.width=widget.getBoundingClientRect().width;
  canvas.height=widget.getBoundingClientRect().height;
  let ctx = canvas.getContext('2d');
  let new_svg = svg.cloneNode(true);
  let defs = widget.shadowRoot.getElementById('icons').querySelector('defs');
  new_svg.appendChild(defs.cloneNode(true));
  for (let strokes of new_svg.querySelectorAll('symbol *[stroke-width]')) {
    strokes.setAttribute('stroke-width',parseInt(strokes.getAttribute('stroke-width'))/100) ;
  }

  for (let use of new_svg.querySelectorAll('use')) {
    use.setAttribute('xlink:href',use.getAttribute('xlink:href').replace('sugars.svg',''));
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

    return download('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(data),'image.svg');
  }

  var img = new Image();
  var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  var url = window.URL.createObjectURL(svgBlob);

  img.onload = function () {
    ctx.drawImage(img, 0, 0);
    window.URL.revokeObjectURL(url);

    let uri = canvas
        .toDataURL('image/png')
        .replace('image/png', 'image/octet-stream');
    download(uri,'image.png');
  };

  img.src = url;
};

export default save;
