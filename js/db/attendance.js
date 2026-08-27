const DB_Attendance = {
  _toEntry(r) {
    const t=s=>s?s.slice(0,5):null;
    return {
      status: r.status,
      p1: t(r.check_in_time),
      p1dist: r.gps_distance_m,
      p2: t(r.lunch_out_time),
      p2dist: r.lunch_out_dist,
      p3: t(r.work_return_time),
      p3dist: r.work_return_dist,
      p4: t(r.work_end_time),
      p4dist: r.work_end_dist,
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

  async logPhase(personnelId, dateStr, key, timeStr, dist, bypassed = false) {
    const colMap = {p1:'check_in_time', p2:'lunch_out_time', p3:'work_return_time', p4:'work_end_time'};
    const distMap = {p1:'gps_distance_m', p2:'lunch_out_dist', p3:'work_return_dist', p4:'work_end_dist'};
    const payload = { status: 'present', [colMap[key]]: timeStr + ':00' };
    if (distMap[key] && dist != null) payload[distMap[key]] = dist;
    if (bypassed) payload.gps_bypassed = true;
    const existingId = await this._findRow(personnelId, dateStr);
    if (existingId) {
      // Prevent overwriting an approved MC and prevent stamping a time that's already recorded
      let updateQ = _db.from('attendance').update(payload).eq('id', existingId).is(colMap[key], null);
      if (key === 'p1') updateQ = updateQ.neq('status', 'mc');
      const { error } = await updateQ;
      return { error };
    }
    const { error } = await _db.from('attendance').insert({ personnel_id: personnelId, date: dateStr, ...payload });
    return { error };
  },

  async logPhaseNow(personnelId, dateStr, key, dist, bypassed = false) {
    const { data, error } = await _db.rpc('log_phase_now', {
      p_personnel_id: personnelId,
      p_date: dateStr,
      p_phase: key,
      p_dist: dist ?? null,
      p_bypassed: bypassed || false,
    });
    return { time: data || null, error };
  },

  async submitLateReason(personnelId, dateStr, reason) {
    const { error } = await _db.from('attendance')
      .update({ late_reason: reason })
      .eq('personnel_id', personnelId).eq('date', dateStr);
    return { error };
  },

  async setTimes(personnelId, dateStr, { p1, p2, p3, p4 }, editorName) {
    const { data: existing, error: fetchErr } = await _db.from('attendance')
      .select('id, edit_log, check_in_time, gps_bypassed')
      .eq('personnel_id', personnelId).eq('date', dateStr).maybeSingle();
    let editLog = [];
    if (!fetchErr) {
      const prevLog = Array.isArray(existing?.edit_log) ? existing.edit_log : [];
      editLog = [...prevLog, { by: editorName, at: new Date().toISOString() }];
    }
    // Only mark gps_bypassed if the check-in time is being changed; preserve it otherwise
    const existingP1 = existing?.check_in_time ? existing.check_in_time.slice(0, 5) : null;
    const p1Changed = existingP1 !== p1;
    const payload = {
      status: p1 ? 'present' : 'absent',
      gps_bypassed: p1Changed ? true : (existing?.gps_bypassed ?? false),
      check_in_time:    p1 ? p1 + ':00' : null,
      lunch_out_time:   p2 ? p2 + ':00' : null,
      work_return_time: p3 ? p3 + ':00' : null,
      work_end_time:    p4 ? p4 + ':00' : null,
      edit_log: editLog,
    };
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

  async saveMissedNote(personnelId, dateStr, note) {
    const existingId = await this._findRow(personnelId, dateStr);
    if (existingId) {
      const { error } = await _db.from('attendance').update({ welfare_note: note }).eq('id', existingId);
      return { error };
    }
    const { error } = await _db.from('attendance').insert({ personnel_id: personnelId, date: dateStr, status: 'missed', welfare_note: note });
    return { error };
  },
};
