const { createClient } = supabase;
const _db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, storageKey: 'ops-auth' },
});
