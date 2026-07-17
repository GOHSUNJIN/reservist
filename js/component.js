window.makeAppComponent = function(DCLogic) {
class AppComponent extends DCLogic {
  state = makeInitialState();

  constructor(...args) {
    super(...args);
    this._touchStartX = null;
    for (const methods of [Handlers, Builders]) {
      for (const [key, fn] of Object.entries(methods)) {
        if (typeof fn === 'function') this[key] = fn.bind(this);
      }
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  componentDidMount(){
    this._lastDate = Utils.dateKey(new Date());
    this._t = setInterval(()=>{
      const newNow = new Date();
      this.setState({now:newNow});
      const newDate = Utils.dateKey(newNow);
      if(newDate !== this._lastDate){ this._lastDate = newDate; this._onDateChange(newDate); }
      if(this.state.role==='admin' && this.state.realtimeChannel){
        const live = this.state.realtimeChannel.state === 'joined';
        if(live !== this.state.realtimeLive) this.setState({realtimeLive:live});
      }
    }, 1000);
    try{ this._offlineQueues = JSON.parse(sessionStorage.getItem('offlineQ')||'[]'); }catch{ this._offlineQueues=[]; }
    if(this._offlineQueues.length) this.setState({offlinePending:true});
    const {detected, name} = this._detectInAppBrowser();
    if(detected) this.setState({isInAppBrowser:true, inAppBrowserName:name});
    if(localStorage.getItem('admin_notif')==='1') this.setState({adminNotifGranted:true});
    this._init();
    this._onOnline = async () => {
      this.setState({isOnline:true});
      const pending = this._offlineQueues;
      if(pending.length && !this.state.demo){
        const failed = [];
        for(const pend of pending){
          let ok = true;
          if(pend.key){
            await DB.attendance.logPhase(pend.id, pend.date, pend.key, pend.time, pend.dist, pend.bypassed||false).catch(()=>{ ok=false; });
          } else {
            await DB.attendance.upsert(pend.id, pend.date, pend.status, pend.extras).catch(()=>{ ok=false; });
          }
          if(!ok) failed.push(pend);
        }
        this._offlineQueues = failed;
        try{ sessionStorage.setItem('offlineQ', JSON.stringify(failed)); }catch{}
        if(!failed.length){ this.setState({offlinePending:false}); }
        else { this._toast('Some check-ins failed to sync. Tap Retry.','error'); }
      }
    };
    this._onOffline = () => this.setState({isOnline:false});
    window.addEventListener('online', this._onOnline);
    window.addEventListener('offline', this._onOffline);
    if(this._offlineQueues.length && navigator.onLine) setTimeout(()=>this._onOnline(), 800);
    this._onActivity = () => { if(this.state.authed) this._resetIdleTimer(); };
    window.addEventListener('pointerdown', this._onActivity);
    window.addEventListener('keydown', this._onActivity);
    this._onVisibilityChange = () => {
      if(!document.hidden && this.state.authed && this._lastActiveAt){
        const elapsed = Date.now() - this._lastActiveAt;
        if(elapsed >= 20*60*1000){ this._toast('Logged out due to inactivity.'); this.logout(); return; }
        else if(elapsed >= 18*60*1000){ this.setState({idleWarning:true}); }
        const newDate = Utils.dateKey(new Date());
        if(newDate !== this._lastDate){ this._lastDate = newDate; this._onDateChange(newDate); }
        if(this._offlineQueues.length && navigator.onLine) this._onOnline();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  componentWillUnmount(){
    if(this._toastTimer) clearTimeout(this._toastTimer);
    if(this._sessionWarnTimer) clearTimeout(this._sessionWarnTimer);
    if(this._idleWarnTimer) clearTimeout(this._idleWarnTimer);
    if(this._idleLogoutTimer) clearTimeout(this._idleLogoutTimer);
    clearInterval(this._t);
    this._unsubscribeRealtime();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('online', this._onOnline);
    window.removeEventListener('offline', this._onOffline);
    window.removeEventListener('pointerdown', this._onActivity);
    window.removeEventListener('keydown', this._onActivity);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  renderVals(){
    const s=this.state;
    const accent=this.props.accent||'#2f5fd0';
    const orgName=this.props.orgName||'Ops Security';
    const hqName=this.props.hqName||'Bedok DHQ';
    return {
      accent, orgName, hqName,
      bgOuter:'#cdd2da',
      bgContent:'#f6f7f9',
      showToast:!!s.toast, toastMsg:s.toast?.msg||'', toastBg:s.toast?.type==='error'?'#c0392b':'#1f8a5b',
      dismissToast:this.dismissToast,
      sessionExpiring:s.sessionExpiring, refreshSessionNow:this.refreshSessionNow,
      idleWarning:s.idleWarning, stayActive:this.stayActive,
      showA2hs:s.showA2hs, a2hsIsIos:s.a2hsIsIos, dismissA2hs:this.dismissA2hs,
      ...this._buildAuth(s, accent),
      ...this._buildNav(s, accent, orgName),
      ...this._buildCheckin(s, accent, hqName),
      ...this._buildCalendar(s, accent),
      ...this._buildAttendance(s),
      ...this._buildBriefings(s, accent),
      ...this._buildAdmin(s, accent),
      ...this._buildAccount(s, accent),
    };
  }
}
return AppComponent;
};
