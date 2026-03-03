// Initialize drawing page interactions
import { showToast } from '../main.js';
import { getCurrentUser } from '../auth.js';
import { isSupabaseConfigured, supabase } from '../supabaseClient.js';
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { createCanvasHistory } from './history.js';
import { createSaveGalleryChoicePrompt, loadDrawingForEditing, saveDrawingFromCanvas } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const canvas = document.getElementById('mainCanvas');
  const canvasContainer = document.getElementById('canvasContainer');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValue = document.getElementById('sizeValue');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  const opacityControlGroup = document.getElementById('opacityControlGroup');
  const colorPicker = document.getElementById('colorPicker');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnClear = document.getElementById('btnClear');
  const btnDownload = document.getElementById('btnDownload');
  const btnSave = document.getElementById('btnSave');
  const uploadImage = document.getElementById('uploadImage');
  const saveGalleryChoiceModalElement = document.getElementById('saveGalleryChoiceModal');
  const saveGallerySelect = document.getElementById('saveGallerySelect');
  const btnConfirmSaveChoice = document.getElementById('btnConfirmSaveChoice');
  const searchParams = new URLSearchParams(window.location.search);
  const editingDrawingId = searchParams.get('edit');
  const authOnlyElements = document.querySelectorAll('.auth-only-feature');

  let ctx = null;
  let isAuthenticatedUser = false;
  const history = createCanvasHistory({
    canvas,
    getCtx: () => ctx,
    btnUndo,
    btnRedo,
    maxHistoryStates: 30
  });

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

    history.resetWithCurrentState();
  }

  initCanvas();
  // Optional: re-init on resize, but that might clear the drawing. 
  // We'll leave it as is for UI stage.

  const promptGallerySaveChoice = createSaveGalleryChoicePrompt({
    bootstrap,
    saveGalleryChoiceModalElement,
    saveGallerySelect,
    btnConfirmSaveChoice
  });

  // 1. Thickness slider UI update
  sizeSlider.addEventListener('input', (e) => {
    sizeValue.textContent = `${e.target.value}px`;
  });

  // 2. Clear Button
  btnClear.addEventListener('click', () => {
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      history.push();
      showToast('Canvas Cleared', 'Your canvas has been reset.', 'success');
    }
  });

  if (btnUndo) {
    btnUndo.addEventListener('click', history.undo);
  }

  if (btnRedo) {
    btnRedo.addEventListener('click', history.redo);
  }

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
    await saveDrawingFromCanvas({
      canvas,
      editingDrawingId,
      isSupabaseConfigured,
      supabase,
      getCurrentUser,
      showToast,
      promptGallerySaveChoice
    });
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
          history.push();
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
  let brushOpacity = 1;
  let selectedColor = '#000000';
  let prevMouseX, prevMouseY;
  let lastFreehandX, lastFreehandY;
  let snapshot;

  function hexToRgba(hex, alpha) {
    const normalizedHex = hex.replace('#', '');
    const r = Number.parseInt(normalizedHex.slice(0, 2), 16);
    const g = Number.parseInt(normalizedHex.slice(2, 4), 16);
    const b = Number.parseInt(normalizedHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  async function configureAuthOnlyCanvasFeatures() {
    const user = await getCurrentUser();
    isAuthenticatedUser = Boolean(user);

    if (!isAuthenticatedUser) {
      authOnlyElements.forEach((element) => {
        element.classList.add('d-none');
      });
      if (opacityControlGroup) {
        opacityControlGroup.classList.add('d-none');
      }
      return;
    }

    authOnlyElements.forEach((element) => {
      element.classList.remove('d-none');
    });
    if (opacityControlGroup) {
      opacityControlGroup.classList.remove('d-none');
    }
  }

  function getShapeConfig(shapeId) {
    if (shapeId === 'shapeLine') return { tool: 'line', name: 'Line', icon: 'bi-slash-lg', authOnly: false };
    if (shapeId === 'shapeRect') return { tool: 'rect', name: 'Rectangle', icon: 'bi-square', authOnly: false };
    if (shapeId === 'shapeCircle') return { tool: 'circle', name: 'Circle', icon: 'bi-circle', authOnly: false };
    if (shapeId === 'shapeStar') return { tool: 'star', name: 'Star', icon: 'bi-star', authOnly: true };
    if (shapeId === 'shapeEllipse') return { tool: 'ellipse', name: 'Ellipse', icon: 'shape-icon-ellipse', authOnly: true };
    if (shapeId === 'shapeCurve') return { tool: 'curve', name: 'Curve', icon: 'bi-bezier2', authOnly: true };
    return null;
  }

  // Tools Selection UI
  const toolRadios = document.querySelectorAll('input[name="tools"]');
  toolRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.id === 'toolPencil') selectedTool = 'pencil';
      else if (e.target.id === 'toolEraser') selectedTool = 'eraser';
    });
  });

  // Shape drop-downs
  const shapeIds = ['shapeLine', 'shapeRect', 'shapeCircle', 'shapeStar', 'shapeEllipse', 'shapeCurve'];
  const shapeBtnText = document.querySelector('#btnGroupDropShapes span.d-none.d-md-inline');
  const shapeBtnIcon = document.querySelector('#btnGroupDropShapes i');
  
  shapeIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();

        const shapeConfig = getShapeConfig(id);
        if (!shapeConfig) return;

        if (shapeConfig.authOnly && !isAuthenticatedUser) {
          showToast('Login Required', 'This shape is available for logged-in users only.', 'info');
          return;
        }
        
        // Uncheck pencil and eraser radio buttons
        toolRadios.forEach(radio => radio.checked = false);

        selectedTool = shapeConfig.tool;
        
        // Update shape button text and icon
        if (shapeBtnText) shapeBtnText.textContent = shapeConfig.name;
        if (shapeBtnIcon) {
          shapeBtnIcon.className = '';
          if (shapeConfig.icon === 'shape-icon-ellipse') {
            shapeBtnIcon.classList.add('shape-icon-ellipse');
          } else {
            shapeBtnIcon.classList.add('bi', shapeConfig.icon);
          }
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

  if (opacitySlider && opacityValue) {
    opacitySlider.addEventListener('input', (e) => {
      const value = Number.parseInt(e.target.value, 10);
      brushOpacity = value / 100;
      opacityValue.textContent = `${value}%`;
    });
  }

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

  const drawEllipse = (e) => {
    const coords = getCoordinates(e);
    const centerX = (prevMouseX + coords.x) / 2;
    const centerY = (prevMouseY + coords.y) / 2;
    const radiusX = Math.abs(coords.x - prevMouseX) / 2;
    const radiusY = Math.abs(coords.y - prevMouseY) / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const drawStar = (e) => {
    const coords = getCoordinates(e);
    const deltaX = coords.x - prevMouseX;
    const deltaY = coords.y - prevMouseY;
    const outerRadius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const innerRadius = outerRadius * 0.45;
    const spikes = 5;
    const step = Math.PI / spikes;

    ctx.beginPath();
    for (let index = 0; index < spikes * 2; index += 1) {
      const isOuterPoint = index % 2 === 0;
      const radius = isOuterPoint ? outerRadius : innerRadius;
      const angle = (index * step) - (Math.PI / 2);
      const x = prevMouseX + Math.cos(angle) * radius;
      const y = prevMouseY + Math.sin(angle) * radius;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.stroke();
  };

  const drawCurve = (e) => {
    const coords = getCoordinates(e);
    const midX = (prevMouseX + coords.x) / 2;
    const midY = (prevMouseY + coords.y) / 2;
    const deltaX = coords.x - prevMouseX;
    const deltaY = coords.y - prevMouseY;
    const curveOffset = Math.sqrt(deltaX * deltaX + deltaY * deltaY) * 0.3;
    const controlX = midX - deltaY * 0.25;
    const controlY = midY + deltaX * 0.25 - curveOffset * 0.2;

    ctx.beginPath();
    ctx.moveTo(prevMouseX, prevMouseY);
    ctx.quadraticCurveTo(controlX, controlY, coords.x, coords.y);
    ctx.stroke();
  };

  const startDraw = (e) => {
    if (e.type === 'touchstart') e.preventDefault();
    isDrawing = true;
    const coords = getCoordinates(e);
    prevMouseX = coords.x;
    prevMouseY = coords.y;
    lastFreehandX = coords.x;
    lastFreehandY = coords.y;
    
    // Create new path to not connect previous lines
    ctx.beginPath();
    ctx.lineWidth = brushWidth;
    const drawColor = selectedTool === 'eraser'
      ? 'rgba(255, 255, 255, 1)'
      : hexToRgba(selectedColor, brushOpacity);
    ctx.strokeStyle = drawColor;
    ctx.fillStyle = drawColor;
    
    // Fix for line endings and joins to make it smoother
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (selectedTool === 'pencil' || selectedTool === 'eraser') {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, Math.max(brushWidth / 2, 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    
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
      const deltaX = coords.x - lastFreehandX;
      const deltaY = coords.y - lastFreehandY;
      const movedDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (movedDistance < 0.25) {
        return;
      }

      ctx.beginPath();
      ctx.moveTo(lastFreehandX, lastFreehandY);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      lastFreehandX = coords.x;
      lastFreehandY = coords.y;
    } else if (selectedTool === 'rect') {
      drawRect(e);
    } else if (selectedTool === 'circle') {
      drawCircle(e);
    } else if (selectedTool === 'line') {
      drawLine(e);
    } else if (selectedTool === 'star') {
      drawStar(e);
    } else if (selectedTool === 'ellipse') {
      drawEllipse(e);
    } else if (selectedTool === 'curve') {
      drawCurve(e);
    }
  };

  const stopDraw = () => {
    if (isDrawing) {
      history.push();
    }
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

  configureAuthOnlyCanvasFeatures();
  loadDrawingForEditing({
    editingDrawingId,
    isSupabaseConfigured,
    supabase,
    getCurrentUser,
    canvas,
    getCtx: () => ctx,
    pushCanvasState: history.push,
    showToast
  });

  showToast('Welcome to the Canvas!', 'Draw and edit with tools. Log in for advanced shapes and opacity control.', 'info');
});
