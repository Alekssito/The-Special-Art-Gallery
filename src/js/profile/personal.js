import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { attachProfileData } from './personal/profileData.js';
import { attachDrawings } from './personal/drawings.js';
import { attachGalleries } from './personal/galleries.js';
import { attachSharing } from './personal/sharing.js';
import { attachProfileEdits } from './personal/profileEdits.js';
import { attachRenderingAndEvents } from './personal/renderingEvents.js';

export function createProfilePersonalModule({ ui, deps, params }) {
  const { subtitle, drawingsContainer } = ui;
  const {
    supabase,
    isSupabaseConfigured,
    getCurrentUserAuth,
    showToast
  } = deps;

  const state = {
    currentUser: null,
    currentProfile: null,
    drawings: [],
    galleries: [],
    ownedGalleries: [],
    userSearchItems: [],
    imageSrcCache: new Map(),
    avatarSrcCache: new Map(),
    removeAvatarRequested: false,
    adminRenderer: () => {},
    galleryModal: null,
    deleteGalleryModal: null,
    deleteDrawingModal: null,
    shareGalleryModal: null,
    editProfileModal: null
  };

  const ctx = { ui, deps, params, state };

  attachProfileData(ctx);
  attachDrawings(ctx);
  attachGalleries(ctx);
  attachSharing(ctx);
  attachProfileEdits(ctx);
  attachRenderingAndEvents(ctx);

  function setAdminRenderer(renderer) {
    state.adminRenderer = typeof renderer === 'function' ? renderer : () => {};
  }

  function getCurrentUser() {
    return state.currentUser;
  }

  function getCurrentProfile() {
    return state.currentProfile;
  }

  function getCurrentGalleryId() {
    return params.currentGalleryId;
  }

  async function initialize() {
    if (!subtitle || !drawingsContainer) {
      return { ready: false };
    }

    if (!isSupabaseConfigured || !supabase) {
      subtitle.textContent = 'Supabase is not configured in this environment.';
      return { ready: false };
    }

    state.currentUser = await getCurrentUserAuth();
    if (!state.currentUser) {
      showToast('Login Required', 'Please log in to view your profile.', 'info');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 900);
      return { ready: false };
    }

    if (ui.galleryModalElement) {
      state.galleryModal = bootstrap.Modal.getOrCreateInstance(ui.galleryModalElement);

      ui.galleryModalElement.addEventListener('hidden.bs.modal', () => {
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
      });
    }

    if (ui.deleteGalleryModalElement) {
      state.deleteGalleryModal = bootstrap.Modal.getOrCreateInstance(ui.deleteGalleryModalElement);
    }

    if (ui.deleteDrawingModalElement) {
      state.deleteDrawingModal = bootstrap.Modal.getOrCreateInstance(ui.deleteDrawingModalElement);
    }

    if (ui.shareGalleryModalElement) {
      state.shareGalleryModal = bootstrap.Modal.getOrCreateInstance(ui.shareGalleryModalElement);
    }

    if (ui.editProfileModalElement) {
      state.editProfileModal = bootstrap.Modal.getOrCreateInstance(ui.editProfileModalElement);
    }

    ctx.bindEvents();
    return { ready: true };
  }

  return {
    initialize,
    setAdminRenderer,
    getCurrentUser,
    getCurrentProfile,
    getCurrentGalleryId,
    isAdminDashboardView: params.isAdminDashboardView,
    resolveAvatarSrc: ctx.resolveAvatarSrc,
    resolveImageSrc: ctx.resolveImageSrc,
    getFileExtension: ctx.getFileExtension,
    loadCurrentProfile: ctx.loadCurrentProfile,
    setProfileHeader: ctx.setProfileHeader,
    refreshNavbarProfileButtonAvatar: ctx.refreshNavbarProfileButtonAvatar,
    loadData: ctx.loadData,
    deleteGallery: ctx.deleteGallery,
    confirmGalleryDelete: ctx.confirmGalleryDelete,
    confirmDrawingDelete: ctx.confirmDrawingDelete,
    renderUserSearchResults: ctx.renderUserSearchResults,
    renderPage: ctx.renderPage
  };
}
