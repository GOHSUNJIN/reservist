// ── Auth view builder ─────────────────────────────────────────────────────
const AuthBuilders = {

  _buildAuth: function(s, accent) {
    const today=Utils.dateKey(this.baseDate());
    const sortedBatches=[...(s.batches||[])].sort((a,b)=>a.start_date>b.start_date?1:-1);
    const liveBatch=sortedBatches.find(b=>today>=b.start_date&&today<=b.end_date)||this._liveBatch(s.batches);
    const isLastDay=!!(liveBatch&&today===liveBatch.end_date);
    const nextBatch=isLastDay?sortedBatches.find(b=>b.start_date>(liveBatch?.end_date||'')):null;
    const targetBatch=nextBatch||liveBatch;
    const targetMembers=(s.personnel||[]).filter(p=>p.batch_id===targetBatch?.id&&(p.role||'reservist')==='reservist');
    const {am:amCount, pm:pmCount}=this._shiftSlotCounts(targetMembers);
    const amFull=amCount>=2, pmFull=pmCount>=2;
    let suShift=s.suShift;
    if((suShift==='AM'&&amFull)||(suShift==='PM'&&pmFull)) suShift='OFFICE';
    const shiftOptions=[
      {value:'AM', disabled:amFull, selected:suShift==='AM', label:amFull?'AM shift (0830-1530) (Taken)':'AM shift (0830-1530) ('+amCount+'/2)'},
      {value:'PM', disabled:pmFull, selected:suShift==='PM', label:pmFull?'PM shift (1530-2230) (Taken)':'PM shift (1530-2230) ('+pmCount+'/2)'},
      {value:'OFFICE', disabled:false, selected:suShift==='OFFICE', label:'Office (0900-1800)'},
    ];
    const tb=a=>`flex:1;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;${a?'background:#fff;color:#161f30;box-shadow:0 1px 3px rgba(20,30,50,.1);':'background:transparent;color:#8a94a3;'}`;
    const bs=targetBatch?new Date(targetBatch.start_date+'T00:00:00'):null;
    const be=targetBatch?new Date(targetBatch.end_date+'T00:00:00'):null;
    const intakeLabel=targetBatch?.label||'';
    const intakeRangeFull=bs&&be?(Utils.fmtShort(bs)+' to '+Utils.fmtShort(be)+' '+bs.getFullYear()):'';
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
      suName:s.suName, suContact:s.suContact, suShift, shiftOptions, suPassword:s.suPassword,
      amFull, pmFull, amCount, pmCount,
      amShiftLabel:amFull?'AM shift (0830-1530) (Taken)':'AM shift (0830-1530) ('+amCount+'/2)',
      pmShiftLabel:pmFull?'PM shift (1530-2230) (Taken)':'PM shift (1530-2230) ('+pmCount+'/2)',
      onSuName:this.onSuName, onSuContact:this.onSuContact, onSuShift:this.onSuShift, onSuShiftSelect:this.onSuShiftSelect, onSuPassword:this.onSuPassword,
      doSignup:this.doSignup,
      intakeLabel, intakeRange:intakeRangeFull, intakeRangeFull,
      signupIsNextCycle:isLastDay&&!!nextBatch,
      forgotPasswordOpen:s.forgotPasswordOpen,
      openForgotPassword:this.openForgotPassword, closeForgotPassword:this.closeForgotPassword,
      capsLock:!!s.capsLock, onPwKeyDown:this.onPwKeyDown,
      signupPending:s.signupPending, dismissSignupPending:this.dismissSignupPending,
    };
  },

};
