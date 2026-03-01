import { getCurrentUser } from './auth.js';
import { showToast } from './main.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const subtitle = document.getElementById('profileSubtitle');
  const drawingsContainer = document.getElementById('profileDrawings');
  const profileUsername = document.getElementById('profileUsername');

  if (!subtitle || !drawingsContainer) return;

  if (!isSupabaseConfigured || !supabase) {
    subtitle.textContent = 'Supabase is not configured in this environment.';
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast('Login Required', 'Please log in to view your profile.', 'info');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 900);
    return;
  }

  const usernameFromMetadata = user.user_metadata?.username?.trim();
  const emailPrefix = user.email ? user.email.split('@')[0] : 'artist';
  const displayUsername = usernameFromMetadata || emailPrefix;

  if (profileUsername) {
    profileUsername.textContent = `• ${displayUsername}`;
  }

  subtitle.textContent = `${user.email} • Your saved drawings`;

  const { data, error } = await supabase
    .from('drawings')
    .select('id, title, image_data, storage_path, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    subtitle.textContent = 'Could not load your drawings right now.';
    showToast('Load Error', error.message || 'Could not load drawings.', 'error');
    return;
  }

  if (!data || data.length === 0) {
    drawingsContainer.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info mb-0" role="alert">
          You have no saved drawings yet. Go to the canvas and click Save.
        </div>
      </div>
    `;
    return;
  }

  async function resolveImageSrc(drawing) {
    if (drawing.storage_path) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('drawings')
        .createSignedUrl(drawing.storage_path, 60 * 10);

      if (!signedError && signedData?.signedUrl) {
        return signedData.signedUrl;
      }
    }
    return drawing.image_data || '';
  }

  const drawingsWithSrc = await Promise.all(
    data.map(async (drawing) => ({
      ...drawing,
      imageSrc: await resolveImageSrc(drawing)
    }))
  );

  drawingsContainer.innerHTML = drawingsWithSrc
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

        const card = button.closest('.col-12');
        if (card) card.remove();
        showToast('Deleted', 'Drawing deleted successfully.', 'success');

        if (!drawingsContainer.children.length) {
          drawingsContainer.innerHTML = `
            <div class="col-12">
              <div class="alert alert-info mb-0" role="alert">
                You have no saved drawings yet. Go to the canvas and click Save.
              </div>
            </div>
          `;
        }
      } catch (deleteError) {
        showToast('Delete Failed', deleteError.message || 'Could not delete drawing.', 'error');
      }
    });
  });
});
