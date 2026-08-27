const DB_Realtime = {
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

  subscribeAdminRequests(dept, onNew) {
    return _db.channel('admin-new-requests-' + (dept||'all'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leave_requests' },
        payload => { if (payload.new) onNew(payload.new); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signup_requests',
        ...(dept ? { filter: `department=eq.${dept}` } : {}) },
        payload => { if (payload.new) onNew({ _type: 'signup', ...payload.new }); })
      .subscribe();
  },

  unsubscribe(channel) {
    if (channel) _db.removeChannel(channel);
  },
};
