export function createSaveGalleryChoicePrompt({ bootstrap, saveGalleryChoiceModalElement, saveGallerySelect, btnConfirmSaveChoice }) {
  const saveGalleryChoiceModal = saveGalleryChoiceModalElement
    ? bootstrap.Modal.getOrCreateInstance(saveGalleryChoiceModalElement)
    : null;

  return (galleries, preselectedGalleryId = null) => {
    if (!saveGalleryChoiceModal || !saveGallerySelect || !btnConfirmSaveChoice) {
      return Promise.resolve(preselectedGalleryId || null);
    }

    const hasPreselectedGallery = preselectedGalleryId
      && galleries.some((gallery) => gallery.id === preselectedGalleryId);

    saveGallerySelect.innerHTML = [
      '<option value="">Save without gallery</option>',
      ...galleries.map((gallery) => `<option value="${gallery.id}">${gallery.name}</option>`)
    ].join('');
    saveGallerySelect.value = hasPreselectedGallery ? preselectedGalleryId : '';

    return new Promise((resolve) => {
      const cleanup = () => {
        btnConfirmSaveChoice.removeEventListener('click', handleConfirm);
        saveGalleryChoiceModalElement.removeEventListener('hidden.bs.modal', handleDismiss);
      };

      const handleConfirm = () => {
        const selectedGalleryId = saveGallerySelect.value || null;
        cleanup();
        saveGalleryChoiceModal.hide();
        resolve(selectedGalleryId);
      };

      const handleDismiss = () => {
        cleanup();
        resolve(undefined);
      };

      btnConfirmSaveChoice.addEventListener('click', handleConfirm);
      saveGalleryChoiceModalElement.addEventListener('hidden.bs.modal', handleDismiss);
      saveGalleryChoiceModal.show();
    });
  };
}

export async function saveDrawingFromCanvas({
  canvas,
  editingDrawingId,
  isSupabaseConfigured,
  supabase,
  getCurrentUser,
  showToast,
  promptGallerySaveChoice
}) {
  if (!isSupabaseConfigured || !supabase) {
    showToast('Supabase Not Configured', 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) first.', 'error');
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast(
      'Account Required',
      'Log in to save drawings to your account. <a href="/login.html" class="fw-bold text-decoration-underline" style="color: inherit;">Go to login</a>.',
      'info'
    );
    return;
  }

  try {
    const now = new Date().toISOString();
    const title = `Drawing ${now}`;

    let storagePath = `${user.id}/${crypto.randomUUID()}.png`;
    let currentGalleryId = null;
    let selectedGalleryId = null;

    if (editingDrawingId) {
      const { data: existingDrawing, error: existingError } = await supabase
        .from('drawings')
        .select('id, user_id, storage_path, gallery_id')
        .eq('id', editingDrawingId)
        .single();

      if (existingError) throw existingError;
      if (existingDrawing?.storage_path) storagePath = existingDrawing.storage_path;
      currentGalleryId = existingDrawing?.gallery_id || null;
      selectedGalleryId = currentGalleryId;
    }

    if (!editingDrawingId) {
      const { data: galleries, error: galleriesError } = await supabase
        .from('galleries')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (galleriesError) throw galleriesError;

      if ((galleries || []).length > 0) {
        const saveChoice = await promptGallerySaveChoice(galleries, null);
        if (saveChoice === undefined) {
          return;
        }
        selectedGalleryId = saveChoice;
      }
    }

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error('Could not create image blob from canvas.'));
          return;
        }
        resolve(result);
      }, 'image/png');
    });

    const { error: uploadError } = await supabase.storage
      .from('drawings')
      .upload(storagePath, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) throw uploadError;

    if (editingDrawingId) {
      const { error: updateError } = await supabase
        .from('drawings')
        .update({
          title,
          storage_path: storagePath,
          image_data: null,
          gallery_id: selectedGalleryId
        })
        .eq('id', editingDrawingId);

      if (updateError) throw updateError;
      showToast('Updated', 'Your drawing updates have been saved.', 'success');
      return;
    }

    const { error } = await supabase.from('drawings').insert({
      user_id: user.id,
      title,
      storage_path: storagePath,
      image_data: null,
      gallery_id: selectedGalleryId
    });

    if (error) throw error;
    showToast('Saved', 'Your drawing has been saved to your account.', 'success');
  } catch (error) {
    showToast('Save Failed', error.message || 'Could not save drawing.', 'error');
  }
}

export async function loadDrawingForEditing({
  editingDrawingId,
  isSupabaseConfigured,
  supabase,
  getCurrentUser,
  canvas,
  getCtx,
  pushCanvasState,
  showToast
}) {
  if (!editingDrawingId || !isSupabaseConfigured || !supabase) return;

  const user = await getCurrentUser();
  if (!user) return;

  const ctx = getCtx();
  if (!ctx) return;

  try {
    const { data: drawing, error: drawingError } = await supabase
      .from('drawings')
      .select('id, storage_path, image_data')
      .eq('id', editingDrawingId)
      .single();

    if (drawingError) throw drawingError;

    let imageSource = drawing?.image_data || null;

    if (!imageSource && drawing?.storage_path) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('drawings')
        .createSignedUrl(drawing.storage_path, 60 * 10);

      if (signedError) throw signedError;

      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error('Could not fetch drawing image for editing.');
      const blob = await response.blob();
      imageSource = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not prepare drawing image.'));
        reader.readAsDataURL(blob);
      });
    }

    if (!imageSource) {
      throw new Error('Drawing image is unavailable.');
    }

    const img = new Image();
    img.onload = () => {
      const context = getCtx();
      if (!context) return;

      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const scale = Math.min((canvas.width - 40) / img.width, (canvas.height - 40) / img.height);
      const x = (canvas.width / 2) - (img.width / 2) * scale;
      const y = (canvas.height / 2) - (img.height / 2) * scale;

      context.drawImage(img, x, y, img.width * scale, img.height * scale);
      pushCanvasState();
      showToast('Edit Mode', 'You are editing an existing drawing. Click Save to update it.', 'info');
    };
    img.src = imageSource;
  } catch (error) {
    showToast('Edit Load Failed', error.message || 'Could not load drawing for editing.', 'error');
  }
}
