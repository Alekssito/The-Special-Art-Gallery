import { getCurrentUser } from '../auth.js';
import { showToast } from '../main.js';
import { navigateTo } from '../navigation.js';
import { isSupabaseConfigured, supabase } from '../supabaseClient.js';
import { createAdminDashboardModule } from './admin.js';
import { createProfilePersonalModule } from './personal.js';

document.addEventListener('DOMContentLoaded', async () => {
  const searchParams = new URLSearchParams(window.location.search);
  const currentGalleryId = searchParams.get('gallery');
  const isAdminDashboardView = searchParams.get('admin') === '1';

  const ui = {
    subtitle: document.getElementById('profileSubtitle'),
    drawingsContainer: document.getElementById('profileDrawings'),
    profileUsername: document.getElementById('profileUsername'),
    profileTitleText: document.getElementById('profileTitleText'),
    profileModeBadge: document.getElementById('profileModeBadge'),
    profileTitleAvatar: document.getElementById('profileTitleAvatar'),
    profileTitleAvatarFallback: document.getElementById('profileTitleAvatarFallback'),
    editProfileButton: document.getElementById('btnEditProfile'),
    privacyToggle: document.getElementById('privacyToggle'),
    shareUserSearch: document.getElementById('shareUserSearch'),
    searchUsersButton: document.getElementById('btnSearchUsers'),
    shareSearchResults: document.getElementById('shareSearchResults'),
    galleriesContainer: document.getElementById('profileGalleries'),
    galleriesSection: document.getElementById('galleriesSection'),
    personalProfileSection: document.getElementById('personalProfileSection'),
    createGalleryButton: document.getElementById('btnCreateGallery'),
    backToProfileButton: document.getElementById('btnBackToProfile'),
    goToAdminDashboardButton: document.getElementById('btnGoToAdminDashboard'),
    galleryModalElement: document.getElementById('galleryModal'),
    galleryModalTitle: document.getElementById('galleryModalLabel'),
    galleryIdInput: document.getElementById('galleryIdInput'),
    galleryNameInput: document.getElementById('galleryNameInput'),
    galleryDrawingSelection: document.getElementById('galleryDrawingSelection'),
    saveGalleryButton: document.getElementById('btnSaveGallery'),
    deleteGalleryModalElement: document.getElementById('deleteGalleryModal'),
    confirmDeleteGalleryButton: document.getElementById('btnConfirmDeleteGallery'),
    deleteDrawingModalElement: document.getElementById('deleteDrawingModal'),
    confirmDeleteDrawingButton: document.getElementById('btnConfirmDeleteDrawing'),
    shareGalleryModalElement: document.getElementById('shareGalleryModal'),
    shareTargetUserId: document.getElementById('shareTargetUserId'),
    shareTargetUsername: document.getElementById('shareTargetUsername'),
    shareGallerySelection: document.getElementById('shareGallerySelection'),
    saveShareSelectionButton: document.getElementById('btnSaveShareSelection'),
    editProfileModalElement: document.getElementById('editProfileModal'),
    editProfileUsernameInput: document.getElementById('editProfileUsername'),
    editProfileAvatarFileInput: document.getElementById('editProfileAvatarFile'),
    editProfileAvatarPreview: document.getElementById('editProfileAvatarPreview'),
    editProfileAvatarFallback: document.getElementById('editProfileAvatarFallback'),
    removeProfilePictureButton: document.getElementById('btnRemoveProfilePicture'),
    saveProfileButton: document.getElementById('btnSaveProfile'),
    adminDashboardSection: document.getElementById('adminDashboardSection'),
    refreshAdminDashboardButton: document.getElementById('btnRefreshAdminDashboard'),
    adminUsersCount: document.getElementById('adminUsersCount'),
    adminGalleriesCount: document.getElementById('adminGalleriesCount'),
    adminDrawingsCount: document.getElementById('adminDrawingsCount'),
    adminUsersList: document.getElementById('adminUsersList'),
    adminGalleriesList: document.getElementById('adminGalleriesList'),
    adminDrawingsList: document.getElementById('adminDrawingsList')
  };

  const personalModule = createProfilePersonalModule({
    ui,
    deps: {
      supabase,
      isSupabaseConfigured,
      getCurrentUserAuth: getCurrentUser,
      showToast
    },
    params: {
      currentGalleryId,
      isAdminDashboardView
    }
  });

  const initResult = await personalModule.initialize();
  if (!initResult.ready) return;

  const adminDashboardModule = createAdminDashboardModule({
    supabase,
    showToast,
    getCurrentProfile: personalModule.getCurrentProfile,
    getCurrentUser: personalModule.getCurrentUser,
    getCurrentGalleryId: personalModule.getCurrentGalleryId,
    isAdminDashboardView: personalModule.isAdminDashboardView,
    resolveAvatarSrc: personalModule.resolveAvatarSrc,
    resolveImageSrc: personalModule.resolveImageSrc,
    getFileExtension: personalModule.getFileExtension,
    loadCurrentProfile: personalModule.loadCurrentProfile,
    setProfileHeader: personalModule.setProfileHeader,
    refreshNavbarProfileButtonAvatar: personalModule.refreshNavbarProfileButtonAvatar,
    loadData: personalModule.loadData,
    renderPage: personalModule.renderPage,
    deleteGallery: personalModule.deleteGallery,
    confirmGalleryDelete: personalModule.confirmGalleryDelete,
    confirmDrawingDelete: personalModule.confirmDrawingDelete,
    ui: {
      adminDashboardSection: ui.adminDashboardSection,
      adminUsersCount: ui.adminUsersCount,
      adminGalleriesCount: ui.adminGalleriesCount,
      adminDrawingsCount: ui.adminDrawingsCount,
      adminUsersList: ui.adminUsersList,
      adminGalleriesList: ui.adminGalleriesList,
      adminDrawingsList: ui.adminDrawingsList,
      deleteGalleryModalElement: ui.deleteGalleryModalElement,
      confirmDeleteGalleryButton: ui.confirmDeleteGalleryButton,
      deleteDrawingModalElement: ui.deleteDrawingModalElement,
      confirmDeleteDrawingButton: ui.confirmDeleteDrawingButton
    }
  });

  personalModule.setAdminRenderer(() => {
    adminDashboardModule.renderAdminDashboard();
  });

  ui.refreshAdminDashboardButton?.addEventListener('click', async () => {
    try {
      await personalModule.loadCurrentProfile();
      await personalModule.setProfileHeader();
      await personalModule.refreshNavbarProfileButtonAvatar();
      await personalModule.loadData();
      await adminDashboardModule.loadAdminData();
      personalModule.renderPage();
      showToast('Dashboard Refreshed', 'Admin dashboard data is up to date.', 'success');
    } catch (error) {
      showToast('Refresh Failed', error.message || 'Could not refresh admin dashboard.', 'error');
    }
  });

  await personalModule.loadCurrentProfile();
  if (isAdminDashboardView && personalModule.getCurrentProfile()?.is_admin !== true) {
    showToast('Access Denied', 'Only admins can access the admin dashboard.', 'error');
    navigateTo('profile');
    return;
  }

  await personalModule.setProfileHeader();
  await personalModule.refreshNavbarProfileButtonAvatar();
  await personalModule.loadData();
  await adminDashboardModule.loadAdminData();
  personalModule.renderUserSearchResults();
  personalModule.renderPage();
});
