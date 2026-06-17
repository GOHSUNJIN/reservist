const { createClient } = supabase;
const _db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DB = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    _email: c => c.replace(/\s+/g,'') + '@opsreservist.mil',

    async login(contact, password) {
      const { data, error } = await _db.auth.signInWithPassword({ email: this._email(contact), password });
      return { user: data?.user || null, error };
    },

    async signup(contact, password) {
      const { data, error } = await _db.auth.signUp({ email: this._email(contact), password,
        options: { emailRedirectTo: null } });
      return { user: data?.user || null, error };
    },

    async logout() { await _db.auth.signOut(); },

    async session() {
      const { data } = await _db.auth.getSession();
      return data?.session?.user || null;
    },
  },

  // ── Personnel ─────────────────────────────────────────────────────────────
  personnel: {
    async list(batchId) {
      const q = _db.from('personnel').select('*').order('created_at');
      if (batchId) q.eq('batch_id', batchId);
      const { data } = await q;
      return data || [];
    },

    async get(authId) {
      const { data } = await _db.from('personnel').select('*').eq('auth_id', authId).maybeSingle();
      return data || null;
    },

    async findByContact(contact) {
      const { data } = await _db.from('personnel').select('*').eq('contact', contact).maybeSingle();
      return data || null;
    },

    async add({ authId, name, contact, shift, batchId, role = 'reservist' }) {
      const row = { name, contact, shift, batch_id: batchId, role };
      if (authId) row.auth_id = authId;
      const { data, error } = await _db.from('personnel').insert(row).select().maybeSingle();
      return { data, error };
    },

    async linkAuth(personnelId, authId) {
      await _db.from('personnel').update({ auth_id: authId }).eq('id', personnelId);
    },

    async remove(personnelId) {
      await _db.from('personnel').delete().eq('id', personnelId);
    },
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  attendance: {
    async getForDate(dateStr) {
      const { data } = await _db.from('attendance').select('*').eq('date', dateStr);
      return (data || []).reduce((acc, r) => {
        acc[r.personnel_id] = {
          status: r.status,
          time: r.check_in_time ? r.check_in_time.slice(0,5) : '-',
          dist: r.gps_distance_m,
          mc: r.mc_filename,
        };
        return acc;
      }, {});
    },

    async getHistory(personnelId) {
      const today = Utils.dateKey(new Date());
      const { data } = await _db.from('attendance')
        .select('*').eq('personnel_id', personnelId).lt('date', today)
        .order('date', { ascending: false }).limit(30);
      return data || [];
    },

    async upsert(personnelId, dateStr, status, extras = {}) {
      const row = { personnel_id: personnelId, date: dateStr, status };
      if (extras.time && extras.time !== '-') row.check_in_time = extras.time + ':00';
      if (extras.dist != null) row.gps_distance_m = extras.dist;
      if (extras.mc) row.mc_filename = extras.mc;
      const { data, error } = await _db.from('attendance')
        .upsert(row, { onConflict: 'personnel_id,date' }).select().maybeSingle();
      return { data, error };
    },

    async remove(personnelId, dateStr) {
      await _db.from('attendance').delete().eq('personnel_id', personnelId).eq('date', dateStr);
    },
  },

  // ── Batches ───────────────────────────────────────────────────────────────
  batches: {
    async list() {
      const { data } = await _db.from('batches').select('*').order('start_date');
      return data || [];
    },
  },

  // ── No-report days ────────────────────────────────────────────────────────
  noReportDays: {
    async list(startDate, endDate) {
      if (!startDate) return new Set();
      const { data } = await _db.from('no_report_days').select('date')
        .gte('date', startDate).lte('date', endDate || startDate);
      return new Set((data || []).map(r => r.date));
    },

    async toggle(dateStr) {
      const { data } = await _db.from('no_report_days').select('date').eq('date', dateStr).maybeSingle();
      if (data) {
        await _db.from('no_report_days').delete().eq('date', dateStr);
        return false;
      }
      await _db.from('no_report_days').insert({ date: dateStr });
      return true;
    },
  },

};
