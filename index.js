const computeSchedules = require("gtfs-utils/compute-schedules");
const readTrips = require("gtfs-utils/read-trips");
const readServices = require("gtfs-utils/read-services-and-exceptions");
const { readStops } = require("./read-stops");
const { readRoutes } = require("./read-routes");
const { readDays } = require("./read-days");
const minimist = require("minimist");
const AdmZip = require("adm-zip");
const request = require("request");
const parseCsv = require("csv-parser");
const stringify = require("csv-stringify");
const fs = require("fs");
const stripBomStream = require("strip-bom-stream");
const sanitize = require("sanitize-filename");

const readCsvString = inputString => {
  const Readable = require("stream").Readable;
  const s = new Readable();
  const csv = parseCsv({
    mapHeaders: ({ header, index }) => header.trim()
  });
  s.pipe(stripBomStream()).pipe(csv);
  s.push(inputString);
  s.push(null);
  return csv;
};

function secondsToTimeString(seconds) {
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours < 10 ? "0" : ""}${hours}:${
    minutes < 10 ? "0" : ""
  }${minutes}`;
}

function splitDate(date) {
  if (date) {
    return (
      date.substr(0, 4) + "-" + date.substr(4, 2) + "-" + date.substr(6, 2)
    );
  } else {
    return "";
  }
}

let files = {};

async function main(folderName = "out") {
  const readFile = name => readCsvString(files[name + ".txt"]);
  console.log("reading stops");
  const stops = await readStops(readFile);
  console.log("reading days");
  const days = await readDays(readFile);
  console.log("reading trips");
  const trips = await readTrips(readFile, t => true);
  console.log("reading routes");
  const routes = await readRoutes(readFile);
  console.log("reading schedules");
  const schedules = await computeSchedules(readFile, {}, trip => trip.route_id);
  //console.log("reading services");
  //const services = await readServices(readFile, "Europe/Berlin");

  console.log("mapping schedules");
  const withStopNames = Object.values(schedules).map(s => ({
    id: s.id,
    route_id: s.route_id,
    trips: s.trips.map(t => ({
      tripId: t.tripId,
      serviceId: trips[t.tripId].service_id,
      days: days[trips[t.tripId].service_id],
      start: t.start
    })),
    sequence: s.sequence,
    stops: s.stops.map(stop => stops[stop].stop_name),
    arrivals: s.arrivals,
    departures: s.departures
  }));

  console.log(`mapped ${withStopNames.length} schedules`);

  const rowsForFiles = withStopNames.map(s => ({
    fileName:
      routes[s.route_id].route_long_name !== ""
        ? sanitize(
            routes[s.route_id].route_long_name.substr(0, 200) + " " + s.route_id
          )
        : s.route_id,
    data: [
      [
        "Days",
        ...s.trips.map(trip =>
          Object.keys(trip.days)
            .filter(day => trip.days[day] === "1")
            .join(", ")
        )
      ],
      ["Start Date", ...s.trips.map(trip => splitDate(trip.days.start_date))],
      ["End Date", ...s.trips.map(trip => splitDate(trip.days.end_date))],
      [" ", ...s.trips.map(trip => "")],
      ...s.stops.map((stop, index) => [
        stop,
        ...s.trips.map(trip =>
          secondsToTimeString(trip.start + s.departures[index])
        )
      ])
    ]
  }));

  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }

  rowsForFiles.forEach(file =>
    stringify(file.data, { header: false }, (err, output) => {
      if (err) throw err;
      fs.writeFile(`${folderName}/${file.fileName}.csv`, output, err => {
        if (err) throw err;
        console.log(`${folderName}/${file.fileName}.csv saved`);
      });
    })
  );
}

module.exports = () => {
  const args = minimist(process.argv.slice(2));
  if (args.url) {
    request.get({ url: args.url, encoding: null }, (err, res, body) => {
      var zip = new AdmZip(body);
      var zipEntries = zip.getEntries();
      zipEntries.forEach(entry => {
        console.log(`found file ${entry.entryName}`);
        files[entry.entryName] = zip.readAsText(entry);
      });
      main(args.name);
    });
  } else {
    console.log(
      "Usage: gtfs-table --name outputFolder --url https://agency.com/gtfs"
    );
  }
};
