// ── Signup and leave request handlers ────────────────────────────────────
const RequestHandlers = {

  // ── Signup requests ───────────────────────────────────────────────────
  loadPendingSignups: async function() {
    const data = await DB.signupRequests.listPending().catch(()=>[]);
    this.setState({pendingSignups:data, pendingSignupsLoaded:true});
  },

  loadApprovedSignups: async function() {
    const data = await DB.signupRequests.listApproved().catch(()=>[]);
    this.setState({approvedSignups:data});
  },

  loadRejectedSignups: async function() {
    const data = await DB.signupRequests.listRejected().catch(()=>[]);
    this.setState({rejectedSignups:data, rejectedSignupsLoaded:true});
  },

  reopenSignup: function(id) {
    return async () => {
      const req = this.state.rejectedSignups.find(r=>r.id===id);
      if(!req) return;
      const {error} = await DB.signupRequests.reopen(id).catch(()=>({error:true}));
      if(error){ this._toast('Failed to re-open. Try again.','error'); return; }
      this.setState(s=>({
        rejectedSignups: s.rejectedSignups.filter(r=>r.id!==id),
        pendingSignups: [{...req, status:'pending', reviewed_by:null, reviewed_at:null}, ...s.pendingSignups],
      }));
      this._toast(req.name+"'s signup re-opened.");
    };
  },

  approveSignup: function(id) {
    return async () => {
      const req = this.state.pendingSignups.find(r=>r.id===id);
      if(!req) return;
      const me = this.cur();
      const reviewerName = me?.name || null;
      const {data:approvedRow, error:approveErr} = await DB.signupRequests.approve(id, reviewerName);
      if(approveErr){ this._toast('Failed to approve. Try again.','error'); return; }
      if(!approvedRow){ this.setState(s=>({pendingSignups:s.pendingSignups.filter(r=>r.id!==id)})); this._toast('Already approved by another admin.','error'); return; }
      // If admin pre-added this person, link auth to existing record; otherwise create new
      const existing = await DB.personnel.findByContact(req.contact).catch(()=>null);
      let finalPerson = existing;
      const wasInactive = existing && !existing.is_active;
      if(existing){
        if(!existing.is_active){
          // Returning reservist: reactivate and assign to the requested batch
          const {data:reactivated} = await DB.personnel.reactivate(existing.id, {batchId:req.batch_id, shift:req.shift, authId:req.auth_id});
          finalPerson = reactivated || existing;
        } else {
          await DB.personnel.linkAuth(existing.id, req.auth_id);
        }
      } else {
        const {data:newPerson, error:addErr} = await DB.personnel.add({authId:req.auth_id, name:req.name, contact:req.contact, shift:req.shift, batchId:req.batch_id});
        if(addErr){ this._toast('Approved but failed to create personnel record. Try again.','error'); return; }
        finalPerson = newPerson;
      }
      const freshPersonnel = await DB.personnel.list().catch(()=>null);
      this.setState(s=>({
        pendingSignups:s.pendingSignups.filter(r=>r.id!==id),
        approvedSignups:[{...req,status:'approved',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()},...s.approvedSignups],
        ...(freshPersonnel ? {personnel:freshPersonnel} : finalPerson&&(!existing||wasInactive) ? {personnel:[...s.personnel,finalPerson]} : {}),
      }));
      this._toast(req.name+' approved and added to the roster.');
    };
  },

  cancelLeaveRequest: function(id) {
    return async () => {
      const {demo} = this.state;
      if(!demo && id && id !== 'demo') {
        const {error} = await DB.leaves.cancel(id).catch(()=>({error:true}));
        if(error){ this._toast('Failed to cancel. Try again.','error'); return; }
      }
      this.setState(s=>({
        myPendingRequest: s.myPendingRequest?.id===id ? null : s.myPendingRequest,
        myLeaveHistory: s.myLeaveHistory.map(r=>r.id===id?{...r,status:'cancelled'}:r),
      }));
      this._toast('Request cancelled.');
    };
  },

  rejectSignup: function(id) {
    return async () => {
      const req = this.state.pendingSignups.find(r=>r.id===id);
      if(!req) return;
      const me = this.cur();
      const {error} = await DB.signupRequests.reject(id, me?.name||null);
      if(error){ this._toast('Failed to reject. Try again.','error'); return; }
      // Keep the auth account so the person can re-submit or be re-opened without orphaned records.
      // The auth account is unlinked from any personnel record, so it is harmless to leave in place.
      this.setState(s=>({pendingSignups:s.pendingSignups.filter(r=>r.id!==id), selectedSignupIds:s.selectedSignupIds.filter(x=>x!==id)}));
      this._toast(req.name+"'s signup was rejected.");
    };
  },

  toggleSignupSelect: function(id) {
    return () => this.setState(s => {
      const ids = s.selectedSignupIds;
      return { selectedSignupIds: ids.includes(id) ? ids.filter(x=>x!==id) : [...ids, id] };
    });
  },

  approveSelected: async function() {
    const { selectedSignupIds, pendingSignups, demo } = this.state;
    if(!selectedSignupIds.length) return;
    const me = this.cur();
    const reviewerName = me?.name || null;
    const toApprove = pendingSignups.filter(r => selectedSignupIds.includes(r.id));
    let count = 0;
    for(const req of toApprove) {
      if(demo) {
        this.setState(s=>({
          pendingSignups:s.pendingSignups.filter(r=>r.id!==req.id),
          approvedSignups:[{...req,status:'approved',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()},...s.approvedSignups],
        }));
        count++;
        continue;
      }
      const {error:approveErr} = await DB.signupRequests.approve(req.id, reviewerName);
      if(approveErr) continue;
      const existing = await DB.personnel.findByContact(req.contact).catch(()=>null);
      const wasInactive = existing && !existing.is_active;
      let finalPerson = existing;
      if(existing) {
        if(!existing.is_active) {
          const {data:reactivated} = await DB.personnel.reactivate(existing.id, {batchId:req.batch_id, shift:req.shift, authId:req.auth_id});
          finalPerson = reactivated || existing;
        } else {
          await DB.personnel.linkAuth(existing.id, req.auth_id);
        }
      } else {
        const {data:newPerson, error:addErr} = await DB.personnel.add({authId:req.auth_id, name:req.name, contact:req.contact, shift:req.shift, batchId:req.batch_id});
        if(addErr){ this._toast(req.name+' approved but roster entry failed. Check and re-approve.','error'); continue; }
        finalPerson = newPerson;
      }
      this.setState(s=>({
        pendingSignups:s.pendingSignups.filter(r=>r.id!==req.id),
        approvedSignups:[{...req,status:'approved',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()},...s.approvedSignups],
        ...(finalPerson&&(!existing||wasInactive) ? {personnel:[...s.personnel,finalPerson]} : {}),
      }));
      count++;
    }
    const freshPersonnel = await DB.personnel.list().catch(()=>null);
    this.setState(s=>({selectedSignupIds:[], ...(freshPersonnel?{personnel:freshPersonnel}:{})}));
    if(count) this._toast(count+' signup'+(count>1?'s':'')+' approved.');
  },

  // ── Leave requests ─────────────────────────────────────────────────────
  loadPendingLeaves: async function() {
    const {demo}=this.state;
    if(demo) return;
    const liveBatch = this._liveBatch(this.state.batches);
    if(liveBatch?.start_date) {
      await DB.leaves.cancelStalePending(liveBatch.start_date).catch(()=>{});
    }
    const data=await DB.leaves.listPending().catch(()=>[]);
    this.setState({pendingLeaves:data,pendingLeavesLoaded:true});
  },

  approveLeave: function(id) {
    return async () => {
      const leave = this.state.pendingLeaves.find(l => l.id === id);
      if(!this.state.demo && leave) {
        const me = this.cur();
        const reviewMeta = { reviewed_by: me?.name || null, reviewed_at: new Date().toISOString() };
        const {data: updated} = await DB.leaves.updateStatus(id, 'approved', reviewMeta).catch(()=>({}));
        if(!updated){ this._toast('Already processed by another admin.','error'); this.loadPendingLeaves(); return; }
        const ops = [];
        if(leave.type === 'mc') {
          ops.push(DB.attendance.upsert(leave.personnel_id, leave.date, 'mc', {}).catch(()=>{}));
        } else if(leave.type === 'personal' || leave.type === 'other') {
          ops.push(DB.attendance.upsert(leave.personnel_id, leave.date, 'absent', {}).catch(()=>{}));
        }
        if(ops.length) await Promise.all(ops);
        // Refresh local attendance state if the leave is for today
        const todayKey = Utils.dateKey(this.baseDate ? this.baseDate() : new Date());
        if(leave.date === todayKey) {
          const freshAtt = await DB.attendance.getForDate(todayKey).catch(()=>null);
          if(freshAtt) this.setState({attendance:freshAtt, attendanceDate:todayKey});
        }
        this._toast('Request approved.');
      }
      this.loadPendingLeaves();
    };
  },

  rejectLeave: function(id) {
    return () => this.setState({rejectLeaveId: id, rejectLeaveReason: ''});
  },

  cancelRejectLeave: function() { this.setState({rejectLeaveId: null, rejectLeaveReason: ''}); },
  onRejectLeaveReason: function(e) { this.setState({rejectLeaveReason: e.target.value}); },

  confirmRejectLeave: async function() {
    const { rejectLeaveId, rejectLeaveReason, demo } = this.state;
    if(!rejectLeaveId) return;
    if(!demo) {
      const me = this.cur();
      const reviewMeta = { reviewed_by: me?.name || null, reviewed_at: new Date().toISOString(), rejection_reason: rejectLeaveReason.trim() || null };
      const { error } = await DB.leaves.updateStatus(rejectLeaveId, 'rejected', reviewMeta).catch(()=>({error:true}));
      if(error) {
        this._toast('Failed to decline request. Try again.','error');
        return;
      }
    }
    this.setState({rejectLeaveId: null, rejectLeaveReason: ''});
    this._toast('Request declined.');
    this.loadPendingLeaves();
  },

  toggleLeaveSelect: function(id) { return () => this.setState(s=>{const ids=s.leaveSelectedIds||[];return {leaveSelectedIds:ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]};});},
  clearLeaveSelect: function() { this.setState({leaveSelectedIds:[],confirmBulkLeaveReject:false,bulkLeaveRejectReason:''}); },

  bulkApproveLeaves: async function() {
    const {leaveSelectedIds,pendingLeaves,demo}=this.state;
    if(!leaveSelectedIds?.length) return;
    this.setState({bulkApprovingLeaves:true});
    let skipped=0;
    if(!demo){
      const me=this.cur(), reviewMeta={reviewed_by:me?.name||null,reviewed_at:new Date().toISOString()};
      await Promise.all(leaveSelectedIds.map(async id=>{
        const leave=pendingLeaves.find(l=>l.id===id);
        const ops=[DB.leaves.updateStatus(id,'approved',reviewMeta).catch(()=>{})];
        if(leave?.type==='mc') ops.push(DB.attendance.upsert(leave.personnel_id,leave.date,'mc',{}).catch(()=>{}));
        else if(leave?.type==='personal'||leave?.type==='other') ops.push(DB.attendance.upsert(leave.personnel_id,leave.date,'absent',{}).catch(()=>{}));
        await Promise.all(ops);
      }));
      const todayKey=Utils.dateKey(this.baseDate?this.baseDate():new Date());
      const hasToday=leaveSelectedIds.some(id=>pendingLeaves.find(l=>l.id===id)?.date===todayKey);
      if(hasToday){const freshAtt=await DB.attendance.getForDate(todayKey).catch(()=>null);if(freshAtt)this.setState({attendance:freshAtt,attendanceDate:todayKey});}
    }
    const count=leaveSelectedIds.length-skipped;
    this.setState({leaveSelectedIds:[],bulkApprovingLeaves:false});
    this._toast(`${count} request${count!==1?'s':''} approved.`);
    this.loadPendingLeaves();
  },

  askBulkLeaveReject: function() { this.setState({confirmBulkLeaveReject:true,bulkLeaveRejectReason:''}); },
  cancelBulkLeaveReject: function() { this.setState({confirmBulkLeaveReject:false,bulkLeaveRejectReason:''}); },
  onBulkLeaveRejectReason: function(e) { this.setState({bulkLeaveRejectReason:e.target.value}); },

  executeBulkLeaveReject: async function() {
    const {leaveSelectedIds,bulkLeaveRejectReason,demo}=this.state;
    if(!leaveSelectedIds?.length) return;
    if(!demo){
      const me=this.cur(), reviewMeta={reviewed_by:me?.name||null,reviewed_at:new Date().toISOString(),rejection_reason:bulkLeaveRejectReason.trim()||null};
      await Promise.all(leaveSelectedIds.map(id=>DB.leaves.updateStatus(id,'rejected',reviewMeta).catch(()=>{})));
    }
    const count=leaveSelectedIds.length;
    this.setState({leaveSelectedIds:[],confirmBulkLeaveReject:false,bulkLeaveRejectReason:''});
    this._toast(`${count} request${count!==1?'s':''} declined.`);
    this.loadPendingLeaves();
  },

  openLeaveRequest: function(date) { return () => this.setState({leaveOpen:true, leaveDate:date, leaveType:'mc', leaveReason:''}); },
  closeLeaveRequest: function() { this.setState({leaveOpen:false}); },
  onLeaveDate:   function(e) { this.setState({leaveDate:e.target.value}); },
  onLeaveType:   function(v) { return () => this.setState({leaveType:v}); },
  onLeaveReason: function(e) { this.setState({leaveReason:e.target.value}); },

  submitLeaveRequest: async function() {
    const {currentUserId, leaveDate, leaveType, leaveReason, demo, myPendingRequest, myLeaveHistory} = this.state;
    const _pendExpired=myPendingRequest?.created_at&&(Date.now()-new Date(myPendingRequest.created_at).getTime())>172800000;
    if(myPendingRequest&&!_pendExpired){ this._toast('You already have a pending request.','error'); return; }
    if(myPendingRequest&&_pendExpired&&!demo){
      await DB.leaves.updateStatus(myPendingRequest.id,'rejected',{reviewed_by:'System',rejection_reason:'Auto-expired after 2 days'}).catch(()=>{});
      this.setState({myPendingRequest:null});
    }
    if(!leaveDate){ this._toast('Please select a date.','error'); return; }
    if(leaveDate < Utils.dateKey(this.baseDate())){ this._toast('Cannot submit a request for a past date.','error'); return; }
    const _myBatch = this.state.batches.find(b=>b.id===this.state.me?.batch_id);
    if(_myBatch && (leaveDate < _myBatch.start_date || leaveDate > _myBatch.end_date)){ this._toast('The selected date is outside your current cycle.','error'); return; }
    if((myLeaveHistory||[]).some(h=>h.date===leaveDate&&h.status!=='cancelled'&&h.status!=='rejected')){ this._toast('You already submitted a request for this date.','error'); return; }
    if(!demo){
      const {data, error} = await DB.leaves.request(currentUserId, leaveDate, leaveType, leaveReason).catch(e=>({error:e}));
      if(error){ this._toast('Failed to submit request.','error'); return; }
      if(data) this.setState(s=>({myPendingRequest:data, myLeaveHistory:[data,...s.myLeaveHistory]}));
    } else {
      const demoReq={id:'demo-'+Date.now(),personnel_id:currentUserId,date:leaveDate,type:leaveType,status:'pending'};
      this.setState(s=>({myPendingRequest:demoReq, myLeaveHistory:[demoReq,...s.myLeaveHistory]}));
    }
    this._toast('Request submitted for approval.');
    this.setState({leaveOpen:false});
  },

  // ── Welfare note ───────────────────────────────────────────────────────
  openWelfareNote:  function() { this.setState({welfareNoteOpen:true, welfareNoteText:this.myRec()?.welfareNote||''}); },
  closeWelfareNote: function() { this.setState({welfareNoteOpen:false, welfareNoteText:''}); },
  onWelfareNoteText: function(e) { this.setState({welfareNoteText:e.target.value}); },

  submitWelfareNote: async function() {
    const {welfareNoteText, currentUserId, demo} = this.state;
    if(welfareNoteText.trim().length > 1000){ this._toast('Note is too long (max 1000 characters).','error'); return; }
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

  // ── Missed day note ───────────────────────────────────────────────────
  openMissedNote: function(dateKey, existingText) { return () => this.setState({missedNoteOpen:true, missedNoteDateKey:dateKey, missedNoteText:existingText||''}); },
  closeMissedNote: function() { this.setState({missedNoteOpen:false, missedNoteDateKey:null, missedNoteText:''}); },
  onMissedNoteText: function(e) { this.setState({missedNoteText:e.target.value}); },

  saveMissedNote: async function() {
    const {missedNoteDateKey, missedNoteText, currentUserId, demo} = this.state;
    if(!missedNoteDateKey) return;
    const note = missedNoteText.trim();
    const hasExisting = this.state.history.some(r=>r.date===missedNoteDateKey);
    if(!note && !hasExisting) {
      this.setState({missedNoteOpen:false, missedNoteDateKey:null, missedNoteText:''});
      return;
    }
    if(!demo) {
      const {error} = await DB.attendance.saveMissedNote(currentUserId, missedNoteDateKey, note).catch(e=>({error:e}));
      if(error) { this._toast('Failed to save note.','error'); return; }
    }
    this.setState(s=>{
      const idx=s.history.findIndex(r=>r.date===missedNoteDateKey);
      const newHistory=idx>=0
        ?s.history.map((r,i)=>i===idx?{...r,welfare_note:note}:r)
        :[...s.history,{date:missedNoteDateKey,status:'missed',welfare_note:note,check_in_time:null,lunch_out_time:null,work_return_time:null,work_end_time:null,late_reason:null}];
      return {history:newHistory, missedNoteOpen:false, missedNoteDateKey:null, missedNoteText:''};
    });
    this._toast(note ? 'Note saved.' : 'Note cleared.');
  },

  // ── Admin log note per person ─────────────────────────────────────────
  openLogNote: function(id, text) { return () => this.setState({logNoteId:id, logNoteText:text||''}); },
  closeLogNote: function() { this.setState({logNoteId:null, logNoteText:''}); },
  onLogNoteText: function(e) { this.setState({logNoteText:e.target.value}); },

  saveLogNote: async function() {
    const {logNoteId, logNoteText, viewOffset, demo} = this.state;
    if(!logNoteId) return;
    const d = new Date(this.baseDate());
    d.setDate(d.getDate() + (viewOffset||0));
    const dateKey = Utils.dateKey(d);
    if(!demo) {
      const {error} = await DB.attendance.saveWelfareNote(logNoteId, dateKey, logNoteText.trim()).catch(e=>({error:e}));
      if(error){ this._toast('Failed to save note.','error'); return; }
    }
    const today = Utils.dateKey(this.baseDate());
    if(dateKey === today) {
      this.setState(s=>({
        attendance:{...s.attendance,[logNoteId]:{...(s.attendance[logNoteId]||{}),welfareNote:logNoteText.trim()}},
        logNoteId:null, logNoteText:'',
      }));
    } else {
      this.setState(s=>({
        attendanceCache:{...s.attendanceCache,[dateKey]:{...(s.attendanceCache[dateKey]||{}),[logNoteId]:{...(s.attendanceCache[dateKey]?.[logNoteId]||{}),welfareNote:logNoteText.trim()}}},
        logNoteId:null, logNoteText:'',
      }));
    }
    this._toast('Note saved.');
  },

  loadMyLeaveHistory: async function() {
    const {currentUserId} = this.state;
    const hist = await DB.leaves.myHistory(currentUserId).catch(()=>[]);
    this.setState({myLeaveHistory:hist, myLeaveHistoryLoaded:true});
  },

  onSignupSearch:    function(e) { this.setState({signupSearch:e.target.value}); },
  clearSignupSearch: function() { this.setState({signupSearch:''}); },
  onLeaveSearch:     function(e) { this.setState({leaveSearch:e.target.value}); },
  clearLeaveSearch:  function() { this.setState({leaveSearch:''}); },

};
