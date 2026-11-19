(() => {
  "use strict";

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const OCR_SCRIPT = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.2/tesseract.min.js";
  const fileInput = document.getElementById("ocr-file");
  const dropzone = document.getElementById("ocr-dropzone");
  const preview = document.getElementById("ocr-preview");
  const previewWrap = document.getElementById("ocr-preview-wrap");
  const status = document.getElementById("ocr-status");
  const output = document.getElementById("ocr-output");
  const runButton = document.getElementById("ocr-run");
  const rotateButton = document.getElementById("ocr-rotate");
  const clearImageButton = document.getElementById("ocr-clear-image");
  const copyButton = document.getElementById("ocr-copy");
  const downloadButton = document.getElementById("ocr-download");
  const clearTextButton = document.getElementById("ocr-clear-text");
  const languageSelect = document.getElementById("ocr-language");
  const rotationSelect = document.getElementById("ocr-rotation");
  const progress = document.getElementById("ocr-progress");
  const progressBar = document.getElementById("ocr-progress-bar");
  const progressLabel = document.getElementById("ocr-progress-label");
  const progressValue = document.getElementById("ocr-progress-value");

  let selectedFile = null;
  let previewUrl = "";
  let tesseractLoading = null;
  let recognitionRunning = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? "var(--color-danger)" : "";
  }

  function updateOutputStats() {
    const text = output.value.trim();
    document.getElementById("ocr-word-count").textContent = text ? String(text.split(/\s+/).length) : "0";
    document.getElementById("ocr-char-count").textContent = String(output.value.length);
    const hasText = output.value.length > 0;
    copyButton.disabled = !hasText;
    downloadButton.disabled = !hasText;
    clearTextButton.disabled = !hasText;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function setFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Choose an image file to continue.", true);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus("This image is larger than 20 MB. Choose a smaller image.", true);
      return;
    }

    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.style.transform = `rotate(${Number(rotationSelect.value)}deg)`;
    previewWrap.classList.add("is-visible");
    document.getElementById("ocr-file-name").textContent = file.name || "Pasted image";
    document.getElementById("ocr-image-size").textContent = formatBytes(file.size);
    runButton.disabled = false;
    rotateButton.disabled = false;
    clearImageButton.disabled = false;
    setStatus("Image ready. Choose settings, then extract the text.");
  }

  function clearImage() {
    selectedFile = null;
    fileInput.value = "";
    preview.removeAttribute("src");
    preview.style.transform = "";
    previewWrap.classList.remove("is-visible");
    runButton.disabled = true;
    rotateButton.disabled = true;
    clearImageButton.disabled = true;
    document.getElementById("ocr-confidence").hidden = true;
    progress.classList.remove("is-visible");
    setStatus("Image removed.");
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractLoading) return tesseractLoading;

    tesseractLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = OCR_SCRIPT;
      script.async = true;
      script.onload = () => window.Tesseract
        ? resolve(window.Tesseract)
        : reject(new Error("The OCR engine did not initialize."));
      script.onerror = () => reject(new Error("Could not load the OCR engine. Check your internet connection and try again."));
      document.head.appendChild(script);
    }).catch(error => {
      tesseractLoading = null;
      throw error;
    });

    return tesseractLoading;
  }

  async function createOcrImage(file) {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, 2800 / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const rotation = Number(rotationSelect.value) * Math.PI / 180;
    const quarterTurn = Math.abs(Math.sin(rotation)) > 0.5;
    const canvas = document.createElement("canvas");
    canvas.width = quarterTurn ? height : width;
    canvas.height = quarterTurn ? width : height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    image.close();

    if (document.getElementById("ocr-enhance").checked) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      const contrast = 1.28;
      for (let index = 0; index < data.length; index += 4) {
        const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
        const enhanced = Math.max(0, Math.min(255, (gray - 128) * contrast + 128));
        data[index] = enhanced;
        data[index + 1] = enhanced;
        data[index + 2] = enhanced;
      }
      context.putImageData(pixels, 0, 0);
    }

    return canvas;
  }

  async function extractText() {
    if (!selectedFile || recognitionRunning) return;
    recognitionRunning = true;
    runButton.disabled = true;
    progress.classList.add("is-visible");
    progress.setAttribute("aria-hidden", "false");
    progressBar.style.width = "0%";
    progressValue.textContent = "0%";
    progressLabel.textContent = "Loading OCR engine…";
    setStatus("Preparing your image. The first run may take a little longer.");

    let worker;
    try {
      const engine = await loadTesseract();
      const languages = languageSelect.value;
      worker = await engine.createWorker({
        logger(message) {
          if (message.status === "recognizing text") {
            const percent = Math.max(0, Math.min(100, Math.round(message.progress * 100)));
            progressBar.style.width = `${percent}%`;
            progressValue.textContent = `${percent}%`;
            progressLabel.textContent = "Recognizing text…";
          } else if (message.status) {
            progressLabel.textContent = message.status.charAt(0).toUpperCase() + message.status.slice(1) + "…";
          }
        }
      });
      await worker.load();
      await worker.loadLanguage(languages);
      await worker.initialize(languages);
      await worker.setParameters({
        tessedit_pageseg_mode: document.getElementById("ocr-layout-mode").value,
        preserve_interword_spaces: "1"
      });

      const image = await createOcrImage(selectedFile);
      const result = await worker.recognize(image);
      output.value = (result.data.text || "").trim();
      updateOutputStats();
      const confidence = Math.round(result.data.confidence || 0);
      const confidenceElement = document.getElementById("ocr-confidence");
      confidenceElement.textContent = `${confidence}% confidence`;
      confidenceElement.hidden = false;
      progressBar.style.width = "100%";
      progressValue.textContent = "100%";
      progressLabel.textContent = "Complete";
      setStatus(output.value ? "Extraction complete. Review the text and correct anything OCR missed." : "No text was recognized. Try a sharper image or another language.");
      output.focus();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "OCR could not read this image. Try another image.", true);
    } finally {
      if (worker) {
        try { await worker.terminate(); } catch (_) { /* The worker may already be stopped. */ }
      }
      recognitionRunning = false;
      runButton.disabled = !selectedFile;
    }
  }

  fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
  dropzone.addEventListener("dragover", event => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
  dropzone.addEventListener("drop", event => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    setFile(event.dataTransfer.files[0]);
  });
  document.addEventListener("paste", event => {
    const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"));
    if (imageItem) setFile(imageItem.getAsFile());
  });
  rotationSelect.addEventListener("change", () => {
    preview.style.transform = `rotate(${Number(rotationSelect.value)}deg)`;
  });
  rotateButton.addEventListener("click", () => {
    rotationSelect.value = String((Number(rotationSelect.value) + 90) % 360);
    rotationSelect.dispatchEvent(new Event("change"));
  });
  runButton.addEventListener("click", extractText);
  clearImageButton.addEventListener("click", clearImage);
  output.addEventListener("input", updateOutputStats);
  clearTextButton.addEventListener("click", () => {
    output.value = "";
    document.getElementById("ocr-confidence").hidden = true;
    updateOutputStats();
    setStatus("Extracted text cleared.");
    output.focus();
  });
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      setStatus("Text copied to clipboard.");
    } catch (_) {
      output.focus();
      output.select();
      setStatus("Clipboard access is unavailable. The text is selected so you can copy it.");
    }
  });
  downloadButton.addEventListener("click", () => {
    const blob = new Blob([output.value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(selectedFile?.name || "recognized-text").replace(/\.[^.]+$/, "")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Text file downloaded.");
  });
  window.addEventListener("beforeunload", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  updateOutputStats();
})();
