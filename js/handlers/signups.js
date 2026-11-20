// ── Signup request handlers (admin) ───────────────────────────────────────
const SignupHandlers = {

  loadPendingSignups: async function() {
    const dept=this._myDept();
    const data=await DB.signupRequests.listPending(dept).catch(()=>[]);
    // Deduplicate by contact: keep the latest request, delete older ones
    const latestByContact=new Map();
    for(const r of data){
      const key=(r.contact||'').replace(/[\s-]/g,'');
      const existing=latestByContact.get(key);
      if(!existing||r.created_at>existing.created_at) latestByContact.set(key,r);
    }
    const toDelete=data.filter(r=>latestByContact.get((r.contact||'').replace(/[\s-]/g,''))?.id!==r.id);
    for(const r of toDelete) DB.signupRequests.deletePendingById(r.id).catch(()=>{});
    const deduped=[...latestByContact.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at));
    this.setState({pendingSignups:deduped,pendingSignupsLoaded:true});
    if(deduped.length) this.loadSignupAvatars(deduped);
  },

  loadSignupAvatars: async function(signups) {
    if(this.state.demo) return;
    const list = signups || this.state.pendingSignups;
    if(!list.length) return;
    const dept=this._myDept();
    const allPersonnel=await DB.personnel.list(null,false,dept).catch(()=>[]);
    const contactToId={};
    for(const p of allPersonnel){const c=(p.contact||'').replace(/[\s-]/g,'');if(c) contactToId[c]=p.id;}
    this.setState({signupContactToId:contactToId});
    const ids=list.map(r=>contactToId[(r.contact||'').replace(/[\s-]/g,'')]).filter(id=>id&&!this.state.avatars[id]);
    if(!ids.length) return;
    const existing=await DB.storage.listAvatarIds().catch(()=>new Set());
    const withAvatar=ids.filter(id=>existing.has(id));
    if(!withAvatar.length) return;
    const urls=DB.storage.getAvatarUrls(withAvatar);
    this.setState(s=>({avatars:{...s.avatars,...urls}}));
  },
  loadApprovedSignups: async function() { const dept=this._myDept(); const data=await DB.signupRequests.listApproved(dept).catch(()=>[]); this.setState({approvedSignups:data}); },
  loadRejectedSignups: async function() { const dept=this._myDept(); const data=await DB.signupRequests.listRejected(dept).catch(()=>[]); this.setState({rejectedSignups:data,rejectedSignupsLoaded:true}); },

  reopenSignup: function(id) {
    return async () => {
      const req=this.state.rejectedSignups.find(r=>r.id===id);
      if(!req) return;
      const {error}=await DB.signupRequests.reopen(id).catch(()=>({error:true}));
      if(error){this._toast(error.hint==='superseded'||error.hint==='already_pending'?error.message:'Failed to re-open. Try again.','error');return;}
      this.setState(s=>({rejectedSignups:s.rejectedSignups.filter(r=>r.id!==id),pendingSignups:[{...req,status:'pending',reviewed_by:null,reviewed_at:null},...s.pendingSignups]}));
      this._toast(req.name+"'s signup re-opened.");
      this._log('signup', 'signup.reopened', { target_name: req.name });
    };
  },

  // Approval runs server-side (approve_signup): it links or creates the
  // personnel row, including a returning reservist whose record sits in
  // another department, which admins can no longer edit directly.
  _approveOne: async function(req) {
    const {data,error}=await DB.signupRequests.approveAndEnrol(req.id).catch(e=>({error:e}));
    if(error){
      if(error.hint==='already_processed') return {gone:true,message:'Already approved by another admin.'};
      return {failed:true,message:error.message||'Failed to approve. Try again.'};
    }
    return {finalPerson:data?.personnel||null,existed:!!data?.existed,wasInactive:!!data?.was_inactive};
  },

  approveSignup: function(id) {
    return async () => {
      const req=this.state.pendingSignups.find(r=>r.id===id);
      if(!req) return;
      const reviewerName=this.cur()?.name||null;
      const {finalPerson,existed,wasInactive,gone,failed,message}=await this._approveOne(req);
      if(gone){this.setState(s=>({pendingSignups:s.pendingSignups.filter(r=>r.id!==id)}));this._toast(message,'error');return;}
      if(failed){this._toast(message,'error');return;}
      if(finalPerson?.id){const _rb=this.state.batches.find(b=>b.id===req.batch_id);this._backfillAbsent(finalPerson.id,_rb,req.department||'ops_security').catch(()=>{});}
      const freshPersonnel=await DB.personnel.list(null,true,this._myDept()).catch(()=>null);
      this.setState(s=>({
        pendingSignups:s.pendingSignups.filter(r=>r.id!==id),
        approvedSignups:[{...req,status:'approved',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()},...s.approvedSignups],
        ...(freshPersonnel?{personnel:freshPersonnel}:finalPerson&&(!existed||wasInactive)?{personnel:[...s.personnel,finalPerson]}:{}),
      }));
      this._toast(req.name+' approved and added to the roster.');
      this._log('signup', 'signup.approved', { target_id: req.auth_id || null, target_name: req.name });
    };
  },

  // Decline opens an inline box for an optional reason, shown to the applicant.
  rejectSignup: function(id) {
    return () => this.setState(s=>({rejectSignupId:s.rejectSignupId===id?null:id,rejectSignupReason:'',moveSignupId:null,moveSignupDept:''}));
  },
  onRejectSignupReason: function(e) { this.setState({rejectSignupReason:e.target.value}); },
  cancelRejectSignup:   function() { this.setState({rejectSignupId:null,rejectSignupReason:''}); },

  confirmRejectSignup: async function() {
    const {rejectSignupId:id,rejectSignupReason,rejectSignupSaving}=this.state;
    if(!id||rejectSignupSaving) return;
    const req=this.state.pendingSignups.find(r=>r.id===id);
    if(!req){this.setState({rejectSignupId:null});return;}
    const reason=(rejectSignupReason||'').trim();
    if(reason.length>500){this._toast('Reason is too long (max 500 characters).','error');return;}
    const reviewerName=this.cur()?.name||null;
    this.setState({rejectSignupSaving:true});
    if(!this.state.demo){
      const {error}=await DB.signupRequests.reject(id,reviewerName,reason).catch(()=>({error:true}));
      if(error){this._toast('Failed to decline. Try again.','error');this.setState({rejectSignupSaving:false});return;}
    }
    const rejected={...req,status:'rejected',reviewed_by:reviewerName,reviewed_at:new Date().toISOString(),rejection_reason:reason||null};
    this.setState(s=>({
      pendingSignups:s.pendingSignups.filter(r=>r.id!==id),
      selectedSignupIds:s.selectedSignupIds.filter(x=>x!==id),
      rejectedSignups:[rejected,...(s.rejectedSignups||[])],
      rejectedSignupsLoaded:true,
      rejectSignupId:null,rejectSignupReason:'',rejectSignupSaving:false,
    }));
    this._toast(req.name+"'s signup was declined.");
    this._log('signup', 'signup.rejected', { target_name: req.name, ...(reason?{reason}:{}) });
  },

  // Move a pending or declined request to the department it should go to.
  openMoveSignup: function(id) {
    return () => this.setState(s=>({moveSignupId:s.moveSignupId===id?null:id,moveSignupDept:'',rejectSignupId:null,rejectSignupReason:''}));
  },
  onMoveSignupDept: function(e) { this.setState({moveSignupDept:e.target.value}); },
  cancelMoveSignup: function() { this.setState({moveSignupId:null,moveSignupDept:''}); },

  confirmMoveSignup: async function() {
    const {moveSignupId:id,moveSignupDept:dept,moveSignupSaving}=this.state;
    if(!id||moveSignupSaving) return;
    if(!dept){this._toast('Choose a department first.','error');return;}
    const req=this.state.pendingSignups.find(r=>r.id===id)||(this.state.rejectedSignups||[]).find(r=>r.id===id);
    if(!req){this.setState({moveSignupId:null});return;}
    this.setState({moveSignupSaving:true});
    let newId=null;
    if(!this.state.demo){
      const {data,error}=await DB.signupRequests.moveToDepartment(id,dept).catch(e=>({error:e}));
      if(error){this._toast(error.message||'Failed to move. Try again.','error');this.setState({moveSignupSaving:false});return;}
      newId=data?.id||null;
    }
    this.setState(s=>({
      pendingSignups:s.pendingSignups.filter(r=>r.id!==id),
      selectedSignupIds:s.selectedSignupIds.filter(x=>x!==id),
      rejectedSignups:(s.rejectedSignups||[]).map(r=>r.id===id?{...r,superseded_by:newId||'moved',superseded_at:new Date().toISOString()}:r),
      moveSignupId:null,moveSignupDept:'',moveSignupSaving:false,
    }));
    this._toast(req.name+"'s request moved to "+Utils.deptLabel(dept)+'.');
  },

  toggleSignupSelect: function(id) {
    return () => this.setState(s=>{const ids=s.selectedSignupIds;return{selectedSignupIds:ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]};});
  },

  approveSelected: async function() {
    const {selectedSignupIds,pendingSignups,demo}=this.state;
    if(!selectedSignupIds.length) return;
    const reviewerName=this.cur()?.name||null;
    const toApprove=pendingSignups.filter(r=>selectedSignupIds.includes(r.id));
    let count=0;
    for(const req of toApprove){
      if(demo){
        this.setState(s=>({pendingSignups:s.pendingSignups.filter(r=>r.id!==req.id),approvedSignups:[{...req,status:'approved',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()},...s.approvedSignups]}));
        count++;continue;
      }
      const {finalPerson,existed,wasInactive,gone,failed,message}=await this._approveOne(req);
      if(gone){this.setState(s=>({pendingSignups:s.pendingSignups.filter(r=>r.id!==req.id)}));continue;}
      if(failed){this._toast(req.name+': '+message,'error');continue;}
      if(finalPerson?.id){const _rb=this.state.batches.find(b=>b.id===req.batch_id);this._backfillAbsent(finalPerson.id,_rb,req.department||'ops_security').catch(()=>{});}
      this.setState(s=>({
        pendingSignups:s.pendingSignups.filter(r=>r.id!==req.id),
        approvedSignups:[{...req,status:'approved',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()},...s.approvedSignups],
        ...(finalPerson&&(!existed||wasInactive)?{personnel:[...s.personnel,finalPerson]}:{}),
      }));
      count++;
    }
    const freshPersonnel=await DB.personnel.list(null,true,this._myDept()).catch(()=>null);
    this.setState(s=>({selectedSignupIds:[],...(freshPersonnel?{personnel:freshPersonnel}:{})}));
    if(count) this._toast(count+' signup'+(count>1?'s':'')+' approved.');
    if (count) this._log('signup', 'signup.bulk_approved', { count });
  },

  selectAllSignups: function() {
    const {pendingSignups,signupSearch}=this.state;
    const q=(signupSearch||'').toLowerCase().trim();
    const visible=q?pendingSignups.filter(r=>r.name.toLowerCase().includes(q)||(r.contact||'').includes(q)):pendingSignups;
    this.setState({selectedSignupIds:visible.map(r=>r.id)});
  },
  clearAllSignupsSelection: function() { this.setState({selectedSignupIds:[]}); },

  onSignupSearch:    function(e) { this.setState({signupSearch:e.target.value}); },
  clearSignupSearch: function() { this.setState({signupSearch:''}); },

};
