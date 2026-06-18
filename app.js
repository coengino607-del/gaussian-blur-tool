const state = {
  file: null,
  image: null,
  sourceUrl: "",
  blur: 12,
  mode: "processed",
  format: "png",
  quality: 92,
  previewTimer: 0,
  isExporting: false,
};

const LARGE_IMAGE_PIXELS = 12_000_000;
const MAX_PREVIEW_EDGE = 1800;

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropInput: document.querySelector("#dropInput"),
  dropZone: document.querySelector("#dropZone"),
  blurSlider: document.querySelector("#blurSlider"),
  blurNumber: document.querySelector("#blurNumber"),
  radiusPresets: document.querySelectorAll("[data-radius]"),
  processedMode: document.querySelector("#processedMode"),
  compareMode: document.querySelector("#compareMode"),
  fitToggle: document.querySelector("#fitToggle"),
  pngFormat: document.querySelector("#pngFormat"),
  jpegFormat: document.querySelector("#jpegFormat"),
  qualityField: document.querySelector("#qualityField"),
  qualitySlider: document.querySelector("#qualitySlider"),
  qualityNumber: document.querySelector("#qualityNumber"),
  resetButton: document.querySelector("#resetButton"),
  pasteButton: document.querySelector("#pasteButton"),
  downloadButton: document.querySelector("#downloadButton"),
  downloadTopButton: document.querySelector("#downloadTopButton"),
  copySettingsButton: document.querySelector("#copySettingsButton"),
  imageState: document.querySelector("#imageState"),
  stageTitle: document.querySelector("#stageTitle"),
  canvasWrap: document.querySelector("#canvasWrap"),
  originalPreview: document.querySelector("#originalPreview"),
  processedPreview: document.querySelector("#processedPreview"),
  workCanvas: document.querySelector("#workCanvas"),
  parameterReadout: document.querySelector("#parameterReadout"),
  fileName: document.querySelector("#fileName"),
  imageSize: document.querySelector("#imageSize"),
  exportName: document.querySelector("#exportName"),
  processMode: document.querySelector("#processMode"),
  formatPill: document.querySelector("#formatPill"),
  message: document.querySelector("#message"),
};

function setMessage(text, tone = "success") {
  els.message.textContent = text;
  els.message.className = `parse-message ${tone === "success" ? "" : tone}`.trim();
}

function getExportExtension() {
  return state.format === "jpeg" ? "jpg" : "png";
}

function getExportName() {
  if (!state.file) return "-";
  const baseName = state.file.name.replace(/\.[^.]+$/, "");
  return `${baseName}-gaussian-${state.blur}px.${getExportExtension()}`;
}

function setActive(button, active) {
  button.classList.toggle("active", active);
}

function getPixelCount() {
  return state.image ? state.image.naturalWidth * state.image.naturalHeight : 0;
}

function getMegapixels() {
  return (getPixelCount() / 1_000_000).toFixed(1);
}

function getPreviewDimensions() {
  if (!state.image) return { width: 0, height: 0, scale: 1 };

  const { naturalWidth, naturalHeight } = state.image;
  const scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(naturalWidth, naturalHeight));
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
    scale,
  };
}

function syncReadouts() {
  els.blurSlider.value = String(state.blur);
  els.blurNumber.value = String(state.blur);
  els.qualitySlider.value = String(state.quality);
  els.qualityNumber.value = String(state.quality);
  els.parameterReadout.textContent =
    state.format === "jpeg"
      ? `Blur radius: ${state.blur}px; JPEG quality: ${state.quality}%`
      : `Blur radius: ${state.blur}px`;
  els.fileName.textContent = state.file?.name ?? "-";
  els.imageSize.textContent = state.image
    ? `${state.image.naturalWidth} x ${state.image.naturalHeight}px`
    : "-";
  els.exportName.textContent = getExportName();
  els.processMode.textContent = state.image
    ? getPixelCount() > LARGE_IMAGE_PIXELS
      ? `大图预览优化 / 原尺寸导出 (${getMegapixels()} MP)`
      : "预览优化 / 原尺寸导出"
    : "预览优化 / 原尺寸导出";
  els.formatPill.textContent = state.format.toUpperCase();
  els.imageState.textContent = state.image
    ? getPixelCount() > LARGE_IMAGE_PIXELS
      ? "大图"
      : "已加载"
    : "未上传";
  els.stageTitle.textContent = state.image
    ? `${state.image.naturalWidth} x ${state.image.naturalHeight}`
    : "等待图片";

  setActive(els.processedMode, state.mode === "processed");
  setActive(els.compareMode, state.mode === "compare");
  setActive(els.pngFormat, state.format === "png");
  setActive(els.jpegFormat, state.format === "jpeg");
  els.radiusPresets.forEach((button) => {
    setActive(button, Number(button.dataset.radius) === state.blur);
  });
  els.qualityField.style.display = state.format === "jpeg" ? "grid" : "none";

  els.downloadButton.disabled = !state.image || state.isExporting;
  els.downloadTopButton.disabled = !state.image || state.isExporting;
  els.downloadButton.textContent = state.isExporting ? "正在导出..." : "下载处理后的图片";
  els.downloadTopButton.textContent = state.isExporting ? "导出中..." : "导出图片";
  els.canvasWrap.classList.toggle("has-image", Boolean(state.image));
  els.canvasWrap.classList.toggle("compare", state.mode === "compare");
  els.canvasWrap.classList.toggle("fit-off", !els.fitToggle.checked);
}

function drawBlurredImage(context, image, width, height, radius) {
  if (radius <= 0) {
    context.drawImage(image, 0, 0, width, height);
    return;
  }

  const padding = Math.ceil(radius * 3);
  const paddedWidth = width + padding * 2;
  const paddedHeight = height + padding * 2;
  const sourceCanvas = document.createElement("canvas");
  const blurCanvas = document.createElement("canvas");
  sourceCanvas.width = blurCanvas.width = paddedWidth;
  sourceCanvas.height = blurCanvas.height = paddedHeight;

  const sourceContext = sourceCanvas.getContext("2d");
  sourceContext.drawImage(image, padding, padding, width, height);

  // Extend edge pixels before blurring so the result behaves more like an image editor.
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  sourceContext.drawImage(image, 0, 0, 1, sourceHeight, 0, padding, padding, height);
  sourceContext.drawImage(
    image,
    sourceWidth - 1,
    0,
    1,
    sourceHeight,
    padding + width,
    padding,
    padding,
    height
  );
  sourceContext.drawImage(image, 0, 0, sourceWidth, 1, padding, 0, width, padding);
  sourceContext.drawImage(
    image,
    0,
    sourceHeight - 1,
    sourceWidth,
    1,
    padding,
    padding + height,
    width,
    padding
  );
  sourceContext.drawImage(image, 0, 0, 1, 1, 0, 0, padding, padding);
  sourceContext.drawImage(image, sourceWidth - 1, 0, 1, 1, padding + width, 0, padding, padding);
  sourceContext.drawImage(image, 0, sourceHeight - 1, 1, 1, 0, padding + height, padding, padding);
  sourceContext.drawImage(
    image,
    sourceWidth - 1,
    sourceHeight - 1,
    1,
    1,
    padding + width,
    padding + height,
    padding,
    padding
  );

  const blurContext = blurCanvas.getContext("2d");
  blurContext.filter = `blur(${radius}px)`;
  blurContext.drawImage(sourceCanvas, 0, 0);
  blurContext.filter = "none";
  context.drawImage(blurCanvas, padding, padding, width, height, 0, 0, width, height);
}

function renderProcessedPreview() {
  if (!state.image) {
    els.processedPreview.removeAttribute("src");
    return;
  }

  const canvas = els.workCanvas;
  const context = canvas.getContext("2d");
  const preview = getPreviewDimensions();
  canvas.width = preview.width;
  canvas.height = preview.height;
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBlurredImage(context, state.image, canvas.width, canvas.height, state.blur * preview.scale);
  els.processedPreview.src = canvas.toDataURL("image/png");
}

function schedulePreviewRender() {
  window.clearTimeout(state.previewTimer);
  state.previewTimer = window.setTimeout(renderProcessedPreview, 80);
}

function updateAll() {
  syncReadouts();
  schedulePreviewRender();
}

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setMessage("请选择一张图片文件。");
    return;
  }

  if (state.sourceUrl) {
    URL.revokeObjectURL(state.sourceUrl);
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    state.file = file;
    state.image = image;
    state.sourceUrl = url;
    els.originalPreview.src = url;
    const pixels = image.naturalWidth * image.naturalHeight;
    if (pixels > LARGE_IMAGE_PIXELS) {
      setMessage(
        `已加载 ${getMegapixels()} MP 大图。预览会自动优化尺寸，导出时仍按原图尺寸处理，可能需要几秒。`,
        "warning"
      );
    } else {
      setMessage("图片已加载，可以调整模糊半径并导出。");
    }
    updateAll();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setMessage("图片加载失败，请换一张图片试试。");
  };
  image.src = url;
}

async function pasteImageFromClipboard() {
  if (!navigator.clipboard?.read) {
    setMessage("当前浏览器不支持按钮读取剪贴板图片，请直接在页面中按 Ctrl+V 粘贴。");
    return;
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) continue;

      const blob = await item.getType(imageType);
      const extension = imageType.split("/")[1] || "png";
      const file = new File([blob], `clipboard-image.${extension}`, { type: imageType });
      loadFile(file);
      return;
    }
    setMessage("剪贴板里没有可用的图片。你可以先截图或复制图片，再回到这里粘贴。");
  } catch {
    setMessage("浏览器没有允许读取剪贴板。请点击页面后直接按 Ctrl+V 粘贴图片。");
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function setBlur(value) {
  state.blur = clampNumber(value, 0, 120);
  updateAll();
}

function setQuality(value) {
  state.quality = clampNumber(value, 40, 100);
  syncReadouts();
}

function getExportBlob() {
  return new Promise((resolve, reject) => {
    if (!state.image) {
      reject(new Error("No image loaded"));
      return;
    }

    const canvas = els.workCanvas;
    const context = canvas.getContext("2d");
    canvas.width = state.image.naturalWidth;
    canvas.height = state.image.naturalHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawBlurredImage(context, state.image, canvas.width, canvas.height, state.blur);

    const mimeType = state.format === "jpeg" ? "image/jpeg" : "image/png";
    const quality = state.format === "jpeg" ? state.quality / 100 : undefined;
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, mimeType, quality);
  });
}

async function downloadImage() {
  if (!state.image || state.isExporting) return;

  state.isExporting = true;
  syncReadouts();
  setMessage(
    getPixelCount() > LARGE_IMAGE_PIXELS
      ? "正在按原图尺寸处理大图，请稍等几秒。"
      : "正在生成导出图片...",
    "busy"
  );

  await new Promise((resolve) => window.setTimeout(resolve, 40));

  try {
    const blob = await getExportBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getExportName();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`已生成下载文件：${getExportName()}`);
  } catch {
    setMessage("导出失败。图片可能过大，请降低图片尺寸后再试。", "warning");
  } finally {
    state.isExporting = false;
    syncReadouts();
  }
}

function resetTool() {
  if (state.sourceUrl) {
    URL.revokeObjectURL(state.sourceUrl);
  }
  state.file = null;
  state.image = null;
  state.sourceUrl = "";
  state.blur = 12;
  state.mode = "processed";
  state.format = "png";
  state.quality = 92;
  state.isExporting = false;
  window.clearTimeout(state.previewTimer);
  els.fileInput.value = "";
  els.dropInput.value = "";
  els.originalPreview.removeAttribute("src");
  els.processedPreview.removeAttribute("src");
  setMessage("图片不会上传到服务器，所有处理都在你的浏览器里完成。可以直接 Ctrl+V 粘贴图片。");
  syncReadouts();
}

els.fileInput.addEventListener("change", (event) => {
  loadFile(event.target.files?.[0]);
});

els.dropInput.addEventListener("change", (event) => {
  loadFile(event.target.files?.[0]);
});

els.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropZone.classList.add("drag-over");
});

els.dropZone.addEventListener("dragleave", () => {
  els.dropZone.classList.remove("drag-over");
});

els.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropZone.classList.remove("drag-over");
  loadFile(event.dataTransfer.files?.[0]);
});

els.blurSlider.addEventListener("input", (event) => setBlur(event.target.value));
els.blurNumber.addEventListener("input", (event) => setBlur(event.target.value));
els.qualitySlider.addEventListener("input", (event) => setQuality(event.target.value));
els.qualityNumber.addEventListener("input", (event) => setQuality(event.target.value));
els.radiusPresets.forEach((button) => {
  button.addEventListener("click", () => setBlur(button.dataset.radius));
});

els.processedMode.addEventListener("click", () => {
  state.mode = "processed";
  syncReadouts();
});

els.compareMode.addEventListener("click", () => {
  state.mode = "compare";
  syncReadouts();
});

els.fitToggle.addEventListener("change", syncReadouts);

els.pngFormat.addEventListener("click", () => {
  state.format = "png";
  syncReadouts();
});

els.jpegFormat.addEventListener("click", () => {
  state.format = "jpeg";
  syncReadouts();
});

els.resetButton.addEventListener("click", resetTool);
els.pasteButton.addEventListener("click", pasteImageFromClipboard);
els.downloadButton.addEventListener("click", downloadImage);
els.downloadTopButton.addEventListener("click", downloadImage);

els.copySettingsButton.addEventListener("click", async () => {
  const text = state.image
    ? `Gaussian Blur: ${state.blur}px, Format: ${state.format.toUpperCase()}, Size: ${state.image.naturalWidth}x${state.image.naturalHeight}`
    : `Gaussian Blur: ${state.blur}px, Format: ${state.format.toUpperCase()}`;
  await navigator.clipboard.writeText(text);
  setMessage("参数已复制。");
});

window.addEventListener("paste", (event) => {
  const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
    entry.type.startsWith("image/")
  );
  const file = item?.getAsFile();
  if (file) {
    event.preventDefault();
    setMessage("已从剪贴板读取图片。");
    loadFile(file);
  }
});

syncReadouts();
