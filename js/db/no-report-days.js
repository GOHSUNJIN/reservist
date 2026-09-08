const DB_NoReportDays = {
  async list(startDate, endDate, dept) {
    if (!startDate) return new Set();
    let q = _db.from('no_report_days').select('date')
      .gte('date', startDate).lte('date', endDate || startDate);
    if (dept) q = q.eq('department', dept);
    const { data } = await q;
    return new Set((data || []).map(r => r.date));
  },

  async toggle(dateStr, dept) {
    let q = _db.from('no_report_days').select('date').eq('date', dateStr);
    if (dept) q = q.eq('department', dept);
    const { data } = await q.maybeSingle();
    if (data) {
      let dq = _db.from('no_report_days').delete().eq('date', dateStr);
      if (dept) dq = dq.eq('department', dept);
      const { error } = await dq;
      return { error, isOn: false };
    }
    const payload = { date: dateStr };
    if (dept) payload.department = dept;
    const { error } = await _db.from('no_report_days').insert(payload);
    return { error, isOn: true };
  },

  async ensure(dateStr, dept) {
    let q = _db.from('no_report_days').select('date').eq('date', dateStr);
    if (dept) q = q.eq('department', dept);
    const { data } = await q.maybeSingle();
    if (!data) {
      const payload = { date: dateStr };
      if (dept) payload.department = dept;
      await _db.from('no_report_days').insert(payload);
    }
  },
};
