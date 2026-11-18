// ============================================================
// Supabase connection config
// Replace these two values with your own project's credentials:
// Supabase Dashboard > Project Settings > API
// ============================================================
const SUPABASE_URL = "https://pfdvvpavnzsjyleffmts.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cNYZY_mbKSyMMAJQtmV6PA_dDGybU4d";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
