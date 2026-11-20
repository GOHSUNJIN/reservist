const DB_Signups = {
  async create({ authId, name, contact, batchId, department = 'ops_security' }) {
    const { data, error } = await _db.from('signup_requests')
      .insert({ auth_id: authId, name, contact, batch_id: batchId, status: 'pending', department })
      .select().maybeSingle();
    return { data, error };
  },

  // Latest request for this account (declined ones are kept as history, so
  // there can be several).
  async getByAuthId(authId) {
    const { data } = await _db.from('signup_requests').select('*').eq('auth_id', authId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data || null;
  },

  // Declined applicant applies again (server enforces 3 per day).
  async reapply(department, batchId, name) {
    const { data, error } = await _db.rpc('reapply_signup', {
      p_department: department, p_batch_id: batchId || null, p_name: name || null,
    });
    return { data, error };
  },

  // Admin moves a pending or declined request to another department.
  async moveToDepartment(id, department) {
    const { data, error } = await _db.rpc('move_signup_request', { p_request_id: id, p_department: department });
    return { data, error };
  },

  // Approval links or creates the personnel row server-side (also handles a
  // returning reservist whose record is in another department).
  async approveAndEnrol(id) {
    const { data, error } = await _db.rpc('approve_signup', { p_request_id: id });
    return { data, error };
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
    let q = _db.from('signup_requests').select('*').eq('status', 'approved').order('reviewed_at', { ascending: false }).limit(50);
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

  async deletePendingById(id) {
    const { error } = await _db.from('signup_requests').delete().eq('id', id).eq('status', 'pending');
    return { error };
  },

  async reopen(id) {
    const { error } = await _db.from('signup_requests')
      .update({ status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null })
      .eq('id', id).eq('status', 'rejected');
    return { error };
  },

  async reject(id, reviewerName, reason) {
    const { error } = await _db.from('signup_requests')
      .update({ status: 'rejected', reviewed_by: reviewerName, reviewed_at: new Date().toISOString(),
                rejection_reason: (reason || '').trim() || null })
      .eq('id', id).eq('status', 'pending');
    return { error };
  },

  async deleteOldProcessed(currentBatchId, dept) {
    if (!currentBatchId || !dept) return { error: null };
    // Declined requests and the re-applications that followed them stay as history.
    let q = _db.from('signup_requests')
      .delete()
      .in('status', ['approved', 'rejected'])
      .is('superseded_by', null)
      .is('previous_request_id', null)
      .neq('batch_id', currentBatchId);
    if (dept) q = q.eq('department', dept);
    const { error } = await q;
    return { error };
  },
};
