// Initialize drawing page interactions
import { showToast } from './main.js';
import { getCurrentUser } from './auth.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';

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

  // 4. Save Button (Authenticated users only)
  btnSave.addEventListener('click', async () => {
    if (!isSupabaseConfigured || !supabase) {
      showToast('Supabase Not Configured', 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.', 'error');
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
      const imageDataUrl = canvas.toDataURL('image/png');
      const title = `Drawing ${new Date().toISOString()}`;

      const { error } = await supabase.from('drawings').insert({
        user_id: user.id,
        title,
        image_data: imageDataUrl
      });

      if (error) throw error;
      showToast('Saved', 'Your drawing has been saved to your account.', 'success');
    } catch (error) {
      showToast('Save Failed', error.message || 'Could not save drawing.', 'error');
    }
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

  // State variables for drawing
  let isDrawing = false;
  let selectedTool = 'pencil';
  let brushWidth = 5;
  let selectedColor = '#000000';
  let prevMouseX, prevMouseY;
  let snapshot;

  // Tools Selection UI
  const toolRadios = document.querySelectorAll('input[name="tools"]');
  toolRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.id === 'toolPencil') selectedTool = 'pencil';
      else if (e.target.id === 'toolEraser') selectedTool = 'eraser';
    });
  });

  // Shape drop-downs
  const shapeIds = ['shapeLine', 'shapeRect', 'shapeCircle'];
  const shapeBtnText = document.querySelector('#btnGroupDropShapes span.d-none.d-md-inline');
  const shapeBtnIcon = document.querySelector('#btnGroupDropShapes i');
  
  shapeIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Uncheck pencil and eraser radio buttons
        toolRadios.forEach(radio => radio.checked = false);
        
        let toolName = 'Shape';
        let iconClass = 'bi-square';
        
        if (id === 'shapeLine') {
          selectedTool = 'line';
          toolName = 'Line';
          iconClass = 'bi-slash-lg';
        } else if (id === 'shapeRect') {
          selectedTool = 'rect';
          toolName = 'Rectangle';
          iconClass = 'bi-square';
        } else if (id === 'shapeCircle') {
          selectedTool = 'circle';
          toolName = 'Circle';
          iconClass = 'bi-circle';
        }
        
        // Update shape button text and icon
        if (shapeBtnText) shapeBtnText.textContent = toolName;
        if (shapeBtnIcon) {
          shapeBtnIcon.className = '';
          shapeBtnIcon.classList.add('bi', iconClass);
        }
      });
    }
  });
  
  // When clicking on pencil or eraser, reset shape button if it was used
  toolRadios.forEach(radio => {
    radio.addEventListener('click', () => {
      if (shapeBtnText) shapeBtnText.textContent = 'Shapes';
      if (shapeBtnIcon) {
        shapeBtnIcon.className = '';
        shapeBtnIcon.classList.add('bi', 'bi-square');
      }
    });
  });

  // Color selection
  colorPicker.addEventListener('input', (e) => {
    selectedColor = e.target.value;
  });

  // Size selection
  sizeSlider.addEventListener('input', (e) => {
    brushWidth = parseInt(e.target.value, 10);
    sizeValue.textContent = `${brushWidth}px`;
  });

  // Drawing Logic
  const setCanvasBackground = () => {
    // Fill background so it's not transparent when downloaded
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Restore default fillStyle to selected color
    ctx.fillStyle = selectedColor;
  };
  
  // Call initially to ensure white background
  // setCanvasBackground() is handled in initCanvas, but just to be safe it's good practice.

  const getCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.offsetX,
      y: e.offsetY
    };
  };

  const drawRect = (e) => {
    const coords = getCoordinates(e);
    // strokeRect(x, y, width, height)
    ctx.strokeRect(prevMouseX, prevMouseY, coords.x - prevMouseX, coords.y - prevMouseY);
  };
  
  const drawCircle = (e) => {
    const coords = getCoordinates(e);
    ctx.beginPath();
    // Calculate radius based on mouse distance
    const radius = Math.sqrt(Math.pow((prevMouseX - coords.x), 2) + Math.pow((prevMouseY - coords.y), 2));
    ctx.arc(prevMouseX, prevMouseY, radius, 0, 2 * Math.PI);
    ctx.stroke();
  };
  
  const drawLine = (e) => {
    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(prevMouseX, prevMouseY);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const startDraw = (e) => {
    if (e.type === 'touchstart') e.preventDefault();
    isDrawing = true;
    const coords = getCoordinates(e);
    prevMouseX = coords.x;
    prevMouseY = coords.y;
    
    // Create new path to not connect previous lines
    ctx.beginPath();
    ctx.lineWidth = brushWidth;
    ctx.strokeStyle = selectedTool === 'eraser' ? 'white' : selectedColor;
    ctx.fillStyle = selectedTool === 'eraser' ? 'white' : selectedColor;
    
    // Fix for line endings and joins to make it smoother
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Save image data to restore when drawing shapes (so you can see it previewing without stacking)
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  };

  const drawing = (e) => {
    if (!isDrawing) return;
    if (e.type === 'touchmove') e.preventDefault();
    
    const coords = getCoordinates(e);
    
    // For shapes, we need to constantly restore canvas to previous state so it doesn't draw multiple shapes
    if (selectedTool !== 'pencil' && selectedTool !== 'eraser') {
      ctx.putImageData(snapshot, 0, 0);
    }
    
    if (selectedTool === 'pencil' || selectedTool === 'eraser') {
      // Draw line from transparently previously stored x,y to current
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (selectedTool === 'rect') {
      drawRect(e);
    } else if (selectedTool === 'circle') {
      drawCircle(e);
    } else if (selectedTool === 'line') {
      drawLine(e);
    }
  };

  const stopDraw = () => {
    isDrawing = false;
  };

  // Canvas Event Listeners
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', drawing);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseout', stopDraw);
  
  // Add touch support directly
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', drawing, { passive: false });
  canvas.addEventListener('touchend', stopDraw);

  showToast('Welcome to the Canvas!', 'You can now draw, erase, and create shapes!', 'info');
});
