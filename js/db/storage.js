const DB_Storage = {
  async uploadAvatar(userId, file) {
    const ext = (file.name||'').split('.').pop().toLowerCase();
    const contentType = file.type || (ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg');
    const { data, error } = await _db.storage.from('avatars').upload(userId, file, { upsert: true, contentType });
    return { path: data?.path || userId, error };
  },

  getAvatarUrl(userId) {
    const { data } = _db.storage.from('avatars').getPublicUrl(userId);
    return data?.publicUrl || null;
  },

  async deleteAvatar(userId) {
    const { error } = await _db.storage.from('avatars').remove([userId]);
    return { error };
  },

  getAvatarUrls(ids) {
    const result = {};
    for(const id of ids){
      const { data } = _db.storage.from('avatars').getPublicUrl(id);
      if(data?.publicUrl) result[id] = data.publicUrl;
    }
    return result;
  },

  async listAvatarIds() {
    const { data } = await _db.storage.from('avatars').list();
    return new Set((data || []).map(f => f.name));
  },
};
