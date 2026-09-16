// ============================================================
// Simple session-based auth against the app_users table.
// Session is kept in sessionStorage (cleared on tab close).
// ============================================================

const SESSION_KEY = "frs_current_user";

function getCurrentUser() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = "index.html";
}

// Redirect to login if not authenticated. Call at the top of dashboard.html.
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  return user;
}

async function login(username, password) {
  const { data, error } = await supabaseClient
    .from("app_users")
    .select("*")
    .eq("username", username.trim())
    .eq("password", password)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, message: "Invalid username or password." };

  setCurrentUser({ id: data.id, username: data.username, full_name: data.full_name, role: data.role });
  return { ok: true, user: data };
}

async function registerRequester(username, password, fullName) {
  const { data: existing } = await supabaseClient
    .from("app_users")
    .select("id")
    .eq("username", username.trim())
    .maybeSingle();

  if (existing) return { ok: false, message: "Username already taken." };

  const { data, error } = await supabaseClient
    .from("app_users")
    .insert({ username: username.trim(), password, full_name: fullName.trim(), role: "Requester" })
    .select()
    .single();

  if (error) return { ok: false, message: error.message };
  return { ok: true, user: data };
}
