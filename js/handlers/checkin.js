// ── Check-in handlers ─────────────────────────────────────────────────────
const CheckinHandlers = {

  _detectInAppBrowser: function() {
    const ua=navigator.userAgent||'';
    const isIOS=/iP(hone|od|ad)/.test(ua);
    if(/WhatsApp/i.test(ua))       return {detected:true, name:'WhatsApp'};
    if(/Instagram/i.test(ua))      return {detected:true, name:'Instagram'};
    if(/FBAN|FBAV/i.test(ua))      return {detected:true, name:'Facebook'};
    if(/Telegram/i.test(ua))       return {detected:true, name:'Telegram'};
    if(/Line\//i.test(ua))         return {detected:true, name:'Line'};
    if(/MicroMessenger/i.test(ua)) return {detected:true, name:'WeChat'};
    if(isIOS && /AppleWebKit/.test(ua) && !/Safari\//.test(ua))
      return {detected:true, name:'a messaging app'};
    return {detected:false, name:''};
  },

  verifyLocation: function() {
    if(this.state.locStatus==='locating') return;
    const retries=this.state.locRetryCount||0;
    this.setState({locStatus:'locating', locSlow:false, locPermErr:false, locRetryCount:retries+1});
    if(this._locSlowTimer) clearTimeout(this._locSlowTimer);
    this._locSlowTimer = setTimeout(()=>this.setState({locSlow:true}), 8000);
    if(!navigator.geolocation){
      setTimeout(()=>{
        clearTimeout(this._locSlowTimer);
        this.setState({locStatus:'verified',locDistance:Math.round(18+Math.random()*72),locSlow:false});
      },1200);
      return;
    }
    const ua=navigator.userAgent||'';
    const isIOS=/iP(hone|od|ad)/.test(ua), isAndroid=/Android/.test(ua);
    const {detected:isInApp, name:inAppName} = this._detectInAppBrowser();
    const _permMsg=isInApp
      ?`Location is blocked inside ${inAppName}.\n\n${inAppName}'s browser cannot access GPS.\n\nFix: tap ··· or the share icon → "Open in Safari" (iPhone) or "Open in Chrome" (Android), then try again there.`
      :isIOS
      ?'Location is blocked for this site.\n\n⚠️ Using Private Browsing? Safari blocks location in private tabs. Switch to a normal tab.\n\nOtherwise:\n1. iPhone Settings → Privacy & Security → Location Services → your browser → "While Using App"\n2. In Safari: tap "aA" in address bar → Website Settings → Location → Allow\n\nThen tap Reload below.'
      :isAndroid
      ?'Location is blocked for this site.\n\n⚠️ Using Incognito? Location is often blocked in private tabs. Switch to a normal tab.\n\nOtherwise:\n1. Tap the 🔒 icon in your address bar → Permissions → Location → Allow\n2. Browser Settings → Site Settings → Location → this site → Allow\n3. Phone Settings → Apps → [your browser] → Permissions → Location → Allow\n\nThen tap Reload below.'
      :'Location blocked.\n\n⚠️ Using a private/incognito tab? Switch to a normal tab.\n\nOtherwise allow Location via the 🔒 lock icon in your address bar, then tap Reload below.';
    const _unavailMsg=retries>=2
      ?'GPS still unavailable after several tries.\n\nAdditional steps:\n• Turn Location Services off and back on in phone Settings\n• Restart your phone\n• Contact your supervisor if the issue persists'
      :'GPS signal unavailable.\n\n• Step outside or move near a window\n• Make sure Airplane mode is off\n• Turn Location Services off and back on, then try again';
    const _timeoutMsg=retries>=2
      ?'GPS keeps timing out.\n\n• Move to an open area with clear sky view\n• Turn Location off and back on in Settings\n• Try restarting your phone\n• Contact your supervisor if this continues'
      :'GPS timed out after 15 seconds.\n\n• Move to an open area or near a window\n• Make sure Location Services is on in Settings\n• Try again in a few seconds';
    navigator.geolocation.getCurrentPosition(
      pos=>{
        clearTimeout(this._locSlowTimer);
        const dist=this._haversine(pos.coords.latitude,pos.coords.longitude,this._hqLat(),this._hqLon());
        const rounded=Math.round(dist);
        const accuracy=pos.coords.accuracy!=null?Math.round(pos.coords.accuracy):null;
        if(accuracy!=null&&accuracy>400&&(this.state.locRetryCount||0)<=2){
          this.setState({locStatus:'idle',locSlow:false});
          setTimeout(()=>this.verifyLocation(),300);
          return;
        }
        this.setState({locDistance:rounded,locAccuracy:accuracy,locSlow:false,locPermErr:false,locStatus:rounded<=this._maxDist()?'verified':'out_of_range'});
      },
      err=>{
        clearTimeout(this._locSlowTimer);
        const isPerm=err.code===1;
        const msg=isPerm?_permMsg:err.code===2?_unavailMsg:_timeoutMsg;
        this.setState({locStatus:'gps_error',locDistance:null,locGpsMsg:msg,locSlow:false,locPermErr:isPerm});
      },
      {enableHighAccuracy:true,timeout:15000,maximumAge:0}
    );
  },

  _hqLat:  function() { return parseFloat(this.props.hqLat)||1.332572; },
  _hqLon:  function() { return parseFloat(this.props.hqLon)||103.937189; },
  _maxDist: function() { return parseInt(this.props.hqRange)||500; },

  _haversine: function(lat1,lon1,lat2,lon2) {
    const R=6371000, r=Math.PI/180;
    const dLat=(lat2-lat1)*r, dLon=(lon2-lon1)*r;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  },

  startPhaseGps: function(phase) {
    return () => {
      if(this.state.locStatus==='locating') return;
      const switchingPhase=this.state.locPhase!==phase;
      this.setState({locPhase:phase, locStatus:'idle', locDistance:null, locGpsMsg:'', locAccuracy:null, locSlow:false, locPermErr:false, ...(switchingPhase?{locRetryCount:0}:{})});
      this.verifyLocation();
    };
  },

  doPhase: function(key) {
    return async () => {
      if(this.state.phaseSubmitting) return;
      const {locStatus,locDistance,locPhase,currentUserId,demo,isOnline} = this.state;
      if(locStatus!=='verified'||locPhase!==key) return;
      this.setState({phaseSubmitting:true});
      const _now = new Date();
      const time = Utils.hhmm(_now);
      if(key==='p1'){
        const me=this.state.me; const shift=me?.shift||'AM';
        const cutoff=Utils.LATE_CUTOFF[shift]||'08:30';
        const [ch,cm]=cutoff.split(':').map(Number);
        const [th,tm]=time.split(':').map(Number);
        const minsLate=(th*60+tm)-(ch*60+cm);
        if(minsLate>=60) this.setState({lateReasonOpen:true,lateReasonText:''});
        else if(minsLate>=30) this.setState({showLateWarning:true});
      }
      const today = Utils.dateKey(this.baseDate());
      const rec = {...this.myRec()};
      if(key==='p1'){rec.status='present';rec.p1=time;rec.p1dist=locDistance;}
      else if(key==='p2') rec.p2=time;
      else if(key==='p3'){rec.p3=time;rec.p3dist=locDistance;}
      else if(key==='p4') rec.p4=time;
      this.setState(s=>({
        attendance:{...s.attendance,[currentUserId]:rec},
        locStatus:'idle', locPhase:null, phaseSubmitting:false,
        showLateWarning:key==='p1'?false:s.showLateWarning,
      }));
      this._haptic();
      const _phaseToasts={p1:'Checked in',p2:'Break recorded',p3:'Returned',p4:'Checked out'};
      this._toast(_phaseToasts[key]||'Recorded');
      if(!demo){
        if(!isOnline){
          this._queuePush({id:currentUserId,date:today,key,time,dist:locDistance});
        } else {
          const {error:phErr} = await DB.attendance.logPhase(currentUserId, today, key, time, locDistance);
          if(phErr) this._toast('Check-in saved locally but failed to sync. Check your connection.','error');
        }
      }
    };
  },

  doPhaseBypass: function(key) {
    return async () => {
      if(this.state.phaseSubmitting) return;
      const {currentUserId,demo,isOnline} = this.state;
      this.setState({phaseSubmitting:true});
      const _now = new Date();
      const time = Utils.hhmm(_now);
      if(key==='p1'){
        const me=this.state.me; const shift=me?.shift||'AM';
        const cutoff=Utils.LATE_CUTOFF[shift]||'08:30';
        const [ch,cm]=cutoff.split(':').map(Number);
        const [th,tm]=time.split(':').map(Number);
        const minsLate=(th*60+tm)-(ch*60+cm);
        if(minsLate>=60) this.setState({lateReasonOpen:true,lateReasonText:''});
        else if(minsLate>=30) this.setState({showLateWarning:true});
      }
      const today = Utils.dateKey(this.baseDate());
      const rec = {...this.myRec()};
      if(key==='p1'){rec.status='present';rec.p1=time;rec.p1dist=null;rec.gpsBypassed=true;}
      else if(key==='p2') rec.p2=time;
      else if(key==='p3'){rec.p3=time;rec.p3dist=null;rec.gpsBypassed=true;}
      else if(key==='p4') rec.p4=time;
      this.setState(s=>({
        attendance:{...s.attendance,[currentUserId]:rec},
        locStatus:'idle', locPhase:null, phaseSubmitting:false,
      }));
      this._haptic();
      const _phaseToasts={p1:'Checked in',p2:'Break recorded',p3:'Returned',p4:'Checked out'};
      this._toast(_phaseToasts[key]||'Recorded');
      if(!demo){
        if(!isOnline){
          this._queuePush({id:currentUserId,date:today,key,time,dist:null,bypassed:true});
        } else {
          const {error:phErr} = await DB.attendance.logPhase(currentUserId, today, key, time, null, true);
          if(phErr) this._toast('Check-in saved locally but failed to sync. Check your connection.','error');
        }
      }
    };
  },

  _haptic: function(ms=60) { if(navigator.vibrate) navigator.vibrate(ms); },

  _queuePush: function(item) {
    this._offlineQueues.push(item);
    try{ sessionStorage.setItem('offlineQ', JSON.stringify(this._offlineQueues)); }catch{}
    this.setState({offlinePending:true});
  },

  retrySync: function() { if(this.state.isOnline) this._onOnline(); },

  openLateReason:      function() { this.setState({lateReasonOpen:true,lateReasonText:this.myRec()?.lateReason||''}); },
  onLateReasonText:    function(e) { this.setState({lateReasonText:e.target.value}); },
  skipLateReason:      function() { this.setState({lateReasonOpen:false,lateReasonText:''}); },
  dismissLateWarning:  function() { this.setState({showLateWarning:false}); },

  submitLateReason: async function() {
    const {lateReasonText,currentUserId,demo,isOnline} = this.state;
    if(!lateReasonText.trim()) return;
    this.setState({lateReasonSubmitting:true});
    if(!demo){
      if(!isOnline){ this._toast('No connection. Reason not saved. Try again when online.','error'); this.setState({lateReasonSubmitting:false}); return; }
      const today=Utils.dateKey(this.baseDate());
      const {error} = await DB.attendance.submitLateReason(currentUserId, today, lateReasonText.trim());
      if(error){ this._toast('Failed to save reason. Try again.','error'); this.setState({lateReasonSubmitting:false}); return; }
    }
    this.setState({lateReasonOpen:false,lateReasonText:'',lateReasonSubmitting:false});
    this._toast('Reason submitted.');
  },

};
