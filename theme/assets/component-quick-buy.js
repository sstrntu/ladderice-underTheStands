class QuickAddToCart extends HTMLElement {
	constructor(){
		super();
		if ( this.querySelector('product-form') ) {
			this.init();
		}
	}
	init(){
		this.querySelector('product-form').addEventListener('add-to-cart', ()=>{
			if ( ! document.body.classList.contains('template-cart') ) {
	 			document.getElementById('site-cart').show();
	 			if ( document.getElementById('cart-recommendations') ) {
	        document.getElementById('cart-recommendations').generateRecommendations();
	      }
			} else {
				document.querySelector('#section-cart .box__text').scrollIntoView();
  			document.querySelector('#section-cart .box__heading .subtitle').innerHTML = document.querySelector('#AjaxCartForm .subtitle').innerHTML;
			}
 		});
	}
}

customElements.define('quick-add-to-cart', QuickAddToCart);

class QuickViewProduct extends HTMLElement {
	constructor(){
		super();
		if ( this.querySelector('button') ) {
			this.init();
		}
	}
	init(){

		this.quickViewModal = null;
		this.querySelector('button').addEventListener('click', (e)=>{

			e.preventDefault();

			if ( ! this.quickViewModal ) {

				const target = e.currentTarget;

				target.classList.add('working');

				fetch(`${target.getAttribute('data-href')}${ target.getAttribute('data-href').includes('?') ? '&' : '?' }view=quick-view`)
					.then(response => response.text())
					.then(text => {

						// create modal w content

	        	const quickViewHTML = new DOMParser().parseFromString(text, 'text/html').querySelector('.product-quick-view');
	        	this.quickViewModal = basicLightbox.create(quickViewHTML);
	        	this.quickViewModal.show();
	        	target.classList.remove('working');

						// setup images for variant selector

						const quickProduct = this.quickViewModal.element();
						const quickProductImage = quickProduct.querySelector('.product-images img');

						const quickViewImages = JSON.parse(quickProduct.querySelector('.product-images').querySelector('[type="application/json"]').textContent);

						const productVariants = quickProduct.querySelector('product-variants');
						if ( productVariants ) {
							productVariants.addEventListener('VARIANT_CHANGE', (e)=>{
								const variant = e.target.currentVariant;
								if ( variant && variant.featured_media != null && quickViewImages[variant.id] != null ) {
									quickProductImage.setAttribute('srcset', quickViewImages[variant.id]);
								}
							})
						}

						// setup add to cart functionality

					 	if ( ! document.body.classList.contains('template-cart') && KROWN.settings.cart_action == 'overlay' ) {

				 			let addToCartEnter = false;
							if ( quickProduct.querySelector('.product--add-to-cart-button') ) {
						 		quickProduct.querySelector('.product--add-to-cart-button').addEventListener('keyup', e=>{
									if ( e.keyCode == window.KEYCODES.RETURN ) {
										addToCartEnter = true;
									}
						 		})
						 	}

						 	if ( quickProduct.querySelector('.product--add-to-cart-form') ) {
						 		quickProduct.querySelector('.product--add-to-cart-form').addEventListener('add-to-cart', ()=>{
						 			document.getElementById('site-cart').show();
									 this.quickViewModal.close();
						 			if ( document.getElementById('cart-recommendations') ) {
						        document.getElementById('cart-recommendations').generateRecommendations();
					        }
						 			if ( addToCartEnter ) {
										setTimeout(()=>{
											document.querySelector('#site-cart .sidebar__cart-close').focus();
										}, 200);
						 			}
						 		});
						 	}

					 	}

	        });

			} else {
      	this.quickViewModal.show();
			}

		})
	}
}

customElements.define('quick-view-product', QuickViewProduct);