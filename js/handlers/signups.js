// ── Signup request handlers (admin) ───────────────────────────────────────
const SignupHandlers = {

  loadPendingSignups:  async function() { const dept=this._myDept(); const data=await DB.signupRequests.listPending(dept).catch(()=>[]); this.setState({pendingSignups:data,pendingSignupsLoaded:true}); },
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

  _ensurePersonnelForSignup: async function(req, signupId) {
    const dept = req.department || 'ops_security';
    const existing=await DB.personnel.findByContact(req.contact).catch(()=>null);
    if(existing){
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
      return {finalPerson:null,existed:false,wasInactive:false,error:true,message:'Failed to create roster entry. Signup reverted to pending - try again.'};
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
      const {error}=await DB.signupRequests.reject(id,this.cur()?.name||null);
      if(error){this._toast('Failed to reject. Try again.','error');return;}
      this.setState(s=>({pendingSignups:s.pendingSignups.filter(r=>r.id!==id),selectedSignupIds:s.selectedSignupIds.filter(x=>x!==id)}));
      this._toast(req.name+"'s signup was rejected.");
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
