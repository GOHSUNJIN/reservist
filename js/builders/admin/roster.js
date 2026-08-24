// ── Admin Roster builder ───────────────────────────────────────────────────
const AdminRoster = {

  build: function(self, s, accent, ctx) {
    const {activeBatch,activeMembers,viewOffset,viewDate,viewIsToday,viewReportDay,viewDateKey,viewMap,viewBlocked,isDekit,viewShowReporting,present,mc,pending,absent} = ctx;
    const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const beforeBatchStart=!!(activeBatch?.start_date&&viewDateKey<activeBatch.start_date);
    const visibleMembers=beforeBatchStart?[]:activeMembers;
    const roster=visibleMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent',time:'-'}, mm=Utils.meta(r.status);
      const cardStyle='background:#fff;border:1px solid #e3e6ec;border-left:3px solid '+mm.color+';border-radius:12px;padding:11px 13px;box-shadow:0 1px 5px rgba(20,30,50,.06);';
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av.replace(/"/g,'%22')}");background-size:cover;background-position:center;color:transparent;`:'';
      const _phaseParts=[r.p1?'IN '+r.p1:null,r.p2?('LCH '+r.p2):null,r.p3?'BACK '+r.p3:null,r.p4?'OUT '+r.p4:null].filter(Boolean);
      const phaseLine=_phaseParts.join('  ·  ');
      const showPhaseLine=r.status==='present'&&_phaseParts.length>0;
      const _pct=s.peopleStats[p.id]?.pct??null;
      return {id:p.id,name:p.name,contact:p.contact||'',initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),shiftWindow:Utils.shiftWindow(p.shift),shift:p.shift,status:r.status,time:r.p1||'-',label:mm.label,color:mm.color,bg:mm.bg,geo:(r.status==='present'&&r.p1dist!=null)?(', GPS verified '+r.p1dist+' m'):'',markPresent:self.setStatus(p.id,'present'),markMc:self.setStatus(p.id,'mc'),markAbsent:self.setStatus(p.id,'absent'),onViewHistory:self.openPersonHistory(p.id),cardStyle,avatarStyle,phaseLine,showPhaseLine,welfareNote:r.welfareNote||'',showWelfareNote:!!(r.welfareNote),canMark:viewOffset<=0,
        lowAttendance:s.peopleStatsLoaded&&_pct!==null&&_pct<75,
        statPctText:s.peopleStatsLoaded&&_pct!==null?(_pct+'%'):''};
    });
    const search=(s.rosterSearch||'').toLowerCase();
    const filteredRoster=roster.filter(r=>!search||r.name.toLowerCase().includes(search));
    const rosterStatusFilter=s.rosterStatusFilter||'all';
    const statusFilteredRoster=rosterStatusFilter==='all'?filteredRoster:filteredRoster.filter(r=>{
      if(rosterStatusFilter==='present') return r.status==='present';
      if(rosterStatusFilter==='mc') return r.status==='mc';
      if(rosterStatusFilter==='absent') return r.status==='absent';
      if(rosterStatusFilter==='pending') return r.status==='pending';
      return true;
    });
    const sortKey=s.rosterSort||'name';
    const sortedFiltered=[...statusFilteredRoster].sort((a,b)=>{
      if(sortKey==='status'){const ord={present:0,mc:1,pending:2,absent:3};return (ord[a.status]??4)-(ord[b.status]??4);}
      return a.name.localeCompare(b.name);
    });
    const _sb='flex:1;padding:7px 8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;white-space:nowrap;transition:background .15s,color .15s;';
    const _sa=_sb+'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.12);';
    const _si=_sb+'background:transparent;color:#8a94a3;';
    const rosterSortNameStyle=sortKey==='name'?_sa:_si;
    const rosterSortStatusStyle=sortKey==='status'?_sa:_si;
    const _rSBtn=(f)=>`padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;border:1px solid ${rosterStatusFilter===f?accent:'#d4d9e2'};background:${rosterStatusFilter===f?accent:'#fff'};color:${rosterStatusFilter===f?'#fff':'#5c6678'};`;
    const rosterStatusAllStyle=_rSBtn('all'),rosterStatusPresentStyle=_rSBtn('present'),rosterStatusMcStyle=_rSBtn('mc'),rosterStatusAbsentStyle=_rSBtn('absent'),rosterStatusPendingStyle=_rSBtn('pending');
    const total=roster.length;
    const snapshotLastLine=viewIsToday?('⏳ Pending ('+pending+'): '+(roster.filter(r=>r.label==='Pending').map(r=>r.name).join(', ')||'(none)')):('❌ Absent ('+absent+'): '+(roster.filter(r=>r.label==='Absent').map(r=>r.name).join(', ')||'(none)'));
    const _orgN=self.props.orgName||'Ops Security';
    const snapshotLines=['📋 *'+_orgN+', '+Utils.fmtMed(viewDate)+'*','✅ Present ('+present+'): '+(roster.filter(r=>r.label==='Present').map(r=>r.name).join(', ')||'(none)'),'🤒 MC ('+mc+'): '+(roster.filter(r=>r.label==='On MC').map(r=>r.name).join(', ')||'(none)'),snapshotLastLine];
    const snapshotLink='https://api.whatsapp.com/send?text='+encodeURIComponent(snapshotLines.join('\n'));
    const nowHhmm=Utils.hhmm(s.now);
    const isLiveView=viewOffset===0;
    const logRows=visibleMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent'}, mm=Utils.meta(r.status);
      const [_cc,_ccm]='09:00'.split(':').map(Number);
      const _lm=r.p1?(()=>{const[h,m]=r.p1.split(':').map(Number);return(h*60+m)-(_cc*60+_ccm);})():0;
      const isLate=r.status==='present'&&_lm>=60;
      const lateReason=r.lateReason||'';
      const showLateReason=isLate&&!!lateReason;
      const showNoLateReason=isLate&&!lateReason;
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av.replace(/"/g,'%22')}");background-size:cover;background-position:center;color:transparent;`:'';
      return {
        id:p.id, name:p.name, contact:p.contact||'', initials:Utils.initials(p.name), shiftLabel:Utils.shiftLabel(p.shift),
        onViewHistory:self.openPersonHistory(p.id),
        label:mm.label, color:mm.color, bg:mm.bg, isLate,
        lateReason, showLateReason, showNoLateReason,
        welfareNote:r.welfareNote||'', showWelfareNote:!!(r.welfareNote),
        logNoteIconColor:r.welfareNote?'#1f8a5b':'#5c6678',
        isEditingLogNote:s.logNoteId===p.id,
        onEditLogNote:self.openLogNote(p.id, r.welfareNote||''),
        showNoGps: !!(r.gpsBypassed),
        editSummary: (()=>{const log=r.editLog||[];if(!log.length)return'';const e=log[log.length-1];const d=new Date(e.at);const sg=new Date(d.getTime()+8*3600*1000);const hh=String(sg.getUTCHours()).padStart(2,'0'),mm2=String(sg.getUTCMinutes()).padStart(2,'0');const day=sg.getUTCDate(),mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][sg.getUTCMonth()];return'Edited by '+(e.by||'Admin')+' · '+hh+':'+mm2+', '+day+' '+mon;})(),
        showEditSummary: !!(r.editLog&&r.editLog.length),
        phaseP1Part: r.status==='present'?('IN '+(r.p1||'-')):'',
        phaseP1Color: isLate?'#c0392b':'#2c3a50',
        phaseRestPart: r.status==='present'?('  ·  LCH '+(r.p2||'-')+'  ·  BACK '+(r.p3||'-')+'  ·  OUT '+(r.p4||'-')):'',
        showPhaseLine: r.status==='present',
        p1:r.p1||'-', p2:r.p2||'-', p3:r.p3||'-', p4:r.p4||'-',
        p1Color:r.p1?(isLate?'#c0392b':'#161f30'):'#c2c8d2',
        p2Color:r.p2?'#161f30':'#c2c8d2',
        p3Color:r.p3?'#161f30':'#c2c8d2',
        p4Color:r.p4?'#161f30':'#c2c8d2',
        avatarStyle, shift:p.shift||'OFFICE',
        p2Label:'LCH',
        p2FormLabel:'Lunch',
        p3Label:'Return (lunch)',
        isTimesEditing:s.timesEditId===p.id,
        onEditTimes:self.openTimesEdit(p.id),
        ...(() => {
          const showMealBadge=r.status==='present'&&!!r.p1&&(!!r.p4||isLiveView);
          if(!showMealBadge) return {showMealBadge:false};
          const mealOk=Utils.mealEligible(r,nowHhmm);
          const workMinsVal=Utils.workMins(r,nowHhmm);
          const done=!!r.p4;
          return {
            showMealBadge:true,
            mealBadgeText:mealOk?(done?'Meal eligible':'On track'):(done?'No meal allowance':'No meal claim'),
            mealBadgeColor:mealOk?'#1f8a5b':(done?'#c0392b':'#b9791a'),
            mealBadgeBg:mealOk?'#e7f3ec':(done?'#f7e4e1':'#fdf6e9'),
            mealBadgeBorder:mealOk?'#a8d5bb':(done?'#e5a9a4':'#f0e2c2'),
            showWorkTime:workMinsVal>0,
            workTimeText:Utils.fmtMins(workMinsVal)+' worked',
          };
        })(),
      };
    });
    const logStatusFilter=s.logStatusFilter||'all';
    const logSearch=(s.logSearch||'').toLowerCase().trim();
    const statusFiltered=logStatusFilter==='all'?logRows:logRows.filter(r=>{
      if(logStatusFilter==='present') return r.label==='Present';
      if(logStatusFilter==='mc') return r.label==='On MC';
      if(logStatusFilter==='absent') return r.label==='Absent';
      if(logStatusFilter==='pending') return r.label==='Pending';
      return true;
    });
    const filteredLogRows=logSearch?statusFiltered.filter(r=>r.name.toLowerCase().includes(logSearch)):statusFiltered;
    const pendingCount=logRows.filter(r=>r.label==='Pending').length;
    const _fSBtn=(f)=>`padding:5px 11px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;border:1px solid ${logStatusFilter===f?accent:'#d4d9e2'};background:${logStatusFilter===f?accent:'#fff'};color:${logStatusFilter===f?'#fff':'#5c6678'};`;
    const lateRows=viewIsToday?logRows.filter(r=>r.isLate):[];
    const lateCount=lateRows.length;
    const lateNames=lateRows.map(r=>r.name).join(', ');
    const showLateAlert=viewIsToday&&lateCount>0&&lateCount>(s.lateAlertDismissedCount||0);
    const lateAlertLabel=lateCount===1?'1 late check-in':lateCount+' late check-ins';
    const logDateLabel=viewIsToday?'TODAY\'S LOG':((WD[viewDate.getDay()]+' '+viewDate.getDate()+' '+MON[viewDate.getMonth()]).toUpperCase()+' LOG');
    const dlabel=WD[viewDate.getDay()]+' '+viewDate.getDate()+' '+MON[viewDate.getMonth()];
    const rel=viewOffset===0?'Today':viewOffset===-1?'Yesterday':viewOffset===1?'Tomorrow':'';
    const viewDateLabel=(rel?rel+', ':'')+dlabel;
    const viewHoliday=Utils.holidayName(viewDate);
    const viewNoReporting=!viewShowReporting;
    const viewDateSub=!viewReportDay?'Weekend, no reporting':viewHoliday?'Public holiday':isDekit?'Dekit day':viewBlocked?'No reporting, toggled off':viewOffset<0?'Past shift, recorded':viewOffset>0?'Scheduled':'Live now';
    const viewNoRepReason=!viewReportDay?'This is a weekend. Reservists do not report on Saturdays or Sundays.':viewHoliday?(viewHoliday+' is a public holiday, so reservists are not required to report.'):isDekit?'Dekit day: reservists return equipment and submit forms. No regular reporting.':'This day is marked as a no-reporting day, so reservists are not required to report.';
    const showRepToggle=viewReportDay&&!isDekit, repToggleLocked=!!viewHoliday, repToggleOn=viewBlocked;
    const noRepMsg=viewHoliday?('Public holiday ('+viewHoliday+'). Auto no-reporting, locked.'):repToggleOn?'On. Reservists are not required to report this day.':'Off. Reservists report and check in as normal.';
    const viewRoster=visibleMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent',time:'-'}, mm=Utils.meta(r.status);
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av.replace(/"/g,'%22')}");background-size:cover;background-position:center;color:transparent;`:'';
      return {id:p.id,name:p.name,contact:p.contact||'',initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),label:mm.label,color:mm.color,bg:mm.bg,timeText:(r.status==='present'&&r.p1)?r.p1:'',avatarStyle,welfareNote:r.welfareNote||'',showWelfareNote:!!(r.welfareNote),onViewHistory:self.openPersonHistory(p.id)};
    });
    const vPresent=viewRoster.filter(r=>r.label==='Present').length, vMc=viewRoster.filter(r=>r.label==='On MC').length, vAbsent=viewRoster.filter(r=>r.label==='Absent').length, vPending=viewRoster.filter(r=>r.label==='Pending').length, vTotal=viewRoster.length;
    const vPercent=vTotal?Math.round((vPresent+vMc)/vTotal*100):0;
    const viewListHeader=viewOffset<0?'ATTENDANCE RECORD':viewOffset>0?'SCHEDULED ROSTER':'LIVE STATUS';
    const viewPercentText=viewOffset>0?(vTotal+' rostered'):(vPercent+'% reported');
    const viewPercentColor=viewOffset>0?'#8a94a3':'#1f8a5b';
    const vThirdLabel=viewOffset<0?'Absent':'Pending', vThirdVal=viewOffset<0?vAbsent:vPending, vThirdColor=viewOffset<0?'#c0392b':'#5c6678';

    return {
      roster, filteredRoster:sortedFiltered, logRows:filteredLogRows, logRowsEmpty:filteredLogRows.length===0,
      logTrulyEmpty:logRows.length===0, logFilterEmpty:logRows.length>0&&filteredLogRows.length===0,
      showLogFilterCount:(logStatusFilter!=='all'||!!logSearch)&&filteredLogRows.length>0,
      logFilterCountLabel:filteredLogRows.length+' result'+(filteredLogRows.length!==1?'s':''),
      logDateLabel,
      timesEditP1:s.timesEditP1||'', timesEditP2:s.timesEditP2||'', timesEditP3:s.timesEditP3||'', timesEditP4:s.timesEditP4||'',
      timesEditSaving:s.timesEditSaving||false,
      ...(()=>{const _iStyle=k=>{const err=s.timesEditErrField===k;return`width:100%;padding:8px 10px;border:1.5px solid ${err?'#c0392b':'#d4d9e2'};border-radius:8px;font-size:13px;font-family:'IBM Plex Mono',monospace;outline:none;background:${err?'#fff5f5':'#f6f8fa'};box-sizing:border-box;color:#161f30;`;};return{timesEditP1Style:_iStyle('p1'),timesEditP2Style:_iStyle('p2'),timesEditP3Style:_iStyle('p3'),timesEditP4Style:_iStyle('p4')};})(),
      onTimesP1:self.onTimesP1, onTimesP2:self.onTimesP2, onTimesP3:self.onTimesP3, onTimesP4:self.onTimesP4,
      saveTimesEdit:self.saveTimesEdit, closeTimesEdit:self.closeTimesEdit,
      setLogStatusAll:self.setLogStatusFilter('all'), setLogStatusPresent:self.setLogStatusFilter('present'),
      setLogStatusMc:self.setLogStatusFilter('mc'), setLogStatusAbsent:self.setLogStatusFilter('absent'), setLogStatusPending:self.setLogStatusFilter('pending'),
      logStatusAllStyle:_fSBtn('all'), logStatusPresentStyle:_fSBtn('present'),
      logStatusMcStyle:_fSBtn('mc'), logStatusAbsentStyle:_fSBtn('absent'), logStatusPendingStyle:_fSBtn('pending'),
      askMarkAllAbsent:self.askMarkAllAbsent, markAllAbsent:self.markAllAbsent,
      cancelMarkAllAbsent:self.cancelMarkAllAbsent,
      markingAllAbsent:s.markingAllAbsent, confirmMarkAllAbsent:s.confirmMarkAllAbsent, notConfirmMarkAllAbsent:!s.confirmMarkAllAbsent,
      markAllAbsentStyle:`padding:5px 9px;border-radius:7px;cursor:pointer;border:1px solid #f7e4e1;background:#fff;color:#c0392b;opacity:${s.markingAllAbsent?'0.45':'1'};display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;white-space:nowrap;`,
      markAllAbsentConfirmStyle:`padding:5px 11px;border-radius:7px;font-size:11.5px;font-weight:700;cursor:pointer;border:none;background:#c0392b;color:#fff;`,
      pendingCount,
      logSearch:s.logSearch||'', onLogSearch:self.onLogSearch, onLogSearchKeyDown:self.onLogSearchKeyDown, clearLogSearch:self.clearLogSearch, hasLogSearch:!!(s.logSearch),
      personHistoryOpen:!!s.personHistoryId,
      personHistoryName:([...s.personnel,...(s.batchMembersCache[activeBatch?.id]||[])].find(p=>p.id===s.personHistoryId)||{}).name||'',
      personHistoryLoading:s.personHistoryLoading,
      confirmWipeHistoryOpen:!!(s.confirmWipeHistoryId&&s.confirmWipeHistoryId===s.personHistoryId),
      wipingHistory:s.wipingHistory,
      wipeHistoryBtnText:s.wipingHistory?'Deleting…':'Yes, delete',
      wipeHistoryBtnOpacity:s.wipingHistory?'0.55':'1',
      askWipeHistory:self.askWipeHistory, confirmWipeHistory:self.confirmWipeHistory, cancelWipeHistory:self.cancelWipeHistory,
      ...(()=>{
        const _phAll=s.personHistoryRows||[];
        const _phFilter=s.personHistoryFilter||'all';
        const _M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],_W=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const _phFiltered=_phFilter==='all'?_phAll:_phAll.filter(r=>{
          if(_phFilter==='present') return r.status==='present';
          if(_phFilter==='mc') return r.status==='mc';
          if(_phFilter==='absent') return r.status==='absent';
          return true;
        });
        const _phPS=15,_phTotalPages=Math.max(1,Math.ceil(_phFiltered.length/_phPS));
        const _phPage=Math.min(Math.max(1,s.personHistoryPage||1),_phTotalPages);
        const _phPaged=_phFiltered.slice((_phPage-1)*_phPS,_phPage*_phPS);
        const _phRows=_phPaged.map(r=>{const mm=Utils.meta(r.status);const d=new Date(r.date+'T00:00:00');const el=r.edit_log||[];const le=el.length?el[el.length-1]:null;return{dateLabel:_W[d.getDay()]+' '+d.getDate()+' '+_M[d.getMonth()]+' '+d.getFullYear(),label:mm.label,color:mm.color,bg:mm.bg,p1:r.check_in_time?r.check_in_time.slice(0,5):'-',p4:r.work_end_time?r.work_end_time.slice(0,5):'-',adminCorrected:el.length>0,editedBy:le?.by||''};});
        const _phSBtn=(f)=>`padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${_phFilter===f?accent:'#d4d9e2'};background:${_phFilter===f?accent:'#fff'};color:${_phFilter===f?'#fff':'#5c6678'};white-space:nowrap;`;
        return {
          personHistoryRows:_phRows,
          personHistoryTotal:_phAll.length,
          noPersonHistory:!_phAll.length&&!s.personHistoryLoading,
          noPersonHistoryFiltered:_phAll.length>0&&_phFiltered.length===0,
          personHistoryFilter:_phFilter,
          personHistoryPage:_phPage,personHistoryTotalPages:_phTotalPages,
          personHistoryHasPrev:_phPage>1,personHistoryHasNext:_phPage<_phTotalPages,
          personHistoryShowPagination:_phTotalPages>1,
          personHistoryPrevOpacity:_phPage>1?'1':'0.35',personHistoryNextOpacity:_phPage<_phTotalPages?'1':'0.35',
          personHistoryPageLabel:`${_phPage} / ${_phTotalPages}`,
          personHistoryPageNext:()=>self.setState({personHistoryPage:Math.min(_phTotalPages,_phPage+1)}),
          personHistoryPagePrev:()=>self.setState({personHistoryPage:Math.max(1,_phPage-1)}),
          setPersonHistoryFilterAll:()=>self.setState({personHistoryFilter:'all',personHistoryPage:1}),
          setPersonHistoryFilterPresent:()=>self.setState({personHistoryFilter:'present',personHistoryPage:1}),
          setPersonHistoryFilterMc:()=>self.setState({personHistoryFilter:'mc',personHistoryPage:1}),
          setPersonHistoryFilterAbsent:()=>self.setState({personHistoryFilter:'absent',personHistoryPage:1}),
          personHistoryFilterAllStyle:_phSBtn('all'),personHistoryFilterPresentStyle:_phSBtn('present'),
          personHistoryFilterMcStyle:_phSBtn('mc'),personHistoryFilterAbsentStyle:_phSBtn('absent'),
        };
      })(),
      closePersonHistory:self.closePersonHistory,
      exportPersonHistory:self.exportPersonHistory,
      realtimeLive:s.realtimeLive,
      realtimeLiveBg:s.realtimeLive?'#e7f3ec':'#f7e4e1',
      realtimeLiveColor:s.realtimeLive?'#1f8a5b':'#c0392b',
      realtimeLiveLabel:s.realtimeLive?'● LIVE':'● Reconnecting',
      showRealtimeBadge:!!s.realtimeChannel,
      rosterSearch:s.rosterSearch, onRosterSearch:self.onRosterSearch, onRosterSearchKeyDown:self.onRosterSearchKeyDown, hasRosterSearch:!!search, clearRosterSearch:self.clearRosterSearch,
      retrySync:self.retrySync,
      markAllPresent:self.markAllPresent, markAllPresenting:s.markAllPresenting,
      askMarkAllPresent:self.askMarkAllPresent, cancelMarkAllPresent:self.cancelMarkAllPresent,
      confirmMarkAllPresent:!!s.confirmMarkAllPresent, notConfirmMarkAllPresent:!s.confirmMarkAllPresent,
      notConfirmAny:!s.confirmMarkAllAbsent&&!s.confirmMarkAllPresent,
      markAllPresentStyle:`padding:5px 9px;border-radius:7px;cursor:pointer;border:1px solid #cfe6d8;background:#fff;color:#1f8a5b;opacity:${s.markAllPresenting?'0.45':'1'};display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;white-space:nowrap;`,
      markAllPresentConfirmStyle:`padding:5px 11px;border-radius:7px;font-size:11.5px;font-weight:700;cursor:pointer;border:none;background:#1f8a5b;color:#fff;`,
      showLogPendingBadge:pendingCount>0, logPendingBadgeCount:String(pendingCount),
      rosterStatusFilter,
      setRosterStatusAll:self.setRosterStatusFilter('all'),setRosterStatusPresent:self.setRosterStatusFilter('present'),
      setRosterStatusMc:self.setRosterStatusFilter('mc'),setRosterStatusAbsent:self.setRosterStatusFilter('absent'),setRosterStatusPending:self.setRosterStatusFilter('pending'),
      rosterStatusAllStyle,rosterStatusPresentStyle,rosterStatusMcStyle,rosterStatusAbsentStyle,rosterStatusPendingStyle,
      noSearchResults:(!!search||rosterStatusFilter!=='all')&&sortedFiltered.length===0,
      rosterEmpty:!search&&rosterStatusFilter==='all'&&roster.length===0,
      filteredCount:sortedFiltered.length, showFilteredCount:(!!search||rosterStatusFilter!=='all')&&sortedFiltered.length>0,
      filteredCountLabel:sortedFiltered.length+' result'+(sortedFiltered.length===1?'':'s'),
      statPresent:present, statMc:mc, statPending:pending, statTotal:total,
      lateCount, lateNames, showLateAlert, lateAlertLabel, dismissLateAlert:()=>self.setState({lateAlertDismissedCount:lateCount}),
      noRepMsg, toggleNoReporting:self.toggleNoReporting,
      showRepToggle, repToggleLocked,
      noRepTrackBg:repToggleOn?accent:'#39435a',
      noRepKnobX:repToggleOn?'25px':'3px',
      repToggleOpacity:repToggleLocked?'0.55':'1',
      repTogglePE:repToggleLocked?'none':'auto',
      prevDay:self.prevDay, nextDay:self.nextDay, goToday:self.goToday,
      onDaySwipeStart:self.onDaySwipeStart, onDaySwipeEnd:self.onDaySwipeEnd,
      snapshotLink, showSnapshot:viewShowReporting,
      openWaPreview:()=>{ self.setState({waPreviewOpen:true,waPreviewText:snapshotLines.join('\n')}); },
      waPreviewOpen:s.waPreviewOpen, waPreviewText:s.waPreviewText,
      closeWaPreview:self.closeWaPreview, onWaPreviewText:self.onWaPreviewText, sendWaPreview:self.sendWaPreview, copyWaPreview:self.copyWaPreview,
      editingNoteText:s.editingNoteText, onNoteText:self.onNoteText, saveNote:self.saveNote, closeNote:self.closeNote,
      logNoteText:s.logNoteText, onLogNoteText:self.onLogNoteText, saveLogNote:self.saveLogNote, closeLogNote:self.closeLogNote,
      refreshPage:self.refreshPage,
      viewDateLabel, viewDateSub, viewIsToday, viewNotToday:!viewIsToday,
      viewShowReporting, viewNoReporting, viewNoRepReason,
      viewRoster, vPresent, vMc, vThirdVal, vThirdLabel, vThirdColor, vTotal,
      vPresentLabel:'Checked in',
      viewListHeader, viewPercentText, viewPercentColor,
      rosterSort:s.rosterSort,
      setRosterSortName:self.setRosterSort('name'),
      setRosterSortStatus:self.setRosterSort('status'),
      rosterSortNameStyle,rosterSortStatusStyle,
      // Feature: admin password reset / set
      resetPwOpen:s.resetPwId!==null,
      ...((()=>{
        const _rp=[...s.personnel,...Object.values(s.batchMembersCache||{}).flat()].find(p=>p.id===s.resetPwId)||{};
        const _hasAuth=!!_rp.auth_id;
        return {
          resetPwPersonName:_rp.name||'',
          resetPwTitle:_hasAuth?'Reset password':'Set password',
          resetPwBtnLabel:s.resetPwSaving?(_hasAuth?'Resetting...':'Creating...'): (_hasAuth?'Reset password':'Create login & set password'),
        };
      })()),
      resetPwNew:s.resetPwNew||'', resetPwSaving:s.resetPwSaving,
      resetPwSavingOpacity:s.resetPwSaving?0.6:1,
      resetPwType:s.showResetPw?'text':'password', showResetPw:!!s.showResetPw, hideResetPw:!s.showResetPw, toggleResetPw:self.toggleResetPw,
      onResetPwNew:self.onResetPwNew, submitResetPw:self.submitResetPw, closeResetPw:self.closeResetPw,
    };
  },

};
