const TILE = 32;
const MIN_IMAGE_SIZE = 1;
const MAX_IMAGE_SIZE = 8192;
const SURFACE_PAD = 420;

const elements = {
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  stage: document.getElementById("canvasStage"),
  canvas: document.getElementById("previewCanvas"),
  emptyState: document.getElementById("emptyState"),
  imageSize: document.getElementById("imageSize"),
  currentImageSize: document.getElementById("currentImageSize"),
  pendingImageSize: document.getElementById("pendingImageSize"),
  tileCount: document.getElementById("tileCount"),
  exportSize: document.getElementById("exportSize"),
  resizeImageBtn: document.getElementById("resizeImageBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  maxBtn: document.getElementById("maxBtn"),
  centerBtn: document.getElementById("centerBtn"),
  quickSizes: document.getElementById("quickSizes"),
  inputs: {
    x: document.getElementById("xInput"),
    y: document.getElementById("yInput"),
    w: document.getElementById("wInput"),
    h: document.getElementById("hInput")
  }
};

const ctx = elements.canvas.getContext("2d", { willReadFrequently: false });

const state = {
  image: null,
  imageName: "tiles",
  imageRect: { x: 0, y: 0, w: 0, h: 0 },
  selection: { x: 0, y: 0, w: 0, h: 0 },
  pointer: null,
  zoom: 1,
  spaceDown: false,
  pan: null
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const snapTile = (value) => Math.max(TILE, Math.floor(value / TILE) * TILE);

function isPendingResize() {
  return Boolean(state.image) && (
    state.imageRect.w !== state.image.width ||
    state.imageRect.h !== state.image.height
  );
}

function getImageWidth() {
  return Math.max(MIN_IMAGE_SIZE, Math.round(state.imageRect.w));
}

function getImageHeight() {
  return Math.max(MIN_IMAGE_SIZE, Math.round(state.imageRect.h));
}

function setControlsEnabled(enabled) {
  elements.downloadBtn.disabled = !enabled;
  elements.maxBtn.disabled = !enabled;
  elements.centerBtn.disabled = !enabled;
  elements.resizeImageBtn.disabled = !enabled;
  Object.values(elements.inputs).forEach((input) => {
    input.disabled = !enabled;
  });
}

function normalizeSelection(next) {
  if (!state.image) return { x: 0, y: 0, w: 0, h: 0 };

  const imageW = getImageWidth();
  const imageH = getImageHeight();
  const maxW = Math.floor(imageW / TILE) * TILE;
  const maxH = Math.floor(imageH / TILE) * TILE;
  const w = clamp(snapTile(next.w), maxW > 0 ? TILE : 0, maxW);
  const h = clamp(snapTile(next.h), maxH > 0 ? TILE : 0, maxH);
  const x = clamp(Math.round(next.x), 0, Math.max(0, imageW - w));
  const y = clamp(Math.round(next.y), 0, Math.max(0, imageH - h));

  return { x, y, w, h };
}

function setSelection(next) {
  state.selection = normalizeSelection(next);
  syncControls();
  draw();
}

function syncControls() {
  const { x, y, w, h } = state.selection;
  elements.inputs.x.value = x;
  elements.inputs.y.value = y;
  elements.inputs.w.value = w;
  elements.inputs.h.value = h;

  const columns = Math.floor(w / TILE);
  const rows = Math.floor(h / TILE);
  elements.currentImageSize.textContent = state.image
    ? `${state.image.width} x ${state.image.height} px`
    : "0 x 0 px";
  elements.pendingImageSize.textContent = isPendingResize()
    ? `${getImageWidth()} x ${getImageHeight()} px`
    : "None";
  elements.resizeImageBtn.disabled = !state.image || !isPendingResize();
  elements.tileCount.textContent = `${columns} x ${rows} = ${columns * rows}`;
  elements.exportSize.textContent = `${w} x ${h} px`;

  [...elements.quickSizes.children].forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.w) === w && Number(button.dataset.h) === h);
  });
}

function buildQuickSizes() {
  elements.quickSizes.textContent = "";
  if (!state.image) return;

  const maxW = Math.floor(getImageWidth() / TILE) * TILE;
  const maxH = Math.floor(getImageHeight() / TILE) * TILE;
  const candidates = [
    [maxW, maxH],
    [maxW, Math.max(TILE, maxH - TILE)],
    [Math.max(TILE, maxW - TILE), maxH],
    [Math.max(TILE, maxW - TILE), Math.max(TILE, maxH - TILE)],
    [TILE * 8, TILE * 8],
    [TILE * 6, TILE * 6],
    [TILE * 4, TILE * 4],
    [TILE, TILE]
  ];

  const seen = new Set();
  candidates
    .filter(([w, h]) => w <= maxW && h <= maxH && w >= TILE && h >= TILE)
    .forEach(([w, h]) => {
      const key = `${w}x${h}`;
      if (seen.has(key)) return;
      seen.add(key);

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = key;
      button.dataset.w = String(w);
      button.dataset.h = String(h);
      button.addEventListener("click", () => setSelection({
        ...state.selection,
        w,
        h
      }));
      elements.quickSizes.appendChild(button);
    });
}

function resizeSurface(preserveImageCenter = true) {
  if (!state.image) return;

  const oldCenter = {
    x: state.imageRect.x + state.imageRect.w / 2,
    y: state.imageRect.y + state.imageRect.h / 2
  };
  const imageW = getImageWidth();
  const imageH = getImageHeight();
  const surfaceW = Math.ceil(Math.max(imageW * 3, imageW + SURFACE_PAD * 2, elements.stage.clientWidth * 2));
  const surfaceH = Math.ceil(Math.max(imageH * 3, imageH + SURFACE_PAD * 2, elements.stage.clientHeight * 2));

  elements.canvas.width = surfaceW;
  elements.canvas.height = surfaceH;
  state.imageRect.w = imageW;
  state.imageRect.h = imageH;

  if (preserveImageCenter && oldCenter.x > 0 && oldCenter.y > 0) {
    state.imageRect.x = clamp(Math.round(oldCenter.x - imageW / 2), 0, surfaceW - imageW);
    state.imageRect.y = clamp(Math.round(oldCenter.y - imageH / 2), 0, surfaceH - imageH);
  } else {
    state.imageRect.x = Math.round((surfaceW - imageW) / 2);
    state.imageRect.y = Math.round((surfaceH - imageH) / 2);
  }

  applyCanvasZoom();
}

function draw() {
  if (!state.image) return;

  const imageRect = state.imageRect;
  const { x, y, w, h } = state.selection;
  const sx = imageRect.x + x;
  const sy = imageRect.y + y;

  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  ctx.imageSmoothingEnabled = false;
  drawCanvasBackdrop();
  ctx.drawImage(state.image, imageRect.x, imageRect.y, imageRect.w, imageRect.h);

  ctx.save();
  ctx.fillStyle = "rgba(5, 8, 12, 0.58)";
  ctx.beginPath();
  ctx.rect(imageRect.x, imageRect.y, imageRect.w, imageRect.h);
  ctx.rect(sx, sy, w, h);
  ctx.fill("evenodd");
  ctx.restore();

  drawGrid(sx, sy, w, h);
  drawSelectionBorder(sx, sy, w, h);
  drawImageResizeBorder();
}

function drawCanvasBackdrop() {
  ctx.save();
  ctx.fillStyle = "#0a0e12";
  ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= elements.canvas.width; x += 64) {
    crispLine(x, 0, x, elements.canvas.height);
  }
  for (let y = 0; y <= elements.canvas.height; y += 64) {
    crispLine(0, y, elements.canvas.width, y);
  }

  ctx.restore();
}

function setZoom(nextZoom, anchor) {
  if (!state.image) return;

  const oldPoint = anchor ? getPointerPosition(anchor) : null;
  state.zoom = clamp(nextZoom, 0.2, 32);
  applyCanvasZoom();

  if (anchor && oldPoint) {
    const stageRect = elements.stage.getBoundingClientRect();
    elements.stage.scrollLeft = elements.canvas.offsetLeft + oldPoint.x * state.zoom - (anchor.clientX - stageRect.left);
    elements.stage.scrollTop = elements.canvas.offsetTop + oldPoint.y * state.zoom - (anchor.clientY - stageRect.top);
  } else {
    centerCanvasView();
  }

  updateCursor();
}

function applyCanvasZoom() {
  if (!state.image) return;
  elements.canvas.style.width = `${Math.max(1, Math.round(elements.canvas.width * state.zoom))}px`;
  elements.canvas.style.height = `${Math.max(1, Math.round(elements.canvas.height * state.zoom))}px`;
}

function fitInitialZoom() {
  const stageWidth = Math.max(1, elements.stage.clientWidth - 48);
  const stageHeight = Math.max(1, elements.stage.clientHeight - 48);
  const fit = Math.min(stageWidth / state.imageRect.w, stageHeight / state.imageRect.h);
  state.zoom = clamp(fit, 0.25, 8);
  applyCanvasZoom();
  requestAnimationFrame(() => {
    elements.stage.scrollLeft = Math.max(0, state.imageRect.x * state.zoom - (elements.stage.clientWidth - state.imageRect.w * state.zoom) / 2);
    elements.stage.scrollTop = Math.max(0, state.imageRect.y * state.zoom - (elements.stage.clientHeight - state.imageRect.h * state.zoom) / 2);
  });
}

function centerCanvasView() {
  elements.stage.scrollLeft = Math.max(0, (elements.stage.scrollWidth - elements.stage.clientWidth) / 2);
  elements.stage.scrollTop = Math.max(0, (elements.stage.scrollHeight - elements.stage.clientHeight) / 2);
}

function updateCursor() {
  if (!state.image) return;
  if (state.spaceDown || state.pan) {
    elements.stage.classList.add("panning");
    elements.canvas.style.cursor = state.pan ? "grabbing" : "grab";
    return;
  }

  elements.stage.classList.remove("panning");
}

function drawGrid(x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "rgba(110, 231, 183, 0.52)";
  ctx.lineWidth = 1;

  for (let gx = x; gx <= x + w; gx += TILE) {
    crispLine(gx, y, gx, y + h);
  }
  for (let gy = y; gy <= y + h; gy += TILE) {
    crispLine(x, gy, x + w, gy);
  }

  ctx.restore();
}

function drawSelectionBorder(x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "#5da7ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));

  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4, y + 4, Math.max(0, w - 8), Math.max(0, h - 8));
  ctx.setLineDash([]);

  ctx.fillStyle = "#6ee7b7";
  ctx.strokeStyle = "#071016";
  ctx.lineWidth = 1;
  getSelectionHandles().forEach((handle) => {
    ctx.fillRect(handle.x - 4, handle.y - 4, 8, 8);
    ctx.strokeRect(handle.x - 4, handle.y - 4, 8, 8);
  });
  ctx.restore();
}

function drawImageResizeBorder() {
  const { x, y, w, h } = state.imageRect;

  ctx.save();
  ctx.strokeStyle = isPendingResize() ? "#ffbf69" : "#ff8c6f";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
  ctx.setLineDash([]);

  ctx.fillStyle = isPendingResize() ? "#ffbf69" : "#ff8c6f";
  ctx.strokeStyle = "#071016";
  ctx.lineWidth = 1;
  getImageHandles().forEach((handle) => {
    ctx.fillRect(handle.x - 5, handle.y - 5, 10, 10);
    ctx.strokeRect(handle.x - 5, handle.y - 5, 10, 10);
  });
  ctx.restore();
}

function crispLine(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  ctx.stroke();
}

function getSelectionHandles() {
  const { x, y, w, h } = state.selection;
  const ox = state.imageRect.x;
  const oy = state.imageRect.y;
  return [
    { name: "nw", x: ox + x, y: oy + y, cursor: "nwse-resize" },
    { name: "ne", x: ox + x + w, y: oy + y, cursor: "nesw-resize" },
    { name: "sw", x: ox + x, y: oy + y + h, cursor: "nesw-resize" },
    { name: "se", x: ox + x + w, y: oy + y + h, cursor: "nwse-resize" }
  ];
}

function getImageHandles() {
  const { x, y, w, h } = state.imageRect;
  const outside = Math.max(10, 16 / state.zoom);
  return [
    { name: "nw", x: x - outside, y: y - outside, cursor: "nwse-resize" },
    { name: "ne", x: x + w + outside, y: y - outside, cursor: "nesw-resize" },
    { name: "sw", x: x - outside, y: y + h + outside, cursor: "nesw-resize" },
    { name: "se", x: x + w + outside, y: y + h + outside, cursor: "nwse-resize" },
    { name: "n", x: x + w / 2, y: y - outside, cursor: "ns-resize" },
    { name: "s", x: x + w / 2, y: y + h + outside, cursor: "ns-resize" },
    { name: "w", x: x - outside, y: y + h / 2, cursor: "ew-resize" },
    { name: "e", x: x + w + outside, y: y + h / 2, cursor: "ew-resize" }
  ];
}

function getPointerPosition(event) {
  const rect = elements.canvas.getBoundingClientRect();
  const scaleX = elements.canvas.width / rect.width;
  const scaleY = elements.canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function hitTest(point) {
  const handleRadius = Math.max(6, 12 / state.zoom);
  const imageHandle = getImageHandles().find((item) => (
    Math.abs(point.x - item.x) <= handleRadius && Math.abs(point.y - item.y) <= handleRadius
  ));
  if (imageHandle) return { type: "image-resize", edge: imageHandle.name, cursor: imageHandle.cursor };

  const selectionHandle = getSelectionHandles().find((item) => (
    Math.abs(point.x - item.x) <= handleRadius && Math.abs(point.y - item.y) <= handleRadius
  ));
  if (selectionHandle) return { type: "selection-resize", edge: selectionHandle.name, cursor: selectionHandle.cursor };

  const imagePoint = toImagePoint(point);
  const { x, y, w, h } = state.selection;
  if (imagePoint.x >= x && imagePoint.x <= x + w && imagePoint.y >= y && imagePoint.y <= y + h) {
    return { type: "selection-move", cursor: "move" };
  }

  if (point.x >= state.imageRect.x && point.x <= state.imageRect.x + state.imageRect.w &&
    point.y >= state.imageRect.y && point.y <= state.imageRect.y + state.imageRect.h) {
    return { type: "image", cursor: "crosshair" };
  }

  return { type: "none", cursor: "default" };
}

function toImagePoint(point) {
  return {
    x: point.x - state.imageRect.x,
    y: point.y - state.imageRect.y
  };
}

function onPointerDown(event) {
  if (!state.image) return;

  if (state.spaceDown) {
    event.preventDefault();
    elements.stage.setPointerCapture(event.pointerId);
    state.pan = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: elements.stage.scrollLeft,
      scrollTop: elements.stage.scrollTop
    };
    updateCursor();
    return;
  }

  const point = getPointerPosition(event);
  const hit = hitTest(point);
  if (hit.type === "none" || hit.type === "image") return;

  elements.stage.setPointerCapture(event.pointerId);
  state.pointer = {
    type: hit.type,
    edge: hit.edge,
    start: point,
    originalSelection: { ...state.selection },
    originalImageRect: { ...state.imageRect }
  };
}

function onPointerMove(event) {
  if (!state.image) return;

  if (state.pan) {
    event.preventDefault();
    elements.stage.scrollLeft = state.pan.scrollLeft - (event.clientX - state.pan.startX);
    elements.stage.scrollTop = state.pan.scrollTop - (event.clientY - state.pan.startY);
    return;
  }

  const point = getPointerPosition(event);

  if (!state.pointer) {
    const hit = hitTest(point);
    elements.canvas.style.cursor = state.spaceDown ? "grab" : hit.cursor;
    return;
  }

  const dx = point.x - state.pointer.start.x;
  const dy = point.y - state.pointer.start.y;

  if (state.pointer.type === "selection-move") {
    setSelection({
      ...state.pointer.originalSelection,
      x: state.pointer.originalSelection.x + dx,
      y: state.pointer.originalSelection.y + dy
    });
    return;
  }

  if (state.pointer.type === "selection-resize") {
    resizeSelectionFromPointer(state.pointer.originalSelection, state.pointer.edge, dx, dy);
    return;
  }

  if (state.pointer.type === "image-resize") {
    resizeImageFromPointer(state.pointer.originalImageRect, state.pointer.edge, dx, dy);
  }
}

function resizeSelectionFromPointer(original, edge, dx, dy) {
  let left = original.x;
  let top = original.y;
  let right = original.x + original.w;
  let bottom = original.y + original.h;
  const imageW = getImageWidth();
  const imageH = getImageHeight();

  if (edge.includes("w")) left = clamp(original.x + dx, 0, right - TILE);
  if (edge.includes("e")) right = clamp(original.x + original.w + dx, left + TILE, imageW);
  if (edge.includes("n")) top = clamp(original.y + dy, 0, bottom - TILE);
  if (edge.includes("s")) bottom = clamp(original.y + original.h + dy, top + TILE, imageH);

  let w = snapTile(right - left);
  let h = snapTile(bottom - top);
  let x = left;
  let y = top;

  if (edge.includes("w")) x = right - w;
  if (edge.includes("n")) y = bottom - h;

  setSelection({ x, y, w, h });
}

function resizeImageFromPointer(original, edge, dx, dy) {
  let left = original.x;
  let top = original.y;
  let right = original.x + original.w;
  let bottom = original.y + original.h;

  if (edge.includes("w")) left = clamp(original.x + dx, 0, right - MIN_IMAGE_SIZE);
  if (edge.includes("e")) right = clamp(original.x + original.w + dx, left + MIN_IMAGE_SIZE, elements.canvas.width);
  if (edge.includes("n")) top = clamp(original.y + dy, 0, bottom - MIN_IMAGE_SIZE);
  if (edge.includes("s")) bottom = clamp(original.y + original.h + dy, top + MIN_IMAGE_SIZE, elements.canvas.height);

  const nextW = clamp(Math.round(right - left), MIN_IMAGE_SIZE, MAX_IMAGE_SIZE);
  const nextH = clamp(Math.round(bottom - top), MIN_IMAGE_SIZE, MAX_IMAGE_SIZE);
  const center = { x: (left + right) / 2, y: (top + bottom) / 2 };

  state.imageRect.w = nextW;
  state.imageRect.h = nextH;
  state.imageRect.x = Math.round(center.x - nextW / 2);
  state.imageRect.y = Math.round(center.y - nextH / 2);
  resizeSurface(true);
  buildQuickSizes();
  state.selection = normalizeSelection(state.selection);
  syncControls();
  draw();
}

function onPointerUp(event) {
  if (state.pan) {
    if (elements.stage.hasPointerCapture(event.pointerId)) {
      elements.stage.releasePointerCapture(event.pointerId);
    }
    state.pan = null;
    updateCursor();
    return;
  }

  if (state.pointer && elements.stage.hasPointerCapture(event.pointerId)) {
    elements.stage.releasePointerCapture(event.pointerId);
  }
  state.pointer = null;
}

async function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    URL.revokeObjectURL(url);
    state.image = image;
    state.imageName = cleanName(file.name.replace(/\.[^.]+$/, "")) || "tiles";
    state.imageRect = { x: 0, y: 0, w: image.width, h: image.height };

    resizeSurface(false);
    elements.canvas.classList.add("ready");
    elements.emptyState.style.display = "none";
    elements.imageSize.textContent = `${image.width} x ${image.height}px`;

    const w = Math.floor(image.width / TILE) * TILE;
    const h = Math.floor(image.height / TILE) * TILE;
    setControlsEnabled(w >= TILE && h >= TILE);
    buildQuickSizes();
    fitInitialZoom();
    setSelection({ x: 0, y: 0, w, h });
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    alert("That image could not be loaded.");
  };
  image.src = url;
}

function cleanName(name) {
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function onInputChange() {
  setSelection({
    x: Number(elements.inputs.x.value),
    y: Number(elements.inputs.y.value),
    w: Number(elements.inputs.w.value),
    h: Number(elements.inputs.h.value)
  });
}

function centerSelection() {
  if (!state.image) return;
  setSelection({
    ...state.selection,
    x: Math.floor((getImageWidth() - state.selection.w) / 2),
    y: Math.floor((getImageHeight() - state.selection.h) / 2)
  });
}

function maxSelection() {
  if (!state.image) return;
  setSelection({
    x: 0,
    y: 0,
    w: Math.floor(getImageWidth() / TILE) * TILE,
    h: Math.floor(getImageHeight() / TILE) * TILE
  });
}

function applyImageResize() {
  if (!state.image || !isPendingResize()) return;

  const resized = document.createElement("canvas");
  resized.width = getImageWidth();
  resized.height = getImageHeight();
  const resizedCtx = resized.getContext("2d");
  resizedCtx.imageSmoothingEnabled = false;
  resizedCtx.drawImage(state.image, 0, 0, resized.width, resized.height);

  state.image = resized;
  state.imageRect.w = resized.width;
  state.imageRect.h = resized.height;
  elements.imageSize.textContent = `${resized.width} x ${resized.height}px`;
  resizeSurface(true);
  buildQuickSizes();
  setSelection(state.selection);
}

async function downloadTiles() {
  if (!state.image || state.selection.w < TILE || state.selection.h < TILE) return;

  elements.downloadBtn.disabled = true;
  elements.downloadBtn.textContent = "Building ZIP...";

  try {
    const files = await renderTiles();
    const zip = createZip(files);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zip);
    link.download = `${state.imageName || "tiles"}_${state.selection.w}x${state.selection.h}_32px.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    elements.downloadBtn.textContent = "Download ZIP";
    elements.downloadBtn.disabled = false;
  }
}

async function renderTiles() {
  const source = getExportSource();
  const output = document.createElement("canvas");
  output.width = TILE;
  output.height = TILE;
  const outputCtx = output.getContext("2d");
  outputCtx.imageSmoothingEnabled = false;

  const files = [];
  const columns = state.selection.w / TILE;
  const rows = state.selection.h / TILE;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      outputCtx.clearRect(0, 0, TILE, TILE);
      outputCtx.drawImage(
        source,
        state.selection.x + column * TILE,
        state.selection.y + row * TILE,
        TILE,
        TILE,
        0,
        0,
        TILE,
        TILE
      );
      const blob = await canvasToBlob(output);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const tileNumber = row * columns + column + 1;
      files.push({
        name: `${tileNumber}.png`,
        bytes
      });
    }
  }

  return files;
}

function getExportSource() {
  if (!isPendingResize()) return state.image;

  const resized = document.createElement("canvas");
  resized.width = getImageWidth();
  resized.height = getImageHeight();
  const resizedCtx = resized.getContext("2d");
  resizedCtx.imageSmoothingEnabled = false;
  resizedCtx.drawImage(state.image, 0, 0, resized.width, resized.height);
  return resized;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = getDosDateTime(new Date());

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    writeHeader(localView, {
      signature: 0x04034b50,
      version: 20,
      flags: 0,
      method: 0,
      dosTime,
      dosDate,
      crc,
      size: file.bytes.length,
      nameLength: nameBytes.length
    });
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, file.bytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    writeHeader(centralView, {
      offset: 2,
      signature: 0,
      version: 20,
      flags: 0,
      method: 0,
      dosTime,
      dosDate,
      crc,
      size: file.bytes.length,
      nameLength: nameBytes.length
    });
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.bytes.length;
  });

  const centralStart = offset;
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralStart, true);

  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function writeHeader(view, options) {
  const offset = options.offset || 0;
  if (options.signature) view.setUint32(offset, options.signature, true);
  view.setUint16(offset + 4, options.version, true);
  view.setUint16(offset + 6, options.flags, true);
  view.setUint16(offset + 8, options.method, true);
  view.setUint16(offset + 10, options.dosTime, true);
  view.setUint16(offset + 12, options.dosDate, true);
  view.setUint32(offset + 14, options.crc, true);
  view.setUint32(offset + 18, options.size, true);
  view.setUint32(offset + 22, options.size, true);
  view.setUint16(offset + 26, options.nameLength, true);
  view.setUint16(offset + 28, 0, true);
}

function getDosDateTime(date) {
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function handleDroppedFile(event) {
  event.preventDefault();
  elements.stage.classList.remove("drop-ready");
  elements.dropZone.classList.remove("dragging");
  loadFile(event.dataTransfer.files[0]);
}

elements.fileInput.addEventListener("change", (event) => loadFile(event.target.files[0]));
elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("dragging");
});
elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("dragging"));
elements.dropZone.addEventListener("drop", handleDroppedFile);
elements.stage.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.stage.classList.add("drop-ready");
});
elements.stage.addEventListener("dragleave", (event) => {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  elements.stage.classList.remove("drop-ready");
});
elements.stage.addEventListener("drop", handleDroppedFile);
Object.values(elements.inputs).forEach((input) => input.addEventListener("change", onInputChange));
elements.maxBtn.addEventListener("click", maxSelection);
elements.centerBtn.addEventListener("click", centerSelection);
elements.resizeImageBtn.addEventListener("click", applyImageResize);
elements.downloadBtn.addEventListener("click", downloadTiles);
elements.stage.addEventListener("wheel", (event) => {
  if (!state.image) return;
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  setZoom(state.zoom * factor, event);
}, { passive: false });
elements.stage.addEventListener("pointerdown", onPointerDown);
elements.stage.addEventListener("pointermove", onPointerMove);
elements.stage.addEventListener("pointerup", onPointerUp);
elements.stage.addEventListener("pointercancel", onPointerUp);

document.addEventListener("keydown", (event) => {
  const tagName = event.target && event.target.tagName;
  if (event.code !== "Space" || tagName === "INPUT" || tagName === "TEXTAREA") return;
  event.preventDefault();
  state.spaceDown = true;
  updateCursor();
});

document.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return;
  state.spaceDown = false;
  if (state.pan) {
    if (elements.stage.hasPointerCapture(state.pan.pointerId)) {
      elements.stage.releasePointerCapture(state.pan.pointerId);
    }
    state.pan = null;
  }
  updateCursor();
});

setControlsEnabled(false);
