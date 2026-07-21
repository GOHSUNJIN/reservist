// ── Account and profile handlers ──────────────────────────────────────────
const AccountHandlers = {

  headerChipClick: function() { this.setState({accountOpen:true, acctNameEdit:this.cur()?.name||''}); },
  closeAccount: function() { this.setState({accountOpen:false, confirmDelete:false, acctPwError:'', acctPwSuccess:'', acctNameError:'', acctNameSuccess:''}); },
  askDelete:    function() { this.setState({confirmDelete:true}); },
  cancelDelete: function() { this.setState({confirmDelete:false}); },

  deleteAccount: async function() {
    if(!this.state.isOnline && !this.state.demo){
      this._toast('No connection. Cannot delete account while offline.','error'); return;
    }
    if(!this.state.demo){
      const {error} = await DB.personnel.deactivate(this.state.currentUserId).catch(e=>({error:e}));
      if(error){ this._toast('Failed to delete account. Please try again.','error'); return; }
    }
    await DB.auth.logout();
    this.setState({authed:false,role:null,authMode:'login',accountOpen:false,confirmDelete:false,accountDeleted:true,loginContact:'',loginPassword:'',demo:false});
  },

  onAvatarFile: function(e) {
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      const uid=this.state.currentUserId;
      localStorage.setItem('avatar_'+uid, r.result);
      this.setState(s=>{const noAv=new Set(s.noAvatarIds||[]);noAv.delete(uid);return{avatars:{...s.avatars,[uid]:r.result},noAvatarIds:noAv};});
      if(!this.state.demo){
        DB.storage.uploadAvatar(uid, f)
          .then(({error})=>{
            if(error){
              localStorage.removeItem('avatar_'+uid);
              this.setState(s=>{const av={...s.avatars};delete av[uid];const noAv=new Set(s.noAvatarIds||[]);noAv.add(uid);return{avatars:av,noAvatarIds:noAv};});
              this._toast('Photo upload failed. Please try again.','error');
            } else {
              const url=DB.storage.getAvatarUrl(uid)+'?t='+Date.now();
              if(url){ localStorage.setItem('avatar_'+uid, url); this.setState(s=>({avatars:{...s.avatars,[uid]:url}})); }
            }
          })
          .catch(()=>{
            localStorage.removeItem('avatar_'+uid);
            this.setState(s=>{const av={...s.avatars};delete av[uid];const noAv=new Set(s.noAvatarIds||[]);noAv.add(uid);return{avatars:av,noAvatarIds:noAv};});
            this._toast('Photo upload failed. Please try again.','error');
          });
      }
    };
    r.readAsDataURL(f);
  },

  removeAvatar: async function() {
    const uid=this.state.currentUserId;
    localStorage.setItem('avatar_'+uid, 'REMOVED');
    this.setState(s=>{const av={...s.avatars};delete av[uid];const noAv=new Set(s.noAvatarIds||[]);noAv.add(uid);return{avatars:av,noAvatarIds:noAv};});
    if(!this.state.demo) await DB.storage.deleteAvatar(uid).catch(()=>{});
    this._toast('Profile photo removed.');
  },

  onAcctNameEdit:  function(e) { this.setState({acctNameEdit:e.target.value, acctNameError:'', acctNameSuccess:''}); },
  onAcctPwCurrent: function(e) { this.setState({acctPwCurrent:e.target.value, acctPwError:'', acctPwSuccess:''}); },
  onAcctPwNew:     function(e) { this.setState({acctPwNew:e.target.value, acctPwError:'', acctPwSuccess:''}); },
  onAcctPwConfirm: function(e) { this.setState({acctPwConfirm:e.target.value, acctPwError:'', acctPwSuccess:''}); },

  saveAcctName: async function() {
    const name = this.state.acctNameEdit.trim();
    if(!name){ this.setState({acctNameError:'Name cannot be empty.'}); return; }
    this.setState({acctSaving:true, acctNameError:'', acctNameSuccess:''});
    if(!this.state.demo){
      const {error} = await DB.personnel.updateName(this.state.currentUserId, name).catch(e=>({error:e}));
      if(error){ this.setState({acctSaving:false, acctNameError:'Failed to save. Try again.'}); return; }
    }
    this.setState(s=>({acctSaving:false, acctNameSuccess:'Name updated.', me:{...s.me, name}}));
  },

  saveAcctPw: async function() {
    const {acctPwCurrent, acctPwNew, acctPwConfirm, me, demo} = this.state;
    if(!acctPwCurrent||!acctPwNew||!acctPwConfirm){ this.setState({acctPwError:'Fill in all password fields.'}); return; }
    if(acctPwNew.length<6){ this.setState({acctPwError:'New password must be at least 6 characters.'}); return; }
    if(acctPwNew!==acctPwConfirm){ this.setState({acctPwError:'New passwords do not match.'}); return; }
    this.setState({acctSaving:true, acctPwError:'', acctPwSuccess:''});
    if(!demo){
      const {error:loginErr} = await DB.auth.login(me?.contact, acctPwCurrent).catch(e=>({error:e}));
      if(loginErr){ this.setState({acctSaving:false, acctPwError:'Current password is incorrect.'}); return; }
      const {error} = await DB.auth.updatePassword(acctPwNew).catch(e=>({error:e}));
      if(error){ this.setState({acctSaving:false, acctPwError:'Failed to update password. Try again.'}); return; }
    }
    this.setState({acctSaving:false, acctPwSuccess:'Password updated.', acctPwCurrent:'', acctPwNew:'', acctPwConfirm:''});
  },

  requestAdminNotifs: async function() {
    if(!('Notification' in window)){ this._toast('Notifications not supported on this browser.','error'); return; }
    const perm = await Notification.requestPermission();
    if(perm === 'granted'){
      localStorage.setItem('admin_notif','1');
      this.setState({adminNotifGranted:true});
      this._subscribeAdminRequests();
      this._toast('Notifications enabled!');
    } else {
      this._toast('Notification permission denied.','error');
    }
  },

  _subscribeAdminRequests: function() {
    if(this.state.demo) return;
    if(this._adminRequestsChannel) return;
    this._adminRequestsChannel = DB.realtime.subscribeAdminRequests((row) => {
      if(row._type==='signup'){
        this.loadPendingSignups();
        if(this.state.adminNotifGranted && typeof Notification !== 'undefined' && Notification.permission === 'granted'){
          new Notification('New signup request', {body:(row.name||'Someone')+' is requesting to join.',icon:'./icon.svg'});
        }
      } else {
        this.loadPendingLeaves();
        if(this.state.adminNotifGranted && typeof Notification !== 'undefined' && Notification.permission === 'granted'){
          const typeMap = {mc:'MC',shift_change:'Shift Change',other:'Other',personal:'Personal Leave'};
          new Notification('New request from personnel', {body:(typeMap[row.type]||row.type)+' request received.',icon:'./icon.svg'});
        }
      }
    });
  },

};
