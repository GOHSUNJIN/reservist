// ── Admin view builder (index) ─────────────────────────────────────────────
const AdminBuilders = {

  _adminContext: function(s) {
    const batches=s.batches, activeBatchIdx=s.activeBatchIdx||0, activeBatch=batches[activeBatchIdx];
    const activeMembers=(activeBatch?.is_live?s.personnel.filter(p=>p.batch_id===activeBatch.id):(s.batchMembersCache?.[activeBatch?.id]||[])).filter(p=>(p.role||'reservist')==='reservist');
    const npShift='OFFICE';
    const todayForChips=Utils.dateKey(this.baseDate());
    const viewOffset=s.viewOffset||0, viewDate=this.dateForOffset(viewOffset), viewIsToday=viewOffset===0, viewReportDay=Utils.isReportDay(viewDate);
    const viewDateKey=Utils.dateKey(viewDate);
    const viewMap=viewIsToday?s.attendance:(s.attendanceCache?.[viewDateKey]||{});
    const viewBlocked=this.isNoReport(viewOffset);
    const isDekit=viewDateKey===activeBatch?.dekit_date;
    const viewShowReporting=viewReportDay&&!viewBlocked&&!isDekit;
    const liveBatch=batches.find(b=>b.is_live)||activeBatch;
    const _rmap=p=>{const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent'};return Utils.meta(r.status).label;};
    const present=activeMembers.filter(p=>_rmap(p)==='Present').length;
    const mc=activeMembers.filter(p=>_rmap(p)==='On MC').length;
    const pending=activeMembers.filter(p=>_rmap(p)==='Pending').length;
    const absent=activeMembers.filter(p=>_rmap(p)==='Absent').length;
    const _psVals=Object.values(s.peopleStats);
    const batchTotalPresent=_psVals.reduce((n,v)=>n+(v.present||0),0);
    const batchTotalMc=_psVals.reduce((n,v)=>n+(v.mc||0),0);
    const batchTotalAbsent=_psVals.reduce((n,v)=>n+(v.absent||0),0);
    const batchTotalDays=batchTotalPresent+batchTotalMc+batchTotalAbsent;
    const batchAvgPct=batchTotalDays>0?Math.round(batchTotalPresent/batchTotalDays*100):null;
    const approvedByContact=new Map((s.approvedSignups||[]).map(r=>[r.contact,r.reviewed_by||'Admin']));
    return {
      batches,activeBatchIdx,activeBatch,activeMembers,
      npShift,
      todayForChips,
      viewOffset,viewDate,viewIsToday,viewReportDay,viewDateKey,viewMap,viewBlocked,isDekit,viewShowReporting,
      liveBatch,
      present,mc,pending,absent,
      batchTotalPresent,batchTotalMc,batchTotalAbsent,batchAvgPct,
      approvedByContact,
    };
  },

  _buildAdmin: function(s, accent) {
    const ctx=this._adminContext(s);
    return {
      ...AdminBatch.build(this, s, accent, ctx),
      ...AdminRoster.build(this, s, accent, ctx),
      ...AdminPeople.build(this, s, accent, ctx),
    };
  },

};
