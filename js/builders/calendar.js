// ── Calendar and attendance view builders ─────────────────────────────────
const CalendarBuilders = {

  _findHistRecord: function(dk) {
    const {attendanceDate, attendance, currentUserId, history} = this.state;
    const myAtt = attendance[currentUserId];
    return history.find(r=>r.date===dk)
      || (dk===attendanceDate && myAtt?.status && myAtt.status!=='pending'
          ? {status:myAtt.status, p1:myAtt.p1||null, p4:myAtt.p4||null} : null);
  },

  _findApprovedLeave: function(dk) {
    return (this.state.myLeaveHistory||[]).find(r=>r.date===dk&&r.status==='approved'&&r.type!=='mc');
  },

  _calDayDetail: function(off, dst) {
    const d=this.dateForOffset(off), hol=Utils.holidayName(d), dk=Utils.dateKey(d);
    if(off===0){
      if(!Utils.isReportDay(d,this._myDept())) return {label:'Weekend',sub:'No reporting required',color:'#8a94a3',bg:'#f6f8fa'};
      if(this.isNoReport(0)) return {label:'No reporting',sub:hol||'Marked as a no-reporting day',color:'#b9791a',bg:'#f7efdc'};
      const rec=this.myRec(), st=rec.status||'pending';
      if(st==='present') return {label:'Checked in',sub:'Reported at '+(rec.p1||'-'),color:'#1f8a5b',bg:'#e7f3ec'};
      if(st==='mc')      return {label:'MC',sub:'Sick leave declared for today',color:'#b9791a',bg:'#f7efdc'};
      if(st==='absent'){
        return this._findApprovedLeave(dk)
          ? {label:'Personal Leave',sub:'Personal leave approved for today',color:'#b9791a',bg:'#f7efdc'}
          : {label:'Absent',sub:'You have been marked absent',color:'#c0392b',bg:'#f7e4e1'};
      }
      return {label:'Pending',sub:'You have not checked in yet today',color:'#5c6678',bg:'#eceef2'};
    }
    if(hol) return {label:'Public holiday',sub:hol+', no reporting',color:'#b9791a',bg:'#f7efdc'};
    if(dst==='ph') return {label:'Public holiday',sub:'No reporting required',color:'#b9791a',bg:'#f7efdc'};
    if(dst==='nr') return {label:'No reporting',sub:'Marked as a no-reporting day',color:'#3b5bdb',bg:'#eef2fb'};
    if(dst==='dekit') return {label:'Dekit day',sub:'Return equipment and submit meal allowance forms',color:'#161f30',bg:'#eceef2'};
    if(dst==='end') return {label:off<0?'Reporting day':'Upcoming',sub:'Last reporting day of your cycle',color:'#5c6678',bg:'#eceef2'};
    if(dst==='post') return {label:'No reporting',sub:'Reporting cycle ended, await dekit',color:'#8a94a3',bg:'#f0f2f7'};
    if(dst==='wknd') return {label:'Weekend',sub:'No reporting required',color:'#8a94a3',bg:'#f6f8fa'};
    if(dst==='past'||dst==='work'&&off<0){
      const hr=this._findHistRecord(dk);
      if(hr){
        const t=hr.p1||'-';
        if(hr.status==='present'&&!hr.p4) return {label:'No clock-out',sub:'You did not clock out. Inform your supervisor. Meal allowance may not apply.',color:'#ea580c',bg:'#fff3e0'};
        if(hr.status==='present') return {label:'Present',sub:'Reported at '+t,color:'#1f8a5b',bg:'#e7f3ec'};
        if(hr.status==='mc')     return {label:'MC',sub:'Sick leave recorded',color:'#b9791a',bg:'#f7efdc'};
        if(hr.status==='absent'){
          return this._findApprovedLeave(dk)
            ?{label:'Personal Leave',sub:'Personal leave approved',color:'#b9791a',bg:'#f7efdc'}
            :{label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
        }
      }
      return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
    }
    if(dst==='work'){
      // Future reporting day - check for approved or pending leave
      const futureLeave=(this.state.myLeaveHistory||[]).find(r=>r.date===dk&&(r.status==='approved'||r.status==='pending'));
      if(futureLeave){
        const isMc=futureLeave.type==='mc';
        if(futureLeave.status==='approved')
          return {label:isMc?'MC approved':'Leave approved',sub:isMc?'Sick leave approved for this day':'Absence approved for this day',color:'#b9791a',bg:'#f7efdc'};
        return {label:isMc?'MC submitted':'Leave submitted',sub:'Awaiting admin approval',color:'#b9791a',bg:'#fdf6e9'};
      }
      return {label:'Upcoming',sub:'Reporting day',color:'#5c6678',bg:'#eceef2'};
    }
    if(dst==='pre') return {label:'No reporting',sub:'Before your cycle started',color:'#5c6678',bg:'#eceef2'};
    return {label:'No reporting',sub:'Outside your reporting cycle',color:'#b9791a',bg:'#f7efdc'};
  },

  _buildCalendar: function(s, accent) {
    const me=this.cur();
    const activeBatch=s.batches.find(b=>b.id===me?.batch_id)||s.batches[s.activeBatchIdx||0];
    if(!activeBatch) return {weekdays:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],calCells:[],cycleStart:'',cycleEnd:'',calSelected:false,calNoneSelected:true,calSelLabel:'',calSelStatus:'',calSelSub:'',calSelColor:'',calSelBg:'',dekitMonth:'',dekitDay:'',dekitLabel:'',dekitSub:'',dekitDateFull:''};
    const bs=new Date(activeBatch.start_date+'T00:00:00');
    const be=new Date(activeBatch.end_date+'T00:00:00');
    const dd=activeBatch.dekit_date?new Date(activeBatch.dekit_date+'T00:00:00'):Utils.addDays(be,3);
    const gridStart=Utils.mondayOf(bs);
    const today=this.baseDate();
    const todayKey=Utils.dateKey(today), bsKey=Utils.dateKey(bs), beKey=Utils.dateKey(be), ddKey=Utils.dateKey(dd);
    const cellBase='aspect-ratio:1;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;';
    const cellStyle=st=>{
      if(st==='today') return cellBase+'background:'+accent+';color:#fff;';
      if(st==='ph')    return cellBase+'background:#f7efdc;color:#b9791a;';
      if(st==='nr')    return cellBase+'background:#eef2fb;color:#3b5bdb;border:1px dashed #a5b8f3;';
      if(st==='work')  return cellBase+'background:#fff;border:1px solid #e3e6ec;color:#161f30;';
      if(st==='end')   return cellBase+'background:#fff;border:1.5px solid '+accent+';color:'+accent+';';
      if(st==='dekit') return cellBase+'background:#131a27;color:#fff;';
      if(st==='post')  return cellBase+'background:#f0f2f7;color:#8a94a3;';
      if(st==='wknd')  return cellBase+'background:#f6f8fa;color:#c2c8d2;';
      if(st==='past')  return cellBase+'background:#f6f8fa;color:#b0b8c4;border:1px solid #eef0f4;';
      return cellBase+'background:transparent;color:#c2c8d2;';
    };
    const calCells=Array.from({length:21},(_,i)=>{
      const d=Utils.addDays(gridStart,i), dk=Utils.dateKey(d);
      const off=Math.round((d-today)/86400000);
      const isHol=!!Utils.holidayName(d), isNoRep=s.noReportDays.has(dk), isWknd=!Utils.isReportDay(d,this._myDept());
      let dst;
      if(dk===todayKey) dst='today';
      else if(dk<bsKey) dst='pre';
      else if(dk>ddKey) dst='off';
      else if(dk===ddKey) dst='dekit';
      else if(dk>beKey) dst='post';
      else if(dk===beKey) dst='end';
      else if(isWknd) dst='wknd';
      else if(isHol) dst='ph';
      else if(isNoRep) dst='nr';
      else if(dk<todayKey) dst='past';
      else dst='work';
      let style=cellStyle(dst)+'cursor:pointer;';
      if(dst==='past'){
        const hr=this._findHistRecord(dk);
        const pst=hr?.status;
        if(pst==='present'&&!hr?.p4) style=cellBase+'background:#fff3e0;color:#c2410c;border:2px dashed #fb923c;cursor:pointer;';
        else if(pst==='present') style=cellBase+'background:#e7f3ec;color:#1f8a5b;border:2px solid #a8d5bb;cursor:pointer;';
        else if(pst==='mc') style=cellBase+'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;cursor:pointer;';
        else if(pst==='absent'){
          style=this._findApprovedLeave(dk)?cellBase+'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;cursor:pointer;':cellBase+'background:#f7e4e1;color:#c0392b;border:2px solid #e5a9a4;cursor:pointer;';
        } else style=cellBase+'background:#f7e4e1;color:#c0392b;border:2px solid #e5a9a4;cursor:pointer;';
      }
      if(dst==='work'&&off>0){
        const fl=(this.state.myLeaveHistory||[]).find(r=>r.date===dk&&(r.status==='approved'||r.status==='pending'));
        if(fl?.status==='approved') style=cellBase+'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;cursor:pointer;';
        else if(fl?.status==='pending') style=cellBase+'background:#fdf6e9;color:#b9791a;border:1px dashed #e8c77a;cursor:pointer;';
      }
      if(s.selectedCalOffset===off) style+='outline:2px solid '+accent+';outline-offset:1px;';
      return {num:d.getDate(),style,off,st:dst,onClick:this.selectCalDay(off)};
    });
    const dekitLabel='Dekit, '+Utils.fmtMed(dd);
    const dekitSub='Last report: '+Utils.fmtMed(be);
    const dekitDateFull=Utils.fmtMed(dd);
    const selOff=s.selectedCalOffset, calSelected=selOff!=null;
    let calSelLabel='',calSelStatus='',calSelSub='',calSelColor='',calSelBg='';
    if(calSelected){
      const sd=this.dateForOffset(selOff);
      const selCell=calCells.find(c=>c.off===selOff);
      const info=this._calDayDetail(selOff,selCell?selCell.st:'off');
      calSelLabel=Utils.fmtMed(sd)+(selOff===0?', Today':'');
      calSelStatus=info.label; calSelSub=info.sub; calSelColor=info.color; calSelBg=info.bg;
    }
    return {
      weekdays:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], calCells,
      cycleStart:Utils.fmtShort(bs), cycleEnd:Utils.fmtShort(be),
      calSelected, calNoneSelected:!calSelected,
      calSelLabel, calSelStatus, calSelSub, calSelColor, calSelBg,
      dekitMonth:Utils._MS[dd.getMonth()].toUpperCase(), dekitDay:dd.getDate(),
      dekitLabel, dekitSub, dekitDateFull,
    };
  },

  _buildAttendance: function(s) {
    const me=this.cur(); if(!me) return {myHistory:[],statMyPresent:0,statMyMc:0,statMyMissed:0,statMyDays:0,cycleDone:0,cycleTotal:0,cyclePct:0};
    const isCas=this._myDept()==='cas';
    const rec=this.myRec(), status=rec.status||'pending';
    const todayD=this.baseDate(), today=Utils.dateKey(todayD);
    const activeBatch=s.batches.find(b=>b.id===me.batch_id)||s.batches[s.activeBatchIdx||0];
    const _cTimings=(!isCas&&this._myDept()==='ops_security')?(s.me?.phase_timings||Utils.effectiveTimings(activeBatch)):null;
    const _histBreakLabel=(_cTimings&&Utils.isBreakDinner(_cTimings))?'DINNER':'LUNCH';
    const _modeChanges=_cTimings?.mode_changes||[];
    // Per-row label: (1) dinner_mode stored at P1 check-in, (2) latest mode_changes entry on or
    // before the row's date (upserted per day, so same-day flip-flops collapse to net result),
    // (3) fall back to current timings for records that pre-date this feature.
    const _rowBreakLabel=(r)=>{
      if(r.dinnerMode!=null) return r.dinnerMode?'DINNER':'LUNCH';
      if(r.date&&_modeChanges.length>0){
        const rel=_modeChanges.filter(e=>e.from<=r.date);
        if(rel.length>0) return rel.reduce((a,b)=>a.from>b.from?a:b).dinner?'DINNER':'LUNCH';
      }
      return _histBreakLabel;
    };

    const _tc=(v,c1,c0)=>v?c1:c0;
    const _dc='#c2c8d2';

    const _exDates=s.historyExpandedDates||[];
    const _ed=f=>!!(rec.editLog||[]).some(e=>e.fields?.includes(f));
    const todayRow=(Utils.isReportDay(todayD,this._myDept())&&!this.isNoReport(0)&&(!activeBatch||today>=activeBatch.start_date)&&(!activeBatch||today<=activeBatch.end_date))
      ?[{date:Utils.fmtMed(todayD)+', Today',dateKey:today,showMonthDivider:false,monthDividerLabel:'',shift:'Office',status,
         p1:rec.p1||'-',p2:rec.p2||'-',p3:rec.p3||'-',p4:rec.p4||'-',
         p1Color:_ed('p1')?'#2f5fd0':_tc(rec.p1,'#161f30',_dc),p2Color:_ed('p2')?'#2f5fd0':_tc(rec.p2,'#161f30',_dc),p3Color:_ed('p3')?'#2f5fd0':_tc(rec.p3,'#161f30',_dc),p4Color:_ed('p4')?'#2f5fd0':_tc(rec.p4,'#161f30',_dc),
         p1Edited:_ed('p1'),p2Edited:_ed('p2'),p3Edited:_ed('p3'),p4Edited:_ed('p4'),
         hasExpandToggle:status==='present',rowCursor:status==='present'?'pointer':'default',isExpanded:_exDates.includes(today),onToggleExpand:this.toggleHistoryExpand(today),
         showTimes:status==='present'&&_exDates.includes(today),rowMarginBot:(status==='present'&&_exDates.includes(today))?'9px':'0',chevronRotate:_exDates.includes(today)?'180':'0',
         lateReason:rec.lateReason||'',showLateReason:!!(rec.lateReason)&&_exDates.includes(today)&&!_ed('p1'),
         isMissedRow:false,showMissedNote:false,missedNote:'',onOpenMissedNote:()=>{},
         showTimingWarning:status==='present'&&(isCas?!rec.p4:(!rec.p2||!rec.p3||!rec.p4)),
         showLunchTimes:!isCas, histGridCols:isCas?'repeat(2,1fr)':'repeat(4,1fr)',p2Label:_histBreakLabel,
         missingClockOut:status==='present'&&!rec.p4,
         hasIncompleteTimes:status==='present'&&!!rec.p4&&(isCas?false:(!rec.p2||!rec.p3))&&_exDates.includes(today),
         isToday:true,
         ...Utils.meta(status)}]:[];

    const _nc='#b9791a'; // amber for unrecorded slots
    const _histFiltered=s.history.filter(r=>Utils.isReportDay(new Date(r.date+'T00:00:00'),this._myDept())&&(!activeBatch||r.date>=activeBatch.start_date));
    const histKeys=new Set(_histFiltered.map(r=>r.date));
    const histRows=_histFiltered.map(r=>{
      const d=new Date(r.date+'T00:00:00');
      const p1=r.p1||null,p2=r.p2||null,p3=r.p3||null,p4=r.p4||null;
      const isPresent=r.status==='present';
      const missingClockOut=isPresent&&!p4;
      const hasIncompleteTimes=isPresent&&!missingClockOut&&(isCas?false:(!p2||!p3));
      const _rowEx=_exDates.includes(r.date);
      const isMissed=r.status==='missed';
      const _ed2=f=>!!(r.editLog||[]).some(e=>e.fields?.includes(f));
      const _approvedLeave=r.status==='absent'?this._findApprovedLeave(r.date):null;
      return {date:Utils.fmtMed(d),dateKey:r.date,shift:'Office',status:r.status,
        p1:p1||'-',
        p2:p2||(isPresent?'–':'-'), p3:p3||(isPresent?'–':'-'), p4:p4||(isPresent?'–':'-'),
        p1Color:_ed2('p1')?'#2f5fd0':_tc(p1,'#161f30',_dc),
        p2Color:_ed2('p2')?'#2f5fd0':(p2?'#161f30':(isPresent?_nc:_dc)),
        p3Color:_ed2('p3')?'#2f5fd0':(p3?'#161f30':(isPresent?_nc:_dc)),
        p4Color:_ed2('p4')?'#2f5fd0':(p4?'#161f30':(isPresent?_nc:_dc)),
        p1Edited:_ed2('p1'),p2Edited:_ed2('p2'),p3Edited:_ed2('p3'),p4Edited:_ed2('p4'),
        hasExpandToggle:isPresent||isMissed,rowCursor:(isPresent||isMissed)?'pointer':'default',isExpanded:_rowEx,
        onToggleExpand:isMissed?this.openMissedNote(r.date,r.welfareNote||''):this.toggleHistoryExpand(r.date),
        showTimes:isPresent&&_rowEx,rowMarginBot:(isPresent&&_rowEx)?'9px':'0',chevronRotate:_rowEx?'180':'0',hasIncompleteTimes:hasIncompleteTimes&&_rowEx,
        missingClockOut,
        showTimingWarning:isPresent&&(isCas?!p4:(!p2||!p3||!p4)),
        showLunchTimes:!isCas, histGridCols:isCas?'repeat(2,1fr)':'repeat(4,1fr)',p2Label:_rowBreakLabel(r),
        lateReason:r.lateReason||'',showLateReason:!!(r.lateReason)&&_rowEx&&!_ed2('p1'),
        isMissedRow:isMissed,missedNote:r.welfareNote||'',showMissedNote:false,
        onOpenMissedNote:isMissed?this.openMissedNote(r.date,r.welfareNote||''):()=>{},
        isPersonalLeave:!!_approvedLeave,
        ...(_approvedLeave?{label:'Personal Leave',color:'#b9791a',bg:'#f7efdc'}:Utils.meta(r.status))};
    });

    const missedRows=[];
    if(activeBatch){
      const bStart=new Date(activeBatch.start_date+'T00:00:00'), yesterday=Utils.addDays(todayD,-1);
      for(let d=new Date(bStart);d<=yesterday;d=Utils.addDays(d,1)){
        const dk=Utils.dateKey(d);
        if(Utils.isReportDay(d,this._myDept())&&dk<=activeBatch.end_date&&!Utils.holidayName(d)&&!s.noReportDays.has(dk)&&!histKeys.has(dk)){
          missedRows.push({date:Utils.fmtMed(d),dateKey:dk,shift:'Office',status:'missed',
            p1:'-',p2:'-',p3:'-',p4:'-',p1Color:_dc,p2Color:_dc,p3Color:_dc,p4Color:_dc,
            p1Edited:false,p2Edited:false,p3Edited:false,p4Edited:false,
            showTimes:false,rowMarginBot:'0',chevronRotate:'0',hasExpandToggle:true,rowCursor:'pointer',isExpanded:false,onToggleExpand:this.openMissedNote(dk,''),showTimingWarning:false,
            isMissedRow:true,missedNote:'',showMissedNote:false,onOpenMissedNote:this.openMissedNote(dk,''),p2Label:_rowBreakLabel({date:dk}),
            ...Utils.meta('missed')});
        }
      }
    }

    const allPast=[...histRows,...missedRows].sort((a,b)=>a.dateKey>b.dateKey?-1:1);

    // Future leave/MC rows: approved or pending requests after today within the cycle
    const futureLeaveRows=[];
    if(activeBatch){
      const allLeaves=[...(s.myPendingRequests||[]),...(s.myLeaveHistory||[])];
      const pri={approved:0,pending:1};
      const byDate=new Map();
      for(const r of allLeaves){
        if(r.date<=today||r.date>activeBatch.end_date) continue;
        if(r.status!=='approved'&&r.status!=='pending') continue;
        const d=new Date(r.date+'T00:00:00');
        if(!Utils.isReportDay(d,this._myDept())||s.noReportDays.has(r.date)) continue;
        const prev=byDate.get(r.date);
        if(!prev||(pri[r.status]??99)<(pri[prev.status]??99)) byDate.set(r.date,r);
      }
      for(const [dk,r] of [...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
        const d=new Date(dk+'T00:00:00');
        const isMc=r.type==='mc';
        const isApproved=r.status==='approved';
        const lbl=isMc?'MC':'Personal Leave';
        futureLeaveRows.push({
          date:Utils.fmtMed(d),dateKey:dk,showMonthDivider:futureLeaveRows.length===0,monthDividerLabel:'Upcoming',shift:'Office',
          status:isApproved?(isMc?'mc':'absent'):'pending',
          label:lbl,color:'#b9791a',bg:isApproved?'#f7efdc':'#fdf6e9',
          p1:'-',p2:'-',p3:'-',p4:'-',
          p1Color:_dc,p2Color:_dc,p3Color:_dc,p4Color:_dc,
          p1Edited:false,p2Edited:false,p3Edited:false,p4Edited:false,
          hasExpandToggle:false,rowCursor:'default',isExpanded:false,onToggleExpand:()=>{},
          showTimes:false,rowMarginBot:'0',chevronRotate:'0',
          showTimingWarning:false,isMissedRow:false,missedNote:'',showMissedNote:false,
          onOpenMissedNote:()=>{},missingClockOut:false,hasIncompleteTimes:false,
          showLunchTimes:!isCas,histGridCols:isCas?'repeat(2,1fr)':'repeat(4,1fr)',p2Label:_histBreakLabel,
          lateReason:'',showLateReason:false,isToday:false,
        });
      }
    }

    const futureApprovedMcCount=futureLeaveRows.filter(r=>r.status==='mc'||r.status==='absent').length;

    let _lastMonth='';
    allPast.forEach(r=>{
      const m=r.dateKey.slice(0,7);
      r.showMonthDivider=m!==_lastMonth;
      r.monthDividerLabel=r.showMonthDivider?(Utils._MS[parseInt(r.dateKey.slice(5,7),10)-1]+' '+r.dateKey.slice(0,4)):'';
      _lastMonth=m;
    });
    const myHistory=[...todayRow,...futureLeaveRows,...allPast];
    const statRows=[...todayRow,...allPast];
    const statMyPresent=statRows.filter(h=>h.status==='present').length;
    const statMyMc=statRows.filter(h=>h.status==='mc'||h.isPersonalLeave).length;
    const statMyAbsent=statRows.filter(h=>(h.status==='absent'||h.status==='missed')&&!h.isPersonalLeave).length;
    const statMyMissed=statMyAbsent; // kept for back-compat

    let cycleTotal=0, cycleDone=0;
    if(activeBatch){
      const bStart=new Date(activeBatch.start_date+'T00:00:00'),bEnd=new Date(activeBatch.end_date+'T00:00:00'),now=this.baseDate();
      for(let d=new Date(bStart);d<=bEnd;d=Utils.addDays(d,1)){
        if(Utils.isReportDay(d,this._myDept())&&!Utils.holidayName(d)&&!s.noReportDays.has(Utils.dateKey(d))){cycleTotal++;if(d<=now)cycleDone++;}
      }
    }
    const totalRecorded=statMyPresent+statMyMc+statMyAbsent;
    const attendanceRate=cycleDone>0?Math.round((statMyPresent+statMyMc)/cycleDone*100):null;
    const attendanceRateText=attendanceRate!==null?attendanceRate+'%':'-';
    const showAttendanceSummary=totalRecorded>0||cycleDone>0;
    const streak=(()=>{
      const myRec=s.attendance[s.currentUserId]||{};
      const todayEntry=(Utils.isReportDay(todayD,this._myDept())&&!this.isNoReport(0)&&myRec.status==='present')?[{date:today,status:'present'}]:[];
      const sorted=[...todayEntry,...s.history.filter(r=>r.date!==today)].sort((a,b)=>b.date.localeCompare(a.date));
      let n=0;for(const r of sorted){if(r.status==='present')n++;else break;}return n;
    })();
    const streakLabel=(()=>{
      if(streak>0) return streak===1?'1-day streak':streak+'-day streak';
      const lastPresent=[...s.history].sort((a,b)=>b.date.localeCompare(a.date)).find(r=>r.status==='present');
      if(!lastPresent) return 'No streak';
      return 'Last present: '+Utils.fmtShort(new Date(lastPresent.date+'T00:00:00'));
    })();
    const cycleNotStarted=!!(activeBatch&&today<activeBatch.start_date);
    const cycleStartsLabel=activeBatch?Utils.fmtLong(new Date(activeBatch.start_date+'T00:00:00')):'';

    const hasMissingClockOut=s.history.slice(0,14).some(r=>r.status==='present'&&!r.p4);

    const bEnd=activeBatch?.end_date||'';
    const bDekit=activeBatch?.dekit_date||'';
    const showDekitNotice=!!(bEnd&&bDekit&&today>bEnd&&today<=bDekit);
    const dekitNoticeDateFmt=bDekit?Utils.fmtShort(new Date(bDekit+'T00:00:00')):'';
    const dekitDiff=bDekit?Math.round((new Date(bDekit+'T00:00:00')-new Date(today+'T00:00:00'))/86400000):null;
    const dekitTimingText=dekitDiff===0?`Dekit is today (${dekitNoticeDateFmt}).`:dekitDiff===1?`Dekit is tomorrow (${dekitNoticeDateFmt}).`:`Dekit is on ${dekitNoticeDateFmt}.`;

    const PAGE=10, page=s.historyPage||1;
    const pagedHistory=myHistory.slice(0,page*PAGE);
    const historyHasMore=myHistory.length>page*PAGE;
    const historyRemaining=myHistory.length-pagedHistory.length;
    return {myHistory:pagedHistory,historyHasMore,historyRemaining,showMoreHistory:this.showMoreHistory,statMyPresent,statMyMc:statMyMc+futureApprovedMcCount,statMyMissed,statMyAbsent,statMyDays:statMyPresent+statMyMc+futureApprovedMcCount,cycleDone,cycleTotal,cyclePct:cycleTotal?Math.round(cycleDone/cycleTotal*100):0,historyTruncated:s.history.length>=500,historyEmpty:pagedHistory.length===0,totalRecorded,attendanceRate,attendanceRateText,showAttendanceSummary,streak,streakLabel,cycleNotStarted,cycleStartsLabel,hasMissingClockOut,showDekitNotice,dekitNoticeDateFmt,dekitTimingText,historyLoaded:s.historyLoaded,
      missedNoteOpen:s.missedNoteOpen,missedNoteText:s.missedNoteText,missedNoteReady:true,closeMissedNote:this.closeMissedNote,onMissedNoteText:this.onMissedNoteText,saveMissedNote:this.saveMissedNote};
  },

};
