const Utils = {
  shiftLabel(s){ return s==='AM'?'AM shift':s==='PM'?'PM shift':'Office hours'; },
  shiftWindow(s){ return s==='AM'?'0830 to 1530 hrs':s==='PM'?'1530 to 2230 hrs':'0900 to 1800 hrs'; },
  initials(name){ const p=(name||'').trim().split(/\s+/); return ((p[0]||'')[0]||'').toUpperCase()+((p[p.length-1]||'')[0]||'').toUpperCase(); },
  meta(s){
    if(s==='present') return {label:'Present',color:'#1f8a5b',bg:'#e7f3ec'};
    if(s==='mc')      return {label:'On MC',  color:'#b9791a',bg:'#f7efdc'};
    if(s==='absent')  return {label:'Absent', color:'#c0392b',bg:'#f7e4e1'};
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
  SG_HOLIDAYS:{
    '2026-01-01':"New Year's Day",'2026-02-17':'Chinese New Year','2026-02-18':'Chinese New Year',
    '2026-03-21':'Hari Raya Puasa','2026-04-03':'Good Friday','2026-05-01':'Labour Day',
    '2026-05-27':'Hari Raya Haji','2026-05-31':'Vesak Day','2026-06-01':'Vesak Day (observed)',
    '2026-08-09':'National Day','2026-08-10':'National Day (observed)',
    '2026-11-08':'Deepavali','2026-11-09':'Deepavali (observed)','2026-12-25':'Christmas Day',
  },
  holidayName(d){ return this.SG_HOLIDAYS[this.dateKey(d)]||null; },
};
