// ── Nav view builder ──────────────────────────────────────────────────────
const NavBuilders = {

  _buildNav: function(s, accent, orgName) {
    const me=this.cur();
    const TITLES={checkin:'Check-In',briefings:'Briefings',attendance:'Attendance',meal:'Meal Allowance',overview:'Dashboard',roster:'Roster',log:'Attendance Log',people:'Personnel'};
    const nc=t=>s.tab===t?accent:'#9aa3b2';
    const ni=t=>s.tab===t?accent:'transparent';
    return {
      isReservist:s.role==='reservist', isAdmin:s.role==='admin',
      headerChipClick:this.headerChipClick, logout:this.logout,
      userName:s.role==='admin'?(me?.name||'Supervisor'):(me?.name||''),
      userInitials:s.role==='admin'?(me?.name?Utils.initials(me.name):'SV'):Utils.initials(me?.name||''),
      tabTitle:TITLES[s.tab]||'',
      headerKicker:s.isSuperAdmin?'Master, '+orgName:s.role==='admin'?'Admin, '+orgName:orgName+', PNSMEN',
      goCheckin:this.go('checkin'), goBriefings:this.go('briefings'), goAttendance:this.go('attendance'), goMeal:this.go('meal'),
      goOverview:()=>{ this.setState({tab:'overview'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goRoster:()=>{ this.setState({tab:'roster'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goLog:()=>{ this.setState({tab:'log'}); setTimeout(()=>this.loadRosterAvatars(),0); this._scrollTop(); },
      goPeople:this.goPeople,
      cCheckin:nc('checkin'), cBriefings:nc('briefings'), cAttendance:nc('attendance'), cMeal:nc('meal'),
      cOverview:nc('overview'), cRoster:nc('roster'), cLog:nc('log'), cPeople:nc('people'),
      ntCheckin:ni('checkin'), ntBriefings:ni('briefings'), ntAttendance:ni('attendance'), ntMeal:ni('meal'),
      ntOverview:ni('overview'), ntRoster:ni('roster'), ntLog:ni('log'), ntPeople:ni('people'),
      tabCheckin:s.tab==='checkin', tabBriefings:s.tab==='briefings', tabAttendance:s.tab==='attendance', tabMeal:s.tab==='meal',
      tabOverview:s.tab==='overview', tabRoster:s.tab==='roster', tabLog:s.tab==='log', tabPeople:s.tab==='people',
      pendingSignupCount:s.pendingSignups.length,
      hasPendingSignups:s.pendingSignups.length>0,
      pendingSignupsLoaded:!!(s.pendingSignupsLoaded),
    };
  },

};
