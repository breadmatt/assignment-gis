const pg = require("pg");

const connectionString = 'postgres://postgres:postgres@localhost:5432/pdt';

const client = new  pg.Client(connectionString);
client.connect();

module.exports = client;