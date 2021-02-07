

let socket = io();
function createRow(flight, isInsert) {
    console.log(JSON.stringify(flight))
    let updatedRow;
    updatedRow = "<tr class='row' id=flight" + flight._id + ">\n" +
        "        <td>" + flight.terminal + "</td>\n" +
        "        <td>" + flight.airline + "</td>\n" +
        "        <td>" + (flight.src_airport === current_city ? flight.dst_airport : flight.src_airport) + "</td>\n" +
        "        <td>" + (flight.src_airport === current_city ? flight.takeoff_time : flight.arrival_time) + "</td>\n" +
        "        <td>" + flight.airplane + "</td>\n" +
        "        <td>" + flight._id + "</td>\n" +
        "        <td>" + flight.distance + " km</td>\n" +
        "        <td " + (flight.remark === 'DELAYED' ? "style=\"color: red;\">" : "style=\"color: green;\">") + flight.remark + "</td>\n" +
        "    </tr>";
    console.log("update row :" + updatedRow);
    if (isInsert) {
        let table = (current_city === flight.src_airport) ? document.querySelector("#departures") : document.querySelector("#arrivals");
        let newRow = table.insertRow()
        newRow.outerHTML = updatedRow

    } else {
        let item = document.querySelector('#flight' + flight._id);
        item.outerHTML = updatedRow;
    }

}

socket.on(current_city, function (data) {
    console.log("incoming data from socket...")
    if (data.operationType === "update")
        createRow(data.fullDocument, false)
    else createRow(data.fullDocument, true)

});