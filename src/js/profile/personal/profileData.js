export function attachProfileData(ctx) {
  const { ui, deps, state } = ctx;
  const {
    profileUsername,
    profileModeBadge,
    profileTitleAvatar,
    profileTitleAvatarFallback,
    editProfileAvatarPreview,
    editProfileAvatarFallback,
    privacyToggle
  } = ui;
  const { supabase } = deps;

  ctx.getFileExtension = function getFileExtension(fileName) {
    const parts = fileName.split('.');
    if (parts.length < 2) return 'png';
    return parts.pop().toLowerCase();
  };

  ctx.resolveAvatarSrc = async function resolveAvatarSrc(avatarPath) {
    if (!avatarPath) return '';
    if (state.avatarSrcCache.has(avatarPath)) {
      return state.avatarSrcCache.get(avatarPath);
    }

    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .createSignedUrl(avatarPath, 60 * 10);

    if (error || !data?.signedUrl) {
      state.avatarSrcCache.set(avatarPath, '');
      return '';
    }

    state.avatarSrcCache.set(avatarPath, data.signedUrl);
    return data.signedUrl;
  };

  ctx.renderProfileTitleAvatar = async function renderProfileTitleAvatar() {
    if (!profileTitleAvatar || !profileTitleAvatarFallback) return;

    const avatarSrc = await ctx.resolveAvatarSrc(state.currentProfile?.avatar_path || '');
    if (avatarSrc) {
      profileTitleAvatar.src = avatarSrc;
      profileTitleAvatar.classList.remove('d-none');
      profileTitleAvatarFallback.classList.add('d-none');
      return;
    }

    profileTitleAvatar.removeAttribute('src');
    profileTitleAvatar.classList.add('d-none');
    profileTitleAvatarFallback.classList.remove('d-none');
  };

  ctx.setEditProfilePreviewFromPath = async function setEditProfilePreviewFromPath(avatarPath) {
    if (!editProfileAvatarPreview || !editProfileAvatarFallback) return;

    const avatarSrc = await ctx.resolveAvatarSrc(avatarPath || '');
    if (avatarSrc) {
      editProfileAvatarPreview.src = avatarSrc;
      editProfileAvatarPreview.classList.remove('d-none');
      editProfileAvatarFallback.classList.add('d-none');
      return;
    }

    editProfileAvatarPreview.removeAttribute('src');
    editProfileAvatarPreview.classList.add('d-none');
    editProfileAvatarFallback.classList.remove('d-none');
  };

  ctx.getFallbackUsername = function getFallbackUsername() {
    const usernameFromMetadata = state.currentUser?.user_metadata?.username?.trim();
    const emailPrefix = state.currentUser?.email ? state.currentUser.email.split('@')[0] : 'artist';
    return usernameFromMetadata || emailPrefix;
  };

  ctx.refreshNavbarProfileButtonAvatar = async function refreshNavbarProfileButtonAvatar() {
    const accountLinks = document.querySelectorAll('a[href="/profile.html"]');
    if (!accountLinks.length) return;

    const displayUsername = state.currentProfile?.username?.trim() || ctx.getFallbackUsername();
    const avatarSrc = await ctx.resolveAvatarSrc(state.currentProfile?.avatar_path || '');
    const isAdmin = state.currentProfile?.is_admin === true;

    accountLinks.forEach((link) => {
      if (!link.classList.contains('btn-accent')) return;
      link.innerHTML = avatarSrc
        ? `<img src="${avatarSrc}" alt="Profile picture" class="profile-nav-avatar me-2"> My Profile`
        : '<i class="bi bi-person-circle me-2"></i> My Profile';
    });

    const guestBadge = document.querySelector('.navbar .badge');
    if (guestBadge) {
      guestBadge.classList.remove('bg-success', 'bg-warning', 'bg-danger');
      guestBadge.classList.add(isAdmin ? 'bg-danger' : 'bg-success');
      guestBadge.innerHTML = isAdmin
        ? `<i class="bi bi-shield-lock-fill"></i> Admin Mode • ${displayUsername}`
        : `<i class="bi bi-person-check"></i> User Mode • ${displayUsername}`;
    }
  };

  ctx.loadCurrentProfile = async function loadCurrentProfile() {
    const fallbackUsername = ctx.getFallbackUsername();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, username, searchable, avatar_path, is_admin')
      .eq('user_id', state.currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      state.currentProfile = data;
    } else {
      const { data: insertedProfile, error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: state.currentUser.id,
          username: fallbackUsername,
          searchable: true,
          avatar_path: null,
          is_admin: false
        }, { onConflict: 'user_id' })
        .select('user_id, username, searchable, avatar_path, is_admin')
        .single();

      if (upsertError) throw upsertError;
      state.currentProfile = insertedProfile;
    }

    if (privacyToggle) {
      privacyToggle.checked = state.currentProfile.searchable !== false;
    }
  };

  ctx.setProfileHeader = async function setProfileHeader() {
    const displayUsername = state.currentProfile?.username?.trim() || ctx.getFallbackUsername();
    if (profileUsername) {
      profileUsername.textContent = `• ${displayUsername}`;
    }

    if (profileModeBadge) {
      const isAdmin = state.currentProfile?.is_admin === true;
      profileModeBadge.textContent = isAdmin ? 'Admin Mode' : 'User Mode';
      profileModeBadge.classList.toggle('admin-mode-badge', isAdmin);
      profileModeBadge.classList.toggle('bg-success-subtle', !isAdmin);
      profileModeBadge.classList.toggle('text-success-emphasis', !isAdmin);
      profileModeBadge.classList.toggle('border-success-subtle', !isAdmin);
    }

    await ctx.renderProfileTitleAvatar();
  };
}
