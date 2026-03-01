import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import '../css/style.css';
import { getCurrentUser, signInWithEmail, signOut, signUpWithEmail } from './auth.js';
import { isSupabaseConfigured } from './supabaseClient.js';

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
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
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

async function handleNavbarAuthState() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const loginLink = navbar.querySelector('a[href="/login.html"]');
  const registerLinks = navbar.querySelectorAll('a[href="/register.html"]');
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

  registerLinks.forEach((link) => link.classList.add('d-none'));

  if (guestBadge) {
    guestBadge.classList.remove('bg-warning');
    guestBadge.classList.add('bg-success');
    guestBadge.innerHTML = `<i class="bi bi-person-check"></i> ${user.email}`;
  }
}

function handleLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      showToast('Supabase Not Configured', 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.', 'error');
      return;
    }

    const email = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value || '';

    try {
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
      showToast('Supabase Not Configured', 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.', 'error');
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
});
