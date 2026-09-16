// ============================================================
// Dashboard controller: role-based tabs, tables, and modals
// ============================================================

let currentUser = null;
let facilitiesCache = [];

const TABS_BY_ROLE = {
  Administrator: ["facilities", "reservations", "users", "service", "audit"],
  "Facility Staff": ["facilities", "reservations", "service"],
  Requester: ["facilities", "reservations"],
};

const TAB_LABELS = {
  facilities: "Facilities",
  reservations: "Reservations",
  users: "Users",
  service: "Service Concerns",
  audit: "Audit Logs",
};

function fmt(dt) {
  return new Date(dt).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function statusPill(status) {
  const cls = status.replace(/\s/g, "");
  return `<span class="status-pill status-${cls}">${status}</span>`;
}

function openModal(html) {
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modalBackdrop").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("modalBackdrop").classList.add("hidden");
  document.getElementById("modalBody").innerHTML = "";
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
async function init() {
  currentUser = requireAuth();
  if (!currentUser) return;

  document.getElementById("userName").textContent = currentUser.full_name;
  document.getElementById("userRole").textContent = currentUser.role;

  renderTabs();

  document.getElementById("addFacilityBtn").classList.toggle("hidden", currentUser.role === "Requester");
  document.getElementById("newReservationBtn").classList.toggle("hidden", currentUser.role !== "Requester");
  document.getElementById("newServiceBtn").classList.toggle("hidden", currentUser.role !== "Facility Staff");

  document.getElementById("addFacilityBtn").addEventListener("click", showAddFacilityModal);
  document.getElementById("newReservationBtn").addEventListener("click", showNewReservationModal);
  document.getElementById("addUserBtn").addEventListener("click", showAddUserModal);
  document.getElementById("newServiceBtn").addEventListener("click", showNewServiceModal);

  const firstTab = TABS_BY_ROLE[currentUser.role][0];
  switchTab(firstTab);
}

function renderTabs() {
  const bar = document.getElementById("tabsBar");
  const tabs = TABS_BY_ROLE[currentUser.role];
  bar.innerHTML = tabs
    .map((t) => `<button class="tab-btn" data-tab="${t}">${TAB_LABELS[t]}</button>`)
    .join("");
  bar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`tab-${tab}`).classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  if (tab === "facilities") renderFacilitiesTab();
  if (tab === "reservations") renderReservationsTab();
  if (tab === "users") renderUsersTab();
  if (tab === "service") renderServiceTab();
  if (tab === "audit") renderAuditTab();
}

// ------------------------------------------------------------
// Facilities
// ------------------------------------------------------------
async function renderFacilitiesTab() {
  const wrap = document.getElementById("facilitiesTableWrap");
  wrap.innerHTML = "Loading...";
  try {
    facilitiesCache = await loadFacilities();
    if (!facilitiesCache.length) {
      wrap.innerHTML = `<div class="empty-note">No facilities yet.</div>`;
      return;
    }
    const canManage = currentUser.role === "Administrator" || currentUser.role === "Facility Staff";
    const rows = facilitiesCache
      .map(
        (f) => `
        <tr>
          <td>${f.name}</td>
          <td>${f.description || ""}</td>
          <td>${statusPill(f.status)}</td>
          <td class="actions-cell">
            ${
              canManage
                ? `<select class="statusSelect" data-id="${f.id}" data-name="${f.name}" style="padding:4px 6px;border-radius:6px;border:1px solid var(--gray-border);">
                    <option value="Active" ${f.status === "Active" ? "selected" : ""}>Active</option>
                    <option value="Maintenance" ${f.status === "Maintenance" ? "selected" : ""}>Maintenance</option>
                    <option value="Inactive" ${f.status === "Inactive" ? "selected" : ""}>Inactive</option>
                  </select>`
                : ""
            }
            ${
              currentUser.role === "Administrator"
                ? `<button class="btn btn-danger btn-sm" onclick="handleDeleteFacility('${f.id}', '${f.name.replace(/'/g, "\\'")}')">Delete</button>`
                : ""
            }
          </td>
        </tr>`
      )
      .join("");
    wrap.innerHTML = `<table><thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;

    wrap.querySelectorAll(".statusSelect").forEach((sel) => {
      sel.addEventListener("change", async () => {
        await updateFacilityStatus(sel.dataset.id, sel.value, sel.dataset.name);
        renderFacilitiesTab();
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function showAddFacilityModal() {
  openModal(`
    <h3>Add Facility</h3>
    <div id="facilityModalAlert"></div>
    <div class="field"><label>Name</label><input id="fName" /></div>
    <div class="field"><label>Description</label><textarea id="fDesc" rows="3"></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn" id="saveFacilityBtn">Save</button>
    </div>
  `);
  document.getElementById("saveFacilityBtn").addEventListener("click", async () => {
    const name = document.getElementById("fName").value.trim();
    const desc = document.getElementById("fDesc").value.trim();
    if (!name) {
      document.getElementById("facilityModalAlert").innerHTML = `<div class="alert alert-error">Name is required.</div>`;
      return;
    }
    await addFacility(name, desc);
    closeModal();
    renderFacilitiesTab();
  });
}

async function handleDeleteFacility(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  await deleteFacility(id, name);
  renderFacilitiesTab();
}

// ------------------------------------------------------------
// Reservations
// ------------------------------------------------------------
async function renderReservationsTab() {
  const wrap = document.getElementById("reservationsTableWrap");
  wrap.innerHTML = "Loading...";
  try {
    let list = await loadReservations();
    if (currentUser.role === "Requester") {
      list = list.filter((r) => r.requester_id === currentUser.id);
    }
    if (!list.length) {
      wrap.innerHTML = `<div class="empty-note">No reservations yet.</div>`;
      return;
    }
    const rows = list.map((r) => `
      <tr>
        <td>${r.facilities?.name || "—"}</td>
        <td>${r.app_users?.full_name || "—"}</td>
        <td>${r.purpose}</td>
        <td>${fmt(r.start_time)}</td>
        <td>${fmt(r.end_time)}</td>
        <td>${statusPill(r.status)}</td>
        <td class="actions-cell">${reservationActions(r)}</td>
      </tr>
    `).join("");
    wrap.innerHTML = `<table><thead><tr><th>Facility</th><th>Requester</th><th>Purpose</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
    window.__reservations = list; // for action lookups
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function reservationActions(r) {
  const btns = [];
  if (currentUser.role === "Administrator" && r.status === "Pending") {
    btns.push(`<button class="btn btn-sm" onclick="handleApprove('${r.id}')">Approve</button>`);
    btns.push(`<button class="btn btn-sm btn-danger" onclick="handleReject('${r.id}')">Reject</button>`);
  }
  if (currentUser.role === "Facility Staff" && r.status === "Scheduled") {
    btns.push(`<button class="btn btn-sm btn-amber" onclick="handleMarkInUse('${r.id}')">Mark In Use</button>`);
  }
  if (currentUser.role === "Facility Staff" && r.status === "In Use") {
    btns.push(`<button class="btn btn-sm" onclick="handleMarkCompleted('${r.id}')">Mark Completed</button>`);
  }
  if (currentUser.role === "Requester" && r.status === "Pending" && r.requester_id === currentUser.id) {
    btns.push(`<button class="btn btn-sm btn-outline" onclick="handleCancel('${r.id}')">Cancel</button>`);
  }
  return btns.join("") || "—";
}

function findReservation(id) {
  return (window.__reservations || []).find((r) => r.id === id);
}

async function handleApprove(id) {
  const r = findReservation(id);
  const result = await approveReservation(r);
  if (!result.ok) alert(result.message);
  renderReservationsTab();
}
async function handleReject(id) {
  const r = findReservation(id);
  if (!confirm("Reject this reservation?")) return;
  const result = await rejectReservation(r);
  if (!result.ok) alert(result.message);
  renderReservationsTab();
}
async function handleMarkInUse(id) {
  const r = findReservation(id);
  const result = await markInUse(r);
  if (!result.ok) alert(result.message);
  renderReservationsTab();
}
async function handleMarkCompleted(id) {
  const r = findReservation(id);
  const result = await markCompleted(r);
  if (!result.ok) alert(result.message);
  renderReservationsTab();
}
async function handleCancel(id) {
  const r = findReservation(id);
  if (!confirm("Cancel this reservation?")) return;
  const result = await cancelReservation(r, currentUser.id);
  if (!result.ok) alert(result.message);
  renderReservationsTab();
}

async function showNewReservationModal() {
  const facilities = await loadFacilities();
  const activeOptions = facilities
    .filter((f) => f.status === "Active")
    .map((f) => `<option value="${f.id}">${f.name}</option>`)
    .join("");

  openModal(`
    <h3>New Reservation</h3>
    <div id="resModalAlert"></div>
    <div class="field">
      <label>Facility</label>
      <select id="rFacility">${activeOptions || `<option disabled selected>No active facilities</option>`}</select>
    </div>
    <div class="field"><label>Purpose</label><input id="rPurpose" placeholder="e.g. Org meeting" /></div>
    <div class="grid-2">
      <div class="field"><label>Start</label><input type="datetime-local" id="rStart" /></div>
      <div class="field"><label>End</label><input type="datetime-local" id="rEnd" /></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn" id="submitResBtn">Submit Request</button>
    </div>
  `);

  document.getElementById("submitResBtn").addEventListener("click", async () => {
    const facilityId = document.getElementById("rFacility").value;
    const facility = facilities.find((f) => f.id === facilityId);
    const purpose = document.getElementById("rPurpose").value.trim();
    const start = document.getElementById("rStart").value;
    const end = document.getElementById("rEnd").value;
    const alertBox = document.getElementById("resModalAlert");

    if (!facility || !purpose || !start || !end) {
      alertBox.innerHTML = `<div class="alert alert-error">Please fill in all fields.</div>`;
      return;
    }
    const result = await submitReservation(facility, currentUser.id, purpose, start, end);
    if (!result.ok) {
      alertBox.innerHTML = `<div class="alert alert-error">${result.message}</div>`;
      return;
    }
    closeModal();
    renderReservationsTab();
  });
}

// ------------------------------------------------------------
// Users (Administrator only)
// ------------------------------------------------------------
async function renderUsersTab() {
  const wrap = document.getElementById("usersTableWrap");
  wrap.innerHTML = "Loading...";
  const { data, error } = await supabaseClient.from("app_users").select("*").order("role");
  if (error) {
    wrap.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
    return;
  }
  const rows = data.map((u) => `
    <tr>
      <td>${u.full_name}</td>
      <td>${u.username}</td>
      <td>${u.role}</td>
    </tr>
  `).join("");
  wrap.innerHTML = `<table><thead><tr><th>Full Name</th><th>Username</th><th>Role</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function showAddUserModal() {
  openModal(`
    <h3>Add User</h3>
    <div id="userModalAlert"></div>
    <div class="field"><label>Full Name</label><input id="uFullName" /></div>
    <div class="field"><label>Username</label><input id="uUsername" /></div>
    <div class="field"><label>Password</label><input id="uPassword" type="text" /></div>
    <div class="field">
      <label>Role</label>
      <select id="uRole">
        <option>Administrator</option>
        <option>Facility Staff</option>
        <option selected>Requester</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn" id="saveUserBtn">Create</button>
    </div>
  `);
  document.getElementById("saveUserBtn").addEventListener("click", async () => {
    const full_name = document.getElementById("uFullName").value.trim();
    const username = document.getElementById("uUsername").value.trim();
    const password = document.getElementById("uPassword").value;
    const role = document.getElementById("uRole").value;
    const alertBox = document.getElementById("userModalAlert");
    if (!full_name || !username || !password) {
      alertBox.innerHTML = `<div class="alert alert-error">All fields are required.</div>`;
      return;
    }
    const { error } = await supabaseClient.from("app_users").insert({ full_name, username, password, role });
    if (error) {
      alertBox.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
      return;
    }
    await logAction("Create", "app_users", null, `User "${username}" created with role ${role}.`);
    closeModal();
    renderUsersTab();
  });
}

// ------------------------------------------------------------
// Service Concerns
// ------------------------------------------------------------
async function renderServiceTab() {
  const wrap = document.getElementById("serviceTableWrap");
  wrap.innerHTML = "Loading...";
  try {
    const list = await loadServiceRequests();
    if (!list.length) {
      wrap.innerHTML = `<div class="empty-note">No service concerns reported.</div>`;
      return;
    }
    const rows = list.map((s) => `
      <tr>
        <td>${s.facilities?.name || "—"}</td>
        <td>${s.app_users?.full_name || "—"}</td>
        <td>${s.concern}</td>
        <td>${statusPill(s.status)}</td>
        <td>${fmt(s.created_at)}</td>
        <td>${
          currentUser.role === "Administrator" && s.status === "Open"
            ? `<button class="btn btn-sm" onclick="handleResolve('${s.id}')">Resolve</button>`
            : "—"
        }</td>
      </tr>
    `).join("");
    wrap.innerHTML = `<table><thead><tr><th>Facility</th><th>Reported By</th><th>Concern</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function handleResolve(id) {
  const result = await resolveServiceRequest(id);
  if (!result.ok) alert(result.message);
  renderServiceTab();
}

async function showNewServiceModal() {
  const facilities = await loadFacilities();
  const options = facilities.map((f) => `<option value="${f.id}">${f.name}</option>`).join("");
  openModal(`
    <h3>Report Facility Concern</h3>
    <div id="svcModalAlert"></div>
    <div class="field"><label>Facility</label><select id="sFacility">${options}</select></div>
    <div class="field"><label>Concern</label><textarea id="sConcern" rows="3" placeholder="Describe the issue"></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn" id="saveSvcBtn">Submit</button>
    </div>
  `);
  document.getElementById("saveSvcBtn").addEventListener("click", async () => {
    const facilityId = document.getElementById("sFacility").value;
    const facility = facilities.find((f) => f.id === facilityId);
    const concern = document.getElementById("sConcern").value.trim();
    if (!concern) {
      document.getElementById("svcModalAlert").innerHTML = `<div class="alert alert-error">Please describe the concern.</div>`;
      return;
    }
    const result = await createServiceRequest(facilityId, currentUser.id, concern, facility.name);
    if (!result.ok) {
      document.getElementById("svcModalAlert").innerHTML = `<div class="alert alert-error">${result.message}</div>`;
      return;
    }
    closeModal();
    renderServiceTab();
  });
}

// ------------------------------------------------------------
// Audit Logs
// ------------------------------------------------------------
async function renderAuditTab() {
  const wrap = document.getElementById("auditTableWrap");
  wrap.innerHTML = "Loading...";
  try {
    const logs = await loadAuditLogs();
    if (!logs.length) {
      wrap.innerHTML = `<div class="empty-note">No audit entries yet.</div>`;
      return;
    }
    const rows = logs.map((l) => `
      <tr>
        <td>${fmt(l.created_at)}</td>
        <td>${l.action}</td>
        <td>${l.table_name}</td>
        <td>${l.performed_by_name || "—"}</td>
        <td>${l.details || ""}</td>
      </tr>
    `).join("");
    wrap.innerHTML = `<table><thead><tr><th>Timestamp</th><th>Action</th><th>Table</th><th>Performed By</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) {
    wrap.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

init();
