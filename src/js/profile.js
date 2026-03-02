import { getCurrentUser } from './auth.js';
import { showToast } from './main.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

document.addEventListener('DOMContentLoaded', async () => {
  const subtitle = document.getElementById('profileSubtitle');
  const drawingsContainer = document.getElementById('profileDrawings');
  const profileUsername = document.getElementById('profileUsername');
  const profileTitleText = document.getElementById('profileTitleText');
  const profileTitleAvatar = document.getElementById('profileTitleAvatar');
  const profileTitleAvatarFallback = document.getElementById('profileTitleAvatarFallback');
  const editProfileButton = document.getElementById('btnEditProfile');
  const privacyToggle = document.getElementById('privacyToggle');
  const shareUserSearch = document.getElementById('shareUserSearch');
  const searchUsersButton = document.getElementById('btnSearchUsers');
  const shareSearchResults = document.getElementById('shareSearchResults');
  const galleriesContainer = document.getElementById('profileGalleries');
  const galleriesSection = document.getElementById('galleriesSection');
  const createGalleryButton = document.getElementById('btnCreateGallery');
  const backToProfileButton = document.getElementById('btnBackToProfile');
  const galleryModalElement = document.getElementById('galleryModal');
  const galleryModalTitle = document.getElementById('galleryModalLabel');
  const galleryIdInput = document.getElementById('galleryIdInput');
  const galleryNameInput = document.getElementById('galleryNameInput');
  const galleryDrawingSelection = document.getElementById('galleryDrawingSelection');
  const saveGalleryButton = document.getElementById('btnSaveGallery');
  const deleteGalleryModalElement = document.getElementById('deleteGalleryModal');
  const confirmDeleteGalleryButton = document.getElementById('btnConfirmDeleteGallery');
  const shareGalleryModalElement = document.getElementById('shareGalleryModal');
  const shareTargetUserId = document.getElementById('shareTargetUserId');
  const shareTargetUsername = document.getElementById('shareTargetUsername');
  const shareGallerySelection = document.getElementById('shareGallerySelection');
  const saveShareSelectionButton = document.getElementById('btnSaveShareSelection');
  const editProfileModalElement = document.getElementById('editProfileModal');
  const editProfileUsernameInput = document.getElementById('editProfileUsername');
  const editProfileAvatarFileInput = document.getElementById('editProfileAvatarFile');
  const editProfileAvatarPreview = document.getElementById('editProfileAvatarPreview');
  const editProfileAvatarFallback = document.getElementById('editProfileAvatarFallback');
  const removeProfilePictureButton = document.getElementById('btnRemoveProfilePicture');
  const saveProfileButton = document.getElementById('btnSaveProfile');

  let galleryModal = null;
  let deleteGalleryModal = null;
  let shareGalleryModal = null;
  let editProfileModal = null;
  let currentUser = null;
  let currentProfile = null;
  let drawings = [];
  let galleries = [];
  let ownedGalleries = [];
  let userSearchItems = [];
  const imageSrcCache = new Map();
  const avatarSrcCache = new Map();
  const searchParams = new URLSearchParams(window.location.search);
  const currentGalleryId = searchParams.get('gallery');
  let removeAvatarRequested = false;

  if (!subtitle || !drawingsContainer) return;

  if (!isSupabaseConfigured || !supabase) {
    subtitle.textContent = 'Supabase is not configured in this environment.';
    return;
  }

  currentUser = await getCurrentUser();
  if (!currentUser) {
    showToast('Login Required', 'Please log in to view your profile.', 'info');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 900);
    return;
  }

  if (galleryModalElement) {
    galleryModal = bootstrap.Modal.getOrCreateInstance(galleryModalElement);

    galleryModalElement.addEventListener('hidden.bs.modal', () => {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('padding-right');
      document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
    });
  }

  if (deleteGalleryModalElement) {
    deleteGalleryModal = bootstrap.Modal.getOrCreateInstance(deleteGalleryModalElement);
  }

  if (shareGalleryModalElement) {
    shareGalleryModal = bootstrap.Modal.getOrCreateInstance(shareGalleryModalElement);
  }

  if (editProfileModalElement) {
    editProfileModal = bootstrap.Modal.getOrCreateInstance(editProfileModalElement);
  }

  function getAvatarFallbackMarkup() {
    return '<i class="bi bi-person-circle me-2"></i>';
  }

  function getFileExtension(fileName) {
    const parts = fileName.split('.');
    if (parts.length < 2) return 'png';
    return parts.pop().toLowerCase();
  }

  async function resolveAvatarSrc(avatarPath) {
    if (!avatarPath) return '';
    if (avatarSrcCache.has(avatarPath)) {
      return avatarSrcCache.get(avatarPath);
    }

    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .createSignedUrl(avatarPath, 60 * 10);

    if (error || !data?.signedUrl) {
      avatarSrcCache.set(avatarPath, '');
      return '';
    }

    avatarSrcCache.set(avatarPath, data.signedUrl);
    return data.signedUrl;
  }

  async function renderProfileTitleAvatar() {
    if (!profileTitleAvatar || !profileTitleAvatarFallback) return;

    const avatarSrc = await resolveAvatarSrc(currentProfile?.avatar_path || '');
    if (avatarSrc) {
      profileTitleAvatar.src = avatarSrc;
      profileTitleAvatar.classList.remove('d-none');
      profileTitleAvatarFallback.classList.add('d-none');
      return;
    }

    profileTitleAvatar.removeAttribute('src');
    profileTitleAvatar.classList.add('d-none');
    profileTitleAvatarFallback.classList.remove('d-none');
  }

  async function setEditProfilePreviewFromPath(avatarPath) {
    if (!editProfileAvatarPreview || !editProfileAvatarFallback) return;

    const avatarSrc = await resolveAvatarSrc(avatarPath || '');
    if (avatarSrc) {
      editProfileAvatarPreview.src = avatarSrc;
      editProfileAvatarPreview.classList.remove('d-none');
      editProfileAvatarFallback.classList.add('d-none');
      return;
    }

    editProfileAvatarPreview.removeAttribute('src');
    editProfileAvatarPreview.classList.add('d-none');
    editProfileAvatarFallback.classList.remove('d-none');
  }

  async function refreshNavbarProfileButtonAvatar() {
    const accountLinks = document.querySelectorAll('a[href="/profile.html"]');
    if (!accountLinks.length) return;

    const displayUsername = currentProfile?.username?.trim() || getFallbackUsername();
    const avatarSrc = await resolveAvatarSrc(currentProfile?.avatar_path || '');

    accountLinks.forEach((link) => {
      if (!link.classList.contains('btn-accent')) return;
      link.innerHTML = avatarSrc
        ? `<img src="${avatarSrc}" alt="Profile picture" class="profile-nav-avatar me-2"> My Profile`
        : '<i class="bi bi-person-circle me-2"></i> My Profile';
    });

    const guestBadge = document.querySelector('.navbar .badge');
    if (guestBadge) {
      guestBadge.innerHTML = `<i class="bi bi-person-check"></i> User Mode • ${displayUsername}`;
    }
  }

  function getFallbackUsername() {
    const usernameFromMetadata = currentUser.user_metadata?.username?.trim();
    const emailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'artist';
    return usernameFromMetadata || emailPrefix;
  }

  async function loadCurrentProfile() {
    const fallbackUsername = getFallbackUsername();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, username, searchable, avatar_path')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      currentProfile = data;
    } else {
      const { data: insertedProfile, error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: currentUser.id,
          username: fallbackUsername,
          searchable: true,
          avatar_path: null
        }, { onConflict: 'user_id' })
        .select('user_id, username, searchable, avatar_path')
        .single();

      if (upsertError) throw upsertError;
      currentProfile = insertedProfile;
    }

    if (privacyToggle) {
      privacyToggle.checked = currentProfile.searchable !== false;
    }
  }

  async function setProfileHeader() {
    const displayUsername = currentProfile?.username?.trim() || getFallbackUsername();
    if (profileUsername) {
      profileUsername.textContent = `• ${displayUsername}`;
    }

    await renderProfileTitleAvatar();
  }

  function getSelectedGallery() {
    if (!currentGalleryId) return null;
    return galleries.find((gallery) => gallery.id === currentGalleryId) || null;
  }

  async function resolveImageSrc(drawing) {
    if (imageSrcCache.has(drawing.id)) {
      return imageSrcCache.get(drawing.id);
    }

    let imageSrc = drawing.image_data || '';
    if (drawing.storage_path) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('drawings')
        .createSignedUrl(drawing.storage_path, 60 * 10);

      if (!signedError && signedData?.signedUrl) {
        imageSrc = signedData.signedUrl;
      }
    }

    imageSrcCache.set(drawing.id, imageSrc);
    return imageSrc;
  }

  function getDefaultGalleryName() {
    return `Gallery ${ownedGalleries.length + 1}`;
  }

  function buildGallerySelectionOptions(selectedDrawingIds = []) {
    if (!galleryDrawingSelection) return;

    const ownDrawings = drawings.filter((drawing) => drawing.user_id === currentUser.id);

    if (!ownDrawings.length) {
      galleryDrawingSelection.innerHTML = '<p class="text-muted mb-0">No drawings available yet.</p>';
      return;
    }

    galleryDrawingSelection.innerHTML = ownDrawings.map((drawing) => {
      const isChecked = selectedDrawingIds.includes(drawing.id);
      return `
        <label class="gallery-drawing-option mb-2 w-100">
          <input class="form-check-input mt-0" type="checkbox" value="${drawing.id}" ${isChecked ? 'checked' : ''}>
          <img src="${drawing.imageSrc}" alt="Drawing preview" class="gallery-drawing-thumb">
          <span class="small text-muted">${new Date(drawing.created_at).toLocaleString()}</span>
        </label>
      `;
    }).join('');
  }

  function openCreateGalleryModal() {
    if (!galleryModal) return;
    if (galleryModalTitle) galleryModalTitle.textContent = 'Create Gallery';
    if (galleryIdInput) galleryIdInput.value = '';
    if (galleryNameInput) galleryNameInput.value = '';
    buildGallerySelectionOptions([]);
    galleryModal.show();
  }

  function openEditGalleryModal(galleryId) {
    if (!galleryModal || !galleryId) return;

    const gallery = galleries.find((item) => item.id === galleryId);
    if (!gallery || gallery.user_id !== currentUser.id) return;

    if (galleryModalTitle) galleryModalTitle.textContent = 'Edit Gallery';
    if (galleryIdInput) galleryIdInput.value = galleryId;
    if (galleryNameInput) galleryNameInput.value = gallery.name || '';
    const selectedIds = drawings
      .filter((drawing) => drawing.gallery_id === galleryId)
      .map((drawing) => drawing.id);
    buildGallerySelectionOptions(selectedIds);
    galleryModal.show();
  }

  async function loadData() {
    const [{ data: drawingsData, error: drawingsError }, { data: galleriesData, error: galleriesError }] = await Promise.all([
      supabase
        .from('drawings')
        .select('id, user_id, title, image_data, storage_path, created_at, gallery_id')
        .order('created_at', { ascending: false }),
      supabase
        .from('galleries')
        .select('id, user_id, name, created_at')
        .order('created_at', { ascending: true })
    ]);

    if (drawingsError) throw drawingsError;
    if (galleriesError) throw galleriesError;

    drawings = await Promise.all(
      (drawingsData || []).map(async (drawing) => ({
        ...drawing,
        imageSrc: await resolveImageSrc(drawing)
      }))
    );

    galleries = galleriesData || [];
    ownedGalleries = galleries.filter((gallery) => gallery.user_id === currentUser.id);
  }

  async function saveGallery() {
    if (!galleryDrawingSelection) return;

    const editingGalleryId = galleryIdInput?.value?.trim() || null;
    const inputName = galleryNameInput?.value?.trim() || '';
    const selectedDrawingIds = Array.from(
      galleryDrawingSelection.querySelectorAll('input[type="checkbox"]:checked')
    ).map((checkbox) => checkbox.value);

    try {
      let galleryId = editingGalleryId;
      let galleryName = inputName;

      if (!galleryId) {
        if (!galleryName) {
          galleryName = getDefaultGalleryName();
        }

        const { data: newGallery, error: insertError } = await supabase
          .from('galleries')
          .insert({
            user_id: currentUser.id,
            name: galleryName
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        galleryId = newGallery.id;
      } else {
        const editedGallery = galleries.find((gallery) => gallery.id === galleryId);
        if (!editedGallery || editedGallery.user_id !== currentUser.id) {
          throw new Error('You can only edit your own galleries.');
        }

        if (!galleryName) {
          const currentGallery = galleries.find((item) => item.id === galleryId);
          galleryName = currentGallery?.name || getDefaultGalleryName();
        }

        const { error: updateGalleryError } = await supabase
          .from('galleries')
          .update({ name: galleryName })
          .eq('id', galleryId);

        if (updateGalleryError) throw updateGalleryError;

        const { error: clearError } = await supabase
          .from('drawings')
          .update({ gallery_id: null })
          .eq('gallery_id', galleryId);

        if (clearError) throw clearError;
      }

      if (selectedDrawingIds.length) {
        const { error: assignError } = await supabase
          .from('drawings')
          .update({ gallery_id: galleryId })
          .in('id', selectedDrawingIds);

        if (assignError) throw assignError;
      }

      galleryModal?.hide();
      showToast('Gallery Saved', 'Gallery details updated successfully.', 'success');
      await loadData();
      renderPage();
    } catch (error) {
      showToast('Gallery Save Failed', error.message || 'Could not save gallery.', 'error');
    }
  }

  function confirmGalleryDelete() {
    return new Promise((resolve) => {
      if (!deleteGalleryModal || !deleteGalleryModalElement || !confirmDeleteGalleryButton) {
        resolve(false);
        return;
      }

      const handleConfirm = () => {
        cleanup();
        deleteGalleryModal.hide();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        confirmDeleteGalleryButton.removeEventListener('click', handleConfirm);
        deleteGalleryModalElement.removeEventListener('hidden.bs.modal', handleCancel);
      };

      confirmDeleteGalleryButton.addEventListener('click', handleConfirm);
      deleteGalleryModalElement.addEventListener('hidden.bs.modal', handleCancel, { once: true });
      deleteGalleryModal.show();
    });
  }

  async function deleteGallery(galleryId) {
    const targetGallery = galleries.find((gallery) => gallery.id === galleryId);
    if (!targetGallery || targetGallery.user_id !== currentUser.id) {
      showToast('Access Denied', 'You can only delete your own galleries.', 'error');
      return;
    }

    const confirmed = await confirmGalleryDelete();
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('galleries')
        .delete()
        .eq('id', galleryId);

      if (error) throw error;

      showToast('Gallery Deleted', 'Gallery removed successfully.', 'success');
      await loadData();

      if (currentGalleryId === galleryId) {
        window.location.href = '/profile.html';
        return;
      }

      renderPage();
    } catch (error) {
      showToast('Delete Failed', error.message || 'Could not delete gallery.', 'error');
    }
  }

  function renderGalleries() {
    if (!galleriesContainer) return;

    if (!galleries.length) {
      galleriesContainer.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info mb-0" role="alert">
            You have no galleries yet. Click Create Gallery to organize your drawings.
          </div>
        </div>
      `;
      return;
    }

    galleriesContainer.innerHTML = galleries.map((gallery) => {
      const isSharedGallery = gallery.user_id !== currentUser.id;
      const drawingsCount = drawings.filter((drawing) => drawing.gallery_id === gallery.id).length;
      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card card-custom h-100">
            <div class="card-body d-flex flex-column">
              <h3 class="h6 fw-bold mb-2">
                <i class="bi bi-folder2-open me-2"></i>${gallery.name}
                ${isSharedGallery ? '<span class="badge bg-info-subtle text-info-emphasis ms-2">Shared</span>' : ''}
              </h3>
              <p class="text-muted small mb-3">${drawingsCount} drawing${drawingsCount === 1 ? '' : 's'}</p>
              <div class="mt-auto d-flex gap-2 flex-wrap">
                <a class="btn btn-sm btn-primary-custom flex-grow-1" href="/profile.html?gallery=${gallery.id}">
                  <i class="bi bi-box-arrow-in-right me-1"></i> Enter
                </a>
                ${isSharedGallery ? `
                <button class="btn btn-sm btn-outline-secondary flex-grow-1" disabled>
                  <i class="bi bi-eye me-1"></i> View Only
                </button>
                ` : `
                <button class="btn btn-sm btn-outline-secondary flex-grow-1 btn-edit-gallery" data-gallery-id="${gallery.id}">
                  <i class="bi bi-pencil me-1"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger flex-grow-1 btn-delete-gallery" data-gallery-id="${gallery.id}">
                  <i class="bi bi-trash me-1"></i> Delete
                </button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    galleriesContainer.querySelectorAll('.btn-edit-gallery').forEach((button) => {
      button.addEventListener('click', () => {
        const galleryId = button.getAttribute('data-gallery-id');
        openEditGalleryModal(galleryId);
      });
    });

    galleriesContainer.querySelectorAll('.btn-delete-gallery').forEach((button) => {
      button.addEventListener('click', async () => {
        const galleryId = button.getAttribute('data-gallery-id');
        if (!galleryId) return;
        await deleteGallery(galleryId);
      });
    });
  }

  function renderDrawings() {
    const selectedGallery = getSelectedGallery();
    const isSharedGalleryView = selectedGallery && selectedGallery.user_id !== currentUser.id;
    const visibleDrawings = currentGalleryId
      ? drawings.filter((drawing) => drawing.gallery_id === currentGalleryId)
      : drawings.filter((drawing) => !drawing.gallery_id);

    if (!visibleDrawings.length) {
      drawingsContainer.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info mb-0" role="alert">
            ${currentGalleryId
              ? (isSharedGalleryView
                ? 'This shared gallery is empty.'
                : 'This gallery is empty. Edit the gallery to add drawings.')
              : 'You have no drawings outside galleries yet. Go to the canvas and click Save.'}
          </div>
        </div>
      `;
      return;
    }

    drawingsContainer.innerHTML = visibleDrawings
      .map((drawing) => {
        const createdAt = new Date(drawing.created_at).toLocaleString();
        const isOwnDrawing = drawing.user_id === currentUser.id;
        const canManageDrawing = isOwnDrawing && !isSharedGalleryView;
        return `
          <div class="col-12 col-md-6 col-xl-4">
            <div class="card h-100 card-custom">
              <img src="${drawing.imageSrc}" class="card-img-top profile-drawing-image" alt="Saved drawing">
              <div class="card-body d-flex flex-column">
                <p class="text-muted small mb-3">Saved: ${createdAt}</p>
                <div class="mt-auto d-flex gap-2 flex-wrap">
                  <a href="${drawing.imageSrc}" download="drawing-${drawing.id}.png" class="btn btn-sm btn-secondary-custom flex-grow-1">
                    <i class="bi bi-download me-1"></i> Download
                  </a>
                  ${canManageDrawing ? `
                  <a href="/draw.html?edit=${drawing.id}" class="btn btn-sm btn-primary-custom flex-grow-1">
                    <i class="bi bi-pencil-square me-1"></i> Edit
                  </a>
                  <button class="btn btn-sm btn-outline-danger flex-grow-1 btn-delete-drawing" data-id="${drawing.id}" data-storage-path="${drawing.storage_path || ''}">
                    <i class="bi bi-trash me-1"></i> Delete
                  </button>
                  ` : `
                  <button class="btn btn-sm btn-outline-secondary flex-grow-1" disabled>
                    <i class="bi bi-eye me-1"></i> Shared • View Only
                  </button>
                  `}
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    drawingsContainer.querySelectorAll('.btn-delete-drawing').forEach((button) => {
      button.addEventListener('click', async () => {
        const drawingId = button.getAttribute('data-id');
        const storagePath = button.getAttribute('data-storage-path');

        if (!drawingId) return;

        const confirmed = window.confirm('Delete this drawing? This cannot be undone.');
        if (!confirmed) return;

        try {
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

          showToast('Deleted', 'Drawing deleted successfully.', 'success');
          await loadData();
          renderPage();
        } catch (deleteError) {
          showToast('Delete Failed', deleteError.message || 'Could not delete drawing.', 'error');
        }
      });
    });
  }

  function renderUserSearchResults() {
    if (!shareSearchResults) return;

    if (!ownedGalleries.length) {
      shareSearchResults.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info mb-0" role="alert">
            Create at least one gallery to share with other users.
          </div>
        </div>
      `;
      return;
    }

    if (!userSearchItems.length) {
      shareSearchResults.innerHTML = `
        <div class="col-12">
          <p class="text-muted small mb-0">Search by username to find users and share your galleries.</p>
        </div>
      `;
      return;
    }

    shareSearchResults.innerHTML = userSearchItems.map((item) => `
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card h-100 card-custom">
          <div class="card-body d-flex flex-column">
            <h3 class="h6 fw-bold mb-3 d-flex align-items-center gap-2">
              ${item.avatarSrc
                ? `<img src="${item.avatarSrc}" alt="${item.username} profile picture" class="user-search-avatar">`
                : '<i class="bi bi-person-circle"></i>'}
              <span>${item.username}</span>
            </h3>
            <button type="button" class="btn btn-sm btn-primary-custom mt-auto btn-open-share-modal" data-user-id="${item.user_id}" data-username="${item.username}">
              <i class="bi bi-share me-1"></i> Share Galleries
            </button>
          </div>
        </div>
      </div>
    `).join('');

    shareSearchResults.querySelectorAll('.btn-open-share-modal').forEach((button) => {
      button.addEventListener('click', async () => {
        const targetUserId = button.getAttribute('data-user-id');
        const targetUsername = button.getAttribute('data-username') || 'user';
        if (!targetUserId) return;
        await openShareModal(targetUserId, targetUsername);
      });
    });
  }

  async function runUserSearch() {
    const rawTerm = shareUserSearch?.value?.trim() || '';

    if (rawTerm.length < 2) {
      userSearchItems = [];
      renderUserSearchResults();
      showToast('Search', 'Type at least 2 characters to search users.', 'info');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, username, avatar_path')
        .ilike('username', `%${rawTerm}%`)
        .neq('user_id', currentUser.id)
        .eq('searchable', true)
        .order('username', { ascending: true })
        .limit(12);

      if (error) throw error;

      userSearchItems = await Promise.all(
        (data || []).map(async (item) => ({
          ...item,
          avatarSrc: await resolveAvatarSrc(item.avatar_path)
        }))
      );
      if (!userSearchItems.length) {
        shareSearchResults.innerHTML = `
          <div class="col-12">
            <div class="alert alert-warning mb-0" role="alert">No visible users found for that username.</div>
          </div>
        `;
        return;
      }

      renderUserSearchResults();
    } catch (error) {
      showToast('Search Failed', error.message || 'Could not search users.', 'error');
    }
  }

  async function openShareModal(targetUserId, targetUsernameValue) {
    if (!shareGalleryModal || !shareTargetUserId || !shareTargetUsername || !shareGallerySelection) return;

    if (!ownedGalleries.length) {
      showToast('No Galleries', 'Create a gallery before sharing.', 'info');
      return;
    }

    shareTargetUserId.value = targetUserId;
    shareTargetUsername.textContent = targetUsernameValue;

    const { data: existingShares, error } = await supabase
      .from('gallery_shares')
      .select('gallery_id')
      .eq('owner_user_id', currentUser.id)
      .eq('shared_with_user_id', targetUserId);

    if (error) {
      showToast('Share Failed', error.message || 'Could not load current share settings.', 'error');
      return;
    }

    const sharedGalleryIds = new Set((existingShares || []).map((item) => item.gallery_id));

    shareGallerySelection.innerHTML = ownedGalleries.map((gallery) => {
      const isChecked = sharedGalleryIds.has(gallery.id);
      return `
        <label class="gallery-drawing-option mb-2 w-100">
          <input class="form-check-input mt-0" type="checkbox" value="${gallery.id}" ${isChecked ? 'checked' : ''}>
          <span class="fw-semibold">${gallery.name}</span>
        </label>
      `;
    }).join('');

    shareGalleryModal.show();
  }

  async function saveShareSelection() {
    const targetUserId = shareTargetUserId?.value?.trim() || '';
    if (!targetUserId || !shareGallerySelection) return;

    const selectedGalleryIds = Array.from(
      shareGallerySelection.querySelectorAll('input[type="checkbox"]:checked')
    ).map((checkbox) => checkbox.value);

    const ownedGalleryIds = ownedGalleries.map((gallery) => gallery.id);
    const galleryIdsToRemove = ownedGalleryIds.filter((id) => !selectedGalleryIds.includes(id));

    try {
      if (galleryIdsToRemove.length) {
        const { error: deleteError } = await supabase
          .from('gallery_shares')
          .delete()
          .eq('owner_user_id', currentUser.id)
          .eq('shared_with_user_id', targetUserId)
          .in('gallery_id', galleryIdsToRemove);

        if (deleteError) throw deleteError;
      }

      if (selectedGalleryIds.length) {
        const payload = selectedGalleryIds.map((galleryId) => ({
          gallery_id: galleryId,
          owner_user_id: currentUser.id,
          shared_with_user_id: targetUserId
        }));

        const { error: upsertError } = await supabase
          .from('gallery_shares')
          .upsert(payload, { onConflict: 'gallery_id,shared_with_user_id' });

        if (upsertError) throw upsertError;
      }

      shareGalleryModal?.hide();
      showToast('Sharing Updated', 'Gallery sharing settings were saved.', 'success');
      await loadData();
      renderPage();
    } catch (error) {
      showToast('Share Save Failed', error.message || 'Could not save share settings.', 'error');
    }
  }

  async function updatePrivacySetting() {
    if (!privacyToggle) return;

    const nextValue = privacyToggle.checked;
    const previousValue = currentProfile?.searchable !== false;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ searchable: nextValue })
        .eq('user_id', currentUser.id);

      if (error) throw error;

      currentProfile = {
        ...currentProfile,
        searchable: nextValue
      };

      showToast(
        'Privacy Updated',
        nextValue
          ? 'Your profile is now visible in username search.'
          : 'Your profile is now hidden from username search.',
        'success'
      );
    } catch (error) {
      privacyToggle.checked = previousValue;
      showToast('Privacy Update Failed', error.message || 'Could not update privacy setting.', 'error');
    }
  }

  async function openEditProfileModal() {
    if (!editProfileModal) return;

    removeAvatarRequested = false;

    if (editProfileUsernameInput) {
      editProfileUsernameInput.value = currentProfile?.username || getFallbackUsername();
    }

    if (editProfileAvatarFileInput) {
      editProfileAvatarFileInput.value = '';
    }

    await setEditProfilePreviewFromPath(currentProfile?.avatar_path || '');
    editProfileModal.show();
  }

  async function saveProfileChanges() {
    if (!editProfileUsernameInput) return;

    const nextUsername = editProfileUsernameInput.value.trim();
    if (!nextUsername) {
      showToast('Invalid Username', 'Username cannot be empty.', 'error');
      return;
    }

    const previousAvatarPath = currentProfile?.avatar_path || null;
    let nextAvatarPath = previousAvatarPath;
    const newAvatarFile = editProfileAvatarFileInput?.files?.[0] || null;

    try {
      if (newAvatarFile) {
        const maxSizeBytes = 5 * 1024 * 1024;
        if (newAvatarFile.size > maxSizeBytes) {
          throw new Error('Profile image must be 5MB or smaller.');
        }

        const extension = getFileExtension(newAvatarFile.name);
        const uploadPath = `${currentUser.id}/avatar-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(uploadPath, newAvatarFile, {
            contentType: newAvatarFile.type || 'image/png',
            upsert: false
          });

        if (uploadError) throw uploadError;

        if (currentProfile?.avatar_path && currentProfile.avatar_path !== uploadPath) {
          await supabase.storage
            .from('profile-pictures')
            .remove([currentProfile.avatar_path]);
        }

        nextAvatarPath = uploadPath;
      } else if (removeAvatarRequested && previousAvatarPath) {
        await supabase.storage
          .from('profile-pictures')
          .remove([previousAvatarPath]);
        nextAvatarPath = null;
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_profiles')
        .update({
          username: nextUsername,
          avatar_path: nextAvatarPath
        })
        .eq('user_id', currentUser.id)
        .select('user_id, username, searchable, avatar_path')
        .single();

      if (updateError) throw updateError;

      currentProfile = updatedProfile;

      if (previousAvatarPath) {
        avatarSrcCache.delete(previousAvatarPath);
      }
      if (nextAvatarPath) {
        avatarSrcCache.delete(nextAvatarPath);
      }

      if (currentUser.user_metadata) {
        currentUser.user_metadata.username = nextUsername;
      }

      await setProfileHeader();
      await refreshNavbarProfileButtonAvatar();
      editProfileModal?.hide();
      showToast('Profile Updated', 'Your profile details were saved.', 'success');

      if (userSearchItems.length) {
        userSearchItems = [];
        renderUserSearchResults();
      }
    } catch (error) {
      showToast('Profile Update Failed', error.message || 'Could not update profile.', 'error');
    }
  }

  function renderPage() {
    const selectedGallery = getSelectedGallery();
    const isSharedGalleryView = selectedGallery && selectedGallery.user_id !== currentUser.id;

    if (currentGalleryId && !selectedGallery) {
      showToast('Gallery Not Found', 'This gallery does not exist or you do not have access.', 'error');
      window.location.href = '/profile.html';
      return;
    }

    if (selectedGallery) {
      const titleSuffix = isSharedGalleryView ? ' (Shared)' : '';
      if (profileTitleText) profileTitleText.textContent = `${selectedGallery.name}${titleSuffix}`;
      subtitle.textContent = isSharedGalleryView
        ? `${currentUser.email} • Shared gallery • View only`
        : `${currentUser.email} • Gallery view`;
      if (editProfileButton) editProfileButton.classList.add('d-none');
      if (galleriesSection) galleriesSection.classList.add('d-none');
      if (createGalleryButton) createGalleryButton.classList.add('d-none');
      if (backToProfileButton) backToProfileButton.classList.remove('d-none');
      if (privacyToggle?.closest('.card')) privacyToggle.closest('.card').classList.add('d-none');
    } else {
      if (profileTitleText) profileTitleText.textContent = 'My Profile';
      subtitle.textContent = `${currentUser.email} • Your saved drawings`;
      if (editProfileButton) editProfileButton.classList.remove('d-none');
      if (galleriesSection) galleriesSection.classList.remove('d-none');
      if (createGalleryButton) createGalleryButton.classList.remove('d-none');
      if (backToProfileButton) backToProfileButton.classList.add('d-none');
      if (privacyToggle?.closest('.card')) privacyToggle.closest('.card').classList.remove('d-none');
      renderGalleries();
      renderUserSearchResults();
    }

    renderDrawings();
  }

  createGalleryButton?.addEventListener('click', () => {
    openCreateGalleryModal();
  });

  saveGalleryButton?.addEventListener('click', async () => {
    await saveGallery();
  });

  searchUsersButton?.addEventListener('click', async () => {
    await runUserSearch();
  });

  shareUserSearch?.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await runUserSearch();
  });

  privacyToggle?.addEventListener('change', async () => {
    await updatePrivacySetting();
  });

  saveShareSelectionButton?.addEventListener('click', async () => {
    await saveShareSelection();
  });

  editProfileButton?.addEventListener('click', async () => {
    await openEditProfileModal();
  });

  editProfileAvatarFileInput?.addEventListener('change', async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      await setEditProfilePreviewFromPath(currentProfile?.avatar_path || '');
      return;
    }

    removeAvatarRequested = false;

    const previewUrl = URL.createObjectURL(selectedFile);
    if (editProfileAvatarPreview && editProfileAvatarFallback) {
      editProfileAvatarPreview.src = previewUrl;
      editProfileAvatarPreview.classList.remove('d-none');
      editProfileAvatarFallback.classList.add('d-none');
    }
  });

  removeProfilePictureButton?.addEventListener('click', () => {
    removeAvatarRequested = true;
    if (editProfileAvatarFileInput) {
      editProfileAvatarFileInput.value = '';
    }

    if (editProfileAvatarPreview && editProfileAvatarFallback) {
      editProfileAvatarPreview.removeAttribute('src');
      editProfileAvatarPreview.classList.add('d-none');
      editProfileAvatarFallback.classList.remove('d-none');
    }
  });

  saveProfileButton?.addEventListener('click', async () => {
    await saveProfileChanges();
  });

  await loadCurrentProfile();
  await setProfileHeader();
  await refreshNavbarProfileButtonAvatar();
  await loadData();
  renderUserSearchResults();
  renderPage();
});
