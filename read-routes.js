async function readRoutes(readFile) {
  return new Promise((resolve, reject) => {
    const data = readFile("routes");
    data.once("error", err => {
      reject(err);
      data.destroy(err);
    });
    data.once("end", err => {
      if (!err) setImmediate(resolve, acc);
    });

    const acc = Object.create(null); // by ID
    data.on("data", t => {
      const { route_id, ...data } = t;
      acc[route_id] = data;
    });
  });
}

exports.readRoutes = readRoutes;
