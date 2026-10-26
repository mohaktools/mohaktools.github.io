/* =========================================
   MohakTools — Shared Search
   File: assets/js/search.js
   Requires: tools-registry.js

   Two behaviours on every search field it finds:
     1. Autocomplete — type "ala" and matching tools appear
        instantly; arrow keys move, Enter opens, Escape closes.
     2. Submit — Enter with nothing highlighted runs the full
        search and renders a results section.
   ========================================= */

(() => {
  "use strict";

  const registry = window.MohakToolsRegistry;
  if (!registry) {
    console.error("MohakTools: Load tools-registry.js before search.js.");
    return;
  }

  const INPUT_SELECTOR = "#home-search, #mt-header-search-input, [data-tool-search]";
  const MAX_SUGGESTIONS = 7;
  const DEBOUNCE_MS = 90;

  const escapeHTML = value =>
    String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  function injectStyles() {
    if (document.getElementById("mt-search-styles")) return;
    const style = document.createElement("style");
    style.id = "mt-search-styles";
    style.textContent = `
      .mt-search-field { position: relative; }

      .mt-suggest {
        position: absolute;
        z-index: 1200;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        margin: 0;
        padding: 6px;
        list-style: none;
        max-height: 340px;
        overflow-y: auto;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: 0 12px 30px var(--color-card-shadow);
      }

      .mt-suggest[hidden] { display: none; }

      .mt-suggest-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 10px;
        border-radius: 8px;
        cursor: pointer;
      }

      .mt-suggest-item:hover,
      .mt-suggest-item.is-active {
        background: var(--color-surface-secondary);
      }

      .mt-suggest-icon {
        display: grid;
        flex: 0 0 auto;
        width: 34px;
        height: 34px;
        place-items: center;
        border-radius: 9px;
        background: var(--color-surface-secondary);
        color: var(--color-primary);
        font-weight: 700;
      }

      .mt-suggest-item.is-active .mt-suggest-icon {
        background: var(--color-primary);
        color: var(--color-primary-text);
      }

      .mt-suggest-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .mt-suggest-text strong {
        color: var(--color-text);
        font-size: 0.95rem;
        font-weight: 600;
      }

      .mt-suggest-text small {
        color: var(--color-text-secondary);
        font-size: 0.8rem;
      }

      #mt-search-results { padding-block: 20px; }

      .mt-search-results-heading { margin-bottom: 16px; }

      .mt-search-results-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .mt-search-empty {
        padding: 24px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
      }

      @media (max-width: 900px) {
        .mt-search-results-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 420px) {
        .mt-search-results-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------- results rendering ---------- */

  function createResultsContainer() {
    let container = document.getElementById("mt-search-results");
    if (container) return container;

    const main = document.querySelector("main");
    if (!main) return null;

    container = document.createElement("section");
    container.id = "mt-search-results";
    container.className = "container";
    container.hidden = true;
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-label", "Search results");
    main.prepend(container);
    return container;
  }

  function renderResults(query, results) {
    const container = createResultsContainer();
    if (!container) return;

    container.hidden = false;

    const cards = results
      .map(
        tool => `
        <a class="tool-card" href="${escapeHTML(tool.url)}">
          <span class="tool-icon" aria-hidden="true">${escapeHTML(tool.icon)}</span>
          <h3>${escapeHTML(tool.name)}</h3>
          <p class="tool-card-description">${escapeHTML(tool.description)}</p>
        </a>`
      )
      .join("");

    container.innerHTML = `
      <div class="mt-search-results-heading">
        <h2>Search results</h2>
        <p class="text-muted">
          ${results.length} result${results.length === 1 ? "" : "s"}
          for &ldquo;${escapeHTML(query)}&rdquo;
        </p>
      </div>
      ${
        results.length
          ? `<div class="mt-search-results-grid">${cards}</div>`
          : `<div class="mt-search-empty">
               <h3>No matching tools found</h3>
               <p>Try a different word, such as calculator, time, text or converter.</p>
             </div>`
      }
    `;

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function runSearch(rawQuery) {
    const query = String(rawQuery == null ? "" : rawQuery).trim();
    if (!query) {
      const first = document.querySelector(INPUT_SELECTOR);
      if (first) first.focus();
      return;
    }

    renderResults(query, registry.search(query));

    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    history.replaceState({}, "", url);
  }

  /* ---------- autocomplete ---------- */

  function setupAutocomplete(input) {
    const form = input.closest("form");
    const field = input.closest(".search-field") || input.parentElement;
    if (!field) return;

    field.classList.add("mt-search-field");

    const list = document.createElement("ul");
    list.className = "mt-suggest";
    list.id = `mt-suggest-${Math.random().toString(36).slice(2, 8)}`;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    field.appendChild(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id);

    let suggestions = [];
    let activeIndex = -1;
    let timer = null;

    const close = () => {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      suggestions = [];
      activeIndex = -1;
    };

    const highlight = index => {
      const items = Array.from(list.children);
      items.forEach(item => item.classList.remove("is-active"));
      if (index >= 0 && items[index]) {
        items[index].classList.add("is-active");
        input.setAttribute("aria-activedescendant", items[index].id);
        items[index].scrollIntoView({ block: "nearest" });
      }
      activeIndex = index;
    };

    const goTo = index => {
      const tool = suggestions[index];
      if (!tool) return;
      window.location.href = tool.url;
    };

    const render = query => {
      suggestions = registry.search(query).slice(0, MAX_SUGGESTIONS);

      if (!suggestions.length) {
        close();
        return;
      }

      list.innerHTML = suggestions
        .map(
          (tool, index) => `
          <li
            class="mt-suggest-item"
            id="${list.id}-opt-${index}"
            role="option"
            aria-selected="false"
            data-index="${index}"
          >
            <span class="mt-suggest-icon" aria-hidden="true">${escapeHTML(tool.icon)}</span>
            <span class="mt-suggest-text">
              <strong>${escapeHTML(tool.name)}</strong>
              <small>${escapeHTML(tool.categoryName)}</small>
            </span>
          </li>`
        )
        .join("");

      activeIndex = -1;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };

    input.addEventListener("input", () => {
      window.clearTimeout(timer);
      const value = input.value.trim();
      if (!value) {
        close();
        return;
      }
      timer = window.setTimeout(() => render(value), DEBOUNCE_MS);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") {
        if (!suggestions.length) return;
        event.preventDefault();
        highlight(activeIndex + 1 >= suggestions.length ? 0 : activeIndex + 1);
      } else if (event.key === "ArrowUp") {
        if (!suggestions.length) return;
        event.preventDefault();
        highlight(activeIndex - 1 < 0 ? suggestions.length - 1 : activeIndex - 1);
      } else if (event.key === "Enter") {
        if (activeIndex >= 0) {
          event.preventDefault();
          goTo(activeIndex);
        } else {
          // Let the form's submit handler run the full search.
          close();
        }
      } else if (event.key === "Escape") {
        if (!list.hidden) {
          event.preventDefault();
          close();
        }
      } else if (event.key === "Tab") {
        close();
      }
    });

    // mousedown (not click) so the input keeps focus until navigation.
    list.addEventListener("mousedown", event => {
      const item = event.target.closest(".mt-suggest-item");
      if (!item) return;
      event.preventDefault();
      goTo(Number(item.dataset.index));
    });

    input.addEventListener("blur", () => {
      window.setTimeout(close, 120);
    });
  }

  /* ---------- wiring ---------- */

  function init() {
    injectStyles();

    document.querySelectorAll(INPUT_SELECTOR).forEach(setupAutocomplete);

    document.addEventListener("submit", event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (form.id === "home-search-form") {
        event.preventDefault();
        runSearch(document.getElementById("home-search")?.value);
      } else if (form.id === "mt-header-search") {
        event.preventDefault();
        const value = document.getElementById("mt-header-search-input")?.value;
        const isHome =
          window.location.pathname === "/" ||
          window.location.pathname.endsWith("/index.html");
        if (isHome) runSearch(value);
        else if (String(value || "").trim()) {
          window.location.href = "/?q=" + encodeURIComponent(value.trim());
        }
      }
    });

    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) {
      document.querySelectorAll(INPUT_SELECTOR).forEach(input => {
        input.value = initial;
      });
      runSearch(initial);
    }
  }

  registry.ready.then(init);

  window.MohakToolsSearch = Object.freeze({
    search: query => registry.search(query),
    run: runSearch
  });
})();
