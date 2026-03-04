if ( typeof MainHeader !== 'function' ) {
		
	class MainHeader extends HTMLElement {

		constructor(){
			super();
			this.mount();
		}

		mount(){

			document.body.append(document.getElementById('site-nav--mobile'));

			/* -- > DRAWERS < -- */

			document.querySelectorAll('[data-js-sidebar-handle]').forEach(elm => {
				if ( elm.hasAttribute('aria-controls') ) {
					const elmSidebar = document.getElementById(elm.getAttribute('aria-controls'));
					elm.addEventListener('click', e=>{
						if ( ! elm.classList.contains('disable-sidebar') ) {
							e.preventDefault();
							elm.setAttribute('aria-expanded', 'true');
							elmSidebar.show();
						}
					})
					elm.addEventListener('keyup', e=>{
						if ( e.keyCode == window.KEYCODES.RETURN ) {
							elm.setAttribute('aria-expanded', 'true');
							elmSidebar.show();
							elmSidebar.querySelector('.site-close-handle').focus();
						}
					})
				}
			});

			// closing drawers

			document.addEventListener('keydown', e=>{
				if ( e.keyCode == window.KEYCODES.ESC ) {
					if ( document.querySelector('sidebar-drawer.active') ) 
						document.querySelector('sidebar-drawer.active').hide();
				}
			});

			document.getElementById('site-overlay').addEventListener('click', ()=>{
				if ( document.querySelector('sidebar-drawer.active') )
					document.querySelector('sidebar-drawer.active').hide();
			});

			// resizing drawers

			this.RESIZE_SidebarHelper = debounce(()=>{
				if ( document.querySelector('sidebar-drawer.active') ) {
					document.querySelector('sidebar-drawer.active').style.height = `${window.innerHeight}px`;
				}
			}, 200);
			window.addEventListener('resize', this.RESIZE_SidebarHelper);
			this.RESIZE_SidebarHelper();

			// search focus

			if ( document.getElementById('site-search-handle') ) {
				document.getElementById('site-search-handle').addEventListener('click', ()=>{
					setTimeout(()=>{
						document.getElementById('search-form-sidebar').focus();
					}, 200);
				});
			}

			// swap long menus with mobile version

			if ( document.querySelector('.site-nav.style--classic > .site-nav-container') ) {
				let classicMenuWidth = 0;
				let iconsMenuWidth = 0;
				document.querySelectorAll('.site-nav.style--classic > .site-nav-container .primary-menu > ul > li').forEach(elm=>{
					classicMenuWidth += elm.offsetWidth;
				});
				document.querySelectorAll('.site-nav .site-menu-handle').forEach(elm=>{
					if ( ! elm.classList.contains('hide') ) {
						iconsMenuWidth += elm.offsetWidth;
					}
				});
				
				if ( classicMenuWidth > document.getElementById('site-header').offsetWidth - 200 - document.querySelector('.logo').offsetWidth - iconsMenuWidth ) {
					document.body.classList.add('switch-menus');
				}
			} 

			// _end of drawers

			/* -- > SUBMENU HELPERS < -- */

			this.siteHeader = document.getElementById('site-header');

			if ( document.querySelector('.site-nav.style--classic') ) {
				const submenuPadding = Math.ceil(( this.siteHeader.offsetHeight - document.querySelector('.site-nav.style--classic').offsetHeight ) / 2);
				const submenuStyle = document.createElement('style');
				submenuStyle.id = 'site-nav-classic';
				submenuStyle.setAttribute('type', 'text/css');
				submenuStyle.innerHTML = `.site-nav.style--classic .submenu { padding-top: ${submenuPadding}px; } .site-nav.style--classic .submenu:after { top: ${submenuPadding}px; height: calc(100% - ${submenuPadding}px) !important; } .site-nav.style--classic .submenu.mega-menu { padding-top: ${submenuPadding+70}px; } .site-nav.style--classic .submenu.mega-menu:after { top: ${submenuPadding}px; }`;
				document.getElementsByTagName('head')[0].appendChild(submenuStyle);
			}

			// tab navigation for classic menu ___ TO WORK ON THIS !!!

			document.querySelectorAll('.site-nav.style--classic .has-submenu > a').forEach(childEl=>{

				const elm = childEl.parentNode;

				elm.addEventListener('keydown', e=>{
					if ( e.keyCode == window.KEYCODES.RETURN ) {
						if ( ! e.target.classList.contains('no-focus-link') ) {
							e.preventDefault();
						}
						if ( ! elm.classList.contains('focus') ) {
							elm.classList.add('focus');
							elm.setAttribute('aria-expanded', 'true');
						} else if ( document.activeElement.parentNode.classList.contains('has-submenu') && elm.classList.contains('focus') ) {
							elm.classList.remove('focus');
							elm.setAttribute('aria-expanded', 'true');
						}
					}
				});	

				if ( elm.querySelector('.submenu-holder > li:last-child a') ) {
					elm.querySelector('.submenu-holder > li:last-child a').addEventListener('focusout', e=>{
						if ( elm.classList.contains('focus') ) {
							elm.classList.remove('focus');
							elm.setAttribute('aria-expanded', 'false');
						}
					});
				}

			});

			document.querySelectorAll('.site-nav.style--classic .has-babymenu:not(.mega-link) > a').forEach(childEl=>{	

				const elm = childEl.parentNode;

				elm.addEventListener('keydown', e=>{
					if ( e.keyCode == window.KEYCODES.RETURN ) {
						e.preventDefault();
						if ( ! elm.classList.contains('focus') ) {
							elm.classList.add('focus');
							elm.setAttribute('aria-expanded', 'true');
						} else {
							elm.classList.remove('focus');
							elm.setAttribute('aria-expanded', 'false');
						}
					}
				});

				if ( elm.querySelector('.babymenu li:last-child a') ) {
					elm.querySelector('.babymenu li:last-child a').addEventListener('focusout', e=>{
						if ( elm.parentNode.classList.contains('focus') ) {
							elm.parentNode.classList.remove('focus');
							elm.parentNode.setAttribute('aria-expanded', 'false');
						}
					});
				}

			})

			// sidebar submenus opening

			document.querySelectorAll('.site-nav.style--sidebar .has-submenu:not(.collections-menu)').forEach(elm=>{
				elm.querySelector(':scope > a').addEventListener('click', e=>{
					const parent = e.currentTarget.parentNode;
					if ( ! parent.classList.contains('active') ) {
						e.preventDefault();
						parent.classList.add('active');
						this._slideDown(parent.querySelector('.submenu'), 200);
						parent.querySelector('.submenu').setAttribute('aria-expanded', 'true');
					} else if ( e.currentTarget.getAttribute('href') == '#' ) {
						e.preventDefault();
						parent.classList.remove('active');
						this._slideUp(parent.querySelector('.submenu'), 200);
						parent.querySelector('.submenu').setAttribute('aria-expanded', 'false');
						elm.classList.remove('hover');
					}
				});
			})

			document.querySelectorAll('.site-nav.style--sidebar .has-babymenu:not(.collections-menu)').forEach(elm=>{
				elm.querySelector(':scope > a').addEventListener('click', e=>{
					const parent = e.currentTarget.parentNode;
					if ( ! parent.classList.contains('active') ) {
						e.preventDefault();
						parent.classList.add('active');
						this._slideDown(parent.querySelector('.babymenu'), 200);
						parent.querySelector('.babymenu').setAttribute('aria-expanded', 'true');
					} else if ( e.currentTarget.getAttribute('href') == '#' ) {
						e.preventDefault();
						parent.classList.remove('active');
						this._slideUp(parent.querySelector('.babymenu'), 200);
						parent.querySelector('.babymenu').setAttribute('aria-expanded', 'false');
						elm.classList.remove('hover');
					}
				})
				
			});

			// _end of submenus

			/* -- > STICKY SIDEBAR < -- */

			this.siteHeaderParent = document.querySelector('.mount-header');

			if ( this.siteHeader.dataset.sticky === 'sticky--scroll' ) {

				window.lst = window.scrollY;
				window.lhp = 0;

				this.SCROLL_StickyHelper = () =>{

					var st = window.scrollY;

					if ( st < 0 || Math.abs(lst - st) <= 5 )
						return;	

					if ( st > window.lhp ) {

						if ( st == 0 && this.siteHeaderParent.classList.contains('is-sticky') ) {
							this.siteHeaderParent.classList.remove('is-sticky');
						} else if ( st <= lst && ! this.siteHeaderParent.classList.contains('is-sticky') ) {
							window.lhp = this.siteHeader.offsetTop;
							if ( Math.abs(this.siteHeaderParent.getBoundingClientRect().top) > this.siteHeaderParent.offsetHeight ) {
								this.siteHeaderParent.classList.add('is-sticky');
								this.siteHeaderParent.classList.add('is-animating');
							}
						} else if ( st > lst && this.siteHeaderParent.classList.contains('is-sticky') ) {
							this.siteHeaderParent.classList.remove('is-sticky');
							this.siteHeaderParent.classList.remove('is-animating');
						}

					} 

					window.lst = st;

				}

				window.addEventListener('scroll', this.SCROLL_StickyHelper, {passive:true});

			} else if ( this.siteHeader.dataset.sticky === 'sticky' ) {
				this.siteHeaderParent.classList.add('is-sticky');
			}

			// _end of stickyness

		}

		_slideUp(target, duration) {
			target.style.transitionProperty = 'height, margin, padding';
			target.style.transitionDuration = duration + 'ms';
			target.style.boxSizing = 'border-box';
			target.style.height = target.offsetHeight + 'px';
			target.offsetHeight;
			target.style.overflow = 'hidden';
			target.style.height = 0;
			target.style.paddingTop = 0;
			target.style.paddingBottom = 0;
			target.style.marginTop = 0;
			target.style.marginBottom = 0;
			setTimeout(()=>{
				target.style.display = 'none';
				target.style.removeProperty('height');
				target.style.removeProperty('padding-top');
				target.style.removeProperty('padding-bottom');
				target.style.removeProperty('margin-top');
				target.style.removeProperty('margin-bottom');
				target.style.removeProperty('overflow');
				target.style.removeProperty('transition-duration');
				target.style.removeProperty('transition-property');
			}, duration);
		}
		_slideDown(target, duration) {
			target.style.removeProperty('display');
			let display = window.getComputedStyle(target).display;
		
			if (display === 'none')
				display = 'block';
		
			target.style.display = display;
			const height = target.offsetHeight;
			target.style.overflow = 'hidden';
			target.style.height = 0;
			target.style.paddingTop = 0;
			target.style.paddingBottom = 0;
			target.style.marginTop = 0;
			target.style.marginBottom = 0;
			target.offsetHeight;
			target.style.boxSizing = 'border-box';
			target.style.transitionProperty = "height, margin, padding";
			target.style.transitionDuration = duration + 'ms';
			target.style.height = height + 'px';
			target.style.removeProperty('padding-top');
			target.style.removeProperty('padding-bottom');
			target.style.removeProperty('margin-top');
			target.style.removeProperty('margin-bottom');
			setTimeout(()=>{
				target.style.removeProperty('height');
				target.style.removeProperty('overflow');
				target.style.removeProperty('transition-duration');
				target.style.removeProperty('transition-property');
			}, duration);
		}

		unmount(){
			window.removeEventListener('resize', this.RESIZE_SidebarHelper);
			window.removeEventListener('scroll', this.SCROLL_StickyHelper);
		}

	}

  if ( typeof customElements.get('main-header') == 'undefined' ) {
		customElements.define('main-header', MainHeader);
	}

}

if ( typeof SidebarDrawer !== 'function' ) {

	class SidebarDrawer extends HTMLElement {

		constructor(){
			super();
			this.siteOverlay = document.getElementById('site-overlay');
			this.querySelector('.site-close-handle').addEventListener('click', ()=>{
				this.hide();
			});
		}

		show(){
			this.style.display = 'block';
			setTimeout(()=>{
				this.classList.add('active');
				window.inertElems.forEach(elm=>{
					elm.setAttribute('inert', '');
				});
			}, 10);
			this.siteOverlay.classList.add('active');
			document.body.classList.add('sidebar-move');
			document.querySelector('html').classList.add('kill-overflow');
			this.style.height = `${window.innerHeight}px`;
			if ( this.id == "site-cart" ) {
				if ( document.querySelector('#cart-recommendations css-slider') ) {
					document.querySelector('#cart-recommendations css-slider').resetSlider();
				}
			}
		}

		hide(){
			this.classList.remove('active');
			this.siteOverlay.classList.remove('active');
			document.body.classList.remove('sidebar-move');
			document.querySelector('html').classList.remove('kill-overflow');
			document.querySelector('body').classList.remove('drawer-menu-opened');
			window.inertElems.forEach(elm=>{
				elm.removeAttribute('inert');
			})
			setTimeout(()=>{
				this.style.display = 'none';
			}, 250);
		}

	}


  if ( typeof customElements.get('sidebar-drawer') == 'undefined' ) {
		customElements.define('sidebar-drawer', SidebarDrawer);
	}

}