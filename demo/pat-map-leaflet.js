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
// when using +proj=stere the roads are offset by about 100meters
// These projection strings are both incomplete, because they do not take into account the datum shift that is used in the RD projection and can be approximated using the ‘towgs84′ parameter in PROJ4.
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

        init: function($el, options) {
            // http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png
            
            var defaultOptions = {
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
            },

            defaultLayers = {
                AHN25M: {
                    layertype: 'WMS',
                    name: 'AHN1 - Actueel Hoogtebestand NL 25 meter (WMS)',
                    url: 'http://geodata.nationaalgeoregister.nl/ahn25m/wms',
                    layers: 'ahn25m',
                    transparent: 'true',
                    format: 'image/png',
                    visibility: true,
                    isBaseLayer: false,
                    singleTile: true
                },
                BRT: {
                    layertype: 'WMTS',
                    name: 'BRT Achtergrondkaart (WMTS)',
                    url: 'http://geodata.nationaalgeoregister.nl/wmts/',
                    layer: 'brtachtergrondkaart',
                    style: null,
                    matrixSet: 'EPSG:28992',
                    visibility: true,
                    isBaseLayer: true,
                    attribution: '(c) OSM & Kadaster'
                },
                LUFO: {
                    layertype: 'WMTS',
                    name: 'PDOK achtergrond luchtfoto\'s (WMTS)',
                    url: 'http://geodata1.nationaalgeoregister.nl/luchtfoto/wmts?',
                    version: "1.3.0",
                    layer: 'luchtfoto',
                    style: '',
                    matrixSet: 'nltilingschema',
                    matrixIds : [01,02,03,04,05,06,07,08,09,10,11,12,13,14,15,16],
                    serverResolutions: [3440.64, 1720.32, 860.16, 430.08, 215.04, 107.52, 53.76, 26.88, 13.44, 6.72, 3.36, 1.68, 0.84, 0.42],
                    visibility: true,
                    isBaseLayer: true,
                    format: 'image/jpeg',
                    attribution: '<a href="https://www.pdok.nl/nl/copyright/luchtfotos/" target="_blank">(c) CC-BY-NC</a>',
                    zoomOffset: 2
                }
            };

            return $el.each(function(el) {
                // // To avoid scope issues, use 'controller' instead of 'this'
                // // to reference this class from internal events and functions.
                // var controller = this;

                // // Access to jQuery and DOM versions of element
                // controller.$el = $(el);
                // controller.el = el;

                // Add a reverse reference to the DOM object referencing like $(".map").data("MapController")
                // controller.$el.data('MapController', controller);

                var $patleaflet = $(this),
                    options = parser.parse($patleaflet, options),
                    settings = $.extend({}, defaultOptions, options);

                 /**
                 * The zoom level property = the zoom level to start in (between 0 and 14)
                 * 
                 * @type int
                 */
                this.zoom = null;

                /**
                 * The location (x,y) to zoom to. A x,y commaseparated String (epsg:28992)
                 * @type String
                 */
                this.loc = null;

                /**
                 * A boundingbox (w,s,e,n) to zoom to. A commaseparated String of west,south,east,north
                 * @type String
                 */
                this.bbox = null;

                /**
                 * A commaseparated list of pdok id's (defined in pdok-layers.js). Eg: 'brt,top10'
                 * @type String
                 */
                this.pdoklayers = null;

                /**
                 * Reference to OpenLayers Map object
                 * @type OpenLayers.Map
                 */
                this.map = null;

                /**
                 * The location to put a marker. mloc = markerlocation
                 *
                 * By giving a mloc param (eg 125000,450000) in the config or querystring, a marker will be placed on that point (using mt0 as style)
                 * @type String
                 */
                this.mloc = null;

                /**
                 * Reference to an image URL for the marker. To be used in combination with mloc
                 *
                 * It is overriding the mt0 externalGraphic image
                 * @type URL
                 */
                this.mimg = null;


                /**
                 * Markertype property. You can set a mt (styletype) for your mloc. Eg 'mt3'
                 * @type String
                 */
                this.mt = null;

                /**
                 * If a popup should be used or not. Defaults to true
                 * @type boolean
                 */
                this.showPopup = true;
                this.showpopup = true;

                /**
                 * If a popup hover should be used or not Defaults to false
                 * @type boolean
                 */
                this.hoverPopup = false;
                this.hoverpopup = false;

                /**
                 * Reference to popup titel, only used in case of the use of mloc
                 * @type String
                 */
                this.titel = null;

                /**
                 * Reference to popup text, only used in case of the use of mloc
                 * @type String
                 */
                this.tekst = null;

                /**
                 * an URL to a text file, to be used loaded as features
                 *
                 * The text file format is determined by the OpenLayers.Format.Text Class
                 * 
                 * <p>Examples of such txt files:
                 * <pre>
                 * point  title   description
                 * # defaulting to epsg:28992 / RD
                 * # !!!!!! FIRST Y THEN X
                 * 517000,117960  foo omschrijving foo
                 * 511800,222000  faa omschrijving faa
                 * 541611,155111  fii omschrijving fii
                 * # alternative epsg:4326 / LatLon
                 * #52.64,4.84    foo omschrijving foo
                 * #52.59,6.38    faa omschrijving faa
                 * #51.73,5.39    fii omschrijving fii
                 * <pre>
                 * or 
                 * <pre>
                 * * lat  lon title   description
                 * # defaulting to epsg:28992 / RD
                 * # !!!!!! FIRST Y THEN X
                 * 517000 117960  foo omschrijving foo
                 * 511800 222000  faa omschrijving faa
                 * 541611 155111  fii omschrijving fii
                 * # alternative epsg:4326 / LatLon
                 * #52.64 4.84    foo omschrijving foo
                 * #52.59 6.38    faa omschrijving faa
                 * #51.73 5.39    fii omschrijving fii
                 * </pre>
                 * or an example with images and their dimensions
                 * <pre>
                 * lat   lon title   description iconSize    iconOffset  icon
                 * 450000 140000  Ministerie ELenI    Economische Zaken Landbouw en Innovatie 32,37   16,-37  http://kaart.pdok.nl/api/markertypes/flag-nl.png
                 * 460000 160000  Kadaster    Kadaster    32,37   -16,-18 http://kaart.pdok.nl/api/markertypes/flag-blue.png
                 * 470000 170000  Rijkswaterstaat Infrastructuur en Milieu    64,72   -32,-36 http://kaart.pdok.nl/api/markertypes/vlc.png
                 * 480000 180000  Ministerie IenM Infrastructuur en Milieu    40,46   -20,-23 http://kaart.pdok.nl/api/markertypes/flag-blue.png
                 * </pre>
                 * </p>
                 * @see <a href="../../../documentatie/examples/data/test1.txt">test1.txt</a>
                 * @see <a href="../../../documentatie/examples/data/test2.txt">test2.txt</a>
                 * @type URL
                 */
                this.txturl = null;

                /**
                 * Wmts URL to be used as wmts layer. Always together with a wmtslayer and wmtsmatrixset parameter
                 * @type URL
                 */
                this.wmtsurl = null;

                /**
                 * The layername of the wmts service. ALways together with a wmtsurl and wmtsmatrixset parameter
                 * @type String
                 */
                this.wmtslayer = null;

                /**
                 * The matrixset of the wmts service. ALways together with a wmtsurl and wmtslayer parameter
                 * @type String
                 */
                this.wmtsmatrixset = null;

                /**
                 * The WMS url to be used as a wms layer. Always together with a wmslayers parameter
                 * @type URL
                 */
                this.wmsurl = null;

                /**
                 * The wms layers parameter, a commaseparated string of layername(s). Always together with a wmsurl parameter
                 * @type String
                 */
                this.wmslayers = null;


                /**
                 * The wmsinfoformat parameter, format of featureinfo
                 *  currently only 'text/html' and 'text/plain' are supported
                 * For the service from the this.wmsurl parameter there will be a featureinfocontrol created
                 *
                 * @type String
                 */
                this.wmsinfoformat = 'none';

                /**
                 * The TMS url to be loaded as a layer. Always together with tmslayer
                 * @type URL
                 */
                this.tmsurl = null;
                /**
                 * The tms layer parameter, a layer name of the tms service. Always together with a tmsurl parameter
                 * @type String
                 */
                this.tmslayer = null;
                /**
                 * The tmstype parameter, the image format to use (defaults to .png). Always together with a tmsurl and tmslayer parameter
                 * @type String
                 */
                this.tmstype = 'png';

                // Reference to layerswitch object (not to be used at the moment)
                this.ls = false;

                /**
                 * To determine if the layer switcher should be shown or not. Defaults to true
                 * @type Boolean
                 */
                this.showlayerswitcher = true;

                /**
                 * Reference to the DIV-id the map should be rendered in.
                 * Note that you have to set this one to have two maps in one page!
                 * @type String
                 */
                this.div = 'map';

                /**
                 * Reference to internal styles Object with all marker, lines and polygon rules.
                 *
                 * This Object is created from the pdok-markers.js file. Which is a json file with marker definitions
                 * @type Object
                 */
                this.styles = null;

                // internal name of the features layer
                this.FEATURESLAYER_NAME = "Markers";

                // this.features can come as KML string from config/params
                // after handling this, it contains an array of features
                this.features = [];

                /**
                 * Reference to featuresLayer (= layer where you draw feature on)
                 * @type OpenLayers.Layer.Vector
                 */
                this.featuresLayer = null;
                
                    
                // data passed as  data attribute in the html has priority above passed by javascript
                settings.tileProviderUrlTemplate =  settings.url.replace(/'/g, '');
                settings.onInitialized = mapLeaflet.onInitialized;
                mapLeaflet.setup($patleaflet, settings);
            });
        },

        setup: function($el, settings) {
            console.log(settings);
            settings.onInitialized();
        },

        // voorbeeld api url:
        // wmsurl=http://geodata.nationaalgeoregister.nl/nwbwegen/wms&wmslayers=wegvakken,hectopunten&zoom=8&loc=140000,470000
        // 
        // voorbeeld script configuratie
        // var config = {
        //     "zoom":12,
        //     "loc":['117310.48','478021.84'],
        //     "features":'<kml xmlns="http://earth.google.com/kml/2.0"><Folder><Placemark><name>Veld 1</name><description>Kunstgras</description><Polygon><outerBoundaryIs><LinearRing><coordinates>4.832158918037519,52.289198752647465 4.833604297454259,52.28880538750718 4.83321702413708,52.288267535670336 4.8317961863987335,52.28866856118072 4.832158918037519,52.289198752647465</coordinates></LinearRing></outerBoundaryIs></Polygon><ExtendedData><Data name="styletype"><value>pt5</value></Data></ExtendedData></Placemark><Placemark><name>Veld 2</name><description>Kunstgras</description><Polygon><outerBoundaryIs><LinearRing><coordinates>4.83370334917628,52.28876055222833 4.834988284472295,52.28839661838783 4.834613027202369,52.28788147673822 4.83334050861941,52.28823791482712 4.83370334917628,52.28876055222833</coordinates></LinearRing></outerBoundaryIs></Polygon><ExtendedData><Data name="styletype"><value>pt5</value></Data></ExtendedData></Placemark><Placemark><name>Veld 3</name><description>Gras</description><Polygon><outerBoundaryIs><LinearRing><coordinates>4.835050213818429,52.2883667082711 4.83633512674572,52.288002759731576 4.835984291235147,52.28750283587499 4.834699389915331,52.287866780651896 4.835050213818429,52.2883667082711</coordinates></LinearRing></outerBoundaryIs></Polygon><ExtendedData><Data name="styletype"><value>pt5</value></Data></ExtendedData></Placemark><Placemark><name>Veld 6</name><description>Kunstgras</description><Polygon><outerBoundaryIs><LinearRing><coordinates>4.832656799453639,52.289752226315464 4.8337439479171715,52.289455326661475 4.833490396210264,52.28905399859664 4.832390756354692,52.28936593696613 4.832656799453639,52.289752226315464</coordinates></LinearRing></outerBoundaryIs></Polygon><ExtendedData><Data name="styletype"><value>pt5</value></Data></ExtendedData></Placemark><Placemark><name>Veld 4</name><description>Gras</description><Polygon><outerBoundaryIs><LinearRing><coordinates>4.834248048457809,52.28951053390999 4.833885007510901,52.28900299701928 4.83513292179059,52.28864643818935 4.83549578675874,52.28916907008237 4.834248048457809,52.28951053390999</coordinates></LinearRing></outerBoundaryIs></Polygon><ExtendedData><Data name="styletype"><value>pt5</value></Data></ExtendedData></Placemark><Placemark><name>Veld 5</name><description>Gras</description><Polygon><outerBoundaryIs><LinearRing><coordinates>4.835631770615655,52.2891244055084 4.836916981019351,52.28873780254075 4.836565946212252,52.28825297925307 4.8352810279250145,52.28861693027675 4.835631770615655,52.2891244055084</coordinates></LinearRing></outerBoundaryIs></Polygon><ExtendedData><Data name="styletype"><value>pt5</value></Data></ExtendedData></Placemark><Placemark><name>1A</name><description>&amp;nbsp;</description><Point><coordinates>4.832255869383488,52.288829270055494</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>1B</name><description>&amp;nbsp;</description><Point><coordinates>4.833021314794686,52.288659213908446</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>2A</name><description>&amp;nbsp;</description><Point><coordinates>4.833775289133154,52.28842115064746</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>2B</name><description>&amp;nbsp;</description><Point><coordinates>4.834541003230846,52.28822843645261</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>3A</name><description>&amp;nbsp;</description><Point><coordinates>4.835047996988898,52.288049609106224</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>3B</name><description>&amp;nbsp;</description><Point><coordinates>4.835936806439181,52.28785746065328</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>4A</name><description>&amp;nbsp;</description><Point><coordinates>4.8342464006316,52.289148138461194</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>4B</name><description>&amp;nbsp;</description><Point><coordinates>4.835061369342126,52.2889556512135</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>5A</name><description>&amp;nbsp;</description><Point><coordinates>4.835617519584729,52.2887846007872</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark><Placemark><name>5B</name><description>&amp;nbsp;</description><Point><coordinates>4.836346486272761,52.28857660382915</coordinates></Point><ExtendedData><Data name="styletype"><value>mt3</value></Data></ExtendedData></Placemark></Folder></kml>',
        //     "hoverPopup":"true",
        //     "showlayerswitcher":"false"
        // };
        // function createPDOKKaart() {
        //     var api = new Pdok.Api(config);
        //     return api;
        // }       
        // OpenLayers.ImgPath="../api/img/";
        // 
        // 
        // showBRT : function(){
        //     var layers = olMap.getLayersByName("BRT Achtergrondkaart");
        //     for(var layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        //         olMap.setBaseLayer(layers[layerIndex]);
        //     }
        // },
        // 
        // /**
        //  * Method to create a WMS layer and add it to the map based on a layer configuration object. Normally you'll use the addWMS method, but you can also use this way.
        //  * @param {Object} layerConfigObj a layer configuration object as described in markersdef
        //  */
        // Pdok.Api.prototype.createWMSLayer = function(layerConfigObj) {
        //     // default WMS layer object to set defaults:
        //     // missing values in config object will be replaced by sensible defaults:
        //     var defaults = {
        //             name: 'WMS layer',
        //             url: '',
        //             layers: '',
        //             wmsinfoformat: 'none',  // if this one is filled a featureinfocontrol is added
        //             styles: '',
        //             visibility: true,
        //             isBaseLayer: false,
        //             format: 'image/png',
        //             singleTile: true,
        //             attribution:''
        //     };

        //     layerConfigObj = OpenLayers.Util.applyDefaults(layerConfigObj, defaults);

        //     var layer = new OpenLayers.Layer.WMS(
        //             layerConfigObj.name,
        //             layerConfigObj.url,
        //             {
        //                 layers: layerConfigObj.layers, 
        //                 transparent: layerConfigObj.transparent, 
        //                 format: layerConfigObj.format
        //             },
        //             {
        //                 visibility: layerConfigObj.visibility, 
        //                 isBaseLayer: layerConfigObj.isBaseLayer, 
        //                 singleTile: layerConfigObj.singleTile,
        //                 attribution:layerConfigObj.attribution 
        //             }
        //     );
        //     if (layerConfigObj.wmsinfoformat && layerConfigObj.wmsinfoformat != 'none') {
        //         var infoformat = layerConfigObj.wmsinfoformat; // text/plain, application/vnd.ogc.gml, application/vnd.ogc.gml/3.1.1, text/html
        //         var info = new OpenLayers.Control.WMSGetFeatureInfo({
        //             url: layerConfigObj.url,
        //             infoFormat: infoformat,
        //             title: 'Info voor'+layerConfigObj.name,
        //             queryVisible: true,
        //             eventListeners: {
        //                 getfeatureinfo: function(event) {
        //                     // removing all popups here first!
        //                     while( this.map.popups.length ) {
        //                         this.map.removePopup(this.map.popups[0]);
        //                     }
        //                     popupContent = event.text;
        //                     if (infoformat == 'text/plain'){
        //                         popupContent = '<pre>'+event.text+'</pre>';
        //                     }
        //                     var popup = new OpenLayers.Popup.FramedCloud(
        //                         "featurePopup", 
        //                         this.map.getLonLatFromPixel(event.xy),
        //                         null,
        //                         popupContent,
        //                         null,
        //                         true
        //                     );
        //                     this.map.addPopup(popup);
        //                 }
        //             }
        //         });
        //         this.map.addControl(info);
        //         info.activate();
        //     }

        //     return layer;
        // }


        // 
        // /**
        // * Api method to set the current center of the map.
        // * 
        // * @param {Array or Atring} loc An array of two coordinates: like [x,y] OR a commaseparated String with the two coordinates
        // */
        // setLocation = function(loc) {
        //     // if loc is a string like '150000,450000', split
        //     if( typeof(loc) == 'string'){
        //         loc = loc.split(',');
        //     }
        //     this.map.setCenter (new OpenLayers.LonLat(parseInt(loc[0]), parseInt(loc[1])));
        //     return true;
        // }
        // 
        // /**
        //  * Api method to set the current zoom level of this Api map
        //  * 
        //  * @param {integer} zoomlevel the zoomlevel (0 is full map, 14 is fully zoomed in)
        //  */
        // setZoomLevel = function(zoomlevel) {
        //     this.map.zoomTo (zoomlevel);
        //     return true;
        // }
        // 
        // /**
        //  * Api Interface addLayers to add layers the map, based on their layerkey-names Eg: 'BRT,TOP10NL2,CBS_PROVINCIES'
        //  * @param {array} An javascript array of layer names
        //  * @param {OpenLayers.Map} the Pdok.Api-map to add the layers to
        //  */
        // addLayers = function(arrLayerNames, map){
        //     if (arrLayerNames==null){
        //         alert('null object as layernames');
        //         return;
        //     }
        //     else if (arrLayerNames == '-') {
        //         // this is the 'header' of the selectbox: "choose ..."
        //         return;
        //     }

        //     if (map == undefined){
        //         map = this.map;
        //     }
        //     for (l in arrLayerNames)
        //     {
        //         var layerId = arrLayerNames[l];
        //         if (this.defaultLayers[layerId]){
        //             var lyr;
        //             if (this.defaultLayers[layerId].layertype.toUpperCase()=='WMS'){
        //                 lyr = this.createWMSLayer( this.defaultLayers[layerId]);
        //             }
        //             else if (this.defaultLayers[layerId].layertype.toUpperCase()=='WMTS'){
        //                 lyr = this.createWMTSLayer( this.defaultLayers[layerId]);
        //             }
        //             else if (this.defaultLayers[layerId].layertype.toUpperCase()=='TMS'){
        //                 lyr = this.createTMSLayer( this.defaultLayers[layerId]);
        //             }
        //             else {
        //                 alert('layertype not available (wrong config?): ' + this.defaultLayers.l.layertype);
        //             }
        //             if (lyr){
        //                 lyr.pdokId = layerId;
        //                 map.addLayer(lyr);
        //             }
        //         }
        //         else{
        //             alert('layerid not available: ' + layerId);
        //         }
        //     }
        //     // to be sure featuresLayer and locationLayer are always on top
        //     this.moveVectorLayersToTop();
        //     return true;
        // }

        //createMap: function(mapoptions){
        //  open layers example 
        //  var olMap = new OpenLayers.Map ({
        //     controls: controls,
        //     maxExtent: new OpenLayers.Bounds(-285401.92,22598.08,595401.9199999999,903401.9199999999),
        //     theme: null,
        //     resolutions: [3440.64, 1720.32, 860.16, 430.08, 215.04, 107.52, 53.76, 26.88, 13.44, 6.72, 3.36, 1.68, 0.84, 0.42, 0.21],
        //     numZoomLevels: 15,
        //     units: 'm',
        //     projection: new OpenLayers.Projection("EPSG:28992"),
        //     div: this.div
        // });
        // this.map = olMap;
        //}

        onInitialized: function(event, el) {
            console.log('map initialized');
        }


    };

    patterns.register(mapLeaflet);
    return mapLeaflet;
}));
