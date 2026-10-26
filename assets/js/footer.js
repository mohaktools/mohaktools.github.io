/* =========================================
   MohakTools — Shared Footer
   File: assets/js/footer.js

   Features:
   - Centralized light/dark theme colors
   - Registry-only category links (no fallback)
   - Registry-driven popular tools
   - Dedicated /tools/ navigation
   - Information links
   - Responsive footer layout
   - Accessible keyboard focus states
   - Safe HTML escaping
   - Automatic copyright year
   - Waits for registry initialization
   - Automatically creates missing footer mount
   ========================================= */

(() => {
  "use strict";

  let mount = document.getElementById("site-footer");

  if (!mount) {
    mount = document.createElement("div");
    mount.id = "site-footer";
    document.body.append(mount);
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

  mount.innerHTML = `
    <style>
      .mt-footer {
        margin-top: 64px;
        padding: 52px 0 24px;
        background: var(--color-surface);
        border-top: 1px solid var(--color-border);
        color: var(--color-text);
        font-size: 16px;
        line-height: 1.6;
      }

      .mt-footer *,
      .mt-footer *::before,
      .mt-footer *::after {
        box-sizing: border-box;
      }

      .mt-footer-inner {
        width: min(calc(100% - 40px), 1200px);
        margin-inline: auto;
      }

      .mt-footer-grid {
        display: grid;
        grid-template-columns:
          minmax(220px, 1.5fr)
          repeat(3, minmax(140px, 1fr));
        gap: 36px;
        padding-bottom: 40px;
      }

      .mt-footer-about {
        max-width: 350px;
      }

      .mt-footer-brand-link {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        border-radius: var(--radius-md);
        color: var(--color-text);
        text-decoration: none;
      }

      .mt-footer-brand-link:hover {
        color: var(--color-text);
        text-decoration: none;
      }

      .mt-footer-logo {
        display: grid;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        place-items: center;
        overflow: hidden;
        border-radius: 10px;
        background: var(--color-primary);
        color: var(--color-primary-text);
        font-size: 1rem;
        font-weight: 800;
      }

      .mt-footer-logo img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .mt-footer-brand {
        color: var(--color-text);
        font-size: 1.2rem;
        font-weight: 800;
        letter-spacing: -0.035em;
        line-height: 1.25;
      }

      .mt-footer-description {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: 0.94rem;
        line-height: 1.8;
      }

      .mt-footer-all-tools {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        margin-top: 18px;
        color: var(--color-primary);
        font-size: 0.92rem;
        font-weight: 700;
        text-decoration: none;
      }

      .mt-footer-all-tools:hover {
        text-decoration: underline;
      }

      .mt-footer-heading {
        margin: 5px 0 17px;
        color: var(--color-text);
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.075em;
        line-height: 1.5;
        text-transform: uppercase;
      }

      .mt-footer-links {
        display: grid;
        justify-items: start;
        gap: 11px;
      }

      .mt-footer-links a {
        display: inline-block;
        max-width: 100%;
        color: var(--color-text-secondary);
        font-size: 0.93rem;
        line-height: 1.5;
        text-decoration: none;
        overflow-wrap: anywhere;
        transition: color 160ms ease;
      }

      .mt-footer-links a:hover {
        color: var(--color-primary);
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .mt-footer a:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 4px;
        border-radius: 3px;
      }

      .mt-footer-bottom {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px 24px;
        padding-top: 22px;
        border-top: 1px solid var(--color-border);
      }

      .mt-footer-bottom p {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: 0.86rem;
        line-height: 1.7;
      }

      .mt-footer-bottom-links {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 18px;
      }

      .mt-footer-bottom-links a {
        color: var(--color-text-secondary);
        font-size: 0.86rem;
        text-decoration: none;
      }

      .mt-footer-bottom-links a:hover {
        color: var(--color-primary);
        text-decoration: underline;
      }

      .mt-footer [hidden] {
        display: none !important;
      }

      @media (max-width: 1000px) {
        .mt-footer-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 34px 40px;
        }

        .mt-footer-about {
          max-width: 480px;
        }
      }

      @media (max-width: 560px) {
        .mt-footer {
          margin-top: 44px;
          padding: 38px 0 20px;
        }

        .mt-footer-inner {
          width: min(calc(100% - 32px), 1200px);
        }

        .mt-footer-grid {
          grid-template-columns: minmax(0, 1fr);
          gap: 30px;
          padding-bottom: 30px;
        }

        .mt-footer-about {
          max-width: 100%;
        }

        .mt-footer-heading {
          margin-bottom: 13px;
        }

        .mt-footer-links {
          gap: 10px;
        }

        .mt-footer-bottom {
          align-items: flex-start;
          flex-direction: column;
          gap: 12px;
          padding-top: 18px;
        }

        .mt-footer-bottom-links {
          gap: 10px 16px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mt-footer *,
        .mt-footer *::before,
        .mt-footer *::after {
          scroll-behavior: auto !important;
          transition-duration: 0.01ms !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    </style>

    <footer class="mt-footer">
      <div class="mt-footer-inner">
        <div class="mt-footer-grid">

          <section class="mt-footer-about"
                   aria-label="About MohakTools">
            <a class="mt-footer-brand-link"
               href="/"
               aria-label="MohakTools home">
              <span class="mt-footer-logo" aria-hidden="true">
                <img
                  src="/favicon.webp"
                  alt=""
                  width="36"
                  height="36"
                >
              </span>
              <span class="mt-footer-brand">MohakTools</span>
            </a>

            <p class="mt-footer-description">
              Useful online tools for calculations, conversions,
              productivity, text processing, development and everyday
              digital tasks. Simple tools designed to work when you
              need them.
            </p>

            <a class="mt-footer-all-tools" href="/tools/">
              Explore all tools
              <span aria-hidden="true">→</span>
            </a>
          </section>

          <section>
            <h2 class="mt-footer-heading">Categories</h2>
            <nav
              class="mt-footer-links"
              id="mt-footer-categories"
              aria-label="Tool categories"
            ></nav>
          </section>

          <section id="mt-footer-popular-section">
            <h2 class="mt-footer-heading">Popular tools</h2>
            <nav
              class="mt-footer-links"
              id="mt-footer-popular"
              aria-label="Popular tools"
            ></nav>
          </section>

          <section>
            <h2 class="mt-footer-heading">Information</h2>
            <nav
              class="mt-footer-links"
              aria-label="Information navigation"
            >
              <a href="/about/">About Us</a>
              <a href="/contact/">Contact</a>
              <a href="/feedback/">Give Feedback</a>
              <a href="/privacy-policy/">Privacy Policy</a>
              <a href="/terms/">Terms of Use</a>
            </nav>
          </section>

        </div>

        <div class="mt-footer-bottom">
          <p>
            &copy; <span id="mt-footer-year"></span>
            MohakTools. All rights reserved.
          </p>

          <nav
            class="mt-footer-bottom-links"
            aria-label="Additional navigation"
          >
            <a href="/">Home</a>
            <a href="/tools/">All tools</a>
            <a href="/contact/">Contact</a>
          </nav>
        </div>
      </div>
    </footer>
  `;

  const yearElement = mount.querySelector("#mt-footer-year");
  const logoImage = mount.querySelector(".mt-footer-logo img");

  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }

  if (logoImage) {
    logoImage.addEventListener("error", () => {
      const logo = logoImage.parentElement;
      logoImage.remove();
      logo.textContent = "M";
    }, { once: true });

    if (logoImage.complete && logoImage.naturalWidth === 0) {
      logoImage.dispatchEvent(new Event("error"));
    }
  }

  function renderCategories(categories) {
    const container = mount.querySelector("#mt-footer-categories");
    if (!container) return;

    const validCategories = Array.isArray(categories)
      ? categories.filter(category =>
          category &&
          typeof category.id === "string" &&
          category.id.trim() &&
          typeof category.name === "string" &&
          category.name.trim()
        )
      : [];

    container.innerHTML = validCategories.map(category => `
      <a href="/tools/#${encodeURIComponent(category.id)}">
        ${escapeHTML(category.name)}
      </a>
    `).join("");
  }

  function renderPopular(tools) {
    const container = mount.querySelector("#mt-footer-popular");
    const section = mount.querySelector("#mt-footer-popular-section");

    if (!container || !section) return;

    const validTools = Array.isArray(tools)
      ? tools.filter(tool =>
          tool &&
          typeof tool.name === "string" &&
          typeof tool.url === "string" &&
          tool.url.trim()
        ).slice(0, 6)
      : [];

    section.hidden = validTools.length === 0;

    container.innerHTML = validTools.map(tool => `
      <a href="${escapeHTML(tool.url)}">
        ${escapeHTML(tool.name)}
      </a>
    `).join("");
  }

  function initializeFooter() {
    const registry = window.MohakToolsRegistry;

    if (!registry) {
      console.error(
        "MohakTools footer: tools-registry.js is not loaded."
      );
      renderCategories([]);
      renderPopular([]);
      return;
    }

    const renderFromRegistry = () => {
      try {
        const ready =
          typeof registry.isReady === "function" &&
          registry.isReady();

        if (!ready) {
          renderCategories([]);
          renderPopular([]);
          return;
        }

        const categories =
          typeof registry.getCategories === "function"
            ? registry.getCategories()
            : [];

        const popular =
          typeof registry.getPopular === "function"
            ? registry.getPopular(6)
            : [];

        renderCategories(categories);
        renderPopular(popular);
      } catch (error) {
        console.error(
          "MohakTools footer: unable to read registry.",
          error
        );
        renderCategories([]);
        renderPopular([]);
      }
    };

    if (registry.ready && typeof registry.ready.then === "function") {
      registry.ready.then(renderFromRegistry).catch(error => {
        console.error(
          "MohakTools footer: registry failed to load.",
          error
        );
        renderCategories([]);
        renderPopular([]);
      });

      return;
    }

    renderFromRegistry();
  }

  document.addEventListener(
    "mohaktools:registry-ready",
    initializeFooter
  );

  initializeFooter();
})();
