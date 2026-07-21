// ── Miscellaneous handlers ────────────────────────────────────────────────
const MiscHandlers = {

  // ── Toast ──────────────────────────────────────────────────────────────
  _toast: function(msg, type='success') {
    if(this._toastTimer) clearTimeout(this._toastTimer);
    this.setState({toast:{msg,type}});
    this._toastTimer=setTimeout(()=>this.setState({toast:null}),type==='error'?5000:3000);
  },

  dismissToast: function() {
    if(this._toastTimer) clearTimeout(this._toastTimer);
    this.setState({toast:null});
  },

  // ── Page refresh ───────────────────────────────────────────────────────
  refreshPage: async function() {
    const {role, me, demo} = this.state;
    if(demo || !me) return;
    const today = Utils.dateKey(this.baseDate());
    let batches = await DB.batches.list().catch(()=>this.state.batches);
    if(role==='admin'){
      batches = await this._ensureLiveBatch(batches).catch(()=>batches);
      batches = await this._ensureForwardBatches(batches, 8).catch(()=>batches);
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
    this.setState({batches, activeBatchIdx, attendance, noReportDays, history, attendanceCache, noReportDaysCache});
  },

  // ── Navigation ─────────────────────────────────────────────────────────
  _scrollTop: function() { document.getElementById('main-scroll')?.scrollTo(0,0); },
  go: function(t) { return () => { this.setState({tab:t}); this._scrollTop(); }; },
  goCheckin:    function() { this.setState({tab:'checkin'}); this._scrollTop(); },
  goBriefings:  function() { this.setState({tab:'briefings'}); this._scrollTop(); },
  goAttendance: function() { this.setState({tab:'attendance'}); this._scrollTop(); },
  goMeal:       function() { this.setState({tab:'meal'}); this._scrollTop(); },
  goOverview:   function() { this.setState({tab:'overview'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
  goRoster:     function() { this.setState({tab:'roster'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
  goLog:        function() { this.setState({tab:'log'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },

  goPeople: function() {
    this.setState({tab:'people',peopleStatsLoaded:false});
    this.loadPeopleStats();
    this.loadRosterAvatars();
    this.loadPendingLeaves();
    this.loadPendingSignups();
    this._scrollTop();
  },

  setRolesTab:  function(k) { return () => this.setState({rolesTab:k}); },
  selectCalDay: function(off) { return () => this.setState(s=>({selectedCalOffset:s.selectedCalOffset===off?null:off})); },

  // ── Helpers ────────────────────────────────────────────────────────────
  cur: function() { return this.state.me || this.state.personnel.find(p=>p.id===this.state.currentUserId) || null; },

  myRec: function() { return this.state.attendance[this.state.currentUserId]||{status:'pending'}; },

  showMoreHistory: function() { this.setState(s=>({historyPage:(s.historyPage||1)+1})); },

  // ── Help ──────────────────────────────────────────────────────────────
  openHelp: function() { this.setState({helpOpen:true}); },
  closeHelp: function() { this.setState({helpOpen:false}); },

  // ── WhatsApp preview ──────────────────────────────────────────────────
  openWaPreview: function() { this.setState({waPreviewOpen:true}); },
  closeWaPreview: function() { this.setState({waPreviewOpen:false, waPreviewText:''}); },
  onWaPreviewText: function(e) { this.setState({waPreviewText:e.target.value}); },
  sendWaPreview: function() {
    const {waPreviewText} = this.state;
    const link = 'https://api.whatsapp.com/send?text='+encodeURIComponent(waPreviewText);
    window.open(link, '_blank', 'noopener');
    this.setState({waPreviewOpen:false, waPreviewText:''});
  },

  // ── Handover checklist ────────────────────────────────────────────────
  dismissHandover: function() {
    const batch = this.state.batches[this.state.activeBatchIdx||0];
    if(batch) localStorage.setItem('handover_'+batch.id, '1');
    this.setState({});
  },

};
