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

  exportPersonHistory: async function() {
    if(typeof JSZip==='undefined'){this._toast('Export library not loaded. Please refresh and try again.','error');return;}
    const s=this.state;
    const allPeople=[...s.personnel,...Object.values(s.batchMembersCache).flat()];
    const name=(allPeople.find(p=>p.id===s.personHistoryId)||{}).name||'Member';
    const rawRows=s.personHistoryRows||[];
    const leaveSet=new Set((s.personHistoryLeaves||[]).map(l=>l.date));
    const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const W=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const rows=rawRows.map(r=>{
      const isPersonalLeave=r.status==='absent'&&leaveSet.has(r.date);
      const mm=isPersonalLeave?{label:'Personal Leave'}:Utils.meta(r.status);
      const d=new Date(r.date+'T00:00:00'), editLog=r.edit_log||[], latestEdit=editLog.length?editLog[editLog.length-1]:null;
      return {dateLabel:W[d.getDay()]+' '+d.getDate()+' '+M[d.getMonth()]+' '+d.getFullYear(),label:mm.label,p1:r.check_in_time?r.check_in_time.slice(0,5):'-',p4:r.work_end_time?r.work_end_time.slice(0,5):'-',note:editLog.length>0?'Corrected by '+(latestEdit?.by||''):'',statusKey:r.status==='present'?'present':r.status==='mc'?'mc':(isPersonalLeave?'leave':'absent')};
    });

    // ── OOXML utilities ──────────────────────────────────────────────────────
    const xe=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const cr=(row,c)=>String.fromCharCode(64+c)+row;
    const sc=(row,c,val,xf)=>`<c r="${cr(row,c)}" s="${xf}" t="inlineStr"><is><t>${xe(String(val))}</t></is></c>`;
    const mkFont=(bold,sz,color)=>`<font>${bold?'<b/>':''}<sz val="${sz}"/><color rgb="FF${color}"/><name val="Arial"/></font>`;
    const mkFill=c=>c==='none'?'<fill><patternFill patternType="none"/></fill>':c==='gray125'?'<fill><patternFill patternType="gray125"/></fill>':`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
    const thin=p=>`<${p} style="thin"><color rgb="FFE8EAED"/></${p}>`;
    const mkBorder=t=>t==='none'?'<border><left/><right/><top/><bottom/><diagonal/></border>':`<border>${thin('left')}${thin('right')}${thin('top')}${thin('bottom')}<diagonal/></border>`;
    const mkXf=(f,fi,b,h)=>`<xf numFmtId="0" fontId="${f}" fillId="${fi}" borderId="${b}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="center"/></xf>`;

    // Fonts: 0=normal  1=bold  2=bold13pt  3=boldWhite  4=boldGreen  5=boldAmber  6=boldRed  7=boldGrey
    const fontDefs=[mkFont(false,10,'000000'),mkFont(true,10,'000000'),mkFont(true,13,'000000'),mkFont(true,10,'FFFFFF'),mkFont(true,10,'27AE60'),mkFont(true,10,'E67E22'),mkFont(true,10,'C0392B'),mkFont(true,10,'5C6678')];
    // Fills: 0=none  1=gray125  2=darkHeader  3=green  4=amber  5=red  6=grey
    const fillKeys=['none','gray125','2C3E50','EAFAF1','FEF9E7','FDEDEC','F0F2F5'];
    // Borders: 0=none  1=thin-bottom
    const borderDefs=[mkBorder('none'),mkBorder('thin')];
    // Cell formats (xf):
    // 0=title  1=hdrC  2=dat  3=present  4=mc  5=absent  6=leave/other  7=time
    const xfDefs=[[2,0,0,'left'],[3,2,1,'center'],[0,0,1,'left'],[4,3,1,'center'],[5,4,1,'center'],[6,5,1,'center'],[7,6,1,'center'],[0,0,1,'center']];
    const XF={title:0,hdr:1,dat:2,present:3,mc:4,absent:5,other:6,time:7};

    const statusXf=k=>k==='present'?XF.present:k==='mc'?XF.mc:k==='absent'?XF.absent:XF.other;

    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${fontDefs.length}">${fontDefs.join('')}</fonts>
<fills count="${fillKeys.length}">${fillKeys.map(mkFill).join('')}</fills>
<borders count="${borderDefs.length}">${borderDefs.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfDefs.length}">${xfDefs.map(([f,fi,b,h])=>mkXf(f,fi,b,h)).join('')}</cellXfs>
</styleSheet>`;

    const shRows=[];
    // Row 1: title (merged A1:E1)
    shRows.push(`<row r="1" ht="28" customHeight="1">${sc(1,1,name+' - Attendance History',XF.title)}${[2,3,4,5].map(c=>`<c r="${cr(1,c)}" s="${XF.title}"/>`).join('')}</row>`);
    // Row 2: headers
    shRows.push(`<row r="2" ht="24" customHeight="1">${['Date','Status','In','Out','Notes'].map((h,i)=>sc(2,i+1,h,XF.hdr)).join('')}</row>`);
    // Data rows
    rows.forEach((r,i)=>{
      const row=i+3;
      shRows.push(`<row r="${row}" ht="22" customHeight="1">${sc(row,1,r.dateLabel,XF.dat)}${sc(row,2,r.label,statusXf(r.statusKey))}${sc(row,3,r.p1,XF.time)}${sc(row,4,r.p4,XF.time)}${sc(row,5,r.note,XF.dat)}</row>`);
    });

    const lastRow=rows.length+2;
    const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="14" customWidth="1"/><col min="3" max="4" width="10" customWidth="1"/><col min="5" max="5" width="22" customWidth="1"/></cols>
<sheetData>${shRows.join('')}</sheetData>
<mergeCells count="1"><mergeCell ref="A1:E1"/></mergeCells>
</worksheet>`;

    const zip=new JSZip();
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
    zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="History" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml',styles);
    zip.file('xl/worksheets/sheet1.xml',sheetXml);

    const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=name.replace(/\s+/g,'_')+'_history.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},3000);
    this._toast('Saved to Downloads.');
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
