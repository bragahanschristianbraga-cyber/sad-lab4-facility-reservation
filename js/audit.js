// ============================================================
// Audit trail helper — BR-B4-10: approval and status changes must be logged.
// ============================================================

async function logAction(action, tableName, recordId, details) {
  const user = getCurrentUser();
  const { error } = await supabaseClient.from("audit_logs").insert({
    action,
    table_name: tableName,
    record_id: recordId,
    performed_by: user ? user.id : null,
    performed_by_name: user ? `${user.full_name} (${user.role})` : "System",
    details,
  });
  if (error) console.error("Audit log failed:", error.message);
}

async function loadAuditLogs() {
  const { data, error } = await supabaseClient
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}
