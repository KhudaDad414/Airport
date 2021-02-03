/**
 * Required External Modules
 */
const express = require('express');
const assert = require('assert');
const mongodb = require('mongodb');
const httpModule = require('http');
const socketModule = require('socket.io');
const ejsModule = require("ejs");

/**
 * App Variables
 */
const MongoClient = mongodb.MongoClient;
const app = express();
const url = 'mongodb+srv://temp-user:temp-password@sandbox.vawr3.gcp.mongodb.net/Airport?retryWrites=true&w=majority';
const dbName = "Airport";
const http = httpModule.Server(app);
const io = socketModule(http);
const port =process.env.PORT || 3000;

/**
 *  App Configuration
 */
app.engine('html', ejsModule.renderFile);

/**
 * Routes Definitions
 */


app.get('/Status', async (req, res) => {
    let station = req.query.airport;
    console.log("Connecting to the database...")
    let client = await MongoClient.connect(url);
    const db = client.db(dbName);
    const airportsCollection = db.collection("airports")
    const routesCollection = db.collection("routes")
    let arrivals = "";
    let departures = "";


    function convertToRow(flights,isArrival) {
        let rows = "";
        flights.forEach(flight => {
            rows += "<tr class='row' id=flight" + flight._id + ">\n" +
                "        <td>" + flight.terminal + "</td>\n" +
                "        <td>" + flight.airline + "</td>\n" +
                "        <td>" + (isArrival ? flight.src_airport : flight.dst_airport) + "</td>\n" +
                "        <td>" + (isArrival ? flight.takeoff_time : flight.arrival_time) + "</td>\n" +
                "        <td>" + flight.airplane + "</td>\n" +
                "        <td>" + flight._id + "</td>\n" +
                "        <td>" + flight.distance + " km</td>\n" +
                "        <td " + (flight.remark === 'DELAYED' ? "style=\"color: red;\">" : "style=\"color: green;\">") + flight.remark + "</td>\n" +
                "    </tr>";
        });
        return rows;

    }

    function zeroPad(num, places) {
        return String(num).padStart(places, '0');
    }

    async function getFlightDistance(flight) {
        let cursor = airportsCollection.aggregate([{
            "$geoNear": {
                "near": flight.location, "spherical": true, "distanceField": "distance", "distanceMultiplier": 0.001
            }
        }, {$match: {name: (station === flight.dst_airport)?flight.dst_airport:flight.src_airport}}, {"$project": {location: 1,distance: 1, _id: 0}}]);
        let result = await cursor.get();
        let cursor2 = airportsCollection.aggregate([{
            "$geoNear": {
                "near": result[0].location, "spherical": true, "distanceField": "totalDistance", "distanceMultiplier": 0.001
            }
        }, {$match: {name: (station === flight.dst_airport)?flight.src_airport:flight.dst_airport}}, {"$project": {location: 1,totalDistance: 1, _id: 0}}]);
        let result2 = await cursor2.get();
        return zeroPad(Math.round(result[0].distance), 4)+"/"+zeroPad(Math.round(result2[0].totalDistance), 4);

    }

    async function getFlights() {
        let flights = [];
        let condition = {$or: [{dst_airport: station}, {src_airport: station}]};
        console.log("Getting flights Info...")
        let cursor = routesCollection.find(condition);
        await cursor.forEach(flight=>flights.push(flight))
        return flights;
    }

    const flights = await getFlights()
    const promises = flights.map((flight) => {
        return getFlightDistance(flight).then((distance) => {
            flight.distance = distance;
            return flight;
        });

    });
    const flightsWithDistance = await Promise.all(promises);
    arrivals = convertToRow(flightsWithDistance.filter(flight=> flight.dst_airport === station),true)
    departures = convertToRow(flightsWithDistance.filter(flight=> flight.src_airport === station),false)
    console.log("Sending HTML file to the client...")
    res.render(__dirname + "/templates/airport.html", {
        socket: station,
        arrivals: arrivals,
        departures: departures

    });


    console.log("watching data to change...")
    let watchCursor = routesCollection.watch([{$match: {$or: [{"fullDocument.dst_airport": station}, {"fullDocument.src_airport": station}]}}],
        {fullDocument: "updateLookup"});
    watchCursor.on("change",async data => {
        console.log("Data changed. sending changed data to the client...")
        console.log("Received data after change: "+ JSON.stringify(data))
        let distance = await getFlightDistance(data.fullDocument)
        data.fullDocument.distance = distance
        io.emit(data.fullDocument.src_airport, data);
        io.emit(data.fullDocument.dst_airport, data);

    });
});


app.get('/', (req, res) => {
    MongoClient.connect(url, function (err, client) {
        assert.strictEqual(null, err);

        const db = client.db(dbName);
        db.collection("routes", function (err, collection) {
            collection.distinct("src_airport", function (err, result) {
                let preText = "";
                for (let i = 0; i < result.length; i++) {
                    preText += "<a href=/Status?airport=" + result[i] + " target='_blank'>" + result[i] + "  </a><br>"
                }

                res.send(preText)
            })

        });
    });

});

/**
 * Server Activation
 */
http.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)

});














