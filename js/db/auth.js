const DB_Auth = {
  _email: c => c.replace(/[\s-]/g,'') + '@opsreservist.mil',

  async login(contact, password) {
    const { data, error } = await _db.auth.signInWithPassword({ email: this._email(contact), password });
    return { user: data?.user || null, error };
  },

  async signup(contact, password, name) {
    const { data, error } = await _db.auth.signUp({ email: this._email(contact), password,
      options: { data: name ? { display_name: name } : undefined } });
    return { user: data?.user || null, error };
  },

  async syncDisplayName(name) {
    const { data } = await _db.auth.getUser();
    if(!data?.user) return;
    if(data.user.user_metadata?.display_name === name) return;
    await _db.auth.updateUser({ data: { display_name: name } });
  },

  async logout() { await _db.auth.signOut({ scope: 'local' }).catch(()=>{}); },

  async updatePassword(newPassword) {
    const { error } = await _db.auth.updateUser({ password: newPassword });
    return { error };
  },

  async session() {
    const { data } = await _db.auth.getSession();
    return data?.session?.user || null;
  },

  async refreshSession() {
    const { data, error } = await _db.auth.refreshSession();
    return { session: data?.session || null, error };
  },

  async deleteUser(userId) {
    const { error } = await _db.rpc('delete_auth_user', { p_user_id: userId });
    return { error };
  },

  async adminResetPassword(authId, newPassword) {
    const { error } = await _db.rpc('admin_reset_password', { p_user_id: authId, p_new_password: newPassword });
    return { data: !error, error };
  },

  async createUserAsAdmin(contact, password, name) {
    const { data: sd } = await _db.auth.getSession();
    const session = sd?.session;
    const result = await this.signup(contact, password, name);
    if (session) {
      try { await _db.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      catch { await _db.auth.refreshSession().catch(()=>{}); }
    }
    return result;
  },
};
