// ── Admin Batch builder ────────────────────────────────────────────────────
const AdminBatch = {

  build: function(self, s, accent, ctx) {
    const {batches,activeBatchIdx,activeBatch,activeMembers,npShift,todayForChips,liveBatch,approvedByContact} = ctx;
    const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
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
      return {label:b.label, range:Utils.fmtShort(bs)+' to '+Utils.fmtShort(be), onClick:self.setBatch(i), style:chipStyle, isPast, isActive, isFuture, startDate:b.start_date,
        pickerBg:isActive?'#eef3fc':'#fff', pickerLabelColor:isActive?'#2f5fd0':'#161f30'};
    });
    const activeChips=allChips.filter(c=>!c.isPast);
    const _pickerYearMap={};
    allChips.forEach((c,i)=>{
      const yr=batches[i]?.start_date?.slice(0,4)||'';
      if(!_pickerYearMap[yr]) _pickerYearMap[yr]=[];
      _pickerYearMap[yr].push({...c, onPick:()=>{ self.closeCyclePicker(); c.onClick(); }});
    });
    const allPickerYears=Object.keys(_pickerYearMap).sort((a,b)=>b-a);
    const activePickerYear=s.cyclePickerYear||null;
    const cyclePickerYears=allPickerYears.map(yr=>({
      year:yr,
      isSelected:yr===activePickerYear,
      style:yr===activePickerYear
        ?'-webkit-appearance:none;padding:5px 14px;background:#161f30;border:none;border-radius:20px;font-size:12px;font-weight:600;color:#fff;cursor:pointer;'
        :'-webkit-appearance:none;padding:5px 14px;background:#f0f2f5;border:none;border-radius:20px;font-size:12px;font-weight:600;color:#5c6678;cursor:pointer;',
      onSelect:()=>self.setCyclePickerYear(yr),
    }));
    const sortCycles=(arr)=>[...arr].sort((a,b)=>{
      if(a.isActive) return -1; if(b.isActive) return 1;
      if(!a.isPast&&!b.isPast){
        if(a.startDate!==b.startDate) return a.startDate>b.startDate?1:-1;
        return a.id>b.id?1:-1;
      }
      if(a.isPast&&b.isPast){
        if(a.startDate!==b.startDate) return a.startDate>b.startDate?-1:1;
        return a.id>b.id?-1:1;
      }
      return a.isPast?1:-1;
    });
    const cycleTotalPages=Math.max(1,allPickerYears.length);
    const safeCyclePage=Math.min(s.cyclePickerPage||1,cycleTotalPages);
    const currentPickerYear=allPickerYears[safeCyclePage-1];
    const cyclePickerGroups=currentPickerYear?[{year:currentPickerYear,cycles:sortCycles(_pickerYearMap[currentPickerYear])}]:[];
    const cyclePickerHasPrev=safeCyclePage>1, cyclePickerHasNext=safeCyclePage<cycleTotalPages;
    const cyclePickerShowPagination=cycleTotalPages>1;
    const cyclePickerPageInfo=`${safeCyclePage} / ${cycleTotalPages}`;
    const cyclePickerPrevColor=cyclePickerHasPrev?'#161f30':'#c4c9d4', cyclePickerPrevCursor=cyclePickerHasPrev?'pointer':'default';
    const cyclePickerNextColor=cyclePickerHasNext?'#161f30':'#c4c9d4', cyclePickerNextCursor=cyclePickerHasNext?'pointer':'default';
    const activeCycleLabel=activeBatch?.label||'No cycle';
    const _abs=activeBatch?new Date(activeBatch.start_date+'T00:00:00'):null;
    const _abe=activeBatch?new Date(activeBatch.end_date+'T00:00:00'):null;
    const activeCycleRange=_abs&&_abe?Utils.fmtShort(_abs)+' to '+Utils.fmtShort(_abe):'';
    const editTargetLabel=activeBatch?.label||'';
    const editTargetIsLive=!!activeBatch?.is_live;
    const _ebs=activeBatch?new Date(activeBatch.start_date+'T00:00:00'):null;
    const _ebe=activeBatch?new Date(activeBatch.end_date+'T00:00:00'):null;
    const editTargetRange=_ebs&&_ebe?(Utils.fmtShort(_ebs)+' to '+Utils.fmtShort(_ebe)+' '+_ebs.getFullYear()):'';
    const editTargetIsPast=!!(activeBatch&&activeBatch.end_date<todayForChips&&!activeBatch.is_live);
    const editTargetStatus=editTargetIsLive?'LIVE':editTargetIsPast?'PAST':'UPCOMING';
    const editTargetStatusChipBg=editTargetIsLive?'#22c55e':editTargetIsPast?'rgba(255,255,255,.1)':'rgba(47,95,208,.5)';
    const editTargetStatusChipColor=editTargetIsLive?'#fff':editTargetIsPast?'#8a94a3':'#a8c0f8';
    const _sortedBatches=[...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const _isLastDay=!!(liveBatch&&todayForChips===liveBatch.end_date);
    const _nextBatch=_isLastDay?_sortedBatches.find(b=>b.start_date>liveBatch.end_date):null;
    const signupTargetLabel=_nextBatch?_nextBatch.label:(liveBatch?.label||'');
    const signupIsNextCycle=!!_nextBatch;
    const lbs=liveBatch?new Date(liveBatch.start_date+'T00:00:00'):null, lbe=liveBatch?new Date(liveBatch.end_date+'T00:00:00'):null;
    const intakeLabel=liveBatch?liveBatch.label:'';
    const intakeRange=lbs&&lbe?(Utils.fmtShort(lbs)+' to '+Utils.fmtShort(lbe)):'';

    return {
      activeChips,
      cyclePickerGroups, cyclePickerOpen:s.cyclePickerOpen,
      cyclePickerYears, setCyclePickerYear:self.setCyclePickerYear,
      cyclePickerHasPrev, cyclePickerHasNext, cyclePickerShowPagination, cyclePickerPageInfo,
      cyclePickerPrevColor, cyclePickerPrevCursor, cyclePickerNextColor, cyclePickerNextCursor,
      cyclePickerNext:self.cyclePickerNext, cyclePickerPrev:self.cyclePickerPrev,
      openCyclePicker:self.openCyclePicker, closeCyclePicker:self.closeCyclePicker,
      activeCycleLabel, activeCycleRange,
      editTargetLabel, editTargetIsLive, editTargetRange, editTargetStatus, editTargetStatusChipBg, editTargetStatusChipColor,
      signupTargetLabel, signupIsNextCycle,
      signupCycleNote:signupIsNextCycle?' (next cycle)':'',
      intakeLabel,
      editingBatchLabel:s.editingBatchLabel, batchLabelText:s.batchLabelText,
      startEditBatchLabel:self.startEditBatchLabel, onBatchLabelText:self.onBatchLabelText,
      saveBatchLabel:self.saveBatchLabel, cancelBatchLabel:self.cancelBatchLabel,
      newBatchDate:s.newBatchDate,onNewBatchDate:self.onNewBatchDate,createBatch:self.createBatch,batchCreating:s.batchCreating,
      npName:s.npName, npContact:s.npContact, npShift, npPassword:s.npPassword,
      addPersonnelOpen:!!(s.addPersonnelOpen), toggleAddPersonnel:self.toggleAddPersonnel,
      addPersonnelBtnBg:s.addPersonnelOpen?'#161f30':'#eceef2',
      addPersonnelBtnStroke:s.addPersonnelOpen?'#fff':'#5c6678',
      showReenrollConfirm:!!(s.npReenrollRecord), showAddForm:!(s.npReenrollRecord),
      reenrollName:s.npReenrollRecord?.name||'',
      confirmReenroll:self.confirmReenroll, cancelReenroll:self.cancelReenroll,
      onNpName:self.onNpName, onNpContact:self.onNpContact, onNpShift:self.onNpShift, onNpPassword:self.onNpPassword, addPerson:self.addPerson,
      onNpAddSearch:self.onNpAddSearch, npAddSearch:s.npAddSearch||'',
      ...(()=>{
        const q=(s.npAddSearch||'').toLowerCase().trim();
        const results=q?(s.npDeactivatedPool||[]).filter(p=>p.name.toLowerCase().includes(q)||(p.contact||'').toLowerCase().includes(q)).slice(0,6).map(p=>({
          id:p.id, name:p.name, contact:p.contact||'', initials:Utils.initials(p.name),
          onSelect:()=>self.setState({npReenrollRecord:p, npName:p.name, npContact:p.contact||'', npAddSearch:''}),
        })):[];
        return {npAddSearchResults:results, npAddSearchHasResults:results.length>0, npAddSearchNoResults:!!(q&&!results.length)};
      })(),
      mealActive:!!(activeBatch?.meal_active), toggleMealActive:self.toggleMealActive,
      mealActiveText:activeBatch?.meal_active?'Active: reservists should submit daily.':'On hold: reservists should not submit.',
      mealToggleTrackBg:activeBatch?.meal_active?accent:'#39435a',
      mealToggleKnobX:activeBatch?.meal_active?'25px':'3px',
      batchLoading:s.batchLoading,
      exportCsv:self.exportCsv, exportPrint:self.exportPrint,
      // Feature: broadcast notice
      broadcastOpen:s.broadcastOpen, broadcastText:s.broadcastText||'', broadcastSaving:s.broadcastSaving,
      broadcastSavingOpacity:s.broadcastSaving?0.6:1,
      broadcastBtnLabel:s.broadcastSaving?'Saving...':'Post notice',
      openBroadcast:self.openBroadcast, closeBroadcast:self.closeBroadcast,
      onBroadcastText:self.onBroadcastText, saveBroadcast:self.saveBroadcast,
      activeBatchNotice:activeBatch?.notice_text||'', hasActiveBatchNotice:!!(activeBatch?.notice_text),
      broadcastSubColor:activeBatch?.notice_text?'#2f5fd0':'#8a94a3',
      broadcastSubText:activeBatch?.notice_text||'No active notice',
      // Feature: bulk add
      bulkAddOpen:s.bulkAddOpen, bulkAddText:s.bulkAddText||'',
      bulkAddIsInput:s.bulkAddStep==='input', bulkAddIsPreview:s.bulkAddStep==='preview',
      bulkAddAdding:s.bulkAddAdding,
      bulkAddAddingOpacity:s.bulkAddAdding?0.6:1,
      ...(()=>{
        const _parsed=(s.bulkAddParsed||[]).map(r=>({...r,validColor:r.valid?'#1f8a5b':'#c0392b',validLabel:r.valid?'OK':'Skip',shiftDisplay:'OFFICE'}));
        const _vc=_parsed.filter(r=>r.valid).length;
        return {
          bulkAddParsed:_parsed,
          bulkAddValidCount:_vc,
          bulkAddTotal:_parsed.length,
          bulkAddHasValid:_vc>0,
          bulkAddBtnLabel:s.bulkAddAdding?'Adding...':('Add '+_vc+' personnel'),
        };
      })(),
      openBulkAdd:self.openBulkAdd, closeBulkAdd:self.closeBulkAdd,
      onBulkAddText:self.onBulkAddText, parseBulkAdd:self.parseBulkAdd, confirmBulkAdd:self.confirmBulkAdd,
      bulkAddPassword:s.bulkAddPassword||'', onBulkAddPassword:self.onBulkAddPassword,
      bulkAddPwType:s.showBulkAddPw?'text':'password', showBulkAddPw:!!s.showBulkAddPw, hideBulkAddPw:!s.showBulkAddPw, toggleBulkAddPw:self.toggleBulkAddPw,
      // Feature: bulk no-report days
      noReportBulkOpen:s.noReportBulkOpen, noReportBulkText:s.noReportBulkText||'',
      openNoReportBulk:self.openNoReportBulk, closeNoReportBulk:self.closeNoReportBulk,
      onNoReportBulkText:self.onNoReportBulkText, applyNoReportBulk:self.applyNoReportBulk,
      batchJumpDate:s.batchJumpDate, onBatchJumpDate:self.onBatchJumpDate, jumpToDate:self.jumpToDate,
    };
  },

};
