window.lightMapStyle=[{featureType:"water",elementType:"geometry",stylers:[{color:"#e9e9e9"},{lightness:17}]},{featureType:"landscape",elementType:"geometry",stylers:[{color:"#f5f5f5"},{lightness:20}]},{featureType:"road.highway",elementType:"geometry.fill",stylers:[{color:"#ffffff"},{lightness:17}]},{featureType:"road.highway",elementType:"geometry.stroke",stylers:[{color:"#ffffff"},{lightness:29},{weight:.2}]},{featureType:"road.arterial",elementType:"geometry",stylers:[{color:"#ffffff"},{lightness:18}]},
{featureType:"road.local",elementType:"geometry",stylers:[{color:"#ffffff"},{lightness:16}]},{featureType:"poi",elementType:"geometry",stylers:[{color:"#f5f5f5"},{lightness:21}]},{featureType:"poi.park",elementType:"geometry",stylers:[{color:"#dedede"},{lightness:21}]},{elementType:"labels.text.stroke",stylers:[{visibility:"on"},{color:"#ffffff"},{lightness:16}]},{elementType:"labels.text.fill",stylers:[{saturation:36},{color:"#333333"},{lightness:40}]},{elementType:"labels.icon",stylers:[{visibility:"off"}]},
{featureType:"transit",elementType:"geometry",stylers:[{color:"#f2f2f2"},{lightness:19}]},{featureType:"administrative",elementType:"geometry.fill",stylers:[{color:"#fefefe"},{lightness:20}]},{featureType:"administrative",elementType:"geometry.stroke",stylers:[{color:"#fefefe"},{lightness:17},{weight:1.2}]}];

window.darkMapStyle=[{featureType:"all",elementType:"labels.text.fill",stylers:[{saturation:36},{color:"#000000"},{lightness:40}]},{featureType:"all",elementType:"labels.text.stroke",stylers:[{visibility:"on"},{color:"#000000"},{lightness:16}]},{featureType:"all",elementType:"labels.icon",stylers:[{visibility:"off"}]},{featureType:"administrative",elementType:"geometry.fill",stylers:[{color:"#000000"},{lightness:20}]},{featureType:"administrative",elementType:"geometry.stroke",stylers:[{color:"#000000"},
{lightness:17},{weight:1.2}]},{featureType:"landscape",elementType:"geometry",stylers:[{color:"#000000"},{lightness:20}]},{featureType:"poi",elementType:"geometry",stylers:[{color:"#000000"},{lightness:21}]},{featureType:"road.highway",elementType:"geometry.fill",stylers:[{color:"#000000"},{lightness:17}]},{featureType:"road.highway",elementType:"geometry.stroke",stylers:[{color:"#000000"},{lightness:29},{weight:.2}]},{featureType:"road.arterial",elementType:"geometry",stylers:[{color:"#000000"},
{lightness:18}]},{featureType:"road.local",elementType:"geometry",stylers:[{color:"#000000"},{lightness:16}]},{featureType:"transit",elementType:"geometry",stylers:[{color:"#000000"},{lightness:19}]},{featureType:"water",elementType:"geometry",stylers:[{color:"#000000"},{lightness:17}]}];

if ( typeof ContactMap !== 'function' ) {

	class ContactMap extends HTMLElement {

		constructor(){
			super();
			this.mount();
		}

		mount(){
			
			if ( this.dataset.address != "" ) {
				if ( typeof google !== 'undefined' && google.maps ) {
					this._createMap();
				} else {
					if ( window.loadingGoogleMapsScript ) {
						this.ti = setInterval(()=>{
							if ( typeof google !== 'undefined' ) {
								clearInterval(this.ti);
								this._createMap();
							}
						}, 100);
					} else {
						window.loadingGoogleMapsScript = true;
						var googleScript = document.createElement('script');
						googleScript.onload = (()=>{
							this._createMap();
						});
						googleScript.async = true
						googleScript.src = `https://maps.googleapis.com/maps/api/js?v=3&key=${this.dataset.key}`;
						document.head.appendChild(googleScript);
					}

				}

			}
		}

		_createMap(){

			const mapEl = this.querySelector('.contact-map-object'),
				mapDetails = this.querySelector('.contact-map-address-holder');

			const coordsKey = `map-coords-${mapEl.id}`;

			let coordsStorage = localStorage.getItem(coordsKey) != null ? JSON.parse(localStorage.getItem(coordsKey)) : null,
				mapLat = 0,
				mapLong = 0;

			if ( coordsStorage != null && coordsStorage['address'] == mapEl.dataset.address ) {
				mapLat = coordsStorage['lat'];
				mapLong = coordsStorage['long'];
			}

			let geocoder, map, address;

			geocoder = new google.maps.Geocoder();
			address = mapEl.dataset.address;

			const mapOptions = {
				zoom: parseInt(mapEl.dataset.zoom),
				center: new google.maps.LatLng(mapLat, mapLong),
				streetViewControl: false,
				scrollwheel: false,
				panControl: true,
				mapTypeControl: false,
				overviewMapControl: false,
				zoomControl: true,
				draggable: true,
				styles: mapEl.dataset.style == 'light' ? window.lightMapStyle : window.darkMapStyle
			};			

			map = new google.maps.Map(document.getElementById(mapEl.id), mapOptions);

			if ( mapLat != 0 || mapLong != 0 ) {

				const markerOptions = {
					position: new google.maps.LatLng(mapLat, mapLong),
					map: map, 
					title: address
				}

				if( mapEl.dataset.marker != 'none' ) {
					markerOptions['icon'] = {
						url: mapEl.dataset.marker,
						scaledSize: new google.maps.Size(60, 60)
					}
				}

				mapDetails.querySelector('a').setAttribute('href', `http://www.google.com/maps/place/${mapLat},${mapLong}`);
				const contentString = mapDetails.innerHTML;
				const infowindow = new google.maps.InfoWindow({
					content: contentString
				});

				const marker = new google.maps.Marker(markerOptions); 
				marker.addListener('click', ()=>{
					infowindow.open(map, marker);
					if ( window.innerWidth < 480 ) {
						document.querySelector('.template-page-contact .box__heading .title').style.marginTop = '50px';
					} else if ( window.innerWidth < 768 ) {
						document.querySelector('.template-page-contact .box__heading .title').style.marginTop = '100px';
					}
				});

				if ( window.innerWidth > 768 ) {
					map.panBy(-150, 150);
				} else {
					map.panBy(-75, 75);
				}

			} else {

				if ( geocoder ) {

					geocoder.geocode( { 'address': address }, (results, status)=>{

						if (status == google.maps.GeocoderStatus.OK) {
							if (status != google.maps.GeocoderStatus.ZERO_RESULTS) {

								map.setCenter(results[0].geometry.location);

								const markerOptions = {
									position: results[0].geometry.location,
									map: map, 
									title: address
								}

								if( mapEl.dataset.marker != 'none' ) {
									markerOptions['icon'] = {
										url: mapEl.dataset.marker,
										scaledSize: new google.maps.Size(60, 60)
									}
								}

								mapDetails.querySelector('a').setAttribute('href', `http://www.google.com/maps/place/${results[0].geometry.location.lat()},${results[0].geometry.location.lng()}`);
								const contentString = mapDetails.innerHTML;

								const infowindow = new google.maps.InfoWindow({
									content: contentString
								});

								const marker = new google.maps.Marker(markerOptions); 
								marker.addListener('click', ()=>{
									infowindow.open(map, marker);
								});

								if ( window.innerWidth > 768 ) {
									map.panBy(-150, 150);
								} else {
									map.panBy(-75, 75);
								}
								
								localStorage.setItem(coordsKey, JSON.stringify({
									'address': mapEl.dataset.address,
									'lat': results[0].geometry.location.lat(),
									'long': results[0].geometry.location.lng()
								}));

							} else {
								alert("No results found for the given address");
							}
						} else {
							console.log("Geocode was not successful for the following reason: " + status);
						}

					});

				}

			}

		}

	}

  if ( typeof customElements.get('contact-map') == 'undefined' ) {
		customElements.define('contact-map', ContactMap);
	}

}