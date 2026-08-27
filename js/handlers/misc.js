// ── Miscellaneous handlers ────────────────────────────────────────────────
const MiscHandlers = {

  // ── Toast ──────────────────────────────────────────────────────────────
  // Shows a toast notification and auto-dismisses it after a timeout.
  _toast: function(msg, type='success') {
    if(this._toastTimer) clearTimeout(this._toastTimer);
    this.setState({toast:{msg,type}});
    this._toastTimer=setTimeout(()=>this.setState({toast:null}),type==='error'?5000:3000);
  },

  dismissToast: function() {
    if(this._toastTimer) clearTimeout(this._toastTimer);
    this.setState({toast:null});
  },

  // Returns the effective department for the current user, respecting the superadmin dept filter.
  _myDept: function() {
    const s = this.state;
    if(s.isSuperAdmin && s.adminDeptFilter) return s.adminDeptFilter;
    return s.me?.department || 'ops_security';
  },

  onDeptSelect: function(e) { this.switchAdminDept(e.target.value); },

  switchAdminDept: async function(dept) {
    if(!this.state.isSuperAdmin || dept === this._myDept()) return;
    if(this.state.timesEditId){this._toast('Close the time editor before switching departments.','error');return;}
    const currentDept = this._myDept();
    const currentBatchId = this.state.batches[this.state.activeBatchIdx||0]?.id;
    const deptLastBatchId = {...(this.state.deptLastBatchId||{}), [currentDept]: currentBatchId};
    this.setState({adminDeptFilter:dept, batchLoading:true, deptLastBatchId, personnel:[], batches:[], viewOffset:0, rosterSearch:'', personHistoryId:null, personHistoryRows:[], pendingLeaves:[], pendingLeavesLoaded:false, leaveSearch:'', leaveSearchOpen:false, leaveTypeFilter:'all', pendingSignups:[], pendingSignupsLoaded:false, approvedSignups:[], rejectedSignups:[], rejectedSignupsLoaded:false, signupSearch:'', signupSearchOpen:false, signupTypeFilter:'all', adminsList:[], adminsLoaded:false, peopleStats:{}, peopleStatsLoaded:false, attendanceCache:{}, batchMembersCache:{}, noReportDaysCache:{}, confirmMarkAllAbsent:false});
    let batches = await DB.batches.list(dept).catch(()=>[]);
    batches = await this._ensureLiveBatch(batches, null, dept);
    batches = await this._ensureForwardBatches(batches, 8, dept);
    const liveIdx = batches.findIndex(b=>b.is_live);
    const savedBatchId = deptLastBatchId[dept];
    const savedIdx = savedBatchId ? batches.findIndex(b=>b.id===savedBatchId) : -1;
    const activeBatchIdx = savedIdx>=0 ? savedIdx : (liveIdx>=0?liveIdx:0);
    const activeBatch = batches[activeBatchIdx];
    const today = Utils.dateKey(this.baseDate());
    const [personnel, attendance, noReportDays] = await Promise.all([
      DB.personnel.list(null, true, dept),
      DB.attendance.getForDate(today),
      activeBatch ? DB.noReportDays.list(activeBatch.start_date, activeBatch.dekit_date||activeBatch.end_date) : Promise.resolve(new Set()),
    ]);
    this._unsubscribeRealtime();
    this.setState({batches, activeBatchIdx, personnel, attendance, attendanceDate:today, noReportDays, batchLoading:false});
    this._subscribeRealtime(today);
    this._subscribeAdminRequests();
    setTimeout(()=>Promise.all([
      this.loadRosterAvatars(),
      this.loadPendingLeaves(),
      this.loadPendingSignups(),
      this.loadApprovedSignups(),
      this.loadRejectedSignups(),
      this.loadAdmins(),
    ]), 0);
  },

  // ── Page refresh ───────────────────────────────────────────────────────
  refreshPage: async function() {
    const {role, me, demo} = this.state;
    if(demo || !me) return;
    const today = Utils.dateKey(this.baseDate());
    const dept = this._myDept();
    let batches = await DB.batches.list(dept).catch(()=>this.state.batches);
    if(role==='admin'){
      batches = await this._ensureLiveBatch(batches, null, dept).catch(()=>batches);
      batches = await this._ensureForwardBatches(batches, 8, dept).catch(()=>batches);
    }
    const liveIdx = batches.findIndex(b=>b.is_live);
    const activeBatchIdx = liveIdx>=0?liveIdx:this.state.activeBatchIdx||0;
    const activeBatch = batches[activeBatchIdx];
    const [attendance, noReportDays] = await Promise.all([
      DB.attendance.getForDate(today),
      activeBatch ? DB.noReportDays.list(activeBatch.start_date, activeBatch.dekit_date||activeBatch.end_date) : Promise.resolve(new Set()),
    ]);
    const history = role==='reservist' ? await DB.attendance.getHistory(me.id).catch(()=>[]) : this.state.history;
    let attendanceCache = {};
    if(activeBatch && !activeBatch.is_live){
      attendanceCache = await DB.attendance.getForBatch(activeBatch.start_date, activeBatch.end_date).catch(()=>({}));
    }
    const noReportDaysCache = activeBatch ? {[activeBatch.id]: noReportDays} : {};
    this.setState({batches, activeBatchIdx, attendance, noReportDays, history, attendanceCache, noReportDaysCache, historyLoaded:true});
  },

  // ── Navigation ─────────────────────────────────────────────────────────
  _scrollTop: function() { document.getElementById('main-scroll')?.scrollTo(0,0); },
  go: function(t) { return () => { this.setState({tab:t}); this._scrollTop(); }; },

  goPeople: function() {
    this.setState({tab:'people',peopleStatsLoaded:false,rejectedSignupsHidden:true,leaveSearch:'',leaveSearchOpen:false,leaveTypeFilter:'all',signupSearch:'',signupSearchOpen:false,signupTypeFilter:'all'});
    this.loadPeopleStats();
    this.loadRosterAvatars();
    this.loadPendingLeaves();
    this.loadPendingSignups();
    this.loadRejectedSignups();
    this._scrollTop();
  },

  setBriefTab: function(k) {
    return () => {
      this.setState({briefTab:k});
      if(k==='history' && this.state.role==='reservist' && !this.state.demo) {
        DB.leaves.myHistory(this.state.currentUserId)
          .then(hist=>{this.setState(s=>({myLeaveHistory:hist.length>0?hist:s.myLeaveHistory,myLeaveHistoryLoaded:true}));})
          .catch(()=>{});
      }
    };
  },
  selectCalDay: function(off) { return () => this.setState(s=>({selectedCalOffset:s.selectedCalOffset===off?null:off})); },

  // ── Helpers ────────────────────────────────────────────────────────────
  cur: function() { return this.state.me || this.state.personnel.find(p=>p.id===this.state.currentUserId) || null; },

  myRec: function() { return this.state.attendance[this.state.currentUserId]||{status:'pending'}; },

  // Returns the list of reservists for a given batch, using the members cache for past batches.
  _batchReservists: function(batch) {
    const {personnel, batchMembersCache} = this.state;
    const all = batch?.is_live
      ? personnel.filter(p => p.batch_id === batch.id)
      : (batchMembersCache[batch?.id] || []);
    return all.filter(p => (p.role || 'reservist') === 'reservist');
  },

  showMoreHistory: function() { this.setState(s=>({historyPage:(s.historyPage||1)+1})); },

  toggleRosterCard: function(id) {
    return () => this.setState(s => ({rosterExpandedId: s.rosterExpandedId === id ? null : id}));
  },

  toggleHistoryExpand: function(dateKey) {
    return () => this.setState(s=>{
      const a=[...(s.historyExpandedDates||[])];
      const i=a.indexOf(dateKey);
      if(i>=0) a.splice(i,1); else a.push(dateKey);
      return {historyExpandedDates:a};
    });
  },

  // ── Password visibility toggles ───────────────────────────────────────
  toggleLoginPw:   function() { this.setState(s=>({showLoginPw:!s.showLoginPw})); },
  toggleSuPw:      function() { this.setState(s=>({showSuPw:!s.showSuPw})); },
  toggleAcctPw:    function() { this.setState(s=>({showAcctPw:!s.showAcctPw})); },
  toggleNpPw:      function() { this.setState(s=>({showNpPw:!s.showNpPw})); },
  toggleBulkAddPw: function() { this.setState(s=>({showBulkAddPw:!s.showBulkAddPw})); },
  toggleNpAdminPw: function() { this.setState(s=>({showNpAdminPw:!s.showNpAdminPw})); },
  toggleResetPw:   function() { this.setState(s=>({showResetPw:!s.showResetPw})); },

  // ── Help ──────────────────────────────────────────────────────────────
  openHelp: function() { this.setState({helpOpen:true}); },
  closeHelp: function() { this.setState({helpOpen:false}); },

  // ── WhatsApp preview ──────────────────────────────────────────────────
  openWaPreview: function() { this.setState({waPreviewOpen:true}); },
  closeWaPreview: function() { this.setState({waPreviewOpen:false, waPreviewText:''}); },
  onWaPreviewText: function(e) { this.setState({waPreviewText:e.target.value}); },
  copyWaPreview: function() {
    const text=this.state.waPreviewText;
    if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>this._toast('Copied to clipboard.')).catch(()=>this._toast('Could not copy.','error'));}
    else{this._toast('Copy not supported.','error');}
  },
  copyContact: function(contact) {
    return (e) => {
      if(e){e.stopPropagation();e.preventDefault();}
      if(!contact) return;
      if(navigator.clipboard){navigator.clipboard.writeText(contact).then(()=>this._toast('Copied.')).catch(()=>this._toast('Could not copy.','error'));}
      else{this._toast('Copy not supported.','error');}
    };
  },
  sendWaPreview: function() {
    const {waPreviewText} = this.state;
    const link = 'https://api.whatsapp.com/send?text='+encodeURIComponent(waPreviewText);
    window.open(link, '_blank', 'noopener');
    this.setState({waPreviewOpen:false, waPreviewText:''});
  },

};
