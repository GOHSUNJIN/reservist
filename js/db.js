const { createClient } = supabase;
const _db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, storageKey: 'ops-auth' },
});

const DB = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    _email: c => c.replace(/[\s-]/g,'') + '@opsreservist.mil',

    async login(contact, password) {
      const { data, error } = await _db.auth.signInWithPassword({ email: this._email(contact), password });
      return { user: data?.user || null, error };
    },

    async signup(contact, password, name) {
      const { data, error } = await _db.auth.signUp({ email: this._email(contact), password,
        options: { emailRedirectTo: null, data: name ? { display_name: name } : undefined } });
      return { user: data?.user || null, error };
    },

    async syncDisplayName(name) {
      const { data } = await _db.auth.getUser();
      if(!data?.user) return;
      if(data.user.user_metadata?.display_name === name) return;
      await _db.auth.updateUser({ data: { display_name: name } });
    },

    async logout() { await _db.auth.signOut(); },

    async updatePassword(newPassword) {
      const { error } = await _db.auth.updateUser({ password: newPassword });
      return { error };
    },

    async session() {
      const { data } = await _db.auth.getSession();
      return data?.session?.user || null;
    },

    async refreshSession() {
      const { data, error } = await _db.auth.refreshSession();
      return { session: data?.session || null, error };
    },

    async createUserAsAdmin(contact, password, name) {
      const { data: sd } = await _db.auth.getSession();
      const session = sd?.session;
      const result = await this.signup(contact, password, name);
      if (session) {
        try { await _db.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
        catch { await _db.auth.refreshSession().catch(()=>{}); }
      }
      return result;
    },
  },

  // ── Personnel ─────────────────────────────────────────────────────────────
  personnel: {
    async list(batchId, activeOnly = true) {
      let q = _db.from('personnel').select('*').order('created_at');
      if (batchId) q = q.eq('batch_id', batchId);
      if (activeOnly) q = q.eq('is_active', true);
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
      const row = { name, contact, shift, batch_id: batchId, role, is_active: true };
      if (authId) row.auth_id = authId;
      const { data, error } = await _db.from('personnel').insert(row).select().maybeSingle();
      return { data, error };
    },

    async linkAuth(personnelId, authId) {
      await _db.from('personnel').update({ auth_id: authId }).eq('id', personnelId);
    },

    async deactivate(personnelId) {
      const { error } = await _db.from('personnel').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('id', personnelId);
      return { error };
    },

    async remove(personnelId) {
      await _db.from('personnel').delete().eq('id', personnelId);
    },

    async updateName(personnelId, name) {
      const { data, error } = await _db.from('personnel').update({ name }).eq('id', personnelId).select().maybeSingle();
      return { data, error };
    },

    async updateShift(personnelId, shift) {
      const { data, error } = await _db.from('personnel').update({ shift }).eq('id', personnelId).select().maybeSingle();
      return { data, error };
    },

    async updateNote(personnelId, notes) {
      const { data, error } = await _db.from('personnel').update({ notes }).eq('id', personnelId).select().maybeSingle();
      return { data, error };
    },

    async assignBatch(batchId) {
      await _db.from('personnel').update({batch_id:batchId}).is('batch_id',null).eq('is_active',true);
    },

    async carryOver(toBatchId) {
      const { error } = await _db.from('personnel')
        .update({ batch_id: toBatchId })
        .neq('batch_id', toBatchId)
        .not('batch_id', 'is', null)
        .eq('is_active', true)
        .eq('role', 'reservist');
      return { error };
    },
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  attendance: {
    _toEntry(r) {
      const t=s=>s?s.slice(0,5):null;
      return {
        status: r.status,
        p1: t(r.check_in_time),
        p1dist: r.gps_distance_m,
        p2: t(r.lunch_out_time),
        p3: t(r.work_return_time),
        p3dist: r.work_return_dist,
        p4: t(r.work_end_time),
        lateReason: r.late_reason || null,
      };
    },

    async getForDate(dateStr) {
      const { data } = await _db.from('attendance').select('*').eq('date', dateStr);
      return (data || []).reduce((acc, r) => { acc[r.personnel_id] = this._toEntry(r); return acc; }, {});
    },

    // Returns { [dateKey]: { [personnelId]: entry } } for supervisor past batch view
    async getForBatch(startDate, endDate) {
      const { data } = await _db.from('attendance').select('*').gte('date', startDate).lte('date', endDate);
      const result = {};
      for (const r of (data || [])) {
        if (!result[r.date]) result[r.date] = {};
        result[r.date][r.personnel_id] = this._toEntry(r);
      }
      return result;
    },

    async getHistory(personnelId) {
      const today = Utils.dateKey(new Date());
      const { data } = await _db.from('attendance')
        .select('*').eq('personnel_id', personnelId).lt('date', today)
        .order('date', { ascending: false }).limit(500);
      return data || [];
    },

    async upsert(personnelId, dateStr, status, extras = {}) {
      const row = { personnel_id: personnelId, date: dateStr, status };
      if (extras.time && extras.time !== '-') row.check_in_time = extras.time + ':00';
      if (extras.dist != null) row.gps_distance_m = extras.dist;
      const { data, error } = await _db.from('attendance')
        .upsert(row, { onConflict: 'personnel_id,date' }).select().maybeSingle();
      return { data, error };
    },

    async remove(personnelId, dateStr) {
      await _db.from('attendance').delete().eq('personnel_id', personnelId).eq('date', dateStr);
    },

    async logPhase(personnelId, dateStr, key, timeStr, dist) {
      const colMap={p1:'check_in_time',p2:'lunch_out_time',p3:'work_return_time',p4:'work_end_time'};
      const distMap={p1:'gps_distance_m',p3:'work_return_dist'};
      const row={personnel_id:personnelId,date:dateStr,status:'present',[colMap[key]]:timeStr+':00'};
      if(distMap[key]&&dist!=null) row[distMap[key]]=dist;
      const { error } = await _db.from('attendance').upsert(row,{onConflict:'personnel_id,date'});
      return { error };
    },

    async submitLateReason(personnelId, dateStr, reason) {
      const { error } = await _db.from('attendance')
        .update({ late_reason: reason })
        .eq('personnel_id', personnelId).eq('date', dateStr);
      return { error };
    },
  },

  // ── Batches ───────────────────────────────────────────────────────────────
  batches: {
    async list() {
      const { data } = await _db.from('batches').select('*').order('start_date');
      return data || [];
    },

    async create(label, startDate, endDate, dekitDate) {
      // Deactivate any previously live batch
      await _db.from('batches').update({ is_live: false }).eq('is_live', true);
      const { data, error } = await _db.from('batches').insert({
        label, start_date: startDate, end_date: endDate, dekit_date: dekitDate, is_live: true,
      }).select().maybeSingle();
      return { data, error };
    },

    async activate(batchId) {
      await _db.from('batches').update({ is_live: false }).eq('is_live', true);
      await _db.from('batches').update({ is_live: true }).eq('id', batchId);
    },

    async setMealActive(batchId, active) {
      await _db.from('batches').update({ meal_active: active }).eq('id', batchId);
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

  // ── Storage (MC files) ────────────────────────────────────────────────────
  storage: {
    async uploadAvatar(userId, file) {
      const { data, error } = await _db.storage.from('avatars').upload(userId, file, { upsert: true, contentType: file.type });
      return { path: data?.path || userId, error };
    },

    getAvatarUrl(userId) {
      const { data } = _db.storage.from('avatars').getPublicUrl(userId);
      return data?.publicUrl || null;
    },

    async deleteAvatar(userId) {
      const { error } = await _db.storage.from('avatars').remove([userId]);
      return { error };
    },

    getAvatarUrls(ids) {
      const result = {};
      for(const id of ids){
        const { data } = _db.storage.from('avatars').getPublicUrl(id);
        if(data?.publicUrl) result[id] = data.publicUrl;
      }
      return result;
    },

    async listAvatarIds() {
      const { data } = await _db.storage.from('avatars').list();
      return new Set((data || []).map(f => f.name));
    },
  },

  // ── Realtime ──────────────────────────────────────────────────────────────
  realtime: {
    subscribeAttendance(dateStr, onUpdate) {
      return _db.channel('attendance-' + dateStr)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `date=eq.${dateStr}` },
          payload => { if (payload.new) onUpdate(payload.new); })
        .subscribe();
    },

    unsubscribe(channel) {
      if (channel) _db.removeChannel(channel);
    },
  },

};
