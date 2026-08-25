// ── Admin People builder ───────────────────────────────────────────────────
const AdminPeople = {

  build: function(self, s, accent, ctx) {
    const {activeBatch,activeMembers,approvedByContact} = ctx;

    const _prSearch=(s.peopleRosterSearch||'').toLowerCase().trim();
    const _filteredActiveMembers=_prSearch?activeMembers.filter(p=>p.name.toLowerCase().includes(_prSearch)||(p.contact||'').toLowerCase().includes(_prSearch)):activeMembers;
    return {
      personnelList:_filteredActiveMembers.map(p=>{
        const av=s.avatars[p.id]||'';
        const _addedBySignup=approvedByContact.get(p.contact)||'';
        const _addedByAdmin=p.created_by||'';
        const approvedBy=_addedByAdmin||_addedBySignup;
        const approvedByLabel=_addedByAdmin?'Added by':'Approved by';
        return {...p,
          initials:Utils.initials(p.name),
          shiftLabel:Utils.shiftLabel(p.shift),
          onEditNote:self.openNote(p.id,p.notes||''),
          isEditingNote:s.editingNoteId===p.id,
          onAskDeactivate:self.askDeactivatePerson(p.id),
          isConfirmingDeactivate:s.confirmDeactivateId===p.id,
          statPresent:s.peopleStats[p.id]?.present??0,
          statMc:s.peopleStats[p.id]?.mc??0,
          statAbsent:s.peopleStats[p.id]?.absent??0,
          statPct:s.peopleStats[p.id]?.pct!=null?(s.peopleStats[p.id].pct+'%'):'No records',
          showStats:s.peopleStatsLoaded,
          lowAttendance:s.peopleStatsLoaded&&(s.peopleStats[p.id]?.pct??null)!==null&&s.peopleStats[p.id].pct<75,
          avatarStyle:Utils.avatarStyle(av),
          avatarInitials:av?'':Utils.initials(p.name),
          onViewHistory:self.openPersonHistory(p.id),
          approvedBy, approvedByLabel,
          showApprovedBy:!!approvedBy,
          onResetPw:self.openResetPw(p.id),
          canResetPw:true, resetPwBtnLabel:p.auth_id?'Reset PW':'Set PW',
        };
      }),
      personnelListEmpty:activeMembers.length===0,
      personnelSearchNoResults:activeMembers.length>0&&_filteredActiveMembers.length===0,
      peopleRosterSearch:s.peopleRosterSearch||'', hasPeopleRosterSearch:!!_prSearch,
      onPeopleRosterSearch:self.onPeopleRosterSearch, clearPeopleRosterSearch:self.clearPeopleRosterSearch,
      cancelDeactivatePerson:self.cancelDeactivatePerson,
      confirmDeactivatePerson:self.confirmDeactivatePerson,
      memberSearchOpen:s.memberSearchOpen, openMemberSearch:self.openMemberSearch, closeMemberSearch:self.closeMemberSearch,
      memberSelectedCount:s.memberSearchSelected.length, hasMemberSelection:s.memberSearchSelected.length>0,
      confirmBulkDeleteOpen:s.confirmBulkDelete, bulkDeleting:s.bulkDeleting,
      askBulkDelete:self.askBulkDelete, cancelBulkDelete:self.cancelBulkDelete, executeBulkDelete:self.executeBulkDelete, clearMemberSelect:self.clearMemberSelect,
      onMemberSearchText:self.onMemberSearchText, memberSearchText:s.memberSearchText||'',
      memberSearchLoaded:s.memberSearchLoaded, deletingMember:s.deletingMember,
      confirmDeleteMemberId:s.confirmDeleteMemberId,
      cancelDeleteMember:self.cancelDeleteMember, confirmDeleteMember:self.confirmDeleteMember,
      setMemberStatusAll:self.onMemberSearchStatus('all'), setMemberStatusActive:self.onMemberSearchStatus('current'), setMemberStatusInactive:self.onMemberSearchStatus('past'), setMemberStatusRemoved:self.onMemberSearchStatus('removed'),
      ...(()=>{
        const mf=s.memberSearchStatus||'all';
        const _msBtn=f=>`padding:5px 13px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ${mf===f?accent:'#d4d9e2'};background:${mf===f?accent:'#fff'};color:${mf===f?'#fff':'#5c6678'};white-space:nowrap;`;
        return {memberStatusAllStyle:_msBtn('all'),memberStatusActiveStyle:_msBtn('current'),memberStatusInactiveStyle:_msBtn('past'),memberStatusRemovedStyle:_msBtn('removed')};
      })(),
      onMemberSearchCycle:self.onMemberSearchCycle, memberSearchCycle:s.memberSearchCycle||'all',
      memberCycleOptions:(()=>{
        const seen=new Set();
        const opts=[{value:'all',label:'All cycles'}];
        const liveBatchId=(s.batches||[]).find(b=>b.is_live)?.id||null;
        if(liveBatchId) opts.push({value:liveBatchId,label:'Current cycle'});
        s.memberSearchList.forEach(p=>{
          if(p.batch_id&&p.batch_id!==liveBatchId&&!seen.has(p.batch_id)){
            seen.add(p.batch_id);
            const b=(s.batches||[]).find(x=>x.id===p.batch_id);
            if(b) opts.push({value:p.batch_id,label:b.label||Utils.dateKey(new Date(b.start_date)).slice(0,7)});
          }
        });
        return opts;
      })(),
      ...(()=>{
        const PAGE_SIZE=20;
        const liveBatchId=(s.batches||[]).find(b=>b.is_live)?.id||null;
        const _mMeta=p=>{
          if(!p.is_active) return {status:'removed',label:'Removed',color:'#8a94a3',bg:'#f0f2f5'};
          if(p.batch_id===liveBatchId) return {status:'current',label:'Current',color:'#1f8a5b',bg:'#e7f3ec'};
          return {status:'past',label:'Past',color:'#b9791a',bg:'#fff8ec'};
        };
        const q=(s.memberSearchText||'').toLowerCase().trim();
        const mf=s.memberSearchStatus||'all';
        const mc=s.memberSearchCycle||'all';
        const _getBatchLabel=p=>{const b=(s.batches||[]).find(x=>x.id===p.batch_id);return b?(b.label||Utils.dateKey(new Date(b.start_date)).slice(0,7)):'No cycle';};
        let filtered=s.memberSearchList;
        if(q) filtered=filtered.filter(p=>{const bl=_getBatchLabel(p).toLowerCase();return p.name.toLowerCase().includes(q)||(p.contact||'').toLowerCase().includes(q)||bl.includes(q);});
        if(mf!=='all') filtered=filtered.filter(p=>_mMeta(p).status===mf);
        if(mc!=='all') filtered=filtered.filter(p=>p.batch_id===mc);
        const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
        const page=Math.min(Math.max(1,s.memberSearchPage||1),totalPages);
        const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
        return {
          memberSearchRows:paged.map(p=>{
            const batchLabel=_getBatchLabel(p);
            const isConfirming=s.confirmDeleteMemberId===p.id;
            const _isSel=s.memberSearchSelected.includes(p.id);
            const mm=_mMeta(p);
            return {
              id:p.id, name:p.name, contact:p.contact||'', initials:Utils.initials(p.name),
              statusLabel:mm.label, statusColor:mm.color, statusBg:mm.bg,
              batchLabel, shiftLabel:Utils.shiftLabel(p.shift),
              isConfirming, onAskDelete:self.askDeleteMember(p.id),
              isSelected:_isSel, onToggleSelect:self.toggleMemberSelect(p.id),
              checkBorder:_isSel?'#3b5bdb':'#c8cdd6', checkBg:_isSel?'#3b5bdb':'#fff',
            };
          }),
          memberSearchEmpty:s.memberSearchLoaded&&filtered.length===0,
          memberSearchPage:page, memberSearchTotalPages:totalPages,
          memberSearchTotal:filtered.length,
          memberSearchHasPrev:page>1, memberSearchHasNext:page<totalPages,
          memberSearchShowPagination:totalPages>1,
          memberSearchPrevOpacity:page>1?'1':'0.35', memberSearchNextOpacity:page<totalPages?'1':'0.35',
          memberSearchPagePrev:()=>self.setState({memberSearchPage:Math.max(1,page-1)}),
          memberSearchPageNext:()=>self.setState({memberSearchPage:Math.min(totalPages,page+1)}),
          memberSearchPageLabel:`${page} / ${totalPages}`,
        };
      })(),
      leaveSearch:s.leaveSearch||'', onLeaveSearch:self.onLeaveSearch, clearLeaveSearch:self.clearLeaveSearch, hasLeaveSearch:!!(s.leaveSearch||'').trim(),
      ...(()=>{
        const _lq=(s.leaveSearch||'').toLowerCase().trim();
        const _lb=_lq?(s.pendingLeaves||[]).filter(l=>(l.personnel?.name||'').toLowerCase().includes(_lq)||(l.personnel?.contact||'').includes(_lq)):(s.pendingLeaves||[]);
        const _sorted=[..._lb].sort((a,b)=>{const aMs=a.created_at?Date.now()-new Date(a.created_at).getTime():0;const bMs=b.created_at?Date.now()-new Date(b.created_at).getTime():0;return bMs-aMs;});
        const _leaveAllIds=_sorted.map(l=>l.id);
        const _allLeavesSel=_leaveAllIds.length>0&&_leaveAllIds.every(id=>(s.leaveSelectedIds||[]).includes(id));
        const _nowMs=Date.now(),_2d=172800000;
        return {
          pendingLeaves:_sorted.map(l=>{const _ms=l.created_at?_nowMs-new Date(l.created_at).getTime():0,_h=Math.floor(_ms/3600000),_d=Math.floor(_h/24),isExpired=_ms>_2d,timeAgo=!l.created_at?'':_h<1?'Just now':_h<24?_h+' hr'+(_h!==1?'s':'')+' ago':_d+' day'+(_d!==1?'s':'')+' ago';return({
            id:l.id,reason:l.reason||'',
            personName:l.personnel?.name||'Unknown',
            initials:Utils.initials(l.personnel?.name||'?'),
            personShift:Utils.shiftLabel(l.personnel?.shift||'OFFICE'),
            typeLabel:l.type==='mc'?'MC':l.type==='other'?'Other':'Personal Leave',
            typeBg:l.type==='mc'?'#fdf6e9':'#f1f8f4',
            typeColor:l.type==='mc'?'#b9791a':'#1f8a5b',
            typeBorder:l.type==='mc'?'#f0e2c2':'#cfe6d8',
            dateLabel:l.date?Utils.fmtMed(new Date(l.date+'T00:00:00')):'',
            isSelected:(s.leaveSelectedIds||[]).includes(l.id),onToggleSelect:self.toggleLeaveSelect(l.id),
            checkBorder:(s.leaveSelectedIds||[]).includes(l.id)?'#3b5bdb':'#c8cdd6',
            checkBg:(s.leaveSelectedIds||[]).includes(l.id)?'#3b5bdb':'#fff',
            expiredOpacity:isExpired?'0.65':'1',expiredTimeColor:isExpired?'#c0392b':'#a0a8b4',
            onApprove:self.approveLeave(l.id),onReject:self.rejectLeave(l.id),
            isRejectOpen:s.rejectLeaveId===l.id,
            rejectLeaveReason:s.rejectLeaveId===l.id?s.rejectLeaveReason:'',
            onRejectLeaveReason:self.onRejectLeaveReason,
            confirmRejectLeave:self.confirmRejectLeave,
            cancelRejectLeave:self.cancelRejectLeave,
            timeAgo,isExpired,
          });
          }),
          leaveSearchHasNoResults:!!_lq&&(s.pendingLeaves||[]).length>0&&_lb.length===0,
          allLeavesSelected:_allLeavesSel,
          selectAllLeaves:self.selectAllLeaves,clearAllLeavesSelection:self.clearAllLeavesSelection,
          leaveSelectAllBorder:_allLeavesSel?'#3b5bdb':'#c8cdd6',leaveSelectAllBg:_allLeavesSel?'#3b5bdb':'#fff',
        };
      })(),
      pendingLeavesCount:(s.pendingLeaves||[]).length,
      hasPendingLeaves:(s.pendingLeaves||[]).length>0,
      pendingLeavesLoaded:s.pendingLeavesLoaded,
      leaveSelectedCount:(s.leaveSelectedIds||[]).length,
      hasLeaveSelection:(s.leaveSelectedIds||[]).length>0,
      clearLeaveSelect:self.clearLeaveSelect,
      bulkApproveLeaves:self.bulkApproveLeaves,
      bulkApproveBtnText:s.bulkApprovingLeaves?'Approving…':('Approve '+(s.leaveSelectedIds||[]).length),
      bulkApproveBtnOpacity:s.bulkApprovingLeaves?'0.55':'1',
      declineReqLabel:'Decline '+((s.leaveSelectedIds||[]).length)+' request'+(((s.leaveSelectedIds||[]).length)===1?'':'s')+'?',
      deleteMemberBtnText:s.deletingMember?'Deleting…':'Yes, delete',
      deleteMemberBtnOpacity:s.deletingMember?'0.55':'1',
      bulkDeleteBtnText:s.bulkDeleting?'Deleting…':'Yes, delete all',
      bulkDeleteBtnOpacity:s.bulkDeleting?'0.55':'1',
      askBulkLeaveReject:self.askBulkLeaveReject,
      confirmBulkLeaveReject:!!(s.confirmBulkLeaveReject),
      bulkLeaveRejectReason:s.bulkLeaveRejectReason||'',
      onBulkLeaveRejectReason:self.onBulkLeaveRejectReason,
      executeBulkLeaveReject:self.executeBulkLeaveReject,
      cancelBulkLeaveReject:self.cancelBulkLeaveReject,
      bulkApprovingLeaves:!!(s.bulkApprovingLeaves),
      isSuperAdmin:s.isSuperAdmin,
      addAdminOpen:s.addAdminOpen, toggleAddAdmin:self.toggleAddAdmin,
      promoteAdminOpen:s.promoteAdminOpen, togglePromoteAdmin:self.togglePromoteAdmin,
      adminsList:(s.adminsList||[]).map(a=>{
        const av=s.avatars[a.id]||'';
        return {
          id:a.id, name:a.name, contact:a.contact||'',
          roleLabel:a.role==='superadmin'?'Master':'Admin',
          roleColor:a.role==='superadmin'?'#b9791a':'#5c6678',
          isMaster:a.role==='superadmin',
          initials:Utils.initials(a.name),
          avatarStyle:Utils.avatarStyle(av),
          hasAvatar:!!av,
          avatarCursor:av?'cursor:pointer;':'',
          onViewAvatar:av?self.openAvatarLightbox(av):null,
          canDeactivate:a.id!==s.currentUserId&&a.role!=='superadmin',
          canResetPw:s.isSuperAdmin&&a.id!==s.currentUserId,
          onAskDeactivate:self.askDeactivateAdmin(a.id),
          onResetAdminPw:s.isSuperAdmin&&a.id!==s.currentUserId?self.openResetPw(a.id):null,
          isConfirming:s.confirmDeactivateAdminId===a.id,
          onConfirmDeactivate:self.confirmDeactivateAdmin,
          onCancelDeactivate:self.cancelDeactivateAdmin,
        };
      }),
      showAvatarLightbox:!!s.avatarLightboxUrl,
      avatarLightboxStyle:s.avatarLightboxUrl?`width:240px;height:240px;border-radius:50%;background-image:url("${(s.avatarLightboxUrl).replace(/"/g,'%22')}");background-size:cover;background-position:center;box-shadow:0 8px 40px rgba(0,0,0,0.5);flex-shrink:0;`:'',
      closeAvatarLightbox:self.closeAvatarLightbox,
      npAdminName:s.npAdminName, onNpAdminName:self.onNpAdminName,
      npAdminContact:s.npAdminContact, onNpAdminContact:self.onNpAdminContact,
      npAdminPassword:s.npAdminPassword, onNpAdminPassword:self.onNpAdminPassword,
      addAdmin:self.addAdmin,
      npPwType:s.showNpPw?'text':'password', showNpPw:!!s.showNpPw, hideNpPw:!s.showNpPw, toggleNpPw:self.toggleNpPw,
      npAdminPwType:s.showNpAdminPw?'text':'password', showNpAdminPw:!!s.showNpAdminPw, hideNpAdminPw:!s.showNpAdminPw, toggleNpAdminPw:self.toggleNpAdminPw,
      resetPwType:s.showResetPw?'text':'password', showResetPw:!!s.showResetPw, hideResetPw:!s.showResetPw, toggleResetPw:self.toggleResetPw,
      promoteAdminId:s.promoteAdminId, promoteSearch:s.promoteSearch,
      onPromoteSearch:self.onPromoteSearch, onPromoteSearchKeyDown:self.onPromoteSearchKeyDown,
      promoteShowAllCycles:s.promoteShowAllCycles,
      setPromoteCurrentCycle:self.setPromoteCurrentCycle, setPromoteAllCycles:self.setPromoteAllCycles,
      promoteAdminTargetName:s.promoteAdminId?(s.promoteAdminName||''):'',
      promoteAdminTargetContact:s.promoteAdminId?(s.promoteAdminContact||''):'',
      clearPromoteSelection:self.clearPromoteSelection,
      ...(()=>{
        const segActive='flex:1;padding:5px 8px;background:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;color:#161f30;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.1);';
        const segInactive='flex:1;padding:5px 8px;background:transparent;border:none;border-radius:6px;font-size:12px;font-weight:500;color:#8a94a3;cursor:pointer;';
        return {
          promoteFilterCurrentStyle:!s.promoteShowAllCycles?segActive:segInactive,
          promoteFilterAllStyle:s.promoteShowAllCycles?segActive:segInactive,
        };
      })(),
      promoteNextPage:self.promoteNextPage, promotePrevPage:self.promotePrevPage,
      ...((pab=>{
        const PROMOTE_PAGE_SIZE=8;
        const all=(s.personnel||[]).filter(p=>p.is_active!==false&&(p.role||'reservist')==='reservist');
        const base=s.promoteShowAllCycles?all:all.filter(p=>pab&&p.batch_id===pab.id);
        const q=(s.promoteSearch||'').toLowerCase().trim();
        const filtered=q?base.filter(p=>p.name.toLowerCase().includes(q)||(p.contact||'').includes(q)):base;
        const allRows=filtered.map(p=>{
          const b=(s.batches||[]).find(b=>b.id===p.batch_id);
          const av=(s.avatars||{})[p.id];
          return {id:p.id,name:p.name,contact:p.contact||'',batchLabel:b?b.label:'',contactBatchLine:(p.contact||'')+(b?' · '+b.label:''),initials:Utils.initials(p.name)||'?',avatarStyle:Utils.avatarStyle(av),
            onSelect:()=>self.setState({promoteAdminId:p.id,promoteAdminName:p.name,promoteAdminContact:p.contact||'',confirmPromoteAdminId:null,promoteSearch:''})};
        });
        const promoteTotalPages=Math.max(1,Math.ceil(allRows.length/PROMOTE_PAGE_SIZE));
        const safePage=Math.min(s.promoteListPage||1,promoteTotalPages);
        const promoteFilteredList=allRows.slice((safePage-1)*PROMOTE_PAGE_SIZE, safePage*PROMOTE_PAGE_SIZE);
        return {
          promoteFilteredList, promoteListEmpty:allRows.length===0,
          promoteListPage:safePage, promoteTotalPages,
          promoteHasPrev:safePage>1, promoteHasNext:safePage<promoteTotalPages,
          promoteHasPrevColor:safePage>1?'#161f30':'#c4c9d4', promoteHasPrevCursor:safePage>1?'pointer':'default',
          promoteHasNextColor:safePage<promoteTotalPages?'#161f30':'#c4c9d4', promoteHasNextCursor:safePage<promoteTotalPages?'pointer':'default',
          promoteShowPagination:promoteTotalPages>1,
          promotePageInfo:`${safePage} / ${promoteTotalPages}`,
        };
      })(self._liveBatch(s.batches))),
      confirmPromoteAdminId:s.confirmPromoteAdminId,
      askPromoteAdmin:self.askPromoteAdmin,
      cancelPromoteAdmin:self.cancelPromoteAdmin,
      confirmPromoteAdmin:self.confirmPromoteAdmin,
      signupSearch:s.signupSearch||'', onSignupSearch:self.onSignupSearch, clearSignupSearch:self.clearSignupSearch, hasSignupSearch:!!(s.signupSearch||'').trim(),
      ...(()=>{
        const _approvedContacts=new Set((s.approvedSignups||[]).map(a=>(a.contact||'').replace(/[\s-]/g,'')));
        const _sq=(s.signupSearch||'').toLowerCase().trim();
        const _base=_sq?s.pendingSignups.filter(r=>r.name.toLowerCase().includes(_sq)||(r.contact||'').includes(_sq)):s.pendingSignups;
        const _allIds=_base.map(r=>r.id);
        const _allSel=_allIds.length>0&&_allIds.every(id=>(s.selectedSignupIds||[]).includes(id));
        return {
          pendingSignups:_base.map(r=>{
            const b=(s.batches||[]).find(b=>b.id===r.batch_id);
            const isReactivation=_approvedContacts.has((r.contact||'').replace(/[\s-]/g,''));
            const isSelected=(s.selectedSignupIds||[]).includes(r.id);
            return {id:r.id,name:r.name,contact:r.contact,shift:r.shift,batchLabel:b?b.label:'',initials:Utils.initials(r.name)||'?',
              createdAt:r.created_at?new Date(r.created_at).toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'}):'',
              deptLabel:Utils.deptLabel(r.department),
              isReactivation,isNew:!isReactivation,
              isSelected,cardBg:isSelected?'#f0f2f7':'#fff',
              checkBorder:isSelected?'#161f30':'#c8cdd6',checkBg:isSelected?'#161f30':'#fff',
              onToggleSelect:self.toggleSignupSelect(r.id),
              onApprove:self.approveSignup(r.id),onReject:self.rejectSignup(r.id)};
          }),
          signupSearchHasNoResults:!!_sq&&s.pendingSignups.length>0&&_base.length===0,
          allSignupsSelected:_allSel,
          selectAllSignups:self.selectAllSignups,clearAllSignupsSelection:self.clearAllSignupsSelection,
          signupSelectAllBorder:_allSel?'#161f30':'#c8cdd6',signupSelectAllBg:_allSel?'#161f30':'#fff',
        };
      })(),
      hasPendingSignups:s.pendingSignups.length>0,
      pendingSignupsLoaded:!!(s.pendingSignupsLoaded),
      pendingSignupCount:s.pendingSignups.length,
      selectedSignupCount:(s.selectedSignupIds||[]).length,
      hasSelectedSignups:(s.selectedSignupIds||[]).length>0,
      onApproveSelected:self.approveSelected,
      rejectedSignups:(s.rejectedSignups||[]).map(r=>{
        const b=(s.batches||[]).find(b=>b.id===r.batch_id);
        const reviewedAt=r.reviewed_at?new Date(r.reviewed_at).toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'}):'';
        return {id:r.id,name:r.name,contact:r.contact,batchLabel:b?b.label:'',initials:Utils.initials(r.name)||'?',reviewedAt,reviewedBy:r.reviewed_by||'',onReopen:self.reopenSignup(r.id)};
      }),
      hasRejectedSignups:(s.rejectedSignups||[]).length>0,
      rejectedSignupsLoaded:!!(s.rejectedSignupsLoaded),
      rejectedSignupCount:(s.rejectedSignups||[]).length,
      rejectedSignupsHidden:!!(s.rejectedSignupsHidden),
      rejectedSignupsChevronRotate:s.rejectedSignupsHidden?'-90':'0',
      toggleRejectedSignups:()=>self.setState({rejectedSignupsHidden:!s.rejectedSignupsHidden}),
      // People sub-tabs
      ...(()=>{
        const tab=s.peopleTab||'requests';
        const pendingTotal=s.pendingSignups.length+(s.pendingLeaves||[]).length;
        const ptBtn=(active)=>active
          ?'flex:1;padding:8px 4px;background:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;color:#161f30;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.1);'
          :'flex:1;padding:8px 4px;background:transparent;border:none;font-size:13px;font-weight:500;color:#8a94a3;cursor:pointer;';
        return {
          ptRequests:tab==='requests', ptRoster:tab==='roster', ptAdmins:tab==='admins',
          setPeopleTabRequests:()=>self.setState({peopleTab:'requests'}),
          setPeopleTabRoster:()=>self.setState({peopleTab:'roster'}),
          setPeopleTabAdmins:()=>self.setState({peopleTab:'admins'}),
          ptRequestsStyle:ptBtn(tab==='requests'),
          ptRosterStyle:ptBtn(tab==='roster'),
          ptAdminsStyle:ptBtn(tab==='admins'),
          pendingTotalCount:pendingTotal,
          hasPendingRequests:pendingTotal>0,
        };
      })(),
    };
  },

};
