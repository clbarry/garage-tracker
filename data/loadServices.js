// data/loadServices.js
// One-off seed script. Run with:  node --env-file=.env data/loadServices.js
//
// What it does:
//   1. Wipes the vehicles + services collections (so re-running is clean).
//   2. Inserts the 300 vehicles from vehicles.json  -> MongoDB gives each an _id.
//   3. Reads the 700 service rows from services.json (they have NO vehicleId yet).
//   4. Assigns each vehicle a RANDOM 0-5 services, linking by the vehicle's _id,
//      until all 700 are placed. Clamps each service's mileageAtService to be
//      <= that vehicle's currentMileage (an odometer can't read more than "now").
//   5. Inserts the linked services and prints a distribution summary.

import { readFileSync } from "fs";
import db from "../db/servicesDb.js";

const MAX_SERVICES_PER_VEHICLE = 5;

// Read a JSON file from the data/ folder (relative to this script).
function readJson(fileName) {
  const url = new URL(fileName, import.meta.url); // resolves next to this file
  return JSON.parse(readFileSync(url, "utf-8"));
}

async function loadData() {
  await db.init();
  const database = db.getDatabase();
  const vehicles = database.collection("vehicles");
  const services = database.collection("services");

  // --- 1. Start clean so re-running doesn't pile up duplicates ---
  await vehicles.deleteMany({});
  await services.deleteMany({});
  console.log("Cleared vehicles and services collections.");

  // --- 2. Insert vehicles, then read them back to get their new _ids ---
  const vehicleDocs = readJson("vehicles-mockaroo.json");
  await vehicles.insertMany(vehicleDocs);
  const insertedVehicles = await vehicles.find().toArray();
  console.log(`Inserted ${insertedVehicles.length} vehicles.`);

  // --- 3. Load the un-linked service rows ---
  const serviceDocs = readJson("services-mockaroo.json");
  console.log(`Loaded ${serviceDocs.length} service rows to assign.`);

  // --- 4. Assign each service to a random vehicle (max 5 per vehicle) ---
  // Track how many services each vehicle has so far.
  const counts = new Map(); // vehicle _id (string) -> number of services
  insertedVehicles.forEach((v) => counts.set(v._id.toString(), 0));

  const linkedServices = [];

  for (const service of serviceDocs) {
    // Pick a random vehicle that still has room (< 5 services).
    const available = insertedVehicles.filter(
      (v) => counts.get(v._id.toString()) < MAX_SERVICES_PER_VEHICLE,
    );
    if (available.length === 0) {
      // Every vehicle is full (would only happen if services > 300*5). Stop.
      break;
    }
    const vehicle = available[Math.floor(Math.random() * available.length)];

    // Clamp the service mileage so it never exceeds the car's current mileage.
    const clampedMileage = Math.min(
      service.mileageAtService,
      vehicle.currentMileage,
    );

    linkedServices.push({
      ...service,
      vehicleId: vehicle._id.toString(), // the foreign key -> vehicle's _id
      mileageAtService: clampedMileage,
    });

    counts.set(vehicle._id.toString(), counts.get(vehicle._id.toString()) + 1);
  }

  // --- 5. Insert the linked services and report ---
  await services.insertMany(linkedServices);
  console.log(`Inserted ${linkedServices.length} linked services.`);

  // Distribution: how many vehicles have 0, 1, 2, ... services?
  const dist = {};
  for (const count of counts.values()) {
    dist[count] = (dist[count] || 0) + 1;
  }
  console.log("Services-per-vehicle distribution (count: #vehicles):", dist);

  const total = insertedVehicles.length + linkedServices.length;
  console.log(`TOTAL rows across both collections: ${total}`);
}

loadData()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  });
