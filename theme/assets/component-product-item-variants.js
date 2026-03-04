if ( typeof ProductItemVariants !== 'function' ) {

  class ProductItemVariants extends HTMLElement {
    constructor(){

      super();

      this.productItem = this.closest('[data-js-product-item]');
      this.productVariantImages = this.querySelector('[data-js-product-variant-images]');
      this.zIndex = 9;

      setTimeout(()=>{
        this.productItem.classList.add('product-item--has-variants');
        this.querySelectorAll('[data-js-product-variant]').forEach(elm=>{

          elm.addEventListener('click', e=>{
            e.preventDefault();
            e.stopPropagation();
            
            const variantImg = this.productVariantImages.querySelector(`template[data-media-id="${e.currentTarget.dataset.variantImage}"]`);
            if ( variantImg ) {
              if ( ! variantImg.dataset.init ) {
                this.initVariantImage(variantImg);
                this.showVariantImage(e.currentTarget.dataset.variantImage);
              } else {
                this.showVariantImage(e.currentTarget.dataset.variantImage);
              }
            }

          })

        })
      }, 500);

      setTimeout(()=>{
        const imageObserver = new IntersectionObserver((entries, observer) => {
          if ( ! entries[0].isIntersecting ) {
            return;
          } else {
            this.productVariantImages.querySelectorAll(`template`).forEach(elm=>{
              if ( ! elm.dataset.init ) {
                this.initVariantImage(elm);
              }
            });
            observer.unobserve(this);
          }
        });
        imageObserver.observe(this);
      }, 5000)

    }

    initVariantImage(template) {
      template.dataset.init = true;
      const image = template.content.querySelector('div').cloneNode(true);
      image.dataset.mediaId = template.dataset.mediaId;
      this.productItem.prepend(image);
    }

		showVariantImage(id) {
			this.productItem.querySelector(`[data-media-id="${id}"]`).style.zIndex = ++this.zIndex;
      setTimeout(()=>{
        this.productItem.querySelector(`[data-media-id="${id}"] img`).srcset = this.productItem.querySelector(`[data-media-id="${id}"] img`).srcset;
      }, 10);
      if ( typeof(document.body.animate) === 'function' ) {
        this.productItem.querySelector(`[data-media-id="${id}"]`).animate([
          { opacity: 0 },
          { opacity: 1 }
        ], {
          duration: 200,
          iterations: 1,
          fill: 'forwards'
        })
      } else {
        this.productItem.querySelector(`[data-media-id="${id}"]`).style.opacity = 1;
      }
		}

  }

  if ( typeof customElements.get('product-item-variants') == 'undefined' ) {
    customElements.define('product-item-variants', ProductItemVariants);
  }

}