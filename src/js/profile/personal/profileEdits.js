export function attachProfileEdits(ctx) {
  const { ui, deps, state } = ctx;
  const {
    privacyToggle,
    editProfileUsernameInput,
    editProfileAvatarFileInput,
    editProfileAvatarPreview,
    editProfileAvatarFallback
  } = ui;
  const { supabase, showToast } = deps;

  ctx.updatePrivacySetting = async function updatePrivacySetting() {
    if (!privacyToggle) return;

    const nextValue = privacyToggle.checked;
    const previousValue = state.currentProfile?.searchable !== false;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ searchable: nextValue })
        .eq('user_id', state.currentUser.id);

      if (error) throw error;

      state.currentProfile = {
        ...state.currentProfile,
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
  };

  ctx.openEditProfileModal = async function openEditProfileModal() {
    if (!state.editProfileModal) return;

    state.removeAvatarRequested = false;

    if (editProfileUsernameInput) {
      editProfileUsernameInput.value = state.currentProfile?.username || ctx.getFallbackUsername();
    }

    if (editProfileAvatarFileInput) {
      editProfileAvatarFileInput.value = '';
    }

    await ctx.setEditProfilePreviewFromPath(state.currentProfile?.avatar_path || '');
    state.editProfileModal.show();
  };

  ctx.saveProfileChanges = async function saveProfileChanges() {
    if (!editProfileUsernameInput) return;

    const nextUsername = editProfileUsernameInput.value.trim();
    if (!nextUsername) {
      showToast('Invalid Username', 'Username cannot be empty.', 'error');
      return;
    }

    const previousAvatarPath = state.currentProfile?.avatar_path || null;
    let nextAvatarPath = previousAvatarPath;
    const newAvatarFile = editProfileAvatarFileInput?.files?.[0] || null;

    try {
      if (newAvatarFile) {
        const maxSizeBytes = 5 * 1024 * 1024;
        if (newAvatarFile.size > maxSizeBytes) {
          throw new Error('Profile image must be 5MB or smaller.');
        }

        const extension = ctx.getFileExtension(newAvatarFile.name);
        const uploadPath = `${state.currentUser.id}/avatar-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(uploadPath, newAvatarFile, {
            contentType: newAvatarFile.type || 'image/png',
            upsert: false
          });

        if (uploadError) throw uploadError;

        if (state.currentProfile?.avatar_path && state.currentProfile.avatar_path !== uploadPath) {
          await supabase.storage
            .from('profile-pictures')
            .remove([state.currentProfile.avatar_path]);
        }

        nextAvatarPath = uploadPath;
      } else if (state.removeAvatarRequested && previousAvatarPath) {
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
        .eq('user_id', state.currentUser.id)
        .select('user_id, username, searchable, avatar_path, is_admin')
        .single();

      if (updateError) throw updateError;

      state.currentProfile = updatedProfile;

      if (previousAvatarPath) {
        state.avatarSrcCache.delete(previousAvatarPath);
      }
      if (nextAvatarPath) {
        state.avatarSrcCache.delete(nextAvatarPath);
      }

      if (state.currentUser.user_metadata) {
        state.currentUser.user_metadata.username = nextUsername;
      }

      await ctx.setProfileHeader();
      await ctx.refreshNavbarProfileButtonAvatar();
      state.editProfileModal?.hide();
      showToast('Profile Updated', 'Your profile details were saved.', 'success');

      if (state.userSearchItems.length) {
        state.userSearchItems = [];
        ctx.renderUserSearchResults();
      }
    } catch (error) {
      showToast('Profile Update Failed', error.message || 'Could not update profile.', 'error');
    }
  };

  ctx.handleAvatarInputChange = async function handleAvatarInputChange(event) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      await ctx.setEditProfilePreviewFromPath(state.currentProfile?.avatar_path || '');
      return;
    }

    state.removeAvatarRequested = false;

    const previewUrl = URL.createObjectURL(selectedFile);
    if (editProfileAvatarPreview && editProfileAvatarFallback) {
      editProfileAvatarPreview.src = previewUrl;
      editProfileAvatarPreview.classList.remove('d-none');
      editProfileAvatarFallback.classList.add('d-none');
    }
  };

  ctx.handleAvatarRemove = function handleAvatarRemove() {
    state.removeAvatarRequested = true;
    if (editProfileAvatarFileInput) {
      editProfileAvatarFileInput.value = '';
    }

    if (editProfileAvatarPreview && editProfileAvatarFallback) {
      editProfileAvatarPreview.removeAttribute('src');
      editProfileAvatarPreview.classList.add('d-none');
      editProfileAvatarFallback.classList.remove('d-none');
    }
  };
}
