/* globals document,MouseEvent,window,Blob,XMLSerializer,Image,HTMLCanvasElement,MediaRecorder,URL */

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

// glycan.js's SVGRenderer.js (use_css_variables()) writes every icon
// shape's fill/stroke/stroke-width as e.g.
// style="fill: var(--fill-color,#ffd400)" so a live page can theme icons
// via CSS - harmless in a browser, but Adobe Illustrator's SVG importer
// doesn't reliably resolve CSS custom properties, and can leave shapes
// unfilled/unstroked in an otherwise-identical file. There's no live page
// for var() to matter to in a static export, so resolve each one down to
// its actual computed value (matching whatever's really on screen right
// now, theme overrides included - not just hard-coded fallbacks) and write
// that as a plain attribute instead, before the style attribute carrying
// the var() reference is dropped.
//
// Relies on `original` and `clone` being structurally identical at this
// point (clone is a fresh, unmutated cloneNode(true) of original) so
// querySelectorAll('*') on each returns matching elements at the same
// index - must run before any further clone-only DOM mutations (defs
// merging, href rewriting, etc. further down in prepare()).
const VAR_PROPERTY = /([a-z-]+)\s*:\s*var\(/gi;

const flattenCSSVariables = (original,clone) => {
  const originals = original.querySelectorAll('*');
  const clones = clone.querySelectorAll('*');
  originals.forEach((el,i) => {
    const style = el.getAttribute('style');
    if (!style || !style.includes('var(')) {
      return;
    }
    const computed = window.getComputedStyle(el);
    const target = clones[i];
    for (const match of style.matchAll(VAR_PROPERTY)) {
      const prop = match[1];
      const value = computed.getPropertyValue(prop);
      if (value) {
        target.setAttribute(prop,value);
      }
    }
    target.removeAttribute('style');
  });
};

let save = async (widget,svg,format='png',filename='image',opts) => {
  let data = await prepare(widget,svg,format,opts);
  if (format === 'video') {
    download(data.url,`${filename}.${data.ext}`);
    return;
  }
  download(data,`${filename}.${format}`);
}

// mp4/h264 opens natively in far more places than webm (QuickTime, Windows
// Photos, iOS/Android galleries, most video editors) -- prefer it, and fall
// back to webm only on browsers whose MediaRecorder can't emit mp4 (Firefox
// as of this writing; Safari in fact only speaks mp4, never webm).
const VIDEO_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

let pickVideoMimeType = () => VIDEO_MIME_CANDIDATES.find(
  type => window.MediaRecorder && MediaRecorder.isTypeSupported(type)
);

// Video codecs carry no alpha channel -- the source canvas's transparent
// pixels (alpha 0) get flattened to black on encode. Compositing onto an
// opaque backing canvas every frame, and capturing *that* instead, bakes in
// a solid background so playback doesn't go black wherever the drawing was
// transparent.
let compositeOpaque = (source,background) => {
  let out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  let ctx = out.getContext('2d');
  let raf;
  let draw = () => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0);
    raf = requestAnimationFrame(draw);
  };
  draw();
  return {canvas: out, stop: () => cancelAnimationFrame(raf)};
};

let recordVideo = (canvas,durationMs=4000,fps=30,background='#fff') => {
  let mimeType = pickVideoMimeType();
  if (!mimeType) return Promise.reject(new Error('Video recording is not supported in this browser'));

  let composited = compositeOpaque(canvas,background);
  let stream = composited.canvas.captureStream(fps);
  let recorder = new MediaRecorder(stream, {mimeType});
  let chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

  return new Promise((resolve,reject) => {
    recorder.onerror = e => reject(e.error || e);
    recorder.onstop = () => {
      composited.stop();
      stream.getTracks().forEach(track => track.stop());
      let blob = new Blob(chunks, {type: mimeType});
      resolve({url: URL.createObjectURL(blob), ext: mimeType.includes('mp4') ? 'mp4' : 'webm'});
    };
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
  });
};

let prepare = (widget,svg,format='png',opts={}) => {
  if (format === 'video') {
    if (!(svg instanceof HTMLCanvasElement)) {
      return Promise.reject(new Error('Video export needs a canvas-backed renderer'));
    }
    return recordVideo(svg, opts.durationMs, opts.fps, opts.background);
  }
  if (format === 'png' && (svg instanceof HTMLCanvasElement)) {
    let uri = svg.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    return Promise.resolve(uri);
  }
  let canvas = document.createElement('canvas');
  canvas.width=widget.getBoundingClientRect().width;
  canvas.height=widget.getBoundingClientRect().height;
  let ctx = canvas.getContext('2d');
  let new_svg = svg.cloneNode(true);
  if (format === 'svg') {
    flattenCSSVariables(svg,new_svg);
  }
  if (widget.shadowRoot.getElementById('icons')) {
    let defs = widget.shadowRoot.getElementById('icons').querySelector('defs');
    let cloned_defs = defs.cloneNode(true);
    if (format === 'svg') {
      // The actual var()-styled shapes (use_css_variables() in
      // SVGRenderer.js) live inside these <symbol> defs, not in `svg`
      // itself (which only holds <use>/<line>/<text> referencing them by
      // id) - the flattenCSSVariables(svg,new_svg) call above never sees
      // them, since this defs tree isn't part of `svg` at all; it's a
      // separate, shared store merged in here.
      flattenCSSVariables(defs,cloned_defs);
    }
    new_svg.appendChild(cloned_defs);
    for (let extra_svg of [...new_svg.querySelectorAll('defs > svg')]) {
      extra_svg.parentNode.removeChild(extra_svg);
    }
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
