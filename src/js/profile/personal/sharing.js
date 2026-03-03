export function attachSharing(ctx) {
  const { ui, deps, state } = ctx;
  const {
    shareUserSearch,
    shareSearchResults,
    shareTargetUserId,
    shareTargetUsername,
    shareGallerySelection
  } = ui;
  const { supabase, showToast } = deps;

  ctx.renderUserSearchResults = function renderUserSearchResults() {
    if (!shareSearchResults) return;

    if (!state.ownedGalleries.length) {
      shareSearchResults.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info mb-0" role="alert">
            Create at least one gallery to share with other users.
          </div>
        </div>
      `;
      return;
    }

    if (!state.userSearchItems.length) {
      shareSearchResults.innerHTML = `
        <div class="col-12">
          <p class="text-muted small mb-0">Search by username to find users and share your galleries.</p>
        </div>
      `;
      return;
    }

    shareSearchResults.innerHTML = state.userSearchItems.map((item) => `
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
        await ctx.openShareModal(targetUserId, targetUsername);
      });
    });
  };

  ctx.runUserSearch = async function runUserSearch() {
    const rawTerm = shareUserSearch?.value?.trim() || '';

    if (rawTerm.length < 2) {
      state.userSearchItems = [];
      ctx.renderUserSearchResults();
      showToast('Search', 'Type at least 2 characters to search users.', 'info');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, username, avatar_path')
        .ilike('username', `%${rawTerm}%`)
        .neq('user_id', state.currentUser.id)
        .eq('searchable', true)
        .order('username', { ascending: true })
        .limit(12);

      if (error) throw error;

      state.userSearchItems = await Promise.all(
        (data || []).map(async (item) => ({
          ...item,
          avatarSrc: await ctx.resolveAvatarSrc(item.avatar_path)
        }))
      );
      if (!state.userSearchItems.length) {
        shareSearchResults.innerHTML = `
          <div class="col-12">
            <div class="alert alert-warning mb-0" role="alert">No visible users found for that username.</div>
          </div>
        `;
        return;
      }

      ctx.renderUserSearchResults();
    } catch (error) {
      showToast('Search Failed', error.message || 'Could not search users.', 'error');
    }
  };

  ctx.openShareModal = async function openShareModal(targetUserId, targetUsernameValue) {
    if (!state.shareGalleryModal || !shareTargetUserId || !shareTargetUsername || !shareGallerySelection) return;

    if (!state.ownedGalleries.length) {
      showToast('No Galleries', 'Create a gallery before sharing.', 'info');
      return;
    }

    shareTargetUserId.value = targetUserId;
    shareTargetUsername.textContent = targetUsernameValue;

    const { data: existingShares, error } = await supabase
      .from('gallery_shares')
      .select('gallery_id')
      .eq('owner_user_id', state.currentUser.id)
      .eq('shared_with_user_id', targetUserId);

    if (error) {
      showToast('Share Failed', error.message || 'Could not load current share settings.', 'error');
      return;
    }

    const sharedGalleryIds = new Set((existingShares || []).map((item) => item.gallery_id));

    shareGallerySelection.innerHTML = state.ownedGalleries.map((gallery) => {
      const isChecked = sharedGalleryIds.has(gallery.id);
      return `
        <label class="gallery-drawing-option mb-2 w-100">
          <input class="form-check-input mt-0" type="checkbox" value="${gallery.id}" ${isChecked ? 'checked' : ''}>
          <span class="fw-semibold">${gallery.name}</span>
        </label>
      `;
    }).join('');

    state.shareGalleryModal.show();
  };

  ctx.saveShareSelection = async function saveShareSelection() {
    const targetUserId = shareTargetUserId?.value?.trim() || '';
    if (!targetUserId || !shareGallerySelection) return;

    const selectedGalleryIds = Array.from(
      shareGallerySelection.querySelectorAll('input[type="checkbox"]:checked')
    ).map((checkbox) => checkbox.value);

    const ownedGalleryIds = state.ownedGalleries.map((gallery) => gallery.id);
    const galleryIdsToRemove = ownedGalleryIds.filter((id) => !selectedGalleryIds.includes(id));

    try {
      if (galleryIdsToRemove.length) {
        const { error: deleteError } = await supabase
          .from('gallery_shares')
          .delete()
          .eq('owner_user_id', state.currentUser.id)
          .eq('shared_with_user_id', targetUserId)
          .in('gallery_id', galleryIdsToRemove);

        if (deleteError) throw deleteError;
      }

      if (selectedGalleryIds.length) {
        const payload = selectedGalleryIds.map((galleryId) => ({
          gallery_id: galleryId,
          owner_user_id: state.currentUser.id,
          shared_with_user_id: targetUserId
        }));

        const { error: upsertError } = await supabase
          .from('gallery_shares')
          .upsert(payload, { onConflict: 'gallery_id,shared_with_user_id' });

        if (upsertError) throw upsertError;
      }

      state.shareGalleryModal?.hide();
      showToast('Sharing Updated', 'Gallery sharing settings were saved.', 'success');
      await ctx.loadData();
      ctx.renderPage();
    } catch (error) {
      showToast('Share Save Failed', error.message || 'Could not save share settings.', 'error');
    }
  };
}
