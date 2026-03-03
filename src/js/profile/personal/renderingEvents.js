export function attachRenderingAndEvents(ctx) {
  const { ui, deps, params, state } = ctx;
  const {
    subtitle,
    profileTitleText,
    editProfileButton,
    galleriesSection,
    createGalleryButton,
    backToProfileButton,
    goToAdminDashboardButton,
    privacyToggle,
    personalProfileSection,
    adminDashboardSection,
    searchUsersButton,
    shareUserSearch,
    saveGalleryButton,
    saveShareSelectionButton,
    saveProfileButton,
    editProfileAvatarFileInput,
    removeProfilePictureButton
  } = ui;
  const { showToast } = deps;
  const { currentGalleryId, isAdminDashboardView } = params;

  ctx.renderPage = function renderPage() {
    const selectedGallery = ctx.getSelectedGallery();
    const isSharedGalleryView = selectedGallery && selectedGallery.user_id !== state.currentUser.id;
    const isAdmin = state.currentProfile?.is_admin === true;

    if (currentGalleryId && !selectedGallery) {
      showToast('Gallery Not Found', 'This gallery does not exist or you do not have access.', 'error');
      window.location.href = '/profile.html';
      return;
    }

    if (selectedGallery) {
      const titleSuffix = isSharedGalleryView ? ' (Shared)' : '';
      if (profileTitleText) profileTitleText.textContent = `${selectedGallery.name}${titleSuffix}`;
      subtitle.textContent = isSharedGalleryView
        ? `${state.currentUser.email} • Shared gallery • View only`
        : `${state.currentUser.email} • Gallery view`;
      if (editProfileButton) editProfileButton.classList.add('d-none');
      if (galleriesSection) galleriesSection.classList.add('d-none');
      if (createGalleryButton) createGalleryButton.classList.add('d-none');
      if (backToProfileButton) {
        backToProfileButton.classList.remove('d-none');
        backToProfileButton.setAttribute('href', '/profile.html');
        backToProfileButton.innerHTML = '<i class="bi bi-arrow-left-circle-fill me-1"></i> Back to Profile';
      }
      if (goToAdminDashboardButton) goToAdminDashboardButton.classList.add('d-none');
      if (privacyToggle?.closest('.card')) privacyToggle.closest('.card').classList.add('d-none');
      if (personalProfileSection) personalProfileSection.classList.remove('d-none');
      if (adminDashboardSection) adminDashboardSection.classList.add('d-none');
    } else {
      if (profileTitleText) profileTitleText.textContent = isAdminDashboardView ? 'Admin Dashboard' : 'My Profile';
      subtitle.textContent = isAdminDashboardView
        ? `${state.currentUser.email} • Admin management screen`
        : isAdmin
          ? `${state.currentUser.email} • Personal profile screen`
          : `${state.currentUser.email} • Your saved drawings`;

      if (goToAdminDashboardButton) {
        goToAdminDashboardButton.classList.toggle('d-none', !isAdmin || isAdminDashboardView);
      }

      if (isAdminDashboardView && isAdmin) {
        if (editProfileButton) editProfileButton.classList.add('d-none');
        if (galleriesSection) galleriesSection.classList.add('d-none');
        if (createGalleryButton) createGalleryButton.classList.add('d-none');
        if (backToProfileButton) {
          backToProfileButton.classList.remove('d-none');
          backToProfileButton.setAttribute('href', '/profile.html');
          backToProfileButton.innerHTML = '<i class="bi bi-arrow-left-circle-fill me-1"></i> Back to Profile';
        }
        if (privacyToggle?.closest('.card')) privacyToggle.closest('.card').classList.add('d-none');
        if (personalProfileSection) personalProfileSection.classList.add('d-none');
      } else {
        if (editProfileButton) editProfileButton.classList.remove('d-none');
        if (galleriesSection) galleriesSection.classList.remove('d-none');
        if (createGalleryButton) createGalleryButton.classList.remove('d-none');
        if (backToProfileButton) backToProfileButton.classList.add('d-none');
        if (privacyToggle?.closest('.card')) privacyToggle.closest('.card').classList.remove('d-none');
        if (personalProfileSection) personalProfileSection.classList.remove('d-none');
      }

      state.adminRenderer();
      ctx.renderGalleries();
      ctx.renderUserSearchResults();
    }

    if (!(isAdminDashboardView && isAdmin)) {
      ctx.renderDrawings();
    }
  };

  ctx.bindEvents = function bindEvents() {
    createGalleryButton?.addEventListener('click', () => {
      ctx.openCreateGalleryModal();
    });

    saveGalleryButton?.addEventListener('click', async () => {
      await ctx.saveGallery();
    });

    searchUsersButton?.addEventListener('click', async () => {
      await ctx.runUserSearch();
    });

    shareUserSearch?.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      await ctx.runUserSearch();
    });

    privacyToggle?.addEventListener('change', async () => {
      await ctx.updatePrivacySetting();
    });

    saveShareSelectionButton?.addEventListener('click', async () => {
      await ctx.saveShareSelection();
    });

    editProfileButton?.addEventListener('click', async () => {
      await ctx.openEditProfileModal();
    });

    editProfileAvatarFileInput?.addEventListener('change', async (event) => {
      await ctx.handleAvatarInputChange(event);
    });

    removeProfilePictureButton?.addEventListener('click', () => {
      ctx.handleAvatarRemove();
    });

    saveProfileButton?.addEventListener('click', async () => {
      await ctx.saveProfileChanges();
    });
  };
}
