# Leaflet

## Description

With the pat-mapleaflet plugin you can create a leaflet map based on structured html with a pat-map-leaflet attribute and as input an xml configuration file 

## Documentation

### Container
| Property | Default value | Values | Description | Type |
| ----- | --------| -------- | ------- | ----------- |
| `config`|  |  | Sets the path to the configuration xml | String |
| `layerNames` | | | List the titles of the layers to be displayed | string |
| `currentLocation` | | | Capture and set the current location | boolean |

### Child nodes
| Property | Default value | Values | Description | Type |
| ----- | --------| -------- | ------- | ----------- |
| `data-location`|  |  | lat , long values | csv |
| `data-zoom`|  |  | zoomlevel | integer between 1 and 13 |

Creating a map is very simple: Just add the `pat-map-leaflet` class to an
element and add the extra attributes do define the displayed layers.
If inside the container a child is included with the data-location attribute a marker will be displayed at that position and the content of that child will be displayed inside the popup for that marker.

### Without marker:
    
    <div id="map" class="pat-map-leaflet" data-pat-leaflet="config:lib/defaultlayers.xml; layerNames:BRT achtergrondkaart [tms],Maximale waterhoogte;"></div>

### With marker:

    <div id="map" class="pat-map-leaflet" data-pat-leaflet="config:data/layers.xml;layerNames:BRT achtergrondkaart [tms],Maximale waterhoogte;">
        <div class="maplocation" 
             data-location="51.948009,4.8437067" 
             data-zoom="5">
            <h3>2871GA Schoonhoven, Nederland</h3>
            <p>
                Overstromingsrisico: minder dan 1 meter.
            </p>
        </div>
    </div>

### Configuration xml 
    
    <?xml version="1.0"?>
    <contextCollection>
        <title>PDOK configuratie</title>
        <baseUrl>http://geodata.nationaalgeoregister.nl/</baseUrl>
        <projection>EPSG:28992</projection>
        <resolutions>3440.640,1720.320, 860.160, 430.080, 215.040, 107.520, 53.760, 26.880, 13.440, 6.720, 3.360, 1.680, 0.840, 0.420, 0.210, 0.105, 0.0525</resolutions>
        <maxExtent>-285401.920,22598.080,595401.920,903401.920</maxExtent>
        <center>52.15616055555555,5.38763888888889</center>
        <zoom>2</zoom>
        <context>
            <title>Achtergrond</title>
            <tmsLayer>
                <title>BRT achtergrondkaart [tms]</title>
                <url>{baseUrl}tms/</url>
                <isBaseLayer>true</isBaseLayer>
                <isVisible>true</isVisible>
                <opacity>1.0</opacity>
                <type>png</type>
                <maxResolution>1720.320</maxResolution>
                <minResolution>0.21</minResolution>
                <isSingleTile>false</isSingleTile>
                <layername>brtachtergrondkaart@EPSG:28992@png</layername>
                <attribution>(c) CC-BY Kadaster</attribution>
                <layerToggle>false</layerToggle>
                <layerControl>false</layerControl>
                <isAlpha>true</isAlpha>
                <isTransparent>true</isTransparent>
            </tmsLayer>
        </context>
        <contextFolder>
            <title>Overlay</title>
            <context>
                <title>WMS layers</title>
                <wmsLayer>
                    <title>Maximale waterhoogte</title>
                    <maxResolution>1720.320</maxResolution>
                    <url>http://urltothegeoserver/wms??</url>
                    <isBaseLayer>false</isBaseLayer>
                    <opacity>0.5</opacity>
                    <isTransparent>true</isTransparent>
                    <isVisible>true</isVisible>
                    <layers>waterdiepte</layers>
                    <format>image/png</format>
                    <featureInfoFormat>application/openlayers</featureInfoFormat>
                    <isAlpha>true</isAlpha>
                    <isSingleTile>true</isSingleTile>
                    <layerToggle>false</layerToggle>
                    <layerControl>true</layerControl>
                </wmsLayer>
                <wmsLayer>
                    <title>Treinstations</title>
                    <maxResolution>1720.320</maxResolution>
                    <url>http://urltothegeoserver/wms??</url>
                    <isBaseLayer>false</isBaseLayer>
                    <opacity>1.0</opacity>
                    <isTransparent>true</isTransparent>
                    <isVisible>true</isVisible>
                    <layers>treinstations</layers>
                    <format>image/png</format>
                    <featureInfoFormat>application/openlayers</featureInfoFormat>
                    <isAlpha>true</isAlpha>
                    <isSingleTile>true</isSingleTile>
                    <layerToggle>false</layerToggle>
                    <layerControl>true</layerControl>
                </wmsLayer>
            </context>
        </contextFolder>
    </contextCollection>