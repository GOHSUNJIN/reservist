// ── Roster, log, and attendance handlers ──────────────────────────────────
const RosterHandlers = {

  toggleRosterCard: function(id) {
    return () => this.setState(s => ({rosterExpandedId: s.rosterExpandedId === id ? null : id}));
  },

  // Helpers: read/write attendance from today's map or the date cache
  // Returns the attendance map for the viewed date: today's live map or the date cache.
  _viewAttMap: function(off, dk) {
    return off===0 ? this.state.attendance : (this.state.attendanceCache?.[dk]||{});
  },
  // Writes an attendance entry to today's map or the date cache depending on the offset.
  _setViewEntry: function(id, entry, off, dk) {
    if(off===0) this.setState(s=>({attendance:{...s.attendance,[id]:entry}}));
    else this.setState(s=>({attendanceCache:{...s.attendanceCache,[dk]:{...(s.attendanceCache?.[dk]||{}),[id]:entry}}}));
  },
  // Removes an attendance entry from today's map or the date cache depending on the offset.
  _delViewEntry: function(id, off, dk) {
    if(off===0) this.setState(s=>{const a={...s.attendance};delete a[id];return{attendance:a};});
    else this.setState(s=>{const c={...(s.attendanceCache?.[dk]||{})};delete c[id];return{attendanceCache:{...s.attendanceCache,[dk]:c}};});
  },

  setStatus: function(id, status) {
    return async () => {
      const off=this.state.viewOffset||0;
      if(off > 0) return;
      if(!this._statusSubmitting) this._statusSubmitting = new Set();
      if(this._statusSubmitting.has(id)) return;
      this._statusSubmitting.add(id);
      const dk=Utils.dateKey(this.dateForOffset(off));
      const prev=this._viewAttMap(off,dk)[id]||{};
      const p1=status==='present'?(prev.p1||Utils.hhmm(new Date())):prev.p1;
      const entry={...prev,status,p1};
      this._setViewEntry(id,entry,off,dk);
      if(!this.state.demo){
        if(!this.state.isOnline){
            this._queuePush({type:'status',id,date:dk,status,extras:status==='present'&&p1?{time:p1,dist:prev.p1dist}:{}});
          this._haptic(40);
          this._toast({present:'Marked present (queued)',mc:'Marked MC (queued)',absent:'Marked absent (queued)'}[status]||'Queued');
          return;
        }
        const {error}=await DB.attendance.upsert(id,dk,status,status==='present'&&p1?{time:p1,dist:prev.p1dist}:{});
        if(error){
          if(prev.status) this._setViewEntry(id,{...prev},off,dk); else this._delViewEntry(id,off,dk);
          this._statusSubmitting.delete(id);
          this._toast('Failed to update. Try again.','error');
          return;
        }
        if(prev.status==='mc'&&status!=='mc') DB.leaves.voidApprovedForDate(id,dk).catch(()=>{});
      }
      this._statusSubmitting.delete(id);
      this._haptic(40);
      this._toast({present:'Marked present',mc:'Marked MC',absent:'Marked absent'}[status]||'Updated');
    };
  },

  askMarkAllAbsent:    function() { this.setState({confirmMarkAllAbsent:true}); },
  cancelMarkAllAbsent: function() { this.setState({confirmMarkAllAbsent:false}); },

  markAllAbsent: async function() {
    const {batches,activeBatchIdx,viewOffset,demo}=this.state;
    const off=viewOffset||0;
    if(off > 0){this.setState({confirmMarkAllAbsent:false});return;}
    this.setState({confirmMarkAllAbsent:false, markingAllAbsent:true});
    const activeBatch=batches[activeBatchIdx||0];
    if(!activeBatch){this.setState({markingAllAbsent:false});return;}
    const dk=Utils.dateKey(this.dateForOffset(off)), viewMap=this._viewAttMap(off,dk);
    const pending=this._batchReservists(activeBatch).filter(p=>{const r=viewMap[p.id]||{};return !r.status||r.status==='pending';});
    if(!pending.length){this.setState({markingAllAbsent:false});this._toast('No pending members.');return;}
    if(off===0) this.setState(s=>{const att={...s.attendance};for(const p of pending)att[p.id]={...(att[p.id]||{}),status:'absent'};return{attendance:att};});
    else this.setState(s=>{const c={...(s.attendanceCache?.[dk]||{})};for(const p of pending)c[p.id]={...(c[p.id]||{}),status:'absent'};return{attendanceCache:{...s.attendanceCache,[dk]:c}};});
    if(!demo){
      const results=await Promise.all(pending.map(p=>DB.attendance.upsert(p.id,dk,'absent',{}).catch(e=>({error:e}))));
      const failed=results.filter(r=>r?.error).length;
      if(failed){this.setState({markingAllAbsent:false});this._toast(failed+' save'+(failed>1?'s':'')+' failed. Check your connection.','error');return;}
    }
    this.setState({markingAllAbsent:false});
    this._toast(pending.length+' member'+(pending.length>1?'s':'')+' marked absent.');
  },

  askMarkAllPresent:    function() { this.setState({confirmMarkAllPresent:true}); },
  cancelMarkAllPresent: function() { this.setState({confirmMarkAllPresent:false}); },

  markAllPresent: async function() {
    if(this.state.markAllPresenting) return;
    const off=this.state.viewOffset||0;
    if(off > 0){this.setState({confirmMarkAllPresent:false});return;}
    this.setState({confirmMarkAllPresent:false, markAllPresenting:true});
    const dk=Utils.dateKey(this.dateForOffset(off)), viewMap=this._viewAttMap(off,dk);
    const activeBatch=this.state.batches[this.state.activeBatchIdx||0];
    const pending=this._batchReservists(activeBatch).filter(p=>{const st=viewMap[p.id]?.status;return !st||st==='pending';});
    if(!pending.length){this.setState({markAllPresenting:false});return;}
    const p1=Utils.hhmm(new Date()), updates={};
    let failed=0;
    await Promise.all(pending.map(async p=>{
      updates[p.id]={status:'present',p1};
      if(!this.state.demo){
        const {error}=await DB.attendance.upsert(p.id,dk,'present',{time:p1}).catch(e=>({error:e}));
        if(error) failed++;
      }
    }));
    if(off===0) this.setState(s=>({attendance:{...s.attendance,...updates},markAllPresenting:false}));
    else this.setState(s=>({attendanceCache:{...s.attendanceCache,[dk]:{...(s.attendanceCache?.[dk]||{}),...updates}},markAllPresenting:false}));
    if(failed) this._toast(failed+' save'+(failed>1?'s':'')+' failed. Check your connection.','error');
    else this._toast(pending.length+' member'+(pending.length>1?'s':'')+' marked present.');
  },

  prevDay: function() { this._navToOffset(this.state.viewOffset-1); },
  nextDay: function() { this._navToOffset(this.state.viewOffset+1); },
  goToday: function() { this._navToOffset(0); },

  // Navigates to a day offset, switching active batch if the target date falls in a different batch.
  _navToOffset: async function(off) {
    const date=Utils.dateKey(this.dateForOffset(off)), {batches}=this.state, curIdx=this.state.activeBatchIdx||0;
    let ni=batches.findIndex((b,i)=>i!==curIdx&&date>=b.start_date&&date<=b.end_date);
    if(ni<0) ni=batches.findIndex((b,i)=>i===curIdx&&date>=b.start_date&&date<=b.end_date);
    if(ni<0) ni=batches.findIndex((b,i)=>i!==curIdx&&date>=b.start_date&&date<=(b.dekit_date||b.end_date));
    if(ni<0) ni=batches.findIndex((b,i)=>i===curIdx&&date>=b.start_date&&date<=(b.dekit_date||b.end_date));
    if(ni<0){
      let bestDate='',bestIdx=-1;
      batches.forEach((b,i)=>{const bd=b.dekit_date||b.end_date;if(bd<date&&bd>bestDate){bestDate=bd;bestIdx=i;}});
      ni=bestIdx;
    }
    if(ni>=0&&ni!==curIdx){
      const b=batches[ni];
      this.setState({batchLoading:true});
      let members=this.state.batchMembersCache[b.id];
      if(!members&&!b.is_live){members=await DB.personnel.list(b.id,false,this._myDept()).catch(()=>[]);this.setState(s=>({batchMembersCache:{...s.batchMembersCache,[b.id]:members}}));}
      const cachedNrd=this.state.noReportDaysCache[b.id];
      const [nrd,attMap]=await Promise.all([
        cachedNrd?Promise.resolve(cachedNrd):DB.noReportDays.list(b.start_date,b.dekit_date||b.end_date).catch(()=>new Set()),
        b.is_live?Promise.resolve({}):DB.attendance.getForBatch(b.start_date,b.end_date).catch(()=>({})),
      ]);
      this.setState(s=>({activeBatchIdx:ni,viewOffset:off,selectedCalOffset:null,attendanceCache:b.is_live?{}:{...s.attendanceCache,...attMap},noReportDays:nrd,noReportDaysCache:cachedNrd?s.noReportDaysCache:{...s.noReportDaysCache,[b.id]:nrd},batchLoading:false,rosterSearch:'',logSearch:'',confirmMarkAllAbsent:false}));
      return;
    }
    this.setState({viewOffset:off, logSearch:'', confirmMarkAllAbsent:false});
    if(off===0 && !this.state.demo && this.state.isOnline){
      const _today=Utils.dateKey(this.dateForOffset(0));
      DB.attendance.getForDate(_today).then(att=>{if(this.state.viewOffset===0)this.setState({attendance:att});}).catch(()=>{});
    }
    this._loadDateAttendance(off);
  },

  onDaySwipeStart:  function(e) { this._touchStartX=e.touches[0].clientX; },
  onDaySwipeCancel: function()  { this._touchStartX=null; },
  onDaySwipeEnd: function(e) {
    if(this._touchStartX===null) return;
    const dx=e.changedTouches[0].clientX-this._touchStartX;
    this._touchStartX=null;
    if(Math.abs(dx)<40) return;
    const now=Date.now();
    if(this._lastSwipeAt&&now-this._lastSwipeAt<400) return;
    this._lastSwipeAt=now;
    if(dx<0) this.nextDay(); else this.prevDay();
  },

  onRosterSearch:      function(e) { this.setState({rosterSearch:e.target.value}); },
  onRosterSearchKeyDown: function(e) { if(e.key==='Enter') e.target.blur(); },
  clearRosterSearch:   function() { this.setState({rosterSearch:''}); },
  setRosterSort:       function(key) { return () => this.setState({rosterSort:key}); },
  setRosterStatusFilter: function(f) { return () => this.setState({rosterStatusFilter:f}); },
  setLogStatusFilter:  function(f) { return () => this.setState({logStatusFilter:f}); },
  onLogSearch:         function(e) { this.setState({logSearch:e.target.value}); },
  onLogSearchKeyDown:  function(e) { if(e.key==='Enter') e.target.blur(); },
  clearLogSearch:      function() { this.setState({logSearch:''}); },

  openNote:  function(id, text) { return () => this.setState({editingNoteId:id, editingNoteText:text||''}); },
  onNoteText: function(e) { this.setState({editingNoteText:e.target.value}); },
  closeNote:  function() { this.setState({editingNoteId:null, editingNoteText:''}); },

  saveNote: async function() {
    const {editingNoteId, editingNoteText, demo}=this.state;
    if(!editingNoteId) return;
    if(!demo) await DB.personnel.updateNote(editingNoteId, editingNoteText).catch(()=>{});
    this.setState(s=>({personnel:s.personnel.map(p=>p.id===editingNoteId?{...p,notes:editingNoteText}:p),editingNoteId:null,editingNoteText:''}));
    this._toast('Note saved.');
  },

  openTimesEdit: function(id) {
    return () => {
      const s=this.state;
      const d=new Date(this.baseDate()); d.setDate(d.getDate()+(s.viewOffset||0));
      const dateKey=Utils.dateKey(d), rec=(s.attendanceCache[dateKey]||s.attendance)[id]||{};
      this.setState({timesEditId:id,timesEditP1:rec.p1||'',timesEditP2:rec.p2||'',timesEditP3:rec.p3||'',timesEditP4:rec.p4||''});
    };
  },

  closeTimesEdit: function() {
    this.setState({timesEditId:null,timesEditP1:'',timesEditP2:'',timesEditP3:'',timesEditP4:'',timesEditErrField:null});
  },

  _fmtTimeInput: function(raw) {
    const digits=raw.replace(/\D/g,'').slice(0,4);
    return digits.length<=2 ? digits : digits.slice(0,2)+':'+digits.slice(2);
  },
  onTimesP1: function(e) { this.setState({timesEditP1:this._fmtTimeInput(e.target.value),timesEditErrField:null}); },
  onTimesP2: function(e) { this.setState({timesEditP2:this._fmtTimeInput(e.target.value),timesEditErrField:null}); },
  onTimesP3: function(e) { this.setState({timesEditP3:this._fmtTimeInput(e.target.value),timesEditErrField:null}); },
  onTimesP4: function(e) { this.setState({timesEditP4:this._fmtTimeInput(e.target.value),timesEditErrField:null}); },

  saveTimesEdit: async function() {
    const {timesEditId,timesEditP1,timesEditP2,timesEditP3,timesEditP4,viewOffset,demo}=this.state;
    if(!timesEditId) return;
    const validTime=t=>!t||/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    const toMins=t=>{if(!t)return null;const[h,m]=t.split(':').map(Number);return h*60+m;};
    if(!timesEditP1){this.setState({timesEditErrField:'p1'});this._toast('Check-in time is required.','error');return;}
    for(const [key,val] of [['p1',timesEditP1],['p2',timesEditP2],['p3',timesEditP3],['p4',timesEditP4]]){
      if(val&&!validTime(val)){this.setState({timesEditErrField:key});this._toast('Times must be in HH:MM format (24h).','error');return;}
    }
    if(timesEditP3&&!timesEditP2){this.setState({timesEditErrField:'p2'});this._toast('Lunch out time is required when recording a return.','error');return;}
    if(timesEditP4&&!timesEditP3){this.setState({timesEditErrField:'p3'});this._toast('Return from lunch time is required when recording checkout.','error');return;}
    if(timesEditP4&&!timesEditP2){this.setState({timesEditErrField:'p2'});this._toast('Lunch out time is required when recording checkout.','error');return;}
    const slots=[{t:timesEditP1,label:'Check-in',key:'p1'},{t:timesEditP2||null,label:'Lunch out',key:'p2'},{t:timesEditP3||null,label:'Return from lunch',key:'p3'},{t:timesEditP4||null,label:'Check-out',key:'p4'}];
    let prevMins=null, prevLabel='';
    for(const sl of slots){
      const m=toMins(sl.t);if(m===null)continue;
      if(prevMins!==null&&m<=prevMins){this.setState({timesEditErrField:sl.key});this._toast(`${sl.label} must be after ${prevLabel}.`,'error');return;}
      prevMins=m;prevLabel=sl.label;
    }
    const d=new Date(this.baseDate()); d.setDate(d.getDate()+(viewOffset||0));
    const dateKey=Utils.dateKey(d);
    this.setState({timesEditSaving:true});
    let savedEditLog=[];
    if(!demo){
      const {error,editLog}=await DB.attendance.setTimes(timesEditId,dateKey,{p1:timesEditP1,p2:timesEditP2||null,p3:timesEditP3||null,p4:timesEditP4||null},this.cur()?.name||'Admin');
      if(error){this.setState({timesEditSaving:false});this._toast('Failed to save. Try again.','error');return;}
      savedEditLog=editLog||[];
    }
    const prevEntry=(this.state.attendanceCache[dateKey]||this.state.attendance)[timesEditId]||{};
    const entry={...prevEntry,status:'present',p1:timesEditP1||null,p2:timesEditP2||null,p3:timesEditP3||null,p4:timesEditP4||null,gpsBypassed:true,editLog:savedEditLog};
    const clearEdit={timesEditId:null,timesEditSaving:false,timesEditP1:'',timesEditP2:'',timesEditP3:'',timesEditP4:''};
    if(viewOffset===0) this.setState(s=>({attendance:{...s.attendance,[timesEditId]:entry},...clearEdit}));
    else this.setState(s=>({attendanceCache:{...s.attendanceCache,[dateKey]:{...(s.attendanceCache[dateKey]||{}),[timesEditId]:entry}},...clearEdit}));
    this._toast('Times updated.');
  },

  // Subscribes to Supabase realtime updates for attendance on the given date.
  _subscribeRealtime: function(dateStr) {
    if(this.state.demo) return;
    const ch=DB.realtime.subscribeAttendance(dateStr, row=>{
      this.setState(s=>{
        if(!s.personnel.some(p=>p.id===row.personnel_id)) return null;
        const existing=s.attendance[row.personnel_id]||{}, incoming=DB.attendance._toEntry(row), merged={};
        for(const k of Object.keys(incoming)) merged[k]=incoming[k]??existing[k];
        return {attendance:{...s.attendance,[row.personnel_id]:merged}};
      });
    });
    this.setState({realtimeChannel:ch});
  },

  loadRosterAvatars: async function() {
    const {batches,activeBatchIdx,demo,batchMembersCache,personnel}=this.state;
    if(demo) return;
    const batch=batches[activeBatchIdx||0];
    const batchMembers=batch?.is_live?personnel:(batchMembersCache[batch?.id]||[]);
    const memberSet=new Set(batchMembers.map(p=>p.id));
    const members=[...batchMembers,...(personnel||[]).filter(p=>!memberSet.has(p.id))];
    const ids=members.map(p=>p.id).filter(id=>!this.state.avatars[id]);
    if(!ids.length) return;
    const existing=await DB.storage.listAvatarIds().catch(()=>new Set());
    if(!existing.size) return;
    const withAvatar=ids.filter(id=>existing.has(id));
    if(!withAvatar.length) return;
    const urls=DB.storage.getAvatarUrls(withAvatar);
    this.setState(s=>({avatars:{...s.avatars,...urls}}));
  },

};
