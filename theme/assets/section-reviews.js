

if ( typeof ProductReviews !== 'function' ) {

	class ProductReviews {

		constructor(_this){

			const observer = new MutationObserver((mutations, observer)=>{
				for ( const mutation of mutations ) {
					if ( mutation.addedNodes.length > 0 ) {
						mutation.addedNodes.forEach(elm=>{
							if ( elm.tagName == 'DIV' && elm.classList.contains('spr-container') ) {
								this.init(elm);
								observer.disconnect();
							} 
						});
					}
				}
			})

			_this.classList.add('observe-reviews');

			if ( _this.querySelector('.spr-review') ) {
				this.init(_this.querySelector('.spr-container'))
			} else {
				observer.observe(_this, {childList: true})
			}
		}

		init(elm){
      
			elm.closest('#shopify-product-reviews').classList.remove('observe-reviews');
			elm.closest('#shopify-product-reviews').classList.add('show-reviews');

			// redo reviews title

			const ratingTextEl = document.querySelector('[data-js-review-value]');

			if ( document.querySelector('#shopify-product-reviews .spr-summary-starrating') ) {
				document.querySelector('#shopify-product-reviews .spr-summary-starrating').prepend(this.createRatingEl(document.querySelector('.spr-summary-starrating'), 'spr-custom-rating', (ratingTextEl ? ratingTextEl.textContent : '')));
			}

			// recreate section structure

			elm.classList = "site-box-container container--fullscreen box--can-stick";

			const reviewsHeader = elm.querySelector('.spr-header');
			if ( reviewsHeader ) {
				reviewsHeader.classList = "site-box box--big lap--box--small-fl palm--box--small-fl box--typo-big box--center-align box--column-flow box__heading";
				reviewsHeader.setAttribute('data-order', '0');
				reviewsHeader.style.borderBottom = "none";
				reviewsHeader.innerHTML = `<div class="site-box-content" 
					style="display:flex;flex-direction:column"
				>${ reviewsHeader.innerHTML }</div>`;
				reviewsHeader.querySelector('.spr-header-title').classList = "h1 title";
				reviewsHeader.querySelector('.spr-summary-actions-newreview').classList.add("button");
				reviewsHeader.querySelector('.spr-summary-actions-newreview').classList.add("button--solid");
			}

			const reviewsContent = elm.querySelector('.spr-content');
			if ( reviewsContent ) {
				reviewsContent.classList = "site-box box--big lap--box--bigger box__text box--typo-big box--center-align box--column-flow";
				reviewsContent.setAttribute('data-order', '1');
				if ( reviewsContent.querySelector('.spr-reviews').children.length <= 0 ) {
					reviewsContent.querySelector('.spr-reviews').innerHTML = `<p class="text-size--larger">${KROWN.settings.locales.product_no_reviews}</p>`;
					reviewsContent.querySelector('.spr-reviews').style.display = "block";
					reviewsHeader.querySelector('.spr-summary-caption').remove();
				}
				reviewsContent.querySelector('.spr-reviews').classList = "site-box-content";
			}

			// turn form into popup

			const reviewForm = document.createElement('div');
			reviewForm.id = 'spr-form-modal';
			reviewForm.innerHTML = `<div id="spr-form" class="spr-form-holder page-popup">
				<div class="basicLightboxClose" tabindex="1">×</div>
			</div>`;
			
			document.querySelector('.spr-summary-actions-newreview').setAttribute('onclick', '');
			const reviewModalForm = basicLightbox.create(reviewForm, {
				trigger: document.querySelector('.spr-summary-actions-newreview'),
				focus: 'input[type="text"]'
			});

			reviewModalForm.element().querySelector('.spr-form-holder').prepend(elm.querySelector('.spr-form'));
			reviewModalForm.element().querySelector('.spr-form').style.display = 'block';
			reviewModalForm.element().querySelector('.spr-button').classList = "button button--solid";

			// recreate reviews & pagination

			this.redoReviews(elm);
		// this.redoPagination(elm);

		} 

		redoReviews(elm) {

			elm.querySelectorAll('.spr-review').forEach(review=>{
				review.querySelector('.spr-review-header').insertBefore(this.createRatingEl(review, 'spr-review-custom-rating'), review.querySelector('.spr-review-header').firstElementChild.nextSibling);
			});

			const reviewsPagination = elm.querySelector('.spr-pagination');
			if ( reviewsPagination ) {
				reviewsPagination.querySelector('div').classList = "pagination pagination--small";
				if ( reviewsPagination.querySelector('.spr-pagination-prev') ) {
					reviewsPagination.querySelector('.spr-pagination-prev a').innerHTML = `<svg width="8" height="13" viewBox="0 0 8 13" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M1.46442 7.94185L0.0502109 6.52764L6.53549 0.0423586L7.94971 1.45657L1.46442 7.94185Z" fill="#262627"/>
								<path d="M0.0503636 6.49961L1.46458 5.0854L7.94986 11.5707L6.53564 12.9849L0.0503636 6.49961Z" fill="#262627"/>
							</svg>`;
				}

				if ( reviewsPagination.querySelector('.spr-pagination-next') ) {
					reviewsPagination.querySelector('.spr-pagination-next a').innerHTML = `<svg width="8" height="13" viewBox="0 0 8 13" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M6.53557 5.08537L7.94979 6.49958L1.46451 12.9849L0.0502931 11.5706L6.53557 5.08537Z" fill="#262627"/>
							<path d="M7.94964 6.52761L6.53542 7.94182L0.050142 1.45654L1.46436 0.0423289L7.94964 6.52761Z" fill="#262627"/>
						</svg>`;
				}
			}

			if ( this.reviewsObserver ) {
				this.reviewsObserver.disconnect();
			}

			this.reviewsObserver = new MutationObserver((mutations, observer)=>{
				for ( const mutation of mutations ) {
					this.redoReviews(elm);
				}
			})
			this.reviewsObserver.observe(elm, {childList: true, subtree: true})

		}

		createRatingEl(elm, className, textContent=""){
			const ra = elm.querySelectorAll('.spr-icon-star').length,
						rb = elm.querySelectorAll('.spr-icon-star-half-alt').length > 0 ? '.5' : '',
						ratingEl = document.createElement('span');
			ratingEl.classList = `${className} text-size--regular`;
			ratingEl.innerHTML = `<span>${ textContent != "" ? textContent : `${(ra + rb)} / 5` }</span>${KROWN.settings.symbols.star}`;
			return ratingEl;
		}

	}

	new ProductReviews(document.getElementById('shopify-product-reviews'));

}