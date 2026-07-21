// ── Account view builder ──────────────────────────────────────────────────
const AccountBuilders = {

  _buildAccount: function(s, accent) {
    const me=this.cur(); if(!me) return {};
    const avatarUrl=s.avatars[s.currentUserId]||'';
    const acctBatch=(s.batches||[]).find(b=>b.id===me.batch_id)||(s.batches||[]).find(b=>b.is_live)||null;
    const acctDekit=acctBatch?.dekit_date?new Date(acctBatch.dekit_date+'T00:00:00'):null;
    const acctTodayMid=new Date();acctTodayMid.setHours(0,0,0,0);
    const acctDkLeft=acctDekit?Math.round((acctDekit-acctTodayMid)/86400000):null;
    const acctDekitCountdown=acctDkLeft===null?'':acctDkLeft===0?'Return equipment today':acctDkLeft>0?`${acctDkLeft} day${acctDkLeft!==1?'s':''} to dekit`:'Cycle complete';
    const acctShowDekit=s.role==='reservist'&&!!acctDekitCountdown;
    return {
      accountOpen:s.accountOpen,
      closeAccount:this.closeAccount, askDelete:this.askDelete, cancelDelete:this.cancelDelete, deleteAccount:this.deleteAccount,
      confirmDelete:s.confirmDelete,
      acctContact:me.contact||'-',
      onAvatarFile:this.onAvatarFile,
      headerAvatarBg:avatarUrl?('url("'+avatarUrl+'")') :'none',
      headerNoAvatar:!avatarUrl,
      acctAvatarBg:avatarUrl?('url("'+avatarUrl+'")') :'none',
      acctNoAvatar:!avatarUrl, acctHasAvatar:!!avatarUrl,
      removeAvatar:this.removeAvatar,
      isReservistRole:s.role==='reservist',
      acctNameEdit:s.acctNameEdit, onAcctNameEdit:this.onAcctNameEdit, saveAcctName:this.saveAcctName,
      acctNameError:s.acctNameError, acctNameSuccess:s.acctNameSuccess,
      acctPwCurrent:s.acctPwCurrent, acctPwNew:s.acctPwNew, acctPwConfirm:s.acctPwConfirm,
      onAcctPwCurrent:this.onAcctPwCurrent, onAcctPwNew:this.onAcctPwNew, onAcctPwConfirm:this.onAcctPwConfirm,
      saveAcctPw:this.saveAcctPw,
      acctPwError:s.acctPwError, acctPwSuccess:s.acctPwSuccess,
      acctSaving:s.acctSaving, acctSavingOpacity:s.acctSaving?0.6:1, capsLock:!!s.capsLock, onPwKeyDown:this.onPwKeyDown,
      acctDekitCountdown, acctShowDekit,
      adminNotifGranted:s.adminNotifGranted, requestAdminNotifs:this.requestAdminNotifs,
      helpOpen:s.helpOpen, openHelp:this.openHelp, closeHelp:this.closeHelp,
      dekitDateFull:acctDekit?Utils.fmtMed(acctDekit):'',
      changePwOpen:s.changePwOpen, openChangePw:this.openChangePw, closeChangePw:this.closeChangePw,
      changeNameOpen:s.changeNameOpen, openChangeName:this.openChangeName, closeChangeName:this.closeChangeName,
    };
  },

};
