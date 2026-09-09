// ── Briefings view builder ────────────────────────────────────────────────
const BriefingsBuilders = {

  _buildBriefings: function(s, accent) {
    const activeBatch=s.batches[s.activeBatchIdx||0];
    const me=this.cur();
    // Use the user's own batch for personal progress and dekit info
    const myBatch=(me?.batch_id?s.batches.find(b=>b.id===me.batch_id):null)||activeBatch;
    const OFFICE_ROLE={title:'Office Hours',window:'0900 to 1800, Lunch 1200 to 1400',items:['Escort contractors when required.','Check signages and designated spots.','Assist with Red Teaming exercises if needed.']};
    const LNF_ROLE={title:'Logistics and Finance',window:'0900 to 1700, Mon to Sat',items:['Escort contractors to and from the office.','During events, assist with deployments, refreshments and milk runs.','Assist NSFs with moving items from place to place when needed.','Collect and return keys from the Manpower Officer\'s office.']};
    const isLnf=this._myDept()==='lnf';
    const activeRole=isLnf?LNF_ROLE:OFFICE_ROLE;
    const briefTab=s.briefTab||'info';
    const briefTabs=[{key:'info',label:'Info'},{key:'history',label:'Requests'}].map(t=>({
      ...t, onClick:this.setBriefTab(t.key),
      style:`flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;${briefTab===t.key?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':'background:transparent;color:#8a94a3;'}`,
    }));
    const waGroupUrl=this.props.waGroupLink||'';
    // Meal stats — merge today's live attendance over stale history / backfill
    const today=Utils.dateKey(this.baseDate());
    const bStart=myBatch?.start_date||'';
    const bEnd=myBatch?.end_date||'';
    const _todayLive=s.attendance?.[s.currentUserId];
    const _h=(()=>{
      const hist=(s.mealHistory||[]).slice();
      if(_todayLive&&!hist.some(r=>r.date===today))
        hist.push({date:today,..._todayLive});
      return hist.filter(r=>
        Utils.isReportDay(new Date(r.date+'T00:00:00'),this._myDept())&&
        (!bStart||r.date>=bStart)&&(!bEnd||r.date<=bEnd)
      );
    })();
    const _toM=t=>{const[h,m]=t.split(':').map(Number);return h*60+m;};
    const _workMins=r=>{
      if(!r.p1||!r.p4) return 0;
      const dept=this._myDept();
      if(dept==='cas') return _toM(r.p4)-_toM(r.p1);
      if(r.p2&&r.p3) return (_toM(r.p2)-_toM(r.p1))+(_toM(r.p4)-_toM(r.p3));
      return _toM(r.p4)-_toM(r.p1);
    };
    const mealPresent=_h.filter(r=>r.status==='present').length;
    const mealEligibleDays=_h.filter(r=>r.status==='present'&&!!r.p4&&_workMins(r)>=360).length;
    const mealMc=_h.filter(r=>r.status==='mc').length;
    const mealAbsent=_h.filter(r=>(r.status==='absent'||r.status==='missed')&&r.date<=today).length;
    const mealTotalDays=_h.filter(r=>r.date<=today).length;
    const mealProgressPct=mealTotalDays>0?Math.round(mealEligibleDays/mealTotalDays*100):0;
    const mealDayLabel=mealEligibleDays===1?'day':'days';
    const mealAllowanceLabel=mealEligibleDays===1?'allowance':'allowances';
    const _DW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],_DM=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mealDays=[..._h].filter(r=>r.date<=today).sort((a,b)=>b.date.localeCompare(a.date)).map((r,i,arr)=>{
      const d=new Date(r.date+'T00:00:00');
      const isEligible=r.status==='present'&&!!r.p4&&_workMins(r)>=360;
      const isPresentNoOut=r.status==='present'&&!r.p4;
      const isPresentUnder=r.status==='present'&&!!r.p4&&!isEligible;
      const isMc=r.status==='mc';
      let label,color,bg;
      if(isEligible){label='Entitled';color='#1f8a5b';bg='#e7f3ec';}
      else if(isPresentNoOut){label='No clock-out';color='#c2410c';bg='#fff3e0';}
      else if(isPresentUnder){label='Under 6 hrs';color='#b9791a';bg='#fdf6e9';}
      else if(isMc){label='MC / Leave';color='#b9791a';bg='#fdf6e9';}
      else{label='Absent';color='#c0392b';bg='#f7e4e1';}
      return {
        dateLabel:_DW[d.getDay()]+' '+d.getDate()+' '+_DM[d.getMonth()],
        label,color,bg,isEligible,
        showTimes:r.status==='present',
        checkIn:r.p1||'-',checkOut:r.p4||'–',
        borderBottom:i===arr.length-1?'none':'1px solid #f2f4f7',
      };
    });
    const hasMealDays=mealDays.length>0;
    // Cycle progress - count weekdays excluding public holidays and custom no-report days
    const bDekit=myBatch?.dekit_date||'';
    const _nrd=s.noReportDays instanceof Set?s.noReportDays:new Set(s.noReportDays||[]);
    let cycleDayLabel='',cycleProgressPct=0,showCycleProgress=false;
    if(bStart&&bEnd&&today>=bStart&&today<=bEnd){
      let total=0,elapsed=0;
      const todayD=new Date(today+'T00:00:00');
      for(const d=new Date(bStart+'T00:00:00'),end=new Date(bEnd+'T00:00:00');d<=end;d.setDate(d.getDate()+1)){
        const dk=Utils.dateKey(d);
        if(Utils.isReportDay(d,this._myDept())&&!_nrd.has(dk)&&!Utils.holidayName(d)){
          total++;
          if(d<=todayD) elapsed++;
        }
      }
      if(total>0){cycleDayLabel=`Day ${elapsed} of ${total}`;cycleProgressPct=Math.round((elapsed/total)*100);showCycleProgress=true;}
    }
    // Dekit countdown
    let infoDekitCountdown='',showInfoDekitCountdown=false;
    if(bDekit&&today<=bDekit){
      const diff=Math.round((new Date(bDekit+'T00:00:00')-new Date(today+'T00:00:00'))/86400000);
      const fmt=Utils.fmtShort(new Date(bDekit+'T00:00:00'));
      infoDekitCountdown=diff===0?`Today (${fmt})`:`${diff} day${diff===1?'':'s'} away (${fmt})`;
      showInfoDekitCountdown=true;
    }
    // Transport
    const briefTransport=this.props.hqTransport||'';
    const showBriefTransport=!!briefTransport;
    return {
      myShiftTitle:activeRole.title, myShiftWindow:activeRole.window, myShiftItems:activeRole.items, myShiftNote:'',
      briefLocation:(this.props.hqName||'Bedok DHQ')+' Canteen',
      briefDays:isLnf?'Monday to Saturday':'Monday to Friday',
      briefAttire:'Civilian',
      briefAttireRowBorder:showBriefTransport?'1px solid #f2f4f7':'none',
      briefTransport, showBriefTransport,
      mealPresent, mealMc, mealAbsent, mealTotalDays, mealEligibleDays, mealProgressPct, mealDayLabel, mealAllowanceLabel, mealDays, hasMealDays,
      dekitItems:[
        {n:'1',text:'Confirm your meal allowance entitlement count with the Manpower Officer.'},
        {n:'2',text:'Bring hardcopies of any MCs taken.'},
        {n:'3',text:'Update the Manpower Officer in charge once all PNSMEN have arrived.'},
      ],
      cycleDayLabel, cycleProgressPct, showCycleProgress,
      infoDekitCountdown, showInfoDekitCountdown,
      sickItems:[
        {n:'1',text:'Inform your supervisor as early as possible.'},
        {n:'2',text:'Submit an MC or Personal Leave request in the app. Your record updates immediately.'},
        {n:'3',text:'Keep your MC hardcopy. You will need it for dekit day.'},
      ],
      briefTabs, briefTabInfo:briefTab==='info', briefTabHistory:briefTab==='history',
      waGroupUrl, showWaGroup:!!waGroupUrl,
      teamMembers: me?.batch_id ? s.personnel
        .filter(p=>p.batch_id===me.batch_id&&p.id!==s.currentUserId&&(p.role||'reservist')==='reservist')
        .map(p=>{
          const av=s.avatars[p.id]||'';
          return {
            id:p.id, name:p.name, initials:Utils.initials(p.name),
            avatarStyle:Utils.avatarStyle(av),
            avatarInitials:av?'':Utils.initials(p.name),
            avatarCursor:av?'cursor:pointer;':'',
            onViewAvatar:av?this.openAvatarLightbox(av):null,
            shiftLabel:Utils.shiftLabel(p.shift),
            contact:p.contact||'',
            onCopyContact:this.copyContact(p.contact||''),
            waLink:p.contact?`https://api.whatsapp.com/send?phone=65${p.contact.replace(/[\s-]/g,'')}`:''
          };
        }) : [],
      showTeam: !!(me?.batch_id && s.personnel.some(p=>p.batch_id===me.batch_id&&p.id!==s.currentUserId&&(p.role||'reservist')==='reservist')),
      casInfoBlocked: s.role==='reservist' && this._myDept()==='cas',
      lfInfoBlocked:  false,
      showFullInfo:   s.role!=='reservist' || this._myDept()!=='cas',
      ...(()=>{
        const raw=s.myLeaveHistory||[];
        const pends=s.myPendingRequests||[];
        const newPends=pends.filter(p=>!raw.some(r=>r.id===p.id));
        const all=[...newPends,...raw].sort((a,b)=>b.date.localeCompare(a.date)||(b.created_at||'').localeCompare(a.created_at||''));
        const pri={pending:0,approved:1,rejected:2,cancelled:3};
        const byDate=new Map();
        for(const r of all){const prev=byDate.get(r.date);if(!prev||(pri[r.status]??4)<(pri[prev.status]??4)) byDate.set(r.date,r);}
        const deduped=[...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date));
        const lhf=s.leaveHistFilter||'all';
        const _fPill=(active)=>active?'-webkit-appearance:none;padding:5px 13px;border-radius:20px;border:none;font-size:12px;font-weight:600;background:#161f30;color:#fff;cursor:pointer;':'-webkit-appearance:none;padding:5px 13px;border-radius:20px;border:none;font-size:12px;font-weight:500;color:#8a94a3;background:#f1f3f6;cursor:pointer;';
        const filtered=lhf==='all'?deduped:deduped.filter(r=>r.status===lhf);
        // Auto-reset filter to 'all' when active filter yields no results
        if(lhf!=='all'&&filtered.length===0&&deduped.length>0) setTimeout(()=>this.setState({leaveHistFilter:'all'}),0);
        return {
          leaveHistFilter:lhf,
          setLeaveHistAll:()=>this.setState({leaveHistFilter:'all'}),
          setLeaveHistPending:()=>this.setState({leaveHistFilter:'pending'}),
          setLeaveHistApproved:()=>this.setState({leaveHistFilter:'approved'}),
          setLeaveHistRejected:()=>this.setState({leaveHistFilter:'rejected'}),
          setLeaveHistCancelled:()=>this.setState({leaveHistFilter:'cancelled'}),
          leaveHistFilterAllStyle:_fPill(lhf==='all'),
          leaveHistFilterPendingStyle:_fPill(lhf==='pending'),
          leaveHistFilterApprovedStyle:_fPill(lhf==='approved'),
          leaveHistFilterRejectedStyle:_fPill(lhf==='rejected'),
          leaveHistFilterCancelledStyle:_fPill(lhf==='cancelled'),
          showLeaveHistFilterPending:deduped.some(r=>r.status==='pending'),
          showLeaveHistFilterApproved:deduped.some(r=>r.status==='approved'),
          showLeaveHistFilterRejected:deduped.some(r=>r.status==='rejected'),
          showLeaveHistFilterCancelled:deduped.some(r=>r.status==='cancelled'),
          leaveHistFiltered:filtered.length>0, leaveHistEmpty:filtered.length===0&&deduped.length>0,
          leaveHistoryItems:filtered.map(r=>({
            id:r.id,
            typeLabel:r.type==='mc'?'MC':'Personal Leave',
            typeBg:'#fdf6e9',
            typeColor:'#b9791a',
            typeBorder:'#f0e2c2',
            dateLabel:r.date?Utils.fmtMed(new Date(r.date+'T00:00:00')):'',
            statusLabel:r.status==='approved'?'Approved':r.status==='rejected'?'Declined':r.status==='cancelled'?'Withdrawn':'Submitted',
            statusColor:r.status==='approved'?'#1f8a5b':r.status==='rejected'?'#c0392b':r.status==='cancelled'?'#8a94a3':'#b9791a',
            statusBg:r.status==='approved'?'#e7f3ec':r.status==='rejected'?'#f7e4e1':r.status==='cancelled'?'#f0f2f7':'#fdf6e9',
            statusBorder:r.status==='approved'?'#b8dfc9':r.status==='rejected'?'#f1d0cc':r.status==='cancelled'?'#d4d9e2':'#f0e2c2',
            leftBar:r.status==='approved'?'#1f8a5b':r.status==='rejected'?'#c0392b':r.status==='cancelled'?'#d4d9e2':'#f0be5a',
            isApproved:r.status==='approved',
            isRejected:r.status==='rejected',
            isPending:r.status==='pending',
            isCancelled:r.status==='cancelled',
            reason:r.reason||'',
            rejectionReasonText:r.rejection_reason||'No reason provided.',
            showReviewedByApproved:!!(r.reviewed_by&&r.status==='approved'),
            reviewedBy:r.reviewed_by||'',
            canCancel:r.status==='pending',
            isCancelConfirming:s.cancelLeaveId===r.id,
            onAskCancel:this.askCancelLeave(r.id),
            onConfirmCancel:this.cancelLeaveRequest(r.id),
            onDismissCancel:this.dismissCancelLeave,
          })),
        };
      })(),
      showLeaveHistory:((s.myLeaveHistory||[]).length>0)||!!(s.myPendingRequests?.length), myLeaveHistoryLoaded:s.myLeaveHistoryLoaded,
      showLeaveItems:(((s.myLeaveHistory||[]).length>0)||!!(s.myPendingRequests?.length))&&!!s.myLeaveHistoryLoaded,
      showLeaveEmpty:!(((s.myLeaveHistory||[]).length>0)||!!(s.myPendingRequests?.length))&&!!s.myLeaveHistoryLoaded,
    };
  },

};
