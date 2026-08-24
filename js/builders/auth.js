// ── Auth view builder ─────────────────────────────────────────────────────
const AuthBuilders = {

  _buildAuth: function(s, accent) {
    const today=Utils.dateKey(this.baseDate());
    const suDept=s.suDepartment||'';
    // Filter batches by selected department for the intake badge
    const allSorted=[...(s.batches||[])].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const deptBatches=suDept?allSorted.filter(b=>!b.department||b.department===suDept):allSorted;
    const liveBatch=deptBatches.find(b=>today>=b.start_date&&today<=b.end_date)||(deptBatches.find(b=>b.is_live));
    const isLastDay=!!(liveBatch&&today===liveBatch.end_date);
    const nextBatch=isLastDay?deptBatches.find(b=>b.start_date>(liveBatch?.end_date||'')):null;
    const targetBatch=nextBatch||liveBatch;
    const tb=a=>`flex:1;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;${a?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':'background:transparent;color:#8a94a3;'}`;
    const bs=targetBatch?new Date(targetBatch.start_date+'T00:00:00'):null;
    const be=targetBatch?new Date(targetBatch.end_date+'T00:00:00'):null;
    const intakeLabel=targetBatch?.label||'';
    const intakeRangeFull=bs&&be?(Utils.fmtShort(bs)+' to '+Utils.fmtShort(be)+' '+bs.getFullYear()):'';
    const deptBtnBase='flex:1;padding:11px 8px;border:2px solid;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;text-align:center;transition:all .15s;';
    const deptOpsActive=suDept==='ops_security';
    const deptCasActive=suDept==='cas';
    return {
      showAuth:!s.authed, showApp:s.authed,
      isLogin:s.authMode==='login'&&!s.signupPending, isSignup:s.authMode==='signup'&&!s.signupPending,
      goLogin:this.goLogin, goSignup:this.goSignup,
      loginTabStyle:tb(s.authMode==='login'), signupTabStyle:tb(s.authMode==='signup'),
      accountDeleted:s.accountDeleted,
      loginNric:s.loginContact, loginPassword:s.loginPassword, authError:s.authError,
      authLoading:s.loading, authLoadingOpacity:s.loading?0.6:1,
      loginBtnLabel:s.loading?'Logging in…':'Log in',
      signupBtnLabel:s.loading?'Creating account…':'Create account',
      onLoginNric:this.onLoginContact, onLoginPassword:this.onLoginPassword,
      onLoginNricKeyDown:this.onLoginContactKeyDown,
      doLogin:this.doLogin, demoReservist:this.demoReservist, demoAdmin:this.demoAdmin,
      suName:s.suName, suContact:s.suContact, suPassword:s.suPassword,
      onSuName:this.onSuName, onSuContact:this.onSuContact, onSuPassword:this.onSuPassword,
      doSignup:this.doSignup,
      intakeLabel, intakeRangeFull,
      showIntakeBadge:!!targetBatch&&!!suDept,
      signupIsNextCycle:isLastDay&&!!nextBatch,
      forgotPasswordOpen:s.forgotPasswordOpen,
      openForgotPassword:this.openForgotPassword, closeForgotPassword:this.closeForgotPassword,
      capsLock:!!s.capsLock, onPwKeyDown:this.onPwKeyDown,
      signupPending:s.signupPending, dismissSignupPending:this.dismissSignupPending,
      suDepartment:suDept,
      selectDeptOps:this.selectDeptOps, selectDeptCas:this.selectDeptCas,
      deptOpsStyle:deptBtnBase+(deptOpsActive?`border-color:${accent};background:#eef3fc;color:${accent};`:'border-color:#d4d9e2;background:#fff;color:#5c6678;'),
      deptCasStyle:deptBtnBase+(deptCasActive?`border-color:${accent};background:#eef3fc;color:${accent};`:'border-color:#d4d9e2;background:#fff;color:#5c6678;'),
      signupCycleNote: suDept ? ` (${Utils.deptLabel(suDept)})` : '',
    };
  },

};
