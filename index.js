/**
 * Required External Modules
 */
const express = require('express');
const path = require('path');
const httpModule = require('http');
const socketModule = require('socket.io');
const ejsModule = require("ejs");
const indexRoute = require("./routes/index")
const flightRoute = require("./routes/flight")
/**
 * App Variables
 */
const app = express();
const http = httpModule.Server(app);
const io = socketModule(http);
const port = process.env.PORT || 3000;
flightRoute.initialize(io);

/**
 *  App Configuration
 */
app.engine('html', ejsModule.renderFile);
app.use('/views', express.static(path.resolve(__dirname, 'views')));
app.use('/public', express.static(path.resolve(__dirname, 'public')));

/**
 * Routes Definitions
 */

app.get('/Status', flightRoute.status);
app.get('/Dashboard', flightRoute.dashboard);

app.get('/', indexRoute.index);

/**
 * Server Activation
 */
http.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)

});














