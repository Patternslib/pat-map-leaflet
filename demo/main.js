/* global require, define */

        // for documentation
        //'pat-markdown':

        // for leaflet
        // 
require.config({

    paths: {

        jquery: '../src/bower_components/jquery/jquery',
        logging: '../src/bower_components/logging/src/logging',
        'jquery.form': '../src/bower_components/jquery-form/jquery.form',

        'pat-logger': '../src/core/logger',
        'pat-parser': '../src/core/parser',
        'pat-utils': '../src/core/utils',
        'pat-compat': '../src/core/compat',
        'pat-jquery-ext': '../src/core/jquery-ext',
        'pat-registry': '../src/core/registry',
        'pat-ajax': '../src/pat/ajax',

        'leaflet': 'lib/leaflet.min',
        'proj4': 'lib/proj4js-compressed',
        'proj4leaflet': 'lib/proj4leaflet',
        'pat-proj4leaflet': 'pat-map-leaflet',

        'markdown':'../src/pat/markdown',
        'pat-inject':'../src/pat/inject',
        'Markdown.Converter':'../src/legacy/Markdown.Converter',
        'Markdown.Sanitizer':'../src/legacy/Markdown.Sanitizer',
        'Markdown.Extra':'../src/legacy/Markdown.Extra',
        'pat-htmlparser':'../src/lib/htmlparser'

    },

    shim: {
        jquery: {
            exports: 'jQuery'
        }
    }

});

// define(['pat-registry', 'pat-ajax','pat-proj4leaflet','markdown'], function(registry, ajax, patproj4leaflet) {
   
//     console.log(registry.patterns);
//     registry.patterns.patleaflet.init();
// });

require(['pat-registry', 'pat-ajax','pat-proj4leaflet','markdown'], function(registry, ajax, patproj4leaflet) { 
    console.log(registry.patterns);
    registry.init();
    //registry.patterns.patleaflet.init();
});