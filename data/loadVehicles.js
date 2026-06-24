// data/loadVehicles.js
// Standalone seed for JUST the vehicles collection, so the Vehicles feature
// can be tested without the (currently broken) services loader.
// Run with:  node --env-file=.env data/loadVehicles.js
//
// Uses its own MongoClient (same connection pattern as db/vehiclesDb.js) so it
// has no dependency on servicesDb.js.

import { readFileSync } from "fs";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = "garage";

function readJson(fileName) {
  const url = new URL(fileName, import.meta.url); // resolves next to this file
  return JSON.parse(readFileSync(url, "utf-8"));
}

async function loadVehicles() {
  const client = await MongoClient.connect(uri);
  try {
    const vehicles = client.db(DB_NAME).collection("vehicles");

    await vehicles.deleteMany({}); // start clean so re-running is repeatable
    const docs = readJson("vehicles-mockaroo.json");
    const result = await vehicles.insertMany(docs);
    console.log(`Inserted ${result.insertedCount} vehicles.`);
  } finally {
    await client.close();
  }
}

loadVehicles()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  });
