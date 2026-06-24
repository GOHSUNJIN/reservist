window.makeAppComponent = function(DCLogic) {
class AppComponent extends DCLogic {
  state = {
    // auth
    authed: false, role: null, authMode: 'login',
    currentUserId: null, me: null,
    authError: '', loading: false, accountDeleted: false,
    // form fields
    loginContact: '', loginPassword: '',
    suName: '', suContact: '', suShift: 'AM', suPassword: '',
    // live data
    personnel: [], attendance: {}, attendanceCache: {},
    batches: [], activeBatchIdx: 0,
    noReportDays: new Set(), history: [],
    batchMembersCache: {},
    // ui state
    tab: 'checkin', rolesTab: 'AM',
    locStatus: 'idle', locDistance: null, locGpsMsg: '',
    accountOpen: false, confirmDelete: false,
    viewOffset: 0, avatars: {}, selectedCalOffset: null,
    npName: '', npContact: '', npShift: 'AM', npPassword: '',
    rosterSearch: '',
    realtimeChannel: null,
    now: new Date(), demo: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    offlinePending: false,
    testDate: null, testDateInput: '', testTime: null, testTimeInput: '', phaseSubmitting: false,
    acctNameEdit: '',
    acctPwCurrent: '', acctPwNew: '', acctPwConfirm: '',
    acctPwError: '', acctPwSuccess: '',
    acctNameError: '', acctNameSuccess: '',
    acctSaving: false,
    locPhase: null, locSlow: false, locAccuracy: null, locPermErr: false, locRetryCount: 0,
    isInAppBrowser: false, inAppBrowserName: '',
    batchLoading: false, batchCreating: false,
    editingNoteId: null, editingNoteText: '',
    batchJumpDate: Utils.dateKey(new Date()),
    toast: null,
    rosterSort: 'shift',
    newBatchDate: '',
    noAvatarIds: new Set(),
    peopleStats: {}, peopleStatsLoaded: false,
    confirmDeactivateId: null,
    showArchivedBatches: false,
    cyclePickerOpen: false,
    attendanceDate: null,
    noReportDaysCache: {},
    markAllPresenting: false,
    carryingOver: false,
    historyPage: 1,
    sessionExpiring: false,
    idleWarning: false,
    showA2hs: false, a2hsIsIos: false,
    forgotPasswordOpen: false,
    showLateWarning: false,
    lateReasonOpen: false, lateReasonText: '', lateReasonSubmitting: false,
    leaveOpen: false, leaveDate: '', leaveType: 'mc', leaveReason: '',
    myPendingRequest: null,
    pendingLeaves: [], pendingLeavesLoaded: false,
    shiftChangeOpen: false, shiftChangeNew: 'AM', shiftChangeReason: '',
    notifGranted: false,
    adminNotifGranted: false,
    myLeaveHistory: [], myLeaveHistoryLoaded: false,
    welfareNoteOpen: false, welfareNoteText: '', welfareNoteSaving: false,
  };

  // ── Lifecycle ────────────────────────────────────────────────────────────
  componentDidMount(){
    this._t = setInterval(()=>this.setState({now:new Date()}), 1000);
    this._offlineQueues = [];
    const {detected, name} = this._detectInAppBrowser();
    if(detected) this.setState({isInAppBrowser:true, inAppBrowserName:name});
    if(localStorage.getItem('admin_notif')==='1') this.setState({adminNotifGranted:true});
    this._init();
    this._onOnline = async () => {
      this.setState({isOnline:true});
      const pending = this._offlineQueues;
      if(pending.length && !this.state.demo){
        const failed = [];
        for(const pend of pending){
          let ok = true;
          if(pend.key){
            await DB.attendance.logPhase(pend.id, pend.date, pend.key, pend.time, pend.dist, pend.bypassed||false).catch(()=>{ ok=false; });
          } else {
            await DB.attendance.upsert(pend.id, pend.date, pend.status, pend.extras).catch(()=>{ ok=false; });
          }
          if(!ok) failed.push(pend);
        }
        this._offlineQueues = failed;
        if(!failed.length){ this.setState({offlinePending:false}); }
        else { this._toast('Some check-ins failed to sync. Tap Retry.','error'); }
      }
    };
    this._onOffline = () => this.setState({isOnline:false});
    window.addEventListener('online', this._onOnline);
    window.addEventListener('offline', this._onOffline);
    this._onActivity = () => { if(this.state.authed) this._resetIdleTimer(); };
    window.addEventListener('pointerdown', this._onActivity);
    window.addEventListener('keydown', this._onActivity);
    this._onVisibilityChange = () => {
      if(!document.hidden && this.state.authed && this._lastActiveAt){
        const elapsed = Date.now() - this._lastActiveAt;
        if(elapsed >= 20*60*1000){ this._toast('Logged out due to inactivity.'); this.logout(); }
        else if(elapsed >= 18*60*1000){ this.setState({idleWarning:true}); }
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }
  componentWillUnmount(){
    if(this._toastTimer) clearTimeout(this._toastTimer);
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    if(this._idleWarnTimer) clearTimeout(this._idleWarnTimer);
    if(this._idleLogoutTimer) clearTimeout(this._idleLogoutTimer);
    if(this._reminderTimer) clearTimeout(this._reminderTimer);
    clearInterval(this._t);
    this._unsubscribeRealtime();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('online', this._onOnline);
    window.removeEventListener('offline', this._onOffline);
    window.removeEventListener('pointerdown', this._onActivity);
    window.removeEventListener('keydown', this._onActivity);
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  async _init(){
    const batches = await DB.batches.list().catch(()=>[]);
    if(batches.length){
      const liveIdx = batches.findIndex(b=>b.is_live);
      const activeBatchIdx = liveIdx>=0?liveIdx:0;
      const activeBatch = batches[activeBatchIdx];
      const personnel = await DB.personnel.list().catch(()=>[]);
      this.setState({batches, activeBatchIdx, personnel});
    }
    const user = await DB.auth.session();
    if(user) await this._afterLogin(user);
  }

  async _afterLogin(user){
    const me = await DB.personnel.get(user.id);
    if(!me){
      await DB.auth.logout();
      this.setState({authed:false,loading:false,authError:'Account setup incomplete. Please sign up again.'});
      return;
    }
    // Load avatar: localStorage cache is instant; otherwise check bucket listing
    // to confirm the file actually exists before setting a URL (getPublicUrl always
    // returns a URL regardless of whether the file is there)
    const cachedAvatar = localStorage.getItem('avatar_'+me.id);
    if(cachedAvatar && cachedAvatar !== 'REMOVED'){
      // Show cached immediately, then validate it still exists in Supabase
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
    const role = me.role || 'reservist';
    const today = Utils.dateKey(this.baseDate());

    let batches = await DB.batches.list().catch(()=>[]);
    if(role==='admin'){
      batches = await this._ensureLiveBatch(batches);
      batches = await this._ensureForwardBatches(batches, 2);
    }

    const liveIdx = batches.findIndex(b=>b.is_live);
    const activeBatchIdx = liveIdx>=0?liveIdx:0;
    const activeBatch = batches[activeBatchIdx];

    // Auto-deactivate reservist if their batch's dekit day has passed
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
      authError:'', loading:false, accountDeleted:false, demo:false,
    });
    if(role==='admin'){ this._subscribeRealtime(today); setTimeout(()=>this.loadRosterAvatars(),0); setTimeout(()=>this.loadPendingLeaves(),0); this._subscribeAdminRequests(); }
    if(role==='reservist'){
      DB.leaves.myPending(me.id).then(req=>this.setState({myPendingRequest:req})).catch(()=>{});
      DB.leaves.myHistory(me.id).then(hist=>this.setState({myLeaveHistory:hist,myLeaveHistoryLoaded:true})).catch(()=>{});
      this._myAttendanceChannel = DB.realtime.subscribeMyAttendance(me.id, (row) => {
        const todayKey = Utils.dateKey(this.baseDate());
        if(row.date === todayKey){
          // Merge with existing — Supabase realtime may send partial rows (only changed columns)
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
    // Session expiry warning — show 5 min before typical 1-hour Supabase JWT expiry
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    this._sessionWarnTimer = setTimeout(()=>{ if(this.state.authed) this.setState({sessionExpiring:true}); }, 55*60*1000);
    // Add to Home Screen nudge — 30-second delay, at most once per day
    setTimeout(()=>{ if(this._shouldShowA2hs()){ localStorage.setItem('a2hs_seen',Date.now().toString()); this.setState({showA2hs:true, a2hsIsIos:/iP(hone|od|ad)/.test(navigator.userAgent||'')}); } }, 30000);
    this._resetIdleTimer();
  }

  _resetIdleTimer(){
    this._lastActiveAt = Date.now();
    if(this._idleWarnTimer) clearTimeout(this._idleWarnTimer);
    if(this._idleLogoutTimer) clearTimeout(this._idleLogoutTimer);
    if(this.state.idleWarning) this.setState({idleWarning:false});
    this._idleWarnTimer = setTimeout(()=>{ if(this.state.authed) this.setState({idleWarning:true}); }, 18*60*1000);
    this._idleLogoutTimer = setTimeout(()=>{ if(this.state.authed){ this._toast('Logged out due to inactivity.'); this.logout(); } }, 20*60*1000);
  }
  stayActive = () => { this._resetIdleTimer(); };

  async _ensureLiveBatch(batches, overrideDate){
    const today = overrideDate || Utils.dateKey(this.baseDate());
    const live = batches.find(b=>b.is_live);
    if(live && live.start_date<=today && today<=(live.dekit_date||live.end_date)) return batches;
    const current = batches.find(b=>b.start_date<=today && today<=(b.dekit_date||b.end_date));
    if(current){
      await DB.batches.activate(current.id).catch(()=>{});
      return DB.batches.list().catch(()=>batches);
    }
    // No batch covers today — create batches forward until one does (handles large test-date jumps)
    let sorted = [...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
    let lastCreated = null;
    for(let attempt=0; attempt<20; attempt++){
      const lastBatch = sorted[sorted.length-1];
      const fromDate = lastBatch?.end_date
        ? Utils.addDays(new Date(lastBatch.end_date+'T00:00:00'), 1)
        : new Date(today+'T00:00:00');
      const nextTue = Utils.nextBatchTuesday(fromDate);
      const {start,end,dekit} = Utils.batchDatesFrom(nextTue);
      const startStr=Utils.dateKey(start), endStr=Utils.dateKey(end), dekitStr=Utils.dateKey(dekit);
      const sameYear = sorted.filter(b=>b.start_date.slice(0,4)===startStr.slice(0,4));
      const num = sameYear.length+1;
      const label = Utils.batchLabel(startStr, endStr, num);
      const {data} = await DB.batches.create(label, startStr, endStr, dekitStr).catch(()=>({}));
      if(data){ sorted.push(data); lastCreated=data; }
      if(startStr<=today && today<=dekitStr){
        if(data?.id) await DB.personnel.assignBatch(data.id).catch(()=>{});
        break;
      }
      // Still haven't reached today — keep creating
      if(startStr>today) break; // gap period: next batch starts after today, stop
    }
    return DB.batches.list().catch(()=>sorted);
  }

  async _ensureForwardBatches(batches, ahead=3){
    const today=Utils.dateKey(this.baseDate());
    let sorted=[...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const futureBatches=sorted.filter(b=>b.start_date>today);
    const needed=ahead-futureBatches.length;
    if(needed<=0) return batches;
    const prevLiveId=sorted.find(b=>b.is_live)?.id;
    for(let i=0;i<needed;i++){
      const lastBatch=sorted[sorted.length-1];
      const fromDate=lastBatch?.end_date
        ?Utils.addDays(new Date(lastBatch.end_date+'T00:00:00'),1)
        :new Date(today+'T00:00:00');
      const nextTue=Utils.nextBatchTuesday(fromDate);
      const {start,end,dekit}=Utils.batchDatesFrom(nextTue);
      const startStr=Utils.dateKey(start),endStr=Utils.dateKey(end),dekitStr=Utils.dateKey(dekit);
      const sameYear=sorted.filter(b=>b.start_date.slice(0,4)===startStr.slice(0,4));
      const label=Utils.batchLabel(startStr,endStr,sameYear.length+1);
      const {data}=await DB.batches.create(label,startStr,endStr,dekitStr).catch(()=>({}));
      if(data) sorted.push(data); else break;
    }
    if(prevLiveId) await DB.batches.activate(prevLiveId).catch(()=>{});
    return DB.batches.list().catch(()=>sorted);
  }

  async _loadDateAttendance(off){
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
  }

  // ── Auth actions ──────────────────────────────────────────────────────────
  goLogin  = () => this.setState({authMode:'login',  authError:''});
  goSignup = async () => {
    this.setState({authMode:'signup', authError:''});
    await this._refreshSignupSlots();
  };

  doLogin = async () => {
    if(!this.state.loginContact.trim()){ this.setState({authError:'Enter your contact number.'}); return; }
    this.setState({loading:true, authError:''});
    const {user,error} = await DB.auth.login(this.state.loginContact, this.state.loginPassword);
    if(error||!user){ this.setState({loading:false, authError:'Invalid contact number or password.'}); return; }
    await this._afterLogin(user);
    this.setState({loginContact:'', loginPassword:''});
  };

  doSignup = async () => {
    const {suName,suContact,suPassword,suShift} = this.state;
    if(!suName.trim()||!suContact.trim()||!suPassword.trim()){ this.setState({authError:'Please fill in all fields.'}); return; }
    if(suPassword.length < 6){ this.setState({authError:'Password must be at least 6 characters.'}); return; }
    const cleanContact = suContact.replace(/[\s-]/g,'');
    if(!/^[689]\d{7}$/.test(cleanContact)){ this.setState({authError:'Contact must be an 8-digit Singapore number.'}); return; }
    const activeBatch = this._liveBatch();
    if(!activeBatch){
      this.setState({authError:'No active intake batch is open for sign-up right now.'});
      return;
    }
    const members = await DB.personnel.list(activeBatch.id).catch(()=>[]);
    const shift = this._capShift(suShift||'AM', members);
    this.setState({loading:true, authError:''});
    const {user,error} = await DB.auth.signup(cleanContact, suPassword, suName.trim());
    if(error||!user){ this.setState({loading:false, authError:error?.message||'Signup failed. Try a different contact or password.'}); return; }
    const existing = await DB.personnel.findByContact(cleanContact);
    if(existing){
      await DB.personnel.linkAuth(existing.id, user.id);
    } else {
      const {error:addErr} = await DB.personnel.add({authId:user.id, name:suName, contact:suContact, shift, batchId:activeBatch.id});
      if(addErr){
        await DB.auth.logout();
        this.setState({loading:false, authError:'Profile setup failed: '+(addErr.message||'database error. Check Supabase grants.')});
        return;
      }
    }
    await this._afterLogin(user);
    this.setState({suName:'', suContact:'', suPassword:''});
  };

  logout = async () => {
    if(this._idleWarnTimer) clearTimeout(this._idleWarnTimer);
    if(this._idleLogoutTimer) clearTimeout(this._idleLogoutTimer);
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    if(this._reminderTimer) clearTimeout(this._reminderTimer);
    this._unsubscribeRealtime();
    if(!this.state.demo) await DB.auth.logout();
    this.setState({
      authed:false, role:null, authMode:'login', demo:false,
      currentUserId:null, me:null, loginContact:'', loginPassword:'',
      locStatus:'idle', locDistance:null, locGpsMsg:'', locSlow:false, locAccuracy:null, locPermErr:false, locRetryCount:0,
      accountOpen:false, confirmDelete:false,
      personnel:[], attendance:{}, history:[], attendanceCache:{}, batchMembersCache:{}, attendanceDate:null,
      testDate:null, testDateInput:'', testTime:null, testTimeInput:'', phaseSubmitting:false,
      acctNameEdit:'', acctPwCurrent:'', acctPwNew:'', acctPwConfirm:'',
      acctPwError:'', acctPwSuccess:'', acctNameError:'', acctNameSuccess:'', acctSaving:false,
      locPhase:null, batchLoading:false, batchCreating:false,
      editingNoteId:null, editingNoteText:'',
      batchJumpDate:Utils.dateKey(new Date()),
      toast:null, rosterSort:'shift', newBatchDate:'',
      peopleStats:{}, peopleStatsLoaded:false, confirmDeactivateId:null, showArchivedBatches:false, cyclePickerOpen:false,
      noAvatarIds:new Set(), noReportDaysCache:{},
      markAllPresenting:false, carryingOver:false,
      historyPage:1,
      sessionExpiring:false, idleWarning:false, showA2hs:false, forgotPasswordOpen:false,
      showLateWarning:false, lateReasonOpen:false, lateReasonText:'', lateReasonSubmitting:false,
      pendingLeaves:[], pendingLeavesLoaded:false,
      leaveOpen:false, leaveDate:'', leaveType:'mc', leaveReason:'',
      myPendingRequest:null,
      shiftChangeOpen:false, shiftChangeNew:'AM', shiftChangeReason:'',
      notifGranted:false, adminNotifGranted:false,
      myLeaveHistory:[], myLeaveHistoryLoaded:false,
      welfareNoteOpen:false, welfareNoteText:'', welfareNoteSaving:false,
    });
  };

  demoReservist = () => {
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
  };

  demoAdmin = () => {
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
  };

  // ── Form handlers ─────────────────────────────────────────────────────────
  onLoginContact  = e => this.setState({loginContact:e.target.value});
  onLoginPassword = e => this.setState({loginPassword:e.target.value});
  onSuName         = e => this.setState({suName:e.target.value});
  onSuContact      = e => this.setState({suContact:e.target.value});
  onSuShift        = e => this.setState({suShift:e.target.value});
  onSuShiftSelect  = v => () => this.setState({suShift:v});
  onSuPassword= e => this.setState({suPassword:e.target.value});
  onNpName     = e => this.setState({npName:e.target.value});
  onNpContact  = e => this.setState({npContact:e.target.value});
  onNpShift    = e => this.setState({npShift:e.target.value});
  onNpPassword = e => this.setState({npPassword:e.target.value});

  loadPendingLeaves = async () => {
    const {demo}=this.state;
    if(demo) return;
    const data=await DB.leaves.listPending().catch(()=>[]);
    this.setState({pendingLeaves:data,pendingLeavesLoaded:true});
  };
  approveLeave = id => async () => {
    const leave = this.state.pendingLeaves.find(l => l.id === id);
    if(!this.state.demo && leave) {
      const ops = [DB.leaves.updateStatus(id, 'approved').catch(()=>{})];
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
    }
    this._toast('Request approved.');
    this.loadPendingLeaves();
  };
  rejectLeave = id => async () => {
    if(!this.state.demo) await DB.leaves.updateStatus(id,'rejected').catch(()=>{});
    this._toast('Request declined.');
    this.loadPendingLeaves();
  };

  // ── Leave requests ────────────────────────────────────────────────────────
  openLeaveRequest = date => () => this.setState({leaveOpen:true, leaveDate:date, leaveType:'mc', leaveReason:''});
  closeLeaveRequest = () => this.setState({leaveOpen:false});
  onLeaveDate = e => this.setState({leaveDate:e.target.value});
  onLeaveType = v => () => this.setState({leaveType:v});
  onLeaveReason = e => this.setState({leaveReason:e.target.value});
  submitLeaveRequest = async () => {
    const {currentUserId, leaveDate, leaveType, leaveReason, demo, myPendingRequest} = this.state;
    if(myPendingRequest){ this._toast('You already have a pending request.','error'); return; }
    if(!leaveDate){ this._toast('Please select a date.','error'); return; }
    if(!demo){
      const {data, error} = await DB.leaves.request(currentUserId, leaveDate, leaveType, leaveReason).catch(e=>({error:e}));
      if(error){ this._toast('Failed to submit request.','error'); return; }
      if(data) this.setState({myPendingRequest:data});
    } else {
      this.setState({myPendingRequest:{id:'demo',personnel_id:currentUserId,date:leaveDate,type:leaveType,status:'pending'}});
    }
    this._toast('Request submitted for approval.');
    this.setState({leaveOpen:false});
  };

  // ── Shift change requests ─────────────────────────────────────────────────
  openShiftChange = () => { const me=this.cur(); this.setState({shiftChangeOpen:true,shiftChangeNew:me?.shift||'AM',shiftChangeReason:''}); };
  closeShiftChange = () => this.setState({shiftChangeOpen:false});
  onShiftChangeNew = v => () => this.setState({shiftChangeNew:v});
  onShiftChangeReason = e => this.setState({shiftChangeReason:e.target.value});
  submitShiftChange = async () => {
    const {currentUserId,shiftChangeNew,shiftChangeReason,demo}=this.state;
    if(!demo){
      const {error}=await DB.leaves.request(currentUserId,Utils.dateKey(this.baseDate()),'shift_change',shiftChangeReason,shiftChangeNew).catch(e=>({error:e}));
      if(error){ this._toast('Failed to send request.','error'); return; }
    }
    this._toast('Shift change request sent.');
    this.setState({shiftChangeOpen:false});
  };

  // ── Welfare note ──────────────────────────────────────────────────────────
  openWelfareNote = () => this.setState({welfareNoteOpen:true, welfareNoteText:this.myRec()?.welfareNote||''});
  closeWelfareNote = () => this.setState({welfareNoteOpen:false});
  onWelfareNoteText = e => this.setState({welfareNoteText:e.target.value});
  submitWelfareNote = async () => {
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
  };

  // ── Admin notifications ───────────────────────────────────────────────────
  _subscribeAdminRequests() {
    if(this.state.demo) return;
    if(this._adminRequestsChannel) return;
    this._adminRequestsChannel = DB.realtime.subscribeAdminRequests((row) => {
      this.loadPendingLeaves();
      if(this.state.adminNotifGranted && typeof Notification !== 'undefined' && Notification.permission === 'granted'){
        const typeMap = {mc:'MC',shift_change:'Shift Change',other:'Other',personal:'Personal Leave'};
        new Notification('New request from personnel', {body:(typeMap[row.type]||row.type)+' request received.',icon:'./icon.svg'});
      }
    });
  }
  requestAdminNotifs = async () => {
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
  };

  // ── Reminders ─────────────────────────────────────────────────────────────
  requestReminders = async () => {
    if(!('Notification' in window)){ this._toast('Notifications not supported on this browser.','error'); return; }
    const perm=await Notification.requestPermission();
    if(perm==='granted'){
      this.setState({notifGranted:true});
      this._scheduleReminder();
      this._toast('Reminders enabled!');
    } else {
      this._toast('Notification permission denied.','error');
    }
  };
  _scheduleReminder = () => {
    const me=this.cur(); if(!me) return;
    const shift=me.shift||'AM';
    const times={AM:'08:00',PM:'15:00',OFFICE:'08:45'};
    const [h,m]=(times[shift]||'08:00').split(':').map(Number);
    const fire=new Date(); fire.setHours(h,m,0,0);
    if(fire<=new Date()) fire.setDate(fire.getDate()+1);
    if(this._reminderTimer) clearTimeout(this._reminderTimer);
    this._reminderTimer=setTimeout(()=>{
      if(this.state.notifGranted&&!this.state.demo){
        new Notification('Time to check in!',{body:`${Utils.shiftLabel(shift)} shift starts soon. Open the app to check in.`,icon:'./icon.svg'});
      }
      this._scheduleReminder();
    },fire-new Date());
  };

  // ── Check-in ──────────────────────────────────────────────────────────────
  _detectInAppBrowser(){
    const ua=navigator.userAgent||'';
    const isIOS=/iP(hone|od|ad)/.test(ua);
    // Named in-app browsers (UA contains their identifier)
    if(/WhatsApp/i.test(ua))    return {detected:true, name:'WhatsApp'};
    if(/Instagram/i.test(ua))   return {detected:true, name:'Instagram'};
    if(/FBAN|FBAV/i.test(ua))   return {detected:true, name:'Facebook'};
    if(/Telegram/i.test(ua))    return {detected:true, name:'Telegram'};
    if(/Line\//i.test(ua))      return {detected:true, name:'Line'};
    if(/MicroMessenger/i.test(ua)) return {detected:true, name:'WeChat'};
    // iOS heuristic: real browsers (Safari, Chrome, Firefox, Edge) all append
    // "Safari/xxx" to their UA. In-app WKWebViews don't.
    if(isIOS && /AppleWebKit/.test(ua) && !/Safari\//.test(ua))
      return {detected:true, name:'a messaging app'};
    return {detected:false, name:''};
  }

  verifyLocation = () => {
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
    // Permission denied — in-app browser takes priority, then private mode, then settings
    const _permMsg=isInApp
      ?`Location is blocked inside ${inAppName}.\n\n${inAppName}'s browser cannot access GPS.\n\nFix: tap ··· or the share icon → "Open in Safari" (iPhone) or "Open in Chrome" (Android), then try again there.`
      :isIOS
      ?'Location is blocked for this site.\n\n⚠️ Using Private Browsing? Safari blocks location in private tabs — switch to a normal tab.\n\nOtherwise:\n1. iPhone Settings → Privacy & Security → Location Services → your browser → "While Using App"\n2. In Safari: tap "aA" in address bar → Website Settings → Location → Allow\n\nThen tap Reload below.'
      :isAndroid
      ?'Location is blocked for this site.\n\n⚠️ Using Incognito? Location is often blocked in private tabs — switch to a normal tab.\n\nOtherwise:\n1. Tap the 🔒 icon in your address bar → Permissions → Location → Allow\n2. Browser Settings → Site Settings → Location → this site → Allow\n3. Phone Settings → Apps → [your browser] → Permissions → Location → Allow\n\nThen tap Reload below.'
      :'Location blocked.\n\n⚠️ Using a private/incognito tab? Switch to a normal tab.\n\nOtherwise allow Location via the 🔒 lock icon in your address bar, then tap Reload below.';
    // GPS unavailable (code 2) — hardware couldn't get a fix
    const _unavailMsg=retries>=2
      ?'GPS still unavailable after several tries.\n\nAdditional steps:\n• Turn Location Services off and back on in phone Settings\n• Restart your phone\n• Contact your supervisor if the issue persists'
      :'GPS signal unavailable.\n\n• Step outside or move near a window\n• Make sure Airplane mode is off\n• Turn Location Services off and back on, then try again';
    // Timeout (code 3) — got the hardware but fix took too long
    const _timeoutMsg=retries>=2
      ?'GPS keeps timing out.\n\n• Move to an open area with clear sky view\n• Turn Location off and back on in Settings\n• Try restarting your phone\n• Contact your supervisor if this continues'
      :'GPS timed out — took more than 15 seconds.\n\n• Move to an open area or near a window\n• Make sure Location Services is on in Settings\n• Try again in a few seconds';
    navigator.geolocation.getCurrentPosition(
      pos=>{
        clearTimeout(this._locSlowTimer);
        const dist=this._haversine(pos.coords.latitude,pos.coords.longitude,this._hqLat(),this._hqLon());
        const rounded=Math.round(dist);
        const accuracy=pos.coords.accuracy!=null?Math.round(pos.coords.accuracy):null;
        // If accuracy is extremely poor and this is an early attempt, auto-retry for a cleaner fix
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
  };

  _hqLat(){ return parseFloat(this.props.hqLat)||1.332572; }
  _hqLon(){ return parseFloat(this.props.hqLon)||103.937189; }
  _maxDist(){ return parseInt(this.props.hqRange)||500; }

  _haversine(lat1,lon1,lat2,lon2){
    const R=6371000, r=Math.PI/180;
    const dLat=(lat2-lat1)*r, dLon=(lon2-lon1)*r;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  startPhaseGps = phase => () => {
    if(this.state.locStatus==='locating') return;
    const switchingPhase=this.state.locPhase!==phase;
    this.setState({locPhase:phase, locStatus:'idle', locDistance:null, locGpsMsg:'', locAccuracy:null, locSlow:false, locPermErr:false, ...(switchingPhase?{locRetryCount:0}:{})});
    this.verifyLocation();
  };

  doPhase = key => async () => {
    if(this.state.phaseSubmitting) return;
    const {locStatus,locDistance,locPhase,currentUserId,demo,isOnline,testTime} = this.state;
    const needsGps = true;
    if(needsGps && (locStatus!=='verified'||locPhase!==key)) return;
    this.setState({phaseSubmitting:true});
    const _now = testTime ? (()=>{const d=new Date();const[h,m]=testTime.split(':').map(Number);d.setHours(h,m,0,0);return d;})() : new Date();
    const time = Utils.hhmm(_now);
    // Late detection — only on p1 check-in
    if(key==='p1'){
      const me=this.state.me; const shift=me?.shift||'AM';
      const cutoff=Utils.LATE_CUTOFF[shift]||'08:30';
      const [ch,cm]=cutoff.split(':').map(Number);
      const [th,tm]=time.split(':').map(Number);
      const minsLate=(th*60+tm)-(ch*60+cm);
      if(minsLate>=60) this.setState({lateReasonOpen:true,lateReasonText:''});
      else if(minsLate>=30) this.setState({showLateWarning:true});
    }
    const dist = needsGps ? locDistance : null;
    const today = Utils.dateKey(this.baseDate());
    const rec = {...this.myRec()};
    if(key==='p1'){rec.status='present';rec.p1=time;rec.p1dist=dist;}
    else if(key==='p2') rec.p2=time;
    else if(key==='p3'){rec.p3=time;rec.p3dist=dist;}
    else if(key==='p4') rec.p4=time;
    this.setState(s=>({
      attendance:{...s.attendance,[currentUserId]:rec},
      locStatus:needsGps?'idle':s.locStatus,
      locPhase:needsGps?null:s.locPhase,
      phaseSubmitting:false,
    }));
    this._haptic();
    if(!demo){
      if(!isOnline){
        this._offlineQueues.push({id:currentUserId,date:today,key,time,dist});
        this.setState({offlinePending:true});
      } else {
        const {error:phErr} = await DB.attendance.logPhase(currentUserId, today, key, time, dist);
        if(phErr) this._toast('Check-in saved locally but failed to sync. Check your connection.','error');
      }
    }
  };

  doPhaseBypass = key => async () => {
    if(this.state.phaseSubmitting) return;
    const {currentUserId,demo,isOnline,testTime} = this.state;
    this.setState({phaseSubmitting:true});
    const _now = testTime ? (()=>{const d=new Date();const[h,m]=testTime.split(':').map(Number);d.setHours(h,m,0,0);return d;})() : new Date();
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
    if(!demo){
      if(!isOnline){
        this._offlineQueues.push({id:currentUserId,date:today,key,time,dist:null,bypassed:true});
        this.setState({offlinePending:true});
      } else {
        const {error:phErr} = await DB.attendance.logPhase(currentUserId, today, key, time, null, true);
        if(phErr) this._toast('Check-in saved locally but failed to sync. Check your connection.','error');
      }
    }
  };

  _haptic(ms=60){ if(navigator.vibrate) navigator.vibrate(ms); }
  _toast(msg, type='success'){
    if(this._toastTimer) clearTimeout(this._toastTimer);
    this.setState({toast:{msg,type}});
    this._toastTimer=setTimeout(()=>this.setState({toast:null}),type==='error'?5000:3000);
  }
  dismissToast = () => {
    if(this._toastTimer) clearTimeout(this._toastTimer);
    this.setState({toast:null});
  };

  showMoreHistory = () => { this.setState(s=>({historyPage:(s.historyPage||1)+1})); };

  _touchStartX = null;
  onDaySwipeStart = e => { this._touchStartX = e.touches[0].clientX; };
  onDaySwipeEnd   = e => {
    if(this._touchStartX===null) return;
    const dx=e.changedTouches[0].clientX-this._touchStartX;
    this._touchStartX=null;
    if(Math.abs(dx)<40) return;
    if(dx<0) this.nextDay(); else this.prevDay();
  };

  openNote  = (id, text) => () => this.setState({editingNoteId:id, editingNoteText:text||''});
  onNoteText= e => this.setState({editingNoteText:e.target.value});
  saveNote  = async () => {
    const {editingNoteId, editingNoteText, demo} = this.state;
    if(!editingNoteId) return;
    if(!demo) await DB.personnel.updateNote(editingNoteId, editingNoteText).catch(()=>{});
    this.setState(s=>({
      personnel: s.personnel.map(p=>p.id===editingNoteId?{...p,notes:editingNoteText}:p),
      editingNoteId: null, editingNoteText: '',
    }));
    this._toast('Note saved.');
  };
  closeNote = () => this.setState({editingNoteId:null, editingNoteText:''});

  changeShift = id => async e => {
    const shift=e.target.value;
    if(shift==='AM'||shift==='PM'){
      const others=this.state.personnel.filter(p=>p.id!==id&&p.is_active!==false&&(p.role||'reservist')==='reservist');
      const count=others.filter(p=>p.shift===shift).length;
      if(count>=2){ this._toast((shift==='AM'?'AM':'PM')+' shift is full (2/2).','error'); return; }
    }
    if(!this.state.demo) await DB.personnel.updateShift(id, shift).catch(()=>{});
    this.setState(s=>({personnel:s.personnel.map(p=>p.id===id?{...p,shift}:p)}));
  };


  // ── Account ───────────────────────────────────────────────────────────────
  headerChipClick = () => this.setState({accountOpen:true, acctNameEdit:this.cur()?.name||''});
  closeAccount = () => this.setState({accountOpen:false, confirmDelete:false, acctPwError:'', acctPwSuccess:'', acctNameError:'', acctNameSuccess:''});
  askDelete   = () => this.setState({confirmDelete:true});
  cancelDelete= () => this.setState({confirmDelete:false});

  deleteAccount = async () => {
    if(!this.state.demo) await DB.personnel.deactivate(this.state.currentUserId);
    await DB.auth.logout();
    this.setState({authed:false,role:null,authMode:'login',accountOpen:false,confirmDelete:false,accountDeleted:true,loginContact:'',loginPassword:'',demo:false});
  };

  onAvatarFile = e => {
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      const uid=this.state.currentUserId;
      localStorage.setItem('avatar_'+uid, r.result);
      this.setState(s=>{const noAv=new Set(s.noAvatarIds||[]);noAv.delete(uid);return{avatars:{...s.avatars,[uid]:r.result},noAvatarIds:noAv};});
      if(!this.state.demo){
        DB.storage.uploadAvatar(uid, f)
          .then(({error})=>{
            if(!error){
              const url=DB.storage.getAvatarUrl(uid)+'?t='+Date.now();
              if(url){ localStorage.setItem('avatar_'+uid, url); this.setState(s=>({avatars:{...s.avatars,[uid]:url}})); }
            }
          })
          .catch(()=>{});
      }
    };
    r.readAsDataURL(f);
  };

  removeAvatar = async () => {
    const uid=this.state.currentUserId;
    localStorage.setItem('avatar_'+uid, 'REMOVED');
    this.setState(s=>{const av={...s.avatars};delete av[uid];const noAv=new Set(s.noAvatarIds||[]);noAv.add(uid);return{avatars:av,noAvatarIds:noAv};});
    if(!this.state.demo) await DB.storage.deleteAvatar(uid).catch(()=>{});
    this._toast('Profile photo removed.');
  };

  // ── Account editing ───────────────────────────────────────────────────────
  onAcctNameEdit  = e => this.setState({acctNameEdit:e.target.value, acctNameError:'', acctNameSuccess:''});
  onAcctPwCurrent = e => this.setState({acctPwCurrent:e.target.value, acctPwError:'', acctPwSuccess:''});
  onAcctPwNew     = e => this.setState({acctPwNew:e.target.value, acctPwError:'', acctPwSuccess:''});
  onAcctPwConfirm = e => this.setState({acctPwConfirm:e.target.value, acctPwError:'', acctPwSuccess:''});

  saveAcctName = async () => {
    const name = this.state.acctNameEdit.trim();
    if(!name){ this.setState({acctNameError:'Name cannot be empty.'}); return; }
    this.setState({acctSaving:true, acctNameError:'', acctNameSuccess:''});
    if(!this.state.demo){
      const {error} = await DB.personnel.updateName(this.state.currentUserId, name).catch(e=>({error:e}));
      if(error){ this.setState({acctSaving:false, acctNameError:'Failed to save. Try again.'}); return; }
    }
    this.setState(s=>({acctSaving:false, acctNameSuccess:'Name updated.', me:{...s.me, name}}));
  };

  saveAcctPw = async () => {
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
  };

  // ── Test date override ────────────────────────────────────────────────────
  onTestDateInput = e => this.setState({testDateInput:e.target.value});

  setTestDate = async () => {
    const d = this.state.testDateInput;
    if(!d) return;
    this.setState({testDate:d, viewOffset:0});
    if(this.state.role==='admin'&&!this.state.demo){
      let batches = await DB.batches.list().catch(()=>this.state.batches);
      batches = await this._ensureLiveBatch(batches, d);
      const liveIdx = batches.findIndex(b=>b.is_live);
      this.setState({batches, activeBatchIdx:liveIdx>=0?liveIdx:0});
    }
    if(this.state.role==='reservist'&&!this.state.demo){
      const [att, hist] = await Promise.all([
        DB.attendance.getForDate(d).catch(()=>({})),
        DB.attendance.getHistory(this.state.currentUserId, d).catch(()=>[]),
      ]);
      this.setState({attendance:att, attendanceDate:d, history:hist});
    }
  };

  clearTestDate = async () => {
    this.setState({testDate:null, testDateInput:'', viewOffset:0});
    if(this.state.role==='admin'&&!this.state.demo){
      let batches = await DB.batches.list().catch(()=>this.state.batches);
      batches = await this._ensureLiveBatch(batches, Utils.dateKey(new Date()));
      const liveIdx = batches.findIndex(b=>b.is_live);
      this.setState({batches, activeBatchIdx:liveIdx>=0?liveIdx:0});
    }
    if(this.state.role==='reservist'&&!this.state.demo){
      const today = Utils.dateKey(new Date());
      const [att, hist] = await Promise.all([
        DB.attendance.getForDate(today).catch(()=>({})),
        DB.attendance.getHistory(this.state.currentUserId).catch(()=>[]),
      ]);
      this.setState({attendance:att, attendanceDate:today, history:hist});
    }
  };



  // ── Test time override ────────────────────────────────────────────────────
  onTestTimeInput = e => this.setState({testTimeInput:e.target.value});
  setTestTime = () => { const t=this.state.testTimeInput; if(!t) return; this.setState({testTime:t}); };
  clearTestTime = () => this.setState({testTime:null, testTimeInput:''});

  // ── Export CSV ────────────────────────────────────────────────────────────
  exportCsv = async () => {
    const {batches,activeBatchIdx,batchMembersCache,personnel,attendance,noReportDays,demo}=this.state;
    const batch=batches[activeBatchIdx||0]; if(!batch) return;
    const members=batch.is_live?personnel:(batchMembersCache[batch.id]||[]);
    const start=new Date(batch.start_date+'T00:00:00'), end=new Date(batch.end_date+'T00:00:00');
    const dates=[];
    for(let d=new Date(start);d<=end;d=Utils.addDays(d,1)){
      if(Utils.isReportDay(d)&&!Utils.holidayName(d)&&!noReportDays.has(Utils.dateKey(d))) dates.push(new Date(d));
    }
    // For the live batch, attendanceCache only has dates the admin has navigated to.
    // Fetch the full batch attendance before building the CSV.
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
  };

  // ── Realtime ──────────────────────────────────────────────────────────────
  _subscribeRealtime(dateStr){
    if(this.state.demo) return;
    const ch=DB.realtime.subscribeAttendance(dateStr, row=>{
      // Merge with existing — Supabase realtime may send partial rows (only changed columns)
      this.setState(s=>{
        const existing=s.attendance[row.personnel_id]||{};
        const incoming=DB.attendance._toEntry(row);
        const merged={};
        for(const k of Object.keys(incoming)) merged[k]=incoming[k]??existing[k];
        return {attendance:{...s.attendance,[row.personnel_id]:merged}};
      });
    });
    this.setState({realtimeChannel:ch});
  }
  _unsubscribeRealtime(){
    DB.realtime.unsubscribe(this.state.realtimeChannel);
    if(this._myLeaveChannel){ DB.realtime.unsubscribe(this._myLeaveChannel); this._myLeaveChannel = null; }
    if(this._myAttendanceChannel){ DB.realtime.unsubscribe(this._myAttendanceChannel); this._myAttendanceChannel = null; }
    if(this._adminRequestsChannel){ DB.realtime.unsubscribe(this._adminRequestsChannel); this._adminRequestsChannel = null; }
  }

  // ── Admin actions ─────────────────────────────────────────────────────────
  toggleMealActive = async () => {
    const {batches,activeBatchIdx,demo}=this.state;
    const idx=activeBatchIdx||0;
    const activeBatch=batches[idx]; if(!activeBatch) return;
    const next=!activeBatch.meal_active;
    if(!demo) await DB.batches.setMealActive(activeBatch.id, next);
    this.setState(s=>({batches:s.batches.map((b,i)=>i===idx?{...b,meal_active:next}:b)}));
    this._toast('Meal allowance forms '+(next?'activated':'paused')+'.');
  };

  openCyclePicker  = () => this.setState({cyclePickerOpen:true});
  closeCyclePicker = () => this.setState({cyclePickerOpen:false});

  toggleNoReporting = async () => {
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
  };

  _navToOffset = async (off) => {
    const date=Utils.dateKey(this.dateForOffset(off));
    const {batches}=this.state;
    const curIdx=this.state.activeBatchIdx||0;
    // Prefer the batch whose reporting window (start→end_date) covers the date —
    // this handles overlap where the next batch's reporting days start before the
    // previous batch's dekit date (e.g. B1 Jul starts Jun 30, B2 Jun dekit Jul 1).
    let ni=batches.findIndex((b,i)=>i!==curIdx&&date>=b.start_date&&date<=b.end_date);
    if(ni<0) ni=batches.findIndex((b,i)=>i===curIdx&&date>=b.start_date&&date<=b.end_date);
    // Fall back to dekit range (e.g. navigating to the dekit day itself)
    if(ni<0) ni=batches.findIndex((b,i)=>i!==curIdx&&date>=b.start_date&&date<=(b.dekit_date||b.end_date));
    if(ni<0) ni=batches.findIndex((b,i)=>i===curIdx&&date>=b.start_date&&date<=(b.dekit_date||b.end_date));
    // Gap between batches: fall back to the most recently ended batch before target date
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
      this.setState(s=>({activeBatchIdx:ni,viewOffset:off,selectedCalOffset:null,attendanceCache:b.is_live?{}:{...s.attendanceCache,...attMap},noReportDays:nrd,noReportDaysCache:cachedNrd?s.noReportDaysCache:{...s.noReportDaysCache,[b.id]:nrd},batchLoading:false,rosterSearch:''}));
      return;
    }
    this.setState({viewOffset:off});
    this._loadDateAttendance(off);
  };
  prevDay = () => this._navToOffset(this.state.viewOffset-1);
  nextDay = () => this._navToOffset(this.state.viewOffset+1);
  goToday = () => this._navToOffset(0);

  setBatch = i => async () => {
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
      activeBatchIdx:i, viewOffset:off, selectedCalOffset:null,
      attendanceCache: b.is_live ? {} : {...s.attendanceCache, ...batchAttMap},
      noReportDays,
      noReportDaysCache: cachedNrd?s.noReportDaysCache:{...s.noReportDaysCache,[b.id]:noReportDays},
      batchLoading:false, rosterSearch:'',
    }));
  };

  onBatchJumpDate = e => this.setState({batchJumpDate:e.target.value});
  jumpToDate = async () => {
    const {batchJumpDate, demo}=this.state;
    if(!batchJumpDate) return;
    this.setState({batchLoading:true, batchJumpDate:''});
    // Fetch fresh batch list and create forward batches to cover the target date if needed
    let batches=this.state.batches;
    if(!demo){
      const sorted=[...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
      const lastBatch=sorted[sorted.length-1];
      const lastEnd=lastBatch?.dekit_date||lastBatch?.end_date||'';
      if(batchJumpDate>lastEnd){
        // Target is beyond all existing batches — create until covered + 3 ahead
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
  };

  setStatus = (id, status) => async () => {
    const off=this.state.viewOffset||0;
    const viewDateKey=Utils.dateKey(this.dateForOffset(off));
    const viewIsToday=off===0;
    const prev=viewIsToday?(this.state.attendance[id]||{}):((this.state.attendanceCache?.[viewDateKey]||{})[id]||{});
    // Preserve all existing timing; only fill p1 when marking present with no prior check-in
    const p1=status==='present'?(prev.p1||Utils.hhmm(new Date())):prev.p1;
    const entry={...prev,status,p1};
    if(viewIsToday){ this.setState(s=>({attendance:{...s.attendance,[id]:entry}})); }
    else { this.setState(s=>({attendanceCache:{...s.attendanceCache,[viewDateKey]:{...(s.attendanceCache?.[viewDateKey]||{}),[id]:entry}}})); }
    if(!this.state.demo){
      // Only write check_in_time to DB when there was no prior check-in and we're marking present
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
  };

  addPerson = async () => {
    const {npName,npContact,npShift,npPassword,batches,activeBatchIdx,demo,personnel,batchMembersCache}=this.state;
    if(!npName.trim()){ this._toast('Name is required.','error'); return; }
    const cleanContact=npContact.replace(/[\s-]/g,'');
    if(!cleanContact){ this._toast('Contact number is required.','error'); return; }
    if(!/^[689]\d{7}$/.test(cleanContact)){ this._toast('Contact must be an 8-digit Singapore number.','error'); return; }
    if(personnel.some(p=>p.contact.replace(/[\s-]/g,'')===cleanContact)){ this._toast('This contact is already on the roster.','error'); return; }
    if(!npPassword.trim()){ this._toast('Password is required.','error'); return; }
    if(npPassword.length<6){ this._toast('Password must be at least 6 characters.','error'); return; }
    const activeBatch=batches[activeBatchIdx||0];
    const batchMembers=activeBatch?.is_live?personnel.filter(p=>p.batch_id===activeBatch?.id):(batchMembersCache?.[activeBatch?.id]||[]);
    const {am:bAm,pm:bPm}=this._shiftSlotCounts(personnel);
    if(npShift==='AM'&&bAm>=2){ this._toast('AM shift is full (2/2). Select PM or Office.','error'); return; }
    if(npShift==='PM'&&bPm>=2){ this._toast('PM shift is full (2/2). Select AM or Office.','error'); return; }
    const shift=npShift;
    const contact=cleanContact;
    const addedName=npName.trim();
    if(!demo){
      let authId=null;
      {
        const {user,error}=await DB.auth.createUserAsAdmin(cleanContact,npPassword,addedName);
        if(error||!user){ this._toast('Account creation failed: '+(error?.message||'Try again.'),'error'); return; }
        authId=user.id;
      }
      const {data,error}=await DB.personnel.add({authId,name:addedName,contact,shift,batchId:activeBatch?.id});
      if(error||!data){ this._toast('Failed to add. Try again.','error'); return; }
      this.setState(s=>({personnel:[...s.personnel,data],npName:'',npContact:'',npShift:'AM',npPassword:'',rosterSearch:''}));
    } else {
      const id='demo-'+Date.now();
      this.setState(s=>({personnel:[...s.personnel,{id,name:addedName,contact,shift,role:'reservist',batch_id:activeBatch?.id,is_active:true}],npName:'',npContact:'',npShift:'AM',npPassword:'',rosterSearch:''}));
    }
    this._toast(addedName+' added to roster.');
  };

  onRosterSearch = e => this.setState({rosterSearch:e.target.value});
  clearRosterSearch = () => this.setState({rosterSearch:''});
  retrySync = () => { if(this.state.isOnline) this._onOnline(); };
  refreshSessionNow = async () => {
    this.setState({sessionExpiring:false});
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    try { await DB.auth.refreshSession(); } catch(e){}
    this._sessionWarnTimer = setTimeout(()=>{ if(this.state.authed) this.setState({sessionExpiring:true}); }, 55*60*1000);
  };
  dismissA2hs = () => { localStorage.setItem('a2hs_dismissed','1'); this.setState({showA2hs:false}); };
  openForgotPassword = () => this.setState({forgotPasswordOpen:true});
  closeForgotPassword = () => this.setState({forgotPasswordOpen:false});
  dismissLateWarning = () => this.setState({showLateWarning:false});
  onLateReasonText = e => this.setState({lateReasonText:e.target.value});
  skipLateReason = () => this.setState({lateReasonOpen:false,lateReasonText:''});
  submitLateReason = async () => {
    const {lateReasonText,currentUserId,demo,isOnline} = this.state;
    if(!lateReasonText.trim()) return;
    this.setState({lateReasonSubmitting:true});
    if(!demo){
      if(!isOnline){ this._toast('No connection — reason not saved. Try again when online.','error'); this.setState({lateReasonSubmitting:false}); return; }
      const today=Utils.dateKey(this.baseDate());
      const {error} = await DB.attendance.submitLateReason(currentUserId, today, lateReasonText.trim());
      if(error){ this._toast('Failed to save reason. Try again.','error'); this.setState({lateReasonSubmitting:false}); return; }
    }
    this.setState({lateReasonOpen:false,lateReasonText:'',lateReasonSubmitting:false});
    this._toast('Reason submitted.');
  };
  _shouldShowA2hs(){
    try{
      if(window.navigator.standalone||window.matchMedia('(display-mode:standalone)').matches) return false;
      if(localStorage.getItem('a2hs_dismissed')) return false;
      const last = localStorage.getItem('a2hs_seen');
      if(last && (Date.now() - parseInt(last)) < 24*60*60*1000) return false; // at most once per day
      return /Android|iPhone|iPad|iPod/.test(navigator.userAgent||'');
    }catch(e){return false;}
  }
  markAllPresent = async () => {
    if(this.state.markAllPresenting) return;
    this.setState({markAllPresenting:true});
    const off=this.state.viewOffset||0;
    const viewDateKey=Utils.dateKey(this.dateForOffset(off));
    const viewIsToday=off===0;
    const viewMap=viewIsToday?this.state.attendance:(this.state.attendanceCache?.[viewDateKey]||{});
    const {batches,activeBatchIdx,batchMembersCache}=this.state;
    const activeBatch=batches[activeBatchIdx||0];
    const activeMembers=activeBatch?.is_live?this.state.personnel:(batchMembersCache?.[activeBatch?.id]||[]);
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
  };

  refreshPage = async () => {
    const {role, me, demo} = this.state;
    if(demo || !me) return;
    const today = Utils.dateKey(this.baseDate());
    // Reload batch list so deletions/additions in Supabase are reflected
    let batches = await DB.batches.list().catch(()=>this.state.batches);
    if(role==='admin'){
      batches = await this._ensureLiveBatch(batches).catch(()=>batches);
      batches = await this._ensureForwardBatches(batches, 2).catch(()=>batches);
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
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  _scrollTop(){ document.getElementById('main-scroll')?.scrollTo(0,0); }
  go = t => () => { this.setState({tab:t}); this._scrollTop(); };
  setRolesTab  = k => () => this.setState({rolesTab:k});
  selectCalDay = off => () => this.setState(s=>({selectedCalOffset:s.selectedCalOffset===off?null:off}));
  goPeople = () => { this.setState({tab:'people',peopleStatsLoaded:false}); this.loadPeopleStats(); this.loadRosterAvatars(); this.loadPendingLeaves(); this._scrollTop(); };

  loadRosterAvatars = async () => {
    const {batches,activeBatchIdx,demo,batchMembersCache,personnel,noAvatarIds}=this.state;
    if(demo) return;
    const batch=batches[activeBatchIdx||0];
    const members=batch?.is_live?personnel:(batchMembersCache[batch?.id]||[]);
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
  };

  loadPeopleStats = async () => {
    const {batches,activeBatchIdx,personnel,demo}=this.state;
    const batch=batches[activeBatchIdx||0];
    if(!batch||demo) return;
    const allAtt=await DB.attendance.getForBatch(batch.start_date,batch.dekit_date||batch.end_date).catch(()=>({}));
    const stats={};
    for(const p of personnel){
      let present=0,mc=0,absent=0;
      for(const dateMap of Object.values(allAtt)){
        const rec=dateMap[p.id];
        if(rec?.status==='present') present++;
        else if(rec?.status==='mc') mc++;
        else if(rec?.status==='absent') absent++;
      }
      const total=present+mc+absent;
      stats[p.id]={present,mc,absent,total,pct:total?Math.round(present/total*100):null};
    }
    this.setState({peopleStats:stats,peopleStatsLoaded:true});
  };

  setRosterSort = key => () => this.setState({rosterSort:key});
  onNewBatchDate = e => this.setState({newBatchDate:e.target.value});

  createBatch = async () => {
    const {newBatchDate,batches,demo,batchCreating}=this.state;
    if(!newBatchDate||batchCreating) return;
    this.setState({batchCreating:true});
    const start=new Date(newBatchDate+'T00:00:00');
    const {start:s,end:e,dekit:dk}=Utils.batchDatesFrom(start);
    const startStr=Utils.dateKey(s),endStr=Utils.dateKey(e),dekitStr=Utils.dateKey(dk);
    const sameYear=batches.filter(b=>b.start_date.slice(0,4)===startStr.slice(0,4));
    const num=sameYear.length+1;
    const label=Utils.batchLabel(startStr,endStr,num);
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
  };

  carryOver = async () => {
    const {batches, carryingOver, demo} = this.state;
    if(carryingOver) return;
    const liveBatch = batches.find(b => b.is_live);
    if(!liveBatch) return;
    this.setState({carryingOver:true});
    if(!demo){
      const {error} = await DB.personnel.carryOver(liveBatch.id);
      if(error){
        this._toast('Could not carry over. Check your connection.', 'error');
        this.setState({carryingOver:false});
        return;
      }
    }
    const personnel = await DB.personnel.list().catch(()=>this.state.personnel);
    this.setState({personnel, carryingOver:false});
    this._toast('Personnel carried over to current batch.');
  };

  askDeactivatePerson = id => () => this.setState({confirmDeactivateId:id});
  cancelDeactivatePerson = () => this.setState({confirmDeactivateId:null});
  confirmDeactivatePerson = async () => {
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
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  baseDate(){ if(this.state.testDate){ return new Date(this.state.testDate+'T00:00:00'); } const d=new Date(); d.setHours(0,0,0,0); return d; }
  dateForOffset(off){ return Utils.addDays(this.baseDate(), off); }
  isNoReport(off){
    const d=this.dateForOffset(off);
    if(!Utils.isReportDay(d)) return false;
    return this.state.noReportDays.has(Utils.dateKey(d)) || !!Utils.holidayName(d);
  }
  cur(){ return this.state.me || this.state.personnel.find(p=>p.id===this.state.currentUserId) || null; }
  myRec(){ return this.state.attendance[this.state.currentUserId]||{status:'pending'}; }
  _liveBatch(batches){
    const list = batches || this.state.batches;
    return list.find(b=>b.is_live) || list[0] || null;
  }
  async _refreshSignupSlots(){
    const liveBatch = this._liveBatch();
    if(!liveBatch || this.state.demo) return;
    const personnel = await DB.personnel.list().catch(()=>[]);
    const liveIdx = this.state.batches.findIndex(b=>b.id===liveBatch.id);
    this.setState({personnel, activeBatchIdx:liveIdx>=0?liveIdx:this.state.activeBatchIdx});
  }
  _shiftSlotCounts(members){
    const list = (members||[]).filter(p=>p.is_active!==false && (p.role||'reservist')==='reservist');
    return {
      am: list.filter(p=>p.shift==='AM').length,
      pm: list.filter(p=>p.shift==='PM').length,
    };
  }
  _capShift(want, members){
    const {am, pm} = this._shiftSlotCounts(members || this.state.personnel);
    if(want==='AM'&&am>=2) return 'OFFICE';
    if(want==='PM'&&pm>=2) return 'OFFICE';
    return want;
  }

  _calDayDetail(off, dst){
    const d=this.dateForOffset(off), hol=Utils.holidayName(d), dk=Utils.dateKey(d);
    if(off===0){
      if(!Utils.isReportDay(d)) return {label:'Weekend',sub:'No reporting required',color:'#8a94a3',bg:'#f6f8fa'};
      if(this.isNoReport(0)) return {label:'No reporting',sub:hol||'Marked as a no-reporting day',color:'#b9791a',bg:'#f7efdc'};
      const rec=this.myRec(), st=rec.status||'pending';
      if(st==='present') return {label:'Checked in',sub:'Reported at '+(rec.p1||'-'),color:'#1f8a5b',bg:'#e7f3ec'};
      if(st==='mc')      return {label:'On MC',sub:'Sick leave declared for today',color:'#b9791a',bg:'#f7efdc'};
      return {label:'Pending',sub:'You have not checked in yet today',color:'#5c6678',bg:'#eceef2'};
    }
    if(hol) return {label:'Public holiday',sub:hol+', no reporting',color:'#b9791a',bg:'#f7efdc'};
    if(dst==='ph') return {label:'Public holiday',sub:'No reporting required',color:'#b9791a',bg:'#f7efdc'};
    if(dst==='nr') return {label:'No reporting',sub:'Marked as a no-reporting day',color:'#8a94a3',bg:'#f0f2f7'};
    if(dst==='dekit') return {label:'Dekit day',sub:'Return equipment and submit meal allowance forms',color:'#161f30',bg:'#eceef2'};
    if(dst==='end') return {label:off<0?'Reporting day':'Upcoming',sub:'Last reporting day of your cycle',color:'#5c6678',bg:'#eceef2'};
    if(dst==='post') return {label:'No reporting',sub:'Reporting cycle ended, await dekit',color:'#8a94a3',bg:'#f0f2f7'};
    if(dst==='wknd') return {label:'Weekend',sub:'No reporting required',color:'#8a94a3',bg:'#f6f8fa'};
    if(dst==='past'){
      const {attendanceDate, attendance, currentUserId} = this.state;
      const myAtt = attendance[currentUserId];
      const hr = this.state.history.find(r=>r.date===dk)
        || (dk===attendanceDate && myAtt?.status && myAtt.status!=='pending'
            ? {status:myAtt.status, check_in_time:myAtt.p1?myAtt.p1+':00':null} : null);
      if(hr){
        const t=hr.check_in_time?hr.check_in_time.slice(0,5):'-';
        if(hr.status==='present') return {label:'Present',sub:'Reported at '+t,color:'#1f8a5b',bg:'#e7f3ec'};
        if(hr.status==='mc')     return {label:'On MC',sub:'Sick leave recorded',color:'#b9791a',bg:'#f7efdc'};
        if(hr.status==='absent') return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
      }
      return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
    }
    if(dst==='work'||dst==='today'){
      if(off<0){
        const {attendanceDate, attendance, currentUserId} = this.state;
        const myAtt = attendance[currentUserId];
        const hr = this.state.history.find(r=>r.date===dk)
          || (dk===attendanceDate && myAtt?.status && myAtt.status!=='pending'
              ? {status:myAtt.status, check_in_time:myAtt.p1?myAtt.p1+':00':null} : null);
        if(hr){
          const t=hr.check_in_time?hr.check_in_time.slice(0,5):'-';
          if(hr.status==='present') return {label:'Present',sub:'Reported at '+t,color:'#1f8a5b',bg:'#e7f3ec'};
          if(hr.status==='mc')     return {label:'On MC',sub:'Sick leave recorded',color:'#b9791a',bg:'#f7efdc'};
          if(hr.status==='absent') return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
        }
        return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
      }
      return {label:'Upcoming',sub:'Reporting day',color:'#5c6678',bg:'#eceef2'};
    }
    if(dst==='pre') return {label:'No reporting',sub:'Before your cycle started',color:'#5c6678',bg:'#eceef2'};
    return {label:'No reporting',sub:'Outside your reporting cycle',color:'#b9791a',bg:'#f7efdc'};
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  _buildAuth(s, accent){
    const activeBatch=this._liveBatch(s.batches);
    const {am:amCount, pm:pmCount}=this._shiftSlotCounts(s.personnel);
    const amFull=amCount>=2, pmFull=pmCount>=2;
    let suShift=s.suShift;
    if((suShift==='AM'&&amFull)||(suShift==='PM'&&pmFull)) suShift='OFFICE';
    const shiftOptions=[
      {value:'AM', disabled:amFull, selected:suShift==='AM', label:amFull?'AM shift (0830-1530) - Taken':'AM shift (0830-1530) ('+amCount+'/2)'},
      {value:'PM', disabled:pmFull, selected:suShift==='PM', label:pmFull?'PM shift (1530-2230) - Taken':'PM shift (1530-2230) ('+pmCount+'/2)'},
      {value:'OFFICE', disabled:false, selected:suShift==='OFFICE', label:'Office (0900-1800)'},
    ];
    const tb=a=>`flex:1;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;${a?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':'background:transparent;color:#8a94a3;'}`;
    const bs=activeBatch?new Date(activeBatch.start_date+'T00:00:00'):null;
    const be=activeBatch?new Date(activeBatch.end_date+'T00:00:00'):null;
    const intakeLabel=activeBatch?activeBatch.label:'';
    const intakeRangeFull=bs&&be?(Utils.fmtShort(bs)+' to '+Utils.fmtShort(be)+' '+bs.getFullYear()):'';
    return {
      showAuth:!s.authed, showApp:s.authed,
      isLogin:s.authMode==='login', isSignup:s.authMode==='signup',
      goLogin:this.goLogin, goSignup:this.goSignup,
      loginTabStyle:tb(s.authMode==='login'), signupTabStyle:tb(s.authMode==='signup'),
      accountDeleted:s.accountDeleted,
      loginNric:s.loginContact, loginPassword:s.loginPassword, authError:s.authError,
      authLoading:s.loading,
      loginBtnLabel:s.loading?'Logging in…':'Log in',
      signupBtnLabel:s.loading?'Creating account…':'Create account',
      onLoginNric:this.onLoginContact, onLoginPassword:this.onLoginPassword,
      doLogin:this.doLogin, demoReservist:this.demoReservist, demoAdmin:this.demoAdmin,
      suName:s.suName, suContact:s.suContact, suShift, shiftOptions, suPassword:s.suPassword,
      amFull, pmFull, amCount, pmCount,
      amShiftLabel:amFull?'AM shift (0830-1530) - Taken':'AM shift (0830-1530) ('+amCount+'/2)',
      pmShiftLabel:pmFull?'PM shift (1530-2230) - Taken':'PM shift (1530-2230) ('+pmCount+'/2)',
      onSuName:this.onSuName, onSuContact:this.onSuContact, onSuShift:this.onSuShift, onSuShiftSelect:this.onSuShiftSelect, onSuPassword:this.onSuPassword,
      doSignup:this.doSignup,
      intakeLabel, intakeRange:intakeRangeFull, intakeRangeFull,
      forgotPasswordOpen:s.forgotPasswordOpen,
      openForgotPassword:this.openForgotPassword, closeForgotPassword:this.closeForgotPassword,
    };
  }

  _buildNav(s, accent, orgName){
    const me=this.cur();
    const TITLES={checkin:'Check-In',briefings:'Briefings',attendance:'Attendance',meal:'Meal Allowance',overview:'Dashboard',roster:'Roster',log:'Attendance Log',people:'Personnel'};
    const nc=t=>s.tab===t?accent:'#9aa3b2';
    const ni=t=>s.tab===t?accent:'transparent';
    return {
      isReservist:s.role==='reservist', isAdmin:s.role==='admin',
      headerChipClick:this.headerChipClick, logout:this.logout,
      userName:s.role==='admin'?(me?.name||'Supervisor'):(me?.name||''),
      userInitials:s.role==='admin'?(me?.name?Utils.initials(me.name):'SV'):Utils.initials(me?.name||''),
      tabTitle:TITLES[s.tab]||'',
      headerKicker:s.role==='admin'?'Admin, '+orgName:orgName+', PNSMEN',
      goCheckin:this.go('checkin'), goBriefings:this.go('briefings'), goAttendance:this.go('attendance'), goMeal:this.go('meal'),
      goOverview:()=>{ this.setState({tab:'overview'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goRoster:()=>{ this.setState({tab:'roster'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goLog:()=>{ this.setState({tab:'log'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goPeople:this.goPeople,
      cCheckin:nc('checkin'), cBriefings:nc('briefings'), cAttendance:nc('attendance'), cMeal:nc('meal'),
      cOverview:nc('overview'), cRoster:nc('roster'), cLog:nc('log'), cPeople:nc('people'),
      ntCheckin:ni('checkin'), ntBriefings:ni('briefings'), ntAttendance:ni('attendance'), ntMeal:ni('meal'),
      ntOverview:ni('overview'), ntRoster:ni('roster'), ntLog:ni('log'), ntPeople:ni('people'),
      tabCheckin:s.tab==='checkin', tabBriefings:s.tab==='briefings', tabAttendance:s.tab==='attendance', tabMeal:s.tab==='meal',
      tabOverview:s.tab==='overview', tabRoster:s.tab==='roster', tabLog:s.tab==='log', tabPeople:s.tab==='people',
    };
  }

  _buildCheckin(s, accent, hqName){
    const me=this.cur();
    if(!me) return {
      todayLong:Utils.fmtLong(new Date()), clock:Utils.hhmm(s.now),
      myShiftLabel:'', myShiftWindow:'', myStatusLabel:'', myStatusColor:accent,
      myStatusPulse:'', phToday:false, phName:'',
      isMc:false, showPhases:false, phases:[], allDone:false,
      outOfCycle:false, outOfCycleTitle:'', outOfCycleSub:'',
      batchLabel:'', dekitCountdown:'', batchRange:'', showBatchInfo:false,
      whatsappLink:'', showWaShare:false,
      isOffline:!s.isOnline, offlinePending:s.offlinePending,
      hasTestDate:false, testDate:'', testDateInput:'', onTestDateInput:()=>{}, setTestDate:()=>{}, clearTestDate:()=>{},
      hasPendingRequest:false, pendingRequestLabel:'', pendingRequestDate:'',
      isAbsent:false,
      openLeaveRequest:()=>{}, leaveOpen:false, leaveDate:'', leaveType:'personal', leaveReason:'',
      leaveIsPersonal:true, leaveIsMc:false, leaveIsOther:false,
      onLeaveDate:()=>{}, onLeaveTypePersonal:()=>{}, onLeaveTypeMc:()=>{}, onLeaveTypeOther:()=>{},
      onLeaveReason:()=>{}, submitLeaveRequest:()=>{}, closeLeaveRequest:()=>{},
      openShiftChange:()=>{}, shiftChangeOpen:false, shiftChangeNew:'AM', shiftChangeReason:'',
      shiftChangeIsAm:true, shiftChangeIsPm:false, shiftChangeIsOffice:false,
      onShiftChangeAm:()=>{}, onShiftChangePm:()=>{}, onShiftChangeOffice:()=>{},
      onShiftChangeReason:()=>{}, submitShiftChange:()=>{}, closeShiftChange:()=>{},
      notifGranted:false, requestReminders:()=>{},
    };
    const rec=this.myRec(), status=rec.status||'pending', m=Utils.meta(status);
    const todayD=this.dateForOffset(0);
    const isOffDay=!Utils.isReportDay(todayD);
    const noRep=isOffDay||this.isNoReport(0);
    const todayKey=Utils.dateKey(todayD);
    const myBatch=s.batches.find(b=>b.id===me.batch_id);
    let outOfCycle=false, outOfCycleTitle='', outOfCycleSub='';
    if(!myBatch){
      outOfCycle=true; outOfCycleTitle='No cycle assigned';
      outOfCycleSub='You have not been assigned to a batch. Contact your supervisor.';
    } else {
      const bsKey=myBatch.start_date, beKey=myBatch.end_date, ddKey=myBatch.dekit_date;
      if(todayKey<bsKey){
        outOfCycle=true; outOfCycleTitle='Cycle not started';
        outOfCycleSub='Your reporting cycle begins on '+Utils.fmtMed(new Date(bsKey+'T00:00:00'))+'. Nothing to do yet.';
      } else if(ddKey&&todayKey===ddKey){
        outOfCycle=true; outOfCycleTitle='Dekit day';
        outOfCycleSub='Return all equipment and submit your meal allowance forms today.';
      } else if(ddKey&&todayKey>ddKey){
        outOfCycle=true; outOfCycleTitle='Cycle complete';
        outOfCycleSub=(myBatch.label?myBatch.label+' is complete.':'Your cycle is complete.')+' Well done.';
      } else if(todayKey>beKey){
        outOfCycle=true; outOfCycleTitle='Reporting days ended';
        const dekitD=ddKey?Utils.fmtMed(new Date(ddKey+'T00:00:00')):null;
        outOfCycleSub='Your last reporting day has passed.'+(dekitD?' Dekit on '+dekitD+'.':'');
      }
    }

    // GPS state (shared across phases, scoped by locPhase)
    const locVerified=s.locStatus==='verified', locLocating=s.locStatus==='locating';
    const locOutOfRange=s.locStatus==='out_of_range', locGpsError=s.locStatus==='gps_error';
    const locIdle=!s.locStatus||s.locStatus==='idle';
    let gLocBorder,gLocCardBg,gLocBadgeBg,gLocBadgeColor,gLocMsg,gLocMsgColor;
    const accStr=s.locAccuracy!=null?' · ±'+s.locAccuracy+'m GPS':'';
    const poorAcc=s.locAccuracy!=null&&s.locAccuracy>150;
    const slowMsg=s.locRetryCount>=2
      ?'Still locating — GPS signal is very weak. Move outside to an open area, then try again.'
      :'Taking longer than usual. Try stepping near a window or outside.';
    if(locVerified){
      const warnAcc=poorAcc?' (low accuracy — try again outdoors for a better reading)':'';
      gLocBorder=poorAcc?'#f0e2c2':'#cfe6d8';gLocCardBg=poorAcc?'#fdf6e9':'#f5faf7';gLocBadgeBg=poorAcc?'#f7efdc':'#e7f3ec';gLocBadgeColor=poorAcc?'#b9791a':'#1f8a5b';
      gLocMsg=s.locDistance+' m from '+hqName+', on-site'+accStr+warnAcc;gLocMsgColor=poorAcc?'#b9791a':'#1f8a5b';
    }
    else if(locOutOfRange){gLocBorder='#f1d3cf';gLocCardBg='#fbeeec';gLocBadgeBg='#f7e4e1';gLocBadgeColor='#c0392b';const veryPoorAcc=s.locAccuracy!=null&&s.locAccuracy>300;gLocMsg=veryPoorAcc?('GPS signal too weak to verify your location (±'+s.locAccuracy+'m).\n\nStep outside to an open area with clear sky and try again.'):s.locDistance+' m away — you must be at '+hqName+' to check in'+accStr+(poorAcc?'\n\nNote: GPS accuracy is low (±'+s.locAccuracy+'m). If you are on-site, move outside and try again.':'');gLocMsgColor='#c0392b';}
    else if(locGpsError){gLocBorder='#f0e2c2';gLocCardBg='#fdf6e9';gLocBadgeBg='#f7efdc';gLocBadgeColor='#b9791a';gLocMsg=s.locGpsMsg||'Location unavailable. Check permissions and try again.';gLocMsgColor='#b9791a';}
    else if(locLocating){gLocBorder='#eef0f4';gLocCardBg='#fff';gLocBadgeBg='#eceef2';gLocBadgeColor=accent;gLocMsg=s.locSlow?slowMsg:'Locating you via GPS...';gLocMsgColor='#8a94a3';}
    else{gLocBorder='#eef0f4';gLocCardBg='#fff';gLocBadgeBg='#eceef2';gLocBadgeColor='#8a94a3';gLocMsg='Tap "Locate me" to verify your location.';gLocMsgColor='#8a94a3';}

    const shift=me.shift||'AM';
    const now=s.testTime?(()=>{const d=new Date(s.now);const[h,m]=s.testTime.split(':').map(Number);d.setHours(h,m,0,0);return d;})():s.now;
    const testMode=!!s.testDate||s.demo;
    const phaseDefs=[
      {key:'p1',num:1,label:'Check in to work',needsGps:true,depends:null},
      {key:'p2',num:2,label:shift==='PM'?'Dinner break':'Lunch break',needsGps:true,depends:'p1'},
      {key:'p3',num:3,label:shift==='PM'?'Return from dinner':'Return from lunch',needsGps:true,depends:'p2'},
      {key:'p4',num:4,label:'Check out',needsGps:true,depends:'p3'},
    ];
    const phases=phaseDefs.map(pd=>{
      const time=rec[pd.key];
      const dist=pd.key==='p1'?rec.p1dist:pd.key==='p3'?rec.p3dist:null;
      const done=!!time;
      const locked=!!pd.depends&&!rec[pd.depends];
      const inWin=testMode||Utils.phaseInWindow(shift,pd.key,now);
      const pastWin=!testMode&&Utils.phaseWindowPast(shift,pd.key,now);
      const upcoming=!done&&!locked&&!inWin&&!pastWin;
      const lateActive=pd.key!=='p4'&&!done&&!locked&&pastWin;
      const isActive=!done&&!locked&&(inWin||pastWin);
      const myGpsActive=isActive&&pd.needsGps&&s.locPhase===pd.key;
      const doneText=done?(pd.needsGps?(dist!=null?'GPS verified · '+dist+' m from '+hqName:'GPS verified'):'Recorded'):'';
      const btnLabel=pd.key==='p1'?'Check in to work':pd.key==='p2'?(shift==='PM'?'Record dinner break':'Record lunch break'):pd.key==='p3'?(shift==='PM'?'Return from dinner':'Return from lunch'):'Check out';
      const win=Utils.phaseWindow(shift,pd.key);
      const locIsOutOfRange=myGpsActive&&locOutOfRange;
      const _waPhaseLabel=pd.key==='p1'?'Check in':pd.key==='p2'?(shift==='PM'?'Dinner break':'Lunch break'):pd.key==='p3'?(shift==='PM'?'Return from dinner':'Return from lunch'):'Check out';
      const _waGeoMsg=`Hi, I need help with my attendance.\n\nName: ${me.name}\nShift: ${Utils.shiftLabel(me.shift)}\nPhase: ${_waPhaseLabel}\nDate: ${Utils.dateKey(this.baseDate())}\n\nGPS shows me ${s.locDistance!=null?s.locDistance+'m ':''}out of range. Please assist with a manual record.`;
      const geofenceWaLink=`https://api.whatsapp.com/send?text=${encodeURIComponent(_waGeoMsg)}`;
      return {
        key:pd.key, num:pd.num, label:pd.label, isLast:pd.key==='p4', notLast:pd.key!=='p4',
        needsGps:pd.needsGps, notNeedsGps:!pd.needsGps,
        done, notDone:!done, time:time||'-', doneText,
        locked, upcoming, isActive, notActive:!isActive||done,
        lateActive, btnBg:lateActive?'#b9791a':accent,
        stepBg:done?'#1f8a5b':isActive?(lateActive?'#b9791a':accent):'#eceef2',
        stepColor:done||isActive?'#fff':'#8a94a3',
        connectorBg:done?'#1f8a5b':'#eceef2',
        rowPadBot:done?'8px':'16px',
        subLabel:win?win[0]+' – '+win[1]:'',
        btnLabel,
        onStart:this.startPhaseGps(pd.key),
        onSubmit:this.doPhase(pd.key),
        gpsStarted:myGpsActive,
        gpsNotStarted:isActive&&pd.needsGps&&!myGpsActive,
        locLocating:myGpsActive&&locLocating,
        locVerified:myGpsActive&&locVerified,
        locNeedsAction:myGpsActive&&(locIdle||locOutOfRange||locGpsError),
        locShowReload:myGpsActive&&locGpsError&&s.locPermErr,
        locBtnLabel:locLocating?'Locating...':(locIdle?'Locate me':'Try again'),
        locBtnDisabled:myGpsActive&&locLocating,
        locBorder:myGpsActive?gLocBorder:'#eef0f4',
        locCardBg:myGpsActive?gLocCardBg:'#fff',
        locBadgeBg:myGpsActive?gLocBadgeBg:'#eceef2',
        locBadgeColor:myGpsActive?gLocBadgeColor:'#8a94a3',
        locMsg:myGpsActive?gLocMsg:('Tap "Locate me" to verify you are at '+hqName+'.'),
        locMsgColor:myGpsActive?gLocMsgColor:'#8a94a3',
        checkInOpacity:(myGpsActive&&locVerified)?'1':'.45',
        checkInPE:(myGpsActive&&locVerified)?'auto':'none',
        locIsOutOfRange, geofenceWaLink,
        showGpsBypass: myGpsActive && locGpsError && (s.locRetryCount||0) >= 2 && (pd.key==='p1'||pd.key==='p3'),
        onBypass: this.doPhaseBypass(pd.key),
        showBrowserTip: myGpsActive && locGpsError,
      };
    });
    const allDone=phases.every(ph=>ph.done);
    const shiftStart={AM:'08:30',PM:'15:30',OFFICE:'09:00'}[shift]||'08:30';
    const [_sc,_sm]=shiftStart.split(':').map(Number);
    const _lateMs=rec.p1?(()=>{const[h,m]=rec.p1.split(':').map(Number);return(h*60+m)-(_sc*60+_sm);})():0;
    const isLate=_lateMs>=60;
    const _waTimes=[];
    if(rec.p1) _waTimes.push('IN '+rec.p1);
    if(rec.p2) _waTimes.push('LUNCH '+rec.p2);
    if(rec.p3) _waTimes.push('BACK '+rec.p3);
    if(rec.p4) _waTimes.push('OUT '+rec.p4);
    const waMsg=status==='present'
      ?`✅ ${me.name} — ${Utils.shiftLabel(me.shift)}\n${_waTimes.join(' · ')}`
      :status==='mc'
      ?`🤒 ${me.name} is on MC today (${Utils.shiftLabel(me.shift)}).`
      :'';
    const whatsappLink=waMsg?'https://api.whatsapp.com/send?text='+encodeURIComponent(waMsg):'';
    const showWaShare=!!(status==='present'||status==='mc');
    const activeBatch=s.batches[s.activeBatchIdx||0];
    const batchLabel=activeBatch?.label||'';
    const dekit=activeBatch?.dekit_date?new Date(activeBatch.dekit_date+'T00:00:00'):null;
    const todayMid=new Date();todayMid.setHours(0,0,0,0);
    const dekitDaysLeft=dekit?Math.round((dekit-todayMid)/86400000):null;
    const dekitCountdown=dekitDaysLeft===null?'':dekitDaysLeft===0?'Return equipment today':dekitDaysLeft>0?`${dekitDaysLeft} day${dekitDaysLeft!==1?'s':''} to dekit`:'Cycle complete';
    const batchRange=activeBatch?(Utils.fmtShort(new Date(activeBatch.start_date+'T00:00:00'))+' to '+Utils.fmtShort(new Date(activeBatch.end_date+'T00:00:00'))):'';
    return {
      todayLong:Utils.fmtLong(this.baseDate()),
      clock:s.testDate?'--:--':s.testTime?s.testTime:Utils.hhmm(s.now),
      myShiftLabel:Utils.shiftLabel(me.shift), myShiftWindow:Utils.shiftWindow(me.shift),
      myStatusLabel:outOfCycle?outOfCycleTitle:noRep?'No reporting':m.label,
      myStatusColor:outOfCycle?'#8a94a3':noRep?accent:m.color,
      myStatusBg:outOfCycle?'#eceef2':noRep?'#eef3fc':m.bg,
      myStatusPulse:(!outOfCycle&&status==='pending'&&!noRep)?'animation:pulseDot 1.6s ease infinite;':'',
      phToday:!outOfCycle&&noRep,
      phName:Utils.holidayName(todayD)||(isOffDay?'Reservists do not report on weekends.':'No CNB reporting today.'),
      isMc:!outOfCycle&&status==='mc'&&!noRep,
      isAbsent:!outOfCycle&&status==='absent'&&!noRep,
      // Only block today's check-in if the pending request is for today and not yet checked in
      hasPendingRequest:!outOfCycle&&!noRep&&status!=='mc'&&status!=='absent'&&!!(s.myPendingRequest&&s.myPendingRequest.date===todayKey&&status!=='present'),
      pendingRequestLabel:s.myPendingRequest?.type==='mc'?'MC':s.myPendingRequest?.type==='shift_change'?'shift change':'absence',
      pendingRequestDate:s.myPendingRequest?.date?Utils.fmtMed(new Date(s.myPendingRequest.date+'T00:00:00')):'',
      showPhases:!outOfCycle&&!noRep&&status!=='mc'&&status!=='absent'&&!(s.myPendingRequest&&s.myPendingRequest.date===todayKey&&status!=='present'),
      outOfCycle, outOfCycleTitle, outOfCycleSub,
      phases, allDone,
      isLate, lateShiftStart:shiftStart,
      showLateWarning:s.showLateWarning, dismissLateWarning:this.dismissLateWarning,
      lateReasonOpen:s.lateReasonOpen, lateReasonText:s.lateReasonText,
      onLateReasonText:this.onLateReasonText, submitLateReason:this.submitLateReason,
      skipLateReason:this.skipLateReason, lateReasonSubmitting:s.lateReasonSubmitting,
      batchLabel, dekitCountdown, batchRange, showBatchInfo:!!activeBatch,
      whatsappLink, showWaShare,
      isOffline:!s.isOnline, offlinePending:s.offlinePending, offlineQueueCount:this._offlineQueues?.length||0,
      retrySync:this.retrySync, refreshPage:this.refreshPage,
      isInAppBrowser:s.isInAppBrowser, inAppBrowserName:s.inAppBrowserName,
      hasTestDate:!!s.testDate, testDate:s.testDate||'',
      testDateInput:s.testDateInput, onTestDateInput:this.onTestDateInput,
      setTestDate:this.setTestDate, clearTestDate:this.clearTestDate,
      hasTestTime:!!s.testTime, testTime:s.testTime||'',
      testTimeInput:s.testTimeInput, onTestTimeInput:this.onTestTimeInput,
      setTestTime:this.setTestTime, clearTestTime:this.clearTestTime,
      openLeaveRequest:this.openLeaveRequest(Utils.dateKey(this.baseDate())),
      leaveOpen:s.leaveOpen, leaveDate:s.leaveDate, leaveType:s.leaveType, leaveReason:s.leaveReason,
      onLeaveDate:this.onLeaveDate,
      leaveIsPersonal:s.leaveType==='personal', leaveIsMc:s.leaveType==='mc', leaveIsOther:s.leaveType==='other',
      onLeaveTypePersonal:this.onLeaveType('personal'), onLeaveTypeMc:this.onLeaveType('mc'), onLeaveTypeOther:this.onLeaveType('other'),
      onLeaveReason:this.onLeaveReason, submitLeaveRequest:this.submitLeaveRequest, closeLeaveRequest:this.closeLeaveRequest,
      openShiftChange:this.openShiftChange, shiftChangeOpen:s.shiftChangeOpen,
      shiftChangeNew:s.shiftChangeNew, shiftChangeReason:s.shiftChangeReason,
      onShiftChangeAm:this.onShiftChangeNew('AM'), onShiftChangePm:this.onShiftChangeNew('PM'), onShiftChangeOffice:this.onShiftChangeNew('OFFICE'),
      shiftChangeIsAm:s.shiftChangeNew==='AM', shiftChangeIsPm:s.shiftChangeNew==='PM', shiftChangeIsOffice:s.shiftChangeNew==='OFFICE',
      onShiftChangeReason:this.onShiftChangeReason, submitShiftChange:this.submitShiftChange, closeShiftChange:this.closeShiftChange,
      notifGranted:s.notifGranted, requestReminders:this.requestReminders,
      welfareNote:rec.welfareNote||'', hasWelfareNote:!!(rec.welfareNote),
      canAddWelfareNote:!outOfCycle&&!noRep&&Utils.isReportDay(todayD),
      openWelfareNote:this.openWelfareNote, closeWelfareNote:this.closeWelfareNote,
      welfareNoteOpen:s.welfareNoteOpen, welfareNoteText:s.welfareNoteText, welfareNoteSaving:s.welfareNoteSaving,
      onWelfareNoteText:this.onWelfareNoteText, submitWelfareNote:this.submitWelfareNote,
    };
  }

  _buildCalendar(s, accent){
    const activeBatch=s.batches[s.activeBatchIdx||0];
    if(!activeBatch) return {weekdays:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],calCells:[],cycleStart:'',cycleEnd:'',calSelected:false,calNoneSelected:true,calSelLabel:'',calSelStatus:'',calSelSub:'',calSelColor:'',calSelBg:'',dekitMonth:'',dekitDay:'',dekitLabel:'',dekitSub:'',dekitDateFull:''};
    const bs=new Date(activeBatch.start_date+'T00:00:00');
    const be=new Date(activeBatch.end_date+'T00:00:00');
    const dd=activeBatch.dekit_date?new Date(activeBatch.dekit_date+'T00:00:00'):Utils.addDays(be,3);
    const gridStart=Utils.mondayOf(bs);
    const today=this.baseDate();
    const todayKey=Utils.dateKey(today), bsKey=Utils.dateKey(bs), beKey=Utils.dateKey(be), ddKey=Utils.dateKey(dd);
    const cellBase='aspect-ratio:1;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;';
    const cellStyle=st=>{
      if(st==='today') return cellBase+'background:'+accent+';color:#fff;';
      if(st==='ph')    return cellBase+'background:#f7efdc;color:#b9791a;';
      if(st==='nr')    return cellBase+'background:#f0f2f7;color:#8a94a3;border:1px dashed #c4c9d4;';
      if(st==='work')  return cellBase+'background:#fff;border:1px solid #e3e6ec;color:#161f30;';
      if(st==='end')   return cellBase+'background:#fff;border:1.5px solid '+accent+';color:'+accent+';';
      if(st==='dekit') return cellBase+'background:#131a27;color:#fff;';
      if(st==='post')  return cellBase+'background:#f0f2f7;color:#8a94a3;';
      if(st==='wknd')  return cellBase+'background:#f6f8fa;color:#c2c8d2;';
      if(st==='past')  return cellBase+'background:#f6f8fa;color:#b0b8c4;border:1px solid #eef0f4;';
      return cellBase+'background:transparent;color:#c2c8d2;';
    };
    const calCells=Array.from({length:21},(_,i)=>{
      const d=Utils.addDays(gridStart,i), dk=Utils.dateKey(d);
      const off=Math.round((d-today)/86400000);
      const isHol=!!Utils.holidayName(d), isNoRep=s.noReportDays.has(dk), isWknd=!Utils.isReportDay(d);
      let dst;
      if(dk<bsKey) dst='pre';
      else if(dk>ddKey) dst='off';
      else if(dk===ddKey) dst='dekit';
      else if(dk>beKey) dst='post';
      else if(dk===beKey) dst=dk===todayKey?'today':'end';
      else if(dk===todayKey) dst='today';
      else if(isWknd) dst='wknd';
      else if(isHol) dst='ph';
      else if(isNoRep) dst='nr';
      else if(dk<todayKey) dst='past';
      else dst='work';
      let style=cellStyle(dst)+'cursor:pointer;';
      if(dst==='past'){
        const hr=s.history.find(r=>r.date===dk)
          ||(dk===s.attendanceDate&&s.attendance[s.currentUserId]?.status&&s.attendance[s.currentUserId].status!=='pending'
             ?{status:s.attendance[s.currentUserId].status}:null);
        const pst=hr?.status;
        if(pst==='present') style=cellBase+'background:#e7f3ec;color:#1f8a5b;border:2px solid #a8d5bb;cursor:pointer;';
        else if(pst==='mc') style=cellBase+'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;cursor:pointer;';
        else style=cellBase+'background:#f7e4e1;color:#c0392b;border:2px solid #e5a9a4;cursor:pointer;';
      }
      if(s.selectedCalOffset===off) style+='outline:2px solid '+accent+';outline-offset:1px;';
      return {num:d.getDate(),style,off,st:dst,onClick:this.selectCalDay(off)};
    });
    const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dekitLabel='Dekit, '+WD[dd.getDay()]+' '+dd.getDate()+' '+MON[dd.getMonth()];
    const dekitSub='Last report: '+WD[be.getDay()]+' '+be.getDate()+' '+MON[be.getMonth()];
    const dekitDateFull=WD[dd.getDay()]+' '+dd.getDate()+' '+MON[dd.getMonth()];
    const selOff=s.selectedCalOffset, calSelected=selOff!=null;
    let calSelLabel='',calSelStatus='',calSelSub='',calSelColor='',calSelBg='';
    if(calSelected){
      const sd=this.dateForOffset(selOff);
      const selCell=calCells.find(c=>c.off===selOff);
      const info=this._calDayDetail(selOff,selCell?selCell.st:'off');
      calSelLabel=Utils.fmtMed(sd)+(selOff===0?', today':'');
      calSelStatus=info.label; calSelSub=info.sub; calSelColor=info.color; calSelBg=info.bg;
    }
    return {
      weekdays:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], calCells,
      cycleStart:Utils.fmtShort(bs), cycleEnd:Utils.fmtShort(be),
      calSelected, calNoneSelected:!calSelected,
      calSelLabel, calSelStatus, calSelSub, calSelColor, calSelBg,
      dekitMonth:MON[dd.getMonth()].toUpperCase(), dekitDay:dd.getDate(),
      dekitLabel, dekitSub, dekitDateFull,
    };
  }

  _buildAttendance(s){
    const me=this.cur(); if(!me) return {myHistory:[],statMyPresent:0,statMyMc:0,statMyMissed:0,statMyDays:0,cycleDone:0,cycleTotal:0,cyclePct:0};
    const rec=this.myRec(), status=rec.status||'pending';
    const todayD=this.baseDate(), today=Utils.dateKey(todayD);
    const activeBatch=s.batches[s.activeBatchIdx||0];

    const _tc=(v,c1,c0)=>v?c1:c0;
    const _dc='#c2c8d2';

    // Today row
    const todayRow=(status!=='pending'&&Utils.isReportDay(todayD)&&!this.isNoReport(0))
      ?[{date:Utils.fmtMed(todayD)+', Today',dateKey:today,shift:Utils.shiftLabel(me.shift),status,
         p1:rec.p1||'-',p2:rec.p2||'-',p3:rec.p3||'-',p4:rec.p4||'-',
         p1Color:_tc(rec.p1,'#161f30',_dc),p2Color:_tc(rec.p2,'#161f30',_dc),p3Color:_tc(rec.p3,'#161f30',_dc),p4Color:_tc(rec.p4,'#161f30',_dc),
         showTimes:status==='present',...Utils.meta(status)}]:[];

    // Past recorded rows
    const histKeys=new Set(s.history.map(r=>r.date));
    const histRows=s.history.map(r=>{
      const d=new Date(r.date+'T00:00:00');
      const tk=s=>s?s.slice(0,5):null;
      const p1=tk(r.check_in_time),p2=tk(r.lunch_out_time),p3=tk(r.work_return_time),p4=tk(r.work_end_time);
      return {date:Utils.fmtMed(d),dateKey:r.date,shift:Utils.shiftLabel(me.shift),status:r.status,
        p1:p1||'-',p2:p2||'-',p3:p3||'-',p4:p4||'-',
        p1Color:_tc(p1,'#161f30',_dc),p2Color:_tc(p2,'#161f30',_dc),p3Color:_tc(p3,'#161f30',_dc),p4Color:_tc(p4,'#161f30',_dc),
        showTimes:r.status==='present',...Utils.meta(r.status)};
    });

    // Missed shifts: reporting days in current batch before today with no record
    const missedRows=[];
    if(activeBatch){
      const bStart=new Date(activeBatch.start_date+'T00:00:00'), yesterday=Utils.addDays(todayD,-1);
      for(let d=new Date(bStart);d<=yesterday;d=Utils.addDays(d,1)){
        const dk=Utils.dateKey(d);
        if(Utils.isReportDay(d)&&dk<=activeBatch.end_date&&!Utils.holidayName(d)&&!s.noReportDays.has(dk)&&!histKeys.has(dk)){
          missedRows.push({date:Utils.fmtMed(d),dateKey:dk,shift:Utils.shiftLabel(me.shift),status:'missed',
            p1:'-',p2:'-',p3:'-',p4:'-',p1Color:_dc,p2Color:_dc,p3Color:_dc,p4Color:_dc,showTimes:false,...Utils.meta('missed')});
        }
      }
    }

    // Merge past rows oldest-first (chronological)
    const allPast=[...histRows,...missedRows].sort((a,b)=>a.dateKey>b.dateKey?-1:1);
    const myHistory=[...todayRow,...allPast];
    const statMyPresent=myHistory.filter(h=>h.status==='present').length;
    const statMyMc=myHistory.filter(h=>h.status==='mc').length;
    const statMyMissed=missedRows.length;

    let cycleTotal=0, cycleDone=0;
    if(activeBatch){
      const bStart=new Date(activeBatch.start_date+'T00:00:00'),bEnd=new Date(activeBatch.end_date+'T00:00:00'),now=this.baseDate();
      for(let d=new Date(bStart);d<=bEnd;d=Utils.addDays(d,1)){
        if(Utils.isReportDay(d)&&!Utils.holidayName(d)&&!s.noReportDays.has(Utils.dateKey(d))){cycleTotal++;if(d<=now)cycleDone++;}
      }
    }
    // Performance summary
    const totalRecorded=statMyPresent+statMyMc+statMyMissed;
    const attendanceRate=cycleDone>0?Math.round((statMyPresent+statMyMc)/cycleDone*100):null;
    const attendanceRateText=attendanceRate!==null?attendanceRate+'%':'—';
    let attendanceStreak=0;
    for(const row of myHistory){ if(row.status==='present'||row.status==='mc') attendanceStreak++; else break; }
    const showAttendanceSummary=totalRecorded>0||cycleDone>0;

    const PAGE=10, page=s.historyPage||1;
    const pagedHistory=myHistory.slice(0,page*PAGE);
    const historyHasMore=myHistory.length>page*PAGE;
    const historyRemaining=myHistory.length-pagedHistory.length;
    return {myHistory:pagedHistory,historyHasMore,historyRemaining,showMoreHistory:this.showMoreHistory,statMyPresent,statMyMc,statMyMissed,statMyDays:statMyPresent+statMyMc,cycleDone,cycleTotal,cyclePct:cycleTotal?Math.round(cycleDone/cycleTotal*100):0,historyTruncated:s.history.length>=500,historyEmpty:pagedHistory.length===0,totalRecorded,attendanceRate,attendanceRateText,attendanceStreak,showAttendanceSummary};
  }

  _buildBriefings(s, accent){
    const activeBatch=s.batches[s.activeBatchIdx||0];
    const mealActive=!!(activeBatch?.meal_active);
    const ROLES={
      AM:{title:'AM Shift',window:'0830 to 1530, Lunch 1200-1430',items:['MOPs for CNB testing must exit via the same route they entered.','MOPs must not loiter around the area.','Escort contractors around the building when required.','Assist with Red Teaming exercises if needed.']},
      PM:{title:'PM Shift',window:'1530 to 2230, Dinner 1630-1830',items:['Same duties as AM shift.','May leave early if CNB confirms no more reporting.'],note:'Fridays: stay till 1800 only. May move to canteen after 1630. Update WhatsApp when leaving DHQ or if on MC.'},
      OFFICE:{title:'Office Hours',window:'0900 to 1800, Lunch 1200-1400',items:['Escort contractors when required.','Assist with Red Teaming exercises if needed.']},
    };
    const me=this.cur(), myShift=me?.shift||'AM';
    const tab=s.rolesTab||myShift, active=ROLES[tab], mine=ROLES[myShift];
    const roleTabs=[['AM','AM'],['PM','PM'],['OFFICE','Office']].map(([key,label])=>({
      key,label,isMyShift:key===myShift,onClick:this.setRolesTab(key),
      style:`flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;${tab===key?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':key===myShift?`background:rgba(47,95,208,.07);color:${accent};`:'background:transparent;color:#8a94a3;'}`,
    }));
    const waGroupUrl=this.props.waGroupLink||'';
    return {
      roleTabs, roleTitle:active.title, roleWindow:active.window, roleItems:active.items, roleNote:active.note||'',
      myShiftTitle:mine.title, myShiftWindow:mine.window, myShiftItems:mine.items, myShiftNote:mine.note||'',
      briefLocation:(this.props.hqName||'Bedok DHQ')+' Canteen',
      briefAttire:'Civilian: pants and covered shoes',
      mealActive,
      mealStatusBanner:mealActive?'Active: submit your form daily (Mon-Fri).':'On hold: do not submit the form for now.',
      mealStatusStyle:mealActive?'background:#e7f3ec;border:1px solid #a8d5bb;border-radius:8px;padding:7px 10px;font-size:12px;color:#1f8a5b;font-weight:600;margin-bottom:8px;':'background:#fdf6e9;border:1px solid #f0e2c2;border-radius:8px;padding:7px 10px;font-size:12px;color:#8a6d2a;font-weight:600;margin-bottom:8px;',
      mealFormLink:'https://go.gov.sg/gdiv-pnsmen-meal-allowance',
      mealItems:mealActive?[
        'Mark PRESENT if you completed your shift, MC if on sick leave.',
        'Upload a copy of your MC when declaring sick leave.',
        "Supervisor's email is sent daily via the WhatsApp group.",
        'No submission needed on public holidays or no‑reporting days.',
      ]:[
        'When active: submit daily Mon-Fri, including MC days.',
        'Mark PRESENT if shift completed, MC if on sick leave.',
        'No submission needed on public holidays or no‑reporting days.',
      ],
      dekitItems:[
        'Fill meal allowance forms and submit to the Manpower Officer, endorsed by Ops Branch supervisor.',
        'Bring hardcopies of any MCs taken.',
        'Update WhatsApp once all PNSMEN have arrived.',
      ],
      waGroupUrl, showWaGroup:!!waGroupUrl,
      teamMembers: me?.batch_id ? s.personnel
        .filter(p=>p.batch_id===me.batch_id&&p.id!==s.currentUserId&&(p.role||'reservist')==='reservist')
        .map(p=>({
          id:p.id, name:p.name, initials:Utils.initials(p.name),
          shiftLabel:Utils.shiftLabel(p.shift),
          contact:p.contact||'',
          waLink:p.contact?`https://api.whatsapp.com/send?phone=65${p.contact.replace(/[\s-]/g,'')}`:''
        })) : [],
      showTeam: !!(me?.batch_id && s.personnel.some(p=>p.batch_id===me.batch_id&&p.id!==s.currentUserId)),
      leaveHistoryItems: s.myLeaveHistory.map(r=>({
        id:r.id,
        typeLabel:r.type==='mc'?'MC':r.type==='shift_change'?'Shift Change':r.type==='other'?'Other':'Personal Leave',
        dateLabel:r.date?Utils.fmtMed(new Date(r.date+'T00:00:00')):'',
        statusLabel:r.status==='approved'?'Approved':r.status==='rejected'?'Declined':'Pending',
        statusColor:r.status==='approved'?'#1f8a5b':r.status==='rejected'?'#c0392b':'#b9791a',
        statusBg:r.status==='approved'?'#e7f3ec':r.status==='rejected'?'#f7e4e1':'#fdf6e9',
        reason:r.reason||'',
      })),
      showLeaveHistory:s.myLeaveHistory.length>0, myLeaveHistoryLoaded:s.myLeaveHistoryLoaded,
    };
  }

  _buildAdmin(s, accent){
    const batches=s.batches, activeBatchIdx=s.activeBatchIdx||0, activeBatch=batches[activeBatchIdx];
    const activeMembers=activeBatch?.is_live?s.personnel:(s.batchMembersCache?.[activeBatch?.id]||[]);
    const {am:npAmCount,pm:npPmCount}=this._shiftSlotCounts(s.personnel);
    const npAmFull=npAmCount>=2, npPmFull=npPmCount>=2;
    let npShift=s.npShift;
    if((npShift==='AM'&&npAmFull)||(npShift==='PM'&&npPmFull)) npShift='OFFICE';
    const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const todayForChips=Utils.dateKey(this.baseDate());
    const allChips=batches.map((b,i)=>{
      const bs=new Date(b.start_date+'T00:00:00'), be=new Date(b.end_date+'T00:00:00');
      const isFuture=b.start_date>todayForChips;
      const isPast=b.end_date<todayForChips&&!b.is_live;
      const isActive=i===activeBatchIdx;
      let chipStyle='flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-start;padding:7px 13px;border-radius:9px;cursor:pointer;white-space:nowrap;text-align:left;';
      if(isActive) chipStyle+='background:'+accent+';color:#fff;border:1px solid '+accent+';';
      else if(isFuture) chipStyle+='background:#f6f8fa;color:#8a94a3;border:1.5px dashed #c2c8d2;';
      else if(isPast) chipStyle+='background:#f6f8fa;color:#8a94a3;border:1px solid #e3e6ec;';
      else chipStyle+='background:#fff;color:#5c6678;border:1px solid #d4d9e2;';
      return {label:b.label, range:Utils.fmtShort(bs)+' to '+Utils.fmtShort(be), onClick:this.setBatch(i), style:chipStyle, isPast, isActive, isFuture};
    });
    const activeChips=allChips.filter(c=>!c.isPast);
    const archivedChips=allChips.filter(c=>c.isPast);
    // Cycle picker — all batches grouped by year, newest year first
    const _pickerYearMap={};
    allChips.forEach((c,i)=>{
      const yr=batches[i]?.start_date?.slice(0,4)||'';
      if(!_pickerYearMap[yr]) _pickerYearMap[yr]=[];
      _pickerYearMap[yr].push({...c, onPick:()=>{ this.closeCyclePicker(); c.onClick(); }});
    });
    const cyclePickerGroups=Object.keys(_pickerYearMap).sort((a,b)=>b-a).map(yr=>({year:yr,cycles:[..._pickerYearMap[yr]].reverse()}));
    const activeCycleLabel=activeBatch?.label||'No cycle';
    const _abs=activeBatch?new Date(activeBatch.start_date+'T00:00:00'):null;
    const _abe=activeBatch?new Date(activeBatch.end_date+'T00:00:00'):null;
    const activeCycleRange=_abs&&_abe?Utils.fmtShort(_abs)+' – '+Utils.fmtShort(_abe):'';
    const viewOffset=s.viewOffset||0, viewDate=this.dateForOffset(viewOffset), viewIsToday=viewOffset===0, viewReportDay=Utils.isReportDay(viewDate);
    const viewDateKey=Utils.dateKey(viewDate);
    const viewMap=viewIsToday?s.attendance:(s.attendanceCache?.[viewDateKey]||{});
    const roster=activeMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent',time:'-'}, mm=Utils.meta(r.status);
      const cardStyle='background:#fff;border:1px solid #e3e6ec;border-left:3px solid '+mm.color+';border-radius:12px;padding:11px 13px;';
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      const _phaseParts=[r.p1?'IN '+r.p1:null,r.p2?((p.shift==='PM'?'DIN ':'LCH ')+r.p2):null,r.p3?'BACK '+r.p3:null,r.p4?'OUT '+r.p4:null].filter(Boolean);
      const phaseLine=_phaseParts.join('  ·  ');
      const showPhaseLine=r.status==='present'&&_phaseParts.length>0;
      return {id:p.id,name:p.name,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),shift:p.shift,status:r.status,time:r.p1||'-',label:mm.label,color:mm.color,bg:mm.bg,geo:(r.status==='present'&&r.p1dist!=null)?(', GPS verified '+r.p1dist+' m'):'',markPresent:this.setStatus(p.id,'present'),markMc:this.setStatus(p.id,'mc'),markAbsent:this.setStatus(p.id,'absent'),onShiftChange:this.changeShift(p.id),cardStyle,avatarStyle,phaseLine,showPhaseLine,welfareNote:r.welfareNote||'',showWelfareNote:!!(r.welfareNote)};
    });
    const search=(s.rosterSearch||'').toLowerCase();
    const filteredRoster=roster.filter(r=>!search||r.name.toLowerCase().includes(search));
    const sortKey=s.rosterSort||'shift';
    const sortedFiltered=[...filteredRoster].sort((a,b)=>{
      if(sortKey==='name') return a.name.localeCompare(b.name);
      if(sortKey==='status'){const ord={present:0,mc:1,pending:2,absent:3};return (ord[a.status]??4)-(ord[b.status]??4);}
      const so={AM:0,PM:1,OFFICE:2};return (so[a.shift]??3)-(so[b.shift]??3);
    });
    const _sb='flex:1;padding:6px 4px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid ';
    const _sa=_sb+accent+';background:'+accent+';color:#fff;', _si=_sb+'#d4d9e2;background:#fff;color:#5c6678;';
    const rosterSortShiftStyle=sortKey==='shift'?_sa:_si;
    const rosterSortNameStyle=sortKey==='name'?_sa:_si;
    const rosterSortStatusStyle=sortKey==='status'?_sa:_si;
    const present=roster.filter(r=>r.label==='Present').length, mc=roster.filter(r=>r.label==='On MC').length, pending=roster.filter(r=>r.label==='Pending').length, absent=roster.filter(r=>r.label==='Absent').length, total=roster.length;
    const snapshotLastLine=viewIsToday?('⏳ Pending ('+pending+'): '+(roster.filter(r=>r.label==='Pending').map(r=>r.name).join(', ')||'(none)')):('❌ Absent ('+absent+'): '+(roster.filter(r=>r.label==='Absent').map(r=>r.name).join(', ')||'(none)'));
    const _orgN=this.props.orgName||'Ops Security';
    const snapshotLines=['📋 *'+_orgN+' — '+Utils.fmtMed(viewDate)+'*','✅ Present ('+present+'): '+(roster.filter(r=>r.label==='Present').map(r=>r.name).join(', ')||'(none)'),'🤒 MC ('+mc+'): '+(roster.filter(r=>r.label==='On MC').map(r=>r.name).join(', ')||'(none)'),snapshotLastLine];
    const snapshotLink='https://api.whatsapp.com/send?text='+encodeURIComponent(snapshotLines.join('\n'));
    const pendingCount=roster.filter(r=>r.label==='Pending').length;
    const shiftCutoff=Utils.LATE_CUTOFF;
    const logRows=activeMembers.filter(p=>{
      const r=viewMap[p.id]||{status:'pending'};
      return r.status!=='pending';
    }).map(p=>{
      const r=viewMap[p.id]||{status:'pending'}, mm=Utils.meta(r.status);
      const cutoff=shiftCutoff[p.shift||'AM'];
      const [_cc,_ccm]=cutoff.split(':').map(Number);
      const _lm=r.p1?(()=>{const[h,m]=r.p1.split(':').map(Number);return(h*60+m)-(_cc*60+_ccm);})():0;
      const isLate=r.status==='present'&&_lm>=60;
      const lateReason=r.lateReason||'';
      const showLateReason=isLate&&!!lateReason;
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      return {
        id:p.id, name:p.name, initials:Utils.initials(p.name), shiftLabel:Utils.shiftLabel(p.shift),
        label:mm.label, color:mm.color, bg:mm.bg, isLate,
        lateReason, showLateReason,
        welfareNote:r.welfareNote||'', showWelfareNote:!!(r.welfareNote),
        showNoGps: !!(r.gpsBypassed),
        p1:r.p1||'–', p2:r.p2||'–', p3:r.p3||'–', p4:r.p4||'–',
        p1Color:r.p1?(isLate?'#c0392b':'#161f30'):'#c2c8d2',
        p2Color:r.p2?'#161f30':'#c2c8d2',
        p3Color:r.p3?'#161f30':'#c2c8d2',
        p4Color:r.p4?'#161f30':'#c2c8d2',
        avatarStyle,
      };
    });
    const lateRows=viewIsToday?logRows.filter(r=>r.isLate):[];
    const lateCount=lateRows.length;
    const lateNames=lateRows.map(r=>r.name).join(', ');
    const showLateAlert=viewIsToday&&lateCount>0;
    const lateAlertLabel=lateCount===1?'1 late check-in':lateCount+' late check-ins';
    const logDateLabel=viewIsToday?'TODAY\'S LOG':((WD[viewDate.getDay()]+' '+viewDate.getDate()+' '+MON[viewDate.getMonth()]).toUpperCase()+' LOG');
    const dlabel=WD[viewDate.getDay()]+' '+viewDate.getDate()+' '+MON[viewDate.getMonth()];
    const rel=viewOffset===0?'Today':viewOffset===-1?'Yesterday':viewOffset===1?'Tomorrow':'';
    const viewDateLabel=(rel?rel+', ':'')+dlabel;
    const viewHoliday=Utils.holidayName(viewDate), viewBlocked=this.isNoReport(viewOffset);
    const isDekit=viewDateKey===activeBatch?.dekit_date;
    const viewShowReporting=viewReportDay&&!viewBlocked&&!isDekit, viewNoReporting=!viewShowReporting;
    const viewDateSub=!viewReportDay?'Weekend, no reporting':viewHoliday?'Public holiday':isDekit?'Dekit day':viewBlocked?'No reporting, toggled off':viewOffset<0?'Past shift, recorded':viewOffset>0?'Scheduled':'Live now';
    const viewNoRepReason=!viewReportDay?'This is a weekend. Reservists do not report on Saturdays or Sundays.':viewHoliday?(viewHoliday+' is a public holiday, so reservists are not required to report.'):isDekit?'Dekit day: reservists return equipment and submit forms. No regular reporting.':'This day is marked as a no-reporting day, so reservists are not required to report.';
    const showRepToggle=viewReportDay&&!isDekit, repToggleLocked=!!viewHoliday, repToggleOn=viewBlocked;
    const noRepMsg=viewHoliday?('Public holiday ('+viewHoliday+'). Auto no-reporting, locked.'):repToggleOn?'On. Reservists are not required to report this day.':'Off. Reservists report and check in as normal.';
    const viewRoster=activeMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent',time:'-'}, mm=Utils.meta(r.status);
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      return {id:p.id,name:p.name,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),label:mm.label,color:mm.color,bg:mm.bg,timeText:(r.status==='present'&&r.p1)?r.p1:'',avatarStyle,welfareNote:r.welfareNote||'',showWelfareNote:!!(r.welfareNote)};
    });
    const vPresent=viewRoster.filter(r=>r.label==='Present').length, vMc=viewRoster.filter(r=>r.label==='On MC').length, vAbsent=viewRoster.filter(r=>r.label==='Absent').length, vPending=viewRoster.filter(r=>r.label==='Pending').length, vTotal=viewRoster.length;
    const vPercent=vTotal?Math.round((vPresent+vMc)/vTotal*100):0;
    const viewListHeader=viewOffset<0?'ATTENDANCE RECORD':viewOffset>0?'SCHEDULED ROSTER':'LIVE STATUS';
    const viewPercentText=viewOffset>0?(vTotal+' rostered'):(vPercent+'% reported');
    const viewPercentColor=viewOffset>0?'#8a94a3':'#1f8a5b';
    const vThirdLabel=viewOffset<0?'Absent':'Pending', vThirdVal=viewOffset<0?vAbsent:vPending, vThirdColor=viewOffset<0?'#c0392b':'#5c6678';
    const liveBatch=batches.find(b=>b.is_live)||activeBatch;
    const lbs=liveBatch?new Date(liveBatch.start_date+'T00:00:00'):null, lbe=liveBatch?new Date(liveBatch.end_date+'T00:00:00'):null;
    const intakeLabel=liveBatch?liveBatch.label:'';
    const intakeRange=lbs&&lbe?(Utils.fmtShort(lbs)+' to '+Utils.fmtShort(lbe)):'';
    const carryOverCandidates=liveBatch?s.personnel.filter(p=>(p.role||'reservist')==='reservist'&&p.batch_id&&p.batch_id!==liveBatch.id):[];
    const showCarryOver=liveBatch&&carryOverCandidates.length>0;
    const carryOverCount=carryOverCandidates.length;
    const _psVals = Object.values(s.peopleStats);
    const batchTotalPresent = _psVals.reduce((n,v)=>n+(v.present||0),0);
    const batchTotalMc = _psVals.reduce((n,v)=>n+(v.mc||0),0);
    const batchTotalAbsent = _psVals.reduce((n,v)=>n+(v.absent||0),0);
    const batchTotalDays = batchTotalPresent+batchTotalMc+batchTotalAbsent;
    const batchAvgPct = batchTotalDays>0?Math.round(batchTotalPresent/batchTotalDays*100):null;
    return {
      activeChips, archivedChips, archivedCount:archivedChips.length,
      cyclePickerGroups, cyclePickerOpen:s.cyclePickerOpen,
      openCyclePicker:this.openCyclePicker, closeCyclePicker:this.closeCyclePicker,
      activeCycleLabel, activeCycleRange,
      showArchivedBatches:s.showArchivedBatches,
      toggleArchivedBatches:()=>this.setState(s=>({showArchivedBatches:!s.showArchivedBatches})),
      roster, filteredRoster:sortedFiltered, logRows, logDateLabel,
      rosterSearch:s.rosterSearch, onRosterSearch:this.onRosterSearch, hasRosterSearch:!!search, clearRosterSearch:this.clearRosterSearch,
      retrySync:this.retrySync,
      markAllPresent:this.markAllPresent, pendingCount, markAllPresenting:s.markAllPresenting,
      noSearchResults:!!search&&sortedFiltered.length===0,
      filteredCount:search?sortedFiltered.length:0, showFilteredCount:!!search&&sortedFiltered.length>0,
      statPresent:present, statMc:mc, statPending:pending, statTotal:total,
      lateCount, lateNames, showLateAlert, lateAlertLabel,
      noRepMsg, toggleNoReporting:this.toggleNoReporting,
      showRepToggle, repToggleLocked,
      noRepTrackBg:repToggleOn?accent:'#39435a',
      noRepKnobX:repToggleOn?'25px':'3px',
      repToggleOpacity:repToggleLocked?'0.55':'1',
      repTogglePE:repToggleLocked?'none':'auto',
      prevDay:this.prevDay, nextDay:this.nextDay, goToday:this.goToday,
      onDaySwipeStart:this.onDaySwipeStart, onDaySwipeEnd:this.onDaySwipeEnd,
      snapshotLink, showSnapshot:viewShowReporting,
      editingNoteText:s.editingNoteText, onNoteText:this.onNoteText, saveNote:this.saveNote, closeNote:this.closeNote,
      refreshPage:this.refreshPage,
      viewDateLabel, viewDateSub, viewIsToday, viewNotToday:!viewIsToday,
      viewShowReporting, viewNoReporting, viewNoRepReason,
      viewRoster, vPresent, vMc, vThirdVal, vThirdLabel, vThirdColor, vTotal,
      vPresentLabel:'Checked in',
      viewListHeader, viewPercentText, viewPercentColor,
      intakeLabel, intakeRange,
      personnelList:activeMembers.map(p=>{const av=s.avatars[p.id]||'';return{...p,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),onEditNote:this.openNote(p.id,p.notes||''),isEditingNote:s.editingNoteId===p.id,onAskDeactivate:this.askDeactivatePerson(p.id),isConfirmingDeactivate:s.confirmDeactivateId===p.id,statPresent:s.peopleStats[p.id]?.present??0,statMc:s.peopleStats[p.id]?.mc??0,statAbsent:s.peopleStats[p.id]?.absent??0,statPct:s.peopleStats[p.id]?.pct!=null?(s.peopleStats[p.id].pct+'%'):'No records',showStats:s.peopleStatsLoaded,avatarStyle:av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'',avatarInitials:av?'':Utils.initials(p.name)};}),
      cancelDeactivatePerson:this.cancelDeactivatePerson,
      confirmDeactivatePerson:this.confirmDeactivatePerson,
      rosterSort:s.rosterSort,
      setRosterSortShift:this.setRosterSort('shift'),
      setRosterSortName:this.setRosterSort('name'),
      setRosterSortStatus:this.setRosterSort('status'),
      rosterSortShiftStyle,rosterSortNameStyle,rosterSortStatusStyle,
      newBatchDate:s.newBatchDate,onNewBatchDate:this.onNewBatchDate,createBatch:this.createBatch,batchCreating:s.batchCreating,
      showCarryOver, carryOverCount, carryOver:this.carryOver, carryingOver:s.carryingOver,
      npName:s.npName, npContact:s.npContact, npShift, npPassword:s.npPassword,
      npAmFull, npPmFull, npAmCount, npPmCount,
      npAmLabel:npAmFull?'AM shift (0830-1530) - Taken':'AM shift (0830-1530) ('+npAmCount+'/2)',
      npPmLabel:npPmFull?'PM shift (1530-2230) - Taken':'PM shift (1530-2230) ('+npPmCount+'/2)',
      onNpName:this.onNpName, onNpContact:this.onNpContact, onNpShift:this.onNpShift, onNpPassword:this.onNpPassword, addPerson:this.addPerson,
      mealActive:!!(activeBatch?.meal_active), toggleMealActive:this.toggleMealActive,
      mealToggleTrackBg:activeBatch?.meal_active?accent:'#39435a',
      mealToggleKnobX:activeBatch?.meal_active?'25px':'3px',
      batchLoading:s.batchLoading,
      exportCsv:this.exportCsv,
      testDate:s.testDate, testDateInput:s.testDateInput,
      onTestDateInput:this.onTestDateInput, setTestDate:this.setTestDate, clearTestDate:this.clearTestDate,
      hasTestDate:!!s.testDate,
      batchJumpDate:s.batchJumpDate, onBatchJumpDate:this.onBatchJumpDate, jumpToDate:this.jumpToDate,
      pendingLeaves:(s.pendingLeaves||[]).map(l=>({
        id:l.id, reason:l.reason||'',
        personName:l.personnel?.name||'Unknown',
        personShift:Utils.shiftLabel(l.personnel?.shift||'AM'),
        typeLabel:l.type==='mc'?'MC':l.type==='shift_change'?'Shift Change':l.type==='other'?'Other':'Personal Leave',
        dateLabel:l.date?Utils.fmtMed(new Date(l.date+'T00:00:00')):'',
        requestedShiftLabel:l.requested_shift?Utils.shiftLabel(l.requested_shift):'',
        showRequestedShift:l.type==='shift_change'&&!!l.requested_shift,
        onApprove:this.approveLeave(l.id), onReject:this.rejectLeave(l.id),
      })),
      pendingLeavesCount:(s.pendingLeaves||[]).length,
      hasPendingLeaves:(s.pendingLeaves||[]).length>0,
      pendingLeavesLoaded:s.pendingLeavesLoaded,
      batchTotalPresent, batchTotalMc, batchTotalAbsent,
      batchAvgPct:batchAvgPct!==null?batchAvgPct+'%':'—',
      showBatchStats:s.peopleStatsLoaded,
    };
  }

  _buildAccount(s, accent){
    const me=this.cur(); if(!me) return {};
    const avatarUrl=s.avatars[s.currentUserId]||'';
    const acctBatch=(s.batches||[]).find(b=>b.is_live)||(s.batches||[]).find(b=>b.id===me.batch_id)||null;
    const acctDekit=acctBatch?.dekit_date?new Date(acctBatch.dekit_date+'T00:00:00'):null;
    const acctTodayMid=new Date();acctTodayMid.setHours(0,0,0,0);
    const acctDkLeft=acctDekit?Math.round((acctDekit-acctTodayMid)/86400000):null;
    const acctDekitCountdown=acctDkLeft===null?'':acctDkLeft===0?'Return equipment today':acctDkLeft>0?`${acctDkLeft} day${acctDkLeft!==1?'s':''} to dekit`:'Cycle complete';
    const acctShowDekit=s.role==='reservist'&&!!acctDekitCountdown;
    return {
      accountOpen:s.accountOpen,
      closeAccount:this.closeAccount, askDelete:this.askDelete, cancelDelete:this.cancelDelete, deleteAccount:this.deleteAccount,
      confirmDelete:s.confirmDelete, deleteIdle:!s.confirmDelete,
      acctNric:'', acctContact:me.contact||'-',
      onAvatarFile:this.onAvatarFile,
      headerAvatarBg:avatarUrl?('url("'+avatarUrl+'")') :'none',
      headerNoAvatar:!avatarUrl,
      acctAvatarBg:avatarUrl?('url("'+avatarUrl+'")') :'none',
      acctNoAvatar:!avatarUrl, acctHasAvatar:!!avatarUrl,
      removeAvatar:this.removeAvatar,
      isReservistRole:s.role==='reservist',
      acctNameEdit:s.acctNameEdit, onAcctNameEdit:this.onAcctNameEdit, saveAcctName:this.saveAcctName,
      acctNameError:s.acctNameError, acctNameSuccess:s.acctNameSuccess,
      acctPwCurrent:s.acctPwCurrent, acctPwNew:s.acctPwNew, acctPwConfirm:s.acctPwConfirm,
      onAcctPwCurrent:this.onAcctPwCurrent, onAcctPwNew:this.onAcctPwNew, onAcctPwConfirm:this.onAcctPwConfirm,
      saveAcctPw:this.saveAcctPw,
      acctPwError:s.acctPwError, acctPwSuccess:s.acctPwSuccess,
      acctSaving:s.acctSaving,
      acctDekitCountdown, acctShowDekit,
      adminNotifGranted:s.adminNotifGranted, requestAdminNotifs:this.requestAdminNotifs,
    };
  }

  // ── renderVals ────────────────────────────────────────────────────────────
  renderVals(){
    const s=this.state;
    const accent=this.props.accent||'#2f5fd0';
    const orgName=this.props.orgName||'Ops Security';
    const hqName=this.props.hqName||'Bedok DHQ';
    return {
      accent, orgName, hqName,
      bgOuter:'#cdd2da',
      bgContent:'#f6f7f9',
      showToast:!!s.toast, toastMsg:s.toast?.msg||'', toastBg:s.toast?.type==='error'?'#c0392b':'#1f8a5b',
      dismissToast:this.dismissToast,
      sessionExpiring:s.sessionExpiring, refreshSessionNow:this.refreshSessionNow,
      idleWarning:s.idleWarning, stayActive:this.stayActive,
      showA2hs:s.showA2hs, a2hsIsIos:s.a2hsIsIos, dismissA2hs:this.dismissA2hs,
      ...this._buildAuth(s, accent),
      ...this._buildNav(s, accent, orgName),
      ...this._buildCheckin(s, accent, hqName),
      ...this._buildCalendar(s, accent),
      ...this._buildAttendance(s),
      ...this._buildBriefings(s, accent),
      ...this._buildAdmin(s, accent),
      ...this._buildAccount(s, accent),
    };
  }
}
return AppComponent;
};
