/* =========================================
   MohakTools — Global Theme Controller
   File: assets/js/theme.js
   ========================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "mohaktools-theme";
  const VALID_THEMES = ["light", "dark", "system"];
  const root = document.documentElement;
  const colorSchemeQuery = window.matchMedia(
    "(prefers-color-scheme: dark)"
  );

  let currentTheme = "system";

  // Read the saved theme safely.
  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      return VALID_THEMES.includes(saved) ? saved : "system";
    } catch {
      return "system";
    }
  }

  // Save the selected theme safely.
  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn("MohakTools: Theme preference could not be saved.");
    }
  }

  // Resolve system preference into a real display theme.
  function resolveTheme(theme) {
    if (theme === "system") {
      return colorSchemeQuery.matches ? "dark" : "light";
    }

    return theme;
  }

  // Apply the theme globally.
  function applyTheme(theme, options = {}) {
    if (!VALID_THEMES.includes(theme)) {
      theme = "system";
    }

    const previousTheme = root.dataset.theme;
    const resolvedTheme = resolveTheme(theme);

    currentTheme = theme;

    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = theme;

    // Update browser controls and supported form elements.
    root.style.colorScheme = resolvedTheme;

    // Update theme selector controls on the current page.
    document.querySelectorAll("[data-theme-selector]").forEach((control) => {
      control.value = theme;
    });

    // Update buttons that display a theme label.
    document.querySelectorAll("[data-theme-label]").forEach((element) => {
      element.textContent =
        theme.charAt(0).toUpperCase() + theme.slice(1);
    });

    // Update toggle buttons and accessibility labels.
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute(
        "aria-label",
        resolvedTheme === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      );

      button.setAttribute(
        "aria-pressed",
        String(resolvedTheme === "dark")
      );
    });

    // Persist unless this is an operating-system preference update.
    if (options.save !== false) {
      saveTheme(theme);
    }

    // Notify other site components.
    if (previousTheme !== resolvedTheme || options.forceEvent) {
      window.dispatchEvent(
        new CustomEvent("mohak:themechange", {
          detail: {
            theme,
            resolvedTheme
          }
        })
      );
    }
  }

  // Set a specific theme.
  function setTheme(theme) {
    if (!VALID_THEMES.includes(theme)) {
      console.warn("MohakTools: Invalid theme:", theme);
      return;
    }

    applyTheme(theme);
  }

  // Toggle between explicit light and dark themes.
  function toggleTheme() {
    const resolvedTheme = resolveTheme(currentTheme);

    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  // Reset the theme to system default.
  function resetTheme() {
    setTheme("system");
  }

  // Listen for theme selector changes.
  document.addEventListener("change", (event) => {
    const selector = event.target.closest("[data-theme-selector]");

    if (selector) {
      setTheme(selector.value);
    }
  });

  // Listen for theme toggle button clicks.
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");

    if (button) {
      toggleTheme();
    }
  });

  // React to operating-system theme changes.
  function handleSystemThemeChange() {
    if (currentTheme === "system") {
      applyTheme("system", {
        save: false,
        forceEvent: true
      });
    }
  }

  if (typeof colorSchemeQuery.addEventListener === "function") {
    colorSchemeQuery.addEventListener("change", handleSystemThemeChange);
  } else {
    // Compatibility with older browsers.
    colorSchemeQuery.addListener(handleSystemThemeChange);
  }

  // React to theme changes made in another tab.
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      applyTheme(getSavedTheme(), {
        save: false,
        forceEvent: true
      });
    }
  });

  // Public API for all MohakTools pages.
  window.MohakTheme = Object.freeze({
    get() {
      return currentTheme;
    },

    getResolved() {
      return resolveTheme(currentTheme);
    },

    set: setTheme,
    toggle: toggleTheme,
    reset: resetTheme
  });

  // Apply the saved preference immediately.
  applyTheme(getSavedTheme(), {
    save: false,
    forceEvent: true
  });
})();