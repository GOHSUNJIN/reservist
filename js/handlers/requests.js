// ── Leave request and notes handlers ──────────────────────────────────────
const RequestHandlers = {

  onLeaveSearch:    function(e) { this.setState({leaveSearch:e.target.value}); },
  clearLeaveSearch: function() { this.setState({leaveSearch:''}); },

  loadPendingLeaves: async function() {
    const {demo}=this.state;
    if(demo) return;
    const liveBatch=this._liveBatch(this.state.batches);
    if(liveBatch?.start_date) await DB.leaves.cancelStalePending(liveBatch.start_date).catch(()=>{});
    const data=await DB.leaves.listPending(this._myDept()).catch(()=>[]);
    this.setState({pendingLeaves:data,pendingLeavesLoaded:true});
  },

  approveLeave: function(id) {
    return async () => {
      const leave=this.state.pendingLeaves.find(l=>l.id===id);
      if(leave&&leave.personnel_id===this.state.currentUserId){this._toast('Cannot approve your own request.','error');return;}
      this.setState({approvingLeaveId:id});
      if(!this.state.demo&&leave){
        const reviewMeta={reviewed_by:this.cur()?.name||null,reviewed_at:new Date().toISOString()};
        const {data:updated}=await DB.leaves.updateStatus(id,'approved',reviewMeta).catch(()=>({}));
        if(!updated){this._toast('Already processed by another admin.','error');this.setState({approvingLeaveId:null});this.loadPendingLeaves();return;}
        const ops=[];
        if(leave.type==='mc') ops.push(DB.attendance.upsert(leave.personnel_id,leave.date,'mc',{}).catch(()=>({error:true})));
        else if(leave.type==='personal'||leave.type==='other') ops.push(DB.attendance.upsert(leave.personnel_id,leave.date,'absent',{}).catch(()=>({error:true})));
        if(ops.length){
          const results=await Promise.all(ops);
          if(results.some(r=>r?.error)){this._toast('Approved, but failed to update attendance record. Check the roster.','error');}
          else {
            const todayKey=Utils.dateKey(this.baseDate());
            if(leave.date===todayKey){const freshAtt=await DB.attendance.getForDate(todayKey).catch(()=>null);if(freshAtt)this.setState({attendance:freshAtt,attendanceDate:todayKey});}
            this._toast('Request approved.');
          }
        } else {
          this._toast('Request approved.');
        }
      }
      this.setState({approvingLeaveId:null});
      if(this.state.demo&&leave){this.setState(s=>({pendingLeaves:(s.pendingLeaves||[]).filter(l=>l.id!==id)}));this._toast('Request approved.');}
      else this.loadPendingLeaves();
    };
  },

  rejectLeave:        function(id) { return () => this.setState({rejectLeaveId:id,rejectLeaveReason:''}); },
  cancelRejectLeave:  function() { this.setState({rejectLeaveId:null,rejectLeaveReason:''}); },
  onRejectLeaveReason: function(e) { this.setState({rejectLeaveReason:e.target.value}); },

  confirmRejectLeave: async function() {
    const {rejectLeaveId,rejectLeaveReason,demo}=this.state;
    if(!rejectLeaveId) return;
    this.setState({confirmingDecline:true});
    if(!demo){
      const reviewMeta={reviewed_by:this.cur()?.name||null,reviewed_at:new Date().toISOString(),rejection_reason:rejectLeaveReason.trim()||null};
      const {error}=await DB.leaves.updateStatus(rejectLeaveId,'rejected',reviewMeta).catch(()=>({error:true}));
      if(error){this._toast('Failed to decline request. Try again.','error');this.setState({confirmingDecline:false});return;}
    }
    const _id=rejectLeaveId;
    this.setState({rejectLeaveId:null,rejectLeaveReason:'',confirmingDecline:false});
    this._toast('Request declined.');
    if(demo) this.setState(s=>({pendingLeaves:(s.pendingLeaves||[]).filter(l=>l.id!==_id)}));
    else this.loadPendingLeaves();
  },

  toggleLeaveSelect:   function(id) { return () => this.setState(s=>{const ids=s.leaveSelectedIds||[];return{leaveSelectedIds:ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]};});},
  clearLeaveSelect:    function() { this.setState({leaveSelectedIds:[],confirmBulkLeaveReject:false,bulkLeaveRejectReason:''}); },
  selectAllLeaves: function() {
    const {pendingLeaves,leaveSearch}=this.state;
    const q=(leaveSearch||'').toLowerCase().trim();
    const visible=q?(pendingLeaves||[]).filter(l=>(l.personnel?.name||'').toLowerCase().includes(q)||(l.personnel?.contact||'').includes(q)):(pendingLeaves||[]);
    this.setState({leaveSelectedIds:visible.map(l=>l.id)});
  },
  clearAllLeavesSelection: function() { this.setState({leaveSelectedIds:[]}); },

  bulkApproveLeaves: async function() {
    const {leaveSelectedIds,pendingLeaves,demo,currentUserId}=this.state;
    if(!leaveSelectedIds?.length) return;
    if(leaveSelectedIds.find(id=>pendingLeaves.find(l=>l.id===id)?.personnel_id===currentUserId)){this._toast('Cannot approve your own request.','error');return;}
    this.setState({bulkApprovingLeaves:true});
    if(!demo){
      const reviewMeta={reviewed_by:this.cur()?.name||null,reviewed_at:new Date().toISOString()};
      await Promise.all(leaveSelectedIds.map(async id=>{
        const leave=pendingLeaves.find(l=>l.id===id);
        const ops=[DB.leaves.updateStatus(id,'approved',reviewMeta).catch(()=>{})];
        if(leave?.type==='mc') ops.push(DB.attendance.upsert(leave.personnel_id,leave.date,'mc',{}).catch(()=>{}));
        else if(leave?.type==='personal'||leave?.type==='other') ops.push(DB.attendance.upsert(leave.personnel_id,leave.date,'absent',{}).catch(()=>{}));
        await Promise.all(ops);
      }));
      const todayKey=Utils.dateKey(this.baseDate?this.baseDate():new Date());
      if(leaveSelectedIds.some(id=>pendingLeaves.find(l=>l.id===id)?.date===todayKey)){
        const freshAtt=await DB.attendance.getForDate(todayKey).catch(()=>null);
        if(freshAtt) this.setState({attendance:freshAtt,attendanceDate:todayKey});
      }
    }
    const count=leaveSelectedIds.length, _approved=new Set(leaveSelectedIds);
    this.setState({leaveSelectedIds:[],bulkApprovingLeaves:false});
    this._toast(`${count} request${count!==1?'s':''} approved.`);
    if(demo) this.setState(s=>({pendingLeaves:(s.pendingLeaves||[]).filter(l=>!_approved.has(l.id))}));
    else this.loadPendingLeaves();
  },

  askBulkLeaveReject:     function() { this.setState({confirmBulkLeaveReject:true,bulkLeaveRejectReason:''}); },
  cancelBulkLeaveReject:  function() { this.setState({confirmBulkLeaveReject:false,bulkLeaveRejectReason:''}); },
  onBulkLeaveRejectReason: function(e) { this.setState({bulkLeaveRejectReason:e.target.value}); },

  executeBulkLeaveReject: async function() {
    const {leaveSelectedIds,bulkLeaveRejectReason,demo}=this.state;
    if(!leaveSelectedIds?.length) return;
    if(!demo){
      const reviewMeta={reviewed_by:this.cur()?.name||null,reviewed_at:new Date().toISOString(),rejection_reason:bulkLeaveRejectReason.trim()||null};
      await Promise.all(leaveSelectedIds.map(id=>DB.leaves.updateStatus(id,'rejected',reviewMeta).catch(()=>{})));
    }
    const count=leaveSelectedIds.length, _rejected=new Set(leaveSelectedIds);
    this.setState({leaveSelectedIds:[],confirmBulkLeaveReject:false,bulkLeaveRejectReason:''});
    this._toast(`${count} request${count!==1?'s':''} declined.`);
    if(demo) this.setState(s=>({pendingLeaves:(s.pendingLeaves||[]).filter(l=>!_rejected.has(l.id))}));
    else this.loadPendingLeaves();
  },

  openLeaveRequest:  function(date) { return () => this.setState({leaveOpen:true,leaveDate:date,leaveType:'mc',leaveReason:''}); },
  closeLeaveRequest: function() { this.setState({leaveOpen:false}); },
  onLeaveDate:   function(e) { this.setState({leaveDate:e.target.value}); },
  onLeaveType:   function(v) { return () => this.setState({leaveType:v}); },
  onLeaveReason: function(e) { this.setState({leaveReason:e.target.value}); },

  submitLeaveRequest: async function() {
    const {currentUserId,leaveDate,leaveType,leaveReason,demo,myPendingRequest,myLeaveHistory,myLeaveHistoryLoaded}=this.state;
    if(!demo&&!myLeaveHistoryLoaded){this._toast('Loading your history, please wait a moment.','error');return;}
    const _pendExpired=myPendingRequest?.created_at&&(Date.now()-new Date(myPendingRequest.created_at).getTime())>172800000;
    if(myPendingRequest&&!_pendExpired){this._toast('You already have a pending request.','error');return;}
    if(myPendingRequest&&_pendExpired&&!demo){
      await DB.leaves.updateStatus(myPendingRequest.id,'rejected',{reviewed_by:'System',rejection_reason:'Auto-expired after 2 days'}).catch(()=>{});
      this.setState({myPendingRequest:null});
    }
    if(!leaveDate){this._toast('Please select a date.','error');return;}
    if(leaveDate<Utils.dateKey(this.baseDate())){this._toast('Cannot submit a request for a past date.','error');return;}
    const _myBatch=this.state.batches.find(b=>b.id===this.state.me?.batch_id);
    if(_myBatch&&(leaveDate<_myBatch.start_date||leaveDate>_myBatch.end_date)){this._toast('The selected date is outside your current cycle.','error');return;}
    if((myLeaveHistory||[]).some(h=>h.date===leaveDate&&h.status!=='cancelled'&&h.status!=='rejected')){this._toast('You already submitted a request for this date.','error');return;}
    if(!demo){
      const {data,error}=await DB.leaves.request(currentUserId,leaveDate,leaveType,leaveReason).catch(e=>({error:e}));
      if(error){this._toast('Failed to submit request.','error');return;}
      if(data) this.setState(s=>({myPendingRequest:data,myLeaveHistory:[data,...s.myLeaveHistory]}));
    } else {
      const demoReq={id:'demo-'+Date.now(),personnel_id:currentUserId,date:leaveDate,type:leaveType,status:'pending'};
      this.setState(s=>({myPendingRequest:demoReq,myLeaveHistory:[demoReq,...s.myLeaveHistory]}));
    }
    this._toast('Request submitted for approval.');
    this.setState({leaveOpen:false});
  },

  cancelLeaveRequest: function(id) {
    return async () => {
      const {demo}=this.state;
      if(!demo&&id&&id!=='demo'){
        const {data,error}=await DB.leaves.cancel(id).catch(()=>({error:true}));
        if(error){this._toast('Failed to cancel. Try again.','error');return;}
        if(!data){this._toast('Request was already reviewed by an admin.','error');this.loadMyLeaveHistory();return;}
      }
      this.setState(s=>({myPendingRequest:s.myPendingRequest?.id===id?null:s.myPendingRequest,myLeaveHistory:s.myLeaveHistory.map(r=>r.id===id?{...r,status:'cancelled'}:r)}));
      this._toast('Request cancelled.');
    };
  },

  loadMyLeaveHistory: async function() {
    const hist=await DB.leaves.myHistory(this.state.currentUserId).catch(()=>[]);
    this.setState({myLeaveHistory:hist,myLeaveHistoryLoaded:true});
  },

  openWelfareNote:   function() { this.setState({welfareNoteOpen:true,welfareNoteText:this.myRec()?.welfareNote||''}); },
  closeWelfareNote:  function() { this.setState({welfareNoteOpen:false,welfareNoteText:''}); },
  onWelfareNoteText: function(e) { this.setState({welfareNoteText:e.target.value}); },

  submitWelfareNote: async function() {
    const {welfareNoteText,currentUserId,demo}=this.state;
    if(welfareNoteText.trim().length>1000){this._toast('Note is too long (max 1000 characters).','error');return;}
    this.setState({welfareNoteSaving:true});
    const today=Utils.dateKey(this.baseDate());
    if(!demo){
      const {error}=await DB.attendance.saveWelfareNote(currentUserId,today,welfareNoteText.trim()).catch(e=>({error:e}));
      if(error){this._toast('Failed to save note.','error');this.setState({welfareNoteSaving:false});return;}
    }
    this.setState(s=>({attendance:{...s.attendance,[s.currentUserId]:{...s.attendance[s.currentUserId],welfareNote:welfareNoteText.trim()}},welfareNoteOpen:false,welfareNoteSaving:false}));
    this._toast('Note saved.');
  },

  openMissedNote:   function(dateKey,existingText) { return () => this.setState({missedNoteOpen:true,missedNoteDateKey:dateKey,missedNoteText:existingText||''}); },
  closeMissedNote:  function() { this.setState({missedNoteOpen:false,missedNoteDateKey:null,missedNoteText:''}); },
  onMissedNoteText: function(e) { this.setState({missedNoteText:e.target.value}); },

  saveMissedNote: async function() {
    const {missedNoteDateKey,missedNoteText,currentUserId,demo}=this.state;
    if(!missedNoteDateKey) return;
    const note=missedNoteText.trim();
    if(!note&&!this.state.history.some(r=>r.date===missedNoteDateKey)){this.setState({missedNoteOpen:false,missedNoteDateKey:null,missedNoteText:''});return;}
    if(!demo){
      const {error}=await DB.attendance.saveMissedNote(currentUserId,missedNoteDateKey,note).catch(e=>({error:e}));
      if(error){this._toast('Failed to save note.','error');return;}
    }
    this.setState(s=>{
      const idx=s.history.findIndex(r=>r.date===missedNoteDateKey);
      const newHistory=idx>=0?s.history.map((r,i)=>i===idx?{...r,welfare_note:note}:r):[...s.history,{date:missedNoteDateKey,status:'missed',welfare_note:note,check_in_time:null,lunch_out_time:null,work_return_time:null,work_end_time:null,late_reason:null}];
      return {history:newHistory,missedNoteOpen:false,missedNoteDateKey:null,missedNoteText:''};
    });
    this._toast(note?'Note saved.':'Note cleared.');
  },

  openLogNote:   function(id,text) { return () => this.setState({logNoteId:id,logNoteText:text||''}); },
  closeLogNote:  function() { this.setState({logNoteId:null,logNoteText:''}); },
  onLogNoteText: function(e) { this.setState({logNoteText:e.target.value}); },

  saveLogNote: async function() {
    const {logNoteId,logNoteText,viewOffset,demo}=this.state;
    if(!logNoteId) return;
    this.setState({logNoteSaving:true});
    const d=new Date(this.baseDate()); d.setDate(d.getDate()+(viewOffset||0));
    const dateKey=Utils.dateKey(d);
    if(!demo){
      const {error}=await DB.attendance.saveWelfareNote(logNoteId,dateKey,logNoteText.trim()).catch(e=>({error:e}));
      if(error){this._toast('Failed to save note.','error');this.setState({logNoteSaving:false});return;}
    }
    const today=Utils.dateKey(this.baseDate()), clear={logNoteId:null,logNoteText:'',logNoteSaving:false};
    if(dateKey===today) this.setState(s=>({attendance:{...s.attendance,[logNoteId]:{...(s.attendance[logNoteId]||{}),welfareNote:logNoteText.trim()}},...clear}));
    else this.setState(s=>({attendanceCache:{...s.attendanceCache,[dateKey]:{...(s.attendanceCache[dateKey]||{}),[logNoteId]:{...(s.attendanceCache[dateKey]?.[logNoteId]||{}),welfareNote:logNoteText.trim()}}},...clear}));
    this._toast('Note saved.');
  },

};
