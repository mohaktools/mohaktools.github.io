(() => {
  "use strict";

  const PDFLIB_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
  const JSZIP_SRC = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  const filesInput = document.getElementById("pdf-files");
  const fileList = document.getElementById("pdf-file-list");
  const dropzone = document.getElementById("pdf-dropzone");
  const modeInput = document.getElementById("pdf-mode");
  const processButton = document.getElementById("pdf-process");
  const status = document.getElementById("pdf-status");
  const preview = document.getElementById("pdf-preview");
  const previewPlaceholder = document.getElementById("pdf-preview-placeholder");
  const downloadButton = document.getElementById("pdf-download");
  const resultMeta = document.getElementById("pdf-result-meta");
  let files = [];
  let resultBlob = null;
  let resultName = "prepared.pdf";
  let previewUrl = "";
  let busy = false;
  let pdfLibPromise;
  let zipPromise;

  function loadScript(src, check, currentPromise) {
    if (check()) return Promise.resolve();
    if (currentPromise) return currentPromise;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => check() ? resolve() : reject(new Error("The file library failed to initialize."));
      script.onerror = () => reject(new Error("Could not load the PDF library. Check your connection and retry."));
      document.head.appendChild(script);
    });
  }

  function ensurePdfLib() {
    pdfLibPromise = loadScript(PDFLIB_SRC, () => Boolean(window.PDFLib), pdfLibPromise).catch(error => {
      pdfLibPromise = null;
      throw error;
    });
    return pdfLibPromise;
  }

  function ensureZip() {
    zipPromise = loadScript(JSZIP_SRC, () => Boolean(window.JSZip), zipPromise).catch(error => {
      zipPromise = null;
      throw error;
    });
    return zipPromise;
  }

  function prettySize(size) {
    return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function setStatus(message, error = false) {
    status.textContent = message;
    status.style.color = error ? "var(--color-danger)" : "";
  }

  function updateControls() {
    const mode = modeInput.value;
    document.getElementById("pdf-extract-options").hidden = mode !== "extract";
    processButton.disabled = busy || (mode === "merge" ? files.length < 2 : files.length !== 1);
    document.getElementById("pdf-clear").disabled = busy || files.length === 0;
  }

  function addFiles(incoming) {
    const valid = [];
    for (const file of incoming) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setStatus(`${file.name} is not a PDF and was skipped.`, true);
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        setStatus(`${file.name} is larger than 100 MB and was skipped.`, true);
        continue;
      }
      if (!files.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) valid.push(file);
    }
    files = [...files, ...valid];
    if (valid.length) clearResult();
    renderFiles();
    if (valid.length) setStatus(`${valid.length} PDF${valid.length === 1 ? "" : "s"} added.`);
  }

  function renderFiles() {
    fileList.replaceChildren();
    files.forEach((file, index) => {
      const row = document.createElement("div");
      row.className = "file-list-row";
      const icon = document.createElement("span");
      icon.className = "file-list-thumb";
      icon.style.display = "grid";
      icon.style.placeItems = "center";
      icon.style.color = "var(--color-primary)";
      icon.style.fontWeight = "800";
      icon.textContent = "PDF";
      const copy = document.createElement("div");
      copy.className = "file-list-copy";
      const name = document.createElement("div");
      name.className = "file-list-name";
      name.textContent = file.name;
      const meta = document.createElement("div");
      meta.className = "file-list-meta";
      meta.textContent = `${prettySize(file.size)} · File ${index + 1}`;
      copy.append(name, meta);
      const actions = document.createElement("div");
      actions.className = "file-list-actions";
      actions.append(
        listAction("↑", "up", index, index === 0, `Move ${file.name} up`),
        listAction("↓", "down", index, index === files.length - 1, `Move ${file.name} down`),
        listAction("×", "remove", index, false, `Remove ${file.name}`)
      );
      row.append(icon, copy, actions);
      fileList.appendChild(row);
    });
    updateControls();
  }

  function listAction(text, action, index, disabled, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.dataset.index = String(index);
    button.disabled = disabled || busy;
    button.textContent = text;
    button.setAttribute("aria-label", label);
    return button;
  }

  function parsePageRanges(value, pageCount) {
    if (!value.trim()) return Array.from({ length: pageCount }, (_, index) => index);
    const pages = new Set();
    for (const rawPart of value.split(",")) {
      const match = rawPart.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error(`Invalid page range: “${rawPart.trim()}”. Use a format such as 1-3, 5.`);
      const start = Number(match[1]);
      const end = Number(match[2] || match[1]);
      if (start < 1 || end < start || end > pageCount) throw new Error(`Pages must be between 1 and ${pageCount}, and each range must go from low to high.`);
      for (let page = start; page <= end; page += 1) pages.add(page - 1);
    }
    return [...pages].sort((a, b) => a - b);
  }

  function previewBlob(blob, name, detail) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    resultBlob = blob;
    resultName = name;
    previewUrl = URL.createObjectURL(blob);
    preview.src = previewUrl;
    preview.hidden = false;
    previewPlaceholder.hidden = true;
    resultMeta.textContent = detail;
    downloadButton.disabled = false;
  }

  function clearResult() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    preview.removeAttribute("src");
    preview.hidden = true;
    previewPlaceholder.hidden = false;
    resultBlob = null;
    downloadButton.disabled = true;
    resultMeta.textContent = "Your prepared PDF will appear here.";
  }

  async function processFiles() {
    if (busy || !files.length) return;
    const mode = modeInput.value;
    if ((mode === "merge" && files.length < 2) || (mode !== "merge" && files.length !== 1)) {
      setStatus(mode === "merge" ? "Add at least two PDF files to merge." : "Choose one PDF for splitting or page extraction.", true);
      return;
    }

    busy = true;
    updateControls();
    downloadButton.disabled = true;
    setStatus("Loading PDF tools…");
    try {
      await ensurePdfLib();
      const { PDFDocument } = window.PDFLib;

      if (mode === "merge") {
        const merged = await PDFDocument.create();
        let totalPages = 0;
        for (const file of files) {
          setStatus(`Reading ${file.name}…`);
          const pdf = await PDFDocument.load(await file.arrayBuffer());
          const pages = await merged.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => merged.addPage(page));
          totalPages += pages.length;
        }
        const bytes = await merged.save({ useObjectStreams: true });
        const blob = new Blob([bytes], { type: "application/pdf" });
        previewBlob(blob, "merged.pdf", `${files.length} files · ${totalPages} pages · ${prettySize(blob.size)}`);
        setStatus("Merge is ready. Check the preview, then choose Download prepared file.");
      } else {
        const source = await PDFDocument.load(await files[0].arrayBuffer());
        const pageCount = source.getPageCount();
        const selected = mode === "extract"
          ? parsePageRanges(document.getElementById("pdf-ranges").value, pageCount)
          : Array.from({ length: pageCount }, (_, index) => index);

        if (mode === "extract") {
          const output = await PDFDocument.create();
          const pages = await output.copyPages(source, selected);
          pages.forEach(page => output.addPage(page));
          const blob = new Blob([await output.save({ useObjectStreams: true })], { type: "application/pdf" });
          previewBlob(blob, "extracted-pages.pdf", `${pages.length} of ${pageCount} pages · ${prettySize(blob.size)}`);
          setStatus("Page extraction is ready. Check the preview before downloading.");
        } else {
          await ensureZip();
          const zip = new window.JSZip();
          let firstPdf = null;
          for (let index = 0; index < selected.length; index += 1) {
            setStatus(`Preparing page ${index + 1} of ${selected.length}…`);
            const output = await PDFDocument.create();
            const [page] = await output.copyPages(source, [selected[index]]);
            output.addPage(page);
            const bytes = await output.save({ useObjectStreams: true });
            if (index === 0) firstPdf = new Blob([bytes], { type: "application/pdf" });
            zip.file(`page-${String(index + 1).padStart(3, "0")}.pdf`, bytes);
          }
          const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
          previewBlob(firstPdf, "split-pages.zip", `${selected.length} single-page PDFs · ZIP · ${prettySize(blob.size)}`);
          resultBlob = blob;
          resultName = "split-pages.zip";
          setStatus("Split preview is ready. The preview shows page 1; download the ZIP for all pages.");
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not process this PDF. Check the file and try again.", true);
    } finally {
      busy = false;
      updateControls();
    }
  }

  filesInput.addEventListener("change", () => {
    addFiles(Array.from(filesInput.files || []));
    filesInput.value = "";
  });
  dropzone.addEventListener("dragover", event => { event.preventDefault(); dropzone.classList.add("is-dragging"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
  dropzone.addEventListener("drop", event => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    addFiles(Array.from(event.dataTransfer.files || []));
  });
  modeInput.addEventListener("change", () => {
    clearResult();
    updateControls();
  });
  fileList.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button || busy) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "remove") files.splice(index, 1);
    if (button.dataset.action === "up" && index > 0) [files[index - 1], files[index]] = [files[index], files[index - 1]];
    if (button.dataset.action === "down" && index < files.length - 1) [files[index + 1], files[index]] = [files[index], files[index + 1]];
    clearResult();
    renderFiles();
  });
  processButton.addEventListener("click", processFiles);
  document.getElementById("pdf-clear").addEventListener("click", () => {
    files = [];
    renderFiles();
    clearResult();
    setStatus("Files cleared.");
  });
  downloadButton.addEventListener("click", () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = resultName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  window.addEventListener("beforeunload", () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
  updateControls();
})();
