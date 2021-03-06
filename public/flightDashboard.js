let socket = io();
console.log("page loaded.")
let table = document.getElementById('flights');
let newRowTemplate = htmlToElements("<tr class='row' id=newRow>\n" +
    "            <td><input class='flight_no'  type='text' value=''/></td>\n" +
    "            <td><input class='terminal' type='text' value=''/></td>\n" +
    "            <td><input class='from' type='text' value=''/></td>\n" +
    "            <td><input class='to' type='text' value=''/></td>\n" +
    "            <td><input class='arrival_time' type='text' value=''/></td>\n" +
    "            <td><input class='takeoff_time' type='text' value=''/></td>\n" +
    "            <td><input class='airplane' type='text' value=''/></td>\n" +
    "           <td style='display: none;'><input class='location' type='text' value='{\"type\" : \"Point\", \"coordinates\" : [ 34.213332, 62.2260492 ] }'/></td>" +
    "           <td><input class='remark' type='text' value=''/></td></tr>")[0];
let rows = table.rows;

function setListeners() {

    console.log("Adding change listeners...")
    for (let i = 0; i < rows.length; i++) {
        rows[i].addEventListener('change', flightListeners)

    }
}

function htmlToElements(html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    return template.content.childNodes;
}

async function addFlight() {


    let insertedRow = document.getElementById("newRow")
    if (validateAndJasonify(insertedRow) === null) {
        alert("first fill all of the required fields.")
        return;
    }
    insertedRow.id = "flight" + insertedRow.getElementsByClassName("flight_no")[0].value;
    insertedRow.getElementsByClassName("flight_no")[0].disabled = true;
    insertedRow.addEventListener('change', flightListeners);
    insertedRow.getElementsByClassName("from")[0].addEventListener('change', flightListeners);
    console.log("firing the change event...")
    insertedRow.getElementsByClassName("from")[0].dispatchEvent(new Event("change"));
    let row = table.insertRow()
    row.outerHTML = newRowTemplate.outerHTML;


}

function validateAndJasonify(targetRow) {
    let flight = {};
    flight._id = parseInt(targetRow.getElementsByClassName("flight_no")[0].value);
    flight.terminal = targetRow.getElementsByClassName("terminal")[0].value;
    flight.airline = current_airline;
    flight.src_airport = targetRow.getElementsByClassName("from")[0].value;
    flight.dst_airport = targetRow.getElementsByClassName("to")[0].value;
    flight.remark = targetRow.getElementsByClassName("remark")[0].value;
    flight.location = JSON.parse(targetRow.getElementsByClassName("location")[0].value);
    flight.airplane = targetRow.getElementsByClassName("airplane")[0].value;
    flight.takeoff_time = targetRow.getElementsByClassName("takeoff_time")[0].value;
    flight.arrival_time = targetRow.getElementsByClassName("arrival_time")[0].value;
    if (flight._id === null || flight.terminal === "" || flight.airline === "" || flight.src_airport === "" || flight.dst_airport === "" || flight.remark === "" || flight.location === "" || flight.airplane === "" || flight.takeoff_time === "" || flight.arrival_time === "") {
        return null;
    } else return flight;
}

function flightListeners(e) {
    e.preventDefault();
    console.log("handling the change event...")
    let targetRow = e.target || e.srcElement;
    targetRow = targetRow.parentElement.parentElement;
    console.log(targetRow)
    let flight = validateAndJasonify(targetRow);
    if (flight === null) {
        alert("One or more fields are empty");
        return;
    }
    console.log("sending updated data: " + JSON.stringify(flight))
    socket.emit('flight change', flight);

}

setListeners();
console.log("the empty node is: " + newRowTemplate.outerHTML)
let row = table.insertRow()
row.outerHTML = newRowTemplate.outerHTML;