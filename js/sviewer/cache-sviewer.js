import {default as SViewerLite} from './lite';

const SUGAR_CACHE=new Map();
const SUGAR_CACHE_COUNTS=new Map();

let render_lock;


class Lock {
	constructor() {
		this.lock = new Promise((resolve) => {
			this.done = resolve;
		})
	}
	nextTick() {
		return new Promise(resolve => {
			requestAnimationFrame(resolve);
		})
	}
}

class SViewerCache extends SViewerLite {
  async _redraw_sugar() {
  	if (this.sequence == '') {
  		return;
  	}
  	if ( ! this.renderer ) {
  		return;
  	}

  	await this.renderer.ready;

  	if (render_lock && render_lock.active) {
  		setTimeout( () => {
  			this._redraw_sugar();
  		},0);
  		return;
  	}
  	render_lock = new Lock();
  	render_lock.active = true;
  	if (SUGAR_CACHE.has(this.sequence) && SUGAR_CACHE_COUNTS.get(this.sequence) > 1) {
  		render_lock.done();
  		render_lock.active = false;
  		this.shadowRoot.getElementById('output').innerHTML = '<img/>';
  		this.shadowRoot.getElementById('output').firstChild.setAttribute('src',SUGAR_CACHE.get(this.sequence));
  		return;
  	} else {
  		await super._redraw_sugar();
  		await render_lock.nextTick();
  		let dataurl = await this.toDataURL('image/png');
  		SUGAR_CACHE.set(this.sequence,dataurl);
  		SUGAR_CACHE_COUNTS.set(this.sequence, (SUGAR_CACHE_COUNTS.get(this.sequence) || 0)+1);
  		render_lock.done();
  		render_lock.active = false;
  		return;
  	}
  }
}

customElements.define('ccg-sviewer-cache',SViewerCache);

export default SViewerCache;
