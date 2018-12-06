/*
 *   A function that converts a PostGIS query into a GeoJSON object.
 *   Copyright (C) 2012  Samuel Giles <sam@sam-giles.co.uk>
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.

 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

//modified by me by adding extra query properties in "properties"

/**
 * Takes an array of associative objects/arrays and outputs a FeatureCollection object.  See <http://www.geojson.org/geojson-spec.html> example 1.1/
 * The Query that fetched the data would need to be similar to:
 *              SELECT {field_list}, st_asgeojson(...) AS geojson FROM geotable
 * Where the "AS geojson" must be as is. Because the function relies on a "geojson" column.
 *
 * @param queryResult The query result from the PostGIS database.  Format deduced from <https://gist.github.com/2146017>
 * @returns The equivalent GeoJSON object representation.
 */
module.exports = function postGISQueryToFeatureCollection(queryResult) {
    // Initalise variables.
    var i = 0,
        length = queryResult.length,
        prop = null,
        geojson = {
            "type": "FeatureCollection",
            "features": []
        };    // Set up the initial GeoJSON object.

    for(i = 0; i < length; i++) {  // For each result create a feature
        var feature = {
            "type": "Feature",
            "properties":{},
            "geometry": JSON.parse(queryResult[i].geojson)
        };

        // finally for each property/extra field, add it to the feature as properties as defined in the GeoJSON spec.
        for(prop in queryResult[i]) {
            if (prop !== "geojson" && queryResult[i].hasOwnProperty(prop)) {
                feature.properties[prop] = queryResult[i][prop];
            }
        }
        // Push the feature into the features array in the geojson object.
        geojson.features.push(feature);
    }
    // return the FeatureCollection geojson object.
    return geojson;
}




