// ── Auth handlers ─────────────────────────────────────────────────────────
const AuthHandlers = {

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
    let signupUser = user;
    if(error||!user){
      const alreadyReg = error?.message?.toLowerCase().includes('already registered') || error?.message?.toLowerCase().includes('user already registered');
      if(alreadyReg){
        // Returning reservist: try logging in with provided credentials
        const {user:retUser, error:loginErr} = await DB.auth.login(cleanContact, suPassword);
        if(loginErr||!retUser){
          this.setState({loading:false, authError:'This contact is already registered. If you are a returning reservist, use your previous password. Otherwise, ask your supervisor to re-enroll you directly.'});
          return;
        }
        signupUser = retUser;
      } else {
        this.setState({loading:false, authError:error?.message||'Signup failed. Try a different contact or password.'});
        return;
      }
    }
    // Check for existing requests now that the user is authenticated
    const existingReq = await DB.signupRequests.getByContact(cleanContact).catch(()=>null);
    if(existingReq?.status==='pending'){
      await DB.auth.logout();
      this.setState({loading:false, authError:'A signup request for this number is already pending admin approval.'});
      return;
    }
    if(existingReq?.status==='rejected'){
      await DB.auth.logout();
      this.setState({loading:false, authError:'Your previous signup request was not approved. Contact your supervisor.'});
      return;
    }
    const {error:reqErr} = await DB.signupRequests.create({authId:signupUser.id, name:suName.trim(), contact:cleanContact, shift, batchId:activeBatch.id});
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
      timesEditId:null, timesEditP1:'', timesEditP2:'', timesEditP3:'', timesEditP4:'', timesEditSaving:false, timesEditErrField:null,
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
      shiftChangeOpen:false, shiftChangeNew:'AM', shiftChangeReason:'', shiftChangeConfirming:false,
      adminNotifGranted:false,
      myLeaveHistory:[], myLeaveHistoryLoaded:false,
      welfareNoteOpen:false, welfareNoteText:'', welfareNoteSaving:false,
      isSuperAdmin:false, adminsList:[], adminsLoaded:false,
      npAdminName:'', npAdminContact:'', npAdminPassword:'', confirmDeactivateAdminId:null,
      promoteAdminId:'', promoteAdminName:'', promoteAdminContact:'', confirmPromoteAdminId:null, promoteSearch:'', promoteShowAllCycles:false, promoteListPage:1,
      peopleTab:'requests',
      editingBatchLabel:false, batchLabelText:'',
      viewOffset:0, rosterSearch:'', logSearch:'', logShiftFilter:'all',
      markingAllAbsent:false, confirmMarkAllAbsent:false,
      personHistoryId:null, personHistoryRows:[], personHistoryLoading:false,
      signupPending:false,
      pendingSignups:[], pendingSignupsLoaded:false, approvedSignups:[],
      selectedSignupIds:[],
      signupSearch:'', leaveSearch:'', addPersonnelOpen:false, npReenrollRecord:null,
      rejectLeaveId:null, rejectLeaveReason:'',
      waPreviewOpen:false, waPreviewText:'',
      logNoteId:null, logNoteText:'',
      realtimeLive:false,
      resetPwId:null, resetPwNew:'', resetPwSaving:false,
      broadcastOpen:false, broadcastText:'', broadcastSaving:false,
      bulkAddOpen:false, bulkAddText:'', bulkAddParsed:[], bulkAddStep:'input', bulkAddAdding:false,
      noReportBulkOpen:false, noReportBulkText:'',
      helpOpen:false,
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

  dismissSignupPending: function() { this.setState({signupPending:false, authMode:'login'}); },

  setAuthMode: function(mode) { this.setState({authMode:mode, authError:''}); },

  forgotPassword: function() { this.setState({forgotPasswordOpen:true}); },
  openForgotPassword:  function() { this.setState({forgotPasswordOpen:true}); },
  closeForgotPassword: function() { this.setState({forgotPasswordOpen:false}); },

  refreshSessionNow: async function() {
    this.setState({sessionExpiring:false});
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    let refreshFailed = false;
    try {
      const {session, error} = await DB.auth.refreshSession();
      if(error || !session) refreshFailed = true;
    } catch(e) { refreshFailed = true; }
    if(refreshFailed) {
      await DB.auth.logout().catch(()=>{});
      this.setState({authed:false,role:null,authMode:'login',loading:false,authError:'Your session has expired. Please log in again.'});
      return;
    }
    this._sessionWarnTimer = setTimeout(()=>{ if(this.state.authed) this.setState({sessionExpiring:true}); }, 55*60*1000);
  },

  stayActive: function() { this._resetIdleTimer(); },

  dismissA2hs: function() { localStorage.setItem('a2hs_dismissed','1'); this.setState({showA2hs:false}); },

  _shouldShowA2hs: function() {
    try{
      if(window.navigator.standalone||window.matchMedia('(display-mode:standalone)').matches) return false;
      if(localStorage.getItem('a2hs_dismissed')) return false;
      const last = localStorage.getItem('a2hs_seen');
      if(last && (Date.now() - parseInt(last)) < 24*60*60*1000) return false;
      return /Android|iPhone|iPad|iPod/.test(navigator.userAgent||'');
    }catch(e){return false;}
  },

  _refreshSignupSlots: async function() {
    const liveBatch = this._liveBatch();
    if(!liveBatch || this.state.demo) return;
    const personnel = await DB.personnel.list().catch(()=>[]);
    const liveIdx = this.state.batches.findIndex(b=>b.id===liveBatch.id);
    this.setState({personnel, activeBatchIdx:liveIdx>=0?liveIdx:this.state.activeBatchIdx});
  },

  _capShift: function(want, members) {
    const {am, pm} = this._shiftSlotCounts(members || this.state.personnel);
    if(want==='AM'&&am>=2) return 'OFFICE';
    if(want==='PM'&&pm>=2) return 'OFFICE';
    return want;
  },

};
