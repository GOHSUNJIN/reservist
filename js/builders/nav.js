// ── Nav view builder ──────────────────────────────────────────────────────
const NavBuilders = {

  _buildNav: function(s, accent, orgName) {
    const me=this.cur();
    const TITLES={checkin:'Check-In',briefings:'Briefings',attendance:'Attendance',meal:'Meal Allowance',overview:'Dashboard',roster:'Roster',log:'Attendance Log',people:'Personnel'};
    const nc=t=>s.tab===t?accent:'#9aa3b2';
    const nb=t=>s.tab===t?'#eef3fc':'transparent';
    return {
      isReservist:s.role==='reservist', isAdmin:s.role==='admin',
      headerChipClick:this.headerChipClick, logout:this.logout, askLogout:this.askLogout, cancelLogout:this.cancelLogout, logoutConfirmOpen:s.logoutConfirmOpen||false, logoutConfirmClosed:!(s.logoutConfirmOpen||false),
      userName:s.role==='admin'?(me?.name||'Supervisor'):(me?.name||''),
      userInitials:s.role==='admin'?(me?.name?Utils.initials(me.name):'SV'):Utils.initials(me?.name||''),
      tabTitle:TITLES[s.tab]||'',
      headerKicker:(()=>{const dl=Utils.deptLabel(this._myDept());return s.isSuperAdmin?'Master, '+dl:s.role==='admin'?'Admin, '+dl:dl+', PNSMEN';})(),
      goCheckin:this.go('checkin'), goBriefings:this.go('briefings'), goAttendance:this.go('attendance'), goMeal:this.go('meal'),
      goOverview:()=>{ this.setState({tab:'overview'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goRoster:()=>{ this.setState({tab:'roster'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goLog:()=>{ this.setState({tab:'log', viewOffset:0}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goPeople:this.goPeople,
      cCheckin:nc('checkin'), cBriefings:nc('briefings'), cAttendance:nc('attendance'), cMeal:nc('meal'),
      cOverview:nc('overview'), cRoster:nc('roster'), cLog:nc('log'), cPeople:nc('people'),
      nbCheckin:nb('checkin'), nbBriefings:nb('briefings'), nbAttendance:nb('attendance'), nbMeal:nb('meal'),
      nbOverview:nb('overview'), nbRoster:nb('roster'), nbLog:nb('log'), nbPeople:nb('people'),
      tabCheckin:s.tab==='checkin', tabBriefings:s.tab==='briefings', tabAttendance:s.tab==='attendance', tabMeal:s.tab==='meal',
      tabOverview:s.tab==='overview', tabRoster:s.tab==='roster', tabLog:s.tab==='log', tabPeople:s.tab==='people',
      pendingSignupCount:s.pendingSignups.length,
      hasPendingSignups:s.pendingSignups.length>0,
      pendingSignupsLoaded:!!(s.pendingSignupsLoaded),
      offlinePending:s.offlinePending, offlineQueueCount:this._offlineQueues?.length||0,
      offlineQueueMsg:(()=>{const n=this._offlineQueues?.length||0;return s.offlinePending?': '+n+' action'+(n===1?'':'s')+' queued':'';})(),
      showReservistFullNav: s.role==='reservist' && this._myDept()!=='cas',
    };
  },

};
