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
        options: { data: name ? { display_name: name } : undefined } });
      return { user: data?.user || null, error };
    },

    async syncDisplayName(name) {
      const { data } = await _db.auth.getUser();
      if(!data?.user) return;
      if(data.user.user_metadata?.display_name === name) return;
      await _db.auth.updateUser({ data: { display_name: name } });
    },

    async logout() { await _db.auth.signOut({ scope: 'local' }).catch(()=>{}); },

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
      const row = { name, contact, shift: shift || null, batch_id: batchId, role, is_active: true };
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

    async reactivate(personnelId, { batchId, shift, authId } = {}) {
      const updates = { is_active: true, deactivated_at: null };
      if (batchId !== undefined) updates.batch_id = batchId;
      if (shift !== undefined) updates.shift = shift;
      if (authId !== undefined) updates.auth_id = authId;
      const { data, error } = await _db.from('personnel').update(updates).eq('id', personnelId).select().maybeSingle();
      return { data, error };
    },

    async updateName(personnelId, name) {
      const { data, error } = await _db.from('personnel').update({ name }).eq('id', personnelId).select().maybeSingle();
      return { data, error };
    },

    async updateShift(personnelId, shift) {
      const { data, error } = await _db.from('personnel').update({ shift: shift || null }).eq('id', personnelId).select().maybeSingle();
      return { data, error };
    },

    async updateNote(personnelId, notes) {
      const { data, error } = await _db.from('personnel').update({ notes }).eq('id', personnelId).select().maybeSingle();
      return { data, error };
    },

    async assignBatch(batchId) {
      await _db.from('personnel').update({batch_id:batchId}).is('batch_id',null).eq('is_active',true);
    },

    async listAdmins() {
      const { data } = await _db.from('personnel').select('*').in('role', ['admin', 'superadmin']).eq('is_active', true).order('created_at');
      return data || [];
    },

    async demoteToReservist(personnelId) {
      const { error } = await _db.from('personnel')
        .update({ role: 'reservist', batch_id: null, shift: null })
        .eq('id', personnelId);
      return { error };
    },

    async promoteToAdmin(personnelId) {
      const { data, error } = await _db.from('personnel')
        .update({ role: 'admin', shift: null, batch_id: null })
        .eq('id', personnelId).select().maybeSingle();
      return { data, error };
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
        welfareNote: r.welfare_note || null,
        gpsBypassed: r.gps_bypassed || false,
        editLog: r.edit_log || [],
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

    async getHistory(personnelId, cutoffDate) {
      const today = cutoffDate || Utils.dateKey(new Date());
      const { data } = await _db.from('attendance')
        .select('*').eq('personnel_id', personnelId).lt('date', today)
        .order('date', { ascending: false }).limit(500);
      return data || [];
    },

    async _findRow(personnelId, dateStr) {
      const { data } = await _db.from('attendance')
        .select('id').eq('personnel_id', personnelId).eq('date', dateStr).limit(1);
      return data?.[0]?.id || null;
    },

    async upsert(personnelId, dateStr, status, extras = {}) {
      const payload = { status };
      if (extras.time && extras.time !== '-') payload.check_in_time = extras.time + ':00';
      if (extras.dist != null) payload.gps_distance_m = extras.dist;
      const existingId = await this._findRow(personnelId, dateStr);
      if (existingId) {
        const { data, error } = await _db.from('attendance').update(payload).eq('id', existingId).select().maybeSingle();
        return { data, error };
      }
      const { data, error } = await _db.from('attendance').insert({ personnel_id: personnelId, date: dateStr, ...payload }).select().maybeSingle();
      return { data, error };
    },

    async remove(personnelId, dateStr) {
      await _db.from('attendance').delete().eq('personnel_id', personnelId).eq('date', dateStr);
    },

    async logPhase(personnelId, dateStr, key, timeStr, dist, bypassed = false) {
      const colMap = {p1:'check_in_time', p2:'lunch_out_time', p3:'work_return_time', p4:'work_end_time'};
      const distMap = {p1:'gps_distance_m', p3:'work_return_dist'};
      const payload = { status: 'present', [colMap[key]]: timeStr + ':00' };
      if (distMap[key] && dist != null) payload[distMap[key]] = dist;
      if (bypassed) payload.gps_bypassed = true;
      const existingId = await this._findRow(personnelId, dateStr);
      if (existingId) {
        const { error } = await _db.from('attendance').update(payload).eq('id', existingId);
        return { error };
      }
      const { error } = await _db.from('attendance').insert({ personnel_id: personnelId, date: dateStr, ...payload });
      return { error };
    },

    async submitLateReason(personnelId, dateStr, reason) {
      const { error } = await _db.from('attendance')
        .update({ late_reason: reason })
        .eq('personnel_id', personnelId).eq('date', dateStr);
      return { error };
    },

    async setTimes(personnelId, dateStr, { p1, p2, p3, p4 }, editorName) {
      const payload = { status: p1 ? 'present' : 'absent', gps_bypassed: true };
      payload.check_in_time    = p1 ? p1 + ':00' : null;
      payload.lunch_out_time   = p2 ? p2 + ':00' : null;
      payload.work_return_time = p3 ? p3 + ':00' : null;
      payload.work_end_time    = p4 ? p4 + ':00' : null;
      const { data: existing, error: fetchErr } = await _db.from('attendance').select('id, edit_log').eq('personnel_id', personnelId).eq('date', dateStr).maybeSingle();
      let editLog = [];
      if (!fetchErr) {
        const prevLog = Array.isArray(existing?.edit_log) ? existing.edit_log : [];
        editLog = [...prevLog, { by: editorName, at: new Date().toISOString() }];
        payload.edit_log = editLog;
      }
      const rowId = existing?.id || (!fetchErr ? null : await this._findRow(personnelId, dateStr));
      if (rowId) {
        const { error } = await _db.from('attendance').update(payload).eq('id', rowId);
        return { error, editLog };
      }
      const { error } = await _db.from('attendance').insert({ personnel_id: personnelId, date: dateStr, ...payload });
      return { error, editLog };
    },

    async saveWelfareNote(personnelId, dateStr, note) {
      const existingId = await this._findRow(personnelId, dateStr);
      if (existingId) {
        const { error } = await _db.from('attendance').update({ welfare_note: note }).eq('id', existingId);
        return { error };
      }
      const { error } = await _db.from('attendance').insert({ personnel_id: personnelId, date: dateStr, status: 'absent', welfare_note: note });
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

    async updateLabel(batchId, label) {
      await _db.from('batches').update({ label }).eq('id', batchId);
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

  // ── Leave requests ────────────────────────────────────────────────────────
  leaves: {
    async listPending() {
      const { data } = await _db.from('leave_requests')
        .select('*, personnel(name, shift, contact)')
        .eq('status', 'pending').order('created_at');
      return data || [];
    },

    async request(personnelId, date, type, reason, requestedShift) {
      const row = { personnel_id: personnelId, date, type, reason: reason || null };
      if (requestedShift) row.requested_shift = requestedShift;
      const { data, error } = await _db.from('leave_requests').insert(row).select().maybeSingle();
      return { data, error };
    },

    async updateStatus(id, status, meta = {}) {
      const { data, error } = await _db.from('leave_requests').update({ status, ...meta }).eq('id', id).select().maybeSingle();
      return { data, error };
    },

    async myPending(personnelId) {
      const { data } = await _db.from('leave_requests')
        .select('*').eq('personnel_id', personnelId).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      return data || null;
    },

    async myHistory(personnelId) {
      const { data } = await _db.from('leave_requests')
        .select('*').eq('personnel_id', personnelId)
        .order('created_at', { ascending: false }).limit(20);
      return data || [];
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

  // ── Signup requests ──────────────────────────────────────────────────────
  signupRequests: {
    async create({ authId, name, contact, shift, batchId }) {
      const { data, error } = await _db.from('signup_requests')
        .insert({ auth_id: authId, name, contact, shift, batch_id: batchId, status: 'pending' })
        .select().maybeSingle();
      return { data, error };
    },

    async getByAuthId(authId) {
      const { data } = await _db.from('signup_requests').select('*').eq('auth_id', authId).maybeSingle();
      return data || null;
    },

    async getByContact(contact) {
      const { data } = await _db.from('signup_requests').select('*').eq('contact', contact).order('created_at', { ascending: false }).limit(1).maybeSingle();
      return data || null;
    },

    async listPending() {
      const { data } = await _db.from('signup_requests').select('*').eq('status', 'pending').order('created_at');
      return data || [];
    },

    async listApproved() {
      const { data } = await _db.from('signup_requests').select('*').eq('status', 'approved').order('reviewed_at', { ascending: false });
      return data || [];
    },

    async approve(id, reviewerName) {
      const { data, error } = await _db.from('signup_requests')
        .update({ status: 'approved', reviewed_by: reviewerName, reviewed_at: new Date().toISOString() })
        .eq('id', id).select().maybeSingle();
      return { data, error };
    },

    async reject(id, reviewerName) {
      const { error } = await _db.from('signup_requests')
        .update({ status: 'rejected', reviewed_by: reviewerName, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      return { error };
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

    subscribeMyAttendance(personnelId, onUpdate) {
      return _db.channel('my-att-' + personnelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `personnel_id=eq.${personnelId}` },
          payload => { if (payload.new) onUpdate(payload.new); })
        .subscribe();
    },

    subscribeLeaveStatus(personnelId, onUpdate) {
      return _db.channel('leave-status-' + personnelId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leave_requests', filter: `personnel_id=eq.${personnelId}` },
          payload => { if (payload.new) onUpdate(payload.new); })
        .subscribe();
    },

    subscribeAdminRequests(onNew) {
      return _db.channel('admin-new-requests')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leave_requests' },
          payload => { if (payload.new) onNew(payload.new); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signup_requests' },
          payload => { if (payload.new) onNew({ _type: 'signup', ...payload.new }); })
        .subscribe();
    },

    unsubscribe(channel) {
      if (channel) _db.removeChannel(channel);
    },
  },

};
