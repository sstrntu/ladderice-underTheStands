if ( typeof PickupAvailability !== 'function' ) {
	class PickupAvailability extends HTMLElement {

		constructor(){
			super();
			this.errorHtml = this.querySelector('template').content.firstElementChild.cloneNode(true);
			this.onClickRefreshList = this.onClickRefreshList.bind(this);
			if(!this.hasAttribute('available')) return;
			this.fetchAvailability(this.dataset.variantId);
		}

		fetchAvailability(variantId) {
			const variantSectionUrl = `${this.dataset.baseUrl.endsWith('/')?this.dataset.baseUrl:`${this.dataset.baseUrl}/`}variants/${variantId}/?section_id=helper-pickup-availability`;
			fetch(variantSectionUrl)
				.then(response => response.text())
				.then(text => {
					const sectionInnerHTML = new DOMParser()
						.parseFromString(text, 'text/html')
						.querySelector('.shopify-section');
					this.renderPreview(sectionInnerHTML);
				})
				.catch(e => {
					console.log(e);
					if ( this.querySelector('button') ) {
						this.querySelector('button').removeEventListener('click', this.onClickRefreshList);
					}
					this.renderError();
				});

		}

		onClickRefreshList() {
			this.fetchAvailability(this.dataset.variantId);
		}

		renderError() {
			this.innerHTML = '';
			this.appendChild(this.errorHtml);
			this.querySelector('button').addEventListener('click', this.onClickRefreshList);
		}

		renderPreview(sectionInnerHTML){
			
			const drawer = document.getElementById('PickupAvailabilityDrawer');
			if (drawer) drawer.remove();

			if (!sectionInnerHTML.querySelector('pickup-availability-preview')) {
				this.innerHTML = "";
				this.removeAttribute('available');
				return;
			}

			this.innerHTML = sectionInnerHTML.querySelector('pickup-availability-preview').outerHTML;
			this.setAttribute('available', '');
			document.body.appendChild(sectionInnerHTML.querySelector('#PickupAvailabilityDrawer'));

			this.querySelector('button').addEventListener('click', (evt) => {
				document.getElementById('PickupAvailabilityDrawer').show(evt.target);
			});
			this.querySelector('button').addEventListener('keyup', e=>{
				if ( e.keyCode == window.KEYCODES.RETURN ) {
					document.getElementById('PickupAvailabilityDrawer').querySelector('[data-js-close]').focus();
				}
			})

		}

	}

  if ( typeof customElements.get('pickup-availability') == 'undefined' ) {
		customElements.define('pickup-availability', PickupAvailability);
	}

}