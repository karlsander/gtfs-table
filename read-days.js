async function readDays(readFile) {
  return new Promise((resolve, reject) => {
    const data = readFile("calendar");
    data.once("error", err => {
      reject(err);
      data.destroy(err);
    });
    data.once("end", err => {
      if (!err) setImmediate(resolve, acc);
    });

    const acc = Object.create(null); // by ID
    data.on("data", t => {
      const { service_id, ...data } = t;
      acc[service_id] = data;
    });
  });
}

exports.readDays = readDays;
