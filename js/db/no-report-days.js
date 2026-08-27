const DB_NoReportDays = {
  async list(startDate, endDate) {
    if (!startDate) return new Set();
    const { data } = await _db.from('no_report_days').select('date')
      .gte('date', startDate).lte('date', endDate || startDate);
    return new Set((data || []).map(r => r.date));
  },

  async toggle(dateStr) {
    const { data } = await _db.from('no_report_days').select('date').eq('date', dateStr).maybeSingle();
    if (data) {
      const { error } = await _db.from('no_report_days').delete().eq('date', dateStr);
      return { error, isOn: false };
    }
    const { error } = await _db.from('no_report_days').insert({ date: dateStr });
    return { error, isOn: true };
  },

  async ensure(dateStr) {
    const { data } = await _db.from('no_report_days').select('date').eq('date', dateStr).maybeSingle();
    if (!data) await _db.from('no_report_days').insert({ date: dateStr });
  },
};
