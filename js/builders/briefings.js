// ── Briefings view builder ────────────────────────────────────────────────
const BriefingsBuilders = {

  _buildBriefings: function(s, accent) {
    const activeBatch=s.batches[s.activeBatchIdx||0];
    const mealActive=!!(activeBatch?.meal_active);
    const ROLES={
      AM:{title:'AM Shift',window:'0830 to 1530, Lunch 1200 to 1430',items:['MOPs for CNB testing must exit via the same route they entered.','MOPs must not loiter around the area.','Escort contractors around the building when required.','Assist with Red Teaming exercises if needed.']},
      PM:{title:'PM Shift',window:'1530 to 2230, Dinner 1630 to 1830',items:['Same duties as AM shift.','May leave early if CNB confirms no more reporting.'],note:'Fridays: stay till 1800 only. May move to canteen after 1630. Update WhatsApp when leaving DHQ or if on MC.'},
      OFFICE:{title:'Office Hours',window:'0900 to 1800, Lunch 1200 to 1400',items:['Escort contractors when required.','Assist with Red Teaming exercises if needed.']},
    };
    const me=this.cur(), myShift=me?.shift||'AM';
    const tab=s.rolesTab||myShift, active=ROLES[tab], mine=ROLES[myShift];
    const roleTabs=[['AM','AM'],['PM','PM'],['OFFICE','Office']].map(([key,label])=>({
      key,label,isMyShift:key===myShift,onClick:this.setRolesTab(key),
      style:`flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;${tab===key?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':key===myShift?`background:rgba(47,95,208,.07);color:${accent};`:'background:transparent;color:#8a94a3;'}`,
    }));
    const briefTab=s.briefTab||'info';
    const briefTabs=[{key:'info',label:'Info'},{key:'history',label:'Leave History'}].map(t=>({
      ...t, onClick:this.setBriefTab(t.key),
      style:`flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;${briefTab===t.key?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':'background:transparent;color:#8a94a3;'}`,
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
      briefTabs, briefTabInfo:briefTab==='info', briefTabHistory:briefTab==='history',
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
        rejectionReason:r.rejection_reason||'',
        showRejectionReason:!!(r.rejection_reason&&r.status==='rejected'),
        reviewedBy:r.reviewed_by||'',
        showReviewedBy:!!(r.reviewed_by&&r.status!=='pending'),
      })),
      showLeaveHistory:s.myLeaveHistory.length>0, myLeaveHistoryLoaded:s.myLeaveHistoryLoaded,
    };
  },

};
