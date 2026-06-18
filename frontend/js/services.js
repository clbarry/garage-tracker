// frontend/js/services.js
// Page logic for the Services page. For now (step 1) it just loads the service
// records and shows them in the table, turning each service's vehicleId into a
// friendly nickname using the vehicles list.
//
// Structured like the professor's demo: one MyFrontEnd() wrapper with nested
// fetchX()/displayX() helpers, called once at the bottom.

async function MyFrontEnd() {
  // --- fetching -----------------------------------------------------------

  // GET the service records. Returns [] (and logs) if the request fails, so
  // the rest of the page still runs.
  async function fetchServices() {
    const res = await fetch("/api/services");
    if (!res.ok) {
      console.error("Error fetching services:", res.statusText);
      return [];
    }
    return await res.json();
  }

  // GET the vehicles (used to translate vehicleId -> nickname).
  async function fetchVehicles() {
    const res = await fetch("/api/vehicles");
    if (!res.ok) {
      console.error("Error fetching vehicles:", res.statusText);
      return [];
    }
    return await res.json();
  }

  // --- helpers ------------------------------------------------------------

  // Build a lookup: vehicle _id (string) -> nickname. Both the vehicle _id and
  // a service's vehicleId arrive from the API as hex strings, so they match.
  function buildVehicleNameMap(vehicles) {
    const map = new Map();
    for (let v of vehicles) {
      map.set(v._id, v.nickname);
    }
    return map;
  }

  // Add one <td> with the given text to a row.
  function addCell(row, text) {
    const td = document.createElement("td");
    td.textContent = text;
    row.appendChild(td);
  }

  // --- rendering ----------------------------------------------------------

  // Fill the service table. nameById maps vehicleId -> nickname.
  // We use ?? (not ||) for "missing" so a real 0 (e.g. mileage 0) still shows.
  function displayServices(services, nameById) {
    const tbody = document.getElementById("services-tbody");
    tbody.innerHTML = "";

    for (let s of services) {
      const row = document.createElement("tr");

      // Add the service data to the row.
      addCell(row, nameById.get(s.vehicleId) ?? "Unknown");
      addCell(row, s.date ?? "—");
      addCell(row, s.serviceType ?? "—");
      addCell(row, s.mileageAtService ?? "—");
      addCell(row, s.cost != null ? `$${s.cost.toFixed(2)}` : "—");
      addCell(row, s.shopName ?? "—");
      addCell(row, s.serviceRating ?? "—");

      // Actions: Edit + Delete buttons. Rendered now, wired up in a later step.
      const actions = document.createElement("td");
      const editBtn = document.createElement("button");

      // Configure the edit button.
      editBtn.type = "button";
      editBtn.className = "btn btn-sm btn-secondary";
      editBtn.textContent = "Edit";

      // Configure the delete button.
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-sm btn-danger";
      deleteBtn.textContent = "Delete";

      // Add the buttons to the actions cell.
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(actions);

      // Add the row to the table.
      tbody.appendChild(row);
    }
  }

  // --- run ----------------------------------------------------------------

  // Fetch the services + vehicles and (re)draw the table. Call this again
  // whenever the data changes (e.g. after adding/editing/deleting later) to
  // refresh the list.
  async function refreshServices() {
    const [services, vehicles] = await Promise.all([
      fetchServices(),
      fetchVehicles(),
    ]);
    const nameById = buildVehicleNameMap(vehicles);
    console.log(
      "Loaded",
      services.length,
      "services,",
      vehicles.length,
      "vehicles",
    );
    displayServices(services, nameById);
  }

  // Initial load.
  refreshServices();
}

MyFrontEnd();
