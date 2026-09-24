const DB_Leaves = {
  async listPending(dept) {
    let q = _db.from('leave_requests')
      .select('*, personnel!inner(name, shift, contact, department)')
      .eq('status', 'pending').order('created_at');
    if (dept) q = q.eq('personnel.department', dept);
    const { data } = await q;
    return data || [];
  },

  async request(personnelId, date, type, reason) {
    const row = { personnel_id: personnelId, date, type, reason: reason || null };
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
      .order('created_at', { ascending: false });
    return data || [];
  },

  async cancel(id) {
    const { error } = await _db.from('leave_requests').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending');
    return { error };
  },

  async voidApprovedForDate(personnelId, date) {
    const { error } = await _db.from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('personnel_id', personnelId)
      .eq('date', date)
      .eq('status', 'approved');
    return { error };
  },

  async cancelStalePending(cutoffDate, dept) {
    let q = _db.from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('status', 'pending')
      .lt('date', cutoffDate);
    if (dept) {
      const { data: people } = await _db.from('personnel').select('id').eq('department', dept);
      const ids = (people || []).map(p => p.id);
      if (!ids.length) return { error: null };
      q = q.in('personnel_id', ids);
    }
    const { error } = await q;
    return { error };
  },

  async myHistory(personnelId) {
    const { data } = await _db.from('leave_requests')
      .select('*').eq('personnel_id', personnelId)
      .order('created_at', { ascending: false }).limit(20);
    return data || [];
  },

  async approvedByPerson(personnelId) {
    const { data } = await _db.from('leave_requests')
      .select('date, type').eq('personnel_id', personnelId).eq('status', 'approved').neq('type', 'mc');
    return data || [];
  },

  async listApprovedForDate(date) {
    const { data } = await _db.from('leave_requests')
      .select('personnel_id, type, reason').eq('date', date).eq('status', 'approved');
    return data || [];
  },

  async listProcessed(dept, since, until) {
    let q = _db.from('leave_requests')
      .select('*, personnel!inner(name, contact, department)')
      .in('status', ['approved', 'rejected'])
      .order('date', { ascending: false })
      .limit(50);
    if (since) q = q.gte('date', since);
    if (until) q = q.lte('date', until);
    if (dept) q = q.eq('personnel.department', dept);
    const { data } = await q;
    return data || [];
  },

  async adminCreatePersonalLeave(personnelId, date, reviewedBy) {
    await _db.from('leave_requests').delete()
      .eq('personnel_id', personnelId).eq('date', date)
      .in('status', ['pending', 'approved'])
      .then(()=>{}, ()=>{});
    const { data, error } = await _db.from('leave_requests').insert({
      personnel_id: personnelId, date, type: 'personal', status: 'approved',
      reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
    }).select().maybeSingle();
    return { data, error };
  },

  async listApprovedInRange(startDate, endDate, dept) {
    let q = _db.from('leave_requests')
      .select('personnel_id, date, type, personnel!inner(department)')
      .eq('status', 'approved')
      .gte('date', startDate)
      .lte('date', endDate);
    if (dept) q = q.eq('personnel.department', dept);
    const { data } = await q;
    return data || [];
  },

  async cancelAllPendingByPerson(personnelId) {
    const { error } = await _db.from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('personnel_id', personnelId)
      .eq('status', 'pending');
    return { error };
  },

  async deleteOld(cutoffDate, dept) {
    let q = _db.from('leave_requests').delete().lt('date', cutoffDate);
    if (dept) {
      const { data: people } = await _db.from('personnel').select('id').eq('department', dept);
      const ids = (people || []).map(p => p.id);
      if (!ids.length) return { error: null };
      q = q.in('personnel_id', ids);
    }
    const { error } = await q;
    return { error };
  },
};
