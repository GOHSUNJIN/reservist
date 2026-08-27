// ── Briefings view builder ────────────────────────────────────────────────
const BriefingsBuilders = {

  _buildBriefings: function(s, accent) {
    const activeBatch=s.batches[s.activeBatchIdx||0];
    const mealActive=!!(activeBatch?.meal_active);
    const OFFICE_ROLE={title:'Office Hours',window:'0900 to 1800, Lunch 1200 to 1400',items:['Escort contractors when required.','Assist with Red Teaming exercises if needed.']};
    const me=this.cur();
    const briefTab=s.briefTab||'info';
    const briefTabs=[{key:'info',label:'Info'},{key:'history',label:'Requests'}].map(t=>({
      ...t, onClick:this.setBriefTab(t.key),
      style:`flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;${briefTab===t.key?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':'background:transparent;color:#8a94a3;'}`,
    }));
    const waGroupUrl=this.props.waGroupLink||'';
    return {
      myShiftTitle:OFFICE_ROLE.title, myShiftWindow:OFFICE_ROLE.window, myShiftItems:OFFICE_ROLE.items, myShiftNote:'',
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
        'No submission needed on public holidays or no-reporting days.',
      ]:[
        'When active: submit daily Mon-Fri, including MC days.',
        'Mark PRESENT if shift completed, MC if on sick leave.',
        'No submission needed on public holidays or no-reporting days.',
      ],
      dekitItems:[
        'Fill meal allowance forms and submit to the Manpower Officer, endorsed by Ops Branch supervisor.',
        'Bring hardcopies of any MCs taken.',
        'Update WhatsApp once all PNSMEN have arrived.',
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
            waLink:p.contact?`https://api.whatsapp.com/send?phone=65${p.contact.replace(/[\s-]/g,'')}`:''
          };
        }) : [],
      showTeam: !!(me?.batch_id && s.personnel.some(p=>p.batch_id===me.batch_id&&p.id!==s.currentUserId&&(p.role||'reservist')==='reservist')),
      casInfoBlocked: s.role==='reservist' && this._myDept()==='cas',
      leaveHistoryItems: (()=>{
        const raw=s.myLeaveHistory||[];
        const pend=s.myPendingRequest;
        const list=(pend&&!raw.some(r=>r.id===pend.id))?[pend,...raw]:raw;
        const _pri={pending:4,approved:3,rejected:2,cancelled:1};
        const byDate=new Map();
        for(const r of list){
          const ex=byDate.get(r.date);
          if(!ex||(_pri[r.status]||0)>(_pri[ex.status]||0)) byDate.set(r.date,r);
        }
        return [...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date));
      })().map(r=>({
        id:r.id,
        typeLabel:r.type==='mc'?'MC':r.type==='other'?'Other':'Personal Leave',
        dateLabel:r.date?Utils.fmtMed(new Date(r.date+'T00:00:00')):'',
        statusLabel:r.status==='approved'?'Approved':r.status==='rejected'?'Declined':r.status==='cancelled'?'Withdrawn':'Pending',
        statusColor:r.status==='approved'?'#1f8a5b':r.status==='rejected'?'#c0392b':r.status==='cancelled'?'#8a94a3':'#b9791a',
        statusBg:r.status==='approved'?'#e7f3ec':r.status==='rejected'?'#f7e4e1':r.status==='cancelled'?'#f0f2f7':'#fdf6e9',
        statusBorder:r.status==='approved'?'#b8dfc9':r.status==='rejected'?'#f1d0cc':r.status==='cancelled'?'#d4d9e2':'#f0e2c2',
        isApproved:r.status==='approved',
        isRejected:r.status==='rejected',
        isPending:r.status==='pending',
        isCancelled:r.status==='cancelled',
        reason:r.reason||'',
        rejectionReasonText:r.rejection_reason||'No reason provided.',
        showReviewedByApproved:!!(r.reviewed_by&&r.status==='approved'),
        reviewedBy:r.reviewed_by||'',
        canCancel:r.status==='pending',
        onCancel:this.cancelLeaveRequest(r.id),
      })),
      showLeaveHistory:((s.myLeaveHistory||[]).length>0)||!!s.myPendingRequest, myLeaveHistoryLoaded:s.myLeaveHistoryLoaded,
      showLeaveItems:(((s.myLeaveHistory||[]).length>0)||!!s.myPendingRequest)&&!!s.myLeaveHistoryLoaded,
      showLeaveEmpty:!(((s.myLeaveHistory||[]).length>0)||!!s.myPendingRequest)&&!!s.myLeaveHistoryLoaded,
    };
  },

};
