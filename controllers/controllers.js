exports.connectDatabase = async function() {
    const mongodb = require('mongodb');
    const MongoClient = mongodb.MongoClient;
    const url = 'mongodb://localhost';
    const dbName = "Airport";

    if (!global.db) {
        console.log("Connecting to the database...")
        let client = await MongoClient.connect(url)
        global.db = client.db(dbName);
        global.routesCollection = db.collection("routes")
        global.airportsCollection = db.collection("airports")
    }
}
