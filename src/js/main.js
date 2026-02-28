import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import '../css/style.css';

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
