// ── Member search, history, and password reset handlers ───────────────────
const MemberSearchHandlers = {

  openPersonHistory: function(id) {
    return async () => {
      this.setState({personHistoryId:id,personHistoryRows:[],personHistoryLeaves:[],personHistoryLoading:true});
      if(!this.state.demo){
        const [data,leaves]=await Promise.all([
          DB.attendance.getHistory(id,Utils.dateKey(Utils.addDays(new Date(),1))).catch(()=>[]),
          DB.leaves.approvedByPerson(id).catch(()=>[]),
        ]);
        this.setState({personHistoryRows:data,personHistoryLeaves:leaves,personHistoryLoading:false});
      } else {
        this.setState({personHistoryLoading:false});
      }
    };
  },

  closePersonHistory: function() { this.setState({personHistoryId:null,personHistoryRows:[],personHistoryLeaves:[],personHistoryLoading:false,confirmWipeHistoryId:null}); },

  askWipeHistory:    function() { this.setState({confirmWipeHistoryId:this.state.personHistoryId}); },
  cancelWipeHistory: function() { this.setState({confirmWipeHistoryId:null}); },

  confirmWipeHistory: async function() {
    const id=this.state.confirmWipeHistoryId;
    if(!id) return;
    if(id===this.state.currentUserId){this._toast('You cannot delete your own account.','error');this.setState({confirmWipeHistoryId:null});return;}
    const s=this.state;
    const allLoaded=[...s.personnel,...Object.values(s.batchMembersCache).flat()];
    const person=allLoaded.find(p=>p.id===id);
    const authId=person?.auth_id||null, batchId=s.batches[s.activeBatchIdx||0]?.id;
    this.setState({wipingHistory:true});
    if(!s.demo){
      const {error}=await DB.personnel.deletePermanently(id,authId).catch(()=>({error:true}));
      if(error){this._toast('Delete failed. Check your connection.','error');this.setState({wipingHistory:false});return;}
    }
    this.setState(prev=>{
      const personnel=prev.personnel.filter(p=>p.id!==id);
      const batchMembersCache={...prev.batchMembersCache};
      Object.keys(batchMembersCache).forEach(k=>{batchMembersCache[k]=(batchMembersCache[k]||[]).filter(p=>p.id!==id);});
      return {personnel,batchMembersCache,wipingHistory:false,confirmWipeHistoryId:null,personHistoryId:null,personHistoryRows:[]};
    });
    this._toast((person?.name||'Member')+' permanently deleted.');
  },

  onMemberSearchStatus: function(v) { return () => this.setState({memberSearchStatus:v,memberSearchPage:1,confirmDeleteMemberId:null,memberSearchSelected:[],confirmBulkDelete:false}); },
  onMemberSearchCycle:  function(e) { this.setState({memberSearchCycle:e.target.value,memberSearchPage:1,confirmDeleteMemberId:null,memberSearchSelected:[],confirmBulkDelete:false}); },

  openMemberSearch: async function() {
    this.setState({memberSearchOpen:true,memberSearchLoaded:false,memberSearchText:'',memberSearchList:[],memberSearchStatus:'all',memberSearchCycle:'all',memberSearchPage:1,memberSearchSelected:[],confirmDeleteMemberId:null,confirmBulkDelete:false});
    if(!this.state.demo){
      const data=await DB.personnel.listAll(this._myDept()).catch(()=>[]);
      this.setState({memberSearchList:data,memberSearchLoaded:true});
    } else {
      this.setState({memberSearchLoaded:true});
    }
  },
  closeMemberSearch:  function() { this.setState({memberSearchOpen:false,memberSearchText:'',confirmDeleteMemberId:null}); },
  onMemberSearchText: function(e) { this.setState({memberSearchText:e.target.value,memberSearchPage:1,confirmDeleteMemberId:null,memberSearchSelected:[],confirmBulkDelete:false}); },
  askDeleteMember:    function(id) { return () => this.setState({confirmDeleteMemberId:id}); },
  cancelDeleteMember: function() { this.setState({confirmDeleteMemberId:null}); },

  confirmDeleteMember: async function() {
    const {confirmDeleteMemberId,memberSearchList,demo,currentUserId}=this.state;
    if(!confirmDeleteMemberId) return;
    if(confirmDeleteMemberId===currentUserId){this._toast('You cannot delete your own account.','error');this.setState({confirmDeleteMemberId:null});return;}
    const person=memberSearchList.find(p=>p.id===confirmDeleteMemberId), authId=person?.auth_id||null;
    this.setState({deletingMember:true});
    if(!demo){
      const {error}=await DB.personnel.deletePermanently(confirmDeleteMemberId,authId).catch(()=>({error:true}));
      if(error){this._toast('Delete failed. Check your connection.','error');this.setState({deletingMember:false});return;}
    }
    this.setState(prev=>{
      const memberSearchList=prev.memberSearchList.filter(p=>p.id!==confirmDeleteMemberId);
      const personnel=prev.personnel.filter(p=>p.id!==confirmDeleteMemberId);
      const batchMembersCache={...prev.batchMembersCache};
      Object.keys(batchMembersCache).forEach(k=>{batchMembersCache[k]=(batchMembersCache[k]||[]).filter(p=>p.id!==confirmDeleteMemberId);});
      return {memberSearchList,personnel,batchMembersCache,deletingMember:false,confirmDeleteMemberId:null};
    });
    this._toast((person?.name||'Member')+' permanently deleted.');
  },

  toggleMemberSelect: function(id) { return () => this.setState(s=>{const sel=s.memberSearchSelected,next=sel.includes(id)?sel.filter(x=>x!==id):[...sel,id];return{memberSearchSelected:next,confirmBulkDelete:false,confirmDeleteMemberId:null};});},
  clearMemberSelect:  function() { this.setState({memberSearchSelected:[],confirmBulkDelete:false}); },
  askBulkDelete:      function() { this.setState({confirmBulkDelete:true}); },
  cancelBulkDelete:   function() { this.setState({confirmBulkDelete:false}); },

  executeBulkDelete: async function() {
    const {memberSearchSelected,memberSearchList,demo,currentUserId}=this.state;
    const safeIds=memberSearchSelected.filter(id=>id!==currentUserId);
    if(!safeIds.length) return;
    if(safeIds.length<memberSearchSelected.length) this._toast('Your own account was excluded from the deletion.','error');
    this.setState({bulkDeleting:true});
    const failedIds=[];
    if(!demo){
      for(const id of safeIds){
        const person=memberSearchList.find(p=>p.id===id);
        const {error}=await DB.personnel.deletePermanently(id,person?.auth_id||null).catch(()=>({error:true}));
        if(error) failedIds.push(id);
      }
    }
    const succeededIds=safeIds.filter(id=>!failedIds.includes(id)), ids=new Set(succeededIds);
    this.setState(prev=>{
      const memberSearchList=prev.memberSearchList.filter(p=>!ids.has(p.id));
      const personnel=prev.personnel.filter(p=>!ids.has(p.id));
      const batchMembersCache={...prev.batchMembersCache};
      Object.keys(batchMembersCache).forEach(k=>{batchMembersCache[k]=(batchMembersCache[k]||[]).filter(p=>!ids.has(p.id));});
      return {memberSearchList,personnel,batchMembersCache,memberSearchSelected:prev.memberSearchSelected.filter(id=>!ids.has(id)),confirmBulkDelete:false,bulkDeleting:false};
    });
    if(failedIds.length) this._toast(failedIds.length+' deletion'+(failedIds.length!==1?'s':'')+' failed. Check your connection.','error');
    if(succeededIds.length) this._toast(succeededIds.length+' member'+(succeededIds.length!==1?'s':'')+' permanently deleted.');
  },

  exportPersonHistory: function() {
    const s=this.state;
    const allPeople=[...s.personnel,...Object.values(s.batchMembersCache).flat()];
    const name=(allPeople.find(p=>p.id===s.personHistoryId)||{}).name||'Member';
    const rawRows=s.personHistoryRows||[];
    const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const W=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const rows=rawRows.map(r=>{
      const mm=Utils.meta(r.status), d=new Date(r.date+'T00:00:00'), editLog=r.edit_log||[], latestEdit=editLog.length?editLog[editLog.length-1]:null;
      return {dateLabel:W[d.getDay()]+' '+d.getDate()+' '+M[d.getMonth()]+' '+d.getFullYear(),label:mm.label,p1:r.check_in_time?r.check_in_time.slice(0,5):'-',p4:r.work_end_time?r.work_end_time.slice(0,5):'-',adminCorrected:editLog.length>0,editedBy:latestEdit?.by||''};
    });
    const xe=t=>String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const sc=(sid,v)=>`<Cell ss:StyleID="${sid}"><Data ss:Type="String">${xe(v)}</Data></Cell>`;
    const styles=`<Style ss:ID="ttl"><Font ss:Bold="1" ss:Size="13"/></Style><Style ss:ID="hdr"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2c3e50" ss:Pattern="Solid"/></Style><Style ss:ID="dat"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="s_present"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#27ae60"/><Interior ss:Color="#eafaf1" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="s_mc"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#e67e22"/><Interior ss:Color="#fef9e7" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="s_absent"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#c0392b"/><Interior ss:Color="#fdedec" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="s_other"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#5c6678"/><Interior ss:Color="#f0f2f5" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style><Style ss:ID="tim"><Alignment ss:Horizontal="Center"/><Font ss:FontName="IBM Plex Mono" ss:Size="10.5"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e8eaed"/></Borders></Style>`;
    const dataRows=rows.map(r=>{
      const sid='s_'+(r.label==='Present'?'present':r.label==='MC'?'mc':r.label==='Absent'?'absent':'other');
      return `<Row ss:Height="22">${sc('dat',r.dateLabel)}${sc(sid,r.label)}${sc('tim',r.p1)}${sc('tim',r.p4)}${sc('dat',r.adminCorrected?'Corrected by '+r.editedBy:'')}</Row>`;
    }).join('');
    const xml=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles>${styles}</Styles><Worksheet ss:Name="History"><Table><Column ss:Width="150"/><Column ss:Width="80"/><Column ss:Width="70"/><Column ss:Width="70"/><Column ss:Width="130"/><Row ss:Height="28"><Cell ss:MergeAcross="4" ss:StyleID="ttl"><Data ss:Type="String">${xe(name+' - Attendance History')}</Data></Cell></Row><Row ss:Height="24">${sc('hdr','Date')}${sc('hdr','Status')}${sc('hdr','In')}${sc('hdr','Out')}${sc('hdr','Notes')}</Row>${dataRows}</Table></Worksheet></Workbook>`;
    const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download=name.replace(/\s+/g,'_')+'_history.xls';
    document.body.appendChild(a);a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},3000);
  },

  openResetPw:  function(id) { return () => this.setState({resetPwId:id,resetPwNew:'',resetPwSaving:false}); },
  closeResetPw: function() { this.setState({resetPwId:null,resetPwNew:'',showResetPw:false}); },
  onResetPwNew: function(e) { this.setState({resetPwNew:e.target.value}); },

  submitResetPw: async function() {
    const {resetPwId,resetPwNew,personnel,demo}=this.state;
    if(!resetPwId) return;
    if(!resetPwNew||resetPwNew.length<6){this._toast('Password must be at least 6 characters.','error');return;}
    if(demo){this._toast('Cannot reset passwords in demo mode.','error');return;}
    const _all=[...personnel,...Object.values(this.state.batchMembersCache||{}).flat(),...(this.state.adminsList||[])];
    const p=_all.find(x=>x.id===resetPwId);
    if(!p){this._toast('Person not found.','error');return;}
    if((p.role==='admin'||p.role==='superadmin')&&!this.state.isSuperAdmin){this._toast('Access denied.','error');return;}
    if(!this.state.isSuperAdmin&&p.department&&p.department!==this._myDept()){this._toast('Access denied.','error');return;}
    this.setState({resetPwSaving:true});
    if(!p.auth_id){
      const {user,error}=await DB.auth.createUserAsAdmin(p.contact,resetPwNew,p.name);
      if(error||!user){this.setState({resetPwSaving:false});this._toast('Failed to create login account.','error');return;}
      await DB.personnel.linkAuth(p.id,user.id).catch(()=>{});
      this.setState(s=>({personnel:s.personnel.map(x=>x.id===resetPwId?{...x,auth_id:user.id}:x),resetPwSaving:false}));
      this._toast((p.name||'Person')+' now has a login account.');
    } else {
      const {error}=await DB.auth.adminResetPassword(p.auth_id,resetPwNew);
      this.setState({resetPwSaving:false});
      if(error){this._toast('Failed to reset password.','error');return;}
      this._toast((p.name||'Person')+"'s password has been reset.");
    }
    this.setState({resetPwId:null,resetPwNew:'',showResetPw:false});
  },

};
