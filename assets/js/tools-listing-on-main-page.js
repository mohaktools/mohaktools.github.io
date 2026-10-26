
/* =========================================
   MohakTools — Homepage Tool Listings
   File: assets/js/tools-listing-on-main-page.js
   Requires: tools-registry.js

   Features:
   - Renders categories and tool cards from the registry.
   - Reads the saved default category from localStorage.
   - Prioritizes the selected category in homepage listings and chips.
   - Keeps the original registry data unchanged.
   ========================================= */

(() => {
  "use strict";

  const registry = window.MohakToolsRegistry;
  const STORAGE_KEY = "mohaktools-default-category";

  if (!registry) {
    console.error(
      "MohakTools: Load tools-registry.js before tools-listing-on-main-page.js."
    );
    return;
  }

  const escapeHTML = value =>
    String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  function getDefaultCategoryId() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }

  function prioritizeDefaultCategory(categories) {
    const defaultId = getDefaultCategoryId();
    const index = categories.findIndex(category => category.id === defaultId);

    if (!defaultId || index <= 0) {
      return categories.slice();
    }

    return [
      categories[index],
      ...categories.slice(0, index),
      ...categories.slice(index + 1)
    ];
  }

  function createToolCard(tool) {
    return `
      <a
        class="tool-card"
        href="${escapeHTML(tool.url)}"
        data-tool-id="${escapeHTML(tool.id)}"
      >
        <span class="tool-icon" aria-hidden="true">${escapeHTML(tool.icon)}</span>
        <h3>${escapeHTML(tool.name)}</h3>
        <p class="tool-card-description">${escapeHTML(tool.description)}</p>
      </a>
    `;
  }

  function renderCategoryChips(categories) {
    const nav = document.getElementById("category-nav");
    if (!nav) return;

    const orderedCategories = prioritizeDefaultCategory(categories);
    const defaultId = getDefaultCategoryId();

    nav.innerHTML = orderedCategories
      .map(category => {
        const isDefault = category.id === defaultId;

        return `
          <a
            class="category-link"
            href="#${escapeHTML(category.id)}"
            ${isDefault ? 'aria-current="true"' : ""}
          >${escapeHTML(category.name)}${isDefault ? " (Default)" : ""}</a>
        `;
      })
      .join("");
  }

  function getListingMount() {
    let listing = document.getElementById("all-tools-listing");
    if (listing) return listing;

    const main = document.querySelector("main");
    if (!main) return null;

    listing = document.createElement("div");
    listing.id = "all-tools-listing";

    const hero = main.querySelector(".hero");

    if (hero) {
      hero.insertAdjacentElement("afterend", listing);
    } else {
      main.prepend(listing);
    }

    return listing;
  }

  function renderAllCategories() {
    const listing = getListingMount();
    if (!listing) return;

    const categories = prioritizeDefaultCategory(registry.getCategories());

    // Remove static fallback sections for registry-managed categories.
    registry.getCategories().forEach(category => {
      document.getElementById(category.id)?.remove();
    });

    listing.innerHTML = categories
      .map(category => {
        const tools = registry.getByCategory(category.id);
        if (!tools.length) return "";

        const isDefault = category.id === getDefaultCategoryId();

        return `
          <section
            class="container home-section"
            id="${escapeHTML(category.id)}"
            ${isDefault ? 'data-default-category="true"' : ""}
          >
            <div class="home-section-heading">
              <h2>
                ${escapeHTML(category.name)}
                ${isDefault ? '<span class="text-muted"> · Default</span>' : ""}
              </h2>
              <span class="text-muted">
                ${tools.length} tool${tools.length === 1 ? "" : "s"}
              </span>
            </div>
            <div class="tools-grid">
              ${tools.map(createToolCard).join("")}
            </div>
          </section>
        `;
      })
      .join("");
  }

  function initialize() {
    const categories = registry.getCategories();

    renderCategoryChips(categories);
    renderAllCategories();

    document.dispatchEvent(
      new CustomEvent("mohaktools:listings-ready", {
        detail: {
          count: registry.count,
          categories: categories.length,
          defaultCategory: getDefaultCategoryId()
        }
      })
    );
  }

  registry.ready
    .then(initialize)
    .catch(error => {
      console.error("MohakTools: Failed to render homepage listings.", error);
    });

  // Allow settings changes in another tab to refresh the homepage.
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      window.MohakToolsListings?.refresh();
    }
  });

  window.MohakToolsListings = Object.freeze({
    refresh() {
      const categories = registry.getCategories();
      renderCategoryChips(categories);
      renderAllCategories();
    }
  });
})();
