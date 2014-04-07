// jshint indent: 4, browser: true, jquery: true, quotmark: single, camelcase: false, eqnull:true
// vim: sw=4 expandtab
/* global  define,L, require */

/**
 * Patterns mapcontroller - leaflet map controller
 *
 * Map starter for leaflet data
 * @author: Ron Jonk - @onswater
 * @link: http://www.onswater.nl
 * @version: 1.0
 * example html
 * <div id="map1" class="pat-map-leaflet"
        data-pat-leaflet="url: 'http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png' ;
                          attribution: Kaartgegevens: © <a href='http://www.cbs.nl'>CBS</a>, <a href='http://www.kadaster.nl'>Kadaster</a>, <a href='http://openstreetmap.org'>OpenStreetMap</a>. ;
                          max-zoom: 9;
                          start-zoom: 3;
                          min-zoom: 1;
                          api-key: Fmjtd%7Cluub20uy2q%2Caw%3Do5-9urlq0;
                          alt-text: Waterhoogte aanduiding in nederland;">

        <div class="maplocation" data-location="52.080956570675866, 4.306919574737549">
             <h3>Zuid-Beveland</h3>
            <p>
                Overstromingskans: groter dan 1 op 100 per jaar
            </p>
            <p>
                Verwacht aantal slachtoffers: 10 per jaar
            </p>
            <p>
                Verwachte schade: €38.000.000,- per jaar
            </p>
        </div>
    </div>
 *
 * the name of js must start with'leaflet' the image for the marker must be inside the image folder of the stylesheet
 */
;

// require.config({
//     paths: {
//         jquery: 'jquery',
//         parser: 'patterns_dir/core/parser',
//         registry: 'patterns_dir/core/registry',
//         ajax: 'patterns_dir/pat/ajax',
//         custom: 'custom'
//     }
// });

// define(['registry', 'ajax', 'custom'], function (registry, ajax, custom) {
//     console.log(registry);
//     console.log(ajax);
//     console.log(custom);
//     console.log(registry.patterns.custom);
// });


(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery', 'leaflet','pat-registry','pat-parser'], function ($, L, patterns, Parser) {
            return factory($, L, patterns, Parser);
        });
    } else {
        factory(root.jQuery, root.L, root.patterns, root.patterns.Parser);
    }
}(this, function($,L,patterns, Parser) {

    var parser = new Parser('leaflet');

    parser.add_argument('url');
    parser.add_argument('attribution');
    parser.add_argument('center');
    parser.add_argument('max-zoom', 9, [1,2,3,4,5,6,7,8,9,10,11,12,13]);
    parser.add_argument('start-zoom', 9, [1,2,3,4,5,6,7,8,9,10,11,12,13]);
    parser.add_argument('min-zoom', 1, [1,2,3,4,5,6,7,8,9,10,11,12,13]);
    parser.add_argument('api-key','');
    parser.add_argument('alt-text', 'landkaart');

    //overwrite imagePathFunction to look for path next to csspath not js path
    L.Icon.Default.imagePath = (function() {
        var scripts = document.getElementsByTagName('link'),
            leafletRe = /[\/^]leaflet[\-\._]?([\w\-\._]*)\.css\??/;

        var i, len, src, matches, path;

        for (i = 0, len = scripts.length; i < len; i++) {
            src = scripts[i].href;
            matches = src.match(leafletRe);

            if (matches) {
                path = src.split(leafletRe)[0];
                return (path ? path + '/' : '') + 'images';
            }
        }
    }());

    var mapLeaflet = {
        name: 'map-leaflet',
        trigger: '.pat-map-leaflet',

        init: function($el, opts) {

            var RD = new L.Proj.CRS.TMS(
                'EPSG:28992',
                '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +no_defs',
                [-285401.92,22598.08,595401.9199999999,903401.9199999999], {
                resolutions: [3440.640, 1720.320, 860.160, 430.080, 215.040, 107.520, 53.760, 26.880, 13.440, 6.720, 3.360, 1.680, 0.840, 0.420]
            });


            $.leafletController = function(el, options) {
                // To avoid scope issues, use 'controller' instead of 'this'
                // to reference this class from internal events and functions.
                var controller = this;

                // Access to jQuery and DOM versions of element
                controller.$el = $(el);
                controller.el = el;

                // Add a reverse reference to the DOM object referencing like $(".map").data("MapController")
                controller.$el.data('MapController', controller);


                /**
                 * initialise the map, create map, markers en eventhandlers
                 * @return none
                 */
                controller.init = function() {
                    controller.options = $.extend({}, $.leafletController.defaultOptions, options);
                    // data passed as  data attribute in the html has priority above passed by javascript
                    controller.tileProviderUrlTemplate =  controller.options.url.replace(/'/g, '');
                    controller.maxZoom = controller.options.maxZoom;
                    controller.startZoom =  controller.options.startZoom;
                    controller.minZoom = controller.options.minZoom;
                    controller.attribution = controller.options.attribution;
                    controller.apiKey = controller.options.apiKey;
                    controller.subDomains = controller.options.subDomains;
                    controller.dataMarkers =  controller.options.dataMarkers;
                    controller.altText = controller.options.altText;

                    // collect the data from json or table
                    controller.markerdata = controller._setData(controller.dataMarkers);
                    // init the map
                    this.map = this._createMap();
                    // add the markers layer
                    this._setMarkers(controller.markerdata.markers, this.map);
                    this.map.whenReady(this._onWhenReady);
                    this.map.on('click', this._onMapClick);
                    this.map.on('focus', this._onMapFocus, this);
                    this.map.on('blur', this._onMapBlur, this);
                };

                /**
                 * init events when map buidling is ready
                 * @return none
                 */
                controller._onWhenReady = function() {
                    //console.log('i\'m ready!!!!');
                    if (controller.options.listenToEvents) {
                        this.on('popupopen', controller._handlePopupOpen);
                        this.on('popupclose', controller._handlePopupClose);
                    }

                    if (options.addAltText){
                        controller._setAltText();
                    }

                };

                /**
                 * detect map focussing
                 * @param  {event} e passed map event
                 */
                controller._onMapFocus = function() {
                    controller.$el.addClass('focus');
                };

                /**
                 * detect map focussing
                 * @param  {event} e passed map event
                 */
                controller._onMapBlur = function() {
                    controller.$el.removeClass('focus');
                };

                /**
                 * Create the leaflet map
                 * @return {map} initialised map with tileLayer
                 */
                controller._createMap = function() {
                    var map = L.map(controller.el.id, {
                        crs: RD,
                        continuousWorld: true,
                        zoom: controller.startZoom,
                        dragging: controller.options.dragging,
                        zoomControl: controller.options.zoomControl,
                        scrollWheelZoom: controller.options.scrollWheelZoom,
                        doubleClickZoom: controller.options.doubleClickZoom,
                        boxZoom: controller.options.boxZoom,
                        touchZoom: controller.options.touchZoom,
                        keyboard: controller.options.keyboardInteraction,
                        trackResize: controller.options.trackResize,
                        layers: [
                                new L.TileLayer(controller.tileProviderUrlTemplate, {
                                    attribution: controller.attribution,
                                    maxZoom: controller.maxZoom,
                                    minZoom: controller.minZoom,
                                    subdomains: controller.subDomains,
                                    key: controller.apiKey,
                                    detectRetina: true,
                                    continuousWorld: true
                                })
                            ]
                        });

                    // L.tileLayer(controller.tileProviderUrlTemplate, {
                    //  attribution: controller.attribution,
                    //  maxZoom: controller.maxZoom,
                    //  minZoom: controller.minZoom,
                    //  subdomains: controller.subDomains,
                    //  key: controller.apiKey,
                    //  detectRetina: true
                    // }).addTo(map);

                    // add scale to map
                    L.control.scale({
                        imperial: false,
                        position:'topright'
                    }).addTo(map);

                    //if(controller.options.zoomControl){
                    //var zoomControl     = new L.Control.Zoom({ position: 'topright'} ); // default topleft
                    //var scaleControl    = new L.Control.Scale({ position: 'bottomleft' });
                    //zoomControl.addTo(map);
                    //scaleControl.addTo(map);
                    //}
                    return map;
                };

                /**
                 * set the markers on the map layer
                 * @param  {[type]} markers pass controller.markerdata.markers
                 * @return none
                 */
                controller._setMarkers = function(markers, map) {
                    //console.log(markers);
                    // {latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'}
                    controller.markers = [];
                    controller.bounds = [];
                    // between 200 and 300 maximum width of map 2*19 is margin in popup + 14px side space
                    var popupOptions = {
                        minWidth: Math.min(map._container.offsetWidth, 200) ,
                        maxWidth: Math.min(map._container.offsetWidth-53, 300)
                    };

                    $.each(markers, function(index, mrk) {
                        var title = mrk.title.replace(/(<([^>]+)>)/ig, '').replace(/^\s+|\s+$/g, '');// strip tags and trailing leading whitespace
                        var lmrk = L.marker(mrk.latlng, {
                            title: title
                        }).addTo(map);
                        controller.markers.push(lmrk);
                        controller.bounds.push(mrk.latlng);
                        //controller.markers[index].bindPopup('<h3>' + mrk.title + '</h3>' + mrk.popuptext);

                        controller.markers[index].bindPopup(mrk.popuptext,popupOptions);
                    });

                    //console.log(controller.bounds);
                    var latlngBounds = new L.latLngBounds(controller.bounds);
                    //this.map.fitBounds(latlngBounds, { padding: new L.point(16, 16)});
                    this.map.fitBounds(latlngBounds, {
                        padding: new L.point(16, 16)
                    });

                    //zoom map to certain level
                    //multiple points controller.startZoom or based on fit points
                    //single point controller.startZoom or marker zoom or default
                    if(parseInt(controller.startZoom,10)>-1){
                        this.map.setZoom(controller.startZoom);
                    } else if (markers.length === 1) {
                        this.map.setZoom(markers[0].zoom || controller.options.startZoom);
                    }
                };

                /**
                 * create controller markerdata object from table or json opject
                 * {latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'}
                 * @param  {[type]} data [description]
                 * @return markerdata object
                 */
                controller._setData = function(data) {
                    if (!data) {
                        data = {};
                        var $datatable = null;
                        data.markers = [];

                        $datatable =  controller.$el.children();
                        if($datatable.length === 0) {return;}

                        var dataType = $datatable[0].tagName;
                        // hide visually
                        $datatable.addClass('assistive');

                        // add data to markers array
                        var addDataMarkers = function($el,title,popuptext){
                            var loc = $el.data('location').split(',');
                            var zoom = $el.data('zoom')|| controller.startZoom;
                            //[51.5, -0.09], {title: 'London'}
                            var obj = {
                                latlng: loc,
                                title: title,
                                popuptext: popuptext,
                                zoom: zoom
                            };
                            data.markers.push(obj);
                        };

                        switch (dataType) {
                        case 'TABLE':
                            $datatable.find('tbody tr').each(function() {
                                var $this = $(this);
                                var title = $this.find('th').html();
                                var popuptext = $this.find('td').html();
                                addDataMarkers($this,title,popuptext);
                            });
                            break;
                        case 'UL':
                            $datatable.find('li').each(function() {
                                var $this = $(this);
                                var title = $this.find('a').html() || $this.html();
                                var popuptext = $this.html();
                                addDataMarkers($this,title,popuptext);
                            });
                            break;
                        case 'DIV':
                            // input is selector element with h3, p, img
                            $datatable.each(function() {
                                var $this = $(this);
                                var title = $this.find('h3').html() || $this.find('a').html() || $this.html();
                                var popuptext = $this.html();
                                addDataMarkers($this,title,popuptext);
                            });

                            break;
                        case 'DL':
                            // TODO
                            break;
                        }
                    }
                    return data;
                };

                /**
                 * handle events when popup is opened
                 * @return none
                 */
                controller._handlePopupOpen = function(e) {
                    this.dragging.disable();
                    this.touchZoom.disable();
                    this.scrollWheelZoom.disable();
                    this.doubleClickZoom.disable();
                    this.boxZoom.disable();
                    this.keyboard.disable();

                    // focus on anchor on popup
                    $(e.popup._container).find('.leaflet-popup-content a').first().focus();
                    // on tab go to next when there is a second anchor
                    // setView( <LatLng> center, <Number> zoom, <zoom/pan options> options? ) of current marker
                };

                /**
                 * reset events when popup is closed
                 * @return none
                 */
                controller._handlePopupClose = function() {
                    if (this.options.dragging) {
                        this.dragging.enable();
                    }
                    if (this.options.touchZoom) {
                        this.touchZoom.enable();
                    }
                    if (this.options.scrollWheelZoom) {
                        this.scrollWheelZoom.enable();
                    }
                    if (this.options.doubleClickZoom) {
                        this.doubleClickZoom.enable();
                    }
                    if (this.options.boxZoom) {
                        this.boxZoom.enable();
                    }
                    if (this.options.keyboardInteraction) {
                        this.keyboard.enable();
                    }
                    // focus back to map not to markers
                    //this.focus();
                };

                /* -----------------------------------
                    add alt attribute on only the first image in the map
                   ----------------------------------*/
                controller._setAltText = function(){
                    controller.$el.find('img:not([alt])').attr('alt', '').first().attr('alt', this.altText);
                };

                // /**
                //  * This function puts the flood layer on the map.
                //  */
                // controller._putLayer = function () {
                //  var imgCSS = { opacity: 0.5 };
                //  var overlay = new L.ImageOverlay(this.kmlUrl, this.kmlBounds, imgCSS).addTo(this.map);
                // };

                /**
                * This function clears map from any attached markers.
                */
                controller._clearMap = function () {
                    $.each(controller.markers, function (key, marker) {
                        controller.map.removeLayer(marker);
                    });
                };

                // test RD coordinates
                controller.map.on('click', function(e) {
                    if (window.console) {
                        var point = RD.projection.project(e.latlng);
                        console.log("RD X: " + point.x + ", Y: " + point.y);
                    }
                });


                // Run initializer
                controller.init();
            };

            /**
             * set default options
             * @type leafletController object
             */
            $.leafletController.defaultOptions = {
                maxZoom: 18,
                minZoom: 1,
                apiKey: 'Fmjtd%7Cluub20uy2q%2Caw%3Do5-9urlq0',
                subDomains: ['otile1', 'otile2', 'otile3', 'otile4'],
                listenToEvents: false,
                url: 'http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
                attribution: '&copy;<a href="http://open.mapquest.co.uk" target="_blank">MapQuest</a>, Map data &copy; <a href="http://www.openstreetmap.org/copyright/" target="_blank">OpenStreetMap</a>',
                startZoom: 6,
                dragging: true,
                zoomControl: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                boxZoom: false,
                touchZoom: true,
                keyboardInteraction: true,
                trackResize: true,
                altText:'Kaart van Nederland',
                addAltText:false,
                kmlUrl: 'images/map/water_levels.png',
                kmlBounds: [[50.343832, 2.511731],[53.876508, 7.751853]]
            };


            return $el.each(function() {
                var $el = $(this),
                    options = parser.parse($el, opts);
                (new $.leafletController(this, options));
            });
        },
    };

    patterns.register(mapLeaflet);
    return mapLeaflet;
}));
