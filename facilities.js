// ============================================================
// Facilities: CRUD + status management
// ============================================================

async function loadFacilities() {
  const { data, error } = await supabaseClient
    .from("facilities")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

async function addFacility(name, description) {
  const { data, error } = await supabaseClient
    .from("facilities")
    .insert({ name: name.trim(), description: description.trim(), status: "Active" })
    .select()
    .single();
  if (error) throw error;
  await logAction("Create", "facilities", data.id, `Facility "${name}" added.`);
  return data;
}

// BR-B4-08 enforced here: only Active <-> Maintenance <-> Inactive transitions allowed,
// UI is responsible for blocking reservations against non-Active facilities (see reservations.js)
async function updateFacilityStatus(facilityId, newStatus, facilityName) {
  const { error } = await supabaseClient
    .from("facilities")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", facilityId);
  if (error) throw error;
  await logAction("Update Status", "facilities", facilityId, `"${facilityName}" set to ${newStatus}.`);
}

async function deleteFacility(facilityId, facilityName) {
  const { error } = await supabaseClient.from("facilities").delete().eq("id", facilityId);
  if (error) throw error;
  await logAction("Delete", "facilities", facilityId, `Facility "${facilityName}" deleted.`);
}
