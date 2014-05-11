/* global require */

require.config({

    paths: {

        jquery: '../../src/bower_components/jquery/jquery',
        logging: '../../src/bower_components/logging/src/logging',
        'jquery.form': '../../src/bower_components/jquery-form/jquery.form',

        'pat-logger': '../../src/core/logger',
        'pat-parser': '../../src/core/parser',
        'pat-utils': '../../src/core/utils',
        'pat-compat': '../../src/core/compat',
        'pat-jquery-ext': '../../src/core/jquery-ext',
        'pat-registry': '../../src/core/registry',

        'leaflet': 'lib/leaflet.min',
        'proj4': 'lib/proj4js-compressed',
        'proj4leaflet': 'lib/proj4leaflet',
        'pat-proj4leaflet': 'pat-map-leaflet',

    },

    shim: {
        jquery: {
            exports: 'jQuery'
        }
    }

});

require(['pat-registry','pat-proj4leaflet'], function(registry) {
    registry.init();
});