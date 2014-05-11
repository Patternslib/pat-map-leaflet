// jshint indent: 4, browser: true, jquery: true, quotmark: false, camelcase: false, eqnull:true, strict:false
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
// add #debug or #currentlocation to the url to test location


(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery','pat-registry','pat-parser','leaflet', 'proj4', 'proj4leaflet'], function ($, patterns, Parser,L , proj4, LProj4) {
            return factory($, patterns, Parser, L, proj4, LProj4);
        });
    } else {
        factory(root.jQuery, root.patterns, root.patterns.Parser, root.L,root.proj4,root.L.Proj);
    }
}(this, function($, patterns, Parser, L) {

    var parser = new Parser('leaflet');

    parser.add_argument('config');
    parser.add_argument('layerNames');
    parser.add_argument('location');

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

        init: function($el) {
            
            var defaultOptions = {
                debug: (window.location.hash.indexOf('debug') > -1),
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
                doubleclick:true,
                touchZoom: true,
                keyboardInteraction: true,
                trackResize: true,
                altText:'Kaart van Nederland',
                hasLayerToggle: true,
                currentLocation: (window.location.hash.indexOf('currentlocation') > -1),
                hasLayerControl: true,
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
                    base.options = $.extend(options,parser.parse(base.$el)); //parser.parse(base.$el, options);
                    base.options.id = base.el.id;
                     // define the layers to show
                    base.layers = [];
                     // defined map object
                    base.map = null;

                    // collect the data from dom tree
                    base.markerdata = base._getMarkerData(base.dataMarkers);

                     // get config file with layer information
                    base.configfile = base.options.config || 'lib/defaultlayers.xml';

                    // get the layer information to display and create the map and markers
                    $.ajax({ type: 'GET', url: base.configfile, dataType: 'xml'})
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
                                    // add the layers on the map
                                    base._addLayers(base.options.layers);
                                    
                                    // set layer control for all layers
                                    if(base.options.hasLayerControl){
                                        base._addLayerControls();
                                    }

                                    // add markers
                                    if(base.markerdata){
                                        base._addMarkers(base.markerdata.markers);
                                    }

                                    if(base.options.location ==='current'){
                                        base._setCurrentLocation();
                                    }
                                   
                                    base.map.whenReady(base._onWhenReady);

                                    // add click handler
                                    if(base.options.debug){
                                        base.map.on('click', base._onMapClick);
                                    }

                                    if(base.options.doubleclick){
                                        base.map.on('doubleClickZoom', function(){base._setZoomLevel(Math.max(base.map.getZoom()+1,base.max.getMaxZoom()));});
                                    }

                                    // add focus and blur handlers
                                    base.map.on('focus', base._onMapFocus, base);
                                    base.map.on('blur', base._onMapBlur, base);
                                
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
                    
                        $datatable =  $('.maplocation',base.$el);

                        if($datatable.length === 0) {return;}
                        
                        // look in what structure the children are organised
                        var dataType = $datatable[0].tagName;
                       
                        // hide visually of the children
                        $datatable.addClass('assistive');

                        // add data to markers array
                        var addDataMarkers = function($el,title,popuptext){
                            var loc = $el.data('location').split(',') ||  base.center;
                            var zoom = parseInt($el.data('zoom'),10) || base.zoom;

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
                                var title = $this.find('.title').html() || $this.find('th').html();
                                var popuptext = $this.find('td').html();
                                addDataMarkers($this,title,popuptext);
                            });
                            break;
                        case 'UL':
                            $datatable.find('li').each(function() {
                                var $this = $(this);
                                var title = $this.find('.title').html() || $this.find('a').html() || $this.html();
                                var popuptext = $this.html();
                                addDataMarkers($this,title,popuptext);
                            });
                            break;
                        case 'DIV':
                            // input is selector element with div's
                            $datatable.each(function() {
                                var $this = $(this);
                                var title = $this.find('.title').html() || $this.find('h2').html() || $this.find('h3').html() || $this.find('h4').html() || $this.find('a').html() || $this.html();
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
                                $('title',xml).filter(function() {
                                    return $(this).text() === layerName;
                                }).parent()
                            );
                        });

                        // get only the nodes with the correct title
                        // * eg: for a WMTS the layernames is defined in a 'layer' property
                        // * while for a WMS it is called 'layers' (mind the s on the end)
                        // * example one square of img: http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart@EPSG:28992@png/2/2/2.png

                        for (var i=0,j = nodes.length ; i < j; i++) {
                            var node = nodes[i];
                            
                            // Generic
                            var title = this.getTextContent('title', node);
                            var url = this.getLayerUrlContent('url', node);
                            var isBaseLayer = this.getBooleanContent('isBaseLayer', node);
                            var isVisible = this.getBooleanContent('isVisible', node);
                            var isSingleTile=this.getBooleanContent('isSingleTile', node);
                            var layerType = node[0].nodeName;
                            var opacity = this.getNumberContent('opacity', node);
                            var alpha = this.getBooleanContent('isAlpha', node);
                            var transparent = this.getBooleanContent('isTransparent', node);
                            var layerToggle = this.getBooleanContent('layerToggle', node);
                            var layerControl = this.getBooleanContent('layerControl', node);
                            var isOverlay = this.getBooleanContent('isOverlay', node);
                           
                            var config = {
                                    layerType:layerType,
                                    baselayer:isBaseLayer,
                                    singleTile:isSingleTile,
                                    transparent:transparent,
                                    opacity:opacity,
                                    visibility:isVisible,
                                    continuousWorld:true,
                                    alpha:alpha
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
                            var layer = {title:title,url:url,layerToggle:layerToggle,layerControl:layerControl,isOverlay:isOverlay,config:config};
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
                            var resolutions = base.options.map.resolutions;
                            // base._setPosition(base.options.location.split(','));
                            var center = new L.LatLng(52, 5.3); // center of dutch map default
                            var zoom = base.options.map.zoom || 2;
                            var crs = L.CRS.EPSG3857; // default for leaflet most used in online maps
                            var loc;

                            // get Coordinate Reference System to use
                            switch (projection) {
                            case 'EPSG:28992':
                                crs = new L.Proj.CRS.TMS(
                                    projection,
                                    base.options.PROJ4Projection,
                                    maxExtent,
                                    {resolutions: resolutions}
                                );
                                break;
                            case 'simple':
                                crs = L.CRS.Simple;
                                break;
                            case 'EPSG4326':
                                crs = L.CRS.EPSG4326;
                                break;
                            }

                            // var RD = new L.Proj.CRS.TMS(
                            //             projection,
                            //             base.options.PROJ4Projection,
                            //             maxExtent,
                            //             {resolutions: resolutions}
                            //         );

                            //pass location by current, or by coordinates in de options or in the config file
                            // if(base.options.location === 'current'){
                            //     loc = base._getCurrentLocation();
                            //     if (loc){
                            //         center = new L.LatLng(loc[0], loc[1]);
                            //     }
                            // } else 

                            if (base.options.location && base.options.location.split(',').length === 2){
                                loc = base.options.location.split(',');
                            } else if (base.options.map.center && base.options.map.center.length === 2){
                                loc = base.options.map.center;
                            }
                            center = new L.LatLng(loc[0], loc[1]);

                            var map = new L.Map('map', {
                                continuousWorld: true,
                                crs: crs,
                                center: center,
                                zoom: zoom
                            });
                            return map;

                        } catch (e) {
                            return false;
                        }
                };

                /**
                * Api Interface addLayers to add layers the map, based on their layerkey-names Eg: 'BRT,TOP10NL2,CBS_PROVINCIES'
                * @param {array} An javascript array of layer names
                */
                base._addLayers = function(arrLayerNames){
                    for(var i=0,y=arrLayerNames.length;i<y;i++){
                        var layeroptions = arrLayerNames[i];
                        var layer;

                        switch(layeroptions.config.layerType){
                        case 'wmsLayer' :
                            layer = base._addWMS(layeroptions);
                            break;
                        case 'imageLayer':
                            layer = base._addImageOverlay(layeroptions);
                            break;
                        default:
                            layer = base._addLayer(layeroptions);
                            break;
                        }
                        //layer.setZIndex(i);
                    }
                };

                /**
                 * display layer controls on the map
                 * setting zindex TODO topLayer.setZIndex(7) or use bringToFront or bringToBack
                 * The overlay layers will be drawn default on top of the base layers.
                 * The autoZIndex option, which is by default On, specifies that the control must assign z indices to each 
                 * of its layers in the order in which they are added, and that means they'll be drawn in that order.
                 * or use addLayer( <ILayer> layer, <Boolean> insertAtTheBottom? ) when adding layer
                 */
                base._addLayerControls  = function(){
                    var backgroundMaps,overlayMaps,layergroup;
                    var baselayercontrol = 0;

                    for (var i=0,j=base.layers.length;i<j;i++){
                        var layer = base.layers[i].layer;
                        var title = base.layers[i].title;
                        // check if layer must be included in layer controller
                        if(base.layers[i].layerControl){
                            if(layer.options.baselayer){
                                baselayercontrol+=1;
                                if(!backgroundMaps){
                                    backgroundMaps={};
                                }
                                layergroup = backgroundMaps;
                            }
                            else {
                                if(!overlayMaps){
                                    overlayMaps={};
                                }
                                layergroup = overlayMaps || {};
                            }

                            layergroup[title] = layer;
                            // zindex
                            // if(!layer.options.isOverlay){
                            //     layer.bringToBack();
                            // }
                        }
                    }
                   
                    if(baselayercontrol>1 || overlayMaps ){
                        // only show base layer radio buttons control if there is something to control
                        if(baselayercontrol === 1 ){
                            backgroundMaps = null;
                        }
                        L.control.layers(backgroundMaps, overlayMaps,{position: 'bottomleft'}).addTo(base.map);
                    }
                };

                /**
                 * Add an external toggle other then default layer controls for switching layers on and off
                 * @param {L.layer} lay layer to switch
                 */
                base._addLayerToggle =  function(layer, name){

                    var $ui = $('ul.ui-control',base.$el);
                    if($ui){
                        // Create a simple layer switcher that toggles layers on and off.
                        //var item = document.createElement('li');
                        //var link = document.createElement('a');
                        var $listItem = $('<li></li>');
                        var $link = $('<a class="active" tabindex="0">'+name+'</a>');
                        $link.on('click',function(e) {
                            e.preventDefault();

                            if (base.map.hasLayer(layer)) {
                                base.map.removeLayer(layer);
                                this.className = '';
                            } else {
                                base.map.addLayer(layer);
                                this.className = 'active';
                            }
                        });
                        $ui.append($listItem.append($link));
                    }
                };

                // base.showLayer= function(layername){
                //      map.getPane(layername).style.display = 'none';

                // }
                // base.hideLayer = function(layer){
                //      map.getPane(layername).style.display = '';
                // }


                /**
                 * Api method to set the current position and zoom level
                 * @param {float} lat   latitude
                 * @param {float} lng   longitude
                 * @param {int} zoom    zoom level
                 */
                base._setView = function(latitude,longitude,zoom){
                    var loc = new L.LatLng(latitude,longitude);
                    base.map.setView(loc,zoom);
                };

                base.getBounds = function(){
                    var bounds = base.map.getBounds();
                        //southWest = bounds.getSouthWest(),
                        //northEast = bounds.getNorthEast(),
                        //lngSpan = northEast.lng - southWest.lng,
                        //latSpan = northEast.lat - southWest.lat;
                    return bounds;
                };

                base._setLayer = function(layer,layerOptions){
                    var obj = {};
                    obj.layer = layer;
                    obj.title = layerOptions.title;
                    obj.layerControl = layerOptions.layerControl;
                    base.layers.push(obj);
                    return obj;
                };

                /**
                 * Add Tile map service on the map - TMS delivers tiles
                 */
                base._addLayer = function(layerOptions){
                    //base.map.addLayer(new L.TileLayer(layerOptions.url, layerOptions.config));

                    //create layer
                    var LLayer = new L.TileLayer(layerOptions.url, layerOptions.config);
                    base._setLayer(LLayer,layerOptions);
                    
                    // only add isVisible layer the rest in under the controls
                    if(layerOptions.config.visibility){
                        base.map.addLayer(LLayer);
                    }

                };

                /**
                 *  add Web Map Service layers on the map - WMS delivers one image per request
                 */
                base._addWMS = function(layerOptions){
                    var LLayer = new L.TileLayer.WMS(layerOptions.url, layerOptions.config);
                    base._setLayer(LLayer,layerOptions);

                    //if(layerOptions.config.visibility){
                    base.map.addLayer(LLayer);
                    //}

                    if(base.options.hasLayerToggle && layerOptions.layerToggle){
                        base._addLayerToggle(LLayer,layerOptions.title);
                    }
                };

                /**
                 * This function puts the flood layer on the map.
                 */
                base._addImageOverlay = function (layerOptions) {
                    //console.log(base.getBounds());

                    // example
                    var map_object = {
                        img_url: 'views/media/water_levels.png',
                        img_bounds: new L.LatLngBounds(
                            new L.LatLng(50.343832, 2.28),
                            new L.LatLng(53.876508, 7.751853)
                        )
                    },
                    img_obj = { opacity: 0.5 };
                    
                    var layer = new L.ImageOverlay(map_object.img_url, map_object.img_bounds, img_obj);
                    this.map.addLayer(layer);
                    //this.map.fitBounds(map_object.img_bounds);
                    //return new L.ImageOverlay(map_object.img_url, map_object.img_bounds, img_obj).addTo(base.map);
                    
                    if(base.options.hasLayerToggle && layerOptions.layerToggle){
                        base._addLayerToggle(layer,layerOptions.title);
                    }

                };

                /**
                 * detect map focussing
                 * @param  {array} point array with lat and long
                 */
                base._setPosition = function(latlong) {
                    base.map.center(latlong);
                };


                // /**
                //  * zoom into location of client
                //  */
                // base._setCurrentLocation = function (){
                //     var loc =  base._getCurrentLocation();
                //     if (loc){
                //         L.marker(loc).addTo(base.map);
                //         base._setView(loc[0],loc[1],10);
                //     }
                // };
                /**
                 * set the current location of the user by the geolocation object
                 * @return {[array]} location in lat, lon coordinates
                 */
                base._setCurrentLocation = function (){
                    function showLocation(position){
                        var lat = position.coords.latitude;
                        var lon = position.coords.longitude;
                        console.log(lat +','+ lon);
                        
                        L.marker([lat, lon]).addTo(base.map);
                        base._setView(lat,lon,10);

                        return [lat,lon];
                    }
                    function errorHandler(err) {
                        if(err.code === 1) {
                            console.log('Error: Access is denied!');
                        } else if( err.code === 2) {
                            console.log('Error: Position is unavailable!');
                        }
                        return false;
                    }
                    if(navigator.geolocation){
                        // timeout at 60000 milliseconds (60 seconds)
                        //var options = {timeout:60000};
                        navigator.geolocation.getCurrentPosition(showLocation, errorHandler);
                    }
                };

                /**
                 * set the markers on the map layer and zoom the map based on number of markers
                 * @param  {[type]} markers pass base.markerdata.markers
                 * @return none
                 */
                base._addMarkers = function(markers) {
                    
                    // {latlng:[lat,lng],title:'markertitle',popuptext:'Interdum et malesuada fames ac ante ipsum'}
                    base.markers = [];
                    base.bounds = [];
                    
                    // between 200 and 300 maximum width of map 2*19 is margin in popup + 14px side space
                    var popupOptions = {
                        minWidth: Math.min(base.map._container.offsetWidth, 200) ,
                        maxWidth: Math.min(base.map._container.offsetWidth-53, 300)
                    };

                    $.each(markers, function(index, mrk) {
                        var title = mrk.title.replace(/(<([^>]+)>)/ig, '').replace(/^\s+|\s+$/g, '');// strip tags and trailing leading whitespace
                        var lmrk = L.marker(mrk.latlng, {
                            title: title
                        }).addTo(base.map);
                        base.markers.push(lmrk);
                        base.bounds.push(mrk.latlng);
                        base.markers[index].bindPopup(mrk.popuptext,popupOptions);
                    });
                    var latlngBounds = new L.latLngBounds(base.bounds);

                    base.map.fitBounds(latlngBounds, {
                        padding: new L.point(16, 16)
                    });

                    //zoom map to certain level 
                    //multiple points base.startZoom or based on fit points
                    //single point base.startZoom or marker zoom or default
                    if(parseInt(base.options.map.startZoom,10)>-1){
                        base._setZoomLevel(base.startZoom);
                    } else if (markers.length === 1) {
                        base._setZoomLevel(markers[0].zoom || base.options.startZoom);
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
                    $.each(base.map.markers, function (key, marker) {
                        base.map.removeLayer(marker);
                    });
                };

                /**
                 * Api method to set the current zoom level of this Api map
                 * 
                 * @param {integer} zoomlevel the zoomlevel (0 is full map, 14 is fully zoomed in)
                 */
                base._setZoomLevel = function(zoomlevel) {
                    base.map.setZoom(zoomlevel);
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
