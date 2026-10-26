/* =========================================
   MohakTools — Shared Header
   File: assets/js/header.js

   Features:
   - Shared light/dark theme support
   - Registry-driven category navigation
   - No hardcoded category fallback
   - Dedicated /tools/ links
   - Correct active navigation states
   - Responsive mobile navigation
   - Accessible keyboard controls
   - Safe HTML escaping
   - Homepage and internal-page support

   Requires:
   - assets/css/themes.css
   - assets/css/global.css
   - assets/js/theme.js
   - assets/js/tools-registry.js
   ========================================= */

(() => {
  "use strict";

  
let mount = document.getElementById("site-header");

if (!mount) {
  mount = document.createElement("div");
  mount.id = "site-header";
  document.body.prepend(mount);
}

if (mount.dataset.initialized === "true") return;
mount.dataset.initialized = "true";


  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const normalizePath = pathname =>
    pathname.replace(/\/+$/, "") || "/";

  const currentPath = normalizePath(window.location.pathname);
  const isToolsPage = currentPath === "/tools";

  mount.innerHTML = `
    <style>
      .mt-header {
        position: sticky;
        top: 0;
        z-index: 1000;
        width: 100%;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text);
        box-shadow: 0 2px 12px var(--color-card-shadow);
      }

      .mt-header *,
      .mt-header *::before,
      .mt-header *::after {
        box-sizing: border-box;
      }

      .mt-header-inner {
        width: min(calc(100% - 40px), 1200px);
        min-height: 72px;
        margin-inline: auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
      }

      .mt-brand {
        display: inline-flex;
        align-items: center;
        gap: 11px;
        flex-shrink: 0;
        color: var(--color-text);
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.045em;
        text-decoration: none;
        border-radius: var(--radius-md);
      }

      .mt-brand:hover {
        color: var(--color-text);
        text-decoration: none;
      }

      .mt-brand img {
        display: block;
        width: 38px;
        height: 38px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .mt-brand-mark {
        display: none;
        width: 38px;
        height: 38px;
        place-items: center;
        flex-shrink: 0;
        border-radius: 12px;
        background: var(--color-primary);
        color: var(--color-primary-text);
        font-size: 1.1rem;
        font-weight: 800;
      }

      .mt-header-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        margin-left: auto;
      }

      .mt-icon-button {
        display: inline-flex;
        min-width: 42px;
        min-height: 42px;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 9px 13px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-text);
        font: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.2;
        text-decoration: none;
        cursor: pointer;
        transition:
          background-color 180ms ease,
          border-color 180ms ease,
          color 180ms ease,
          transform 180ms ease;
      }

      .mt-icon-button:hover {
        background: var(--color-surface-secondary);
        border-color: var(--color-primary);
        color: var(--color-text);
        text-decoration: none;
      }

      .mt-icon-button:active {
        transform: scale(0.97);
      }

      .mt-icon-button:focus-visible,
      .mt-brand:focus-visible,
      .mt-nav a:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 3px;
      }

      .mt-theme-icon {
        font-size: 1rem;
        line-height: 1;
      }

      .mt-nav {
        border-top: 1px solid var(--color-border);
        background: var(--color-surface);
      }

      .mt-nav-inner {
        width: min(calc(100% - 40px), 1200px);
        min-height: 46px;
        margin-inline: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
      }

      .mt-nav a {
        position: relative;
        display: inline-flex;
        min-height: 42px;
        align-items: center;
        justify-content: center;
        padding: 9px 12px;
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        font-size: 0.9rem;
        font-weight: 550;
        text-decoration: none;
        white-space: nowrap;
        transition:
          color 180ms ease,
          background-color 180ms ease;
      }

      .mt-nav a:hover {
        background: var(--color-surface-secondary);
        color: var(--color-primary);
        text-decoration: none;
      }

      .mt-nav a[aria-current="page"] {
        background: var(--color-surface-secondary);
        color: var(--color-primary);
        font-weight: 700;
      }

      .mt-mobile-menu {
        display: none;
      }

      @media (max-width: 860px) {
        .mt-header-inner {
          width: min(calc(100% - 28px), 1200px);
          min-height: 64px;
          gap: 12px;
        }

        .mt-brand {
          gap: 8px;
          font-size: 1.15rem;
        }

        .mt-brand img,
        .mt-brand-mark {
          width: 34px;
          height: 34px;
        }

        .mt-header-actions {
          gap: 7px;
        }

        .mt-icon-button {
          min-width: 40px;
          min-height: 40px;
          padding: 8px 10px;
        }

        .mt-settings-label,
        .mt-theme-label {
          display: none;
        }

        .mt-mobile-menu {
          display: inline-flex;
        }

        .mt-nav-inner {
          display: none;
          width: min(calc(100% - 28px), 1200px);
          min-height: auto;
          max-height: min(65vh, 460px);
          padding: 10px 0 14px;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .mt-nav-inner.is-open {
          display: flex;
        }

        .mt-nav a {
          width: 100%;
          min-height: 44px;
          justify-content: flex-start;
          padding: 12px 14px;
          white-space: normal;
        }
      }

      @media (max-width: 380px) {
        .mt-header-inner {
          width: calc(100% - 20px);
        }

        .mt-brand {
          font-size: 1.03rem;
        }

        .mt-header-actions {
          gap: 5px;
        }

        .mt-icon-button {
          min-width: 36px;
          min-height: 38px;
          padding: 7px 8px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mt-header *,
        .mt-header *::before,
        .mt-header *::after {
          scroll-behavior: auto !important;
          transition-duration: 0.01ms !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    </style>

    <header class="mt-header">
      <div class="mt-header-inner">
        <a class="mt-brand" href="/" aria-label="MohakTools home">
          <img src="/favicon.webp" alt="" width="38" height="38">
          <span class="mt-brand-mark" aria-hidden="true">M</span>
          <span>MohakTools</span>
        </a>

        <div class="mt-header-actions">
          <button
            class="mt-icon-button"
            type="button"
            data-theme-toggle
            aria-label="Toggle light and dark theme"
            title="Toggle light/dark mode"
          >
            <span class="mt-theme-icon" aria-hidden="true">◐</span>
            <span class="mt-theme-label">Theme</span>
          </button>

          <a
            class="mt-icon-button"
            href="/settings/"
            aria-label="Settings"
            title="Settings"
          >
            <span aria-hidden="true">⚙</span>
            <span class="mt-settings-label">Settings</span>
          </a>

          <button
            class="mt-icon-button mt-mobile-menu"
            type="button"
            id="mt-menu-toggle"
            aria-expanded="false"
            aria-controls="mt-navigation"
            aria-label="Open navigation menu"
          >
            <span class="mt-menu-label">Menu</span>
          </button>
        </div>
      </div>

      <nav class="mt-nav" aria-label="Main navigation">
        <div class="mt-nav-inner" id="mt-navigation"></div>
      </nav>
    </header>
  `;

  const navigation = mount.querySelector("#mt-navigation");
  const menuButton = mount.querySelector("#mt-menu-toggle");
  const logoImage = mount.querySelector(".mt-brand img");
  const logoFallback = mount.querySelector(".mt-brand-mark");

  if (logoImage && logoFallback) {
    const showLogoFallback = () => {
      logoImage.style.display = "none";
      logoFallback.style.display = "grid";
    };

    logoImage.addEventListener("error", showLogoFallback, { once: true });

    if (logoImage.complete && logoImage.naturalWidth === 0) {
      showLogoFallback();
    }
  }

  function closeMobileMenu() {
    navigation.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
  }

  menuButton.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");

    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu"
    );
  });

  function getCategories() {
    const registry = window.MohakToolsRegistry;

    if (
      !registry ||
      typeof registry.getCategories !== "function" ||
      typeof registry.isReady !== "function" ||
      !registry.isReady()
    ) {
      return [];
    }

    const categories = registry.getCategories();

    if (!Array.isArray(categories)) return [];

    return categories.filter(category =>
      category &&
      typeof category.id === "string" &&
      category.id.trim() &&
      typeof category.name === "string" &&
      category.name.trim()
    );
  }

  function renderNav() {
    const categories = getCategories();
    const hash = window.location.hash;

    const links = [
      {
        label: "Home",
        href: "/",
        active: currentPath === "/"
      },
      {
        label: "All tools",
        href: "/tools/",
        active: isToolsPage && !hash
      },
      ...categories.map(category => ({
        label: category.name,
        href: `/tools/#${encodeURIComponent(category.id)}`,
        active: isToolsPage &&
          hash === `#${encodeURIComponent(category.id)}`
      }))
    ];

    navigation.innerHTML = links.map(link => `
      <a
        href="${escapeHTML(link.href)}"
        ${link.active ? 'aria-current="page"' : ""}
      >${escapeHTML(link.label)}</a>
    `).join("");

    navigation.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", closeMobileMenu);
    });
  }

  function initializeNavigation() {
    // Render Home and All tools immediately; categories appear
    // only after the actual registry has loaded successfully.
    renderNav();

    const registry = window.MohakToolsRegistry;

    if (registry?.ready && typeof registry.ready.then === "function") {
      registry.ready.then(renderNav);
    }
  }

  document.addEventListener("mohaktools:registry-ready", renderNav);

  document.addEventListener("click", event => {
    if (
      navigation.classList.contains("is-open") &&
      !mount.contains(event.target)
    ) {
      closeMobileMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      navigation.classList.contains("is-open")
    ) {
      closeMobileMenu();
      menuButton.focus();
    }
  });

  window.addEventListener("hashchange", renderNav);

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) {
      closeMobileMenu();
    }
  });

  initializeNavigation();
})();