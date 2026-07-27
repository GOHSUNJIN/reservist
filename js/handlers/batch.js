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
    const start=new Date(newBatchDate+'T00:00:00');
    const {start:s,end:e,dekit:dk}=Utils.batchDatesFrom(start);
    const startStr=Utils.dateKey(s),endStr=Utils.dateKey(e),dekitStr=Utils.dateKey(dk);
    const sameYear=batches.filter(b=>b.start_date.slice(0,4)===startStr.slice(0,4));
    const maxNum=sameYear.reduce((m,b)=>Math.max(m,parseInt((b.label||'').match(/^Cycle (\d+)\//)?.[1]||0)),0);
    const label=Utils.batchLabel(startStr,endStr,maxNum+1);
    if(!demo){
      const {data,error}=await DB.batches.create(label,startStr,endStr,dekitStr);
      if(error||!data){ this._toast('Failed to create batch.','error'); this.setState({batchCreating:false}); return; }
      const newBatches=await DB.batches.list().catch(()=>[...batches,data]);
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

  exportCsv: async function() {
    const {batches,activeBatchIdx,batchMembersCache,personnel,attendance,noReportDays,demo}=this.state;
    const batch=batches[activeBatchIdx||0]; if(!batch) return;
    const members=batch.is_live?personnel:(batchMembersCache[batch.id]||[]);
    const start=new Date(batch.start_date+'T00:00:00'), end=new Date(batch.end_date+'T00:00:00');
    const dates=[];
    for(let d=new Date(start);d<=end;d=Utils.addDays(d,1)){
      if(Utils.isReportDay(d)&&!Utils.holidayName(d)&&!noReportDays.has(Utils.dateKey(d))) dates.push(new Date(d));
    }
    let attCache=this.state.attendanceCache;
    if(!demo){
      const allAtt=await DB.attendance.getForBatch(batch.start_date,batch.end_date).catch(()=>({}));
      attCache={...attCache,...allAtt};
    }
    const todayKey=Utils.dateKey(this.baseDate());
    const fmtDate=d=>{const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return d.getDate()+' '+mo[d.getMonth()];};
    const shiftLabel=s=>s==='AM'?'AM (0830-1530)':s==='PM'?'PM (1530-2230)':s==='OFFICE'?'Office (0900-1800)':s||'-';
    const metaRows=[
      ['"Cycle"','"'+batch.label+'"'],
      ['"Period"','"'+fmtDate(start)+' – '+fmtDate(end)+'"'],
      ['"Exported"','"'+fmtDate(new Date())+'"'],
      [],
    ];
    const header=['"Name"','"Contact"','"Shift"',...dates.map(d=>'"'+fmtDate(d)+'"'),'"Present"','"MC"','"Absent"','"Attendance %"'];
    const rows=members.map(p=>{
      const dayEntries=dates.map(d=>{const dk=Utils.dateKey(d);const map=dk===todayKey?attendance:(attCache[dk]||{});return map[p.id]||null;});
      const statuses=dayEntries.map(e=>e?.status||'absent');
      const pres=statuses.filter(s=>s==='present').length;
      const mc=statuses.filter(s=>s==='mc').length;
      const abs=statuses.filter(s=>s==='absent').length;
      const pct=dates.length>0?Math.round(pres/dates.length*100)+'%':'-';
      const cells=dayEntries.map(e=>{const code=e?.status==='present'?'P':e?.status==='mc'?'MC':e?.status==='absent'?'A':'-';return(code==='P'&&e?.editLog?.length>0)?'P*':code;});
      return ['"'+p.name.replace(/"/g,'""')+'"','"'+p.contact+'"','"'+shiftLabel(p.shift)+'"',...cells,pres,mc,abs,'"'+pct+'"'].join(',');
    });
    const totPres=rows.reduce((a,r,i)=>{const p=members[i];const st=dates.map(d=>{const dk=Utils.dateKey(d);const map=dk===todayKey?attendance:(attCache[dk]||{});return (map[p.id]?.status)||'absent';});return a+st.filter(s=>s==='present').length;},0);
    const totMc=rows.reduce((a,r,i)=>{const p=members[i];const st=dates.map(d=>{const dk=Utils.dateKey(d);const map=dk===todayKey?attendance:(attCache[dk]||{});return (map[p.id]?.status)||'absent';});return a+st.filter(s=>s==='mc').length;},0);
    const totAbs=rows.reduce((a,r,i)=>{const p=members[i];const st=dates.map(d=>{const dk=Utils.dateKey(d);const map=dk===todayKey?attendance:(attCache[dk]||{});return (map[p.id]?.status)||'absent';});return a+st.filter(s=>s==='absent').length;},0);
    const totDays=members.length*dates.length;
    const totPct=totDays>0?Math.round(totPres/totDays*100)+'%':'-';
    const summaryRow=['"TOTAL"','""','""',...dates.map(()=>'""'),totPres,totMc,totAbs,'"'+totPct+'"'].join(',');
    const legend=['"Legend: P = Present, P* = Present (admin-corrected times), MC = Medical Certificate, A = Absent"'];
    const csv='﻿'+[...metaRows.map(r=>r.join(',')),header.join(','),...rows,'',summaryRow,'',legend].join('\n');
    const a=document.createElement('a');
    a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    a.download=(batch.label.replace(/[\s/]+/g,'_')||'batch')+'_attendance.csv';
    a.click();
  },

  exportPrint: async function() {
    const {batches,activeBatchIdx,batchMembersCache,personnel,attendance,noReportDays,demo}=this.state;
    const batch=batches[activeBatchIdx||0]; if(!batch) return;
    const members=batch.is_live?personnel:(batchMembersCache[batch.id]||[]);
    const start=new Date(batch.start_date+'T00:00:00'), end=new Date(batch.end_date+'T00:00:00');
    const dates=[];
    for(let d=new Date(start);d<=end;d=Utils.addDays(d,1)){
      if(Utils.isReportDay(d)&&!Utils.holidayName(d)&&!noReportDays.has(Utils.dateKey(d))) dates.push(new Date(d));
    }
    let attCache=this.state.attendanceCache;
    if(!demo){
      const allAtt=await DB.attendance.getForBatch(batch.start_date,batch.end_date).catch(()=>({}));
      attCache={...attCache,...allAtt};
    }
    const todayKey=Utils.dateKey(this.baseDate());
    const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtDate=d=>d.getDate()+' '+MO[d.getMonth()];
    const fmtDay=d=>{const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];return days[d.getDay()];};
    const orgName=this.props.orgName||'Ops Security';
    const accent=this.props.accent||'#2f5fd0';

    const rowData=members.map(p=>{
      const entries=dates.map(d=>{const dk=Utils.dateKey(d);const map=dk===todayKey?attendance:(attCache[dk]||{});return map[p.id]||null;});
      const statuses=entries.map(e=>e?.status||'absent');
      const pres=statuses.filter(s=>s==='present').length;
      const mc=statuses.filter(s=>s==='mc').length;
      const abs=statuses.filter(s=>s==='absent').length+statuses.filter(s=>s==='missed').length;
      const pct=dates.length>0?Math.round(pres/dates.length*100):0;
      const cells=entries.map(e=>{
        if(!e||!e.status||e.status==='absent'||e.status==='missed') return {code:'A',cls:'A'};
        if(e.status==='mc') return {code:'MC',cls:'MC'};
        return {code: e.editLog?.length>0?'P*':'P', cls: e.editLog?.length>0?'Ps':'P'};
      });
      return {name:p.name, shift:p.shift||'-', cells, pres, mc, abs, pct};
    });

    const totPres=rowData.reduce((a,r)=>a+r.pres,0);
    const totMc=rowData.reduce((a,r)=>a+r.mc,0);
    const totAbs=rowData.reduce((a,r)=>a+r.abs,0);
    const totDays=members.length*dates.length;
    const totPct=totDays>0?Math.round(totPres/totDays*100):0;
    const exportedOn=fmtDate(new Date())+' '+new Date().getFullYear();

    const headCols=dates.map(d=>`<th>${fmtDay(d)}<br><span style="font-weight:400;font-size:9px;">${fmtDate(d)}</span></th>`).join('');
    const bodyRows=rowData.map(r=>{
      const dayCells=r.cells.map(c=>`<td class="${c.cls}">${c.code}</td>`).join('');
      const pctColor=r.pct>=80?'#2e7d32':r.pct>=60?'#e65100':'#c62828';
      return `<tr>
        <td class="name">${r.name}</td>
        <td class="shift">${r.shift}</td>
        ${dayCells}
        <td class="tot">${r.pres}</td>
        <td class="tot mc">${r.mc}</td>
        <td class="tot ab">${r.abs}</td>
        <td class="tot" style="color:${pctColor};font-weight:700;">${r.pct}%</td>
      </tr>`;
    }).join('');

    const html=`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${batch.label} — Attendance Report</title>
<style>
  @page{size:A4 landscape;margin:12mm 10mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:10.5px;color:#1a1a1a;margin:0;padding:0;}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid ${accent};}
  .hdr-left h1{font-size:17px;margin:0 0 3px;color:${accent};}
  .hdr-left p{margin:0;font-size:11px;color:#555;}
  .hdr-right{text-align:right;font-size:10px;color:#777;}
  .stats{display:flex;gap:10px;margin-bottom:14px;}
  .stat{flex:1;border:1px solid #e0e0e0;border-radius:5px;padding:7px 10px;}
  .stat-val{font-size:18px;font-weight:700;}
  .stat-label{font-size:9px;color:#777;text-transform:uppercase;letter-spacing:.04em;}
  .stat.green .stat-val{color:#2e7d32;}
  .stat.amber .stat-val{color:#e65100;}
  .stat.red .stat-val{color:#c62828;}
  .stat.blue .stat-val{color:#1565c0;}
  table{border-collapse:collapse;width:100%;}
  th,td{border:1px solid #d0d0d0;padding:3px 5px;text-align:center;white-space:nowrap;}
  th{background:#f0f2f5;font-size:9.5px;font-weight:700;}
  td.name{text-align:left;font-weight:600;min-width:110px;}
  td.shift{text-align:left;color:#555;min-width:35px;}
  td.tot{font-weight:700;}
  td.mc{color:#e65100;}
  td.ab{color:#c62828;}
  .P{background:#e8f5e9;color:#2e7d32;font-weight:700;}
  .Ps{background:#c8e6c9;color:#1b5e20;font-weight:700;}
  .MC{background:#fff8e1;color:#e65100;font-weight:700;}
  .A{background:#fce4ec;color:#c62828;}
  .total-row td{background:#f0f2f5;font-weight:700;border-top:2px solid #bbb;}
  .legend{margin-top:10px;font-size:9px;color:#777;}
  .no-print{margin-bottom:10px;}
  @media print{.no-print{display:none;}}
</style>
</head><body>
<div class="no-print">
  <button onclick="window.print()" style="padding:7px 16px;background:${accent};color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
</div>
<div class="hdr">
  <div class="hdr-left">
    <h1>${batch.label} — Attendance Report</h1>
    <p>${orgName} &nbsp;·&nbsp; ${fmtDate(start)} – ${fmtDate(end)} ${end.getFullYear()} &nbsp;·&nbsp; ${dates.length} reporting day${dates.length!==1?'s':''} &nbsp;·&nbsp; ${members.length} personnel</p>
  </div>
  <div class="hdr-right">Generated ${exportedOn}</div>
</div>
<div class="stats">
  <div class="stat green"><div class="stat-val">${totPres}</div><div class="stat-label">Attendances</div></div>
  <div class="stat blue"><div class="stat-val">${totMc}</div><div class="stat-label">MC / Leave</div></div>
  <div class="stat red"><div class="stat-val">${totAbs}</div><div class="stat-label">Absences</div></div>
  <div class="stat ${totPct>=80?'green':totPct>=60?'amber':'red'}"><div class="stat-val">${totPct}%</div><div class="stat-label">Overall Attendance</div></div>
</div>
<table>
  <thead><tr>
    <th style="text-align:left;">Name</th>
    <th style="text-align:left;">Shift</th>
    ${headCols}
    <th>P</th><th>MC</th><th>A</th><th>Rate</th>
  </tr></thead>
  <tbody>
    ${bodyRows}
    <tr class="total-row">
      <td class="name" colspan="2">TOTAL</td>
      ${dates.map(()=>'<td></td>').join('')}
      <td>${totPres}</td><td class="mc">${totMc}</td><td class="ab">${totAbs}</td>
      <td style="color:${totPct>=80?'#2e7d32':totPct>=60?'#e65100':'#c62828'};font-weight:700;">${totPct}%</td>
    </tr>
  </tbody>
</table>
<div class="legend">P = Present &nbsp;|&nbsp; P* = Present (admin-corrected) &nbsp;|&nbsp; MC = Medical / Leave &nbsp;|&nbsp; A = Absent / Missed</div>
</body></html>`;

    const w=window.open('','_blank'); if(!w) return;
    w.document.write(html);
    w.document.close();
  },

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
    this._toast(text ? 'Notice posted to all reservists.' : 'Notice cleared.');
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
    let added=0;
    for(const dk of dates){
      if(!this.state.noReportDays.has(dk)){
        await DB.noReportDays.ensure(dk).catch(()=>{});
        added++;
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
    if(!Utils.isReportDay(d)||Utils.holidayName(d)) return;
    const dk=Utils.dateKey(d);
    const isNowOn = this.state.demo ? !this.state.noReportDays.has(dk) : await DB.noReportDays.toggle(dk);
    const batchId=this.state.batches[this.state.activeBatchIdx||0]?.id;
    this.setState(s=>{
      const nd=new Set(s.noReportDays); isNowOn?nd.add(dk):nd.delete(dk);
      const noReportDaysCache=batchId?{...s.noReportDaysCache,[batchId]:nd}:s.noReportDaysCache;
      return {noReportDays:nd,noReportDaysCache};
    });
    this._toast('No reporting '+(isNowOn?'enabled':'disabled')+' for '+Utils.fmtShort(d)+'.');
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
        batches=await this._ensureLiveBatch(batches, batchJumpDate);
        batches=await this._ensureForwardBatches(batches);
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
