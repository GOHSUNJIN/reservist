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
      if(error){this._toast('Failed to re-open. Try again.','error');return;}
      this.setState(s=>({rejectedSignups:s.rejectedSignups.filter(r=>r.id!==id),pendingSignups:[{...req,status:'pending',reviewed_by:null,reviewed_at:null},...s.pendingSignups]}));
      this._toast(req.name+"'s signup re-opened.");
    };
  },

  // Finds or creates a personnel record for an approved signup; reactivates inactive records if found.
  _ensurePersonnelForSignup: async function(req, signupId) {
    const dept = req.department || 'ops_security';
    const existing=await DB.personnel.findByContact(req.contact, dept).catch(()=>null);
    if(existing){
      if(existing.role==='admin'||existing.role==='superadmin'){
        await DB.signupRequests.reopen(signupId).catch(()=>{});
        return {finalPerson:null,existed:true,wasInactive:false,error:true,message:'This contact belongs to a supervisor account and cannot be enrolled as a reservist. Please contact your system administrator.'};
      }
      if(!existing.is_active){
        const {data:reactivated}=await DB.personnel.reactivate(existing.id,{batchId:req.batch_id,shift:req.shift,authId:req.auth_id,department:dept});
        return {finalPerson:reactivated||existing,existed:true,wasInactive:true};
      }
      await DB.personnel.linkAuth(existing.id,req.auth_id);
      return {finalPerson:existing,existed:true,wasInactive:false};
    }
    const {data:newPerson,error:addErr}=await DB.personnel.add({authId:req.auth_id,name:req.name,contact:req.contact,shift:req.shift,batchId:req.batch_id,department:dept});
    if(addErr){
      await DB.signupRequests.reopen(signupId).catch(()=>{});
      return {finalPerson:null,existed:false,wasInactive:false,error:true,message:'Failed to create roster entry. Signup reverted to pending. Try again.'};
    }
    return {finalPerson:newPerson,existed:false,wasInactive:false};
  },

  approveSignup: function(id) {
    return async () => {
      const req=this.state.pendingSignups.find(r=>r.id===id);
      if(!req) return;
      const reviewerName=this.cur()?.name||null;
      const {data:approvedRow,error:approveErr}=await DB.signupRequests.approve(id,reviewerName);
      if(approveErr){this._toast('Failed to approve. Try again.','error');return;}
      if(!approvedRow){this.setState(s=>({pendingSignups:s.pendingSignups.filter(r=>r.id!==id)}));this._toast('Already approved by another admin.','error');return;}
      const {finalPerson,existed,wasInactive,error:personErr,message:personMsg}=await this._ensurePersonnelForSignup(req,id);
      if(personErr){this._toast(personMsg,'error');return;}
      if(finalPerson?.id){const _rb=this.state.batches.find(b=>b.id===req.batch_id);this._backfillAbsent(finalPerson.id,_rb,req.department||'ops_security').catch(()=>{});}
      const freshPersonnel=await DB.personnel.list(null,true,this._myDept()).catch(()=>null);
      this.setState(s=>({
        pendingSignups:s.pendingSignups.filter(r=>r.id!==id),
        approvedSignups:[{...req,status:'approved',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()},...s.approvedSignups],
        ...(freshPersonnel?{personnel:freshPersonnel}:finalPerson&&(!existed||wasInactive)?{personnel:[...s.personnel,finalPerson]}:{}),
      }));
      this._toast(req.name+' approved and added to the roster.');
    };
  },

  rejectSignup: function(id) {
    return async () => {
      const req=this.state.pendingSignups.find(r=>r.id===id);
      if(!req) return;
      const reviewerName=this.cur()?.name||null;
      const {error}=await DB.signupRequests.reject(id,reviewerName);
      if(error){this._toast('Failed to decline. Try again.','error');return;}
      const rejected={...req,status:'rejected',reviewed_by:reviewerName,reviewed_at:new Date().toISOString()};
      this.setState(s=>({
        pendingSignups:s.pendingSignups.filter(r=>r.id!==id),
        selectedSignupIds:s.selectedSignupIds.filter(x=>x!==id),
        rejectedSignups:[rejected,...(s.rejectedSignups||[])],
        rejectedSignupsLoaded:true,
      }));
      this._toast(req.name+"'s signup was declined.");
    };
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
      const {data:approvedRow,error:approveErr}=await DB.signupRequests.approve(req.id,reviewerName);
      if(approveErr||!approvedRow) continue;
      const {finalPerson,existed,wasInactive,error:personErr,message:personMsg}=await this._ensurePersonnelForSignup(req,req.id);
      if(personErr){this._toast(personMsg,'error');continue;}
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
