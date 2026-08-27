const DB_Signups = {
  async create({ authId, name, contact, shift, batchId, department = 'ops_security' }) {
    const { data, error } = await _db.from('signup_requests')
      .insert({ auth_id: authId, name, contact, shift, batch_id: batchId, status: 'pending', department })
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

  async listPending(dept) {
    let q = _db.from('signup_requests').select('*').eq('status', 'pending').order('created_at');
    if (dept) q = q.eq('department', dept);
    const { data } = await q;
    return data || [];
  },

  async listApproved(dept) {
    let q = _db.from('signup_requests').select('*').eq('status', 'approved').order('reviewed_at', { ascending: false });
    if (dept) q = q.eq('department', dept);
    const { data } = await q;
    return data || [];
  },

  async listRejected(dept) {
    let q = _db.from('signup_requests').select('*').eq('status', 'rejected').order('reviewed_at', { ascending: false }).limit(50);
    if (dept) q = q.eq('department', dept);
    const { data } = await q;
    return data || [];
  },

  async reopen(id) {
    const { error } = await _db.from('signup_requests')
      .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
      .eq('id', id);
    return { error };
  },

  async approve(id, reviewerName) {
    const { data, error } = await _db.from('signup_requests')
      .update({ status: 'approved', reviewed_by: reviewerName, reviewed_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'pending').select().maybeSingle();
    return { data, error };
  },

  async reject(id, reviewerName) {
    const { error } = await _db.from('signup_requests')
      .update({ status: 'rejected', reviewed_by: reviewerName, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    return { error };
  },

  async deleteOldProcessed(currentBatchId) {
    if (!currentBatchId) return { error: null };
    const { error } = await _db.from('signup_requests')
      .delete()
      .in('status', ['approved', 'rejected'])
      .neq('batch_id', currentBatchId);
    return { error };
  },
};
