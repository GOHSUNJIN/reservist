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
    const {npAdminName, npAdminContact, npAdminPassword, adminsList, demo, isSuperAdmin} = this.state;
    if(!demo && !isSuperAdmin){ this._toast('Access denied.','error'); return; }
    if(!npAdminName.trim()){ this._toast('Name is required.','error'); return; }
    const {clean:cleanContact, error:contactErr} = Utils.validateSGContact(npAdminContact);
    if(contactErr){ this._toast(contactErr,'error'); return; }
    if(adminsList.some(a=>a.contact?.replace(/[\s-]/g,'')===cleanContact)){ this._toast('This contact is already an admin.','error'); return; }
    if(!npAdminPassword || npAdminPassword.length < 6){ this._toast('Password must be at least 6 characters.','error'); return; }
    if(!demo){
      const existing = await DB.personnel.findByContact(cleanContact).catch(()=>null);
      if(existing){ this._toast('This contact is already registered.','error'); return; }
      const {user, error} = await DB.auth.createUserAsAdmin(cleanContact, npAdminPassword, npAdminName.trim());
      if(error || !user){ this._toast('Failed to create account. Try again.','error'); return; }
      const {error:addErr} = await DB.personnel.add({authId:user.id, name:npAdminName.trim(), contact:cleanContact, shift:null, batchId:null, role:'admin'});
      if(addErr){ await DB.auth.deleteUser(user.id).catch(()=>{}); this._toast('Failed to add admin to roster. Try again.','error'); return; }
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
    if(!this.state.demo && !this.state.isSuperAdmin){ this._toast('Access denied.','error'); this.setState({confirmDeactivateAdminId:null}); return; }
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
    const {confirmPromoteAdminId, personnel, demo, isSuperAdmin} = this.state;
    if(!confirmPromoteAdminId) return;
    if(!demo && !isSuperAdmin){ this._toast('Access denied.','error'); this.setState({confirmPromoteAdminId:null}); return; }
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
    const {clean:cleanContact, error:contactErr} = Utils.validateSGContact(npContact);
    if(contactErr){ this._toast(contactErr,'error'); return; }
    if(personnel.some(p=>p.contact.replace(/[\s-]/g,'')===cleanContact)){ this._toast('This contact is already on the roster.','error'); return; }
    const activeBatch=batches[activeBatchIdx||0];
    if(!activeBatch){ this._toast('No active batch selected. Create a batch first.','error'); return; }
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
      this.setState(s=>({personnel:[...s.personnel,data],npName:'',npContact:'',npShift:'OFFICE',npPassword:'',rosterSearch:'',addPersonnelOpen:false}));
    } else {
      const id='demo-'+Date.now();
      this.setState(s=>({personnel:[...s.personnel,{id,name:npName.trim(),contact:cleanContact,shift:npShift,role:'reservist',batch_id:activeBatch.id,is_active:true}],npName:'',npContact:'',npShift:'OFFICE',npPassword:'',rosterSearch:'',addPersonnelOpen:false}));
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
    this.setState(s=>({personnel:[...s.personnel,{...reactivated,name:finalName}],npName:'',npContact:'',npShift:'OFFICE',npPassword:'',npReenrollRecord:null,rosterSearch:'',addPersonnelOpen:false}));
    this._toast(finalName+' re-enrolled on the roster.');
  },

  cancelReenroll: function() { this.setState({npReenrollRecord:null}); },

  onNpName:        function(e) { this.setState({npName:e.target.value}); },
  onNpContact:     function(e) { this.setState({npContact:e.target.value}); },
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

  closePersonHistory: function() { this.setState({personHistoryId:null, personHistoryRows:[], personHistoryLoading:false, confirmWipeHistoryId:null}); },

  askWipeHistory: function() { this.setState({confirmWipeHistoryId:this.state.personHistoryId}); },
  cancelWipeHistory: function() { this.setState({confirmWipeHistoryId:null}); },
  confirmWipeHistory: async function() {
    const id = this.state.confirmWipeHistoryId;
    if(!id) return;
    if(id === this.state.currentUserId){ this._toast('You cannot delete your own account.','error'); this.setState({confirmWipeHistoryId:null}); return; }
    const s = this.state;
    const allLoaded = [...s.personnel, ...Object.values(s.batchMembersCache).flat()];
    const person = allLoaded.find(p=>p.id===id);
    const authId = person?.auth_id || null;
    const batchId = s.batches[s.activeBatchIdx||0]?.id;
    this.setState({wipingHistory:true});
    if(!s.demo){
      const {error} = await DB.personnel.deletePermanently(id, authId).catch(()=>({error:true}));
      if(error){ this._toast('Delete failed. Check your connection.','error'); this.setState({wipingHistory:false}); return; }
    }
    this.setState(prev=>{
      const personnel = prev.personnel.filter(p=>p.id!==id);
      const batchMembersCache = {...prev.batchMembersCache};
      Object.keys(batchMembersCache).forEach(k=>{ batchMembersCache[k]=(batchMembersCache[k]||[]).filter(p=>p.id!==id); });
      return {personnel,batchMembersCache,wipingHistory:false,confirmWipeHistoryId:null,personHistoryId:null,personHistoryRows:[]};
    });
    this._toast((person?.name||'Member')+' permanently deleted.');
  },

  onMemberSearchStatus: function(v) { return () => this.setState({memberSearchStatus:v, memberSearchPage:1, confirmDeleteMemberId:null, memberSearchSelected:[], confirmBulkDelete:false}); },
  onMemberSearchCycle: function(e) { this.setState({memberSearchCycle:e.target.value, memberSearchPage:1, confirmDeleteMemberId:null, memberSearchSelected:[], confirmBulkDelete:false}); },

  openMemberSearch: async function() {
    this.setState({memberSearchOpen:true, memberSearchLoaded:false, memberSearchText:'', memberSearchList:[], memberSearchStatus:'all', memberSearchCycle:'all', memberSearchPage:1, memberSearchSelected:[], confirmDeleteMemberId:null, confirmBulkDelete:false});
    if(!this.state.demo){
      const data = await DB.personnel.listAll().catch(()=>[]);
      this.setState({memberSearchList:data, memberSearchLoaded:true});
    } else {
      this.setState({memberSearchLoaded:true});
    }
  },
  closeMemberSearch: function() { this.setState({memberSearchOpen:false, memberSearchText:'', confirmDeleteMemberId:null}); },
  onMemberSearchText: function(e) { this.setState({memberSearchText:e.target.value, memberSearchPage:1, confirmDeleteMemberId:null, memberSearchSelected:[], confirmBulkDelete:false}); },
  askDeleteMember: function(id) { return () => this.setState({confirmDeleteMemberId:id}); },
  cancelDeleteMember: function() { this.setState({confirmDeleteMemberId:null}); },
  confirmDeleteMember: async function() {
    const {confirmDeleteMemberId, memberSearchList, demo, currentUserId} = this.state;
    if(!confirmDeleteMemberId) return;
    if(confirmDeleteMemberId === currentUserId){ this._toast('You cannot delete your own account.','error'); this.setState({confirmDeleteMemberId:null}); return; }
    const person = memberSearchList.find(p=>p.id===confirmDeleteMemberId);
    const authId = person?.auth_id||null;
    this.setState({deletingMember:true});
    if(!demo){
      const {error} = await DB.personnel.deletePermanently(confirmDeleteMemberId, authId).catch(()=>({error:true}));
      if(error){ this._toast('Delete failed. Check your connection.','error'); this.setState({deletingMember:false}); return; }
    }
    this.setState(prev=>{
      const memberSearchList = prev.memberSearchList.filter(p=>p.id!==confirmDeleteMemberId);
      const personnel = prev.personnel.filter(p=>p.id!==confirmDeleteMemberId);
      const batchMembersCache = {...prev.batchMembersCache};
      Object.keys(batchMembersCache).forEach(k=>{ batchMembersCache[k]=(batchMembersCache[k]||[]).filter(p=>p.id!==confirmDeleteMemberId); });
      return {memberSearchList, personnel, batchMembersCache, deletingMember:false, confirmDeleteMemberId:null};
    });
    this._toast((person?.name||'Member')+' permanently deleted.');
  },

  toggleMemberSelect: function(id) { return () => this.setState(s=>{ const sel=s.memberSearchSelected; const next=sel.includes(id)?sel.filter(x=>x!==id):[...sel,id]; return {memberSearchSelected:next,confirmBulkDelete:false,confirmDeleteMemberId:null}; }); },
  clearMemberSelect: function() { this.setState({memberSearchSelected:[],confirmBulkDelete:false}); },
  askBulkDelete: function() { this.setState({confirmBulkDelete:true}); },
  cancelBulkDelete: function() { this.setState({confirmBulkDelete:false}); },
  executeBulkDelete: async function() {
    const {memberSearchSelected,memberSearchList,demo,currentUserId}=this.state;
    const safeIds = memberSearchSelected.filter(id => id !== currentUserId);
    if(!safeIds.length) return;
    if(safeIds.length < memberSearchSelected.length) this._toast('Your own account was excluded from the deletion.','error');
    this.setState({bulkDeleting:true});
    const failedIds = [];
    if(!demo){
      for(const id of safeIds){
        const person=memberSearchList.find(p=>p.id===id);
        const {error} = await DB.personnel.deletePermanently(id,person?.auth_id||null).catch(()=>({error:true}));
        if(error) failedIds.push(id);
      }
    }
    const succeededIds = safeIds.filter(id=>!failedIds.includes(id));
    const ids=new Set(succeededIds);
    this.setState(prev=>{
      const memberSearchList=prev.memberSearchList.filter(p=>!ids.has(p.id));
      const personnel=prev.personnel.filter(p=>!ids.has(p.id));
      const batchMembersCache={...prev.batchMembersCache};
      Object.keys(batchMembersCache).forEach(k=>{batchMembersCache[k]=(batchMembersCache[k]||[]).filter(p=>!ids.has(p.id));});
      const memberSearchSelected=prev.memberSearchSelected.filter(id=>!ids.has(id));
      return {memberSearchList,personnel,batchMembersCache,memberSearchSelected,confirmBulkDelete:false,bulkDeleting:false};
    });
    if(failedIds.length){
      this._toast(failedIds.length+' deletion'+(failedIds.length!==1?'s':'')+' failed. Check your connection.','error');
    }
    if(succeededIds.length){
      this._toast(succeededIds.length+' member'+(succeededIds.length!==1?'s':'')+' permanently deleted.');
    }
  },

  exportPersonHistory: function() {
    const s=this.state;
    const allPeople=[...s.personnel,...Object.values(s.batchMembersCache).flat()];
    const name=(allPeople.find(p=>p.id===s.personHistoryId)||{}).name||'Member';
    const rawRows=s.personHistoryRows||[];
    // Map raw DB rows to the same computed fields used in the person history modal builder
    const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],W=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const rows=rawRows.map(r=>{
      const mm=Utils.meta(r.status);
      const d=new Date(r.date+'T00:00:00');
      const editLog=r.edit_log||[];
      const latestEdit=editLog.length?editLog[editLog.length-1]:null;
      return {
        dateLabel:W[d.getDay()]+' '+d.getDate()+' '+M[d.getMonth()]+' '+d.getFullYear(),
        label:mm.label,
        p1:r.check_in_time?r.check_in_time.slice(0,5):'-',
        p4:r.work_end_time?r.work_end_time.slice(0,5):'-',
        adminCorrected:editLog.length>0,
        editedBy:latestEdit?.by||'',
      };
    });
    const xe=t=>String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const sc=(sid,v)=>`<Cell ss:StyleID="${sid}"><Data ss:Type="String">${xe(v)}</Data></Cell>`;
    const styles=`<Style ss:ID="ttl"><Font ss:Bold="1" ss:Size="13"/></Style><Style ss:ID="hdr"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2c3e50" ss:Pattern="Solid"/></Style><Style ss:ID="dat"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="s_present"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#27ae60"/><Interior ss:Color="#eafaf1" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="s_mc"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#e67e22"/><Interior ss:Color="#fef9e7" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="s_absent"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#c0392b"/><Interior ss:Color="#fdedec" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="s_other"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#5c6678"/><Interior ss:Color="#f0f2f5" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="tim"><Alignment ss:Horizontal="Center"/><Font ss:FontName="IBM Plex Mono" ss:Size="10.5"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style>`;
    const dataRows=rows.map(r=>{
      const sid='s_'+(r.label==='Present'?'present':r.label==='On MC'?'mc':r.label==='Absent'?'absent':'other');
      return `<Row ss:Height="22">${sc('dat',r.dateLabel)}${sc(sid,r.label)}${sc('tim',r.p1)}${sc('tim',r.p4)}${sc('dat',r.adminCorrected?'Corrected by '+r.editedBy:'')}</Row>`;
    }).join('');
    const xml=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles>${styles}</Styles><Worksheet ss:Name="History"><Table><Column ss:Width="150"/><Column ss:Width="80"/><Column ss:Width="70"/><Column ss:Width="70"/><Column ss:Width="130"/><Row ss:Height="28"><Cell ss:MergeAcross="4" ss:StyleID="ttl"><Data ss:Type="String">${xe(name+' - Attendance History')}</Data></Cell></Row><Row ss:Height="24">${sc('hdr','Date')}${sc('hdr','Status')}${sc('hdr','In')}${sc('hdr','Out')}${sc('hdr','Notes')}</Row>${dataRows}</Table></Worksheet></Workbook>`;
    const blob=new Blob([xml],{type:'text/xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name.replace(/\s+/g,'_')+'_history.xml';
    document.body.appendChild(a);a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},3000);
  },

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
      const shift = 'OFFICE';
      const valid = name.length>1 && /^[689]\d{7}$/.test(contact);
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

};
