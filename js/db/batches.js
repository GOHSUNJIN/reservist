const DB_Batches = {
  async list(dept) {
    let q = _db.from('batches').select('*').order('start_date');
    if (dept) q = q.eq('department', dept);
    const { data } = await q;
    return data || [];
  },

  async create(label, startDate, endDate, dekitDate, dept) {
    // Guard against duplicate batches (e.g. two admins creating simultaneously)
    let dupCheck = _db.from('batches').select('id').eq('start_date', startDate);
    if (dept) dupCheck = dupCheck.eq('department', dept);
    const { data: dup } = await dupCheck.maybeSingle();
    if (dup) return { data: null, error: new Error('A batch with this start date already exists.') };

    // Deactivate the previously live batch within the same department only
    let deactivateQ = _db.from('batches').update({ is_live: false }).eq('is_live', true);
    if (dept) deactivateQ = deactivateQ.eq('department', dept);
    await deactivateQ;
    const row = { label, start_date: startDate, end_date: endDate, dekit_date: dekitDate, is_live: true };
    if (dept) row.department = dept;
    const { data, error } = await _db.from('batches').insert(row).select().maybeSingle();
    return { data, error };
  },

  async activate(batchId, dept) {
    let deactivateQ = _db.from('batches').update({ is_live: false }).eq('is_live', true);
    if (dept) deactivateQ = deactivateQ.eq('department', dept);
    await deactivateQ;
    await _db.from('batches').update({ is_live: true }).eq('id', batchId);
  },

  async remove(batchId) {
    const { error } = await _db.from('batches').delete().eq('id', batchId);
    return { error };
  },

  async setMealActive(batchId, active) {
    await _db.from('batches').update({ meal_active: active }).eq('id', batchId);
  },

  async updateLabel(batchId, label) {
    await _db.from('batches').update({ label }).eq('id', batchId);
  },

  async updateNotice(batchId, text) {
    const { data, error } = await _db.from('batches').update({ notice_text: text || null }).eq('id', batchId).select().maybeSingle();
    return { data, error };
  },
};
