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
    const maxNum=sameYear.reduce((m,b)=>Math.max(m,parseInt((b.label||'').match(/^Cycle (\d+)\//)?.[1]||0, 10)),0);
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

  _getExportData: async function() {
    const {batches,activeBatchIdx,noReportDays,demo}=this.state;
    const batch=batches[activeBatchIdx||0]; if(!batch) return null;
    const members=this._batchReservists(batch).filter(p=>p.batch_id===batch.id);
    if(!members.length) return null;
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
    return {batch, members, start, end, dates, attCache, todayKey:Utils.dateKey(this.baseDate())};
  },

  _buildExportMembers: function(members, dates, attCache, todayKey) {
    const {attendance}=this.state;
    return members.map(p=>{
      const entries=dates.map(d=>{const dk=Utils.dateKey(d);const map=dk===todayKey?attendance:(attCache[dk]||{});return map[p.id]||null;});
      const pres=entries.filter(e=>e?.status==='present').length;
      const mc=entries.filter(e=>e?.status==='mc').length;
      const abs=entries.filter(e=>e?.status==='absent'||e?.status==='missed').length;
      const pct=dates.length>0?Math.round(pres/dates.length*100):null;
      return {name:p.name, shift:p.shift||'-', entries, pres, mc, abs, pct};
    });
  },

  exportCsv: async function() {
    const exportData=await this._getExportData();
    if(!exportData){ this._toast('No reservists found in this cycle.','error'); return; }
    const {batch,members,start,end,dates,attCache,todayKey}=exportData;
    const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const fmtDate=d=>d.getDate()+' '+MO[d.getMonth()];
    const fmtDay=d=>DAYS[d.getDay()];
    const ac=this.props.accent||'#2f5fd0';

    const rowData=this._buildExportMembers(members,dates,attCache,todayKey).map(r=>({
      ...r,
      cells:r.entries.map(e=>{
        if(!e?.status||e.status==='absent'||e.status==='missed') return {code:e?.status?'A':'-',sid:'sD'};
        if(e.status==='mc') return {code:'MC',sid:'sMC'};
        return {code:e.editLog?.length>0?'P*':'P',sid:e.editLog?.length>0?'sPs':'sP'};
      }),
    }));

    const totPres=rowData.reduce((a,r)=>a+r.pres,0);
    const totMc=rowData.reduce((a,r)=>a+r.mc,0);
    const totAbs=rowData.reduce((a,r)=>a+r.abs,0);
    const totDays=members.length*dates.length;
    const totPct=totDays>0?Math.round(totPres/totDays*100):null;

    // SpreadsheetML helpers
    const xe=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const sc=(sid,val)=>`<Cell ss:StyleID="${sid}"><Data ss:Type="String">${xe(String(val))}</Data></Cell>`;
    const ec=sid=>`<Cell ss:StyleID="${sid}"/>`;
    const rateSidE=n=>n==null?'sDashE':n>=80?'sRateGE':n>=60?'sRateAE':'sRateRE';
    const rateSidO=n=>n==null?'sDashO':n>=80?'sRateGO':n>=60?'sRateAO':'sRateRO';
    const rateSidT=n=>n==null?'sTot':n>=80?'sTotG':n>=60?'sTotA':'sTotR';

    const now=new Date();
    const exportedStr=`${fmtDay(now)} ${fmtDate(now)} ${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    const span=2+dates.length+4;

    const colDefs=`<Column ss:Width="180"/><Column ss:Width="55"/>${dates.map(()=>'<Column ss:Width="88"/>').join('')}<Column ss:Width="62"/><Column ss:Width="45"/><Column ss:Width="62"/><Column ss:Width="58"/>`;

    const metaRows=`<Row>${sc('sMetaLbl','Cycle')}<Cell ss:StyleID="sMeta" ss:MergeAcross="${span-2}"><Data ss:Type="String">${xe(batch.label)}</Data></Cell></Row><Row>${sc('sMetaLbl','Period')}<Cell ss:StyleID="sMeta" ss:MergeAcross="${span-2}"><Data ss:Type="String">${xe(fmtDate(start)+' to '+fmtDate(end)+' '+end.getFullYear())}</Data></Cell></Row><Row>${sc('sMetaLbl','Exported')}<Cell ss:StyleID="sMeta" ss:MergeAcross="${span-2}"><Data ss:Type="String">${xe(exportedStr)}</Data></Cell></Row><Row ss:Height="8"/>`;

    const headerRow=`<Row ss:Height="20">${sc('sHdrL','Name')}${sc('sHdrC','Shift')}${dates.map(d=>sc('sHdrC',fmtDay(d)+' '+fmtDate(d))).join('')}${sc('sHdrC','Present')}${sc('sHdrC','MC')}${sc('sHdrC','Absent')}${sc('sHdrC','Rate')}</Row>`;

    const dataRows=rowData.map((r,i)=>{
      const even=i%2===0;
      const dashSid=even?'sDashE':'sDashO';
      const cellXml=r.cells.map(c=>sc(c.sid==='sD'?dashSid:c.sid,c.code)).join('');
      return `<Row>${sc(even?'sNameE':'sNameO',r.name)}${sc(even?'sShiftE':'sShiftO',r.shift)}${cellXml}${sc(even?'sNumGE':'sNumGO',r.pres)}${sc(even?'sNumAE':'sNumAO',r.mc)}${sc(even?'sNumRE':'sNumRO',r.abs)}${sc((even?rateSidE:rateSidO)(r.pct),r.pct!=null?r.pct+'%':'-')}</Row>`;
    }).join('');

    const totalRow=`<Row><Cell ss:StyleID="sTotL" ss:MergeAcross="1"><Data ss:Type="String">TOTAL</Data></Cell>${dates.map(()=>ec('sTot')).join('')}${sc('sTotG',totPres)}${sc('sTotA',totMc)}${sc('sTotR',totAbs)}${sc(rateSidT(totPct),totPct!=null?totPct+'%':'-')}</Row>`;

    const legendRow=`<Row ss:Height="8"/><Row><Cell ss:StyleID="sLegend" ss:MergeAcross="${span-1}"><Data ss:Type="String">P = Present  |  P* = Present (admin-corrected)  |  MC = Medical / Leave  |  A = Absent</Data></Cell></Row>`;

    // SpreadsheetML styles
    const b1=pos=>`<Border ss:Position="${pos}" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D8E4"/>`;
    const allB=`<Borders>${b1('Bottom')}${b1('Left')}${b1('Right')}${b1('Top')}</Borders>`;
    const totB=`<Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#B0B8CC"/>${b1('Bottom')}${b1('Left')}${b1('Right')}</Borders>`;
    const mk=(id,hal,bold,fc,bg,bdr)=>`<Style ss:ID="${id}"><Alignment ss:Horizontal="${hal}"/><Font ss:FontName="Arial" ss:Size="10"${bold?' ss:Bold="1"':''}${fc?` ss:Color="${fc}"`:''}/>${bg?`<Interior ss:Color="${bg}" ss:Pattern="Solid"/>`:''}${bdr}</Style>`;

    const styles=`<Styles>
      <Style ss:ID="Default"><Font ss:FontName="Arial" ss:Size="10"/></Style>
      ${mk('sMetaLbl','Left',true,'#777777','','')}
      ${mk('sMeta','Left',false,'','','')}
      ${mk('sHdrL','Left',true,'#FFFFFF',ac,allB)}
      ${mk('sHdrC','Center',true,'#FFFFFF',ac,allB)}
      ${mk('sNameE','Left',true,'#1A2233','#FFFFFF',allB)}
      ${mk('sNameO','Left',true,'#1A2233','#F5F7FB',allB)}
      ${mk('sShiftE','Center',false,'#5C6678','#FFFFFF',allB)}
      ${mk('sShiftO','Center',false,'#5C6678','#F5F7FB',allB)}
      ${mk('sP','Center',true,'#155724','#D4EDDA',allB)}
      ${mk('sPs','Center',true,'#0D3D1A','#B8DAC4',allB)}
      ${mk('sMC','Center',true,'#856404','#FFF3CD',allB)}
      ${mk('sA','Center',true,'#721C24','#F8D7DA',allB)}
      ${mk('sDashE','Center',false,'#B0B8C4','#FFFFFF',allB)}
      ${mk('sDashO','Center',false,'#B0B8C4','#F5F7FB',allB)}
      ${mk('sNumGE','Center',true,'#155724','#FFFFFF',allB)}
      ${mk('sNumGO','Center',true,'#155724','#F5F7FB',allB)}
      ${mk('sNumAE','Center',true,'#856404','#FFFFFF',allB)}
      ${mk('sNumAO','Center',true,'#856404','#F5F7FB',allB)}
      ${mk('sNumRE','Center',true,'#721C24','#FFFFFF',allB)}
      ${mk('sNumRO','Center',true,'#721C24','#F5F7FB',allB)}
      ${mk('sRateGE','Center',true,'#155724','#FFFFFF',allB)}
      ${mk('sRateGO','Center',true,'#155724','#F5F7FB',allB)}
      ${mk('sRateAE','Center',true,'#856404','#FFFFFF',allB)}
      ${mk('sRateAO','Center',true,'#856404','#F5F7FB',allB)}
      ${mk('sRateRE','Center',true,'#721C24','#FFFFFF',allB)}
      ${mk('sRateRO','Center',true,'#721C24','#F5F7FB',allB)}
      ${mk('sTot','Center',true,'','#EDF0F5',totB)}
      ${mk('sTotL','Left',true,'','#EDF0F5',totB)}
      ${mk('sTotG','Center',true,'#155724','#EDF0F5',totB)}
      ${mk('sTotA','Center',true,'#856404','#EDF0F5',totB)}
      ${mk('sTotR','Center',true,'#721C24','#EDF0F5',totB)}
      ${mk('sLegend','Left',false,'#9AA3B2','','')}
    </Styles>`;

    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:o="urn:schemas-microsoft-com:office:office">\n${styles}\n<Worksheet ss:Name="Attendance"><Table ss:DefaultColumnWidth="60">\n${colDefs}\n${metaRows}\n${headerRow}\n${dataRows}\n${totalRow}\n${legendRow}\n</Table></Worksheet>\n</Workbook>`;

    const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=(batch.label.replace(/[\s/]+/g,'_')||'batch')+'_attendance.xls'; a.click();
    URL.revokeObjectURL(url);
  },

  exportPrint: async function() {
    const exportData=await this._getExportData();
    if(!exportData){ this._toast('No reservists found in this cycle.','error'); return; }
    const {batch,members,start,end,dates,attCache,todayKey}=exportData;
    const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const fmtDate=d=>d.getDate()+' '+MO[d.getMonth()];
    const fmtDay=d=>DAYS[d.getDay()];
    const orgName=this.props.orgName||'Ops Security';
    const accent=this.props.accent||'#2f5fd0';

    const rowData=this._buildExportMembers(members,dates,attCache,todayKey).map(r=>({
      ...r,
      pct: r.pct ?? 0,
      cells:r.entries.map(e=>{
        if(!e?.status||e.status==='absent'||e.status==='missed') return {code:'A',cls:'A'};
        if(e.status==='mc') return {code:'MC',cls:'MC'};
        return {code:e.editLog?.length>0?'P*':'P',cls:e.editLog?.length>0?'Ps':'P'};
      }),
    }));

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
        <td class="name">${r.name.replace(/</g,'&lt;')}</td>
        <td class="shift">${r.shift}</td>
        ${dayCells}
        <td class="tot">${r.pres}</td>
        <td class="tot mc">${r.mc}</td>
        <td class="tot ab">${r.abs}</td>
        <td class="tot" style="color:${pctColor};font-weight:700;">${r.pct}%</td>
      </tr>`;
    }).join('');

    const reportInner=`
<div class="rpt-hdr">
  <div>
    <div class="rpt-title">${batch.label}: Attendance Report</div>
    <div class="rpt-sub">${orgName} &nbsp;·&nbsp; ${fmtDate(start)} to ${fmtDate(end)} ${end.getFullYear()} &nbsp;·&nbsp; ${dates.length} reporting day${dates.length!==1?'s':''} &nbsp;·&nbsp; ${members.length} personnel</div>
  </div>
  <div class="rpt-gen">Generated ${exportedOn}</div>
</div>
<div class="stats">
  <div class="stat green"><div class="stat-val">${totPres}</div><div class="stat-label">Attendances</div></div>
  <div class="stat blue"><div class="stat-val">${totMc}</div><div class="stat-label">MC / Leave</div></div>
  <div class="stat red"><div class="stat-val">${totAbs}</div><div class="stat-label">Absences</div></div>
  <div class="stat ${totPct>=80?'green':totPct>=60?'amber':'red'}"><div class="stat-val">${totPct}%</div><div class="stat-label">Overall Rate</div></div>
</div>
<div style="overflow-x:auto;">
<table>
  <thead><tr>
    <th style="text-align:left;position:sticky;left:0;background:#f0f2f5;z-index:1;">Name</th>
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
</div>
<div class="legend">P = Present &nbsp;·&nbsp; P* = Present (admin-corrected) &nbsp;·&nbsp; MC = Medical / Leave &nbsp;·&nbsp; A = Absent / Missed</div>`;

    const printCss=`<style id="print-report-css">
      @media print {
        body>*:not(#rpt-overlay){display:none!important;}
        #rpt-overlay{position:static!important;background:none!important;padding:0!important;display:block!important;}
        .rpt-modal{box-shadow:none!important;border-radius:0!important;max-height:none!important;overflow:visible!important;width:100%!important;}
        .rpt-toolbar{display:none!important;}
        .rpt-body{overflow:visible!important;padding:0!important;}
        @page{size:A4 landscape;margin:12mm 10mm;}
      }
    </style>`;

    document.getElementById('rpt-overlay')?.remove();
    document.getElementById('print-report-css')?.remove();
    document.head.insertAdjacentHTML('beforeend', printCss);

    const overlay=document.createElement('div');
    overlay.id='rpt-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,20,35,0.6);display:flex;align-items:flex-end;justify-content:center;padding:0;';
    overlay.innerHTML=`
<style>
  #rpt-overlay *{box-sizing:border-box;font-family:Arial,sans-serif;}
  .rpt-modal{background:#fff;border-radius:18px 18px 0 0;width:100%;max-width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.22);}
  .rpt-toolbar{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid #eceef3;flex-shrink:0;gap:10px;}
  .rpt-toolbar-left{display:flex;flex-direction:column;gap:2px;min-width:0;}
  .rpt-toolbar-title{font-size:14px;font-weight:700;color:#1a2233;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .rpt-toolbar-sub{font-size:11px;color:#7d899b;}
  .rpt-toolbar-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
  .rpt-btn-print{padding:8px 16px;background:${accent};color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;}
  .rpt-btn-close{width:34px;height:34px;border-radius:9px;background:#f0f2f5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .rpt-body{overflow-y:auto;overflow-x:hidden;padding:16px 18px 24px;flex:1;min-height:0;}
  .rpt-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid ${accent};}
  .rpt-title{font-size:15px;font-weight:700;color:${accent};margin-bottom:2px;}
  .rpt-sub{font-size:11px;color:#555;}
  .rpt-gen{font-size:10px;color:#999;text-align:right;white-space:nowrap;}
  .stats{display:flex;gap:8px;margin-bottom:14px;}
  .stat{flex:1;border:1px solid #e8edf3;border-radius:8px;padding:8px 10px;}
  .stat-val{font-size:20px;font-weight:700;line-height:1.1;}
  .stat-label{font-size:9px;color:#8a94a3;text-transform:uppercase;letter-spacing:.05em;margin-top:2px;}
  .stat.green .stat-val{color:#2e7d32;} .stat.amber .stat-val{color:#e65100;} .stat.red .stat-val{color:#c62828;} .stat.blue .stat-val{color:#1565c0;}
  table{border-collapse:collapse;width:100%;font-size:11px;}
  th,td{border:1px solid #dde2ea;padding:4px 6px;text-align:center;white-space:nowrap;}
  th{background:#f5f7fa;font-size:10px;font-weight:700;color:#36404f;}
  td.name{text-align:left;font-weight:600;color:#1a2233;}
  td.shift{text-align:left;color:#7d899b;font-size:10px;}
  td.tot{font-weight:700;color:#1a2233;}
  td.mc{color:#e65100;} td.ab{color:#c62828;}
  .P{background:#e8f5e9;color:#2e7d32;font-weight:700;}
  .Ps{background:#c8e6c9;color:#1b5e20;font-weight:700;}
  .MC{background:#fff8e1;color:#e65100;font-weight:700;}
  .A{color:#9aa3b2;}
  .total-row td{background:#f5f7fa;font-weight:700;border-top:2px solid #c8d0dc;}
  .legend{margin-top:10px;font-size:10px;color:#9aa3b2;}
</style>
<div class="rpt-modal">
  <div class="rpt-toolbar">
    <div class="rpt-toolbar-left">
      <div class="rpt-toolbar-title">${batch.label}: Attendance Report</div>
      <div class="rpt-toolbar-sub">${members.length} personnel · ${dates.length} reporting days</div>
    </div>
    <div class="rpt-toolbar-actions">
      <button class="rpt-btn-print" id="rpt-print-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save PDF
      </button>
      <button class="rpt-btn-close" id="rpt-close-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5c6678" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  </div>
  <div class="rpt-body">${reportInner}</div>
</div>`;

    document.body.appendChild(overlay);

    const close=()=>{ overlay.remove(); document.getElementById('print-report-css')?.remove(); };
    overlay.addEventListener('click',e=>{ if(e.target===overlay) close(); });
    document.getElementById('rpt-close-btn').addEventListener('click', close);
    document.getElementById('rpt-print-btn').addEventListener('click', ()=>window.print());
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
