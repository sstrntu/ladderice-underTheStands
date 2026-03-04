if ( typeof ProductPage !== 'function' ) {

	class ProductPage extends HTMLElement {

		constructor(){

			super();

			if ( ! this.hasAttribute('data-empty-product' ) ) {

				this.productGallery = this.querySelector('.product-gallery');
				this.productSlider = this.querySelector('css-slider');

				// Gallery thumbnails

				if ( this.querySelector('.product-gallery__thumbnails .thumbnail') ) {

					this.querySelectorAll('.product-gallery__thumbnails .thumbnail').forEach((elm, i)=>{
						if ( i == 0 )
							elm.classList.add('active');
						elm.addEventListener('click',e=>{
							if ( this.productSlider.sliderEnabled ) {
								this.productSlider.changeSlide(e.currentTarget.dataset.index);
							} else {
								window.scrollTo({
									top: this.productGallery.querySelector(`.product-gallery-item[data-faux-index="${e.currentTarget.hasAttribute('data-faux-index') ? e.currentTarget.dataset.fauxIndex : e.currentTarget.dataset.index }"]`).offsetTop + this.offsetTop,
									behavior: 'smooth'
								});
								this.thumbnailNavigationHelper(e.currentTarget.dataset.fauxIndex);
							}
							this._pauseAllMedia();
							//playMedia(this.productGallery.querySelector(`.product-gallery-item[data-index="${e.currentTarget.dataset.index}"]`));
						});
					})

					if ( this.productSlider ) {
						this.productSlider.addEventListener('change', e=>{
							this.thumbnailNavigationHelper(e.target.index);
						});
					}

				}

				if ( this.productSlider ) {
					this.productSlider.addEventListener('change', e=>{
						if ( this.productGallery.querySelector(`.product-gallery-item[data-index="${e.target.index}"]`).dataset.productMediaType == 'model' && this.xrButton ) {
							this.xrButton.setAttribute('data-shopify-model3d-id', this.productGallery.querySelector(`.product-gallery-item[data-index="${e.target.index}"]`).dataset.mediaId);
						}
						this._pauseAllMedia();
						this.thumbnailNavigationHelper(e.target.index);
					});
				}

				// Product variant event listener for theme specific logic

				const productVariants = this.querySelector('product-variants');
				if ( productVariants ) {
					productVariants.addEventListener('VARIANT_CHANGE', this.onVariantChangeHandler.bind(this));
					this.onVariantChangeHandler({target:productVariants});
				}

				// show cart drawer when element is added to cart

				if ( ! document.body.classList.contains('template-cart') && KROWN.settings.cart_action == 'overlay' ) {

					let addToCartEnter = false;
					if ( this.querySelector('.product--add-to-cart-button') ) {
						this.querySelector('.product--add-to-cart-button').addEventListener('keyup', e=>{
							if ( e.keyCode == window.KEYCODES.RETURN ) {
								addToCartEnter = true;
							}
						})
					}

					if ( this.querySelector('.product--add-to-cart-form') ) {
						this.querySelector('.product--add-to-cart-form').addEventListener('add-to-cart', ()=>{
							document.getElementById('site-cart').show();
							if ( document.getElementById('cart-recommendations') ) {
								document.getElementById('cart-recommendations').generateRecommendations();
							}
							if ( addToCartEnter ) {
								setTimeout(()=>{
									document.querySelector('#site-cart .site-close-handle').focus();
								}, 200);
							}
						});
					}

				}

				// Scroll navigation helper 

				if ( this.productGallery.dataset.style == "scroll" ) {

					this.productGalleryNavigation = this.querySelector('.product-gallery__thumbnails');
					this.productGalleryNavigationItem = this.querySelectorAll('.product-gallery__thumbnails .thumbnail');

					const productGallerySlides = this.productGallery.querySelectorAll('.product-gallery-item');
					const reversedGallerySlides = [...productGallerySlides].reverse();

					const checkIfProductIsFirst = this.parentNode == document.querySelector('#main .mount-product-page:first-child') ? document.querySelector('#main .mount-product-page:first-child .product-gallery__thumbnails') : false;

					this.GALLERY_NAVIGATION_SCROLL = () => { 
						if ( ! this.productGallery.querySelector('css-slider').sliderEnabled && window.innerWidth > 768 ) {

							for ( const slide of reversedGallerySlides ) {
								const slideTop = slide.getBoundingClientRect().top;
								if ( slideTop < window.innerHeight / 2 && slideTop > -window.innerHeight / 2  ) {
									this.productGalleryNavigationItem.forEach(elm=>elm.classList.remove('active'));
									this.productGalleryNavigationItem[slide.dataset.fauxIndex].classList.add('active');
									break;
								} 
							}

							const productGalleryTop = this.productGallery.getBoundingClientRect().top;
							if ( (productGalleryTop - window.innerHeight) * -1 > this.productGallery.offsetHeight ) {
								this.productGalleryNavigation.classList.add('scroll');
								this.productGalleryNavigation.classList.remove('scroll-up');
							} else if ( productGalleryTop > 0 ) {
								this.productGalleryNavigation.classList.add('scroll-up');
								this.productGalleryNavigation.classList.add('scroll');
								if ( checkIfProductIsFirst ) {
									checkIfProductIsFirst.style.height = `calc( var(--window-height) + ${window.scrollY}px )`;
								}
							} else if ( (productGalleryTop - window.innerHeight) * -1 < this.productGallery.offsetHeight ) {
								this.productGalleryNavigation.classList.remove('scroll');
								this.productGalleryNavigation.classList.remove('scroll-up');
							}

						}

					}

					window.addEventListener('scroll', this.GALLERY_NAVIGATION_SCROLL, {passive:true});
					this.GALLERY_NAVIGATION_SCROLL();

				}

				// Check for models

				const models = this.querySelectorAll('product-model');
				if ( models.length > 0 ) {
					window.ProductModel.loadShopifyXR();
					this.xrButton = this.querySelector('.product__view-in-space');
				}

				// Change sticky position for text content

				const productContentBox = this.querySelector('.box__product-content');
				const productGalleryBox = this.querySelector('.box__product-gallery');

				this.CONTENT_STICKY_RESIZE = () => {
					productContentBox.style.top = `calc(100vh - ${productContentBox.offsetHeight+1}px)`;
					productGalleryBox.style.top = `calc(100vh - ${productGalleryBox.offsetHeight+1}px)`;
				}
				window.addEventListener('resize', this.CONTENT_STICKY_RESIZE, {passive:true});
				this.CONTENT_STICKY_RESIZE();

				const contentObserver = new MutationObserver(mutations=>{
					for ( const mutation of mutations ) {
						this.CONTENT_STICKY_RESIZE();
					}
				});
				contentObserver.observe(productContentBox,{ attributes: true, childList: true, subtree: true });

				// Assist for video popups
				
				if ( this.productGallery.querySelector('video-popup') ) {
					
					const productVideoObserver = new MutationObserver(mutations=>{
						for ( const mutation of mutations ) {
							if ( mutation.target.classList.contains('video-opened') ) {
								this.productGallery.classList.add('remove-navigation');
							} else {
								this.productGallery.classList.remove('remove-navigation');
							}
						}
					});
					this.productGallery.querySelectorAll('video-popup').forEach(elm=>{
						productVideoObserver.observe(elm,{ attributes: true, childList: false, subtree: false });
					})

				}

			}

		}

		thumbnailNavigationHelper(index=0){
			this.querySelectorAll('.product-gallery__thumbnails .thumbnail').forEach((elm, i)=>{
				if ( i == index )
					elm.classList.add('active');
				else 
					elm.classList.remove('active');
			});
			setTimeout(()=>{
				this.querySelector('.thumbnails-holder').scrollLeft = this.querySelector('.product-gallery__thumbnails .thumbnail.active').offsetLeft - this.querySelector('.product-gallery__thumbnails .thumbnail.active').offsetWidth;
			}, 50);
		}

		onVariantChangeHandler(e){
			const variant = e.target.currentVariant;
			if ( variant && variant.featured_media != null ) {
				const variantImg = this.productGallery.querySelector('.product-gallery-item[data-media-id="' + variant.featured_media.id + '"]');
				if ( variantImg ) {
					if ( this.productGallery.dataset.style == "slider" || ( this.productGallery.dataset.style == "scroll" && this.productGallery.querySelector('css-slider').sliderEnabled ) ) {
						this.productGallery.querySelector('css-slider').changeSlide(variantImg.dataset.index);
					} else {
						const originalOrder = [...this.productGallery.querySelectorAll('.product-gallery-item')].sort((a,b)=>{
							return a.dataset.index - b.dataset.index;
						});

						if ( Math.abs(this.productGallery.getBoundingClientRect().y) > window.innerHeight / 2 ) {
							window.scrollTo({
								top: this.productGallery.offsetTop,
								behavior: 'smooth'
							});
						}
						originalOrder.forEach(elm=>{
							this.productGallery.querySelector('css-slider').append(elm)
						})
						this.productGallery.querySelector('css-slider').prepend(variantImg);
						this.reorderThumbnailNavigation();
					}
				}
			}
		}

		reorderThumbnailNavigation(index){
			const reversedGallerySlidesForThumbnails = [...this.productGallery.querySelectorAll('.product-gallery-item')].reverse();
			const galleryThumbnailsHolder = this.querySelector('.product-gallery__thumbnails .thumbnails-holder .thumbnails');
			reversedGallerySlidesForThumbnails.forEach(slide=>{
				galleryThumbnailsHolder.prepend(this.querySelector(`.product-gallery__thumbnails .thumbnail[data-faux-index="${slide.dataset.index}"]`));
			})
			this.querySelectorAll('.product-gallery__thumbnails .thumbnails-holder .thumbnail').forEach((elm, i) => {
				elm.setAttribute('data-index', i);
			})
			this.thumbnailNavigationHelper(0);
			setTimeout(()=>{
				this.thumbnailNavigationHelper(0);
			}, 10);
		}

		_pauseAllMedia(){
			document.querySelectorAll('.product .js-youtube').forEach(video => {
				video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
			});
			document.querySelectorAll('.product .js-vimeo').forEach(video => {
				video.contentWindow.postMessage('{"method":"pause"}', '*');
			});
			document.querySelectorAll('.product video').forEach(video => video.pause());
			document.querySelectorAll('.product product-model').forEach(model => {
				if ( model.modelViewerUI ) 
					model.modelViewerUI.pause()
			});
		}

		_playMedia(media){
			switch ( media.dataset.productMediaType ) {
				case 'video':
					media.querySelector('video').play();
					break;
				case 'external_video-youtube':
					media.querySelector('.js-youtube').contentWindow.postMessage('{"event":"command","func":"' + 'playVideo' + '","args":""}', '*');
					break;
				case 'external_video-vimeo':
					media.querySelector('.js-vimeo').contentWindow.postMessage('{"method":"play"}', '*');
					break;
			}
		}

	}

  if ( typeof customElements.get('product-page') == 'undefined' ) {
		customElements.define('product-page', ProductPage);
	}

}