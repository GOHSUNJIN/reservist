// ── Calendar and attendance view builders ─────────────────────────────────
const CalendarBuilders = {

  _calDayDetail: function(off, dst) {
    const d=this.dateForOffset(off), hol=Utils.holidayName(d), dk=Utils.dateKey(d);
    if(off===0){
      if(!Utils.isReportDay(d)) return {label:'Weekend',sub:'No reporting required',color:'#8a94a3',bg:'#f6f8fa'};
      if(this.isNoReport(0)) return {label:'No reporting',sub:hol||'Marked as a no-reporting day',color:'#b9791a',bg:'#f7efdc'};
      const rec=this.myRec(), st=rec.status||'pending';
      if(st==='present') return {label:'Checked in',sub:'Reported at '+(rec.p1||'-'),color:'#1f8a5b',bg:'#e7f3ec'};
      if(st==='mc')      return {label:'MC',sub:'Sick leave declared for today',color:'#b9791a',bg:'#f7efdc'};
      if(st==='absent'){
        const pl=(this.state.myLeaveHistory||[]).find(r=>r.date===dk&&r.status==='approved'&&r.type!=='mc');
        return pl
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
    if(dst==='past'){
      const {attendanceDate, attendance, currentUserId} = this.state;
      const myAtt = attendance[currentUserId];
      const hr = this.state.history.find(r=>r.date===dk)
        || (dk===attendanceDate && myAtt?.status && myAtt.status!=='pending'
            ? {status:myAtt.status, check_in_time:myAtt.p1?myAtt.p1+':00':null} : null);
      if(hr){
        const t=hr.check_in_time?hr.check_in_time.slice(0,5):'-';
        if(hr.status==='present'&&!hr.work_end_time) return {label:'No clock-out',sub:'You did not clock out. Inform your supervisor. Meal allowance may not apply.',color:'#c2410c',bg:'#fff3e0'};
        if(hr.status==='present') return {label:'Present',sub:'Reported at '+t,color:'#1f8a5b',bg:'#e7f3ec'};
        if(hr.status==='mc')     return {label:'MC',sub:'Sick leave recorded',color:'#b9791a',bg:'#f7efdc'};
        if(hr.status==='absent'){
          const pl=(this.state.myLeaveHistory||[]).find(r=>r.date===dk&&r.status==='approved'&&r.type!=='mc');
          return pl?{label:'Personal Leave',sub:'Personal leave approved',color:'#b9791a',bg:'#f7efdc'}:{label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
        }
      }
      return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
    }
    if(dst==='work'){
      if(off<0){
        const {attendanceDate, attendance, currentUserId} = this.state;
        const myAtt = attendance[currentUserId];
        const hr = this.state.history.find(r=>r.date===dk)
          || (dk===attendanceDate && myAtt?.status && myAtt.status!=='pending'
              ? {status:myAtt.status, check_in_time:myAtt.p1?myAtt.p1+':00':null} : null);
        if(hr){
          const t=hr.check_in_time?hr.check_in_time.slice(0,5):'-';
          if(hr.status==='present'&&!hr.work_end_time) return {label:'No clock-out',sub:'You did not clock out. Inform your supervisor. Meal allowance may not apply.',color:'#c2410c',bg:'#fff3e0'};
          if(hr.status==='present') return {label:'Present',sub:'Reported at '+t,color:'#1f8a5b',bg:'#e7f3ec'};
          if(hr.status==='mc')     return {label:'MC',sub:'Sick leave recorded',color:'#b9791a',bg:'#f7efdc'};
          if(hr.status==='absent'){
            const pl=(this.state.myLeaveHistory||[]).find(r=>r.date===dk&&r.status==='approved'&&r.type!=='mc');
            return pl?{label:'Personal Leave',sub:'Personal leave approved',color:'#b9791a',bg:'#f7efdc'}:{label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
          }
        }
        return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
      }
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
      const isHol=!!Utils.holidayName(d), isNoRep=s.noReportDays.has(dk), isWknd=!Utils.isReportDay(d);
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
        const hr=s.history.find(r=>r.date===dk)
          ||(dk===s.attendanceDate&&s.attendance[s.currentUserId]?.status&&s.attendance[s.currentUserId].status!=='pending'
             ?{status:s.attendance[s.currentUserId].status}:null);
        const pst=hr?.status;
        if(pst==='present'&&!hr?.work_end_time) style=cellBase+'background:#fff3e0;color:#c2410c;border:2px dashed #fb923c;cursor:pointer;';
        else if(pst==='present') style=cellBase+'background:#e7f3ec;color:#1f8a5b;border:2px solid #a8d5bb;cursor:pointer;';
        else if(pst==='mc') style=cellBase+'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;cursor:pointer;';
        else if(pst==='absent'){
          const pl=(s.myLeaveHistory||[]).find(r=>r.date===dk&&r.status==='approved'&&r.type!=='mc');
          style=pl?cellBase+'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;cursor:pointer;':cellBase+'background:#f7e4e1;color:#c0392b;border:2px solid #e5a9a4;cursor:pointer;';
        } else style=cellBase+'background:#f7e4e1;color:#c0392b;border:2px solid #e5a9a4;cursor:pointer;';
      }
      if(dst==='work'&&off>0){
        const fl=(s.myLeaveHistory||[]).find(r=>r.date===dk&&(r.status==='approved'||r.status==='pending'));
        if(fl?.status==='approved') style=cellBase+'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;cursor:pointer;';
        else if(fl?.status==='pending') style=cellBase+'background:#fdf6e9;color:#b9791a;border:1px dashed #e8c77a;cursor:pointer;';
      }
      if(s.selectedCalOffset===off) style+='outline:2px solid '+accent+';outline-offset:1px;';
      return {num:d.getDate(),style,off,st:dst,onClick:this.selectCalDay(off)};
    });
    const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dekitLabel='Dekit, '+WD[dd.getDay()]+' '+dd.getDate()+' '+MON[dd.getMonth()];
    const dekitSub='Last report: '+WD[be.getDay()]+' '+be.getDate()+' '+MON[be.getMonth()];
    const dekitDateFull=WD[dd.getDay()]+' '+dd.getDate()+' '+MON[dd.getMonth()];
    const selOff=s.selectedCalOffset, calSelected=selOff!=null;
    let calSelLabel='',calSelStatus='',calSelSub='',calSelColor='',calSelBg='';
    if(calSelected){
      const sd=this.dateForOffset(selOff);
      const selCell=calCells.find(c=>c.off===selOff);
      const info=this._calDayDetail(selOff,selCell?selCell.st:'off');
      calSelLabel=Utils.fmtMed(sd)+(selOff===0?', today':'');
      calSelStatus=info.label; calSelSub=info.sub; calSelColor=info.color; calSelBg=info.bg;
    }
    return {
      weekdays:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], calCells,
      cycleStart:Utils.fmtShort(bs), cycleEnd:Utils.fmtShort(be),
      calSelected, calNoneSelected:!calSelected,
      calSelLabel, calSelStatus, calSelSub, calSelColor, calSelBg,
      dekitMonth:MON[dd.getMonth()].toUpperCase(), dekitDay:dd.getDate(),
      dekitLabel, dekitSub, dekitDateFull,
    };
  },

  _buildAttendance: function(s) {
    const me=this.cur(); if(!me) return {myHistory:[],statMyPresent:0,statMyMc:0,statMyMissed:0,statMyDays:0,cycleDone:0,cycleTotal:0,cyclePct:0};
    const isCas=this._myDept()==='cas';
    const rec=this.myRec(), status=rec.status||'pending';
    const todayD=this.baseDate(), today=Utils.dateKey(todayD);
    const activeBatch=s.batches.find(b=>b.id===me.batch_id)||s.batches[s.activeBatchIdx||0];

    const _tc=(v,c1,c0)=>v?c1:c0;
    const _dc='#c2c8d2';

    const _exDates=s.historyExpandedDates||[];
    const todayRow=(Utils.isReportDay(todayD)&&!this.isNoReport(0))
      ?[{date:Utils.fmtMed(todayD)+', Today',dateKey:today,shift:Utils.shiftLabel(me.shift),status,
         p1:rec.p1||'-',p2:rec.p2||'-',p3:rec.p3||'-',p4:rec.p4||'-',
         p1Color:_tc(rec.p1,'#161f30',_dc),p2Color:_tc(rec.p2,'#161f30',_dc),p3Color:_tc(rec.p3,'#161f30',_dc),p4Color:_tc(rec.p4,'#161f30',_dc),
         hasExpandToggle:status==='present'||status==='pending',isExpanded:_exDates.includes(today),onToggleExpand:this.toggleHistoryExpand(today),
         showTimes:status==='present'&&_exDates.includes(today),rowMarginBot:(status==='present'&&_exDates.includes(today))?'9px':'0',chevronRotate:_exDates.includes(today)?'180':'0',
         lateReason:rec.lateReason||'',showLateReason:!!(rec.lateReason)&&_exDates.includes(today),
         isMissedRow:false,showMissedNote:false,missedNote:'',onOpenMissedNote:()=>{},
         showTimingWarning:status==='present'&&(isCas?!rec.p4:(!rec.p2||!rec.p3||!rec.p4)),
         showLunchTimes:!isCas, histGridCols:isCas?'repeat(2,1fr)':'repeat(4,1fr)',
         ...Utils.meta(status)}]:[];

    const _nc='#b9791a'; // amber for unrecorded slots
    const histKeys=new Set(s.history.map(r=>r.date));
    const histRows=s.history.map(r=>{
      const d=new Date(r.date+'T00:00:00');
      const tk=s=>s?s.slice(0,5):null;
      const p1=tk(r.check_in_time),p2=tk(r.lunch_out_time),p3=tk(r.work_return_time),p4=tk(r.work_end_time);
      const isPresent=r.status==='present';
      const missingClockOut=isPresent&&!p4;
      const hasIncompleteTimes=isPresent&&!missingClockOut&&(isCas?false:(!p2||!p3));
      const _rowEx=_exDates.includes(r.date);
      const isMissed=r.status==='missed';
      return {date:Utils.fmtMed(d),dateKey:r.date,shift:Utils.shiftLabel(me.shift),status:r.status,
        p1:p1||'-',
        p2:p2||(isPresent?'–':'-'), p3:p3||(isPresent?'–':'-'), p4:p4||(isPresent?'–':'-'),
        p1Color:_tc(p1,'#161f30',_dc),
        p2Color:p2?'#161f30':(isPresent?_nc:_dc),
        p3Color:p3?'#161f30':(isPresent?_nc:_dc),
        p4Color:p4?'#161f30':(isPresent?_nc:_dc),
        hasExpandToggle:isPresent||isMissed,isExpanded:_rowEx,
        onToggleExpand:isMissed?this.openMissedNote(r.date,r.welfare_note||''):this.toggleHistoryExpand(r.date),
        showTimes:isPresent&&_rowEx,rowMarginBot:(isPresent&&_rowEx)?'9px':'0',chevronRotate:_rowEx?'180':'0',hasIncompleteTimes:hasIncompleteTimes&&_rowEx,
        missingClockOut,
        showTimingWarning:isPresent&&(isCas?!p4:(!p2||!p3||!p4)),
        showLunchTimes:!isCas, histGridCols:isCas?'repeat(2,1fr)':'repeat(4,1fr)',
        lateReason:r.late_reason||'',showLateReason:!!(r.late_reason)&&_rowEx,
        isMissedRow:isMissed,missedNote:r.welfare_note||'',showMissedNote:false,
        onOpenMissedNote:isMissed?this.openMissedNote(r.date,r.welfare_note||''):()=>{},
        ...Utils.meta(r.status)};
    });

    const missedRows=[];
    if(activeBatch){
      const bStart=new Date(activeBatch.start_date+'T00:00:00'), yesterday=Utils.addDays(todayD,-1);
      for(let d=new Date(bStart);d<=yesterday;d=Utils.addDays(d,1)){
        const dk=Utils.dateKey(d);
        if(Utils.isReportDay(d)&&dk<=activeBatch.end_date&&!Utils.holidayName(d)&&!s.noReportDays.has(dk)&&!histKeys.has(dk)){
          missedRows.push({date:Utils.fmtMed(d),dateKey:dk,shift:Utils.shiftLabel(me.shift),status:'missed',
            p1:'-',p2:'-',p3:'-',p4:'-',p1Color:_dc,p2Color:_dc,p3Color:_dc,p4Color:_dc,
            showTimes:false,rowMarginBot:'0',chevronRotate:'0',hasExpandToggle:true,isExpanded:false,onToggleExpand:this.openMissedNote(dk,''),showTimingWarning:false,
            isMissedRow:true,missedNote:'',showMissedNote:false,onOpenMissedNote:this.openMissedNote(dk,''),
            ...Utils.meta('missed')});
        }
      }
    }

    const allPast=[...histRows,...missedRows].sort((a,b)=>a.dateKey>b.dateKey?-1:1);
    const myHistory=[...todayRow,...allPast];
    const statMyPresent=myHistory.filter(h=>h.status==='present').length;
    const statMyMc=myHistory.filter(h=>h.status==='mc').length;
    const statMyMissed=missedRows.length;

    let cycleTotal=0, cycleDone=0;
    if(activeBatch){
      const bStart=new Date(activeBatch.start_date+'T00:00:00'),bEnd=new Date(activeBatch.end_date+'T00:00:00'),now=this.baseDate();
      for(let d=new Date(bStart);d<=bEnd;d=Utils.addDays(d,1)){
        if(Utils.isReportDay(d)&&!Utils.holidayName(d)&&!s.noReportDays.has(Utils.dateKey(d))){cycleTotal++;if(d<=now)cycleDone++;}
      }
    }
    const totalRecorded=statMyPresent+statMyMc+statMyMissed;
    const attendanceRate=cycleDone>0?Math.round((statMyPresent+statMyMc)/cycleDone*100):null;
    const attendanceRateText=attendanceRate!==null?attendanceRate+'%':'-';
    const showAttendanceSummary=totalRecorded>0||cycleDone>0;
    const streak=(()=>{
      const myRec=s.attendance[s.currentUserId]||{};
      const todayEntry=(Utils.isReportDay(todayD)&&!this.isNoReport(0)&&myRec.status==='present')?[{date:today,status:'present'}]:[];
      const sorted=[...todayEntry,...s.history.filter(r=>r.date!==today)].sort((a,b)=>b.date.localeCompare(a.date));
      let n=0;for(const r of sorted){if(r.status==='present')n++;else break;}return n;
    })();
    const streakLabel=streak===0?'No streak':streak===1?'1-day streak':streak+'-day streak';
    const cycleNotStarted=!!(activeBatch&&today<activeBatch.start_date);
    const cycleStartsLabel=activeBatch?Utils.fmtLong(new Date(activeBatch.start_date+'T00:00:00')):'';

    const hasMissingClockOut=s.history.slice(0,14).some(r=>r.status==='present'&&!r.work_end_time);

    const PAGE=10, page=s.historyPage||1;
    const pagedHistory=myHistory.slice(0,page*PAGE);
    const historyHasMore=myHistory.length>page*PAGE;
    const historyRemaining=myHistory.length-pagedHistory.length;
    return {myHistory:pagedHistory,historyHasMore,historyRemaining,showMoreHistory:this.showMoreHistory,statMyPresent,statMyMc,statMyMissed,statMyDays:statMyPresent+statMyMc,cycleDone,cycleTotal,cyclePct:cycleTotal?Math.round(cycleDone/cycleTotal*100):0,historyTruncated:s.history.length>=500,historyEmpty:pagedHistory.length===0,totalRecorded,attendanceRate,attendanceRateText,showAttendanceSummary,streak,streakLabel,cycleNotStarted,cycleStartsLabel,hasMissingClockOut,historyLoaded:s.historyLoaded,
      missedNoteOpen:s.missedNoteOpen,missedNoteText:s.missedNoteText,missedNoteReady:true,closeMissedNote:this.closeMissedNote,onMissedNoteText:this.onMissedNoteText,saveMissedNote:this.saveMissedNote};
  },

};
