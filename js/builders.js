// ── View model builders ───────────────────────────────────────────────────
// Each _build* method assembles a flat data object consumed by the DC template
// engine. All methods are regular functions bound to the component instance.
const Builders = {

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
    if(dst==='nr') return {label:'No reporting',sub:'Marked as a no-reporting day',color:'#8a94a3',bg:'#f0f2f7'};
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
          if(hr.status==='present') return {label:'Present',sub:'Reported at '+t,color:'#1f8a5b',bg:'#e7f3ec'};
          if(hr.status==='mc')     return {label:'On MC',sub:'Sick leave recorded',color:'#b9791a',bg:'#f7efdc'};
          if(hr.status==='absent') return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
        }
        return {label:'Absent',sub:'No attendance recorded',color:'#c0392b',bg:'#f7e4e1'};
      }
      return {label:'Upcoming',sub:'Reporting day',color:'#5c6678',bg:'#eceef2'};
    }
    if(dst==='pre') return {label:'No reporting',sub:'Before your cycle started',color:'#5c6678',bg:'#eceef2'};
    return {label:'No reporting',sub:'Outside your reporting cycle',color:'#b9791a',bg:'#f7efdc'};
  },

  _buildAuth: function(s, accent) {
    const today=Utils.dateKey(this.baseDate());
    const sortedBatches=[...(s.batches||[])].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const liveBatch=sortedBatches.find(b=>today>=b.start_date&&today<=b.end_date)||this._liveBatch(s.batches);
    const isLastDay=!!(liveBatch&&today===liveBatch.end_date);
    const nextBatch=isLastDay?sortedBatches.find(b=>b.start_date>(liveBatch?.end_date||'')):null;
    const targetBatch=nextBatch||liveBatch;
    const targetMembers=(s.personnel||[]).filter(p=>p.batch_id===targetBatch?.id&&(p.role||'reservist')==='reservist');
    const {am:amCount, pm:pmCount}=this._shiftSlotCounts(targetMembers);
    const amFull=amCount>=2, pmFull=pmCount>=2;
    let suShift=s.suShift;
    if((suShift==='AM'&&amFull)||(suShift==='PM'&&pmFull)) suShift='OFFICE';
    const shiftOptions=[
      {value:'AM', disabled:amFull, selected:suShift==='AM', label:amFull?'AM shift (0830-1530) (Taken)':'AM shift (0830-1530) ('+amCount+'/2)'},
      {value:'PM', disabled:pmFull, selected:suShift==='PM', label:pmFull?'PM shift (1530-2230) (Taken)':'PM shift (1530-2230) ('+pmCount+'/2)'},
      {value:'OFFICE', disabled:false, selected:suShift==='OFFICE', label:'Office (0900-1800)'},
    ];
    const tb=a=>`flex:1;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;${a?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':'background:transparent;color:#8a94a3;'}`;
    const bs=targetBatch?new Date(targetBatch.start_date+'T00:00:00'):null;
    const be=targetBatch?new Date(targetBatch.end_date+'T00:00:00'):null;
    const intakeLabel=targetBatch?.label||'';
    const intakeRangeFull=bs&&be?(Utils.fmtShort(bs)+' to '+Utils.fmtShort(be)+' '+bs.getFullYear()):'';
    return {
      showAuth:!s.authed, showApp:s.authed,
      isLogin:s.authMode==='login'&&!s.signupPending, isSignup:s.authMode==='signup'&&!s.signupPending,
      goLogin:this.goLogin, goSignup:this.goSignup,
      loginTabStyle:tb(s.authMode==='login'), signupTabStyle:tb(s.authMode==='signup'),
      accountDeleted:s.accountDeleted,
      loginNric:s.loginContact, loginPassword:s.loginPassword, authError:s.authError,
      authLoading:s.loading, authLoadingOpacity:s.loading?0.6:1,
      loginBtnLabel:s.loading?'Logging in…':'Log in',
      signupBtnLabel:s.loading?'Creating account…':'Create account',
      onLoginNric:this.onLoginContact, onLoginPassword:this.onLoginPassword,
      onLoginNricKeyDown:this.onLoginContactKeyDown,
      doLogin:this.doLogin, demoReservist:this.demoReservist, demoAdmin:this.demoAdmin,
      suName:s.suName, suContact:s.suContact, suShift, shiftOptions, suPassword:s.suPassword,
      amFull, pmFull, amCount, pmCount,
      amShiftLabel:amFull?'AM shift (0830-1530) (Taken)':'AM shift (0830-1530) ('+amCount+'/2)',
      pmShiftLabel:pmFull?'PM shift (1530-2230) (Taken)':'PM shift (1530-2230) ('+pmCount+'/2)',
      onSuName:this.onSuName, onSuContact:this.onSuContact, onSuShift:this.onSuShift, onSuShiftSelect:this.onSuShiftSelect, onSuPassword:this.onSuPassword,
      doSignup:this.doSignup,
      intakeLabel, intakeRange:intakeRangeFull, intakeRangeFull,
      signupIsNextCycle:isLastDay&&!!nextBatch,
      forgotPasswordOpen:s.forgotPasswordOpen,
      openForgotPassword:this.openForgotPassword, closeForgotPassword:this.closeForgotPassword,
      capsLock:!!s.capsLock, onPwKeyDown:this.onPwKeyDown,
      signupPending:s.signupPending, dismissSignupPending:this.dismissSignupPending,
    };
  },

  _buildNav: function(s, accent, orgName) {
    const me=this.cur();
    const TITLES={checkin:'Check-In',briefings:'Briefings',attendance:'Attendance',meal:'Meal Allowance',overview:'Dashboard',roster:'Roster',log:'Attendance Log',people:'Personnel'};
    const nc=t=>s.tab===t?accent:'#9aa3b2';
    const ni=t=>s.tab===t?accent:'transparent';
    return {
      isReservist:s.role==='reservist', isAdmin:s.role==='admin',
      headerChipClick:this.headerChipClick, logout:this.logout,
      userName:s.role==='admin'?(me?.name||'Supervisor'):(me?.name||''),
      userInitials:s.role==='admin'?(me?.name?Utils.initials(me.name):'SV'):Utils.initials(me?.name||''),
      tabTitle:TITLES[s.tab]||'',
      headerKicker:s.isSuperAdmin?'Master, '+orgName:s.role==='admin'?'Admin, '+orgName:orgName+', PNSMEN',
      goCheckin:this.go('checkin'), goBriefings:this.go('briefings'), goAttendance:this.go('attendance'), goMeal:this.go('meal'),
      goOverview:()=>{ this.setState({tab:'overview'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goRoster:()=>{ this.setState({tab:'roster'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goLog:()=>{ this.setState({tab:'log'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goPeople:this.goPeople,
      cCheckin:nc('checkin'), cBriefings:nc('briefings'), cAttendance:nc('attendance'), cMeal:nc('meal'),
      cOverview:nc('overview'), cRoster:nc('roster'), cLog:nc('log'), cPeople:nc('people'),
      ntCheckin:ni('checkin'), ntBriefings:ni('briefings'), ntAttendance:ni('attendance'), ntMeal:ni('meal'),
      ntOverview:ni('overview'), ntRoster:ni('roster'), ntLog:ni('log'), ntPeople:ni('people'),
      tabCheckin:s.tab==='checkin', tabBriefings:s.tab==='briefings', tabAttendance:s.tab==='attendance', tabMeal:s.tab==='meal',
      tabOverview:s.tab==='overview', tabRoster:s.tab==='roster', tabLog:s.tab==='log', tabPeople:s.tab==='people',
      pendingSignupCount:s.pendingSignups.length,
      hasPendingSignups:s.pendingSignups.length>0,
    };
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
      openShiftChange:()=>{}, shiftChangeOpen:false, shiftChangeNew:'AM', shiftChangeReason:'',
      shiftChangeIsAm:true, shiftChangeIsPm:false, shiftChangeIsOffice:false,
      onShiftChangeAm:()=>{}, onShiftChangePm:()=>{}, onShiftChangeOffice:()=>{},
      onShiftChangeReason:()=>{}, submitShiftChange:()=>{}, closeShiftChange:()=>{},
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
      const warnAcc=poorAcc?' (low accuracy; try again outdoors for a better reading)':'';
      gLocBorder=poorAcc?'#f0e2c2':'#cfe6d8';gLocCardBg=poorAcc?'#fdf6e9':'#f5faf7';gLocBadgeBg=poorAcc?'#f7efdc':'#e7f3ec';gLocBadgeColor=poorAcc?'#b9791a':'#1f8a5b';
      gLocMsg=s.locDistance+' m from '+hqName+', on-site'+accStr+warnAcc;gLocMsgColor=poorAcc?'#b9791a':'#1f8a5b';
    }
    else if(locOutOfRange){gLocBorder='#f1d3cf';gLocCardBg='#fbeeec';gLocBadgeBg='#f7e4e1';gLocBadgeColor='#c0392b';const veryPoorAcc=s.locAccuracy!=null&&s.locAccuracy>300;gLocMsg=veryPoorAcc?('GPS signal too weak to verify your location (±'+s.locAccuracy+'m).\n\nStep outside to an open area with clear sky and try again.'):s.locDistance+' m away. You must be at '+hqName+' to check in.'+accStr+(poorAcc?'\n\nNote: GPS accuracy is low (±'+s.locAccuracy+'m). If you are on-site, move outside and try again.':'');gLocMsgColor='#c0392b';}
    else if(locGpsError){gLocBorder='#f0e2c2';gLocCardBg='#fdf6e9';gLocBadgeBg='#f7efdc';gLocBadgeColor='#b9791a';gLocMsg=s.locGpsMsg||'Location unavailable. Check permissions and try again.';gLocMsgColor='#b9791a';}
    else if(locLocating){gLocBorder='#eef0f4';gLocCardBg='#fff';gLocBadgeBg='#eceef2';gLocBadgeColor=accent;gLocMsg=s.locSlow?slowMsg:'Locating you via GPS...';gLocMsgColor='#8a94a3';}
    else{gLocBorder='#eef0f4';gLocCardBg='#fff';gLocBadgeBg='#eceef2';gLocBadgeColor='#8a94a3';gLocMsg='Tap "Locate me" to verify your location.';gLocMsgColor='#8a94a3';}

    const shift=me.shift||'AM';
    const now=s.now;
    const testMode=s.demo;
    const phaseDefs=[
      {key:'p1',num:1,label:'Check in to work',needsGps:true,depends:null},
      {key:'p2',num:2,label:shift==='PM'?'Dinner break':'Lunch break',needsGps:true,depends:'p1'},
      {key:'p3',num:3,label:shift==='PM'?'Return from dinner':'Return from lunch',needsGps:true,depends:'p2'},
      {key:'p4',num:4,label:'Check out',needsGps:true,depends:'p3'},
    ];
    const phases=phaseDefs.map(pd=>{
      const time=rec[pd.key];
      const dist=pd.key==='p1'?rec.p1dist:pd.key==='p3'?rec.p3dist:null;
      const done=!!time;
      const locked=!!pd.depends&&!rec[pd.depends];
      const inWin=testMode||Utils.phaseInWindow(shift,pd.key,now);
      const pastWin=!testMode&&Utils.phaseWindowPast(shift,pd.key,now);
      const upcoming=!done&&!locked&&!inWin&&!pastWin;
      const lateActive=pd.key!=='p4'&&!done&&!locked&&pastWin;
      const isActive=!done&&!locked&&(inWin||pastWin);
      const myGpsActive=isActive&&pd.needsGps&&s.locPhase===pd.key;
      const doneText=done?(pd.needsGps?(dist!=null?'GPS verified · '+dist+' m from '+hqName:'GPS verified'):'Recorded'):'';
      const btnLabel=pd.key==='p1'?'Check in to work':pd.key==='p2'?(shift==='PM'?'Record dinner break':'Record lunch break'):pd.key==='p3'?(shift==='PM'?'Return from dinner':'Return from lunch'):'Check out';
      const win=Utils.phaseWindow(shift,pd.key);
      const locIsOutOfRange=myGpsActive&&locOutOfRange;
      const _waPhaseLabel=pd.key==='p1'?'Check in':pd.key==='p2'?(shift==='PM'?'Dinner break':'Lunch break'):pd.key==='p3'?(shift==='PM'?'Return from dinner':'Return from lunch'):'Check out';
      const _waGeoMsg=`Hi, I need help with my attendance.\n\nName: ${me.name}\nShift: ${Utils.shiftLabel(me.shift)}\nPhase: ${_waPhaseLabel}\nDate: ${Utils.dateKey(this.baseDate())}\n\nGPS shows me ${s.locDistance!=null?s.locDistance+'m ':''}out of range. Please assist with a manual record.`;
      const geofenceWaLink=`https://api.whatsapp.com/send?text=${encodeURIComponent(_waGeoMsg)}`;
      return {
        key:pd.key, num:pd.num, label:pd.label, isLast:pd.key==='p4', notLast:pd.key!=='p4',
        needsGps:pd.needsGps, notNeedsGps:!pd.needsGps,
        done, notDone:!done, time:time||'-', doneText,
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
        locShowReload:myGpsActive&&locGpsError&&s.locPermErr,
        locBtnLabel:locLocating?'Locating...':(locIdle?'Locate me':'Try again'),
        locBtnDisabled:myGpsActive&&locLocating,
        locBorder:myGpsActive?gLocBorder:'#eef0f4',
        locCardBg:myGpsActive?gLocCardBg:'#fff',
        locBadgeBg:myGpsActive?gLocBadgeBg:'#eceef2',
        locBadgeColor:myGpsActive?gLocBadgeColor:'#8a94a3',
        locMsg:myGpsActive?gLocMsg:('Tap "Locate me" to verify you are at '+hqName+'.'),
        locMsgColor:myGpsActive?gLocMsgColor:'#8a94a3',
        checkInOpacity:(myGpsActive&&locVerified&&!s.phaseSubmitting)?'1':'.45',
        checkInPE:(myGpsActive&&locVerified&&!s.phaseSubmitting)?'auto':'none',
        locIsOutOfRange, geofenceWaLink,
        showGpsBypass: myGpsActive && locGpsError && (s.locRetryCount||0) >= 2 && (pd.key==='p1'||pd.key==='p3'),
        onBypass: this.doPhaseBypass(pd.key),
        showBrowserTip: myGpsActive && locGpsError,
      };
    });
    const allDone=phases.every(ph=>ph.done);
    const summaryP1=rec.p1||'-', summaryP2=rec.p2||'-', summaryP3=rec.p3||'-', summaryP4=rec.p4||'-';
    const shiftStart={AM:'08:30',PM:'15:30',OFFICE:'09:00'}[shift]||'08:30';
    const [_sc,_sm]=shiftStart.split(':').map(Number);
    const _lateMs=rec.p1?(()=>{const[h,m]=rec.p1.split(':').map(Number);return(h*60+m)-(_sc*60+_sm);})():0;
    const isLate=_lateMs>=60;
    const _waTimes=[];
    if(rec.p1) _waTimes.push('IN '+rec.p1);
    if(rec.p2) _waTimes.push('LUNCH '+rec.p2);
    if(rec.p3) _waTimes.push('BACK '+rec.p3);
    if(rec.p4) _waTimes.push('OUT '+rec.p4);
    const waMsg=status==='present'
      ?`✅ ${me.name} | ${Utils.shiftLabel(me.shift)}\n${_waTimes.join(' · ')}`
      :status==='mc'
      ?`🤒 ${me.name} is on MC today (${Utils.shiftLabel(me.shift)}).`
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
      hasPendingRequest:!outOfCycle&&!noRep&&status!=='mc'&&status!=='absent'&&!!(s.myPendingRequest&&s.myPendingRequest.date===todayKey&&status!=='present'),
      pendingRequestLabel:s.myPendingRequest?.type==='mc'?'MC':s.myPendingRequest?.type==='shift_change'?'shift change':'absence',
      pendingRequestDate:s.myPendingRequest?.date?Utils.fmtMed(new Date(s.myPendingRequest.date+'T00:00:00')):'',
      showPhases:!outOfCycle&&!noRep&&status!=='mc'&&status!=='absent'&&!(s.myPendingRequest&&s.myPendingRequest.date===todayKey&&status!=='present'),
      outOfCycle, outOfCycleTitle, outOfCycleSub,
      phases, allDone,
      summaryP1, summaryP2, summaryP3, summaryP4,
      isLate, lateShiftStart:shiftStart,
      showLateWarning:s.showLateWarning, dismissLateWarning:this.dismissLateWarning,
      lateReasonOpen:s.lateReasonOpen, lateReasonText:s.lateReasonText,
      onLateReasonText:this.onLateReasonText, submitLateReason:this.submitLateReason,
      skipLateReason:this.skipLateReason, lateReasonSubmitting:s.lateReasonSubmitting,
      lateReasonEmpty:!(s.lateReasonText||'').trim(),
      lateReasonReady:!!(s.lateReasonText||'').trim()&&!s.lateReasonSubmitting,
      batchLabel, dekitCountdown, batchRange, showBatchInfo:!!activeBatch,
      whatsappLink, showWaShare,
      isOffline:!s.isOnline, offlinePending:s.offlinePending, offlineQueueCount:this._offlineQueues?.length||0,
      retrySync:this.retrySync, refreshPage:this.refreshPage,
      isInAppBrowser:s.isInAppBrowser, inAppBrowserName:s.inAppBrowserName,
      openLeaveRequest:this.openLeaveRequest(Utils.dateKey(this.baseDate())),
      leaveOpen:s.leaveOpen, leaveDate:s.leaveDate, leaveType:s.leaveType, leaveReason:s.leaveReason,
      onLeaveDate:this.onLeaveDate,
      leaveIsPersonal:s.leaveType==='personal', leaveIsMc:s.leaveType==='mc', leaveIsOther:s.leaveType==='other',
      onLeaveTypePersonal:this.onLeaveType('personal'), onLeaveTypeMc:this.onLeaveType('mc'), onLeaveTypeOther:this.onLeaveType('other'),
      onLeaveReason:this.onLeaveReason, submitLeaveRequest:this.submitLeaveRequest, closeLeaveRequest:this.closeLeaveRequest,
      openShiftChange:this.openShiftChange, shiftChangeOpen:s.shiftChangeOpen,
      shiftChangeNew:s.shiftChangeNew, shiftChangeReason:s.shiftChangeReason,
      onShiftChangeAm:this.onShiftChangeNew('AM'), onShiftChangePm:this.onShiftChangeNew('PM'), onShiftChangeOffice:this.onShiftChangeNew('OFFICE'),
      shiftChangeIsAm:s.shiftChangeNew==='AM', shiftChangeIsPm:s.shiftChangeNew==='PM', shiftChangeIsOffice:s.shiftChangeNew==='OFFICE',
      onShiftChangeReason:this.onShiftChangeReason, submitShiftChange:this.submitShiftChange, closeShiftChange:this.closeShiftChange,
      welfareNote:rec.welfareNote||'', hasWelfareNote:!!(rec.welfareNote),
      welfareNoteBtnLabel:rec.welfareNote?'Edit daily note':'Add a note for today',
      canAddWelfareNote:!outOfCycle&&!noRep&&Utils.isReportDay(todayD),
      openWelfareNote:this.openWelfareNote, closeWelfareNote:this.closeWelfareNote,
      welfareNoteOpen:s.welfareNoteOpen, welfareNoteText:s.welfareNoteText, welfareNoteSaving:s.welfareNoteSaving, welfareNoteSavingOpacity:s.welfareNoteSaving?0.6:1,
      onWelfareNoteText:this.onWelfareNoteText, submitWelfareNote:this.submitWelfareNote,
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
      if(st==='nr')    return cellBase+'background:#f0f2f7;color:#8a94a3;border:1px dashed #c4c9d4;';
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
        if(pst==='present') style=cellBase+'background:#e7f3ec;color:#1f8a5b;border:2px solid #a8d5bb;cursor:pointer;';
        else if(pst==='mc') style=cellBase+'background:#f7efdc;color:#b9791a;border:2px solid #e8c77a;cursor:pointer;';
        else style=cellBase+'background:#f7e4e1;color:#c0392b;border:2px solid #e5a9a4;cursor:pointer;';
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
    const rec=this.myRec(), status=rec.status||'pending';
    const todayD=this.baseDate(), today=Utils.dateKey(todayD);
    const activeBatch=s.batches.find(b=>b.id===me.batch_id)||s.batches[s.activeBatchIdx||0];

    const _tc=(v,c1,c0)=>v?c1:c0;
    const _dc='#c2c8d2';

    const todayRow=(Utils.isReportDay(todayD)&&!this.isNoReport(0))
      ?[{date:Utils.fmtMed(todayD)+', Today',dateKey:today,shift:Utils.shiftLabel(me.shift),status,
         p1:rec.p1||'-',p2:rec.p2||'-',p3:rec.p3||'-',p4:rec.p4||'-',
         p1Color:_tc(rec.p1,'#161f30',_dc),p2Color:_tc(rec.p2,'#161f30',_dc),p3Color:_tc(rec.p3,'#161f30',_dc),p4Color:_tc(rec.p4,'#161f30',_dc),
         showTimes:status==='present',lateReason:rec.lateReason||'',showLateReason:!!(rec.lateReason),...Utils.meta(status)}]:[];

    const histKeys=new Set(s.history.map(r=>r.date));
    const histRows=s.history.map(r=>{
      const d=new Date(r.date+'T00:00:00');
      const tk=s=>s?s.slice(0,5):null;
      const p1=tk(r.check_in_time),p2=tk(r.lunch_out_time),p3=tk(r.work_return_time),p4=tk(r.work_end_time);
      return {date:Utils.fmtMed(d),dateKey:r.date,shift:Utils.shiftLabel(me.shift),status:r.status,
        p1:p1||'-',p2:p2||'-',p3:p3||'-',p4:p4||'-',
        p1Color:_tc(p1,'#161f30',_dc),p2Color:_tc(p2,'#161f30',_dc),p3Color:_tc(p3,'#161f30',_dc),p4Color:_tc(p4,'#161f30',_dc),
        showTimes:r.status==='present',lateReason:r.late_reason||'',showLateReason:!!(r.late_reason),...Utils.meta(r.status)};
    });

    const missedRows=[];
    if(activeBatch){
      const bStart=new Date(activeBatch.start_date+'T00:00:00'), yesterday=Utils.addDays(todayD,-1);
      for(let d=new Date(bStart);d<=yesterday;d=Utils.addDays(d,1)){
        const dk=Utils.dateKey(d);
        if(Utils.isReportDay(d)&&dk<=activeBatch.end_date&&!Utils.holidayName(d)&&!s.noReportDays.has(dk)&&!histKeys.has(dk)){
          missedRows.push({date:Utils.fmtMed(d),dateKey:dk,shift:Utils.shiftLabel(me.shift),status:'missed',
            p1:'-',p2:'-',p3:'-',p4:'-',p1Color:_dc,p2Color:_dc,p3Color:_dc,p4Color:_dc,showTimes:false,...Utils.meta('missed')});
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
    const cycleNotStarted=!!(activeBatch&&today<activeBatch.start_date);
    const cycleStartsLabel=activeBatch?Utils.fmtLong(new Date(activeBatch.start_date+'T00:00:00')):'';

    const PAGE=10, page=s.historyPage||1;
    const pagedHistory=myHistory.slice(0,page*PAGE);
    const historyHasMore=myHistory.length>page*PAGE;
    const historyRemaining=myHistory.length-pagedHistory.length;
    return {myHistory:pagedHistory,historyHasMore,historyRemaining,showMoreHistory:this.showMoreHistory,statMyPresent,statMyMc,statMyMissed,statMyDays:statMyPresent+statMyMc,cycleDone,cycleTotal,cyclePct:cycleTotal?Math.round(cycleDone/cycleTotal*100):0,historyTruncated:s.history.length>=500,historyEmpty:pagedHistory.length===0,totalRecorded,attendanceRate,attendanceRateText,showAttendanceSummary,cycleNotStarted,cycleStartsLabel};
  },

  _buildBriefings: function(s, accent) {
    const activeBatch=s.batches[s.activeBatchIdx||0];
    const mealActive=!!(activeBatch?.meal_active);
    const ROLES={
      AM:{title:'AM Shift',window:'0830 to 1530, Lunch 1200-1430',items:['MOPs for CNB testing must exit via the same route they entered.','MOPs must not loiter around the area.','Escort contractors around the building when required.','Assist with Red Teaming exercises if needed.']},
      PM:{title:'PM Shift',window:'1530 to 2230, Dinner 1630-1830',items:['Same duties as AM shift.','May leave early if CNB confirms no more reporting.'],note:'Fridays: stay till 1800 only. May move to canteen after 1630. Update WhatsApp when leaving DHQ or if on MC.'},
      OFFICE:{title:'Office Hours',window:'0900 to 1800, Lunch 1200-1400',items:['Escort contractors when required.','Assist with Red Teaming exercises if needed.']},
    };
    const me=this.cur(), myShift=me?.shift||'AM';
    const tab=s.rolesTab||myShift, active=ROLES[tab], mine=ROLES[myShift];
    const roleTabs=[['AM','AM'],['PM','PM'],['OFFICE','Office']].map(([key,label])=>({
      key,label,isMyShift:key===myShift,onClick:this.setRolesTab(key),
      style:`flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;${tab===key?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':key===myShift?`background:rgba(47,95,208,.07);color:${accent};`:'background:transparent;color:#8a94a3;'}`,
    }));
    const waGroupUrl=this.props.waGroupLink||'';
    return {
      roleTabs, roleTitle:active.title, roleWindow:active.window, roleItems:active.items, roleNote:active.note||'',
      myShiftTitle:mine.title, myShiftWindow:mine.window, myShiftItems:mine.items, myShiftNote:mine.note||'',
      briefLocation:(this.props.hqName||'Bedok DHQ')+' Canteen',
      briefAttire:'Civilian: pants and covered shoes',
      mealActive,
      mealStatusBanner:mealActive?'Active: submit your form daily (Mon-Fri).':'On hold: do not submit the form for now.',
      mealStatusStyle:mealActive?'background:#e7f3ec;border:1px solid #a8d5bb;border-radius:8px;padding:7px 10px;font-size:12px;color:#1f8a5b;font-weight:600;margin-bottom:8px;':'background:#fdf6e9;border:1px solid #f0e2c2;border-radius:8px;padding:7px 10px;font-size:12px;color:#8a6d2a;font-weight:600;margin-bottom:8px;',
      mealFormLink:'https://go.gov.sg/gdiv-pnsmen-meal-allowance',
      mealItems:mealActive?[
        'Mark PRESENT if you completed your shift, MC if on sick leave.',
        'Upload a copy of your MC when declaring sick leave.',
        "Supervisor's email is sent daily via the WhatsApp group.",
        'No submission needed on public holidays or no‑reporting days.',
      ]:[
        'When active: submit daily Mon-Fri, including MC days.',
        'Mark PRESENT if shift completed, MC if on sick leave.',
        'No submission needed on public holidays or no‑reporting days.',
      ],
      dekitItems:[
        'Fill meal allowance forms and submit to the Manpower Officer, endorsed by Ops Branch supervisor.',
        'Bring hardcopies of any MCs taken.',
        'Update WhatsApp once all PNSMEN have arrived.',
      ],
      waGroupUrl, showWaGroup:!!waGroupUrl,
      teamMembers: me?.batch_id ? s.personnel
        .filter(p=>p.batch_id===me.batch_id&&p.id!==s.currentUserId&&(p.role||'reservist')==='reservist')
        .map(p=>({
          id:p.id, name:p.name, initials:Utils.initials(p.name),
          shiftLabel:Utils.shiftLabel(p.shift),
          contact:p.contact||'',
          waLink:p.contact?`https://api.whatsapp.com/send?phone=65${p.contact.replace(/[\s-]/g,'')}`:''
        })) : [],
      showTeam: !!(me?.batch_id && s.personnel.some(p=>p.batch_id===me.batch_id&&p.id!==s.currentUserId&&(p.role||'reservist')==='reservist')),
      leaveHistoryItems: s.myLeaveHistory.map(r=>({
        id:r.id,
        typeLabel:r.type==='mc'?'MC':r.type==='shift_change'?'Shift Change':r.type==='other'?'Other':'Personal Leave',
        dateLabel:r.date?Utils.fmtMed(new Date(r.date+'T00:00:00')):'',
        statusLabel:r.status==='approved'?'Approved':r.status==='rejected'?'Declined':'Pending',
        statusColor:r.status==='approved'?'#1f8a5b':r.status==='rejected'?'#c0392b':'#b9791a',
        statusBg:r.status==='approved'?'#e7f3ec':r.status==='rejected'?'#f7e4e1':'#fdf6e9',
        reason:r.reason||'',
        reviewedBy:r.reviewed_by||'',
        showReviewedBy:!!(r.reviewed_by&&r.status!=='pending'),
      })),
      showLeaveHistory:s.myLeaveHistory.length>0, myLeaveHistoryLoaded:s.myLeaveHistoryLoaded,
    };
  },

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
    const _sb='flex:1;padding:7px 4px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:background .15s,color .15s;';
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
      const av=s.avatars[p.id]||'';
      const avatarStyle=av?`background-image:url("${av}");background-size:cover;background-position:center;color:transparent;`:'';
      return {
        id:p.id, name:p.name, initials:Utils.initials(p.name), shiftLabel:Utils.shiftLabel(p.shift),
        label:mm.label, color:mm.color, bg:mm.bg, isLate,
        lateReason, showLateReason,
        welfareNote:r.welfareNote||'', showWelfareNote:!!(r.welfareNote),
        showNoGps: !!(r.gpsBypassed),
        p1:r.p1||'-', p2:r.p2||'-', p3:r.p3||'-', p4:r.p4||'-',
        p1Color:r.p1?(isLate?'#c0392b':'#161f30'):'#c2c8d2',
        p2Color:r.p2?'#161f30':'#c2c8d2',
        p3Color:r.p3?'#161f30':'#c2c8d2',
        p4Color:r.p4?'#161f30':'#c2c8d2',
        avatarStyle, shift:p.shift||'AM',
        p2Label:p.shift==='PM'?'DIN':'LCH',
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
      onTimesP1:this.onTimesP1, onTimesP2:this.onTimesP2, onTimesP3:this.onTimesP3, onTimesP4:this.onTimesP4,
      saveTimesEdit:this.saveTimesEdit, closeTimesEdit:this.closeTimesEdit,
      setLogFilterAll:this.setLogShiftFilter('all'), setLogFilterAm:this.setLogShiftFilter('AM'),
      setLogFilterPm:this.setLogShiftFilter('PM'), setLogFilterOffice:this.setLogShiftFilter('OFFICE'),
      logFilterAllStyle:_fBtn('all',accent), logFilterAmStyle:_fBtn('AM',accent),
      logFilterPmStyle:_fBtn('PM',accent), logFilterOfficeStyle:_fBtn('OFFICE',accent),
      askMarkAllAbsent:this.askMarkAllAbsent, markAllAbsent:this.markAllAbsent,
      cancelMarkAllAbsent:this.cancelMarkAllAbsent,
      markingAllAbsent:s.markingAllAbsent, confirmMarkAllAbsent:s.confirmMarkAllAbsent, notConfirmMarkAllAbsent:!s.confirmMarkAllAbsent,
      markAllAbsentStyle:`padding:5px 8px;border-radius:7px;cursor:pointer;border:1px solid #f7e4e1;background:#fff;color:#c0392b;opacity:${s.markingAllAbsent?'0.45':'1'};display:flex;align-items:center;flex-shrink:0;`,
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
        return {dateLabel:W[d.getDay()]+' '+d.getDate()+' '+M[d.getMonth()]+' '+d.getFullYear(),label:mm.label,color:mm.color,bg:mm.bg,p1:r.check_in_time?r.check_in_time.slice(0,5):'-',p4:r.work_end_time?r.work_end_time.slice(0,5):'-'};
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
      editingNoteText:s.editingNoteText, onNoteText:this.onNoteText, saveNote:this.saveNote, closeNote:this.closeNote,
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
      onNpName:this.onNpName, onNpContact:this.onNpContact, onNpShift:this.onNpShift, onNpPassword:this.onNpPassword, addPerson:this.addPerson,
      mealActive:!!(activeBatch?.meal_active), toggleMealActive:this.toggleMealActive,
      mealToggleTrackBg:activeBatch?.meal_active?accent:'#39435a',
      mealToggleKnobX:activeBatch?.meal_active?'25px':'3px',
      batchLoading:s.batchLoading,
      exportCsv:this.exportCsv,
      batchJumpDate:s.batchJumpDate, onBatchJumpDate:this.onBatchJumpDate, jumpToDate:this.jumpToDate,
      pendingLeaves:(s.pendingLeaves||[]).map(l=>({
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
      })),
      pendingLeavesCount:(s.pendingLeaves||[]).length,
      hasPendingLeaves:(s.pendingLeaves||[]).length>0,
      pendingLeavesLoaded:s.pendingLeavesLoaded,
      batchTotalPresent, batchTotalMc, batchTotalAbsent,
      batchAvgPct:batchAvgPct!==null?batchAvgPct+'%':'-',
      showBatchStats:s.peopleStatsLoaded,
      isSuperAdmin:s.isSuperAdmin,
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
      pendingSignups:(()=>{
        const approvedContacts=new Set((s.approvedSignups||[]).map(a=>(a.contact||'').replace(/[\s-]/g,'')));
        return s.pendingSignups.map(r=>{
          const b=(s.batches||[]).find(b=>b.id===r.batch_id);
          const initials=r.name.trim().split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'?';
          const isReactivation=approvedContacts.has((r.contact||'').replace(/[\s-]/g,''));
          return {id:r.id,name:r.name,contact:r.contact,shift:r.shift,batchLabel:b?b.label:'',initials,
            createdAt:r.created_at?new Date(r.created_at).toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'}):'',
            isReactivation, isNew:!isReactivation,
            onApprove:this.approveSignup(r.id), onReject:this.rejectSignup(r.id)};
        });
      })(),
      hasPendingSignups:s.pendingSignups.length>0,
      pendingSignupCount:s.pendingSignups.length,
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

  _buildAccount: function(s, accent) {
    const me=this.cur(); if(!me) return {};
    const avatarUrl=s.avatars[s.currentUserId]||'';
    const acctBatch=(s.batches||[]).find(b=>b.id===me.batch_id)||(s.batches||[]).find(b=>b.is_live)||null;
    const acctDekit=acctBatch?.dekit_date?new Date(acctBatch.dekit_date+'T00:00:00'):null;
    const acctTodayMid=new Date();acctTodayMid.setHours(0,0,0,0);
    const acctDkLeft=acctDekit?Math.round((acctDekit-acctTodayMid)/86400000):null;
    const acctDekitCountdown=acctDkLeft===null?'':acctDkLeft===0?'Return equipment today':acctDkLeft>0?`${acctDkLeft} day${acctDkLeft!==1?'s':''} to dekit`:'Cycle complete';
    const acctShowDekit=s.role==='reservist'&&!!acctDekitCountdown;
    return {
      accountOpen:s.accountOpen,
      closeAccount:this.closeAccount, askDelete:this.askDelete, cancelDelete:this.cancelDelete, deleteAccount:this.deleteAccount,
      confirmDelete:s.confirmDelete, deleteIdle:!s.confirmDelete,
      acctNric:'', acctContact:me.contact||'-',
      onAvatarFile:this.onAvatarFile,
      headerAvatarBg:avatarUrl?('url("'+avatarUrl+'")') :'none',
      headerNoAvatar:!avatarUrl,
      acctAvatarBg:avatarUrl?('url("'+avatarUrl+'")') :'none',
      acctNoAvatar:!avatarUrl, acctHasAvatar:!!avatarUrl,
      removeAvatar:this.removeAvatar,
      isReservistRole:s.role==='reservist',
      acctNameEdit:s.acctNameEdit, onAcctNameEdit:this.onAcctNameEdit, saveAcctName:this.saveAcctName,
      acctNameError:s.acctNameError, acctNameSuccess:s.acctNameSuccess,
      acctPwCurrent:s.acctPwCurrent, acctPwNew:s.acctPwNew, acctPwConfirm:s.acctPwConfirm,
      onAcctPwCurrent:this.onAcctPwCurrent, onAcctPwNew:this.onAcctPwNew, onAcctPwConfirm:this.onAcctPwConfirm,
      saveAcctPw:this.saveAcctPw,
      acctPwError:s.acctPwError, acctPwSuccess:s.acctPwSuccess,
      acctSaving:s.acctSaving, acctSavingOpacity:s.acctSaving?0.6:1, capsLock:!!s.capsLock, onPwKeyDown:this.onPwKeyDown,
      acctDekitCountdown, acctShowDekit,
      adminNotifGranted:s.adminNotifGranted, requestAdminNotifs:this.requestAdminNotifs,
    };
  },
};
