// js/vehicles.js
// browser logic for vehicles.html, loaded with defer so the page is parsed
// first. talks to the backend with fetch + json (server sends data, browser
// builds the html). lists vehicles, runs the search/filter form, drives the
// add/edit form (post or put), shows details, updates mileage (patch), deletes.

const API = "/api/vehicles";

/*=============================================
=                 Elements                    =
=============================================*/

const tbody = document.getElementById("vehicles-tbody");
const countLine = document.getElementById("vehicle-count");
const makeOptions = document.getElementById("make-options");

const filterForm = document.getElementById("filter-form");
const filterQ = document.getElementById("filter-q");
const filterStatus = document.getElementById("filter-status");
const filterMake = document.getElementById("filter-make");
const filterYear = document.getElementById("filter-year");
const filterReset = document.getElementById("filter-reset");

const vehicleForm = document.getElementById("vehicle-form");
const formHeading = document.getElementById("form-heading");
const formSubmit = document.getElementById("form-submit");
const formCancel = document.getElementById("form-cancel");
const formError = document.getElementById("form-error");
const formFields = {
  nickname: document.getElementById("form-nickname"),
  make: document.getElementById("form-make"),
  model: document.getElementById("form-model"),
  year: document.getElementById("form-year"),
  currentMileage: document.getElementById("form-mileage"),
  purchasePrice: document.getElementById("form-price"),
  status: document.getElementById("form-status"),
};

const detailEmpty = document.getElementById("detail-empty");
const detailBody = document.getElementById("detail-body");
const detailFields = {
  nickname: document.getElementById("detail-nickname"),
  makemodel: document.getElementById("detail-makemodel"),
  year: document.getElementById("detail-year"),
  mileage: document.getElementById("detail-mileage"),
  price: document.getElementById("detail-price"),
  status: document.getElementById("detail-status"),
};
const detailEdit = document.getElementById("detail-edit");
const detailDelete = document.getElementById("detail-delete");
const detailMessage = document.getElementById("detail-message");
const mileageForm = document.getElementById("mileage-form");
const mileageInput = document.getElementById("mileage-input");

// remembered between clicks
let editingId = null; // null = form is adding, not editing
let selectedId = null; // vehicle shown in the detail view

/*=============================================
=                 Fetch helper                =
=============================================*/

// one fetch wrapper: parses json and throws the backend's message on a non-2xx.
// 204 = no body
async function request(path, options) {
  const res = await fetch(path, options);
  if (res.status === 204) {
    return null;
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

/*=============================================
=             Formatting helpers              =
=============================================*/

function formatMiles(n) {
  return Number(n).toLocaleString() + " mi";
}

function formatMoney(n) {
  return "$" + Number(n).toLocaleString();
}

// "In Repair" -> "status-in-repair"
function statusClass(status) {
  return "status-" + status.toLowerCase().replace(/\s+/g, "-");
}

// coloured status pill (base class + modifier)
function statusBadge(status) {
  const span = document.createElement("span");
  span.className = "status-badge " + statusClass(status);
  span.textContent = status;
  return span;
}

/*=============================================
=               Render the list               =
=============================================*/

function renderVehicles(vehicles) {
  tbody.replaceChildren(); // clear old rows + the loading placeholder

  if (vehicles.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No vehicles found.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    countLine.textContent = "";
    return;
  }

  for (const v of vehicles) {
    const tr = document.createElement("tr");

    // nickname bold, make + model under it
    const nameCell = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = v.nickname;
    const sub = document.createElement("div");
    sub.className = "text-muted small";
    sub.textContent = v.make + " " + v.model;
    nameCell.append(strong, sub);

    const yearCell = document.createElement("td");
    yearCell.textContent = v.year;

    const mileageCell = document.createElement("td");
    mileageCell.textContent = formatMiles(v.currentMileage);

    const priceCell = document.createElement("td");
    priceCell.textContent = formatMoney(v.purchasePrice);

    const statusCell = document.createElement("td");
    statusCell.appendChild(statusBadge(v.status));

    // view / edit / delete, each with its own handler
    const actionCell = document.createElement("td");
    actionCell.className = "row-actions";
    actionCell.append(
      actionButton("View", "btn-outline-secondary", () => showDetail(v._id)),
      actionButton("Edit", "btn-outline-primary", () => startEdit(v)),
      actionButton("Delete", "btn-outline-danger", () => removeVehicle(v)),
    );

    tr.append(
      nameCell,
      yearCell,
      mileageCell,
      priceCell,
      statusCell,
      actionCell,
    );
    tbody.appendChild(tr);
  }

  countLine.textContent =
    vehicles.length + (vehicles.length === 1 ? " vehicle" : " vehicles");
}

// bootstrap-styled button + click handler
function actionButton(label, variant, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm me-1 " + variant;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

/*=============================================
=             Load + filter the list          =
=============================================*/

// read the filter form into a params object (skip empty fields)
function currentFilters() {
  const params = {};
  if (filterQ.value.trim()) {
    params.q = filterQ.value.trim();
  }
  if (filterStatus.value) {
    params.status = filterStatus.value;
  }
  if (filterMake.value.trim()) {
    params.make = filterMake.value.trim();
  }
  if (filterYear.value) {
    params.year = filterYear.value;
  }
  return params;
}

async function loadVehicles(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const vehicles = await request(query ? `${API}?${query}` : API);
    renderVehicles(vehicles);
  } catch (error) {
    countLine.textContent = "Could not load vehicles: " + error.message;
  }
}

// fill the make datalist from the full list so the suggestions don't shrink as
// you filter
async function refreshMakeOptions() {
  try {
    const all = await request(API);
    const makes = [...new Set(all.map((v) => v.make))].sort();
    makeOptions.replaceChildren();
    for (const make of makes) {
      const opt = document.createElement("option");
      opt.value = make;
      makeOptions.appendChild(opt);
    }
  } catch {
    // non-fatal: the make box still works as free text
  }
}

/*=============================================
=              Add / edit the form            =
=============================================*/

function resetForm() {
  editingId = null;
  vehicleForm.reset();
  formHeading.textContent = "Add a Vehicle";
  formSubmit.textContent = "Save";
  formCancel.classList.add("d-none");
  formError.textContent = "";
}

function startEdit(vehicle) {
  editingId = vehicle._id;
  formFields.nickname.value = vehicle.nickname;
  formFields.make.value = vehicle.make;
  formFields.model.value = vehicle.model;
  formFields.year.value = vehicle.year;
  formFields.currentMileage.value = vehicle.currentMileage;
  formFields.purchasePrice.value = vehicle.purchasePrice;
  formFields.status.value = vehicle.status;

  formHeading.textContent = "Edit Vehicle";
  formSubmit.textContent = "Update";
  formCancel.classList.remove("d-none");
  formError.textContent = "";
  formFields.nickname.focus();
}

vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";

  // gather the form; the backend does the real validation
  const body = {
    nickname: formFields.nickname.value,
    make: formFields.make.value,
    model: formFields.model.value,
    year: formFields.year.value,
    currentMileage: formFields.currentMileage.value,
    purchasePrice: formFields.purchasePrice.value,
    status: formFields.status.value,
  };

  // editingId picks add (post) vs update (put)
  const options = {
    method: editingId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  const path = editingId ? `${API}/${editingId}` : API;

  try {
    await request(path, options);
    resetForm();
    await refreshMakeOptions(); // a new make might exist now
    await loadVehicles(currentFilters());
  } catch (error) {
    formError.textContent = error.message; // show the backend's 400
  }
});

formCancel.addEventListener("click", resetForm);

/*=============================================
=                Detail view                  =
=============================================*/

async function showDetail(id) {
  detailMessage.textContent = "";
  try {
    const v = await request(`${API}/${id}`);
    selectedId = v._id;
    detailFields.nickname.textContent = v.nickname;
    detailFields.makemodel.textContent = v.make + " " + v.model;
    detailFields.year.textContent = v.year;
    detailFields.mileage.textContent = formatMiles(v.currentMileage);
    detailFields.price.textContent = formatMoney(v.purchasePrice);
    detailFields.status.replaceChildren(statusBadge(v.status));
    mileageInput.value = v.currentMileage;

    detailEmpty.classList.add("d-none");
    detailBody.classList.remove("d-none");
    detailBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    detailMessage.className = "mt-2 text-danger";
    detailMessage.textContent = "Could not load vehicle: " + error.message;
  }
}

// quick mileage update (patch), no full edit form
mileageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedId) {
    return;
  }
  try {
    const updated = await request(`${API}/${selectedId}/mileage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentMileage: mileageInput.value }),
    });
    detailFields.mileage.textContent = formatMiles(updated.currentMileage);
    detailMessage.className = "mt-2 text-success";
    detailMessage.textContent = "Mileage updated.";
    await loadVehicles(currentFilters()); // reflect it in the list too
  } catch (error) {
    detailMessage.className = "mt-2 text-danger";
    detailMessage.textContent = error.message;
  }
});

// edit from the detail view: load the vehicle and fill the form
detailEdit.addEventListener("click", async () => {
  if (!selectedId) {
    return;
  }
  try {
    const v = await request(`${API}/${selectedId}`);
    startEdit(v);
    vehicleForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    detailMessage.className = "mt-2 text-danger";
    detailMessage.textContent = error.message;
  }
});

detailDelete.addEventListener("click", () => {
  if (!selectedId) {
    return;
  }
  removeVehicleById(selectedId, true);
});

/*=============================================
=                   Delete                    =
=============================================*/

function removeVehicle(vehicle) {
  if (!window.confirm(`Delete "${vehicle.nickname}"? This can't be undone.`)) {
    return;
  }
  removeVehicleById(vehicle._id, false);
}

async function removeVehicleById(id, fromDetail) {
  if (fromDetail) {
    if (!window.confirm("Delete this vehicle? This can't be undone.")) {
      return;
    }
  }
  try {
    await request(`${API}/${id}`, { method: "DELETE" });
    // close the detail view if this was the open vehicle
    if (selectedId === id) {
      selectedId = null;
      detailBody.classList.add("d-none");
      detailEmpty.classList.remove("d-none");
    }
    // reset the form if this was the one being edited
    if (editingId === id) {
      resetForm();
    }
    await refreshMakeOptions();
    await loadVehicles(currentFilters());
  } catch (error) {
    window.alert("Could not delete: " + error.message);
  }
}

/*=============================================
=                Wire up + start              =
=============================================*/

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadVehicles(currentFilters());
});

filterReset.addEventListener("click", () => {
  filterForm.reset();
  loadVehicles({});
});

// first load: fill make suggestions, then show everything
refreshMakeOptions();
loadVehicles({});
