export function createCanvasHistory({ canvas, getCtx, btnUndo, btnRedo, maxHistoryStates = 30 }) {
  const undoStack = [];
  const redoStack = [];

  const getCanvasState = () => canvas.toDataURL('image/png');

  const updateButtons = () => {
    if (btnUndo) btnUndo.disabled = undoStack.length <= 1;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
  };

  const restore = (state) => {
    const ctx = getCtx();
    if (!state || !ctx) return;

    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = state;
  };

  const push = () => {
    const ctx = getCtx();
    if (!ctx) return;

    const currentState = getCanvasState();
    const lastState = undoStack[undoStack.length - 1];
    if (currentState !== lastState) {
      undoStack.push(currentState);
      if (undoStack.length > maxHistoryStates) {
        undoStack.shift();
      }
      redoStack.length = 0;
      updateButtons();
    }
  };

  const undo = () => {
    if (undoStack.length <= 1) return;
    const currentState = undoStack.pop();
    redoStack.push(currentState);
    const previousState = undoStack[undoStack.length - 1];
    restore(previousState);
    updateButtons();
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack.pop();
    undoStack.push(nextState);
    restore(nextState);
    updateButtons();
  };

  const resetWithCurrentState = () => {
    undoStack.length = 0;
    redoStack.length = 0;
    undoStack.push(getCanvasState());
    updateButtons();
  };

  return {
    push,
    undo,
    redo,
    resetWithCurrentState,
    updateButtons,
    restore
  };
}
