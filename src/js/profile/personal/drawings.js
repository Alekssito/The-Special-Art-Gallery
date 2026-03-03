import { getRouteUrl } from '../../navigation.js';

export function attachDrawings(ctx) {
  const { ui, deps, params, state } = ctx;
  const { drawingsContainer } = ui;
  const { supabase, showToast } = deps;
  const { currentGalleryId } = params;

  ctx.confirmDrawingDelete = function confirmDrawingDelete() {
    return new Promise((resolve) => {
      if (!state.deleteDrawingModal || !ui.deleteDrawingModalElement || !ui.confirmDeleteDrawingButton) {
        resolve(false);
        return;
      }

      const handleConfirm = () => {
        cleanup();
        state.deleteDrawingModal.hide();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        ui.confirmDeleteDrawingButton.removeEventListener('click', handleConfirm);
        ui.deleteDrawingModalElement.removeEventListener('hidden.bs.modal', handleCancel);
      };

      ui.confirmDeleteDrawingButton.addEventListener('click', handleConfirm);
      ui.deleteDrawingModalElement.addEventListener('hidden.bs.modal', handleCancel, { once: true });
      state.deleteDrawingModal.show();
    });
  };

  ctx.resolveImageSrc = async function resolveImageSrc(drawing) {
    if (state.imageSrcCache.has(drawing.id)) {
      return state.imageSrcCache.get(drawing.id);
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

    state.imageSrcCache.set(drawing.id, imageSrc);
    return imageSrc;
  };

  ctx.renderDrawings = function renderDrawings() {
    const selectedGallery = ctx.getSelectedGallery();
    const isSharedGalleryView = selectedGallery && selectedGallery.user_id !== state.currentUser.id;
    const visibleDrawings = currentGalleryId
      ? state.drawings.filter((drawing) => drawing.gallery_id === currentGalleryId)
      : state.drawings.filter((drawing) => !drawing.gallery_id);

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
        const isOwnDrawing = drawing.user_id === state.currentUser.id;
        const canManageDrawing = isOwnDrawing && !isSharedGalleryView;
        return `
          <div class="col-12 col-md-6 col-xl-4">
            <div class="card h-100 card-custom">
              <img src="${drawing.imageSrc}" class="card-img-top profile-drawing-image" alt="Saved drawing">
              <div class="card-body d-flex flex-column">
                <p class="text-muted small mb-3">Saved: ${createdAt}</p>
                <div class="mt-auto d-flex gap-2 flex-wrap">
                  <button class="btn btn-sm btn-secondary-custom flex-grow-1 btn-download-drawing" data-id="${drawing.id}" data-image-src="${drawing.imageSrc}">
                    <i class="bi bi-download me-1"></i> Download
                  </button>
                  ${canManageDrawing ? `
                  <a href="${getRouteUrl('draw', { query: { edit: drawing.id } })}" class="btn btn-sm btn-primary-custom flex-grow-1">
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

    drawingsContainer.querySelectorAll('.btn-download-drawing').forEach((button) => {
      button.addEventListener('click', async () => {
        const drawingId = button.getAttribute('data-id');
        const imageSrc = button.getAttribute('data-image-src');
        if (!drawingId || !imageSrc) return;

        try {
          const response = await fetch(imageSrc);
          if (!response.ok) {
            throw new Error('Could not fetch drawing image for download.');
          }

          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = `drawing-${drawingId}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(objectUrl);
        } catch (downloadError) {
          showToast('Download Failed', downloadError.message || 'Could not download drawing.', 'error');
        }
      });
    });

    drawingsContainer.querySelectorAll('.btn-delete-drawing').forEach((button) => {
      button.addEventListener('click', async () => {
        const drawingId = button.getAttribute('data-id');
        const storagePath = button.getAttribute('data-storage-path');

        if (!drawingId) return;

        const confirmed = await ctx.confirmDrawingDelete();
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
          await ctx.loadData();
          ctx.renderPage();
        } catch (deleteError) {
          showToast('Delete Failed', deleteError.message || 'Could not delete drawing.', 'error');
        }
      });
    });
  };
}
