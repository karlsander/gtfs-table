async function readStops(readFile) {
  return new Promise((resolve, reject) => {
    const data = readFile("stops");
    data.once("error", err => {
      reject(err);
      data.destroy(err);
    });
    data.once("end", err => {
      if (!err) setImmediate(resolve, acc);
    });

    const acc = Object.create(null); // by ID
    data.on("data", t => {
      const { stop_id, ...data } = t;
      acc[stop_id] = data;
    });
  });
}

exports.readStops = readStops;
