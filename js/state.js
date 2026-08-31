// ── Initial state factory ─────────────────────────────────────────────────
// Called once per component instance. Dynamic defaults (now, batchJumpDate,
// Sets, isOnline) are evaluated freshly each time so instances never share
// mutable references.
const makeInitialState = () => ({

  // ── Session and auth ────────────────────────────────────────────────────
  authed: false, role: null, authMode: 'login',
  currentUserId: null, me: null,
  authError: '', loading: false, accountDeleted: false,
  isSuperAdmin: false,
  realtimeChannel: null, realtimeLive: false,
  sessionExpiring: false, idleWarning: false,
  adminNotifGranted: false,

  // ── Auth forms ──────────────────────────────────────────────────────────
  loginContact: '', loginPassword: '', showLoginPw: false,
  suName: '', suContact: '', suPassword: '', suDepartment: '', showSuPw: false,
  forgotPasswordOpen: false,
  adminDeptFilter: 'ops_security',

  // ── Live data ───────────────────────────────────────────────────────────
  personnel: [], attendance: {}, attendanceCache: {}, approvedLeavesCache: {},
  batches: [], activeBatchIdx: 0,
  noReportDays: new Set(), noReportDaysCache: {},
  history: [],
  batchMembersCache: {}, deptLastBatchId: {},
  attendanceDate: null,

  // ── UI shell ────────────────────────────────────────────────────────────
  tab: 'checkin',
  now: new Date(), demo: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlinePending: false,
  isInAppBrowser: false, inAppBrowserName: '',
  toast: null,
  viewOffset: 0, selectedCalOffset: null,
  avatars: {}, noAvatarIds: new Set(),
  showA2hs: false, a2hsIsIos: false,
  helpOpen: false,

  // ── Check-in and GPS ────────────────────────────────────────────────────
  locStatus: 'idle', locDistance: null, locGpsMsg: '',
  locPhase: null, locSlow: false, locAccuracy: null, locPermErr: false, locRetryCount: 0,
  phaseSubmitting: false,
  showLateWarning: false,
  lateReasonOpen: false, lateReasonText: '', lateReasonSubmitting: false,
  lateAlertDismissedCount: 0,

  // ── Roster and log ──────────────────────────────────────────────────────
  rosterSearch: '', rosterSort: 'name', rosterStatusFilter: 'all',
  rosterExpandedId: null,
  logSearch: '', logStatusFilter: 'all', logNoteSaving: false,
  markingAllAbsent: false, confirmMarkAllAbsent: false,
  markAllPresenting: false, confirmMarkAllPresent: false,
  editingNoteId: null, editingNoteText: '',
  logNoteId: null, logNoteText: '',
  timesEditId: null, timesEditP1: '', timesEditP2: '', timesEditP3: '', timesEditP4: '', timesEditSaving: false, timesEditErrField: null,
  waPreviewOpen: false, waPreviewText: '',

  // ── Batch and cycles ────────────────────────────────────────────────────
  newBatchDate: '',
  batchLoading: false, batchCreating: false,
  batchJumpDate: Utils.dateKey(new Date()),
  editingBatchLabel: false, batchLabelText: '',
  showArchivedBatches: false,
  cyclePickerOpen: false, cyclePickerYear: null, cyclePickerPage: 1,
  broadcastOpen: false, broadcastText: '', broadcastSaving: false,
  noReportBulkOpen: false, noReportBulkText: '',

  // ── Personnel management ─────────────────────────────────────────────────
  peopleTab: 'roster',
  npName: '', npContact: '', npShift: 'OFFICE', npPassword: '', showNpPw: false,
  addPersonnelOpen: false, npReenrollRecord: null, npAddSearch: '', npDeactivatedPool: [],
  confirmDeactivateId: null,
  peopleStats: {}, peopleStatsLoaded: false,
  bulkAddOpen: false, bulkAddText: '', bulkAddParsed: [], bulkAddStep: 'input',
  bulkAddAdding: false, bulkAddPassword: '', showBulkAddPw: false,
  peopleRosterSearch: '',

  // ── Member search and history ────────────────────────────────────────────
  memberSearchOpen: false, memberSearchText: '', memberSearchList: [], memberSearchLoaded: false,
  memberSearchStatus: 'all', memberSearchCycle: 'all', memberSearchSelected: [], memberSearchPage: 1,
  confirmDeleteMemberId: null, deletingMember: false,
  confirmBulkDelete: false, bulkDeleting: false,
  personHistoryId: null, personHistoryRows: [], personHistoryLoading: false,
  personHistoryFilter: 'all', personHistoryPage: 1,
  confirmWipeHistoryId: null, wipingHistory: false,
  resetPwId: null, resetPwNew: '', resetPwSaving: false, showResetPw: false,

  // ── Signup requests ──────────────────────────────────────────────────────
  signupPending: false,
  pendingSignups: [], pendingSignupsLoaded: false,
  approvedSignups: [],
  rejectedSignups: [], rejectedSignupsLoaded: false,
  selectedSignupIds: [],
  signupSearch: '', signupTypeFilter: 'all', signupSearchOpen: false,
  rejectedSignupsHidden: true,

  // ── Leave requests ───────────────────────────────────────────────────────
  leaveOpen: false, leaveDate: '', leaveType: 'mc', leaveReason: '', leaveSubmitting: false,
  leaveHistFilter: 'all',
  myPendingRequests: [],
  myLeaveHistory: [], myLeaveHistoryLoaded: false,
  pendingLeaves: [], pendingLeavesLoaded: false,
  leaveSearch: '', leaveTypeFilter: 'all', leaveSearchOpen: false,
  rejectLeaveId: null, rejectLeaveReason: '',
  approvingLeaveId: null, confirmingDecline: false,
  processedLeaves: [], processedLeavesLoaded: false, processedLeavesHidden: true,
  processedLeavesSearch: '', processedLeavesFilter: 'all', processedLeavesPage: 1,
  leaveSelectedIds: [], confirmBulkLeaveReject: false, bulkLeaveRejectReason: '', bulkApprovingLeaves: false,

  // ── Notes and welfare ────────────────────────────────────────────────────
  welfareNoteOpen: false, welfareNoteText: '', welfareNoteSaving: false,
  missedNoteOpen: false, missedNoteDateKey: null, missedNoteText: '',

  // ── History tab (reservist) ──────────────────────────────────────────────
  historyPage: 1, historyExpandedDates: [], historyLoaded: false,
  briefTab: 'info',

  // ── Avatar lightbox ──────────────────────────────────────────────────────
  avatarLightboxUrl: null,

  // ── Admin management ─────────────────────────────────────────────────────
  adminsList: [], adminsLoaded: false,
  npAdminName: '', npAdminContact: '', npAdminPassword: '', showNpAdminPw: false,
  addAdminOpen: false, confirmDeactivateAdminId: null,
  promoteAdminOpen: false,
  promoteAdminId: '', promoteAdminName: '', promoteAdminContact: '',
  confirmPromoteAdminId: null, promoteSearch: '',
  promoteShowAllCycles: false, promoteListPage: 1,

  // ── Account settings ─────────────────────────────────────────────────────
  accountOpen: false, confirmDelete: false, logoutConfirmOpen: false,
  changePwOpen: false, changeNameOpen: false,
  acctNameEdit: '',
  acctPwCurrent: '', acctPwNew: '', acctPwConfirm: '',
  acctPwError: '', acctPwSuccess: '', capsLock: false,
  acctNameError: '', acctNameSuccess: '',
  acctSaving: false, showAcctPw: false,

});
