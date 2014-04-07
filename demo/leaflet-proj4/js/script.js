define(["libs/proj4leaflet"], function (LProj){

    console.log(LProj)

    var controller = {
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
    }

    return controller;
});
