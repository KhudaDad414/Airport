let io;
let station;
exports.initialize = function(io_from) {
  io = io_from;
};

function zeroPad(num, places) {
  return String(num).padStart(places, '0');
}

async function getFlightDistance(flight) {
  try {
    const cursor = airportsCollection.aggregate([{
      '$geoNear': {
        'near': flight.location, 'spherical': true, 'distanceField': 'distance', 'distanceMultiplier': 0.001,
      },
    }, {$match: {name: (station === flight.dst_airport) ? flight.dst_airport : flight.src_airport}}, {
      '$project': {
        location: 1,
        distance: 1,
        _id: 0,
      },
    }]);
    const result = await cursor.get();
    const cursor2 = airportsCollection.aggregate([{
      '$geoNear': {
        'near': result[0].location,
        'spherical': true,
        'distanceField': 'totalDistance',
        'distanceMultiplier': 0.001,
      },
    }, {$match: {name: (station === flight.dst_airport) ? flight.src_airport : flight.dst_airport}}, {
      '$project': {
        location: 1,
        totalDistance: 1,
        _id: 0,
      },
    }]);
    const result2 = await cursor2.get();
    return zeroPad(Math.round(result[0].distance), 4) + '/' + zeroPad(Math.round(result2[0].totalDistance), 4);
  } catch (err) {
    console.log('got an error while fetching ' + flight._id + ' flights\' distance.' + err);
  }
}

async function getFlightsByAirline(airline) {
  const flights = [];
  const condition = {'airline': airline};
  console.log('Getting flights Info...');
  const cursor = routesCollection.find(condition);
  await cursor.forEach((flight) => flights.push(flight));
  return flights;
}

async function getFlightsByAirport(airport) {
  const flights = [];
  const condition = {$or: [{dst_airport: airport}, {src_airport: airport}]};
  console.log('Getting flights Info...');
  const cursor = routesCollection.find(condition);
  await cursor.forEach((flight) => flights.push(flight));
  return flights;
}

async function flightHandler(flight) {
  console.log('Received updated data.');
  const query = {_id: flight._id};
  // check if the src_airport or dst_airport is changed then send a signal to the respective airports the delete the entry
  let databaseFlight;
  const cursor = routesCollection.find(query);
  await cursor.forEach((flight) => databaseFlight = flight);
  if (databaseFlight) {
    if (databaseFlight.src_airport !== flight.src_airport) {
      io.emit(databaseFlight.src_airport, {operationType: 'delete', _id: flight._id});
    } else if (databaseFlight.dst_airport !== flight.dst_airport) {
      io.emit(databaseFlight.dst_airport, {operationType: 'delete', _id: flight._id});
    }
  }

  const update = {
    $set: {
      '_id': flight._id,
      'terminal': flight.terminal,
      'airline': flight.airline,
      'src_airport': flight.src_airport,
      'dst_airport': flight.dst_airport,
      'remark': flight.remark,
      'location': flight.location,
      'airplane': flight.airplane,
      'takeoff_time': flight.takeoff_time,
      'arrival_time': flight.arrival_time,
    },
  };
  const options = {upsert: true};
  routesCollection.updateOne(query, update, options);
}

exports.status = async function(req, res) {
  await require('../controllers/controllers').connectDatabase();

  station = req.query.airport;
  let arrivals = '';
  let departures = '';


  const flights = await getFlightsByAirport(station);
  const promises = flights.map((flight) => {
    return getFlightDistance(flight).then((distance) => {
      flight.distance = distance;
      return flight;
    });
  });
  const flightsWithDistance = await Promise.all(promises);
  arrivals = flightsWithDistance.filter((flight) => flight.dst_airport === station);
  departures = flightsWithDistance.filter((flight) => flight.src_airport === station);
  console.log('Sending HTML file to the client...');
  res.render('../views/flightStatus.html', {
    title: station + ' Airport Flight Board',
    socket: station,
    arrivals: arrivals,
    departures: departures,

  });


  console.log('watching data to change...');
  const watchCursor = routesCollection.watch(
      [{$match: {$or: [{'fullDocument.dst_airport': station},
        {'fullDocument.src_airport': station}]}}],
      {fullDocument: 'updateLookup'});
  watchCursor.on('change', async (data) => {
    console.log('Data changed. sending changed data to the client...');
    console.log('Received data after change: ' + JSON.stringify(data));
    const distance = await getFlightDistance(data.fullDocument);
    data.fullDocument.distance = distance;
    io.emit(data.fullDocument.src_airport, data);
    io.emit(data.fullDocument.dst_airport, data);
  });
};

exports.dashboard = async function(req, res) {
  await require('../controllers/controllers').connectDatabase();
  const currentAirline = req.query.airline;


  const flights = await getFlightsByAirline(currentAirline);

  console.log('Sending HTML file to the client...');
  res.render('../views/flightDashboard.html', {
    title: currentAirline + ' Dashboard',
    airline: currentAirline,
    flights: flights,
  });
  io.on('connection', (socket) => {
    socket.on('flight change', flightHandler);
  });
};
