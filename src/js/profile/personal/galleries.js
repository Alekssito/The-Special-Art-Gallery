export function attachGalleries(ctx) {
  const { ui, deps, params, state } = ctx;
  const {
    galleriesContainer,
    galleryModalTitle,
    galleryIdInput,
    galleryNameInput,
    galleryDrawingSelection
  } = ui;
  const { supabase, showToast } = deps;
  const { currentGalleryId } = params;

  ctx.getSelectedGallery = function getSelectedGallery() {
    if (!currentGalleryId) return null;
    return state.galleries.find((gallery) => gallery.id === currentGalleryId) || null;
  };

  ctx.getDefaultGalleryName = function getDefaultGalleryName() {
    return `Gallery ${state.ownedGalleries.length + 1}`;
  };

  ctx.buildGallerySelectionOptions = function buildGallerySelectionOptions(selectedDrawingIds = []) {
    if (!galleryDrawingSelection) return;

    const ownDrawings = state.drawings.filter((drawing) => drawing.user_id === state.currentUser.id);

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
  };

  ctx.openCreateGalleryModal = function openCreateGalleryModal() {
    if (!state.galleryModal) return;
    if (galleryModalTitle) galleryModalTitle.textContent = 'Create Gallery';
    if (galleryIdInput) galleryIdInput.value = '';
    if (galleryNameInput) galleryNameInput.value = '';
    ctx.buildGallerySelectionOptions([]);
    state.galleryModal.show();
  };

  ctx.openEditGalleryModal = function openEditGalleryModal(galleryId) {
    if (!state.galleryModal || !galleryId) return;

    const gallery = state.galleries.find((item) => item.id === galleryId);
    if (!gallery || gallery.user_id !== state.currentUser.id) return;

    if (galleryModalTitle) galleryModalTitle.textContent = 'Edit Gallery';
    if (galleryIdInput) galleryIdInput.value = galleryId;
    if (galleryNameInput) galleryNameInput.value = gallery.name || '';
    const selectedIds = state.drawings
      .filter((drawing) => drawing.gallery_id === galleryId)
      .map((drawing) => drawing.id);
    ctx.buildGallerySelectionOptions(selectedIds);
    state.galleryModal.show();
  };

  ctx.loadData = async function loadData() {
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

    let visibleGalleryIdsForAdmin = null;
    if (state.currentProfile?.is_admin === true) {
      const { data: shareData, error: shareError } = await supabase
        .from('gallery_shares')
        .select('gallery_id')
        .eq('shared_with_user_id', state.currentUser.id);

      if (shareError) throw shareError;
      visibleGalleryIdsForAdmin = new Set((shareData || []).map((item) => item.gallery_id));
    }

    const filteredGalleries = (galleriesData || []).filter((gallery) => {
      if (state.currentProfile?.is_admin !== true) return true;
      return gallery.user_id === state.currentUser.id || visibleGalleryIdsForAdmin.has(gallery.id);
    });

    const filteredDrawings = (drawingsData || []).filter((drawing) => {
      if (state.currentProfile?.is_admin !== true) return true;
      return drawing.user_id === state.currentUser.id
        || (drawing.gallery_id && visibleGalleryIdsForAdmin.has(drawing.gallery_id));
    });

    state.drawings = await Promise.all(
      filteredDrawings.map(async (drawing) => ({
        ...drawing,
        imageSrc: await ctx.resolveImageSrc(drawing)
      }))
    );

    state.galleries = filteredGalleries;
    state.ownedGalleries = state.galleries.filter((gallery) => gallery.user_id === state.currentUser.id);
  };

  ctx.saveGallery = async function saveGallery() {
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
          galleryName = ctx.getDefaultGalleryName();
        }

        const { data: newGallery, error: insertError } = await supabase
          .from('galleries')
          .insert({
            user_id: state.currentUser.id,
            name: galleryName
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        galleryId = newGallery.id;
      } else {
        const editedGallery = state.galleries.find((gallery) => gallery.id === galleryId);
        if (!editedGallery || editedGallery.user_id !== state.currentUser.id) {
          throw new Error('You can only edit your own galleries.');
        }

        if (!galleryName) {
          const currentGallery = state.galleries.find((item) => item.id === galleryId);
          galleryName = currentGallery?.name || ctx.getDefaultGalleryName();
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

      state.galleryModal?.hide();
      showToast('Gallery Saved', 'Gallery details updated successfully.', 'success');
      await ctx.loadData();
      ctx.renderPage();
    } catch (error) {
      showToast('Gallery Save Failed', error.message || 'Could not save gallery.', 'error');
    }
  };

  ctx.confirmGalleryDelete = function confirmGalleryDelete() {
    return new Promise((resolve) => {
      if (!state.deleteGalleryModal || !ui.deleteGalleryModalElement || !ui.confirmDeleteGalleryButton) {
        resolve(false);
        return;
      }

      const handleConfirm = () => {
        cleanup();
        state.deleteGalleryModal.hide();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        ui.confirmDeleteGalleryButton.removeEventListener('click', handleConfirm);
        ui.deleteGalleryModalElement.removeEventListener('hidden.bs.modal', handleCancel);
      };

      ui.confirmDeleteGalleryButton.addEventListener('click', handleConfirm);
      ui.deleteGalleryModalElement.addEventListener('hidden.bs.modal', handleCancel, { once: true });
      state.deleteGalleryModal.show();
    });
  };

  ctx.deleteGallery = async function deleteGallery(galleryId) {
    const targetGallery = state.galleries.find((gallery) => gallery.id === galleryId);
    const canAdminDelete = state.currentProfile?.is_admin === true;
    if (!targetGallery || (targetGallery.user_id !== state.currentUser.id && !canAdminDelete)) {
      showToast('Access Denied', 'You can only delete your own galleries.', 'error');
      return;
    }

    const confirmed = await ctx.confirmGalleryDelete();
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('galleries')
        .delete()
        .eq('id', galleryId);

      if (error) throw error;

      showToast('Gallery Deleted', 'Gallery removed successfully.', 'success');
      await ctx.loadData();

      if (currentGalleryId === galleryId) {
        window.location.href = '/profile.html';
        return;
      }

      ctx.renderPage();
    } catch (error) {
      showToast('Delete Failed', error.message || 'Could not delete gallery.', 'error');
    }
  };

  ctx.renderGalleries = function renderGalleries() {
    if (!galleriesContainer) return;

    if (!state.galleries.length) {
      galleriesContainer.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info mb-0" role="alert">
            You have no galleries yet. Click Create Gallery to organize your drawings.
          </div>
        </div>
      `;
      return;
    }

    galleriesContainer.innerHTML = state.galleries.map((gallery) => {
      const isSharedGallery = gallery.user_id !== state.currentUser.id;
      const drawingsCount = state.drawings.filter((drawing) => drawing.gallery_id === gallery.id).length;
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
        ctx.openEditGalleryModal(galleryId);
      });
    });

    galleriesContainer.querySelectorAll('.btn-delete-gallery').forEach((button) => {
      button.addEventListener('click', async () => {
        const galleryId = button.getAttribute('data-gallery-id');
        if (!galleryId) return;
        await ctx.deleteGallery(galleryId);
      });
    });
  };
}
