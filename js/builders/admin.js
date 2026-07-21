// ── Admin view builder ────────────────────────────────────────────────────
const AdminBuilders = {

  _buildAdmin: function(s, accent) {
    const batches=s.batches, activeBatchIdx=s.activeBatchIdx||0, activeBatch=batches[activeBatchIdx];
    const activeMembers=(activeBatch?.is_live?s.personnel.filter(p=>p.batch_id===activeBatch.id):(s.batchMembersCache?.[activeBatch?.id]||[])).filter(p=>(p.role||'reservist')==='reservist');
    const {am:npAmCount,pm:npPmCount}=this._shiftSlotCounts(activeMembers);
    const npAmFull=npAmCount>=2, npPmFull=npPmCount>=2;
    let npShift=s.npShift;
    if((npShift==='AM'&&npAmFull)||(npShift==='PM'&&npPmFull)) npShift='OFFICE';
    const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const todayForChips=Utils.dateKey(this.baseDate());
    const allChips=batches.map((b,i)=>{
      const bs=new Date(b.start_date+'T00:00:00'), be=new Date(b.end_date+'T00:00:00');
      const isFuture=b.start_date>todayForChips;
      const isPast=b.end_date<todayForChips&&!b.is_live;
      const isActive=i===activeBatchIdx;
      let chipStyle='flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-start;padding:7px 13px;border-radius:9px;cursor:pointer;white-space:nowrap;text-align:left;';
      if(isActive) chipStyle+='background:'+accent+';color:#fff;border:1px solid '+accent+';';
      else if(isFuture) chipStyle+='background:#f6f8fa;color:#8a94a3;border:1.5px dashed #c2c8d2;';
      else if(isPast) chipStyle+='background:#f6f8fa;color:#8a94a3;border:1px solid #e3e6ec;';
      else chipStyle+='background:#fff;color:#5c6678;border:1px solid #d4d9e2;';
      return {label:b.label, range:Utils.fmtShort(bs)+' to '+Utils.fmtShort(be), onClick:this.setBatch(i), style:chipStyle, isPast, isActive, isFuture, startDate:b.start_date};
    });
    const activeChips=allChips.filter(c=>!c.isPast);
    const archivedChips=allChips.filter(c=>c.isPast);
    const _pickerYearMap={};
    allChips.forEach((c,i)=>{
      const yr=batches[i]?.start_date?.slice(0,4)||'';
      if(!_pickerYearMap[yr]) _pickerYearMap[yr]=[];
      _pickerYearMap[yr].push({...c, onPick:()=>{ this.closeCyclePicker(); c.onClick(); }});
    });
    const allPickerYears=Object.keys(_pickerYearMap).sort((a,b)=>b-a);
    const activePickerYear=s.cyclePickerYear||null;
    const cyclePickerYears=allPickerYears.map(yr=>({
      year:yr,
      isSelected:yr===activePickerYear,
      style:yr===activePickerYear
        ?'-webkit-appearance:none;padding:5px 14px;background:#161f30;border:none;border-radius:20px;font-size:12px;font-weight:600;color:#fff;cursor:pointer;'
        :'-webkit-appearance:none;padding:5px 14px;background:#f0f2f5;border:none;border-radius:20px;font-size:12px;font-weight:600;color:#5c6678;cursor:pointer;',
      onSelect:()=>this.setCyclePickerYear(yr),
    }));
    const CYCLE_PAGE_SIZE=8;
    const sortCycles=(arr)=>[...arr].sort((a,b)=>{
      if(a.isActive) return -1; if(b.isActive) return 1;
      if(!a.isPast&&!b.isPast) return a.startDate>b.startDate?1:-1;
      if(a.isPast&&b.isPast) return a.startDate>b.startDate?-1:1;
      return a.isPast?1:-1;
    });
    const filteredYears=allPickerYears.filter(yr=>!activePickerYear||yr===activePickerYear);
    const flatCycles=filteredYears.flatMap(yr=>sortCycles(_pickerYearMap[yr]).map(c=>({...c,year:yr})));
    const cycleTotalPages=Math.max(1,Math.ceil(flatCycles.length/CYCLE_PAGE_SIZE));
    const safeCyclePage=Math.min(s.cyclePickerPage||1,cycleTotalPages);
    const pagedCycles=flatCycles.slice((safeCyclePage-1)*CYCLE_PAGE_SIZE, safeCyclePage*CYCLE_PAGE_SIZE);
    const regrouped={};
    pagedCycles.forEach(c=>{ if(!regrouped[c.year]) regrouped[c.year]=[]; regrouped[c.year].push(c); });
    const cyclePickerGroups=Object.keys(regrouped).sort((a,b)=>b-a).map(yr=>({year:yr,cycles:regrouped[yr]}));
    const showCycleYearFilter=allPickerYears.length>1;
    const cyclePickerHasPrev=safeCyclePage>1, cyclePickerHasNext=safeCyclePage<cycleTotalPages;
    const cyclePickerShowPagination=cycleTotalPages>1;
    const cyclePickerPageInfo=`${safeCyclePage} / ${cycleTotalPages}`;
    const activeCycleLabel=activeBatch?.label||'No cycle';
    const _abs=activeBatch?new Date(activeBatch.start_date+'T00:00:00'):null;
    const _abe=activeBatch?new Date(activeBatch.end_date+'T00:00:00'):null;
    const activeCycleRange=_abs&&_abe?Utils.fmtShort(_abs)+' to '+Utils.fmtShort(_abe):'';
    const viewOffset=s.viewOffset||0, viewDate=this.dateForOffset(viewOffset), viewIsToday=viewOffset===0, viewReportDay=Utils.isReportDay(viewDate);
    const viewDateKey=Utils.dateKey(viewDate);
    const viewMap=viewIsToday?s.attendance:(s.attendanceCache?.[viewDateKey]||{});
    const roster=activeMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent',time:'-'}, mm=Utils.meta(r.status);
      const cardStyle='background:#fff;border:1px solid #e3e6ec;border-left:3px solid '+mm.color+';border-radius:12px;padding:11px 13px;';
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      const _phaseParts=[r.p1?'IN '+r.p1:null,r.p2?((p.shift==='PM'?'DIN ':'LCH ')+r.p2):null,r.p3?'BACK '+r.p3:null,r.p4?'OUT '+r.p4:null].filter(Boolean);
      const phaseLine=_phaseParts.join('  ·  ');
      const showPhaseLine=r.status==='present'&&_phaseParts.length>0;
      return {id:p.id,name:p.name,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),shift:p.shift,status:r.status,time:r.p1||'-',label:mm.label,color:mm.color,bg:mm.bg,geo:(r.status==='present'&&r.p1dist!=null)?(', GPS verified '+r.p1dist+' m'):'',markPresent:this.setStatus(p.id,'present'),markMc:this.setStatus(p.id,'mc'),markAbsent:this.setStatus(p.id,'absent'),onShiftChange:this.changeShift(p.id),cardStyle,avatarStyle,phaseLine,showPhaseLine,welfareNote:r.welfareNote||'',showWelfareNote:!!(r.welfareNote),canMark:viewOffset<=0};
    });
    const search=(s.rosterSearch||'').toLowerCase();
    const filteredRoster=roster.filter(r=>!search||r.name.toLowerCase().includes(search));
    const sortKey=s.rosterSort||'shift';
    const sortedFiltered=[...filteredRoster].sort((a,b)=>{
      if(sortKey==='name') return a.name.localeCompare(b.name);
      if(sortKey==='status'){const ord={present:0,mc:1,pending:2,absent:3};return (ord[a.status]??4)-(ord[b.status]??4);}
      const so={AM:0,PM:1,OFFICE:2};return (so[a.shift]??3)-(so[b.shift]??3);
    });
    const _sb='flex:1;padding:7px 8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;white-space:nowrap;transition:background .15s,color .15s;';
    const _sa=_sb+'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.12);';
    const _si=_sb+'background:transparent;color:#8a94a3;';
    const rosterSortShiftStyle=sortKey==='shift'?_sa:_si;
    const rosterSortNameStyle=sortKey==='name'?_sa:_si;
    const rosterSortStatusStyle=sortKey==='status'?_sa:_si;
    const present=roster.filter(r=>r.label==='Present').length, mc=roster.filter(r=>r.label==='On MC').length, pending=roster.filter(r=>r.label==='Pending').length, absent=roster.filter(r=>r.label==='Absent').length, total=roster.length;
    const snapshotLastLine=viewIsToday?('⏳ Pending ('+pending+'): '+(roster.filter(r=>r.label==='Pending').map(r=>r.name).join(', ')||'(none)')):('❌ Absent ('+absent+'): '+(roster.filter(r=>r.label==='Absent').map(r=>r.name).join(', ')||'(none)'));
    const _orgN=this.props.orgName||'Ops Security';
    const snapshotLines=['📋 *'+_orgN+', '+Utils.fmtMed(viewDate)+'*','✅ Present ('+present+'): '+(roster.filter(r=>r.label==='Present').map(r=>r.name).join(', ')||'(none)'),'🤒 MC ('+mc+'): '+(roster.filter(r=>r.label==='On MC').map(r=>r.name).join(', ')||'(none)'),snapshotLastLine];
    const snapshotLink='https://api.whatsapp.com/send?text='+encodeURIComponent(snapshotLines.join('\n'));
    const shiftCutoff=Utils.LATE_CUTOFF;
    const logRows=activeMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent'}, mm=Utils.meta(r.status);
      const cutoff=shiftCutoff[p.shift||'AM'];
      const [_cc,_ccm]=cutoff.split(':').map(Number);
      const _lm=r.p1?(()=>{const[h,m]=r.p1.split(':').map(Number);return(h*60+m)-(_cc*60+_ccm);})():0;
      const isLate=r.status==='present'&&_lm>=60;
      const lateReason=r.lateReason||'';
      const showLateReason=isLate&&!!lateReason;
      const showNoLateReason=isLate&&!lateReason;
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      return {
        id:p.id, name:p.name, initials:Utils.initials(p.name), shiftLabel:Utils.shiftLabel(p.shift),
        label:mm.label, color:mm.color, bg:mm.bg, isLate,
        lateReason, showLateReason, showNoLateReason,
        welfareNote:r.welfareNote||'', showWelfareNote:!!(r.welfareNote),
        logNoteIconColor:r.welfareNote?'#1f8a5b':'#5c6678',
        isEditingLogNote:s.logNoteId===p.id,
        onEditLogNote:this.openLogNote(p.id, r.welfareNote||''),
        showNoGps: !!(r.gpsBypassed),
        editLog: (()=>{const log=r.editLog||[];if(!log.length)return[];const e=log[log.length-1];const d=new Date(e.at);const sg=new Date(d.getTime()+8*3600*1000);const hh=String(sg.getUTCHours()).padStart(2,'0'),mm2=String(sg.getUTCMinutes()).padStart(2,'0');const day=sg.getUTCDate(),mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][sg.getUTCMonth()];return[{by:e.by||'Admin',timeLabel:`${hh}:${mm2}, ${day} ${mon}`}];})(),
        showEditLog: !!(r.editLog&&r.editLog.length),
        p1:r.p1||'-', p2:r.p2||'-', p3:r.p3||'-', p4:r.p4||'-',
        p1Color:r.p1?(isLate?'#c0392b':'#161f30'):'#c2c8d2',
        p2Color:r.p2?'#161f30':'#c2c8d2',
        p3Color:r.p3?'#161f30':'#c2c8d2',
        p4Color:r.p4?'#161f30':'#c2c8d2',
        avatarStyle, shift:p.shift||'AM',
        p2Label:p.shift==='PM'?'DIN':'LCH',
        p2FormLabel:p.shift==='PM'?'Dinner':'Lunch',
        p3Label:p.shift==='PM'?'Return (dinner)':'Return (lunch)',
        isTimesEditing:s.timesEditId===p.id,
        onEditTimes:this.openTimesEdit(p.id),
      };
    });
    const logShiftFilter=s.logShiftFilter||'all';
    const logSearch=(s.logSearch||'').toLowerCase().trim();
    const shiftFiltered=logShiftFilter==='all'?logRows:logRows.filter(r=>r.shift===logShiftFilter);
    const filteredLogRows=logSearch?shiftFiltered.filter(r=>r.name.toLowerCase().includes(logSearch)):shiftFiltered;
    const pendingCount=logRows.filter(r=>r.label==='Pending').length;
    const _fBtn=(f,accent)=>`padding:5px 11px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;border:1px solid ${logShiftFilter===f?accent:'#d4d9e2'};background:${logShiftFilter===f?accent:'#fff'};color:${logShiftFilter===f?'#fff':'#5c6678'};`;
    const lateRows=viewIsToday?logRows.filter(r=>r.isLate):[];
    const lateCount=lateRows.length;
    const lateNames=lateRows.map(r=>r.name).join(', ');
    const showLateAlert=viewIsToday&&lateCount>0;
    const lateAlertLabel=lateCount===1?'1 late check-in':lateCount+' late check-ins';
    const logDateLabel=viewIsToday?'TODAY\'S LOG':((WD[viewDate.getDay()]+' '+viewDate.getDate()+' '+MON[viewDate.getMonth()]).toUpperCase()+' LOG');
    const dlabel=WD[viewDate.getDay()]+' '+viewDate.getDate()+' '+MON[viewDate.getMonth()];
    const rel=viewOffset===0?'Today':viewOffset===-1?'Yesterday':viewOffset===1?'Tomorrow':'';
    const viewDateLabel=(rel?rel+', ':'')+dlabel;
    const viewHoliday=Utils.holidayName(viewDate), viewBlocked=this.isNoReport(viewOffset);
    const isDekit=viewDateKey===activeBatch?.dekit_date;
    const viewShowReporting=viewReportDay&&!viewBlocked&&!isDekit, viewNoReporting=!viewShowReporting;
    const viewDateSub=!viewReportDay?'Weekend, no reporting':viewHoliday?'Public holiday':isDekit?'Dekit day':viewBlocked?'No reporting, toggled off':viewOffset<0?'Past shift, recorded':viewOffset>0?'Scheduled':'Live now';
    const viewNoRepReason=!viewReportDay?'This is a weekend. Reservists do not report on Saturdays or Sundays.':viewHoliday?(viewHoliday+' is a public holiday, so reservists are not required to report.'):isDekit?'Dekit day: reservists return equipment and submit forms. No regular reporting.':'This day is marked as a no-reporting day, so reservists are not required to report.';
    const showRepToggle=viewReportDay&&!isDekit, repToggleLocked=!!viewHoliday, repToggleOn=viewBlocked;
    const noRepMsg=viewHoliday?('Public holiday ('+viewHoliday+'). Auto no-reporting, locked.'):repToggleOn?'On. Reservists are not required to report this day.':'Off. Reservists report and check in as normal.';
    const viewRoster=activeMembers.map(p=>{
      const r=viewMap[p.id]||{status:viewOffset>=0?'pending':'absent',time:'-'}, mm=Utils.meta(r.status);
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      return {id:p.id,name:p.name,initials:Utils.initials(p.name),shiftLabel:Utils.shiftLabel(p.shift),label:mm.label,color:mm.color,bg:mm.bg,timeText:(r.status==='present'&&r.p1)?r.p1:'',avatarStyle,welfareNote:r.welfareNote||'',showWelfareNote:!!(r.welfareNote)};
    });
    const vPresent=viewRoster.filter(r=>r.label==='Present').length, vMc=viewRoster.filter(r=>r.label==='On MC').length, vAbsent=viewRoster.filter(r=>r.label==='Absent').length, vPending=viewRoster.filter(r=>r.label==='Pending').length, vTotal=viewRoster.length;
    const vPercent=vTotal?Math.round((vPresent+vMc)/vTotal*100):0;
    const viewListHeader=viewOffset<0?'ATTENDANCE RECORD':viewOffset>0?'SCHEDULED ROSTER':'LIVE STATUS';
    const viewPercentText=viewOffset>0?(vTotal+' rostered'):(vPercent+'% reported');
    const viewPercentColor=viewOffset>0?'#8a94a3':'#1f8a5b';
    const vThirdLabel=viewOffset<0?'Absent':'Pending', vThirdVal=viewOffset<0?vAbsent:vPending, vThirdColor=viewOffset<0?'#c0392b':'#5c6678';
    const liveBatch=batches.find(b=>b.is_live)||activeBatch;
    const lbs=liveBatch?new Date(liveBatch.start_date+'T00:00:00'):null, lbe=liveBatch?new Date(liveBatch.end_date+'T00:00:00'):null;
    const intakeLabel=liveBatch?liveBatch.label:'';
    const intakeRange=lbs&&lbe?(Utils.fmtShort(lbs)+' to '+Utils.fmtShort(lbe)):'';
    const editTargetLabel=activeBatch?.label||'';
    const editTargetIsLive=!!activeBatch?.is_live;
    const _ebs=activeBatch?new Date(activeBatch.start_date+'T00:00:00'):null;
    const _ebe=activeBatch?new Date(activeBatch.end_date+'T00:00:00'):null;
    const editTargetRange=_ebs&&_ebe?(Utils.fmtShort(_ebs)+' to '+Utils.fmtShort(_ebe)+' '+_ebs.getFullYear()):'';
    const editTargetIsPast=!!(activeBatch&&activeBatch.end_date<todayForChips&&!activeBatch.is_live);
    const editTargetStatus=editTargetIsLive?'LIVE':editTargetIsPast?'PAST':'UPCOMING';
    const _sortedBatches=[...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const _isLastDay=!!(liveBatch&&todayForChips===liveBatch.end_date);
    const _nextBatch=_isLastDay?_sortedBatches.find(b=>b.start_date>liveBatch.end_date):null;
    const signupTargetLabel=_nextBatch?_nextBatch.label:(liveBatch?.label||'');
    const signupIsNextCycle=!!_nextBatch;
    const _psVals = Object.values(s.peopleStats);
    const batchTotalPresent = _psVals.reduce((n,v)=>n+(v.present||0),0);
    const batchTotalMc = _psVals.reduce((n,v)=>n+(v.mc||0),0);
    const batchTotalAbsent = _psVals.reduce((n,v)=>n+(v.absent||0),0);
    const batchTotalDays = batchTotalPresent+batchTotalMc+batchTotalAbsent;
    const batchAvgPct = batchTotalDays>0?Math.round(batchTotalPresent/batchTotalDays*100):null;

    // Build approved signups lookup Map (O(n) instead of O(n²))
    const approvedByContact = new Map((s.approvedSignups||[]).map(r=>[r.contact, r.reviewed_by||'Admin']));

    return {
      activeChips, archivedChips, archivedCount:archivedChips.length,
      cyclePickerGroups, cyclePickerOpen:s.cyclePickerOpen,
      cyclePickerYears, showCycleYearFilter, setCyclePickerYear:this.setCyclePickerYear,
      cyclePickerHasPrev, cyclePickerHasNext, cyclePickerShowPagination, cyclePickerPageInfo,
      cyclePickerNext:this.cyclePickerNext, cyclePickerPrev:this.cyclePickerPrev,
      openCyclePicker:this.openCyclePicker, closeCyclePicker:this.closeCyclePicker,
      activeCycleLabel, activeCycleRange,
      showArchivedBatches:s.showArchivedBatches,
      toggleArchivedBatches:()=>this.setState(s=>({showArchivedBatches:!s.showArchivedBatches})),
      roster, filteredRoster:sortedFiltered, logRows:filteredLogRows, logRowsEmpty:filteredLogRows.length===0, logDateLabel,
      timesEditP1:s.timesEditP1||'', timesEditP2:s.timesEditP2||'', timesEditP3:s.timesEditP3||'', timesEditP4:s.timesEditP4||'',
      timesEditSaving:s.timesEditSaving||false,
      ...(()=>{const _iStyle=k=>{const err=s.timesEditErrField===k;return`width:100%;padding:8px 10px;border:1.5px solid ${err?'#c0392b':'#d4d9e2'};border-radius:8px;font-size:13px;font-family:'IBM Plex Mono',monospace;outline:none;background:${err?'#fff5f5':'#f6f8fa'};box-sizing:border-box;color:#161f30;`;};return{timesEditP1Style:_iStyle('p1'),timesEditP2Style:_iStyle('p2'),timesEditP3Style:_iStyle('p3'),timesEditP4Style:_iStyle('p4')};})(),
      onTimesP1:this.onTimesP1, onTimesP2:this.onTimesP2, onTimesP3:this.onTimesP3, onTimesP4:this.onTimesP4,
      saveTimesEdit:this.saveTimesEdit, closeTimesEdit:this.closeTimesEdit,
      setLogFilterAll:this.setLogShiftFilter('all'), setLogFilterAm:this.setLogShiftFilter('AM'),
      setLogFilterPm:this.setLogShiftFilter('PM'), setLogFilterOffice:this.setLogShiftFilter('OFFICE'),
      logFilterAllStyle:_fBtn('all',accent), logFilterAmStyle:_fBtn('AM',accent),
      logFilterPmStyle:_fBtn('PM',accent), logFilterOfficeStyle:_fBtn('OFFICE',accent),
      askMarkAllAbsent:this.askMarkAllAbsent, markAllAbsent:this.markAllAbsent,
      cancelMarkAllAbsent:this.cancelMarkAllAbsent,
      markingAllAbsent:s.markingAllAbsent, confirmMarkAllAbsent:s.confirmMarkAllAbsent, notConfirmMarkAllAbsent:!s.confirmMarkAllAbsent,
      markAllAbsentStyle:`padding:6px 11px;border-radius:7px;cursor:pointer;border:1px solid #f7e4e1;background:#fff;color:#c0392b;opacity:${s.markingAllAbsent?'0.45':'1'};display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;flex-shrink:0;`,
      markAllAbsentConfirmStyle:`padding:5px 11px;border-radius:7px;font-size:11.5px;font-weight:700;cursor:pointer;border:none;background:#c0392b;color:#fff;`,
      pendingCount,
      logSearch:s.logSearch||'', onLogSearch:this.onLogSearch, onLogSearchKeyDown:this.onLogSearchKeyDown, clearLogSearch:this.clearLogSearch, hasLogSearch:!!(s.logSearch),
      personHistoryOpen:!!s.personHistoryId,
      personHistoryName:([...s.personnel,...(s.batchMembersCache[activeBatch?.id]||[])].find(p=>p.id===s.personHistoryId)||{}).name||'',
      personHistoryLoading:s.personHistoryLoading,
      personHistoryRows:(s.personHistoryRows||[]).slice(0,100).map(r=>{
        const mm=Utils.meta(r.status);
        const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],W=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const d=new Date(r.date+'T00:00:00');
        const editLog=r.edit_log||[];
        const latestEdit=editLog.length?editLog[editLog.length-1]:null;
        return {dateLabel:W[d.getDay()]+' '+d.getDate()+' '+M[d.getMonth()]+' '+d.getFullYear(),label:mm.label,color:mm.color,bg:mm.bg,p1:r.check_in_time?r.check_in_time.slice(0,5):'-',p4:r.work_end_time?r.work_end_time.slice(0,5):'-',adminCorrected:editLog.length>0,editedBy:latestEdit?.by||''};
      }),
      noPersonHistory:!(s.personHistoryRows||[]).length&&!s.personHistoryLoading,
      closePersonHistory:this.closePersonHistory,
      realtimeLive:s.realtimeLive,
      realtimeLiveBg:s.realtimeLive?'#e7f3ec':'#f7e4e1',
      realtimeLiveColor:s.realtimeLive?'#1f8a5b':'#c0392b',
      realtimeLiveLabel:s.realtimeLive?'● LIVE':'● Reconnecting',
      showRealtimeBadge:!!s.realtimeChannel,
      rosterSearch:s.rosterSearch, onRosterSearch:this.onRosterSearch, onRosterSearchKeyDown:this.onRosterSearchKeyDown, hasRosterSearch:!!search, clearRosterSearch:this.clearRosterSearch,
      retrySync:this.retrySync,
      markAllPresent:this.markAllPresent, pendingCount, markAllPresenting:s.markAllPresenting,
      noSearchResults:!!search&&sortedFiltered.length===0,
      rosterEmpty:!search&&roster.length===0,
      filteredCount:search?sortedFiltered.length:0, showFilteredCount:!!search&&sortedFiltered.length>0,
      statPresent:present, statMc:mc, statPending:pending, statTotal:total,
      lateCount, lateNames, showLateAlert, lateAlertLabel,
      noRepMsg, toggleNoReporting:this.toggleNoReporting,
      showRepToggle, repToggleLocked,
      noRepTrackBg:repToggleOn?accent:'#39435a',
      noRepKnobX:repToggleOn?'25px':'3px',
      repToggleOpacity:repToggleLocked?'0.55':'1',
      repTogglePE:repToggleLocked?'none':'auto',
      prevDay:this.prevDay, nextDay:this.nextDay, goToday:this.goToday,
      onDaySwipeStart:this.onDaySwipeStart, onDaySwipeEnd:this.onDaySwipeEnd,
      snapshotLink, showSnapshot:viewShowReporting,
      openWaPreview:()=>{ this.setState({waPreviewOpen:true,waPreviewText:snapshotLines.join('\n')}); },
      waPreviewOpen:s.waPreviewOpen, waPreviewText:s.waPreviewText,
      closeWaPreview:this.closeWaPreview, onWaPreviewText:this.onWaPreviewText, sendWaPreview:this.sendWaPreview,
      editingNoteText:s.editingNoteText, onNoteText:this.onNoteText, saveNote:this.saveNote, closeNote:this.closeNote,
      logNoteText:s.logNoteText, onLogNoteText:this.onLogNoteText, saveLogNote:this.saveLogNote, closeLogNote:this.closeLogNote,
      refreshPage:this.refreshPage,
      viewDateLabel, viewDateSub, viewIsToday, viewNotToday:!viewIsToday,
      viewShowReporting, viewNoReporting, viewNoRepReason,
      viewRoster, vPresent, vMc, vThirdVal, vThirdLabel, vThirdColor, vTotal,
      vPresentLabel:'Checked in',
      viewListHeader, viewPercentText, viewPercentColor,
      editTargetLabel, editTargetIsLive, editTargetRange, editTargetStatus,
      signupTargetLabel, signupIsNextCycle,
      editingBatchLabel:s.editingBatchLabel, batchLabelText:s.batchLabelText,
      startEditBatchLabel:this.startEditBatchLabel, onBatchLabelText:this.onBatchLabelText,
      saveBatchLabel:this.saveBatchLabel, cancelBatchLabel:this.cancelBatchLabel,
      personnelList:activeMembers.map(p=>{
        const av=s.avatars[p.id]||'';
        const approvedBy=approvedByContact.get(p.contact)||'';
        return {...p,
          initials:Utils.initials(p.name),
          shiftLabel:Utils.shiftLabel(p.shift),
          onEditNote:this.openNote(p.id,p.notes||''),
          isEditingNote:s.editingNoteId===p.id,
          onAskDeactivate:this.askDeactivatePerson(p.id),
          isConfirmingDeactivate:s.confirmDeactivateId===p.id,
          statPresent:s.peopleStats[p.id]?.present??0,
          statMc:s.peopleStats[p.id]?.mc??0,
          statAbsent:s.peopleStats[p.id]?.absent??0,
          statPct:s.peopleStats[p.id]?.pct!=null?(s.peopleStats[p.id].pct+'%'):'No records',
          showStats:s.peopleStatsLoaded,
          avatarStyle:av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'',
          avatarInitials:av?'':Utils.initials(p.name),
          onViewHistory:this.openPersonHistory(p.id),
          approvedBy,
          showApprovedBy:!!approvedBy,
          onResetPw:this.openResetPw(p.id),
          canResetPw:!!p.auth_id,
        };
      }),
      personnelListEmpty:activeMembers.length===0,
      cancelDeactivatePerson:this.cancelDeactivatePerson,
      confirmDeactivatePerson:this.confirmDeactivatePerson,
      rosterSort:s.rosterSort,
      setRosterSortShift:this.setRosterSort('shift'),
      setRosterSortName:this.setRosterSort('name'),
      setRosterSortStatus:this.setRosterSort('status'),
      rosterSortShiftStyle,rosterSortNameStyle,rosterSortStatusStyle,
      newBatchDate:s.newBatchDate,onNewBatchDate:this.onNewBatchDate,createBatch:this.createBatch,batchCreating:s.batchCreating,
      npName:s.npName, npContact:s.npContact, npShift, npPassword:s.npPassword,
      npAmFull, npPmFull, npAmCount, npPmCount,
      npAmLabel:npAmFull?'AM shift (0830-1530) (Taken)':'AM shift (0830-1530) ('+npAmCount+'/2)',
      npPmLabel:npPmFull?'PM shift (1530-2230) (Taken)':'PM shift (1530-2230) ('+npPmCount+'/2)',
      addPersonnelOpen:!!(s.addPersonnelOpen), toggleAddPersonnel:this.toggleAddPersonnel,
      addPersonnelBtnBg:s.addPersonnelOpen?'#161f30':'#eceef2',
      addPersonnelBtnStroke:s.addPersonnelOpen?'#fff':'#5c6678',
      showReenrollConfirm:!!(s.npReenrollRecord), showAddForm:!(s.npReenrollRecord),
      reenrollName:s.npReenrollRecord?.name||'',
      confirmReenroll:this.confirmReenroll, cancelReenroll:this.cancelReenroll,
      onNpName:this.onNpName, onNpContact:this.onNpContact, onNpShift:this.onNpShift, onNpPassword:this.onNpPassword, addPerson:this.addPerson,
      mealActive:!!(activeBatch?.meal_active), toggleMealActive:this.toggleMealActive,
      mealToggleTrackBg:activeBatch?.meal_active?accent:'#39435a',
      mealToggleKnobX:activeBatch?.meal_active?'25px':'3px',
      batchLoading:s.batchLoading,
      exportCsv:this.exportCsv,
      // Feature: admin password reset
      resetPwOpen:s.resetPwId!==null,
      resetPwPersonName:(s.personnel.find(p=>p.id===s.resetPwId)||{}).name||'',
      resetPwNew:s.resetPwNew||'', resetPwSaving:s.resetPwSaving,
      resetPwSavingOpacity:s.resetPwSaving?0.6:1,
      resetPwBtnLabel:s.resetPwSaving?'Resetting...':'Reset password',
      onResetPwNew:this.onResetPwNew, submitResetPw:this.submitResetPw, closeResetPw:this.closeResetPw,
      // Feature: broadcast notice
      broadcastOpen:s.broadcastOpen, broadcastText:s.broadcastText||'', broadcastSaving:s.broadcastSaving,
      broadcastSavingOpacity:s.broadcastSaving?0.6:1,
      broadcastBtnLabel:s.broadcastSaving?'Saving...':'Post notice',
      openBroadcast:this.openBroadcast, closeBroadcast:this.closeBroadcast,
      onBroadcastText:this.onBroadcastText, saveBroadcast:this.saveBroadcast,
      activeBatchNotice:activeBatch?.notice_text||'', hasActiveBatchNotice:!!(activeBatch?.notice_text),
      broadcastSubColor:activeBatch?.notice_text?'#2f5fd0':'#8a94a3',
      broadcastSubText:activeBatch?.notice_text||'No active notice',
      // Feature: bulk add
      bulkAddOpen:s.bulkAddOpen, bulkAddText:s.bulkAddText||'',
      bulkAddIsInput:s.bulkAddStep==='input', bulkAddIsPreview:s.bulkAddStep==='preview',
      bulkAddAdding:s.bulkAddAdding,
      bulkAddAddingOpacity:s.bulkAddAdding?0.6:1,
      ...(()=>{
        const _parsed=(s.bulkAddParsed||[]).map(r=>({...r,validColor:r.valid?'#1f8a5b':'#c0392b',validLabel:r.valid?'OK':'Skip',shiftDisplay:r.shift||'AM'}));
        const _vc=_parsed.filter(r=>r.valid).length;
        return {
          bulkAddParsed:_parsed,
          bulkAddValidCount:_vc,
          bulkAddTotal:_parsed.length,
          bulkAddHasValid:_vc>0,
          bulkAddBtnLabel:s.bulkAddAdding?'Adding...':('Add '+_vc+' personnel'),
        };
      })(),
      openBulkAdd:this.openBulkAdd, closeBulkAdd:this.closeBulkAdd,
      onBulkAddText:this.onBulkAddText, parseBulkAdd:this.parseBulkAdd, confirmBulkAdd:this.confirmBulkAdd,
      // Feature: bulk no-report days
      noReportBulkOpen:s.noReportBulkOpen, noReportBulkText:s.noReportBulkText||'',
      openNoReportBulk:this.openNoReportBulk, closeNoReportBulk:this.closeNoReportBulk,
      onNoReportBulkText:this.onNoReportBulkText, applyNoReportBulk:this.applyNoReportBulk,
      batchJumpDate:s.batchJumpDate, onBatchJumpDate:this.onBatchJumpDate, jumpToDate:this.jumpToDate,
      leaveSearch:s.leaveSearch||'', onLeaveSearch:this.onLeaveSearch, clearLeaveSearch:this.clearLeaveSearch, hasLeaveSearch:!!(s.leaveSearch||'').trim(),
      pendingLeaves:(()=>{const _lq=(s.leaveSearch||'').toLowerCase().trim();const _lb=_lq?(s.pendingLeaves||[]).filter(l=>(l.personnel?.name||'').toLowerCase().includes(_lq)||(l.personnel?.contact||'').includes(_lq)):(s.pendingLeaves||[]);const _nowMs=Date.now(),_2d=172800000;return _lb.map(l=>{const _ms=l.created_at?_nowMs-new Date(l.created_at).getTime():0,_h=Math.floor(_ms/3600000),_d=Math.floor(_h/24),isExpired=_ms>_2d,timeAgo=!l.created_at?'':_h<1?'Just now':_h<24?_h+' hr'+(_h!==1?'s':'')+' ago':_d+' day'+(_d!==1?'s':'')+' ago';return({
        id:l.id, reason:l.reason||'',
        personName:l.personnel?.name||'Unknown',
        initials:Utils.initials(l.personnel?.name||'?'),
        personShift:Utils.shiftLabel(l.personnel?.shift||'AM'),
        typeLabel:l.type==='mc'?'MC':l.type==='shift_change'?'Shift Change':l.type==='other'?'Other':'Personal Leave',
        typeBg:l.type==='mc'?'#fdf6e9':l.type==='shift_change'?'#eef3fc':'#f1f8f4',
        typeColor:l.type==='mc'?'#b9791a':l.type==='shift_change'?'#2f5fd0':'#1f8a5b',
        typeBorder:l.type==='mc'?'#f0e2c2':l.type==='shift_change'?'#d7e2f7':'#cfe6d8',
        dateLabel:l.date?Utils.fmtMed(new Date(l.date+'T00:00:00')):'',
        requestedShiftLabel:l.requested_shift?Utils.shiftLabel(l.requested_shift):'',
        showRequestedShift:l.type==='shift_change'&&!!l.requested_shift,
        onApprove:this.approveLeave(l.id), onReject:this.rejectLeave(l.id),
        isRejectOpen:s.rejectLeaveId===l.id,
        rejectLeaveReason:s.rejectLeaveId===l.id?s.rejectLeaveReason:'',
        onRejectLeaveReason:this.onRejectLeaveReason,
        confirmRejectLeave:this.confirmRejectLeave,
        cancelRejectLeave:this.cancelRejectLeave,
        timeAgo, isExpired,
      });});})(),
      pendingLeavesCount:(s.pendingLeaves||[]).length,
      hasPendingLeaves:(s.pendingLeaves||[]).length>0,
      pendingLeavesLoaded:s.pendingLeavesLoaded,
      batchTotalPresent, batchTotalMc, batchTotalAbsent,
      batchAvgPct:batchAvgPct!==null?batchAvgPct+'%':'-',
      showBatchStats:s.peopleStatsLoaded,
      isSuperAdmin:s.isSuperAdmin,
      addAdminOpen:s.addAdminOpen, toggleAddAdmin:this.toggleAddAdmin,
      promoteAdminOpen:s.promoteAdminOpen, togglePromoteAdmin:this.togglePromoteAdmin,
      adminsList:(s.adminsList||[]).map(a=>({
        id:a.id, name:a.name, contact:a.contact||'',
        roleLabel:a.role==='superadmin'?'Master':'Admin',
        isMaster:a.role==='superadmin',
        initials:Utils.initials(a.name),
        canDeactivate:a.id!==s.currentUserId&&a.role!=='superadmin',
        onAskDeactivate:this.askDeactivateAdmin(a.id),
        isConfirming:s.confirmDeactivateAdminId===a.id,
        onConfirmDeactivate:this.confirmDeactivateAdmin,
        onCancelDeactivate:this.cancelDeactivateAdmin,
      })),
      npAdminName:s.npAdminName, onNpAdminName:this.onNpAdminName,
      npAdminContact:s.npAdminContact, onNpAdminContact:this.onNpAdminContact,
      npAdminPassword:s.npAdminPassword, onNpAdminPassword:this.onNpAdminPassword,
      addAdmin:this.addAdmin,
      promoteAdminId:s.promoteAdminId, promoteSearch:s.promoteSearch,
      onPromoteSearch:this.onPromoteSearch, onPromoteSearchKeyDown:this.onPromoteSearchKeyDown,
      promoteShowAllCycles:s.promoteShowAllCycles,
      setPromoteCurrentCycle:this.setPromoteCurrentCycle, setPromoteAllCycles:this.setPromoteAllCycles,
      promoteAdminTargetName:s.promoteAdminId?(s.promoteAdminName||''):'',
      promoteAdminTargetContact:s.promoteAdminId?(s.promoteAdminContact||''):'',
      clearPromoteSelection:this.clearPromoteSelection,
      ...(()=>{
        const segActive='flex:1;padding:5px 8px;background:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;color:#161f30;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.1);';
        const segInactive='flex:1;padding:5px 8px;background:transparent;border:none;border-radius:6px;font-size:12px;font-weight:500;color:#8a94a3;cursor:pointer;';
        return {
          promoteFilterCurrentStyle:!s.promoteShowAllCycles?segActive:segInactive,
          promoteFilterAllStyle:s.promoteShowAllCycles?segActive:segInactive,
        };
      })(),
      promoteNextPage:this.promoteNextPage, promotePrevPage:this.promotePrevPage,
      ...((pab=>{
        const PROMOTE_PAGE_SIZE=8;
        const all=(s.personnel||[]).filter(p=>p.is_active!==false&&(p.role||'reservist')==='reservist');
        const base=s.promoteShowAllCycles?all:all.filter(p=>pab&&p.batch_id===pab.id);
        const q=(s.promoteSearch||'').toLowerCase().trim();
        const filtered=q?base.filter(p=>p.name.toLowerCase().includes(q)||(p.contact||'').includes(q)):base;
        const allRows=filtered.map(p=>{
          const b=(s.batches||[]).find(b=>b.id===p.batch_id);
          const initials=p.name.trim().split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'?';
          const av=(s.avatars||{})[p.id];
          const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
          return {id:p.id,name:p.name,contact:p.contact||'',batchLabel:b?b.label:'',initials,avatarStyle,
            onSelect:()=>this.setState({promoteAdminId:p.id,promoteAdminName:p.name,promoteAdminContact:p.contact||'',confirmPromoteAdminId:null,promoteSearch:''})};
        });
        const promoteTotalPages=Math.max(1,Math.ceil(allRows.length/PROMOTE_PAGE_SIZE));
        const safePage=Math.min(s.promoteListPage||1,promoteTotalPages);
        const promoteFilteredList=allRows.slice((safePage-1)*PROMOTE_PAGE_SIZE, safePage*PROMOTE_PAGE_SIZE);
        return {
          promoteFilteredList, promoteListEmpty:allRows.length===0,
          promoteListPage:safePage, promoteTotalPages,
          promoteHasPrev:safePage>1, promoteHasNext:safePage<promoteTotalPages,
          promoteShowPagination:promoteTotalPages>1,
          promotePageInfo:`${safePage} / ${promoteTotalPages}`,
        };
      })(this._liveBatch(s.batches))),
      confirmPromoteAdminId:s.confirmPromoteAdminId,
      askPromoteAdmin:this.askPromoteAdmin,
      cancelPromoteAdmin:this.cancelPromoteAdmin,
      confirmPromoteAdmin:this.confirmPromoteAdmin,
      signupSearch:s.signupSearch||'', onSignupSearch:this.onSignupSearch, clearSignupSearch:this.clearSignupSearch, hasSignupSearch:!!(s.signupSearch||'').trim(),
      pendingSignups:(()=>{
        const approvedContacts=new Set((s.approvedSignups||[]).map(a=>(a.contact||'').replace(/[\s-]/g,'')));
        const _sq=(s.signupSearch||'').toLowerCase().trim();
        const _base=_sq?s.pendingSignups.filter(r=>r.name.toLowerCase().includes(_sq)||(r.contact||'').includes(_sq)):s.pendingSignups;
        return _base.map(r=>{
          const b=(s.batches||[]).find(b=>b.id===r.batch_id);
          const initials=r.name.trim().split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'?';
          const isReactivation=approvedContacts.has((r.contact||'').replace(/[\s-]/g,''));
          const isSelected=(s.selectedSignupIds||[]).includes(r.id);
          return {id:r.id,name:r.name,contact:r.contact,shift:r.shift,batchLabel:b?b.label:'',initials,
            createdAt:r.created_at?new Date(r.created_at).toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'}):'',
            isReactivation, isNew:!isReactivation,
            isSelected,
            cardBg:isSelected?'#f0f2f7':'#fff',
            checkBorder:isSelected?'#161f30':'#c8cdd6',
            checkBg:isSelected?'#161f30':'#fff',
            onToggleSelect:this.toggleSignupSelect(r.id),
            onApprove:this.approveSignup(r.id), onReject:this.rejectSignup(r.id)};
        });
      })(),
      hasPendingSignups:s.pendingSignups.length>0,
      pendingSignupsLoaded:!!(s.pendingSignupsLoaded),
      pendingSignupCount:s.pendingSignups.length,
      selectedSignupCount:(s.selectedSignupIds||[]).length,
      hasSelectedSignups:(s.selectedSignupIds||[]).length>0,
      onApproveSelected:this.approveSelected,
      // People sub-tabs
      ...(()=>{
        const tab=s.peopleTab||'requests';
        const pendingTotal=s.pendingSignups.length+(s.pendingLeaves||[]).length;
        const ptBtn=(active)=>active
          ?'flex:1;padding:8px 4px;background:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;color:#161f30;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.1);'
          :'flex:1;padding:8px 4px;background:transparent;border:none;font-size:13px;font-weight:500;color:#8a94a3;cursor:pointer;';
        return {
          ptRequests:tab==='requests', ptRoster:tab==='roster', ptAdmins:tab==='admins',
          setPeopleTabRequests:()=>this.setState({peopleTab:'requests'}),
          setPeopleTabRoster:()=>this.setState({peopleTab:'roster'}),
          setPeopleTabAdmins:()=>this.setState({peopleTab:'admins'}),
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
