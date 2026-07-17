// ── Event handlers, data loaders, and helpers ────────────────────────────
// All methods are regular functions so they can be bound to the component
// instance in the constructor. Arrow returns inside curried handlers capture
// `this` from the bound outer function.
const Handlers = {

  // ── Data loading ──────────────────────────────────────────────────────
  _init: async function() {
    const y = new Date().getFullYear();
    Utils.loadHolidays(y-1, y, y+1, y+2).catch(()=>{});
    const batches = await DB.batches.list().catch(()=>[]);
    if(batches.length){
      const liveIdx = batches.findIndex(b=>b.is_live);
      const activeBatchIdx = liveIdx>=0?liveIdx:0;
      const personnel = await DB.personnel.list().catch(()=>[]);
      this.setState({batches, activeBatchIdx, personnel});
    }
    const user = await DB.auth.session();
    if(user) await this._afterLogin(user);
  },

  _afterLogin: async function(user) {
    const me = await DB.personnel.get(user.id);
    if(!me){
      const req = await DB.signupRequests.getByAuthId(user.id).catch(()=>null);
      await DB.auth.logout();
      if(req?.status==='pending'){
        this.setState({authed:false,loading:false,authError:'Your account is pending admin approval. You will be able to log in once an admin approves your request.'});
      } else if(req?.status==='rejected'){
        this.setState({authed:false,loading:false,authError:'Your signup request was not approved. Please contact your supervisor.'});
      } else {
        this.setState({authed:false,loading:false,authError:'Account setup incomplete. Please sign up again.'});
      }
      return;
    }
    const cachedAvatar = localStorage.getItem('avatar_'+me.id);
    if(cachedAvatar && cachedAvatar !== 'REMOVED'){
      this.setState(s=>({avatars:{...s.avatars,[me.id]:cachedAvatar}}));
      DB.storage.listAvatarIds().then(ids=>{
        if(!ids.has(me.id)){
          localStorage.removeItem('avatar_'+me.id);
          this.setState(s=>{const av={...s.avatars};delete av[me.id];return{avatars:av};});
        }
      }).catch(()=>{});
    } else if(!cachedAvatar){
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

    let batches = await DB.batches.list().catch(()=>[]);
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
        await DB.personnel.deactivate(me.id).catch(()=>{});
        await DB.auth.logout();
        this.setState({authed:false,role:null,authMode:'login',loading:false,accountDeleted:true});
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
      attendance, noReportDays, history, attendanceDate: today,
      authError:'', loading:false, accountDeleted:false, demo:false, isSuperAdmin,
    });
    if(role==='admin'){
      this._subscribeRealtime(today);
      setTimeout(()=>this.loadRosterAvatars(), 0);
      setTimeout(()=>this.loadPendingLeaves(), 0);
      setTimeout(()=>this.loadPendingSignups(), 0);
      setTimeout(()=>this.loadApprovedSignups(), 0);
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
          if(row.status === 'rejected') this._toast('Your absence request was declined.');
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

  _resetIdleTimer: function() {
    this._lastActiveAt = Date.now();
    if(this._idleWarnTimer) clearTimeout(this._idleWarnTimer);
    if(this._idleLogoutTimer) clearTimeout(this._idleLogoutTimer);
    if(this.state.idleWarning) this.setState({idleWarning:false});
    this._idleWarnTimer = setTimeout(()=>{ if(this.state.authed) this.setState({idleWarning:true}); }, 18*60*1000);
    this._idleLogoutTimer = setTimeout(()=>{ if(this.state.authed){ this._toast('Logged out due to inactivity.'); this.logout(); } }, 20*60*1000);
  },

  stayActive: function() { this._resetIdleTimer(); },

  _onDateChange: async function(newDate) {
    if(!this.state.authed || this.state.demo) return;
    if(this.state.role==='admin'){
      const {attendanceDate:yesterday, attendance:yesterdayAtt, personnel, noReportDays} = this.state;
      if(yesterday && Utils.isReportDay(new Date(yesterday+'T00:00:00')) && !noReportDays.has(yesterday)){
        const pending = personnel.filter(p=>{ const r=yesterdayAtt[p.id]; return p.role==='reservist'&&(!r||r.status==='pending'); });
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
      this.setState({attendance:att, attendanceDate:newDate, history:hist});
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
      const maxNum = sameYear.reduce((m,b)=>Math.max(m,parseInt((b.label||'').match(/^Cycle (\d+)\//)?.[1]||0)),0);
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
      const maxNum = sameYear.reduce((m,b)=>Math.max(m,parseInt((b.label||'').match(/^Cycle (\d+)\//)?.[1]||0)),0);
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

  // ── Auth actions ───────────────────────────────────────────────────────
  goLogin: function() { this.setState({authMode:'login', authError:''}); },

  goSignup: async function() {
    this.setState({authMode:'signup', authError:''});
    await this._refreshSignupSlots();
  },

  doLogin: async function() {
    if(!this.state.loginContact.trim()){ this.setState({authError:'Enter your contact number.'}); return; }
    this.setState({loading:true, authError:''});
    const {user,error} = await DB.auth.login(this.state.loginContact, this.state.loginPassword);
    if(error||!user){ this.setState({loading:false, authError:'Invalid contact number or password.'}); return; }
    await this._afterLogin(user);
    this.setState({loginContact:'', loginPassword:''});
  },

  doSignup: async function() {
    const {suName,suContact,suPassword,suShift} = this.state;
    if(!suName.trim()||!suContact.trim()||!suPassword.trim()){ this.setState({authError:'Please fill in all fields.'}); return; }
    if(suPassword.length < 6){ this.setState({authError:'Password must be at least 6 characters.'}); return; }
    const cleanContact = suContact.replace(/[\s-]/g,'');
    if(!/^[689]\d{7}$/.test(cleanContact)){ this.setState({authError:'Contact must be an 8-digit Singapore number.'}); return; }
    const existingReq = await DB.signupRequests.getByContact(cleanContact).catch(()=>null);
    if(existingReq?.status==='pending'){
      this.setState({authError:'A signup request for this number is already pending admin approval.'});
      return;
    }
    if(existingReq?.status==='rejected'){
      this.setState({authError:'Your previous signup request was not approved. Contact your supervisor.'});
      return;
    }
    const today = Utils.dateKey(this.baseDate());
    const sortedBatches = [...this.state.batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const liveBatch = sortedBatches.find(b=>today>=b.start_date&&today<=b.end_date) || this._liveBatch();
    if(!liveBatch){
      this.setState({authError:'No active intake batch is open for sign-up right now.'});
      return;
    }
    const isLastDay = today === liveBatch.end_date;
    const nextBatch = isLastDay ? sortedBatches.find(b=>b.start_date>liveBatch.end_date) : null;
    const activeBatch = nextBatch || liveBatch;
    const members = await DB.personnel.list(activeBatch.id).catch(()=>[]);
    const shift = this._capShift(suShift||'AM', members);
    this.setState({loading:true, authError:''});
    const {user,error} = await DB.auth.signup(cleanContact, suPassword, suName.trim());
    if(error||!user){ this.setState({loading:false, authError:error?.message||'Signup failed. Try a different contact or password.'}); return; }
    const {error:reqErr} = await DB.signupRequests.create({authId:user.id, name:suName.trim(), contact:cleanContact, shift, batchId:activeBatch.id});
    if(reqErr){
      await DB.auth.logout();
      this.setState({loading:false, authError:'Signup failed: '+(reqErr.message||'database error. Check Supabase grants.')});
      return;
    }
    await DB.auth.logout();
    this.setState({loading:false, signupPending:true, suName:'', suContact:'', suPassword:''});
  },

  logout: async function() {
    if(this._idleWarnTimer) clearTimeout(this._idleWarnTimer);
    if(this._idleLogoutTimer) clearTimeout(this._idleLogoutTimer);
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    this._unsubscribeRealtime();
    if(!this.state.demo) await DB.auth.logout();
    this.setState({
      authed:false, role:null, authMode:'login', demo:false,
      currentUserId:null, me:null, loginContact:'', loginPassword:'',
      suName:'', suContact:'', suShift:'AM', suPassword:'',
      locStatus:'idle', locDistance:null, locGpsMsg:'', locSlow:false, locAccuracy:null, locPermErr:false, locRetryCount:0,
      accountOpen:false, confirmDelete:false,
      personnel:[], attendance:{}, history:[], attendanceCache:{}, batchMembersCache:{}, attendanceDate:null,
      batches:[], activeBatchIdx:0, noReportDays:new Set(), avatars:{}, selectedCalOffset:null, offlinePending:false,
      testDate:null, testDateInput:'', testTime:null, testTimeInput:'', phaseSubmitting:false,
      acctNameEdit:'', acctPwCurrent:'', acctPwNew:'', acctPwConfirm:'',
      acctPwError:'', acctPwSuccess:'', acctNameError:'', acctNameSuccess:'', acctSaving:false,
      locPhase:null, batchLoading:false, batchCreating:false,
      editingNoteId:null, editingNoteText:'',
      batchJumpDate:Utils.dateKey(new Date()),
      toast:null, rosterSort:'shift', newBatchDate:'',
      peopleStats:{}, peopleStatsLoaded:false, confirmDeactivateId:null, showArchivedBatches:false, cyclePickerOpen:false,
      noAvatarIds:new Set(), noReportDaysCache:{},
      markAllPresenting:false,
      historyPage:1,
      sessionExpiring:false, idleWarning:false, showA2hs:false, forgotPasswordOpen:false,
      showLateWarning:false, lateReasonOpen:false, lateReasonText:'', lateReasonSubmitting:false,
      pendingLeaves:[], pendingLeavesLoaded:false,
      leaveOpen:false, leaveDate:'', leaveType:'mc', leaveReason:'',
      myPendingRequest:null,
      shiftChangeOpen:false, shiftChangeNew:'AM', shiftChangeReason:'',
      adminNotifGranted:false,
      myLeaveHistory:[], myLeaveHistoryLoaded:false,
      welfareNoteOpen:false, welfareNoteText:'', welfareNoteSaving:false,
      isSuperAdmin:false, adminsList:[], adminsLoaded:false,
      npAdminName:'', npAdminContact:'', npAdminPassword:'', confirmDeactivateAdminId:null,
      promoteAdminId:'', confirmPromoteAdminId:null, promoteSearch:'', promoteShowAllCycles:false,
      editingBatchLabel:false, batchLabelText:'',
      viewOffset:0, rosterSearch:'', logSearch:'', logShiftFilter:'all',
      markingAllAbsent:false, confirmMarkAllAbsent:false,
      personHistoryId:null, personHistoryRows:[], personHistoryLoading:false,
      signupPending:false,
      pendingSignups:[], pendingSignupsLoaded:false, approvedSignups:[],
      realtimeLive:false,
    });
  },

  demoReservist: function() {
    const today=new Date(); today.setHours(0,0,0,0);
    const start=Utils.mondayOf(today), end=Utils.addDays(start,13), dekit=Utils.addDays(end,3);
    const batch={id:'demo-batch',label:'Demo Cycle',start_date:Utils.dateKey(start),end_date:Utils.dateKey(end),dekit_date:Utils.dateKey(dekit),is_live:true};
    const personnel=[
      {id:'d1',name:'Demo User',contact:'9000 0001',shift:'PM',role:'reservist',batch_id:'demo-batch',is_active:true},
      {id:'d2',name:'Tan Jian Hui',contact:'9000 0002',shift:'AM',role:'reservist',batch_id:'demo-batch',is_active:true},
      {id:'d3',name:'Ahmad Fariz',contact:'9000 0003',shift:'AM',role:'reservist',batch_id:'demo-batch',is_active:true},
      {id:'d4',name:'Lim Hui Ying',contact:'9000 0004',shift:'OFFICE',role:'reservist',batch_id:'demo-batch',is_active:true},
    ];
    this.setState({authed:true,role:'reservist',tab:'checkin',demo:true,currentUserId:'d1',me:personnel[0],personnel,batches:[batch],activeBatchIdx:0,attendance:{},noReportDays:new Set(),history:[],authError:'',accountDeleted:false});
  },

  demoAdmin: function() {
    const today=new Date(); today.setHours(0,0,0,0);
    const tue=Utils.nextBatchTuesday(Utils.addDays(today,-7));
    const {start,end,dekit}=Utils.batchDatesFrom(tue);
    const batch={id:'demo-batch',label:'Demo Cycle',start_date:Utils.dateKey(start),end_date:Utils.dateKey(end),dekit_date:Utils.dateKey(dekit),is_live:true};
    const personnel=[
      {id:'d2',name:'Tan Jian Hui',contact:'9000 0002',shift:'AM',role:'reservist',batch_id:'demo-batch',is_active:true},
      {id:'d3',name:'Ahmad Fariz',contact:'9000 0003',shift:'AM',role:'reservist',batch_id:'demo-batch',is_active:true},
      {id:'d4',name:'Lim Hui Ying',contact:'9000 0004',shift:'OFFICE',role:'reservist',batch_id:'demo-batch',is_active:true},
      {id:'d5',name:'Brandon Yeo',contact:'9000 0005',shift:'PM',role:'reservist',batch_id:'demo-batch',is_active:true},
    ];
    this.setState({authed:true,role:'admin',tab:'overview',demo:true,currentUserId:'demo-admin',me:{id:'demo-admin',name:'Supervisor',role:'admin'},personnel,batches:[batch],activeBatchIdx:0,attendance:{'d2':{status:'present',p1:'08:24',p1dist:32},'d3':{status:'present',p1:'08:31',p1dist:48},'d5':{status:'mc',p1:null}},noReportDays:new Set(),history:[],authError:'',accountDeleted:false});
  },

  // ── Form handlers ──────────────────────────────────────────────────────
  onLoginContact:  function(e) { this.setState({loginContact:e.target.value}); },
  onLoginPassword: function(e) { this.setState({loginPassword:e.target.value}); },
  onPwKeyDown:     function(e) {
    this.setState({capsLock:!!e.getModifierState('CapsLock')});
    if(e.key==='Enter' && this.state.authMode==='login') this.doLogin();
  },
  onLoginContactKeyDown: function(e) {
    if(e.key==='Enter' && this.state.authMode==='login') this.doLogin();
  },
  onSuName:        function(e) { this.setState({suName:e.target.value}); },
  onSuContact:     function(e) { this.setState({suContact:e.target.value}); },
  onSuShift:       function(e) { this.setState({suShift:e.target.value}); },
  onSuShiftSelect: function(v) { return () => this.setState({suShift:v}); },
  onSuPassword:    function(e) { this.setState({suPassword:e.target.value}); },
  onNpName:        function(e) { this.setState({npName:e.target.value}); },
  onNpContact:     function(e) { this.setState({npContact:e.target.value}); },
  onNpShift:       function(e) { this.setState({npShift:e.target.value}); },
  onNpPassword:    function(e) { this.setState({npPassword:e.target.value}); },

  dismissSignupPending: function() { this.setState({signupPending:false, authMode:'login'}); },

  // ── Admin: signup request management ──────────────────────────────────
  loadPendingSignups: async function() {
    const data = await DB.signupRequests.listPending().catch(()=>[]);
    this.setState({pendingSignups:data, pendingSignupsLoaded:true});
  },

  loadApprovedSignups: async function() {
    const data = await DB.signupRequests.listApproved().catch(()=>[]);
    this.setState({approvedSignups:data});
  },

  approveSignup: function(id) {
    return async () => {
      const req = this.state.pendingSignups.find(r=>r.id===id);
      if(!req) return;
      const me = this.cur();
      const reviewerName = me?.name || null;
      const {error:approveErr} = await DB.signupRequests.approve(id, reviewerName);
      if(approveErr){ this._toast('Failed to approve. Try again.','error'); return; }
      // If admin pre-added this person, link auth to existing record; otherwise create new
      const existing = await DB.personnel.findByContact(req.contact).catch(()=>null);
      let finalPerson = existing;
      if(existing){
        await DB.personnel.linkAuth(existing.id, req.auth_id);
      } else {
        const {data:newPerson, error:addErr} = await DB.personnel.add({authId:req.auth_id, name:req.name, contact:req.contact, shift:req.shift, batchId:req.batch_id});
        if(addErr){ this._toast('Approved but failed to create personnel record. Try again.','error'); return; }
        finalPerson = newPerson;
      }
      this.setState(s=>({
        pendingSignups:s.pendingSignups.filter(r=>r.id!==id),
        approvedSignups:[{...req,status:'approved',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()},...s.approvedSignups],
        personnel:finalPerson&&!existing?[...s.personnel,finalPerson]:s.personnel,
      }));
      this._toast(req.name+' approved and added to the roster.');
    };
  },

  rejectSignup: function(id) {
    return async () => {
      const req = this.state.pendingSignups.find(r=>r.id===id);
      if(!req) return;
      const me = this.cur();
      const {error} = await DB.signupRequests.reject(id, me?.name||null);
      if(error){ this._toast('Failed to reject. Try again.','error'); return; }
      this.setState(s=>({pendingSignups:s.pendingSignups.filter(r=>r.id!==id)}));
      this._toast(req.name+"'s signup was rejected.");
    };
  },

  // ── Superadmin: admin management ───────────────────────────────────────
  loadAdmins: async function() {
    const data = await DB.personnel.listAdmins().catch(()=>[]);
    this.setState({adminsList:data, adminsLoaded:true});
  },

  onNpAdminName:     function(e) { this.setState({npAdminName:e.target.value}); },
  onNpAdminContact:  function(e) { this.setState({npAdminContact:e.target.value}); },
  onNpAdminPassword: function(e) { this.setState({npAdminPassword:e.target.value}); },

  addAdmin: async function() {
    const {npAdminName, npAdminContact, npAdminPassword, adminsList, demo} = this.state;
    if(!npAdminName.trim()){ this._toast('Name is required.','error'); return; }
    const cleanContact = npAdminContact.replace(/[\s-]/g,'');
    if(!cleanContact){ this._toast('Contact number is required.','error'); return; }
    if(!/^[689]\d{7}$/.test(cleanContact)){ this._toast('Contact must be an 8-digit Singapore number.','error'); return; }
    if(adminsList.some(a=>a.contact?.replace(/[\s-]/g,'')===cleanContact)){ this._toast('This contact is already an admin.','error'); return; }
    if(!npAdminPassword || npAdminPassword.length < 6){ this._toast('Password must be at least 6 characters.','error'); return; }
    if(!demo){
      const existing = await DB.personnel.findByContact(cleanContact).catch(()=>null);
      if(existing){ this._toast('This contact is already registered.','error'); return; }
      const {user, error} = await DB.auth.createUserAsAdmin(cleanContact, npAdminPassword, npAdminName.trim());
      if(error || !user){ this._toast('Failed to create account. Try again.','error'); return; }
      const {error:addErr} = await DB.personnel.add({authId:user.id, name:npAdminName.trim(), contact:cleanContact, shift:null, batchId:null, role:'admin'});
      if(addErr){ this._toast('Account created but roster entry failed.','error'); return; }
      await this.loadAdmins();
    }
    this.setState({npAdminName:'', npAdminContact:'', npAdminPassword:''});
    this._toast(npAdminName.trim() + ' added as admin.');
  },

  askDeactivateAdmin:    function(id) { return () => this.setState({confirmDeactivateAdminId:id}); },
  cancelDeactivateAdmin: function() { this.setState({confirmDeactivateAdminId:null}); },

  confirmDeactivateAdmin: async function() {
    const id = this.state.confirmDeactivateAdminId;
    if(!id) return;
    this.setState({confirmDeactivateAdminId:null});
    if(!this.state.demo) await DB.personnel.deactivate(id).catch(()=>{});
    this.setState(s=>({adminsList:s.adminsList.filter(a=>a.id!==id)}));
    this._toast('Admin removed.');
  },

  onPromoteAdminId:    function(e) { this.setState({promoteAdminId:e.target.value, confirmPromoteAdminId:null}); },
  onPromoteSearch:     function(e) { this.setState({promoteSearch:e.target.value, promoteAdminId:'', confirmPromoteAdminId:null}); },
  onPromoteSearchKeyDown: function(e) { if(e.key==='Enter') e.target.blur(); },
  togglePromoteShowAll: function() { this.setState(s=>({promoteShowAllCycles:!s.promoteShowAllCycles, promoteAdminId:'', confirmPromoteAdminId:null, promoteSearch:''})); },
  clearPromoteSelection: function() { this.setState({promoteAdminId:'', confirmPromoteAdminId:null, promoteSearch:''}); },

  askPromoteAdmin: function() {
    const {promoteAdminId} = this.state;
    if(!promoteAdminId){ this._toast('Select a person to promote.','error'); return; }
    this.setState({confirmPromoteAdminId:promoteAdminId});
  },

  cancelPromoteAdmin: function() { this.setState({confirmPromoteAdminId:null}); },

  confirmPromoteAdmin: async function() {
    const {confirmPromoteAdminId, personnel, demo} = this.state;
    if(!confirmPromoteAdminId) return;
    const person = personnel.find(p=>p.id===confirmPromoteAdminId);
    if(!person) return;
    this.setState({confirmPromoteAdminId:null, promoteAdminId:'', promoteSearch:''});
    if(!demo){
      const {error} = await DB.personnel.promoteToAdmin(confirmPromoteAdminId).catch(e=>({error:e}));
      if(error){ this._toast('Failed to promote. Try again.','error'); return; }
    }
    this.setState(s=>({personnel:s.personnel.filter(p=>p.id!==confirmPromoteAdminId)}));
    await this.loadAdmins();
    this._toast(person.name+' promoted to admin.');
  },

  // ── Leave requests ─────────────────────────────────────────────────────
  loadPendingLeaves: async function() {
    const {demo}=this.state;
    if(demo) return;
    const data=await DB.leaves.listPending().catch(()=>[]);
    this.setState({pendingLeaves:data,pendingLeavesLoaded:true});
  },

  approveLeave: function(id) {
    return async () => {
      const leave = this.state.pendingLeaves.find(l => l.id === id);
      if(!this.state.demo && leave) {
        const me = this.cur();
        const reviewMeta = { reviewed_by: me?.name || null, reviewed_at: new Date().toISOString() };
        const ops = [DB.leaves.updateStatus(id, 'approved', reviewMeta).catch(()=>{})];
        if(leave.type === 'mc') {
          ops.push(DB.attendance.upsert(leave.personnel_id, leave.date, 'mc', {}).catch(()=>{}));
        } else if(leave.type === 'personal' || leave.type === 'other') {
          ops.push(DB.attendance.upsert(leave.personnel_id, leave.date, 'absent', {}).catch(()=>{}));
        } else if(leave.type === 'shift_change' && leave.requested_shift) {
          ops.push(
            DB.personnel.updateShift(leave.personnel_id, leave.requested_shift).then(({data}) => {
              if(data) this.setState(s=>({personnel:s.personnel.map(p=>p.id===leave.personnel_id?{...p,shift:data.shift}:p)}));
            }).catch(()=>{})
          );
        }
        await Promise.all(ops);
        this._toast('Request approved.');
      }
      this.loadPendingLeaves();
    };
  },

  rejectLeave: function(id) {
    return async () => {
      if(!this.state.demo) {
        const me = this.cur();
        const reviewMeta = { reviewed_by: me?.name || null, reviewed_at: new Date().toISOString() };
        await DB.leaves.updateStatus(id, 'rejected', reviewMeta).catch(()=>{});
      }
      this._toast('Request declined.');
      this.loadPendingLeaves();
    };
  },

  openLeaveRequest: function(date) { return () => this.setState({leaveOpen:true, leaveDate:date, leaveType:'mc', leaveReason:''}); },
  closeLeaveRequest: function() { this.setState({leaveOpen:false}); },
  onLeaveDate:   function(e) { this.setState({leaveDate:e.target.value}); },
  onLeaveType:   function(v) { return () => this.setState({leaveType:v}); },
  onLeaveReason: function(e) { this.setState({leaveReason:e.target.value}); },

  submitLeaveRequest: async function() {
    const {currentUserId, leaveDate, leaveType, leaveReason, demo, myPendingRequest} = this.state;
    if(myPendingRequest){ this._toast('You already have a pending request.','error'); return; }
    if(!leaveDate){ this._toast('Please select a date.','error'); return; }
    if(leaveDate < Utils.dateKey(this.baseDate())){ this._toast('Cannot submit a request for a past date.','error'); return; }
    if(!demo){
      const {data, error} = await DB.leaves.request(currentUserId, leaveDate, leaveType, leaveReason).catch(e=>({error:e}));
      if(error){ this._toast('Failed to submit request.','error'); return; }
      if(data) this.setState({myPendingRequest:data});
    } else {
      this.setState({myPendingRequest:{id:'demo',personnel_id:currentUserId,date:leaveDate,type:leaveType,status:'pending'}});
    }
    this._toast('Request submitted for approval.');
    this.setState({leaveOpen:false});
  },

  // ── Shift change requests ──────────────────────────────────────────────
  openShiftChange: function() { const me=this.cur(); this.setState({shiftChangeOpen:true,shiftChangeNew:me?.shift||'AM',shiftChangeReason:''}); },
  closeShiftChange: function() { this.setState({shiftChangeOpen:false}); },
  onShiftChangeNew: function(v) { return () => this.setState({shiftChangeNew:v}); },
  onShiftChangeReason: function(e) { this.setState({shiftChangeReason:e.target.value}); },

  submitShiftChange: async function() {
    const {currentUserId,shiftChangeNew,shiftChangeReason,demo}=this.state;
    if(!shiftChangeReason.trim()){ this._toast('Please provide a reason for the shift change.','error'); return; }
    if(!demo){
      const {error}=await DB.leaves.request(currentUserId,Utils.dateKey(this.baseDate()),'shift_change',shiftChangeReason,shiftChangeNew).catch(e=>({error:e}));
      if(error){ this._toast('Failed to send request.','error'); return; }
    }
    this._toast('Shift change request sent.');
    this.setState({shiftChangeOpen:false});
  },

  // ── Welfare note ───────────────────────────────────────────────────────
  openWelfareNote:  function() { this.setState({welfareNoteOpen:true, welfareNoteText:this.myRec()?.welfareNote||''}); },
  closeWelfareNote: function() { this.setState({welfareNoteOpen:false, welfareNoteText:''}); },
  onWelfareNoteText: function(e) { this.setState({welfareNoteText:e.target.value}); },

  submitWelfareNote: async function() {
    const {welfareNoteText, currentUserId, demo} = this.state;
    this.setState({welfareNoteSaving:true});
    const today = Utils.dateKey(this.baseDate());
    if(!demo){
      const {error} = await DB.attendance.saveWelfareNote(currentUserId, today, welfareNoteText.trim()).catch(e=>({error:e}));
      if(error){ this._toast('Failed to save note.','error'); this.setState({welfareNoteSaving:false}); return; }
    }
    this.setState(s=>({
      attendance:{...s.attendance,[s.currentUserId]:{...s.attendance[s.currentUserId],welfareNote:welfareNoteText.trim()}},
      welfareNoteOpen:false, welfareNoteSaving:false,
    }));
    this._toast('Note saved.');
  },

  // ── Admin notifications ────────────────────────────────────────────────
  _subscribeAdminRequests: function() {
    if(this.state.demo) return;
    if(this._adminRequestsChannel) return;
    this._adminRequestsChannel = DB.realtime.subscribeAdminRequests((row) => {
      if(row._type==='signup'){
        this.loadPendingSignups();
        if(this.state.adminNotifGranted && typeof Notification !== 'undefined' && Notification.permission === 'granted'){
          new Notification('New signup request', {body:(row.name||'Someone')+' is requesting to join.',icon:'./icon.svg'});
        }
      } else {
        this.loadPendingLeaves();
        if(this.state.adminNotifGranted && typeof Notification !== 'undefined' && Notification.permission === 'granted'){
          const typeMap = {mc:'MC',shift_change:'Shift Change',other:'Other',personal:'Personal Leave'};
          new Notification('New request from personnel', {body:(typeMap[row.type]||row.type)+' request received.',icon:'./icon.svg'});
        }
      }
    });
  },

  requestAdminNotifs: async function() {
    if(!('Notification' in window)){ this._toast('Notifications not supported on this browser.','error'); return; }
    const perm = await Notification.requestPermission();
    if(perm === 'granted'){
      localStorage.setItem('admin_notif','1');
      this.setState({adminNotifGranted:true});
      this._subscribeAdminRequests();
      this._toast('Notifications enabled!');
    } else {
      this._toast('Notification permission denied.','error');
    }
  },

  // ── Check-in ───────────────────────────────────────────────────────────
  _detectInAppBrowser: function() {
    const ua=navigator.userAgent||'';
    const isIOS=/iP(hone|od|ad)/.test(ua);
    if(/WhatsApp/i.test(ua))       return {detected:true, name:'WhatsApp'};
    if(/Instagram/i.test(ua))      return {detected:true, name:'Instagram'};
    if(/FBAN|FBAV/i.test(ua))      return {detected:true, name:'Facebook'};
    if(/Telegram/i.test(ua))       return {detected:true, name:'Telegram'};
    if(/Line\//i.test(ua))         return {detected:true, name:'Line'};
    if(/MicroMessenger/i.test(ua)) return {detected:true, name:'WeChat'};
    if(isIOS && /AppleWebKit/.test(ua) && !/Safari\//.test(ua))
      return {detected:true, name:'a messaging app'};
    return {detected:false, name:''};
  },

  verifyLocation: function() {
    if(this.state.locStatus==='locating') return;
    const retries=this.state.locRetryCount||0;
    this.setState({locStatus:'locating', locSlow:false, locPermErr:false, locRetryCount:retries+1});
    if(this._locSlowTimer) clearTimeout(this._locSlowTimer);
    this._locSlowTimer = setTimeout(()=>this.setState({locSlow:true}), 8000);
    if(!navigator.geolocation){
      setTimeout(()=>{
        clearTimeout(this._locSlowTimer);
        this.setState({locStatus:'verified',locDistance:Math.round(18+Math.random()*72),locSlow:false});
      },1200);
      return;
    }
    const ua=navigator.userAgent||'';
    const isIOS=/iP(hone|od|ad)/.test(ua), isAndroid=/Android/.test(ua);
    const {detected:isInApp, name:inAppName} = this._detectInAppBrowser();
    const _permMsg=isInApp
      ?`Location is blocked inside ${inAppName}.\n\n${inAppName}'s browser cannot access GPS.\n\nFix: tap ··· or the share icon → "Open in Safari" (iPhone) or "Open in Chrome" (Android), then try again there.`
      :isIOS
      ?'Location is blocked for this site.\n\n⚠️ Using Private Browsing? Safari blocks location in private tabs. Switch to a normal tab.\n\nOtherwise:\n1. iPhone Settings → Privacy & Security → Location Services → your browser → "While Using App"\n2. In Safari: tap "aA" in address bar → Website Settings → Location → Allow\n\nThen tap Reload below.'
      :isAndroid
      ?'Location is blocked for this site.\n\n⚠️ Using Incognito? Location is often blocked in private tabs. Switch to a normal tab.\n\nOtherwise:\n1. Tap the 🔒 icon in your address bar → Permissions → Location → Allow\n2. Browser Settings → Site Settings → Location → this site → Allow\n3. Phone Settings → Apps → [your browser] → Permissions → Location → Allow\n\nThen tap Reload below.'
      :'Location blocked.\n\n⚠️ Using a private/incognito tab? Switch to a normal tab.\n\nOtherwise allow Location via the 🔒 lock icon in your address bar, then tap Reload below.';
    const _unavailMsg=retries>=2
      ?'GPS still unavailable after several tries.\n\nAdditional steps:\n• Turn Location Services off and back on in phone Settings\n• Restart your phone\n• Contact your supervisor if the issue persists'
      :'GPS signal unavailable.\n\n• Step outside or move near a window\n• Make sure Airplane mode is off\n• Turn Location Services off and back on, then try again';
    const _timeoutMsg=retries>=2
      ?'GPS keeps timing out.\n\n• Move to an open area with clear sky view\n• Turn Location off and back on in Settings\n• Try restarting your phone\n• Contact your supervisor if this continues'
      :'GPS timed out after 15 seconds.\n\n• Move to an open area or near a window\n• Make sure Location Services is on in Settings\n• Try again in a few seconds';
    navigator.geolocation.getCurrentPosition(
      pos=>{
        clearTimeout(this._locSlowTimer);
        const dist=this._haversine(pos.coords.latitude,pos.coords.longitude,this._hqLat(),this._hqLon());
        const rounded=Math.round(dist);
        const accuracy=pos.coords.accuracy!=null?Math.round(pos.coords.accuracy):null;
        if(accuracy!=null&&accuracy>400&&(this.state.locRetryCount||0)<=2){
          this.setState({locStatus:'idle',locSlow:false});
          setTimeout(()=>this.verifyLocation(),300);
          return;
        }
        this.setState({locDistance:rounded,locAccuracy:accuracy,locSlow:false,locPermErr:false,locStatus:rounded<=this._maxDist()?'verified':'out_of_range'});
      },
      err=>{
        clearTimeout(this._locSlowTimer);
        const isPerm=err.code===1;
        const msg=isPerm?_permMsg:err.code===2?_unavailMsg:_timeoutMsg;
        this.setState({locStatus:'gps_error',locDistance:null,locGpsMsg:msg,locSlow:false,locPermErr:isPerm});
      },
      {enableHighAccuracy:true,timeout:15000,maximumAge:0}
    );
  },

  _hqLat:  function() { return parseFloat(this.props.hqLat)||1.332572; },
  _hqLon:  function() { return parseFloat(this.props.hqLon)||103.937189; },
  _maxDist: function() { return parseInt(this.props.hqRange)||500; },

  _haversine: function(lat1,lon1,lat2,lon2) {
    const R=6371000, r=Math.PI/180;
    const dLat=(lat2-lat1)*r, dLon=(lon2-lon1)*r;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  },

  startPhaseGps: function(phase) {
    return () => {
      if(this.state.locStatus==='locating') return;
      const switchingPhase=this.state.locPhase!==phase;
      this.setState({locPhase:phase, locStatus:'idle', locDistance:null, locGpsMsg:'', locAccuracy:null, locSlow:false, locPermErr:false, ...(switchingPhase?{locRetryCount:0}:{})});
      this.verifyLocation();
    };
  },

  doPhase: function(key) {
    return async () => {
      if(this.state.phaseSubmitting) return;
      const {locStatus,locDistance,locPhase,currentUserId,demo,isOnline} = this.state;
      if(locStatus!=='verified'||locPhase!==key) return;
      this.setState({phaseSubmitting:true});
      const _now = new Date();
      const time = Utils.hhmm(_now);
      if(key==='p1'){
        const me=this.state.me; const shift=me?.shift||'AM';
        const cutoff=Utils.LATE_CUTOFF[shift]||'08:30';
        const [ch,cm]=cutoff.split(':').map(Number);
        const [th,tm]=time.split(':').map(Number);
        const minsLate=(th*60+tm)-(ch*60+cm);
        if(minsLate>=60) this.setState({lateReasonOpen:true,lateReasonText:''});
        else if(minsLate>=30) this.setState({showLateWarning:true});
      }
      const today = Utils.dateKey(this.baseDate());
      const rec = {...this.myRec()};
      if(key==='p1'){rec.status='present';rec.p1=time;rec.p1dist=locDistance;}
      else if(key==='p2') rec.p2=time;
      else if(key==='p3'){rec.p3=time;rec.p3dist=locDistance;}
      else if(key==='p4') rec.p4=time;
      this.setState(s=>({
        attendance:{...s.attendance,[currentUserId]:rec},
        locStatus:'idle', locPhase:null, phaseSubmitting:false,
        showLateWarning:key==='p1'?false:s.showLateWarning,
      }));
      this._haptic();
      const _phaseToasts={p1:'Checked in',p2:'Break recorded',p3:'Returned',p4:'Checked out'};
      this._toast(_phaseToasts[key]||'Recorded');
      if(!demo){
        if(!isOnline){
          this._queuePush({id:currentUserId,date:today,key,time,dist:locDistance});
        } else {
          const {error:phErr} = await DB.attendance.logPhase(currentUserId, today, key, time, locDistance);
          if(phErr) this._toast('Check-in saved locally but failed to sync. Check your connection.','error');
        }
      }
    };
  },

  doPhaseBypass: function(key) {
    return async () => {
      if(this.state.phaseSubmitting) return;
      const {currentUserId,demo,isOnline} = this.state;
      this.setState({phaseSubmitting:true});
      const _now = new Date();
      const time = Utils.hhmm(_now);
      if(key==='p1'){
        const me=this.state.me; const shift=me?.shift||'AM';
        const cutoff=Utils.LATE_CUTOFF[shift]||'08:30';
        const [ch,cm]=cutoff.split(':').map(Number);
        const [th,tm]=time.split(':').map(Number);
        const minsLate=(th*60+tm)-(ch*60+cm);
        if(minsLate>=60) this.setState({lateReasonOpen:true,lateReasonText:''});
        else if(minsLate>=30) this.setState({showLateWarning:true});
      }
      const today = Utils.dateKey(this.baseDate());
      const rec = {...this.myRec()};
      if(key==='p1'){rec.status='present';rec.p1=time;rec.p1dist=null;rec.gpsBypassed=true;}
      else if(key==='p2') rec.p2=time;
      else if(key==='p3'){rec.p3=time;rec.p3dist=null;rec.gpsBypassed=true;}
      else if(key==='p4') rec.p4=time;
      this.setState(s=>({
        attendance:{...s.attendance,[currentUserId]:rec},
        locStatus:'idle', locPhase:null, phaseSubmitting:false,
      }));
      this._haptic();
      const _phaseToasts={p1:'Checked in',p2:'Break recorded',p3:'Returned',p4:'Checked out'};
      this._toast(_phaseToasts[key]||'Recorded');
      if(!demo){
        if(!isOnline){
          this._queuePush({id:currentUserId,date:today,key,time,dist:null,bypassed:true});
        } else {
          const {error:phErr} = await DB.attendance.logPhase(currentUserId, today, key, time, null, true);
          if(phErr) this._toast('Check-in saved locally but failed to sync. Check your connection.','error');
        }
      }
    };
  },

  _haptic: function(ms=60) { if(navigator.vibrate) navigator.vibrate(ms); },

  _queuePush: function(item) {
    this._offlineQueues.push(item);
    try{ sessionStorage.setItem('offlineQ', JSON.stringify(this._offlineQueues)); }catch{}
    this.setState({offlinePending:true});
  },

  // ── Person history (admin drill-down) ──────────────────────────────────
  openPersonHistory: function(id) {
    return async () => {
      this.setState({personHistoryId:id, personHistoryRows:[], personHistoryLoading:true});
      if(!this.state.demo){
        const tomorrow = Utils.dateKey(Utils.addDays(new Date(), 1));
        const data = await DB.attendance.getHistory(id, tomorrow).catch(()=>[]);
        this.setState({personHistoryRows:data, personHistoryLoading:false});
      } else {
        this.setState({personHistoryLoading:false});
      }
    };
  },

  closePersonHistory: function() { this.setState({personHistoryId:null, personHistoryRows:[], personHistoryLoading:false}); },

  // ── Log search ─────────────────────────────────────────────────────────
  onLogSearch:   function(e) { this.setState({logSearch:e.target.value}); },
  onLogSearchKeyDown: function(e) { if(e.key==='Enter') e.target.blur(); },
  clearLogSearch: function() { this.setState({logSearch:''}); },

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

  showMoreHistory: function() { this.setState(s=>({historyPage:(s.historyPage||1)+1})); },

  // ── Day swipe ──────────────────────────────────────────────────────────
  onDaySwipeStart: function(e) { this._touchStartX = e.touches[0].clientX; },
  onDaySwipeEnd: function(e) {
    if(this._touchStartX===null) return;
    const dx=e.changedTouches[0].clientX-this._touchStartX;
    this._touchStartX=null;
    if(Math.abs(dx)<40) return;
    if(dx<0) this.nextDay(); else this.prevDay();
  },

  // ── Roster notes ───────────────────────────────────────────────────────
  openNote:  function(id, text) { return () => this.setState({editingNoteId:id, editingNoteText:text||''}); },
  onNoteText: function(e) { this.setState({editingNoteText:e.target.value}); },
  closeNote:  function() { this.setState({editingNoteId:null, editingNoteText:''}); },

  saveNote: async function() {
    const {editingNoteId, editingNoteText, demo} = this.state;
    if(!editingNoteId) return;
    if(!demo) await DB.personnel.updateNote(editingNoteId, editingNoteText).catch(()=>{});
    this.setState(s=>({
      personnel: s.personnel.map(p=>p.id===editingNoteId?{...p,notes:editingNoteText}:p),
      editingNoteId: null, editingNoteText: '',
    }));
    this._toast('Note saved.');
  },

  changeShift: function(id) {
    return async (e) => {
      const shift=e.target.value;
      if(shift==='AM'||shift==='PM'){
        const others=this.state.personnel.filter(p=>p.id!==id&&p.is_active!==false&&(p.role||'reservist')==='reservist');
        const count=others.filter(p=>p.shift===shift).length;
        if(count>=2){ this._toast((shift==='AM'?'AM':'PM')+' shift is full (2/2).','error'); return; }
      }
      if(!this.state.demo) await DB.personnel.updateShift(id, shift).catch(()=>{});
      this.setState(s=>({personnel:s.personnel.map(p=>p.id===id?{...p,shift}:p)}));
    };
  },

  // ── Account ────────────────────────────────────────────────────────────
  headerChipClick: function() { this.setState({accountOpen:true, acctNameEdit:this.cur()?.name||''}); },
  closeAccount: function() { this.setState({accountOpen:false, confirmDelete:false, acctPwError:'', acctPwSuccess:'', acctNameError:'', acctNameSuccess:''}); },
  askDelete:    function() { this.setState({confirmDelete:true}); },
  cancelDelete: function() { this.setState({confirmDelete:false}); },

  deleteAccount: async function() {
    if(!this.state.isOnline && !this.state.demo){
      this._toast('No connection. Cannot delete account while offline.','error'); return;
    }
    if(!this.state.demo){
      const {error} = await DB.personnel.deactivate(this.state.currentUserId).catch(e=>({error:e}));
      if(error){ this._toast('Failed to delete account. Please try again.','error'); return; }
    }
    await DB.auth.logout();
    this.setState({authed:false,role:null,authMode:'login',accountOpen:false,confirmDelete:false,accountDeleted:true,loginContact:'',loginPassword:'',demo:false});
  },

  onAvatarFile: function(e) {
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      const uid=this.state.currentUserId;
      localStorage.setItem('avatar_'+uid, r.result);
      this.setState(s=>{const noAv=new Set(s.noAvatarIds||[]);noAv.delete(uid);return{avatars:{...s.avatars,[uid]:r.result},noAvatarIds:noAv};});
      if(!this.state.demo){
        DB.storage.uploadAvatar(uid, f)
          .then(({error})=>{
            if(error){
              localStorage.removeItem('avatar_'+uid);
              this.setState(s=>{const av={...s.avatars};delete av[uid];const noAv=new Set(s.noAvatarIds||[]);noAv.add(uid);return{avatars:av,noAvatarIds:noAv};});
              this._toast('Photo upload failed. Please try again.','error');
            } else {
              const url=DB.storage.getAvatarUrl(uid)+'?t='+Date.now();
              if(url){ localStorage.setItem('avatar_'+uid, url); this.setState(s=>({avatars:{...s.avatars,[uid]:url}})); }
            }
          })
          .catch(()=>{
            localStorage.removeItem('avatar_'+uid);
            this.setState(s=>{const av={...s.avatars};delete av[uid];const noAv=new Set(s.noAvatarIds||[]);noAv.add(uid);return{avatars:av,noAvatarIds:noAv};});
            this._toast('Photo upload failed. Please try again.','error');
          });
      }
    };
    r.readAsDataURL(f);
  },

  removeAvatar: async function() {
    const uid=this.state.currentUserId;
    localStorage.setItem('avatar_'+uid, 'REMOVED');
    this.setState(s=>{const av={...s.avatars};delete av[uid];const noAv=new Set(s.noAvatarIds||[]);noAv.add(uid);return{avatars:av,noAvatarIds:noAv};});
    if(!this.state.demo) await DB.storage.deleteAvatar(uid).catch(()=>{});
    this._toast('Profile photo removed.');
  },

  // ── Account editing ────────────────────────────────────────────────────
  onAcctNameEdit:  function(e) { this.setState({acctNameEdit:e.target.value, acctNameError:'', acctNameSuccess:''}); },
  onAcctPwCurrent: function(e) { this.setState({acctPwCurrent:e.target.value, acctPwError:'', acctPwSuccess:''}); },
  onAcctPwNew:     function(e) { this.setState({acctPwNew:e.target.value, acctPwError:'', acctPwSuccess:''}); },
  onAcctPwConfirm: function(e) { this.setState({acctPwConfirm:e.target.value, acctPwError:'', acctPwSuccess:''}); },

  saveAcctName: async function() {
    const name = this.state.acctNameEdit.trim();
    if(!name){ this.setState({acctNameError:'Name cannot be empty.'}); return; }
    this.setState({acctSaving:true, acctNameError:'', acctNameSuccess:''});
    if(!this.state.demo){
      const {error} = await DB.personnel.updateName(this.state.currentUserId, name).catch(e=>({error:e}));
      if(error){ this.setState({acctSaving:false, acctNameError:'Failed to save. Try again.'}); return; }
    }
    this.setState(s=>({acctSaving:false, acctNameSuccess:'Name updated.', me:{...s.me, name}}));
  },

  saveAcctPw: async function() {
    const {acctPwCurrent, acctPwNew, acctPwConfirm, me, demo} = this.state;
    if(!acctPwCurrent||!acctPwNew||!acctPwConfirm){ this.setState({acctPwError:'Fill in all password fields.'}); return; }
    if(acctPwNew.length<6){ this.setState({acctPwError:'New password must be at least 6 characters.'}); return; }
    if(acctPwNew!==acctPwConfirm){ this.setState({acctPwError:'New passwords do not match.'}); return; }
    this.setState({acctSaving:true, acctPwError:'', acctPwSuccess:''});
    if(!demo){
      const {error:loginErr} = await DB.auth.login(me?.contact, acctPwCurrent).catch(e=>({error:e}));
      if(loginErr){ this.setState({acctSaving:false, acctPwError:'Current password is incorrect.'}); return; }
      const {error} = await DB.auth.updatePassword(acctPwNew).catch(e=>({error:e}));
      if(error){ this.setState({acctSaving:false, acctPwError:'Failed to update password. Try again.'}); return; }
    }
    this.setState({acctSaving:false, acctPwSuccess:'Password updated.', acctPwCurrent:'', acctPwNew:'', acctPwConfirm:''});
  },

  // ── Export CSV ─────────────────────────────────────────────────────────
  exportCsv: async function() {
    const {batches,activeBatchIdx,batchMembersCache,personnel,attendance,noReportDays,demo}=this.state;
    const batch=batches[activeBatchIdx||0]; if(!batch) return;
    const members=batch.is_live?personnel:(batchMembersCache[batch.id]||[]);
    const start=new Date(batch.start_date+'T00:00:00'), end=new Date(batch.end_date+'T00:00:00');
    const dates=[];
    for(let d=new Date(start);d<=end;d=Utils.addDays(d,1)){
      if(Utils.isReportDay(d)&&!Utils.holidayName(d)&&!noReportDays.has(Utils.dateKey(d))) dates.push(new Date(d));
    }
    let attCache=this.state.attendanceCache;
    if(!demo){
      const allAtt=await DB.attendance.getForBatch(batch.start_date,batch.end_date).catch(()=>({}));
      attCache={...attCache,...allAtt};
    }
    const todayKey=Utils.dateKey(this.baseDate());
    const header=['Name','Contact','Shift',...dates.map(d=>Utils.fmtShort(d)),'Present','MC','Absent'].join(',');
    const rows=members.map(p=>{
      const statuses=dates.map(d=>{
        const dk=Utils.dateKey(d);
        const map=dk===todayKey?attendance:(attCache[dk]||{});
        return (map[p.id]?.status)||'absent';
      });
      const pres=statuses.filter(s=>s==='present').length;
      const mc=statuses.filter(s=>s==='mc').length;
      const abs=statuses.filter(s=>s==='absent').length;
      return ['"'+p.name+'"',p.contact,p.shift,...statuses,pres,mc,abs].join(',');
    });
    const csv=[header,...rows].join('\n');
    const a=document.createElement('a');
    a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    a.download=(batch.label.replace(/\s+/g,'_')||'batch')+'_attendance.csv';
    a.click();
  },

  // ── Realtime ───────────────────────────────────────────────────────────
  _subscribeRealtime: function(dateStr) {
    if(this.state.demo) return;
    const ch=DB.realtime.subscribeAttendance(dateStr, row=>{
      this.setState(s=>{
        const existing=s.attendance[row.personnel_id]||{};
        const incoming=DB.attendance._toEntry(row);
        const merged={};
        for(const k of Object.keys(incoming)) merged[k]=incoming[k]??existing[k];
        return {attendance:{...s.attendance,[row.personnel_id]:merged}};
      });
    });
    this.setState({realtimeChannel:ch});
  },

  _unsubscribeRealtime: function() {
    DB.realtime.unsubscribe(this.state.realtimeChannel);
    if(this._myLeaveChannel){ DB.realtime.unsubscribe(this._myLeaveChannel); this._myLeaveChannel = null; }
    if(this._myAttendanceChannel){ DB.realtime.unsubscribe(this._myAttendanceChannel); this._myAttendanceChannel = null; }
    if(this._adminRequestsChannel){ DB.realtime.unsubscribe(this._adminRequestsChannel); this._adminRequestsChannel = null; }
  },

  // ── Admin actions ──────────────────────────────────────────────────────
  toggleMealActive: async function() {
    const {batches,activeBatchIdx,demo}=this.state;
    const idx=activeBatchIdx||0;
    const activeBatch=batches[idx]; if(!activeBatch) return;
    const next=!activeBatch.meal_active;
    if(!demo) await DB.batches.setMealActive(activeBatch.id, next);
    this.setState(s=>({batches:s.batches.map((b,i)=>i===idx?{...b,meal_active:next}:b)}));
    this._toast('Meal allowance forms '+(next?'activated':'paused')+'.');
  },

  openCyclePicker:  function() { this.setState({cyclePickerOpen:true}); },
  closeCyclePicker: function() { this.setState({cyclePickerOpen:false}); },

  toggleNoReporting: async function() {
    const off=this.state.viewOffset, d=this.dateForOffset(off);
    if(!Utils.isReportDay(d)||Utils.holidayName(d)) return;
    const dk=Utils.dateKey(d);
    const isNowOn = this.state.demo ? !this.state.noReportDays.has(dk) : await DB.noReportDays.toggle(dk);
    const batchId=this.state.batches[this.state.activeBatchIdx||0]?.id;
    this.setState(s=>{
      const nd=new Set(s.noReportDays); isNowOn?nd.add(dk):nd.delete(dk);
      const noReportDaysCache=batchId?{...s.noReportDaysCache,[batchId]:nd}:s.noReportDaysCache;
      return {noReportDays:nd,noReportDaysCache};
    });
    this._toast('No reporting '+(isNowOn?'enabled':'disabled')+' for '+Utils.fmtShort(d)+'.');
  },

  _navToOffset: async function(off) {
    const date=Utils.dateKey(this.dateForOffset(off));
    const {batches}=this.state;
    const curIdx=this.state.activeBatchIdx||0;
    let ni=batches.findIndex((b,i)=>i!==curIdx&&date>=b.start_date&&date<=b.end_date);
    if(ni<0) ni=batches.findIndex((b,i)=>i===curIdx&&date>=b.start_date&&date<=b.end_date);
    if(ni<0) ni=batches.findIndex((b,i)=>i!==curIdx&&date>=b.start_date&&date<=(b.dekit_date||b.end_date));
    if(ni<0) ni=batches.findIndex((b,i)=>i===curIdx&&date>=b.start_date&&date<=(b.dekit_date||b.end_date));
    if(ni<0){
      let bestDate='',bestIdx=-1;
      batches.forEach((b,i)=>{ const bd=b.dekit_date||b.end_date; if(bd<date&&bd>bestDate){bestDate=bd;bestIdx=i;} });
      ni=bestIdx;
    }
    if(ni>=0&&ni!==curIdx){
      const b=batches[ni];
      this.setState({batchLoading:true});
      let members=this.state.batchMembersCache[b.id];
      if(!members&&!b.is_live){ members=await DB.personnel.list(b.id,false).catch(()=>[]); this.setState(s=>({batchMembersCache:{...s.batchMembersCache,[b.id]:members}})); }
      const cachedNrd=this.state.noReportDaysCache[b.id];
      const [nrd,attMap]=await Promise.all([
        cachedNrd?Promise.resolve(cachedNrd):DB.noReportDays.list(b.start_date,b.dekit_date||b.end_date).catch(()=>new Set()),
        b.is_live?Promise.resolve({}):DB.attendance.getForBatch(b.start_date,b.end_date).catch(()=>({})),
      ]);
      this.setState(s=>({activeBatchIdx:ni,viewOffset:off,selectedCalOffset:null,attendanceCache:b.is_live?{}:{...s.attendanceCache,...attMap},noReportDays:nrd,noReportDaysCache:cachedNrd?s.noReportDaysCache:{...s.noReportDaysCache,[b.id]:nrd},batchLoading:false,rosterSearch:'',logSearch:'',confirmMarkAllAbsent:false}));
      return;
    }
    this.setState({viewOffset:off, logSearch:'', confirmMarkAllAbsent:false});
    this._loadDateAttendance(off);
  },

  prevDay: function() { this._navToOffset(this.state.viewOffset-1); },
  nextDay: function() { this._navToOffset(this.state.viewOffset+1); },
  goToday: function() { this._navToOffset(0); },

  setBatch: function(i) {
    return async () => {
      const b=this.state.batches[i]; if(!b) return;
      this.setState({batchLoading:true});
      const start=new Date(b.start_date+'T00:00:00'), today=this.baseDate();
      const off=Math.round((start-today)/86400000);
      let members=this.state.batchMembersCache[b.id];
      if(!members && !b.is_live){
        members = await DB.personnel.list(b.id, false).catch(()=>[]);
        this.setState(s=>({batchMembersCache:{...s.batchMembersCache,[b.id]:members}}));
      }
      const cachedNrd=this.state.noReportDaysCache[b.id];
      const [noReportDays, batchAttMap] = await Promise.all([
        cachedNrd?Promise.resolve(cachedNrd):DB.noReportDays.list(b.start_date, b.dekit_date||b.end_date).catch(()=>new Set()),
        b.is_live ? Promise.resolve({}) : DB.attendance.getForBatch(b.start_date, b.end_date).catch(()=>({})),
      ]);
      this.setState(s=>({
        activeBatchIdx:i, viewOffset:off, selectedCalOffset:null, batchJumpDate:b.is_live?Utils.dateKey(today):b.start_date,
        attendanceCache: b.is_live ? {} : {...s.attendanceCache, ...batchAttMap},
        noReportDays,
        noReportDaysCache: cachedNrd?s.noReportDaysCache:{...s.noReportDaysCache,[b.id]:noReportDays},
        batchLoading:false, rosterSearch:'', logSearch:'', confirmMarkAllAbsent:false, peopleStatsLoaded:false,
      }));
      this.loadPeopleStats();
    };
  },

  onBatchJumpDate: function(e) { this.setState({batchJumpDate:e.target.value}); },

  jumpToDate: async function() {
    const {batchJumpDate, demo}=this.state;
    if(!batchJumpDate) return;
    this.setState({batchLoading:true, batchJumpDate:''});
    let batches=this.state.batches;
    if(!demo){
      const sorted=[...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
      const lastBatch=sorted[sorted.length-1];
      const lastEnd=lastBatch?.dekit_date||lastBatch?.end_date||'';
      if(batchJumpDate>lastEnd){
        batches=await this._ensureLiveBatch(batches, batchJumpDate);
        batches=await this._ensureForwardBatches(batches);
        this.setState({batches});
      }
    }
    let idx=batches.findIndex(b=>batchJumpDate>=b.start_date&&batchJumpDate<=b.end_date);
    if(idx===-1) idx=batches.findIndex(b=>batchJumpDate>=b.start_date&&batchJumpDate<=(b.dekit_date||b.end_date));
    if(idx===-1){
      let bestDiff=Infinity;
      batches.forEach((b,i)=>{
        const diff=Math.abs(new Date(b.start_date)-new Date(batchJumpDate+'T00:00:00'));
        if(diff<bestDiff){bestDiff=diff;idx=i;}
      });
    }
    if(idx===-1){this.setState({batchLoading:false});return;}
    await this.setBatch(idx)();
    const targetOff=Math.round((new Date(batchJumpDate+'T00:00:00')-this.baseDate())/86400000);
    this.setState({viewOffset:targetOff, batchJumpDate});
  },

  setStatus: function(id, status) {
    return async () => {
      const off=this.state.viewOffset||0;
      if(off > 0) return;
      const viewDateKey=Utils.dateKey(this.dateForOffset(off));
      const viewIsToday=off===0;
      const prev=viewIsToday?(this.state.attendance[id]||{}):((this.state.attendanceCache?.[viewDateKey]||{})[id]||{});
      const p1=status==='present'?(prev.p1||Utils.hhmm(new Date())):prev.p1;
      const entry={...prev,status,p1};
      if(viewIsToday){ this.setState(s=>({attendance:{...s.attendance,[id]:entry}})); }
      else { this.setState(s=>({attendanceCache:{...s.attendanceCache,[viewDateKey]:{...(s.attendanceCache?.[viewDateKey]||{}),[id]:entry}}})); }
      if(!this.state.demo){
        if(!this.state.isOnline){
          const isNewPresent=status==='present'&&!prev.p1;
          this._queuePush({id,date:viewDateKey,status,extras:isNewPresent?{time:p1,dist:prev.p1dist}:{}});
          this._haptic(40);
          const _sl={present:'Marked present (queued)',mc:'Marked MC (queued)',absent:'Marked absent (queued)'};
          this._toast(_sl[status]||'Queued');
          return;
        }
        const isNewPresent=status==='present'&&!prev.p1;
        const {error}=await DB.attendance.upsert(id,viewDateKey,status,isNewPresent?{time:p1,dist:prev.p1dist}:{});
        if(error){
          if(prev.status){
            if(viewIsToday){ this.setState(s=>({attendance:{...s.attendance,[id]:{...prev}}})); }
            else { this.setState(s=>({attendanceCache:{...s.attendanceCache,[viewDateKey]:{...(s.attendanceCache?.[viewDateKey]||{}),[id]:{...prev}}}})); }
          } else {
            if(viewIsToday){ this.setState(s=>{const a={...s.attendance};delete a[id];return{attendance:a};}); }
            else { this.setState(s=>{const c={...(s.attendanceCache?.[viewDateKey]||{})};delete c[id];return{attendanceCache:{...s.attendanceCache,[viewDateKey]:c}};}); }
          }
          this._toast('Failed to update. Try again.','error');
          return;
        }
      }
      this._haptic(40);
      const _sl={present:'Marked present',mc:'Marked MC',absent:'Marked absent'};
      this._toast(_sl[status]||'Updated');
    };
  },

  askMarkAllAbsent:    function() { this.setState({confirmMarkAllAbsent:true}); },
  cancelMarkAllAbsent: function() { this.setState({confirmMarkAllAbsent:false}); },

  markAllAbsent: async function() {
    const {personnel,batches,activeBatchIdx,attendance,attendanceCache,viewOffset,batchMembersCache,demo}=this.state;
    if((viewOffset||0) > 0){ this.setState({confirmMarkAllAbsent:false}); return; }
    this.setState({confirmMarkAllAbsent:false, markingAllAbsent:true});
    const activeBatch=batches[activeBatchIdx||0]; if(!activeBatch){ this.setState({markingAllAbsent:false}); return; }
    const members=activeBatch.is_live?personnel:(batchMembersCache[activeBatch.id]||[]);
    const activeMembers=(members||[]).filter(p=>(p.role||'reservist')==='reservist');
    const off=viewOffset||0;
    const viewDateKey=Utils.dateKey(this.dateForOffset(off));
    const viewIsToday=off===0;
    const viewMap=viewIsToday?attendance:(attendanceCache?.[viewDateKey]||{});
    const pending=activeMembers.filter(p=>{ const r=viewMap[p.id]||{}; return !r.status||r.status==='pending'; });
    if(!pending.length){ this.setState({markingAllAbsent:false}); this._toast('No pending members.'); return; }
    if(viewIsToday){
      this.setState(s=>{const att={...s.attendance};for(const p of pending) att[p.id]={...(att[p.id]||{}),status:'absent'};return{attendance:att};});
    } else {
      this.setState(s=>{const c={...(s.attendanceCache?.[viewDateKey]||{})};for(const p of pending) c[p.id]={...(c[p.id]||{}),status:'absent'};return{attendanceCache:{...s.attendanceCache,[viewDateKey]:c}};});
    }
    if(!demo){
      const results=await Promise.all(pending.map(p=>DB.attendance.upsert(p.id,viewDateKey,'absent',{}).catch(e=>({error:e}))));
      const failed=results.filter(r=>r?.error).length;
      if(failed){
        this.setState({markingAllAbsent:false});
        this._toast(failed+' save'+(failed>1?'s':'')+' failed. Check your connection.','error');
        return;
      }
    }
    this.setState({markingAllAbsent:false});
    this._toast(pending.length+' member'+(pending.length>1?'s':'')+' marked absent.');
  },

  addPerson: async function() {
    const {npName,npContact,npShift,npPassword,batches,activeBatchIdx,demo,personnel,batchMembersCache}=this.state;
    if(!npName.trim()){ this._toast('Name is required.','error'); return; }
    const cleanContact=npContact.replace(/[\s-]/g,'');
    if(!cleanContact){ this._toast('Contact number is required.','error'); return; }
    if(!/^[689]\d{7}$/.test(cleanContact)){ this._toast('Contact must be an 8-digit Singapore number.','error'); return; }
    if(personnel.some(p=>p.contact.replace(/[\s-]/g,'')===cleanContact)){ this._toast('This contact is already on the roster.','error'); return; }
    if(!npPassword.trim()){ this._toast('Password is required.','error'); return; }
    if(npPassword.length<6){ this._toast('Password must be at least 6 characters.','error'); return; }
    const activeBatch=batches[activeBatchIdx||0];
    const {am:bAm,pm:bPm}=this._shiftSlotCounts(personnel);
    if(npShift==='AM'&&bAm>=2){ this._toast('AM shift is full (2/2). Select PM or Office.','error'); return; }
    if(npShift==='PM'&&bPm>=2){ this._toast('PM shift is full (2/2). Select AM or Office.','error'); return; }
    const shift=npShift;
    const contact=cleanContact;
    const addedName=npName.trim();
    if(!demo){
      let authId=null;
      const {user,error}=await DB.auth.createUserAsAdmin(cleanContact,npPassword,addedName);
      if(error||!user){ this._toast('Account creation failed: '+(error?.message||'Try again.'),'error'); return; }
      authId=user.id;
      const {data,error:addErr}=await DB.personnel.add({authId,name:addedName,contact,shift,batchId:activeBatch?.id});
      if(addErr||!data){ this._toast('Failed to add. Try again.','error'); return; }
      this.setState(s=>({personnel:[...s.personnel,data],npName:'',npContact:'',npShift:'AM',npPassword:'',rosterSearch:''}));
    } else {
      const id='demo-'+Date.now();
      this.setState(s=>({personnel:[...s.personnel,{id,name:addedName,contact,shift,role:'reservist',batch_id:activeBatch?.id,is_active:true}],npName:'',npContact:'',npShift:'AM',npPassword:'',rosterSearch:''}));
    }
    this._toast(addedName+' added to roster.');
  },

  onRosterSearch:   function(e) { this.setState({rosterSearch:e.target.value}); },
  onRosterSearchKeyDown: function(e) { if(e.key==='Enter') e.target.blur(); },
  clearRosterSearch: function() { this.setState({rosterSearch:''}); },
  retrySync: function() { if(this.state.isOnline) this._onOnline(); },

  refreshSessionNow: async function() {
    this.setState({sessionExpiring:false});
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    try { await DB.auth.refreshSession(); } catch(e){}
    this._sessionWarnTimer = setTimeout(()=>{ if(this.state.authed) this.setState({sessionExpiring:true}); }, 55*60*1000);
  },

  dismissA2hs: function() { localStorage.setItem('a2hs_dismissed','1'); this.setState({showA2hs:false}); },
  openForgotPassword:  function() { this.setState({forgotPasswordOpen:true}); },
  closeForgotPassword: function() { this.setState({forgotPasswordOpen:false}); },
  dismissLateWarning:  function() { this.setState({showLateWarning:false}); },
  onLateReasonText:    function(e) { this.setState({lateReasonText:e.target.value}); },
  skipLateReason:      function() { this.setState({lateReasonOpen:false,lateReasonText:''}); },

  submitLateReason: async function() {
    const {lateReasonText,currentUserId,demo,isOnline} = this.state;
    if(!lateReasonText.trim()) return;
    this.setState({lateReasonSubmitting:true});
    if(!demo){
      if(!isOnline){ this._toast('No connection. Reason not saved. Try again when online.','error'); this.setState({lateReasonSubmitting:false}); return; }
      const today=Utils.dateKey(this.baseDate());
      const {error} = await DB.attendance.submitLateReason(currentUserId, today, lateReasonText.trim());
      if(error){ this._toast('Failed to save reason. Try again.','error'); this.setState({lateReasonSubmitting:false}); return; }
    }
    this.setState({lateReasonOpen:false,lateReasonText:'',lateReasonSubmitting:false});
    this._toast('Reason submitted.');
  },

  _shouldShowA2hs: function() {
    try{
      if(window.navigator.standalone||window.matchMedia('(display-mode:standalone)').matches) return false;
      if(localStorage.getItem('a2hs_dismissed')) return false;
      const last = localStorage.getItem('a2hs_seen');
      if(last && (Date.now() - parseInt(last)) < 24*60*60*1000) return false;
      return /Android|iPhone|iPad|iPod/.test(navigator.userAgent||'');
    }catch(e){return false;}
  },

  markAllPresent: async function() {
    if(this.state.markAllPresenting) return;
    const off=this.state.viewOffset||0;
    if(off > 0){ return; }
    this.setState({markAllPresenting:true});
    const viewDateKey=Utils.dateKey(this.dateForOffset(off));
    const viewIsToday=off===0;
    const viewMap=viewIsToday?this.state.attendance:(this.state.attendanceCache?.[viewDateKey]||{});
    const {batches,activeBatchIdx,batchMembersCache}=this.state;
    const activeBatch=batches[activeBatchIdx||0];
    const activeMembers=(activeBatch?.is_live?this.state.personnel.filter(p=>p.batch_id===activeBatch.id):(batchMembersCache?.[activeBatch?.id]||[])).filter(p=>(p.role||'reservist')==='reservist');
    const pending=activeMembers.filter(p=>!viewMap[p.id]?.status||viewMap[p.id]?.status==='absent');
    const p1=Utils.hhmm(new Date());
    const updates={};
    await Promise.all(pending.map(async p=>{
      updates[p.id]={status:'present',p1};
      if(!this.state.demo) await DB.attendance.upsert(p.id,viewDateKey,'present',{time:p1}).catch(()=>{});
    }));
    if(viewIsToday){
      this.setState(s=>({attendance:{...s.attendance,...updates},markAllPresenting:false}));
    } else {
      this.setState(s=>({attendanceCache:{...s.attendanceCache,[viewDateKey]:{...(s.attendanceCache?.[viewDateKey]||{}),...updates}},markAllPresenting:false}));
    }
  },

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
  setRolesTab:  function(k) { return () => this.setState({rolesTab:k}); },
  selectCalDay: function(off) { return () => this.setState(s=>({selectedCalOffset:s.selectedCalOffset===off?null:off})); },

  goPeople: function() {
    this.setState({tab:'people',peopleStatsLoaded:false});
    this.loadPeopleStats();
    this.loadRosterAvatars();
    this.loadPendingLeaves();
    this.loadPendingSignups();
    this._scrollTop();
  },

  loadRosterAvatars: async function() {
    const {batches,activeBatchIdx,demo,batchMembersCache,personnel,noAvatarIds}=this.state;
    if(demo) return;
    const batch=batches[activeBatchIdx||0];
    const batchMembers=batch?.is_live?personnel:(batchMembersCache[batch?.id]||[]);
    // Also include all personnel so promote-to-admin list and other cross-cycle views show avatars
    const memberSet=new Set(batchMembers.map(p=>p.id));
    const members=[...batchMembers,...(personnel||[]).filter(p=>!memberSet.has(p.id))];
    const noAvSet=noAvatarIds||new Set();
    const ids=members.map(p=>p.id).filter(id=>!this.state.avatars[id]&&!noAvSet.has(id));
    if(!ids.length) return;
    const existing=await DB.storage.listAvatarIds().catch(()=>new Set());
    const withAvatar=ids.filter(id=>existing.has(id));
    const withoutAvatar=ids.filter(id=>!existing.has(id));
    const urls=DB.storage.getAvatarUrls(withAvatar);
    this.setState(s=>({
      ...(withAvatar.length?{avatars:{...s.avatars,...urls}}:{}),
      noAvatarIds:new Set([...(s.noAvatarIds||[]),...withoutAvatar]),
    }));
  },

  loadPeopleStats: async function() {
    const {batches,activeBatchIdx,personnel,demo,batchMembersCache,attendance,noReportDays}=this.state;
    const batch=batches[activeBatchIdx||0];
    if(!batch||demo) return;
    const members=batch.is_live?personnel:(batchMembersCache[batch.id]||[]);
    const allAtt=await DB.attendance.getForBatch(batch.start_date,batch.dekit_date||batch.end_date).catch(()=>({}));
    const today=Utils.dateKey(this.baseDate());
    if(batch.is_live) allAtt[today]={...(allAtt[today]||{}),...attendance};
    const batchEnd=batch.dekit_date||batch.end_date;
    const ceiling=batchEnd<today?batchEnd:today;
    const reportDays=[];
    for(let d=new Date(batch.start_date+'T00:00:00'),end=new Date(ceiling+'T00:00:00');d<=end;d=new Date(d.getTime()+86400000)){
      const dk=Utils.dateKey(d);
      if(Utils.isReportDay(d)&&!noReportDays.has(dk)) reportDays.push(dk);
    }
    const stats={};
    for(const p of members){
      let present=0,mc=0,absent=0;
      for(const dk of reportDays){
        const rec=allAtt[dk]?.[p.id];
        if(rec?.status==='present') present++;
        else if(rec?.status==='mc') mc++;
        else if(dk<today||rec?.status==='absent') absent++;
      }
      const total=present+mc+absent;
      stats[p.id]={present,mc,absent,total,pct:total?Math.round(present/total*100):null};
    }
    this.setState({peopleStats:stats,peopleStatsLoaded:true});
  },

  setRosterSort:    function(key) { return () => this.setState({rosterSort:key}); },
  setLogShiftFilter: function(f) { return () => this.setState({logShiftFilter:f}); },
  onNewBatchDate:   function(e) { this.setState({newBatchDate:e.target.value}); },

  createBatch: async function() {
    const {newBatchDate,batches,demo,batchCreating}=this.state;
    if(!newBatchDate||batchCreating) return;
    this.setState({batchCreating:true});
    const start=new Date(newBatchDate+'T00:00:00');
    const {start:s,end:e,dekit:dk}=Utils.batchDatesFrom(start);
    const startStr=Utils.dateKey(s),endStr=Utils.dateKey(e),dekitStr=Utils.dateKey(dk);
    const sameYear=batches.filter(b=>b.start_date.slice(0,4)===startStr.slice(0,4));
    const maxNum=sameYear.reduce((m,b)=>Math.max(m,parseInt((b.label||'').match(/^Cycle (\d+)\//)?.[1]||0)),0);
    const label=Utils.batchLabel(startStr,endStr,maxNum+1);
    if(!demo){
      const {data,error}=await DB.batches.create(label,startStr,endStr,dekitStr);
      if(error||!data){ this._toast('Failed to create batch.','error'); this.setState({batchCreating:false}); return; }
      const newBatches=await DB.batches.list().catch(()=>[...batches,data]);
      const liveIdx=newBatches.findIndex(b=>b.is_live);
      this.setState({batches:newBatches,activeBatchIdx:liveIdx>=0?liveIdx:0,newBatchDate:'',batchCreating:false,tab:'people'});
    } else {
      const nb={id:'demo-b-'+Date.now(),label,start_date:startStr,end_date:endStr,dekit_date:dekitStr,is_live:true};
      this.setState(prev=>({batches:[...prev.batches,nb],newBatchDate:'',batchCreating:false}));
    }
    this._toast('Batch '+label+' created.');
  },

  startEditBatchLabel: function() {
    const activeBatch=this.state.batches[this.state.activeBatchIdx||0];
    this.setState({editingBatchLabel:true, batchLabelText:activeBatch?.label||''});
  },
  onBatchLabelText: function(e) { this.setState({batchLabelText:e.target.value}); },

  saveBatchLabel: async function() {
    const {batches, batchLabelText, demo, activeBatchIdx} = this.state;
    const activeBatch = batches[activeBatchIdx||0];
    if(!activeBatch||!batchLabelText.trim()) return;
    if(!demo) await DB.batches.updateLabel(activeBatch.id, batchLabelText.trim()).catch(()=>{});
    const newBatches = batches.map(b=>b.id===activeBatch.id?{...b,label:batchLabelText.trim()}:b);
    this.setState({batches:newBatches, editingBatchLabel:false});
    this._toast('Batch label updated.');
  },

  cancelBatchLabel: function() { this.setState({editingBatchLabel:false}); },

  askDeactivatePerson:    function(id) { return () => this.setState({confirmDeactivateId:id}); },
  cancelDeactivatePerson: function() { this.setState({confirmDeactivateId:null}); },

  confirmDeactivatePerson: async function() {
    const {confirmDeactivateId,demo,batches,activeBatchIdx}=this.state;
    if(!confirmDeactivateId) return;
    const removedName=this.state.personnel.find(p=>p.id===confirmDeactivateId)?.name||'Person';
    if(!demo){
      const {error} = await DB.personnel.deactivate(confirmDeactivateId).catch(()=>({error:true}));
      if(error){ this._toast('Could not remove person. Check your connection.','error'); this.setState({confirmDeactivateId:null}); return; }
    }
    const batchId=batches[activeBatchIdx||0]?.id;
    this.setState(s=>{
      const personnel=s.personnel.filter(p=>p.id!==confirmDeactivateId);
      const batchMembersCache=batchId?{...s.batchMembersCache,[batchId]:(s.batchMembersCache[batchId]||[]).filter(p=>p.id!==confirmDeactivateId)}:s.batchMembersCache;
      return {personnel,batchMembersCache,confirmDeactivateId:null};
    });
    this._toast(removedName+' removed from roster.');
  },

  // ── Helpers ────────────────────────────────────────────────────────────
  baseDate: function() { const d=new Date(); d.setHours(0,0,0,0); return d; },

  dateForOffset: function(off) { return Utils.addDays(this.baseDate(), off); },

  isNoReport: function(off) {
    const d=this.dateForOffset(off);
    if(!Utils.isReportDay(d)) return false;
    return this.state.noReportDays.has(Utils.dateKey(d)) || !!Utils.holidayName(d);
  },

  cur: function() { return this.state.me || this.state.personnel.find(p=>p.id===this.state.currentUserId) || null; },

  myRec: function() { return this.state.attendance[this.state.currentUserId]||{status:'pending'}; },

  _liveBatch: function(batches) {
    const list = batches || this.state.batches;
    return list.find(b=>b.is_live) || list[0] || null;
  },

  _refreshSignupSlots: async function() {
    const liveBatch = this._liveBatch();
    if(!liveBatch || this.state.demo) return;
    const personnel = await DB.personnel.list().catch(()=>[]);
    const liveIdx = this.state.batches.findIndex(b=>b.id===liveBatch.id);
    this.setState({personnel, activeBatchIdx:liveIdx>=0?liveIdx:this.state.activeBatchIdx});
  },

  _shiftSlotCounts: function(members) {
    const list = (members||[]).filter(p=>p.is_active!==false && (p.role||'reservist')==='reservist');
    return {
      am: list.filter(p=>p.shift==='AM').length,
      pm: list.filter(p=>p.shift==='PM').length,
    };
  },

  _capShift: function(want, members) {
    const {am, pm} = this._shiftSlotCounts(members || this.state.personnel);
    if(want==='AM'&&am>=2) return 'OFFICE';
    if(want==='PM'&&pm>=2) return 'OFFICE';
    return want;
  },
};
