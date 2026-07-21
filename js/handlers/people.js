// ── People / personnel management handlers ────────────────────────────────
const PeopleHandlers = {

  // ── Superadmin: admin management ───────────────────────────────────────
  loadAdmins: async function() {
    const data = await DB.personnel.listAdmins().catch(()=>[]);
    this.setState({adminsList:data, adminsLoaded:true});
  },

  onNpAdminName:     function(e) { this.setState({npAdminName:e.target.value}); },
  onNpAdminContact:  function(e) { this.setState({npAdminContact:e.target.value}); },
  onNpAdminPassword: function(e) { this.setState({npAdminPassword:e.target.value}); },

  toggleAddAdmin: function() { this.setState(s=>({addAdminOpen:!s.addAdminOpen, npAdminName:'', npAdminContact:'', npAdminPassword:''})); },
  togglePromoteAdmin: function() { this.setState(s=>({promoteAdminOpen:!s.promoteAdminOpen, promoteAdminId:'', promoteAdminName:'', promoteAdminContact:'', confirmPromoteAdminId:null, promoteSearch:'', promoteListPage:1})); },

  addAdmin: async function() {
    const {npAdminName, npAdminContact, npAdminPassword, adminsList, demo} = this.state;
    if(!npAdminName.trim()){ this._toast('Name is required.','error'); return; }
    const cleanContact = npAdminContact.replace(/[\s-]/g,'');
    if(!cleanContact){ this._toast('Contact number is required.','error'); return; }
    if(!/^[689]\d{7}$/.test(cleanContact)){ this._toast('Contact must be an 8-digit Singapore number.','error'); return; }
    if(adminsList.some(a=>a.contact?.replace(/[\s-]/g,'')===cleanContact)){ this._toast('This contact is already an admin.','error'); return; }
    if(!npAdminPassword || npAdminPassword.length < 6){ this._toast('Password must be at least 6 characters.','error'); return; }
    if(!demo){
      const existing = await DB.personnel.findByContact(cleanContact).catch(()=>null);
      if(existing){ this._toast('This contact is already registered.','error'); return; }
      const {user, error} = await DB.auth.createUserAsAdmin(cleanContact, npAdminPassword, npAdminName.trim());
      if(error || !user){ this._toast('Failed to create account. Try again.','error'); return; }
      const {error:addErr} = await DB.personnel.add({authId:user.id, name:npAdminName.trim(), contact:cleanContact, shift:null, batchId:null, role:'admin'});
      if(addErr){ this._toast('Account created but roster entry failed.','error'); return; }
      await this.loadAdmins();
    }
    this.setState({npAdminName:'', npAdminContact:'', npAdminPassword:'', addAdminOpen:false});
    this._toast(npAdminName.trim() + ' added as admin.');
  },

  askDeactivateAdmin:    function(id) { return () => this.setState({confirmDeactivateAdminId:id}); },
  cancelDeactivateAdmin: function() { this.setState({confirmDeactivateAdminId:null}); },

  confirmDeactivateAdmin: async function() {
    const id = this.state.confirmDeactivateAdminId;
    if(!id) return;
    const admin = (this.state.adminsList||[]).find(a=>a.id===id);
    this.setState({confirmDeactivateAdminId:null});
    if(!this.state.demo){
      const {error} = await DB.personnel.demoteToReservist(id).catch(e=>({error:e}));
      if(error){ this._toast('Failed to remove admin. Try again.','error'); return; }
    }
    this.setState(s=>({
      adminsList: s.adminsList.filter(a=>a.id!==id),
      personnel: admin ? [...s.personnel, {...admin, role:'reservist', batch_id:null, shift:null}] : s.personnel,
    }));
    this._toast((admin?.name||'Admin')+' removed and returned to reservist pool.');
  },

  onPromoteAdminId:    function(e) { this.setState({promoteAdminId:e.target.value, confirmPromoteAdminId:null}); },
  onPromoteSearch:     function(e) { this.setState({promoteSearch:e.target.value, promoteAdminId:'', promoteAdminName:'', promoteAdminContact:'', confirmPromoteAdminId:null, promoteListPage:1}); },
  onPromoteSearchKeyDown: function(e) { if(e.key==='Enter') e.target.blur(); },
  togglePromoteShowAll: function() { this.setState(s=>({promoteShowAllCycles:!s.promoteShowAllCycles, promoteAdminId:'', promoteAdminName:'', promoteAdminContact:'', confirmPromoteAdminId:null, promoteSearch:'', promoteListPage:1})); },
  setPromoteCurrentCycle: function() { if(this.state.promoteShowAllCycles) this.setState({promoteShowAllCycles:false, promoteAdminId:'', promoteAdminName:'', promoteAdminContact:'', confirmPromoteAdminId:null, promoteSearch:'', promoteListPage:1}); },
  setPromoteAllCycles:    function() { if(!this.state.promoteShowAllCycles) this.setState({promoteShowAllCycles:true,  promoteAdminId:'', promoteAdminName:'', promoteAdminContact:'', confirmPromoteAdminId:null, promoteSearch:'', promoteListPage:1}); },
  clearPromoteSelection: function() { this.setState({promoteAdminId:'', promoteAdminName:'', promoteAdminContact:'', confirmPromoteAdminId:null, promoteSearch:''}); },
  promoteNextPage: function() { this.setState(s=>({promoteListPage:s.promoteListPage+1})); },
  promotePrevPage: function() { this.setState(s=>({promoteListPage:Math.max(1,s.promoteListPage-1)})); },

  askPromoteAdmin: function() {
    const {promoteAdminId} = this.state;
    if(!promoteAdminId){ this._toast('Select a person to promote.','error'); return; }
    this.setState({confirmPromoteAdminId:promoteAdminId});
  },

  cancelPromoteAdmin: function() { this.setState({confirmPromoteAdminId:null}); },

  confirmPromoteAdmin: async function() {
    const {confirmPromoteAdminId, personnel, demo} = this.state;
    if(!confirmPromoteAdminId) return;
    const person = personnel.find(p=>p.id===confirmPromoteAdminId);
    if(!person) return;
    this.setState({confirmPromoteAdminId:null, promoteAdminId:'', promoteAdminName:'', promoteAdminContact:'', promoteSearch:''});
    if(!demo){
      const {error} = await DB.personnel.promoteToAdmin(confirmPromoteAdminId).catch(e=>({error:e}));
      if(error){ this._toast('Failed to promote. Try again.','error'); return; }
    }
    this.setState(s=>({personnel:s.personnel.filter(p=>p.id!==confirmPromoteAdminId), promoteAdminOpen:false}));
    await this.loadAdmins();
    this._toast(person.name+' promoted to admin.');
  },

  // ── Personnel management ───────────────────────────────────────────────
  addPerson: async function() {
    const {npName,npContact,npShift,npPassword,batches,activeBatchIdx,demo,personnel}=this.state;
    if(!npName.trim()){ this._toast('Name is required.','error'); return; }
    const cleanContact=npContact.replace(/[\s-]/g,'');
    if(!cleanContact){ this._toast('Contact number is required.','error'); return; }
    if(!/^[689]\d{7}$/.test(cleanContact)){ this._toast('Contact must be an 8-digit Singapore number.','error'); return; }
    if(personnel.some(p=>p.contact.replace(/[\s-]/g,'')===cleanContact)){ this._toast('This contact is already on the roster.','error'); return; }
    const activeBatch=batches[activeBatchIdx||0];
    if(!activeBatch){ this._toast('No active batch selected. Create a batch first.','error'); return; }
    const {am:bAm,pm:bPm}=this._shiftSlotCounts(personnel);
    if(npShift==='AM'&&bAm>=2){ this._toast('AM shift is full (2/2). Select PM or Office.','error'); return; }
    if(npShift==='PM'&&bPm>=2){ this._toast('PM shift is full (2/2). Select AM or Office.','error'); return; }
    if(!demo){
      const existingRecord = await DB.personnel.findByContact(cleanContact).catch(()=>null);
      if(existingRecord && !existingRecord.is_active){
        this.setState({npReenrollRecord:existingRecord});
        return;
      }
      if(existingRecord && existingRecord.is_active){
        this._toast('This contact is already registered.','error'); return;
      }
      if(!npPassword.trim()){ this._toast('Password is required for new personnel.','error'); return; }
      if(npPassword.length<6){ this._toast('Password must be at least 6 characters.','error'); return; }
      const {user,error}=await DB.auth.createUserAsAdmin(cleanContact,npPassword,npName.trim());
      if(error||!user){ this._toast('Account creation failed: '+(error?.message||'Try again.'),'error'); return; }
      const {data,error:addErr}=await DB.personnel.add({authId:user.id,name:npName.trim(),contact:cleanContact,shift:npShift,batchId:activeBatch.id});
      if(addErr||!data){
        await DB.auth.deleteUser(user.id).catch(()=>{});
        this._toast('Failed to add to roster. Try again.','error'); return;
      }
      this.setState(s=>({personnel:[...s.personnel,data],npName:'',npContact:'',npShift:'AM',npPassword:'',rosterSearch:'',addPersonnelOpen:false}));
    } else {
      const id='demo-'+Date.now();
      this.setState(s=>({personnel:[...s.personnel,{id,name:npName.trim(),contact:cleanContact,shift:npShift,role:'reservist',batch_id:activeBatch.id,is_active:true}],npName:'',npContact:'',npShift:'AM',npPassword:'',rosterSearch:'',addPersonnelOpen:false}));
    }
    this._toast(npName.trim()+' added to roster.');
  },

  confirmReenroll: async function() {
    const {npName,npShift,batches,activeBatchIdx,npReenrollRecord}=this.state;
    if(!npReenrollRecord) return;
    const activeBatch=batches[activeBatchIdx||0];
    const addedName=npName.trim();
    const {data:reactivated,error:reactErr}=await DB.personnel.reactivate(npReenrollRecord.id,{batchId:activeBatch?.id,shift:npShift});
    if(reactErr||!reactivated){ this._toast('Failed to re-enroll. Try again.','error'); return; }
    if(addedName&&addedName!==npReenrollRecord.name) await DB.personnel.updateName(npReenrollRecord.id,addedName).catch(()=>{});
    const finalName=addedName||npReenrollRecord.name;
    this.setState(s=>({personnel:[...s.personnel,{...reactivated,name:finalName}],npName:'',npContact:'',npShift:'AM',npPassword:'',npReenrollRecord:null,rosterSearch:'',addPersonnelOpen:false}));
    this._toast(finalName+' re-enrolled on the roster.');
  },

  cancelReenroll: function() { this.setState({npReenrollRecord:null}); },

  onNpName:        function(e) { this.setState({npName:e.target.value}); },
  onNpContact:     function(e) { this.setState({npContact:e.target.value}); },
  onNpShift:       function(e) { this.setState({npShift:e.target.value}); },
  onNpPassword:    function(e) { this.setState({npPassword:e.target.value}); },
  toggleAddPersonnel: function() { this.setState(s=>({addPersonnelOpen:!s.addPersonnelOpen,npReenrollRecord:null})); },

  askDeactivatePerson:    function(id) { return () => this.setState({confirmDeactivateId:id}); },
  cancelDeactivatePerson: function() { this.setState({confirmDeactivateId:null}); },

  confirmDeactivatePerson: async function() {
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
  },

  openPersonHistory: function(id) {
    return async () => {
      this.setState({personHistoryId:id, personHistoryRows:[], personHistoryLoading:true});
      if(!this.state.demo){
        const tomorrow = Utils.dateKey(Utils.addDays(new Date(), 1));
        const data = await DB.attendance.getHistory(id, tomorrow).catch(()=>[]);
        this.setState({personHistoryRows:data, personHistoryLoading:false});
      } else {
        this.setState({personHistoryLoading:false});
      }
    };
  },

  closePersonHistory: function() { this.setState({personHistoryId:null, personHistoryRows:[], personHistoryLoading:false}); },

  openResetPw: function(id) { return () => this.setState({resetPwId:id, resetPwNew:'', resetPwSaving:false}); },
  closeResetPw: function() { this.setState({resetPwId:null, resetPwNew:''}); },
  onResetPwNew: function(e) { this.setState({resetPwNew:e.target.value}); },
  submitResetPw: async function() {
    const {resetPwId, resetPwNew, personnel, demo} = this.state;
    if(!resetPwId) return;
    if(!resetPwNew || resetPwNew.length < 6) { this._toast('Password must be at least 6 characters.', 'error'); return; }
    if(demo) { this._toast('Cannot reset passwords in demo mode.', 'error'); return; }
    const p = personnel.find(x=>x.id===resetPwId);
    if(!p?.auth_id) { this._toast('No login account linked to this person.', 'error'); return; }
    this.setState({resetPwSaving:true});
    const {error} = await DB.auth.adminResetPassword(p.auth_id, resetPwNew);
    this.setState({resetPwSaving:false});
    if(error) { this._toast('Failed to reset password.', 'error'); return; }
    this._toast((p.name||'Person')+"'s password has been reset.");
    this.setState({resetPwId:null, resetPwNew:''});
  },

  openBulkAdd: function() { this.setState({bulkAddOpen:true, bulkAddText:'', bulkAddParsed:[], bulkAddStep:'input', bulkAddAdding:false}); },
  closeBulkAdd: function() { this.setState({bulkAddOpen:false, bulkAddText:'', bulkAddParsed:[], bulkAddStep:'input', bulkAddAdding:false}); },
  onBulkAddText: function(e) { this.setState({bulkAddText:e.target.value}); },
  parseBulkAdd: function() {
    const lines = (this.state.bulkAddText||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const parsed = lines.map(line=>{
      const parts = line.split(',').map(p=>p.trim());
      const name = parts[0]||'';
      const contact = (parts[1]||'').replace(/[\s-]/g,'');
      const shiftRaw = (parts[2]||'AM').toUpperCase().replace(/\s/g,'');
      const shift = ['AM','PM','OFFICE'].includes(shiftRaw)?shiftRaw:'AM';
      const valid = name.length>1 && contact.length>=6;
      return {name, contact, shift, valid};
    });
    this.setState({bulkAddParsed:parsed, bulkAddStep:'preview'});
  },
  confirmBulkAdd: async function() {
    const {bulkAddParsed, batches, activeBatchIdx, demo} = this.state;
    const batch = batches[activeBatchIdx||0];
    if(!batch) { this._toast('No active batch.', 'error'); return; }
    const valid = bulkAddParsed.filter(r=>r.valid);
    if(!valid.length) return;
    if(demo) { this._toast('Cannot add personnel in demo mode.', 'error'); return; }
    this.setState({bulkAddAdding:true});
    let added=0, skipped=0, failed=0;
    for(const r of valid){
      const existing = await DB.personnel.findByContact(r.contact).catch(()=>null);
      if(existing){
        if(!existing.is_active){
          const {error} = await DB.personnel.reactivate(existing.id,{batchId:batch.id,shift:r.shift});
          error ? failed++ : added++;
        } else { skipped++; }
        continue;
      }
      const {error} = await DB.personnel.add({name:r.name,contact:r.contact,shift:r.shift,batchId:batch.id});
      error ? failed++ : added++;
    }
    const personnel = await DB.personnel.list().catch(()=>this.state.personnel);
    this.setState({personnel, bulkAddAdding:false});
    this.closeBulkAdd();
    const msg = [added?added+' added':'', skipped?skipped+' already active':'', failed?failed+' failed':''].filter(Boolean).join(', ');
    this._toast(msg||'Done.', failed?'error':undefined);
  },

  loadPeopleStats: async function() {
    const {batches,activeBatchIdx,personnel,demo,batchMembersCache,attendance,noReportDays}=this.state;
    const batch=batches[activeBatchIdx||0];
    if(!batch||demo) return;
    const members=batch.is_live?personnel:(batchMembersCache[batch.id]||[]);
    const allAtt=await DB.attendance.getForBatch(batch.start_date,batch.dekit_date||batch.end_date).catch(()=>({}));
    const today=Utils.dateKey(this.baseDate());
    if(batch.is_live) allAtt[today]={...(allAtt[today]||{}),...attendance};
    const batchEnd=batch.dekit_date||batch.end_date;
    const ceiling=batchEnd<today?batchEnd:today;
    const reportDays=[];
    for(let d=new Date(batch.start_date+'T00:00:00'),end=new Date(ceiling+'T00:00:00');d<=end;d=new Date(d.getTime()+86400000)){
      const dk=Utils.dateKey(d);
      if(Utils.isReportDay(d)&&!noReportDays.has(dk)) reportDays.push(dk);
    }
    const stats={};
    for(const p of members){
      let present=0,mc=0,absent=0;
      for(const dk of reportDays){
        const rec=allAtt[dk]?.[p.id];
        if(rec?.status==='present') present++;
        else if(rec?.status==='mc') mc++;
        else if(dk<today||rec?.status==='absent') absent++;
      }
      const total=present+mc+absent;
      stats[p.id]={present,mc,absent,total,pct:total?Math.round(present/total*100):null};
    }
    this.setState({peopleStats:stats,peopleStatsLoaded:true});
  },

};
