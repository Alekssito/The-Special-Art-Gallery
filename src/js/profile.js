import { getCurrentUser } from './auth.js';
import { showToast } from './main.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

document.addEventListener('DOMContentLoaded', async () => {
  const subtitle = document.getElementById('profileSubtitle');
  const drawingsContainer = document.getElementById('profileDrawings');
  const profileUsername = document.getElementById('profileUsername');
  const profileTitleText = document.getElementById('profileTitleText');
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

  let galleryModal = null;
  let deleteGalleryModal = null;
  let currentUser = null;
  let drawings = [];
  let galleries = [];
  const imageSrcCache = new Map();
  const searchParams = new URLSearchParams(window.location.search);
  const currentGalleryId = searchParams.get('gallery');

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

  const usernameFromMetadata = currentUser.user_metadata?.username?.trim();
  const emailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'artist';
  const displayUsername = usernameFromMetadata || emailPrefix;

  if (profileUsername) {
    profileUsername.textContent = `• ${displayUsername}`;
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
    return `Gallery ${galleries.length + 1}`;
  }

  function buildGallerySelectionOptions(selectedDrawingIds = []) {
    if (!galleryDrawingSelection) return;

    if (!drawings.length) {
      galleryDrawingSelection.innerHTML = '<p class="text-muted mb-0">No drawings available yet.</p>';
      return;
    }

    galleryDrawingSelection.innerHTML = drawings.map((drawing) => {
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
    if (!gallery) return;

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
        .select('id, title, image_data, storage_path, created_at, gallery_id')
        .order('created_at', { ascending: false }),
      supabase
        .from('galleries')
        .select('id, name, created_at')
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
      const drawingsCount = drawings.filter((drawing) => drawing.gallery_id === gallery.id).length;
      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card card-custom h-100">
            <div class="card-body d-flex flex-column">
              <h3 class="h6 fw-bold mb-2"><i class="bi bi-folder2-open me-2"></i>${gallery.name}</h3>
              <p class="text-muted small mb-3">${drawingsCount} drawing${drawingsCount === 1 ? '' : 's'}</p>
              <div class="mt-auto d-flex gap-2 flex-wrap">
                <a class="btn btn-sm btn-primary-custom flex-grow-1" href="/profile.html?gallery=${gallery.id}">
                  <i class="bi bi-box-arrow-in-right me-1"></i> Enter
                </a>
                <button class="btn btn-sm btn-outline-secondary flex-grow-1 btn-edit-gallery" data-gallery-id="${gallery.id}">
                  <i class="bi bi-pencil me-1"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger flex-grow-1 btn-delete-gallery" data-gallery-id="${gallery.id}">
                  <i class="bi bi-trash me-1"></i> Delete
                </button>
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
    const visibleDrawings = currentGalleryId
      ? drawings.filter((drawing) => drawing.gallery_id === currentGalleryId)
      : drawings.filter((drawing) => !drawing.gallery_id);

    if (!visibleDrawings.length) {
      drawingsContainer.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info mb-0" role="alert">
            ${currentGalleryId ? 'This gallery is empty. Edit the gallery to add drawings.' : 'You have no drawings outside galleries yet. Go to the canvas and click Save.'}
          </div>
        </div>
      `;
      return;
    }

    drawingsContainer.innerHTML = visibleDrawings
      .map((drawing) => {
        const createdAt = new Date(drawing.created_at).toLocaleString();
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
                  <a href="/draw.html?edit=${drawing.id}" class="btn btn-sm btn-primary-custom flex-grow-1">
                    <i class="bi bi-pencil-square me-1"></i> Edit
                  </a>
                  <button class="btn btn-sm btn-outline-danger flex-grow-1 btn-delete-drawing" data-id="${drawing.id}" data-storage-path="${drawing.storage_path || ''}">
                    <i class="bi bi-trash me-1"></i> Delete
                  </button>
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

  function renderPage() {
    const selectedGallery = currentGalleryId ? galleries.find((gallery) => gallery.id === currentGalleryId) : null;

    if (currentGalleryId && !selectedGallery) {
      showToast('Gallery Not Found', 'This gallery does not exist or you do not have access.', 'error');
      window.location.href = '/profile.html';
      return;
    }

    if (selectedGallery) {
      if (profileTitleText) profileTitleText.textContent = selectedGallery.name;
      subtitle.textContent = `${currentUser.email} • Gallery view`;
      if (galleriesSection) galleriesSection.classList.add('d-none');
      if (createGalleryButton) createGalleryButton.classList.add('d-none');
      if (backToProfileButton) backToProfileButton.classList.remove('d-none');
    } else {
      if (profileTitleText) profileTitleText.textContent = 'My Profile';
      subtitle.textContent = `${currentUser.email} • Your saved drawings`;
      if (galleriesSection) galleriesSection.classList.remove('d-none');
      if (createGalleryButton) createGalleryButton.classList.remove('d-none');
      if (backToProfileButton) backToProfileButton.classList.add('d-none');
      renderGalleries();
    }

    renderDrawings();
  }

  createGalleryButton?.addEventListener('click', () => {
    openCreateGalleryModal();
  });

  saveGalleryButton?.addEventListener('click', async () => {
    await saveGallery();
  });

  await loadData();
  renderPage();
});
