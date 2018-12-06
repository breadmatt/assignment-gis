var express = require('express');
var router = express.Router();
var db = require('../public/javascripts/db');
var toGeoJSON = require('../public/javascripts/postgistogeojson.js');

router.use(
    function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next()
    }
);

router.get('/getAllAirports', function (req, res, next) {
    console.log("query on gis db");

    const myQuery = `
        SELECT sub.name AS title,ST_AsGeoJSON(ST_Transform(sub.way, 4326)) AS geojson, ST_Area(ST_Transform(way,4326)::geography) as area 
        FROM (select * from planet_osm_polygon as p where p.aeroway like 'aerodrome' and (LOWER(p.name) like '%airport%' or LOWER(p.name) like '%airfield%')) as sub;`;

    db.query(myQuery, function (err, result) {
        var geoJSON = toGeoJSON(result.rows); 
        console.log("geoJSON:" + JSON.stringify(geoJSON));
        res.json(geoJSON);
    });
});

router.get('/getPercentiles', function (req, res, next) {
    const queryString = `
        select 
        percentile_cont(0.15) within group(order by sub.area asc) as first,
        percentile_cont(0.30) within group(order by sub.area asc) as second,
        percentile_cont(0.45) within group(order by sub.area asc) as third,
        percentile_cont(0.60) within group(order by sub.area asc) as fourth,
        percentile_cont(0.75) within group(order by sub.area asc) as fifth,
        percentile_cont(0.90) within group(order by sub.area asc) as sixth 
        from 
        (select ST_Area(ST_Transform(way,4326)::geography) as area from planet_osm_polygon where aeroway='aerodrome' and (LOWER(name) like '%airfield%' or LOWER(name) like '%airport%') order by area asc) as sub`;

    db.query(queryString, function (err, result) {
        res.json(Object.values(result.rows[0]));
    });
});

router.get('/getAllHelipads', function (req, res, next) {

    const polygonQuery = "SELECT sub.name AS title,ST_AsGeoJSON(ST_Transform(sub.way, 4326)) AS geojson " +
        "FROM (select * from planet_osm_polygon as p where p.aeroway like 'helipad' and p.name is not null) as sub;";

    db.query(polygonQuery, function (err, result) {
        var geoJSON = toGeoJSON(result.rows);
        console.log("geoJSON:" + JSON.stringify(geoJSON));
        res.json(geoJSON);
    });
});

router.get('/getAirport', function (req, res, next) {
    let searchName = decodeURI(req.query.name);

    const searchQuery = `
        SELECT sub.name AS title,ST_AsGeoJSON(ST_Transform(sub.way, 4326)) AS geojson, ST_Area(ST_Transform(way,4326)::geography) as area 
        FROM (select * from planet_osm_polygon as p where p.aeroway like 'aerodrome' and LOWER(p.name) like LOWER('%${searchName}%')) as sub;`;

    db.query(searchQuery, function (err, result) {

        var geoJSON = toGeoJSON(result.rows); 
        console.log("geoJSON:" + JSON.stringify(geoJSON));
        res.json(geoJSON);
    });

});

router.get('/getNearestFoodDrink', function(req, res, next){
    console.log("food query request");
    let lon = decodeURI(req.query.lon);
    let lat = decodeURI(req.query.lat);
    const searchQuery = `
        SELECT ST_DistanceSphere(ST_GeomFromText('POINT(${lon} ${lat})', 4326), ST_Transform(way,4326)) as dist, 
        name, amenity, ST_AsGeoJSON(ST_Transform(way, 4326)) as geojson from planet_osm_point 
        where (amenity='restaurant' or amenity='cafe' or amenity='bar' or amenity='fast_food' or amenity='food_court') and name is not null
        and ST_DistanceSphere(ST_GeomFromText('POINT(${lon} ${lat})', 4326), ST_Transform(way,4326)) < 5000
        order by dist limit 20;
    `;

    db.query(searchQuery, function (err, result) {

        var geoJSON = toGeoJSON(result.rows); 
        console.log("geoJSON:" + JSON.stringify(geoJSON));
        res.json(geoJSON);
    });
})

router.get('/getPointsForWeather', function (req, res, next) {
    var sourceId = req.query.sourceId;
    var destinationId = req.query.destinationId;
    var segmentLineQuery = `
        WITH sub1 AS (SELECT name, way FROM planet_osm_polygon WHERE osm_id = ${sourceId} ),
        sub2 AS(SELECT name, way as way FROM planet_osm_polygon WHERE osm_id = ${destinationId}) 															
        SELECT ST_AsGeoJSON(ST_Segmentize(ST_MakeLine(ST_Transform(ST_Centroid(sub1.way), 4326), ST_Transform(ST_Centroid(sub2.way), 4326))::geography,100000)) as geojson, 
        ST_AsGeoJSON(ST_Transform(sub1.way, 4326)) as srcgj, sub1.name as name1, ST_AsGeoJSON(ST_Transform(sub2.way, 4326)) as destgj, sub2.name as name2 
        from sub1,sub2;
    `;
    db.query(segmentLineQuery, async function (err, result) {
        var segments = toGeoJSON([{geojson: result.rows[0].geojson}]);
        var sourceAirport = toGeoJSON([{geojson: result.rows[0].srcgj, title: result.rows[0].name1}]);
        var destinationAirport = toGeoJSON([{geojson: result.rows[0].destgj, title: result.rows[0].name2}]);

        var lines = segments.features[0].geometry.coordinates;
        var promises = [];

        for (var i = 0; i < lines.length - 1; i++) {
            var interpolationQuery = `
                SELECT ST_AsGeoJSON(ST_Line_Interpolate_Point(ST_GeomFromText('LINESTRING(${lines[i][0]} ${lines[i][1]},${lines[i + 1][0]} ${lines[i + 1][1]})'),0.5)) as geojson;
            `;
            promises.push(getInterpolatedPoint(interpolationQuery));
        }

        Promise.all(promises)
            .then((results) => {
                res.json({interpols: results, sourceAirport: sourceAirport, destinationAirport: destinationAirport});
            });
    });
});

function getInterpolatedPoint(query) {
    return new Promise((resolve) => {
        setTimeout(() => {
            db.query(query, function (err, result2) {
                var geojson2 = toGeoJSON(result2.rows);
                resolve(geojson2.features[0].geometry.coordinates);
            })

        }, Math.floor(Math.random() * 1000));
    });
}

router.get('/getAirportsByNameInterval', function (req, res, next) {

    var interval = req.query.interval;
    var myQuery = "(select osm_id, name from planet_osm_polygon as point where point.aeroway='aerodrome' and (";
    for (var i = 0; i < interval.length; i++) {
        myQuery += "LOWER(LEFT(name, 1)) = '" + interval.charAt(i) + "' ";
        if (i + 1 != interval.length) {
            myQuery += "or ";
        }
    }
    myQuery += ")) as sub";
    myQuery = "select * from " + myQuery + " where (LOWER(sub.name) like '%airport%' or LOWER(sub.name) like '%airfield%')";
    db.query(myQuery, function (err, result) {
        res.json(result.rows);
    });
});

router.get('/getAirplaneNames', function (req, res, next) {

    var myQuery = "SELECT id, name FROM airplanes"
    db.query(myQuery, function (err, result) {
        res.json(result.rows);
    });
});

router.get('/getAirplaneById', function (req, res, next) {
    var id = req.query.id;
    var myQuery = `SELECT * FROM airplanes WHERE id=${id}`;
    db.query(myQuery, function (err, result) {
        res.json(result.rows);
    });
});

router.get('/rangeQuery', function (req, res, next) {
    console.log("query on gis db");
    var sourceId = req.query.sourceId;
    var destinationId = req.query.destinationId;
    var maxDistance = Number(req.query.maxDistance);
    console.log(maxDistance)
    var myQuery = `
        WITH sub1 AS (SELECT name, way FROM planet_osm_polygon WHERE osm_id = ${sourceId} ),
        sub2 AS(SELECT name, way as way FROM planet_osm_polygon WHERE osm_id = ${destinationId}) 
        select ST_Distance_Sphere(ST_Transform(ST_Centroid(sub1.way), 4326), ST_Transform(ST_Centroid(sub2.way), 4326)) / 1000 as disKm, 
        sub1.name AS name1, 
        ST_AsGeoJSON(ST_Transform(sub1.way, 4326)) as poly1, 
        sub2.name AS name2, 
        ST_AsGeoJSON(ST_Transform(sub2.way, 4326)) as poly2 
        from sub1, sub2;`;

    db.query(myQuery, function (err, result) {
        var airport1 = [{ geojson: result.rows[0].poly1, title: result.rows[0].name1 }];
        var airport2 = [{ geojson: result.rows[0].poly2, title: result.rows[0].name2 }];
        var geoJSON1 = toGeoJSON(airport1);
        var geoJSON2 = toGeoJSON(airport2);
        var dist = result.rows[0].diskm;
        var resultObject;

        if (dist > maxDistance) {
            var interpolationQuery = `
                WITH sub1 AS (SELECT name, way FROM planet_osm_polygon WHERE osm_id = ${sourceId} ), 
                sub2 AS(SELECT name, way as way FROM planet_osm_polygon WHERE osm_id = ${destinationId}) 
                select	ST_AsGeoJSON(ST_Line_Interpolate_Point(ST_MakeLine(ST_Transform(ST_Centroid(sub1.way), 4326), ST_Transform(ST_Centroid(sub2.way), 4326)), ${maxDistance / dist})) as interpolation 
                from sub1,sub2;`;

            db.query(interpolationQuery, function (err, result2) {
                var interGeoJSON = toGeoJSON([{ geojson: result2.rows[0].interpolation, title: "" }]);
                resultObject = { dist: dist, geoJSON1: geoJSON1, geoJSON2: geoJSON2, interGeoJSON: interGeoJSON }
                res.json(resultObject);
            })
        }
        else {
            resultObject = { dist: dist, geoJSON1: geoJSON1, geoJSON2: geoJSON2 }
            res.json(resultObject);
        }

    });
});

module.exports = router;
