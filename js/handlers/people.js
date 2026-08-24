// ── Personnel roster handlers ──────────────────────────────────────────────
const PeopleHandlers = {

  onNpName:    function(e) { this.setState({npName:e.target.value}); },
  onNpContact: function(e) { this.setState({npContact:e.target.value}); },
  onNpShift:   function(e) { this.setState({npShift:e.target.value}); },
  onNpPassword: function(e) { this.setState({npPassword:e.target.value}); },
  onNpAddSearch: function(e) { this.setState({npAddSearch:e.target.value}); },
  onPeopleRosterSearch:   function(e) { this.setState({peopleRosterSearch:e.target.value}); },
  clearPeopleRosterSearch: function() { this.setState({peopleRosterSearch:''}); },

  addPerson: async function() {
    const {npName,npContact,npShift,npPassword,batches,activeBatchIdx,demo,personnel,me}=this.state;
    if(!npName.trim()){this._toast('Name is required.','error');return;}
    const {clean:cleanContact,error:contactErr}=Utils.validateSGContact(npContact);
    if(contactErr){this._toast(contactErr,'error');return;}
    if(personnel.some(p=>p.contact?.replace(/[\s-]/g,'')===cleanContact)){this._toast('This contact is already on the roster.','error');return;}
    const activeBatch=batches[activeBatchIdx||0];
    if(!activeBatch){this._toast('No active batch selected. Create a batch first.','error');return;}
    if(!demo){
      const existingRecord=await DB.personnel.findByContact(cleanContact).catch(()=>null);
      if(existingRecord&&!existingRecord.is_active){this.setState({npReenrollRecord:existingRecord});return;}
      if(existingRecord&&existingRecord.is_active){this._toast('This contact is already registered.','error');return;}
      if(!npPassword.trim()){this._toast('Password is required for new personnel.','error');return;}
      if(npPassword.length<6){this._toast('Password must be at least 6 characters.','error');return;}
      const {user,error}=await DB.auth.createUserAsAdmin(cleanContact,npPassword,npName.trim());
      if(error||!user){this._toast('Account creation failed: '+(error?.message||'Try again.'),'error');return;}
      const {data,error:addErr}=await DB.personnel.add({authId:user.id,name:npName.trim(),contact:cleanContact,shift:npShift,batchId:activeBatch.id,department:this._myDept()});
      if(addErr||!data){await DB.auth.deleteUser(user.id).catch(()=>{});this._toast('Failed to add to roster. Try again.','error');return;}
      if(me?.name&&data?.id) DB.personnel.setCreatedBy(data.id,me.name).catch(()=>{});
      this.setState(s=>({personnel:[...s.personnel,data],npName:'',npContact:'',npShift:'OFFICE',npPassword:'',rosterSearch:'',addPersonnelOpen:false,npAddSearch:'',showNpPw:false}));
      DB.personnel.list(null,true,this._myDept()).then(fresh=>this.setState({personnel:fresh})).catch(()=>{});
    } else {
      const id='demo-'+Date.now();
      this.setState(s=>({personnel:[...s.personnel,{id,name:npName.trim(),contact:cleanContact,shift:npShift,role:'reservist',batch_id:activeBatch.id,is_active:true}],npName:'',npContact:'',npShift:'OFFICE',npPassword:'',rosterSearch:'',addPersonnelOpen:false,npAddSearch:''}));
    }
    this._toast(npName.trim()+' added to roster.');
  },

  confirmReenroll: async function() {
    const {npName,npShift,batches,activeBatchIdx,npReenrollRecord,me}=this.state;
    if(!npReenrollRecord) return;
    const activeBatch=batches[activeBatchIdx||0];
    if(!activeBatch){this._toast('No active batch selected.','error');return;}
    const addedName=npName.trim();
    const {data:reactivated,error:reactErr}=await DB.personnel.reactivate(npReenrollRecord.id,{batchId:activeBatch?.id,shift:npShift});
    if(reactErr||!reactivated){this._toast('Failed to re-enroll. Try again.','error');return;}
    if(addedName&&addedName!==npReenrollRecord.name) await DB.personnel.updateName(npReenrollRecord.id,addedName).catch(()=>{});
    if(me?.name&&reactivated?.id) DB.personnel.setCreatedBy(reactivated.id,me.name).catch(()=>{});
    const finalName=addedName||npReenrollRecord.name;
    this.setState(s=>({personnel:[...s.personnel,{...reactivated,name:finalName}],npName:'',npContact:'',npShift:'OFFICE',npPassword:'',npReenrollRecord:null,rosterSearch:'',addPersonnelOpen:false,npAddSearch:'',showNpPw:false}));
    DB.personnel.list(null,true,this._myDept()).then(fresh=>this.setState({personnel:fresh})).catch(()=>{});
    this._toast(finalName+' re-enrolled on the roster.');
  },

  cancelReenroll: function() { this.setState({npReenrollRecord:null,npAddSearch:'',npName:'',npContact:''}); },

  toggleAddPersonnel: function() {
    const opening=!this.state.addPersonnelOpen;
    this.setState({addPersonnelOpen:opening,npReenrollRecord:null,npAddSearch:'',npDeactivatedPool:[],showNpPw:false,...(opening?{npName:'',npContact:'',npShift:'OFFICE',npPassword:''}:{})});
    if(opening&&!this.state.demo) DB.personnel.listAll(this._myDept()).then(all=>this.setState({npDeactivatedPool:all.filter(p=>!p.is_active)})).catch(()=>{});
  },

  askDeactivatePerson:    function(id) { return () => this.setState({confirmDeactivateId:id}); },
  cancelDeactivatePerson: function() { this.setState({confirmDeactivateId:null}); },

  confirmDeactivatePerson: async function() {
    const {confirmDeactivateId,demo,batches,activeBatchIdx}=this.state;
    if(!confirmDeactivateId) return;
    const removedName=this.state.personnel.find(p=>p.id===confirmDeactivateId)?.name||'Person';
    if(!demo){
      const {error}=await DB.personnel.deactivate(confirmDeactivateId).catch(()=>({error:true}));
      if(error){this._toast('Could not remove person. Check your connection.','error');this.setState({confirmDeactivateId:null});return;}
    }
    const batchId=batches[activeBatchIdx||0]?.id;
    this.setState(s=>{
      const personnel=s.personnel.filter(p=>p.id!==confirmDeactivateId);
      const batchMembersCache=batchId?{...s.batchMembersCache,[batchId]:(s.batchMembersCache[batchId]||[]).filter(p=>p.id!==confirmDeactivateId)}:s.batchMembersCache;
      return {personnel,batchMembersCache,confirmDeactivateId:null};
    });
    this._toast(removedName+' removed from roster.');
  },

  loadPeopleStats: async function() {
    const {batches,activeBatchIdx,personnel,demo,batchMembersCache,attendance,noReportDays}=this.state;
    const batch=batches[activeBatchIdx||0];
    if(!batch||demo) return;
    const members=batch.is_live?personnel:(batchMembersCache[batch.id]||[]);
    const allAtt=await DB.attendance.getForBatch(batch.start_date,batch.dekit_date||batch.end_date).catch(()=>({}));
    const today=Utils.dateKey(this.baseDate());
    if(batch.is_live) allAtt[today]={...(allAtt[today]||{}),...attendance};
    const ceiling=batch.dekit_date||batch.end_date; const end=ceiling<today?ceiling:today;
    const reportDays=[];
    for(let d=new Date(batch.start_date+'T00:00:00'),e=new Date(end+'T00:00:00');d<=e;d=new Date(d.getTime()+86400000)){
      const dk=Utils.dateKey(d);
      if(Utils.isReportDay(d)&&!noReportDays.has(dk)&&!Utils.holidayName(d)) reportDays.push(dk);
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

  openBulkAdd:  function() { this.setState({bulkAddOpen:true,bulkAddText:'',bulkAddParsed:[],bulkAddStep:'input',bulkAddAdding:false,bulkAddPassword:'',showBulkAddPw:false}); },
  closeBulkAdd: function() { this.setState({bulkAddOpen:false,bulkAddText:'',bulkAddParsed:[],bulkAddStep:'input',bulkAddAdding:false,bulkAddPassword:'',showBulkAddPw:false}); },
  onBulkAddText: function(e) { this.setState({bulkAddText:e.target.value}); },
  onBulkAddPassword: function(e) { this.setState({bulkAddPassword:e.target.value}); },

  parseBulkAdd: function() {
    const lines=(this.state.bulkAddText||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const seen=new Set();
    const parsed=lines.map(line=>{
      const parts=line.split(',').map(p=>p.trim()), name=parts[0]||'', contact=(parts[1]||'').replace(/[\s-]/g,'');
      const valid=name.length>1&&/^[689]\d{7}$/.test(contact);
      const isDupe=valid&&seen.has(contact);
      if(valid&&!isDupe) seen.add(contact);
      return {name,contact,shift:'OFFICE',valid:valid&&!isDupe};
    });
    this.setState({bulkAddParsed:parsed,bulkAddStep:'preview'});
  },

  confirmBulkAdd: async function() {
    const {bulkAddParsed,batches,activeBatchIdx,demo,me,bulkAddPassword}=this.state;
    const batch=batches[activeBatchIdx||0];
    if(!batch){this._toast('No active batch.','error');return;}
    const valid=bulkAddParsed.filter(r=>r.valid);
    if(!valid.length) return;
    if(demo){this._toast('Cannot add personnel in demo mode.','error');return;}
    if(!bulkAddPassword||bulkAddPassword.length<6){this._toast('A shared password is required (min. 6 characters).','error');return;}
    this.setState({bulkAddAdding:true});
    let added=0, skipped=0, failed=0;
    for(const r of valid){
      const existing=await DB.personnel.findByContact(r.contact).catch(()=>null);
      if(existing){
        if(!existing.is_active){const {error}=await DB.personnel.reactivate(existing.id,{batchId:batch.id,shift:r.shift});error?failed++:added++;}
        else skipped++;
        continue;
      }
      const {user,error:authErr}=await DB.auth.createUserAsAdmin(r.contact,bulkAddPassword,r.name);
      if(authErr||!user){failed++;continue;}
      const {data:addedData,error}=await DB.personnel.add({authId:user.id,name:r.name,contact:r.contact,shift:r.shift,batchId:batch.id,department:this._myDept()});
      if(error){await DB.auth.deleteUser(user.id).catch(()=>{});failed++;}else{if(me?.name&&addedData?.id)DB.personnel.setCreatedBy(addedData.id,me.name).catch(()=>{});added++;}
    }
    const personnel=await DB.personnel.list(null,true,this._myDept()).catch(()=>this.state.personnel);
    this.setState({personnel,bulkAddAdding:false});
    this.closeBulkAdd();
    const msg=[added?added+' added':'',skipped?skipped+' already active':'',failed?failed+' failed':''].filter(Boolean).join(', ');
    this._toast(msg||'Done.',failed?'error':undefined);
  },

};
