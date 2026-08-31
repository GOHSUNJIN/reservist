// ── Checkin, calendar, and attendance view builders ───────────────────────
const CheckinBuilders = {

  _calDayDetail: function(off, dst) {
    const d=this.dateForOffset(off), hol=Utils.holidayName(d), dk=Utils.dateKey(d);
    if(off===0){
      if(!Utils.isReportDay(d)) return {label:'Weekend',sub:'No reporting required',color:'#8a94a3',bg:'#f6f8fa'};
      if(this.isNoReport(0)) return {label:'No reporting',sub:hol||'Marked as a no-reporting day',color:'#b9791a',bg:'#f7efdc'};
      const rec=this.myRec(), st=rec.status||'pending';
      if(st==='present') return {label:'Checked in',sub:'Reported at '+(rec.p1||'-'),color:'#1f8a5b',bg:'#e7f3ec'};
      if(st==='mc')      return {label:'On MC',sub:'Sick leave declared for today',color:'#b9791a',bg:'#f7efdc'};
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
        if(hr.status==='present'&&!hr.work_end_time) return {label:'No clock-out',sub:'You did not clock out. Inform your supervisor — meal allowance may not apply.',color:'#c2410c',bg:'#fff3e0'};
        if(hr.status==='present') return {label:'Present',sub:'Reported at '+t,color:'#1f8a5b',bg:'#e7f3ec'};
        if(hr.status==='mc')     return {label:'On MC',sub:'Sick leave recorded',color:'#b9791a',bg:'#f7efdc'};
        if(hr.status==='absent') return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
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
          if(hr.status==='present'&&!hr.work_end_time) return {label:'No clock-out',sub:'You did not clock out. Inform your supervisor — meal allowance may not apply.',color:'#c2410c',bg:'#fff3e0'};
          if(hr.status==='present') return {label:'Present',sub:'Reported at '+t,color:'#1f8a5b',bg:'#e7f3ec'};
          if(hr.status==='mc')     return {label:'On MC',sub:'Sick leave recorded',color:'#b9791a',bg:'#f7efdc'};
          if(hr.status==='absent') return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
        }
        return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
      }
      // Future reporting day - check for approved or pending leave
      const futureLeave=(this.state.myLeaveHistory||[]).find(r=>r.date===dk&&(r.status==='approved'||r.status==='pending'));
      if(futureLeave){
        const isMc=futureLeave.type==='mc';
        if(futureLeave.status==='approved')
          return {label:isMc?'MC approved':'Leave approved',sub:isMc?'Sick leave approved for this day':'Absence approved for this day',color:isMc?'#b9791a':'#c0392b',bg:isMc?'#f7efdc':'#f7e4e1'};
        return {label:isMc?'MC submitted':'Leave submitted',sub:'Awaiting admin approval',color:isMc?'#b9791a':'#c0392b',bg:isMc?'#fdf6e9':'#fbeeec'};
      }
      return {label:'Upcoming',sub:'Reporting day',color:'#5c6678',bg:'#eceef2'};
    }
    if(dst==='pre') return {label:'No reporting',sub:'Before your cycle started',color:'#5c6678',bg:'#eceef2'};
    return {label:'No reporting',sub:'Outside your reporting cycle',color:'#b9791a',bg:'#f7efdc'};
  },

  _buildCheckin: function(s, accent, hqName) {
    const me=this.cur();
    if(!me) return {
      todayLong:Utils.fmtLong(new Date()), clock:Utils.hhmm(s.now),
      myShiftLabel:'', myShiftWindow:'', myStatusLabel:'', myStatusColor:accent,
      myStatusPulse:'', phToday:false, phName:'',
      isMc:false, showPhases:false, phases:[], allDone:false,
      outOfCycle:false, outOfCycleTitle:'', outOfCycleSub:'',
      batchLabel:'', dekitCountdown:'', batchRange:'', showBatchInfo:false,
      whatsappLink:'', showWaShare:false,
      isOffline:!s.isOnline, offlinePending:s.offlinePending,
      hasPendingRequest:false, pendingRequestLabel:'', pendingRequestDate:'',
      isAbsent:false,
      openLeaveRequest:()=>{}, leaveOpen:false, leaveDate:'', leaveType:'personal', leaveReason:'',
      leaveIsPersonal:true, leaveIsMc:false, leaveIsOther:false,
      onLeaveDate:()=>{}, onLeaveTypePersonal:()=>{}, onLeaveTypeMc:()=>{}, onLeaveTypeOther:()=>{},
      onLeaveReason:()=>{}, submitLeaveRequest:()=>{}, closeLeaveRequest:()=>{},
    };
    const rec=this.myRec(), status=rec.status||'pending', m=Utils.meta(status);
    const todayD=this.dateForOffset(0);
    const isOffDay=!Utils.isReportDay(todayD);
    const noRep=isOffDay||this.isNoReport(0);
    const todayKey=Utils.dateKey(todayD);
    const myBatch=s.batches.find(b=>b.id===me.batch_id);
    let outOfCycle=false, outOfCycleTitle='', outOfCycleSub='';
    if(!myBatch){
      outOfCycle=true; outOfCycleTitle='No cycle assigned';
      outOfCycleSub='You have not been assigned to a batch. Contact your supervisor.';
    } else {
      const bsKey=myBatch.start_date, beKey=myBatch.end_date, ddKey=myBatch.dekit_date;
      if(todayKey<bsKey){
        outOfCycle=true; outOfCycleTitle='Cycle not started';
        outOfCycleSub='Your reporting cycle begins on '+Utils.fmtMed(new Date(bsKey+'T00:00:00'))+'. Nothing to do yet.';
      } else if(ddKey&&todayKey===ddKey){
        outOfCycle=true; outOfCycleTitle='Dekit day';
        outOfCycleSub='Return all equipment and submit your meal allowance forms today.';
      } else if(ddKey&&todayKey>ddKey){
        outOfCycle=true; outOfCycleTitle='Cycle complete';
        outOfCycleSub=(myBatch.label?myBatch.label+' is complete.':'Your cycle is complete.')+' Well done.';
      } else if(todayKey>beKey){
        outOfCycle=true; outOfCycleTitle='Reporting days ended';
        const dekitD=ddKey?Utils.fmtMed(new Date(ddKey+'T00:00:00')):null;
        outOfCycleSub='Your last reporting day has passed.'+(dekitD?' Dekit on '+dekitD+'.':'');
      }
    }

    const locVerified=s.locStatus==='verified', locLocating=s.locStatus==='locating';
    const locOutOfRange=s.locStatus==='out_of_range', locGpsError=s.locStatus==='gps_error';
    const locIdle=!s.locStatus||s.locStatus==='idle';
    let gLocBorder,gLocCardBg,gLocBadgeBg,gLocBadgeColor,gLocMsg,gLocMsgColor;
    const accStr=s.locAccuracy!=null?' · ±'+s.locAccuracy+'m GPS':'';
    const poorAcc=s.locAccuracy!=null&&s.locAccuracy>150;
    const slowMsg=s.locRetryCount>=2
      ?'Still locating. GPS signal is very weak. Move outside to an open area, then try again.'
      :'Taking longer than usual. Try stepping near a window or outside.';
    if(locVerified){
      gLocBorder='#cfe6d8';gLocCardBg='#f5faf7';gLocBadgeBg='#e7f3ec';gLocBadgeColor='#1f8a5b';
      gLocMsg=s.locDistance+' m from '+hqName+', on-site'+accStr;gLocMsgColor='#1f8a5b';
    }
    else if(locOutOfRange){gLocBorder='#f1d3cf';gLocCardBg='#fbeeec';gLocBadgeBg='#f7e4e1';gLocBadgeColor='#c0392b';const veryPoorAcc=s.locAccuracy!=null&&s.locAccuracy>300;const badFix=s.locDistance!=null&&s.locDistance>50000;gLocMsg=(veryPoorAcc||badFix)?('GPS signal too weak to verify your location'+(s.locAccuracy!=null?' (±'+s.locAccuracy+'m)':'')+'. Step outside to an open area with clear sky and try again.'):s.locDistance+' m away. You must be at '+hqName+' to check in.'+accStr+(poorAcc?'\n\nNote: GPS accuracy is low (±'+s.locAccuracy+'m). If you are on-site, move outside and try again.':'');gLocMsgColor='#c0392b';}
    else if(locGpsError){gLocBorder='#f0e2c2';gLocCardBg='#fdf6e9';gLocBadgeBg='#f7efdc';gLocBadgeColor='#b9791a';gLocMsg=s.locGpsMsg||'Location unavailable. Check permissions and try again.';gLocMsgColor='#b9791a';}
    else if(locLocating){gLocBorder='#eef0f4';gLocCardBg='#fff';gLocBadgeBg='#eceef2';gLocBadgeColor=accent;gLocMsg=s.locSlow?slowMsg:'Locating you via GPS...';gLocMsgColor='#8a94a3';}
    else{gLocBorder='#eef0f4';gLocCardBg='#fff';gLocBadgeBg='#eceef2';gLocBadgeColor='#8a94a3';gLocMsg='Tap "Locate me" to verify your location.';gLocMsgColor='#8a94a3';}

    const shift='OFFICE';
    const now=s.now;
    const testMode=s.demo;
    const isCas=this._myDept()==='cas';
    const phaseDefs=isCas?[
      {key:'p1',num:1,label:'Check in to work',needsGps:true,depends:null},
      {key:'p4',num:2,label:'Check out',needsGps:true,depends:'p1'},
    ]:[
      {key:'p1',num:1,label:'Check in to work',needsGps:true,depends:null},
      {key:'p2',num:2,label:'Lunch break',needsGps:true,depends:'p1'},
      {key:'p3',num:3,label:'Return from lunch',needsGps:true,depends:'p2'},
      {key:'p4',num:4,label:'Check out',needsGps:true,depends:'p3'},
    ];
    const phases=phaseDefs.map(pd=>{
      const time=rec[pd.key];
      const dist=rec[pd.key+'dist']??null;
      const done=!!time;
      const locked=!!pd.depends&&!rec[pd.depends];
      const inWin=testMode||Utils.phaseInWindow(shift,pd.key,now,isCas?'cas':null);
      const pastWin=!testMode&&Utils.phaseWindowPast(shift,pd.key,now,isCas?'cas':null);
      const upcoming=!done&&!locked&&!inWin&&!pastWin;
      const lateActive=pd.key!=='p4'&&!done&&!locked&&pastWin;
      const isActive=!done&&!locked&&(inWin||pastWin);
      const myGpsActive=isActive&&pd.needsGps&&s.locPhase===pd.key;
      const doneText=done?(pd.needsGps?(dist!=null?'GPS verified · '+dist+' m from '+hqName:'GPS verified'):'Recorded'):'';
      const btnLabel=pd.key==='p1'?'Check in to work':pd.key==='p2'?'Record lunch break':pd.key==='p3'?'Return from lunch':'Check out';
      const win=Utils.phaseWindow(shift,pd.key,isCas?'cas':null);
      const locIsOutOfRange=myGpsActive&&locOutOfRange;
      const _waPhaseLabel=pd.key==='p1'?'Check in':pd.key==='p2'?'Lunch break':pd.key==='p3'?'Return from lunch':'Check out';
      const _waGeoMsg=`Hi, I need help with my attendance.\n\nName: ${me.name}\nPhase: ${_waPhaseLabel}\nDate: ${Utils.dateKey(this.baseDate())}\n\nGPS shows me ${s.locDistance!=null?s.locDistance+'m ':''}out of range. Please assist with a manual record.`;
      const geofenceWaLink=`https://api.whatsapp.com/send?text=${encodeURIComponent(_waGeoMsg)}`;
      return {
        key:pd.key, num:pd.num, label:pd.label, isLast:pd.key==='p4', notLast:pd.key!=='p4',
        needsGps:pd.needsGps, notNeedsGps:!pd.needsGps,
        done, notDone:!done, time:time||'-', doneText,
        labelColor:done?'#1f8a5b':isActive?'#161f30':'#a0a8b4',
        locked, upcoming, isActive, notActive:!isActive||done,
        lateActive, btnBg:lateActive?'#b9791a':accent,
        stepBg:done?'#1f8a5b':isActive?(lateActive?'#b9791a':accent):'#eceef2',
        stepColor:done||isActive?'#fff':'#8a94a3',
        stepShadow:done?'0 0 0 3px #d4ede0':isActive?'0 0 0 3px #dbe6fa':'none',
        connectorBg:done?'#1f8a5b':'#eceef2',
        rowPadBot:done?'8px':'16px',
        subLabel:win?(pd.key==='p4'?'From '+win[0]:win[0]+' to '+win[1]):'',
        btnLabel,
        onStart:this.startPhaseGps(pd.key),
        onSubmit:this.doPhase(pd.key),
        gpsStarted:myGpsActive,
        gpsNotStarted:isActive&&pd.needsGps&&!myGpsActive,
        locLocating:myGpsActive&&locLocating,
        locVerified:myGpsActive&&locVerified,
        locNeedsAction:myGpsActive&&(locIdle||locOutOfRange||locGpsError),
        locShowReload:false,
        locIsPermErr:myGpsActive&&locGpsError&&s.locPermErr,
        locIsNotPermErr:!(myGpsActive&&locGpsError&&s.locPermErr),
        locBtnLabel:locLocating?'Locating...':(locIdle?'Locate me':'Try again'),
        locBtnDisabled:myGpsActive&&locLocating,
        locBtnOpacity:myGpsActive&&locLocating?'.6':'1',
        locBorder:myGpsActive?gLocBorder:'#eef0f4',
        locCardBg:myGpsActive?gLocCardBg:'#fff',
        locBadgeBg:myGpsActive?gLocBadgeBg:'#eceef2',
        locBadgeColor:myGpsActive?gLocBadgeColor:'#8a94a3',
        locMsg:myGpsActive?gLocMsg:('Tap "Locate me" to verify you are at '+hqName+'.'),
        locMsgColor:myGpsActive?gLocMsgColor:'#8a94a3',
        checkInOpacity:(myGpsActive&&locVerified&&!s.phaseSubmitting)?'1':'.45',
        checkInPE:(myGpsActive&&locVerified&&!s.phaseSubmitting)?'auto':'none',
        locIsOutOfRange, geofenceWaLink,
        showGpsBypass: myGpsActive && locGpsError,
        bypassLabel: pd.key==='p1'?'Check in without GPS':pd.key==='p2'?'Record break without GPS':pd.key==='p3'?'Record return without GPS':'Check out without GPS',
        onBypass: this.doPhaseBypass(pd.key),
        showBrowserTip: myGpsActive && locGpsError && !s.locPermErr,
      };
    });
    const allDone=phases.every(ph=>ph.done);
    const summaryP1=rec.p1||'-', summaryP2=rec.p2||'-', summaryP3=rec.p3||'-', summaryP4=rec.p4||'-', summaryP2Label='LUNCH';
    const shiftStart='09:00';
    const [_sc,_sm]=shiftStart.split(':').map(Number);
    const _lateMs=rec.p1?(()=>{const[h,m]=rec.p1.split(':').map(Number);return(h*60+m)-(_sc*60+_sm);})():0;
    const isLate=_lateMs>=60;
    const incompletePastRec=s.history.find(r=>r.status==='present'&&(isCas?!r.work_end_time:(!r.lunch_out_time||!r.work_return_time||!r.work_end_time)));
    const hasIncompletePast=!!incompletePastRec;
    const incompletePastDate=hasIncompletePast?Utils.fmtMed(new Date(incompletePastRec.date+'T00:00:00')):'';
    const _waDate=Utils.fmtMed(this.baseDate());
    const _waBreakLabel='LUNCH';
    const _waTimes=[];
    if(rec.p1) _waTimes.push('IN  '+rec.p1);
    if(!isCas&&rec.p2) _waTimes.push(_waBreakLabel+'  '+rec.p2);
    if(!isCas&&rec.p3) _waTimes.push('BACK  '+rec.p3);
    if(rec.p4) _waTimes.push('OUT  '+rec.p4);
    const _waLateNote=isLate?' · Late check-in':'';
    const waMsg=status==='present'
      ?`✅ *${me.name}* | ${Utils.shiftLabel(me.shift)}\n${_waDate}${_waLateNote}\n\n${_waTimes.join('  ·  ')}`
      :status==='mc'
      ?`🤒 *${me.name}* | On MC today\n${Utils.shiftLabel(me.shift)}  ·  ${_waDate}`
      :'';
    const whatsappLink=waMsg?'https://api.whatsapp.com/send?text='+encodeURIComponent(waMsg):'';
    const showWaShare=!!(status==='present'||status==='mc');
    const activeBatch=myBatch||s.batches[s.activeBatchIdx||0];
    const batchLabel=activeBatch?.label||'';
    const dekit=activeBatch?.dekit_date?new Date(activeBatch.dekit_date+'T00:00:00'):null;
    const todayMid=new Date();todayMid.setHours(0,0,0,0);
    const dekitDaysLeft=dekit?Math.round((dekit-todayMid)/86400000):null;
    const dekitCountdown=dekitDaysLeft===null?'':dekitDaysLeft===0?'Return equipment today':dekitDaysLeft>0?`${dekitDaysLeft} day${dekitDaysLeft!==1?'s':''} to dekit`:'Cycle complete';
    const batchRange=activeBatch?(Utils.fmtShort(new Date(activeBatch.start_date+'T00:00:00'))+' to '+Utils.fmtShort(new Date(activeBatch.end_date+'T00:00:00'))):'';
    const _todayPend=(s.myPendingRequests||[]).find(r=>r.date===todayKey);
    const _pendMs=_todayPend?.created_at?Date.now()-new Date(_todayPend.created_at).getTime():0;
    const pendingRequestExpired=!!(_todayPend&&_pendMs>172800000);
    const _pendH=Math.floor(_pendMs/3600000),_pendD=Math.floor(_pendH/24);
    const pendingRequestTimeAgo=_todayPend?.created_at?(_pendH<1?'Just now':_pendH<24?_pendH+' hr'+(_pendH!==1?'s':'')+' ago':_pendD+' day'+(_pendD!==1?'s':'')+' ago'):'';
    return {
      todayLong:Utils.fmtLong(this.baseDate()),
      clock:Utils.hhmm(s.now),
      myShiftLabel:Utils.shiftLabel(me.shift), myShiftWindow:Utils.shiftWindow(me.shift),
      myStatusLabel:outOfCycle?outOfCycleTitle:noRep?'No reporting':m.label,
      myStatusColor:outOfCycle?'#8a94a3':noRep?accent:m.color,
      myStatusBg:outOfCycle?'#eceef2':noRep?'#eef3fc':m.bg,
      myStatusPulse:(!outOfCycle&&status==='pending'&&!noRep)?'animation:pulseDot 1.6s ease infinite;':'',
      phToday:!outOfCycle&&noRep,
      phName:Utils.holidayName(todayD)||(isOffDay?'Reservists do not report on weekends.':'No CNB reporting today.'),
      isMc:!outOfCycle&&status==='mc'&&!noRep,
      isAbsent:!outOfCycle&&status==='absent'&&!noRep,
      showTeamSection:!outOfCycle&&!noRep&&(status==='mc'||status==='absent')&&!!(me?.batch_id&&s.personnel.some(p=>p.batch_id===me.batch_id&&p.id!==s.currentUserId&&(p.role||'reservist')==='reservist')),
      hasPendingRequest:!outOfCycle&&!noRep&&status!=='mc'&&status!=='absent'&&!!(_todayPend&&!pendingRequestExpired&&status!=='present'),
      pendingRequestLabel:_todayPend?.type==='mc'?'MC':'absence',
      pendingRequestDate:_todayPend?.date?Utils.fmtMed(new Date(_todayPend.date+'T00:00:00')):'',
      pendingRequestExpired:!outOfCycle&&!noRep&&pendingRequestExpired, pendingRequestTimeAgo,
      onCancelPendingRequest:_todayPend?this.cancelLeaveRequest(_todayPend.id):()=>{},
      showPhases:!outOfCycle&&!noRep&&status!=='mc'&&status!=='absent'&&!(_todayPend&&!pendingRequestExpired&&status!=='present'),
      outOfCycle, outOfCycleTitle, outOfCycleSub,
      phases, allDone,
      summaryP1, summaryP2, summaryP3, summaryP4, summaryP2Label,
      showLunchSummary:!isCas, summaryGridCols:isCas?'repeat(2,1fr)':'repeat(4,1fr)',
      isLate, lateShiftStart:shiftStart,
      hasIncompletePast, incompletePastDate,
      canAddLateReason:isLate&&!rec.lateReason&&status==='present'&&!outOfCycle&&!noRep,
      hasLateReason:isLate&&!!rec.lateReason,
      lateReasonDisplayText:rec.lateReason||'',
      openLateReason:this.openLateReason,
      lateReasonModalTitle:rec.lateReason?'Edit late reason':'Late check-in',
      lateReasonModalSub:rec.lateReason?'Update your reason for the late check-in.':'You checked in more than an hour late. Give a brief reason. Your admin will see it.',
      showLateWarning:s.showLateWarning, dismissLateWarning:this.dismissLateWarning,
      lateReasonOpen:s.lateReasonOpen, lateReasonText:s.lateReasonText,
      onLateReasonText:this.onLateReasonText, submitLateReason:this.submitLateReason,
      skipLateReason:this.skipLateReason, lateReasonSubmitting:s.lateReasonSubmitting,
      lateReasonEmpty:!(s.lateReasonText||'').trim(),
      lateReasonReady:!!(s.lateReasonText||'').trim()&&!s.lateReasonSubmitting,
      batchLabel, dekitCountdown, batchRange, showBatchInfo:!!activeBatch,
      showCheckinReminder:!outOfCycle&&!noRep&&status==='pending'&&!s.demo&&(Utils.phaseInWindow(shift,'p1',now,isCas?'cas':null)||Utils.phaseWindowPast(shift,'p1',now,isCas?'cas':null)),
      // Work timer and meal eligibility
      ...(() => {
        const nowHhmm=Utils.hhmm(s.now);
        const onBreak=!!(rec.p1&&rec.p2&&!rec.p3);
        const workMinsVal=Utils.workMins(rec,nowHhmm);
        const breakMinsVal=onBreak?Math.max(0,Utils._hmToMins(nowHhmm)-Utils._hmToMins(rec.p2)):(rec.p2&&rec.p3?Math.max(0,Utils._hmToMins(rec.p3)-Utils._hmToMins(rec.p2)):0);
        const isMealEligible=Utils.mealEligible(rec,nowHhmm);
        const mealStatusText=rec.p4?(isMealEligible?'Meal eligible':'No meal allowance'):(isMealEligible?'Meal eligible':'No meal claim');
        const mealStatusColor=isMealEligible?'#1f8a5b':'#b9791a';
        const mealStatusBg=isMealEligible?'#e7f3ec':'#fdf6e9';
        const mealStatusBorderColor=isMealEligible?'#a8d5bb':'#f0e2c2';
        return {
          showWorkTimer:!outOfCycle&&!noRep&&status==='present'&&!!rec.p1,
          workTimerDisplay:Utils.fmtMins(workMinsVal),
          onBreak, breakDisplay:Utils.fmtMins(breakMinsVal),
          isMealEligible, mealStatusText, mealStatusColor, mealStatusBg, mealStatusBorderColor,
          showClockOutReminder:isMealEligible&&!rec.p4&&!outOfCycle&&!noRep,
        };
      })(),
      ...(()=>{
        if(!myBatch) return {upcomingNoRepDays:[],hasUpcomingNoRepDays:false};
        const tomorrow=Utils.addDays(todayD,1);
        const days=[];
        for(let d=new Date(tomorrow);Utils.dateKey(d)<=myBatch.end_date;d=Utils.addDays(d,1)){
          const dk=Utils.dateKey(d), holName=Utils.holidayName(d);
          if(Utils.isReportDay(d)&&(holName||s.noReportDays.has(dk))){
            days.push({label:Utils.fmtMed(d)+(holName?' · '+holName:'')});
          }
        }
        return {upcomingNoRepDays:days, hasUpcomingNoRepDays:days.length>0};
      })(),
      whatsappLink, showWaShare,
      isOffline:!s.isOnline, offlinePending:s.offlinePending, offlineQueueCount:this._offlineQueues?.length||0,
      retrySync:this.retrySync, refreshPage:this.refreshPage,
      isInAppBrowser:s.isInAppBrowser, inAppBrowserName:s.inAppBrowserName,
      openLeaveRequest:this.openLeaveRequest(Utils.dateKey(this.baseDate())),
      leaveOpen:s.leaveOpen, leaveDate:s.leaveDate, leaveType:s.leaveType, leaveReason:s.leaveReason, leaveReady:!!(s.leaveDate),
      leaveSubmittingOpacity:s.leaveSubmitting?'0.55':'1', leaveSubmittingPE:s.leaveSubmitting?'none':'auto',
      onLeaveDate:this.onLeaveDate,
      leaveIsPersonal:s.leaveType==='personal', leaveIsMc:s.leaveType==='mc',
      onLeaveTypePersonal:this.onLeaveType('personal'), onLeaveTypeMc:this.onLeaveType('mc'),
      onLeaveReason:this.onLeaveReason, submitLeaveRequest:this.submitLeaveRequest, closeLeaveRequest:this.closeLeaveRequest,
      welfareNote:rec.welfareNote||'', hasWelfareNote:!!(rec.welfareNote),
      welfareNoteBtnLabel:rec.welfareNote?'Edit daily note':'Add a note for today',
      canAddWelfareNote:s.role==='admin'&&!outOfCycle&&!noRep&&Utils.isReportDay(todayD),
      supervisorNote:rec.welfareNote||'', hasSupervisorNote:s.role==='reservist'&&!!(rec.welfareNote),
      openWelfareNote:this.openWelfareNote, closeWelfareNote:this.closeWelfareNote,
      welfareNoteOpen:s.welfareNoteOpen, welfareNoteText:s.welfareNoteText, welfareNoteSaving:s.welfareNoteSaving, welfareNoteSavingOpacity:s.welfareNoteSaving?0.6:1,
      onWelfareNoteText:this.onWelfareNoteText, submitWelfareNote:this.submitWelfareNote,
      // Broadcast notice for reservist
      ...(() => { const _bn=(s.batches.find(x=>x.id===me?.batch_id))?.notice_text||''; return {batchNotice:_bn, hasBatchNotice:!!_bn}; })(),
    };
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
        else style=cellBase+'background:#f7e4e1;color:#c0392b;border:2px solid #e5a9a4;cursor:pointer;';
      }
      if(dst==='work'&&off>0){
        const fl=(s.myLeaveHistory||[]).find(r=>r.date===dk&&(r.status==='approved'||r.status==='pending'));
        if(fl?.status==='approved') style=cellBase+(fl.type==='mc'?'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;':'background:#f7e4e1;color:#c0392b;border:2px solid #e5a9a4;')+'cursor:pointer;';
        else if(fl?.status==='pending') style=cellBase+(fl.type==='mc'?'background:#fdf6e9;color:#b9791a;border:1px dashed #e8c77a;':'background:#fbeeec;color:#c0392b;border:1px dashed #e5a9a4;')+'cursor:pointer;';
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
