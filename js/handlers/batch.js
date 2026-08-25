// ── Batch management handlers ─────────────────────────────────────────────
const BatchHandlers = {

  setBatch: function(i) {
    return async () => {
      const b=this.state.batches[i]; if(!b) return;
      this.setState({batchLoading:true});
      const start=new Date(b.start_date+'T00:00:00'), today=this.baseDate();
      const off=Math.round((start-today)/86400000);
      let members=this.state.batchMembersCache[b.id];
      if(!members && !b.is_live){
        members = await DB.personnel.list(b.id, false).catch(()=>[]);
        this.setState(s=>({batchMembersCache:{...s.batchMembersCache,[b.id]:members}}));
      }
      const cachedNrd=this.state.noReportDaysCache[b.id];
      const [noReportDays, batchAttMap] = await Promise.all([
        cachedNrd?Promise.resolve(cachedNrd):DB.noReportDays.list(b.start_date, b.dekit_date||b.end_date).catch(()=>new Set()),
        b.is_live ? Promise.resolve({}) : DB.attendance.getForBatch(b.start_date, b.end_date).catch(()=>({})),
      ]);
      this.setState(s=>({
        activeBatchIdx:i, viewOffset:off, selectedCalOffset:null, batchJumpDate:b.is_live?Utils.dateKey(today):b.start_date,
        attendanceCache: b.is_live ? {} : {...s.attendanceCache, ...batchAttMap},
        noReportDays,
        noReportDaysCache: cachedNrd?s.noReportDaysCache:{...s.noReportDaysCache,[b.id]:noReportDays},
        batchLoading:false, rosterSearch:'', logSearch:'', confirmMarkAllAbsent:false, peopleStatsLoaded:false,
      }));
      this.loadPeopleStats();
    };
  },

  createBatch: async function() {
    const {newBatchDate,batches,demo,batchCreating}=this.state;
    if(!newBatchDate||batchCreating) return;
    this.setState({batchCreating:true});
    const dept=this._myDept();
    const start=new Date(newBatchDate+'T00:00:00');
    const {start:s,end:e,dekit:dk}=Utils.batchDatesFrom(start);
    const startStr=Utils.dateKey(s),endStr=Utils.dateKey(e),dekitStr=Utils.dateKey(dk);
    const allBatches=await DB.batches.list().catch(()=>batches);
    const sameYear=allBatches.filter(b=>b.start_date.slice(0,4)===startStr.slice(0,4));
    const maxNum=sameYear.reduce((m,b)=>Math.max(m,parseInt((b.label||'').match(/^Cycle (\d+)\//)?.[1]||0, 10)),0);
    const sameDateBatch=allBatches.find(b=>b.start_date===startStr&&b.department!==dept);
    const cycleNum=sameDateBatch?(parseInt((sameDateBatch.label||'').match(/^Cycle (\d+)\//)?.[1]||0,10)||maxNum+1):maxNum+1;
    const label=Utils.batchLabel(startStr,endStr,cycleNum);
    if(!demo){
      const {data,error}=await DB.batches.create(label,startStr,endStr,dekitStr,dept);
      if(error||!data){ this._toast('Failed to create batch.','error'); this.setState({batchCreating:false}); return; }
      const newBatches=await DB.batches.list(dept).catch(()=>[...batches,data]);
      const liveIdx=newBatches.findIndex(b=>b.is_live);
      this.setState({batches:newBatches,activeBatchIdx:liveIdx>=0?liveIdx:0,newBatchDate:'',batchCreating:false,tab:'people'});
    } else {
      const nb={id:'demo-b-'+Date.now(),label,start_date:startStr,end_date:endStr,dekit_date:dekitStr,is_live:true};
      this.setState(prev=>({batches:[...prev.batches,nb],newBatchDate:'',batchCreating:false}));
    }
    this._toast('Batch '+label+' created.');
  },

  deleteBatch: async function() {
    const {batches, activeBatchIdx, demo} = this.state;
    const batch = batches[activeBatchIdx||0]; if(!batch) return;
    if(!demo) await DB.batches.remove(batch.id).catch(()=>{});
    const newBatches = batches.filter(b=>b.id!==batch.id);
    this.setState({batches:newBatches, activeBatchIdx:0});
    this._toast('Batch removed.');
  },

  startEditBatchLabel: function() {
    const activeBatch=this.state.batches[this.state.activeBatchIdx||0];
    this.setState({editingBatchLabel:true, batchLabelText:activeBatch?.label||''});
  },
  onBatchLabelText: function(e) { this.setState({batchLabelText:e.target.value}); },

  saveBatchLabel: async function() {
    const {batches, batchLabelText, demo, activeBatchIdx} = this.state;
    const activeBatch = batches[activeBatchIdx||0];
    if(!activeBatch||!batchLabelText.trim()) return;
    if(!demo) await DB.batches.updateLabel(activeBatch.id, batchLabelText.trim()).catch(()=>{});
    const newBatches = batches.map(b=>b.id===activeBatch.id?{...b,label:batchLabelText.trim()}:b);
    this.setState({batches:newBatches, editingBatchLabel:false});
    this._toast('Batch label updated.');
  },

  cancelBatchLabel: function() { this.setState({editingBatchLabel:false}); },

  openBroadcast: function() {
    const batch = this.state.batches[this.state.activeBatchIdx||0];
    this.setState({broadcastOpen:true, broadcastText:batch?.notice_text||''});
  },
  closeBroadcast: function() { this.setState({broadcastOpen:false, broadcastText:''}); },
  onBroadcastText: function(e) { this.setState({broadcastText:e.target.value}); },
  saveBroadcast: async function() {
    const {batches, activeBatchIdx, broadcastText, demo} = this.state;
    const batch = batches[activeBatchIdx||0]; if(!batch) return;
    if(demo) { this._toast('Cannot post notices in demo mode.', 'error'); return; }
    this.setState({broadcastSaving:true});
    const text = broadcastText.trim();
    const {error} = await DB.batches.updateNotice(batch.id, text);
    this.setState({broadcastSaving:false});
    if(error) { this._toast('Failed to save notice.', 'error'); return; }
    this.setState(s=>({batches:s.batches.map(b=>b.id===batch.id?{...b,notice_text:text||null}:b), broadcastOpen:false}));
    this._toast(text ? `Notice posted to ${Utils.deptLabel(this._myDept())} reservists.` : 'Notice cleared.');
  },

  openNoReportBulk: function() { this.setState({noReportBulkOpen:true, noReportBulkText:''}); },
  closeNoReportBulk: function() { this.setState({noReportBulkOpen:false, noReportBulkText:''}); },
  onNoReportBulkText: function(e) { this.setState({noReportBulkText:e.target.value}); },
  applyNoReportBulk: async function() {
    const {noReportBulkText, batches, activeBatchIdx, demo} = this.state;
    const batch = batches[activeBatchIdx||0]; if(!batch) return;
    if(demo) { this._toast('Cannot set no-report days in demo mode.', 'error'); return; }
    const raw = noReportBulkText.replace(/\n/g,',').split(',').map(s=>s.trim()).filter(Boolean);
    const batchEnd = batch.dekit_date||batch.end_date;
    const dates = [];
    for(const s of raw){
      let dk = null;
      if(/^\d{4}-\d{2}-\d{2}$/.test(s)) dk = s;
      else if(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)){
        const parts = s.split(/[\/\-]/);
        dk = parts[2]+'-'+parts[1].padStart(2,'0')+'-'+parts[0].padStart(2,'0');
      }
      if(dk && dk>=batch.start_date && dk<=batchEnd) dates.push(dk);
    }
    if(!dates.length){ this._toast('No valid dates found. Use dd/mm/yyyy format.', 'error'); return; }
    const _existingNrd = this.state.noReportDays;
    let added=0;
    for(const dk of dates){
      if(!_existingNrd.has(dk)){
        const {error:nrErr} = await DB.noReportDays.ensure(dk).catch(()=>({error:true}));
        if(!nrErr) added++;
      }
    }
    const nrd = await DB.noReportDays.list(batch.start_date, batchEnd).catch(()=>this.state.noReportDays);
    this.setState({noReportDays:nrd, noReportBulkOpen:false, noReportBulkText:''});
    this._toast(added+' no-report day'+(added!==1?'s':'')+' added.');
  },

  onNewBatchDate: function(e) { this.setState({newBatchDate:e.target.value}); },

  toggleMealActive: async function() {
    const {batches,activeBatchIdx,demo}=this.state;
    const idx=activeBatchIdx||0;
    const activeBatch=batches[idx]; if(!activeBatch) return;
    const next=!activeBatch.meal_active;
    if(!demo) await DB.batches.setMealActive(activeBatch.id, next);
    this.setState(s=>({batches:s.batches.map((b,i)=>i===idx?{...b,meal_active:next}:b)}));
    this._toast('Meal allowance forms '+(next?'activated':'paused')+'.');
  },

  isNoReport: function(off) {
    const d=this.dateForOffset(off);
    if(!Utils.isReportDay(d)) return false;
    return this.state.noReportDays.has(Utils.dateKey(d)) || !!Utils.holidayName(d);
  },

  toggleNoReporting: async function() {
    const off=this.state.viewOffset, d=this.dateForOffset(off);
    if(off < 0) return;
    if(!Utils.isReportDay(d)||Utils.holidayName(d)) return;
    const dk=Utils.dateKey(d);
    let isNowOn;
    if(this.state.demo){
      isNowOn = !this.state.noReportDays.has(dk);
    } else {
      const {error:_nrErr, isOn} = await DB.noReportDays.toggle(dk);
      if(_nrErr){ this._toast('Failed to update. Try again.','error'); return; }
      isNowOn = isOn;
    }
    const batchId=this.state.batches[this.state.activeBatchIdx||0]?.id;
    this.setState(s=>{
      const nd=new Set(s.noReportDays); isNowOn?nd.add(dk):nd.delete(dk);
      const noReportDaysCache=batchId?{...s.noReportDaysCache,[batchId]:nd}:s.noReportDaysCache;
      return {noReportDays:nd,noReportDaysCache};
    });
    const _existingAtt = !isNowOn && Object.keys(this.state.attendanceCache[dk]||{}).length > 0;
    this._toast('No reporting '+(isNowOn?'enabled':'disabled')+' for '+Utils.fmtShort(d)+'.'+(_existingAtt?' Existing attendance records for this date are kept in the database.':''));
  },

  onBatchJumpDate: function(e) { this.setState({batchJumpDate:e.target.value}); },

  jumpToDate: async function() {
    const {batchJumpDate, demo}=this.state;
    if(!batchJumpDate) return;
    this.setState({batchLoading:true, batchJumpDate:''});
    let batches=this.state.batches;
    if(!demo){
      const sorted=[...batches].sort((a,b)=>a.start_date>b.start_date?1:-1);
      const lastBatch=sorted[sorted.length-1];
      const lastEnd=lastBatch?.dekit_date||lastBatch?.end_date||'';
      if(batchJumpDate>lastEnd){
        batches=await this._ensureLiveBatch(batches, batchJumpDate, this._myDept());
        batches=await this._ensureForwardBatches(batches, 8, this._myDept());
        this.setState({batches});
      }
    }
    let idx=batches.findIndex(b=>batchJumpDate>=b.start_date&&batchJumpDate<=b.end_date);
    if(idx===-1) idx=batches.findIndex(b=>batchJumpDate>=b.start_date&&batchJumpDate<=(b.dekit_date||b.end_date));
    if(idx===-1){
      let bestDiff=Infinity;
      batches.forEach((b,i)=>{
        const diff=Math.abs(new Date(b.start_date)-new Date(batchJumpDate+'T00:00:00'));
        if(diff<bestDiff){bestDiff=diff;idx=i;}
      });
    }
    if(idx===-1){this.setState({batchLoading:false});return;}
    await this.setBatch(idx)();
    const targetOff=Math.round((new Date(batchJumpDate+'T00:00:00')-this.baseDate())/86400000);
    this.setState({viewOffset:targetOff, batchJumpDate});
  },

  dateForOffset: function(off) { return Utils.addDays(this.baseDate(), off); },

  baseDate: function() { const d=new Date(); d.setHours(0,0,0,0); return d; },

  openCyclePicker:    function() { this.setState({cyclePickerOpen:true, cyclePickerYear:null, cyclePickerPage:1}); },
  closeCyclePicker:   function() { this.setState({cyclePickerOpen:false, cyclePickerYear:null, cyclePickerPage:1}); },
  setCyclePickerYear: function(yr) { this.setState(s=>({cyclePickerYear:s.cyclePickerYear===yr?null:yr, cyclePickerPage:1})); },
  cyclePickerNext: function() { this.setState(s=>({cyclePickerPage:s.cyclePickerPage+1})); },
  cyclePickerPrev: function() { this.setState(s=>({cyclePickerPage:Math.max(1,s.cyclePickerPage-1)})); },

};
