// ============================================================
// Reservations: workflow + business rule enforcement
// Statuses: Pending, Approved, Rejected, Scheduled, In Use, Completed, Cancelled
// ============================================================

async function loadReservations() {
  const { data, error } = await supabaseClient
    .from("reservations")
    .select("*, facilities(name, status), app_users(full_name, username)")
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data;
}

async function loadMyReservations(requesterId) {
  const all = await loadReservations();
  return all.filter((r) => r.requester_id === requesterId);
}

// BR-B4-03: overlapping approved/scheduled/in-use schedules are prohibited for a facility.
// Checked both at submission time (TC-B4-02) and again right before approval.
async function hasConflict(facilityId, startTime, endTime, excludeReservationId = null) {
  const { data, error } = await supabaseClient
    .from("reservations")
    .select("id, start_time, end_time, status")
    .eq("facility_id", facilityId)
    .in("status", ["Approved", "Scheduled", "In Use"]);
  if (error) throw error;

  const newStart = new Date(startTime).getTime();
  const newEnd = new Date(endTime).getTime();

  return data.some((r) => {
    if (excludeReservationId && r.id === excludeReservationId) return false;
    const existingStart = new Date(r.start_time).getTime();
    const existingEnd = new Date(r.end_time).getTime();
    return newStart < existingEnd && newEnd > existingStart; // overlap test
  });
}

// BR-B4-01 / BR-B4-02 / BR-B4-03 / BR-B4-08 enforced here.
async function submitReservation(facility, requesterId, purpose, startTime, endTime) {
  if (facility.status !== "Active") {
    return { ok: false, message: "This facility is not available for reservation (not Active)." };
  }
  if (new Date(startTime) >= new Date(endTime)) {
    return { ok: false, message: "Start time must be before end time." };
  }
  const conflict = await hasConflict(facility.id, startTime, endTime);
  if (conflict) {
    return { ok: false, message: "Schedule conflict: this facility is already booked for an overlapping time." };
  }

  const { data, error } = await supabaseClient
    .from("reservations")
    .insert({
      facility_id: facility.id,
      requester_id: requesterId,
      purpose: purpose.trim(),
      start_time: startTime,
      end_time: endTime,
      status: "Pending",
    })
    .select()
    .single();
  if (error) return { ok: false, message: error.message };

  await logAction("Submit", "reservations", data.id, `Reservation for "${facility.name}" submitted (Pending).`);
  return { ok: true, reservation: data };
}

// BR-B4-04: only Administrator may approve (enforced by only rendering this action for Administrator role).
// Approve moves Pending -> Approved & Scheduled in one step, reserving the slot (BR-B4-06).
async function approveReservation(reservation) {
  const conflict = await hasConflict(reservation.facility_id, reservation.start_time, reservation.end_time, reservation.id);
  if (conflict) {
    return { ok: false, message: "Cannot approve: another reservation now conflicts with this time slot." };
  }
  const { error } = await supabaseClient
    .from("reservations")
    .update({ status: "Scheduled", updated_at: new Date().toISOString() })
    .eq("id", reservation.id);
  if (error) return { ok: false, message: error.message };

  await logAction("Approve", "reservations", reservation.id, "Reservation approved and scheduled.");
  return { ok: true };
}

// BR-B4-05: rejected reservations cannot later become Scheduled — enforced by only allowing
// reject from Pending, and never offering "approve" once a reservation is Rejected.
async function rejectReservation(reservation) {
  const { error } = await supabaseClient
    .from("reservations")
    .update({ status: "Rejected", updated_at: new Date().toISOString() })
    .eq("id", reservation.id);
  if (error) return { ok: false, message: error.message };

  await logAction("Reject", "reservations", reservation.id, "Reservation rejected.");
  return { ok: true };
}

// Facility Staff: Scheduled -> In Use
async function markInUse(reservation) {
  if (reservation.status !== "Scheduled") {
    return { ok: false, message: "Only Scheduled reservations can be marked In Use." };
  }
  const { error } = await supabaseClient
    .from("reservations")
    .update({ status: "In Use", updated_at: new Date().toISOString() })
    .eq("id", reservation.id);
  if (error) return { ok: false, message: error.message };

  await logAction("Confirm Usage", "reservations", reservation.id, "Facility usage confirmed (In Use).");
  return { ok: true };
}

// Facility Staff: In Use -> Completed. BR-B4-07: Completed reservations cannot be edited afterward
// (enforced by the UI hiding all action buttons once status === "Completed").
async function markCompleted(reservation) {
  if (reservation.status !== "In Use") {
    return { ok: false, message: "Only reservations that are In Use can be marked Completed." };
  }
  const { error } = await supabaseClient
    .from("reservations")
    .update({ status: "Completed", updated_at: new Date().toISOString() })
    .eq("id", reservation.id);
  if (error) return { ok: false, message: error.message };

  await logAction("Complete", "reservations", reservation.id, "Reservation marked Completed.");
  return { ok: true };
}

// BR-B4-09: requesters may modify (cancel) only their own Pending requests.
async function cancelReservation(reservation, currentUserId) {
  if (reservation.requester_id !== currentUserId) {
    return { ok: false, message: "You can only cancel your own reservations." };
  }
  if (reservation.status !== "Pending") {
    return { ok: false, message: "Only Pending reservations can be cancelled." };
  }
  const { error } = await supabaseClient
    .from("reservations")
    .update({ status: "Cancelled", updated_at: new Date().toISOString() })
    .eq("id", reservation.id);
  if (error) return { ok: false, message: error.message };

  await logAction("Cancel", "reservations", reservation.id, "Reservation cancelled by requester.");
  return { ok: true };
}
