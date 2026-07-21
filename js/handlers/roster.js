// ── Roster, log, and attendance handlers ──────────────────────────────────
const RosterHandlers = {

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
    if(!pending.length){ this.setState({markAllPresenting:false}); return; }
    const p1=Utils.hhmm(new Date());
    const updates={};
    let failed=0;
    await Promise.all(pending.map(async p=>{
      updates[p.id]={status:'present',p1};
      if(!this.state.demo){
        const {error}=await DB.attendance.upsert(p.id,viewDateKey,'present',{time:p1}).catch(e=>({error:e}));
        if(error) failed++;
      }
    }));
    if(viewIsToday){
      this.setState(s=>({attendance:{...s.attendance,...updates},markAllPresenting:false}));
    } else {
      this.setState(s=>({attendanceCache:{...s.attendanceCache,[viewDateKey]:{...(s.attendanceCache?.[viewDateKey]||{}),...updates}},markAllPresenting:false}));
    }
    if(failed) this._toast(failed+' save'+(failed>1?'s':'')+' failed. Check your connection.','error');
    else this._toast(pending.length+' member'+(pending.length>1?'s':'')+' marked present.');
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

  prevDay: function() { this._navToOffset(this.state.viewOffset-1); },
  nextDay: function() { this._navToOffset(this.state.viewOffset+1); },
  goToday: function() { this._navToOffset(0); },

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

  onDaySwipeStart: function(e) { this._touchStartX = e.touches[0].clientX; },
  onDaySwipeEnd: function(e) {
    if(this._touchStartX===null) return;
    const dx=e.changedTouches[0].clientX-this._touchStartX;
    this._touchStartX=null;
    if(Math.abs(dx)<40) return;
    if(dx<0) this.nextDay(); else this.prevDay();
  },

  onRosterSearch:   function(e) { this.setState({rosterSearch:e.target.value}); },
  onRosterSearchKeyDown: function(e) { if(e.key==='Enter') e.target.blur(); },
  clearRosterSearch: function() { this.setState({rosterSearch:''}); },

  setRosterSort:    function(key) { return () => this.setState({rosterSort:key}); },
  setLogShiftFilter: function(f) { return () => this.setState({logShiftFilter:f}); },

  onLogSearch:   function(e) { this.setState({logSearch:e.target.value}); },
  onLogSearchKeyDown: function(e) { if(e.key==='Enter') e.target.blur(); },
  clearLogSearch: function() { this.setState({logSearch:''}); },

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

  openTimesEdit: function(id) {
    return () => {
      const s = this.state;
      const base = this.baseDate();
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (s.viewOffset || 0));
      const dateKey = Utils.dateKey(d);
      const rec = (s.attendanceCache[dateKey] || s.attendance)[id] || {};
      this.setState({ timesEditId: id, timesEditP1: rec.p1||'', timesEditP2: rec.p2||'', timesEditP3: rec.p3||'', timesEditP4: rec.p4||'' });
    };
  },

  closeTimesEdit: function() {
    this.setState({ timesEditId: null, timesEditP1: '', timesEditP2: '', timesEditP3: '', timesEditP4: '', timesEditErrField: null });
  },

  _fmtTimeInput: function(raw) {
    const digits = raw.replace(/\D/g,'').slice(0,4);
    if(digits.length<=2) return digits;
    return digits.slice(0,2)+':'+digits.slice(2);
  },
  onTimesP1: function(e) { this.setState({ timesEditP1: this._fmtTimeInput(e.target.value), timesEditErrField: null }); },
  onTimesP2: function(e) { this.setState({ timesEditP2: this._fmtTimeInput(e.target.value), timesEditErrField: null }); },
  onTimesP3: function(e) { this.setState({ timesEditP3: this._fmtTimeInput(e.target.value), timesEditErrField: null }); },
  onTimesP4: function(e) { this.setState({ timesEditP4: this._fmtTimeInput(e.target.value), timesEditErrField: null }); },

  saveTimesEdit: async function() {
    const { timesEditId, timesEditP1, timesEditP2, timesEditP3, timesEditP4, viewOffset, demo } = this.state;
    if (!timesEditId) return;
    const validTime = t => !t || /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    const _toMins = t => { if(!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
    const _editPerson = (this.state.roster||[]).find(p=>p.id===timesEditId);
    const _isPM = _editPerson?.shift==='PM';
    const _p2Label = _isPM ? 'Dinner out' : 'Lunch out';
    const _p3Label = _isPM ? 'Return from dinner' : 'Return from lunch';
    if (!timesEditP1) { this.setState({timesEditErrField:'p1'}); this._toast('Check-in time is required.', 'error'); return; }
    for (const [key,val] of [['p1',timesEditP1],['p2',timesEditP2],['p3',timesEditP3],['p4',timesEditP4]]) {
      if (val && !validTime(val)) { this.setState({timesEditErrField:key}); this._toast('Times must be in HH:MM format (24h).','error'); return; }
    }
    if (timesEditP3 && !timesEditP2) { this.setState({timesEditErrField:'p2'}); this._toast(`${_isPM?'Dinner':'Lunch'} out time is required when recording a return.`,'error'); return; }
    const _slots = [{t:timesEditP1,label:'Check-in',key:'p1'},{t:timesEditP2||null,label:_p2Label,key:'p2'},{t:timesEditP3||null,label:_p3Label,key:'p3'},{t:timesEditP4||null,label:'Check-out',key:'p4'}];
    let _prevMins=null, _prevLabel='';
    for(const sl of _slots){
      const m=_toMins(sl.t);
      if(m===null) continue;
      if(_prevMins!==null && m<=_prevMins){ this.setState({timesEditErrField:sl.key}); this._toast(`${sl.label} must be after ${_prevLabel}.`,'error'); return; }
      _prevMins=m; _prevLabel=sl.label;
    }
    const base = this.baseDate();
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (viewOffset || 0));
    const dateKey = Utils.dateKey(d);
    this.setState({ timesEditSaving: true });
    let savedEditLog = [];
    if (!demo) {
      const { error, editLog } = await DB.attendance.setTimes(timesEditId, dateKey, { p1: timesEditP1, p2: timesEditP2||null, p3: timesEditP3||null, p4: timesEditP4||null }, this.cur()?.name || 'Admin');
      if (error) { this.setState({ timesEditSaving: false }); this._toast('Failed to save. Try again.', 'error'); return; }
      savedEditLog = editLog || [];
    }
    const prevEntry = (this.state.attendanceCache[dateKey] || this.state.attendance)[timesEditId] || {};
    const entry = { ...prevEntry, status: 'present', p1: timesEditP1||null, p2: timesEditP2||null, p3: timesEditP3||null, p4: timesEditP4||null, gpsBypassed: true, editLog: savedEditLog };
    if (viewOffset === 0) {
      this.setState(s => ({ attendance: { ...s.attendance, [timesEditId]: entry }, timesEditId: null, timesEditSaving: false, timesEditP1: '', timesEditP2: '', timesEditP3: '', timesEditP4: '' }));
    } else {
      this.setState(s => ({ attendanceCache: { ...s.attendanceCache, [dateKey]: { ...(s.attendanceCache[dateKey]||{}), [timesEditId]: entry } }, timesEditId: null, timesEditSaving: false, timesEditP1: '', timesEditP2: '', timesEditP3: '', timesEditP4: '' }));
    }
    this._toast('Times updated.');
  },

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

};
