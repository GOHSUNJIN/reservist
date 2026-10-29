const DB_Personnel = {
  async list(batchId, activeOnly = true, dept) {
    let q = _db.from('personnel').select('*').order('created_at');
    if (batchId) q = q.eq('batch_id', batchId);
    if (activeOnly) q = q.eq('is_active', true);
    if (dept) q = q.eq('department', dept);
    const { data } = await q;
    return data || [];
  },

  async listAll(dept) {
    let q = _db.from('personnel').select('*').eq('role','reservist').order('name');
    if (dept) q = q.eq('department', dept);
    const { data } = await q;
    return data || [];
  },

  async get(authId) {
    const { data } = await _db.from('personnel').select('*').eq('auth_id', authId).maybeSingle();
    return data || null;
  },

  async findByContact(contact, dept) {
    const { data } = await _db.from('personnel').select('*').eq('contact', contact);
    if (!data || !data.length) return null;
    if (dept) {
      const deptMatch = data.find(p => p.is_active && p.department === dept) || data.find(p => p.department === dept);
      if (deptMatch) return deptMatch;
    }
    return data.find(p => p.is_active) || data[0];
  },

  async add({ authId, name, contact, batchId, role = 'reservist', department = 'ops_security' }) {
    const row = { name, contact, batch_id: batchId, role, is_active: true, department };
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

  async deletePermanently(personnelId, authId) {
    const { error: lErr } = await _db.from('leave_requests').delete().eq('personnel_id', personnelId);
    const { error: aErr } = await _db.from('attendance').delete().eq('personnel_id', personnelId);
    if (lErr || aErr) return { error: lErr || aErr };
    await _db.storage.from('avatars').remove([personnelId]).catch(()=>{});
    const { error: pErr } = await _db.from('personnel').delete().eq('id', personnelId);
    if (authId) await _db.rpc('delete_auth_user', { p_user_id: authId }).catch(()=>{});
    if (pErr) return { error: pErr };
    return { error: null };
  },

  async checkExists(personnelId) {
    const { data } = await _db.from('personnel').select('id').eq('id', personnelId).maybeSingle();
    return !!data;
  },

  async setCreatedBy(personnelId, createdBy) {
    const { error } = await _db.from('personnel').update({ created_by: createdBy }).eq('id', personnelId);
    return { error };
  },

  async reactivate(personnelId, { batchId, authId, department } = {}) {
    const updates = { is_active: true, deactivated_at: null };
    if (batchId !== undefined) updates.batch_id = batchId;
    if (authId !== undefined) updates.auth_id = authId;
    if (department !== undefined) updates.department = department;
    const { data, error } = await _db.from('personnel').update(updates).eq('id', personnelId).select().maybeSingle();
    return { data, error };
  },

  async updateName(personnelId, name) {
    const { data, error } = await _db.from('personnel').update({ name }).eq('id', personnelId).select().maybeSingle();
    return { data, error };
  },

  async updateTimings(personnelId, timings) {
    const { data, error } = await _db.from('personnel').update({ phase_timings: timings || null }).eq('id', personnelId).select().maybeSingle();
    return { data, error };
  },

  async updateNote(personnelId, notes) {
    const { data, error } = await _db.from('personnel').update({ notes }).eq('id', personnelId).select().maybeSingle();
    return { data, error };
  },

  async assignBatch(batchId, dept) {
    let q = _db.from('personnel').update({batch_id:batchId}).is('batch_id',null).eq('is_active',true);
    if (dept) q = q.eq('department', dept);
    await q;
  },

  async listAdmins(dept) {
    let q = _db.from('personnel').select('*').in('role', ['admin', 'master']).eq('is_active', true).order('created_at');
    if (dept) q = q.eq('department', dept);
    const { data } = await q;
    return data || [];
  },

  async demoteToReservist(personnelId) {
    const { error } = await _db.from('personnel')
      .update({ role: 'reservist', batch_id: null })
      .eq('id', personnelId);
    return { error };
  },

  async promoteToAdmin(personnelId) {
    const { data, error } = await _db.from('personnel')
      .update({ role: 'admin', batch_id: null })
      .eq('id', personnelId).select().maybeSingle();
    return { data, error };
  },

  async carryOver(toBatchId, dept) {
    let q = _db.from('personnel')
      .update({ batch_id: toBatchId })
      .neq('batch_id', toBatchId)
      .not('batch_id', 'is', null)
      .eq('is_active', true)
      .eq('role', 'reservist');
    if (dept) q = q.eq('department', dept);
    const { error } = await q;
    return { error };
  },
};
