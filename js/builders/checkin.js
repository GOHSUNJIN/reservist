// ── Check-in view builder ──────────────────────────────────────────────────
const CheckinBuilders = {

  _buildCheckin: function(s, accent, hqName) {
    const me=this.cur();
    if(!me) return {
      todayLong:Utils.fmtLong(new Date()), clock:Utils.hhmm(s.now),
      myShiftLabel:'', myShiftWindow:'', myStatusLabel:'', myStatusColor:accent,
      myStatusPulse:'', phToday:false, phName:'',
      isMc:false, isPersonalLeave:false, showPhases:false, phases:[], allDone:false,
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
      ?`🤒 *${me.name}* | MC today\n${Utils.shiftLabel(me.shift)}  ·  ${_waDate}`
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
    const todayApprovedLeave=(s.myLeaveHistory||[]).find(r=>r.date===todayKey&&r.status==='approved'&&r.type!=='mc');
    const _todayPend=(s.myPendingRequests||[]).find(r=>r.date===todayKey);
    const _pendMs=_todayPend?.created_at?Date.now()-new Date(_todayPend.created_at).getTime():0;
    const pendingRequestExpired=!!(_todayPend&&_pendMs>172800000);
    const _pendH=Math.floor(_pendMs/3600000),_pendD=Math.floor(_pendH/24);
    const pendingRequestTimeAgo=_todayPend?.created_at?(_pendH<1?'Just now':_pendH<24?_pendH+' hr'+(_pendH!==1?'s':'')+' ago':_pendD+' day'+(_pendD!==1?'s':'')+' ago'):'';
    return {
      todayLong:Utils.fmtLong(this.baseDate()),
      clock:Utils.hhmm(s.now),
      myShiftLabel:Utils.shiftLabel(me.shift), myShiftWindow:Utils.shiftWindow(me.shift),
      myStatusLabel:outOfCycle?outOfCycleTitle:noRep?'No reporting':todayApprovedLeave&&status==='absent'?'Personal Leave':m.label,
      myStatusColor:outOfCycle?'#8a94a3':noRep?accent:todayApprovedLeave&&status==='absent'?'#b9791a':m.color,
      myStatusBg:outOfCycle?'#eceef2':noRep?'#eef3fc':todayApprovedLeave&&status==='absent'?'#f7efdc':m.bg,
      myStatusPulse:(!outOfCycle&&status==='pending'&&!noRep)?'animation:pulseDot 1.6s ease infinite;':'',
      phToday:!outOfCycle&&noRep,
      phName:Utils.holidayName(todayD)||(isOffDay?'Reservists do not report on weekends.':'No CNB reporting today.'),
      isMc:!outOfCycle&&status==='mc'&&!noRep,
      isPersonalLeave:!outOfCycle&&status==='absent'&&!noRep&&!!todayApprovedLeave,
      isAbsent:!outOfCycle&&status==='absent'&&!noRep&&!todayApprovedLeave,
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

};
