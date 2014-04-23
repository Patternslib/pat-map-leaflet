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

// USAGE FOR PROJ4 layers with LEAFLET
// 
// glosssarY: 
// EPSG: European Petroleum Survey Group
// RD: Rijksdriehoeksstelsel (RD) dutch crs
// TMS: Tile map service
// WMS: Web Map Service
// crs: coordinate reference system
// 
// Spatialreference.org has a slightly different take on EPSG:28992:
// +proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs
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
// USAGE EXAMPLE:
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
// 
// USAGE EXAMPLE:
// var crs = new L.Proj.CRS.TMS(...),
//     map = new L.Map('map', {
//         crs: crs,
//         continuousWorld: true,
//         worldCopyJump: false
//     }),

// map.addLayer(new L.Proj.TileLayer.TMS('http://{s}.my-tms-server/{z}/{x}/{y}.png', crs, {
//     maxZoom: 17
//     ,minZoom: 0
//     ,continuousWorld: true
//     ,attribution: attrib
// }));


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
    parser.add_argument('layerNames');

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
                id: 'map',
                PROJ4Projection:'+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +no_defs',
                zoom: 2,
                listenToEvents: false,
                url: 'http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png',
                attribution: '',
                map:{zoom:2,baseUrl:'http://geodata.nationaalgeoregister.nl/',projection:'EPSG:28992'},
                layers:[],
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
                dataMarkers: null, //{{latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'},{latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'}}
                //kmlUrl: 'images/map/water_levels.png',
                //kmlBounds: [[50.343832, 2.511731],[53.876508, 7.751853]],
                center: [52.15, 5.38],
                onInitialized:null,
                context: '<contextCollection xmlns="http://preview.pdok.nl/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://preview.pdok.nl/1.0 config.xsd "><baseUrl>http://geodata.nationaalgeoregister.nl/</baseUrl><projection>EPSG:28992</projection><resolutions>3440.640,1720.320, 860.160, 430.080, 215.040, 107.520, 53.760, 26.880, 13.440, 6.720, 3.360, 1.680, 0.840, 0.420, 0.210, 0.105, 0.0525</resolutions><maxExtent>-285401.920,22598.080,595401.920,903401.920</maxExtent><center>155000,463000</center><zoom>2</zoom></contextCollection>'
            };

            $.MapController = function(el, options) {
                // To avoid scope issues, use 'base' instead of 'this'
                // to reference this class from internal events and functions.
                var base = this;

                // Access to jQuery and DOM versions of element
                base.$el = $(el);
                base.el = el;

                // Add a reverse reference to the DOM object referencing like $(".map").data("MapController")
                base.$el.data('MapController', base);

                /**
                 * initialise the map, create map, markers en eventhandlers
                 * @return none
                 */
                base.init = function() {
                    // get information from dom node and extend the options with it
                    base.options = parser.parse(base.$el, options);

                    // collect the data from dom tree
                    base.markerdata = base._getMarkerData(base.dataMarkers);

                    // get the layer information to display and create the map and markers
                    $.ajax({ type: 'GET', url: 'lib/defaultlayers.xml', dataType: 'xml'})
                         .done(function(xml) {
                                base.options.contextCollection =  $('contextCollection', xml);
                                base.options.map = $.extend(base.options.map, base.XMLParser.parseMap(base.options.contextCollection));
                                base.options.layers = base.XMLParser.parseLayers(base.options.contextCollection);
                            })
                        .fail(function() {
                                base.options.contextCollection =  $.parseXML(base.options.context);
                            })
                        .always(function() {
                                base.map = base._createMap();

                                if(base.map){
                                    base._addLayers(base.options.layers);

                                    base._addLayerControls();
                                    //base._addMarkers();
                                    //base._setView(base.options.map.center[0],base.options.map.center[1],base.options.map.zoom);
                                    
                                    base.map.whenReady(base._onWhenReady);
                                    // base.map.on('click', base._onMapClick);
                                    // base.map.on('focus', base._onMapFocus, base);
                                    // base.map.on('blur', base._onMapBlur, base);
                                
                                }
                                
                                // add the markers layer
                                
                                //base._setMarkers(base.markerdata.markers, base.map);
                               
                                base._onInitialized();
                            });

                };

                /**
                 * create base markerdata object from table or json opject
                 * {latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'}
                 * @param  {[type]} data [description]
                 * @return markerdata object
                 */
                base._getMarkerData = function(data) {
                    if (!data) {
                        data = {};
                        var $datatable = null;
                        data.markers = [];
                    
                        $datatable =  base.$el.children();
                        if($datatable.length === 0) {return;}
                        
                        // look in what structure the children are organised
                        var dataType = $datatable[0].tagName;
                       
                        // hide visually of the children
                        $datatable.addClass('assistive');

                        // add data to markers array
                        var addDataMarkers = function($el,title,popuptext){
                            var properties = $el.data('pat-leaflet').split(';');
                            var propertiesObj = {};
                            for(var i=0; i< properties.length; i++) {
                                var tup = properties[i].split(':');
                                if(tup){propertiesObj[tup[0]] = tup[1];}
                            }

                            //var object = JSON.parse('{ '+data+'}');
                            var loc = propertiesObj.location.split(',') ||  base.center;
                            var zoom = propertiesObj.zoom || base.zoom;

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

                base.XMLParser = {
                    parseMap : function (xml) {
                        //console.log(this);
                        var title = this.getTextContent('contextCollection > title', xml);
                        var baseUrl = this.getTextContent('contextCollection > baseUrl', xml);
                        var projection = this.getTextContent('projection', xml);
                        var resolutions = this.getNumberArrayContent('resolutions', xml);
                        var maxExtent = this.getNumberArrayContent('maxExtent', xml);
                        var center = this.getNumberArrayContent('center', xml);
                        var zoom = this.getNumberContent('zoom', xml);

                        var result = {
                            title:title,
                            baseUrl:baseUrl,
                            projection:projection,
                            resolutions:resolutions,
                            maxExtent:maxExtent,
                            center:center,
                            zoom:zoom
                        };

                        return result;
                    },
                    parseLayers : function (xml) {
                        var result = [];
                        var layerNames = base.options.layerNames.split(',');
                        var nodes = [];

                        $.each(layerNames, function(index, layerName) {
                            nodes.push(
                                $('title',xml).filter(function() {return $(this).text() === layerName;}).parent()
                            );
                        });

                        // get only the nodes with the correct title
                        // * eg: for a WMTS the layernames is defined in a 'layer' property
                        // * while for a WMS it is called 'layers' (mind the s on the end)
                        // * example one square of img: http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart@EPSG:28992@png/2/2/2.png

                        for (var i=0,j = nodes.length ; i < j; i++) {
                            var node = nodes[i];
                            
                            // Generic
                            var title = this.getTextContent('title', node),
                                url = this.getLayerUrlContent('url', node),
                                isBaseLayer = this.getBooleanContent('isBaseLayer', node),
                                isVisible = this.getBooleanContent('isVisible', node),
                                isSingleTile=this.getBooleanContent('isSingleTile', node),
                                layerType = node[0].nodeName,
                                opacity = this.getNumberContent('opacity', node),
                                transparent = Boolean(parseInt(opacity,10)),
                                config = {
                                    layerType:layerType,
                                    baselayer:isBaseLayer,
                                    singleTile:isSingleTile,
                                    transparent:transparent,
                                    opacity:opacity,
                                    visibility:isVisible,
                                    continuousWorld:true
                                };

                            switch(layerType) {
                            case 'tmsLayer':
                                // TMS specific
                                var layername = this.getTextContent('layername', node),
                                    type = this.getTextContent('type', node),
                                    bgColor = this.getTextContent('bgColor', node),
                                    attribution = this.getTextContent('attribution', node),
                                    tmsconfig = {
                                    tms:true,
                                    layername:layername,
                                    bgcolor:bgColor,
                                    type:type,
                                    attribution:attribution
                                };

                                url += '1.0.0/{layername}/{z}/{x}/{y}.{type}';
                                $.extend(config,tmsconfig);
                                break;
                            case 'wmsLayer':
                                // WMS specific
                                var layers = this.getTextContent('layers', node),
                                    format = this.getTextContent('format', node),
                                    wmsconfig = {
                                    format:format,
                                    layers:layers
                                };
                                $.extend(config,wmsconfig);
                                break;
                            }
                            //this.addMinMaxResolutions(config, node);
                            this.addMinMaxZoom(config, node);
                            var layer = {title:title,url:url,config:config};
                            result.push(layer);
                        }
                        return result;
                    },
                    getText:function ($node) {
                        return $node.text();
                    },
                    getTextContent:function (elementName, $node) {
                        var result;
                        var child = $node.find(elementName);
                        if (child) {
                            result = this.getText(child);
                        }
                        return result;
                    },
                    getNumberContent:function (elementName, $node) {
                        var result;
                        var text = this.getTextContent(elementName, $node);
                        if (!isNaN(text)) {
                            result = Number(text);
                        }
                        return result;
                    },
                    getTextOrNumberContent:function (elementName, root) {
                        var result;
                        var text = this.getTextContent(elementName, root);
                        if (isNaN(text)) {
                            result = text;
                        } else {
                            result = Number(text);
                        }
                        return result;
                    },
                    getTextArrayContent:function (elementName, $node) {
                        var result = [];
                        var text = this.getTextContent(elementName, $node);
                        if (text) {
                            result = text.split(",");
                        }
                        return result;
                    },
                    getBooleanContent:function (elementName, $node, defaultValue) {
                        var result =  this.getTextContent(elementName, $node);
                        if (!result && defaultValue) {
                            result = defaultValue;
                        }
                        return result === 'true';
                    },
                    getNumberArrayContent:function (elementName, $node) {
                        var result = [];
                        var text = this.getTextContent(elementName, $node);
                        if (text) {
                            var array = text.split(",");
                            for (var i = 0; i < array.length; i++) {
                                result.push(Number(array[i]));
                            }
                        }
                        return result;
                    },
                    getLayerUrlContent:function (elementName, $node) {
                        var result = this.getTextContent(elementName, $node);
                        if (result && result.indexOf("{baseUrl}") > -1) {
                            var baseUrl = this.getTextContent('baseUrl', $node.closest('contextCollection'));
                            if (baseUrl) {
                                result = result.replace("{baseUrl}", baseUrl);
                            } else if (base.options.map.baseUrl) {
                                result = result.replace("{baseUrl}", base.options.map.baseUrl);
                            } else {
                                console.log('No base URL found for layer');
                            }
                        }
                        return result;
                    },
                    addMinMaxZoom:function (properties, $node) {
                        var mapResolutions = base.options.map.resolutions;

                        var minResolution = this.getNumberContent('minResolution', $node);
                        if (!minResolution) {
                            minResolution = mapResolutions[mapResolutions.length - 1];
                        }
                        properties.minResolution = minResolution;
                        properties.maxZoom = mapResolutions.indexOf(minResolution);

                        var maxResolution = this.getNumberContent('maxResolution', $node);
                        if (!maxResolution) {
                            maxResolution = mapResolutions[0];
                        }
                        properties.maxResolution = maxResolution;
                        properties.minZoom = mapResolutions.indexOf(maxResolution);
                    }
                };

                /**
                 * init events when map is ready - set alt text and handle popup events
                 * @return none
                 */
                base._onWhenReady = function() {
                    //console.log('i\'m ready!!!!');
                    if (base.options.listenToEvents) {
                        this.on('popupopen', base._handlePopupOpen);
                        this.on('popupclose', base._handlePopupClose);
                    }
                    if (options.addAltText){
                        base._setAltText();
                    }
                };

                /**
                 * detect mouseclicks other then markers
                 * @param  {event} e passed map event
                 */
                base._onMapClick = function(e) {
                    console.log('You clicked the map at ' + e.latlng + ', layerpoint: ' + e.layerPoint + ', containerpoint: ' + e.containerPoint);
                };

                /**
                 * detect map focussing
                 * @param  {event} e passed map event
                 */
                base._onMapFocus = function() {
                    //console.log('focus map');
                    base.$el.addClass('focus');
                };

                /**
                 * detect map focussing
                 * @param  {event} e passed map event
                 */
                base._onMapBlur = function() {
                    //console.log('blur map');
                    base.$el.removeClass('focus');
                };

                /**
                 * Create the leaflet map
                 * @return {map} initialised map with empty tileLayer
                 */
                base._createMap = function() {

                    try {
                            var projection = base.options.map.projection; //base.options.contextCollection.find('projection').text();
                            var maxExtent = base.options.map.maxExtent; //base.options.contextCollection.find('maxExtent').text().split(',');
                            // for modern browsers var resolutions = base.options.contextCollection.find('resolutions').text().split(',').map(Number);
                            var resolutions = base.options.map.resolutions;
                            
                            
                            var RD = new L.Proj.CRS.TMS(
                                        projection,
                                        base.options.PROJ4Projection,
                                        maxExtent,
                                        {resolutions: resolutions}
                                    );

                            var map = new L.Map('map', {
                                continuousWorld: true,
                                crs: RD,
                              // layers: [
                              //   new L.TileLayer('http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png', {
                              //       tms: true,
                              //       minZoom: 2,
                              //       maxZoom: 13,
                              //       attribution: 'Kaartgegevens: © <a href="http://www.cbs.nl">CBS</a>, <a href="http://www.kadaster.nl">Kadaster</a>, <a href="http://openstreetmap.org">OpenStreetMap</a><span class="printhide">-auteurs (<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>).</span>',
                              //       continuousWorld: true
                              //   })
                              // ],
                                center: new L.LatLng(52, 5.3),
                                zoom: 2
                            });

                            // map.addLayer(new L.Proj.TileLayer.TMS('http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png', RD, {
                            //     maxZoom: 17,
                            //     minZoom: 0,
                            //     continuousWorld: true,
                            //     attribution: '(c) CC-BY Kadaster'
                            // }));

                            return map;

                        } catch (e) {
                            return false;
                        }

                    // var map = L.map(base.el.id, {
                    //     zoom: base.startZoom,
                    //     dragging: base.options.dragging,
                    //     zoomControl: base.options.zoomControl,
                    //     scrollWheelZoom: base.options.scrollWheelZoom,
                    //     doubleClickZoom: base.options.doubleClickZoom,
                    //     boxZoom: base.options.boxZoom,
                    //     touchZoom: base.options.touchZoom,
                    //     keyboard: base.options.keyboardInteraction,
                    //     trackResize: base.options.trackResize
                    // });

                    // L.tileLayer(base.tileProviderUrlTemplate, {
                    //     attribution: base.attribution,
                    //     maxZoom: base.maxZoom,
                    //     minZoom: base.minZoom,
                    //     detectRetina: true
                    // }).addTo(map);

                    // // add scale to map
                    // L.control.scale({
                    //     imperial: false,
                    //     position:'topright'
                    // }).addTo(map);

                    // //if(base.options.zoomControl){
                    // //var zoomControl     = new L.Control.Zoom({ position: 'topright'} ); // default topleft
                    // //var scaleControl    = new L.Control.Scale({ position: 'bottomleft' });
                    // //zoomControl.addTo(map);
                    // //scaleControl.addTo(map);
                    // //}
                    // return map;
                };


                /**
                * Api Interface addLayers to add layers the map, based on their layerkey-names Eg: 'BRT,TOP10NL2,CBS_PROVINCIES'
                * @param {array} An javascript array of layer names
                */
                base._addLayers = function(arrLayerNames){
                    for(var i=0,y=arrLayerNames.length;i<y;i++){
                        var layeroptions = arrLayerNames[i];


                        switch(layeroptions.config.layerType){
                        case 'tmsLayer' :
                            base._addTMS(layeroptions);
                            break;
                        case 'wmsLayer' :
                            base._addWMS(layeroptions);
                            break;
                        case 'imageLayer':
                            base._addImageOverlay(layeroptions);
                            break;
                        }
                    }
                };

                base._addLayerControls  = function(){
                    var backgroundMaps = {};
                    var overlayMaps = {};
                    var i = 0; // get title from base.options.map.layers
                    for (var lay in base.map._layers){
                        var layer = base.map._layers[lay];
                        if(layer.options.baselayer){
                            backgroundMaps[base.options.layers[i].title] = layer;
                        }
                        else {
                            overlayMaps[base.options.layers[i].title] = layer;
                        }
                        i+=1;
                    }
                    L.control.layers(backgroundMaps, overlayMaps).addTo(base.map);
                };

                /**
                 * Api method to set the current position and zoom level
                 * @param {float} lat   latitude
                 * @param {float} lng   longitude
                 * @param {int} zoom    zoom level
                 */
                base._setView = function(latitude,longitude,zoom){
                    this.map.setView(new L.LatLng(latitude,longitude),zoom);
                };


                /**
                 * Add Tile map service on the map - TMS delivers tiles
                 */
                base._addTMS = function(layerOptions){
                    // basic L.tileLayer('http://{s}.somedomain.com/{foo}/{z}/{x}/{y}.png', {foo: 'bar'});
                    this.map.addLayer(new L.TileLayer(layerOptions.url, layerOptions.config));
                };

                /**
                 *  add Web Map Service layers on the map - WMS delivers one image per request
                 */
                base._addWMS = function(layerOptions){
                    this.map.addLayer(new L.TileLayer.WMS(layerOptions.url, layerOptions.config));
                };

                /**
                 * This function puts the flood layer on the map.
                 */
                base._addImageOverlay = function (layerOptions) {
                   var map_object = {
                        img_url: 'views/media/water_levels.png',
                        img_bounds: new L.LatLngBounds(
                            new L.LatLng(50.343832, 2.511731),
                            new L.LatLng(53.876508, 7.751853)
                        )
                    },
                    img_obj = { opacity: 0.5 };
                    
                    this.map.addLayer(new L.ImageOverlay(map_object.img_url, map_object.img_bounds, img_obj));
                    //this.map.fitBounds(map_object.img_bounds);
                    //return new L.ImageOverlay(map_object.img_url, map_object.img_bounds, img_obj).addTo(base.map);
                };


                /**
                 * set the markers on the map layer and zoom the map based on number of markers
                 * @param  {[type]} markers pass base.markerdata.markers
                 * @return none
                 */
                base._addMarkers = function(markers, map) {
                    
                    // {latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'}
                    base.markers = [];
                    base.bounds = [];
                    
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
                        base.markers.push(lmrk);
                        base.bounds.push(mrk.latlng);
                        base.markers[index].bindPopup(mrk.popuptext,popupOptions);
                    });

                    //console.log(base.bounds);
                    var latlngBounds = new L.latLngBounds(base.bounds);

                    this.map.fitBounds(latlngBounds, {
                        padding: new L.point(16, 16)
                    });

                    //zoom map to certain level 
                    //multiple points base.startZoom or based on fit points
                    //single point base.startZoom or marker zoom or default
                    if(parseInt(base.options.map.startZoom,10)>-1){
                        base.setZoomLevel(base.startZoom);
                    } else if (markers.length === 1) {
                        base.setZoomLevel(markers[0].zoom || base.options.startZoom);
                    }
                };

                /**
                 * handle events when popup is opened
                 * @return none
                 */
                base._handlePopupOpen = function(e) {
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
                base._handlePopupClose = function() {
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
                    add alt attribute on only the first image in the map for accesibility validation
                   ----------------------------------*/
                base._setAltText = function(){
                    base.$el.find('img:not([alt])').attr('alt', '').first().attr('alt', this.altText);
                };

                /**
                 * This function clears map from any attached markers.
                 */
                base._clearMap = function() {
                    $.each(this.map.markers, function (key, marker) {
                        this.map.removeLayer(marker);
                    });
                };

                /**
                 * Api method to set the current zoom level of this Api map
                 * 
                 * @param {integer} zoomlevel the zoomlevel (0 is full map, 14 is fully zoomed in)
                 */
                base._setZoomLevel = function(zoomlevel) {
                    this.map.zoomTo(zoomlevel);
                    return true;
                };

                /**
                 * detect map focussing
                 * @param  {event} e passed map event
                 */
                base._onMapFocus = function() {
                    $el.addClass('focus');
                };

                /**
                 * detect map focussing
                 * @param  {event} e passed map event
                 */
                base._onMapBlur =  function() {
                    base.$el.removeClass('focus');
                };

                /**
                 * handle events when popup is opened
                 * @return none
                 */
                base._handlePopupOpen = function(e) {
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

                base._onInitialized = function(event, $el) {
                    // callback and triggering
                    base.$el.trigger("initialized");

                    if(base.options.onInitialized){
                        base.options.onInitialized.call($el);
                    }
                    console.log(base);
                };

                // Run initializer
                base.init();
            };

            return $el.each(function(index, el) {
                (new $.MapController(el, defaultOptions));
            });
        }
    };

    patterns.register(mapLeaflet);
    return mapLeaflet;
}));
