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
const url = 'mongodb://localhost';
const dbName = "Airport";
const http = httpModule.Server(app);
const io = socketModule(http);
const port = process.env.PORT || 3000;


let airportsCollection;
let routesCollection;
/**
 *  App Configuration
 */
app.engine('html', ejsModule.renderFile);
express.static("public");

/**
 * Routes Definitions
 */


app.get('/Status', async (req, res) => {
    await connectDatabase();
    let station = req.query.airport;
    let arrivals = "";
    let departures = "";


    function convertToRow(flights, isArrival) {
        let rows = "";
        flights.forEach(flight => {
            rows += "<tr class='row' id=flight" + flight._id + ">\n" +
                "        <td>" + flight.terminal + "</td>\n" +
                "        <td>" + flight.airline + "</td>\n" +
                "        <td>" + (isArrival ? flight.src_airport : flight.dst_airport) + "</td>\n" +
                "        <td>" + (isArrival ?flight.arrival_time: flight.takeoff_time) + "</td>\n" +
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
        console.log("getting distance for flight id: "+flight._id)
        let cursor = airportsCollection.aggregate([{
            "$geoNear": {
                "near": flight.location, "spherical": true, "distanceField": "distance", "distanceMultiplier": 0.001
            }
        }, {$match: {name: (station === flight.dst_airport) ? flight.dst_airport : flight.src_airport}}, {
            "$project": {
                location: 1,
                distance: 1,
                _id: 0
            }
        }]);
        let result = await cursor.get();
        let cursor2 = airportsCollection.aggregate([{
            "$geoNear": {
                "near": result[0].location,
                "spherical": true,
                "distanceField": "totalDistance",
                "distanceMultiplier": 0.001
            }
        }, {$match: {name: (station === flight.dst_airport) ? flight.src_airport : flight.dst_airport}}, {
            "$project": {
                location: 1,
                totalDistance: 1,
                _id: 0
            }
        }]);
        let result2 = await cursor2.get();
        return zeroPad(Math.round(result[0].distance), 4) + "/" + zeroPad(Math.round(result2[0].totalDistance), 4);

    }

    async function getFlights() {
        let flights = [];
        let condition = {$or: [{dst_airport: station}, {src_airport: station}]};
        console.log("Getting flights Info...")
        let cursor = routesCollection.find(condition);
        await cursor.forEach(flight => flights.push(flight))
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
    arrivals = convertToRow(flightsWithDistance.filter(flight => flight.dst_airport === station), true)
    departures = convertToRow(flightsWithDistance.filter(flight => flight.src_airport === station), false)
    console.log("Sending HTML file to the client...")
    res.render(__dirname + "/public/airport.html", {
        socket: station,
        arrivals: arrivals,
        departures: departures

    });


    console.log("watching data to change...")
    let watchCursor = routesCollection.watch([{$match: {$or: [{"fullDocument.dst_airport": station}, {"fullDocument.src_airport": station}]}}],
        {fullDocument: "updateLookup"});
    watchCursor.on("change", async data => {
        console.log("Data changed. sending changed data to the client...")
        console.log("Received data after change: " + JSON.stringify(data))
        let distance = await getFlightDistance(data.fullDocument)
        data.fullDocument.distance = distance
        io.emit(data.fullDocument.src_airport, data);
        io.emit(data.fullDocument.dst_airport, data);

    });
});

app.get('/Dashboard', async (req, res) => {
    await connectDatabase();
    let current_airline = req.query.airline;
    let convertedFlights = "";


    function convertToRow(flights) {
        let rows = "";

        flights.forEach(flight => {
            rows += "<tr class='row' id=flight" + flight._id + ">\n" +
                "        <td><input class='flight_no' disabled=\"disabled\" type='text' value='" + flight._id + "'/></td>\n" +
                "        <td><input class='terminal' type='text' value='" + flight.terminal + "'/></td>\n" +
                "        <td><input class='from' type='text' value='" + flight.src_airport+ "'/></td>\n" +
                "        <td><input class='to' type='text' value='" + flight.dst_airport+ "'/></td>\n" +
                "        <td><input class='arrival_time' type='text' value='" + flight.arrival_time + "'/></td>\n" +
                "        <td><input class='takeoff_time' type='text' value='" + flight.takeoff_time+ "'/></td>\n" +
                "        <td><input class='airplane' type='text' value='" + flight.airplane + "'/></td>\n" +
                "        <td style='display: none;'><input class='location' type='text' value='" + JSON.stringify(flight.location) + "'/></td>\n" +
                "        <td><input class='remark' type='text' value='"+ flight.remark + "'/></td>\n" +
                "    </tr>";
        });
        return rows;

    }



    async function getFlights() {
        let flights = [];
        let condition = {"airline":current_airline};
        console.log("Getting flights Info...")
        let cursor = routesCollection.find(condition);
        await cursor.forEach(flight => flights.push(flight))
        return flights;
    }

    const flights = await getFlights()
    convertedFlights = convertToRow(flights)
    console.log("Sending HTML file to the client...")
    res.render(__dirname + "/public/airline.html", {
        airline: current_airline,
        flights: convertedFlights,
    });
    io.on('connection', (socket) => {
        socket.on('flight change', (flight) => {
            console.log("Received updated data.")

            const query = { _id: flight._id };
            const update = { $set: { _id: flight._id,terminal: flight.terminal, airline: flight.airline, "src_airport" : flight.src_airport,"dst_airport" : flight.dst_airport,"remark" : flight.remark,"location" : flight.location,
                    "airplane" : flight.airplane,
                    "takeoff_time" : flight.takeoff_time,
                    "arrival_time" : flight.arrival_time
                }};
            const options = { upsert: true };
            routesCollection.updateOne(query, update, options);
        });
    });
});

async function connectDatabase() {
    if(!global.db) {
        console.log("Connecting to the database...")
        let client = await MongoClient.connect(url)
        global.db = client.db(dbName);
        routesCollection = db.collection("routes");
        airportsCollection = db.collection("airports");
    }
}

app.get('/', async (req, res) => {
     await connectDatabase();

    let airports = routesCollection.distinct("src_airport")
    let airlines = routesCollection.distinct("airline")
    const data = await Promise.all([airports, airlines])

    let preText = "<head><link rel=\"stylesheet\" href=\"https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css\"></head><body>" +
        "<h2 style='margin: 4px'>Airports Status</h2>";
    for (let i = 0; i < data[0].length; i++) {
        preText += "<a style='width: 90%; margin-left:5%; margin-right:5%' type=\"button\" class=\"btn btn-outline-primary\" href=/Status?airport=" + data[0][i] + " target='_blank'>" + data[0][i] + "  </a><br>"
    }
    preText += "<h2 style='margin: 4px'>Airline Dashboards</h2>"
    for (let i = 0; i < data[1].length; i++) {
        preText += "<a style='width: 90%; margin-left:5%; margin-right:5%' type=\"button\" class=\"btn btn-outline-primary\" href=/Dashboard?airline=" + data[1][i] + " target='_blank'>" + data[1][i] + "  </a><br>"
    }
    preText += "</body>"
    res.send(preText)


});

/**
 * Server Activation
 */
http.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)

});














