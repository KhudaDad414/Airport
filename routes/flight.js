let io;
exports.initialize = function (io_from) {
    io = io_from;
}
exports.status = async function (req, res) {
    await require("../controllers/controllers").connectDatabase()

    let station = req.query.airport;
    let arrivals = "";
    let departures = "";


    function zeroPad(num, places) {
        return String(num).padStart(places, '0');
    }

    async function getFlightDistance(flight) {
        try {
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
    }catch(err){
        console.log("got an error while fetching "+flight._id+" flights' distance." + err)
    }
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
    arrivals = flightsWithDistance.filter(flight => flight.dst_airport === station)
    departures = flightsWithDistance.filter(flight => flight.src_airport === station)
    console.log("Sending HTML file to the client...")
    res.render("../views/flightStatus.html", {
        title: station + " Airport Flight Board",
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

}
exports.dashboard = async function (req, res) {
    await require("../controllers/controllers").connectDatabase()
    let current_airline = req.query.airline;
    let convertedFlights = "";


    async function getFlights() {
        let flights = [];
        let condition = {"airline": current_airline};
        console.log("Getting flights Info...")
        let cursor = routesCollection.find(condition);
        await cursor.forEach(flight => flights.push(flight))
        return flights;
    }

    const flights = await getFlights()

    console.log("Sending HTML file to the client...")
    res.render("../views/flightDashboard.html", {
        title: current_airline + " Dashboard",
        airline: current_airline,
        flights: flights,
    });
    io.on('connection', (socket) => {
        socket.on('flight change', flightHandler);
    });

    function flightHandler(flight) {
        console.log("Received updated data.")
        const query = {_id: flight._id};
        const update = {
            $set: {
                _id: flight._id,
                terminal: flight.terminal,
                airline: flight.airline,
                "src_airport": flight.src_airport,
                "dst_airport": flight.dst_airport,
                "remark": flight.remark,
                "location": flight.location,
                "airplane": flight.airplane,
                "takeoff_time": flight.takeoff_time,
                "arrival_time": flight.arrival_time
            }
        };
        const options = {upsert: true};
        routesCollection.updateOne(query, update, options);
    }
}