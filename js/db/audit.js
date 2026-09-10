const DB_Audit = {
  async log(entry) {
    try {
      const { data: sd } = await _db.auth.getSession();
      const token = sd?.session?.access_token;
      if (!token) return;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(entry),
      });
      if (!res.ok) console.error('[audit_log] insert failed:', res.status, await res.text());
    } catch (e) {
      console.error('[audit_log] insert error:', e);
    }
  },

  async query({ dept, category, search, dateFrom, dateTo, limit = 100, offset = 0 } = {}) {
    let q = _db.from('audit_log').select('*', { count: 'exact' });
    if (dept) q = q.eq('department', dept);
    if (category && category !== 'all') q = q.eq('category', category);
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo);
    if (search) {
      const s = search.replace(/'/g, "''");
      q = q.or(`actor_name.ilike.%${s}%,action.ilike.%${s}%,target_name.ilike.%${s}%`);
    }
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, count, error } = await q;
    return { data: data || [], count: count || 0, error };
  },

  async todayStats(dept) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let q = _db.from('audit_log').select('category, actor_id, actor_name, action, created_at');
    if (dept) q = q.eq('department', dept);
    q = q.gte('created_at', today.toISOString());
    const { data } = await q;
    return data || [];
  },

  async weekStats(dept) {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    let q = _db.from('audit_log').select('category, created_at, department');
    if (dept) q = q.eq('department', dept);
    q = q.gte('created_at', d.toISOString());
    const { data } = await q;
    return data || [];
  },
};
