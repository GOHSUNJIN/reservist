// ── Auth view builder ─────────────────────────────────────────────────────
const AuthBuilders = {

  _buildAuth: function(s, accent) {
    const today=Utils.dateKey(this.baseDate());
    const suDept=s.suDepartment||'';
    // Filter batches by selected department for the intake badge
    const allSorted=[...(s.batches||[])].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const strictDept=suDept?allSorted.filter(b=>b.department===suDept):allSorted;
    const deptBatches=suDept?(strictDept.length?strictDept:allSorted.filter(b=>!b.department)):allSorted;
    const liveBatch=deptBatches.find(b=>b.is_live)||deptBatches.find(b=>today>=b.start_date&&today<=b.end_date);
    const isLastDay=!!(liveBatch&&today===liveBatch.end_date);
    const nextBatch=isLastDay?deptBatches.find(b=>b.start_date>(liveBatch?.end_date||'')):null;
    const targetBatch=nextBatch||liveBatch;
    const tb=a=>`flex:1;padding:11px;border:none;border-radius:var(--r-sm);font-size:14px;font-weight:600;cursor:pointer;${a?'background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(20,30,50,.1);':'background:transparent;color:var(--ink-2);'}`;
    const bs=targetBatch?new Date(targetBatch.start_date+'T00:00:00'):null;
    const be=targetBatch?new Date(targetBatch.end_date+'T00:00:00'):null;
    let intakeLabel=targetBatch?.label||'';
    if(isLastDay&&liveBatch){
      const liveM=liveBatch.label?.match(/^Cycle (\d+)\/(.*)/);
      const targetM=intakeLabel.match(/^Cycle (\d+)\/(.*)/);
      if(liveM&&targetM&&parseInt(targetM[1])<=parseInt(liveM[1]))
        intakeLabel=`Cycle ${parseInt(liveM[1])+1}/${liveM[2]}`;
    }
    const intakeRangeFull=bs&&be?(Utils.fmtShort(bs)+' to '+Utils.fmtShort(be)+' '+bs.getFullYear()):'';
    const signupDeptOptions=Object.entries(Utils.DEPARTMENTS).map(([value,{label}])=>({value,label}));
    return {
      showAuth:!s.authed, showApp:s.authed,
      isLogin:s.authMode==='login'&&!s.signupPending, isSignup:s.authMode==='signup'&&!s.signupPending,
      isRejected:s.authMode==='rejected'&&!s.signupPending, isReapply:s.authMode==='reapply'&&!s.signupPending,
      showAuthTabs:!s.signupPending&&s.authMode!=='rejected'&&s.authMode!=='reapply'&&s.authMode!=='setpw'&&s.authMode!=='pending',
      isPendingStatus:s.authMode==='pending'&&!s.signupPending,
      isSetPassword:s.authMode==='setpw'&&!s.signupPending,
      setPwNew:s.setPwNew, setPwConfirm:s.setPwConfirm, onSetPwNew:this.onSetPwNew, onSetPwConfirm:this.onSetPwConfirm,
      onSetPwKeyDown:this.onSetPwKeyDown, doSetPassword:this.doSetPassword, logoutSetPw:this.logoutSetPw,
      setPwType:s.showSetPw?'text':'password', toggleSetPw:this.toggleSetPw, setPwToggleLabel:s.showSetPw?'Hide':'Show',
      setPwBtnLabel:s.loading?'Saving…':'Save Password',
      ...(()=>{
        const r=s.rejectedReq||{};
        const pr=s.pendingReq||{};
        const prIntake=pr.intakeLabel||((s.batches||[]).find(b=>b.id===pr.batch_id)||{}).label||'';
        const prWhen=pr.created_at?new Date(pr.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
        const when=r.reviewed_at?new Date(r.reviewed_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
        return {
          rejectedDeptLabel:Utils.deptLabel(r.department)||'the department',
          rejectedReason:r.rejection_reason||'', hasRejectedReason:!!r.rejection_reason,
          rejectedWhen:when, hasRejectedWhen:!!when,
          rejectedName:r.name||'', rejectedContact:r.contact||'',
          pendingDeptLabel:Utils.deptLabel(pr.department)||'your department',
          pendingIntake:prIntake, hasPendingIntake:!!prIntake,
          pendingWhen:prWhen, hasPendingWhen:!!prWhen,
          pendingCheckLabel:s.loading?'Checking…':'Check Again',
          reapplySameDeptNote:(suDept&&suDept===r.department)?'This is the department that declined your last request.':'',
        };
      })(),
      openReapply:this.openReapply, cancelReapply:this.cancelReapply, doReapply:this.doReapply, logoutRejected:this.logoutRejected, logoutPending:this.logoutPending, checkPendingAgain:this.checkPendingAgain,
      reapplyBtnLabel:s.loading?'Submitting…':'Submit Application',
      goLogin:this.goLogin, goSignup:this.goSignup,
      loginTabStyle:tb(s.authMode==='login'), signupTabStyle:tb(s.authMode==='signup'),
      accountDeleted:s.accountDeleted,
      loginNric:s.loginContact, loginPassword:s.loginPassword, authError:s.authError,
      authLoading:s.loading, authLoadingOpacity:s.loading?0.6:1, authLoadingPointerEvents:s.loading?'none':'auto',
      loginBtnLabel:s.loading?'Logging In…':'Log In',
      signupBtnLabel:s.loading?'Creating Account…':'Create Account',
      onLoginNric:this.onLoginContact, onLoginPassword:this.onLoginPassword,
      onLoginNricKeyDown:this.onLoginContactKeyDown,
      doLogin:this.doLogin, demoReservist:this.demoReservist, demoAdmin:this.demoAdmin,
      suName:s.suName, suContact:s.suContact, suPassword:s.suPassword,
      onSuName:this.onSuName, onSuContact:this.onSuContact, onSuPassword:this.onSuPassword,
      onSuKeyDown:this.onSuKeyDown,
      doSignup:this.doSignup,
      intakeLabel, intakeRangeFull,
      showIntakeBadge:!!targetBatch&&!!suDept,
      signupIsNextCycle:isLastDay&&!!nextBatch,
      forgotPasswordOpen:s.forgotPasswordOpen,
      openForgotPassword:this.openForgotPassword, closeForgotPassword:this.closeForgotPassword,
      capsLock:!!s.capsLock, onPwKeyDown:this.onPwKeyDown,
      signupPending:s.signupPending, dismissSignupPending:this.dismissSignupPending,
      suDepartment:suDept,
      signupDeptSelectVal:suDept,
      signupDeptOptions,
      onSignupDeptSelect:this.onSignupDeptSelect,
      signupCycleNote: suDept ? ` (${Utils.deptLabel(suDept)})` : '',
      loginPwType:s.showLoginPw?'text':'password', showLoginPw:!!s.showLoginPw, hideLoginPw:!s.showLoginPw, toggleLoginPw:this.toggleLoginPw,
      suPwType:s.showSuPw?'text':'password', showSuPw:!!s.showSuPw, hideSuPw:!s.showSuPw, toggleSuPw:this.toggleSuPw,
    };
  },

};
