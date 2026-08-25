// ── Admin account management handlers ─────────────────────────────────────
const AdminMgmtHandlers = {

  openAvatarLightbox:  function(url) { return () => this.setState({avatarLightboxUrl:url}); },
  closeAvatarLightbox: function() { this.setState({avatarLightboxUrl:null}); },

  loadAdmins: async function() {
    const dept=this._myDept();
    const data=await DB.personnel.listAdmins(dept).catch(()=>[]);
    this.setState({adminsList:data,adminsLoaded:true});
  },

  onNpAdminName:     function(e) { this.setState({npAdminName:e.target.value}); },
  onNpAdminContact:  function(e) { this.setState({npAdminContact:e.target.value}); },
  onNpAdminPassword: function(e) { this.setState({npAdminPassword:e.target.value}); },

  toggleAddAdmin: function() {
    this.setState(s=>({addAdminOpen:!s.addAdminOpen,npAdminName:'',npAdminContact:'',npAdminPassword:'',showNpAdminPw:false}));
  },
  togglePromoteAdmin: function() {
    this.setState(s=>({promoteAdminOpen:!s.promoteAdminOpen,promoteAdminId:'',promoteAdminName:'',promoteAdminContact:'',confirmPromoteAdminId:null,promoteSearch:'',promoteListPage:1}));
  },

  addAdmin: async function() {
    const {npAdminName,npAdminContact,npAdminPassword,adminsList,demo,isSuperAdmin}=this.state;
    if(!demo&&!isSuperAdmin){this._toast('Access denied.','error');return;}
    if(!npAdminName.trim()){this._toast('Name is required.','error');return;}
    const {clean:cleanContact,error:contactErr}=Utils.validateSGContact(npAdminContact);
    if(contactErr){this._toast(contactErr,'error');return;}
    if(adminsList.some(a=>a.contact?.replace(/[\s-]/g,'')===cleanContact)){this._toast('This contact is already an admin.','error');return;}
    if(!npAdminPassword||npAdminPassword.length<6){this._toast('Password must be at least 6 characters.','error');return;}
    if(!demo){
      const existing=await DB.personnel.findByContact(cleanContact).catch(()=>null);
      if(existing){this._toast('This contact is already registered.','error');return;}
      const {user,error}=await DB.auth.createUserAsAdmin(cleanContact,npAdminPassword,npAdminName.trim());
      if(error||!user){this._toast('Failed to create account. Try again.','error');return;}
      const {error:addErr}=await DB.personnel.add({authId:user.id,name:npAdminName.trim(),contact:cleanContact,shift:null,batchId:null,role:'admin',department:this._myDept()});
      if(addErr){await DB.auth.deleteUser(user.id).catch(()=>{});this._toast('Failed to add admin to roster. Try again.','error');return;}
      await this.loadAdmins();
    } else {
      this.setState(s=>({adminsList:[...s.adminsList,{id:'demo-admin-'+Date.now(),name:npAdminName.trim(),contact:cleanContact,role:'admin'}]}));
    }
    this.setState({npAdminName:'',npAdminContact:'',npAdminPassword:'',addAdminOpen:false,showNpAdminPw:false});
    this._toast(npAdminName.trim()+' added as admin.');
  },

  askDeactivateAdmin:    function(id) { return () => this.setState({confirmDeactivateAdminId:id}); },
  cancelDeactivateAdmin: function() { this.setState({confirmDeactivateAdminId:null}); },

  confirmDeactivateAdmin: async function() {
    const id=this.state.confirmDeactivateAdminId;
    if(!id) return;
    if(!this.state.demo&&!this.state.isSuperAdmin){this._toast('Access denied.','error');this.setState({confirmDeactivateAdminId:null});return;}
    const admin=(this.state.adminsList||[]).find(a=>a.id===id);
    this.setState({confirmDeactivateAdminId:null});
    if(!this.state.demo){
      const {error}=await DB.personnel.demoteToReservist(id).catch(e=>({error:e}));
      if(error){this._toast('Failed to remove admin. Try again.','error');return;}
    }
    this.setState(s=>({adminsList:s.adminsList.filter(a=>a.id!==id),personnel:admin?[...s.personnel,{...admin,role:'reservist',batch_id:null,shift:null}]:s.personnel}));
    this._toast((admin?.name||'Admin')+' removed and returned to reservist pool.');
  },

  onPromoteAdminId:       function(e) { this.setState({promoteAdminId:e.target.value,confirmPromoteAdminId:null}); },
  onPromoteSearch:        function(e) { this.setState({promoteSearch:e.target.value,promoteAdminId:'',promoteAdminName:'',promoteAdminContact:'',confirmPromoteAdminId:null,promoteListPage:1}); },
  onPromoteSearchKeyDown: function(e) { if(e.key==='Enter') e.target.blur(); },
  togglePromoteShowAll:   function() { this.setState(s=>({promoteShowAllCycles:!s.promoteShowAllCycles,promoteAdminId:'',promoteAdminName:'',promoteAdminContact:'',confirmPromoteAdminId:null,promoteSearch:'',promoteListPage:1})); },
  setPromoteCurrentCycle: function() { if(this.state.promoteShowAllCycles) this.setState({promoteShowAllCycles:false,promoteAdminId:'',promoteAdminName:'',promoteAdminContact:'',confirmPromoteAdminId:null,promoteSearch:'',promoteListPage:1}); },
  setPromoteAllCycles:    function() { if(!this.state.promoteShowAllCycles) this.setState({promoteShowAllCycles:true,promoteAdminId:'',promoteAdminName:'',promoteAdminContact:'',confirmPromoteAdminId:null,promoteSearch:'',promoteListPage:1}); },
  clearPromoteSelection:  function() { this.setState({promoteAdminId:'',promoteAdminName:'',promoteAdminContact:'',confirmPromoteAdminId:null,promoteSearch:''}); },
  promoteNextPage: function() { this.setState(s=>({promoteListPage:(s.promoteListPage||1)+1})); },
  promotePrevPage: function() { this.setState(s=>({promoteListPage:Math.max(1,(s.promoteListPage||1)-1)})); },

  askPromoteAdmin: function() {
    if(!this.state.promoteAdminId){this._toast('Select a person to promote.','error');return;}
    this.setState({confirmPromoteAdminId:this.state.promoteAdminId});
  },
  cancelPromoteAdmin: function() { this.setState({confirmPromoteAdminId:null}); },

  confirmPromoteAdmin: async function() {
    const {confirmPromoteAdminId,personnel,demo,isSuperAdmin}=this.state;
    if(!confirmPromoteAdminId) return;
    if(!demo&&!isSuperAdmin){this._toast('Access denied.','error');this.setState({confirmPromoteAdminId:null});return;}
    const person=personnel.find(p=>p.id===confirmPromoteAdminId);
    if(!person) return;
    this.setState({confirmPromoteAdminId:null,promoteAdminId:'',promoteAdminName:'',promoteAdminContact:'',promoteSearch:''});
    if(!demo){
      const {error}=await DB.personnel.promoteToAdmin(confirmPromoteAdminId).catch(e=>({error:e}));
      if(error){this._toast('Failed to promote. Try again.','error');return;}
    }
    this.setState(s=>({personnel:s.personnel.filter(p=>p.id!==confirmPromoteAdminId),promoteAdminOpen:false}));
    await this.loadAdmins();
    this._toast(person.name+' promoted to admin.');
  },

};
