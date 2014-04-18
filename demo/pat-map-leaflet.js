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

// de coördinaten in het Rijksdriehoeksstelsel (RD) 
// Spatialreference.org has a slightly different take on EPSG:28992:
// +proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs
// 
// EPSG stands for : European Petroleum Survey Group
// 
// when using +proj=stere the roads are offset by about 100meters
// These projection strings are both incomplete, because they do not take into account the datum shift that is used in the RD projection and can be approximated using the ‘towgs84′ parameter in PROJ4.
// 
// The one and only right PROJ4 projection string is
// +proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.999908 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +no_defs
// src: http://oegeo.wordpress.com/2008/05/20/note-to-self-the-one-and-only-rd-projection-string/
// http://www.kadaster.nl/rijksdriehoeksmeting/rdnap.html
// https://github.com/kartena/Proj4Leaflet
// 
// example calling api
// proj4(fromProjection[, toProjection2, coordinates])
// 
// When all 3 arguments are given, the result is that the coordinates are transformed from projection1 to projection 2. And returned in the same format that they were given in.
// var firstProjection = 'PROJCS["NAD83 / Massachusetts Mainland",GEOGCS["NAD83",DATUM["North_American_Datum_1983",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6269"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.01745329251994328,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4269"]],UNIT["metre",1,AUTHORITY["EPSG","9001"]],PROJECTION["Lambert_Conformal_Conic_2SP"],PARAMETER["standard_parallel_1",42.68333333333333],PARAMETER["standard_parallel_2",41.71666666666667],PARAMETER["latitude_of_origin",41],PARAMETER["central_meridian",-71.5],PARAMETER["false_easting",200000],PARAMETER["false_northing",750000],AUTHORITY["EPSG","26986"],AXIS["X",EAST],AXIS["Y",NORTH]]';
// var secondProjection = "+proj=gnom +lat_0=90 +lon_0=0 +x_0=6300000 +y_0=6300000 +ellps=WGS84 +datum=WGS84 +units=m +no_defs";
// 
// proj4(firstProjection,secondProjection,[2,5]);
// [-2690666.2977344505, 3662659.885459918]
// 
// example  conversion
// proj4(firstProjection).forward([-71,41]);
// -> [242075.00535055372, 750123.32090043]
// proj4(firstProjection).inverse([242075.00535055372, 750123.32090043]);
// -> [-71, 40.99999999999986]
//the floating points to answer your question
//
// map.setView([38.0, 127.0], 0);
// 
// resolutions are the bounds of the different zoom levels
// basic usage custom projection
// var crs = new L.Proj.CRS('EPSG:3575',
//         '+proj=laea +lat_0=90 +lon_0=10 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
//   {
//     resolutions: [8192, 4096, 2048], // 3 example zoom level resolutions
//   }
// );

// var map = L.map('map', {
//   crs: crs,
//   continuousWorld: true
// });
// L.tileLayer('http://tile.example.com/example/{z}/{x}/{y}.png').addTo(map);
//
// example:
// var RD = new L.Proj.CRS.TMS(
//     'EPSG:28992', 
//     '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +no_defs',
//     [-285401.92,22598.08,595401.9199999999,903401.9199999999], 
//     {resolutions: [3440.640, 1720.320, 860.160, 430.080, 215.040, 107.520, 53.760, 26.880, 13.440, 6.720, 3.360, 1.680, 0.840, 0.420]}
// );
// var map = new L.Map('map', {
//   continuousWorld: true,
//   crs: RD,
//   layers: [
//     new L.TileLayer('http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png', {
//         tms: true,
//         minZoom: 3,
//         maxZoom: 13,
//         attribution: 'Kaartgegevens: © <a href="http://www.cbs.nl">CBS</a>, <a href="http://www.kadaster.nl">Kadaster</a>, <a href="http://openstreetmap.org">OpenStreetMap</a><span class="printhide">-auteurs (<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>).</span>',
//         continuousWorld: true
//     })
//   ],
//   center: new L.LatLng(52.15, 5.38),
//   zoom: 3
// });
// // test RD coordinates
// map.on('click', function(e) {
//     if (window.console) {
//         var point = RD.projection.project(e.latlng);
//         console.log("RD X: " + point.x + ", Y: " + point.y);
//     }
// });
// 
// of via config voorbeeld:
// var config = {
// "zoom":1,
// "baselayer":'BRT',
// "loc":'142500, 470000',
// "pdoklayers":'BRT,AHN1_100M_WMS',
// "markersdef":'http://kaart.pdok.nl/api/js/pdok-markers.js',
// "layersdef":'http://kaart.pdok.nl/api/js/pdok-layers.js',
// "mloc":'140779.68,457957.76',
// "titel":'kop van marker',
// "tekst":'een tekst voor de marker',
// "mt":'mt0'
// };



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

    parser.add_argument('config');
    parser.add_argument('zoom');
    parser.add_argument('layers');
    

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

        init: function($el, options) {
            // http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png
            
            var defaultOptions = {
                maxZoom: 13,
                minZoom: 2,
                apiKey: 'Fmjtd%7Cluub20uy2q%2Caw%3Do5-9urlq0',
                listenToEvents: false,
                url: 'http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
                attribution: '(c) CC-BY Kadaster, Map data &copy; <a href="http://www.openstreetmap.org/copyright/" target="_blank">OpenStreetMap</a>',
                startZoom: 2,
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
        
            return $el.each(function(el) {
                
                var $patleaflet = $(this),
                    options = parser.parse($patleaflet, options),
                    settings = $.extend({}, defaultOptions, options);

                    
                // data passed as  data attribute in the html has priority above passed by javascript
                settings.tileProviderUrlTemplate =  settings.url.replace(/'/g, '');
                settings.onInitialized = mapLeaflet.onInitialized;
                mapLeaflet.setup($patleaflet, settings);
            });


        },

        setup: function($el, settings) {
            console.log(settings);
            mapLeaflet = this;

            // get position
            // get zoom level

            $.ajax({ type: 'GET', url: 'lib/defaultlayers.xml', dataType: 'xml', success: function(xml){
                var contectCollectionXML =  $('contextCollection', xml);
                console.log(contectCollectionXML.find('tmsLayer'));
                

                mapLeaflet.createMap(settings);
            }});
           
        },
        /**
         * Create a leaflet map
         * @param  {object} mapoptions json object with the mapoptions
         * @return {object} leaflet map object
         */
        createMap: function(mapoptions){

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
                center: new L.LatLng(52.15, 5.38),
                zoom: 2
            });

            return map;
        },

        /**
        * Api Interface addLayers to add layers the map, based on their layerkey-names Eg: 'BRT,TOP10NL2,CBS_PROVINCIES'
        * @param {array} An javascript array of layer names
        * @param {leaflet.Map} to add the layers to
        */
        addLayers: function(arrLayerNames, map){

        },

        /**
         * Api method to set the current zoom level of this Api map
         * 
         * @param {integer} zoomlevel the zoomlevel (0 is full map, 14 is fully zoomed in)
         */
        setZoomLevel: function(zoomlevel) {
            this.map.zoomTo(zoomlevel);
            return true;
        },

        /**
        * Api method to set the current center of the map.
        * 
        * @param {Array or Atring} loc An array of two coordinates: like [x,y] OR a commaseparated String with the two coordinates
        */
        setLocation: function(loc) {

        },

        /**
         * detect map focussing
         * @param  {event} e passed map event
         */
        _onMapFocus: function() {
            $el.addClass('focus');
        },

        /**
         * detect map focussing
         * @param  {event} e passed map event
         */
        _onMapBlur: function() {
            controller.$el.removeClass('focus');
        },

        onInitialized: function(event, el) {
            console.log('map initialized');
        }

    };

    patterns.register(mapLeaflet);
    return mapLeaflet;
}));
