// jshint indent: 4, browser: true, jquery: true, quotmark: false, camelcase: false, eqnull:true
// vim: sw=4 expandtab
/* global  define */

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


(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery','pat-registry','pat-parser','leaflet', 'proj4', 'proj4leaflet'], function ($, patterns, Parser,L , proj4, LProj4) {
            return factory($, patterns, Parser, L, proj4, LProj4);
        });
    } else {
        factory(root.jQuery, root.patterns, root.patterns.Parser, root.L,root.proj4,root.L.Proj);
    }
}(this, function($, patterns, Parser, L, proj4, LProj4 ) {

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
        name: 'patleaflet',
        trigger: '.pat-map-leaflet',

        init: function($el, opts) {

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


                    var RD = new L.Proj.CRS.TMS(
                        'EPSG:28992',
                        '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +no_defs',
                        [-285401.92,22598.08,595401.9199999999,903401.9199999999], {
                        resolutions: [3440.640, 1720.320, 860.160, 430.080, 215.040, 107.520, 53.760, 26.880, 13.440, 6.720, 3.360, 1.680, 0.840, 0.420]
                    });

                    var map = new L.Map('map', {
                      continuousWorld: true,
                      crs: RD,
                      layers: [
                        new L.TileLayer('http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png', {
                            tms: true,
                            minZoom: 2,
                            maxZoom: 13,
                            attribution: 'Kaartgegevens: © <a href="http://www.cbs.nl">CBS</a>, <a href="http://www.kadaster.nl">Kadaster</a>, <a href="http://openstreetmap.org">OpenStreetMap</a><span class="printhide">-auteurs (<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>).</span>',
                            continuousWorld: true
                        })
                      ],
                      center: new L.LatLng(52, 5.3),
                      zoom: 2
                    });
                    // test RD coordinates
                    map.on('click', function(e) {
                        if (window.console) {
                            var point = RD.projection.project(e.latlng);
                            console.log("RD X: " + point.x + ", Y: " + point.y);
                        }
                    });

                    console.log('init patmapleaflet')



                    // // collect the data from json or table
                    // controller.markerdata = controller._setData(controller.dataMarkers);
                    // // init the map
                    // this.map = this._createMap();
                    // // add the markers layer
                    // this._setMarkers(controller.markerdata.markers, this.map);
                    // this.map.whenReady(this._onWhenReady);
                    // this.map.on('click', this._onMapClick);
                    // this.map.on('focus', this._onMapFocus, this);
                    // this.map.on('blur', this._onMapBlur, this);
                };

                

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
        }
    };

    patterns.register(mapLeaflet);
    return mapLeaflet;
}));
