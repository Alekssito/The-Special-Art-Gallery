import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import '../css/style.css';
import { getCurrentUser, signInWithEmail, signOut, signUpWithEmail } from './auth.js';
import { getRememberMePreference, isSupabaseConfigured, setRememberMePreference, supabase } from './supabaseClient.js';

/**
 * Utility function to show Toast notifications dynamically
 * @param {string} title 
 * @param {string} message 
 * @param {string} type 'success', 'error', 'info'
 */
export function showToast(title, message, type = 'success') {
  // Define icons based on type
  const icons = {
    success: '<i class="bi bi-check-circle-fill text-success"></i>',
    error: '<i class="bi bi-x-circle-fill text-danger"></i>',
    info: '<i class="bi bi-info-circle-fill text-primary"></i>'
  };

  // Check if a toast container exists, create one if not
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container position-fixed p-3';
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toastEl = document.createElement('div');
  toastEl.className = `toast custom-toast`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  toastEl.innerHTML = `
    <div class="toast-header border-0">
      ${icons[type] || icons.info}
      <strong class="me-auto ms-2">${title}</strong>
      <small>Just now</small>
      <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;

  // Append to container
  toastContainer.appendChild(toastEl);

  // Initialize and show toast via Bootstrap JS api
  const bootstrapToast = new bootstrap.Toast(toastEl, {
    autohide: true,
    delay: 4000
  });
  
  bootstrapToast.show();

  // Remove element after it's hidden
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

// Make globally available for inline scripts if necessary
window.showToast = showToast;

function getPathnameFromLink(link) {
  const href = link?.getAttribute('href') || '';
  if (!href) return '';

  try {
    const url = new URL(href, window.location.origin);
    const pathname = url.pathname.toLowerCase();
    if (pathname.length > 1 && pathname.endsWith('/')) {
      return pathname.slice(0, -1);
    }
    return pathname;
  } catch {
    return href.toLowerCase();
  }
}

function isPathMatch(pathname, candidates) {
  return candidates.includes(pathname);
}

async function handleNavbarAuthState() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const navbarLinks = Array.from(navbar.querySelectorAll('a[href]'));
  const allPageLinks = Array.from(document.querySelectorAll('a[href]'));

  const loginLink = navbarLinks.find((link) => {
    const pathname = getPathnameFromLink(link);
    const label = link.textContent?.trim().toLowerCase() || '';
    return isPathMatch(pathname, ['/login', '/login.html']) || label === 'login' || label === 'logout';
  });

  const accountLinks = allPageLinks.filter((link) => {
    const pathname = getPathnameFromLink(link);
    const label = link.textContent?.trim().toLowerCase() || '';
    return (
      isPathMatch(pathname, ['/register', '/register.html', '/profile', '/profile.html']) ||
      label.includes('sign up') ||
      label.includes('create an account') ||
      label.includes('my profile')
    );
  });

  const guestBadge = navbar.querySelector('.badge');

  const user = await getCurrentUser();
  if (!user) {
    if (guestBadge) {
      guestBadge.classList.remove('bg-success');
      guestBadge.classList.add('bg-warning');
      guestBadge.innerHTML = '<i class="bi bi-person-circle"></i> Guest Mode';
    }
    return;
  }

  if (loginLink) {
    loginLink.textContent = 'Logout';
    loginLink.setAttribute('href', '#');
    if (!loginLink.dataset.logoutBound) {
      loginLink.dataset.logoutBound = '1';
      loginLink.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          await signOut();
          showToast('Logged Out', 'You have been signed out.', 'success');
          setTimeout(() => {
            window.location.href = '/';
          }, 700);
        } catch (error) {
          showToast('Logout Failed', error.message || 'Could not sign out.', 'error');
        }
      });
    }
  }

  let displayUsername = user.email ? user.email.split('@')[0] : 'artist';
  let avatarUrl = '';
  let isAdmin = false;

  if (supabase) {
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('username, avatar_path, is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    isAdmin = profileData?.is_admin === true;

    if (profileData?.username?.trim()) {
      displayUsername = profileData.username.trim();
    } else {
      const usernameFromMetadata = user.user_metadata?.username?.trim();
      if (usernameFromMetadata) {
        displayUsername = usernameFromMetadata;
      }
    }

    if (profileData?.avatar_path) {
      const { data: avatarData } = await supabase.storage
        .from('profile-pictures')
        .createSignedUrl(profileData.avatar_path, 60 * 10);

      avatarUrl = avatarData?.signedUrl || '';
    }
  }

  accountLinks.forEach((link) => {
    link.setAttribute('href', '/profile.html');
    const label = link.textContent?.trim().toLowerCase() || '';
    if (label.includes('sign up') || label.includes('create an account')) {
      link.textContent = 'My Profile';
    }

    if (link.classList.contains('btn-accent')) {
      link.innerHTML = avatarUrl
        ? `<img src="${avatarUrl}" alt="Profile picture" class="profile-nav-avatar me-2"> My Profile`
        : '<i class="bi bi-person-circle me-2"></i> My Profile';
    }
  });

  if (guestBadge) {
    guestBadge.classList.remove('bg-warning');
    guestBadge.classList.remove('bg-success');
    guestBadge.classList.remove('bg-danger');
    guestBadge.classList.add(isAdmin ? 'bg-danger' : 'bg-success');
    guestBadge.innerHTML = isAdmin
      ? `<i class="bi bi-shield-lock-fill"></i> Admin Mode • ${displayUsername}`
      : `<i class="bi bi-person-check"></i> User Mode • ${displayUsername}`;
    guestBadge.style.cursor = 'pointer';
    guestBadge.setAttribute('title', 'Go to profile');
    guestBadge.setAttribute('role', 'link');
    guestBadge.setAttribute('tabindex', '0');
    if (!guestBadge.dataset.profileBound) {
      guestBadge.dataset.profileBound = '1';
      guestBadge.addEventListener('click', () => {
        window.location.href = '/profile.html';
      });
      guestBadge.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.href = '/profile.html';
        }
      });
    }
  }
}

function handleLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  const rememberMeCheckbox = document.getElementById('rememberMe');
  if (rememberMeCheckbox) {
    rememberMeCheckbox.checked = getRememberMePreference();
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      showToast('Supabase Not Configured', 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) first.', 'error');
      return;
    }

    const email = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value || '';
    const rememberMe = document.getElementById('rememberMe')?.checked ?? true;

    try {
      setRememberMePreference(rememberMe);
      await signInWithEmail({ email, password });
      showToast('Login Successful', 'Welcome back! Redirecting to canvas...', 'success');
      setTimeout(() => {
        window.location.href = '/draw.html';
      }, 900);
    } catch (error) {
      showToast('Login Failed', error.message || 'Invalid credentials.', 'error');
    }
  });
}

function handleRegisterForm() {
  const registerForm = document.getElementById('registerForm');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      showToast('Supabase Not Configured', 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) first.', 'error');
      return;
    }

    const username = document.getElementById('username')?.value?.trim() || '';
    const email = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value || '';
    const confirmPassword = document.getElementById('confirm_password')?.value || '';

    if (password !== confirmPassword) {
      showToast('Password Mismatch', 'Password and confirm password must match.', 'error');
      return;
    }

    try {
      const data = await signUpWithEmail({ email, password, username });
      if (data.session) {
        showToast('Account Created', 'Registration complete. Redirecting to canvas...', 'success');
        setTimeout(() => {
          window.location.href = '/draw.html';
        }, 900);
        return;
      }

      showToast('Check Your Email', 'Your account was created. Verify your email, then log in.', 'info');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1400);
    } catch (error) {
      showToast('Registration Failed', error.message || 'Unable to create account.', 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  handleLoginForm();
  handleRegisterForm();
  await handleNavbarAuthState();

  if (supabase) {
    supabase.auth.onAuthStateChange(() => {
      void handleNavbarAuthState();
    });
  }
});
