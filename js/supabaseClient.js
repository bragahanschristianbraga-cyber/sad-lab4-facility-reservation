// js/supabaseClient.js
const SUPABASE_URL = 'https://pfdvvpavnzsjyleffmts.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cNYZY_mbKSyMMAJQtmV6PA_dDGybU4d';

if (!window.supabase || !window.supabase.createClient) {
  throw new Error('Supabase library failed to load from the CDN.');
}

// Replaces the library namespace with the client, so `supabase.from(...)` works everywhere.
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Alias in case your other files use this name instead.
var supabaseClient = supabase;
