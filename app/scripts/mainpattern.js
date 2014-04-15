// @codekit-prepend "vendor/leaflet/leaflet","vendor/proj4leaflet/lib/proj4-compressed","vendor/proj4leaflet/src/proj4leaflet"
// jshint indent: 4, browser: true, jquery: true, camelcase: false, eqnull:true
/* global  L, require */
// require.config({
//     paths: {
//         "jquery": "vendor/jquery/dist/jquery",
//         "proj4": "vendor/proj4leaflet/lib/proj4-compressed",
//         "proj4leaflet": "vendor/proj4leaflet/src/proj4leaflet",
//         "leaflet": "vendor/leaflet/leaflet"
//     }
// });
// require(["jquery", "proj4leaflet"], function($) {
    // GeoJSON layer (UTM15)
    //proj4.defs('EPSG:26915', '+proj=utm +zone=15 +ellps=GRS80 +datum=NAD83 +units=m +no_defs');

    // var crs = new L.Proj.CRS('EPSG:3006',
    //             '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    //             {
    //                 resolutions: [
    //                     8192, 4096, 2048, 1024, 512, 256, 128,
    //                     64, 32, 16, 8, 4, 2, 1, 0.5
    //                 ],
    //                 origin: [0, 0]
    //             }),

    // var RD = new L.Proj.CRS.TMS(
    //     'EPSG:28992',
    //     '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +no_defs', [-285401.92, 22598.08, 595401.9199999999, 903401.9199999999], {
    //         resolutions: [3440.640, 1720.320, 860.160, 430.080, 215.040, 107.520, 53.760, 26.880, 13.440, 6.720, 3.360, 1.680, 0.840, 0.420]
    //     });

    // var map = new L.Map('map', {
    //     continuousWorld: true,
    //     crs: RD,
    //     layers: [
    //         new L.TileLayer('http://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png', {
    //             tms: true,
    //             minZoom: 2,
    //             maxZoom: 13,
    //             attribution: 'Kaartgegevens: © <a href="http://www.cbs.nl">CBS</a>, <a href="http://www.kadaster.nl">Kadaster</a>, <a href="http://openstreetmap.org">OpenStreetMap</a><span class="printhide">-auteurs (<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>).</span>',
    //             continuousWorld: true
    //         })
    //     ],
    //     center: new L.LatLng(52, 5.3),
    //     zoom: 2
    // });

    // var geojson = {
    //     'type': 'Feature',
    //     'geometry': {
    //         'type': 'Point',
    //         'coordinates': [136076.4801040586, 465580.4804486522],
    //     },
    //     'properties': {
    //         'name': 'Utrecht'
    //     },
    //     'crs': {
    //         'type': 'name',
    //         'properties': {
    //             'name': 'urn:ogc:def:crs:EPSG::28992'
    //         }
    //     }
    // };

    // L.Proj.geoJson(geojson, {
    //     'pointToLayer': function(feature, latlng) {
    //         return L.marker(latlng).bindPopup(feature.properties.name);
    //     }
    // }).addTo(map);

    // // test RD coordinates
    // map.on('click', function(e) {
    //     if (window.console) {
    //         var point = RD.projection.project(e.latlng);
    //         console.log("RD X: " + point.x + ", Y: " + point.y);
    //     }
    // });
// });
