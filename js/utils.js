const Utils = {
  shiftLabel(s){ return s==='AM'?'AM shift':s==='PM'?'PM shift':'Office'; },
  shiftWindow(s){ return s==='AM'?'0830 to 1530 hrs':s==='PM'?'1530 to 2230 hrs':'0900 to 1800 hrs'; },
  initials(name){ const p=(name||'').trim().split(/\s+/); return ((p[0]||'')[0]||'').toUpperCase()+((p[p.length-1]||'')[0]||'').toUpperCase(); },
  meta(s){
    if(s==='present') return {label:'Present',color:'#1f8a5b',bg:'#e7f3ec'};
    if(s==='mc')      return {label:'On MC',  color:'#b9791a',bg:'#f7efdc'};
    if(s==='absent')  return {label:'Absent', color:'#c0392b',bg:'#f7e4e1'};
    if(s==='missed') return {label:'Missed', color:'#c0392b', bg:'#f7e4e1'};
    return {label:'Pending',color:'#5c6678',bg:'#eceef2'};
  },
  hhmm(d){ const p=n=>String(n).padStart(2,'0'); return p(d.getHours())+':'+p(d.getMinutes()); },
  dateKey(d){ const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); },
  addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; },
  mondayOf(d){ const wd=d.getDay(); return this.addDays(d, wd===0?-6:1-wd); },
  isReportDay(d){ const w=d.getDay(); return w>=1&&w<=5; },
  fmtShort(d){ const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return d.getDate()+' '+M[d.getMonth()]; },
  fmtMed(d){ const W=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return W[d.getDay()]+' '+d.getDate()+' '+M[d.getMonth()]; },
  fmtLong(d){ const W=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],M=['January','February','March','April','May','June','July','August','September','October','November','December']; return W[d.getDay()]+', '+d.getDate()+' '+M[d.getMonth()]+' '+d.getFullYear(); },

  // ── Batch cycle helpers ────────────────────────────────────────────────────
  // Cycles run Tue→Mon (13 days), dekit on Wed (+15 days from start).
  // Example: 16 Jun (Tue) → 29 Jun (Mon) → 1 Jul (Wed dekit).
  nextBatchTuesday(from){
    const d=new Date(from); d.setHours(0,0,0,0);
    const dow=d.getDay(); // 0=Sun,1=Mon,2=Tue...
    if(dow===2) return d;
    const days=dow<2?2-dow:9-dow;
    return this.addDays(d,days);
  },
  batchDatesFrom(startTue){
    const start=new Date(startTue); start.setHours(0,0,0,0);
    const end=this.addDays(start,13);   // Monday
    const dekit=this.addDays(start,15); // Wednesday
    return {start,end,dekit};
  },
  batchLabel(startDate, endDate, num){
    const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d=endDate?new Date(endDate+'T00:00:00'):new Date(startDate+'T00:00:00');
    return 'B'+(num||1)+' '+M[d.getMonth()]+' '+d.getFullYear();
  },

  SG_HOLIDAYS:{
    '2026-01-01':"New Year's Day",'2026-02-17':'Chinese New Year','2026-02-18':'Chinese New Year',
    '2026-03-21':'Hari Raya Puasa','2026-04-03':'Good Friday','2026-05-01':'Labour Day',
    '2026-05-27':'Hari Raya Haji','2026-05-31':'Vesak Day','2026-06-01':'Vesak Day (observed)',
    '2026-08-09':'National Day','2026-08-10':'National Day (observed)',
    '2026-11-08':'Deepavali','2026-11-09':'Deepavali (observed)','2026-12-25':'Christmas Day',
    '2027-01-01':"New Year's Day",'2027-02-06':'Chinese New Year','2027-02-08':'Chinese New Year (observed)',
    '2027-03-10':'Hari Raya Puasa','2027-03-26':'Good Friday','2027-05-01':'Labour Day',
    '2027-05-03':'Labour Day (observed)','2027-05-16':'Hari Raya Haji','2027-05-21':'Vesak Day',
    '2027-08-09':'National Day','2027-10-29':'Deepavali','2027-12-25':'Christmas Day',
    '2027-12-27':'Christmas Day (observed)',
  },
  holidayName(d){ return this.SG_HOLIDAYS[this.dateKey(d)]||null; },

  PHASE_WINDOWS:{
    AM:    {p1:['07:00','09:30'],p2:['11:00','13:00'],p3:['11:30','13:30'],p4:['14:30','16:00']},
    PM:    {p1:['14:30','17:00'],p2:['19:00','21:00'],p3:['19:30','21:30'],p4:['21:30','23:30']},
    OFFICE:{p1:['07:30','10:00'],p2:['11:30','13:30'],p3:['12:00','14:00'],p4:['17:00','19:00']},
  },
  phaseWindow(shift,key){return(this.PHASE_WINDOWS[shift]||this.PHASE_WINDOWS.OFFICE)[key]||null;},
  phaseInWindow(shift,key,now){
    const w=this.phaseWindow(shift,key);if(!w)return false;
    const p=n=>String(n).padStart(2,'0');
    const t=p(now.getHours())+':'+p(now.getMinutes());
    return t>=w[0]&&t<=w[1];
  },
  phaseWindowPast(shift,key,now){
    const w=this.phaseWindow(shift,key);if(!w)return false;
    const p=n=>String(n).padStart(2,'0');
    const t=p(now.getHours())+':'+p(now.getMinutes());
    return t>w[1];
  },
};
