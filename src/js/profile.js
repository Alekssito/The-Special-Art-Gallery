import { getCurrentUser } from './auth.js';
import { showToast } from './main.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const subtitle = document.getElementById('profileSubtitle');
  const drawingsContainer = document.getElementById('profileDrawings');

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

  subtitle.textContent = `${user.email} • Your saved drawings`;

  const { data, error } = await supabase
    .from('drawings')
    .select('id, title, image_data, created_at')
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

  drawingsContainer.innerHTML = data
    .map((drawing) => {
      const createdAt = new Date(drawing.created_at).toLocaleString();
      return `
        <div class="col-12 col-md-6 col-xl-4">
          <div class="card h-100 card-custom">
            <img src="${drawing.image_data}" class="card-img-top profile-drawing-image" alt="${drawing.title}">
            <div class="card-body d-flex flex-column">
              <h5 class="card-title mb-1 text-truncate" title="${drawing.title}">${drawing.title}</h5>
              <p class="text-muted small mb-3">Saved: ${createdAt}</p>
              <div class="mt-auto d-flex gap-2">
                <a href="${drawing.image_data}" download="${drawing.title}.png" class="btn btn-sm btn-secondary-custom w-100">
                  <i class="bi bi-download me-1"></i> Download
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
});
