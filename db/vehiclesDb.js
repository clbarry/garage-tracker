// db/vehiclesDb.js - DATA LAYER 
// The ONLY place that talks to MongoDB for the Vehicles feature 
// Same factory + per-call connection style as db/servicesDb.js, but
// self-contained: its own getClient so it has no dependency on the services db.

// For now it only needs to LIST vehicles (the Services page uses this to show
// nicknames and fill the vehicle dropdowns). More methods get added here as
// the Vehicles feature grows.


// ALL CRUD operations -> list (with optional filter), get one, create,
// update, a quick mileage-only update, and delete. The routes in routes/vehicles.js 
// call these methods and never touch a collection directly.
 
import { MongoClient } from "mongodb";
 
// Same database as the services side ("garage"); both teammates share it.
const DEFAULT_DB_NAME = "garage";
 
function createVehiclesDb() {
  // Open a fresh connection and hand back the client (to close) and the
  // "vehicles" collection. Connection string comes from .env via --env-file.
  async function getClient() {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
    const client = await MongoClient.connect(uri);
    const vehicles = client.db(DEFAULT_DB_NAME).collection("vehicles");
    return { client, vehicles };
  }
 
  const me = {};
 
  // Return vehicles matching `filter` (an empty {} matches everything). The
  // route builds the filter from the search/filter query string and passes it
  // in. The default {} means a call with no argument (like the Services page
  // makes for its dropdowns) still returns every vehicle, so nothing breaks.
  me.getVehicles = async function (filter = {}) {
    const { client, vehicles } = await getClient();
    try {
      return await vehicles.find(filter).sort({ make: 1, model: 1 }).toArray();
    } finally {
      await client.close();
    }
  };
 
  // Return a single vehicle by its _id, or null if not found. The route
  // validates/converts the id first, so `objectId` is a real ObjectId.
  me.getVehicleById = async function (objectId) {
    const { client, vehicles } = await getClient();
    try {
      return await vehicles.findOne({ _id: objectId });
    } finally {
      await client.close();
    }
  };
 
  // Insert a new vehicle document. Returns the result so the route can read
  // the auto-generated insertedId. MongoDB adds the unique _id automatically.
  me.createVehicle = async function (doc) {
    const { client, vehicles } = await getClient();
    try {
      return await vehicles.insertOne(doc);
    } finally {
      await client.close();
    }
  };
 
  // Replace the listed fields on the vehicle with this _id. Returns the result
  // so the route can check matchedCount (0 = no document had that id).
  me.updateVehicle = async function (objectId, fields) {
    const { client, vehicles } = await getClient();
    try {
      return await vehicles.updateOne({ _id: objectId }, { $set: fields });
    } finally {
      await client.close();
    }
  };
 
  // Quick odometer update: set ONLY currentMileage. Backs the mileage update
  // control on the detail view, so the user can bump the odometer without
  // opening the full edit form. Returns the result (route checks matchedCount).
  me.updateVehicleMileage = async function (objectId, mileage) {
    const { client, vehicles } = await getClient();
    try {
      return await vehicles.updateOne(
        { _id: objectId },
        { $set: { currentMileage: mileage } },
      );
    } finally {
      await client.close();
    }
  };
 
  // Delete the vehicle with this _id. Returns the result so the route can
  // check deletedCount (0 = no document had that id).
  me.deleteVehicle = async function (objectId) {
    const { client, vehicles } = await getClient();
    try {
      return await vehicles.deleteOne({ _id: objectId });
    } finally {
      await client.close();
    }
  };
 
  return me;
}
 
// Export ONE shared instance, same as the services db.
export default createVehiclesDb();