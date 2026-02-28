// Initialize drawing page interactions
import { showToast } from './main.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const canvas = document.getElementById('mainCanvas');
  const canvasContainer = document.getElementById('canvasContainer');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValue = document.getElementById('sizeValue');
  const colorPicker = document.getElementById('colorPicker');
  const btnClear = document.getElementById('btnClear');
  const btnDownload = document.getElementById('btnDownload');
  const btnSave = document.getElementById('btnSave');
  const uploadImage = document.getElementById('uploadImage');

  let ctx = null;

  // Setup Canvas
  function initCanvas() {
    // Make the canvas resize to the container, leaving a small margin
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width = rect.width - 20;
    canvas.height = rect.height - 20;

    ctx = canvas.getContext('2d');
    
    // Fill with white background initially
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  initCanvas();
  // Optional: re-init on resize, but that might clear the drawing. 
  // We'll leave it as is for UI stage.

  // 1. Thickness slider UI update
  sizeSlider.addEventListener('input', (e) => {
    sizeValue.textContent = `${e.target.value}px`;
  });

  // 2. Clear Button
  btnClear.addEventListener('click', () => {
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      showToast('Canvas Cleared', 'Your canvas has been reset.', 'success');
    }
  });

  // 3. Download Button
  btnDownload.addEventListener('click', () => {
    // Guest users can download
    try {
      const dataURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = 'my-special-drawing.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('Downloaded!', 'Your masterpiece has been saved to your device.', 'success');
    } catch (e) {
      showToast('Download Error', 'Could not download the image.', 'error');
    }
  });

  // 4. Save Button (Requires Account - Guest behavior)
  btnSave.addEventListener('click', () => {
    showToast(
      'Account Required', 
      'Creating galleries and saving drawings to the cloud requires an account. <a href="/register.html" class="fw-bold text-decoration-underline" style="color: inherit;">Sign up here</a>!', 
      'info'
    );
  });

  // 5. Upload Image
  uploadImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Draw the uploaded image onto the canvas center
          // Clear first
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Calculate aspect ratio
          const scale = Math.min((canvas.width - 40) / img.width, (canvas.height - 40) / img.height);
          const x = (canvas.width / 2) - (img.width / 2) * scale;
          const y = (canvas.height / 2) - (img.height / 2) * scale;
          
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          showToast('Image Uploaded', 'Your image is ready to be edited!', 'success');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } else if (file) {
      showToast('Invalid File', 'Please upload a valid image file (.jpg, .png)', 'error');
    }
    // reset input
    e.target.value = '';
  });

  // Tools Selection UI Feedback
  const toolRadios = document.querySelectorAll('input[name="tools"]');
  toolRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      // Logic for drawing will be implemented later
      showToast('Tool Selected', `You selected the ${e.target.id.replace('tool', '')} tool.`, 'info');
    });
  });

  // Shape drop-downs
  const shapeIds = ['shapeLine', 'shapeRect', 'shapeCircle'];
  shapeIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Shape Selected', `You selected the ${id.replace('shape', '')} shape tool.`, 'info');
      });
    }
  });

  showToast('Welcome to the Canvas!', 'Drawing is disabled in this phase. Feel free to explore the tools and UI!', 'info');
});
