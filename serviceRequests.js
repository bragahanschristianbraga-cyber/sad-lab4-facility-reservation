// ============================================================
// Service requests: Facility Staff report concerns about a facility
// ============================================================

async function loadServiceRequests() {
  const { data, error } = await supabaseClient
    .from("service_requests")
    .select("*, facilities(name), app_users(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function createServiceRequest(facilityId, staffId, concern, facilityName) {
  const { data, error } = await supabaseClient
    .from("service_requests")
    .insert({ facility_id: facilityId, staff_id: staffId, concern: concern.trim(), status: "Open" })
    .select()
    .single();
  if (error) return { ok: false, message: error.message };

  await logAction("Create", "service_requests", data.id, `Concern raised for "${facilityName}".`);
  return { ok: true, request: data };
}

async function resolveServiceRequest(requestId) {
  const { error } = await supabaseClient
    .from("service_requests")
    .update({ status: "Resolved" })
    .eq("id", requestId);
  if (error) return { ok: false, message: error.message };

  await logAction("Resolve", "service_requests", requestId, "Service concern marked Resolved.");
  return { ok: true };
}
