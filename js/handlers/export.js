// ── Attendance export handlers (Excel .xlsx and print report) ──────────────
const ExportHandlers = {

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
    const _mealElig=e=>{
      if(!e||e.status!=='present'||!e.p4) return false;
      return Utils.mealEligible(e, e.p4);
    };
    return members.map(p=>{
      const entries=dates.map(d=>{const dk=Utils.dateKey(d);const map=dk===todayKey?attendance:(attCache[dk]||{});return map[p.id]||null;});
      const pres=entries.filter(e=>e?.status==='present').length;
      const mc=entries.filter(e=>e?.status==='mc').length;
      const abs=entries.filter(e=>e?.status==='absent'||e?.status==='missed').length;
      const meal=entries.filter(_mealElig).length;
      const pct=dates.length>0?Math.round(pres/dates.length*100):null;
      return {name:p.name, shift:p.shift||'-', entries, pres, mc, abs, meal, pct};
    });
  },

  exportCsv: async function() {
    if(typeof JSZip==='undefined'){this._toast('Export library not loaded. Please refresh and try again.','error');return;}
    const exportData=await this._getExportData();
    if(!exportData){this._toast('No reservists found in this cycle.','error');return;}

    const {batch,members,start,end,dates,attCache,todayKey}=exportData;
    const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const fmtDate=d=>d.getDate()+' '+MO[d.getMonth()];
    const fmtDay=d=>DAYS[d.getDay()];
    const acc=(this.props.accent||'#2f5fd0').slice(1).toUpperCase();

    const rowData=this._buildExportMembers(members,dates,attCache,todayKey).map(r=>({
      ...r,
      cells:r.entries.map(e=>{
        if(!e?.status) return {code:'-',alt:true};
        if(e.status==='absent'||e.status==='missed') return {code:'A',xf:'absent'};
        if(e.status==='mc') return {code:'MC',xf:'mc'};
        return {code:e.editLog?.length>0?'P*':'P',xf:e.editLog?.length>0?'presentStar':'present'};
      }),
    }));

    const totPres=rowData.reduce((a,r)=>a+r.pres,0);
    const totMc  =rowData.reduce((a,r)=>a+r.mc,0);
    const totAbs =rowData.reduce((a,r)=>a+r.abs,0);
    const totMeal=rowData.reduce((a,r)=>a+r.meal,0);
    const totDays=members.length*dates.length;
    const totPct =totDays>0?Math.round(totPres/totDays*100):null;

    const now=new Date();
    const exportedStr=fmtDay(now)+' '+fmtDate(now)+' '+now.getFullYear()+' '+
      now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');

    // ── OOXML utilities ─────────────────────────────────────────────────────
    const xe=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const col=n=>{let s='';while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};
    const cr=(row,c)=>col(c)+row;
    const sc=(row,c,val,xf)=>`<c r="${cr(row,c)}" s="${xf}" t="inlineStr"><is><t>${xe(String(val))}</t></is></c>`;
    const ec=(row,c,xf)=>`<c r="${cr(row,c)}" s="${xf}"/>`;

    const D=dates.length, TC=7+D, lastCol=col(TC);

    // ── Font definitions ────────────────────────────────────────────────────
    // Index:  0=normal-black  1=bold-navy  2=normal-slate  3=bold-white
    //         4=bold-white-13pt  5=normal-grey  6=normal-dark
    //         7=bold-green  8=bold-dkgreen  9=bold-amber  10=bold-red
    //         11=normal-ltgrey  12=normal-legend-grey
    const mkFont=(bold,sz,color)=>`<font>${bold?'<b/>':''}<sz val="${sz}"/><color rgb="FF${color}"/><name val="Arial"/></font>`;
    const fontDefs=[
      mkFont(false,10,'000000'), mkFont(true,10,'1A2233'), mkFont(false,10,'5C6678'),
      mkFont(true,10,'FFFFFF'),  mkFont(true,13,'FFFFFF'),
      mkFont(false,10,'888888'), mkFont(false,10,'333333'),
      mkFont(true,10,'155724'),  mkFont(true,10,'0D3D1A'),
      mkFont(true,10,'856404'),  mkFont(true,10,'721C24'),
      mkFont(false,10,'B0B8C4'), mkFont(false,10,'9AA3B2'),
    ];

    // ── Fill definitions ────────────────────────────────────────────────────
    // Index: 0=none(req)  1=gray125(req)  2=white  3=lightRow  4=accent
    //        5=green  6=dkGreen  7=amber  8=red  9=total
    const mkFill=c=>c==='none'?'<fill><patternFill patternType="none"/></fill>':
      c==='gray125'?'<fill><patternFill patternType="gray125"/></fill>':
      `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
    const fillKeys=['none','gray125','FFFFFF','F5F7FB',acc,'D4EDDA','B8DAC4','FFF3CD','F8D7DA','EDF0F5'];
    const FI={none:0,gray:1,white:2,light:3,accent:4,green:5,dkGreen:6,amber:7,red:8,total:9};

    // ── Border definitions ──────────────────────────────────────────────────
    // Index: 0=none  1=thin-all  2=medium-top+thin-rest
    const mkBorder=t=>{
      const thin=p=>`<${p} style="thin"><color rgb="FFD0D8E4"/></${p}>`;
      if(t==='none') return '<border><left/><right/><top/><bottom/><diagonal/></border>';
      if(t==='thin') return `<border>${thin('left')}${thin('right')}${thin('top')}${thin('bottom')}<diagonal/></border>`;
      return `<border>${thin('left')}${thin('right')}<top style="medium"><color rgb="FFB0B8CC"/></top>${thin('bottom')}<diagonal/></border>`;
    };
    const BI={none:0,thin:1,thickTop:2};

    // ── Cell format (xf) definitions ────────────────────────────────────────
    // [fontId, fillId, borderId, halign]
    const mkXf=(f,fi,b,h)=>`<xf numFmtId="0" fontId="${f}" fillId="${fi}" borderId="${b}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="center"/></xf>`;
    const xfDefs=[
      [0,FI.none, BI.none,    'left'],    // 0  def
      [4,FI.accent,BI.none,   'left'],    // 1  titleHdr
      [5,FI.none, BI.none,    'left'],    // 2  metaLbl
      [6,FI.none, BI.none,    'left'],    // 3  meta
      [3,FI.accent,BI.thin,   'left'],    // 4  hdrL
      [3,FI.accent,BI.thin,   'center'],  // 5  hdrC
      [1,FI.white,BI.thin,    'left'],    // 6  nameE
      [1,FI.light,BI.thin,    'left'],    // 7  nameO
      [2,FI.white,BI.thin,    'left'],    // 8  shiftE
      [2,FI.light,BI.thin,    'left'],    // 9  shiftO
      [7,FI.green,BI.thin,    'center'],  // 10 present
      [8,FI.dkGreen,BI.thin,  'center'],  // 11 presentStar
      [9,FI.amber,BI.thin,    'center'],  // 12 mc
      [10,FI.red, BI.thin,    'center'],  // 13 absent
      [11,FI.white,BI.thin,   'center'],  // 14 dashE
      [11,FI.light,BI.thin,   'center'],  // 15 dashO
      [7, FI.white,BI.thin,   'center'],  // 16 numGE / rateGE
      [7, FI.light,BI.thin,   'center'],  // 17 numGO / rateGO
      [9, FI.white,BI.thin,   'center'],  // 18 numAE / rateAE
      [9, FI.light,BI.thin,   'center'],  // 19 numAO / rateAO
      [10,FI.white,BI.thin,   'center'],  // 20 numRE / rateRE
      [10,FI.light,BI.thin,   'center'],  // 21 numRO / rateRO
      [1, FI.total,BI.thickTop,'center'], // 22 totC
      [1, FI.total,BI.thickTop,'left'],   // 23 totL
      [7, FI.total,BI.thickTop,'center'], // 24 totG
      [9, FI.total,BI.thickTop,'center'], // 25 totA
      [10,FI.total,BI.thickTop,'center'], // 26 totR
      [12,FI.none, BI.none,   'left'],    // 27 legend
    ];
    const XF={
      def:0,titleHdr:1,metaLbl:2,meta:3,hdrL:4,hdrC:5,
      nameE:6,nameO:7,shiftE:8,shiftO:9,
      present:10,presentStar:11,mc:12,absent:13,
      dashE:14,dashO:15,
      numGE:16,numGO:17,numAE:18,numAO:19,numRE:20,numRO:21,
      totC:22,totL:23,totG:24,totA:25,totR:26,
      legend:27,
    };
    const rateSid=(n,E)=>n==null?(E?XF.dashE:XF.dashO):n>=80?(E?XF.numGE:XF.numGO):n>=60?(E?XF.numAE:XF.numAO):(E?XF.numRE:XF.numRO);
    const rateSidTot=n=>n==null?XF.totC:n>=80?XF.totG:n>=60?XF.totA:XF.totR;

    // ── styles.xml ──────────────────────────────────────────────────────────
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${fontDefs.length}">${fontDefs.join('')}</fonts>
<fills count="${fillKeys.length}">${fillKeys.map(mkFill).join('')}</fills>
<borders count="3">${['none','thin','thickTop'].map(mkBorder).join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfDefs.length}">${xfDefs.map(([f,fi,b,h])=>mkXf(f,fi,b,h)).join('')}</cellXfs>
</styleSheet>`;

    // ── sheet1.xml ──────────────────────────────────────────────────────────
    const col3=D>0?`<col min="3" max="${2+D}" width="11" customWidth="1"/>`:'';
    const colsXml=`<cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="8" customWidth="1"/>${col3}<col min="${3+D}" max="${7+D}" width="8" customWidth="1"/></cols>`;

    const rows=[];
    let r=1;

    // Title row (merged A1:lastCol)
    rows.push(`<row r="${r}" ht="30" customHeight="1">${sc(r,1,batch.label+': Attendance Report',XF.titleHdr)}${Array.from({length:TC-1},(_,i)=>ec(r,i+2,XF.titleHdr)).join('')}</row>`);

    // Spacer
    rows.push(`<row r="${++r}" ht="4" customHeight="1"/>`);

    // Meta rows
    const metaRow=(label,val)=>{r++;return `<row r="${r}" ht="18" customHeight="1">${sc(r,1,label,XF.metaLbl)}${sc(r,2,val,XF.meta)}${Array.from({length:TC-2},(_,i)=>ec(r,i+3,XF.meta)).join('')}</row>`;};
    rows.push(metaRow('Cycle',batch.label));
    rows.push(metaRow('Period',fmtDate(start)+' to '+fmtDate(end)+' '+end.getFullYear()));
    rows.push(metaRow('Exported',exportedStr));

    // Spacer
    rows.push(`<row r="${++r}" ht="10" customHeight="1"/>`);

    // Header row (row 7)
    r++;
    rows.push(`<row r="${r}" ht="20" customHeight="1">${[
      sc(r,1,'Name',XF.hdrL),sc(r,2,'Shift',XF.hdrC),
      ...dates.map((d,i)=>sc(r,3+i,fmtDay(d)+' '+fmtDate(d),XF.hdrC)),
      sc(r,3+D,'Present',XF.hdrC),sc(r,4+D,'MC',XF.hdrC),
      sc(r,5+D,'Absent',XF.hdrC),sc(r,6+D,'Meal',XF.hdrC),sc(r,7+D,'Rate',XF.hdrC),
    ].join('')}</row>`);

    // Data rows (start at row 8)
    rowData.forEach((rd,idx)=>{
      r++;
      const E=idx%2===0;
      const dataCells=rd.cells.map((c,i)=>{
        const xf=c.xf?XF[c.xf]:(E?XF.dashE:XF.dashO);
        return sc(r,3+i,c.code,xf);
      });
      rows.push(`<row r="${r}" ht="20" customHeight="1">${[
        sc(r,1,rd.name,E?XF.nameE:XF.nameO),sc(r,2,rd.shift,E?XF.shiftE:XF.shiftO),
        ...dataCells,
        sc(r,3+D,rd.pres,E?XF.numGE:XF.numGO),sc(r,4+D,rd.mc,E?XF.numAE:XF.numAO),
        sc(r,5+D,rd.abs,E?XF.numRE:XF.numRO),sc(r,6+D,rd.meal,E?XF.numAE:XF.numAO),
        sc(r,7+D,rd.pct!=null?rd.pct+'%':'-',rateSid(rd.pct,E)),
      ].join('')}</row>`);
    });

    // Total row
    const totRow=++r;
    rows.push(`<row r="${totRow}" ht="20" customHeight="1">${[
      sc(totRow,1,'TOTAL',XF.totL),ec(totRow,2,XF.totC),
      ...Array.from({length:D},(_,i)=>ec(totRow,3+i,XF.totC)),
      sc(totRow,3+D,totPres,XF.totG),sc(totRow,4+D,totMc,XF.totA),
      sc(totRow,5+D,totAbs,XF.totR),sc(totRow,6+D,totMeal,XF.totA),
      sc(totRow,7+D,totPct!=null?totPct+'%':'-',rateSidTot(totPct)),
    ].join('')}</row>`);

    // Spacer + legend
    rows.push(`<row r="${++r}" ht="8" customHeight="1"/>`);
    const legRow=++r;
    rows.push(`<row r="${legRow}">${sc(legRow,1,'P = Present  |  P* = Present (admin-corrected)  |  MC = Medical / Leave  |  A = Absent  |  Meal = Days eligible for meal allowance (6h+ worked, clocked out)',XF.legend)}</row>`);

    const merges=[
      `<mergeCell ref="A1:${lastCol}1"/>`,
      `<mergeCell ref="B3:${lastCol}3"/>`,
      `<mergeCell ref="B4:${lastCol}4"/>`,
      `<mergeCell ref="B5:${lastCol}5"/>`,
      `<mergeCell ref="A${totRow}:B${totRow}"/>`,
      `<mergeCell ref="A${legRow}:${lastCol}${legRow}"/>`,
    ];

    const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0">
<pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/>
<selection pane="bottomLeft" activeCell="A8" sqref="A8"/>
</sheetView></sheetViews>
<sheetFormatPr defaultColWidth="8" defaultRowHeight="15"/>
${colsXml}
<sheetData>${rows.join('')}</sheetData>
<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>
</worksheet>`;

    // ── Package OOXML into .xlsx (ZIP) ──────────────────────────────────────
    const zip=new JSZip();
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
    zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
    zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Attendance" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
    zip.file('xl/styles.xml',styles);
    zip.file('xl/worksheets/sheet1.xml',sheetXml);

    const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const filename=(batch.label.replace(/[\s/#]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'batch')+'_attendance.xlsx';
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._toast('Saved to Downloads.');
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
    const xe=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

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
    const totMeal=rowData.reduce((a,r)=>a+r.meal,0);
    const totDays=members.length*dates.length;
    const totPct=totDays>0?Math.round(totPres/totDays*100):0;
    const exportedOn=fmtDate(new Date())+' '+new Date().getFullYear();

    const headCols=dates.map(d=>`<th>${fmtDay(d)}<br><span style="font-weight:400;font-size:9px;">${fmtDate(d)}</span></th>`).join('');
    const bodyRows=rowData.map(r=>{
      const dayCells=r.cells.map(c=>`<td class="${c.cls}">${c.code}</td>`).join('');
      const pctColor=r.pct>=80?'#2e7d32':r.pct>=60?'#e65100':'#c62828';
      return `<tr>
        <td class="name">${xe(r.name)}</td>
        <td class="shift">${xe(r.shift)}</td>
        ${dayCells}
        <td class="tot">${r.pres}</td>
        <td class="tot mc">${r.mc}</td>
        <td class="tot ab">${r.abs}</td>
        <td class="tot meal">${r.meal}</td>
        <td class="tot" style="color:${pctColor};font-weight:700;">${r.pct}%</td>
      </tr>`;
    }).join('');

    const reportInner=`
<div class="rpt-hdr">
  <div>
    <div class="rpt-title">${xe(batch.label)}: Attendance Report</div>
    <div class="rpt-sub">${xe(orgName)} &nbsp;·&nbsp; ${fmtDate(start)} to ${fmtDate(end)} ${end.getFullYear()} &nbsp;·&nbsp; ${dates.length} reporting day${dates.length!==1?'s':''} &nbsp;·&nbsp; ${members.length} personnel</div>
  </div>
  <div class="rpt-gen">Generated ${exportedOn}</div>
</div>
<div class="stats">
  <div class="stat green"><div class="stat-val">${totPres}</div><div class="stat-label">Attendances</div></div>
  <div class="stat blue"><div class="stat-val">${totMc}</div><div class="stat-label">MC / Leave</div></div>
  <div class="stat red"><div class="stat-val">${totAbs}</div><div class="stat-label">Absences</div></div>
  <div class="stat amber"><div class="stat-val">${totMeal}</div><div class="stat-label">Meal Claims</div></div>
  <div class="stat ${totPct>=80?'green':totPct>=60?'amber':'red'}"><div class="stat-val">${totPct}%</div><div class="stat-label">Overall Rate</div></div>
</div>
<div style="overflow-x:auto;">
<table>
  <thead><tr>
    <th style="text-align:left;position:sticky;left:0;background:#f0f2f5;z-index:1;">Name</th>
    <th style="text-align:left;">Shift</th>
    ${headCols}
    <th>P</th><th>MC</th><th>A</th><th>Meal</th><th>Rate</th>
  </tr></thead>
  <tbody>
    ${bodyRows}
    <tr class="total-row">
      <td class="name" colspan="2">TOTAL</td>
      ${dates.map(()=>'<td></td>').join('')}
      <td>${totPres}</td><td class="mc">${totMc}</td><td class="ab">${totAbs}</td><td class="meal">${totMeal}</td>
      <td style="color:${totPct>=80?'#2e7d32':totPct>=60?'#e65100':'#c62828'};font-weight:700;">${totPct}%</td>
    </tr>
  </tbody>
</table>
</div>
<div class="legend">P = Present &nbsp;·&nbsp; P* = Present (admin-corrected) &nbsp;·&nbsp; MC = Medical / Leave &nbsp;·&nbsp; A = Absent / Missed &nbsp;·&nbsp; Meal = Days eligible for meal allowance (6h+ worked, clocked out)</div>`;

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
  td.mc{color:#e65100;} td.ab{color:#c62828;} td.meal{color:#b45309;font-weight:700;}
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
      <div class="rpt-toolbar-title">${xe(batch.label)}: Attendance Report</div>
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

};
