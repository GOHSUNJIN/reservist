// ── Init and lifecycle handlers ───────────────────────────────────────────
const InitHandlers = {

  _init: async function() {
    const y = new Date().getFullYear();
    Utils.loadHolidays(y-1, y, y+1, y+2).catch(()=>{});
    const [batches, user] = await Promise.all([
      DB.batches.list().catch(()=>[]),
      DB.auth.session(),
    ]);
    if(batches.length){
      const liveIdx = batches.findIndex(b=>b.is_live);
      const activeBatchIdx = liveIdx>=0?liveIdx:0;
      const personnel = await DB.personnel.list().catch(()=>[]);
      this.setState({batches, activeBatchIdx, personnel});
    }
    if(user) await this._afterLogin(user, batches);
  },

  _afterLogin: async function(user, prefetchedBatches) {
    const me = await DB.personnel.get(user.id).catch(()=>null);
    if(!me){
      const req = await DB.signupRequests.getByAuthId(user.id).catch(()=>null);
      await DB.auth.logout();
      if(req?.status==='pending'){
        this.setState({authed:false,loading:false,authError:'Your account is pending admin approval. You will be able to log in once an admin approves your request.'});
      } else if(req?.status==='rejected'){
        this.setState({authed:false,loading:false,authError:'Your signup request was not approved. Please contact your supervisor.'});
      } else if(req?.status==='approved'){
        this.setState({authed:false,loading:false,authError:'Your signup was approved but your account setup is incomplete. Please contact your supervisor to fix this.'});
      } else {
        this.setState({authed:false,loading:false,authError:'Account setup incomplete. Please sign up again.'});
      }
      return;
    }
    if(!me.is_active){
      // Check if a re-enrollment request is already pending
      const existingReq = await DB.signupRequests.getByContact(me.contact).catch(()=>null);
      if(existingReq?.status==='pending'){
        await DB.auth.logout();
        this.setState({authed:false,loading:false,authError:'Your re-enrollment request is pending supervisor approval. You will be notified once it is approved.'});
        return;
      }
      // Auto-submit a re-enrollment request so the supervisor sees it in the Requests tab
      const batches = this.state.batches.length ? this.state.batches : await DB.batches.list().catch(()=>[]);
      const liveBatch = batches.find(b=>b.is_live);
      if(liveBatch){
        await DB.signupRequests.create({authId:user.id, name:me.name, contact:me.contact, shift:me.shift||'OFFICE', batchId:liveBatch.id}).catch(()=>{});
        await DB.auth.logout();
        this.setState({authed:false,loading:false,authError:'Your account is inactive for this cycle. A re-enrollment request has been sent to your supervisor. You will be able to log in once they approve it.'});
      } else {
        await DB.auth.logout();
        this.setState({authed:false,loading:false,authError:'Your account is inactive and there is no active cycle to enroll into. Please contact your supervisor.'});
      }
      return;
    }
    const _raw = localStorage.getItem('avatar_'+me.id);
    const _valid = _raw && _raw !== 'REMOVED' && (_raw.startsWith('http') || _raw.startsWith('data:'));
    const _invalid = _raw && _raw !== 'REMOVED' && !_valid;
    if(_invalid) localStorage.removeItem('avatar_'+me.id);
    if(_valid){
      this.setState(s=>({avatars:{...s.avatars,[me.id]:_raw}}));
      DB.storage.listAvatarIds().then(ids=>{
        if(!ids.has(me.id)){
          localStorage.removeItem('avatar_'+me.id);
          this.setState(s=>{const av={...s.avatars};delete av[me.id];return{avatars:av};});
        }
      }).catch(()=>{});
    } else if(!_raw || _invalid){
      DB.storage.listAvatarIds().then(ids=>{
        if(ids.has(me.id)){
          const url=DB.storage.getAvatarUrl(me.id);
          if(url){ this.setState(s=>({avatars:{...s.avatars,[me.id]:url}})); localStorage.setItem('avatar_'+me.id,url); }
        }
      }).catch(()=>{});
    }
    const isSuperAdmin = me.role === 'superadmin';
    const role = (me.role === 'superadmin' || me.role === 'admin') ? 'admin' : me.role || 'reservist';
    const today = Utils.dateKey(this.baseDate());

    let batches = (prefetchedBatches?.length) ? prefetchedBatches : await DB.batches.list().catch(()=>[]);
    if(role==='admin'){
      batches = await this._ensureLiveBatch(batches);
      batches = await this._ensureForwardBatches(batches, 8);
    }

    const liveIdx = batches.findIndex(b=>b.is_live);
    const activeBatchIdx = liveIdx>=0?liveIdx:0;
    const activeBatch = batches[activeBatchIdx];

    if(role==='reservist'){
      const myBatch = batches.find(b=>b.id===me.batch_id);
      if(myBatch?.dekit_date && today >= myBatch.dekit_date){
        const {error:deactivateErr} = await DB.personnel.deactivate(me.id).catch(()=>({error:true}));
        await DB.auth.logout();
        if(deactivateErr){
          this.setState({authed:false,role:null,authMode:'login',loading:false,authError:'Your cycle has ended but we could not fully deactivate your account. Please contact your supervisor.'});
        } else {
          this.setState({authed:false,role:null,authMode:'login',loading:false,accountDeleted:true});
        }
        return;
      }
    }

    const [personnel, attendance, noReportDays, history] = await Promise.all([
      DB.personnel.list(),
      DB.attendance.getForDate(today),
      activeBatch ? DB.noReportDays.list(activeBatch.start_date, activeBatch.dekit_date||activeBatch.end_date) : Promise.resolve(new Set()),
      DB.attendance.getHistory(me.id),
    ]);

    this.setState({
      authed:true, role,
      tab: role==='admin'?'overview':'checkin',
      currentUserId: me.id,
      me, personnel, batches, activeBatchIdx,
      attendance, noReportDays, history, attendanceDate: today, historyLoaded: true,
      authError:'', loading:false, accountDeleted:false, demo:false, isSuperAdmin,
    });
    if(role==='admin'){
      this._subscribeRealtime(today);
      setTimeout(()=>Promise.all([
        this.loadRosterAvatars(),
        this.loadPendingLeaves(),
        this.loadPendingSignups(),
        this.loadApprovedSignups(),
        this.loadRejectedSignups(),
      ]), 0);
      this._subscribeAdminRequests();
      if(typeof Notification !== 'undefined' && Notification.permission !== 'granted'){
        localStorage.removeItem('admin_notif');
        this.setState({adminNotifGranted:false});
      }
      if(isSuperAdmin) setTimeout(()=>this.loadAdmins(), 0);
    }
    if(role==='reservist'){
      DB.leaves.myPending(me.id).then(req=>this.setState({myPendingRequest:req})).catch(()=>{});
      DB.leaves.myHistory(me.id).then(hist=>this.setState({myLeaveHistory:hist,myLeaveHistoryLoaded:true})).catch(()=>{});
      this._myAttendanceChannel = DB.realtime.subscribeMyAttendance(me.id, (row) => {
        const todayKey = Utils.dateKey(this.baseDate());
        if(row.date === todayKey){
          this.setState(s=>{
            const existing=s.attendance[s.currentUserId]||{};
            const incoming=DB.attendance._toEntry(row);
            const merged={};
            for(const k of Object.keys(incoming)) merged[k]=incoming[k]??existing[k];
            return {attendance:{...s.attendance,[s.currentUserId]:merged}};
          });
        }
      });
      this._myLeaveChannel = DB.realtime.subscribeLeaveStatus(me.id, async (row) => {
        if(row.status !== 'pending'){
          this.setState({myPendingRequest:null});
          if(row.status === 'rejected'){
            this._toast('Your absence request was declined.');
            DB.leaves.myHistory(me.id).then(hist=>this.setState({myLeaveHistory:hist,myLeaveHistoryLoaded:true})).catch(()=>{});
          }
          if(row.status === 'approved'){
            this._toast('Your absence request was approved.');
            const att = await DB.attendance.getForDate(Utils.dateKey(this.baseDate())).catch(()=>this.state.attendance);
            this.setState({attendance:att});
          }
        }
      });
    }
    if(!this.state.demo) DB.auth.syncDisplayName(me.name).catch(()=>{});
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    this._sessionWarnTimer = setTimeout(()=>{ if(this.state.authed) this.setState({sessionExpiring:true}); }, 55*60*1000);
    setTimeout(()=>{ if(this._shouldShowA2hs()){ localStorage.setItem('a2hs_seen',Date.now().toString()); this.setState({showA2hs:true, a2hsIsIos:/iP(hone|od|ad)/.test(navigator.userAgent||'')}); } }, 30000);
    this._resetIdleTimer();
  },

  _onDateChange: async function(newDate) {
    if(!this.state.authed || this.state.demo) return;
    if(this.state.role==='admin'){
      const {attendanceDate:yesterday, attendance:yesterdayAtt, personnel, noReportDays} = this.state;
      if(yesterday && Utils.isReportDay(new Date(yesterday+'T00:00:00')) && !noReportDays.has(yesterday)){
        const [approvedLeaves, freshPendingLeaves] = await Promise.all([
          DB.leaves.listApprovedForDate(yesterday).catch(()=>[]),
          DB.leaves.listPending().catch(()=>[]),
        ]);
        const approvedLeaveIds = new Set(approvedLeaves.map(l=>l.personnel_id));
        const pendingLeavesForYesterday = freshPendingLeaves.filter(l=>l.date===yesterday);
        const pending = personnel.filter(p=>{
          const r = yesterdayAtt[p.id];
          if(p.role !== 'reservist') return false;
          if(r && r.status !== 'pending') return false;
          if(approvedLeaveIds.has(p.id)) return false;
          return !pendingLeavesForYesterday.some(l => l.personnel_id === p.id);
        });
        if(pending.length) await Promise.all(pending.map(p=>DB.attendance.upsert(p.id, yesterday, 'absent', {}).catch(()=>{})));
      }
      let batches = await DB.batches.list().catch(()=>this.state.batches);
      batches = await this._ensureLiveBatch(batches, newDate);
      const liveIdx = batches.findIndex(b=>b.is_live);
      const activeBatch = batches[liveIdx>=0?liveIdx:0];
      const [att, nrd] = await Promise.all([
        DB.attendance.getForDate(newDate).catch(()=>({})),
        activeBatch ? DB.noReportDays.list(activeBatch.start_date, activeBatch.dekit_date||activeBatch.end_date).catch(()=>new Set()) : Promise.resolve(new Set()),
      ]);
      this._unsubscribeRealtime();
      this._subscribeRealtime(newDate);
      this.setState({batches, activeBatchIdx:liveIdx>=0?liveIdx:0, attendance:att, attendanceDate:newDate, noReportDays:nrd, viewOffset:0, attendanceCache:{}, confirmMarkAllAbsent:false});
    } else if(this.state.role==='reservist'){
      const [att, hist] = await Promise.all([
        DB.attendance.getForDate(newDate).catch(()=>({})),
        DB.attendance.getHistory(this.state.currentUserId).catch(()=>[]),
      ]);
      this.setState({attendance:att, attendanceDate:newDate, history:hist, historyLoaded:true});
    }
  },

  _ensureLiveBatch: async function(batches, overrideDate) {
    const today = overrideDate || Utils.dateKey(this.baseDate());
    const live = batches.find(b=>b.is_live);
    if(live && live.start_date<=today && today<=live.end_date) return batches;
    const current = batches.find(b=>b.start_date<=today && today<=b.end_date);
    if(current){
      await DB.batches.activate(current.id).catch(()=>{});
      return DB.batches.list().catch(()=>batches);
    }
    let sorted = [...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
    for(let attempt=0; attempt<20; attempt++){
      const lastBatch = sorted[sorted.length-1];
      const fromDate = lastBatch?.end_date
        ? Utils.addDays(new Date(lastBatch.end_date+'T00:00:00'), 1)
        : new Date(today+'T00:00:00');
      const nextTue = Utils.nextBatchTuesday(fromDate);
      const {start,end,dekit} = Utils.batchDatesFrom(nextTue);
      const startStr=Utils.dateKey(start), endStr=Utils.dateKey(end), dekitStr=Utils.dateKey(dekit);
      const sameYear = sorted.filter(b=>b.start_date.slice(0,4)===startStr.slice(0,4));
      const maxNum = sameYear.reduce((m,b)=>Math.max(m,parseInt((b.label||'').match(/^Cycle (\d+)\//)?.[1]||0, 10)),0);
      const label = Utils.batchLabel(startStr, endStr, maxNum+1);
      const {data} = await DB.batches.create(label, startStr, endStr, dekitStr).catch(()=>({}));
      if(data){ sorted.push(data); }
      if(startStr<=today && today<=dekitStr){
        if(data?.id) await DB.personnel.assignBatch(data.id).catch(()=>{});
        break;
      }
      if(startStr>today) break;
    }
    return DB.batches.list().catch(()=>sorted);
  },

  _ensureForwardBatches: async function(batches, ahead=3) {
    const today = Utils.dateKey(this.baseDate());
    let sorted = [...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const futureBatches = sorted.filter(b=>b.start_date>today);
    const needed = ahead-futureBatches.length;
    if(needed<=0) return batches;
    const prevLiveId = sorted.find(b=>b.is_live)?.id;
    for(let i=0; i<needed; i++){
      const lastBatch = sorted[sorted.length-1];
      const fromDate = lastBatch?.end_date
        ? Utils.addDays(new Date(lastBatch.end_date+'T00:00:00'), 1)
        : new Date(today+'T00:00:00');
      const nextTue = Utils.nextBatchTuesday(fromDate);
      const {start,end,dekit} = Utils.batchDatesFrom(nextTue);
      const startStr=Utils.dateKey(start), endStr=Utils.dateKey(end), dekitStr=Utils.dateKey(dekit);
      const sameYear = sorted.filter(b=>b.start_date.slice(0,4)===startStr.slice(0,4));
      const maxNum = sameYear.reduce((m,b)=>Math.max(m,parseInt((b.label||'').match(/^Cycle (\d+)\//)?.[1]||0, 10)),0);
      const label = Utils.batchLabel(startStr, endStr, maxNum+1);
      const {data} = await DB.batches.create(label, startStr, endStr, dekitStr).catch(()=>({}));
      if(data) sorted.push(data); else break;
    }
    if(prevLiveId){
      await DB.batches.activate(prevLiveId).catch(()=>{});
    } else {
      const fresh = await DB.batches.list().catch(()=>sorted);
      return this._ensureLiveBatch(fresh);
    }
    return DB.batches.list().catch(()=>sorted);
  },

  _loadDateAttendance: async function(off) {
    if(off===0) return;
    const d = this.dateForOffset(off);
    const dk = Utils.dateKey(d);
    if(this.state.attendanceCache[dk]) return;
    const data = await DB.attendance.getForDate(dk).catch(()=>({}));
    this.setState(s=>{
      const cache={...s.attendanceCache,[dk]:data};
      const keys=Object.keys(cache).sort();
      if(keys.length>30) keys.slice(0,keys.length-30).forEach(k=>delete cache[k]);
      return {attendanceCache:cache};
    });
  },

  _liveBatch: function(batches) {
    const list = batches || this.state.batches;
    return list.find(b=>b.is_live) || list[0] || null;
  },

  _resetIdleTimer: function() {
    this._lastActiveAt = Date.now();
    if(this._idleWarnTimer) clearTimeout(this._idleWarnTimer);
    if(this._idleLogoutTimer) clearTimeout(this._idleLogoutTimer);
    if(this.state.idleWarning) this.setState({idleWarning:false});
    this._idleWarnTimer = setTimeout(()=>{ if(this.state.authed) this.setState({idleWarning:true}); }, 18*60*1000);
    this._idleLogoutTimer = setTimeout(()=>{ if(this.state.authed){ this._toast('Logged out due to inactivity.'); this.logout(); } }, 20*60*1000);
  },

  _unsubscribeRealtime: function() {
    DB.realtime.unsubscribe(this.state.realtimeChannel);
    if(this._myLeaveChannel){ DB.realtime.unsubscribe(this._myLeaveChannel); this._myLeaveChannel = null; }
    if(this._myAttendanceChannel){ DB.realtime.unsubscribe(this._myAttendanceChannel); this._myAttendanceChannel = null; }
    if(this._adminRequestsChannel){ DB.realtime.unsubscribe(this._adminRequestsChannel); this._adminRequestsChannel = null; }
  },

};
