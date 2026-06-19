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
    mcMode: false, mcFileName: '', _mcFile: null,
    mcViewOpen: false, mcViewName: '', mcViewDate: '', mcViewFile: '', mcViewUrl: '',
    npName: '', npContact: '', npShift: 'AM',
    rosterSearch: '',
    realtimeChannel: null,
    now: new Date(), demo: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    offlinePending: false,
    testDate: null, testDateInput: '',
    acctNameEdit: '',
    acctPwCurrent: '', acctPwNew: '', acctPwConfirm: '',
    acctPwError: '', acctPwSuccess: '',
    acctNameError: '', acctNameSuccess: '',
    acctSaving: false,
    confirmUndo: false,
    addPersonSuccess: '', addPersonError: '',
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
  };

  // ── Lifecycle ────────────────────────────────────────────────────────────
  componentDidMount(){
    this._t = setInterval(()=>this.setState({now:new Date()}), 1000);
    this._init();
    this._onOnline = async () => {
      this.setState({isOnline:true});
      const pend = this._offlineQueue;
      if(pend && !this.state.demo){
        await DB.attendance.upsert(pend.id, pend.date, pend.status, pend.extras).catch(()=>{});
        this._offlineQueue = null;
        this.setState({offlinePending:false});
      }
    };
    this._onOffline = () => this.setState({isOnline:false});
    window.addEventListener('online', this._onOnline);
    window.addEventListener('offline', this._onOffline);
  }
  componentWillUnmount(){
    if(this._toastTimer) clearTimeout(this._toastTimer);
    clearInterval(this._t);
    this._unsubscribeRealtime();
    window.removeEventListener('online', this._onOnline);
    window.removeEventListener('offline', this._onOffline);
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  async _init(){
    const batches = await DB.batches.list().catch(()=>[]);
    if(batches.length){
      const liveIdx = batches.findIndex(b=>b.is_live);
      const activeBatchIdx = liveIdx>=0?liveIdx:0;
      const activeBatch = batches[activeBatchIdx];
      const personnel = activeBatch ? await DB.personnel.list(activeBatch.id).catch(()=>[]) : [];
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
    // Load avatar: localStorage is instant; Supabase URL must be probe-loaded
    // so a deleted file doesn't set a URL in state and hide the initials
    const cachedAvatar = localStorage.getItem('avatar_'+me.id);
    if(cachedAvatar && cachedAvatar !== 'REMOVED'){
      this.setState(s=>({avatars:{...s.avatars,[me.id]:cachedAvatar}}));
    } else if(!cachedAvatar){
      const meAvatarUrl = DB.storage.getAvatarUrl(me.id);
      if(meAvatarUrl){ const img=new Image(); img.onload=()=>this.setState(s=>({avatars:{...s.avatars,[me.id]:meAvatarUrl}})); img.src=meAvatarUrl; }
    }
    const role = me.role || 'reservist';
    const today = Utils.dateKey(this.baseDate());

    let batches = await DB.batches.list().catch(()=>[]);
    if(role==='admin'){
      batches = await this._ensureLiveBatch(batches);
      batches = await this._ensureForwardBatches(batches);
    }

    const liveIdx = batches.findIndex(b=>b.is_live);
    const activeBatchIdx = liveIdx>=0?liveIdx:0;
    const activeBatch = batches[activeBatchIdx];

    // Auto-deactivate reservist if their batch's dekit day has passed
    if(role==='reservist'){
      const myBatch = batches.find(b=>b.id===me.batch_id);
      if(myBatch?.dekit_date && today > myBatch.dekit_date){
        await DB.personnel.deactivate(me.id).catch(()=>{});
        await DB.auth.logout();
        this.setState({authed:false,role:null,authMode:'login',loading:false,accountDeleted:true});
        return;
      }
    }

    const [personnel, attendance, noReportDays, history] = await Promise.all([
      activeBatch ? DB.personnel.list(activeBatch.id) : Promise.resolve([]),
      DB.attendance.getForDate(today),
      activeBatch ? DB.noReportDays.list(activeBatch.start_date, activeBatch.dekit_date||activeBatch.end_date) : Promise.resolve(new Set()),
      DB.attendance.getHistory(me.id),
    ]);

    this.setState({
      authed:true, role,
      tab: role==='admin'?'overview':'checkin',
      currentUserId: me.id,
      me, personnel, batches, activeBatchIdx,
      attendance, noReportDays, history,
      authError:'', loading:false, accountDeleted:false, demo:false,
    });
    if(role==='admin'){ this._subscribeRealtime(today); setTimeout(()=>this.loadRosterAvatars(),0); }
    if(!this.state.demo) DB.auth.syncDisplayName(me.name).catch(()=>{});
  }

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
      const fromDate = lastBatch?.dekit_date
        ? Utils.addDays(new Date(lastBatch.dekit_date+'T00:00:00'), 1)
        : new Date(today+'T00:00:00');
      const nextTue = Utils.nextBatchTuesday(fromDate);
      const {start,end,dekit} = Utils.batchDatesFrom(nextTue);
      const startStr=Utils.dateKey(start), endStr=Utils.dateKey(end), dekitStr=Utils.dateKey(dekit);
      const sameEndMonth = sorted.filter(b=>(b.end_date||b.start_date).slice(0,7)===endStr.slice(0,7));
      const num = sameEndMonth.length+1;
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
    return this._ensureForwardBatches(await DB.batches.list().catch(()=>sorted));
  }

  async _ensureForwardBatches(batches, ahead=3){
    const today=Utils.dateKey(this.baseDate());
    let sorted=[...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const futureBatches=sorted.filter(b=>b.start_date>today);
    const needed=ahead-futureBatches.length;
    for(let i=0;i<needed;i++){
      const lastBatch=sorted[sorted.length-1];
      const fromDate=lastBatch?.dekit_date
        ?Utils.addDays(new Date(lastBatch.dekit_date+'T00:00:00'),1)
        :new Date(today+'T00:00:00');
      const nextTue=Utils.nextBatchTuesday(fromDate);
      const {start,end,dekit}=Utils.batchDatesFrom(nextTue);
      const startStr=Utils.dateKey(start),endStr=Utils.dateKey(end),dekitStr=Utils.dateKey(dekit);
      const sameEndMonth=sorted.filter(b=>(b.end_date||b.start_date).slice(0,7)===endStr.slice(0,7));
      const label=Utils.batchLabel(startStr,endStr,sameEndMonth.length+1);
      const {data}=await DB.batches.create(label,startStr,endStr,dekitStr).catch(()=>({}));
      if(data) sorted.push(data); else break;
    }
    return needed>0?DB.batches.list().catch(()=>sorted):batches;
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
    const {suName,suContact,suPassword} = this.state;
    if(!suName.trim()||!suContact.trim()||!suPassword.trim()){ this.setState({authError:'Please fill in all fields.'}); return; }
    if(suPassword.length < 6){ this.setState({authError:'Password must be at least 6 characters.'}); return; }
    const cleanContact = suContact.replace(/[\s-]/g,'');
    if(!/^\d{8}$/.test(cleanContact)){ this.setState({authError:'Contact must be an 8-digit Singapore number.'}); return; }
    const activeBatch = this._liveBatch();
    if(!activeBatch){
      this.setState({authError:'No active intake batch is open for sign-up right now.'});
      return;
    }
    const members = await DB.personnel.list(activeBatch.id).catch(()=>[]);
    const {am, pm} = this._shiftSlotCounts(members);
    const shift = am < 2 ? 'AM' : pm < 2 ? 'PM' : 'OFFICE';
    this.setState({loading:true, authError:''});
    const {user,error} = await DB.auth.signup(suContact, suPassword, suName.trim());
    if(error||!user){ this.setState({loading:false, authError:error?.message||'Signup failed. Try a different contact or password.'}); return; }
    const existing = await DB.personnel.findByContact(suContact);
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
    this.setState({suName:'', suContact:'', suPassword:'', personnel:members});
  };

  logout = async () => {
    this._unsubscribeRealtime();
    if(!this.state.demo) await DB.auth.logout();
    this.setState({
      authed:false, role:null, authMode:'login', demo:false,
      currentUserId:null, me:null, loginContact:'', loginPassword:'',
      mcMode:false, locStatus:'idle', locDistance:null, locGpsMsg:'',
      accountOpen:false, confirmDelete:false, mcViewOpen:false,
      personnel:[], attendance:{}, history:[], attendanceCache:{}, batchMembersCache:{},
      testDate:null, testDateInput:'',
      acctNameEdit:'', acctPwCurrent:'', acctPwNew:'', acctPwConfirm:'',
      acctPwError:'', acctPwSuccess:'', acctNameError:'', acctNameSuccess:'', acctSaving:false,
      confirmUndo:false, addPersonSuccess:'', addPersonError:'', batchLoading:false, batchCreating:false,
      editingNoteId:null, editingNoteText:'',
      batchJumpDate:Utils.dateKey(new Date()),
      toast:null, rosterSort:'shift', newBatchDate:'',
      peopleStats:{}, peopleStatsLoaded:false, confirmDeactivateId:null, showArchivedBatches:false,
      noAvatarIds:new Set(),
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
    this.setState({authed:true,role:'admin',tab:'overview',demo:true,currentUserId:'demo-admin',me:{id:'demo-admin',name:'Supervisor',role:'admin'},personnel,batches:[batch],activeBatchIdx:0,attendance:{'d2':{status:'present',time:'08:24',dist:32},'d3':{status:'present',time:'08:31',dist:48},'d5':{status:'mc',time:'-',mc:'demo-mc.pdf'}},noReportDays:new Set(),history:[],authError:'',accountDeleted:false});
  };

  // ── Form handlers ─────────────────────────────────────────────────────────
  onLoginContact  = e => this.setState({loginContact:e.target.value});
  onLoginPassword = e => this.setState({loginPassword:e.target.value});
  onSuName    = e => this.setState({suName:e.target.value});
  onSuContact = e => this.setState({suContact:e.target.value});
  onSuShift   = e => this.setState({suShift:e.target.value});
  onSuPassword= e => this.setState({suPassword:e.target.value});
  onNpName    = e => this.setState({npName:e.target.value});
  onNpContact = e => this.setState({npContact:e.target.value});
  onNpShift   = e => this.setState({npShift:e.target.value});

  // ── Check-in ──────────────────────────────────────────────────────────────
  verifyLocation = () => {
    if(this.state.locStatus==='locating') return;
    this.setState({locStatus:'locating'});
    if(!navigator.geolocation){
      setTimeout(()=>this.setState({locStatus:'verified',locDistance:Math.round(18+Math.random()*72)}),1200);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos=>{
        const dist=this._haversine(pos.coords.latitude, pos.coords.longitude, this._hqLat(), this._hqLon());
        const rounded=Math.round(dist);
        this.setState({locDistance:rounded, locStatus:rounded<=this._maxDist()?'verified':'out_of_range'});
      },
      err=>{
        const msg=err.code===1?'Location permission denied. Enable it in your browser/phone settings.':err.code===2?'GPS signal unavailable. Try stepping outside or disabling Airplane mode.':'GPS timed out. Make sure location is on and try again.';
        this.setState({locStatus:'gps_error', locDistance:null, locGpsMsg:msg});
      },
      {enableHighAccuracy:true, timeout:15000, maximumAge:0}
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

  submitCheckIn = async () => {
    if(this.state.locStatus!=='verified') return;
    const today=Utils.dateKey(new Date()), time=Utils.hhmm(new Date()), dist=this.state.locDistance;
    const entry={status:'present',time,dist};
    this.setState(s=>({attendance:{...s.attendance,[s.currentUserId]:entry}}));
    this._haptic();
    if(!this.state.demo){
      if(!this.state.isOnline){
        this._offlineQueue={id:this.state.currentUserId,date:today,status:'present',extras:{time,dist}};
        this.setState({offlinePending:true});
      } else {
        await DB.attendance.upsert(this.state.currentUserId, today, 'present', {time,dist});
      }
    }
  };

  openMc  = () => this.setState({mcMode:true});
  cancelMc= () => this.setState({mcMode:false, mcFileName:'', _mcFile:null});
  onMcFile= e => { const f=e.target.files&&e.target.files[0]; this.setState({mcFileName:f?f.name:'',_mcFile:f||null}); };

  submitMc = async () => {
    const today=Utils.dateKey(new Date());
    let mc=this.state.mcFileName||'medical-cert.pdf';
    if(!this.state.demo && this.state._mcFile){
      const {path,error}=await DB.storage.uploadMc(this.state.currentUserId, today, this.state._mcFile).catch(e=>({path:mc,error:e}));
      if(error) this._toast('File upload failed — MC recorded without attachment.','error');
      else mc=path;
    }
    if(!this.state.demo) await DB.attendance.upsert(this.state.currentUserId, today, 'mc', {mc});
    this.setState(s=>({attendance:{...s.attendance,[s.currentUserId]:{status:'mc',time:'-',mc}},mcMode:false,_mcFile:null}));
    this._haptic();
  };

  _haptic(ms=60){ if(navigator.vibrate) navigator.vibrate(ms); }
  _toast(msg, type='success'){
    if(this._toastTimer) clearTimeout(this._toastTimer);
    this.setState({toast:{msg,type}});
    this._toastTimer=setTimeout(()=>this.setState({toast:null}),3000);
  }

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
    if(!this.state.demo) await DB.personnel.updateShift(id, shift).catch(()=>{});
    this.setState(s=>({personnel:s.personnel.map(p=>p.id===id?{...p,shift}:p)}));
  };

  requestUndo = () => this.setState({confirmUndo: true});
  cancelUndo  = () => this.setState({confirmUndo: false});
  doUndo      = async () => {
    const today=Utils.dateKey(new Date());
    if(!this.state.demo) await DB.attendance.remove(this.state.currentUserId, today);
    this.setState(s=>{ const a={...s.attendance}; delete a[s.currentUserId]; return {attendance:a,mcFileName:'',_mcFile:null,locStatus:'idle',locDistance:null,confirmUndo:false}; });
    this._toast('Check-in undone.');
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
  };

  clearTestDate = async () => {
    this.setState({testDate:null, testDateInput:'', viewOffset:0});
    if(this.state.role==='admin'&&!this.state.demo){
      let batches = await DB.batches.list().catch(()=>this.state.batches);
      batches = await this._ensureLiveBatch(batches, Utils.dateKey(new Date()));
      const liveIdx = batches.findIndex(b=>b.is_live);
      this.setState({batches, activeBatchIdx:liveIdx>=0?liveIdx:0});
    }
  };

  // ── MC viewer ─────────────────────────────────────────────────────────────
  openMcViewer = (name, date, file) => async () => {
    let url='';
    if(file && !this.state.demo) url = await DB.storage.getMcUrl(file).catch(()=>'');
    this.setState({mcViewOpen:true, mcViewName:name, mcViewDate:date, mcViewFile:file||'', mcViewUrl:url});
  };
  closeMcViewer = () => this.setState({mcViewOpen:false});


  // ── Export CSV ────────────────────────────────────────────────────────────
  exportCsv = () => {
    const {batches,activeBatchIdx,batchMembersCache,personnel,attendance,attendanceCache,noReportDays}=this.state;
    const batch=batches[activeBatchIdx||0]; if(!batch) return;
    const members=batch.is_live?personnel:(batchMembersCache[batch.id]||[]);
    const start=new Date(batch.start_date+'T00:00:00'), end=new Date(batch.end_date+'T00:00:00');
    const dates=[];
    for(let d=new Date(start);d<=end;d=Utils.addDays(d,1)){
      if(Utils.isReportDay(d)&&!Utils.holidayName(d)&&!noReportDays.has(Utils.dateKey(d))) dates.push(new Date(d));
    }
    const header=['Name','Contact','Shift',...dates.map(d=>Utils.fmtShort(d)),'Present','MC','Absent'].join(',');
    const rows=members.map(p=>{
      const statuses=dates.map(d=>{
        const dk=Utils.dateKey(d);
        const map=dk===Utils.dateKey(this.baseDate())?attendance:(attendanceCache[dk]||{});
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
      const entry={status:row.status,time:row.check_in_time?row.check_in_time.slice(0,5):'-',dist:row.gps_distance_m,mc:row.mc_filename};
      this.setState(s=>({attendance:{...s.attendance,[row.personnel_id]:entry}}));
    });
    this.setState({realtimeChannel:ch});
  }
  _unsubscribeRealtime(){
    DB.realtime.unsubscribe(this.state.realtimeChannel);
    // setState({realtimeChannel:null}) intentionally skipped here as it may run post-unmount
  }

  // ── Admin actions ─────────────────────────────────────────────────────────
  toggleNoReporting = async () => {
    const off=this.state.viewOffset, d=this.dateForOffset(off);
    if(!Utils.isReportDay(d)||Utils.holidayName(d)) return;
    const dk=Utils.dateKey(d);
    const isNowOn = this.state.demo ? !this.state.noReportDays.has(dk) : await DB.noReportDays.toggle(dk);
    this.setState(s=>{ const nd=new Set(s.noReportDays); isNowOn?nd.add(dk):nd.delete(dk); return {noReportDays:nd}; });
  };

  _navToOffset = async (off) => {
    const date=Utils.dateKey(this.dateForOffset(off));
    const {batches}=this.state;
    const curIdx=this.state.activeBatchIdx||0;
    // Check non-current batches first — handles overlap where next batch starts
    // before current batch's dekit_date
    let ni=batches.findIndex((b,i)=>i!==curIdx&&date>=b.start_date&&date<=(b.dekit_date||b.end_date));
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
      const [nrd,attMap]=await Promise.all([
        DB.noReportDays.list(b.start_date,b.dekit_date||b.end_date).catch(()=>new Set()),
        b.is_live?Promise.resolve({}):DB.attendance.getForBatch(b.start_date,b.end_date).catch(()=>({})),
      ]);
      this.setState(s=>({activeBatchIdx:ni,viewOffset:off,selectedCalOffset:null,attendanceCache:b.is_live?{}:{...s.attendanceCache,...attMap},noReportDays:nrd,batchLoading:false}));
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
    const [noReportDays, batchAttMap] = await Promise.all([
      DB.noReportDays.list(b.start_date, b.dekit_date||b.end_date).catch(()=>new Set()),
      b.is_live ? Promise.resolve({}) : DB.attendance.getForBatch(b.start_date, b.end_date).catch(()=>({})),
    ]);
    this.setState(s=>({
      activeBatchIdx:i, viewOffset:off, selectedCalOffset:null,
      attendanceCache: b.is_live ? {} : {...s.attendanceCache, ...batchAttMap},
      noReportDays, batchLoading:false,
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
    let idx=batches.findIndex(b=>batchJumpDate>=b.start_date&&batchJumpDate<=(b.dekit_date||b.end_date));
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
    const time=status==='present'?(prev.time&&prev.time!=='-'?prev.time:Utils.hhmm(new Date())):'-';
    const dist=status==='present'?prev.dist:undefined;
    if(!this.state.demo) await DB.attendance.upsert(id, viewDateKey, status, {time,dist});
    if(viewIsToday){
      this.setState(s=>({attendance:{...s.attendance,[id]:{status,time,dist}}}));
    } else {
      this.setState(s=>({attendanceCache:{...s.attendanceCache,[viewDateKey]:{...(s.attendanceCache?.[viewDateKey]||{}),[id]:{status,time,dist}}}}));
    }
    this._haptic(40);
  };

  addPerson = async () => {
    const {npName,npContact,npShift,batches,activeBatchIdx,demo,personnel}=this.state;
    if(!npName.trim()){ this._toast('Name is required.','error'); return; }
    const cleanContact=npContact.replace(/[\s-]/g,'');
    if(cleanContact&&!/^\d{8}$/.test(cleanContact)){ this._toast('Contact must be an 8-digit Singapore number.','error'); return; }
    if(cleanContact&&personnel.some(p=>p.contact.replace(/[\s-]/g,'')===cleanContact)){ this._toast('This contact is already on the roster.','error'); return; }
    const activeBatch=batches[activeBatchIdx||0];
    const shift=this._capShift(npShift, personnel);
    const contact=cleanContact||'-';
    const addedName=npName.trim();
    if(!demo){
      const {data,error}=await DB.personnel.add({name:addedName,contact,shift,batchId:activeBatch?.id});
      if(error||!data){ this._toast('Failed to add. Try again.','error'); return; }
      this.setState(s=>({personnel:[...s.personnel,data],npName:'',npContact:'',npShift:'AM'}));
    } else {
      const id='demo-'+Date.now();
      this.setState(s=>({personnel:[...s.personnel,{id,name:addedName,contact,shift,role:'reservist',batch_id:activeBatch?.id,is_active:true}],npName:'',npContact:'',npShift:'AM'}));
    }
    this._toast(addedName+' added to roster.');
  };

  onRosterSearch = e => this.setState({rosterSearch:e.target.value});
  markAllPresent = async () => {
    const off=this.state.viewOffset||0;
    const viewDateKey=Utils.dateKey(this.dateForOffset(off));
    const viewIsToday=off===0;
    const viewMap=viewIsToday?this.state.attendance:(this.state.attendanceCache?.[viewDateKey]||{});
    const pending=this.state.personnel.filter(p=>!viewMap[p.id]?.status||viewMap[p.id]?.status==='absent');
    const time=Utils.hhmm(new Date());
    const updates={};
    await Promise.all(pending.map(async p=>{
      updates[p.id]={status:'present',time};
      if(!this.state.demo) await DB.attendance.upsert(p.id,viewDateKey,'present',{time}).catch(()=>{});
    }));
    if(viewIsToday){
      this.setState(s=>({attendance:{...s.attendance,...updates}}));
    } else {
      this.setState(s=>({attendanceCache:{...s.attendanceCache,[viewDateKey]:{...(s.attendanceCache?.[viewDateKey]||{}),...updates}}}));
    }
  };

  refreshPage = async () => {
    const {role, me, batches, activeBatchIdx, demo} = this.state;
    if(demo || !me) return;
    const today = Utils.dateKey(this.baseDate());
    const activeBatch = batches[activeBatchIdx||0];
    const [attendance, noReportDays] = await Promise.all([
      DB.attendance.getForDate(today),
      activeBatch ? DB.noReportDays.list(activeBatch.start_date, activeBatch.dekit_date||activeBatch.end_date) : Promise.resolve(new Set()),
    ]);
    const history = role==='reservist' ? await DB.attendance.getHistory(me.id).catch(()=>[]) : this.state.history;
    this.setState({attendance, noReportDays, history, attendanceCache:{}});
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  go = t => () => this.setState({tab:t});
  setRolesTab  = k => () => this.setState({rolesTab:k});
  selectCalDay = off => () => this.setState(s=>({selectedCalOffset:s.selectedCalOffset===off?null:off}));
  goPeople = () => { this.setState({tab:'people',peopleStatsLoaded:false}); this.loadPeopleStats(); this.loadRosterAvatars(); };

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
    const sameEndMonth=batches.filter(b=>(b.end_date||b.start_date).slice(0,7)===endStr.slice(0,7));
    const num=sameEndMonth.length+1;
    const label=Utils.batchLabel(startStr,endStr,num);
    if(!demo){
      const {data,error}=await DB.batches.create(label,startStr,endStr,dekitStr);
      if(error||!data){ this._toast('Failed to create batch.','error'); this.setState({batchCreating:false}); return; }
      const newBatches=await DB.batches.list().catch(()=>[...batches,data]);
      const liveIdx=newBatches.findIndex(b=>b.is_live);
      this.setState({batches:newBatches,activeBatchIdx:liveIdx>=0?liveIdx:0,newBatchDate:'',batchCreating:false});
    } else {
      const nb={id:'demo-b-'+Date.now(),label,start_date:startStr,end_date:endStr,dekit_date:dekitStr,is_live:true};
      this.setState(prev=>({batches:[...prev.batches,nb],newBatchDate:'',batchCreating:false}));
    }
    this._toast('Batch '+label+' created.');
  };

  askDeactivatePerson = id => () => this.setState({confirmDeactivateId:id});
  cancelDeactivatePerson = () => this.setState({confirmDeactivateId:null});
  confirmDeactivatePerson = async () => {
    const {confirmDeactivateId,demo,batches,activeBatchIdx}=this.state;
    if(!confirmDeactivateId) return;
    if(!demo) await DB.personnel.deactivate(confirmDeactivateId).catch(()=>{});
    const batchId=batches[activeBatchIdx||0]?.id;
    this.setState(s=>{
      const personnel=s.personnel.filter(p=>p.id!==confirmDeactivateId);
      const batchMembersCache=batchId?{...s.batchMembersCache,[batchId]:(s.batchMembersCache[batchId]||[]).filter(p=>p.id!==confirmDeactivateId)}:s.batchMembersCache;
      return {personnel,batchMembersCache,confirmDeactivateId:null};
    });
    this._toast('Person removed from roster.');
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
    const personnel = await DB.personnel.list(liveBatch.id).catch(()=>[]);
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
      if(this.isNoReport(0)) return {label:'No reporting',sub:hol||'Marked as a no-reporting day',color:'#b9791a',bg:'#f7efdc'};
      const rec=this.myRec(), st=rec.status||'pending';
      if(st==='present') return {label:'Checked in',sub:'Reported at '+rec.time,color:'#1f8a5b',bg:'#e7f3ec'};
      if(st==='mc')      return {label:'On MC',sub:'Sick leave declared for today',color:'#b9791a',bg:'#f7efdc'};
      return {label:'Pending',sub:'You have not checked in yet today',color:'#5c6678',bg:'#eceef2'};
    }
    if(hol) return {label:'Public holiday',sub:hol+', no reporting',color:'#b9791a',bg:'#f7efdc'};
    if(dst==='ph') return {label:'No reporting',sub:Utils.isReportDay(d)?'Marked as a no-reporting day':'No reporting required',color:'#b9791a',bg:'#f7efdc'};
    if(dst==='dekit') return {label:'Dekit day',sub:'Return equipment and submit meal allowance forms',color:'#161f30',bg:'#eceef2'};
    if(dst==='end') return {label:off<0?'Reporting day':'Upcoming',sub:'Last reporting day of your cycle',color:'#5c6678',bg:'#eceef2'};
    if(dst==='work'||dst==='today'){
      if(off<0){
        const hr=this.state.history.find(r=>r.date===dk);
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
      {value:'AM', disabled:amFull, label:amFull?'AM shift — full (2/2)':'AM shift, 0830–1530 ('+amCount+'/2)'},
      {value:'PM', disabled:pmFull, label:pmFull?'PM shift — full (2/2)':'PM shift, 1530–2230 ('+pmCount+'/2)'},
      {value:'OFFICE', disabled:false, label:'Office hours, 0900–1800'},
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
      suName:s.suName, suNric:'', suContact:s.suContact, suShift, shiftOptions, suPassword:s.suPassword,
      onSuName:this.onSuName, onSuNric:()=>{}, onSuContact:this.onSuContact, onSuShift:this.onSuShift, onSuPassword:this.onSuPassword,
      doSignup:this.doSignup,
      intakeLabel, intakeRange:intakeRangeFull, intakeRangeFull,
    };
  }

  _buildNav(s, accent, orgName){
    const me=this.cur();
    const TITLES={checkin:'Check-In',briefings:'Briefings',attendance:'Attendance',meal:'Meal Allowance',overview:'Dashboard',roster:'Roster',log:'Attendance Log',people:'Personnel'};
    const nc=t=>s.tab===t?accent:'#9aa3b2';
    return {
      isReservist:s.role==='reservist', isAdmin:s.role==='admin',
      headerChipClick:this.headerChipClick, logout:this.logout,
      userName:s.role==='admin'?(me?.name||'Supervisor'):(me?.name||''),
      userInitials:s.role==='admin'?(me?.name?Utils.initials(me.name):'SV'):Utils.initials(me?.name||''),
      tabTitle:TITLES[s.tab]||'',
      headerKicker:s.role==='admin'?'Admin, '+orgName:orgName+', PNSMEN',
      goCheckin:this.go('checkin'), goBriefings:this.go('briefings'), goAttendance:this.go('attendance'), goMeal:this.go('meal'),
      goOverview:()=>{ this.setState({tab:'overview'}); setTimeout(()=>this.loadRosterAvatars(),0); },
      goRoster:()=>{ this.setState({tab:'roster'}); setTimeout(()=>this.loadRosterAvatars(),0); },
      goLog:()=>{ this.setState({tab:'log'}); setTimeout(()=>this.loadRosterAvatars(),0); },
      goPeople:this.goPeople,
      cCheckin:nc('checkin'), cBriefings:nc('briefings'), cAttendance:nc('attendance'), cMeal:nc('meal'),
      cOverview:nc('overview'), cRoster:nc('roster'), cLog:nc('log'), cPeople:nc('people'),
      tabCheckin:s.tab==='checkin', tabBriefings:s.tab==='briefings', tabAttendance:s.tab==='attendance', tabMeal:s.tab==='meal',
      tabOverview:s.tab==='overview', tabRoster:s.tab==='roster', tabLog:s.tab==='log', tabPeople:s.tab==='people',
    };
  }

  _buildCheckin(s, accent, hqName){
    const me=this.cur();
    if(!me) return {
      todayLong:Utils.fmtLong(new Date()), clock:Utils.hhmm(s.now),
      myShiftLabel:'', myShiftWindow:'', myStatusLabel:'', myStatusColor:accent,
      myStatusPulse:'', phToday:false, phName:'', needCheckin:false, mcMode:false,
      isPresent:false, isMc:false, checkInTime:'-', checkInDist:'',
      verifyLocation:()=>{}, submitCheckIn:()=>{}, locLocating:false, locNeedsAction:false,
      locShowLocateBtn:false, locBtnLabel:'Locate me',
      locBorder:'#eef0f4', locCardBg:'#fff', locBadgeBg:'#eceef2', locBadgeColor:'#8a94a3',
      locMsg:'', locMsgColor:'#8a94a3', checkInOpacity:'.45', checkInPE:'none',
      openMc:()=>{}, onMcFile:()=>{}, submitMc:()=>{}, cancelMc:()=>{}, undoCheckin:()=>{},
      mcFileLabel:'',
      batchLabel:'', dekitCountdown:'', batchRange:'', showBatchInfo:false,
      whatsappLink:'', showWaShare:false,
      isOffline:!s.isOnline, offlinePending:s.offlinePending,
    };
    const rec=this.myRec(), status=rec.status||'pending', m=Utils.meta(status);
    const noRep=this.isNoReport(0);
    const locVerified=s.locStatus==='verified', locLocating=s.locStatus==='locating';
    const locOutOfRange=s.locStatus==='out_of_range', locGpsError=s.locStatus==='gps_error';
    const locIdle=!s.locStatus||s.locStatus==='idle';
    let locBorder,locCardBg,locBadgeBg,locBadgeColor,locMsg,locMsgColor;
    if(locVerified){ locBorder='#cfe6d8'; locCardBg='#f5faf7'; locBadgeBg='#e7f3ec'; locBadgeColor='#1f8a5b'; locMsg=s.locDistance+' m from '+hqName+' — on-site'; locMsgColor='#1f8a5b'; }
    else if(locOutOfRange){ locBorder='#f1d3cf'; locCardBg='#fbeeec'; locBadgeBg='#f7e4e1'; locBadgeColor='#c0392b'; locMsg=s.locDistance+' m away — not on-site'; locMsgColor='#c0392b'; }
    else if(locGpsError){ locBorder='#f0e2c2'; locCardBg='#fdf6e9'; locBadgeBg='#f7efdc'; locBadgeColor='#b9791a'; locMsg=s.locGpsMsg||'Location unavailable. Check permissions and try again.'; locMsgColor='#b9791a'; }
    else if(locLocating){ locBorder='#eef0f4'; locCardBg='#fff'; locBadgeBg='#eceef2'; locBadgeColor=accent; locMsg='Locating you via GPS...'; locMsgColor='#8a94a3'; }
    else { locBorder='#eef0f4'; locCardBg='#fff'; locBadgeBg='#eceef2'; locBadgeColor='#8a94a3'; locMsg='Tap to confirm you are at '+hqName+'.'; locMsgColor='#8a94a3'; }
    const activeBatch = s.batches[s.activeBatchIdx||0];
    const batchLabel = activeBatch?.label || '';
    const dekit = activeBatch?.dekit_date ? new Date(activeBatch.dekit_date+'T00:00:00') : null;
    const todayMid = new Date(); todayMid.setHours(0,0,0,0);
    const dekitDaysLeft = dekit ? Math.round((dekit - todayMid) / 86400000) : null;
    const dekitCountdown = dekitDaysLeft === null ? '' : dekitDaysLeft === 0 ? 'Return equipment today' : dekitDaysLeft > 0 ? `${dekitDaysLeft} day${dekitDaysLeft !== 1 ? 's' : ''} to dekit` : 'Cycle complete';
    const batchRange = activeBatch ? (Utils.fmtShort(new Date(activeBatch.start_date+'T00:00:00')) + ' – ' + Utils.fmtShort(new Date(activeBatch.end_date+'T00:00:00'))) : '';
    const waMsg = status==='present'
      ? `✅ [${rec.time}] ${me.name} checked in for ${Utils.shiftLabel(me.shift)}.`
      : status==='mc'
      ? `🤒 ${me.name} is on MC today (${Utils.shiftLabel(me.shift)}).`
      : '';
    const whatsappLink = waMsg ? 'https://api.whatsapp.com/send?text='+encodeURIComponent(waMsg) : '';
    const showWaShare = !!(status==='present'||status==='mc');
    const shiftStart={AM:'08:30',PM:'15:30',OFFICE:'09:00'}[me.shift]||'08:30';
    const isLate=rec.status==='present'&&rec.time&&rec.time!=='-'&&rec.time>shiftStart;
    return {
      todayLong:Utils.fmtLong(this.baseDate()),
      clock:s.testDate?'--:--':Utils.hhmm(s.now),
      myShiftLabel:Utils.shiftLabel(me.shift), myShiftWindow:Utils.shiftWindow(me.shift),
      myStatusLabel:noRep?'No reporting':m.label,
      myStatusColor:noRep?accent:m.color,
      myStatusPulse:(status==='pending'&&!noRep)?'animation:pulseDot 1.6s ease infinite;':'',
      phToday:noRep,
      phName:Utils.holidayName(this.dateForOffset(0))||'No CNB reporting today',
      needCheckin:status==='pending'&&!s.mcMode&&!noRep,
      mcMode:s.mcMode&&!noRep,
      isPresent:status==='present'&&!noRep,
      isMc:status==='mc'&&!noRep,
      checkInTime:rec.time||'-',
      checkInDist:rec.dist!=null?('about '+rec.dist+' m from '+hqName):'on-site',
      verifyLocation:this.verifyLocation, submitCheckIn:this.submitCheckIn,
      locLocating,
      locNeedsAction:locIdle||locOutOfRange||locGpsError,
      locShowLocateBtn:locIdle||locOutOfRange||locGpsError,
      locBtnLabel:locIdle?'Locate me':'Try again',
      locBorder,locCardBg,locBadgeBg,locBadgeColor,locMsg,locMsgColor,
      checkInOpacity:locVerified?'1':'.45',
      checkInPE:locVerified?'auto':'none',
      openMc:this.openMc, onMcFile:this.onMcFile, submitMc:this.submitMc, cancelMc:this.cancelMc,
      undoCheckin:this.requestUndo, confirmUndo:s.confirmUndo, showUndoBtn:!s.confirmUndo, showUndoConfirm:s.confirmUndo, doUndo:this.doUndo, cancelUndo:this.cancelUndo,
      mcFileLabel:s.mcFileName||rec.mc||'No file selected',
      batchLabel, dekitCountdown, batchRange, showBatchInfo: !!activeBatch,
      whatsappLink, showWaShare,
      isLate, lateShiftStart:shiftStart,
      isOffline:!s.isOnline, offlinePending:s.offlinePending,
      refreshPage:this.refreshPage,
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
      if(st==='work')  return cellBase+'background:#fff;border:1px solid #e3e6ec;color:#161f30;';
      if(st==='end')   return cellBase+'background:#fff;border:1.5px solid '+accent+';color:'+accent+';';
      if(st==='dekit') return cellBase+'background:#131a27;color:#fff;';
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
      else if(dk>beKey) dst='ph';
      else if(dk===beKey) dst=dk===todayKey?'today':'end';
      else if(isWknd) dst='off';
      else if(isHol||isNoRep) dst='ph';
      else if(dk===todayKey) dst='today';
      else dst='work';
      let style=cellStyle(dst)+'cursor:pointer;';
      if(s.selectedCalOffset===off) style+='outline:2px solid '+accent+';outline-offset:1px;';
      return {num:d.getDate(),style,off,st:dst,onClick:this.selectCalDay(off)};
    });
    const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dekitLabel='Dekit, '+WD[dd.getDay()]+' '+dd.getDate()+' '+MON[dd.getMonth()];
    const dekitSub='Last report: '+WD[be.getDay()]+' '+be.getDate()+' '+MON[be.getMonth()]+' · Account closes on dekit day';
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
    const today=Utils.dateKey(new Date()), todayD=new Date(today+'T00:00:00');
    const activeBatch=s.batches[s.activeBatchIdx||0];

    // Today row
    const todayRow=(status!=='pending'&&Utils.isReportDay(todayD)&&!this.isNoReport(0))
      ?[{date:Utils.fmtMed(todayD)+', Today',dateKey:today,shift:Utils.shiftLabel(me.shift),status,time:rec.time||'-',...Utils.meta(status)}]:[];

    // Past recorded rows
    const histKeys=new Set(s.history.map(r=>r.date));
    const histRows=s.history.map(r=>{
      const d=new Date(r.date+'T00:00:00');
      const t=r.check_in_time?r.check_in_time.slice(0,5):'-';
      return {date:Utils.fmtMed(d),dateKey:r.date,shift:Utils.shiftLabel(me.shift),status:r.status,time:t,...Utils.meta(r.status)};
    });

    // Missed shifts: reporting days in current batch before today with no record
    const missedRows=[];
    if(activeBatch){
      const bStart=new Date(activeBatch.start_date+'T00:00:00'), yesterday=Utils.addDays(todayD,-1);
      for(let d=new Date(bStart);d<=yesterday;d=Utils.addDays(d,1)){
        const dk=Utils.dateKey(d);
        if(Utils.isReportDay(d)&&!Utils.holidayName(d)&&!s.noReportDays.has(dk)&&!histKeys.has(dk)){
          missedRows.push({date:Utils.fmtMed(d),dateKey:dk,shift:Utils.shiftLabel(me.shift),status:'missed',time:'–',...Utils.meta('missed')});
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
        if(Utils.isReportDay(d)&&!Utils.holidayName(d)){cycleTotal++;if(d<=now)cycleDone++;}
      }
    }
    return {myHistory,statMyPresent,statMyMc,statMyMissed,statMyDays:statMyPresent+statMyMc,cycleDone,cycleTotal,cyclePct:cycleTotal?Math.round(cycleDone/cycleTotal*100):0,historyTruncated:s.history.length>=500};
  }

  _buildBriefings(s, accent){
    const ROLES={
      AM:{title:'AM Shift',window:'0830 – 1530  ·  Lunch 1200–1430',items:['MOPs for CNB testing must exit via the same route they entered.','MOPs must not loiter around the area.','Escort contractors around the building when required.','Assist with Red Teaming exercises if needed.']},
      PM:{title:'PM Shift',window:'1530 – 2230  ·  Dinner 1630–1830',items:['Same duties as AM shift.','May leave early if CNB confirms no more reporting.'],note:'Fridays: stay till 1800 only. May move to canteen after 1630. Update WhatsApp when leaving DHQ or if on MC.'},
      OFFICE:{title:'Office Hours',window:'0900 – 1800  ·  Lunch 1200–1400',items:['Escort contractors when required.','Assist with Red Teaming exercises if needed.']},
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
      briefAttire:'Civilian — pants and covered shoes',
      mealStatusBanner:'On hold — do not submit the form for now.',
      mealItems:[
        'When resumed: submit daily Mon–Fri, including MC days.',
        'Mark PRESENT if shift completed, MC if on sick leave.',
        'No submission on public holidays or no-reporting days.',
      ],
      dekitItems:[
        'Fill meal allowance forms and submit to the Manpower Officer, endorsed by Ops Branch supervisor.',
        'Bring hardcopies of any MCs taken.',
        'Update WhatsApp once all PNSMEN have arrived.',
      ],
      waGroupUrl, showWaGroup:!!waGroupUrl,
    };
  }

  _buildAdmin(s, accent){
    const batches=s.batches, activeBatchIdx=s.activeBatchIdx||0, activeBatch=batches[activeBatchIdx];
    const activeMembers=activeBatch?.is_live?s.personnel:(s.batchMembersCache?.[activeBatch?.id]||[]);
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
      return {label:b.label, range:Utils.fmtShort(bs)+' to '+Utils.fmtShort(be), onClick:this.setBatch(i), style:chipStyle, isPast};
    });
    const activeChips=allChips.filter(c=>!c.isPast);
    const archivedChips=allChips.filter(c=>c.isPast);
    const viewOffset=s.viewOffset||0, viewDate=this.dateForOffset(viewOffset), viewIsToday=viewOffset===0, viewReportDay=Utils.isReportDay(viewDate);
    const viewDateKey=Utils.dateKey(viewDate);
    const viewMap=viewIsToday?s.attendance:(s.attendanceCache?.[viewDateKey]||{});
    const roster=activeMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent',time:'-'}, mm=Utils.meta(r.status);
      const cardStyle='background:#fff;border:1px solid #e3e6ec;border-left:3px solid '+mm.color+';border-radius:12px;padding:11px 13px;';
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      return {id:p.id,name:p.name,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),shift:p.shift,time:r.time||'-',label:mm.label,color:mm.color,bg:mm.bg,geo:(r.status==='present'&&r.dist!=null)?(', GPS verified '+r.dist+' m'):'',markPresent:this.setStatus(p.id,'present'),markMc:this.setStatus(p.id,'mc'),markAbsent:this.setStatus(p.id,'absent'),onShiftChange:this.changeShift(p.id),cardStyle,avatarStyle};
    });
    const search=(s.rosterSearch||'').toLowerCase();
    const filteredRoster=roster.filter(r=>!search||r.name.toLowerCase().includes(search));
    const sortKey=s.rosterSort||'shift';
    const sortedFiltered=[...filteredRoster].sort((a,b)=>{
      if(sortKey==='name') return a.name.localeCompare(b.name);
      if(sortKey==='status'){const ord={present:0,mc:1,pending:2,absent:3};return (ord[a.label.toLowerCase()]??4)-(ord[b.label.toLowerCase()]??4);}
      const so={AM:0,PM:1,OFFICE:2};return (so[a.shift]??3)-(so[b.shift]??3);
    });
    const _sb='flex:1;padding:6px 4px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid ';
    const _sa=_sb+accent+';background:'+accent+';color:#fff;', _si=_sb+'#d4d9e2;background:#fff;color:#5c6678;';
    const rosterSortShiftStyle=sortKey==='shift'?_sa:_si;
    const rosterSortNameStyle=sortKey==='name'?_sa:_si;
    const rosterSortStatusStyle=sortKey==='status'?_sa:_si;
    const present=roster.filter(r=>r.label==='Present').length, mc=roster.filter(r=>r.label==='On MC').length, pending=roster.filter(r=>r.label==='Pending').length, total=roster.length;
    const snapshotLines=['📋 *'+Utils.fmtMed(this.dateForOffset(0))+' Attendance*','✅ Present ('+present+'): '+(roster.filter(r=>r.label==='Present').map(r=>r.name).join(', ')||'—'),'🤒 MC ('+mc+'): '+(roster.filter(r=>r.label==='On MC').map(r=>r.name).join(', ')||'—'),'⏳ Pending ('+pending+'): '+(roster.filter(r=>r.label==='Pending').map(r=>r.name).join(', ')||'—')];
    const snapshotLink='https://api.whatsapp.com/send?text='+encodeURIComponent(snapshotLines.join('\n'));
    const pendingCount=roster.filter(r=>r.label==='Pending').length;
    const shiftCutoff={AM:'08:30',PM:'15:30',OFFICE:'09:00'};
    const logRows=activeMembers.filter(p=>{
      const r=viewMap[p.id]||{status:'pending'};
      return r.status!=='pending';
    }).map(p=>{
      const r=viewMap[p.id]||{status:'pending',time:'-'}, mm=Utils.meta(r.status);
      const cutoff=shiftCutoff[p.shift||'AM'];
      const isLate=r.status==='present'&&r.time&&r.time!=='-'&&r.time>cutoff;
      const hasMc=r.status==='mc'&&!!r.mc;
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      return {id:p.id,name:p.name,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),label:mm.label,color:mm.color,bg:mm.bg,time:r.time||'-',isLate,timeColor:isLate?'#c0392b':'#8a94a3',lateTag:isLate?' (late)':'',mcCursor:hasMc?'pointer':'default',onViewMc:hasMc?this.openMcViewer(p.name,viewDateKey,r.mc):()=>{},avatarStyle};
    });
    const logDateLabel=viewIsToday?'TODAY\'S LOG':((WD[viewDate.getDay()]+' '+viewDate.getDate()+' '+MON[viewDate.getMonth()]).toUpperCase()+' — LOG');
    const dlabel=WD[viewDate.getDay()]+' '+viewDate.getDate()+' '+MON[viewDate.getMonth()];
    const rel=viewOffset===0?'Today':viewOffset===-1?'Yesterday':viewOffset===1?'Tomorrow':'';
    const viewDateLabel=(rel?rel+', ':'')+dlabel;
    const viewHoliday=Utils.holidayName(viewDate), viewBlocked=this.isNoReport(viewOffset);
    const viewShowReporting=viewReportDay&&!viewBlocked, viewNoReporting=!viewShowReporting;
    const viewDateSub=!viewReportDay?'Weekend, no reporting':viewHoliday?'Public holiday':viewBlocked?'No reporting, toggled off':viewOffset<0?'Past shift, recorded':viewOffset>0?'Scheduled':'Live now';
    const viewNoRepReason=!viewReportDay?'This is a weekend. Reservists do not report on Saturdays or Sundays.':viewHoliday?(viewHoliday+' is a public holiday, so reservists are not required to report.'):'This day is marked as a no-reporting day, so reservists are not required to report.';
    const showRepToggle=viewReportDay, repToggleLocked=!!viewHoliday, repToggleOn=viewBlocked;
    const noRepMsg=viewHoliday?('Public holiday ('+viewHoliday+'). Auto no-reporting, locked.'):repToggleOn?'On. Reservists are not required to report this day.':'Off. Reservists report and check in as normal.';
    const viewRoster=activeMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>0?'pending':'absent',time:'-'}, mm=Utils.meta(r.status);
      const hasMc=r.status==='mc'&&!!r.mc;
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      return {id:p.id,name:p.name,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),label:mm.label,color:mm.color,bg:mm.bg,timeText:(r.status==='present'&&r.time&&r.time!=='-')?r.time:'',mcCursor:hasMc?'pointer':'default',onViewMc:hasMc?this.openMcViewer(p.name,viewDateKey,r.mc):()=>{},avatarStyle};
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
    return {
      activeChips, archivedChips, archivedCount:archivedChips.length,
      showArchivedBatches:s.showArchivedBatches,
      toggleArchivedBatches:()=>this.setState(s=>({showArchivedBatches:!s.showArchivedBatches})),
      roster, filteredRoster:sortedFiltered, logRows, logDateLabel,
      rosterSearch:s.rosterSearch, onRosterSearch:this.onRosterSearch,
      markAllPresent:this.markAllPresent, pendingCount,
      statPresent:present, statMc:mc, statPending:pending, statTotal:total,
      noRepMsg, toggleNoReporting:this.toggleNoReporting,
      showRepToggle, repToggleLocked,
      noRepTrackBg:repToggleOn?accent:'#39435a',
      noRepKnobX:repToggleOn?'25px':'3px',
      repToggleOpacity:repToggleLocked?'0.55':'1',
      repTogglePE:repToggleLocked?'none':'auto',
      prevDay:this.prevDay, nextDay:this.nextDay, goToday:this.goToday,
      onDaySwipeStart:this.onDaySwipeStart, onDaySwipeEnd:this.onDaySwipeEnd,
      snapshotLink, showSnapshot:viewIsToday&&viewShowReporting,
      editingNoteText:s.editingNoteText, onNoteText:this.onNoteText, saveNote:this.saveNote, closeNote:this.closeNote,
      refreshPage:this.refreshPage,
      viewDateLabel, viewDateSub, viewIsToday, viewNotToday:!viewIsToday,
      viewShowReporting, viewNoReporting, viewNoRepReason,
      viewRoster, vPresent, vMc, vThirdVal, vThirdLabel, vThirdColor, vTotal,
      vPresentLabel:'Checked in',
      viewListHeader, viewPercentText, viewPercentColor,
      intakeLabel, intakeRange,
      personnelList:activeMembers.map(p=>{const av=s.avatars[p.id]||'';return{...p,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),onEditNote:this.openNote(p.id,p.notes||''),isEditingNote:s.editingNoteId===p.id,onAskDeactivate:this.askDeactivatePerson(p.id),isConfirmingDeactivate:s.confirmDeactivateId===p.id,statPresent:s.peopleStats[p.id]?.present??'-',statMc:s.peopleStats[p.id]?.mc??'-',statPct:s.peopleStats[p.id]?.pct!=null?(s.peopleStats[p.id].pct+'%'):'-',showStats:s.peopleStatsLoaded,avatarStyle:av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'',avatarInitials:av?'':Utils.initials(p.name)};}),
      cancelDeactivatePerson:this.cancelDeactivatePerson,
      confirmDeactivatePerson:this.confirmDeactivatePerson,
      rosterSort:s.rosterSort,
      setRosterSortShift:this.setRosterSort('shift'),
      setRosterSortName:this.setRosterSort('name'),
      setRosterSortStatus:this.setRosterSort('status'),
      rosterSortShiftStyle,rosterSortNameStyle,rosterSortStatusStyle,
      newBatchDate:s.newBatchDate,onNewBatchDate:this.onNewBatchDate,createBatch:this.createBatch,batchCreating:s.batchCreating,
      npName:s.npName, npContact:s.npContact, npShift:s.npShift,
      onNpName:this.onNpName, onNpContact:this.onNpContact, onNpRank:()=>{}, onNpShift:this.onNpShift, addPerson:this.addPerson,
      batchLoading:s.batchLoading,
      exportCsv:this.exportCsv,
      mcViewOpen:s.mcViewOpen, mcViewName:s.mcViewName, mcViewDate:s.mcViewDate,
      mcViewFile:s.mcViewFile, mcViewUrl:s.mcViewUrl, mcViewNoUrl:!s.mcViewUrl,
      closeMcViewer:this.closeMcViewer,
      testDate:s.testDate, testDateInput:s.testDateInput,
      onTestDateInput:this.onTestDateInput, setTestDate:this.setTestDate, clearTestDate:this.clearTestDate,
      hasTestDate:!!s.testDate,
      batchJumpDate:s.batchJumpDate, onBatchJumpDate:this.onBatchJumpDate, jumpToDate:this.jumpToDate,
    };
  }

  _buildAccount(s, accent){
    const me=this.cur(); if(!me) return {};
    const avatarUrl=s.avatars[s.currentUserId]||'';
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
      showToast:!!s.toast, toastMsg:s.toast?.msg||'', toastBg:s.toast?.type==='error'?'#c0392b':'#1f8a5b',
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
