if ( typeof VideoModalPopup !== 'function' ) {

	class VideoModalPopup extends HTMLElement {
		constructor(){
			super();
			const modal = window.basicLightbox.create(`<div class="video-popup-holder-container" style="max-height:90vh"><div class="video-popup-holder" data-video-type="${this.dataset.videoType}" style="padding-top: 56.25%">
					${this.querySelector('template').content.firstElementChild.innerHTML}
					<div class="basicLightboxClose">${KROWN.settings.symbols.close}</div>
				</div></div>`, {
				trigger: this,
				onShow: instance=>{
					setTimeout((instance=>{
						switch ( instance.element().querySelector('.video-popup-holder').dataset.videoType ) {
							case "youtube":
								instance.element().querySelector('.js-youtube').contentWindow.postMessage('{"event":"command","func":"' + 'playVideo' + '","args":""}', '*');
								break;
							case "vimeo":
								instance.element().querySelector('.js-vimeo').contentWindow.postMessage('{"method":"play"}', '*');
								break;
						}
					}).bind(this, instance), 500);
				}
			});

		}
	}

  if ( typeof customElements.get('video-modal-popup') == 'undefined' ) {
		customElements.define('video-modal-popup', VideoModalPopup);
	}

}