KROWN.themeName = 'Split';
KROWN.themeVersion = '4.3.1';

const executeOnceOnDomContentLoaded = ()=>{

  // tab navigation

  let activeElement = document.activeElement;
  document.addEventListener('keyup', e=>{
    if ( e.keyCode == window.KEYCODES.TAB ) {
      if ( activeElement.classList.contains('focus') && e.target != activeElement ) {
        activeElement.classList.remove('focus');
      }
      if ( e.target.classList.contains('product-variant__input') ||
      	e.target.classList.contains('button') ||
      	e.target.classList.contains('product-item') ||
      	e.target.classList.contains('spr-summary-actions-newreview') ||
      	e.target.classList.contains('site-box-content-to-focus')
      ) {
        e.target.classList.add('focus');
      } 
      activeElement = document.activeElement;
    }
  });

  // newsletter has jump

  if ( window.location.pathname.includes('/challenge') ) {
    setTimeout(()=>{
      window.scroll({
        top: 0, 
        behavior: 'auto'
      });
    }, 300);
  }

  // fix image link borders

  document.querySelectorAll('.rte a img').forEach(elm=>{
    elm.parentNode.style.border = 'none';
  });

  // Filter handle
  
  if ( document.getElementById('site-filter-handle') ) {
    document.getElementById('site-filter-handle').addEventListener('click', e=>{
      e.preventDefault();
      document.getElementById('site-filters').show();
      document.getElementById('site-filter-handle').setAttribute('aria-expanded', 'true');
    });
  }

  // fix quick add to cart

  setTimeout(()=>{
    if ( document.querySelector('modal-box quick-view-product') ) {
      document.querySelector('modal-box quick-view-product').init();
    }
    if ( document.querySelector('modal-box quick-add-to-cart') ) {
      document.querySelector('modal-box quick-add-to-cart').init();
      document.querySelector('modal-box product-form').init();
    }
  }, 3050);

  // show newsletter popup confimation

  if ( document.location.search == '?customer_posted=true' && document.location.hash == '#newsletter-popup' && document.getElementById('modal-newsletter') ) {
    const newsletterPopup = document.getElementById('modal-newsletter');
    newsletterPopup.show();
    localStorage.setItem(newsletterPopup._modalKey, JSON.stringify({
      'shown': (new Date().getTime()),
      'content': newsletterPopup._modalText
    }));	
    setTimeout(()=>{
      newsletterPopup.querySelectorAll('[data-js-close]').forEach(elm=>elm.addEventListener('click',()=>{newsletterPopup.hide(true)}));
    }, 100);
    clearTimeout(newsletterPopup._modalTimeout);
  }

  // custom cart listener
  
  if ( document.querySelector('cart-form') ) {
    document.querySelector('cart-form').addEventListener('cart-updated', ()=>{
      if ( document.body.classList.contains('template-cart') ) {

        if ( document.querySelector('#AjaxCartForm .subtitle') ) {
          document.querySelector('#section-cart .box__heading .subtitle').innerHTML = document.querySelector('#AjaxCartForm .subtitle').innerHTML;
        }
        if ( document.getElementById('AjaxCartSubtotal').querySelector('[data-cart-empty]') ) {
          document.querySelector('#section-cart .box__heading .subtitle').innerHTML = "";
          if ( ! document.getElementById('AjaxCartSubtotal').querySelector('.main-cart-empty-content') ) {
            document.getElementById('AjaxCartSubtotal').append(document.getElementById('section-cart').querySelector('template').content.cloneNode(true))
          } else {
            document.getElementById('AjaxCartSubtotal').querySelector('.main-cart-empty-content').style.display = 'block';
          }
        } else if ( document.getElementById('AjaxCartSubtotal').querySelector('.main-cart-empty-content') ) {
          document.getElementById('AjaxCartSubtotal').querySelector('.main-cart-empty-content').style.display = 'none';
        }

      }

      if ( document.querySelector('cart-recommendations') && parseInt(document.querySelector('[data-cart-count]').textContent ) == 0 ) {
        document.querySelector('cart-recommendations').innerHTML = '';
      }

    });
  }

  // recommended products listener

  if ( document.querySelector('#main-product-recommendations') ) {
    document.querySelector('#main-product-recommendations').addEventListener('product-recommendations-loaded', ()=>{
      eval(document.querySelector('#main-product-recommendations .js-fix-height').textContent);
    });
  }

}

if ( document.readyState !== 'loading' ) {
  executeOnceOnDomContentLoaded();
} else {
  document.addEventListener('DOMContentLoaded', executeOnceOnDomContentLoaded);
}

if ( typeof SiteFilterHandle !== 'function' ) {

	class SiteFilterHandle extends HTMLElement {
		constructor(){
			super();
			const sidebar = document.getElementById(this.getAttribute('aria-controls'));
			this.addEventListener('click', e=>{
				if ( ! this.classList.contains('disable-sidebar') ) {
					e.preventDefault();
					this.setAttribute('aria-expanded', 'true');
					sidebar.show();
				}
			})
			this.addEventListener('keyup', e=>{
				if ( e.keyCode == window.KEYCODES.RETURN ) {
					this.setAttribute('aria-expanded', 'true');
					sidebar.show();
					sidebar.querySelector('.site-close-handle').focus();
				}
			})
		}
  }

  if ( typeof customElements.get('site-filter-handle') == 'undefined' ) {
    customElements.define('site-filter-handle', SiteFilterHandle);
  }

}