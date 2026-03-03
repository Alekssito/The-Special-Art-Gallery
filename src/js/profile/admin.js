export function createAdminDashboardModule({
  supabase,
  showToast,
  getCurrentProfile,
  getCurrentUser,
  getCurrentGalleryId,
  isAdminDashboardView,
  resolveAvatarSrc,
  resolveImageSrc,
  getFileExtension,
  loadCurrentProfile,
  setProfileHeader,
  refreshNavbarProfileButtonAvatar,
  loadData,
  renderPage,
  deleteGallery,
  ui
}) {
  let adminUsers = [];
  let adminGalleries = [];
  let adminDrawings = [];

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function loadAdminData() {
    if (getCurrentProfile()?.is_admin !== true) return;

    const [usersResult, galleriesResult, drawingsResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('user_id, username, searchable, avatar_path, is_admin, created_at')
        .order('created_at', { ascending: true }),
      supabase
        .from('galleries')
        .select('id, user_id, name, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('drawings')
        .select('id, user_id, title, image_data, storage_path, created_at, gallery_id')
        .order('created_at', { ascending: false })
    ]);

    if (usersResult.error) throw usersResult.error;
    if (galleriesResult.error) throw galleriesResult.error;
    if (drawingsResult.error) throw drawingsResult.error;

    adminUsers = await Promise.all((usersResult.data || []).map(async (userItem) => ({
      ...userItem,
      avatarSrc: await resolveAvatarSrc(userItem.avatar_path || '')
    })));
    adminGalleries = galleriesResult.data || [];
    adminDrawings = await Promise.all((drawingsResult.data || []).map(async (drawingItem) => ({
      ...drawingItem,
      imageSrc: await resolveImageSrc(drawingItem)
    })));
  }

  async function saveAdminUserProfile(cardElement) {
    const userId = cardElement?.getAttribute('data-user-id');
    if (!userId) return;

    const usernameInput = cardElement.querySelector('.admin-user-name');
    const searchableToggle = cardElement.querySelector('.admin-user-searchable');
    const adminToggle = cardElement.querySelector('.admin-user-admin');

    const nextUsername = usernameInput?.value?.trim() || '';
    if (!nextUsername) {
      showToast('Invalid Username', 'Username cannot be empty.', 'error');
      return;
    }

    const payload = {
      username: nextUsername,
      searchable: searchableToggle?.checked === true,
      is_admin: adminToggle?.checked === true
    };

    const { error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async function uploadAdminUserAvatar(cardElement) {
    const userId = cardElement?.getAttribute('data-user-id');
    if (!userId) return;

    const fileInput = cardElement.querySelector('.admin-avatar-file');
    const file = fileInput?.files?.[0] || null;

    if (!file) {
      showToast('Select Image', 'Choose a profile image first.', 'info');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showToast('Image Too Large', 'Profile image must be 5MB or smaller.', 'error');
      return;
    }

    const existingUser = adminUsers.find((item) => item.user_id === userId);
    const extension = getFileExtension(file.name);
    const uploadPath = `${userId}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(uploadPath, file, {
        contentType: file.type || 'image/png',
        upsert: false
      });

    if (uploadError) throw uploadError;

    if (existingUser?.avatar_path && existingUser.avatar_path !== uploadPath) {
      await supabase.storage
        .from('profile-pictures')
        .remove([existingUser.avatar_path]);
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_path: uploadPath })
      .eq('user_id', userId);

    if (updateError) throw updateError;
  }

  async function removeAdminUserAvatar(cardElement) {
    const userId = cardElement?.getAttribute('data-user-id');
    if (!userId) return;

    const existingUser = adminUsers.find((item) => item.user_id === userId);
    if (existingUser?.avatar_path) {
      await supabase.storage
        .from('profile-pictures')
        .remove([existingUser.avatar_path]);
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ avatar_path: null })
      .eq('user_id', userId);

    if (error) throw error;
  }

  async function saveAdminGallery(cardElement) {
    const galleryId = cardElement?.getAttribute('data-gallery-id');
    if (!galleryId) return;

    const nameInput = cardElement.querySelector('.admin-gallery-name');
    const nextName = nameInput?.value?.trim() || '';
    if (!nextName) {
      showToast('Invalid Name', 'Gallery name cannot be empty.', 'error');
      return;
    }

    const { error } = await supabase
      .from('galleries')
      .update({ name: nextName })
      .eq('id', galleryId);

    if (error) throw error;
  }

  async function deleteAdminDrawing(drawingId, storagePath) {
    if (!drawingId) return;

    if (storagePath) {
      const { error: storageDeleteError } = await supabase.storage
        .from('drawings')
        .remove([storagePath]);

      if (storageDeleteError) throw storageDeleteError;
    }

    const { error: deleteError } = await supabase
      .from('drawings')
      .delete()
      .eq('id', drawingId);

    if (deleteError) throw deleteError;
  }

  function attachAdminDashboardHandlers() {
    ui.adminUsersList?.querySelectorAll('.btn-admin-save-user').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-admin-user-card]');
        if (!card) return;

        try {
          await saveAdminUserProfile(card);
          await loadCurrentProfile();
          await setProfileHeader();
          await refreshNavbarProfileButtonAvatar();
          await loadAdminData();
          renderAdminDashboard();
          showToast('User Updated', 'User profile and permissions were saved.', 'success');
        } catch (error) {
          showToast('Update Failed', error.message || 'Could not update user.', 'error');
        }
      });
    });

    ui.adminUsersList?.querySelectorAll('.btn-admin-upload-avatar').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-admin-user-card]');
        if (!card) return;

        try {
          await uploadAdminUserAvatar(card);
          await loadCurrentProfile();
          await setProfileHeader();
          await refreshNavbarProfileButtonAvatar();
          await loadAdminData();
          renderAdminDashboard();
          showToast('Avatar Updated', 'Profile picture updated successfully.', 'success');
        } catch (error) {
          showToast('Avatar Update Failed', error.message || 'Could not update profile picture.', 'error');
        }
      });
    });

    ui.adminUsersList?.querySelectorAll('.btn-admin-remove-avatar').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-admin-user-card]');
        if (!card) return;

        try {
          await removeAdminUserAvatar(card);
          await loadCurrentProfile();
          await setProfileHeader();
          await refreshNavbarProfileButtonAvatar();
          await loadAdminData();
          renderAdminDashboard();
          showToast('Avatar Removed', 'Profile picture removed successfully.', 'success');
        } catch (error) {
          showToast('Avatar Remove Failed', error.message || 'Could not remove profile picture.', 'error');
        }
      });
    });

    ui.adminGalleriesList?.querySelectorAll('.btn-admin-save-gallery').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-admin-gallery-card]');
        if (!card) return;

        try {
          await saveAdminGallery(card);
          await loadData();
          await loadAdminData();
          renderPage();
          showToast('Gallery Updated', 'Gallery updated successfully.', 'success');
        } catch (error) {
          showToast('Gallery Update Failed', error.message || 'Could not update gallery.', 'error');
        }
      });
    });

    ui.adminGalleriesList?.querySelectorAll('.btn-admin-delete-gallery').forEach((button) => {
      button.addEventListener('click', async () => {
        const galleryId = button.getAttribute('data-gallery-id');
        if (!galleryId) return;

        const confirmed = window.confirm('Delete this gallery? Drawings will be moved outside the gallery.');
        if (!confirmed) return;

        try {
          await deleteGallery(galleryId);
          await loadAdminData();
          renderAdminDashboard();
        } catch (error) {
          showToast('Gallery Delete Failed', error.message || 'Could not delete gallery.', 'error');
        }
      });
    });

    ui.adminDrawingsList?.querySelectorAll('.btn-admin-delete-drawing').forEach((button) => {
      button.addEventListener('click', async () => {
        const drawingId = button.getAttribute('data-id');
        const storagePath = button.getAttribute('data-storage-path') || '';
        if (!drawingId) return;

        const confirmed = window.confirm('Delete this drawing? This cannot be undone.');
        if (!confirmed) return;

        try {
          await deleteAdminDrawing(drawingId, storagePath);
          await loadData();
          await loadAdminData();
          renderPage();
          showToast('Drawing Deleted', 'Drawing removed successfully.', 'success');
        } catch (error) {
          showToast('Delete Failed', error.message || 'Could not delete drawing.', 'error');
        }
      });
    });
  }

  function renderAdminDashboard() {
    if (!ui.adminDashboardSection || getCurrentProfile()?.is_admin !== true || getCurrentGalleryId() || !isAdminDashboardView) {
      ui.adminDashboardSection?.classList.add('d-none');
      return;
    }

    ui.adminDashboardSection.classList.remove('d-none');

    if (ui.adminUsersCount) ui.adminUsersCount.textContent = String(adminUsers.length);
    if (ui.adminGalleriesCount) ui.adminGalleriesCount.textContent = String(adminGalleries.length);
    if (ui.adminDrawingsCount) ui.adminDrawingsCount.textContent = String(adminDrawings.length);

    if (ui.adminUsersList) {
      ui.adminUsersList.innerHTML = adminUsers.length
        ? adminUsers.map((userItem) => `
          <div class="col-12 col-xl-6" data-admin-user-card data-user-id="${userItem.user_id}">
            <div class="card h-100 border-0 bg-light">
              <div class="card-body">
                <div class="d-flex align-items-center gap-3 mb-3">
                  ${userItem.avatarSrc
                    ? `<img src="${userItem.avatarSrc}" alt="${escapeHtml(userItem.username)} profile picture" class="admin-user-avatar">`
                    : '<i class="bi bi-person-circle" style="font-size: 3rem; color: #a61e2f;"></i>'}
                  <div class="flex-grow-1">
                    <label class="form-label small mb-1">Username</label>
                    <input type="text" class="form-control form-control-sm admin-user-name" value="${escapeHtml(userItem.username)}" maxlength="50">
                  </div>
                </div>
                <div class="d-flex flex-wrap gap-3 mb-3">
                  <div class="form-check form-switch">
                    <input class="form-check-input admin-user-searchable" type="checkbox" ${userItem.searchable ? 'checked' : ''}>
                    <label class="form-check-label small">Public Search</label>
                  </div>
                  <div class="form-check form-switch">
                    <input class="form-check-input admin-user-admin" type="checkbox" ${userItem.is_admin ? 'checked' : ''}>
                    <label class="form-check-label small">Admin Access</label>
                  </div>
                </div>
                <div class="mb-2">
                  <input type="file" class="form-control form-control-sm admin-avatar-file" accept="image/*">
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <button type="button" class="btn btn-sm btn-primary-custom btn-admin-save-user"><i class="bi bi-check2-circle me-1"></i>Save User</button>
                  <button type="button" class="btn btn-sm btn-outline-primary btn-admin-upload-avatar"><i class="bi bi-upload me-1"></i>Update Picture</button>
                  <button type="button" class="btn btn-sm btn-outline-danger btn-admin-remove-avatar"><i class="bi bi-trash3 me-1"></i>Remove Picture</button>
                </div>
              </div>
            </div>
          </div>
        `).join('')
        : '<div class="col-12"><div class="alert alert-info mb-0">No users found.</div></div>';
    }

    if (ui.adminGalleriesList) {
      ui.adminGalleriesList.innerHTML = adminGalleries.length
        ? adminGalleries.map((gallery) => {
          const owner = adminUsers.find((item) => item.user_id === gallery.user_id);
          return `
            <div class="col-12 col-lg-6" data-admin-gallery-card data-gallery-id="${gallery.id}">
              <div class="card h-100 border-0 bg-light">
                <div class="card-body">
                  <label class="form-label small mb-1">Gallery Name</label>
                  <input type="text" class="form-control form-control-sm admin-gallery-name mb-2" value="${escapeHtml(gallery.name)}" maxlength="80">
                  <p class="small text-muted mb-3">Owner: ${escapeHtml(owner?.username || gallery.user_id)}</p>
                  <div class="d-flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-sm btn-primary-custom btn-admin-save-gallery"><i class="bi bi-check2-circle me-1"></i>Save</button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-admin-delete-gallery" data-gallery-id="${gallery.id}"><i class="bi bi-trash me-1"></i>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')
        : '<div class="col-12"><div class="alert alert-info mb-0">No galleries found.</div></div>';
    }

    if (ui.adminDrawingsList) {
      ui.adminDrawingsList.innerHTML = adminDrawings.length
        ? adminDrawings.map((drawingItem) => {
          const owner = adminUsers.find((item) => item.user_id === drawingItem.user_id);
          return `
            <div class="col-12 col-md-6 col-xl-4">
              <div class="card h-100 card-custom">
                <img src="${drawingItem.imageSrc}" class="card-img-top profile-drawing-image" alt="Drawing preview">
                <div class="card-body d-flex flex-column">
                  <p class="small text-muted mb-2">Owner: ${escapeHtml(owner?.username || drawingItem.user_id)}</p>
                  <p class="small text-muted mb-3">Saved: ${new Date(drawingItem.created_at).toLocaleString()}</p>
                  <div class="mt-auto d-flex gap-2 flex-wrap">
                    <a href="/draw.html?edit=${drawingItem.id}" class="btn btn-sm btn-primary-custom flex-grow-1">
                      <i class="bi bi-pencil-square me-1"></i> Edit
                    </a>
                    <button class="btn btn-sm btn-outline-danger flex-grow-1 btn-admin-delete-drawing" data-id="${drawingItem.id}" data-storage-path="${drawingItem.storage_path || ''}">
                      <i class="bi bi-trash me-1"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')
        : '<div class="col-12"><div class="alert alert-info mb-0">No drawings found.</div></div>';
    }

    attachAdminDashboardHandlers();
  }

  return {
    loadAdminData,
    renderAdminDashboard
  };
}
