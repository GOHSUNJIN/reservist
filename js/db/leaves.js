const DB_Leaves = {
  async listPending(dept) {
    let q = _db.from('leave_requests')
      .select('*, personnel!inner(name, shift, contact, department)')
      .eq('status', 'pending').order('created_at');
    if (dept) q = q.eq('personnel.department', dept);
    const { data } = await q;
    return data || [];
  },

  async request(personnelId, date, type, reason, requestedShift) {
    const row = { personnel_id: personnelId, date, type, reason: reason || null };
    if (requestedShift) row.requested_shift = requestedShift;
    const { data, error } = await _db.from('leave_requests').insert(row).select().maybeSingle();
    return { data, error };
  },

  async updateStatus(id, status, meta = {}) {
    const { data, error } = await _db.from('leave_requests').update({ status, ...meta }).eq('id', id).eq('status', 'pending').select().maybeSingle();
    return { data, error };
  },

  async myPending(personnelId) {
    const { data } = await _db.from('leave_requests')
      .select('*').eq('personnel_id', personnelId).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data || null;
  },

  async cancel(id) {
    const { data, error } = await _db.from('leave_requests').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending').select().maybeSingle();
    return { data, error };
  },

  async voidApprovedForDate(personnelId, date) {
    const { error } = await _db.from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('personnel_id', personnelId)
      .eq('date', date)
      .eq('status', 'approved');
    return { error };
  },

  async cancelStalePending(cutoffDate) {
    const { error } = await _db.from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('status', 'pending')
      .lt('date', cutoffDate);
    return { error };
  },

  async myHistory(personnelId) {
    const { data } = await _db.from('leave_requests')
      .select('*').eq('personnel_id', personnelId)
      .order('created_at', { ascending: false }).limit(20);
    return data || [];
  },

  async listApprovedForDate(date) {
    const { data } = await _db.from('leave_requests')
      .select('personnel_id, type').eq('date', date).eq('status', 'approved');
    return data || [];
  },

  async deleteOld(cutoffDate) {
    const { error } = await _db.from('leave_requests').delete().lt('date', cutoffDate);
    return { error };
  },
};
