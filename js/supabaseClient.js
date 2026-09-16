// ============================================================
// Supabase connection config
// Replace these two values with your own project's credentials:
// Supabase Dashboard > Project Settings > API
// ============================================================
const SUPABASE_URL = "https://sfnmzlzkfcpkarjfpnbf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbm16bHprZmNwa2FyamZwbmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTcyMzgsImV4cCI6MjEwNTA3MzIzOH0.bqdMIdxqKdQCOU2oXcAa6PgbRorqTUZy14-h8soELxQ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
