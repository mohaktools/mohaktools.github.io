(() => {
  "use strict";

  const fileInput = document.getElementById("bg-file");
  const dropzone = document.getElementById("bg-dropzone");
  const originalPreview = document.getElementById("bg-original");
  const resultCanvas = document.getElementById("bg-result");
  const status = document.getElementById("bg-status");
  const processButton = document.getElementById("bg-process");
  const downloadButton = document.getElementById("bg-download");
  const colorInput = document.getElementById("bg-color");
  let selectedFile = null;
  let sourceUrl = "";
  let outputBlob = null;
  let sampleMode = false;
  let busy = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? "var(--color-danger)" : "";
  }

  function setImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Choose an image file to continue.", true);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus("This image is larger than 20 MB. Choose a smaller one.", true);
      return;
    }
    selectedFile = file;
    outputBlob = null;
    downloadButton.disabled = true;
    resultCanvas.hidden = true;
    document.getElementById("bg-result-placeholder").hidden = false;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    originalPreview.src = sourceUrl;
    originalPreview.hidden = false;
    document.getElementById("bg-original-placeholder").hidden = true;
    document.getElementById("bg-sample").disabled = false;
    processButton.disabled = false;
    document.getElementById("bg-clear").disabled = false;
    setStatus(`${file.name} ready. Choose or sample its background color.`);
  }

  function hexToRgb(hex) {
    return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  }

  function pixelDistance(data, offset, target) {
    const red = data[offset] - target[0];
    const green = data[offset + 1] - target[1];
    const blue = data[offset + 2] - target[2];
    return Math.sqrt((red * red + green * green + blue * blue) / 3);
  }

  function applyBackgroundRemoval() {
    if (!selectedFile || busy) return;
    busy = true;
    processButton.disabled = true;
    setStatus("Reading image pixels…");

    const image = new Image();
    image.onerror = () => {
      busy = false;
      processButton.disabled = !selectedFile;
      setStatus("This image could not be opened. Try a different file.", true);
    };
    image.onload = () => {
      try {
        const scale = Math.min(1, Math.sqrt(24_000_000 / (image.naturalWidth * image.naturalHeight)));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        resultCanvas.width = width;
        resultCanvas.height = height;
        const context = resultCanvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, width, height);

        const imageData = context.getImageData(0, 0, width, height);
        const { data } = imageData;
        const pixelCount = width * height;
        const visited = new Uint8Array(pixelCount);
        const background = new Uint8Array(pixelCount);
        const queue = new Uint32Array(pixelCount);
        const target = hexToRgb(colorInput.value);
        const tolerance = Number(document.getElementById("bg-tolerance").value);
        const softness = Number(document.getElementById("bg-softness").value);
        const maxDistance = tolerance + softness;
        let head = 0;
        let tail = 0;

        function testPixel(index) {
          if (visited[index]) return;
          visited[index] = 1;
          if (pixelDistance(data, index * 4, target) <= maxDistance) {
            background[index] = 1;
            queue[tail] = index;
            tail += 1;
          }
        }

        for (let x = 0; x < width; x += 1) {
          testPixel(x);
          testPixel((height - 1) * width + x);
        }
        for (let y = 0; y < height; y += 1) {
          testPixel(y * width);
          testPixel(y * width + width - 1);
        }

        while (head < tail) {
          const index = queue[head];
          head += 1;
          const x = index % width;
          const y = Math.floor(index / width);
          if (x > 0) testPixel(index - 1);
          if (x + 1 < width) testPixel(index + 1);
          if (y > 0) testPixel(index - width);
          if (y + 1 < height) testPixel(index + width);
        }

        for (let index = 0; index < pixelCount; index += 1) {
          if (!background[index]) continue;
          const offset = index * 4;
          const distance = pixelDistance(data, offset, target);
          const alpha = softness > 0 ? Math.max(0, Math.min(1, (distance - tolerance) / softness)) : 0;
          data[offset + 3] = Math.round(data[offset + 3] * alpha);
        }

        context.putImageData(imageData, 0, 0);
        resultCanvas.hidden = false;
        document.getElementById("bg-result-placeholder").hidden = true;
        resultCanvas.toBlob(blob => {
          outputBlob = blob;
          downloadButton.disabled = !blob;
          setStatus(blob
            ? `Preview ready at ${width} × ${height}. Review the edges, adjust the controls, or download the transparent PNG.`
            : "The browser could not create a PNG from this image.", !blob);
          busy = false;
          processButton.disabled = !selectedFile;
        }, "image/png");
      } catch (error) {
        busy = false;
        processButton.disabled = !selectedFile;
        setStatus(error instanceof Error ? error.message : "Could not process this image. Try a smaller file.", true);
      }
    };
    image.src = sourceUrl;
  }

  function sampleBackground(event) {
    if (!sampleMode) return;
    const bounds = originalPreview.getBoundingClientRect();
    const x = Math.max(0, Math.min(originalPreview.naturalWidth - 1, Math.floor((event.clientX - bounds.left) / bounds.width * originalPreview.naturalWidth)));
    const y = Math.max(0, Math.min(originalPreview.naturalHeight - 1, Math.floor((event.clientY - bounds.top) / bounds.height * originalPreview.naturalHeight)));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = originalPreview.naturalWidth;
    sampleCanvas.height = originalPreview.naturalHeight;
    const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(originalPreview, 0, 0);
    const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
    colorInput.value = `#${[red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("")}`;
    sampleMode = false;
    originalPreview.classList.remove("is-sampling");
    document.getElementById("bg-sample").textContent = "Pick from image";
    setStatus("Background color sampled. Remove the background to refresh the preview.");
  }

  fileInput.addEventListener("change", () => setImage(fileInput.files[0]));
  dropzone.addEventListener("dragover", event => { event.preventDefault(); dropzone.classList.add("is-dragging"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
  dropzone.addEventListener("drop", event => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    setImage(event.dataTransfer.files[0]);
  });
  document.getElementById("bg-sample").addEventListener("click", event => {
    sampleMode = !sampleMode;
    originalPreview.classList.toggle("is-sampling", sampleMode);
    event.currentTarget.textContent = sampleMode ? "Click a background pixel…" : "Pick from image";
    setStatus(sampleMode ? "Click a point in the original image to sample its color." : "Color sampling cancelled.");
  });
  originalPreview.addEventListener("click", sampleBackground);
  document.getElementById("bg-tolerance").addEventListener("input", event => {
    document.getElementById("bg-tolerance-value").value = event.target.value;
  });
  document.getElementById("bg-softness").addEventListener("input", event => {
    document.getElementById("bg-softness-value").value = event.target.value;
  });
  processButton.addEventListener("click", applyBackgroundRemoval);
  downloadButton.addEventListener("click", () => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(selectedFile?.name || "image").replace(/\.[^.]+$/, "")}-transparent.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Transparent PNG downloaded.");
  });
  document.getElementById("bg-clear").addEventListener("click", () => {
    selectedFile = null;
    outputBlob = null;
    fileInput.value = "";
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = "";
    originalPreview.removeAttribute("src");
    originalPreview.hidden = true;
    document.getElementById("bg-original-placeholder").hidden = false;
    resultCanvas.hidden = true;
    document.getElementById("bg-result-placeholder").hidden = false;
    document.getElementById("bg-sample").disabled = true;
    processButton.disabled = true;
    downloadButton.disabled = true;
    document.getElementById("bg-clear").disabled = true;
    setStatus("Image cleared.");
  });
  window.addEventListener("beforeunload", () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); });
})();
