var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
const port = 3000;

var map = require('./routes/map');

var app = express();
app.use(express.static('../'));

app.use(bodyParser.json());
app.use('/map', map);

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
